import { AnimatePresence, motion } from "motion/react";

import { NumberStepper } from "@/components/ui/number-stepper";
import { SettingRow } from "@/components/ui/setting-row";
import { Switch } from "@/components/ui/switch";
import { SPRING, RISE } from "@/lib/motion";
import type { GameSetup } from "@/features/setup/use-game-setup";
import type { NumberPickerKind } from "@/features/setup/number-picker-sheet";

// Starter, fellow imposters and prank rounds.
function RoundOptions({
  setup,
  onPickNumber,
}: {
  setup: GameSetup;
  onPickNumber: (kind: NumberPickerKind) => void;
}) {
  const {
    randomizeStarter,
    setRandomizeStarter,
    canRevealFellows,
    revealFellowImposters,
    setRevealFellowImposters,
    prankProbability,
    setPrankProbability,
  } = setup;
  return (
    <motion.div
      variants={RISE}
      className="flex shrink-0 flex-col divide-y divide-border/70 rounded-[24px] bg-card pr-3 pl-[18px]"
    >
      <SettingRow id="randomize-starter" title="Random first speaker">
        <Switch
          id="randomize-starter"
          checked={randomizeStarter}
          onCheckedChange={setRandomizeStarter}
        />
      </SettingRow>
      <AnimatePresence initial={false}>
        {canRevealFellows && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={SPRING}
            className="overflow-hidden"
          >
            <SettingRow id="fellow-imposters" title="Imposters know each other">
              <Switch
                id="fellow-imposters"
                checked={revealFellowImposters}
                onCheckedChange={setRevealFellowImposters}
              />
            </SettingRow>
          </motion.div>
        )}
      </AnimatePresence>
      <SettingRow id="prank-probability" title="Prank rounds">
        <NumberStepper
          id="prank-probability"
          label="prank chance"
          size="sm"
          min={0}
          max={100}
          value={prankProbability}
          onChange={setPrankProbability}
          onPick={() => onPickNumber("prank")}
          suffix="%"
        />
      </SettingRow>
    </motion.div>
  );
}

export { RoundOptions };
