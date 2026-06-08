import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ArrowRight, CheckCircle, Wallet } from 'lucide-react';
import { WordsPullUpMultiStyle } from './Shared';
import { Link } from 'react-router-dom';

export function Setup() {
  const [step, setStep] = useState(1);

  return (
    <div className="pt-32 pb-24 px-4 sm:px-6 max-w-2xl mx-auto min-h-screen flex flex-col items-center justify-center">
      <div className="w-full flex items-center justify-center gap-2 mb-12">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-[#19C978]' : 'bg-white/10'}`} />
        ))}
      </div>

      <div className="bg-[#101010] p-8 md:p-12 rounded-3xl border border-white/5 w-full relative overflow-hidden">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col items-center text-center"
            >
              <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-6">
                <Wallet className="w-8 h-8 text-[#E1E0CC]" />
              </div>
              <h2 className="text-2xl md:text-3xl text-[#E1E0CC] mb-4">Connect Wallet</h2>
              <p className="text-primary opacity-70 mb-8 max-w-sm">Connect your MetaMask wallet to begin setup.</p>
              
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-8 w-full text-left">
                <p className="text-sm text-gray-400">Notice: 0 ETH detected in wallet.</p>
                <p className="text-sm text-[#19C978] mt-1">No ETH needed. Miiso uses USDC for gas via 1Shot.</p>
              </div>

              <button 
                onClick={() => setStep(2)}
                className="w-full bg-[#E1E0CC] text-black rounded-full py-4 font-medium hover:bg-white transition-colors"
              >
                Connect MetaMask
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col items-center text-center"
            >
              <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-6">
                <Shield className="w-8 h-8 text-[#E1E0CC]" />
              </div>
              <h2 className="text-2xl md:text-3xl text-[#E1E0CC] mb-4">Smart Account Upgrade</h2>
              <p className="text-primary opacity-70 mb-8 max-w-sm">
                Miiso upgrades your wallet to a MetaMask Smart Account using ERC-7715. This is a one-time $0.01 USDC transaction.
              </p>
              
              <button 
                onClick={() => setStep(3)}
                className="w-full bg-[#E1E0CC] text-black rounded-full py-4 font-medium hover:bg-white transition-colors"
              >
                Upgrade My Wallet
              </button>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col items-center text-center"
            >
              <h2 className="text-2xl md:text-3xl text-[#E1E0CC] mb-4">Grant Permission</h2>
              <p className="text-primary opacity-70 mb-8 max-w-sm">
                This is the only permission Miiso will ever have. You can revoke it instantly from this page at any time.
              </p>
              
              <div className="bg-black p-6 rounded-2xl border border-white/5 font-mono text-xs sm:text-sm w-full mb-8 text-left">
                <div className="flex justify-between items-center py-3 border-b border-white/5">
                  <span className="text-gray-500">Function allowed</span>
                  <span className="text-[#19C978]">revoke token approval only</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-white/5">
                  <span className="text-gray-500">Can transfer funds</span>
                  <span className="text-[#EF4444]">never</span>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="text-gray-500">Monthly budget cap</span>
                  <span className="text-[#E1E0CC]">5 USDC</span>
                </div>
              </div>

              <button 
                onClick={() => setStep(4)}
                className="w-full bg-[#E1E0CC] text-black rounded-full py-4 font-medium hover:bg-white transition-colors"
              >
                Approve in MetaMask
              </button>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div 
              key="step4"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center text-center"
            >
              <div className="w-20 h-20 bg-[#19C978]/10 rounded-full flex items-center justify-center mb-6">
                <CheckCircle className="w-10 h-10 text-[#19C978]" />
              </div>
              <h2 className="text-2xl md:text-3xl text-[#E1E0CC] mb-8">Setup Complete</h2>
              
              <div className="space-y-4 text-left w-full max-w-xs mb-8">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-[#19C978]" />
                  <span className="text-[#E1E0CC]">Smart account active</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-[#19C978]" />
                  <span className="text-[#E1E0CC]">Permission granted</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-[#19C978]" />
                  <span className="text-[#E1E0CC]">Scanning started</span>
                </div>
              </div>

              <div className="bg-white/5 rounded-xl p-4 w-full mb-8">
                <span className="text-gray-400 text-sm">Budget remaining:</span>
                <span className="text-[#E1E0CC] ml-2 font-mono">5.00 USDC</span>
              </div>

              <Link 
                to="/dashboard"
                className="w-full bg-[#E1E0CC] text-black rounded-full py-4 font-medium hover:bg-white transition-colors block"
              >
                Go to Dashboard
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
