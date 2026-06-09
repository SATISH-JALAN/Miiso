import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Home } from './Home';
import { Dashboard } from './Dashboard';
import { Setup } from './Setup';
import { Alerts } from './Alerts';
import { Settings } from './Settings';

export default function App() {
  return (
    <BrowserRouter>
      <div className="font-sans antialiased text-[#E1E0CC] bg-black min-h-screen">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
