import { motion } from "motion/react";
import { Shuffle, VenetianMask } from "lucide-react";

import { DROP_CARD, FADE_OUT, POP, RISE, STAGGER } from "@/lib/motion";

// Everyone has seen their card: time to talk, starting with the first speaker if one was drawn.
function EndScreen({
  startingPlayer,
  isDesktop,
}: {
  startingPlayer: number | null;
  isDesktop: boolean;
}) {
  return (
    <motion.div
      variants={STAGGER}
      initial="initial"
      animate="animate"
      exit={FADE_OUT}
      className="flex min-h-0 flex-1 flex-col items-center justify-center gap-7 text-center"
    >
      {isDesktop ? (
        // Desktop: the headline, then the first speaker on a wide card.
        <>
          <motion.h2
            variants={RISE}
            className="-rotate-2 font-display text-[112px] leading-[0.95] font-extrabold tracking-[-0.045em] [text-shadow:6px_6px_0_var(--pink)]"
          >
            all clear
          </motion.h2>
          {startingPlayer && (
            <motion.div
              variants={DROP_CARD}
              className="mt-7 flex w-full max-w-[760px] items-center justify-between gap-6 rounded-[32px] bg-card p-8 text-left shadow-[12px_12px_0_var(--pink)]"
            >
              <div className="flex flex-col gap-2.5">
                <span className="flex items-center gap-2 text-base font-semibold text-muted-foreground">
                  <Shuffle className="size-[18px] text-pink" aria-hidden />
                  first to speak
                </span>
                <p className="font-display text-7xl leading-none font-extrabold tracking-[-0.04em] text-highlight">
                  player {startingPlayer}
                </p>
              </div>
              <span className="flex size-30 shrink-0 items-center justify-center rounded-full bg-secondary">
                <VenetianMask className="size-15 text-pink" aria-hidden />
              </span>
            </motion.div>
          )}
        </>
      ) : (
        <>
          <motion.span
            variants={POP}
            className="flex size-16 items-center justify-center rounded-full bg-card"
          >
            <VenetianMask className="size-8 text-pink" aria-hidden />
          </motion.span>
          <motion.div variants={RISE} className="flex flex-col gap-2">
            <h2 className="font-display text-4xl font-extrabold tracking-[-0.03em]">
              all clear
            </h2>
            <p className="mx-auto max-w-xs text-[15px] text-muted-foreground">
              everyone has seen their card. put the phone down and start
              talking.
            </p>
          </motion.div>
          {startingPlayer && (
            <motion.div
              variants={DROP_CARD}
              className="w-full max-w-xs rounded-[28px] bg-card p-5 shadow-[8px_8px_0_var(--pink)]"
            >
              <span className="flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground">
                <Shuffle className="size-4 text-pink" aria-hidden />
                first to speak
              </span>
              <p className="mt-2 font-display text-4xl font-extrabold tracking-[-0.03em] text-highlight">
                player {startingPlayer}
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                gives the first clue.
              </p>
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  );
}

export { EndScreen };
