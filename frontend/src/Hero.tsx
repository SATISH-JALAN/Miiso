import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { WordsPullUp } from './Shared';
import { Link } from 'react-router-dom';

export function Hero() {
  return (
    <section className="h-screen p-4 md:p-6 w-full">
      <div className="relative w-full h-full rounded-2xl md:rounded-4xl overflow-hidden bg-black">
        {/* Background Video */}
        <video 
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260411_104032_69319010-2458-492b-b04d-b40a5dfa4482.mp4"
          autoPlay loop muted playsInline
          className="absolute inset-0 w-full h-full object-cover z-0"
        />
        {/* Overlays */}
        <div className="absolute inset-0 noise-overlay opacity-[0.7] mix-blend-overlay pointer-events-none z-10" />
        <div className="absolute inset-0 bg-linear-to-b from-black/30 via-transparent to-black/80 z-10 pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-32 md:h-64 bg-linear-to-t from-black to-transparent z-10 pointer-events-none" />

        {/* Hero Content */}
        <div className="absolute bottom-0 left-0 right-0 z-20 p-6 md:p-12 lg:p-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
            <div className="lg:col-span-8">
              <WordsPullUp 
                text="Miiso"
                showAsterisk
                className="text-[26vw] sm:text-[24vw] md:text-[22vw] lg:text-[20vw] xl:text-[19vw] 2xl:text-[20vw] font-medium leading-[0.85] tracking-[-0.07em]"
              />
            </div>
            <div className="lg:col-span-4 flex flex-col items-start lg:mb-8">
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="text-primary opacity-70 text-xs sm:text-sm md:text-base leading-[1.2] mb-6 max-w-sm"
              >
                Miiso is a worldwide network for autonomous on-chain DeFi security. We watch every smart contract — revoking approvals automatically.
              </motion.p>
              
              <Link to="/setup">
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="group flex items-center gap-2 bg-primary text-black rounded-full pl-6 pr-2 py-2 hover:gap-3 transition-all duration-300"
                >
                  <span className="font-medium text-sm sm:text-base">Start protection</span>
                  <div className="bg-black rounded-full w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-[#E1E0CC]" />
                  </div>
                </motion.button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
