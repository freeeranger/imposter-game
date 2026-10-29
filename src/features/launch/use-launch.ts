import { useEffect, useEffectEvent, useState } from "react";

import { hideSplashScreen, isNativeApp } from "@/lib/native";
import { useStoredToggle } from "@/lib/storage";

const LAUNCH_ANIMATION_STORAGE_KEY = "imposter-game-launch-animation";

// Dev only: add ?splash to the URL to watch the launch in a browser.
const PREVIEW_SPLASH =
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).has("splash");

// Getting from Android's splash screen to the app. With the launch animation on, the mask
// from the splash takes over and acts out its exit, and the app animates in once the mask
// starts leaving. Off, the splash just fades. On the web there's no splash at all.
export function useLaunch() {
  const [launchAnimationOn, setLaunchAnimationOn] = useStoredToggle(
    LAUNCH_ANIMATION_STORAGE_KEY,
  );

  // Until the splash starts leaving, render nothing so the entrance animation is actually seen.
  const [hasLaunched, setHasLaunched] = useState<boolean>(
    !isNativeApp && !PREVIEW_SPLASH,
  );
  // Decided once at launch, so changing the setting applies from the next one.
  const [showSplashReveal, setShowSplashReveal] = useState<boolean>(
    (isNativeApp && launchAnimationOn) || PREVIEW_SPLASH,
  );
  const [isSplashReady, setIsSplashReady] = useState<boolean>(false);
  const onSplashHidden = useEffectEvent(() =>
    showSplashReveal ? setIsSplashReady(true) : setHasLaunched(true),
  );
  useEffect(() => {
    if (PREVIEW_SPLASH) {
      const timer = window.setTimeout(() => setIsSplashReady(true), 800);
      return () => window.clearTimeout(timer);
    }
    hideSplashScreen(onSplashHidden);
  }, []);

  return {
    hasLaunched,
    showSplashReveal,
    isSplashReady,
    onSplashOpen: () => setHasLaunched(true),
    onSplashDone: () => setShowSplashReveal(false),
    launchAnimationOn,
    setLaunchAnimationOn,
  };
}
