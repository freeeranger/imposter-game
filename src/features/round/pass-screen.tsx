import { motion } from "motion/react";
import { VenetianMask } from "lucide-react";

import type { Category } from "@/game/categories";
import { CARD_VARIANTS, PASS_VARIANTS, PLAYER_POP, RISE } from "@/lib/motion";

// Between players: who gets the phone next.
function PassScreen({
  currentPlayer,
  playersCount,
  activeCategoryInfo,
  isDesktop,
}: {
  currentPlayer: number;
  playersCount: number;
  activeCategoryInfo: Category | undefined;
  isDesktop: boolean;
}) {
  return (
    <motion.div
      variants={PASS_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
      className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 text-center"
    >
      <motion.span
        variants={RISE}
        className="text-base font-semibold text-muted-foreground lg:text-xl"
      >
        {isDesktop ? "pass the screen to" : "pass the phone to"}
      </motion.span>
      {isDesktop ? (
        // Desktop: the face-down card, landscape, with the player's name on its back.
        <motion.div
          variants={CARD_VARIANTS}
          className="mt-6 flex h-[min(400px,48dvh)] w-full max-w-[760px] flex-col justify-between rounded-[32px] bg-card p-8 text-left shadow-[12px_12px_0_var(--pink)]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-semibold text-muted-foreground">
              face down
            </span>
            <VenetianMask className="size-7 text-pink" aria-hidden />
          </div>
          <p className="text-center font-display text-[104px] leading-none font-extrabold tracking-[-0.045em] text-highlight">
            player {currentPlayer}
          </p>
          <div className="flex items-center justify-between gap-3">
            <span className="truncate rounded-full bg-secondary px-3.5 py-2 text-sm font-bold lowercase">
              {activeCategoryInfo?.label}
            </span>
            <span className="shrink-0 text-sm text-muted-foreground">
              {currentPlayer} / {playersCount}
            </span>
          </div>
        </motion.div>
      ) : (
        <>
          <motion.p
            variants={PLAYER_POP}
            className="font-display text-6xl font-extrabold tracking-[-0.03em] text-highlight"
          >
            player {currentPlayer}
          </motion.p>
          <motion.p
            variants={RISE}
            className="max-w-[16rem] text-sm text-muted-foreground"
          >
            make sure nobody else is peeking.
          </motion.p>
        </>
      )}
    </motion.div>
  );
}

export { PassScreen };
