import { StrictMode } from 'react';
import { Hero } from './Hero';
import { About } from './About';
import { Features } from './Features';
import { HowItWorks, ProblemStats, PermissionTrust, StoryProof, FooterCTA } from './Sections';


export function Home() {
  return (
    <div className="w-full">
      <Hero />

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
