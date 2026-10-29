import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import type { IncomingCategoryState } from "@/features/categories/use-incoming-category";

function ImportCategorySheet({
  importing,
  predictive,
}: {
  importing: IncomingCategoryState;
  predictive: boolean;
}) {
  const { incoming, showImportSheet, closeImportSheet, addIncomingCategory } =
    importing;
  // A category from a share link, checked before anything is saved. The words stay
  // hidden so whoever adds it can still play it.
  return (
    <Sheet
      open={showImportSheet}
      predictive={predictive}
      onClose={closeImportSheet}
      labelledBy="import-sheet-title"
      className="gap-5"
      stacked
      header={
        <div className="flex h-11 items-center justify-between">
          <h2
            id="import-sheet-title"
            className="font-display text-[22px] font-extrabold tracking-[-0.02em]"
          >
            {incoming.status === "ok"
              ? "add this category?"
              : incoming.status === "duplicate"
                ? "already added"
                : incoming.status === "newer"
                  ? "update needed"
                  : "invalid link"}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className="-mr-2.5"
            onClick={closeImportSheet}
            aria-label="Close"
          >
            <X className="size-5 stroke-[2.2]" />
          </Button>
        </div>
      }
    >
      {incoming.status === "ok" ? (
        <>
          <div className="flex flex-col gap-1 rounded-[20px] bg-secondary px-[18px] py-4">
            <span className="font-display text-[26px] leading-tight font-extrabold tracking-[-0.03em] [overflow-wrap:anywhere] lowercase">
              {incoming.name}
            </span>
            <span className="text-sm text-muted-foreground">
              {incoming.words.length + incoming.hard.length} words
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              size="lg"
              className="h-14 w-full text-[17px]"
              onClick={addIncomingCategory}
            >
              <Plus className="size-5 stroke-[2.6]" />
              add category
            </Button>
            <Button variant="ghost" className="h-11" onClick={closeImportSheet}>
              not now
            </Button>
          </div>
        </>
      ) : (
        <Button
          size="lg"
          className="h-14 w-full text-[17px]"
          onClick={closeImportSheet}
        >
          ok
        </Button>
      )}
    </Sheet>
  );
}

export { ImportCategorySheet };
