import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function HorizontalScroll() {
  const sectionRef = useRef<HTMLElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const section = sectionRef.current;
    const strip = stripRef.current;

    if (!section || !strip) return;

    const ctx = gsap.context(() => {
      const scrollDistance = () =>
        -(strip.scrollWidth - window.innerWidth + 96);

      const stripTween = gsap.to(strip, {
        x: scrollDistance,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "+=400%",
          scrub: 1,
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });

      cardsRef.current.forEach((card) => {
        if (!card) return;

        gsap.from(card, {
          opacity: 0.3,
          y: 20,
          ease: "none",
          scrollTrigger: {
            trigger: card,
            containerAnimation: stripTween,
            start: "left 90%", // Start animating when the card enters the right side of the screen
            end: "center center", // Finish when centered
            scrub: true,
          },
        });
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative h-screen bg-brand-bg overflow-hidden flex items-center"
    >
      <div className="absolute top-12 left-0 w-full text-center pointer-events-none z-10">
        <h2 className="text-section text-text-primary">
          The threat happens in seconds
        </h2>
      </div>

      <div
        ref={stripRef}
        className="flex gap-6 px-12 items-center h-full w-max mt-20"
      >
        {/* Card 1 */}
        <div
          ref={(el) => {
            cardsRef.current[0] = el;
          }}
          className="w-95 h-105 bg-brand-surface border border-brand-border rounded-2xl card-inner flex flex-col justify-between shrink-0"
        >
          <div>
            <div className="flex items-center gap-4 mb-6">
              <div className="relative w-4 h-4 flex items-center justify-center">
                <div className="absolute w-full h-full bg-[#C27A73] rounded-full animate-ping opacity-75"></div>
                <div className="relative w-2 h-2 bg-[#C27A73] rounded-full"></div>
              </div>
              <span className="font-mono text-[12px] text-[#C27A73]">
                03:17:08 AM
              </span>
            </div>
            <h3 className="text-2xl font-bold mb-4 leading-tight text-text-primary">
              Malicious contract deployed on Base
            </h3>
            <p className="text-body leading-relaxed">
              Attacker pushes contract with hidden reentrancy vector. 0 users
              affected yet.
            </p>
          </div>
          <div className="font-mono text-[12px] text-text-muted mt-auto pt-4 border-t border-brand-border">
            T + 0 seconds
          </div>
        </div>

        {/* Card 2 */}
        <div
          ref={(el) => {
            cardsRef.current[1] = el;
          }}
          className="w-95 h-105 bg-brand-surface border border-brand-border rounded-2xl card-inner flex flex-col justify-between shrink-0"
        >
          <div>
            <div className="flex items-center gap-4 mb-6">
              <div className="relative w-4 h-4 flex items-center justify-center">
                <div className="absolute w-full h-full border border-[#B8CFA8] rounded-full animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
                <div className="relative w-2 h-2 bg-[#B8CFA8] rounded-full"></div>
              </div>
              <span className="font-mono text-[12px] text-[#B8CFA8]">
                03:17:09 AM
              </span>
            </div>
            <h3 className="text-2xl font-bold mb-4 leading-tight text-text-primary">
              Bytecode analyzed by Venice AI
            </h3>
            <p className="text-body leading-relaxed mb-6">
              Heimdall decompiles contract. Venice returns 97.4% confidence
              exploit signature.
            </p>
            <div className="w-full h-1.5 bg-brand-bg rounded-full overflow-hidden">
              <div className="h-full bg-[#B8CFA8] w-[97.4%] rounded-full shadow-[0_0_10px_var(--color-accent-glow)]"></div>
            </div>
          </div>
          <div className="font-mono text-[12px] text-text-muted mt-auto pt-4 border-t border-brand-border">
            T + 1.1 seconds
          </div>
        </div>

        {/* Card 3 */}
        <div
          ref={(el) => {
            cardsRef.current[2] = el;
          }}
          className="w-95 h-105 bg-brand-surface border border-brand-border rounded-2xl card-inner flex flex-col justify-between shrink-0"
        >
          <div>
            <div className="flex items-center gap-4 mb-6">
              <div className="relative w-4 h-4 flex items-center justify-center">
                <div className="absolute w-full h-full align-middle text-[#10B981] animate-pulse">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    ></path>
                  </svg>
                </div>
              </div>
              <span className="font-mono text-[12px] text-[#10B981]">
                03:17:13 AM
              </span>
            </div>
            <h3 className="text-2xl font-bold mb-4 leading-tight text-text-primary">
              approve(0) executed via 1Shot
            </h3>
            <p className="text-body leading-relaxed">
              Your USDC and WETH approvals to attacker contract reset to zero.
              Gas: $0.01 USDC.
            </p>
          </div>
          <div className="font-mono text-[12px] text-text-muted mt-auto pt-4 border-t border-brand-border">
            T + 5 seconds
          </div>
        </div>

        {/* Card 4 */}
        <div
          ref={(el) => {
            cardsRef.current[3] = el;
          }}
          className="relative w-95 h-105 rounded-2xl border border-brand-border overflow-hidden shrink-0 flex flex-col justify-between"
        >
          {/* Split background */}
          <div className="absolute inset-0 z-0 flex">
            <div className="w-1/2 h-full bg-[#C27A73]/5"></div>
            <div className="w-1/2 h-full bg-[#10B981]/5"></div>
          </div>

          <div className="relative z-10 p-7 h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-4 mb-6">
                <span className="font-mono text-[12px] text-[#71717A]">
                  03:17:41 AM
                </span>
              </div>
              <h3 className="text-2xl font-bold mb-2 leading-tight text-text-primary">
                $2.4M drained from unprotected wallets
              </h3>
              <p className="text-[#10B981] font-medium text-[14px]">
                Your balance: unchanged.
              </p>
            </div>

            <div className="mb-4 text-center">
              <p className="text-[64px] font-extrabold text-[#10B981] leading-none mb-4 drop-shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                $0
              </p>
              <p className="text-[14px] text-text-secondary font-medium tracking-wide">
                lost
              </p>
            </div>

            <div className="font-mono text-[12px] text-text-muted pt-4 border-t border-brand-border">
              T + 33 seconds after Miiso acted
            </div>
          </div>
        </div>

        {/* Padding element for proper scrolling endpoint */}
        <div className="w-12 shrink-0"></div>
      </div>
    </section>
  );
}
