import { createContext, useContext } from "react";
import type { MotionValue } from "motion/react";

// Live progress of Android's back swipe (0 → 1) and which edge it started from (+1 left, -1 right).
export type PredictiveBackValues = {
  progress: MotionValue<number>;
  edge: MotionValue<number>;
};

export const PredictiveBackContext = createContext<PredictiveBackValues | null>(null);

export const usePredictiveBack = () => useContext(PredictiveBackContext);
