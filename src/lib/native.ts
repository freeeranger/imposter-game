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

// iPadOS reports itself as a Mac, so also check for touch.
export const isIOS =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

// True when opened from the home screen (installed web app) rather than in a browser tab.
export const isInstalledWebApp =
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

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

const SPLASH_FADE_MS = 280;
const SMOOTH_FRAME_MS = 70;
const SMOOTH_FRAMES_NEEDED = 3;
const REVEAL_TIMEOUT_MS = 1500;

// While Android's splash is up the WebView isn't drawing, so animations started then finish
// unseen. Wait until it is actually producing frames again before calling back.
const whenRendering = (callback: () => void) => {
  let lastFrame = 0;
  let smoothFrames = 0;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    callback();
  };
  const tick = (now: number) => {
    smoothFrames = lastFrame && now - lastFrame < SMOOTH_FRAME_MS ? smoothFrames + 1 : 0;
    lastFrame = now;
    if (smoothFrames >= SMOOTH_FRAMES_NEEDED) finish();
    else if (!done) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  window.setTimeout(finish, REVEAL_TIMEOUT_MS);
};

// Once fonts are in, fade the native splash out, then start the app's entrance as soon as
// the screen is really rendering, so the UI animates in instead of just "popping" in.
export const hideSplashScreen = (onReveal: () => void) => {
  if (!isNativeApp) {
    onReveal();
    return;
  }
  void document.fonts.ready.then(() => {
    SplashScreen.hide({ fadeOutDuration: SPLASH_FADE_MS }).catch(() => {});
    whenRendering(onReveal);
  });
};

// On the web the Screen Wake Lock API does the same job; the browser drops the lock whenever
// the page is hidden, so it is re-requested when the page comes back.
let webWakeLock: WakeLockSentinel | null = null;
let wantsWebWakeLock = false;

const requestWebWakeLock = async () => {
  try {
    webWakeLock = await navigator.wakeLock.request("screen");
  } catch {
    // Not allowed right now (e.g. low battery mode); the round still works without it.
  }
};

if (!isNativeApp && "wakeLock" in navigator) {
  document.addEventListener("visibilitychange", () => {
    if (wantsWebWakeLock && document.visibilityState === "visible") {
      void requestWebWakeLock();
    }
  });
}

export const setKeepAwake = (keepAwake: boolean) => {
  if (isNativeApp) {
    runNative(() => (keepAwake ? KeepAwake.keepAwake() : KeepAwake.allowSleep()));
    return;
  }
  if (!("wakeLock" in navigator)) return;
  wantsWebWakeLock = keepAwake;
  if (keepAwake && (!webWakeLock || webWakeLock.released)) {
    void requestWebWakeLock();
  } else if (!keepAwake) {
    void webWakeLock?.release();
    webWakeLock = null;
  }
};

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
  onStart: () => void;
  onProgress: (progress: number, edge: "left" | "right") => void;
  onCancel: () => void;
  onInvoke: () => void;
}) => {
  if (!isNativeApp) return () => {};
  const listeners = [
    PredictiveBack.addListener("backStarted", (event) => {
      handlers.onStart();
      handlers.onProgress(event.progress, event.edge);
    }),
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
