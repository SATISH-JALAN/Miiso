// ===== Zustand store — external state management for Miiso frontend =====
import { create } from "zustand";
import type { ApprovalInfo, ProtectionEvent, DashboardStats, SecurityProfile } from "../types/index";

interface VetoTimer {
  eventId: string;
  event: ProtectionEvent;
  remaining: number;
  intervalId: ReturnType<typeof setInterval>;
}

interface MiisoState {
  // Wallet
  userAddress: string | null;
  isConnected: boolean;
  isLoading: boolean;

  // Permission
  permissionContext: string | null;

  // Data
  stats: DashboardStats | null;
  approvals: ApprovalInfo[];
  history: ProtectionEvent[];
  securityProfile: SecurityProfile;

  // Live events (append-only, max 200)
  events: ProtectionEvent[];

  // Active veto timer (Tier 2)
  vetoTimer: VetoTimer | null;

  // Actions
  setUserAddress: (addr: string | null) => void;
  setIsLoading: (loading: boolean) => void;
  setPermission: (ctx: string | null) => void;
  setStats: (stats: DashboardStats | null) => void;
  setApprovals: (approvals: ApprovalInfo[]) => void;
  setHistory: (history: ProtectionEvent[]) => void;
  setSecurityProfile: (profile: SecurityProfile) => void;

  // Event actions
  appendEvent: (event: ProtectionEvent) => void;

  // Veto actions
  startVeto: (event: ProtectionEvent, onFire: () => void) => void;
  cancelVeto: () => void;

  // Reset
  reset: () => void;
}

export const useStore = create<MiisoState>((set, get) => ({
  // Initial state
  userAddress: typeof window !== "undefined" ? localStorage.getItem("miiso_wallet_address") : null,
  isConnected: typeof window !== "undefined" ? !!localStorage.getItem("miiso_wallet_address") : false,
  isLoading: false,
  permissionContext: null,
  stats: null,
  approvals: [],
  history: [],
  securityProfile: "balanced",
  events: [],
  vetoTimer: null,

  // Setters
  setUserAddress: (addr) => {
    if (addr) {
      localStorage.setItem("miiso_wallet_address", addr);
    } else {
      localStorage.removeItem("miiso_wallet_address");
    }
    set({ userAddress: addr, isConnected: !!addr });
  },
  setIsLoading: (loading) => set({ isLoading: loading }),
  setPermission: (ctx) => set({ permissionContext: ctx }),
  setStats: (stats) => set({ stats }),
  setApprovals: (approvals) => set({ approvals }),
  setHistory: (history) => set({ history }),
  setSecurityProfile: (profile) => set({ securityProfile: profile }),

  // Append event (max 200)
  appendEvent: (event) =>
    set((s) => ({
      events: [event, ...s.events].slice(0, 200),
    })),

  // Veto timer
  startVeto: (event, onFire) => {
    // Clear existing timer if any
    const existing = get().vetoTimer;
    if (existing) clearInterval(existing.intervalId);

    const intervalId = setInterval(() => {
      const current = get().vetoTimer;
      if (!current) return;

      const remaining = current.remaining - 1;
      if (remaining <= 0) {
        clearInterval(current.intervalId);
        set({ vetoTimer: null });
        onFire();
      } else {
        set({ vetoTimer: { ...current, remaining } });
      }
    }, 1000);

    set({
      vetoTimer: {
        eventId: event.id,
        event,
        remaining: 60,
        intervalId,
      },
    });
  },

  cancelVeto: () => {
    const { vetoTimer } = get();
    if (vetoTimer?.intervalId) clearInterval(vetoTimer.intervalId);
    set({ vetoTimer: null });
  },

  // Reset all state
  reset: () => {
    const { vetoTimer } = get();
    if (vetoTimer?.intervalId) clearInterval(vetoTimer.intervalId);
    localStorage.removeItem("miiso_wallet_address");
    set({
      userAddress: null,
      isConnected: false,
      isLoading: false,
      permissionContext: null,
      stats: null,
      approvals: [],
      history: [],
      securityProfile: "balanced",
      events: [],
      vetoTimer: null,
    });
  },
}));
