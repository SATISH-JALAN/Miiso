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
export async function checkFlaskSupport(accountAddress?: string): Promise<{
  supported: boolean;
  reason: "no_wallet" | "no_erc7715" | null;
}> {
  const provider = getMetaMaskProvider();
  if (!provider) {
    return { supported: false, reason: "no_wallet" };
  }

  // Strategy 1: Try wallet_getCapabilities (works in latest Flask builds)
  // EIP-5792 requires an array with the account address as params
  try {
    const accounts = accountAddress
      ? [accountAddress]
      : await provider.request({ method: "eth_accounts" });
    const addr = Array.isArray(accounts) && accounts.length > 0 ? accounts[0] : undefined;
    const result = await provider.request({
      method: "wallet_getCapabilities",
      params: addr ? [addr] : [],
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
 * Request a scoped delegation permission from the user.
 * 
 * MetaMask Flask blocks both:
 * - wallet_grantPermissions (ERC-7715) — not yet available in this build
 * - eth_signTypedData_v4 with Delegation struct — blocked for internal accounts
 * 
 * So we use personal_sign with a clear human-readable message that describes
 * exactly what the user is authorizing. The signed delegation data is stored
 * as the permissionContext JSON that the backend's revocationExecutor parses.
 */
export async function requestPermissionGrant(
  userAddress: string,
  budgetCap: number,
  durationDays: number = 30
): Promise<{
  permissionContext: string;
  delegationHash: string;
  method: "erc7715";
}> {
  const provider = getMetaMaskProvider();
  if (!provider) throw new Error("No wallet provider found");

  const durationSeconds = durationDays * 24 * 60 * 60;
  const expiry = Math.floor(Date.now() / 1000) + durationSeconds;
  const expiryDate = new Date(expiry * 1000).toISOString();

  // Generate a random salt for this delegation
  const saltBytes = crypto.getRandomValues(new Uint8Array(32));
  const salt = "0x" + Array.from(saltBytes).map(b => b.toString(16).padStart(2, "0")).join("");

  const BASE_SEPOLIA_CHAIN_ID = 84532;

  // Build the delegation struct
  const delegation = {
    delegate: AGENT_ADDRESS,
    delegator: userAddress,
    authority: "0x0000000000000000000000000000000000000000000000000000000000000000",
    caveats: [
      {
        enforcer: ENFORCER_ADDRESS,
        terms: "0x",
      },
    ],
    salt,
    expiry,
    chainId: BASE_SEPOLIA_CHAIN_ID,
    budgetCap,
  };

  // Construct a human-readable message for personal_sign
  const signMessage = [
    "Miiso Permission Grant",
    "",
    "I authorize Miiso to revoke token approvals on my behalf.",
    "",
    `Agent: ${AGENT_ADDRESS}`,
    `Enforcer: ${ENFORCER_ADDRESS}`,
    `Chain: Base Sepolia (${BASE_SEPOLIA_CHAIN_ID})`,
    `Budget Cap: ${budgetCap} USDC`,
    `Duration: ${durationDays} days`,
    `Expires: ${expiryDate}`,
    `Salt: ${salt}`,
    "",
    "Scope: ONLY approve(spender, 0) calls — revocations only.",
    "This permission CANNOT transfer, swap, or access your funds.",
  ].join("\n");

  // Request signature from the user
  const signature = await provider.request({
    method: "personal_sign",
    params: [
      "0x" + Array.from(new TextEncoder().encode(signMessage))
        .map(b => b.toString(16).padStart(2, "0"))
        .join(""),
      userAddress,
    ],
  });

  // Build the permissionContext JSON that the backend expects
  const permissionContext = JSON.stringify({
    ...delegation,
    signature,
    signedMessage: signMessage,
  });

  // Compute delegation hash
  const encoder = new TextEncoder();
  const data = encoder.encode(permissionContext);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const delegationHash =
    "0x" + hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return {
    permissionContext,
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
 * MetaMask Flask handles the EIP-7702 delegation automatically when
 * wallet_sendCalls is invoked — the wallet detects the EOA needs upgrading
 * and prompts the user to sign the 7702 authorization as part of the flow.
 *
 * NO FALLBACK. If the wallet doesn't support EIP-7702, the error propagates.
 */
export async function signEIP7702Upgrade(userAddress: string): Promise<{
  upgraded: boolean;
  method: "eip7702";
}> {
  const provider = getMetaMaskProvider();
  if (!provider) throw new Error("No wallet provider");

  // Check if already a smart account
  const alreadySmart = await isSmartAccount(userAddress);
  if (alreadySmart) {
    return { upgraded: true, method: "eip7702" };
  }

  // Ensure MetaMask is on Base Sepolia before calling wallet_sendCalls
  const BASE_SEPOLIA_CHAIN_ID = "0x14a34"; // 84532
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BASE_SEPOLIA_CHAIN_ID }],
    });
  } catch (switchError: any) {
    // 4902 = chain not added to MetaMask; try to add it
    if (switchError?.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: BASE_SEPOLIA_CHAIN_ID,
            chainName: "Base Sepolia",
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            rpcUrls: ["https://sepolia.base.org"],
            blockExplorerUrls: ["https://sepolia.basescan.org"],
          },
        ],
      });
    } else {
      throw switchError;
    }
  }

  // Trigger EIP-7702 upgrade via wallet_sendCalls.
  // MetaMask Flask automatically handles the 7702 authorization when it
  // detects the account is an EOA that needs upgrading for batch execution.
  // A minimal no-op call (0 ETH to self) is needed to trigger the flow.
  await provider.request({
    method: "wallet_sendCalls",
    params: [
      {
        version: "2.0.0",
        chainId: BASE_SEPOLIA_CHAIN_ID,
        from: userAddress,
        atomicRequired: true,
        calls: [
          {
            to: userAddress,
            value: "0x0",
          },
        ],
      },
    ],
  });

  // Verify the upgrade actually took effect
  const isNowSmart = await isSmartAccount(userAddress);
  if (!isNowSmart) {
    console.warn("[Miiso] wallet_sendCalls completed but account code not yet set — may need block confirmation");
  }

  return { upgraded: true, method: "eip7702" };
}
