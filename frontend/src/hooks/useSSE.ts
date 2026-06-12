// ===== useSSE — persistent SSE connection with auto-reconnect =====
import { useEffect, useRef } from "react";
import { useStore } from "../store/index";
import { getSSEUrl } from "../lib/api";
import type { ProtectionEvent } from "../types/index";

/**
 * Subscribes to the backend SSE stream for real-time threat events.
 * Auto-reconnects on disconnect (3s retry).
 * Pushes events into Zustand store (NOT React state) to avoid re-render cascades.
 */
export function useSSE(userAddress: string | null) {
  const appendEvent = useStore((s) => s.appendEvent);
  const startVeto = useStore((s) => s.startVeto);
  const setHistory = useStore((s) => s.setHistory);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!userAddress) return;

    let reconnectTimer: ReturnType<typeof setTimeout>;
    let isMounted = true;

    function connect() {
      if (!isMounted) return;

      const url = getSSEUrl(userAddress!);
      const es = new EventSource(url);
      esRef.current = es;

      es.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data) as ProtectionEvent;
          appendEvent(event);
        } catch {
          // Ignore non-JSON messages (heartbeats, etc.)
        }
      };

      // Listen for specific event types
      es.addEventListener("PROTECTION_STAGED", (e: any) => {
        try {
          const data = JSON.parse(e.data);
          console.log("⏰ SSE: PROTECTION_STAGED received", data);

          // Start veto countdown in Zustand
          startVeto(data as ProtectionEvent, () => {
            console.log("⏰ Veto countdown expired — backend will auto-execute");
          });
        } catch { /* ignore parse errors */ }
      });

      es.addEventListener("PROTECTION_CONFIRMED", (e: any) => {
        try {
          const data = JSON.parse(e.data);
          console.log("✅ SSE: PROTECTION_CONFIRMED received", data);
        } catch { /* ignore */ }
      });

      es.addEventListener("VETO_CONFIRMED", (e: any) => {
        try {
          const data = JSON.parse(e.data);
          console.log("🚫 SSE: VETO_CONFIRMED received", data);
        } catch { /* ignore */ }
      });

      es.addEventListener("PERMISSION_REVOKED", (e: any) => {
        try {
          const data = JSON.parse(e.data);
          console.log("🔒 SSE: PERMISSION_REVOKED received", data);
        } catch { /* ignore */ }
      });

      es.addEventListener("CLEAN_SCAN", (e: any) => {
        try {
          const data = JSON.parse(e.data);
          console.log("✨ SSE: CLEAN_SCAN received", data);
          const cleanEvent: ProtectionEvent = {
            id: `clean-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            userAddress: userAddress!,
            tokenAddress: "N/A", // Not a specific token, just a scan
            spenderAddress: data.contractAddress,
            exposedValue: data.inferenceCostUsdc ? `$${data.inferenceCostUsdc.toFixed(5)}` : "$0.00095",
            actionType: "clean",
            severity: "low",
            vetoCancelled: false,
            stagedUntil: null,
            createdAt: data.timestamp || new Date().toISOString()
          };
          appendEvent(cleanEvent);
        } catch { /* ignore */ }
      });

      // Auto-reconnect on error (3s delay)
      es.onerror = () => {
        es.close();
        esRef.current = null;
        if (isMounted) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };
    }

    connect();

    return () => {
      isMounted = false;
      clearTimeout(reconnectTimer);
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [userAddress, appendEvent, startVeto, setHistory]);
}
