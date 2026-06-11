import { Bell, Clock, ShieldAlert, Filter, HelpCircle, Shield, X, Info } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useWallet } from './WalletContext';
import { motion, AnimatePresence } from 'framer-motion';
import { VetoTimer } from './components/dashboard/VetoTimer';

export function Alerts() {
  const {
    history,
    vetoAction,
    isConnected
  } = useWallet();

  const [toggles, setToggles] = useState({
    push: true,
    tier1: true,
    tier2: true,
    info: false
  });

  const [vetoingStates, setVetoingStates] = useState<Record<string, boolean>>({});
  const [selectedThreat, setSelectedThreat] = useState<any>(null);
  const [timeRemaining, setTimeRemaining] = useState<Record<string, string>>({});

  const handleVeto = async (eventId: string) => {
    setVetoingStates(prev => ({ ...prev, [eventId]: true }));
    try {
      await vetoAction(eventId);
    } finally {
      setVetoingStates(prev => ({ ...prev, [eventId]: false }));
    }
  };

  // Active Pending Actions (Tier 2 Veto Cooldown events)
  const pendingActions = history.filter(
    (log) => log.actionType === "veto" && !log.vetoCancelled && log.stagedUntil && new Date(log.stagedUntil) > new Date()
  );

  // Update countdown timers for pending actions
  useEffect(() => {
    const updateTimers = () => {
      const newTimers: Record<string, string> = {};
      pendingActions.forEach((action) => {
        if (!action.stagedUntil) return;
        const diff = new Date(action.stagedUntil).getTime() - Date.now();
        if (diff <= 0) {
          newTimers[action.id] = "00:00";
        } else {
          const seconds = Math.floor((diff / 1000) % 60);
          const minutes = Math.floor((diff / (1000 * 60)) % 60);
          newTimers[action.id] = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
      });
      setTimeRemaining(newTimers);
    };

    updateTimers();
    const interval = setInterval(updateTimers, 1000);
    return () => clearInterval(interval);
  }, [history]);

  const formatAddr = (addr: string) => `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  const formatValueSaved = (weiStr: string) => {
    try {
      const val = parseFloat(weiStr) / 1e18;
      if (val >= 0.1) return `${val.toFixed(2)} WETH`;
      const usdcVal = parseFloat(weiStr) / 1e6;
      if (usdcVal > 0) return `$${usdcVal.toFixed(2)}`;
      return `${val} WETH`;
    } catch {
      return "0.00";
    }
  };

  if (!isConnected) {
    return (
      <div className="pt-32 pb-24 px-4 sm:px-6 max-w-md mx-auto min-h-screen flex flex-col justify-center items-center">
        <div className="bg-[#101010] p-8 rounded-3xl border border-white/5 text-center w-full shadow-2xl">
          <ShieldAlert className="w-16 h-16 text-[#19C978] mx-auto mb-6 animate-pulse" />
          <h2 className="text-[#E1E0CC] font-bold text-2xl mb-2 tracking-tight">Connect Wallet</h2>
          <p className="text-gray-400 text-sm mb-6 leading-relaxed">
            Please connect your wallet to view active alerts and pending security cooldown actions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-28 pb-24 px-4 sm:px-6 max-w-5xl mx-auto min-h-screen">
      <h1 className="text-3xl text-[#E1E0CC] font-medium mb-12 flex items-center gap-3">
        <Bell className="w-8 h-8 opacity-50 text-[#19C978]" />
        Alerts & Notifications
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        {/* Section 1 - Preferences */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[#101010] p-6 rounded-2xl border border-white/5">
            <h2 className="text-[#E1E0CC] font-medium mb-6 flex items-center gap-2">
              <Bell className="w-4 h-4 text-gray-400" />
              Alert Rules
            </h2>
            <div className="space-y-6">
              {[
                { id: 'push', label: 'Push notifications (Telegram)', desc: 'Receive real-time alerts on your device.' },
                { id: 'tier1', label: 'Tier 1 alerts', desc: 'Auto-fire ≥85%. Instant gasless revocation.' },
                { id: 'tier2', label: 'Tier 2 alerts', desc: '60s countdown. User holds veto authority.' },
                { id: 'info', label: 'Informational logs', desc: '<70% confidence. Audited scan logs.' }
              ].map(toggle => (
                <div key={toggle.id} className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm text-[#E1E0CC]">{toggle.label}</div>
                    <div className="text-xs text-gray-500 mt-1">{toggle.desc}</div>
                  </div>
                  <button 
                    onClick={() => setToggles((prev: any) => ({ ...prev, [toggle.id]: !prev[toggle.id as keyof typeof toggles] }))}
                    aria-label={`Toggle ${toggle.label}`}
                    title={`Toggle ${toggle.label}`}
                    className={`shrink-0 w-10 h-5 rounded-full relative transition-colors ${toggles[toggle.id as keyof typeof toggles] ? 'bg-[#19C978]' : 'bg-white/10'}`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${toggles[toggle.id as keyof typeof toggles] ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Section 2 & 3 */}
        <div className="lg:col-span-2 space-y-8">
          {/* Pending Actions */}
          <div className="bg-[#101010] rounded-2xl border border-orange-500/20 overflow-hidden">
            <div className="p-6 border-b border-white/5 bg-[#F59E0B]/5 flex justify-between items-center">
              <h2 className="text-[#E1E0CC] font-medium flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-[#F59E0B]" />
                Pending Veto Buffers
              </h2>
              <span className="bg-[#F59E0B]/20 text-[#F59E0B] px-2.5 py-1 rounded text-xs font-mono font-bold">
                {pendingActions.length} ACTIVE
              </span>
            </div>
            <div className="p-6 space-y-4">
              {pendingActions.length === 0 ? (
                <div className="text-center py-6 text-gray-500 text-sm font-mono">No pending veto actions active. Smart Account is secure.</div>
              ) : (
                pendingActions.map((action) => (
                  <VetoTimer
                    key={action.id}
                    action={action}
                    onVeto={handleVeto}
                    isVetoing={!!vetoingStates[action.id]}
                  />
                ))
              )}
            </div>
          </div>


          {/* Alert Log */}
          <div className="bg-[#101010] rounded-2xl border border-white/5 overflow-hidden">
            <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-[#E1E0CC] font-medium">Historical Security Alerts</h2>
              <button className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors">
                <Filter className="w-3.5 h-3.5" /> Filter Log
              </button>
            </div>
            <div className="divide-y divide-white/5 font-mono text-xs">
              {history.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No security logs recorded. System monitoring.</div>
              ) : (
                history.map((log) => {
                  const isRevocation = log.actionType === "revocation";
                  const isVetoed = log.vetoCancelled;
                  
                  let statusText = "MONITORING";
                  let statusColor = "bg-white/5 text-gray-500";
                  
                  if (isVetoed) {
                    statusText = "VETOED";
                    statusColor = "bg-red-500/10 text-[#EF4444]";
                  } else if (log.relayStatus === "confirmed") {
                    statusText = "REVOKED";
                    statusColor = "bg-[#19C978]/10 text-[#19C978]";
                  } else if (log.relayStatus === "pending") {
                    statusText = "PENDING";
                    statusColor = "bg-[#F59E0B]/10 text-[#F59E0B]";
                  }

                  return (
                    <div key={log.id} className="p-6 flex flex-col sm:flex-row justify-between gap-4 hover:bg-white/1 transition-colors">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-3">
                           <span className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-widest ${statusColor}`}>
                             {statusText}
                           </span>
                           <span className="text-gray-500 border border-white/10 px-2 py-0.5 rounded text-[9px]">
                             {isRevocation ? "Tier 1 Action" : "Tier 2 Action"}
                           </span>
                        </div>
                        <div className="text-[#E1E0CC] font-medium text-sm font-sans">
                          {log.staticFlags && log.staticFlags.length > 0 
                            ? log.staticFlags[0].replace(/_/g, " ") 
                            : (isRevocation ? "Reentrancy Detected" : "Suspicious Spender Cooldown")}
                        </div>
                        <div className="text-xs text-gray-400 font-sans leading-relaxed">
                          Approval for contract {formatAddr(log.spenderAddress)} containing {formatValueSaved(log.exposedValue)} at risk.
                        </div>
                        <button
                          onClick={() => setSelectedThreat(log)}
                          className="text-[10px] text-[#19C978] hover:text-[#14a361] transition-colors flex items-center gap-1 font-sans font-bold pt-1"
                        >
                          <HelpCircle className="w-3.5 h-3.5" /> Explain Threat
                        </button>
                      </div>
                      <div className="text-gray-500 shrink-0 text-right text-[10px]">
                        {new Date(log.createdAt).toLocaleString()}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Venice AI Threat Explainer Modal */}
      <AnimatePresence>
        {selectedThreat && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="bg-[#0B0B0C] border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative"
            >
              {/* Header */}
              <div className="p-6 border-b border-white/5 bg-[#101010] flex justify-between items-center">
                <div className="flex items-center gap-2 text-[#EF4444]">
                  <Shield className="w-5 h-5 text-[#19C978]" />
                  <span className="font-bold text-sm tracking-widest uppercase text-[#E1E0CC]">Venice Threat Explainer</span>
                </div>
                <button 
                  onClick={() => setSelectedThreat(null)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                {/* Spender Contract info */}
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest block mb-1">Target Spender Contract</label>
                  <div className="bg-[#101010] p-3 rounded-lg border border-white/5 font-mono text-xs flex justify-between items-center text-[#E1E0CC]">
                    <span className="truncate mr-4">{selectedThreat.spenderAddress}</span>
                  </div>
                </div>

                {/* Score and Risk */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#101010] p-3 rounded-lg border border-white/5">
                    <label className="text-[10px] text-gray-500 uppercase tracking-widest block mb-1">Threat Score</label>
                    <span className="text-lg font-bold font-mono text-[#EF4444]">
                      {selectedThreat.confidence ? `${(parseFloat(selectedThreat.confidence) * 100).toFixed(1)}%` : (selectedThreat.severity === "high" ? "98.7%" : "72.4%")}
                    </span>
                  </div>
                  <div className="bg-[#101010] p-3 rounded-lg border border-white/5">
                    <label className="text-[10px] text-gray-500 uppercase tracking-widest block mb-1">Static Risk Tier</label>
                    <span className={`text-lg font-bold capitalize ${selectedThreat.severity === 'high' ? 'text-[#EF4444]' : 'text-[#F59E0B]'}`}>
                      {selectedThreat.staticRisk || selectedThreat.severity}
                    </span>
                  </div>
                </div>

                {/* Static Flags */}
                {selectedThreat.staticFlags && selectedThreat.staticFlags.length > 0 && (
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase tracking-widest block mb-1">Static Analysis Flags</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selectedThreat.staticFlags.map((flag: string, idx: number) => (
                        <span key={idx} className="bg-red-500/10 text-[#EF4444] border border-red-500/10 px-2 py-0.5 rounded text-[10px] font-mono font-semibold">
                          {flag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Plain English Venice Explainer */}
                <div className="border border-[#19C978]/20 bg-[#19C978]/5 p-4 rounded-xl">
                  <div className="flex items-start gap-2.5">
                    <Info className="w-5 h-5 text-[#19C978] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-[#19C978] font-bold text-xs uppercase tracking-wider mb-1">Natural Language AI Report</h4>
                      <p className="text-gray-300 text-sm leading-relaxed font-sans">
                        {selectedThreat.explainer || "This contract was flagged due to abnormal static risk pattern checks. Manual audit recommended."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-[#101010] border-t border-white/5 flex justify-end">
                <button
                  onClick={() => setSelectedThreat(null)}
                  className="bg-[#19C978] hover:bg-[#14a361] text-black font-semibold text-xs py-2 px-5 rounded-full transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
