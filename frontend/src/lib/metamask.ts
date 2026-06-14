// ===== MetaMask ERC-7715 + EIP-7702 + 1Shot integration =====

import { encodeFunctionData } from "viem";

const AGENT_ADDRESS = "0x6ED09F73cfe78555F950D3a325Aa38471fDF667d";
const ENFORCER_ADDRESS = "0x0a1BE1E7c3838e9B3D803Be3C946c6E5abC6B6DA";
const BASE_SEPOLIA_CHAIN_ID = 84532;
const BASE_SEPOLIA_CHAIN_HEX = "0x14a34";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";
const ONESHOT_RELAYER_URL =
  import.meta.env.VITE_ONESHOT_RELAYER_URL || "https://relayer.1shotapi.com/rpc";
const USDC_ADDRESS = (import.meta.env.VITE_USDC_ADDRESS ||
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e") as `0x${string}`;
const SUCCESS_FEE_HOOK = (import.meta.env.VITE_SUCCESS_FEE_HOOK || "") as `0x${string}`;
const SMART_ACCOUNT_IMPL = (import.meta.env.VITE_SMART_ACCOUNT_IMPL || "") as `0x${string}`;

export type PermissionGrantMethod = "erc7715" | "signed_delegation";
export type UpgradeMethod = "1shot_paymaster" | "1shot_relayer" | "wallet_sendCalls";

const erc20ApproveAbi = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "boolean" }],
  },
] as const;

function getMetaMaskProvider(): any {
  if (typeof window === "undefined") return null;
  const ethereum = (window as any).ethereum;
  if (!ethereum) return null;

  if (ethereum.providers?.length) {
    const mm = ethereum.providers.find(
      (p: any) => p.isMetaMask && !p.isBraveWallet && !p.isPhantom
    );
    if (mm) return mm;
  }

  if (ethereum.isMetaMask) return ethereum;
  return ethereum;
}

async function hashPermissionContext(permissionContext: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(permissionContext);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return "0x" + hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function checkFlaskSupport(accountAddress?: string): Promise<{
  supported: boolean;
  reason: "no_wallet" | "no_erc7715" | null;
}> {
  const provider = getMetaMaskProvider();
  if (!provider) {
    return { supported: false, reason: "no_wallet" };
  }

  try {
    const accounts = accountAddress
      ? [accountAddress]
      : await provider.request({ method: "eth_accounts" });
    const addr = Array.isArray(accounts) && accounts.length > 0 ? accounts[0] : undefined;
    await provider.request({
      method: "wallet_getCapabilities",
      params: addr ? [addr] : [],
    });
    return { supported: true, reason: null };
  } catch (e: any) {
    const msg = e?.message || "";
    if (msg.includes("doesn't has corresponding handler") || msg.includes("does not have")) {
      return { supported: true, reason: null };
    }
  }

  try {
    const clientVersion = await provider.request({ method: "web3_clientVersion" });
    if (typeof clientVersion === "string" && clientVersion.toLowerCase().includes("flask")) {
      return { supported: true, reason: null };
    }
  } catch { /* ignore */ }

  return { supported: false, reason: "no_erc7715" };
}

/** Detect whether wallet_grantPermissions is available via capabilities. */
export async function supportsNativeGrantPermissions(
  userAddress: string
): Promise<boolean> {
  const provider = getMetaMaskProvider();
  if (!provider) return false;

  try {
    const caps = await provider.request({
      method: "wallet_getCapabilities",
      params: [userAddress],
    });
    const capsStr = JSON.stringify(caps).toLowerCase();
    return (
      capsStr.includes("grantpermissions") ||
      capsStr.includes("permissions") ||
      capsStr.includes("7715")
    );
  } catch {
    return false;
  }
}

async function tryNativeGrantPermissions(
  userAddress: string,
  budgetCap: number,
  durationDays: number
): Promise<{ permissionContext: string; delegationHash: string } | null> {
  const provider = getMetaMaskProvider();
  if (!provider) return null;

  const expiry = Math.floor(Date.now() / 1000) + durationDays * 24 * 60 * 60;

  try {
    const result = await provider.request({
      method: "wallet_grantPermissions",
      params: [
        {
          address: userAddress,
          permissions: [
            {
              type: "erc20-token-restriction",
              data: {
                token: "*",
                allowance: "0",
              },
            },
          ],
          expiry,
          signer: {
            type: "account",
            data: { address: AGENT_ADDRESS },
          },
          enforcer: ENFORCER_ADDRESS,
          chainId: BASE_SEPOLIA_CHAIN_ID,
          budgetCap,
        },
      ],
    });

    const permissionContext =
      typeof result === "string"
        ? result
        : JSON.stringify(result);

    const delegationHash = await hashPermissionContext(permissionContext);
    return { permissionContext, delegationHash };
  } catch (err) {
    console.warn("[Miiso] wallet_grantPermissions unavailable, using signed delegation fallback:", err);
    return null;
  }
}

async function grantViaSignedDelegation(
  userAddress: string,
  budgetCap: number,
  durationDays: number
): Promise<{ permissionContext: string; delegationHash: string }> {
  const provider = getMetaMaskProvider();
  if (!provider) throw new Error("No wallet provider found");

  const expiry = Math.floor(Date.now() / 1000) + durationDays * 24 * 60 * 60;
  const expiryDate = new Date(expiry * 1000).toISOString();

  const saltBytes = crypto.getRandomValues(new Uint8Array(32));
  const salt =
    "0x" + Array.from(saltBytes).map((b) => b.toString(16).padStart(2, "0")).join("");

  const delegation = {
    delegate: AGENT_ADDRESS,
    delegator: userAddress,
    authority: "0x0000000000000000000000000000000000000000000000000000000000000000",
    caveats: [{ enforcer: ENFORCER_ADDRESS, terms: "0x" }],
    salt,
    expiry,
    chainId: BASE_SEPOLIA_CHAIN_ID,
    budgetCap,
  };

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

  const signature = await provider.request({
    method: "personal_sign",
    params: [
      "0x" +
        Array.from(new TextEncoder().encode(signMessage))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(""),
      userAddress,
    ],
  });

  const permissionContext = JSON.stringify({
    ...delegation,
    signature,
    signedMessage: signMessage,
  });

  const delegationHash = await hashPermissionContext(permissionContext);
  return { permissionContext, delegationHash };
}

/**
 * Hybrid permission grant: native ERC-7715 when Flask supports it,
 * otherwise signed delegation JSON for backend 1Shot parsing.
 */
export async function requestPermissionGrant(
  userAddress: string,
  budgetCap: number,
  durationDays: number = 30
): Promise<{
  permissionContext: string;
  delegationHash: string;
  method: PermissionGrantMethod;
}> {
  const nativeSupported = await supportsNativeGrantPermissions(userAddress);

  if (nativeSupported) {
    const native = await tryNativeGrantPermissions(userAddress, budgetCap, durationDays);
    if (native) {
      return { ...native, method: "erc7715" };
    }
  }

  const fallback = await grantViaSignedDelegation(userAddress, budgetCap, durationDays);
  return { ...fallback, method: "signed_delegation" };
}

export async function isSmartAccount(userAddress: string): Promise<boolean> {
  try {
    const provider = getMetaMaskProvider();
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

async function waitForSmartAccount(
  userAddress: string,
  maxAttempts = 6,
  delayMs = 2000
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    if (await isSmartAccount(userAddress)) return true;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

export async function signEIP7702Upgrade(userAddress: string): Promise<{
  upgraded: boolean;
  method: UpgradeMethod;
  feeUsdc: number;
  txHash?: string;
}> {
  return upgradeVia1Shot(userAddress);
}

export async function getRelayCapabilities(): Promise<{
  feeUsdc: number;
  maxFee: string;
  relayerUrl: string;
}> {
  const res = await fetch(`${BACKEND_URL}/api/relay/capabilities`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Failed to fetch 1Shot relay fee");
  }
  const data = await res.json();
  return {
    feeUsdc: data.feeUsdc ?? 0.01,
    maxFee: data.maxFee ?? "10000",
    relayerUrl: data.relayerUrl ?? ONESHOT_RELAYER_URL,
  };
}

async function ensureBaseSepolia(provider: any): Promise<void> {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BASE_SEPOLIA_CHAIN_HEX }],
    });
  } catch (switchError: any) {
    if (switchError?.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: BASE_SEPOLIA_CHAIN_HEX,
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
}

async function waitForCallsStatus(
  provider: any,
  batchId: string,
  maxAttempts = 12,
  delayMs = 2000
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const status = await provider.request({
        method: "wallet_getCallsStatus",
        params: [batchId],
      });
      const code = status?.status ?? status?.receipts?.[0]?.status;
      if (code === 200 || code === "CONFIRMED" || code === 1 || code === "0x1") {
        return;
      }
      if (code === 500 || code === "FAILED" || code === 0) {
        throw new Error("Smart account upgrade transaction failed on-chain");
      }
    } catch (err: any) {
      if (i === maxAttempts - 1) throw err;
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
}

/**
 * Upgrades EOA to smart account via 1Shot USDC gas (paymaster or relayer),
 * with wallet_sendCalls fallback.
 */
export async function upgradeVia1Shot(userAddress: string): Promise<{
  upgraded: boolean;
  method: UpgradeMethod;
  feeUsdc: number;
  txHash?: string;
}> {
  const provider = getMetaMaskProvider();
  if (!provider) throw new Error("No wallet provider");

  if (await isSmartAccount(userAddress)) {
    return { upgraded: true, method: "1shot_paymaster", feeUsdc: 0 };
  }

  await ensureBaseSepolia(provider);

  let feeUsdc = 0.01;
  try {
    const caps = await getRelayCapabilities();
    feeUsdc = caps.feeUsdc;
  } catch {
    console.warn("[Miiso] Could not fetch 1Shot fee quote — using $0.01 estimate");
  }

  // Path 1: wallet_sendCalls with 1Shot paymaster (USDC gas)
  try {
    const sendResult = await provider.request({
      method: "wallet_sendCalls",
      params: [
        {
          version: "2.0.0",
          chainId: BASE_SEPOLIA_CHAIN_HEX,
          from: userAddress,
          atomicRequired: true,
          calls: [{ to: userAddress, value: "0x0" }],
          capabilities: {
            paymasterService: { url: ONESHOT_RELAYER_URL },
          },
        },
      ],
    });

    if (sendResult?.id) {
      await waitForCallsStatus(provider, sendResult.id);
    } else {
      await waitForSmartAccount(userAddress);
    }

    if (await isSmartAccount(userAddress)) {
      return {
        upgraded: true,
        method: "1shot_paymaster",
        feeUsdc,
        txHash: sendResult?.id,
      };
    }
  } catch (err) {
    console.warn("[Miiso] 1Shot paymaster upgrade failed, trying relayer path:", err);
  }

  // Path 2: wallet_signAuthorization + backend 1Shot relayer
  if (SMART_ACCOUNT_IMPL) {
    try {
      const nonceHex = await provider.request({
        method: "eth_getTransactionCount",
        params: [userAddress, "pending"],
      });
      const nonce = parseInt(nonceHex, 16);

      const auth = await provider.request({
        method: "wallet_signAuthorization",
        params: [
          {
            chainId: BASE_SEPOLIA_CHAIN_HEX,
            address: SMART_ACCOUNT_IMPL,
            nonce: `0x${nonce.toString(16)}`,
          },
        ],
      });

      const relayRes = await fetch(`${BACKEND_URL}/api/relay/upgrade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress,
          authorizationList: [
            {
              chainId: BASE_SEPOLIA_CHAIN_ID,
              address: auth.address ?? SMART_ACCOUNT_IMPL,
              nonce: typeof auth.nonce === "string" ? parseInt(auth.nonce, 16) : auth.nonce ?? nonce,
              yParity: typeof auth.yParity === "string" ? parseInt(auth.yParity, 16) : auth.yParity ?? 0,
              r: auth.r,
              s: auth.s,
            },
          ],
        }),
      });

      if (!relayRes.ok) {
        const body = await relayRes.json().catch(() => ({}));
        throw new Error(body.message || "1Shot relayer upgrade failed");
      }

      const relayData = await relayRes.json();
      await waitForSmartAccount(userAddress, 10, 3000);

      if (await isSmartAccount(userAddress)) {
        return {
          upgraded: true,
          method: "1shot_relayer",
          feeUsdc: relayData.feeUsdc ?? feeUsdc,
          txHash: relayData.txHash,
        };
      }
    } catch (err) {
      console.warn("[Miiso] 1Shot relayer upgrade failed, falling back:", err);
    }
  }

  // Path 3: plain wallet_sendCalls (no USDC fee visibility)
  await provider.request({
    method: "wallet_sendCalls",
    params: [
      {
        version: "2.0.0",
        chainId: BASE_SEPOLIA_CHAIN_HEX,
        from: userAddress,
        atomicRequired: true,
        calls: [{ to: userAddress, value: "0x0" }],
      },
    ],
  });

  const isNowSmart = await waitForSmartAccount(userAddress);
  if (!isNowSmart) {
    throw new Error(
      "Smart account upgrade did not complete. Please wait a few blocks and try again."
    );
  }

  return { upgraded: true, method: "wallet_sendCalls", feeUsdc: 0 };
}

/**
 * User pre-approves the success fee hook to pull up to budgetCap USDC on protection events.
 */
export async function approveSuccessFeeHook(
  userAddress: string,
  budgetCapUsdc: number
): Promise<{ approved: boolean; txHash?: string; skipped: boolean }> {
  if (!SUCCESS_FEE_HOOK || SUCCESS_FEE_HOOK === "0x0000000000000000000000000000000000000000") {
    console.warn("[Miiso] SUCCESS_FEE_HOOK not configured — skipping fee approval");
    return { approved: false, skipped: true };
  }

  const provider = getMetaMaskProvider();
  if (!provider) throw new Error("No wallet provider");

  await ensureBaseSepolia(provider);

  const allowance = BigInt(Math.round(budgetCapUsdc * 1_000_000));
  const data = encodeFunctionData({
    abi: erc20ApproveAbi,
    functionName: "approve",
    args: [SUCCESS_FEE_HOOK, allowance],
  });

  const txHash = await provider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: userAddress,
        to: USDC_ADDRESS,
        data,
        value: "0x0",
      },
    ],
  });

  return { approved: true, txHash, skipped: false };
}

export { AGENT_ADDRESS, ENFORCER_ADDRESS, USDC_ADDRESS, SUCCESS_FEE_HOOK };
