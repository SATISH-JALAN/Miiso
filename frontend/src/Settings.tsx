import { Settings as SettingsIcon, Shield, ListPlus, CreditCard, User, AlertOctagon, Info } from 'lucide-react';
import { useState } from 'react';
import { useWallet } from './WalletContext';
import { usePermission } from './hooks/usePermission';
import { useStore } from './store/index';

export function Settings() {
  const {
    walletAddress,
    isConnected,
    securityProfile,
    updateSecurityProfile,
    disableGuard,
    stats
  } = useWallet();

  const [budget, setBudget] = useState(5);
  const [whitelist, setWhitelist] = useState([
    '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', // Uniswap V3
    '0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9'  // Aave V3
  ]);
  const [newAddress, setNewAddress] = useState('');
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [profileUpdating, setProfileUpdating] = useState<'safe' | 'balanced' | 'manual' | null>(null);
  const [isDisablingGuard, setIsDisablingGuard] = useState(false);
  const [isRenewing, setIsRenewing] = useState(false);

  const { grantPermission } = usePermission();
  const permissionContext = useStore((s) => s.permissionContext);

  const handleDisableGuard = async () => {
    if (window.confirm("Are you sure you want to disable Miiso Protection Guard? This will revoke on-chain session authority and relayer protections.")) {
      setIsDisablingGuard(true);
      try {
        await disableGuard();
      } catch (err) {
        console.error("Failed to disable guard:", err);
      } finally {
        setIsDisablingGuard(false);
      }
    }
  };

  const handleRenew = async () => {
    setIsRenewing(true);
    try {
      await grantPermission(budget, whitelist);
      alert("Permission successfully renewed for 30 days.");
    } catch (err) {
      console.error("Failed to renew permission:", err);
      alert("Renewal failed. Check console.");
    } finally {
      setIsRenewing(false);
    }
  };

  const handleUpdateProfile = async (profile: 'safe' | 'balanced' | 'manual') => {
    setIsUpdating(true);
    setProfileUpdating(profile);
    try {
      await updateSecurityProfile(profile);
    } catch (err) {
      console.error("Failed to update strategy profile:", err);
    } finally {
      setIsUpdating(false);
      setProfileUpdating(null);
    }
  };

  const formatAddr = (addr: string) => `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  const formatBudget = (weiStr: string) => {
    try {
      const val = parseFloat(weiStr) / 1e18;
      return val.toFixed(4);
    } catch {
      return "0.00";
    }
  };

  let expiryString = "N/A";
  let isExpired = false;
  if (permissionContext) {
    try {
      const parsed = JSON.parse(permissionContext);
      if (parsed.expiry) {
        const expiryDate = new Date(typeof parsed.expiry === 'string' ? parsed.expiry : parsed.expiry * 1000);
        expiryString = expiryDate.toLocaleString();
        if (expiryDate.getTime() < Date.now()) {
          isExpired = true;
          expiryString += " (EXPIRED)";
        }
      }
    } catch (e) { /* ignore */ }
  }

  if (!isConnected) {
    return (
      <div className="pt-32 pb-24 px-4 sm:px-6 max-w-md mx-auto min-h-screen flex flex-col justify-center items-center">
        <div className="bg-[#101010] p-8 rounded-3xl border border-white/5 text-center w-full shadow-2xl">
          <Shield className="w-16 h-16 text-[#19C978] mx-auto mb-6 animate-pulse" />
          <h2 className="text-[#E1E0CC] font-bold text-2xl mb-2 tracking-tight">Connect Wallet</h2>
          <p className="text-gray-400 text-sm mb-6 leading-relaxed">
            Please connect your wallet to view or modify your auto-pilot security profile settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-28 pb-24 px-4 sm:px-6 max-w-6xl mx-auto min-h-screen">
      <h1 className="text-3xl text-[#E1E0CC] font-medium mb-12 flex items-center gap-3">
        <SettingsIcon className="w-8 h-8 opacity-50" />
        Settings
      </h1>

      <div className="space-y-8">
        
        {/* Security Profiles Configuration Card */}
        <div className="bg-[#101010] p-6 rounded-2xl border border-white/5">
          <h2 className="text-[#E1E0CC] font-medium mb-2 flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#19C978]" />
            Auto-Pilot Strategy Profiles
          </h2>
          <p className="text-xs text-gray-500 mb-6">Select how aggressively Miiso Sentinel will secure your active token permissions when threats are identified.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                id: "safe" as const,
                title: "Ultra-Safe",
                desc: "Instant revocation at ≥ 40% threat confidence. Skip veto buffer completely for maximum asset security.",
                badge: "Highly Aggressive",
                badgeColor: "bg-red-500/10 text-[#EF4444] border-red-500/20"
              },
              {
                id: "balanced" as const,
                title: "Balanced",
                desc: "Auto-revokes critical Tier 1 threats instantly. Holds moderate Tier 2 threats in a 60-second veto buffer.",
                badge: "Recommended",
                badgeColor: "bg-[#19C978]/10 text-[#19C978] border-[#19C978]/20"
              },
              {
                id: "manual" as const,
                title: "Manual Alert",
                desc: "Bypasses automatic smart contract revocations. Dispatches real-time security alerts for manual action.",
                badge: "Alerts Only",
                badgeColor: "bg-gray-500/10 text-gray-400 border-white/5"
              }
            ].map((prof) => {
              const isActive = securityProfile === prof.id;
              const isPending = profileUpdating === prof.id;
              
              return (
                <button
                  key={prof.id}
                  onClick={() => handleUpdateProfile(prof.id)}
                  disabled={isUpdating}
                  className={`p-5 rounded-xl border text-left flex flex-col justify-between transition-all duration-300 min-h-40 ${
                    isActive 
                      ? 'bg-[#19C978]/5 border-[#19C978] shadow-[0_0_15px_rgba(25,201,120,0.15)]' 
                      : 'bg-black/40 border-white/5 hover:border-white/20'
                  } disabled:opacity-50`}
                >
                  <div className="w-full">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-sm font-bold text-[#E1E0CC]">{prof.title}</span>
                      <span className={`text-[9px] px-2 py-0.5 border rounded-full font-semibold font-sans uppercase tracking-wider ${prof.badgeColor}`}>
                        {prof.badge}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">{prof.desc}</p>
                  </div>
                  {isPending && (
                    <div className="mt-4 flex items-center gap-2 text-[10px] text-gray-500">
                      <div className="w-3 h-3 border-2 border-t-transparent border-[#19C978] rounded-full animate-spin" />
                      Saving...
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Account Details */}
          <div className="lg:col-span-5 space-y-8">
            <div className="bg-[#101010] p-6 rounded-2xl border border-white/5">
              <h2 className="text-[#E1E0CC] font-medium mb-6 flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                Account Details
              </h2>
              <div className="space-y-4 font-mono text-sm">
                <div>
                  <label className="block text-xs text-gray-500 mb-1 font-sans uppercase tracking-widest">Connected EOA Address</label>
                  <div className="bg-black p-3 rounded-lg border border-white/5 text-[#E1E0CC] truncate">{walletAddress}</div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1 font-sans uppercase tracking-widest">Miiso Smart Account (ERC-7715)</label>
                  <div className="bg-black p-3 rounded-lg border border-white/5 text-[#E1E0CC] truncate">0x6ED09F73cfe78555F950D3a325Aa38471fDF667d</div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1 font-sans uppercase tracking-widest">Linked Alert Endpoint (Telegram)</label>
                  <div className="bg-black p-3 rounded-lg border border-white/5 text-[#E1E0CC]">@miiso_security_bot</div>
                </div>
              </div>
            </div>
            
            <div className="bg-[#101010] p-6 rounded-2xl border border-white/5">
              <h2 className="text-[#E1E0CC] font-medium mb-6 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-gray-400" />
                Monthly Protection Budget
              </h2>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-sm text-gray-400">Gas Buffer Limit</span>
                    <span className="text-[#E1E0CC] font-mono">{budget} WETH</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" max="10" step="1" 
                    value={budget} 
                    onChange={(e) => setBudget(Number(e.target.value))}
                    aria-label="Gas buffer limit slider"
                    className="w-full accent-[#19C978]" 
                  />
                  <div className="flex justify-between text-xs text-gray-600 mt-2 font-mono">
                    <span>1 WETH</span>
                    <span>10 WETH</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">Adjust your maximum WETH buffer limit for gas-less 1Shot transaction relayers. Limits transaction loops.</p>
              </div>
            </div>
          </div>

          {/* Permissions & Whitelist */}
          <div className="lg:col-span-7 space-y-8">
            <div className="bg-[#101010] p-6 rounded-2xl border border-orange-500/10">
              <h2 className="text-[#E1E0CC] font-medium mb-6 flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#F59E0B]" />
                Active Relayer Delegations
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
                <div className="bg-black p-4 rounded-xl border border-white/5">
                  <div className="text-xs text-gray-500 mb-1">Relayer Status</div>
                  <div className={`font-medium text-sm flex items-center gap-2 ${isExpired ? "text-[#EF4444]" : "text-[#19C978]"}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${isExpired ? "bg-[#EF4444]" : "bg-[#19C978] animate-pulse"}`}/> 
                    {isExpired ? "EXPIRED" : "CONNECTED"}
                  </div>
                </div>
                <div className="bg-black p-4 rounded-xl border border-white/5">
                  <div className="text-xs text-gray-500 mb-1">Active Rules</div>
                  <div className="text-[#E1E0CC] font-medium text-sm">ERC-20 Revoke</div>
                </div>
                <div className="bg-black p-4 rounded-xl border border-white/5">
                  <div className="text-xs text-gray-500 mb-1">Budget Spent</div>
                  <div className="text-[#E1E0CC] font-medium text-sm">
                    {formatBudget(stats?.budgetSpent || "0")} USDC
                  </div>
                </div>
                <div className="bg-black p-4 rounded-xl border border-white/5">
                  <div className="text-xs text-gray-500 mb-1">Expires</div>
                  <div className={`font-medium text-sm text-[#E1E0CC]`}>
                    {expiryString}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                 <button 
                   onClick={handleRenew} 
                   disabled={isRenewing}
                   className="flex-1 bg-white/5 hover:bg-white/10 text-[#E1E0CC] px-4 py-3 rounded-xl text-sm transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                 >
                   {isRenewing ? (
                     <>
                       <div className="w-4 h-4 border-2 border-t-transparent border-[#E1E0CC] rounded-full animate-spin" />
                       Renewing...
                     </>
                   ) : "Renew EIP-7715 Session"}
                 </button>
                 <button className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 px-4 py-3 rounded-xl text-sm transition-colors font-medium flex items-center justify-center gap-2" onClick={handleDisableGuard} disabled={isDisablingGuard}>
                   {isDisablingGuard ? (
                     <>
                       <div className="w-4 h-4 border-2 border-t-transparent border-red-500 rounded-full animate-spin" />
                       Disabling...
                     </>
                   ) : (
                     <>
                       <AlertOctagon className="w-4 h-4" />
                   Disable Guard
                     </>
                   )}
                 </button>
              </div>
            </div>

            <div className="bg-[#101010] p-6 rounded-2xl border border-white/5">
              <h2 className="text-[#E1E0CC] font-medium mb-2 flex items-center gap-2">
                <ListPlus className="w-4 h-4 text-gray-400" />
                Trusted Smart Contracts
              </h2>
              <p className="text-xs text-gray-500 mb-6">Specify protocol spender contracts that Miiso Sentinel will ignore. Useful for personal multisigs and locked vaults.</p>
              
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
                  className="bg-[#19C978] text-black px-4 rounded-lg text-sm font-semibold hover:bg-[#14a361] transition-colors"
                >
                  Add
                </button>
              </div>

              <div className="space-y-2">
                {whitelist.map((address, i) => (
                  <div key={i} className="flex justify-between items-center bg-black p-3 rounded-lg border border-white/5 group">
                    <span className="font-mono text-xs text-[#E1E0CC]">{address}</span>
                    <button 
                      onClick={() => setWhitelist(whitelist.filter((_, idx) => idx !== i))}
                      className="text-gray-600 hover:text-red-500 transition-colors text-xs px-2"
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
    </div>
  );
}
