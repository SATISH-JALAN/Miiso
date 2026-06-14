import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { getPublicSSEUrl } from "./lib/api";

gsap.registerPlugin(ScrollTrigger);

interface ScanEntry {
  contractAddress: string;
  inferenceCostUsdc: number;
  timestamp: string;
}

const MAX_VISIBLE = 12;

function formatAddr(addr: string) {
  if (!addr || addr.length < 10) return addr;
  return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "––:––:––";
  }
}

function formatCost(usdc: number) {
  if (!usdc || usdc === 0) return "$0.00095";
  return `$${usdc.toFixed(5)}`;
}

export function Terminal() {
  const sectionRef = useRef<HTMLElement>(null);
  const [scans, setScans] = useState<ScanEntry[]>([]);
  const [totalScans, setTotalScans] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [connected, setConnected] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Connect to public SSE endpoint for real-time scans
  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let isMounted = true;

    function connect() {
      if (!isMounted) return;

      const url = getPublicSSEUrl();
      es = new EventSource(url);

      es.addEventListener("CONNECT_SUCCESS", () => {
        if (isMounted) setConnected(true);
      });

      es.addEventListener("CLEAN_SCAN", (e: any) => {
        try {
          const data = JSON.parse(e.data) as ScanEntry;
          if (isMounted) {
            setScans(prev => {
              const next = [data, ...prev].slice(0, MAX_VISIBLE);
              return next;
            });
            setTotalScans(prev => prev + 1);
            setTotalCost(prev => prev + (data.inferenceCostUsdc || 0.00095));
          }
        } catch { /* ignore parse errors */ }
      });

      es.onerror = () => {
        es?.close();
        if (isMounted) {
          setConnected(false);
          reconnectTimer = setTimeout(connect, 3000);
        }
      };
    }

    connect();

    return () => {
      isMounted = false;
      clearTimeout(reconnectTimer);
      es?.close();
    };
  }, []);

  // Animate new entries as they appear
  useEffect(() => {
    if (listRef.current && listRef.current.firstElementChild) {
      gsap.from(listRef.current.firstElementChild, {
        opacity: 0,
        x: -15,
        duration: 0.3,
        ease: "power2.out",
      });
    }
  }, [scans.length]);

  return (
    <section
      ref={sectionRef}
      className="section-padding bg-brand-bg relative z-10 border-t border-brand-border"
    >
      <div className="container-content text-center mb-16">
        <span className="font-mono text-[11px] text-[#B8CFA8] uppercase tracking-widest font-bold block mb-4">
          See it happen
        </span>
        <h2 className="text-[44px] font-bold text-text-primary leading-[1.1] tracking-tight whitespace-pre-line">
          {"Real protection.\nReal time."}
        </h2>
      </div>
      <div className="max-w-180 mx-auto w-full">
        {/* Terminal Card */}
        <div className="bg-[#0A0A0A] rounded-2xl border border-brand-border overflow-hidden shadow-2xl">
          {/* Top Bar */}
          <div className="bg-[#0F0F0F] border-b border-brand-border flex items-center px-4 h-10 relative">
            <div className="flex gap-2 absolute left-4">
              <div className="w-2.5 h-2.5 rounded-full bg-[#C27A73]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
            </div>
            <div className="flex-1 text-center font-mono text-[12px] text-text-secondary flex items-center justify-center gap-2">
              miiso — live protection log
              {connected && (
                <span className="w-1.5 h-1.5 bg-[#10B981] rounded-full animate-pulse" />
              )}
            </div>
          </div>

          {/* Body */}
          <div ref={listRef} className="p-6 font-mono text-[13px] leading-[1.8] text-left min-h-[280px] max-h-[400px] overflow-hidden">
            {scans.length === 0 ? (
              <div className="flex items-center justify-center h-[240px]">
                <div className="text-center">
                  <div className="w-4 h-4 border-2 border-t-transparent border-[#B8CFA8] rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-[#3F3F46] text-sm">
                    {connected ? "Waiting for next Base block..." : "Connecting to Base network..."}
                  </p>
                </div>
              </div>
            ) : (
              scans.map((scan, i) => (
                <div key={`${scan.contractAddress}-${scan.timestamp}-${i}`} className="flex justify-between">
                  <span className="text-[#10B981]">
                    {formatTime(scan.timestamp)} ✓{" "}
                    <span className="text-[#71717A]">{formatAddr(scan.contractAddress)}</span>{" "}
                    CLEAN
                  </span>
                  <span className="text-[#3F3F46]">{formatCost(scan.inferenceCostUsdc)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Stats Row Below Terminal */}
        <div className="mt-6 flex justify-center text-center">
          <p className="font-mono text-[12px] text-[#3F3F46]">
            {totalScans > 0
              ? `${totalScans} scans · $${totalCost.toFixed(4)} USDC total · live on Base`
              : "Listening to Base network..."}
          </p>
        </div>
      </div>
    </section>
  );
}
