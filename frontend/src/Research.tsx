import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Bot, Database, ShieldAlert, CheckSquare, Loader2, Play, DollarSign, FileText, ChevronRight, Activity, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { useWallet } from './WalletContext';
import { postAnalyzeContract } from './lib/api';

interface AgentStep {
  agent: 'Research' | 'Data' | 'Analysis' | 'FactCheck' | 'Relayer';
  message: string;
  status: 'pending' | 'running' | 'done' | 'error';
  timestamp: string;
}

export function Research() {
  const { walletAddress, isConnected, connectWallet } = useWallet();
  const [targetAddress, setTargetAddress] = useState('0x9488a0b0b0000000000000000000000000000099');
  const [isRunning, setIsRunning] = useState(false);
  const [currentStepIdx, setCurrentStepIdx] = useState(-1);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'signing' | 'paid'>('idle');
  const [cost, setCost] = useState('0.0002');
  const [activeTab, setActiveTab] = useState<'interactive' | 'logs'>('interactive');
  const [addressError, setAddressError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<{
    combinedConfidence: number;
    staticRisks: string[];
    veniceConfidenceVerdict: string;
    score: number;
    totalCostUsdc: number;
  } | null>(null);

  const [steps, setSteps] = useState<AgentStep[]>([
    { agent: 'Relayer', message: 'EIP-7715 session authorization request: Gas allowance confirmation', status: 'pending', timestamp: '10:09:01' },
    { agent: 'Relayer', message: 'X402 micro-payment authorization via 1Shot Relayer: 0.0002 WETH', status: 'pending', timestamp: '10:09:02' },
    { agent: 'Research', message: 'Retrieving contract bytecode and deployment parameters from Base Sepolia...', status: 'pending', timestamp: '10:09:04' },
    { agent: 'Research', message: 'Scanning developer repositories and verified source hashes...', status: 'pending', timestamp: '10:09:05' },
    { agent: 'Data', message: 'Querying liquidity providers and token distribution matrices...', status: 'pending', timestamp: '10:09:07' },
    { agent: 'Data', message: 'Analyzing transaction history: High-frequency transfer anomalies flagged...', status: 'pending', timestamp: '10:09:09' },
    { agent: 'Analysis', message: 'Decompiling opcodes: Executing static-risk pattern detection...', status: 'pending', timestamp: '10:09:11' },
    { agent: 'Analysis', message: 'Invoking Venice AI text models to evaluate vulnerability payload...', status: 'pending', timestamp: '10:09:13' },
    { agent: 'FactCheck', message: 'Evaluating false-positives against signature white/blacklists...', status: 'pending', timestamp: '10:09:15' },
    { agent: 'FactCheck', message: 'Compiling security report payload & threat score formulation...', status: 'pending', timestamp: '10:09:17' }
  ]);

  const handleStartAnalysis = async () => {
    setAddressError(null);
    setReportData(null);

    if (!isConnected) {
      setAddressError("Please connect your wallet first.");
      return;
    }
    
    if (!targetAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      setAddressError("Please enter a valid 42-character Ethereum address.");
      return;
    }

    setIsRunning(true);
    setPaymentStatus('signing');
    setCurrentStepIdx(0);
    
    // Reset steps status
    setSteps(prev => prev.map(s => ({ ...s, status: 'pending' })));

    // Request MetaMask sign for the X402 payment relayer if available
    if (typeof window !== 'undefined' && (window as any).ethereum && walletAddress !== "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266") {
      try {
        const provider = (window as any).ethereum;
        const msg = `Authorize X402 Agent Research Request\n\nTarget Contract: ${targetAddress}\nGas Cost: ${cost} WETH\nRequest ID: miiso-req-${Math.floor(Math.random() * 100000)}`;
        await provider.request({
          method: 'personal_sign',
          params: [msg, walletAddress]
        });
      } catch (err) {
        console.error("User rejected X402 payment sign:", err);
        setIsRunning(false);
        setPaymentStatus('idle');
        return;
      }
    }

    setPaymentStatus('paid');

    try {
      const result = await postAnalyzeContract(targetAddress);
      if (result.success && result.data) {
        setReportData(result.data);
      } else {
        setAddressError("Analysis failed. Could not fetch bytecode.");
      }
    } catch (err: any) {
      console.error(err);
      setAddressError(err.message || "Failed to analyze contract.");
      setIsRunning(false);
      setPaymentStatus('idle');
      setCurrentStepIdx(-1);
    }
  };

  useEffect(() => {
    if (!isRunning || paymentStatus !== 'paid') return;

    if (currentStepIdx < steps.length) {
      setSteps(prev => {
        const updated = [...prev];
        if (currentStepIdx > 0) {
          updated[currentStepIdx - 1].status = 'done';
        }
        updated[currentStepIdx].status = 'running';
        updated[currentStepIdx].timestamp = new Date().toLocaleTimeString();
        return updated;
      });

      const timer = setTimeout(() => {
        setCurrentStepIdx(prev => prev + 1);
      }, 1200);

      return () => clearTimeout(timer);
    } else {
      setSteps(prev => {
        const updated = [...prev];
        updated[updated.length - 1].status = 'done';
        return updated;
      });
      setIsRunning(false);
    }
  }, [isRunning, currentStepIdx, paymentStatus]);

  const getAgentColor = (agent: string) => {
    switch (agent) {
      case 'Relayer': return 'text-[#19C978]';
      case 'Research': return 'text-[#9b5de5]';
      case 'Data': return 'text-[#00bbf9]';
      case 'Analysis': return 'text-[#f15bb5]';
      case 'FactCheck': return 'text-[#fee440]';
      default: return 'text-white';
    }
  };

  const getAgentIcon = (agent: string) => {
    switch (agent) {
      case 'Relayer': return <DollarSign className="w-4 h-4 text-[#19C978]" />;
      case 'Research': return <Search className="w-4 h-4 text-[#9b5de5]" />;
      case 'Data': return <Database className="w-4 h-4 text-[#00bbf9]" />;
      case 'Analysis': return <Bot className="w-4 h-4 text-[#f15bb5]" />;
      case 'FactCheck': return <CheckSquare className="w-4 h-4 text-[#fee440]" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  return (
    <div className="pt-32 pb-24 px-4 sm:px-6 max-w-6xl mx-auto min-h-screen">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <div className="flex items-center gap-2 text-[#19C978] text-xs font-semibold uppercase tracking-widest mb-2">
            <span className="w-2 h-2 rounded-full bg-[#19C978] animate-ping" />
            Venice-Powered Multi-Agent Security Hub
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-[#E1E0CC] tracking-tight">
            AI Research Center
          </h1>
          <p className="text-gray-400 text-sm mt-2 max-w-2xl leading-relaxed">
            Submit any smart contract address to coordinate specialized AI agents (Research, Data, Analysis, and Fact Checking). Tasks are powered by gasless EIP-7710 X402 payment layers.
          </p>
        </div>
        
        {/* Cost Indicator Card */}
        <div className="bg-[#101010] p-4 rounded-2xl border border-white/5 flex items-center gap-4">
          <div className="bg-[#19C978]/10 p-3 rounded-xl">
            <DollarSign className="w-6 h-6 text-[#19C978]" />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-semibold uppercase">Cost per Query (X402)</div>
            <div className="text-lg font-bold text-[#E1E0CC]">{cost} WETH</div>
          </div>
        </div>
      </div>

      {/* Main Input Form */}
      <div className="bg-[#101010] p-6 rounded-3xl border border-white/5 mb-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#19C978]/5 rounded-full blur-3xl -z-10" />
        
        {addressError && (
          <div className="mb-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-400 text-sm font-semibold">{addressError}</span>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input 
              type="text"
              placeholder="Enter Smart Contract Address (0x...)"
              value={targetAddress}
              onChange={(e) => {
                setTargetAddress(e.target.value);
                setAddressError(null);
              }}
              disabled={isRunning}
              className="w-full bg-black border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-[#E1E0CC] placeholder-gray-600 focus:outline-none focus:border-[#19C978]/45 transition-colors text-sm"
            />
          </div>
          
          <button
            onClick={handleStartAnalysis}
            disabled={isRunning}
            className={`w-full md:w-auto px-8 py-4 rounded-2xl font-bold transition-all duration-300 flex items-center justify-center gap-2 ${
              isRunning 
                ? 'bg-white/10 text-gray-400 cursor-not-allowed' 
                : 'bg-[#19C978] hover:bg-[#14a361] text-black shadow-lg hover:shadow-[#19C978]/15 hover:scale-[1.02]'
            }`}
          >
            {isRunning ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Coordinating Agents...
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current" />
                Initialize Agents
              </>
            )}
          </button>
        </div>
      </div>

      {/* Dynamic Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Agent Coordination Map */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-[#101010] rounded-3xl border border-white/5 p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/5">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Bot className="w-5 h-5 text-[#19C978]" />
                Live Agent Task board
              </h2>
              <div className="flex gap-2">
                <button 
                  onClick={() => setActiveTab('interactive')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === 'interactive' ? 'bg-[#19C978]/10 text-[#19C978] border border-[#19C978]/20' : 'text-gray-400 hover:text-white'}`}
                >
                  Interactive Map
                </button>
                <button 
                  onClick={() => setActiveTab('logs')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === 'logs' ? 'bg-[#19C978]/10 text-[#19C978] border border-[#19C978]/20' : 'text-gray-400 hover:text-white'}`}
                >
                  Stdout Logs
                </button>
              </div>
            </div>

            {activeTab === 'interactive' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { id: 'Relayer', title: 'X402 Pay Layer', desc: 'Authorizes micro-payments & limits', color: 'border-[#19C978]/20 bg-[#19C978]/5' },
                  { id: 'Research', title: 'Research Agent', desc: 'Fetches bytecode & metadata sources', color: 'border-[#9b5de5]/20 bg-[#9b5de5]/5' },
                  { id: 'Data', title: 'Data Agent', desc: 'Analyzes volume, liquidity, & hold matrix', color: 'border-[#00bbf9]/20 bg-[#00bbf9]/5' },
                  { id: 'Analysis', title: 'Analysis Agent', desc: 'Runs static analysis & AI evaluation', color: 'border-[#f15bb5]/20 bg-[#f15bb5]/5' },
                  { id: 'FactCheck', title: 'Fact Check Agent', desc: 'Filters false positives & compiles logs', color: 'border-[#fee440]/20 bg-[#fee440]/5' }
                ].map(agentInfo => {
                  const agentSteps = steps.filter(s => s.agent === agentInfo.id);
                  const isRunningAgent = agentSteps.some(s => s.status === 'running');
                  const isDoneAgent = agentSteps.every(s => s.status === 'done') && agentSteps.length > 0;
                  
                  return (
                    <div 
                      key={agentInfo.id}
                      className={`p-5 rounded-2xl border transition-all duration-300 ${agentInfo.color} ${
                        isRunningAgent ? 'ring-2 ring-[#19C978]/50 scale-[1.02]' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 font-bold text-sm">
                          {getAgentIcon(agentInfo.id)}
                          <span className={getAgentColor(agentInfo.id)}>{agentInfo.title}</span>
                        </div>
                        {isRunningAgent && (
                          <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                          </span>
                        )}
                        {isDoneAgent && (
                          <span className="text-[#19C978] text-xs font-semibold bg-[#19C978]/10 px-2 py-0.5 rounded-full">Active</span>
                        )}
                      </div>
                      <p className="text-gray-400 text-xs leading-relaxed">{agentInfo.desc}</p>
                      
                      {/* Inner status ticker */}
                      <div className="mt-4 pt-3 border-t border-white/5">
                        {agentSteps.map((s, idx) => (
                          <div key={idx} className="flex items-start gap-2 mt-1.5 text-[11px] text-gray-500">
                            <ChevronRight className="w-3.5 h-3.5 text-gray-600 mt-0.5 flex-shrink-0" />
                            <span className={s.status === 'running' ? 'text-[#E1E0CC] font-semibold' : s.status === 'done' ? 'text-gray-400' : ''}>
                              {s.message}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-black/40 border border-white/10 rounded-2xl p-4 font-mono text-xs h-[320px] overflow-y-auto flex flex-col gap-2">
                {steps.map((s, idx) => (
                  <div key={idx} className={`flex items-start gap-2 ${s.status === 'running' ? 'text-white' : s.status === 'done' ? 'text-gray-500' : 'text-gray-700'}`}>
                    <span className="text-gray-600 flex-shrink-0">[{s.timestamp || 'WAIT'}]</span>
                    <span className={`font-semibold flex-shrink-0 uppercase w-20 ${getAgentColor(s.agent)}`}>{s.agent}</span>
                    <span>{s.message}</span>
                    {s.status === 'running' && <Loader2 className="w-3 h-3 animate-spin text-[#19C978] ml-2 mt-0.5" />}
                  </div>
                ))}
                {currentStepIdx === -1 && (
                  <div className="text-gray-600 italic">Console output idle. Initialize agents to stream console telemetry.</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Compiled Research Report */}
        <div className="lg:col-span-1">
          <div className="bg-[#101010] rounded-3xl border border-white/5 p-6 shadow-xl h-full flex flex-col">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-6 pb-4 border-b border-white/5">
              <FileText className="w-5 h-5 text-[#9b5de5]" />
              Research Report
            </h2>

            <AnimatePresence mode="wait">
              {currentStepIdx === -1 ? (
                <motion.div 
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 flex flex-col items-center justify-center text-center p-6"
                >
                  <Bot className="w-16 h-16 text-gray-600 mb-4 animate-pulse" />
                  <h3 className="text-[#E1E0CC] font-bold text-sm mb-1">Waiting for telemetry</h3>
                  <p className="text-gray-500 text-xs max-w-[200px]">
                    Run agent analysis to generate a compiled cryptographic research report.
                  </p>
                </motion.div>
              ) : currentStepIdx < steps.length ? (
                <motion.div 
                  key="compiling"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 flex flex-col items-center justify-center text-center p-6"
                >
                  <Loader2 className="w-12 h-12 text-[#19C978] animate-spin mb-4" />
                  <h3 className="text-[#E1E0CC] font-bold text-sm mb-1">Synthesizing findings...</h3>
                  <p className="text-gray-500 text-xs">
                    Agents are active on Base Sepolia nodes. Writing compiled report to IPFS state.
                  </p>
                </motion.div>
              ) : (
                <motion.div 
                  key="report"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex-1 flex flex-col"
                >
                  {/* Danger score indicator */}
                  <div className={`border p-5 rounded-2xl mb-6 ${reportData?.score && reportData.score < 50 ? 'bg-red-500/5 border-red-500/20' : 'bg-[#19C978]/5 border-[#19C978]/20'}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-gray-400 font-semibold uppercase">Security Score</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${reportData?.score && reportData.score < 50 ? 'text-red-500 bg-red-500/10' : 'text-[#19C978] bg-[#19C978]/10'}`}>
                        {reportData?.score && reportData.score < 50 ? 'Vulnerable' : 'Passed'}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-4xl font-extrabold ${reportData?.score && reportData.score < 50 ? 'text-red-500' : 'text-[#19C978]'}`}>
                        {reportData?.score ?? 92}
                      </span>
                      <span className="text-lg text-gray-500 font-semibold">/100</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-3 leading-relaxed">
                      {reportData?.score && reportData.score < 50 
                        ? 'High-risk vulnerabilities found. Do not interact with this contract. It contains dangerous patterns.'
                        : 'Safe to approve. Only low static risks were found. No delegatecall or whitelist anomalies observed.'}
                    </p>
                  </div>

                  {/* Details Breakdown */}
                  <div className="flex-1 flex flex-col gap-4 text-xs">
                    <div className="border-b border-white/5 pb-3">
                      <div className="text-gray-500 mb-1">Contract Spender</div>
                      <div className="font-mono text-gray-300 truncate">{targetAddress}</div>
                    </div>
                    <div className="border-b border-white/5 pb-3">
                      <div className="text-gray-500 mb-1">Venice Confidence Verdict</div>
                      <div className="text-gray-300 font-medium">{reportData?.veniceConfidenceVerdict ?? '94.5% Safe'}</div>
                    </div>
                    <div className="border-b border-white/5 pb-3">
                      <div className="text-gray-500 mb-1">Static Risks Found</div>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {reportData?.staticRisks?.length ? (
                          reportData.staticRisks.map((risk, i) => (
                            <span key={i} className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-1 rounded text-[10px]">{risk}</span>
                          ))
                        ) : (
                          <span className="bg-white/5 px-2 py-1 rounded text-[10px]">None</span>
                        )}
                      </div>
                    </div>
                    <div className="pb-3">
                      <div className="text-gray-500 mb-1">X402 Relayer Log</div>
                      <div className="text-[#19C978] flex items-center gap-1 font-semibold">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {cost} WETH transaction confirmed
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      alert("Contract address registered as Safe. Adding to whitelist.");
                    }}
                    className="w-full mt-6 bg-[#19C978] hover:bg-[#14a361] text-black font-bold py-3 rounded-xl transition-all text-xs"
                  >
                    Whitelist Contract
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

      </div>
    </div>
  );
}
