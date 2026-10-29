import { motion } from "motion/react";
import { Music, VenetianMask } from "lucide-react";

import type { Category } from "@/game/categories";
import type { PlayerAssignment } from "@/game/round";
import { CARD_VARIANTS, FADE_OUT, RISE, STAGGER } from "@/lib/motion";
import { FitWord } from "@/features/round/fit-word";
import { SwipeCard } from "@/features/round/swipe-card";

const CategoryHint = ({ hint }: { hint?: string }) =>
  hint ? (
    <div className="mx-auto flex max-w-xs items-center gap-2.5 rounded-2xl bg-card px-4 py-3 text-sm font-semibold">
      <Music className="size-4 shrink-0 text-pink" aria-hidden />
      <span>{hint}</span>
    </div>
  ) : null;

// A player's card: their word, or that they're the imposter. Flick it away to pass the phone.
function RevealScreen({
  currentPlayer,
  playersCount,
  currentAssignment,
  activeCategoryInfo,
  fellowImposters,
  isDesktop,
  onSwipe,
}: {
  currentPlayer: number;
  playersCount: number;
  currentAssignment: PlayerAssignment | undefined;
  activeCategoryInfo: Category | undefined;
  fellowImposters: number[];
  isDesktop: boolean;
  onSwipe: (direction: 1 | -1) => void;
}) {
  return (
    <motion.div
      variants={STAGGER}
      initial="initial"
      animate="animate"
      exit="exit"
      className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 py-5"
    >
      <motion.div
        variants={CARD_VARIANTS}
        className="h-[min(420px,52dvh)] w-full max-w-[310px] lg:h-[min(400px,48dvh)] lg:max-w-[760px]"
      >
        <SwipeCard onSwipe={onSwipe}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-muted-foreground">
              {currentAssignment?.isImposter ? "your role" : "your word"}
            </span>
            <VenetianMask className="size-6 text-pink" aria-hidden />
          </div>
          {currentAssignment?.isImposter ? (
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="text-base font-semibold lg:text-xl">
                you are the
              </span>
              <p className="font-display text-[40px] font-extrabold leading-[1.05] tracking-[-0.03em] text-pink lg:text-8xl lg:tracking-[-0.045em]">
                imposter
              </p>
            </div>
          ) : (
            <FitWord
              word={currentAssignment?.word ?? "no word"}
              scale={isDesktop ? 2.2 : 1}
              className="text-center font-display font-extrabold leading-[1.05] tracking-[-0.03em] text-balance hyphens-none text-highlight"
            />
          )}
          <div className="flex items-center justify-between gap-3">
            <span className="truncate rounded-full bg-secondary px-3.5 py-2 text-sm font-bold lowercase">
              {activeCategoryInfo?.label}
            </span>
            <span className="shrink-0 text-[13px] text-muted-foreground">
              {currentPlayer} / {playersCount}
            </span>
          </div>
        </SwipeCard>
      </motion.div>

      {fellowImposters.length > 0 && (
        <motion.div
          variants={{ ...RISE, exit: FADE_OUT }}
          className="flex items-center gap-2 rounded-full bg-card px-4 py-2.5 text-sm font-semibold"
        >
          <span className="text-muted-foreground">
            {fellowImposters.length === 1
              ? "fellow imposter:"
              : "fellow imposters:"}
          </span>
          <span className="text-pink">
            {fellowImposters.map((number) => `player ${number}`).join(" · ")}
          </span>
        </motion.div>
      )}

      {activeCategoryInfo?.hint && (
        <motion.div variants={{ ...RISE, exit: FADE_OUT }}>
          <CategoryHint hint={activeCategoryInfo.hint} />
        </motion.div>
      )}
    </motion.div>
  );
}

export { RevealScreen };
