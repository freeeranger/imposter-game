import type { ReactNode } from "react";
import {
  AnimatePresence,
  motion,
  useDragControls,
  useMotionValue,
  useTransform,
} from "motion/react";

import { useIsDesktop } from "@/lib/media";
import { haptic } from "@/lib/native";
import { usePredictiveBack } from "@/lib/predictive-back";
import { cn } from "@/lib/utils";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  // Rendered in the drag handle area, so the sheet can be swiped down from it.
  header: ReactNode;
  children: ReactNode;
  className?: string;
  // Extra classes for the desktop dialog (e.g. a wider max width).
  desktopClassName?: string;
  // Follow Android's predictive back swipe (only the top-most layer should).
  predictive?: boolean;
  // Opens over a stacked page (e.g. the category editor) instead of under it.
  stacked?: boolean;
};

const DISMISS_OFFSET = 110;
const DISMISS_VELOCITY = 600;

// Bottom sheet that springs up from the bottom and can be swiped down to close.
// On desktop it is a centered dialog instead: no drag handle, it fades and lifts in.
function Sheet({
  open,
  onClose,
  labelledBy,
  header,
  children,
  className,
  desktopClassName,
  predictive = false,
  stacked = false,
}: SheetProps) {
  const isDesktop = useIsDesktop();
  const dragControls = useDragControls();
  const back = usePredictiveBack();
  const idleProgress = useMotionValue(0);
  const progress = back?.progress ?? idleProgress;
  // Preview of the sheet closing: it sinks and shrinks slightly with the swipe.
  const previewY = useTransform(progress, [0, 1], [0, 72]);
  const previewScale = useTransform(progress, [0, 1], [1, 0.96]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className={cn(
            "fixed inset-0 flex items-end justify-center lg:items-center lg:p-8",
            stacked ? "z-50" : "z-40",
          )}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-overlay"
            onClick={onClose}
          />
          <motion.div
            style={predictive ? { y: previewY, scale: previewScale } : undefined}
            className={cn(
              "relative z-10 flex w-full max-w-md origin-bottom justify-center",
              desktopClassName,
            )}
          >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            initial={isDesktop ? { opacity: 0, y: 24, scale: 0.97 } : { y: "100%" }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              transition: { type: "spring", stiffness: 560, damping: 44 },
            }}
            exit={
              isDesktop
                ? { opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.15 } }
                : { y: "100%", transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }
            }
            drag={isDesktop ? false : "y"}
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            // Upward it rubber-bands a little (it can't grow); downward it follows the finger.
            dragElastic={{ top: 0.14, bottom: 1 }}
            // Settle back without bouncing past the rest position after a fast swipe.
            dragTransition={{ bounceStiffness: 600, bounceDamping: 48 }}
            onDragEnd={(_, info) => {
              if (
                info.offset.y > DISMISS_OFFSET ||
                info.velocity.y > DISMISS_VELOCITY
              ) {
                haptic.tap();
                onClose();
              }
            }}
            className={cn(
              "relative z-10 flex max-h-[calc(100dvh-2.5rem)] w-full max-w-md flex-col gap-3 rounded-t-[32px] bg-card px-5 pt-2.5 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-card-foreground",
              "lg:max-h-[min(820px,calc(100dvh-4rem))] lg:max-w-none lg:rounded-[32px] lg:border-[1.5px] lg:border-border lg:px-7 lg:pt-6 lg:pb-7 lg:shadow-[0_24px_80px_rgb(0_0_0/0.35)]",
              className,
            )}
          >
            <div
              onPointerDown={(event) => dragControls.start(event)}
              className="flex shrink-0 cursor-grab touch-none flex-col gap-3 active:cursor-grabbing lg:cursor-auto lg:active:cursor-auto"
            >
              <span
                className="h-[5px] w-10 self-center rounded-full bg-border lg:hidden"
                aria-hidden="true"
              />
              {header}
            </div>
            {children}
            {/* Sheet-coloured skirt below the bottom edge, so a swipe up never lifts the
                sheet off the screen's bottom and shows what's behind it. */}
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-full h-[50vh] bg-card lg:hidden"
            />
          </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export { Sheet };
