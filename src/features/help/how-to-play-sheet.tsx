import { motion } from "motion/react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { RISE, STAGGER } from "@/lib/motion";

function HowToPlaySheet({
  open,
  predictive,
  onClose,
}: {
  open: boolean;
  predictive: boolean;
  onClose: () => void;
}) {
  // How to play
  return (
    <Sheet
      open={open}
      predictive={predictive}
      onClose={onClose}
      labelledBy="info-sheet-title"
      className="gap-5"
      header={
        <div className="flex h-11 items-center justify-between">
          <h2
            id="info-sheet-title"
            className="font-display text-[22px] font-extrabold tracking-[-0.02em]"
          >
            how to play
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
      <motion.ol
        variants={STAGGER}
        initial="initial"
        animate="animate"
        className="flex flex-col gap-3.5 overflow-y-auto text-[15px] leading-relaxed"
      >
        {[
          "Pass the phone around so everyone can check their card in private.",
          "Most players see a secret word. The imposter only sees the category.",
          "Go around the room and say one clue each. Too obvious, and the imposter catches on. Too vague, and everyone votes you out.",
          "Once everyone has spoken, argue and point fingers.",
        ].map((step, index) => (
          <motion.li key={step} variants={RISE} className="flex gap-3">
            <span className="w-4 shrink-0 font-display text-base font-extrabold text-pink">
              {index + 1}
            </span>
            <span>{step}</span>
          </motion.li>
        ))}
      </motion.ol>
    </Sheet>
  );
}

export { HowToPlaySheet };
