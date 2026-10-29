import { AnimatePresence, motion } from "motion/react";

import { Button } from "@/components/ui/button";
import { SPRING } from "@/lib/motion";
import type { PrimaryAction } from "@/app/use-primary-action";
import type { Round } from "@/features/round/use-round";
import type { GameSetup } from "@/features/setup/use-game-setup";

// The big button at the bottom; on desktop's home screen it sits in the hero instead.
function PrimaryButton({ primary }: { primary: PrimaryAction }) {
  const {
    primaryLabel,
    PrimaryIcon,
    primaryIconAtEnd,
    primaryDisabled,
    primaryAction,
    primaryKey,
  } = primary;
  return (
    <Button
      onClick={primaryAction}
      size="lg"
      // Below 360px "hide & pass to player 20" needs smaller type to fit.
      className="relative w-full overflow-hidden max-[359px]:px-4 max-[359px]:text-[15px]"
      disabled={primaryDisabled}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={primaryLabel}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -18 }}
          transition={SPRING}
          className="flex items-center gap-2"
        >
          {!primaryIconAtEnd && (
            <PrimaryIcon className="size-5 stroke-[2.4] max-[359px]:hidden" />
          )}
          {primaryLabel}
          {primaryIconAtEnd && (
            <PrimaryIcon className="size-[22px] stroke-[2.6]" />
          )}
          {primaryKey && (
            <kbd className="ml-1.5 rounded-lg bg-primary-foreground/15 px-2 py-1 font-sans text-[13px] font-bold tracking-normal">
              {primaryKey}
            </kbd>
          )}
        </motion.span>
      </AnimatePresence>
    </Button>
  );
}

// Under the play button: why it can't start yet.
function StartHint({
  setup,
  round,
  primary,
}: {
  setup: GameSetup;
  round: Round;
  primary: PrimaryAction;
}) {
  const { impostersCount, playersCount, hasCategories, isRandomMix } = setup;
  const { gameState } = round;
  const { primaryDisabled } = primary;
  return (
    <AnimatePresence initial={false}>
      {gameState === "setup" && primaryDisabled && (
        <motion.p
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={SPRING}
          className="overflow-hidden pt-2 text-center text-[13px] font-semibold text-pink"
        >
          {impostersCount >= playersCount
            ? "need more players than imposters."
            : !hasCategories
              ? "make a category to play."
              : isRandomMix
                ? "pick at least one category for the random mix."
                : "this category has no words to play with."}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

export { PrimaryButton, StartHint };
