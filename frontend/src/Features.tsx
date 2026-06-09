import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { Check, ArrowRight } from 'lucide-react';
import { WordsPullUpMultiStyle } from './Shared';

function FeatureCard({ children, delay = 0, className = "" }: { children: React.ReactNode, delay?: number, className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.div
      ref={ref}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={isInView ? { scale: 1, opacity: 1 } : { scale: 0.95, opacity: 0 }}
      transition={{ delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`rounded-2xl overflow-hidden relative ${className}`}
    >
      {children}
    </motion.div>
  );
}

export function Features() {
  return (
    <section className="min-h-screen bg-black relative pb-24 px-4 sm:px-6">
      <div className="absolute inset-0 bg-noise opacity-[0.15] pointer-events-none" />
      
      <div className="relative z-10 max-w-7xl mx-auto">
        <div className="mb-16 mt-12 md:mt-0">
          <WordsPullUpMultiStyle 
            segments={[
              { text: "Studio-grade defense for ", className: "text-[#E1E0CC]" },
              { text: "DeFi users. ", className: "text-[#E1E0CC] italic" },
              { text: "Built for pure vision. Powered by AI.", className: "text-gray-500 block mt-2" }
            ]}
            className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-normal text-left max-w-3xl"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 lg:h-120 gap-3 sm:gap-2 md:gap-1">
          {/* Card 1 */}
          <FeatureCard delay={0} className="lg:col-span-1 bg-[#212121] h-64 lg:h-full">
            <video 
              src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260406_133058_0504132a-0cf3-4450-a370-8ea3b05c95d4.mp4"
              autoPlay loop muted playsInline
              className="absolute inset-0 w-full h-full object-cover z-0 opacity-80"
            />
            <div className="absolute bottom-6 left-6 z-10">
               <p className="text-[#E1E0CC] text-lg font-medium">Continuous monitoring.</p>
            </div>
          </FeatureCard>

          {/* Card 2 */}
          <FeatureCard delay={0.15} className="bg-[#212121] p-6 lg:p-8 flex flex-col h-auto lg:h-full justify-between">
             <div>
               <div className="mb-6 bg-black/30 w-12 h-12 rounded-lg flex items-center justify-center">
                  <img src="https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260405_171918_4a5edc79-d78f-4637-ac8b-53c43c220606.png&w=1280&q=85" alt="icon" className="w-10 h-10 rounded-md opacity-90 mix-blend-screen" />
               </div>
               <h3 className="text-[#E1E0CC] text-xl mb-6 font-medium tracking-tight">
                 Zero ETH needed. 
                 <span className="text-gray-500 font-mono text-xs align-top ml-2 inline-block pt-1">01</span>
               </h3>
               
               <ul className="space-y-4">
                  <li className="flex gap-3 items-start"><Check className="w-5 h-5 text-primary shrink-0" /><span className="text-gray-400 text-sm">Pay gas in USDC</span></li>
                  <li className="flex gap-3 items-start"><Check className="w-5 h-5 text-primary shrink-0" /><span className="text-gray-400 text-sm">1Shot relay network</span></li>
                  <li className="flex gap-3 items-start"><Check className="w-5 h-5 text-primary shrink-0" /><span className="text-gray-400 text-sm">No monthly subs</span></li>
                  <li className="flex gap-3 items-start"><Check className="w-5 h-5 text-primary shrink-0" /><span className="text-gray-400 text-sm">Instant execution</span></li>
               </ul>
             </div>

             <a href="#" className="inline-flex items-center gap-2 text-primary text-sm mt-8 group hover:text-white transition-colors uppercase tracking-wider font-semibold">
                Learn more <ArrowRight className="w-4 h-4 -rotate-45 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
             </a>
          </FeatureCard>

          {/* Card 3 */}
          <FeatureCard delay={0.3} className="bg-[#212121] p-6 lg:p-8 flex flex-col h-auto lg:h-full justify-between">
             <div>
               <div className="mb-6 bg-black/30 w-12 h-12 rounded-lg flex items-center justify-center">
                  <img src="https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260405_171741_ed9845ab-f5b2-4018-8ce7-07cc01823522.png&w=1280&q=85" alt="icon" className="w-10 h-10 rounded-md opacity-90 mix-blend-screen" />
               </div>
               <h3 className="text-[#E1E0CC] text-xl mb-6 font-medium tracking-tight">
                 AI Analysis. 
                 <span className="text-gray-500 font-mono text-xs align-top ml-2 inline-block pt-1">02</span>
               </h3>
               
               <ul className="space-y-4">
                  <li className="flex gap-3 items-start"><Check className="w-5 h-5 text-primary shrink-0" /><span className="text-gray-400 text-sm">Venice AI parsing</span></li>
                  <li className="flex gap-3 items-start"><Check className="w-5 h-5 text-primary shrink-0" /><span className="text-gray-400 text-sm">Uncensored threat intel</span></li>
                  <li className="flex gap-3 items-start"><Check className="w-5 h-5 text-primary shrink-0" /><span className="text-gray-400 text-sm">97.4% confidence rating</span></li>
               </ul>
             </div>

             <a href="#" className="inline-flex items-center gap-2 text-primary text-sm mt-8 group hover:text-white transition-colors uppercase tracking-wider font-semibold">
                Learn more <ArrowRight className="w-4 h-4 -rotate-45 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
             </a>
          </FeatureCard>

          {/* Card 4 */}
          <FeatureCard delay={0.45} className="bg-[#212121] p-6 lg:p-8 flex flex-col h-auto lg:h-full justify-between">
             <div>
               <div className="mb-6 bg-black/30 w-12 h-12 rounded-lg flex items-center justify-center">
                  <img src="https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260405_171809_f56666dc-c099-4778-ad82-9ad4f209567b.png&w=1280&q=85" alt="icon" className="w-10 h-10 rounded-md opacity-90 mix-blend-screen" />
               </div>
               <h3 className="text-[#E1E0CC] text-xl mb-6 font-medium tracking-tight">
                 Least privilege. 
                 <span className="text-gray-500 font-mono text-xs align-top ml-2 inline-block pt-1">03</span>
               </h3>
               
               <ul className="space-y-4">
                  <li className="flex gap-3 items-start"><Check className="w-5 h-5 text-primary shrink-0" /><span className="text-gray-400 text-sm">Can revoke approvals</span></li>
                  <li className="flex gap-3 items-start"><span className="w-5 h-5 flex items-center justify-center text-red-500/80 shrink-0 font-bold opacity-70">✗</span><span className="text-gray-400 text-sm">Cannot transfer funds</span></li>
                  <li className="flex gap-3 items-start"><span className="w-5 h-5 flex items-center justify-center text-red-500/80 shrink-0 font-bold opacity-70">✗</span><span className="text-gray-400 text-sm">Cannot swap tokens</span></li>
               </ul>
             </div>

             <a href="#" className="inline-flex items-center gap-2 text-primary text-sm mt-8 group hover:text-white transition-colors uppercase tracking-wider font-semibold">
                Learn more <ArrowRight className="w-4 h-4 -rotate-45 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
             </a>
          </FeatureCard>
        </div>
      </div>
    </section>
  );
}
