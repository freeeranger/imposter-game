import { AnimatePresence, motion } from "motion/react";
import { Download, Loader2, X } from "lucide-react";

import { SPRING } from "@/lib/motion";
import type { AppUpdate } from "@/features/updates/use-app-update";

// On the home screen: a status chip while auto-update works, or (auto-update off) a banner to
// install from or dismiss.
function UpdateNotice({ update }: { update: AppUpdate }) {
  const {
    showUpdateChip,
    showUpdateBanner,
    updateStatus,
    updateVersion,
    downloadProgress,
    installUpdate,
    dismissUpdate,
  } = update;
  return (
    <>
      {/* Auto-update on: just a quiet status chip while it downloads / waits to install. */}
      <AnimatePresence initial={false}>
        {showUpdateChip && (
          <motion.button
            key="update-chip"
            type="button"
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={SPRING}
            onClick={updateStatus === "ready" ? installUpdate : undefined}
            disabled={updateStatus !== "ready"}
            className="flex h-9 shrink-0 cursor-pointer items-center gap-2 self-center rounded-full bg-card px-4 text-[13px] font-semibold tabular-nums disabled:cursor-default"
          >
            {updateStatus === "ready" ? (
              <>
                <Download className="size-3.5 text-pink" />v{updateVersion}{" "}
                ready · install
              </>
            ) : (
              <>
                <Loader2 className="size-3.5 animate-spin text-pink" />
                updating to v{updateVersion} ·{" "}
                {Math.round(downloadProgress * 100)}%
              </>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Auto-update off: a banner you can install from or dismiss for this version. */}
      <AnimatePresence initial={false}>
        {showUpdateBanner && (
          <motion.div
            key="update-banner"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={SPRING}
            className="shrink-0 overflow-hidden"
          >
            <div className="flex items-center gap-1 rounded-[20px] bg-pink py-2 pr-1.5 pl-[18px] text-pink-foreground">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] font-bold">update available</span>
                <span className="text-[13px] font-medium opacity-80">
                  v{updateVersion} is out
                </span>
              </span>
              <motion.button
                type="button"
                onClick={installUpdate}
                whileTap={{ scale: 0.95 }}
                className="flex h-11 cursor-pointer items-center gap-1.5 rounded-full bg-pink-foreground px-4 text-sm font-bold text-pink tabular-nums"
              >
                {updateStatus === "downloading" ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {Math.round(downloadProgress * 100)}%
                  </>
                ) : (
                  <>
                    <Download className="size-4" />
                    install
                  </>
                )}
              </motion.button>
              <button
                type="button"
                onClick={dismissUpdate}
                aria-label="Dismiss update"
                className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-[background-color] hover:bg-pink-foreground/10"
              >
                <X className="size-5 stroke-[2.4]" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export { UpdateNotice };
