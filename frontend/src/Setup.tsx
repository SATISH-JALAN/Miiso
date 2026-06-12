import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ArrowRight, CheckCircle, Wallet, Loader2, ListPlus, Plus, Trash2 } from 'lucide-react';
import { WordsPullUpMultiStyle } from './Shared';
import { Link } from 'react-router-dom';
import { useWallet } from './WalletContext';
import { usePermission } from './hooks/usePermission';

export function Setup() {
  const { walletAddress, isConnected, connectWallet, refreshAllData } = useWallet();
  const { upgradeToSmartAccount, grantPermission, checkIsSmartAccount } = usePermission();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Setup Wizard Custom configurations
  const [budgetCap, setBudgetCap] = useState(5);
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [newWhitelistAddress, setNewWhitelistAddress] = useState('');

  // Automatically advance to Step 2 or 3 if wallet connects while on Step 1
  useEffect(() => {
    async function checkUpgradeStatus() {
      if (isConnected && step === 1) {
        setLoading(true);
        try {
          const isSmart = await checkIsSmartAccount();
          
          if (isSmart) {
            console.log("Wallet is already a smart account, skipping Step 2.");
            setStep(3);
          } else {
            setStep(2);
          }
        } catch (err) {
          console.error("Failed to check smart account status:", err);
          setStep(2); // default to step 2 if check fails
        } finally {
          setLoading(false);
        }
      }
    }
    checkUpgradeStatus();
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

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      // EIP-7702 upgrade flow
      const res = await upgradeToSmartAccount();
      if (res.upgraded) {
        console.log(`Smart account upgrade signed successfully via ${res.method}`);
        setStep(3);
      } else {
        alert("Failed to upgrade EOA to Smart Account. Please try again.");
      }
    } catch (err: any) {
      console.error("Upgrade error:", err);
      alert("Upgrade failed: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleAddWhitelist = () => {
    if (newWhitelistAddress.length === 42 && newWhitelistAddress.startsWith("0x")) {
      setWhitelist([...whitelist, newWhitelistAddress.toLowerCase()]);
      setNewWhitelistAddress('');
    } else {
      alert("Invalid Ethereum address format (must be 42 characters starting with 0x).");
    }
  };

  const handleRemoveWhitelist = (index: number) => {
    setWhitelist(whitelist.filter((_, idx) => idx !== index));
  };

  const handleGrantPermission = async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      // 1. Request ERC-7715/EIP-7715 permission or personal_sign fallback
      const grant = await grantPermission(budgetCap, whitelist);
      console.log(`Permission granted via ${grant.method}`);

      await refreshAllData();
      setStep(4);
    } catch (err: any) {
      console.error("Grant permission failed:", err);
      alert("Failed to grant delegation permission: " + (err.message || err));
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
              className="flex flex-col items-center text-center w-full"
            >
              <h2 className="text-2xl md:text-3xl text-[#E1E0CC] mb-2 font-medium">Customize Setup Rules</h2>
              <p className="text-gray-400 text-sm mb-8 max-w-sm">
                Configure your auto-pilot gas buffer limit and add trusted protocol contracts before signing permissions.
              </p>
              
              <div className="space-y-6 w-full text-left mb-8">
                {/* Gas Relayer Budget Limit Customization */}
                <div className="bg-black/40 border border-white/5 p-5 rounded-2xl">
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Monthly Gas Relayer Cap</label>
                    <span className="text-[#19C978] font-mono font-bold text-sm">{budgetCap} USDC</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="5" 
                    step="1" 
                    value={budgetCap} 
                    onChange={(e) => setBudgetCap(Number(e.target.value))}
                    className="w-full accent-[#19C978] bg-white/10 rounded-lg h-1.5 cursor-pointer"
                  />
                  <p className="text-[10px] text-gray-500 mt-2">Max allowed gas used by Sentinel for automated, gasless veto/revocation relays.</p>
                </div>

                {/* Whitelisting Smart Contracts */}
                <div className="bg-black/40 border border-white/5 p-5 rounded-2xl">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest block mb-2">Trusted Protocols Whitelist</label>
                  <div className="flex gap-2 mb-4">
                    <input 
                      type="text" 
                      placeholder="Paste contract address (0x...)" 
                      value={newWhitelistAddress}
                      onChange={(e) => setNewWhitelistAddress(e.target.value)}
                      className="flex-1 bg-black p-2.5 rounded-lg border border-white/5 text-[#E1E0CC] font-mono text-xs placeholder-gray-600 focus:outline-none focus:border-[#19C978]/50"
                    />
                    <button 
                      onClick={handleAddWhitelist}
                      className="bg-[#19C978] text-black px-3.5 rounded-lg text-xs font-bold hover:bg-[#14a361] transition-colors flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>

                  {whitelist.length > 0 ? (
                    <div className="max-h-24 overflow-y-auto space-y-1.5 pr-1">
                      {whitelist.map((addr, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-black/60 p-2 rounded border border-white/5">
                          <span className="font-mono text-[10px] text-[#E1E0CC]">{addr}</span>
                          <button 
                            onClick={() => handleRemoveWhitelist(idx)}
                            className="text-gray-500 hover:text-[#EF4444] transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-500 italic">No custom whitelisted protocols added yet. You can add them later in settings.</p>
                  )}
                </div>

                {/* Scope details */}
                <div className="bg-black/60 p-4 rounded-xl border border-white/5 font-mono text-[10px] space-y-2 text-gray-500">
                  <div className="flex justify-between border-b border-white/5 pb-1 mb-1">
                    <span>Scope Allowed</span>
                    <span className="text-[#19C978]">Revoke Token Approvals Only</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-1 mb-1">
                    <span>Never Allowed</span>
                    <span className="text-[#E1E0CC]">Transfer funds, swap tokens</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-1 mb-1">
                    <span>Duration</span>
                    <span className="text-[#E1E0CC]">30 days (Auto-expires)</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-1 mb-1">
                    <span>Cost</span>
                    <span className="text-[#E1E0CC]">Up to {budgetCap} USDC cap</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cancellation</span>
                    <span className="text-[#E1E0CC]">Any time, 1-click on chain</span>
                  </div>
                </div>
              </div>

              <button 
                onClick={handleGrantPermission}
                disabled={loading}
                className="w-full bg-[#E1E0CC] text-black rounded-full py-4 font-bold hover:bg-white transition-colors flex items-center justify-center gap-2"
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
              <h2 className="text-2xl md:text-3xl text-[#E1E0CC] mb-4">Setup Complete</h2>
              <p className="text-[#19C978] mb-8 max-w-sm font-semibold tracking-wide">
                Miiso is now active. We are watching Base for you.
              </p>
              
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

              <div className="bg-white/5 rounded-xl p-4 w-full mb-8 flex justify-between">
                <span className="text-gray-400 text-sm">Relay budget remaining:</span>
                <span className="text-[#E1E0CC] ml-2 font-mono font-bold">{budgetCap}.00 USDC</span>
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
