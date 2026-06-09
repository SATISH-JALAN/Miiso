import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function StickyScroll() {
  const containerRef = useRef<HTMLDivElement>(null);
  const leftColRef = useRef<HTMLDivElement>(null);
  const rightColRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<(HTMLDivElement | null)[]>([]);
  const dotsRef = useRef<(HTMLDivElement | null)[]>([]);

  // Terminal mock animation reference
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalLinesRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // 1. Right Side Steps Entrance
      stepsRef.current.forEach((step, index) => {
        if (!step) return;

        gsap.from(step, {
          y: 40,
          opacity: 0,
          duration: 0.6,
          ease: "power3.out",
          scrollTrigger: {
            trigger: step,
            start: "top 80%",
            toggleActions: "play none none reverse", // Optional: reverse on scroll up
          },
        });

        // 2. Active Dot Update logic - tie progress indicator to step scroll position
        ScrollTrigger.create({
          trigger: step,
          start: "top center",
          end: "bottom center",
          onToggle: (self) => {
            if (self.isActive && dotsRef.current[index]) {
              // Deactivate all
              gsap.to(dotsRef.current, {
                backgroundColor: "var(--color-brand-border)",
                duration: 0.3,
              });
              // Activate current
              gsap.to(dotsRef.current[index], {
                backgroundColor: "#19C978",
                duration: 0.3,
              });
            }
          },
        });
      });

      // 3. Terminal Animation (Step 3)
      if (terminalLinesRef.current.length > 0) {
        const termTl = gsap.timeline({ repeat: -1 });

        // Hide all initially
        gsap.set(terminalLinesRef.current, { opacity: 0, x: -10 });

        terminalLinesRef.current.forEach((line, i) => {
          if (!line) return;
          termTl.to(line, { opacity: 1, x: 0, duration: 0.2 }, "+=0.8");
        });

        // Reset and loop
        termTl.to(
          terminalLinesRef.current,
          { opacity: 0, duration: 0.2 },
          "+=2",
        );
      }
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="how-it-works"
      ref={containerRef}
      className="section-padding relative bg-brand-bg border-t border-brand-border"
    >
      <div className="container-content">
        <div className="flex flex-col md:flex-row items-start gap-12 lg:gap-24">
          {/* Left Column (Sticky) */}
          <div
            ref={leftColRef}
            className="md:sticky md:top-30 md:w-1/3 shrink-0 py-12"
          >
            <div className="mb-4">
              <span className="font-mono text-[11px] text-[#19C978] uppercase tracking-widest font-bold">
                How it works
              </span>
            </div>
            <h2 className="text-[44px] font-bold text-text-primary leading-[1.1] mb-12 whitespace-pre-line tracking-tight">
              {"Set up once.\nProtected forever."}
            </h2>

            <div className="hidden md:flex flex-col items-center w-fit gap-2 h-50">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex flex-col items-center">
                  <div
                    ref={(el) => {
                      dotsRef.current[i] = el;
                    }}
                    className={`w-3 h-3 rounded-full transition-colors duration-300 ${i === 0 ? "bg-[#19C978]" : "bg-brand-border"}`}
                  />
                  {i < 3 && (
                    <div className="w-px h-10 bg-brand-border my-2" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right Column (Scrolling) */}
          <div ref={rightColRef} className="md:w-2/3 flex flex-col pt-12">
            {/* Step 1 */}
            <div
              ref={(el) => {
                stepsRef.current[0] = el;
              }}
              className="h-[80vh] min-h-125 flex flex-col justify-center gap-8"
            >
              <div className="bg-brand-surface border border-brand-border rounded-2xl p-8 max-w-sm w-full mx-auto md:mx-0 relative shadow-2xl overflow-hidden">
                <div className="flex items-center gap-3 mb-6 pb-6 border-b border-brand-border">
                  <div className="w-8 h-8 bg-brand-bg rounded-full flex items-center justify-center border border-brand-border">
                    🦊
                  </div>
                  <span className="font-bold">Connect Wallet</span>
                </div>
                <div className="space-y-4">
                  <div className="h-10 bg-brand-bg rounded-lg border border-brand-border w-full flex items-center px-4 justify-center font-mono text-sm text-text-muted">
                    Signature request
                  </div>
                  <div className="h-10 bg-[#19C978] text-[#0A0A0A] rounded-lg w-full flex items-center justify-center font-bold shadow-[0_0_15px_var(--color-accent-glow)]">
                    Sign
                  </div>
                </div>
              </div>
              <div className="max-w-md mx-auto md:mx-0">
                <h3 className="text-2xl font-bold mb-3">Connect your wallet</h3>
                <p className="text-body">
                  Connect your MetaMask wallet. No ETH required — Miiso handles
                  gas through 1Shot using USDC.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div
              ref={(el) => {
                stepsRef.current[1] = el;
              }}
              className="h-[80vh] min-h-125 flex flex-col justify-center gap-8"
            >
              <div className="bg-brand-surface border border-[#19C978]/30 rounded-2xl p-8 max-w-sm w-full mx-auto md:mx-0 shadow-[0_0_40px_rgba(25,201,120,0.08)]">
                <h4 className="font-mono text-xs text-[#19C978] mb-4">
                  ERC-7715 PERMISSION
                </h4>
                <ul className="space-y-3 font-mono text-[13px]">
                  <li className="flex items-center gap-2 text-[#10B981]">
                    <span className="w-4">✓</span> Can revoke approvals
                  </li>
                  <li className="flex items-center gap-2 text-[#EF4444]">
                    <span className="w-4">✗</span> Cannot transfer funds
                  </li>
                  <li className="flex items-center gap-2 text-[#EF4444]">
                    <span className="w-4">✗</span> Cannot swap tokens
                  </li>
                  <li className="flex items-center gap-2 text-[#EF4444]">
                    <span className="w-4">✗</span> Cannot touch your balance
                  </li>
                </ul>
              </div>
              <div className="max-w-md mx-auto md:mx-0">
                <h3 className="text-2xl font-bold mb-3">
                  Grant one permission
                </h3>
                <p className="text-body">
                  You grant Miiso exactly one ability — revoking dangerous
                  approvals. Nothing else. Ever.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div
              ref={(el) => {
                stepsRef.current[2] = el;
              }}
              className="h-[80vh] min-h-125 flex flex-col justify-center gap-8"
            >
              <div
                ref={terminalRef}
                className="bg-[#0A0A0A] border border-brand-border rounded-xl p-6 max-w-sm w-full mx-auto md:mx-0 font-mono text-[12px] leading-loose shadow-xl"
              >
                <div className="flex gap-2 mb-4">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444]/80"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]/80"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#10B981]/80"></div>
                </div>
                <div className="space-y-2 mt-4 text-text-muted">
                  <div
                    ref={(el) => {
                      terminalLinesRef.current[0] = el;
                    }}
                    className="text-[#10B981]"
                  >
                    03:14 ✓ contract 0x4a1f...CLEAN
                  </div>
                  <div
                    ref={(el) => {
                      terminalLinesRef.current[1] = el;
                    }}
                    className="text-[#10B981]"
                  >
                    03:31 ✓ contract 0x9b3c...CLEAN
                  </div>
                  <div
                    ref={(el) => {
                      terminalLinesRef.current[2] = el;
                    }}
                    className="text-[#F59E0B]"
                  >
                    03:17 ⚠ contract 0xf4a1...ANALYZING
                  </div>
                </div>
              </div>
              <div className="max-w-md mx-auto md:mx-0">
                <h3 className="text-2xl font-bold mb-3">Miiso scans 24/7</h3>
                <p className="text-body">
                  Every contract deployed on Base is analyzed by Venice AI's
                  uncensored reasoning model.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div
              ref={(el) => {
                stepsRef.current[3] = el;
              }}
              className="h-[80vh] min-h-125 flex flex-col justify-center gap-8"
            >
              <div className="bg-brand-surface border border-[#10B981]/30 rounded-2xl p-8 max-w-sm w-full mx-auto md:mx-0 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[#10B981]/5" />
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <svg
                    width="120"
                    height="120"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="2"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                  </svg>
                </div>
                <h4 className="font-mono text-xs text-[#10B981] mb-2 relative z-10">
                  FUNDS SECURED
                </h4>
                <div className="text-[64px] font-extrabold text-[#10B981] leading-none mb-1 drop-shadow-[0_0_20px_rgba(16,185,129,0.3)] relative z-10">
                  $0
                </div>
                <div className="text-[#10B981] opacity-80 font-medium text-sm relative z-10">
                  lost to exploit
                </div>
              </div>
              <div className="max-w-md mx-auto md:mx-0">
                <h3 className="text-2xl font-bold mb-3">
                  Automatic protection
                </h3>
                <p className="text-body">
                  When a threat is confirmed, your approvals are revoked before
                  attackers can act. You are notified. The success fee is
                  deducted only if you were protected.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
