import { useRef } from "react";
import type { ReactNode } from "react";
import { motion, useMotionValue, useTransform } from "motion/react";

import { haptic } from "@/lib/native";

const SWIPE_OFFSET = 110;
const SWIPE_VELOCITY = 600;

// The secret card: tilts with the finger and can be flicked away to pass the phone.
const SwipeCard = ({
  onSwipe,
  children,
}: {
  onSwipe: (direction: 1 | -1) => void;
  children: ReactNode;
}) => {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-240, 240], [-14, 14]);
  const isPastThreshold = useRef(false);

  return (
    <motion.div
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      whileDrag={{ scale: 1.02 }}
      onDrag={(_, info) => {
        // A small tick when letting go would pass the phone, and again if pulled back.
        const isPast = Math.abs(info.offset.x) > SWIPE_OFFSET;
        if (isPast !== isPastThreshold.current) {
          isPastThreshold.current = isPast;
          haptic.tap();
        }
      }}
      onDragEnd={(_, info) => {
        if (
          Math.abs(info.offset.x) > SWIPE_OFFSET ||
          Math.abs(info.velocity.x) > SWIPE_VELOCITY
        ) {
          onSwipe(info.offset.x > 0 ? 1 : -1);
        }
      }}
      className="flex h-full w-full cursor-grab touch-pan-y flex-col justify-between rounded-[32px] bg-card p-6 shadow-[10px_10px_0_var(--pink)] active:cursor-grabbing lg:p-8 lg:shadow-[12px_12px_0_var(--pink)]"
    >
      {children}
    </motion.div>
  );
};

export { SwipeCard };
