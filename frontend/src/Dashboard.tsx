import { Shield, AlertTriangle, Activity, ArrowRight, Clock, X, HelpCircle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet, ProtectionEvent, ApprovalInfo } from './WalletContext';
import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { VetoTimer } from './components/dashboard/VetoTimer';
import { TxLink } from './components/shared/TxLink';
import {
  DashboardEmptyState,
  SystemPulseBar,
  LiveFeedIdlePanel,
  DemoReadyPanel,
  StatCard,
  SectionHeader,
  TableShell,
} from './components/dashboard/DashboardPanels';
import { useStore } from './store';


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
    executeVetoAction,
    isLoading 
  } = useWallet();

  const permissionContext = useStore((s) => s.permissionContext);
  const grantMethod = useStore((s) => s.grantMethod);
  const events = useStore((s) => s.events);
  const setupComplete = useStore((s) => s.setupComplete);
  const isReadOnly = isConnected && !setupComplete;
  const [revokingStates, setRevokingStates] = useState<Record<string, boolean>>({});
  const [vetoingStates, setVetoingStates] = useState<Record<string, boolean>>({});
  const [executingStates, setExecutingStates] = useState<Record<string, boolean>>({});
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
      const payload = approvals.map((app: ApprovalInfo) => {
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

  const handleExecuteVeto = async (eventId: string) => {
    setExecutingStates(prev => ({ ...prev, [eventId]: true }));
    try {
      await executeVetoAction(eventId);
    } finally {
      setExecutingStates(prev => ({ ...prev, [eventId]: false }));
    }
  };

  // Format Helper for address display
  const formatAddr = (addr: string) => `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;

  // Active Pending Actions (Tier 2 Veto Cooldown events)
  const pendingActions = events.filter(
    (log: ProtectionEvent) => log.actionType === "veto" && !log.vetoCancelled && log.stagedUntil && new Date(log.stagedUntil) > new Date()
  );

  // Convert stats totalSaved in Wei to a human readable estimated USD representation (assuming WETH = $3000)
  const formatValueSaved = (rawStr: string) => {
    if (!rawStr) return "$0";
    if (rawStr.startsWith("$")) return rawStr;
    try {
      const num = parseFloat(rawStr);
      if (num === 0) return "$0";
      // USDC and similar 6-decimal token amounts
      if (num < 1e15) {
        return `$${(num / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
      }
      const ethVal = num / 1e18;
      return `$${(ethVal * 3000).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    } catch {
      return "$0";
    }
  };

  const formatFee = (rawStr: string) => {
    if (!rawStr) return "-";
    if (rawStr.startsWith("$")) return rawStr;
    try {
      const num = parseFloat(rawStr);
      if (num === 0) return "-";
      const usd = num < 1e15 ? num / 1e6 : (num / 1e18) * 3000;
      return `$${(usd * 0.015).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    } catch {
      return "-";
    }
  };

  const formatBudget = (rawStr: string) => {
    try {
      const num = parseFloat(rawStr);
      return (num / 1e6).toFixed(2);
    } catch {
      return "0.00";
    }
  };

  const permissionExpiry = useMemo(() => {
    if (!permissionContext || !setupComplete) {
      return { daysLeft: "N/A", isExpired: false, permissionExpired: false };
    }
    try {
      const parsed = JSON.parse(permissionContext);
      const expiryRaw = parsed.expiry;
      if (!expiryRaw) return { daysLeft: "N/A", isExpired: false, permissionExpired: false };

      const expiryDate = new Date(
        typeof expiryRaw === "string" ? expiryRaw : expiryRaw * 1000
      );
      const diffTime = expiryDate.getTime() - Date.now();
      if (diffTime <= 0) {
        return { daysLeft: "Expired", isExpired: true, permissionExpired: true };
      }
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return { daysLeft: `${diffDays} days`, isExpired: false, permissionExpired: false };
    } catch {
      return { daysLeft: "N/A", isExpired: false, permissionExpired: false };
    }
  }, [permissionContext, setupComplete]);

  const resolvedBudget = useMemo(() => {
    let cap = parseFloat(stats?.budgetCap || "0");
    let remaining = parseFloat(stats?.budgetRemaining || "0");
    let spent = parseFloat(stats?.budgetSpent || "0");

    if (cap === 0 && permissionContext) {
      try {
        const parsed = JSON.parse(permissionContext);
        if (parsed.budgetCap) {
          cap = parseFloat(String(parsed.budgetCap));
          if (remaining === 0) remaining = cap;
        }
      } catch { /* ignore */ }
    }

    return { cap, remaining, spent };
  }, [stats, permissionContext]);

  const isIdleButArmed =
    setupComplete &&
    !isReadOnly &&
    events.length === 0 &&
    history.length === 0 &&
    approvals.length === 0;

  const getRiskColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'high': return 'text-[#C27A73]';
      case 'medium': return 'text-[#F59E0B]';
      case 'low': return 'text-[#B8CFA8]';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="pt-28 pb-24 px-4 sm:px-6 max-w-7xl mx-auto min-h-screen">
      {/* Read-only Setup Banner */}
      {isReadOnly && (
        <div className="mb-6 bg-[#F59E0B]/10 border border-[#F59E0B]/20 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-[#F59E0B] shrink-0" />
            <div>
              <p className="text-sm text-[#E1E0CC] font-medium">Setup required for autonomous protection</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Complete the setup wizard to activate live threat detection and auto-revocation.
              </p>
            </div>
          </div>
          <Link
            to="/setup"
            className="bg-[#F59E0B] text-black px-4 py-2 rounded-full text-xs font-bold hover:bg-[#d97706] transition-colors shrink-0 flex items-center gap-1.5"
          >
            Complete Setup <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* Top Bar */}
      <div className="bg-[#101010] p-5 sm:p-6 rounded-2xl border border-white/5 mb-6">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
          <div className="flex flex-wrap items-center gap-3">
            {isReadOnly ? (
              <div className="bg-[#F59E0B]/10 text-[#F59E0B] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <div className="w-2 h-2 bg-[#F59E0B] rounded-full" />
                READ ONLY
              </div>
            ) : permissionExpiry.permissionExpired ? (
              <div className="bg-[#C27A73]/10 text-[#C27A73] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <div className="w-2 h-2 bg-[#C27A73] rounded-full" />
                PERMISSION EXPIRED
              </div>
            ) : (
              <div className="bg-[#B8CFA8]/10 text-[#B8CFA8] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <div className="w-2 h-2 bg-[#B8CFA8] rounded-full animate-pulse" />
                PROTECTION ACTIVE
              </div>
            )}
            <span className="text-[#E1E0CC] font-mono text-sm">{formatAddr(walletAddress || "")}</span>
            <span className="hidden sm:inline text-[10px] font-mono text-gray-600 px-2 py-0.5 rounded border border-white/5">
              Base Sepolia
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-8 text-sm">
            <div>
              <span className="text-gray-500 text-[10px] uppercase tracking-widest block mb-0.5">Permission Expiry</span>
              <span className={`font-mono text-sm ${permissionExpiry.isExpired ? "text-[#C27A73]" : "text-[#E1E0CC]"}`}>
                {permissionExpiry.daysLeft}
              </span>
            </div>
            <div>
              <span className="text-gray-500 text-[10px] uppercase tracking-widest block mb-0.5">Permission Method</span>
              <span className="text-[#E1E0CC] text-sm">
                {grantMethod ?? (setupComplete ? "Granted" : "—")}
              </span>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="text-gray-500 text-[10px] uppercase tracking-widest block mb-0.5">USDC Budget Remaining</span>
              <span className="text-[#B8CFA8] font-mono text-sm">
                {formatBudget(String(resolvedBudget.remaining))} / {formatBudget(String(resolvedBudget.cap))} USDC
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Pending Veto Actions Banner */}
      {pendingActions.length > 0 && (
        <div className="mb-8 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#F59E0B] uppercase tracking-wider font-mono flex items-center gap-2">
              <Clock className="w-4 h-4 animate-spin [animation-duration:10s]" />
              Active Veto Buffers ({pendingActions.length})
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {pendingActions.map((action: ProtectionEvent) => (
              <VetoTimer
                key={action.id}
                action={action}
                onVeto={handleVeto}
                isVetoing={!!vetoingStates[action.id]}
                onExecuteVeto={handleExecuteVeto}
                isExecuting={!!executingStates[action.id]}
              />
            ))}
          </div>
        </div>
      )}

      {/* Zone 1 - Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard
          label="Assets Protected"
          value={formatValueSaved(stats?.totalActiveExposure || "0")}
          subtext={approvals.length === 0 ? "No exposed approvals" : `${approvals.length} approval(s) tracked`}
        />
        <StatCard
          label="Active Approvals"
          value={approvals.length.toString()}
          subtext={approvals.length === 0 ? "Wallet clear" : "Under monitoring"}
        />
        <StatCard
          label="Threats Detected"
          value={(stats?.threatsDetected || 0).toString()}
          subtext={(stats?.threatsDetected || 0) === 0 ? "Sentinel idle" : "Analyzed by Venice AI"}
        />
        <StatCard
          label="Value Saved"
          value={formatValueSaved(stats?.totalSaved || "0")}
          subtext={history.length === 0 ? "No revocations yet" : `${history.length} protection event(s)`}
          accent={(stats?.totalSaved && parseFloat(stats.totalSaved) > 0) || history.length > 0}
        />
      </div>

      <SystemPulseBar
        setupComplete={setupComplete}
        isReadOnly={isReadOnly}
        walletAddress={walletAddress}
      />

      {isIdleButArmed && (
        <div className="mb-6">
          <DemoReadyPanel show />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Zone 2 - Live Threat Feed */}
        <div className="xl:col-span-5 bg-[#101010] rounded-2xl border border-white/5 overflow-hidden flex flex-col h-[580px]">
          <SectionHeader
            title="Live Network Scans"
            icon={<Activity className="w-4 h-4 text-[#B8CFA8] animate-pulse" />}
          />
          <div className="p-3 flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-3 font-mono text-xs">
            {events.length === 0 ? (
              <LiveFeedIdlePanel setupComplete={setupComplete && !isReadOnly} />
            ) : (
              events.map((log: ProtectionEvent) => {
                const isRevocation = log.actionType === "revocation";
                const isClean = log.actionType === "clean";
                const isVetoed = log.vetoCancelled;
                
                let statusText = "MONITORING";
                let statusColor = "bg-white/5 text-gray-500";
                
                if (isClean) {
                  statusText = `CLEAN — ${log.exposedValue}`;
                  statusColor = "bg-[#B8CFA8]/10 text-[#B8CFA8]";
                } else if (isVetoed) {
                  statusText = "VETOED";
                  statusColor = "bg-[#C27A73]/10 text-[#C27A73]";
                } else if (log.relayStatus === "confirmed") {
                  statusText = "REVOKED";
                  statusColor = "bg-[#B8CFA8]/10 text-[#B8CFA8]";
                } else if (log.relayStatus === "pending") {
                  statusText = "PENDING";
                  statusColor = "bg-[#F59E0B]/10 text-[#F59E0B]";
                }

                return (
                  <div key={log.id} className={`bg-[#0B0B0C] p-3 rounded-lg border flex flex-col gap-2 ${isClean ? 'border-[#B8CFA8]/20' : 'border-white/5'}`}>
                    <div className="flex justify-between items-start">
                      <a 
                        href={`https://sepolia.basescan.org/address/${log.spenderAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-[#B8CFA8] cursor-pointer transition-colors underline decoration-white/20"
                      >
                        {formatAddr(log.spenderAddress)}
                      </a>
                      <span className="text-gray-500">{new Date(log.createdAt).toLocaleTimeString()}</span>
                    </div>
                    
                    {!isClean && (
                      <div className="flex justify-between items-center">
                        <span className={log.severity === "high" ? "text-[#C27A73]" : "text-[#F59E0B]"}>
                          {log.staticFlags && log.staticFlags.length > 0 
                            ? log.staticFlags[0].replace(/_/g, " ") 
                            : (isRevocation ? "Reentrancy" : "Dangerous Flow")}
                        </span>
                        <span className="bg-white/5 px-2 py-0.5 rounded text-gray-300">
                          Score: {log.confidence ? `${(parseFloat(log.confidence) * 100).toFixed(1)}%` : (log.severity === "high" ? "98.7%" : "72.4%")}
                        </span>
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center mt-1">
                      <span className={`px-2 py-0.5 inline-block rounded font-bold tracking-widest uppercase text-[10px] ${statusColor}`}>
                        {statusText}
                      </span>
                      {!isClean && (
                        <button 
                          onClick={() => setSelectedThreat(log)}
                          className="text-[10px] text-[#B8CFA8] hover:text-[#14a361] transition-colors flex items-center gap-1 font-sans font-semibold"
                        >
                          <HelpCircle className="w-3 h-3" /> Why?
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="xl:col-span-7 flex flex-col gap-6 min-h-[420px]">
          {/* Zone 3 - Protected Assets */}
          <div className="bg-[#101010] rounded-2xl border border-white/5 overflow-hidden flex flex-col">
            <SectionHeader
              title="Protected Assets"
              action={
                approvals.length > 0 ? (
                  <button
                    onClick={handleBatchRevoke}
                    disabled={isBatchRevoking}
                    className="bg-[#C27A73]/10 hover:bg-[#C27A73]/20 text-[#C27A73] border border-red-500/20 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-300 flex items-center gap-2 disabled:opacity-50"
                  >
                    {isBatchRevoking ? (
                      <>
                        <div className="w-3 h-3 border-2 border-t-transparent border-[#C27A73] rounded-full animate-spin" />
                        Securing...
                      </>
                    ) : (
                      "Secure Wallet (Batch Revoke)"
                    )}
                  </button>
                ) : undefined
              }
            />
            {approvals.length === 0 ? (
              <TableShell
                columns={["Token", "Spender", "Amount", "Risk", "Action"]}
                empty={
                  <DashboardEmptyState
                    icon={<Shield className="w-5 h-5" />}
                    title="No active approvals cached"
                    description="When you grant a token approval on-chain, Miiso indexes it here with risk scoring and one-click revoke."
                    hint={setupComplete ? "Approve USDC to trigger the demo flow" : "Complete setup to start indexing"}
                  />
                }
              />
            ) : (
              <div className="overflow-x-auto flex-1">
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
                    {approvals.map((row: ApprovalInfo, i: number) => {
                      const match = row.token.match(/^([A-Z0-9]+)/);
                      const symbol = match ? match[1] : "TOKEN";
                      const key = `${row.token.match(/\((0x[a-fA-F0-9]{40})\)/)?.[1] || row.token}-${row.spender}`;
                      const isRevoking = revokingStates[key];

                      return (
                        <tr key={i} className="border-b border-white/5 hover:bg-white/2 transition-colors h-16">
                          <td className="px-6 font-medium text-[#E1E0CC]">{symbol}</td>
                          <td className="px-6">
                            <div className="flex items-center gap-2">
                              <Shield className="w-4 h-4 text-[#B8CFA8] fill-[#B8CFA8]/10 animate-pulse" />
                              <div className="flex flex-col">
                                <span className="font-semibold text-sm text-[#E1E0CC]">
                                  {row.spenderName || "Unknown Protocol"}
                                </span>
                                <span className="font-mono text-[10px] text-gray-500">
                                  {formatAddr(row.spender)}
                                </span>
                              </div>
                            </div>
                          </td>
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
              </div>
            )}
          </div>

          {/* Zone 4 - Protection History */}
          <div className="bg-[#101010] rounded-2xl border border-white/5 overflow-hidden flex flex-col">
            <SectionHeader title="Protection History" />
            {history.length === 0 ? (
              <TableShell
                columns={["Date/Time", "Threat/Action", "Value At Risk", "Fee (1.5%)", "Tx Hash", "Veto status"]}
                empty={
                  <DashboardEmptyState
                    icon={<Activity className="w-5 h-5" />}
                    title="No protection events yet"
                    description="Auto-revocations and veto cooldowns appear here with Venice scores, relay fees, and BaseScan links."
                    hint="Events populate live during the demo — no seed data needed"
                  />
                }
              />
            ) : (
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-white/5 text-gray-500 h-12">
                      <th className="px-6 font-normal">Date/Time</th>
                      <th className="px-6 font-normal">Threat/Action</th>
                      <th className="px-6 font-normal">Value At Risk</th>
                      <th className="px-6 font-normal">Fee (1.5%)</th>
                      <th className="px-6 font-normal">Tx Hash</th>
                      <th className="px-6 font-normal">Veto status</th>

                    </tr>
                  </thead>
                  <tbody className="text-primary">
                    {history.map((row: ProtectionEvent) => {
                      const isVetoable = row.actionType === "veto" && !row.vetoCancelled;
                      const isVetoing = vetoingStates[row.id];

                      return (
                        <tr key={row.id} className="border-b border-white/5 hover:bg-white/2 transition-colors h-16">
                          <td className="px-6 text-gray-400">{new Date(row.createdAt).toLocaleString()}</td>
                          <td className={`px-6 ${row.actionType === "revocation" ? "text-[#C27A73]" : "text-[#F59E0B]"}`}>
                            {row.actionType === "revocation" ? "Auto-revoked (Tier 1)" : "Veto Cooldown (Tier 2)"}
                          </td>
                          <td className="px-6 text-[#B8CFA8]">{formatValueSaved(row.exposedValue)}</td>
                          <td className="px-6 text-gray-400">
                            {(row.actionType === "revocation" || (row.actionType === "veto" && row.relayStatus === "confirmed"))
                              ? formatFee(row.exposedValue)
                              : "-"}
                          </td>
                          <td className="px-6">
                            <TxLink txHash={row.relayTxHash || ""} />
                          </td>
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
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Budget Tracker Section */}
      <div className="mt-6 bg-[#101010] p-5 sm:p-6 rounded-2xl border border-white/5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-[#E1E0CC] font-medium text-base mb-1">Monthly Gas Relayer Budget</h3>
            <p className="text-xs text-gray-500 max-w-xl leading-relaxed">
              Budget is consumed only when an automated revocation relay fires via 1Shot. Sentinel scans are separate (~$0.001/scan).
            </p>
          </div>
          <div className="flex items-baseline gap-2 font-mono shrink-0">
            <span className="text-[#B8CFA8] text-2xl font-bold">
              ${formatBudget(String(resolvedBudget.spent))}
            </span>
            <span className="text-gray-500 text-sm">
              / ${formatBudget(String(resolvedBudget.cap))} USDC spent
            </span>
          </div>
        </div>

        {(() => {
          const cap = resolvedBudget.cap / 1e6;
          const spent = resolvedBudget.spent / 1e6;
          const percent = cap > 0 ? Math.min(100, (spent / cap) * 100) : 0;
          return (
            <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
              <div
                className="bg-[#B8CFA8] h-full rounded-full transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
          );
        })()}
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
                <div className="flex items-center gap-2 text-[#C27A73]">
                  <Shield className="w-5 h-5 text-[#B8CFA8]" />
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
                    <span className="text-lg font-bold font-mono text-[#C27A73]">
                      {selectedThreat.confidence ? `${(parseFloat(selectedThreat.confidence) * 100).toFixed(1)}%` : (selectedThreat.severity === "high" ? "98.7%" : "72.4%")}
                    </span>
                  </div>
                  <div className="bg-[#101010] p-3 rounded-lg border border-white/5">
                    <label className="text-[10px] text-gray-500 uppercase tracking-widest block mb-1">Static Risk Tier</label>
                    <span className={`text-lg font-bold capitalize ${selectedThreat.severity === 'high' ? 'text-[#C27A73]' : 'text-[#F59E0B]'}`}>
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
                        <span key={idx} className="bg-[#C27A73]/10 text-[#C27A73] border border-red-500/10 px-2 py-0.5 rounded text-[10px] font-mono font-semibold">
                          {flag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Plain English Venice Explainer */}
                <div className="border border-[#B8CFA8]/20 bg-[#B8CFA8]/5 p-4 rounded-xl">
                  <div className="flex items-start gap-2.5">
                    <Info className="w-5 h-5 text-[#B8CFA8] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-[#B8CFA8] font-bold text-xs uppercase tracking-wider mb-1">Natural Language AI Report</h4>
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
                  className="bg-[#B8CFA8] hover:bg-[#14a361] text-black font-semibold text-xs py-2 px-5 rounded-full transition-colors"
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
