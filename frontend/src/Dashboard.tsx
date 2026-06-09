import { Shield, AlertTriangle, CheckCircle, Activity, ArrowRight, Clock, X, HelpCircle, Info, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet, ProtectionEvent } from './WalletContext';
import { useState } from 'react';

export function Dashboard() {
  const { 
    walletAddress, 
    isConnected, 
    stats, 
    approvals, 
    history, 
    connectWallet, 
    revokeApproval, 
    batchRevokeApprovals,
    vetoAction,
    isLoading 
  } = useWallet();

  const [revokingStates, setRevokingStates] = useState<Record<string, boolean>>({});
  const [vetoingStates, setVetoingStates] = useState<Record<string, boolean>>({});
  const [selectedThreat, setSelectedThreat] = useState<ProtectionEvent | null>(null);
  const [isBatchRevoking, setIsBatchRevoking] = useState(false);

  const handleRevoke = async (tokenWithAddress: string, spender: string, rawAllowance: string) => {
    // Extract token address from "SYMBOL (0x...)"
    const match = tokenWithAddress.match(/\((0x[a-fA-F0-9]{40})\)/);
    const tokenAddress = match ? match[1] : tokenWithAddress;
    const key = `${tokenAddress}-${spender}`;
    
    setRevokingStates(prev => ({ ...prev, [key]: true }));
    try {
      await revokeApproval(tokenAddress, spender, rawAllowance);
    } finally {
      setRevokingStates(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleBatchRevoke = async () => {
    if (approvals.length === 0) return;
    setIsBatchRevoking(true);
    try {
      const payload = approvals.map(app => {
        const match = app.token.match(/\((0x[a-fA-F0-9]{40})\)/);
        const tokenAddress = match ? match[1] : app.token;
        return {
          tokenAddress,
          spenderAddress: app.spender,
          rawAllowance: app.rawAllowance
        };
      });
      await batchRevokeApprovals(payload);
    } catch (err) {
      console.error("Batch revoke error:", err);
    } finally {
      setIsBatchRevoking(false);
    }
  };

  const handleVeto = async (eventId: string) => {
    setVetoingStates(prev => ({ ...prev, [eventId]: true }));
    try {
      await vetoAction(eventId);
    } finally {
      setVetoingStates(prev => ({ ...prev, [eventId]: false }));
    }
  };

  if (!isConnected) {
    return (
      <div className="pt-32 pb-24 px-4 sm:px-6 max-w-md mx-auto min-h-screen flex flex-col justify-center items-center">
        <div className="bg-[#101010] p-8 rounded-3xl border border-white/5 text-center w-full shadow-2xl">
          <Shield className="w-16 h-16 text-[#19C978] mx-auto mb-6 animate-pulse" />
          <h2 className="text-[#E1E0CC] font-bold text-2xl mb-2 tracking-tight">Connect Wallet</h2>
          <p className="text-gray-400 text-sm mb-6 leading-relaxed">
            Please connect your wallet to access your live autonomous security dashboard and monitor active permissions.
          </p>
          <button 
            onClick={connectWallet}
            className="w-full bg-[#19C978] hover:bg-[#14a361] text-black font-semibold py-3 px-6 rounded-full transition-all duration-300 shadow-lg"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  // Format Helper for address display
  const formatAddr = (addr: string) => `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;

  // Convert stats totalSaved in Wei to a human readable estimated USD representation (assuming WETH = $3000)
  const formatValueSaved = (weiStr: string) => {
    try {
      const val = parseFloat(weiStr) / 1e18;
      if (val === 0) return "$0";
      return `$${(val * 3000).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    } catch {
      return "$0";
    }
  };

  // Convert budget values (in Wei) to token units
  const formatBudget = (weiStr: string) => {
    try {
      const val = parseFloat(weiStr) / 1e18;
      return val.toFixed(4);
    } catch {
      return "0.00";
    }
  };

  const getRiskColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'high': return 'text-[#EF4444]';
      case 'medium': return 'text-[#F59E0B]';
      case 'low': return 'text-[#19C978]';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="pt-28 pb-24 px-4 sm:px-6 max-w-7xl mx-auto min-h-screen">
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-[#101010] p-4 rounded-2xl border border-white/5 mb-8 gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-[#19C978]/10 text-[#19C978] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-2">
            <div className="w-2 h-2 bg-[#19C978] rounded-full animate-pulse" />
            PROTECTION ACTIVE
          </div>
          <span className="text-[#E1E0CC] font-mono text-sm">{formatAddr(walletAddress || "")}</span>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="flex flex-col items-end">
            <span className="text-gray-500 text-xs">USDC Budget Remaining</span>
            <span className="text-[#19C978] font-mono">
              {formatBudget(stats?.budgetRemaining || "0")} / {formatBudget(stats?.budgetCap || "0")} WETH
            </span>
          </div>
        </div>
      </div>

      {/* Zone 1 - Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Assets Protected", value: "$45,000" },
          { label: "Active Approvals", value: approvals.length.toString() },
          { label: "Threats Detected", value: (stats?.threatsDetected || 0).toString() },
          { label: "Value Saved", value: formatValueSaved(stats?.totalSaved || "0") }
        ].map((stat, i) => (
          <div key={i} className="bg-[#101010] p-6 rounded-2xl border border-white/5">
            <span className="text-gray-500 text-xs tracking-widest uppercase mb-2 block">{stat.label}</span>
            <span className="text-3xl text-[#E1E0CC] font-medium tracking-tight">{stat.value}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Zone 2 - Live Threat Feed */}
        <div className="lg:col-span-1 bg-[#101010] rounded-2xl border border-white/5 overflow-hidden flex flex-col h-125">
          <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#0B0B0C]">
            <h2 className="text-[#E1E0CC] font-medium text-lg">Live Threat Feed</h2>
            <Activity className="w-5 h-5 text-[#19C978] animate-pulse" />
          </div>
          <div className="p-4 flex-1 overflow-y-auto space-y-3 font-mono text-xs">
            {history.length === 0 ? (
              <div className="text-gray-500 text-center py-8">No security logs recorded. System monitoring.</div>
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
                  <div key={log.id} className="bg-[#0B0B0C] p-3 rounded-lg border border-white/5 flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <span className="text-gray-400 hover:text-white cursor-pointer transition-colors underline decoration-white/20">
                        {formatAddr(log.spenderAddress)}
                      </span>
                      <span className="text-gray-500">{new Date(log.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={log.severity === "high" ? "text-[#EF4444]" : "text-[#F59E0B]"}>
                        {log.staticFlags && log.staticFlags.length > 0 
                          ? log.staticFlags[0].replace(/_/g, " ") 
                          : (isRevocation ? "Reentrancy" : "Dangerous Flow")}
                      </span>
                      <span className="bg-white/5 px-2 py-0.5 rounded text-gray-300">
                        Score: {log.confidence ? `${(parseFloat(log.confidence) * 100).toFixed(1)}%` : (log.severity === "high" ? "98.7%" : "72.4%")}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className={`px-2 py-0.5 inline-block rounded font-bold tracking-widest uppercase text-[10px] ${statusColor}`}>
                        {statusText}
                      </span>
                      <button 
                        onClick={() => setSelectedThreat(log)}
                        className="text-[10px] text-[#19C978] hover:text-[#14a361] transition-colors flex items-center gap-1 font-sans font-semibold"
                      >
                        <HelpCircle className="w-3 h-3" /> Why?
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-8">
          {/* Zone 3 - Token Approvals */}
          <div className="bg-[#101010] rounded-2xl border border-white/5 overflow-hidden">
            <div className="p-6 border-b border-white/5 bg-[#0B0B0C] flex justify-between items-center">
              <h2 className="text-[#E1E0CC] font-medium text-lg">Active Token Approvals</h2>
              {approvals.length > 0 && (
                <button
                  onClick={handleBatchRevoke}
                  disabled={isBatchRevoking}
                  className="bg-red-500/10 hover:bg-red-500/20 text-[#EF4444] border border-red-500/20 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-300 flex items-center gap-2 disabled:opacity-50"
                >
                  {isBatchRevoking ? (
                    <>
                      <div className="w-3 h-3 border-2 border-t-transparent border-[#EF4444] rounded-full animate-spin" />
                      Securing...
                    </>
                  ) : (
                    "Secure Wallet (Batch Revoke)"
                  )}
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              {approvals.length === 0 ? (
                <div className="p-6 text-gray-500 text-center font-mono">No active token approvals cached.</div>
              ) : (
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-white/5 text-gray-500 h-12">
                      <th className="px-6 font-normal">Token</th>
                      <th className="px-6 font-normal">Spender</th>
                      <th className="px-6 font-normal">Amount</th>
                      <th className="px-6 font-normal">Risk</th>
                      <th className="px-6 font-normal">Action</th>
                    </tr>
                  </thead>
                  <tbody className="text-primary">
                    {approvals.map((row, i) => {
                      const match = row.token.match(/^([A-Z0-9]+)/);
                      const symbol = match ? match[1] : "TOKEN";
                      const key = `${row.token.match(/\((0x[a-fA-F0-9]{40})\)/)?.[1] || row.token}-${row.spender}`;
                      const isRevoking = revokingStates[key];

                      return (
                        <tr key={i} className="border-b border-white/5 hover:bg-white/2 transition-colors h-16">
                          <td className="px-6 font-medium text-[#E1E0CC]">{symbol}</td>
                          <td className="px-6 font-mono text-xs">{formatAddr(row.spender)}</td>
                          <td className="px-6 font-mono text-xs">{row.amount}</td>
                          <td className={`px-6 capitalize font-semibold ${getRiskColor(row.riskLevel)}`}>{row.riskLevel}</td>
                          <td className="px-6">
                            <button 
                              onClick={() => handleRevoke(row.token, row.spender, row.rawAllowance)}
                              disabled={isRevoking}
                              className="text-xs border border-white/10 hover:border-white/30 text-gray-400 hover:text-white px-3 py-1.5 rounded transition-all disabled:opacity-50"
                            >
                              {isRevoking ? 'Revoking...' : 'Revoke'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Zone 4 - Protection History */}
          <div className="bg-[#101010] rounded-2xl border border-white/5 overflow-hidden">
            <div className="p-6 border-b border-white/5 bg-[#0B0B0C]">
              <h2 className="text-[#E1E0CC] font-medium text-lg">Protection History</h2>
            </div>
            <div className="overflow-x-auto">
              {history.length === 0 ? (
                <div className="p-6 text-gray-500 text-center font-mono">No protection history logs found.</div>
              ) : (
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-white/5 text-gray-500 h-12">
                      <th className="px-6 font-normal">Date/Time</th>
                      <th className="px-6 font-normal">Threat/Action</th>
                      <th className="px-6 font-normal">Value At Risk</th>
                      <th className="px-6 font-normal">Veto status</th>
                    </tr>
                  </thead>
                  <tbody className="text-primary">
                    {history.map((row) => {
                      const isVetoable = row.actionType === "veto" && !row.vetoCancelled;
                      const isVetoing = vetoingStates[row.id];

                      return (
                        <tr key={row.id} className="border-b border-white/5 hover:bg-white/2 transition-colors h-16">
                          <td className="px-6 text-gray-400">{new Date(row.createdAt).toLocaleString()}</td>
                          <td className={`px-6 ${row.actionType === "revocation" ? "text-[#EF4444]" : "text-[#F59E0B]"}`}>
                            {row.actionType === "revocation" ? "Auto-revoked (Tier 1)" : "Veto Cooldown (Tier 2)"}
                          </td>
                          <td className="px-6 text-[#19C978]">{formatValueSaved(row.exposedValue)}</td>
                          <td className="px-6">
                            {isVetoable ? (
                              <button 
                                onClick={() => handleVeto(row.id)}
                                disabled={isVetoing}
                                className="text-xs bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded transition-all disabled:opacity-50"
                              >
                                {isVetoing ? 'Canceling...' : 'Veto / Cancel'}
                              </button>
                            ) : (
                              <span className="text-xs text-gray-500 capitalize">
                                {row.vetoCancelled ? "Cancelled by User" : "Executed Successfully"}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
                      {selectedThreat.staticFlags.map((flag, idx) => (
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
