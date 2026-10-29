// Categories: the built-in word lists in src/data, the ones players make themselves, and
// which words a category plays at each difficulty.

export type CategoryTag = "new" | "updated";

export type CategoryFile = {
  name: string;
  easy: string[];
  hard: string[];
  tag?: CategoryTag;
  hint?: string;
};

export type Category = {
  label: string;
  easy: string[];
  hard: string[];
  tag?: CategoryTag;
  hint?: string;
  // Made by the players on this device. Only split by difficulty if it has hard words.
  custom?: boolean;
};

// "words" are the easy words when there are hard ones, otherwise all of them.
export type CustomCategory = {
  id: string;
  name: string;
  words: string[];
  hard: string[];
};

export const categoryFiles = import.meta.glob<{ default: CategoryFile }>(
  "../data/*.json",
  { eager: true },
);

export const CATEGORIES: Record<string, Category> = Object.fromEntries(
  Object.entries(categoryFiles).map(([path, module]) => {
    const fileName = path.split("/").pop() ?? path;
    const key = fileName.replace(".json", "");
    const { name, easy, hard, tag, hint } = module.default;
    return [key, { label: name, easy, hard, tag, hint }];
  }),
);

export const CATEGORY_KEYS = Object.keys(CATEGORIES);
export const DEFAULT_CATEGORY = CATEGORY_KEYS[0] ?? "random";

export const CUSTOM_CATEGORIES_STORAGE_KEY = "imposter-game-custom-categories";
export const CUSTOM_KEY_PREFIX = "custom:";
export const MIN_CUSTOM_WORDS = 3;
export const MAX_CUSTOM_NAME_LENGTH = 28;

export const loadCustomCategories = (): CustomCategory[] => {
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(CUSTOM_CATEGORIES_STORAGE_KEY) ?? "[]",
    );
    if (!Array.isArray(parsed)) return [];
    // Storage can be old or hand-edited: keep only usable words and the first of any repeated id.
    const seenIds = new Set<string>();
    return parsed.flatMap((item): CustomCategory[] => {
      if (
        typeof item?.id !== "string" ||
        typeof item?.name !== "string" ||
        !Array.isArray(item?.words) ||
        seenIds.has(item.id)
      ) {
        return [];
      }
      const cleanWords = (value: unknown) =>
        (Array.isArray(value) ? (value as unknown[]) : [])
          .filter((word): word is string => typeof word === "string")
          .map((word) => word.trim())
          .filter(Boolean);
      const words = cleanWords(item.words);
      if (words.length === 0) return [];
      const easy = new Set(words.map((word) => word.toLowerCase()));
      const hard = cleanWords(item.hard).filter(
        (word) => !easy.has(word.toLowerCase()),
      );
      seenIds.add(item.id);
      return [{ id: item.id, name: item.name, words, hard }];
    });
  } catch {
    return [];
  }
};

export const toCategoryMap = (customCategories: CustomCategory[]) =>
  Object.fromEntries(
    customCategories.map((category): [string, Category] => [
      CUSTOM_KEY_PREFIX + category.id,
      {
        label: category.name,
        easy: category.words,
        hard: category.hard,
        custom: true,
      },
    ]),
  );

// A pasted "a, b; c" or list (one per line) becomes separate words. Typed words are kept
// whole, so a word can still contain a comma.
export const splitWords = (text: string) =>
  text
    .split(/[,;\n]+/)
    .map((word) => word.trim())
    .filter(Boolean);

export type Difficulty = "easy" | "hard" | "all";
export const DIFFICULTIES: Difficulty[] = ["easy", "hard", "all"];
export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "easy",
  hard: "hard",
  all: "mix",
};
export const DIFFICULTY_DESCRIPTIONS: Record<Difficulty, string> = {
  easy: "everyday words everyone knows.",
  hard: "trickier words that test your poker face.",
  all: "a mix of obvious and niche words.",
};

export const getCategoryWords = (
  category: Category,
  difficulty: Difficulty,
): string[] => {
  // A custom category with one list plays the same words at every difficulty.
  if (category.custom && category.hard.length === 0) return category.easy;
  if (difficulty === "easy") return category.easy;
  if (difficulty === "hard") return category.hard;
  return [...category.easy, ...category.hard];
};

export const getUniqueCategoryWords = (
  category: Category,
  difficulty: Difficulty,
): string[] => Array.from(new Set(getCategoryWords(category, difficulty)));

export const wordSetKey = (words: string[]) =>
  words
    .map((word) => word.toLowerCase())
    .sort()
    .join("\n");
