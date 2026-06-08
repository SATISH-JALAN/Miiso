import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function Terminal() {
  const sectionRef = useRef<HTMLElement>(null);
  const linesRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Setup elements
      gsap.set(linesRef.current, { opacity: 0 });

      // Create timeline
      const tl = gsap.timeline({
        paused: true,
        repeat: -1,
        repeatDelay: 2, // After line 9, pause 2 seconds
      });

      // Show lines one by one
      linesRef.current.forEach((line, i) => {
        if (!line) return;
        // Line 4 needs pulsing logic
        const isAnalyzing = i === 3;

        tl.to(
          line,
          {
            opacity: 1,
            duration: 0.1, // Quick snap in
          },
          i * 0.6,
        ); // 600ms gap

        if (isAnalyzing) {
          tl.to(
            line,
            {
              opacity: 0.5,
              duration: 0.5,
              yoyo: true,
              repeat: 3, // Pulse a few times while next lines appear
              ease: "none",
            },
            i * 0.6 + 0.1,
          );
        }
      });

      // Fade all out at the end of the timeline
      tl.to(
        linesRef.current,
        {
          opacity: 0,
          duration: 0.4,
          ease: "power2.inOut",
        },
        "+=2",
      ); // Wait 2s before fade out starts (on top of timeline end)

      // Start/stop based on scroll
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top 80%",
        end: "bottom 20%",
        onEnter: () => tl.play(),
        onLeave: () => tl.pause(),
        onEnterBack: () => tl.play(),
        onLeaveBack: () => tl.pause(),
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="section-padding bg-brand-bg relative z-10 border-t border-brand-border"
    >
      <div className="container-content text-center mb-16">
        <span className="font-mono text-[11px] text-[#19C978] uppercase tracking-widest font-bold block mb-4">
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
              <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
            </div>
            <div className="flex-1 text-center font-mono text-[12px] text-text-secondary">
              miiso — protection log
            </div>
          </div>

          {/* Body */}
          <div className="p-6 font-mono text-[13px] leading-[1.8] text-left">
            {/* Line 1 */}
            <div
              ref={(el) => {
                linesRef.current[0] = el;
              }}
              className="flex justify-between"
            >
              <span className="text-[#10B981]">
                21:14:02 ✓ <span className="text-[#71717A]">0x4a1f...9c2d</span>{" "}
                CLEAN
              </span>
              <span className="text-[#3F3F46]">$0.00095</span>
            </div>

            {/* Line 2 */}
            <div
              ref={(el) => {
                linesRef.current[1] = el;
              }}
              className="flex justify-between"
            >
              <span className="text-[#10B981]">
                22:31:17 ✓ <span className="text-[#71717A]">0x9b3c...1e8f</span>{" "}
                CLEAN
              </span>
              <span className="text-[#3F3F46]">$0.00095</span>
            </div>

            {/* Line 3 */}
            <div
              ref={(el) => {
                linesRef.current[2] = el;
              }}
              className="flex justify-between"
            >
              <span className="text-[#10B981]">
                23:48:55 ✓ <span className="text-[#71717A]">0x2f7a...4b12</span>{" "}
                CLEAN
              </span>
              <span className="text-[#3F3F46]">$0.00095</span>
            </div>

            {/* Line 4 */}
            <div
              ref={(el) => {
                linesRef.current[3] = el;
              }}
              className="flex justify-between mt-2"
            >
              <span className="text-[#F59E0B]">
                03:17:08 ⚠ <span className="text-[#71717A]">0xf4a1...9d23</span>{" "}
                ANALYZING...
              </span>
            </div>

            {/* Line 5 */}
            <div
              ref={(el) => {
                linesRef.current[4] = el;
              }}
              className="flex justify-between"
            >
              <span className="text-[#19C978]">
                03:17:09 → Venice AI: 97.4% confidence
              </span>
            </div>

            {/* Line 6 */}
            <div
              ref={(el) => {
                linesRef.current[5] = el;
              }}
              className="flex justify-between"
            >
              <span className="text-[#19C978]">
                03:17:09 → REENTRANCY DETECTED · Tier 1
              </span>
            </div>

            {/* Line 7 */}
            <div
              ref={(el) => {
                linesRef.current[6] = el;
              }}
              className="flex justify-between mt-2"
            >
              <span className="text-[#F59E0B]">
                03:17:13 ⚡ approve(0) fired · 1Shot relay
              </span>
            </div>

            {/* Line 8 */}
            <div
              ref={(el) => {
                linesRef.current[7] = el;
              }}
              className="flex justify-between mt-2"
            >
              <span className="text-[#10B981]">
                03:17:15 ✓ TX:{" "}
                <span className="text-[#71717A]">0x9f2c...a13d</span> ·
                CONFIRMED
              </span>
            </div>

            {/* Line 9 */}
            <div
              ref={(el) => {
                linesRef.current[8] = el;
              }}
              className="flex justify-between"
            >
              <span className="text-[#10B981]">
                03:17:15 ✓ USDC allowance → 0 · saved $7,000
              </span>
            </div>
          </div>
        </div>

        {/* Stats Row Below Terminal */}
        <div className="mt-6 flex justify-center text-center">
          <p className="font-mono text-[12px] text-[#3F3F46]">
            4 scans · $0.0038 USDC total · 7.1 seconds · 0 user actions
          </p>
        </div>
      </div>
    </section>
  );
}
