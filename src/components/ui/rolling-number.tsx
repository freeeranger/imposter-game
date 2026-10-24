import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { cn } from "@/lib/utils";

const ROLL_VARIANTS = {
  enter: (direction: number) => ({
    y: direction > 0 ? "75%" : "-75%",
    opacity: 0,
  }),
  center: { y: 0, opacity: 1 },
  exit: (direction: number) => ({
    y: direction > 0 ? "-75%" : "75%",
    opacity: 0,
  }),
};

// Rolls the number up when it grows and down when it shrinks, like an odometer.
function RollingNumber({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const [shownValue, setShownValue] = useState(value);
  const [direction, setDirection] = useState(1);

  if (value !== shownValue) {
    setDirection(value > shownValue ? 1 : -1);
    setShownValue(value);
  }

  return (
    <span className={cn("relative inline-flex justify-center", className)}>
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.span
          key={value}
          custom={direction}
          variants={ROLL_VARIANTS}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: "spring", stiffness: 700, damping: 40 }}
          className="inline-block tabular-nums"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export { RollingNumber };
