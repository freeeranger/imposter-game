import { Fragment, useLayoutEffect, useRef } from "react";

import { cn } from "@/lib/utils";

const wordStartSize = (word: string) => {
  if (word.length > 22) return 26;
  if (word.length > 14) return 32;
  return 42;
};
const MIN_WORD_SIZE = 14;

// Lines only break between words; a single word too wide for the card shrinks to fit instead.
const FitWord = ({
  word,
  scale = 1,
  className,
}: {
  word: string;
  // Multiplies the starting size, for the larger desktop card.
  scale?: number;
  className?: string;
}) => {
  const ref = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const parts = el.querySelectorAll("span");
      let size = Math.round(wordStartSize(word) * scale);
      parts.forEach((part) => (part.style.whiteSpace = "nowrap"));
      el.style.fontSize = `${size}px`;
      while (el.scrollWidth > el.clientWidth && size > MIN_WORD_SIZE) {
        size -= 1;
        el.style.fontSize = `${size}px`;
      }
      // Last resort for absurdly long words: break them rather than spill off the card.
      if (el.scrollWidth > el.clientWidth) {
        parts.forEach((part) => (part.style.whiteSpace = "normal"));
      }
    };
    fit();
    // The display font may still be loading, and it is much wider than the fallback.
    void document.fonts.ready.then(fit);
    const observer = new ResizeObserver(fit);
    if (el.parentElement) observer.observe(el.parentElement);
    return () => observer.disconnect();
  }, [word, scale]);
  return (
    <p ref={ref} className={cn("[overflow-wrap:anywhere]", className)}>
      {/* nowrap per word keeps "Counter-Strike" from splitting at its hyphen */}
      {word.split(" ").map((part, index) => (
        <Fragment key={index}>
          {index > 0 && " "}
          <span>{part}</span>
        </Fragment>
      ))}
    </p>
  );
};

export { FitWord };
