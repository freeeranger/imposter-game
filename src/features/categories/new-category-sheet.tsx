import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Link,
  Loader2,
  PenLine,
  ScanLine,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { haptic } from "@/lib/native";
import { canUseCamera, startQrScanner } from "@/lib/qr-scanner";
import type { ScannerError } from "@/lib/qr-scanner";
import { findShareCode } from "@/lib/share";
import { cn } from "@/lib/utils";

export type NewCategoryMode = "menu" | "link" | "scan";

// "new category": make one yourself, or add a shared one from its link or QR code.
function NewCategorySheet({
  open,
  predictive,
  onClose,
  mode,
  onModeChange,
  onMakeOwn,
  onShareCode,
}: {
  open: boolean;
  predictive: boolean;
  onClose: () => void;
  mode: NewCategoryMode;
  onModeChange: (mode: NewCategoryMode) => void;
  onMakeOwn: () => void;
  // A shared category's code, from a pasted link or a scanned QR code.
  onShareCode: (code: string) => void;
}) {
  const [linkDraft, setLinkDraft] = useState<string>("");
  const [linkError, setLinkError] = useState<boolean>(false);
  const [scanStatus, setScanStatus] = useState<
    "starting" | "scanning" | ScannerError
  >("starting");
  const [scannedOtherCode, setScannedOtherCode] = useState<boolean>(false);
  const scannerVideo = useRef<HTMLVideoElement>(null);

  const openAddMode = (next: "link" | "scan") => {
    haptic.tap();
    setLinkDraft("");
    setLinkError(false);
    setScanStatus("starting");
    setScannedOtherCode(false);
    onModeChange(next);
  };

  const submitLink = () => {
    const code = findShareCode(linkDraft);
    if (code === null) {
      haptic.tap();
      setLinkError(true);
      return;
    }
    onClose();
    onShareCode(code);
  };

  // True once a category's code is read, which ends the scan.
  const onScannedText = useEffectEvent((text: string) => {
    const code = findShareCode(text);
    if (code === null) {
      setScannedOtherCode(true);
      return false;
    }
    onClose();
    onShareCode(code);
    return true;
  });
  const isScanning = open && mode === "scan";
  useEffect(() => {
    const video = scannerVideo.current;
    if (!isScanning || !video) return;
    let done = false;
    let stop: (() => void) | undefined;
    startQrScanner(video, (text) => {
      if (done || !onScannedText(text)) return;
      done = true;
      stop?.();
    })
      .then((stopScanner) => {
        stop = stopScanner;
        if (done) stopScanner();
        else setScanStatus("scanning");
      })
      .catch((error: ScannerError) => {
        if (!done) setScanStatus(error);
      });
    return () => {
      done = true;
      stop?.();
    };
  }, [isScanning]);

  // New category: make one yourself, or add a shared one from its link or QR code.
  return (
    <Sheet
      open={open}
      predictive={predictive}
      onClose={onClose}
      labelledBy="add-sheet-title"
      className="gap-5"
      stacked
      header={
        <div className="flex h-11 items-center gap-1">
          {mode !== "menu" && (
            <Button
              variant="ghost"
              size="icon"
              className="-ml-3"
              onClick={() => onModeChange("menu")}
              aria-label="Back"
            >
              <ChevronLeft className="size-6 stroke-[2.2]" />
            </Button>
          )}
          <h2
            id="add-sheet-title"
            className="font-display text-[22px] font-extrabold tracking-[-0.02em]"
          >
            {mode === "link"
              ? "paste a link"
              : mode === "scan"
                ? "scan a QR code"
                : "new category"}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className="-mr-2.5 ml-auto"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="size-5 stroke-[2.2]" />
          </Button>
        </div>
      }
    >
      {mode === "menu" && (
        <div className="flex flex-col divide-y divide-border/70 rounded-[24px] bg-secondary px-[18px]">
          {[
            {
              icon: PenLine,
              label: "make your own",
              onClick: () => {
                onClose();
                onMakeOwn();
              },
            },
            {
              icon: Link,
              label: "paste a link",
              onClick: () => openAddMode("link"),
            },
            ...(canUseCamera
              ? [
                  {
                    icon: ScanLine,
                    label: "scan a QR code",
                    onClick: () => openAddMode("scan"),
                  },
                ]
              : []),
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={option.onClick}
              className="flex min-h-[58px] cursor-pointer items-center gap-3.5 text-left text-base font-semibold outline-none focus-visible:text-pink"
            >
              <option.icon className="size-5 shrink-0 text-pink" />
              <span className="flex-1">{option.label}</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}

      {mode === "link" && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            submitLink();
          }}
        >
          <Input
            aria-label="Shared category link"
            value={linkDraft}
            autoFocus
            autoComplete="off"
            enterKeyHint="go"
            placeholder="tjeneritz.se/c#…"
            onChange={(event) => {
              setLinkDraft(event.target.value);
              setLinkError(false);
            }}
            className="h-12 bg-secondary text-base"
          />
          {linkError && <p className="px-1 text-sm text-pink">Invalid link.</p>}
          <Button
            type="submit"
            size="lg"
            className="h-14 w-full text-[17px]"
            disabled={!linkDraft.trim()}
          >
            continue
          </Button>
        </form>
      )}

      {mode === "scan" && (
        <div className="flex flex-col items-center gap-4 pb-2">
          <div className="relative aspect-square w-full max-w-[272px] overflow-hidden rounded-[24px] bg-secondary">
            {/* Android's web view draws a grey play-button placeholder until the first
                      frame; a blank poster and staying hidden until the camera runs avoid it. */}
            <video
              ref={scannerVideo}
              muted
              playsInline
              poster="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="
              className={cn(
                "size-full object-cover transition-opacity duration-200",
                scanStatus !== "scanning" && "opacity-0",
              )}
            />
            {scanStatus === "starting" && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {(scanStatus === "denied" || scanStatus === "unavailable") && (
              <div className="absolute inset-0 flex items-center justify-center bg-secondary p-6 text-center text-[15px] text-muted-foreground">
                {scanStatus === "denied"
                  ? "Camera access denied."
                  : "Camera unavailable."}
              </div>
            )}
          </div>
          {scannedOtherCode && (
            <p className="text-center text-sm text-pink">
              Not a category QR code.
            </p>
          )}
          {(scanStatus === "denied" || scanStatus === "unavailable") && (
            <Button
              size="lg"
              className="h-14 w-full text-[17px]"
              onClick={() => openAddMode("link")}
            >
              paste a link
            </Button>
          )}
        </div>
      )}
    </Sheet>
  );
}

export { NewCategorySheet };
