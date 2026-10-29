import { AnimatePresence, motion } from "motion/react";

import {
  DIFFICULTIES,
  DIFFICULTY_DESCRIPTIONS,
  DIFFICULTY_LABELS,
} from "@/game/categories";
import { SPRING, RISE } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { cn } from "@/lib/utils";
import type { GameSetup } from "@/features/setup/use-game-setup";

function DifficultyPicker({ setup }: { setup: GameSetup }) {
  const { selectedCategoryInfo, selectedDifficulty, setSelectedDifficulty } =
    setup;
  // A custom category with one word list has no easy/hard, so difficulty folds away.
  // -mt-5 cancels the column gap; the inner pt-5 brings it back while shown.
  return (
    <motion.div variants={RISE} className="-mt-5 shrink-0">
      <AnimatePresence initial={false}>
        {!(
          selectedCategoryInfo?.custom && selectedCategoryInfo.hard.length === 0
        ) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={SPRING}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-2.5 pt-5">
              <div className="flex items-baseline justify-between gap-3 px-1">
                <span
                  id="difficulty-label"
                  className="text-[13px] font-semibold text-muted-foreground"
                >
                  Difficulty
                </span>
                <span className="relative h-5 min-w-0 flex-1 overflow-hidden text-right">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={selectedDifficulty}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={SPRING}
                      className="block truncate text-[13px] text-muted-foreground/80"
                    >
                      {DIFFICULTY_DESCRIPTIONS[selectedDifficulty]}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </div>
              <div
                role="radiogroup"
                aria-labelledby="difficulty-label"
                className="grid grid-cols-3 rounded-full bg-card p-1"
              >
                {DIFFICULTIES.map((difficulty) => {
                  const isSelected = difficulty === selectedDifficulty;
                  return (
                    <button
                      key={difficulty}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => {
                        haptic.tap();
                        setSelectedDifficulty(difficulty);
                      }}
                      className={cn(
                        "relative h-[42px] cursor-pointer rounded-full text-[15px] transition-colors duration-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60",
                        isSelected
                          ? "font-bold text-primary-foreground"
                          : "font-semibold text-foreground",
                      )}
                    >
                      {isSelected && (
                        <motion.span
                          layoutId="difficulty-pill"
                          transition={SPRING}
                          className="absolute inset-0 rounded-full bg-primary"
                        />
                      )}
                      <span className="relative">
                        {DIFFICULTY_LABELS[difficulty]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export { DifficultyPicker };
