import { Shield, AlertTriangle, CheckCircle, Activity, ArrowRight, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { useWallet } from './WalletContext';
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
    vetoAction,
    isLoading 
  } = useWallet();

  const [revokingStates, setRevokingStates] = useState<Record<string, boolean>>({});
  const [vetoingStates, setVetoingStates] = useState<Record<string, boolean>>({});

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
                        {isRevocation ? "Reentrancy" : "Dangerous Flow"}
                      </span>
                      <span className="bg-white/5 px-2 py-0.5 rounded text-gray-300">
                        Score: {log.severity === "high" ? "98.7%" : "72.4%"}
                      </span>
                    </div>
                    <div className="mt-1">
                      <span className={`px-2 py-0.5 inline-block rounded font-bold tracking-widest uppercase text-[10px] ${statusColor}`}>
                        {statusText}
                      </span>
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
            <div className="p-6 border-b border-white/5 bg-[#0B0B0C]">
              <h2 className="text-[#E1E0CC] font-medium text-lg">Active Token Approvals</h2>
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
    </div>
  );
}
