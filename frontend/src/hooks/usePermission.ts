import { useCallback } from "react";
import { useStore } from "../store/index";
import {
  requestPermissionGrant,
  upgradeVia1Shot,
  approveSuccessFeeHook,
  isSmartAccount,
  type PermissionGrantMethod,
} from "../lib/metamask";
import { postPermissions, getPermissions, deletePermissions } from "../lib/api";

const AGENT_ADDRESS = "0x6ED09F73cfe78555F950D3a325Aa38471fDF667d";

export function usePermission() {
  const userAddress = useStore((s) => s.userAddress);
  const setPermission = useStore((s) => s.setPermission);
  const setGrantMethod = useStore((s) => s.setGrantMethod);
  const setSetupComplete = useStore((s) => s.setSetupComplete);

  const checkPermission = useCallback(async () => {
    if (!userAddress) return null;
    try {
      const result = await getPermissions(userAddress);
      if (result.success && result.permission) {
        setPermission(JSON.stringify(result.permission));
        if (result.permission.grantMethod) {
          const label =
            result.permission.grantMethod === "erc7715"
              ? "Advanced Permission (ERC-7715)"
              : "Signed Delegation";
          setGrantMethod(label);
        }
        setSetupComplete(true);
        return result.permission;
      }
      setSetupComplete(false);
    } catch {
      setSetupComplete(false);
    }
    return null;
  }, [userAddress, setPermission, setGrantMethod, setSetupComplete]);

  const grantPermission = useCallback(
    async (
      budgetCap: number,
      whitelistAddresses: string[] = [],
      durationDays: number = 30,
      feeAllowanceApproved: boolean = false
    ): Promise<{
      method: PermissionGrantMethod;
      permissionContext: string;
      delegationHash: string;
    }> => {
      if (!userAddress) throw new Error("Wallet not connected");

      const { permissionContext, delegationHash, method } =
        await requestPermissionGrant(userAddress, budgetCap, durationDays);

      const durationSeconds = durationDays * 24 * 60 * 60;
      await postPermissions({
        userAddress,
        permissionContext,
        delegationHash,
        sessionSignerAddress: AGENT_ADDRESS,
        budgetCap: Math.round(budgetCap * 1_000_000).toString(),
        expiry: Math.floor(Date.now() / 1000) + durationSeconds,
        grantMethod: method,
        feeAllowanceApproved,
        whitelistAddresses,
      });

      setPermission(permissionContext);
      const methodLabel =
        method === "erc7715"
          ? "Advanced Permission (ERC-7715)"
          : "Signed Delegation";
      setGrantMethod(methodLabel);
      return { method, permissionContext, delegationHash };
    },
    [userAddress, setPermission, setGrantMethod]
  );

  const approveSuccessFee = useCallback(
    async (budgetCap: number) => {
      if (!userAddress) throw new Error("Wallet not connected");
      return approveSuccessFeeHook(userAddress, budgetCap);
    },
    [userAddress]
  );

  const upgradeToSmartAccount = useCallback(async () => {
    if (!userAddress) throw new Error("Wallet not connected");
    return upgradeVia1Shot(userAddress);
  }, [userAddress]);

  const checkIsSmartAccount = useCallback(async () => {
    if (!userAddress) return false;
    return isSmartAccount(userAddress);
  }, [userAddress]);

  const revokePermission = useCallback(async () => {
    if (!userAddress) throw new Error("Wallet not connected");
    await deletePermissions(userAddress);
    setPermission(null);
    setGrantMethod(null);
    setSetupComplete(false);
  }, [userAddress, setPermission, setGrantMethod, setSetupComplete]);

  return {
    checkPermission,
    grantPermission,
    approveSuccessFee,
    upgradeToSmartAccount,
    checkIsSmartAccount,
    revokePermission,
  };
}
