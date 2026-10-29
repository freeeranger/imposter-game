import { useEffect, useRef, useState } from "react";

import {
  APK_DOWNLOAD_URL,
  downloadUpdate,
  fetchLatestVersion,
  haptic,
  isNativeApp,
  isNewerVersion,
  openUpdateInstaller,
} from "@/lib/native";
import { applyPendingWebUpdate } from "@/lib/pwa";
import { readStorage, useStoredToggle, writeStorage } from "@/lib/storage";

export const APP_VERSION = __APP_VERSION__;

const AUTO_UPDATE_STORAGE_KEY = "imposter-game-auto-update";
const DISMISSED_UPDATE_STORAGE_KEY = "imposter-game-dismissed-update";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "latest"
  | "available"
  | "downloading"
  | "ready"
  | "error";

// Android app only: finds newer releases on GitHub, downloads the APK (by itself with
// auto-update on) and hands it to Android's installer once nobody is mid-round.
export function useAppUpdate({ isRoundOver }: { isRoundOver: boolean }) {
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadedUpdateUri, setDownloadedUpdateUri] = useState<string | null>(
    null,
  );
  const [autoUpdate, setAutoUpdate] = useStoredToggle(AUTO_UPDATE_STORAGE_KEY);
  // The update banner can be dismissed per version; a newer release brings it back.
  const [dismissedUpdateVersion, setDismissedUpdateVersion] = useState<
    string | null
  >(() => readStorage(DISMISSED_UPDATE_STORAGE_KEY));
  const autoDownloadStarted = useRef(false);
  const autoInstallPending = useRef(false);

  // Offer the newest APK when GitHub has a newer release than this build.
  useEffect(() => {
    if (!isNativeApp) return;
    let isCancelled = false;
    void fetchLatestVersion().then((latestVersion) => {
      if (isCancelled || !latestVersion) return;
      if (isNewerVersion(latestVersion, APP_VERSION)) {
        setUpdateVersion(latestVersion);
        setUpdateStatus("available");
      } else {
        setUpdateStatus("latest");
      }
    });
    return () => {
      isCancelled = true;
    };
  }, []);

  // Auto-update: fetch a newer APK in the background as soon as one is found.
  useEffect(() => {
    if (!isNativeApp || !autoUpdate || updateStatus !== "available") return;
    if (autoDownloadStarted.current) return;
    autoDownloadStarted.current = true;

    void (async () => {
      setDownloadProgress(0);
      setUpdateStatus("downloading");
      try {
        const uri = await downloadUpdate(setDownloadProgress);
        setDownloadedUpdateUri(uri);
        setUpdateStatus("ready");
        autoInstallPending.current = true;
      } catch {
        setUpdateStatus("available");
      }
    })();
  }, [autoUpdate, updateStatus]);

  // ...and offer it for install once nobody is mid-round. Android still asks to confirm.
  useEffect(() => {
    if (updateStatus !== "ready" || !downloadedUpdateUri) return;
    if (!autoInstallPending.current || !isRoundOver) return;
    autoInstallPending.current = false;
    void openUpdateInstaller(downloadedUpdateUri).catch(() => {});
  }, [updateStatus, downloadedUpdateUri, isRoundOver]);

  const checkForUpdates = async () => {
    haptic.tap();
    setUpdateStatus("checking");
    // A short floor so "checking…" registers instead of flickering.
    const [latestVersion] = await Promise.all([
      fetchLatestVersion(),
      new Promise((resolve) => window.setTimeout(resolve, 500)),
    ]);
    if (!latestVersion) {
      setUpdateStatus("error");
    } else if (isNewerVersion(latestVersion, APP_VERSION)) {
      setUpdateVersion(latestVersion);
      setUpdateStatus("available");
    } else {
      setUpdateStatus("latest");
    }
  };

  const installUpdate = async () => {
    if (updateStatus === "downloading") return;
    haptic.press();
    try {
      if (updateStatus === "ready" && downloadedUpdateUri) {
        await openUpdateInstaller(downloadedUpdateUri);
        return;
      }
      setDownloadProgress(0);
      setUpdateStatus("downloading");
      const uri = await downloadUpdate(setDownloadProgress);
      setDownloadedUpdateUri(uri);
      setUpdateStatus("ready");
      await openUpdateInstaller(uri);
    } catch {
      // Fall back to the browser download if the in-app install fails.
      window.location.href = APK_DOWNLOAD_URL;
      setUpdateStatus((status) =>
        status === "downloading" ? "available" : status,
      );
    }
  };

  const dismissUpdate = () => {
    haptic.tap();
    setDismissedUpdateVersion(updateVersion);
    if (updateVersion) {
      writeStorage(DISMISSED_UPDATE_STORAGE_KEY, updateVersion);
    }
  };

  const hasPendingUpdate =
    updateVersion !== null &&
    (updateStatus === "available" ||
      updateStatus === "downloading" ||
      updateStatus === "ready");

  return {
    updateVersion,
    updateStatus,
    downloadProgress,
    autoUpdate,
    setAutoUpdate,
    checkForUpdates,
    installUpdate,
    dismissUpdate,
    // Auto-update on: a quiet status chip while it downloads / waits to install.
    showUpdateChip:
      hasPendingUpdate && autoUpdate && updateStatus !== "available",
    // Auto-update off: a banner you can install from or dismiss for this version.
    showUpdateBanner:
      hasPendingUpdate &&
      !autoUpdate &&
      dismissedUpdateVersion !== updateVersion,
  };
}

export type AppUpdate = ReturnType<typeof useAppUpdate>;

// Web: take a downloaded update while the app sits in the background somewhere reloading
// loses nothing (settings and categories are saved).
export function useWebUpdateWhenIdle(isIdle: boolean) {
  useEffect(() => {
    if (isNativeApp || !isIdle) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") applyPendingWebUpdate();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isIdle]);
}
