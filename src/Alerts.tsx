import { Bell, Clock, ShieldAlert, Filter } from 'lucide-react';
import { useState } from 'react';

export function Alerts() {
  const [toggles, setToggles] = useState({
    push: true,
    tier1: true,
    tier2: true,
    info: false
  });

  return (
    <div className="pt-28 pb-24 px-4 sm:px-6 max-w-5xl mx-auto min-h-screen">
      <h1 className="text-3xl text-[#E1E0CC] font-medium mb-12">Alerts & Notifications</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        {/* Section 1 - Preferences */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[#101010] p-6 rounded-2xl border border-white/5">
            <h2 className="text-[#E1E0CC] font-medium mb-6 flex items-center gap-2">
              <Bell className="w-4 h-4 text-gray-400" />
              Preferences
            </h2>
            <div className="space-y-6">
              {[
                { id: 'push', label: 'Push notifications (browser)', desc: 'Receive alerts even when tab is closed.' },
                { id: 'tier1', label: 'Tier 1 alerts', desc: 'Auto-fire >85%. Notify after action.' },
                { id: 'tier2', label: 'Tier 2 alerts', desc: '60s countdown. Notify before action.' },
                { id: 'info', label: 'Informational logs', desc: '<70% confidence. Optional feed.' }
              ].map(toggle => (
                <div key={toggle.id} className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm text-[#E1E0CC]">{toggle.label}</div>
                    <div className="text-xs text-gray-500 mt-1">{toggle.desc}</div>
                  </div>
                  <button 
                    onClick={() => setToggles((prev: typeof toggles) => ({ ...prev, [toggle.id]: !prev[toggle.id as keyof typeof toggles] }))}
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
          <div className="bg-[#101010] rounded-2xl border overflow-hidden border-orange-500/20">
            <div className="p-6 border-b border-white/5 bg-[#F59E0B]/5 flex justify-between items-center">
              <h2 className="text-[#E1E0CC] font-medium flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-[#F59E0B]" />
                Pending Actions
              </h2>
              <span className="bg-[#F59E0B]/20 text-[#F59E0B] px-2 py-1 rounded text-xs font-mono">1 ACTIVE</span>
            </div>
            <div className="p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-black p-4 rounded-xl border border-white/5">
                <div>
                  <div className="text-[#F59E0B] font-medium mb-1">Tier 2 Threat Detected: Drain Function</div>
                  <div className="text-sm text-gray-400 font-mono">Contract: 0x9a2f...1d4c &bull; Confidence: 72.1%</div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="flex items-center gap-2 text-[#EF4444] font-mono">
                    <Clock className="w-4 h-4" />
                    00:41
                  </div>
                  <button className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                    Cancel Revocation
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Alert Log */}
          <div className="bg-[#101010] rounded-2xl border border-white/5 overflow-hidden">
            <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-[#E1E0CC] font-medium">Alert Log</h2>
              <button className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
                <Filter className="w-4 h-4" /> Filter
              </button>
            </div>
            <div className="divide-y divide-white/5">
              {[
                { title: 'Reentrancy Detected', status: 'REVOKED', tier: 'Tier 1', date: '2 hrs ago', desc: 'Auto-revoked approval for YieldNest. Confidence 97.4%.' },
                { title: 'Flash Loan Attack', status: 'REVOKED', tier: 'Tier 1', date: 'Yesterday', desc: 'Auto-revoked approval for Unknown 0x4a..1f. Confidence 99.9%.' },
                { title: 'Unusual Volume', status: 'INFO', tier: 'Tier 3', date: 'Yesterday', desc: 'Logged for review. Confidence 41.0%.' },
                { title: 'Suspicious Upgradable', status: 'CANCELLED', tier: 'Tier 2', date: 'Jun 05', desc: 'Revocation cancelled by user. Confidence 78.5%.' }
              ].map((log, i) => (
                <div key={i} className="p-6 flex flex-col sm:flex-row justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                       <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-widest ${
                         log.status === 'REVOKED' ? 'bg-[#19C978]/10 text-[#19C978]' :
                         log.status === 'CANCELLED' ? 'bg-white/10 text-gray-400' :
                         'bg-blue-500/10 text-blue-400'
                       }`}>
                         {log.status}
                       </span>
                       <span className="text-xs text-gray-500 border border-white/10 px-2 py-0.5 rounded">{log.tier}</span>
                    </div>
                    <div className="text-[#E1E0CC] font-medium mb-1">{log.title}</div>
                    <div className="text-sm text-gray-400">{log.desc}</div>
                  </div>
                  <div className="text-sm text-gray-500 shrink-0 font-mono">{log.date}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
