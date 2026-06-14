import { WordsPullUpMultiStyle, AnimatedLetterText } from './Shared';

export function About() {
  return (
    <section className="bg-[#111111] py-24 px-4 sm:px-6 z-10 relative">
      <div className="bg-[#101010] max-w-6xl mx-auto rounded-3xl p-8 md:p-16 mb-24 flex flex-col items-center text-center">
        <span className="text-primary text-[10px] sm:text-xs tracking-widest uppercase mb-12">
          Autonomous Security
        </span>
        
        <WordsPullUpMultiStyle 
          segments={[
            { text: "Your DeFi stays ", className: "font-normal" },
            { text: "protected ", className: "italic" },
            { text: "while you sleep. Zero ETH required.", className: "font-normal" }
          ]}
          className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl max-w-4xl mx-auto leading-[0.95] sm:leading-[0.9] mb-16 text-[#E1E0CC]"
        />

        <div className="max-w-2xl mx-auto mt-8">
          <AnimatedLetterText 
            text="Over the last year, DeFi users lost billions to malicious token approvals. Miiso acts within seconds of a threat deployment, ensuring your assets remain untouched before attackers can act."
            className="text-primary text-sm sm:text-base md:text-lg leading-relaxed"
          />
        </div>
      </div>
    </section>
  );
}
