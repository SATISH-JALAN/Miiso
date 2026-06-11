import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Home } from './Home';
import { Dashboard } from './Dashboard';
import { Setup } from './Setup';
import { Alerts } from './Alerts';
import { Settings } from './Settings';
import { Research } from './Research';
import { WalletProvider } from './WalletContext';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from './lib/wagmiConfig';

const queryClient = new QueryClient();

export default function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <WalletProvider>
          <BrowserRouter>
            <div className="font-sans antialiased text-[#E1E0CC] bg-black min-h-screen">
              <Navbar />
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/research" element={<Research />} />
                <Route path="/setup" element={<Setup />} />
                <Route path="/alerts" element={<Alerts />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </div>
          </BrowserRouter>
        </WalletProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
