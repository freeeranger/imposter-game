import {
  Capacitor,
  registerPlugin,
  SystemBars,
  SystemBarsStyle,
} from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { KeepAwake } from "@capacitor-community/keep-awake";
import { SplashScreen } from "@capacitor/splash-screen";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { FileTransfer } from "@capacitor/file-transfer";
import { FileOpener } from "@capacitor-community/file-opener";

// Native-only features. Every helper is a safe no-op in the browser.
export const isNativeApp = Capacitor.isNativePlatform();

const runNative = (action: () => Promise<unknown>) => {
  if (!isNativeApp) return;
  action().catch(() => {
    // A missing vibrator or a denied permission should never break the game.
  });
};

let hapticsEnabled = true;

export const setHapticsEnabled = (enabled: boolean) => {
  hapticsEnabled = enabled;
};

const runHaptic = (action: () => Promise<unknown>) => {
  if (hapticsEnabled) runNative(action);
};

export const haptic = {
  tap: () => runHaptic(() => Haptics.impact({ style: ImpactStyle.Light })),
  press: () => runHaptic(() => Haptics.impact({ style: ImpactStyle.Medium })),
  thud: () => runHaptic(() => Haptics.impact({ style: ImpactStyle.Heavy })),
  success: () =>
    runHaptic(() => Haptics.notification({ type: NotificationType.Success })),
};

// Once fonts are in, swap the native splash for the app with a short fade.
export const hideSplashScreen = () => {
  if (!isNativeApp) return;
  void document.fonts.ready.then(() =>
    SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {}),
  );
};

export const setKeepAwake = (keepAwake: boolean) =>
  runNative(() => (keepAwake ? KeepAwake.keepAwake() : KeepAwake.allowSleep()));

export const setSystemBarsTheme = (theme: "light" | "dark") =>
  runNative(() =>
    SystemBars.setStyle({
      // "Dark" means light icons for a dark background.
      style: theme === "dark" ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
    }),
  );

// Our native PredictiveBack plugin (android/app/.../PredictiveBackPlugin.java).
type BackGestureEvent = { progress: number; edge: "left" | "right" };
interface PredictiveBackPlugin {
  setEnabled(options: { enabled: boolean }): Promise<void>;
  addListener(
    eventName: "backStarted" | "backProgressed",
    listener: (event: BackGestureEvent) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "backCancelled" | "backInvoked",
    listener: () => void,
  ): Promise<PluginListenerHandle>;
}
const PredictiveBack = registerPlugin<PredictiveBackPlugin>("PredictiveBack");

// Only intercept back while something in the app can close; otherwise Android plays its back-to-home preview.
export const setBackInterception = (enabled: boolean) =>
  runNative(() => PredictiveBack.setEnabled({ enabled }));

// Returns an unsubscribe function, so it slots straight into a useEffect.
export const onPredictiveBack = (handlers: {
  onProgress: (progress: number, edge: "left" | "right") => void;
  onCancel: () => void;
  onInvoke: () => void;
}) => {
  if (!isNativeApp) return () => {};
  const listeners = [
    PredictiveBack.addListener("backStarted", (event) =>
      handlers.onProgress(event.progress, event.edge),
    ),
    PredictiveBack.addListener("backProgressed", (event) =>
      handlers.onProgress(event.progress, event.edge),
    ),
    PredictiveBack.addListener("backCancelled", handlers.onCancel),
    PredictiveBack.addListener("backInvoked", handlers.onInvoke),
  ];
  return () => {
    listeners.forEach((listener) => void listener.then((handle) => handle.remove()));
  };
};

// In the app, a plain link hands external URLs to the system browser; a new tab would go nowhere.
export const externalLinkTarget = isNativeApp ? undefined : "_blank";

const GITHUB_REPO = "freeeranger/imposter-game";
export const APK_DOWNLOAD_URL = `https://github.com/${GITHUB_REPO}/releases/latest/download/imposter.apk`;

export const fetchLatestVersion = async (): Promise<string | null> => {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      { headers: { Accept: "application/vnd.github+json" } },
    );
    if (!response.ok) return null;
    const release = (await response.json()) as { tag_name?: string };
    return release.tag_name?.replace(/^v/, "") ?? null;
  } catch {
    return null;
  }
};

// Downloads the newest APK into the app cache and returns its file URI.
export const downloadUpdate = async (
  onProgress?: (fraction: number) => void,
): Promise<string> => {
  if (!isNativeApp) throw new Error("In-app updates only exist in the Android app");

  const { uri } = await Filesystem.getUri({
    directory: Directory.Cache,
    path: "imposter-update.apk",
  });
  const listener = onProgress
    ? await FileTransfer.addListener("progress", (status) => {
        if (status.lengthComputable && status.contentLength > 0) {
          onProgress(status.bytes / status.contentLength);
        }
      })
    : null;

  try {
    await FileTransfer.downloadFile({
      url: APK_DOWNLOAD_URL,
      path: uri,
      progress: Boolean(onProgress),
    });
  } finally {
    await listener?.remove();
  }

  return uri;
};

// Hands a downloaded APK to Android's installer, which asks the user to confirm.
export const openUpdateInstaller = (uri: string) =>
  FileOpener.open({
    filePath: uri,
    contentType: "application/vnd.android.package-archive",
  });

export const isNewerVersion = (candidate: string, current: string) => {
  const candidateParts = candidate.split(".").map(Number);
  const currentParts = current.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const a = candidateParts[index] ?? 0;
    const b = currentParts[index] ?? 0;
    if (a !== b) return a > b;
  }
  return false;
};
