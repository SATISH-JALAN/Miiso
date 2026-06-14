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

  // Setup flow
  setupComplete: boolean;
  flaskSupported: boolean | null; // null = not checked yet

  // Permission
  permissionContext: string | null;
  grantMethod: string | null;

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
  setSetupComplete: (complete: boolean) => void;
  setFlaskSupported: (supported: boolean | null) => void;
  setPermission: (ctx: string | null) => void;
  setGrantMethod: (method: string | null) => void;
  setStats: (stats: DashboardStats | null) => void;
  setApprovals: (approvals: ApprovalInfo[]) => void;
  setHistory: (history: ProtectionEvent[]) => void;
  setSecurityProfile: (profile: SecurityProfile) => void;

  // Event actions
  appendEvent: (event: ProtectionEvent) => void;

  // Veto actions
  startVeto: (event: ProtectionEvent, onFire: () => void) => void;
  cancelVeto: () => void;
  confirmProtectionEvent: (eventId: string, txHash: string) => void;
  markVetoCancelled: (eventId: string) => void;
  setDormant: () => void;

  // Reset
  reset: () => void;
}

export const useStore = create<MiisoState>((set, get) => ({
  // Initial state
  userAddress: typeof window !== "undefined" ? localStorage.getItem("miiso_wallet_address") : null,
  isConnected: typeof window !== "undefined" ? !!localStorage.getItem("miiso_wallet_address") : false,
  isLoading: false,
  setupComplete: typeof window !== "undefined" ? localStorage.getItem("miiso_setup_complete") === "true" : false,
  flaskSupported: null,
  permissionContext: null,
  grantMethod: null,
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
  setSetupComplete: (complete) => {
    if (complete) {
      localStorage.setItem("miiso_setup_complete", "true");
    } else {
      localStorage.removeItem("miiso_setup_complete");
    }
    set({ setupComplete: complete });
  },
  setFlaskSupported: (supported) => set({ flaskSupported: supported }),
  setPermission: (ctx) => set({ permissionContext: ctx }),
  setGrantMethod: (method) => set({ grantMethod: method }),
  setStats: (stats) => set({ stats }),
  setApprovals: (approvals) => set({ approvals }),
  setHistory: (history) => set({ history, events: history.slice(0, 200) }),
  setSecurityProfile: (profile) => set({ securityProfile: profile }),

  // Append event (max 200)
  appendEvent: (event) =>
    set((s) => ({
      events: [event, ...s.events].slice(0, 200),
    })),

  // Veto timer
  startVeto: (event, onFire) => {
    const existing = get().vetoTimer;
    if (existing) clearInterval(existing.intervalId);

    const stagedUntilMs = event.stagedUntil
      ? new Date(event.stagedUntil).getTime()
      : Date.now() + 60_000;
    let remaining = Math.max(0, Math.ceil((stagedUntilMs - Date.now()) / 1000));
    if (remaining === 0) remaining = 60;

    const intervalId = setInterval(() => {
      const current = get().vetoTimer;
      if (!current) return;

      const nextRemaining = current.remaining - 1;
      if (nextRemaining <= 0) {
        clearInterval(current.intervalId);
        set({ vetoTimer: null });
        onFire();
      } else {
        set({ vetoTimer: { ...current, remaining: nextRemaining } });
      }
    }, 1000);

    set({
      vetoTimer: {
        eventId: event.id,
        event,
        remaining,
        intervalId,
      },
    });
  },

  cancelVeto: () => {
    const { vetoTimer } = get();
    if (vetoTimer?.intervalId) clearInterval(vetoTimer.intervalId);
    set({ vetoTimer: null });
  },

  confirmProtectionEvent: (eventId, txHash) => {
    const update = (e: ProtectionEvent) =>
      e.id === eventId
        ? {
            ...e,
            relayStatus: "confirmed" as const,
            relayTxHash: txHash,
            actionType: "revocation" as const,
          }
        : e;

    const { vetoTimer } = get();
    if (vetoTimer?.eventId === eventId && vetoTimer.intervalId) {
      clearInterval(vetoTimer.intervalId);
    }

    set((s) => ({
      history: s.history.map(update),
      events: s.events.map(update),
      vetoTimer: s.vetoTimer?.eventId === eventId ? null : s.vetoTimer,
    }));
  },

  markVetoCancelled: (eventId) => {
    const update = (e: ProtectionEvent) =>
      e.id === eventId ? { ...e, vetoCancelled: true, relayStatus: "failed" as const } : e;

    set((s) => ({
      history: s.history.map(update),
      events: s.events.map(update),
      vetoTimer: s.vetoTimer?.eventId === eventId ? null : s.vetoTimer,
    }));
    get().cancelVeto();
  },

  setDormant: () => {
    localStorage.removeItem("miiso_setup_complete");
    set({
      setupComplete: false,
      permissionContext: null,
      grantMethod: null,
      stats: null,
      approvals: [],
    });
  },

  // Reset all state
  reset: () => {
    const { vetoTimer } = get();
    if (vetoTimer?.intervalId) clearInterval(vetoTimer.intervalId);
    localStorage.removeItem("miiso_wallet_address");
    localStorage.removeItem("miiso_setup_complete");
    set({
      userAddress: null,
      isConnected: false,
      isLoading: false,
      setupComplete: false,
      flaskSupported: null,
      permissionContext: null,
      grantMethod: null,
      stats: null,
      approvals: [],
      history: [],
      securityProfile: "balanced",
      events: [],
      vetoTimer: null,
    });
  },
}));
