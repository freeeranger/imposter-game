import { useEffect, useMemo, useState } from "react";

import {
  CATEGORIES,
  CATEGORY_KEYS,
  CUSTOM_CATEGORIES_STORAGE_KEY,
  CUSTOM_KEY_PREFIX,
  DEFAULT_CATEGORY,
  getCategoryWords,
  getUniqueCategoryWords,
  loadCustomCategories,
  toCategoryMap,
} from "@/game/categories";
import type { CustomCategory, Difficulty } from "@/game/categories";
import {
  DEFAULT_SETTINGS,
  INTERFACE_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  loadInterfacePrefs,
  loadSettings,
} from "@/game/settings";
import type { InterfacePrefs, PersistedSettings } from "@/game/settings";
import { writeStorage } from "@/lib/storage";

// Everything set up on the home screen before a round: players, imposters, the category (or
// random mix) and difficulty, the round options, plus the player-made categories and which
// kinds of category are shown. All of it is saved between launches.
export function useGameSetup() {
  const [settings] = useState(loadSettings);

  // ----- Categories and which of them are shown -----
  const [customCategories, setCustomCategories] =
    useState<CustomCategory[]>(loadCustomCategories);
  const allCategories = useMemo(
    () => ({ ...CATEGORIES, ...toCategoryMap(customCategories) }),
    [customCategories],
  );
  const [interfacePrefs, setInterfacePrefs] =
    useState<InterfacePrefs>(loadInterfacePrefs);
  useEffect(() => {
    writeStorage(INTERFACE_STORAGE_KEY, JSON.stringify(interfacePrefs));
  }, [interfacePrefs]);
  const visibleCategoryKeys = (prefs: InterfacePrefs) => ({
    builtin: prefs.hideBuiltinCategories ? [] : CATEGORY_KEYS,
    custom: prefs.hideCustomCategories
      ? []
      : customCategories.map((category) => CUSTOM_KEY_PREFIX + category.id),
  });
  const { builtin: builtinCategoryKeys, custom: customCategoryKeys } =
    visibleCategoryKeys(interfacePrefs);
  const allCategoryKeys = [...builtinCategoryKeys, ...customCategoryKeys];
  // A hidden category can't stay picked; fall back to the first visible one.
  const visibleOr = (key: string, keys = allCategoryKeys) =>
    keys.includes(key) ? key : (keys[0] ?? key);

  useEffect(() => {
    writeStorage(
      CUSTOM_CATEGORIES_STORAGE_KEY,
      JSON.stringify(customCategories),
    );
  }, [customCategories]);

  // ----- The game setup -----
  const [playersCount, setPlayersCount] = useState<number>(
    settings.playersCount,
  );
  const [impostersCount, setImpostersCount] = useState<number>(
    settings.impostersCount,
  );
  const [selectedCategory, setSelectedCategory] = useState<string | "random">(
    () =>
      settings.selectedCategory === "random"
        ? "random"
        : visibleOr(settings.selectedCategory),
  );
  // The single category to go back to when leaving random mix.
  const [lastSingleCategory, setLastSingleCategory] = useState<string>(() =>
    visibleOr(settings.lastSingleCategory),
  );
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>(
    settings.selectedDifficulty,
  );
  const [randomizeStarter, setRandomizeStarter] = useState<boolean>(
    settings.randomizeStarter,
  );
  const [prankProbability, setPrankProbability] = useState<number>(
    settings.prankProbability,
  );
  const [revealFellowImposters, setRevealFellowImposters] = useState<boolean>(
    settings.revealFellowImposters,
  );
  const [randomPool, setRandomPool] = useState<Record<string, boolean>>(
    settings.randomPool,
  );
  // Categories with no entry yet (e.g. newly made custom ones) count as included.
  const isInPool = (key: string) => randomPool[key] !== false;

  useEffect(() => {
    writeStorage(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        playersCount,
        impostersCount,
        selectedCategory,
        lastSingleCategory,
        selectedDifficulty,
        randomizeStarter,
        prankProbability,
        revealFellowImposters,
        randomPool,
      } satisfies PersistedSettings),
    );
  }, [
    playersCount,
    impostersCount,
    selectedCategory,
    lastSingleCategory,
    selectedDifficulty,
    randomizeStarter,
    prankProbability,
    revealFellowImposters,
    randomPool,
  ]);

  // ----- Changes -----
  const applyPlayersCount = (value: number) => {
    setPlayersCount(value);
    if (impostersCount >= value) {
      setImpostersCount(Math.max(1, value - 1));
    }
  };

  const selectSingleCategory = (key: string) => {
    setSelectedCategory(key);
    setLastSingleCategory(key);
  };

  const setInterfacePref = (key: keyof InterfacePrefs, value: boolean) => {
    const nextPrefs = { ...interfacePrefs, [key]: value };
    const next = visibleCategoryKeys(nextPrefs);
    const nextKeys = [...next.builtin, ...next.custom];
    setInterfacePrefs(nextPrefs);
    if (selectedCategory !== "random") {
      setSelectedCategory(visibleOr(selectedCategory, nextKeys));
    }
    setLastSingleCategory(visibleOr(lastSingleCategory, nextKeys));
  };

  // You just asked for one of your categories, so make sure "Your categories" shows it.
  const showCustomCategories = () =>
    setInterfacePrefs((prefs) => ({ ...prefs, hideCustomCategories: false }));

  const addCustomCategory = (name: string, words: string[], hard: string[]) => {
    const id = Date.now().toString(36);
    const key = CUSTOM_KEY_PREFIX + id;
    setCustomCategories((categories) => [
      ...categories,
      { id, name, words, hard },
    ]);
    setRandomPool((pool) => ({ ...pool, [key]: true }));
    // A brand-new category is probably the one you want to play.
    if (selectedCategory !== "random") {
      setSelectedCategory(key);
      setLastSingleCategory(key);
    }
  };

  const updateCustomCategory = (saved: CustomCategory) =>
    setCustomCategories((categories) =>
      categories.map((category) =>
        category.id === saved.id ? saved : category,
      ),
    );

  const deleteCustomCategory = (id: string) => {
    const key = CUSTOM_KEY_PREFIX + id;
    setCustomCategories((categories) =>
      categories.filter((category) => category.id !== id),
    );
    setRandomPool((pool) =>
      Object.fromEntries(Object.entries(pool).filter(([item]) => item !== key)),
    );
    const remaining = allCategoryKeys.filter((item) => item !== key);
    const fallback = remaining[0] ?? DEFAULT_CATEGORY;
    if (selectedCategory === key) setSelectedCategory(fallback);
    if (lastSingleCategory === key) setLastSingleCategory(fallback);
  };

  const resetSettings = () => {
    setPlayersCount(DEFAULT_SETTINGS.playersCount);
    setImpostersCount(DEFAULT_SETTINGS.impostersCount);
    setSelectedCategory(visibleOr(DEFAULT_SETTINGS.selectedCategory));
    setLastSingleCategory(visibleOr(DEFAULT_CATEGORY));
    setSelectedDifficulty(DEFAULT_SETTINGS.selectedDifficulty);
    setRandomizeStarter(DEFAULT_SETTINGS.randomizeStarter);
    setPrankProbability(DEFAULT_SETTINGS.prankProbability);
    setRevealFellowImposters(DEFAULT_SETTINGS.revealFellowImposters);
    setRandomPool({ ...DEFAULT_SETTINGS.randomPool });
  };

  // ----- Derived -----
  const isRandomMix = selectedCategory === "random";
  const isSelectedHidden =
    selectedCategory !== "random" &&
    !allCategoryKeys.includes(selectedCategory);
  const selectedCategoryInfo =
    isRandomMix || isSelectedHidden
      ? undefined
      : allCategories[selectedCategory];
  const selectedWordCount = selectedCategoryInfo
    ? getUniqueCategoryWords(selectedCategoryInfo, selectedDifficulty).length
    : 0;
  const randomPoolCount = allCategoryKeys.filter(isInPool).length;
  const hasCategories = allCategoryKeys.length > 0;
  const canRevealFellows = impostersCount >= 2;
  const isStartDisabled =
    !hasCategories ||
    (selectedCategory === "random" &&
      !allCategoryKeys.some(
        (key) =>
          isInPool(key) &&
          getCategoryWords(allCategories[key], selectedDifficulty).length > 0,
      )) ||
    (selectedCategory !== "random" &&
      (isSelectedHidden ||
        getCategoryWords(allCategories[selectedCategory], selectedDifficulty)
          .length === 0)) ||
    impostersCount >= playersCount;

  return {
    customCategories,
    allCategories,
    builtinCategoryKeys,
    customCategoryKeys,
    allCategoryKeys,
    interfacePrefs,
    setInterfacePref,
    showCustomCategories,
    addCustomCategory,
    updateCustomCategory,
    deleteCustomCategory,

    playersCount,
    applyPlayersCount,
    impostersCount,
    setImpostersCount,
    selectedCategory,
    setSelectedCategory,
    lastSingleCategory,
    selectSingleCategory,
    selectedDifficulty,
    setSelectedDifficulty,
    randomizeStarter,
    setRandomizeStarter,
    prankProbability,
    setPrankProbability,
    revealFellowImposters,
    setRevealFellowImposters,
    randomPool,
    setRandomPool,
    isInPool,
    resetSettings,

    isRandomMix,
    selectedCategoryInfo,
    selectedWordCount,
    randomPoolCount,
    hasCategories,
    canRevealFellows,
    isStartDisabled,
  };
}

export type GameSetup = ReturnType<typeof useGameSetup>;
