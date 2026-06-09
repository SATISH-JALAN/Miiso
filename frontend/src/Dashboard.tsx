import { Shield, AlertTriangle, CheckCircle, Activity, ArrowRight, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

export function Dashboard() {
  return (
    <div className="pt-28 pb-24 px-4 sm:px-6 max-w-7xl mx-auto min-h-screen">
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-[#101010] p-4 rounded-2xl border border-white/5 mb-8 gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-[#19C978]/10 text-[#19C978] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-2">
            <div className="w-2 h-2 bg-[#19C978] rounded-full animate-pulse" />
            PROTECTION ACTIVE
          </div>
          <span className="text-[#E1E0CC] font-mono text-sm">0x4a1f...9c2d</span>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="flex flex-col items-end">
            <span className="text-gray-500 text-xs">USDC Budget Remaining</span>
            <span className="text-[#19C978] font-mono">4.989 / 5.00</span>
          </div>
        </div>
      </div>

      {/* Zone 1 - Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Assets Protected", value: "$42,500" },
          { label: "Active Approvals", value: "14" },
          { label: "Threats Detected", value: "8" },
          { label: "Value Saved", value: "$12,400" }
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
            {[
              { type: 'Reentrancy', score: '97.4%', status: 'REVOKED', address: '0x3f1a...8e2b', time: 'Just now', color: 'text-[#19C978]' },
              { type: 'Drain Function', score: '72.1%', status: 'PENDING', address: '0x9a2f...1d4c', time: '2m ago', color: 'text-[#F59E0B]' },
              { type: 'Missing Guard', score: '41.0%', status: 'MONITORING', address: '0x7e4b...5a1f', time: '14m ago', color: 'text-gray-500' },
              { type: 'Clean', score: '0.0%', status: 'MONITORING', address: '0x2d1a...9c3e', time: '1h ago', color: 'text-gray-500' },
              { type: 'Reentrancy', score: '99.9%', status: 'REVOKED', address: '0xbb21...7f8c', time: 'Yesterday', color: 'text-[#19C978]' }
            ].map((log, i) => (
              <div key={i} className="bg-[#0B0B0C] p-3 rounded-lg border border-white/5 flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <span className="text-gray-400 hover:text-white cursor-pointer transition-colors underline decoration-white/20">{log.address}</span>
                  <span className="text-gray-500">{log.time}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`${log.color}`}>{log.type}</span>
                  <span className="bg-white/5 px-2 py-0.5 rounded text-gray-300">Score: {log.score}</span>
                </div>
                <div className="mt-1">
                  <span className={`px-2 py-0.5 inline-block rounded font-bold tracking-widest uppercase text-[10px] ${log.status === 'REVOKED' ? 'bg-[#19C978]/10 text-[#19C978]' : log.status === 'PENDING' ? 'bg-[#F59E0B]/10 text-[#F59E0B]' : 'bg-white/5 text-gray-500'}`}>
                    {log.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-8">
          {/* Zone 3 - Token Approvals */}
          <div className="bg-[#101010] rounded-2xl border border-white/5 overflow-hidden">
            <div className="p-6 border-b border-white/5 bg-[#0B0B0C]">
              <h2 className="text-[#E1E0CC] font-medium text-lg">Active Token Approvals</h2>
            </div>
            <div className="overflow-x-auto">
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
                  {[
                    { token: 'USDC', spender: 'Uniswap V3', amount: 'Unlimited', risk: 'Low', color: 'text-[#19C978]' },
                    { token: 'WETH', spender: 'Aave V3', amount: 'Unlimited', risk: 'Low', color: 'text-[#19C978]' },
                    { token: 'PENDLE', spender: 'Unknown 0x4a..1f', amount: '100,000', risk: 'High', color: 'text-[#EF4444]' },
                    { token: 'USDT', spender: 'YieldNest', amount: 'Unlimited', risk: 'Medium', color: 'text-[#F59E0B]' }
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/2 transition-colors h-16">
                      <td className="px-6 font-medium text-[#E1E0CC]">{row.token}</td>
                      <td className="px-6">{row.spender}</td>
                      <td className="px-6 font-mono text-xs">{row.amount}</td>
                      <td className={`px-6 ${row.color}`}>{row.risk}</td>
                      <td className="px-6">
                        <button className="text-xs border border-white/10 hover:border-white/30 text-gray-400 hover:text-white px-3 py-1.5 rounded transition-all">
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Zone 4 - Protection History */}
          <div className="bg-[#101010] rounded-2xl border border-white/5 overflow-hidden">
            <div className="p-6 border-b border-white/5 bg-[#0B0B0C]">
              <h2 className="text-[#E1E0CC] font-medium text-lg">Protection History</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-white/5 text-gray-500 h-12">
                    <th className="px-6 font-normal">Date/Time</th>
                    <th className="px-6 font-normal">Threat</th>
                    <th className="px-6 font-normal">Value At Risk</th>
                    <th className="px-6 font-normal">Fee</th>
                    <th className="px-6 font-normal">Tx Hash</th>
                  </tr>
                </thead>
                <tbody className="text-primary">
                  {[
                    { date: '2026-06-07 03:17', threat: 'YieldNest Reentrancy', value: '$7,000', fee: '$0.0110', tx: '0x9f2c...a13d' },
                    { date: '2026-05-14 14:22', threat: 'Phishing Router', value: '$5,400', fee: '$0.0095', tx: '0x1a4b...9e8f' }
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/2 transition-colors h-16">
                      <td className="px-6 text-gray-400">{row.date}</td>
                      <td className="px-6 text-[#EF4444]">{row.threat}</td>
                      <td className="px-6 text-[#19C978]">{row.value}</td>
                      <td className="px-6 font-mono text-xs">{row.fee}</td>
                      <td className="px-6">
                        <a href="#" className="font-mono text-xs text-[#E1E0CC] hover:underline decoration-[#E1E0CC]/50">{row.tx} ↗</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
