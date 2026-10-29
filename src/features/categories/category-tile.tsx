import { AnimatePresence, motion } from "motion/react";
import { Check, Ellipsis } from "lucide-react";

import { CUSTOM_KEY_PREFIX, getUniqueCategoryWords } from "@/game/categories";
import type { CustomCategory } from "@/game/categories";
import { SPRING, TILE } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { cn } from "@/lib/utils";
import { CategorySticker } from "@/features/categories/category-sticker";
import type { GameSetup } from "@/features/setup/use-game-setup";

// One category in the picker. With one category chosen, tapping picks it (your own have a ⋯
// for share, edit and delete); in random mix, tapping puts it in or out of the mix.
function CategoryTile({
  categoryKey: key,
  setup,
  onPick,
  onOpenActions,
}: {
  categoryKey: string;
  setup: GameSetup;
  onPick: (key: string) => void;
  onOpenActions: (category: CustomCategory) => void;
}) {
  const {
    allCategories,
    customCategories,
    isRandomMix,
    selectedCategory,
    selectedDifficulty,
    isInPool,
    setRandomPool,
  } = setup;
  const category = allCategories[key];

  if (!isRandomMix) {
    const isSelected = key === selectedCategory;
    const customCategory = category.custom
      ? customCategories.find((item) => CUSTOM_KEY_PREFIX + item.id === key)
      : undefined;
    const tile = (
      <motion.button
        key={key}
        variants={TILE}
        whileTap={{ scale: 0.96 }}
        type="button"
        aria-pressed={isSelected}
        onClick={() => {
          haptic.tap();
          onPick(key);
        }}
        className={cn(
          "relative isolate flex h-[54px] w-full cursor-pointer flex-col items-start justify-center gap-0.5 rounded-2xl bg-secondary px-3.5 text-left transition-colors duration-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60",
          customCategory && "pr-11",
          isSelected ? "text-primary-foreground" : "text-secondary-foreground",
        )}
      >
        {/* Pops in place: a pill gliding across a 2-column grid would cut over other tiles. */}
        <AnimatePresence initial={false}>
          {isSelected && (
            <motion.span
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={SPRING}
              className="absolute inset-0 -z-10 rounded-2xl bg-primary"
            />
          )}
        </AnimatePresence>
        <span
          className={cn(
            "max-w-full truncate text-[15px] leading-tight lowercase",
            isSelected ? "font-bold" : "font-semibold",
          )}
        >
          {category.label}
        </span>
        <span
          className={cn(
            "flex items-center gap-1.5 text-xs whitespace-nowrap transition-colors duration-200",
            isSelected
              ? "text-primary-foreground/70"
              : "text-muted-foreground/80",
          )}
        >
          {getUniqueCategoryWords(category, selectedDifficulty).length} words
          {category.tag && (
            <CategorySticker tag={category.tag} onPrimary={isSelected} />
          )}
        </span>
      </motion.button>
    );
    if (!customCategory) return tile;
    return (
      <div key={key} className="relative">
        {tile}
        <button
          type="button"
          aria-label={`Options for ${category.label}`}
          onClick={() => onOpenActions(customCategory)}
          className={cn(
            "absolute top-1/2 right-1 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60",
            isSelected
              ? "text-primary-foreground/80 hover:text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Ellipsis className="size-5" />
        </button>
      </div>
    );
  }

  const isIncluded = isInPool(key);
  return (
    <motion.button
      key={key}
      variants={TILE}
      whileTap={{ scale: 0.96 }}
      type="button"
      role="checkbox"
      aria-checked={isIncluded}
      onClick={() => {
        haptic.tap();
        setRandomPool((prev) => ({
          ...prev,
          [key]: !isIncluded,
        }));
      }}
      className={cn(
        "relative flex h-[54px] cursor-pointer flex-col items-start justify-center gap-0.5 rounded-2xl border-[1.5px] px-3.5 text-left transition-colors duration-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60",
        isIncluded
          ? "border-transparent bg-secondary text-secondary-foreground"
          : "border-border bg-transparent text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "max-w-[calc(100%-1.75rem)] truncate text-[15px] leading-tight lowercase",
          isIncluded ? "font-semibold" : "font-medium line-through",
        )}
      >
        {category.label}
      </span>
      <span className="flex items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground/80">
        {getUniqueCategoryWords(category, selectedDifficulty).length} words
        {category.tag && <CategorySticker tag={category.tag} />}
      </span>
      <span
        className="absolute top-2 right-2.5 flex size-5 items-center justify-center rounded-full border-2 border-muted-foreground/60"
        aria-hidden="true"
      >
        <AnimatePresence initial={false}>
          {isIncluded && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: "spring", stiffness: 800, damping: 32 }}
              className="absolute -inset-0.5 flex items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <Check className="size-3 stroke-[3.5]" />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </motion.button>
  );
}

export { CategoryTile };
