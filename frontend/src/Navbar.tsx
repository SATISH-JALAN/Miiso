import { Link, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useWallet } from './WalletContext';

export function Navbar() {
  const location = useLocation();
  const { walletAddress, isConnected, connectWallet, disconnectWallet } = useWallet();

  const handleWalletClick = () => {
    if (isConnected) {
      disconnectWallet();
    } else {
      connectWallet();
    }
  };

  const getAddressDisplay = () => {
    if (!walletAddress) return "";
    return `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`;
  };

  return (
    <div className="fixed top-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-7xl px-4 md:px-6 pt-6 pointer-events-none flex justify-center">
      <div className="flex items-center gap-2 pointer-events-auto">
        <Link to="/" className="bg-black rounded-full px-6 py-3 flex items-center gap-6 border border-white/10 shadow-2xl text-[#E1E0CC] font-bold text-lg tracking-tight">
          Miiso
        </Link>
        
        {/* App Links */}
        <nav className="bg-black rounded-full px-6 py-3 hidden md:flex items-center gap-6 border border-white/10 shadow-2xl">
          {[
            { path: '/dashboard', label: 'Dashboard' },
            { path: '/setup', label: 'Setup' },
            { path: '/alerts', label: 'Alerts' },
            { path: '/settings', label: 'Settings' }
          ].map(link => (
            <Link 
              key={link.path} 
              to={link.path}
              className={`text-xs md:text-sm font-medium transition-colors ${location.pathname === link.path ? "text-brand-accent" : "text-[#E1E0CC]/80 hover:text-[#E1E0CC]"}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        
        {/* Connect Wallet */}
        <button 
          onClick={handleWalletClick}
          className="group flex items-center gap-2 bg-primary text-black rounded-full pl-5 pr-2 py-2 hover:gap-3 transition-all duration-300 shadow-2xl"
        >
          <span className="font-medium text-sm">
            {isConnected ? getAddressDisplay() : 'Connect Wallet'}
          </span>
          {!isConnected && (
            <div className="bg-black rounded-full w-8 h-8 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
              <ArrowRight className="w-3 h-3 text-[#E1E0CC]" />
            </div>
          )}
        </button>
      </div>
    </div>
  );
}
