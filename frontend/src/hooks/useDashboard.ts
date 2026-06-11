// ===== useDashboard — Dashboard stats, approvals, and history fetching =====
import { useCallback } from "react";
import { useStore } from "../store/index";
import { getDashboard, getApprovals, getHistory } from "../lib/api";
import type { DashboardStats, ApprovalInfo, ProtectionEvent } from "../types/index";

export function useDashboard() {
  const userAddress = useStore((s) => s.userAddress);
  const setStats = useStore((s) => s.setStats);
  const setApprovals = useStore((s) => s.setApprovals);
  const setHistory = useStore((s) => s.setHistory);

  const fetchDashboardData = useCallback(async () => {
    if (!userAddress) return;
    try {
      const [dbStats, dbApprovals, dbHistory] = await Promise.all([
        getDashboard(userAddress),
        getApprovals(userAddress),
        getHistory(userAddress),
      ]);

      if (dbStats && (dbStats as any).success !== false) {
        setStats(dbStats as unknown as DashboardStats);
      }
      
      if (dbApprovals && (dbApprovals as any).approvals) {
        setApprovals((dbApprovals as any).approvals as ApprovalInfo[]);
      }

      if (dbHistory && (dbHistory as any).events) {
        setHistory((dbHistory as any).events as ProtectionEvent[]);
      }
    } catch (error) {
      console.error("❌ Failed to fetch dashboard data:", error);
    }
  }, [userAddress, setStats, setApprovals, setHistory]);

  return {
    fetchDashboardData,
  };
}
