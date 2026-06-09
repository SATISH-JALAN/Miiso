import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function StatsRow() {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<(HTMLDivElement | null)[]>([]);
  const numsRef = useRef<{ val: number }[]>([
    { val: 0 },
    { val: 0 },
    { val: 0 },
    { val: 0 },
  ]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Curtain Reveal for the entire item
      gsap.from(itemsRef.current, {
        y: 60,
        opacity: 0,
        duration: 0.8,
        stagger: 0.15,
        ease: "power3.out",
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 80%",
        },
      });

      // Number counter animations
      const updateNumber = (
        el: HTMLElement | null,
        val: number,
        prefix: string,
        suffix: string,
        decimals: number,
      ) => {
        if (el) {
          el.textContent = `${prefix}${val.toFixed(decimals)}${suffix}`;
        }
      };

      ScrollTrigger.create({
        trigger: containerRef.current,
        start: "top 80%",
        onEnter: () => {
          // Stat 1: $1.49B
          gsap.to(numsRef.current[0], {
            val: 1.49,
            duration: 2,
            ease: "power2.out",
            onUpdate: function () {
              updateNumber(
                itemsRef.current[0]?.querySelector("h4") || null,
                this.targets()[0].val,
                "$",
                "B",
                2,
              );
            },
          });

          // Stat 2: 75%+
          gsap.to(numsRef.current[1], {
            val: 75,
            duration: 2,
            ease: "power2.out",
            onUpdate: function () {
              updateNumber(
                itemsRef.current[1]?.querySelector("h4") || null,
                this.targets()[0].val,
                "",
                "%+",
                0,
              );
            },
          });

          // Stat 3: 7.1s
          gsap.to(numsRef.current[2], {
            val: 7.1,
            duration: 2,
            ease: "power2.out",
            onUpdate: function () {
              updateNumber(
                itemsRef.current[2]?.querySelector("h4") || null,
                this.targets()[0].val,
                "",
                "s",
                1,
              );
            },
          });

          // Stat 4: $0.01
          gsap.to(numsRef.current[3], {
            val: 0.01,
            duration: 2,
            ease: "power2.out",
            onUpdate: function () {
              updateNumber(
                itemsRef.current[3]?.querySelector("h4") || null,
                this.targets()[0].val,
                "$",
                "",
                2,
              );
            },
          });
        },
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={containerRef}
      className="section-padding bg-brand-surface border-t border-brand-border"
    >
      <div className="container-content">
        <div className="flex flex-col md:flex-row items-center justify-center gap-12 md:gap-30 divide-y md:divide-y-0 md:divide-x divide-brand-border">
          <div
            ref={(el) => {
              itemsRef.current[0] = el;
            }}
            className="flex flex-col items-center pt-8 md:pt-0 pl-0 md:pl-12 first:pt-0 first:pl-0"
          >
            <h4 className="text-[52px] font-extrabold text-text-primary mb-2 tabular-nums">
              $0.00B
            </h4>
            <p className="text-[14px] text-text-secondary text-center max-w-35 leading-snug">
              lost to DeFi exploits in 2024
            </p>
          </div>

          <div
            ref={(el) => {
              itemsRef.current[1] = el;
            }}
            className="flex flex-col items-center pt-8 md:pt-0 pl-0 md:pl-12 first:pt-0 first:pl-0"
          >
            <h4 className="text-[52px] font-extrabold text-text-primary mb-2 tabular-nums">
              0%+
            </h4>
            <p className="text-[14px] text-text-secondary text-center max-w-35 leading-snug">
              of retail losses from token approvals
            </p>
          </div>

          <div
            ref={(el) => {
              itemsRef.current[2] = el;
            }}
            className="flex flex-col items-center pt-8 md:pt-0 pl-0 md:pl-12 first:pt-0 first:pl-0"
          >
            <h4 className="text-[52px] font-extrabold text-text-primary mb-2 tabular-nums">
              0.0s
            </h4>
            <p className="text-[14px] text-text-secondary text-center max-w-35 leading-snug">
              average Miiso response time
            </p>
          </div>

          <div
            ref={(el) => {
              itemsRef.current[3] = el;
            }}
            className="flex flex-col items-center pt-8 md:pt-0 pl-0 md:pl-12 first:pt-0 first:pl-0 border-brand-border"
          >
            <h4 className="text-[52px] font-extrabold text-text-primary mb-2 tabular-nums">
              $0.00
            </h4>
            <p className="text-[14px] text-text-secondary text-center max-w-35 leading-snug">
              cost per protection event
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
