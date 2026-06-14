import { StrictMode } from 'react';
import { Hero } from './Hero';
import { About } from './About';
import { Features } from './Features';
import { HowItWorks, ProblemStats, PermissionTrust, StoryProof, FooterCTA } from './Sections';


export function Home() {
  return (
    <div className="w-full">
      <Hero />

      {/* Smooth fade from dark video into content */}
      <div className="w-full h-32 md:h-48 bg-gradient-to-b from-black via-[#080808] to-[#111111]" />

      <About />
      <Features />
      <HowItWorks />
      <ProblemStats />
      <PermissionTrust />
      <StoryProof />

      <FooterCTA />
    </div>
  );
}
