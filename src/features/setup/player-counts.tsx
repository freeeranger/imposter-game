import { motion } from "motion/react";

import { NumberStepper } from "@/components/ui/number-stepper";
import { RISE } from "@/lib/motion";
import type { GameSetup } from "@/features/setup/use-game-setup";
import type { NumberPickerKind } from "@/features/setup/number-picker-sheet";

function PlayerCounts({
  setup,
  onPickNumber,
}: {
  setup: GameSetup;
  onPickNumber: (kind: NumberPickerKind) => void;
}) {
  const { playersCount, applyPlayersCount, impostersCount, setImpostersCount } =
    setup;
  return (
    <motion.div
      variants={RISE}
      className="grid shrink-0 grid-cols-2 rounded-[24px] bg-card pt-4 pb-[18px]"
    >
      {/* Narrow phones: less side padding so two-digit counts fit between − and +. */}
      <div className="flex flex-col items-center gap-2 border-r border-border/70 px-3.5 max-[374px]:px-2">
        <label
          htmlFor="players"
          className="text-[13px] font-semibold text-muted-foreground"
        >
          Players
        </label>
        <NumberStepper
          id="players"
          label="players"
          min={3}
          max={20}
          value={playersCount}
          onChange={applyPlayersCount}
          onPick={() => onPickNumber("players")}
        />
      </div>
      <div className="flex flex-col items-center gap-2 px-3.5 max-[374px]:px-2">
        <label
          htmlFor="imposters"
          className="text-[13px] font-semibold text-muted-foreground"
        >
          Imposters
        </label>
        <NumberStepper
          id="imposters"
          label="imposters"
          min={1}
          max={Math.max(1, playersCount - 1)}
          value={impostersCount}
          onChange={setImpostersCount}
          onPick={() => onPickNumber("imposters")}
          valueClassName="text-pink"
        />
      </div>
    </motion.div>
  );
}

export { PlayerCounts };
