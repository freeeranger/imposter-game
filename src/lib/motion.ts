import type { Variants } from "motion/react";

// Shared springs and entrance/exit variants, so screens move the same way everywhere.
export const SPRING = { type: "spring", stiffness: 700, damping: 42 } as const;
export const SOFT_SPRING = {
  type: "spring",
  stiffness: 420,
  damping: 34,
} as const;

export const STAGGER: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.03 } },
};
export const RISE: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: SOFT_SPRING },
};
export const FADE_OUT = { opacity: 0, transition: { duration: 0.1 } };

export const PASS_VARIANTS: Variants = {
  initial: { opacity: 0, x: 36 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { ...SOFT_SPRING, staggerChildren: 0.035 },
  },
  exit: { opacity: 0, scale: 0.97, transition: { duration: 0.1 } },
};
export const PLAYER_POP: Variants = {
  initial: { opacity: 0, scale: 0.7, rotate: -6 },
  animate: {
    opacity: 1,
    scale: 1,
    rotate: 0,
    transition: { type: "spring", stiffness: 520, damping: 22 },
  },
};
export const CARD_VARIANTS: Variants = {
  initial: { opacity: 0, rotateY: -70, rotate: -7, y: 28, scale: 0.92 },
  animate: {
    opacity: 1,
    rotateY: 0,
    rotate: -2,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 320, damping: 26 },
  },
  // Flies off toward the side it was swiped (left when the button is used).
  exit: (direction: number) => ({
    opacity: 0,
    x: direction * 420,
    y: -30,
    rotate: direction * 22,
    transition: { duration: 0.24, ease: [0.5, 0, 0.9, 0.5] as const },
  }),
};
export const POP: Variants = {
  initial: { opacity: 0, scale: 0.4, rotate: -20 },
  animate: {
    opacity: 1,
    scale: 1,
    rotate: 0,
    transition: { type: "spring", stiffness: 560, damping: 20 },
  },
};
export const DROP_CARD: Variants = {
  initial: { opacity: 0, y: -24, rotate: 6, scale: 0.92 },
  animate: {
    opacity: 1,
    y: 0,
    rotate: -1,
    scale: 1,
    transition: { type: "spring", stiffness: 420, damping: 20 },
  },
};
// Kept to a cheap, short tween: 17 tiles springing at once made the sheet feel sluggish.
export const TILE: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.16, ease: "easeOut" },
  },
};
