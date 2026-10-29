import { motion } from "motion/react";
import { Check, Share, SquarePlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { RISE, STAGGER } from "@/lib/motion";

// iPhone: how to add the web app to the home screen from Safari.
function InstallHelpSheet({
  open,
  predictive,
  onClose,
}: {
  open: boolean;
  predictive: boolean;
  onClose: () => void;
}) {
  // iPhone: how to install from Safari
  return (
    <Sheet
      open={open}
      predictive={predictive}
      onClose={onClose}
      labelledBy="install-help-title"
      className="gap-5"
      header={
        <div className="flex h-11 items-center justify-between">
          <h2
            id="install-help-title"
            className="font-display text-[22px] font-extrabold tracking-[-0.02em]"
          >
            add to home screen
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
        className="flex flex-col gap-3 pb-2"
      >
        {[
          { icon: Share, text: "Tap Share in Safari’s toolbar." },
          {
            icon: SquarePlus,
            text: "Scroll down and tap Add to Home Screen.",
          },
          {
            icon: Check,
            text: "Tap Add. Imposter opens full screen from your home screen.",
          },
        ].map((step, index) => (
          <motion.li
            key={step.text}
            variants={RISE}
            className="flex items-center gap-4 rounded-[20px] bg-secondary py-3.5 pr-4 pl-3.5"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-card text-pink">
              <step.icon className="size-5" />
            </span>
            <span className="text-[15px] leading-snug">
              <span className="mr-1.5 font-display font-extrabold text-pink">
                {index + 1}
              </span>
              {step.text}
            </span>
          </motion.li>
        ))}
      </motion.ol>
    </Sheet>
  );
}

export { InstallHelpSheet };
