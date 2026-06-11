import React, { useEffect, useState } from "react";
import { ShieldAlert, X } from "lucide-react";
import { motion } from "framer-motion";
import type { ProtectionEvent } from "../../types/index";

interface VetoTimerProps {
  action: ProtectionEvent;
  onVeto: (eventId: string) => Promise<void>;
  isVetoing: boolean;
}

export function VetoTimer({ action, onVeto, isVetoing }: VetoTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(60);

  useEffect(() => {
    if (!action.stagedUntil) return;
    
    const updateCountdown = () => {
      const diff = new Date(action.stagedUntil!).getTime() - Date.now();
      const left = Math.max(0, Math.floor(diff / 1000));
      setSecondsLeft(left);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [action.stagedUntil]);

  // Compute stroke offset for 60-second animated circle
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(60, secondsLeft) / 60) * circumference;

  const formatAddress = (addr: string) => `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;

  const formatValueSaved = (weiStr: string) => {
    try {
      const usdcVal = parseFloat(weiStr) / 1e6;
      if (usdcVal > 0) return `$${usdcVal.toFixed(2)} USDC`;
      const val = parseFloat(weiStr) / 1e18;
      return `${val.toFixed(4)} WETH`;
    } catch {
      return "0.00";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="relative overflow-hidden bg-gradient-to-br from-[#1c0d0d] to-[#0f0707] border border-red-500/20 p-6 rounded-2xl shadow-xl flex items-center justify-between gap-6"
    >
      {/* Background threat pulse */}
      <div className="absolute inset-0 bg-red-500/2 animate-pulse pointer-events-none" />

      <div className="flex items-center gap-4 z-10">
        <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/25 flex items-center justify-center">
          <ShieldAlert className="w-6 h-6 text-red-500 animate-bounce" />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-red-500 font-bold text-xs uppercase tracking-widest font-mono">Tier 2 Threat Staged</span>
            <span className="bg-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded-full font-mono font-medium">Veto Window Active</span>
          </div>
          <h4 className="text-[#E1E0CC] font-medium text-sm leading-none mb-2">
            Target Token: <span className="font-mono text-gray-300 font-bold">{formatAddress(action.tokenAddress)}</span>
          </h4>
          <p className="text-xs text-gray-400">
            Exposed TVL at Risk: <span className="text-[#E1E0CC] font-bold font-mono">{formatValueSaved(action.exposedValue)}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-5 z-10">
        {/* Animated 60s countdown circular indicator */}
        <div className="relative w-14 h-14 flex items-center justify-center">
          <svg className="absolute w-full h-full transform -rotate-90" viewBox="0 0 56 56">
            <circle
              cx="28"
              cy="28"
              r={radius}
              className="stroke-red-950/40 fill-transparent"
              strokeWidth="3.5"
            />
            <motion.circle
              cx="28"
              cy="28"
              r={radius}
              className="stroke-red-500 fill-transparent"
              strokeWidth="3.5"
              strokeDasharray={circumference}
              animate={{ strokeDashoffset }}
              transition={{ duration: 0.8, ease: "linear" }}
              strokeLinecap="round"
            />
          </svg>
          <span className="text-[#E1E0CC] font-bold font-mono text-sm">
            {secondsLeft}s
          </span>
        </div>

        <button
          onClick={() => onVeto(action.id)}
          disabled={isVetoing}
          className="bg-red-600 hover:bg-red-500 text-white font-mono text-xs px-4 py-2.5 rounded-xl border border-red-400/30 flex items-center gap-2 transition-all shadow-lg hover:shadow-red-500/10 active:scale-95 disabled:opacity-50"
        >
          {isVetoing ? (
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
              Vetoing...
            </span>
          ) : (
            <>
              <X className="w-3.5 h-3.5" />
              Veto Action
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}
