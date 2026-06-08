import { Settings as SettingsIcon, Shield, ListPlus, CreditCard, User, AlertOctagon } from 'lucide-react';
import { useState } from 'react';

export function Settings() {
  const [budget, setBudget] = useState(5);
  const [whitelist, setWhitelist] = useState([
    '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', // Uniswap V3
    '0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9'  // Aave V3
  ]);
  const [newAddress, setNewAddress] = useState('');

  return (
    <div className="pt-28 pb-24 px-4 sm:px-6 max-w-5xl mx-auto min-h-screen">
      <h1 className="text-3xl text-[#E1E0CC] font-medium mb-12 flex items-center gap-3">
        <SettingsIcon className="w-8 h-8 opacity-50" />
        Settings
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Account Details */}
        <div className="lg:col-span-5 space-y-8">
          <div className="bg-[#101010] p-6 rounded-2xl border border-white/5">
            <h2 className="text-[#E1E0CC] font-medium mb-6 flex items-center gap-2">
              <User className="w-4 h-4 text-gray-400" />
              Account
            </h2>
            <div className="space-y-4 font-mono text-sm">
              <div>
                <label className="block text-xs text-gray-500 mb-1 font-sans uppercase tracking-widest">Connected Wallet Address</label>
                <div className="bg-black p-3 rounded-lg border border-white/5 text-[#E1E0CC]">0x4a1f3c...9c2d8b</div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1 font-sans uppercase tracking-widest">Smart Account Address</label>
                <div className="bg-black p-3 rounded-lg border border-white/5 text-[#E1E0CC]">0x8b2e1a...4f5c9a</div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1 font-sans uppercase tracking-widest">Linked Email (Optional)</label>
                <input type="email" placeholder="Enter email for alerts" className="w-full bg-black p-3 rounded-lg border border-white/5 text-[#E1E0CC] placeholder-gray-600 focus:outline-none focus:border-[#19C978]/50 transition-colors" />
              </div>
            </div>
          </div>
          
          <div className="bg-[#101010] p-6 rounded-2xl border border-white/5">
            <h2 className="text-[#E1E0CC] font-medium mb-6 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-gray-400" />
              Monthly Budget
            </h2>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm text-gray-400">Scanning Budget Cap</span>
                  <span className="text-[#E1E0CC] font-mono">{budget} USDC</span>
                </div>
                <input 
                  type="range" 
                  min="2" max="20" step="1" 
                  value={budget} 
                  onChange={(e) => setBudget(Number(e.target.value))}
                  aria-label="Scanning budget cap"
                  className="w-full accent-[#19C978]" 
                />
                <div className="flex justify-between text-xs text-gray-600 mt-2 font-mono">
                  <span>2 USDC</span>
                  <span>20 USDC</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">Adjust your monthly USDC limit for 1Shot network gas fees. Any unused budget rolls over.</p>
            </div>
          </div>
        </div>

        {/* Permissions & Whitelist */}
        <div className="lg:col-span-7 space-y-8">
          <div className="bg-[#101010] p-6 rounded-2xl border border-orange-500/10">
            <h2 className="text-[#E1E0CC] font-medium mb-6 flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#F59E0B]" />
              Permission Management
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-black p-4 rounded-xl border border-white/5">
                <div className="text-xs text-gray-500 mb-1">Status</div>
                <div className="text-[#19C978] font-medium text-sm flex items-center gap-2"><div className="w-1.5 h-1.5 bg-[#19C978] rounded-full animate-pulse"/> ACTIVE</div>
              </div>
              <div className="bg-black p-4 rounded-xl border border-white/5">
                <div className="text-xs text-gray-500 mb-1">Expiry Date</div>
                <div className="text-[#E1E0CC] font-medium text-sm">Jul 08, 2026</div>
              </div>
              <div className="bg-black p-4 rounded-xl border border-white/5">
                <div className="text-xs text-gray-500 mb-1">Budget Left</div>
                <div className="text-[#E1E0CC] font-medium text-sm">4.989 USDC</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
               <button className="flex-1 bg-white/5 hover:bg-white/10 text-[#E1E0CC] px-4 py-3 rounded-xl text-sm transition-colors font-medium">
                 Renew Permission
               </button>
               <button className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 px-4 py-3 rounded-xl text-sm transition-colors font-medium flex items-center justify-center gap-2">
                 <AlertOctagon className="w-4 h-4" />
                 Revoke All Permissions
               </button>
            </div>
          </div>

          <div className="bg-[#101010] p-6 rounded-2xl border border-white/5">
            <h2 className="text-[#E1E0CC] font-medium mb-2 flex items-center gap-2">
              <ListPlus className="w-4 h-4 text-gray-400" />
              Protocol Whitelist
            </h2>
            <p className="text-xs text-gray-500 mb-6">Trusted protocol addresses that Miiso won't revoke. Use this for your own contracts or highly trusted multisigs.</p>
            
            <div className="flex gap-2 mb-6">
              <input 
                type="text" 
                placeholder="Paste contract address (0x...)" 
                value={newAddress}
                onChange={e => setNewAddress(e.target.value)}
                className="flex-1 bg-black p-3 rounded-lg border border-white/5 text-[#E1E0CC] font-mono text-sm placeholder-gray-600 focus:outline-none focus:border-[#19C978]/50 transition-colors" 
              />
              <button 
                onClick={() => {
                  if (newAddress.length > 10) {
                     setWhitelist([...whitelist, newAddress]);
                     setNewAddress('');
                  }
                }}
                className="bg-primary text-black px-4 rounded-lg text-sm font-medium hover:bg-white transition-colors"
              >
                Add
              </button>
            </div>

            <div className="space-y-2">
              {whitelist.map((address, i) => (
                <div key={i} className="flex justify-between items-center bg-black p-3 rounded-lg border border-white/5 group">
                  <span className="font-mono text-sm text-[#E1E0CC]">{address}</span>
                  <button 
                    onClick={() => setWhitelist(whitelist.filter((_, idx) => idx !== i))}
                    className="text-gray-600 hover:text-red-500 transition-colors text-sm px-2"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {whitelist.length === 0 && (
                <div className="text-center py-6 text-gray-500 text-sm">No whitelisted addresses.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
