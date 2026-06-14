import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ArrowRight, CheckCircle, Wallet, Loader2, Plus, Trash2, AlertTriangle, ExternalLink } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useWallet } from './WalletContext';
import { usePermission } from './hooks/usePermission';
import { checkFlaskSupport, supportsNativeGrantPermissions, getRelayCapabilities, SUCCESS_FEE_HOOK } from './lib/metamask';
import { postFeeAllowance } from './lib/api';
import { useStore } from './store/index';

export function Setup() {
  const { walletAddress, isConnected, connectWallet, refreshAllData } = useWallet();
  const { upgradeToSmartAccount, grantPermission, approveSuccessFee, checkIsSmartAccount, checkPermission } = usePermission();
  const setSetupComplete = useStore((s) => s.setSetupComplete);
  const setFlaskSupported = useStore((s) => s.setFlaskSupported);
  const setGrantMethod = useStore((s) => s.setGrantMethod);
  const flaskSupported = useStore((s) => s.flaskSupported);
  const storeGrantMethod = useStore((s) => s.grantMethod);
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Setup Wizard Custom configurations
  const [budgetCap, setBudgetCap] = useState(5);
  const [durationDays, setDurationDays] = useState(30);
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [newWhitelistAddress, setNewWhitelistAddress] = useState('');
  const [localGrantMethod, setLocalGrantMethod] = useState<string | null>(null);
  const [upgradeFee, setUpgradeFee] = useState<number | null>(null);
  const [upgradeMethod, setUpgradeMethod] = useState<string | null>(null);
  const [estimatedRelayFee, setEstimatedRelayFee] = useState<number>(0.01);
  const [nativeGrantAvailable, setNativeGrantAvailable] = useState<boolean | null>(null);
  const [setupInitialized, setSetupInitialized] = useState(false);

  const feeHookConfigured = Boolean(
    SUCCESS_FEE_HOOK && SUCCESS_FEE_HOOK !== "0x0000000000000000000000000000000000000000"
  );

  const durationOptions = [
    { days: 7, label: '7 days' },
    { days: 30, label: '30 days' },
    { days: 90, label: '90 days' },
    { days: 365, label: '1 year' },
  ];

  // Restore wizard step from backend permission state (avoids resetting to "Grant Permission" on revisit)
  useEffect(() => {
    if (!isConnected || setupInitialized) return;

    let cancelled = false;

    async function initializeSetup() {
      setLoading(true);
      setError(null);
      try {
        const perm = await checkPermission();
        if (cancelled) return;

        if (perm) {
          if (perm.budgetCap) {
            const cap = parseFloat(String(perm.budgetCap)) / 1_000_000;
            if (!Number.isNaN(cap)) {
              setBudgetCap(Math.max(1, Math.min(10, Math.round(cap))));
            }
          }
          if (Array.isArray(perm.whitelistAddresses)) {
            setWhitelist(perm.whitelistAddresses as string[]);
          }

          const needFeeStep = feeHookConfigured && !perm.feeAllowanceApproved;
          setStep(needFeeStep ? 4 : 5);
          if (!needFeeStep) {
            setSetupComplete(true);
          }
          return;
        }

        const flaskResult = await checkFlaskSupport(walletAddress ?? undefined);
        if (cancelled) return;
        setFlaskSupported(flaskResult.supported);

        if (!flaskResult.supported) {
          setStep(1);
          return;
        }

        const isSmart = await checkIsSmartAccount();
        if (cancelled) return;
        setStep(isSmart ? 3 : 2);
      } catch (err) {
        console.error("Failed to initialize setup:", err);
        if (!cancelled) setStep(2);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setSetupInitialized(true);
        }
      }
    }

    initializeSetup();
    return () => {
      cancelled = true;
    };
  }, [
    isConnected,
    setupInitialized,
    walletAddress,
    checkPermission,
    checkIsSmartAccount,
    setFlaskSupported,
    setSetupComplete,
    feeHookConfigured,
  ]);

  // Pre-fetch 1Shot relay fee for upgrade step
  useEffect(() => {
    if (step === 2) {
      getRelayCapabilities()
        .then((caps) => setEstimatedRelayFee(caps.feeUsdc))
        .catch(() => setEstimatedRelayFee(0.01));
    }
  }, [step]);

  // Check if native ERC-7715 grant is available for step 3 copy
  useEffect(() => {
    if (step === 3 && walletAddress) {
      supportsNativeGrantPermissions(walletAddress)
        .then(setNativeGrantAvailable)
        .catch(() => setNativeGrantAvailable(false));
    }
  }, [step, walletAddress]);

  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      await connectWallet();
      // The useEffect above will handle the rest
    } catch (err: any) {
      setError(err.message || "Failed to connect wallet");
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await upgradeToSmartAccount();
      if (res.upgraded) {
        setUpgradeFee(res.feeUsdc);
        setUpgradeMethod(
          res.method === "1shot_paymaster"
            ? "1Shot Paymaster (USDC)"
            : res.method === "1shot_relayer"
              ? "1Shot Relayer (USDC)"
              : "MetaMask wallet_sendCalls"
        );
        setStep(3);
      }
    } catch (err: any) {
      console.error("Upgrade error:", err);
      setError("Smart account upgrade failed: " + (err.message || "Unknown error. Ensure you are using MetaMask Flask."));
    } finally {
      setLoading(false);
    }
  };

  const handleAddWhitelist = () => {
    if (newWhitelistAddress.length === 42 && newWhitelistAddress.startsWith("0x")) {
      setWhitelist([...whitelist, newWhitelistAddress.toLowerCase()]);
      setNewWhitelistAddress('');
    } else {
      setError("Invalid Ethereum address format (must be 42 characters starting with 0x).");
    }
  };

  const handleRemoveWhitelist = (index: number) => {
    setWhitelist(whitelist.filter((_, idx) => idx !== index));
  };

  const handleGrantPermission = async () => {
    if (!walletAddress) return;
    setLoading(true);
    setError(null);
    try {
      const grant = await grantPermission(budgetCap, whitelist, durationDays, false);
      const label =
        grant.method === "erc7715"
          ? "Advanced Permission (ERC-7715)"
          : "Signed Delegation";
      setLocalGrantMethod(label);
      setGrantMethod(label);
      setStep(4);
    } catch (err: any) {
      console.error("Grant permission failed:", err);
      setError("Permission grant failed: " + (err.message || "Unknown error. Ensure MetaMask Flask approved the request."));
    } finally {
      setLoading(false);
    }
  };

  const handleApproveSuccessFee = async () => {
    if (!walletAddress) return;
    setLoading(true);
    setError(null);
    try {
      const result = await approveSuccessFee(budgetCap);
      if (!result.skipped) {
        await postFeeAllowance(walletAddress, true);
      }
      await refreshAllData();
      setSetupComplete(true);
      setStep(5);
    } catch (err: any) {
      console.error("Success fee approval failed:", err);
      setError("Success fee approval failed: " + (err.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const handleSkipSuccessFee = async () => {
    setLoading(true);
    try {
      await refreshAllData();
      setSetupComplete(true);
      setStep(5);
    } finally {
      setLoading(false);
    }
  };

  const displayGrantMethod = localGrantMethod ?? storeGrantMethod;

  const formatAddr = (addr: string) => `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;

  // Flask requirement screen — shown when connected but Flask not detected
  const FlaskRequirementScreen = () => (
    <motion.div
      key="flask-gate"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col items-center text-center"
    >
      <div className="w-16 h-16 bg-[#F59E0B]/10 rounded-2xl flex items-center justify-center mb-6">
        <AlertTriangle className="w-8 h-8 text-[#F59E0B]" />
      </div>
      <h2 className="text-2xl md:text-3xl text-[#E1E0CC] mb-4">MetaMask Flask Required</h2>
      
      <div className="bg-[#F59E0B]/5 border border-[#F59E0B]/20 rounded-xl p-5 mb-6 w-full text-left">
        <p className="text-sm text-[#E1E0CC] leading-relaxed mb-3">
          The <strong>ERC-7715 Advanced Permissions</strong> standard that powers Miiso's delegated protection is currently available in <strong>MetaMask Flask</strong> — the developer build of MetaMask.
        </p>
        <p className="text-sm text-gray-400 leading-relaxed">
          Standard MetaMask will support this in a future release.
        </p>
      </div>

      <div className="space-y-3 w-full">
        <a
          href="https://metamask.io/flask/"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full bg-[#E1E0CC] text-black rounded-full py-4 font-medium hover:bg-white transition-colors flex items-center justify-center gap-2"
        >
          <ExternalLink className="w-4 h-4" />
          Download MetaMask Flask
        </a>
        <a
          href="https://docs.metamask.io/snaps/"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full bg-white/5 text-[#E1E0CC] border border-white/10 rounded-full py-3 font-medium hover:bg-white/10 transition-colors flex items-center justify-center gap-2 text-sm"
        >
          Learn why this is required
        </a>
      </div>

      <div className="mt-6 bg-white/5 border border-white/5 rounded-xl p-4 w-full text-left">
        <p className="text-[10px] text-gray-500 leading-relaxed">
          <strong className="text-gray-400">Note:</strong> MetaMask Flask and standard MetaMask cannot run in the same browser profile. Install Flask in a separate Chrome profile or a different browser.
        </p>
      </div>

      <button
        onClick={() => {
          // Re-check Flask support after user installs
          setFlaskSupported(null);
          setStep(1);
          window.location.reload();
        }}
        className="mt-4 text-sm text-[#B8CFA8] hover:text-[#14a361] transition-colors font-medium"
      >
        I've installed Flask — retry detection →
      </button>
    </motion.div>
  );

  return (
    <div className="pt-32 pb-24 px-4 sm:px-6 max-w-2xl mx-auto min-h-screen flex flex-col items-center justify-center">
      {/* Progress Bar */}
      <div className="w-full flex items-center justify-center gap-2 mb-12">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-[#B8CFA8]' : 'bg-white/10'}`} />
        ))}
      </div>

      <div className="bg-[#101010] p-8 md:p-12 rounded-3xl border border-white/5 w-full relative overflow-hidden">
        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-[#C27A73]/10 border border-red-500/20 rounded-xl p-4 mb-6"
            >
              <p className="text-sm text-[#C27A73]">{error}</p>
              <button onClick={() => setError(null)} className="text-xs text-gray-400 mt-2 hover:text-white">
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {/* FLASK GATE — shown after connect if Flask not detected */}
          {isConnected && flaskSupported === false && step === 1 ? (
            <FlaskRequirementScreen />
          ) : step === 1 ? (
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
              <p className="text-primary opacity-70 mb-8 max-w-sm">Connect your MetaMask Flask wallet to begin setup.</p>
              
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-8 w-full text-left">
                <p className="text-sm text-gray-400">Miiso requires MetaMask Flask for ERC-7715 permissions.</p>
                <p className="text-sm text-[#B8CFA8] mt-1">No ETH needed. Miiso uses USDC for gas via 1Shot Relayer.</p>
              </div>

              <button 
                onClick={handleConnect}
                disabled={loading}
                className="w-full bg-[#E1E0CC] text-black rounded-full py-4 font-medium hover:bg-white transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Connect MetaMask Flask
              </button>
            </motion.div>
          ) : step === 2 ? (
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
              <p className="text-primary opacity-70 mb-4 max-w-sm">
                Your wallet needs a one-time upgrade to a smart account via the 1Shot relayer.
                Estimated fee: <strong className="text-[#B8CFA8]">${estimatedRelayFee.toFixed(2)} USDC</strong>. No ETH needed.
              </p>

              <div className="bg-[#B8CFA8]/5 border border-[#B8CFA8]/20 rounded-xl p-4 mb-6 w-full text-left text-xs text-gray-400 space-y-2">
                <p>• Gas paid in USDC through 1Shot relayer</p>
                <p>• Your wallet address stays the same</p>
                <p>• Your funds stay exactly where they are</p>
                <p>• Enables programmable permission features (EIP-7702)</p>
              </div>

              {walletAddress && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-6 w-full text-center">
                  <span className="text-xs text-gray-400">Wallet Connected: </span>
                  <span className="text-xs font-mono text-[#B8CFA8]">{formatAddr(walletAddress)}</span>
                </div>
              )}
              
              <button 
                onClick={handleUpgrade}
                disabled={loading}
                className="w-full bg-[#E1E0CC] text-black rounded-full py-4 font-medium hover:bg-white transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Upgrading via 1Shot...' : `Upgrade Account (~$${estimatedRelayFee.toFixed(2)} USDC)`}
              </button>
            </motion.div>
          ) : step === 3 ? (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col items-center text-center w-full"
            >
              <h2 className="text-2xl md:text-3xl text-[#E1E0CC] mb-2 font-medium">Grant Permission</h2>
              <p className="text-gray-400 text-sm mb-4 max-w-sm">
                This is the most important step. Read exactly what Miiso can and cannot do before approving.
              </p>

              {nativeGrantAvailable === true ? (
                <div className="bg-[#B8CFA8]/5 border border-[#B8CFA8]/20 rounded-xl p-4 mb-6 w-full text-left text-xs">
                  <p className="text-[#B8CFA8] font-semibold mb-1">Native ERC-7715 permission screen</p>
                  <p className="text-gray-400 leading-relaxed">
                    MetaMask Flask will show the scoped Advanced Permission UI — approve(token, 0) only,
                    with your budget cap and expiry visible.
                  </p>
                </div>
              ) : nativeGrantAvailable === false ? (
                <div className="bg-[#F59E0B]/5 border border-[#F59E0B]/20 rounded-xl p-4 mb-6 w-full text-left text-xs">
                  <p className="text-[#F59E0B] font-semibold mb-1">Signed delegation fallback</p>
                  <p className="text-gray-400 leading-relaxed">
                    Your Flask build does not expose native ERC-7715 grant yet. Miiso will use a
                    signed delegation message with the same scope — revocations only, enforced on-chain.
                    The dashboard will show which method was used.
                  </p>
                </div>
              ) : null}
              
              <div className="space-y-6 w-full text-left mb-8">
                {/* Permission scope — clear and honest */}
                <div className="bg-black/60 p-5 rounded-xl border border-[#B8CFA8]/20 font-mono text-xs space-y-3">
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-gray-500">What Miiso CAN do</span>
                    <span className="text-[#B8CFA8] font-bold">Revoke token approvals only</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-gray-500">Transfer funds</span>
                    <span className="text-[#C27A73]">Never</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-gray-500">Swap tokens</span>
                    <span className="text-[#C27A73]">Never</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-gray-500">Touch your balance</span>
                    <span className="text-[#C27A73]">Never</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-gray-500">Duration</span>
                    <span className="text-[#E1E0CC]">{durationOptions.find(d => d.days === durationDays)?.label || `${durationDays} days`}, renewable</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-gray-500">Cost</span>
                    <span className="text-[#E1E0CC]">Up to {budgetCap} USDC cap</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Cancellation</span>
                    <span className="text-[#E1E0CC]">One click, any time, instant</span>
                  </div>
                </div>

                {/* Gas Relayer Budget */}
                <div className="bg-black/40 border border-white/5 p-5 rounded-2xl">
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Monthly USDC Budget Cap</label>
                    <span className="text-[#B8CFA8] font-mono font-bold text-sm">{budgetCap} USDC</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="5" 
                    step="1" 
                    value={budgetCap} 
                    onChange={(e) => setBudgetCap(Number(e.target.value))}
                    className="w-full accent-[#B8CFA8] bg-white/10 rounded-lg h-1.5 cursor-pointer"
                  />
                </div>

                {/* Duration Selector */}
                <div className="bg-black/40 border border-white/5 p-5 rounded-2xl">
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Permission Duration</label>
                    <span className="text-[#B8CFA8] font-mono font-bold text-sm">{durationOptions.find(d => d.days === durationDays)?.label || `${durationDays} days`}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {durationOptions.map((opt) => (
                      <button
                        key={opt.days}
                        onClick={() => setDurationDays(opt.days)}
                        className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                          durationDays === opt.days
                            ? 'bg-[#B8CFA8]/20 border border-[#B8CFA8]/50 text-[#B8CFA8]'
                            : 'bg-black/60 border border-white/5 text-gray-400 hover:border-white/20 hover:text-[#E1E0CC]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Whitelist */}
                <div className="bg-black/40 border border-white/5 p-5 rounded-2xl">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest block mb-2">Trusted Protocols (Optional)</label>
                  <div className="flex gap-2 mb-4">
                    <input 
                      type="text" 
                      placeholder="Paste contract address (0x...)" 
                      value={newWhitelistAddress}
                      onChange={(e) => setNewWhitelistAddress(e.target.value)}
                      className="flex-1 bg-black p-2.5 rounded-lg border border-white/5 text-[#E1E0CC] font-mono text-xs placeholder-gray-600 focus:outline-none focus:border-[#B8CFA8]/50"
                    />
                    <button 
                      onClick={handleAddWhitelist}
                      className="bg-[#B8CFA8] text-black px-3.5 rounded-lg text-xs font-bold hover:bg-[#14a361] transition-colors flex items-center gap-1"
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
                            className="text-gray-500 hover:text-[#C27A73] transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-500 italic">No custom whitelisted protocols. You can add them later in settings.</p>
                  )}
                </div>
              </div>

              <button 
                onClick={handleGrantPermission}
                disabled={loading}
                className="w-full bg-[#E1E0CC] text-black rounded-full py-4 font-bold hover:bg-white transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Granting Permission...' : 'Grant Permission in MetaMask'}
              </button>
            </motion.div>
          ) : step === 4 ? (
            <motion.div
              key="step4-fee"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col items-center text-center w-full"
            >
              <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-6">
                <Shield className="w-8 h-8 text-[#E1E0CC]" />
              </div>
              <h2 className="text-2xl md:text-3xl text-[#E1E0CC] mb-2">Success Fee Authorization</h2>
              <p className="text-gray-400 text-sm mb-6 max-w-sm">
                Miiso only charges when it protects you — 1.5% of value saved. Pre-approve up to your
                budget cap so fees can settle automatically on-chain after a confirmed protection event.
              </p>

              <div className="bg-black/60 p-5 rounded-xl border border-white/5 font-mono text-xs space-y-2 w-full text-left mb-6">
                <div className="flex justify-between">
                  <span className="text-gray-500">Max fee pull</span>
                  <span className="text-[#E1E0CC]">{budgetCap} USDC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Rate</span>
                  <span className="text-[#E1E0CC]">1.5% of protected value</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Charged when</span>
                  <span className="text-[#B8CFA8]">Only after confirmed protection</span>
                </div>
              </div>

              {feeHookConfigured ? (
                <button
                  onClick={handleApproveSuccessFee}
                  disabled={loading}
                  className="w-full bg-[#E1E0CC] text-black rounded-full py-4 font-bold hover:bg-white transition-colors flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading ? 'Approving USDC...' : `Approve ${budgetCap} USDC for Success Fees`}
                </button>
              ) : (
                <div className="w-full space-y-3">
                  <p className="text-xs text-gray-500">Success fee hook not deployed — skip for demo.</p>
                  <button
                    onClick={handleSkipSuccessFee}
                    disabled={loading}
                    className="w-full bg-[#E1E0CC] text-black rounded-full py-4 font-medium hover:bg-white transition-colors"
                  >
                    Continue to Dashboard
                  </button>
                </div>
              )}
            </motion.div>
          ) : step === 5 ? (
            <motion.div 
              key="step5"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center text-center"
            >
              <div className="w-20 h-20 bg-[#B8CFA8]/10 rounded-full flex items-center justify-center mb-6">
                <CheckCircle className="w-10 h-10 text-[#B8CFA8]" />
              </div>
              <h2 className="text-2xl md:text-3xl text-[#E1E0CC] mb-4">Miiso is Active</h2>
              <p className="text-[#B8CFA8] mb-8 max-w-sm font-semibold tracking-wide">
                We are watching Base for you. 24/7.
              </p>
              
              <div className="space-y-4 text-left w-full max-w-xs mb-8">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-[#B8CFA8]" />
                  <span className="text-[#E1E0CC]">Smart account active</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-[#B8CFA8]" />
                  <span className="text-[#E1E0CC]">
                    {displayGrantMethod ?? "Protection permission granted"}
                  </span>
                </div>
                {upgradeMethod && (
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-[#B8CFA8]" />
                    <span className="text-[#E1E0CC]">
                      Upgrade via {upgradeMethod}
                      {upgradeFee != null && upgradeFee > 0 ? ` ($${upgradeFee.toFixed(2)} USDC)` : ""}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-[#B8CFA8]" />
                  <span className="text-[#E1E0CC]">Sentinel scanning active</span>
                </div>
              </div>

              <div className="bg-white/5 rounded-xl p-4 w-full mb-8 flex justify-between">
                <span className="text-gray-400 text-sm">USDC budget remaining:</span>
                <span className="text-[#E1E0CC] ml-2 font-mono font-bold">{budgetCap}.00 USDC</span>
              </div>

              <Link 
                to="/dashboard"
                className="w-full bg-[#E1E0CC] text-black rounded-full py-4 font-medium hover:bg-white transition-colors block text-center"
              >
                Go to Dashboard
              </Link>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
