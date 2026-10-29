import { useEffect, useRef, useState } from "react";
import { animate, useMotionValue } from "motion/react";

import {
  isNativeApp,
  onPredictiveBack,
  setBackInterception,
} from "@/lib/native";

// Something back can close: a sheet, page or dialog.
export type BackLayer<Id extends string = string> = {
  id: Id;
  open: boolean;
  close: () => void;
  // False when closing asks first (e.g. an editor with changes), so it shouldn't preview
  // sliding away during the back swipe.
  previewable?: boolean;
};

type BackNavigationOptions<Id extends string> = {
  // Top-most first: back closes the first open one.
  layers: BackLayer<Id>[];
  // With nothing open, back still has somewhere to go (e.g. out of a round)...
  canGoBackOutsideLayers: boolean;
  // ...and this is what it does.
  goBackOutsideLayers: () => void;
};

// One back for everything: Android's back gesture (with its predictive preview), the browser
// or system back on the web, and Escape. With nothing to go back from, back isn't intercepted,
// so Android plays its own back-to-home and the browser leaves the page.
export function useBackNavigation<Id extends string>({
  layers,
  canGoBackOutsideLayers,
  goBackOutsideLayers,
}: BackNavigationOptions<Id>) {
  const top = layers.find((layer) => layer.open) ?? null;
  const topLayer = top?.id ?? null;
  const canGoBack = topLayer !== null || canGoBackOutsideLayers;

  useEffect(() => {
    setBackInterception(canGoBack);
  }, [canGoBack]);

  // Kept in refs so the native listeners (registered once) always see the latest state.
  const topLayerRef = useRef<Id | null>(topLayer);
  const handleBackRef = useRef<() => void>(() => {});
  useEffect(() => {
    topLayerRef.current = top?.previewable === false ? null : topLayer;
    handleBackRef.current = () => {
      if (top) top.close();
      else goBackOutsideLayers();
    };
  });

  // Web: browser/system back (Android home-screen app, iPhone edge swipe) should close layers
  // too, not leave the page. While there is something to go back from, one extra history
  // entry catches the back press.
  const [webBackPresses, setWebBackPresses] = useState(0);
  const skipNextPopState = useRef(false);
  useEffect(() => {
    if (isNativeApp) return;
    const handlePopState = () => {
      if (skipNextPopState.current) {
        skipNextPopState.current = false;
        return;
      }
      handleBackRef.current();
      setWebBackPresses((count) => count + 1);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);
  useEffect(() => {
    if (isNativeApp) return;
    const hasBackEntry = window.history.state?.imposterBack === true;
    if (canGoBack && !hasBackEntry) {
      window.history.pushState({ imposterBack: true }, "");
    } else if (!canGoBack && hasBackEntry) {
      // Closed some other way: drop the spare entry so back leaves the page as usual.
      skipNextPopState.current = true;
      window.history.back();
    }
  }, [canGoBack, webBackPresses]);

  // Predictive back: the layer being closed follows the swipe until it commits or cancels.
  const backProgress = useMotionValue(0);
  const backEdge = useMotionValue(1);
  const [predictiveBackValues] = useState(() => ({
    progress: backProgress,
    edge: backEdge,
  }));
  const [backTarget, setBackTarget] = useState<Id | null>(null);

  // A new swipe can start while the last one is still settling (the closed layer animating
  // out, or a cancelled preview springing back). It takes over: the pending reset and spring
  // are dropped and the preview moves to whatever layer is on top now.
  const backGesture = useRef<{
    generation: number;
    resetTimer?: number;
    spring?: { stop: () => void };
  }>({ generation: 0 });

  useEffect(
    () =>
      onPredictiveBack({
        onStart: () => {
          const gesture = backGesture.current;
          gesture.generation += 1;
          window.clearTimeout(gesture.resetTimer);
          gesture.spring?.stop();
          setBackTarget(topLayerRef.current);
        },
        onProgress: (progress, edge) => {
          backEdge.set(edge === "left" ? 1 : -1);
          backProgress.set(progress);
        },
        onCancel: () => {
          const gesture = backGesture.current;
          const generation = gesture.generation;
          const spring = animate(backProgress, 0, {
            type: "spring",
            stiffness: 500,
            damping: 40,
          });
          gesture.spring = spring;
          void spring.then(() => {
            if (gesture.generation === generation) setBackTarget(null);
          });
        },
        onInvoke: () => {
          const gesture = backGesture.current;
          const generation = gesture.generation;
          handleBackRef.current();
          // Let the closing layer finish its exit before the preview resets.
          gesture.resetTimer = window.setTimeout(() => {
            if (gesture.generation !== generation) return;
            backProgress.set(0);
            setBackTarget(null);
          }, 320);
        },
      }),
    [backProgress, backEdge],
  );

  // Escape closes the top-most layer, the same way back does.
  const hasOpenLayer = topLayer !== null;
  useEffect(() => {
    if (!hasOpenLayer) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleBackRef.current();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasOpenLayer]);

  return { backTarget, predictiveBackValues, hasOpenLayer };
}
