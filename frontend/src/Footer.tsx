import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Shield } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

export function Footer() {
  const footerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(footerRef.current, {
        y: 20,
        opacity: 0,
        duration: 0.8,
        ease: "power2.out",
        scrollTrigger: {
          trigger: footerRef.current,
          start: "top 90%",
        },
      });
    }, footerRef);

    return () => ctx.revert();
  }, []);

  return (
    <footer
      ref={footerRef}
      className="bg-brand-surface border-t border-brand-border pt-16 pb-8"
    >
      <div className="container-content">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 border-b border-brand-border pb-12">
          {/* Left Column */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-brand-accent" />
              <span className="font-sans font-extrabold text-text-primary text-xl tracking-tight">
                miiso
              </span>
            </div>
            <p className="text-sm text-text-secondary max-w-xs">
              Fermented protection for your digital assets.
            </p>
            <div className="text-sm font-mono text-text-muted">
              Built on Base
            </div>
          </div>

          {/* Center Column */}
          <div className="flex flex-col gap-3">
            <h4 className="text-text-primary font-bold mb-2">Links</h4>
            <a
              href="#how-it-works"
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              How it works
            </a>
            <a
              href="#security"
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Security
            </a>
            <a
              href="#docs"
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Docs
            </a>
            <a
              href="#github"
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              GitHub
            </a>
          </div>

          {/* Right Column */}
          <div className="flex flex-col items-start gap-4">
            <h4 className="text-text-primary font-bold mb-2">Get Started</h4>
            <button className="bg-brand-accent text-[#0A0A0A] px-6 py-3 rounded-[100px] text-sm font-semibold hover:brightness-110 transition-all w-fit">
              Start protection
            </button>
            <div className="text-xs text-text-muted mt-2 space-y-1">
              <p>No ETH · No subscription · Cancel anytime</p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-[12px] text-[#3F3F46]">
          <p>© 2026 Miiso · MIT License</p>
          <p>Built for MetaMask × 1Shot × Venice AI</p>
        </div>
      </div>
    </footer>
  );
}
