import { useEffect, useRef } from "react";
import { useStore } from "../store/index";
import { getSSEUrl } from "../lib/api";
import type { ProtectionEvent } from "../types/index";

export function useSSE(userAddress: string | null) {
  const appendEvent = useStore((s) => s.appendEvent);
  const startVeto = useStore((s) => s.startVeto);
  const confirmProtectionEvent = useStore((s) => s.confirmProtectionEvent);
  const markVetoCancelled = useStore((s) => s.markVetoCancelled);
  const setDormant = useStore((s) => s.setDormant);
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
          /* heartbeats */
        }
      };

      es.addEventListener("PROTECTION_STAGED", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          const stagedEvent: ProtectionEvent = {
            id: data.eventId,
            userAddress: userAddress!,
            tokenAddress: data.tokenAddress,
            spenderAddress: data.spenderAddress,
            exposedValue: data.amount ?? "0",
            actionType: "veto",
            severity: "medium",
            vetoCancelled: false,
            stagedUntil: data.stagedUntil,
            relayStatus: "pending",
            createdAt: new Date().toISOString(),
          };
          appendEvent(stagedEvent);
          startVeto(stagedEvent, () => {
            /* backend auto-executes when countdown expires */
          });
        } catch { /* ignore */ }
      });

      es.addEventListener("PROTECTION_CONFIRMED", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data.eventId && data.txHash) {
            confirmProtectionEvent(data.eventId, data.txHash);
          }
        } catch { /* ignore */ }
      });

      es.addEventListener("VETO_CONFIRMED", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data.eventId) {
            markVetoCancelled(data.eventId);
          }
        } catch { /* ignore */ }
      });

      es.addEventListener("PERMISSION_REVOKED", () => {
        setDormant();
      });

      es.addEventListener("CLEAN_SCAN", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          const isScanning = data.status === "scanning";
          const cleanEvent: ProtectionEvent = {
            id: `clean-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            userAddress: userAddress!,
            tokenAddress: "N/A",
            spenderAddress: data.contractAddress,
            exposedValue: isScanning
              ? "Scanning…"
              : data.inferenceCostUsdc
                ? `$${data.inferenceCostUsdc.toFixed(5)}`
                : "$0.00095",
            actionType: "clean",
            severity: "low",
            vetoCancelled: false,
            stagedUntil: null,
            createdAt: data.timestamp || new Date().toISOString(),
          };
          appendEvent(cleanEvent);
        } catch { /* ignore */ }
      });

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
  }, [
    userAddress,
    appendEvent,
    startVeto,
    confirmProtectionEvent,
    markVetoCancelled,
    setDormant,
  ]);
}
