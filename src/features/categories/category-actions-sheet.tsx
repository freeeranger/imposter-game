import { Pencil, Share2, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Sheet } from "@/components/ui/sheet";
import type { CustomCategory } from "@/game/categories";
import { haptic } from "@/lib/native";
import { cn } from "@/lib/utils";

// The ⋯ on one of your categories: share, edit or delete it (delete asks first).
function CategoryActionsSheet({
  category,
  open,
  predictive,
  onClose,
  onShare,
  onEdit,
  confirmingDelete,
  deletePredictive,
  onRequestDelete,
  onCancelDelete,
  onDelete,
}: {
  category: CustomCategory | null;
  open: boolean;
  predictive: boolean;
  onClose: () => void;
  onShare: (category: CustomCategory) => void;
  onEdit: (category: CustomCategory) => void;
  confirmingDelete: boolean;
  deletePredictive: boolean;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <ConfirmDialog
        open={confirmingDelete}
        predictive={deletePredictive}
        icon={<Trash2 className="size-7" aria-hidden />}
        title="delete this category?"
        confirmLabel="delete"
        cancelLabel="keep it"
        onConfirm={onDelete}
        onCancel={onCancelDelete}
      />

      {/* ⋯ on one of your categories: what you can do with it. */}
      <Sheet
        open={open}
        predictive={predictive}
        onClose={onClose}
        labelledBy="actions-sheet-title"
        className="gap-5"
        stacked
        header={
          <div className="flex min-h-11 items-center justify-between gap-3">
            <h2
              id="actions-sheet-title"
              className="min-w-0 font-display text-[22px] font-extrabold tracking-[-0.02em] [overflow-wrap:anywhere] lowercase"
            >
              {category?.name}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              className="-mr-2.5 shrink-0"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="size-5 stroke-[2.2]" />
            </Button>
          </div>
        }
      >
        <div className="flex flex-col divide-y divide-border/70 rounded-[24px] bg-secondary px-[18px]">
          {[
            {
              icon: Share2,
              label: "share",
              onClick: () => {
                if (!category) return;
                onClose();
                onShare(category);
              },
            },
            {
              icon: Pencil,
              label: "edit",
              onClick: () => {
                if (!category) return;
                onClose();
                onEdit(category);
              },
            },
            {
              icon: Trash2,
              label: "delete",
              onClick: () => {
                haptic.tap();
                onRequestDelete();
              },
            },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={option.onClick}
              className={cn(
                "flex min-h-[58px] cursor-pointer items-center gap-3.5 text-left text-base font-semibold outline-none focus-visible:text-pink",
                option.label === "delete" && "text-pink",
              )}
            >
              <option.icon className="size-5 shrink-0 text-pink" />
              {option.label}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}

export { CategoryActionsSheet };
