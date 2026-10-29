import { Check, Loader2, Share2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { QrCode } from "@/components/ui/qr-code";
import { Sheet } from "@/components/ui/sheet";
import type { ShareSheet } from "@/features/categories/use-share-sheet";

function ShareCategorySheet({
  share,
  predictive,
}: {
  share: ShareSheet;
  predictive: boolean;
}) {
  const {
    showShareSheet,
    closeShareSheet,
    shareCategory,
    shareUrl,
    linkCopied,
    canUseShareMenu,
    sendShareLink,
  } = share;
  // Share a category: a QR code to scan across the table, or a link to send.
  return (
    <Sheet
      open={showShareSheet}
      predictive={predictive}
      onClose={closeShareSheet}
      labelledBy="share-sheet-title"
      className="gap-5"
      stacked
      header={
        <div className="flex h-11 items-center justify-between">
          <h2
            id="share-sheet-title"
            className="font-display text-[22px] font-extrabold tracking-[-0.02em]"
          >
            share category
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className="-mr-2.5"
            onClick={closeShareSheet}
            aria-label="Close"
          >
            <X className="size-5 stroke-[2.2]" />
          </Button>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-4 overflow-y-auto">
        <div className="aspect-square w-full max-w-[272px]">
          {shareUrl ? (
            <QrCode
              className="size-full"
              value={shareUrl}
              label={`QR code for ${shareCategory?.name ?? "the category"}`}
            />
          ) : (
            <div className="flex size-full items-center justify-center rounded-[24px] bg-secondary">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="max-w-full font-display text-xl font-extrabold tracking-[-0.02em] [overflow-wrap:anywhere] lowercase">
            {shareCategory?.name}
          </span>
          <span className="text-sm text-muted-foreground">
            {(shareCategory?.words.length ?? 0) +
              (shareCategory?.hard.length ?? 0)}{" "}
            words
          </span>
        </div>
      </div>
      <Button
        size="lg"
        className="h-14 w-full shrink-0 text-[17px]"
        disabled={!shareUrl}
        onClick={() => void sendShareLink()}
      >
        {canUseShareMenu ? (
          <>
            <Share2 className="size-5" />
            send link
          </>
        ) : linkCopied ? (
          <>
            <Check className="size-5" />
            link copied
          </>
        ) : (
          "copy link"
        )}
      </Button>
    </Sheet>
  );
}

export { ShareCategorySheet };
