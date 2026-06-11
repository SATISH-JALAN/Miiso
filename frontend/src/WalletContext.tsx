import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import { useStore } from './store/index';
import { useSSE } from './hooks/useSSE';
import { useDashboard } from './hooks/useDashboard';
import { usePermission } from './hooks/usePermission';
import { postRevoke, postBatchRevoke, postVeto, updateProfile } from './lib/api';
import type { ApprovalInfo, ProtectionEvent, DashboardStats, SecurityProfile } from './types/index';

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
  updateSecurityProfile: (profile: SecurityProfile) => Promise<boolean>;
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
  const { checkPermission } = usePermission();

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

  // Connects wallet - supports window.ethereum if available, falls back to demo account
  const connectWallet = async () => {
    setIsLoading(true);
    try {
      let address = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        const provider = (window as any).ethereum;
        const accounts = await provider.request({ method: 'eth_requestAccounts' });
        if (accounts && accounts[0]) {
          address = accounts[0];
        }
      }
      setUserAddress(address);
    } catch (error) {
      console.error("Wallet connection failed:", error);
      // Fallback anyway to ensure seamless demo experience
      const address = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
      setUserAddress(address);
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectWallet = () => {
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
        await refreshAllData();
        return true;
      }
      return false;
    } catch (err) {
      console.error("Veto action failed:", err);
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
      updateSecurityProfile
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
