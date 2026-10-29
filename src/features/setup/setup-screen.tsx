import type { ReactNode } from "react";
import { motion } from "motion/react";

import { FADE_OUT, RISE, STAGGER } from "@/lib/motion";
import { CategoryCard } from "@/features/setup/category-card";
import { DifficultyPicker } from "@/features/setup/difficulty-picker";
import { PlayerCounts } from "@/features/setup/player-counts";
import { RoundOptions } from "@/features/setup/round-options";
import type { GameSetup } from "@/features/setup/use-game-setup";
import type { NumberPickerKind } from "@/features/setup/number-picker-sheet";
import { UpdateNotice } from "@/features/updates/update-notice";
import type { AppUpdate } from "@/features/updates/use-app-update";

// The home screen: set up the next round.
function SetupScreen({
  setup,
  update,
  isDesktop,
  primaryButton,
  startHint,
  onOpenCategories,
  onPickNumber,
}: {
  setup: GameSetup;
  update: AppUpdate;
  isDesktop: boolean;
  // On desktop the play button sits in the hero here; on phones it's docked below.
  primaryButton: ReactNode;
  startHint: ReactNode;
  onOpenCategories: () => void;
  onPickNumber: (kind: NumberPickerKind) => void;
}) {
  return (
    <motion.div
      variants={STAGGER}
      initial="initial"
      animate="animate"
      exit={FADE_OUT}
      className="-mx-5 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-5 pt-5 pb-2 lg:-mx-12 lg:flex-row lg:items-center-safe lg:gap-20 lg:px-12 lg:py-6"
    >
      {/* Desktop: a hero with the wordmark and play button, settings beside it. */}
      {isDesktop && (
        <motion.div
          variants={RISE}
          className="@container flex min-w-0 flex-1 flex-col items-start gap-8"
        >
          {/* Sized to the column (the word is ~5.6em wide) so it never runs into the settings. */}
          <h1 className="-rotate-2 font-display text-[min(8rem,17cqi)] leading-[0.95] font-extrabold tracking-[-0.045em] [text-shadow:6px_6px_0_var(--pink)]">
            imposter
          </h1>
          <p className="max-w-md text-lg leading-relaxed text-muted-foreground">
            everyone gets the secret word, except the imposter. pass the screen
            around, then talk it out and find them.
          </p>
          <div className="flex w-full max-w-sm flex-col">
            {primaryButton}
            {startHint}
          </div>
        </motion.div>
      )}

      <div className="contents lg:flex lg:w-[26rem] lg:shrink-0 lg:flex-col lg:gap-5">
        <UpdateNotice update={update} />
        <PlayerCounts setup={setup} onPickNumber={onPickNumber} />
        <CategoryCard setup={setup} onOpen={onOpenCategories} />
        <DifficultyPicker setup={setup} />
        <RoundOptions setup={setup} onPickNumber={onPickNumber} />
      </div>
    </motion.div>
  );
}

export { SetupScreen };
