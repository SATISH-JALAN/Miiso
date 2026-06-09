export function Marquee() {
  const cards = [
    {
      quote:
        "Woke up to see a malicious token I interacted with had 100% of its approvals wiped. Literally saved my entire portfolio.",
      name: "0x1a3c...f9e2",
      amount: "$12,000",
    },
    {
      quote:
        "The fact that it runs on Base 24/7 without me needing to sign anything to act during an exploit is exactly what DeFi needs.",
      name: "0x8f2a...b14c",
      amount: "$45,500",
    },
    {
      quote:
        "I used to check Revoke.cash every day paranoid. Now Miiso just runs in the background. Peak peace of mind.",
      name: "0x4c99...e271",
      amount: "$8,200",
    },
    {
      quote:
        "Didn't realize I interacted with a drainer until Miiso's discord bot pinged me that my approval was revoked.",
      name: "0x77d1...aa40",
      amount: "$104,000",
    },
    {
      quote:
        "Zero ETH for gas, 1Shot handles everything seamlessly. The UX is invisible, the protection is undeniable.",
      name: "0x22bb...88cc",
      amount: "$3,400",
    },
    {
      quote:
        "Venice AI parsing the bytecode and catching a hidden reentrancy before anyone lost funds is the future of security.",
      name: "0x911f...ddee",
      amount: "$21,000",
    },
  ];

  // We need enough cards to fill the screen twice for a smooth infinite marquee.
  // Standard practice is to concat the array to itself.
  const row1Content = [...cards, ...cards];

  // Row 2 can be the same cards but reversed, or slightly off-set
  const reversedCards = [...cards].reverse();
  const row2Content = [...reversedCards, ...reversedCards];

  return (
    <section className="py-24 bg-brand-bg relative z-10 overflow-hidden border-t border-brand-border">
      {/* Row 1: Left moving */}
      <div className="flex w-[200%] animate-marquee-left pause-on-hover mb-6">
        {row1Content.map((card, i) => (
          <div
            key={`r1-${i}`}
            className="w-75 shrink-0 mx-3 p-5 px-6 bg-[#0F0F0F] border border-brand-border rounded-xl flex flex-col justify-between min-h-40"
          >
            <p className="text-[14px] leading-relaxed text-[#A1A1AA] mb-4">
              "{card.quote}"
            </p>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[12px] text-[#71717A]">
                {card.name}
              </span>
              <span className="font-mono text-[10px] font-bold tracking-wider text-[#10B981] bg-[#10B981]/10 px-2 py-1 rounded-full uppercase">
                Protected {card.amount}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Row 2: Right moving */}
      <div className="flex w-[200%] animate-marquee-right pause-on-hover ml-[-100%]">
        {row2Content.map((card, i) => (
          <div
            key={`r2-${i}`}
            className="w-75 shrink-0 mx-3 p-5 px-6 bg-[#0F0F0F] border border-brand-border rounded-xl flex flex-col justify-between min-h-40"
          >
            <p className="text-[14px] leading-relaxed text-[#A1A1AA] mb-4">
              "{card.quote}"
            </p>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[12px] text-[#71717A]">
                {card.name}
              </span>
              <span className="font-mono text-[10px] font-bold tracking-wider text-[#10B981] bg-[#10B981]/10 px-2 py-1 rounded-full uppercase">
                Saved {card.amount}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
