import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/native";
import { cn } from "@/lib/utils";

type PageProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  // Stacks above another open page (e.g. license on top of settings).
  stacked?: boolean;
};

const DISMISS_OFFSET = 110;
const DISMISS_VELOCITY = 600;

// Full-screen page that slides in from the right; tap back or swipe right to leave.
function Page({ open, onClose, title, children, stacked = false }: PageProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          initial={{ x: "100%" }}
          animate={{
            x: 0,
            transition: { type: "spring", stiffness: 520, damping: 46 },
          }}
          exit={{ x: "100%", transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
          drag="x"
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
            "fixed inset-0 flex touch-pan-y justify-center bg-background text-foreground shadow-[-16px_0_40px_rgb(0_0_0/0.35)]",
            stacked ? "z-50" : "z-40",
          )}
        >
          <div className="flex h-full w-full max-w-md flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pr-[max(1.25rem,env(safe-area-inset-right))] pb-[max(1.25rem,env(safe-area-inset-bottom))] pl-[max(1.25rem,env(safe-area-inset-left))]">
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
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export { Page };
