// ===== usePermission — ERC-7715 permission grant + status =====
import { useCallback } from "react";
import { useStore } from "../store/index";
import { requestPermissionGrant, signEIP7702Upgrade, isSmartAccount } from "../lib/metamask";
import { postPermissions, getPermissions, deletePermissions } from "../lib/api";

const AGENT_ADDRESS = "0x6ED09F73cfe78555F950D3a325Aa38471fDF667d";

/**
 * Hook for managing ERC-7715 permission lifecycle:
 * - Check if user has active permission
 * - Grant new permission (ERC-7715 via MetaMask Flask)
 * - Upgrade EOA to Smart Account (EIP-7702)
 * - Revoke permission
 * 
 * No fallbacks — requires MetaMask Flask for wallet_grantPermissions.
 */
export function usePermission() {
  const userAddress = useStore((s) => s.userAddress);
  const setPermission = useStore((s) => s.setPermission);

  const checkPermission = useCallback(async () => {
    if (!userAddress) return null;
    try {
      const result = await getPermissions(userAddress);
      if (result.success && result.permission) {
        setPermission(JSON.stringify(result.permission));
        return result.permission;
      }
    } catch {
      // No active permission
    }
    return null;
  }, [userAddress, setPermission]);

  const grantPermission = useCallback(async (budgetCap: number, whitelistAddresses: string[] = []) => {
    if (!userAddress) throw new Error("Wallet not connected");

    // 1. Request ERC-7715 permission via MetaMask Flask (no fallback)
    const { permissionContext, delegationHash, method } = await requestPermissionGrant(userAddress, budgetCap);

    // 2. Register permission with backend
    await postPermissions({
      userAddress,
      permissionContext,
      delegationHash,
      sessionSignerAddress: AGENT_ADDRESS,
      budgetCap: (budgetCap * 1e18).toString(),
      expiry: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // 1 year
    });

    setPermission(permissionContext);
    return { method, permissionContext, delegationHash };
  }, [userAddress, setPermission]);

  const upgradeToSmartAccount = useCallback(async () => {
    if (!userAddress) throw new Error("Wallet not connected");
    return signEIP7702Upgrade(userAddress);
  }, [userAddress]);

  const checkIsSmartAccount = useCallback(async () => {
    if (!userAddress) return false;
    return isSmartAccount(userAddress);
  }, [userAddress]);

  const revokePermission = useCallback(async () => {
    if (!userAddress) throw new Error("Wallet not connected");
    await deletePermissions(userAddress);
    setPermission(null);
  }, [userAddress, setPermission]);

  return {
    checkPermission,
    grantPermission,
    upgradeToSmartAccount,
    checkIsSmartAccount,
    revokePermission,
  };
}
