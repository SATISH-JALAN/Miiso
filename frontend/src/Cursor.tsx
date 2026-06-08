import { useEffect, useRef } from "react";
import gsap from "gsap";

export function Cursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dot = dotRef.current;
    const ring = ringRef.current;

    if (!dot || !ring) return;

    // QuickTo for smooth Ring trailing
    const xToRing = gsap.quickTo(ring, "x", {
      duration: 0.5,
      ease: "power3.out",
    });
    const yToRing = gsap.quickTo(ring, "y", {
      duration: 0.5,
      ease: "power3.out",
    });

    // Center coordinates
    let mouseX = 0;
    let mouseY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      // Direct update for Dot
      gsap.set(dot, { x: mouseX, y: mouseY });

      // Smooth update for Ring
      xToRing(mouseX);
      yToRing(mouseY);
    };

    window.addEventListener("mousemove", handleMouseMove);

    // Initial positioning off-screen or center? Let's just GSAP set to avoid initial jump
    gsap.set([dot, ring], {
      xPercent: -50,
      yPercent: -50,
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });

    // Hover interactions
    const handleMouseEnter = () => {
      gsap.to(ring, {
        scale: 2.2,
        borderColor: "#19C978",
        duration: 0.3,
        ease: "power2.out",
      });
      gsap.to(dot, { scale: 0, duration: 0.3, ease: "power2.out" });
    };

    const handleMouseLeave = () => {
      gsap.to(ring, {
        scale: 1,
        borderColor: "rgba(25,201,120,0.5)",
        duration: 0.3,
        ease: "power2.out",
      });
      gsap.to(dot, { scale: 1, duration: 0.3, ease: "power2.out" });
    };

    // Attach to all links and buttons dynamically
    // Use event delegation on document body to catch dynamically added elements
    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("a") || target.closest("button")) {
        handleMouseEnter();
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("a") || target.closest("button")) {
        handleMouseLeave();
      }
    };

    document.addEventListener("mouseover", handleMouseOver);
    document.addEventListener("mouseout", handleMouseOut);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseover", handleMouseOver);
      document.removeEventListener("mouseout", handleMouseOut);
    };
  }, []);

  return (
    <>
      <div
        ref={dotRef}
        className="fixed top-0 left-0 w-1.5 h-1.5 bg-brand-accent rounded-full pointer-events-none z-9999 mix-blend-difference"
      />
      <div
        ref={ringRef}
        className="fixed top-0 left-0 w-8 h-8 border border-[rgba(25,201,120,0.5)] rounded-full pointer-events-none z-9998"
      />
    </>
  );
}
