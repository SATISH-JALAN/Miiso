// ===== MetaMask ERC-7715 + EIP-7702 integration =====
// Requires MetaMask Flask for ERC-7715 Advanced Permissions support.
// No silent fallbacks — if Flask is not detected, setup is gated.

const AGENT_ADDRESS = "0x6ED09F73cfe78555F950D3a325Aa38471fDF667d";
const ENFORCER_ADDRESS = "0xe264F1f09A19505a1ca1a86D5b01E8bFdb64324A";

/**
 * Detect whether the connected wallet supports ERC-7715 (MetaMask Flask).
 * Returns { supported, reason } so the UI can show an appropriate gate screen.
 */
export async function checkFlaskSupport(): Promise<{
  supported: boolean;
  reason: "no_wallet" | "no_erc7715" | null;
}> {
  if (typeof window === "undefined" || !(window as any).ethereum) {
    return { supported: false, reason: "no_wallet" };
  }

  try {
    const provider = (window as any).ethereum;

    // wallet_getCapabilities only exists in Flask / Smart Accounts Kit
    const result = await provider.request({
      method: "wallet_getCapabilities",
    });

    // Check if any chain reports wallet_grantPermissions support
    const hasPermissions = Object.values(result || {}).some(
      (chain: any) => chain?.["wallet_grantPermissions"]?.supported === true
    );

    return {
      supported: hasPermissions,
      reason: hasPermissions ? null : "no_erc7715",
    };
  } catch (e: any) {
    // Method not found = standard MetaMask = no ERC-7715 support
    console.warn("[MetaMask] Flask detection failed:", e.message);
    return { supported: false, reason: "no_erc7715" };
  }
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
