import { AnimatePresence, motion } from "motion/react";
import { Plus, Shuffle, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RollingNumber } from "@/components/ui/rolling-number";
import { Sheet } from "@/components/ui/sheet";
import type { CustomCategory } from "@/game/categories";
import { SPRING } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { cn } from "@/lib/utils";
import { CategoryTile } from "@/features/categories/category-tile";
import type { GameSetup } from "@/features/setup/use-game-setup";

// Pick one category or build the random mix; your own categories live at the bottom.
function CategorySheet({
  setup,
  open,
  predictive,
  onClose,
  onOpenActions,
  onAddCategory,
}: {
  setup: GameSetup;
  open: boolean;
  predictive: boolean;
  onClose: () => void;
  onOpenActions: (category: CustomCategory) => void;
  onAddCategory: () => void;
}) {
  const {
    isRandomMix,
    lastSingleCategory,
    setSelectedCategory,
    selectSingleCategory,
    randomPoolCount,
    allCategoryKeys,
    builtinCategoryKeys,
    customCategoryKeys,
    setRandomPool,
    interfacePrefs,
  } = setup;

  const pickSingleCategory = (key: string) => {
    selectSingleCategory(key);
    // Let the selection pill glide to the new tile before the sheet drops away.
    window.setTimeout(onClose, 150);
  };
  const renderCategoryTile = (key: string) => (
    <CategoryTile
      key={key}
      categoryKey={key}
      setup={setup}
      onPick={pickSingleCategory}
      onOpenActions={onOpenActions}
    />
  );

  // Category picker
  return (
    <Sheet
      open={open}
      predictive={predictive}
      onClose={onClose}
      labelledBy="category-sheet-title"
      desktopClassName="lg:max-w-2xl"
      header={
        <div className="flex h-11 items-center justify-between">
          <h2
            id="category-sheet-title"
            className="font-display text-[22px] font-extrabold tracking-[-0.02em]"
          >
            pick a category
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className="-mr-2.5"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="size-[18px] stroke-[2.2]" />
          </Button>
        </div>
      }
    >
      <div
        role="radiogroup"
        aria-label="Category mode"
        className="grid shrink-0 grid-cols-2 rounded-full bg-background p-1"
      >
        {[
          { random: false, label: "one category" },
          { random: true, label: "random mix" },
        ].map((mode) => {
          const isSelected = mode.random === isRandomMix;
          return (
            <button
              key={mode.label}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => {
                haptic.tap();
                setSelectedCategory(
                  mode.random ? "random" : lastSingleCategory,
                );
              }}
              className={cn(
                "relative flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full text-[15px] transition-colors duration-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60",
                isSelected
                  ? "font-bold text-primary-foreground"
                  : "font-semibold text-foreground",
              )}
            >
              {isSelected && (
                <motion.span
                  layoutId="category-mode-pill"
                  transition={SPRING}
                  className="absolute inset-0 rounded-full bg-primary"
                />
              )}
              {mode.random && (
                <Shuffle
                  className={cn(
                    "relative size-4 transition-colors",
                    !isSelected && "text-pink",
                  )}
                  aria-hidden
                />
              )}
              <span className="relative">{mode.label}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence initial={false}>
        {isRandomMix && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={SPRING}
            className="shrink-0 overflow-hidden"
          >
            <div className="flex min-h-11 items-center justify-between">
              <span className="flex items-baseline gap-1 text-sm text-muted-foreground">
                picks from
                <span className="flex items-baseline gap-1 font-bold text-foreground">
                  <RollingNumber value={randomPoolCount} /> of{" "}
                  {allCategoryKeys.length}
                </span>
              </span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-11 font-bold text-highlight hover:text-highlight"
                  onClick={() =>
                    setRandomPool(
                      Object.fromEntries(allCategoryKeys.map((k) => [k, true])),
                    )
                  }
                >
                  select all
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-11"
                  onClick={() =>
                    setRandomPool(
                      Object.fromEntries(
                        allCategoryKeys.map((k) => [k, false]),
                      ),
                    )
                  }
                >
                  clear
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="-mx-5 min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-0.5">
        <motion.div
          variants={{
            initial: {},
            animate: {
              transition: { staggerChildren: 0.006, delayChildren: 0.02 },
            },
          }}
          initial="initial"
          animate="animate"
          className="grid grid-cols-2 gap-1.5 lg:grid-cols-3"
        >
          {builtinCategoryKeys.map(renderCategoryTile)}
        </motion.div>

        {!interfacePrefs.hideCustomCategories && (
          <div
            className={cn(
              "flex flex-col gap-2.5 pb-1",
              builtinCategoryKeys.length > 0 && "mt-5",
            )}
          >
            <span className="px-1 text-[13px] font-semibold text-muted-foreground">
              Your categories
            </span>
            <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-3">
              {customCategoryKeys.map(renderCategoryTile)}
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={onAddCategory}
                className="flex h-[54px] cursor-pointer items-center gap-2 rounded-2xl border-[1.5px] border-dashed border-pink/70 px-3.5 text-left text-[15px] font-semibold text-pink outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60"
              >
                <Plus className="size-4 stroke-[2.6]" />
                new category
              </motion.button>
            </div>
          </div>
        )}
      </div>

      <Button
        size="lg"
        className="h-[52px] shrink-0 text-[17px]"
        onClick={onClose}
      >
        done
      </Button>
    </Sheet>
  );
}

export { CategorySheet };
