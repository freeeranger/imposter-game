import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronRight, Download, Loader2 } from "lucide-react";

import { SettingRow } from "@/components/ui/setting-row";
import { Switch } from "@/components/ui/switch";
import { SPRING, RISE } from "@/lib/motion";
import {
  APK_DOWNLOAD_URL,
  haptic,
  isIOS,
  isInstalledWebApp,
  isNativeApp,
} from "@/lib/native";
import { cn } from "@/lib/utils";
import { APP_VERSION } from "@/features/updates/use-app-update";
import type { AppUpdate } from "@/features/updates/use-app-update";

// Settings: the installed version, updates in the app, and getting the app on the web.
function VersionSection({
  update,
  onOpenInstallHelp,
}: {
  update: AppUpdate;
  onOpenInstallHelp: () => void;
}) {
  const {
    updateStatus,
    updateVersion,
    downloadProgress,
    autoUpdate,
    setAutoUpdate,
    checkForUpdates,
    installUpdate,
  } = update;
  return (
    <motion.section variants={RISE} className="flex flex-col gap-2.5">
      <span className="px-1 text-[13px] font-semibold text-muted-foreground">
        Version
      </span>
      <div className="flex flex-col divide-y divide-border/70 rounded-[24px] bg-card px-[18px]">
        <div className="flex min-h-[54px] items-center justify-between">
          <span className="text-[15px] font-medium">Version</span>
          <span className="font-display text-sm font-extrabold">
            v{APP_VERSION}
          </span>
        </div>

        {isNativeApp ? (
          <button
            type="button"
            onClick={() => {
              if (updateStatus === "available" || updateStatus === "ready") {
                void installUpdate();
              } else if (
                updateStatus !== "checking" &&
                updateStatus !== "downloading"
              ) {
                void checkForUpdates();
              }
            }}
            // relative: popLayout positions the outgoing status against this row, not the scrolled page.
            className="relative flex min-h-[54px] cursor-pointer items-center justify-between gap-3 text-left"
          >
            <span className="text-[15px] font-medium">Updates</span>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={updateStatus}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={SPRING}
                className={cn(
                  "flex items-center gap-1.5 text-sm font-semibold",
                  updateStatus === "available" ||
                    updateStatus === "downloading" ||
                    updateStatus === "ready"
                    ? "text-pink"
                    : updateStatus === "latest"
                      ? "text-muted-foreground"
                      : "text-highlight",
                )}
              >
                {updateStatus === "checking" && (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Checking…
                  </>
                )}
                {updateStatus === "latest" && (
                  <>
                    <Check className="size-4 stroke-[2.5]" />
                    Up to date
                  </>
                )}
                {updateStatus === "available" && (
                  <>v{updateVersion} available</>
                )}
                {updateStatus === "downloading" && (
                  <span className="tabular-nums">
                    Downloading {Math.round(downloadProgress * 100)}%
                  </span>
                )}
                {updateStatus === "ready" && <>v{updateVersion} ready</>}
                {updateStatus === "error" && <>Couldn’t check · retry</>}
                {updateStatus === "idle" && <>Check now</>}
              </motion.span>
            </AnimatePresence>
          </button>
        ) : isIOS && !isInstalledWebApp ? (
          // iOS has no install prompt a web app can trigger, so explain the Share-sheet route.
          <button
            type="button"
            onClick={() => {
              haptic.tap();
              onOpenInstallHelp();
            }}
            className="flex min-h-[54px] cursor-pointer items-center justify-between gap-3 text-left"
          >
            <span className="text-[15px] font-medium">Add to Home Screen</span>
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              How
              <ChevronRight className="size-4" />
            </span>
          </button>
        ) : null}

        {isNativeApp && (
          <SettingRow id="auto-update" title="Auto-update">
            <Switch
              id="auto-update"
              checked={autoUpdate}
              onCheckedChange={setAutoUpdate}
            />
          </SettingRow>
        )}
      </div>

      <AnimatePresence initial={false}>
        {isNativeApp &&
          (updateStatus === "available" ||
            updateStatus === "downloading" ||
            updateStatus === "ready") && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={SPRING}
              className="overflow-hidden"
            >
              <button
                type="button"
                onClick={installUpdate}
                disabled={updateStatus === "downloading"}
                className="relative mt-1 flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-full bg-primary font-display text-[15px] font-extrabold text-primary-foreground transition-[scale] active:scale-[0.98] disabled:cursor-default"
              >
                {updateStatus === "downloading" && (
                  <motion.span
                    className="absolute inset-y-0 left-0 bg-primary-foreground/15"
                    animate={{
                      width: `${Math.round(downloadProgress * 100)}%`,
                    }}
                    transition={{ duration: 0.2 }}
                  />
                )}
                <span className="relative flex items-center gap-2 tabular-nums">
                  {updateStatus === "downloading" ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      downloading {Math.round(downloadProgress * 100)}%
                    </>
                  ) : updateStatus === "ready" ? (
                    <>
                      <Download className="size-4" />
                      install v{updateVersion}
                    </>
                  ) : (
                    <>
                      <Download className="size-4" />
                      download & install v{updateVersion}
                    </>
                  )}
                </span>
              </button>
            </motion.div>
          )}
      </AnimatePresence>

      {!isNativeApp && !isIOS && (
        <a
          href={APK_DOWNLOAD_URL}
          className="mt-1 flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground transition-[filter,scale] hover:brightness-105 active:scale-[0.98]"
        >
          <Download className="size-4" />
          download for android
        </a>
      )}
    </motion.section>
  );
}

export { VersionSection };
