import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";

import { Button } from "@/components/ui/button";

type ConfirmDialogProps = {
  open: boolean;
  icon?: ReactNode;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

// Our own confirm prompt, replacing the browser/Android system dialog.
function ConfirmDialog({
  open,
  icon,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-overlay"
            onClick={onCancel}
          />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            initial={{ opacity: 0, scale: 0.9, y: 16, rotate: -2 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              rotate: -1,
              transition: { type: "spring", stiffness: 520, damping: 30 },
            }}
            exit={{ opacity: 0, scale: 0.95, y: 8, transition: { duration: 0.12 } }}
            className="relative z-10 flex w-full max-w-xs flex-col items-center gap-5 rounded-[28px] border-[1.5px] border-border bg-card p-6 text-center text-card-foreground shadow-[8px_8px_0_var(--pink)]"
          >
            {icon && (
              <span className="flex size-14 items-center justify-center rounded-full bg-secondary text-pink">
                {icon}
              </span>
            )}
            <div className="flex flex-col gap-2">
              <h2
                id="confirm-dialog-title"
                className="font-display text-[22px] leading-tight font-extrabold tracking-[-0.02em]"
              >
                {title}
              </h2>
              {description && (
                <p className="text-[15px] text-muted-foreground">{description}</p>
              )}
            </div>
            <div className="flex w-full flex-col gap-2">
              <Button
                variant="pink"
                className="h-[52px] w-full font-display text-[15px] font-extrabold"
                onClick={onConfirm}
                autoFocus
              >
                {confirmLabel}
              </Button>
              <Button variant="ghost" className="h-11 w-full text-[15px]" onClick={onCancel}>
                {cancelLabel}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export { ConfirmDialog };
