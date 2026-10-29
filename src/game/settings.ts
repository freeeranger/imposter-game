import {
  CATEGORIES,
  CATEGORY_KEYS,
  DEFAULT_CATEGORY,
  loadCustomCategories,
  toCategoryMap,
} from "@/game/categories";
import type { Difficulty } from "@/game/categories";

// What's saved between launches: the game setup from the home screen, and the interface
// preferences from settings.

export const INTERFACE_STORAGE_KEY = "imposter-game-interface";

// Kept apart from game settings so "Reset game settings" leaves them alone.
export type InterfacePrefs = {
  hideInfo: boolean;
  hideCustomCategories: boolean;
  hideBuiltinCategories: boolean;
};

export const DEFAULT_INTERFACE_PREFS: InterfacePrefs = {
  hideInfo: false,
  hideCustomCategories: false,
  hideBuiltinCategories: false,
};

export const loadInterfacePrefs = (): InterfacePrefs => {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(INTERFACE_STORAGE_KEY) ?? "{}",
    ) as Partial<InterfacePrefs>;
    const prefs = { ...DEFAULT_INTERFACE_PREFS };
    for (const key of Object.keys(prefs) as (keyof InterfacePrefs)[]) {
      if (typeof parsed[key] === "boolean") prefs[key] = parsed[key];
    }
    // Hiding both would leave nothing to play with.
    if (prefs.hideCustomCategories && prefs.hideBuiltinCategories) {
      prefs.hideCustomCategories = false;
    }
    return prefs;
  } catch {
    return DEFAULT_INTERFACE_PREFS;
  }
};

export const SETTINGS_STORAGE_KEY = "imposter-game-settings";

export type PersistedSettings = {
  playersCount: number;
  impostersCount: number;
  selectedCategory: string;
  // The single category to go back to when leaving random mix.
  lastSingleCategory: string;
  selectedDifficulty: Difficulty;
  randomizeStarter: boolean;
  prankProbability: number;
  revealFellowImposters: boolean;
  randomPool: Record<string, boolean>;
};

export const DEFAULT_SETTINGS: PersistedSettings = {
  playersCount: 4,
  impostersCount: 1,
  selectedCategory: DEFAULT_CATEGORY,
  lastSingleCategory: DEFAULT_CATEGORY,
  selectedDifficulty: "all",
  randomizeStarter: true,
  prankProbability: 5,
  revealFellowImposters: false,
  randomPool: Object.fromEntries(CATEGORY_KEYS.map((key) => [key, true])),
};

export function loadSettings(): PersistedSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<PersistedSettings>;
    const clampInt = (
      value: unknown,
      min: number,
      max: number,
      fallback: number,
    ) =>
      typeof value === "number" && Number.isFinite(value)
        ? Math.min(max, Math.max(min, Math.round(value)))
        : fallback;
    const players = clampInt(
      parsed.playersCount,
      3,
      20,
      DEFAULT_SETTINGS.playersCount,
    );
    const difficulty: Difficulty =
      parsed.selectedDifficulty === "easy" ||
      parsed.selectedDifficulty === "hard" ||
      parsed.selectedDifficulty === "all"
        ? parsed.selectedDifficulty
        : DEFAULT_SETTINGS.selectedDifficulty;
    const customCategoryMap = toCategoryMap(loadCustomCategories());
    const isKnownCategory = (key: unknown): key is string =>
      typeof key === "string" &&
      Boolean(CATEGORIES[key] || customCategoryMap[key]);
    const category =
      parsed.selectedCategory === "random" ||
      isKnownCategory(parsed.selectedCategory)
        ? parsed.selectedCategory
        : DEFAULT_SETTINGS.selectedCategory;
    const lastSingleCategory = isKnownCategory(parsed.lastSingleCategory)
      ? parsed.lastSingleCategory
      : category !== "random"
        ? category
        : DEFAULT_SETTINGS.lastSingleCategory;
    return {
      playersCount: players,
      impostersCount: clampInt(
        parsed.impostersCount,
        1,
        Math.max(1, players - 1),
        DEFAULT_SETTINGS.impostersCount,
      ),
      selectedCategory: category,
      lastSingleCategory,
      selectedDifficulty: difficulty,
      randomizeStarter:
        typeof parsed.randomizeStarter === "boolean"
          ? parsed.randomizeStarter
          : DEFAULT_SETTINGS.randomizeStarter,
      prankProbability: clampInt(
        parsed.prankProbability,
        0,
        100,
        DEFAULT_SETTINGS.prankProbability,
      ),
      revealFellowImposters:
        typeof parsed.revealFellowImposters === "boolean"
          ? parsed.revealFellowImposters
          : DEFAULT_SETTINGS.revealFellowImposters,
      randomPool: {
        ...DEFAULT_SETTINGS.randomPool,
        ...(parsed.randomPool && typeof parsed.randomPool === "object"
          ? parsed.randomPool
          : {}),
      },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
