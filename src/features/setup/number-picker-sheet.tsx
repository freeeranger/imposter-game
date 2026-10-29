import type { CSSProperties } from "react";
import { motion } from "motion/react";
import { Minus, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RollingNumber } from "@/components/ui/rolling-number";
import { Sheet } from "@/components/ui/sheet";
import { RISE, STAGGER, TILE } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { cn } from "@/lib/utils";
import type { GameSetup } from "@/features/setup/use-game-setup";

export type NumberPickerKind = "players" | "imposters" | "prank";
const PRANK_PRESETS = [0, 5, 10, 15, 20, 25];

const range = (from: number, to: number) =>
  Array.from(
    { length: Math.max(0, to - from + 1) },
    (_, index) => from + index,
  );

// Tap a number instead of stepping to it.
function NumberPickerSheet({
  kind,
  setup,
  open,
  predictive,
  onClose,
}: {
  kind: NumberPickerKind;
  setup: GameSetup;
  open: boolean;
  predictive: boolean;
  onClose: () => void;
}) {
  const {
    playersCount,
    applyPlayersCount,
    impostersCount,
    setImpostersCount,
    prankProbability,
    setPrankProbability,
  } = setup;
  const numberPicker = {
    players: {
      title: "players",
      options: range(3, 20),
      value: playersCount,
      apply: applyPlayersCount,
      suffix: "",
    },
    imposters: {
      title: "imposters",
      options: range(1, Math.max(1, playersCount - 1)),
      value: impostersCount,
      apply: setImpostersCount,
      suffix: "",
    },
    prank: {
      title: "prank rounds",
      options: PRANK_PRESETS,
      value: prankProbability,
      apply: setPrankProbability,
      suffix: "%",
    },
  }[kind];
  // Number picker: tap a number instead of typing one
  return (
    <Sheet
      open={open}
      predictive={predictive}
      onClose={onClose}
      labelledBy="number-picker-title"
      header={
        <div className="flex h-11 items-center justify-between">
          <h2
            id="number-picker-title"
            className="font-display text-[22px] font-extrabold tracking-[-0.02em]"
          >
            {numberPicker.title}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className="-mr-2.5"
            onClick={() => onClose()}
            aria-label="Close"
          >
            <X className="size-5 stroke-[2.2]" />
          </Button>
        </div>
      }
    >
      {kind === "prank" ? (
        // Prank chance needs 1% precision, so it gets a slider instead of a grid.
        <motion.div
          variants={STAGGER}
          initial="initial"
          animate="animate"
          className="flex flex-col gap-5 pb-1"
        >
          <motion.div
            variants={RISE}
            className="flex items-center justify-between"
          >
            <Button
              variant="outline"
              size="icon"
              aria-label="Less prank chance"
              disabled={prankProbability <= 0}
              onClick={() => {
                haptic.tap();
                setPrankProbability(Math.max(0, prankProbability - 1));
              }}
            >
              <Minus className="size-5 stroke-[2.5]" />
            </Button>
            <span className="flex items-baseline font-display text-5xl font-extrabold tabular-nums">
              <RollingNumber value={prankProbability} />
              <span className="text-3xl">%</span>
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label="More prank chance"
              disabled={prankProbability >= 100}
              onClick={() => {
                haptic.tap();
                setPrankProbability(Math.min(100, prankProbability + 1));
              }}
            >
              <Plus className="size-5 stroke-[2.5]" />
            </Button>
          </motion.div>
          <motion.input
            variants={RISE}
            type="range"
            min={0}
            max={100}
            step={1}
            value={prankProbability}
            aria-label="Prank chance"
            onChange={(event) => {
              const nextValue = Number(event.target.value);
              // Tick on every 5% so dragging feels notched without buzzing constantly.
              if (nextValue % 5 === 0) haptic.tap();
              setPrankProbability(nextValue);
            }}
            style={{ "--fill": `${prankProbability}%` } as CSSProperties}
            className="range-slider w-full"
          />
          <motion.div variants={RISE} className="grid grid-cols-6 gap-2">
            {PRANK_PRESETS.map((preset) => (
              <motion.button
                key={preset}
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={() => {
                  haptic.tap();
                  setPrankProbability(preset);
                }}
                className={cn(
                  "h-11 cursor-pointer rounded-full text-sm font-bold tabular-nums transition-colors duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60",
                  preset === prankProbability
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground",
                )}
              >
                {preset}%
              </motion.button>
            ))}
          </motion.div>
          <motion.div variants={RISE}>
            <Button
              size="lg"
              className="h-[52px] w-full text-[17px]"
              onClick={() => onClose()}
            >
              done
            </Button>
          </motion.div>
        </motion.div>
      ) : (
        <motion.div
          variants={{
            initial: {},
            animate: {
              transition: { staggerChildren: 0.008, delayChildren: 0.02 },
            },
          }}
          initial="initial"
          animate="animate"
          role="radiogroup"
          aria-labelledby="number-picker-title"
          className={cn(
            "grid gap-2 pb-1",
            numberPicker.suffix ? "grid-cols-4" : "grid-cols-6",
          )}
        >
          {numberPicker.options.map((option) => {
            const isSelected = option === numberPicker.value;
            return (
              <motion.button
                key={option}
                variants={TILE}
                whileTap={{ scale: 0.92 }}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => {
                  haptic.tap();
                  numberPicker.apply(option);
                  window.setTimeout(() => onClose(), 140);
                }}
                className={cn(
                  "h-14 cursor-pointer rounded-2xl font-display text-xl font-extrabold tabular-nums transition-colors duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60",
                  isSelected
                    ? kind === "imposters"
                      ? "bg-pink text-pink-foreground"
                      : "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground",
                )}
              >
                {option}
                {numberPicker.suffix}
              </motion.button>
            );
          })}
        </motion.div>
      )}
    </Sheet>
  );
}

export { NumberPickerSheet };
