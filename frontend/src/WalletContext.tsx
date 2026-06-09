import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface ApprovalInfo {
  token: string;
  spender: string;
  amount: string;
  rawAllowance: string;
  date: string;
  riskLevel: "high" | "medium" | "low" | "none";
}

export interface ProtectionEvent {
  id: string;
  userAddress: string;
  tokenAddress: string;
  spenderAddress: string;
  exposedValue: string;
  actionType: "revocation" | "veto";
  relayTxHash: string;
  relayStatus: "pending" | "confirmed" | "failed";
  severity: "high" | "medium" | "low";
  vetoCancelled: boolean;
  stagedUntil: string | null;
  createdAt: string;
  explainer?: string | null;
  confidence?: string | null;
  staticFlags?: string[] | null;
  staticRisk?: string | null;
}

export interface DashboardStats {
  threatsDetected: number;
  totalSaved: string;
  budgetCap: string;
  budgetSpent: string;
  budgetRemaining: string;
}

interface WalletContextType {
  walletAddress: string | null;
  isConnected: boolean;
  isLoading: boolean;
  securityProfile: 'safe' | 'balanced' | 'manual';
  stats: DashboardStats | null;
  approvals: ApprovalInfo[];
  history: ProtectionEvent[];
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  refreshAllData: () => Promise<void>;
  revokeApproval: (tokenAddress: string, spenderAddress: string, rawAllowance: string) => Promise<boolean>;
  batchRevokeApprovals: (approvalsToRevoke: { tokenAddress: string; spenderAddress: string; rawAllowance: string }[]) => Promise<boolean>;
  vetoAction: (eventId: string) => Promise<boolean>;
  updateSecurityProfile: (profile: 'safe' | 'balanced' | 'manual') => Promise<boolean>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const BACKEND_URL = "http://localhost:3001";

export function WalletProvider({ children }: { children: ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [approvals, setApprovals] = useState<ApprovalInfo[]>([]);
  const [history, setHistory] = useState<ProtectionEvent[]>([]);
  const [securityProfile, setSecurityProfile] = useState<'safe' | 'balanced' | 'manual'>('balanced');
  const [isLoading, setIsLoading] = useState(false);

  // Connects wallet - supports window.ethereum if available, falls back to demo account
  const connectWallet = async () => {
    setIsLoading(true);
    try {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        const provider = (window as any).ethereum;
        const accounts = await provider.request({ method: 'eth_requestAccounts' });
        if (accounts && accounts[0]) {
          setWalletAddress(accounts[0]);
          return;
        }
      }
      // Fallback/demo address when MetaMask is missing (ideal for hackathon / anvil testing)
      setWalletAddress("0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266");
    } catch (error) {
      console.error("Wallet connection failed:", error);
      // Fallback anyway to ensure seamless demo experience
      setWalletAddress("0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266");
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
    setStats(null);
    setApprovals([]);
    setHistory([]);
    setSecurityProfile('balanced');
  };

  const refreshAllData = async () => {
    if (!walletAddress) return;
    setIsLoading(true);
    try {
      // 1. Fetch Stats
      const statsRes = await fetch(`${BACKEND_URL}/api/dashboard/${walletAddress}`);
      const statsJson = await statsRes.json();
      if (statsJson.success) {
        setStats(statsJson.stats);
      }

      // 2. Fetch Approvals
      const approvalsRes = await fetch(`${BACKEND_URL}/api/approvals/${walletAddress}`);
      const approvalsJson = await approvalsRes.json();
      if (approvalsJson.success) {
        setApprovals(approvalsJson.approvals);
      }

      // 3. Fetch History
      const historyRes = await fetch(`${BACKEND_URL}/api/history/${walletAddress}`);
      const historyJson = await historyRes.json();
      if (historyJson.success) {
        setHistory(historyJson.events);
      }

      // 4. Fetch Security Profile
      try {
        const permRes = await fetch(`${BACKEND_URL}/api/permissions/${walletAddress}`);
        const permJson = await permRes.json();
        if (permJson.success && permJson.permission) {
          setSecurityProfile(permJson.permission.securityProfile);
        }
      } catch (permErr) {
        console.warn("Could not retrieve security profile settings:", permErr);
      }
    } catch (error) {
      console.error("Failed to fetch data from backend:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch data on walletAddress changes
  useEffect(() => {
    if (walletAddress) {
      refreshAllData();
      
      // Start EventSource subscription for real-time SSE threat/revocation alerts!
      const eventSource = new EventSource(`${BACKEND_URL}/api/events/${walletAddress}`);
      
      eventSource.addEventListener("THREAT_DETECTED", (e: any) => {
        const data = JSON.parse(e.data);
        console.log("🚨 Real-time event: THREAT_DETECTED", data);
        refreshAllData();
      });

      eventSource.addEventListener("REVOCATION_CONFIRMED", (e: any) => {
        const data = JSON.parse(e.data);
        console.log("✅ Real-time event: REVOCATION_CONFIRMED", data);
        refreshAllData();
      });

      eventSource.addEventListener("VETO_CONFIRMED", (e: any) => {
        const data = JSON.parse(e.data);
        console.log("🚫 Real-time event: VETO_CONFIRMED", data);
        refreshAllData();
      });

      eventSource.onerror = (err) => {
        console.error("SSE connection error:", err);
      };

      return () => {
        eventSource.close();
      };
    }
  }, [walletAddress]);

  // Execute manual revocation via backend EIP-7710/7715 relayer queue
  const revokeApproval = async (tokenAddress: string, spenderAddress: string, rawAllowance: string): Promise<boolean> => {
    if (!walletAddress) return false;
    try {
      const res = await fetch(`${BACKEND_URL}/api/revoke/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress: walletAddress,
          tokenAddress,
          spenderAddress,
          exposedValue: rawAllowance
        })
      });
      const data = await res.json();
      if (data.success) {
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
      const res = await fetch(`${BACKEND_URL}/api/veto/${eventId}`, {
        method: "POST"
      });
      const data = await res.json();
      if (data.success) {
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
      const res = await fetch(`${BACKEND_URL}/api/revoke/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress: walletAddress,
          approvals: approvalsToRevoke.map(a => ({
            tokenAddress: a.tokenAddress,
            spenderAddress: a.spenderAddress,
            exposedValue: a.rawAllowance
          }))
        })
      });
      const data = await res.json();
      if (data.success) {
        await refreshAllData();
        return true;
      }
      return false;
    } catch (err) {
      console.error("Batch revocation failed:", err);
      return false;
    }
  };

  const updateSecurityProfile = async (profile: 'safe' | 'balanced' | 'manual'): Promise<boolean> => {
    if (!walletAddress) return false;
    try {
      const res = await fetch(`${BACKEND_URL}/api/permissions/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress: walletAddress,
          securityProfile: profile
        })
      });
      const data = await res.json();
      if (data.success) {
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
      isConnected: !!walletAddress,
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
