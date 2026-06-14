import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function BentoGrid() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const meshBgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Mesh background animation on Card 1
      if (meshBgRef.current) {
        gsap.to(meshBgRef.current, {
          backgroundPosition: "200% center",
          duration: 20,
          ease: "none",
          repeat: -1,
        });
      }

      // Entrance animation for all cards
      const cards = cardsRef.current.filter(Boolean);
      if (cards.length > 0) {
        gsap.from(cards, {
          y: 30,
          opacity: 0,
          duration: 0.8,
          stagger: 0.08,
          ease: "power3.out",
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top 80%",
          },
        });
      }

      // Hover interactions
      cards.forEach((card) => {
        if (!card) return;

        const handleMouseEnter = () => {
          gsap.to(card, {
            borderColor: "rgba(25,201,120,0.3)",
            scale: 1.01,
            y: -4,
            duration: 0.3,
            ease: "power2.out",
          });
        };

        const handleMouseLeave = () => {
          gsap.to(card, {
            borderColor: "rgba(255, 255, 255, 0.08)",
            scale: 1,
            y: 0,
            duration: 0.3,
            ease: "power2.out",
          });
          // Reset spotlight variable
          gsap.to(card, {
            "--mx": "50%",
            "--my": "50%",
            duration: 0.3,
          });
        };

        const handleMouseMove = (e: MouseEvent) => {
          const rect = card.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;

          gsap.to(card, {
            "--mx": `${x}px`,
            "--my": `${y}px`,
            duration: 0.1,
            ease: "none",
          });
        };

        gsap.set(card, { "--mx": "50%", "--my": "50%" });

        card.addEventListener("mouseenter", handleMouseEnter);
        card.addEventListener("mouseleave", handleMouseLeave);
        card.addEventListener("mousemove", handleMouseMove);
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      className="section-padding bg-brand-bg relative z-10"
      id="pricing"
      ref={containerRef}
    >
      <div className="container-content">
        <div className="mb-16 text-center md:text-left">
          <span className="font-mono text-[11px] text-[#B8CFA8] uppercase tracking-widest font-bold block mb-4">
            Why Miiso
          </span>
          <h2 className="text-[44px] font-bold text-text-primary leading-[1.1] tracking-tight">
            Everything a security agent should be.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 auto-rows-[minmax(320px,auto)]">
          {/* Card 1 */}
          <div
            ref={(el) => {
              cardsRef.current[0] = el;
            }}
            className="spotlight-card md:col-span-2 bg-brand-surface rounded-3xl border border-brand-border p-8 md:p-12 relative overflow-hidden flex flex-col justify-end min-h-90"
          >
            <div
              ref={meshBgRef}
              className="mesh-bg absolute inset-0 z-0 opacity-40 pointer-events-none"
            />
            <div className="relative z-10 max-w-2xl">
              <h3 className="text-3xl font-bold mb-4">
                Proactive, not reactive
              </h3>
              <p className="text-xl text-body leading-relaxed">
                Miiso scans contracts the moment they are deployed — before any
                user can interact with them.
              </p>
            </div>
          </div>

          {/* Card 2 */}
          <div
            ref={(el) => {
              cardsRef.current[1] = el;
            }}
            className="spotlight-card bg-brand-surface rounded-3xl border border-brand-border p-8 md:p-12 relative overflow-hidden flex flex-col justify-between"
          >
            <div className="text-[56px] font-extrabold leading-none mb-6 text-text-primary tabular-nums">
              0 ETH
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2">Zero ETH needed</h3>
              <p className="text-body">Gas paid in USDC via 1Shot relay</p>
            </div>
          </div>

          {/* Card 3 */}
          <div
            ref={(el) => {
              cardsRef.current[2] = el;
            }}
            className="spotlight-card bg-brand-surface rounded-3xl border border-brand-border p-8 md:p-12 relative overflow-hidden flex flex-col justify-between"
          >
            <div className="text-[56px] font-extrabold leading-none mb-6 text-[#10B981] tabular-nums drop-shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              $0.01
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2">Costs pennies</h3>
              <p className="text-body">Per protection event on Base</p>
            </div>
          </div>

          {/* Card 4 */}
          <div
            ref={(el) => {
              cardsRef.current[3] = el;
            }}
            className="spotlight-card bg-brand-surface rounded-3xl border border-brand-border p-8 md:p-12 relative overflow-hidden flex flex-col justify-between"
          >
            <div className="mb-8 flex items-center justify-between">
              <div className="w-12 h-12 bg-brand-accent/20 rounded-xl flex items-center justify-center border border-brand-accent/30 text-brand-accent font-bold">
                V
              </div>
              <div className="bg-[#B8CFA8]/10 text-[#B8CFA8] px-3 py-1 rounded-full font-mono text-xs font-bold border border-[#B8CFA8]/20">
                97.4% confidence
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2">AI-powered</h3>
              <p className="text-body leading-relaxed">
                Uncensored LLM analysis. No safety filter blocking exploit
                pattern detection.
              </p>
            </div>
          </div>

          {/* Card 5 */}
          <div
            ref={(el) => {
              cardsRef.current[4] = el;
            }}
            className="spotlight-card bg-brand-surface rounded-3xl border border-brand-border p-8 md:p-12 relative overflow-hidden flex flex-col justify-between"
          >
            <div className="mb-8 space-y-2">
              <div className="bg-[#10B981]/10 text-[#10B981] px-4 py-2 rounded-lg font-mono text-xs font-bold border border-[#10B981]/20 w-fit shrink-0 tracking-widest">
                ✓ revoke
              </div>
              <div className="bg-[#C27A73]/10 text-[#C27A73] px-4 py-2 rounded-lg font-mono text-xs font-bold border border-[#C27A73]/20 w-fit shrink-0 tracking-widest">
                ✗ transfer
              </div>
              <div className="bg-[#C27A73]/10 text-[#C27A73] px-4 py-2 rounded-lg font-mono text-xs font-bold border border-[#C27A73]/20 w-fit shrink-0 tracking-widest">
                ✗ swap
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2">Least privilege</h3>
              <p className="text-body">Enforced on-chain. Not a policy.</p>
            </div>
          </div>

          {/* Card 6 */}
          <div
            ref={(el) => {
              cardsRef.current[5] = el;
            }}
            className="spotlight-card md:col-span-2 bg-brand-surface rounded-3xl border border-brand-border p-8 md:p-12 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-end gap-12"
          >
            <div className="flex-1 max-w-xl relative w-full">
              <h3 className="text-3xl font-bold mb-4">
                Pay only when protected
              </h3>
              <p className="text-xl text-body leading-relaxed">
                No subscription. No monthly fee. Pure outcome.
              </p>
            </div>

            <div className="bg-brand-bg border border-brand-border rounded-xl p-6 w-full md:w-auto shrink-0 relative min-w-70">
              <div className="absolute top-0 right-10 w-px h-full bg-brand-border shrink-0"></div>
              <div className="space-y-6 relative z-10 w-full">
                <div className="flex items-center justify-between gap-12">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-text-muted"></div>
                    <span className="font-mono text-sm text-text-secondary">
                      No threat
                    </span>
                  </div>
                  <span className="font-bold tabular-nums text-text-muted">
                    $0
                  </span>
                </div>
                <div className="flex items-center justify-between gap-12">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full bg-[#10B981] shadow-[0_0_10px_rgba(16,185,129,0.3)] flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-brand-bg rounded-full"></div>
                    </div>
                    <span className="font-mono text-sm text-[#10B981] font-bold">
                      Threat blocked
                    </span>
                  </div>
                  <span className="font-bold tabular-nums text-[#10B981]">
                    1.5%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
