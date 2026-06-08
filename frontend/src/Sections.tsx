import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { Check, ArrowRight, X } from 'lucide-react';
import { WordsPullUpMultiStyle, AnimatedLetterText, cn } from './Shared';
import { Link } from 'react-router-dom';

function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode, delay?: number, className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial={{ y: 30, opacity: 0 }}
      animate={isInView ? { y: 0, opacity: 1 } : { y: 30, opacity: 0 }}
      transition={{ delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-black py-24 px-4 sm:px-6 relative z-10">
      <div className="max-w-7xl mx-auto">
        <span className="text-primary text-[10px] sm:text-xs tracking-widest uppercase mb-8 block">
          HOW IT WORKS
        </span>
        <WordsPullUpMultiStyle 
          segments={[{ text: "From deployment to revoked. In under 9 seconds.", className: "text-[#E1E0CC]" }]}
          className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-normal text-left max-w-4xl mb-16"
        />
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
          <FadeIn delay={0} className="bg-[#101010] p-8 md:p-10 rounded-2xl border border-white/5">
            <span className="text-gray-500 font-mono text-sm border-b border-white/5 pb-4 mb-6 block w-full">01 — Detect</span>
            <p className="text-primary text-sm md:text-base leading-relaxed opacity-80">
              Every contract deployed on Base enters Miiso's pipeline within milliseconds. Bytecode is fetched and decompiled into readable code automatically.
            </p>
          </FadeIn>
          <FadeIn delay={0.15} className="bg-[#101010] p-8 md:p-10 rounded-2xl border border-white/5">
            <span className="text-gray-500 font-mono text-sm border-b border-white/5 pb-4 mb-6 block w-full">02 — Analyze</span>
            <p className="text-primary text-sm md:text-base leading-relaxed opacity-80">
              Venice AI's uncensored reasoning model examines the decompiled code for reentrancy flaws, drain functions, and missing state guards. Confidence scored 0–100%.
            </p>
          </FadeIn>
          <FadeIn delay={0.3} className="bg-[#101010] p-8 md:p-10 rounded-2xl border border-white/5">
            <span className="text-gray-500 font-mono text-sm border-b border-white/5 pb-4 mb-6 block w-full">03 — Revoke</span>
            <p className="text-primary text-sm md:text-base leading-relaxed opacity-80">
              Above 85% confidence — fires instantly. 70–84% — 60-second window for you to cancel. Below 70% — logged to your dashboard. All transactions settled via 1Shot in USDC.
            </p>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

export function ProblemStats() {
  return (
    <section className="bg-black py-24 px-4 sm:px-6 relative z-10">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-16 lg:gap-24">
        <div className="lg:w-1/2">
          <span className="text-primary text-[10px] sm:text-xs tracking-widest uppercase mb-8 block">
            THE THREAT IS REAL
          </span>
          <WordsPullUpMultiStyle 
            segments={[{ text: "The attack already has your signature.", className: "text-[#E1E0CC]" }]}
            className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-normal text-left mb-8 max-w-xl block"
          />
          <FadeIn delay={0.2} className="mt-8">
            <p className="text-primary opacity-70 text-sm sm:text-base md:text-lg leading-relaxed max-w-xl">
              Every time you deposit, swap, or add liquidity — you sign a token approval. Most are unlimited. Most are forgotten. When a protocol gets exploited, attackers don't break any cryptography. They use the approval you signed months ago.
            </p>
          </FadeIn>
        </div>
        <div className="lg:w-1/2 flex flex-col gap-4">
          <FadeIn delay={0.3} className="bg-[#101010] p-8 rounded-2xl border border-white/5 flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="text-4xl md:text-5xl font-medium text-[#E1E0CC] tracking-tight shrink-0 w-40">$1.49B</div>
            <div className="text-primary opacity-70 text-sm">Lost to DeFi exploits in 2024</div>
          </FadeIn>
          <FadeIn delay={0.4} className="bg-[#101010] p-8 rounded-2xl border border-white/5 flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="text-4xl md:text-5xl font-medium text-[#E1E0CC] tracking-tight shrink-0 w-40">75%</div>
            <div className="text-primary opacity-70 text-sm">Of retail losses from forgotten approvals</div>
          </FadeIn>
          <FadeIn delay={0.5} className="bg-[#101010] p-8 rounded-2xl border border-white/5 flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="text-4xl md:text-5xl font-medium text-[#E1E0CC] tracking-tight shrink-0 w-40">&lt; 90s</div>
            <div className="text-primary opacity-70 text-sm">Average time from malicious deploy to first drain</div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

export function PermissionTrust() {
  return (
    <section id="security" className="bg-black py-24 px-4 sm:px-6 relative z-10">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row-reverse gap-16 lg:gap-24 items-center">
        <div className="lg:w-1/2 w-full">
          <span className="text-primary text-[10px] sm:text-xs tracking-widest uppercase mb-8 block">
            LEAST PRIVILEGE BY DESIGN
          </span>
          <WordsPullUpMultiStyle 
            segments={[{ text: "Miiso can do exactly one thing.", className: "text-[#E1E0CC]" }]}
            className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-normal text-left mb-8 max-w-xl block"
          />
          <FadeIn delay={0.2} className="mt-8">
            <p className="text-primary opacity-70 text-sm sm:text-base md:text-lg leading-relaxed max-w-xl">
              You grant Miiso a single scoped permission via MetaMask's ERC-7715 standard — reset a token approval to zero. Nothing else. The ApprovalRevocationEnforcer contract enforces this on-chain. The blockchain itself rejects any other action.
            </p>
          </FadeIn>
        </div>
        <div className="lg:w-1/2 w-full">
          <FadeIn delay={0.3} className="bg-[#101010] p-8 md:p-12 rounded-2xl border border-white/5 font-mono text-xs sm:text-sm">
            <div className="flex justify-between items-center py-4 border-b border-white/5">
              <span className="text-gray-500">Function allowed</span>
              <span className="text-[#19C978]">revoke token approval only</span>
            </div>
            <div className="flex justify-between items-center py-4 border-b border-white/5">
              <span className="text-gray-500">Can transfer funds</span>
              <span className="text-[#EF4444]">never</span>
            </div>
            <div className="flex justify-between items-center py-4 border-b border-white/5">
              <span className="text-gray-500">Can swap tokens</span>
              <span className="text-[#EF4444]">never</span>
            </div>
            <div className="flex justify-between items-center py-4 border-b border-white/5">
              <span className="text-gray-500">Monthly budget cap</span>
              <span className="text-[#E1E0CC]">5 USDC</span>
            </div>
            <div className="flex justify-between items-center py-4 border-b border-white/5">
              <span className="text-gray-500">Valid for</span>
              <span className="text-[#E1E0CC]">30 days, renewable</span>
            </div>
            <div className="flex justify-between items-center py-4">
              <span className="text-gray-500">Revocable by you</span>
              <span className="text-[#E1E0CC]">any time, one click</span>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

export function StoryProof() {
  return (
    <section className="bg-black py-24 px-4 sm:px-6 relative z-10">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-16 lg:gap-24 items-center">
        <div className="lg:w-1/2 w-full">
          <span className="text-primary text-[10px] sm:text-xs tracking-widest uppercase mb-8 block">
            03:17AM
          </span>
          <WordsPullUpMultiStyle 
            segments={[{ text: "You were asleep. Miiso wasn't.", className: "text-[#E1E0CC]" }]}
            className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-normal text-left mb-8 max-w-xl block"
          />
          <FadeIn delay={0.2} className="mt-8">
            <p className="text-primary opacity-70 text-sm sm:text-base md:text-lg leading-relaxed max-w-xl mb-6">
              Arjun had $7,000 in YieldNest Finance. A rogue developer deployed a malicious contract upgrade at 3am. Miiso detected the reentrancy flaw 180ms after deployment. Venice AI returned 97.4% confidence in 4.3 seconds.
            </p>
            <p className="text-primary opacity-70 text-sm sm:text-base md:text-lg leading-relaxed max-w-xl">
              The revocation fired at 03:17:13am. Nine minutes later, $2.4M was drained from unprotected wallets. Arjun's funds were untouched.
            </p>
          </FadeIn>
        </div>
        <div className="lg:w-1/2 w-full">
          <FadeIn delay={0.3} className="bg-[#101010] p-8 md:p-12 rounded-2xl border border-white/5 font-mono text-xs sm:text-sm">
            <div className="flex justify-between items-center py-4 border-b border-white/5">
              <span className="text-gray-500">Assets protected</span>
              <span className="text-[#19C978]">$7,000</span>
            </div>
            <div className="flex justify-between items-center py-4 border-b border-white/5">
              <span className="text-gray-500">Response time</span>
              <span className="text-[#E1E0CC]">7.1 seconds</span>
            </div>
            <div className="flex justify-between items-center py-4 border-b border-white/5">
              <span className="text-gray-500">Actions from you</span>
              <span className="text-[#E1E0CC]">zero</span>
            </div>
            <div className="flex justify-between items-center py-4">
              <span className="text-gray-500">Total cost</span>
              <span className="text-[#E1E0CC]">$0.0110 USDC</span>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

export function ComparisonTable() {
  return (
    <section id="pricing" className="bg-black py-24 px-4 sm:px-6 relative z-10 overflow-x-auto">
      <div className="max-w-5xl mx-auto">
        <span className="text-primary text-[10px] sm:text-xs tracking-widest uppercase mb-8 block text-center">
          VS THE ALTERNATIVES
        </span>
        <WordsPullUpMultiStyle 
          segments={[{ text: "Nothing else acts for you.", className: "text-[#E1E0CC]" }]}
          className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-normal text-center mb-16 mx-auto block"
        />
        
        <FadeIn delay={0.2} className="w-full overflow-x-auto pb-4">
          <table className="w-full text-left border-collapse min-w-175">
            <thead>
              <tr className="border-b border-white/10 text-sm text-gray-400">
                <th className="py-6 pr-6 font-normal w-1/3"></th>
                <th className="py-6 px-6 font-medium text-[#E1E0CC]">Miiso</th>
                <th className="py-6 px-6 font-normal">Revoke.cash</th>
                <th className="py-6 px-6 font-normal">Forta</th>
                <th className="py-6 pl-6 font-normal">DeFi Insurance</th>
              </tr>
            </thead>
            <tbody className="text-sm md:text-base text-primary">
              <tr className="border-b border-white/5">
                <td className="py-6 pr-6 opacity-80">Autonomous action</td>
                <td className="py-6 px-6"><Check className="w-5 h-5 text-[#19C978]" /></td>
                <td className="py-6 px-6"><X className="w-5 h-5 text-[#EF4444]" /></td>
                <td className="py-6 px-6"><X className="w-5 h-5 text-[#EF4444]" /></td>
                <td className="py-6 pl-6"><X className="w-5 h-5 text-[#EF4444]" /></td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-6 pr-6 opacity-80">Works while you sleep</td>
                <td className="py-6 px-6"><Check className="w-5 h-5 text-[#19C978]" /></td>
                <td className="py-6 px-6"><X className="w-5 h-5 text-[#EF4444]" /></td>
                <td className="py-6 px-6 text-gray-500 text-sm">Alerts only</td>
                <td className="py-6 pl-6"><X className="w-5 h-5 text-[#EF4444]" /></td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-6 pr-6 opacity-80">Requires ETH for gas</td>
                <td className="py-6 px-6"><X className="w-5 h-5 text-[#19C978]" /></td>
                <td className="py-6 px-6"><Check className="w-5 h-5 text-[#EF4444]" /></td>
                <td className="py-6 px-6 text-gray-500">—</td>
                <td className="py-6 pl-6"><X className="w-5 h-5 text-[#19C978]" /></td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-6 pr-6 opacity-80">AI-powered detection</td>
                <td className="py-6 px-6"><Check className="w-5 h-5 text-[#19C978]" /></td>
                <td className="py-6 px-6"><X className="w-5 h-5 text-[#EF4444]" /></td>
                <td className="py-6 px-6 text-gray-500 text-sm">Partial</td>
                <td className="py-6 pl-6"><X className="w-5 h-5 text-[#EF4444]" /></td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-6 pr-6 opacity-80">Pay only when protected</td>
                <td className="py-6 px-6"><Check className="w-5 h-5 text-[#19C978]" /></td>
                <td className="py-6 px-6 text-gray-500 text-sm">Free</td>
                <td className="py-6 px-6 text-gray-500 text-sm">Subscription</td>
                <td className="py-6 pl-6 text-gray-500 text-sm">Premium upfront</td>
              </tr>
              <tr className="">
                <td className="py-6 pr-6 opacity-80">No protocol integration</td>
                <td className="py-6 px-6"><Check className="w-5 h-5 text-[#19C978]" /></td>
                <td className="py-6 px-6"><Check className="w-5 h-5 text-[#19C978]" /></td>
                <td className="py-6 px-6"><X className="w-5 h-5 text-[#EF4444]" /></td>
                <td className="py-6 pl-6"><X className="w-5 h-5 text-[#EF4444]" /></td>
              </tr>
            </tbody>
          </table>
        </FadeIn>
      </div>
    </section>
  );
}

export function FooterCTA() {
  return (
    <footer className="bg-black pt-24 pb-8 px-4 sm:px-6 relative z-10">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col items-center text-center mb-32 bg-[#101010] p-12 md:p-24 rounded-3xl border border-white/5">
          <WordsPullUpMultiStyle 
            segments={[
              { text: "Your approvals are waiting. ", className: "text-[#E1E0CC]" }, 
              { text: "So are the attackers.", className: "text-gray-500 italic block mt-2" }
            ]}
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-normal mb-8 max-w-4xl block"
          />
          <FadeIn delay={0.2} className="max-w-xl mx-auto flex flex-col items-center">
            <p className="text-primary opacity-70 text-sm sm:text-base leading-relaxed mb-8">
              Set up Miiso in under two minutes. No ETH needed. Cancel any time.
            </p>
            <Link to="/setup" className="block w-fit">
              <button className="group flex items-center gap-2 bg-primary text-black rounded-full pl-6 pr-2 py-2 hover:gap-3 transition-all duration-300">
                <span className="font-medium text-sm sm:text-base">Start protection</span>
                <div className="bg-black rounded-full w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-[#E1E0CC]" />
                </div>
              </button>
            </Link>
          </FadeIn>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 border-t border-white/10 pt-8 mt-12">
          <div>
            <div className="flex flex-wrap items-center gap-6 mb-4">
               {["How it works", "Features", "Security", "Pricing", "Docs", "Dashboard"].map(item => (
                <a key={item} href={`#${item.toLowerCase().replace(' ', '-')}`} className="text-xs text-gray-500 hover:text-[#E1E0CC] transition-colors uppercase tracking-widest">{item}</a>
               ))}
            </div>
            <p className="text-xs text-primary opacity-50 font-mono">Fermented protection for your digital assets.</p>
          </div>
          <div className="text-left md:text-right">
             <p className="text-xs text-gray-500 font-mono">Built for: MetaMask Smart Accounts Kit × 1Shot API × Venice AI</p>
             <p className="text-xs text-gray-500 font-mono mt-1">Base (Chain ID 8453)</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
