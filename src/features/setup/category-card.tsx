import { AnimatePresence, motion } from "motion/react";
import { ChevronRight, Shuffle } from "lucide-react";

import { RollingNumber } from "@/components/ui/rolling-number";
import { SPRING, RISE } from "@/lib/motion";
import { CategorySticker } from "@/features/categories/category-sticker";
import type { GameSetup } from "@/features/setup/use-game-setup";

// The chosen category (or random mix) on the home screen; tap it to pick another.
function CategoryCard({
  setup,
  onOpen,
}: {
  setup: GameSetup;
  onOpen: () => void;
}) {
  const {
    selectedCategory,
    selectedCategoryInfo,
    isRandomMix,
    randomPoolCount,
    allCategoryKeys,
    selectedWordCount,
  } = setup;
  return (
    <motion.div variants={RISE} className="shrink-0 py-1 pr-1.5">
      <motion.button
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        whileTap={{ scale: 0.98 }}
        className="relative flex min-h-[88px] w-full -rotate-1 cursor-pointer items-center justify-between gap-3 rounded-[24px] border-[1.5px] border-border bg-card py-3.5 pr-4 pl-5 text-left shadow-[6px_6px_0_var(--pink)] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60"
      >
        <AnimatePresence initial={false}>
          {selectedCategoryInfo?.tag && (
            <motion.span
              key={selectedCategory}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={SPRING}
              className="absolute -top-[11px] right-[26px]"
            >
              <CategorySticker
                tag={selectedCategoryInfo.tag}
                className="px-2.5 py-[3px] text-xs"
              />
            </motion.span>
          )}
        </AnimatePresence>
        <span className="relative flex min-w-0 flex-1 flex-col">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={selectedCategory}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={SPRING}
              className="flex min-w-0 flex-col gap-[5px]"
            >
              <span className="text-[13px] font-semibold text-muted-foreground">
                Category
              </span>
              <span className="flex min-w-0 items-center gap-2">
                {isRandomMix && (
                  <Shuffle className="size-5 shrink-0 text-pink" />
                )}
                <span className="truncate font-display text-[26px] leading-none font-extrabold lowercase tracking-[-0.03em] text-highlight">
                  {isRandomMix
                    ? "random mix"
                    : (selectedCategoryInfo?.label ?? "pick one")}
                </span>
              </span>
              <span className="flex items-baseline gap-1 text-[13px] text-muted-foreground">
                {isRandomMix ? (
                  <>
                    picks from <RollingNumber value={randomPoolCount} /> of{" "}
                    {allCategoryKeys.length}
                  </>
                ) : (
                  <>
                    <RollingNumber value={selectedWordCount} /> words
                  </>
                )}
              </span>
            </motion.span>
          </AnimatePresence>
        </span>
        <ChevronRight className="size-5 shrink-0 stroke-[2.2] text-muted-foreground" />
      </motion.button>
    </motion.div>
  );
}

export { CategoryCard };
