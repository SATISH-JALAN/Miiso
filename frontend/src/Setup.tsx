import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ArrowRight, CheckCircle, Wallet, Loader2 } from 'lucide-react';
import { WordsPullUpMultiStyle } from './Shared';
import { Link } from 'react-router-dom';
import { useWallet } from './WalletContext';

export function Setup() {
  const { walletAddress, isConnected, connectWallet, refreshAllData } = useWallet();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Automatically advance to Step 2 if wallet connects while on Step 1
  useEffect(() => {
    if (isConnected && step === 1) {
      setStep(2);
    }
  }, [isConnected, step]);

  const handleConnect = async () => {
    setLoading(true);
    try {
      await connectWallet();
      setStep(2);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = () => {
    setLoading(true);
    // Mock EIP-7710 Smart Account contract execution
    setTimeout(() => {
      setLoading(false);
      setStep(3);
    }, 1500);
  };

  const handleGrantPermission = async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      // Register EIP-7715 delegation permissions & seed test approvals/logs for this wallet address
      const res = await fetch("http://localhost:3001/api/dev/seed-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userAddress: walletAddress })
      });
      const data = await res.json();
      if (data.success) {
        await refreshAllData();
        setStep(4);
      } else {
        alert("Failed to register delegation permissions: " + (data.message || "Unknown error"));
      }
    } catch (err) {
      console.error(err);
      alert("Network error: Could not reach the fastify relayer.");
    } finally {
      setLoading(false);
    }
  };

  const formatAddr = (addr: string) => `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;

  return (
    <div className="pt-32 pb-24 px-4 sm:px-6 max-w-2xl mx-auto min-h-screen flex flex-col items-center justify-center">
      {/* Progress Bar */}
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
                <p className="text-sm text-[#19C978] mt-1">No ETH needed. Miiso uses USDC for gas via 1Shot Relayer.</p>
              </div>

              <button 
                onClick={handleConnect}
                disabled={loading}
                className="w-full bg-[#E1E0CC] text-black rounded-full py-4 font-medium hover:bg-white transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
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
                Miiso upgrades your wallet to a MetaMask Smart Account using ERC-7710 and ERC-7715. This enables gasless transactions via 1Shot Relayer.
              </p>

              {walletAddress && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-6 w-full text-center">
                  <span className="text-xs text-gray-400">Wallet Connected: </span>
                  <span className="text-xs font-mono text-[#19C978]">{formatAddr(walletAddress)}</span>
                </div>
              )}
              
              <button 
                onClick={handleUpgrade}
                disabled={loading}
                className="w-full bg-[#E1E0CC] text-black rounded-full py-4 font-medium hover:bg-white transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Upgrading Wallet...' : 'Upgrade My Wallet'}
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
                Authorize the Miiso Sentinel agent with EIP-7715 delegation permissions. You can revoke this delegation instantly at any time.
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
                  <span className="text-[#E1E0CC]">100 USDC (WETH equivalent)</span>
                </div>
              </div>

              <button 
                onClick={handleGrantPermission}
                disabled={loading}
                className="w-full bg-[#E1E0CC] text-black rounded-full py-4 font-medium hover:bg-white transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Granting Permission...' : 'Approve in MetaMask'}
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
                  <span className="text-[#E1E0CC]">Smart account active (x402 Relayer)</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-[#19C978]" />
                  <span className="text-[#E1E0CC]">EIP-7715 Permission granted</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-[#19C978]" />
                  <span className="text-[#E1E0CC]">Sentinel threat scanning active</span>
                </div>
              </div>

              <div className="bg-white/5 rounded-xl p-4 w-full mb-8">
                <span className="text-gray-400 text-sm">Relay budget remaining:</span>
                <span className="text-[#E1E0CC] ml-2 font-mono">100.00 USDC</span>
              </div>

              <Link 
                to="/dashboard"
                className="w-full bg-[#E1E0CC] text-black rounded-full py-4 font-medium hover:bg-white transition-colors block text-center"
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
