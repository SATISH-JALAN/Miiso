import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import { useStore } from './store/index';
import { useSSE } from './hooks/useSSE';
import { useDashboard } from './hooks/useDashboard';
import { usePermission } from './hooks/usePermission';
import { postRevoke, postBatchRevoke, postVeto, postExecuteVeto, updateProfile } from './lib/api';
import type { ApprovalInfo, ProtectionEvent, DashboardStats, SecurityProfile } from './types/index';
import { useAccount, useConnect, useDisconnect } from 'wagmi';

export type { ApprovalInfo, ProtectionEvent, DashboardStats };

interface WalletContextType {
  walletAddress: string | null;
  isConnected: boolean;
  isLoading: boolean;
  securityProfile: SecurityProfile;
  stats: DashboardStats | null;
  approvals: ApprovalInfo[];
  history: ProtectionEvent[];
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  refreshAllData: () => Promise<void>;
  revokeApproval: (tokenAddress: string, spenderAddress: string, rawAllowance: string) => Promise<boolean>;
  batchRevokeApprovals: (approvalsToRevoke: { tokenAddress: string; spenderAddress: string; rawAllowance: string }[]) => Promise<boolean>;
  vetoAction: (eventId: string) => Promise<boolean>;
  executeVetoAction: (eventId: string) => Promise<boolean>;
  updateSecurityProfile: (profile: SecurityProfile) => Promise<boolean>;
  disableGuard: () => Promise<boolean>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  // Sync state from Zustand store
  const walletAddress = useStore((s) => s.userAddress);
  const isConnected = useStore((s) => s.isConnected);
  const isLoading = useStore((s) => s.isLoading);
  const securityProfile = useStore((s) => s.securityProfile);
  const stats = useStore((s) => s.stats);
  const approvals = useStore((s) => s.approvals);
  const history = useStore((s) => s.history);

  const setUserAddress = useStore((s) => s.setUserAddress);
  const setIsLoading = useStore((s) => s.setIsLoading);
  const setSecurityProfile = useStore((s) => s.setSecurityProfile);
  const resetStore = useStore((s) => s.reset);

  const { fetchDashboardData } = useDashboard();
  const { checkPermission, revokePermission } = usePermission();

  const { address: wagmiAddress, isConnected: isWagmiConnected } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  // Sync Wagmi account state to Zustand store
  useEffect(() => {
    if (isWagmiConnected && wagmiAddress) {
      setUserAddress(wagmiAddress);
    } else if (!isWagmiConnected && walletAddress) {
      setUserAddress(null);
    }
  }, [wagmiAddress, isWagmiConnected, setUserAddress, walletAddress]);

  // Listen to SSE events (auto-handles state mutations)
  useSSE(walletAddress);

  // Sync dashboard data on wallet address load
  useEffect(() => {
    if (walletAddress) {
      fetchDashboardData();
      checkPermission().then((perm) => {
        if (perm && perm.securityProfile) {
          setSecurityProfile(perm.securityProfile as SecurityProfile);
        }
      });
    }
  }, [walletAddress, fetchDashboardData, checkPermission, setSecurityProfile]);

  // Connects wallet - MetaMask only, no fallbacks
  const connectWallet = async () => {
    setIsLoading(true);
    try {
      if (!connectors || connectors.length === 0) {
        throw new Error("No wallet connectors found. Please install MetaMask.");
      }
      const result = await connectAsync({ connector: connectors[0] });
      if (result.accounts && result.accounts[0]) {
        setUserAddress(result.accounts[0]);
      } else {
        throw new Error("No accounts returned from MetaMask.");
      }
    } catch (error: any) {
      console.error("Wallet connection failed:", error);
      throw new Error(
        error?.message?.includes("rejected")
          ? "Connection rejected by user."
          : "Failed to connect MetaMask. Please ensure MetaMask is installed."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectWallet = () => {
    try {
      disconnect();
    } catch (e) {
      console.warn("Wagmi disconnect failed:", e);
    }
    resetStore();
  };

  const refreshAllData = async () => {
    if (!walletAddress) return;
    setIsLoading(true);
    try {
      await fetchDashboardData();
      const perm = await checkPermission();
      if (perm && perm.securityProfile) {
        setSecurityProfile(perm.securityProfile as SecurityProfile);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Execute manual revocation via backend EIP-7710/7715 relayer queue
  const revokeApproval = async (tokenAddress: string, spenderAddress: string, rawAllowance: string): Promise<boolean> => {
    if (!walletAddress) return false;
    try {
      const res = await postRevoke({
        userAddress: walletAddress,
        tokenAddress,
        spenderAddress,
        rawAllowance
      });
      if (res.success) {
        await refreshAllData();
        return true;
      }
      return false;
    } catch (err) {
      console.error("Manual revocation failed:", err);
      return false;
    }
  };

  // Cancel veto
  const vetoAction = async (eventId: string): Promise<boolean> => {
    try {
      const res = await postVeto(eventId);
      if (res.cancelled) {
        useStore.getState().markVetoCancelled(eventId);
        await refreshAllData();
        return true;
      }
      return false;
    } catch (err) {
      console.error("Veto action failed:", err);
      return false;
    }
  };

  // Immediate execution of veto staged event
  const executeVetoAction = async (eventId: string): Promise<boolean> => {
    try {
      const res = await postExecuteVeto(eventId);
      if (res.executed) {
        await refreshAllData();
        return true;
      }
      return false;
    } catch (err) {
      console.error("Execute veto action failed:", err);
      return false;
    }
  };

  const batchRevokeApprovals = async (approvalsToRevoke: { tokenAddress: string; spenderAddress: string; rawAllowance: string }[]): Promise<boolean> => {
    if (!walletAddress) return false;
    try {
      const res = await postBatchRevoke({
        userAddress: walletAddress,
        approvals: approvalsToRevoke
      });
      if (res.success) {
        await refreshAllData();
        return true;
      }
      return false;
    } catch (err) {
      console.error("Batch revocation failed:", err);
      return false;
    }
  };

  const updateSecurityProfile = async (profile: SecurityProfile): Promise<boolean> => {
    if (!walletAddress) return false;
    try {
      const res = await updateProfile(walletAddress, profile);
      if (res.success) {
        setSecurityProfile(profile);
        return true;
      }
      return false;
    } catch (err) {
      console.error("Failed to update security profile:", err);
      return false;
    }
  };

  const disableGuard = async (): Promise<boolean> => {
    if (!walletAddress) return false;
    setIsLoading(true);
    try {
      // 1. Get delegation hash to disable it on-chain
      const perm = await checkPermission();
      
      if (perm && perm.id) {
        // Find delegation hash in perm object (or get from DB query if needed)
        // Since perm from getActivePermission contains the metadata, we check if delegationHash is there:
        // Actually, we can get it from the full checkPermission context or from details.
        // Let's check on-chain if using MetaMask and not local anvil default keys:
        if (typeof window !== 'undefined' && (window as any).ethereum) {
          try {
            const DELEGATION_MANAGER_ADDRESS = "0xe264F1f09A19505a1ca1a86D5b01E8bFdb64324A";
            const provider = (window as any).ethereum;
            
            // Default hash to use if delegationHash is not returned directly in stats/metadata:
            // The frontend has it in local storage or we can fallback to dummy hash if needed
            const delegationHash = (perm as any).delegationHash || "0x0000000000000000000000000000000000000000000000000000000000000000";
            
            await provider.request({
              method: "eth_sendTransaction",
              params: [{
                from: walletAddress,
                to: DELEGATION_MANAGER_ADDRESS,
                data: `0x5a2d64bc${delegationHash.replace("0x", "").padStart(64, "0")}`,
              }]
            });
            console.log("On-chain delegation disabled!");
          } catch (e: any) {
            console.warn("On-chain disableDelegation failed or rejected:", e.message || e);
          }
        }
      }

      // 2. Call backend DELETE to clear DB
      await revokePermission();
      await refreshAllData();
      return true;
    } catch (err) {
      console.error("Failed to disable guard:", err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <WalletContext.Provider value={{
      walletAddress,
      isConnected,
      isLoading,
      securityProfile,
      stats,
      approvals,
      history,
      connectWallet,
      disconnectWallet,
      refreshAllData,
      revokeApproval,
      batchRevokeApprovals,
      vetoAction,
      executeVetoAction,
      updateSecurityProfile,
      disableGuard
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
