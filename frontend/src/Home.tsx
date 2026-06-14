import { StrictMode } from 'react';
import { Hero } from './Hero';
import { About } from './About';
import { Features } from './Features';
import { HowItWorks, ProblemStats, PermissionTrust, StoryProof, ComparisonTable, FooterCTA } from './Sections';
import { Terminal } from './Terminal';

export function Home() {
  return (
    <div className="w-full">
      <Hero />
      <Terminal />
      <About />
      <Features />
      <HowItWorks />
      <ProblemStats />
      <PermissionTrust />
      <StoryProof />
      <ComparisonTable />
      <FooterCTA />
    </div>
  );
}
