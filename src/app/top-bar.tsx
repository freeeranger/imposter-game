import { AnimatePresence, motion } from "motion/react";
import { Info, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FADE_OUT, SOFT_SPRING } from "@/lib/motion";
import { RoundHeader } from "@/features/round/round-header";
import type { Round } from "@/features/round/use-round";
import type { GameSetup } from "@/features/setup/use-game-setup";

// Stays put at the top while the screen below changes: the app bar on the home screen, the
// round's progress while the phone goes around, and (desktop) the round summary at the end.
function TopBar({
  setup,
  round,
  hasLaunched,
  isDesktop,
  onOpenInfo,
  onOpenSettings,
}: {
  setup: GameSetup;
  round: Round;
  hasLaunched: boolean;
  isDesktop: boolean;
  onOpenInfo: () => void;
  onOpenSettings: () => void;
}) {
  const { interfacePrefs, playersCount, impostersCount } = setup;
  const { gameState, isInRound, currentPlayer, endGame, activeCategoryInfo } =
    round;
  return (
    <div className="shrink-0">
      <AnimatePresence mode="wait">
        {hasLaunched && gameState === "setup" && (
          <motion.header
            key="setup-bar"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0, transition: SOFT_SPRING }}
            exit={FADE_OUT}
            className="flex h-11 items-center justify-between lg:justify-end"
          >
            <h1 className="font-display text-[28px] font-extrabold leading-none tracking-[-0.03em] lg:hidden">
              imposter
            </h1>
            <div className="-mr-2.5 flex">
              {!interfacePrefs.hideInfo && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onOpenInfo}
                  aria-label="How to play"
                >
                  <Info className="size-5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={onOpenSettings}
                aria-label="Settings"
                className="[&_svg]:transition-transform [&_svg]:duration-300 hover:[&_svg]:rotate-45"
              >
                <Settings className="size-5" />
              </Button>
            </div>
          </motion.header>
        )}
        {isInRound && (
          <motion.div
            key="round-bar"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0, transition: SOFT_SPRING }}
            exit={FADE_OUT}
          >
            <RoundHeader
              current={currentPlayer}
              total={playersCount}
              onEnd={endGame}
            />
          </motion.div>
        )}
        {isDesktop && gameState === "end" && (
          <motion.div
            key="end-bar"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0, transition: SOFT_SPRING }}
            exit={FADE_OUT}
            className="flex h-11 items-center justify-center gap-2.5 text-sm font-bold"
          >
            <span className="rounded-full bg-card px-3.5 py-2 lowercase">
              {activeCategoryInfo?.label}
            </span>
            <span className="rounded-full bg-card px-3.5 py-2">
              {playersCount} players
            </span>
            <span className="rounded-full bg-card px-3.5 py-2 text-pink">
              {impostersCount} {impostersCount === 1 ? "imposter" : "imposters"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export { TopBar };
