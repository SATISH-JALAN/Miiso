import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function WordsPullUp({ text, className, showAsterisk, style }: { text: string, className?: string, showAsterisk?: boolean, style?: React.CSSProperties }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-10%" });
  const words = text.split(" ");

  return (
    <span ref={ref} className={cn("inline-flex flex-wrap", className)} style={style}>
      {words.map((word, i) => {
        const isLast = i === words.length - 1;
        return (
          <span key={i} className="overflow-hidden inline-flex relative pb-[0.2em] -mb-[0.2em] -mr-[0.05em]">
            <motion.span
              initial={{ y: "100%" }}
              animate={isInView ? { y: 0 } : { y: "100%" }}
              transition={{ delay: i * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="inline-flex mr-[0.25em]"
            >
              {word}
              {isLast && showAsterisk && (
                <span className="absolute top-[0.4em] -right-[0.3em] text-[0.31em]">*</span>
              )}
            </motion.span>
          </span>
        );
      })}
    </span>
  );
}

export function WordsPullUpMultiStyle({ segments, className }: { segments: {text: string, className?: string}[], className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-10%" });
  
  // Flatten words while keeping their style
  const wordsWithStyle = segments.flatMap(seg => 
    seg.text.split(" ").map((w, idx, arr) => ({ 
      word: w + (idx < arr.length - 1 ? "" : ""), 
      className: seg.className 
    })).filter(x => x.word !== "")
  );

  return (
    <div ref={ref} className={cn("inline-flex flex-wrap justify-center", className)}>
      {wordsWithStyle.map((item, i) => (
        <span key={i} className="overflow-hidden inline-flex pb-[0.2em] -mb-[0.2em]">
          <motion.span
            initial={{ y: "100%" }}
            animate={isInView ? { y: 0 } : { y: "100%" }}
            transition={{ delay: i * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className={cn("inline-flex mr-[0.25em]", item.className)}
          >
            {item.word}
          </motion.span>
        </span>
      ))}
    </div>
  );
}

export function AnimatedLetterText({ text, className }: { text: string, className?: string }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.8", "end 0.2"]
  });

  const chars = text.split("");

  return (
    <p ref={ref} className={cn("inline-block", className)}>
      {chars.map((char, i) => {
        const start = i / chars.length;
        const end = start + 0.1;
        const opacity = useTransform(scrollYProgress, [start, end], [0.1, 1]);
        return (
          <motion.span key={i} style={{ opacity }}>
            {char}
          </motion.span>
        );
      })}
    </p>
  );
}
