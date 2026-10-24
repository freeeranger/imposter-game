import type { ReactNode } from "react";
import { AnimatePresence, motion, useDragControls } from "motion/react";

import { cn } from "@/lib/utils";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  // Rendered in the drag handle area, so the sheet can be swiped down from it.
  header: ReactNode;
  children: ReactNode;
  className?: string;
};

const DISMISS_OFFSET = 110;
const DISMISS_VELOCITY = 600;

// Bottom sheet that springs up from the bottom and can be swiped down to close.
function Sheet({
  open,
  onClose,
  labelledBy,
  header,
  children,
  className,
}: SheetProps) {
  const dragControls = useDragControls();

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-overlay"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            initial={{ y: "100%" }}
            animate={{
              y: 0,
              transition: { type: "spring", stiffness: 380, damping: 36 },
            }}
            exit={{
              y: "100%",
              transition: { type: "spring", stiffness: 420, damping: 42 },
            }}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 1 }}
            onDragEnd={(_, info) => {
              if (
                info.offset.y > DISMISS_OFFSET ||
                info.velocity.y > DISMISS_VELOCITY
              ) {
                onClose();
              }
            }}
            className={cn(
              "relative z-10 flex max-h-[calc(100dvh-2.5rem)] w-full max-w-md flex-col gap-3 rounded-t-[32px] bg-card px-5 pt-2.5 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-card-foreground",
              className,
            )}
          >
            <div
              onPointerDown={(event) => dragControls.start(event)}
              className="flex shrink-0 cursor-grab touch-none flex-col gap-3 active:cursor-grabbing"
            >
              <span
                className="h-[5px] w-10 self-center rounded-full bg-border"
                aria-hidden="true"
              />
              {header}
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export { Sheet };
