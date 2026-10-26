import type { ReactNode } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform } from "motion/react";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useKeyboard } from "@/lib/keyboard";
import { useIsDesktop } from "@/lib/media";
import { haptic } from "@/lib/native";
import { usePredictiveBack } from "@/lib/predictive-back";
import { cn } from "@/lib/utils";

type PageProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  // Stacks above another open page (e.g. license on top of settings).
  stacked?: boolean;
  // Follow Android's predictive back swipe (only the top-most layer should).
  predictive?: boolean;
  // Docked under the scrolling content, and lifted above the on-screen keyboard.
  footer?: ReactNode;
};

const DISMISS_OFFSET = 110;
const DISMISS_VELOCITY = 600;

// Full-screen page that slides in from the right; tap back or swipe right to leave.
// On desktop it is a panel docked to the right edge, over a dimmed app you can click to leave.
function Page({
  open,
  onClose,
  title,
  children,
  stacked = false,
  predictive = false,
  footer,
}: PageProps) {
  const keyboard = useKeyboard();
  const isDesktop = useIsDesktop();
  const back = usePredictiveBack();
  const idleProgress = useMotionValue(0);
  const idleEdge = useMotionValue(1);
  const progress = back?.progress ?? idleProgress;
  const edge = back?.edge ?? idleEdge;
  // Material-style preview: shrink, drift toward the swipe, round the corners.
  const scale = useTransform(progress, [0, 1], [1, 0.9]);
  const x = useTransform(() => progress.get() * edge.get() * 24);
  const borderRadius = useTransform(progress, [0, 1], [0, 32]);

  return (
    <AnimatePresence>
      {open && isDesktop && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className={cn("fixed inset-0 bg-overlay", stacked ? "z-50" : "z-40")}
          onClick={onClose}
        />
      )}
      {open && (
        <motion.div
          key="page"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          initial={{ x: "100%" }}
          animate={{
            x: 0,
            transition: { type: "spring", stiffness: 520, damping: 46 },
          }}
          exit={{ x: "100%", transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
          drag={isDesktop ? false : "x"}
          dragDirectionLock
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={{ left: 0, right: 1 }}
          onDragEnd={(_, info) => {
            if (
              info.offset.x > DISMISS_OFFSET ||
              info.velocity.x > DISMISS_VELOCITY
            ) {
              haptic.tap();
              onClose();
            }
          }}
          className={cn(
            "fixed inset-0 touch-pan-y lg:left-auto lg:w-[30rem]",
            stacked ? "z-50" : "z-40",
          )}
        >
          <motion.div
            style={predictive ? { scale, x, borderRadius } : undefined}
            className="absolute inset-0 flex justify-center overflow-hidden bg-background text-foreground shadow-[-16px_0_40px_rgb(0_0_0/0.35)] lg:rounded-l-[32px] lg:border-l-[1.5px] lg:border-border"
          >
            <div
              style={
                footer && keyboard.inset > 0
                  ? { paddingBottom: keyboard.inset + 12 }
                  : undefined
              }
              className={cn(
                "flex h-full w-full max-w-md flex-col px-5 lg:max-w-none lg:pr-7 lg:pl-7 pt-[max(1.25rem,env(safe-area-inset-top))] pr-[max(1.25rem,env(safe-area-inset-right))] pb-[max(1.25rem,env(safe-area-inset-bottom))] pl-[max(1.25rem,env(safe-area-inset-left))]",
                // The keyboard already sits above the home indicator, so a small gap is enough.
                footer && keyboard.open && "pb-3",
              )}
            >
              <header className="flex h-11 shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="-ml-3"
                  onClick={onClose}
                  aria-label="Back"
                >
                  <ChevronLeft className="size-6 stroke-[2.2]" />
                </Button>
                <h1 className="font-display text-[28px] leading-none font-extrabold tracking-[-0.03em]">
                  {title}
                </h1>
              </header>
              {/* relative so popLayout animations inside measure against the scrolled content */}
              <div className="relative -mx-5 min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-6 pb-2">
                {children}
              </div>
              {footer && <div className="shrink-0 pt-3">{footer}</div>}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export { Page };
