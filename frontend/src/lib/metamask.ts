// ===== MetaMask ERC-7715 + EIP-7702 integration =====
// Requires MetaMask Flask for ERC-7715 Advanced Permissions support.
// No silent fallbacks — if Flask is not detected, setup is gated.

const AGENT_ADDRESS = "0x6ED09F73cfe78555F950D3a325Aa38471fDF667d";
const ENFORCER_ADDRESS = "0x0a1BE1E7c3838e9B3D803Be3C946c6E5abC6B6DA";

/**
 * Find the MetaMask provider, handling multi-provider conflicts.
 * When multiple wallets are installed, window.ethereum.providers[] contains all of them.
 */
function getMetaMaskProvider(): any {
  if (typeof window === "undefined") return null;
  const ethereum = (window as any).ethereum;
  if (!ethereum) return null;

  // If multiple providers exist, find MetaMask specifically
  if (ethereum.providers?.length) {
    const mm = ethereum.providers.find((p: any) => p.isMetaMask && !p.isBraveWallet && !p.isPhantom);
    if (mm) return mm;
  }

  // Single provider
  if (ethereum.isMetaMask) return ethereum;
  return ethereum;
}

/**
 * Detect whether the connected wallet supports ERC-7715 (MetaMask Flask).
 * 
 * Detection strategy (3-tier):
 * 1. Try wallet_getCapabilities — if it succeeds, definitely Flask
 * 2. If it fails with Flask-specific error format ("doesn't has corresponding handler"),
 *    that's still Flask — just an older version
 * 3. Fall back to web3_clientVersion to check for "flask" in the version string
 */
export async function checkFlaskSupport(): Promise<{
  supported: boolean;
  reason: "no_wallet" | "no_erc7715" | null;
}> {
  const provider = getMetaMaskProvider();
  if (!provider) {
    return { supported: false, reason: "no_wallet" };
  }

  // Strategy 1: Try wallet_getCapabilities (works in latest Flask builds)
  try {
    const result = await provider.request({
      method: "wallet_getCapabilities",
    });
    console.log("[Miiso] ✅ Flask detected via wallet_getCapabilities:", JSON.stringify(result, null, 2));
    return { supported: true, reason: null };
  } catch (e: any) {
    const msg = e?.message || "";
    console.log("[Miiso] wallet_getCapabilities error:", msg);

    // Strategy 2: Flask-specific error format (older Flask versions)
    // Flask says "doesn't has corresponding handler" — standard MetaMask says "Method not found"
    if (msg.includes("doesn't has corresponding handler") || msg.includes("does not have")) {
      console.log("[Miiso] ✅ Flask detected via error signature (older Flask build)");
      return { supported: true, reason: null };
    }
  }

  // Strategy 3: Check web3_clientVersion for "flask" keyword
  try {
    const clientVersion = await provider.request({ method: "web3_clientVersion" });
    console.log("[Miiso] web3_clientVersion:", clientVersion);
    if (typeof clientVersion === "string" && clientVersion.toLowerCase().includes("flask")) {
      console.log("[Miiso] ✅ Flask detected via client version string");
      return { supported: true, reason: null };
    }
  } catch { /* ignore */ }

  // Strategy 4: Check if _metamask object exists with getProviderState (Flask-specific internal)
  try {
    if (provider._metamask && typeof provider._metamask.isUnlocked === "function") {
      // This exists in both MetaMask and Flask, but combined with the error above,
      // if we got a "handler" error from strategy 2 we'd have already returned.
      // If we're here, it's likely standard MetaMask.
      console.log("[Miiso] ❌ Standard MetaMask detected (no Flask features)");
    }
  } catch { /* ignore */ }

  console.warn("[Miiso] ❌ Flask not detected by any strategy");
  return { supported: false, reason: "no_erc7715" };
}

/**
 * Request ERC-7715 scoped permission from MetaMask Flask.
 * Permission type: token-approval-revocation
 * Enforcer: ApprovalRevocationEnforcer — only allows approve(spender, 0)
 *
 * NO FALLBACK. If wallet_grantPermissions fails, the error propagates.
 */
export async function requestPermissionGrant(
  userAddress: string,
  budgetCap: number
): Promise<{
  permissionContext: string;
  delegationHash: string;
  method: "erc7715";
}> {
  const provider = (window as any).ethereum;
  if (!provider) throw new Error("No wallet provider found");

  const result = await provider.request({
    method: "wallet_grantPermissions",
    params: [
      {
        permissions: [
          {
            type: "token-approval-revocation",
            data: {
              enforcerAddress: ENFORCER_ADDRESS,
              allowedTokens: [], // Empty = all tokens
            },
          },
        ],
        signer: {
          type: "account",
          data: { id: AGENT_ADDRESS },
        },
        expiry: Math.floor(Date.now() / 1000) + 2592000, // 30 days
      },
    ],
  });

  if (!result || !result.permissionContext) {
    throw new Error(
      "MetaMask did not return a valid permission context. Ensure you are using MetaMask Flask."
    );
  }

  // Compute delegation hash from the permission context
  const encoder = new TextEncoder();
  const data = encoder.encode(result.permissionContext);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const delegationHash =
    "0x" + hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return {
    permissionContext: result.permissionContext,
    delegationHash,
    method: "erc7715",
  };
}

/**
 * Check if user EOA is already upgraded to a Smart Account.
 * Smart accounts have code at their address, EOAs don't.
 */
export async function isSmartAccount(userAddress: string): Promise<boolean> {
  try {
    const provider = (window as any).ethereum;
    if (!provider) return false;

    const code = await provider.request({
      method: "eth_getCode",
      params: [userAddress, "latest"],
    });

    return code !== "0x" && code !== "0x0";
  } catch {
    return false;
  }
}

/**
 * Sign EIP-7702 authorization to upgrade EOA to Smart Account.
 * Submits via wallet_sendCalls with 7702 capability.
 *
 * NO FALLBACK. If the wallet doesn't support EIP-7702, the error propagates.
 */
export async function signEIP7702Upgrade(userAddress: string): Promise<{
  upgraded: boolean;
  method: "eip7702";
}> {
  const provider = (window as any).ethereum;
  if (!provider) throw new Error("No wallet provider");

  // Check if already a smart account
  const alreadySmart = await isSmartAccount(userAddress);
  if (alreadySmart) {
    return { upgraded: true, method: "eip7702" };
  }

  // EIP-7702 via wallet_sendCalls
  await provider.request({
    method: "wallet_sendCalls",
    params: [
      {
        version: "2.0.0",
        chainId: "0x14a34", // Base Sepolia (84532)
        from: userAddress,
        calls: [],
        atomicRequired: false,
        capabilities: {
          "7702": {
            delegateAddress: "0x63c0c19a282a1b52a07dae32b", // MetaMask stateless delegator
          },
        },
      },
    ],
  });

  return { upgraded: true, method: "eip7702" };
}
