import {
  Fragment,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import licenseText from "../LICENSE?raw";
import type { CSSProperties, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberStepper } from "@/components/ui/number-stepper";
import { RollingNumber } from "@/components/ui/rolling-number";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Page } from "@/components/ui/page";
import { QrCode } from "@/components/ui/qr-code";
import { Sheet } from "@/components/ui/sheet";
import { SplashReveal } from "@/components/splash-reveal";
import type { SplashVariant } from "@/components/splash-reveal";
import { Switch } from "@/components/ui/switch";
import {
  AnimatePresence,
  MotionConfig,
  animate,
  motion,
  useMotionValue,
  useTransform,
} from "motion/react";
import type { Variants } from "motion/react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Download,
  Check,
  Loader2,
  Minus,
  Ellipsis,
  Pencil,
  PenLine,
  Trash2,
  SunMoon,
  Plus,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  Link,
  Eye,
  EyeOff,
  Info,
  Moon,
  Settings,
  Share,
  Share2,
  SquarePlus,
  Music,
  RotateCcw,
  ScanLine,
  Shuffle,
  Sun,
  VenetianMask,
  X,
} from "lucide-react";
import {
  APK_DOWNLOAD_URL,
  externalLinkTarget,
  downloadUpdate,
  fetchLatestVersion,
  hideSplashScreen,
  haptic,
  isIOS,
  isInstalledWebApp,
  isNativeApp,
  isNewerVersion,
  onAppLinkOpened,
  onPredictiveBack,
  openUpdateInstaller,
  setBackInterception,
  setHapticsEnabled,
  setKeepAwake,
  setSystemBarsTheme,
  shareLink,
} from "@/lib/native";
import { useKeyboard } from "@/lib/keyboard";
import { useIsDesktop } from "@/lib/media";
import { PredictiveBackContext } from "@/lib/predictive-back";
import { applyPendingWebUpdate } from "@/lib/pwa";
import { canUseCamera, startQrScanner } from "@/lib/qr-scanner";
import type { ScannerError } from "@/lib/qr-scanner";
import {
  decodeCategory,
  findShareCode,
  shareLinkFor,
  takeShareCodeFromLocation,
} from "@/lib/share";
import { cn } from "@/lib/utils";

type CategoryTag = "new" | "updated";

type CategoryFile = {
  name: string;
  easy: string[];
  hard: string[];
  tag?: CategoryTag;
  hint?: string;
};

type Category = {
  label: string;
  easy: string[];
  hard: string[];
  tag?: CategoryTag;
  hint?: string;
  // Made by the players on this device. Only split by difficulty if it has hard words.
  custom?: boolean;
};

// "words" are the easy words when there are hard ones, otherwise all of them.
type CustomCategory = {
  id: string;
  name: string;
  words: string[];
  hard: string[];
};

const categoryFiles = import.meta.glob<{ default: CategoryFile }>(
  "./data/*.json",
  { eager: true },
);

const CATEGORIES: Record<string, Category> = Object.fromEntries(
  Object.entries(categoryFiles).map(([path, module]) => {
    const fileName = path.split("/").pop() ?? path;
    const key = fileName.replace(".json", "");
    const { name, easy, hard, tag, hint } = module.default;
    return [key, { label: name, easy, hard, tag, hint }];
  }),
);

const APP_VERSION = __APP_VERSION__;

// Dev only: add ?splash (or ?splash=glance) to the URL to watch the launch in a browser.
const SPLASH_PREVIEW = import.meta.env.DEV
  ? new URLSearchParams(window.location.search).get("splash")
  : null;
const PREVIEW_SPLASH = SPLASH_PREVIEW !== null;
const SPLASH_VARIANT: SplashVariant =
  SPLASH_PREVIEW === "glance" ? "glance" : "split";
const HAS_SPLASH = isNativeApp || PREVIEW_SPLASH;

const CATEGORY_KEYS = Object.keys(CATEGORIES);
const DEFAULT_CATEGORY = CATEGORY_KEYS[0] ?? "random";

const CUSTOM_CATEGORIES_STORAGE_KEY = "imposter-game-custom-categories";
const CUSTOM_KEY_PREFIX = "custom:";
const MIN_CUSTOM_WORDS = 3;
const MAX_CUSTOM_NAME_LENGTH = 28;

const loadCustomCategories = (): CustomCategory[] => {
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

const toCategoryMap = (customCategories: CustomCategory[]) =>
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
const splitWords = (text: string) =>
  text
    .split(/[,;\n]+/)
    .map((word) => word.trim())
    .filter(Boolean);
type Difficulty = "easy" | "hard" | "all";
const DIFFICULTIES: Difficulty[] = ["easy", "hard", "all"];
const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "easy",
  hard: "hard",
  all: "mix",
};
const DIFFICULTY_DESCRIPTIONS: Record<Difficulty, string> = {
  easy: "everyday words everyone knows.",
  hard: "trickier words that test your poker face.",
  all: "a mix of obvious and niche words.",
};

// Tags read as little stickers slapped on the corner of a card.
const CategorySticker = ({
  tag,
  onPrimary = false,
  className,
}: {
  tag: CategoryTag;
  onPrimary?: boolean;
  className?: string;
}) => (
  <span
    className={cn(
      "inline-flex shrink-0 items-center rounded-full px-2 text-[10px] leading-4 font-bold",
      tag === "new" ? "rotate-6" : "rotate-[5deg]",
      tag === "new" && !onPrimary && "bg-pink text-pink-foreground",
      tag === "new" && onPrimary && "bg-primary-foreground text-[#ff4fa3]",
      tag === "updated" &&
        (onPrimary
          ? "border-[1.5px] border-primary-foreground text-primary-foreground"
          : "border-[1.5px] border-pink bg-card text-pink"),
      className,
    )}
  >
    {tag}
  </span>
);

const CategoryHint = ({ hint }: { hint?: string }) =>
  hint ? (
    <div className="mx-auto flex max-w-xs items-center gap-2.5 rounded-2xl bg-card px-4 py-3 text-sm font-semibold">
      <Music className="size-4 shrink-0 text-pink" aria-hidden />
      <span>{hint}</span>
    </div>
  ) : null;

const RoundProgress = ({
  current,
  total,
}: {
  current: number;
  total: number;
}) => (
  <div className="flex gap-1.5" aria-hidden="true">
    {Array.from({ length: total }, (_, index) => (
      <span
        key={index}
        className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"
      >
        <motion.span
          className={cn(
            "absolute inset-0 origin-left rounded-full transition-colors duration-300",
            index + 1 === current ? "bg-primary" : "bg-muted-foreground",
          )}
          initial={false}
          animate={{ scaleX: index + 1 <= current ? 1 : 0 }}
          transition={SOFT_SPRING}
        />
      </span>
    ))}
  </div>
);

const RoundHeader = ({
  current,
  total,
  onEnd,
}: {
  current: number;
  total: number;
  onEnd: () => void;
}) => (
  <div className="flex flex-col gap-3.5">
    <div className="flex h-11 items-center justify-between">
      <Button
        variant="secondary"
        size="icon"
        onClick={onEnd}
        aria-label="End game"
      >
        <X className="size-[18px] stroke-[2.2]" />
      </Button>
      <span className="flex items-baseline gap-1 text-[15px] font-bold">
        player <RollingNumber value={current} />
        <span className="font-medium text-muted-foreground">of {total}</span>
      </span>
      <span className="size-11" aria-hidden="true" />
    </div>
    <div className="lg:mx-auto lg:w-full lg:max-w-[720px]">
      <RoundProgress current={current} total={total} />
    </div>
  </div>
);

const SWIPE_OFFSET = 110;
const SWIPE_VELOCITY = 600;

// The secret card: tilts with the finger and can be flicked away to pass the phone.
const SwipeCard = ({
  onSwipe,
  children,
}: {
  onSwipe: (direction: 1 | -1) => void;
  children: ReactNode;
}) => {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-240, 240], [-14, 14]);
  const isPastThreshold = useRef(false);

  return (
    <motion.div
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      whileDrag={{ scale: 1.02 }}
      onDrag={(_, info) => {
        // A small tick when letting go would pass the phone, and again if pulled back.
        const isPast = Math.abs(info.offset.x) > SWIPE_OFFSET;
        if (isPast !== isPastThreshold.current) {
          isPastThreshold.current = isPast;
          haptic.tap();
        }
      }}
      onDragEnd={(_, info) => {
        if (
          Math.abs(info.offset.x) > SWIPE_OFFSET ||
          Math.abs(info.velocity.x) > SWIPE_VELOCITY
        ) {
          onSwipe(info.offset.x > 0 ? 1 : -1);
        }
      }}
      className="flex h-full w-full cursor-grab touch-pan-y flex-col justify-between rounded-[32px] bg-card p-6 shadow-[10px_10px_0_var(--pink)] active:cursor-grabbing lg:p-8 lg:shadow-[12px_12px_0_var(--pink)]"
    >
      {children}
    </motion.div>
  );
};

const SettingRow = ({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) => (
  <div className="flex min-h-[60px] items-center justify-between gap-3 py-2.5">
    <label
      htmlFor={id}
      className="flex min-w-0 cursor-pointer flex-col gap-0.5"
    >
      <span className="text-[15px] font-semibold">{title}</span>
      {description && (
        <span className="text-[13px] text-muted-foreground">{description}</span>
      )}
    </label>
    {children}
  </div>
);

const wordStartSize = (word: string) => {
  if (word.length > 22) return 26;
  if (word.length > 14) return 32;
  return 42;
};
const MIN_WORD_SIZE = 14;

// Lines only break between words; a single word too wide for the card shrinks to fit instead.
const FitWord = ({
  word,
  scale = 1,
  className,
}: {
  word: string;
  // Multiplies the starting size, for the larger desktop card.
  scale?: number;
  className?: string;
}) => {
  const ref = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const parts = el.querySelectorAll("span");
      let size = Math.round(wordStartSize(word) * scale);
      parts.forEach((part) => (part.style.whiteSpace = "nowrap"));
      el.style.fontSize = `${size}px`;
      while (el.scrollWidth > el.clientWidth && size > MIN_WORD_SIZE) {
        size -= 1;
        el.style.fontSize = `${size}px`;
      }
      // Last resort for absurdly long words: break them rather than spill off the card.
      if (el.scrollWidth > el.clientWidth) {
        parts.forEach((part) => (part.style.whiteSpace = "normal"));
      }
    };
    fit();
    // The display font may still be loading, and it is much wider than the fallback.
    void document.fonts.ready.then(fit);
    const observer = new ResizeObserver(fit);
    if (el.parentElement) observer.observe(el.parentElement);
    return () => observer.disconnect();
  }, [word, scale]);
  return (
    <p ref={ref} className={cn("[overflow-wrap:anywhere]", className)}>
      {/* nowrap per word keeps "Counter-Strike" from splitting at its hyphen */}
      {word.split(" ").map((part, index) => (
        <Fragment key={index}>
          {index > 0 && " "}
          <span>{part}</span>
        </Fragment>
      ))}
    </p>
  );
};

const getCategoryWords = (
  category: Category,
  difficulty: Difficulty,
): string[] => {
  // A custom category with one list plays the same words at every difficulty.
  if (category.custom && category.hard.length === 0) return category.easy;
  if (difficulty === "easy") return category.easy;
  if (difficulty === "hard") return category.hard;
  return [...category.easy, ...category.hard];
};

type GameState = "setup" | "pass" | "reveal" | "end";
type Theme = "light" | "dark";
type ThemePreference = Theme | "system";
const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "system" },
  { value: "dark", label: "dark" },
  { value: "light", label: "light" },
];
type PrankMode =
  | "everyone-imposter"
  | "one-crewmate"
  | "different-words"
  | "no-imposter"
  | "two-imposters";
type PlayerAssignment = {
  isImposter: boolean;
  word: string | null;
};

const THEME_STORAGE_KEY = "imposter-game-theme";
const HAPTICS_STORAGE_KEY = "imposter-game-haptics";
const INTERFACE_STORAGE_KEY = "imposter-game-interface";

// Kept apart from game settings so "Reset game settings" leaves them alone.
type InterfacePrefs = {
  hideInfo: boolean;
  hideCustomCategories: boolean;
  hideBuiltinCategories: boolean;
};

const DEFAULT_INTERFACE_PREFS: InterfacePrefs = {
  hideInfo: false,
  hideCustomCategories: false,
  hideBuiltinCategories: false,
};

const loadInterfacePrefs = (): InterfacePrefs => {
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
const AUTO_UPDATE_STORAGE_KEY = "imposter-game-auto-update";
const DISMISSED_UPDATE_STORAGE_KEY = "imposter-game-dismissed-update";
const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";

type NumberPickerKind = "players" | "imposters" | "prank";
const PRANK_PRESETS = [0, 5, 10, 15, 20, 25];

// Layers that close on Android back, top-most first.
type BackLayer =
  | "confirm"
  | "deleteConfirm"
  | "discardConfirm"
  | "share"
  | "import"
  | "add"
  | "actions"
  | "picker"
  | "editor"
  | "installHelp"
  | "license"
  | "settings"
  | "category"
  | "info";

// A category arriving from a share link, already numbered if you have one with its name.
type IncomingCategory =
  | { status: "ok"; name: string; words: string[]; hard: string[] }
  | { status: "duplicate"; name: string }
  | { status: "newer" | "invalid" };

const wordSetKey = (words: string[]) =>
  words
    .map((word) => word.toLowerCase())
    .sort()
    .join("\n");

type UpdateStatus =
  | "idle"
  | "checking"
  | "latest"
  | "available"
  | "downloading"
  | "ready"
  | "error";

// The GPL text is hard-wrapped at ~72 columns; rejoin each paragraph so it flows on a phone.
const LICENSE_PARAGRAPHS = licenseText
  .split(/\n\s*\n/)
  .map((paragraph) =>
    paragraph
      .split("\n")
      .map((line) => line.trim())
      .join(" ")
      .trim(),
  )
  .filter(Boolean);

const AUTHOR_NAME = "Lukas Viering";
const AUTHOR_URL = "https://freeranger.dev";
const WEBSITE_URL = "https://tjeneritz.se";
const range = (from: number, to: number) =>
  Array.from(
    { length: Math.max(0, to - from + 1) },
    (_, index) => from + index,
  );
const SETTINGS_STORAGE_KEY = "imposter-game-settings";

type PersistedSettings = {
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

const DEFAULT_SETTINGS: PersistedSettings = {
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

function loadSettings(): PersistedSettings {
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
const SPRING = { type: "spring", stiffness: 700, damping: 42 } as const;
const SOFT_SPRING = { type: "spring", stiffness: 420, damping: 34 } as const;

const STAGGER: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.03 } },
};
const RISE: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: SOFT_SPRING },
};
const FADE_OUT = { opacity: 0, transition: { duration: 0.1 } };

const PASS_VARIANTS: Variants = {
  initial: { opacity: 0, x: 36 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { ...SOFT_SPRING, staggerChildren: 0.035 },
  },
  exit: { opacity: 0, scale: 0.97, transition: { duration: 0.1 } },
};
const PLAYER_POP: Variants = {
  initial: { opacity: 0, scale: 0.7, rotate: -6 },
  animate: {
    opacity: 1,
    scale: 1,
    rotate: 0,
    transition: { type: "spring", stiffness: 520, damping: 22 },
  },
};
const CARD_VARIANTS: Variants = {
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
const POP: Variants = {
  initial: { opacity: 0, scale: 0.4, rotate: -20 },
  animate: {
    opacity: 1,
    scale: 1,
    rotate: 0,
    transition: { type: "spring", stiffness: 560, damping: 20 },
  },
};
const DROP_CARD: Variants = {
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
const TILE: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.16, ease: "easeOut" },
  },
};

const rollChance = (percent: number) => Math.random() < percent / 100;

const randomPlayerNumber = (playersCount: number) =>
  Math.floor(Math.random() * playersCount) + 1;

const pickRandom = <T,>(items: T[]): T =>
  items[Math.floor(Math.random() * items.length)];

const shuffle = <T,>(items: T[]): T[] => {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }

  return shuffled;
};

const getUniqueCategoryWords = (
  category: Category,
  difficulty: Difficulty,
): string[] => Array.from(new Set(getCategoryWords(category, difficulty)));

function App() {
  const [themePreference, setThemePreference] = useState<ThemePreference>(
    () => {
      if (typeof window === "undefined") return "dark";

      const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (
        savedTheme === "light" ||
        savedTheme === "dark" ||
        savedTheme === "system"
      ) {
        return savedTheme;
      }

      return "dark";
    },
  );
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(
    () => window.matchMedia(SYSTEM_DARK_QUERY).matches,
  );
  const theme: Theme =
    themePreference === "system"
      ? systemPrefersDark
        ? "dark"
        : "light"
      : themePreference;

  // Follow the phone's light/dark switch live while "system" is chosen.
  useEffect(() => {
    const query = window.matchMedia(SYSTEM_DARK_QUERY);
    const handleChange = (event: MediaQueryListEvent) =>
      setSystemPrefersDark(event.matches);
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);
  const [settings] = useState(loadSettings);
  const [customCategories, setCustomCategories] =
    useState<CustomCategory[]>(loadCustomCategories);
  const allCategories = useMemo(
    () => ({ ...CATEGORIES, ...toCategoryMap(customCategories) }),
    [customCategories],
  );
  const [interfacePrefs, setInterfacePrefs] =
    useState<InterfacePrefs>(loadInterfacePrefs);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        INTERFACE_STORAGE_KEY,
        JSON.stringify(interfacePrefs),
      );
    } catch {
      // ignore storage write errors (e.g. private mode)
    }
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
    try {
      window.localStorage.setItem(
        CUSTOM_CATEGORIES_STORAGE_KEY,
        JSON.stringify(customCategories),
      );
    } catch {
      // ignore storage write errors (e.g. private mode)
    }
  }, [customCategories]);
  const [gameState, setGameState] = useState<GameState>("setup");
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
  const [prankActive, setPrankActive] = useState<boolean>(false);

  const [randomPool, setRandomPool] = useState<Record<string, boolean>>(
    settings.randomPool,
  );
  // Categories with no entry yet (e.g. newly made custom ones) count as included.
  const isInPool = (key: string) => randomPool[key] !== false;

  const [playerAssignments, setPlayerAssignments] = useState<
    PlayerAssignment[]
  >([]);
  const [activeCategory, setActiveCategory] = useState<string>(
    DEFAULT_CATEGORY === "random" ? "" : DEFAULT_CATEGORY,
  );
  const [currentPlayer, setCurrentPlayer] = useState<number>(1);
  const [startingPlayer, setStartingPlayer] = useState<number | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<1 | -1>(-1);
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);
  const [showCategorySheet, setShowCategorySheet] = useState<boolean>(false);
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadedUpdateUri, setDownloadedUpdateUri] = useState<string | null>(
    null,
  );
  const [autoUpdate, setAutoUpdate] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(AUTO_UPDATE_STORAGE_KEY) !== "off";
    } catch {
      return true;
    }
  });
  const [showLicense, setShowLicense] = useState<boolean>(false);
  // The update banner can be dismissed per version; a newer release brings it back.
  const [dismissedUpdateVersion, setDismissedUpdateVersion] = useState<
    string | null
  >(() => {
    try {
      return window.localStorage.getItem(DISMISSED_UPDATE_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [showEndConfirm, setShowEndConfirm] = useState<boolean>(false);
  const [showInstallHelp, setShowInstallHelp] = useState<boolean>(false);
  // Custom category editor; the draft stays filled while the page animates away.
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [editorDraft, setEditorDraft] = useState<{
    id: string | null;
    name: string;
    words: string[];
    hard: string[];
    // Easy and hard words in separate lists; "words" holds the easy ones then.
    levels: boolean;
  }>({ id: null, name: "", words: [], hard: [], levels: false });
  // Which list typed words go into while levels are on.
  const [addLevel, setAddLevel] = useState<"easy" | "hard">("easy");
  const [wordDraft, setWordDraft] = useState<string>("");
  const [isWordInputFocused, setIsWordInputFocused] = useState<boolean>(false);
  const keyboard = useKeyboard();
  const editorListEnd = useRef<HTMLDivElement>(null);
  const scrollToNewWord = useRef(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState<boolean>(false);
  // Share sheet for a saved custom category; kept after closing so it can animate away.
  const [showShareSheet, setShowShareSheet] = useState<boolean>(false);
  const [shareCategory, setShareCategory] = useState<{
    name: string;
    words: string[];
    hard: string[];
  } | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState<boolean>(false);
  // A shared category waiting to be added; nothing is saved until you say so.
  const [showImportSheet, setShowImportSheet] = useState<boolean>(false);
  const [incoming, setIncoming] = useState<IncomingCategory>({
    status: "invalid",
  });
  // "new category": create one, or add a shared one from a link or its QR code.
  const [showAddSheet, setShowAddSheet] = useState<boolean>(false);
  const [addMode, setAddMode] = useState<"menu" | "link" | "scan">("menu");
  const [linkDraft, setLinkDraft] = useState<string>("");
  const [linkError, setLinkError] = useState<boolean>(false);
  const [scanStatus, setScanStatus] = useState<
    "starting" | "scanning" | ScannerError
  >("starting");
  const [scannedOtherCode, setScannedOtherCode] = useState<boolean>(false);
  const scannerVideo = useRef<HTMLVideoElement>(null);
  // The ⋯ sheet on one of your categories: share, edit or delete it. Kept after closing so
  // the sheet (and the delete confirm) still know which category it was.
  const [showActionsSheet, setShowActionsSheet] = useState<boolean>(false);
  const [actionsCategory, setActionsCategory] = useState<CustomCategory | null>(
    null,
  );
  const autoDownloadStarted = useRef(false);
  const autoInstallPending = useRef(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [isNumberPickerOpen, setIsNumberPickerOpen] = useState<boolean>(false);
  // Kept after closing so the sheet still has content while it animates away.
  const [numberPickerKind, setNumberPickerKind] =
    useState<NumberPickerKind>("players");
  const [hapticsOn, setHapticsOn] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(HAPTICS_STORAGE_KEY) !== "off";
    } catch {
      return true;
    }
  });

  // Until the splash starts leaving, render nothing so the entrance animation is actually seen.
  const [hasLaunched, setHasLaunched] = useState<boolean>(!HAS_SPLASH);
  // The mask from the native splash takes over and acts out its exit; the app animates
  // in once the mask starts leaving.
  const [showSplashReveal, setShowSplashReveal] = useState<boolean>(HAS_SPLASH);
  const [isSplashReady, setIsSplashReady] = useState<boolean>(false);
  const isDesktop = useIsDesktop();
  useEffect(() => {
    if (PREVIEW_SPLASH) {
      const timer = window.setTimeout(() => setIsSplashReady(true), 800);
      return () => window.clearTimeout(timer);
    }
    hideSplashScreen(() => setIsSplashReady(true));
  }, []);

  useEffect(() => {
    setHapticsEnabled(hapticsOn);
    try {
      window.localStorage.setItem(
        HAPTICS_STORAGE_KEY,
        hapticsOn ? "on" : "off",
      );
    } catch {
      // ignore storage write errors (e.g. private mode)
    }
  }, [hapticsOn]);
  const [lastSingleCategory, setLastSingleCategory] = useState<string>(() =>
    visibleOr(settings.lastSingleCategory),
  );

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

  const isSelectedHidden =
    selectedCategory !== "random" &&
    !allCategoryKeys.includes(selectedCategory);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#15111f" : "#f5f1fc");
    setSystemBarsTheme(theme);
  }, [theme]);

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, themePreference);
    } catch {
      // ignore storage write errors (e.g. private mode)
    }
  }, [themePreference]);

  // App only: offer the newest APK when GitHub has a newer release than this build.
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

  useEffect(() => {
    try {
      window.localStorage.setItem(
        AUTO_UPDATE_STORAGE_KEY,
        autoUpdate ? "on" : "off",
      );
    } catch {
      // ignore storage write errors (e.g. private mode)
    }
  }, [autoUpdate]);

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
    if (!autoInstallPending.current || gameState !== "setup") return;
    autoInstallPending.current = false;
    void openUpdateInstaller(downloadedUpdateUri).catch(() => {});
  }, [updateStatus, downloadedUpdateUri, gameState]);

  // Keep the screen on while the phone is passed around.
  useEffect(() => {
    setKeepAwake(gameState !== "setup");
  }, [gameState]);

  const draftName = editorDraft.name.trim();
  const draftHard = editorDraft.levels ? editorDraft.hard : [];
  const missingWords = Math.max(0, MIN_CUSTOM_WORDS - editorDraft.words.length);
  const missingHardWords = editorDraft.levels
    ? Math.max(0, MIN_CUSTOM_WORDS - editorDraft.hard.length)
    : 0;
  const canSaveDraft =
    draftName.length > 0 && missingWords === 0 && missingHardWords === 0;
  const editorOriginal = customCategories.find(
    (category) => category.id === editorDraft.id,
  );
  const isEditorDirty =
    wordDraft.trim() !== "" ||
    (editorOriginal
      ? draftName !== editorOriginal.name ||
        editorDraft.words.join("\n") !== editorOriginal.words.join("\n") ||
        draftHard.join("\n") !== editorOriginal.hard.join("\n") ||
        editorDraft.levels !== editorOriginal.hard.length > 0
      : draftName !== "" ||
        editorDraft.words.length > 0 ||
        draftHard.length > 0);

  const requestCloseEditor = () => {
    if (isEditorDirty) {
      haptic.tap();
      setShowDiscardConfirm(true);
    } else {
      setIsEditorOpen(false);
    }
  };

  const discardCategoryDraft = () => {
    haptic.press();
    setShowDiscardConfirm(false);
    setIsEditorOpen(false);
  };

  // Android back: close the top-most layer, or step out of a round. With nothing to close,
  // back isn't intercepted at all, so Android plays its own predictive back-to-home.
  const topLayer: BackLayer | null = showEndConfirm
    ? "confirm"
    : showDeleteConfirm
      ? "deleteConfirm"
      : showDiscardConfirm
        ? "discardConfirm"
        : showShareSheet
          ? "share"
          : showImportSheet
            ? "import"
            : showAddSheet
              ? "add"
              : showActionsSheet
                ? "actions"
                : isNumberPickerOpen
                  ? "picker"
                  : isEditorOpen
                    ? "editor"
                    : showInstallHelp
                      ? "installHelp"
                      : showLicense
                        ? "license"
                        : showSettings
                          ? "settings"
                          : showCategorySheet
                            ? "category"
                            : showInfoModal
                              ? "info"
                              : null;
  const canGoBack = topLayer !== null || gameState !== "setup";

  useEffect(() => {
    setBackInterception(canGoBack);
  }, [canGoBack]);

  // Kept in refs so the native listeners (registered once) always see the latest state.
  const topLayerRef = useRef<BackLayer | null>(topLayer);
  const handleBackRef = useRef<() => void>(() => {});
  useEffect(() => {
    // A draft with changes asks before closing, so it shouldn't preview sliding away.
    topLayerRef.current =
      topLayer === "editor" && isEditorDirty ? null : topLayer;
    handleBackRef.current = () => {
      if (showEndConfirm) {
        setShowEndConfirm(false);
      } else if (showDeleteConfirm) {
        setShowDeleteConfirm(false);
      } else if (showDiscardConfirm) {
        setShowDiscardConfirm(false);
      } else if (showShareSheet) {
        setShowShareSheet(false);
      } else if (showImportSheet) {
        setShowImportSheet(false);
      } else if (showActionsSheet) {
        setShowActionsSheet(false);
      } else if (showAddSheet) {
        if (addMode === "menu") {
          setShowAddSheet(false);
        } else {
          setAddMode("menu");
        }
      } else if (isNumberPickerOpen) {
        setIsNumberPickerOpen(false);
      } else if (isEditorOpen) {
        requestCloseEditor();
      } else if (showInstallHelp) {
        setShowInstallHelp(false);
      } else if (showLicense) {
        setShowLicense(false);
      } else if (showSettings) {
        setShowSettings(false);
      } else if (showCategorySheet) {
        setShowCategorySheet(false);
      } else if (showInfoModal) {
        setShowInfoModal(false);
      } else if (gameState === "pass" || gameState === "reveal") {
        haptic.tap();
        setShowEndConfirm(true);
      } else if (gameState === "end") {
        setGameState("setup");
      }
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

  // Web: take a downloaded update while the app sits in the background on the setup screen,
  // where reloading loses nothing (settings and categories are saved).
  const isIdleForUpdate = gameState === "setup" && !isEditorOpen;
  useEffect(() => {
    if (isNativeApp || !isIdleForUpdate) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") applyPendingWebUpdate();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isIdleForUpdate]);

  // Predictive back: the layer being closed follows the swipe until it commits or cancels.
  const backProgress = useMotionValue(0);
  const backEdge = useMotionValue(1);
  const [predictiveBackValues] = useState(() => ({
    progress: backProgress,
    edge: backEdge,
  }));
  const [backTarget, setBackTarget] = useState<BackLayer | null>(null);

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

  useEffect(() => {
    try {
      window.localStorage.setItem(
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
    } catch {
      // ignore storage write errors (e.g. private mode)
    }
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

  const startGame = () => {
    if (playersCount < 3) return; // Need at least 3 players

    const availableCategories =
      selectedCategory === "random"
        ? allCategoryKeys.filter(
            (key) =>
              isInPool(key) &&
              getUniqueCategoryWords(allCategories[key], selectedDifficulty)
                .length > 0,
          )
        : allCategoryKeys.includes(selectedCategory)
          ? [selectedCategory]
          : [];

    if (availableCategories.length === 0) return;

    const chosenCategory = pickRandom(availableCategories);
    const categoryWords = getUniqueCategoryWords(
      allCategories[chosenCategory],
      selectedDifficulty,
    );

    if (categoryWords.length === 0) return;

    let assignments: PlayerAssignment[];

    const shouldUsePrank = prankProbability > 0 && rollChance(prankProbability);

    if (shouldUsePrank) {
      const availablePranks: PrankMode[] = ["no-imposter"];

      // Imposters who know each other would notice nobody is listed and smell the prank.
      if (!(revealFellowImposters && impostersCount >= 2)) {
        availablePranks.push("everyone-imposter");

        // With that many imposters already set, a lone crewmate is just a normal round.
        if (impostersCount < playersCount - 1) {
          availablePranks.push("one-crewmate");
        }
      }

      if (categoryWords.length >= playersCount) {
        availablePranks.push("different-words");
      }

      if (impostersCount === 1 && playersCount >= 3) {
        availablePranks.push("two-imposters");
      }

      const prankMode = pickRandom(availablePranks);

      if (prankMode === "everyone-imposter") {
        assignments = Array.from({ length: playersCount }, () => ({
          isImposter: true,
          word: null,
        }));
      } else if (prankMode === "one-crewmate") {
        const crewmateIndex = randomPlayerNumber(playersCount) - 1;
        const sharedWord = pickRandom(categoryWords);
        assignments = Array.from({ length: playersCount }, (_, index) => ({
          isImposter: index !== crewmateIndex,
          word: index === crewmateIndex ? sharedWord : null,
        }));
      } else if (prankMode === "different-words") {
        assignments = shuffle(categoryWords)
          .slice(0, playersCount)
          .map((word) => ({
            isImposter: false,
            word,
          }));
      } else if (prankMode === "two-imposters") {
        const imposterIndices = new Set(
          shuffle(
            Array.from({ length: playersCount }, (_, index) => index),
          ).slice(0, 2),
        );
        const sharedWord = pickRandom(categoryWords);
        assignments = Array.from({ length: playersCount }, (_, index) => ({
          isImposter: imposterIndices.has(index),
          word: imposterIndices.has(index) ? null : sharedWord,
        }));
      } else {
        const sharedWord = pickRandom(categoryWords);
        assignments = Array.from({ length: playersCount }, () => ({
          isImposter: false,
          word: sharedWord,
        }));
      }
    } else {
      const imposterIndices = new Set(
        shuffle(
          Array.from({ length: playersCount }, (_, index) => index),
        ).slice(0, impostersCount),
      );
      const sharedWord = pickRandom(categoryWords);

      assignments = Array.from({ length: playersCount }, (_, index) => ({
        isImposter: imposterIndices.has(index),
        word: imposterIndices.has(index) ? null : sharedWord,
      }));
    }

    setPlayerAssignments(assignments);
    setActiveCategory(chosenCategory);
    setCurrentPlayer(1);
    setPrankActive(shouldUsePrank);

    if (randomizeStarter) {
      setStartingPlayer(randomPlayerNumber(playersCount));
    } else {
      setStartingPlayer(null);
    }

    haptic.press();
    setGameState("pass");
  };

  const nextTurn = () => {
    if (currentPlayer < playersCount) {
      haptic.tap();
      setCurrentPlayer(currentPlayer + 1);
      setGameState("pass");
    } else {
      haptic.success();
      setGameState("end");
    }
  };

  const revealRole = () => {
    if (playerAssignments[currentPlayer - 1]?.isImposter) {
      haptic.thud();
    } else {
      haptic.press();
    }
    setGameState("reveal");
  };

  const resetToSetup = () => {
    setGameState("setup");
  };

  const endGame = () => {
    haptic.tap();
    setShowEndConfirm(true);
  };

  const confirmEndGame = () => {
    haptic.press();
    setShowEndConfirm(false);
    resetToSetup();
  };

  const pickSingleCategory = (key: string) => {
    setSelectedCategory(key);
    setLastSingleCategory(key);
    // Let the selection pill glide to the new tile before the sheet drops away.
    window.setTimeout(() => setShowCategorySheet(false), 150);
  };

  const passWithButton = () => {
    setSwipeDirection(-1);
    nextTurn();
  };

  const passWithSwipe = (direction: 1 | -1) => {
    setSwipeDirection(direction);
    nextTurn();
  };

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
    try {
      if (updateVersion) {
        window.localStorage.setItem(
          DISMISSED_UPDATE_STORAGE_KEY,
          updateVersion,
        );
      }
    } catch {
      // ignore storage write errors (e.g. private mode)
    }
  };

  const openCategoryEditor = (category?: CustomCategory) => {
    haptic.tap();
    setEditorDraft(
      category
        ? {
            id: category.id,
            name: category.name,
            words: [...category.words],
            hard: [...category.hard],
            levels: category.hard.length > 0,
          }
        : { id: null, name: "", words: [], hard: [], levels: false },
    );
    setAddLevel("easy");
    setWordDraft("");
    setIsEditorOpen(true);
  };

  const addDraftWords = (words: string[]) => {
    if (words.length === 0) return;
    haptic.tap();
    setEditorDraft((draft) => {
      const field = draft.levels && addLevel === "hard" ? "hard" : "words";
      // A word lives in one list only, so check both.
      const seen = new Set(
        [...draft.words, ...draft.hard].map((word) => word.toLowerCase()),
      );
      const nextWords = [...draft[field]];
      for (const word of words) {
        if (seen.has(word.toLowerCase())) continue;
        seen.add(word.toLowerCase());
        nextWords.push(word);
      }
      return { ...draft, [field]: nextWords };
    });
    scrollToNewWord.current = true;
  };

  // Keep the newest word in view just above the docked input, also when the keyboard
  // opens and the list gets shorter.
  useEffect(() => {
    if (!scrollToNewWord.current) return;
    scrollToNewWord.current = false;
    editorListEnd.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [editorDraft.words.length, editorDraft.hard.length]);
  const isTypingWords = keyboard.open && isWordInputFocused;
  useEffect(() => {
    if (isTypingWords) editorListEnd.current?.scrollIntoView({ block: "end" });
  }, [isTypingWords]);

  const setDraftLevels = (levels: boolean) => {
    setAddLevel("easy");
    setEditorDraft((draft) =>
      levels
        ? { ...draft, levels }
        : // Back to one list: the hard words join the rest.
          {
            ...draft,
            levels,
            words: [...draft.words, ...draft.hard],
            hard: [],
          },
    );
  };

  const removeDraftWord = (field: "words" | "hard", word: string) => {
    haptic.tap();
    setEditorDraft((draft) => ({
      ...draft,
      [field]: draft[field].filter((item) => item !== word),
    }));
  };

  const moveDraftWord = (from: "words" | "hard", word: string) => {
    haptic.tap();
    const to = from === "words" ? "hard" : "words";
    setEditorDraft((draft) => ({
      ...draft,
      [from]: draft[from].filter((item) => item !== word),
      [to]: [...draft[to], word],
    }));
  };

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

  const saveCategoryDraft = () => {
    if (!canSaveDraft) return;
    haptic.success();
    const id = editorDraft.id;
    if (id) {
      const saved: CustomCategory = {
        id,
        name: draftName,
        words: editorDraft.words,
        hard: draftHard,
      };
      setCustomCategories((categories) =>
        categories.map((category) => (category.id === id ? saved : category)),
      );
    } else {
      addCustomCategory(draftName, editorDraft.words, draftHard);
    }
    setIsEditorOpen(false);
  };

  const openShareSheet = (category: {
    name: string;
    words: string[];
    hard: string[];
  }) => {
    haptic.tap();
    setShareCategory(category);
    setShareUrl(null);
    setLinkCopied(false);
    setShowShareSheet(true);
    void shareLinkFor({
      name: category.name,
      easy: category.words,
      hard: category.hard,
    }).then(setShareUrl);
  };

  const canUseShareMenu =
    isNativeApp || (typeof navigator !== "undefined" && "share" in navigator);
  const sendShareLink = async () => {
    if (!shareCategory || !shareUrl) return;
    haptic.tap();
    try {
      const result = await shareLink({
        title: shareCategory.name,
        text: `Add "${shareCategory.name}" to Imposter:`,
        url: shareUrl,
      });
      if (result === "copied") {
        haptic.success();
        setLinkCopied(true);
      }
    } catch {
      // The browser refused the clipboard; the QR code still works.
    }
  };

  const showIncoming = (next: IncomingCategory) => {
    setIncoming(next);
    setShowImportSheet(true);
  };

  // A name nobody uses yet: "Skolan" becomes "Skolan (2)", still within the name limit.
  const freeCategoryName = (name: string) => {
    const taken = new Set(
      customCategories.map((category) => category.name.toLowerCase()),
    );
    if (!taken.has(name.toLowerCase())) return name;
    for (let number = 2; ; number += 1) {
      const suffix = ` (${number})`;
      const numbered =
        name.slice(0, MAX_CUSTOM_NAME_LENGTH - suffix.length).trimEnd() +
        suffix;
      if (!taken.has(numbered.toLowerCase())) return numbered;
    }
  };

  const receiveShareCode = async (code: string) => {
    const result = await decodeCategory(code);
    if (result.status !== "ok") {
      haptic.tap();
      showIncoming(result);
      return;
    }
    const { name, easy } = result.category;
    const easyKeys = new Set(easy.map((word) => word.toLowerCase()));
    const hardOnly = result.category.hard.filter(
      (word) => !easyKeys.has(word.toLowerCase()),
    );
    // Easy and hard stay apart only if both have enough words to play; else it's one list.
    const levels =
      easy.length >= MIN_CUSTOM_WORDS && hardOnly.length >= MIN_CUSTOM_WORDS;
    const words = levels ? easy : [...easy, ...hardOnly];
    const hard = levels ? hardOnly : [];
    if (words.length < MIN_CUSTOM_WORDS) {
      haptic.tap();
      showIncoming({ status: "invalid" });
      return;
    }
    const duplicate = customCategories.find(
      (category) =>
        category.name.toLowerCase() === name.toLowerCase() &&
        wordSetKey(category.words) === wordSetKey(words) &&
        wordSetKey(category.hard) === wordSetKey(hard),
    );
    if (duplicate) {
      haptic.tap();
      showIncoming({ status: "duplicate", name: duplicate.name });
      return;
    }
    haptic.press();
    showIncoming({ status: "ok", name: freeCategoryName(name), words, hard });
  };

  // Opened from a share link: in the browser it's in the address bar, in the app it arrives
  // as an App Link (at launch, or while the app is already open).
  const onShareLinkOpened = useEffectEvent((url: string | null) => {
    const code =
      url === null ? takeShareCodeFromLocation() : findShareCode(url);
    if (url === null && code === null) return;
    void receiveShareCode(code ?? "");
  });
  useEffect(() => {
    onShareLinkOpened(null);
    return onAppLinkOpened(onShareLinkOpened);
  }, []);

  const openAddSheet = () => {
    haptic.tap();
    setAddMode("menu");
    setShowAddSheet(true);
  };

  const openAddMode = (mode: "link" | "scan") => {
    haptic.tap();
    setLinkDraft("");
    setLinkError(false);
    setScanStatus("starting");
    setScannedOtherCode(false);
    setAddMode(mode);
  };

  const submitLink = () => {
    const code = findShareCode(linkDraft);
    if (code === null) {
      haptic.tap();
      setLinkError(true);
      return;
    }
    setShowAddSheet(false);
    void receiveShareCode(code);
  };

  // True once a category's code is read, which ends the scan.
  const onScannedText = useEffectEvent((text: string) => {
    const code = findShareCode(text);
    if (code === null) {
      setScannedOtherCode(true);
      return false;
    }
    setShowAddSheet(false);
    void receiveShareCode(code);
    return true;
  });
  const isScanning = showAddSheet && addMode === "scan";
  useEffect(() => {
    const video = scannerVideo.current;
    if (!isScanning || !video) return;
    let done = false;
    let stop: (() => void) | undefined;
    startQrScanner(video, (text) => {
      if (done || !onScannedText(text)) return;
      done = true;
      stop?.();
    })
      .then((stopScanner) => {
        stop = stopScanner;
        if (done) stopScanner();
        else setScanStatus("scanning");
      })
      .catch((error: ScannerError) => {
        if (!done) setScanStatus(error);
      });
    return () => {
      done = true;
      stop?.();
    };
  }, [isScanning]);

  const addIncomingCategory = () => {
    if (incoming.status !== "ok") return;
    haptic.success();
    addCustomCategory(incoming.name, incoming.words, incoming.hard);
    // You just asked for this one, so make sure "Your categories" shows it.
    setInterfacePrefs((prefs) => ({ ...prefs, hideCustomCategories: false }));
    setShowImportSheet(false);
  };

  const openCategoryActions = (category: CustomCategory) => {
    haptic.tap();
    setActionsCategory(category);
    setShowActionsSheet(true);
  };

  const deleteActionsCategory = () => {
    const id = actionsCategory?.id;
    if (!id) return;
    haptic.press();
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
    setShowDeleteConfirm(false);
    setShowActionsSheet(false);
  };

  const applyPlayersCount = (value: number) => {
    setPlayersCount(value);
    if (impostersCount >= value) {
      setImpostersCount(Math.max(1, value - 1));
    }
  };

  const openNumberPicker = (kind: NumberPickerKind) => {
    haptic.tap();
    setNumberPickerKind(kind);
    setIsNumberPickerOpen(true);
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

  const hasCategories = allCategoryKeys.length > 0;
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

  const panelKey =
    gameState === "pass" || gameState === "reveal"
      ? `${gameState}-${currentPlayer}`
      : gameState;
  const isInRound = gameState === "pass" || gameState === "reveal";

  let primaryLabel = "let’s play";
  let primaryIcon: LucideIcon = ArrowRight;
  let primaryIconAtEnd = true;
  let primaryDisabled = isStartDisabled;
  let primaryAction = startGame;

  if (gameState === "pass") {
    primaryLabel = `i’m player ${currentPlayer}, show me`;
    primaryIcon = Eye;
    primaryIconAtEnd = false;
    primaryDisabled = false;
    primaryAction = revealRole;
  } else if (gameState === "reveal") {
    primaryLabel =
      currentPlayer < playersCount
        ? `hide & pass to player ${currentPlayer + 1}`
        : "hide & finish";
    primaryIcon = EyeOff;
    primaryIconAtEnd = false;
    primaryDisabled = false;
    primaryAction = passWithButton;
  } else if (gameState === "end") {
    primaryLabel = "play again";
    primaryIcon = RotateCcw;
    primaryIconAtEnd = false;
    primaryDisabled = false;
    primaryAction = resetToSetup;
  }

  const PrimaryIcon = primaryIcon;
  const currentAssignment = playerAssignments[currentPlayer - 1];
  const githubRepoUrl = "https://github.com/freeeranger/imposter-game";

  const imposterNumbers = playerAssignments
    .map((assignment, index) => (assignment.isImposter ? index + 1 : null))
    .filter((value): value is number => value !== null);
  const showFellowImposters =
    revealFellowImposters &&
    !prankActive &&
    (currentAssignment?.isImposter ?? false) &&
    imposterNumbers.length >= 2;
  const fellowImposters = showFellowImposters
    ? imposterNumbers.filter((number) => number !== currentPlayer)
    : [];

  const isRandomMix = selectedCategory === "random";
  const selectedCategoryInfo =
    isRandomMix || isSelectedHidden
      ? undefined
      : allCategories[selectedCategory];
  const randomPoolCount = allCategoryKeys.filter(isInPool).length;
  const numberPicker = {
    players: {
      title: "players",
      options: range(3, 20),
      value: playersCount,
      apply: applyPlayersCount,
      suffix: "",
    },
    imposters: {
      title: "imposters",
      options: range(1, Math.max(1, playersCount - 1)),
      value: impostersCount,
      apply: setImpostersCount,
      suffix: "",
    },
    prank: {
      title: "prank rounds",
      options: PRANK_PRESETS,
      value: prankProbability,
      apply: setPrankProbability,
      suffix: "%",
    },
  }[numberPickerKind];
  const hasPendingUpdate =
    updateVersion !== null &&
    (updateStatus === "available" ||
      updateStatus === "downloading" ||
      updateStatus === "ready");
  const showUpdateChip =
    hasPendingUpdate && autoUpdate && updateStatus !== "available";
  const showUpdateBanner =
    hasPendingUpdate && !autoUpdate && dismissedUpdateVersion !== updateVersion;
  const selectedWordCount = selectedCategoryInfo
    ? getUniqueCategoryWords(selectedCategoryInfo, selectedDifficulty).length
    : 0;
  const activeCategoryInfo = allCategories[activeCategory];
  const canRevealFellows = impostersCount >= 2;

  // The setup play button sits in the desktop hero; everywhere else it is docked in the footer.
  const renderPrimaryButton = () => (
    <Button
      onClick={primaryAction}
      size="lg"
      // Below 360px "hide & pass to player 20" needs smaller type to fit.
      className="relative w-full overflow-hidden max-[359px]:px-4 max-[359px]:text-[15px]"
      disabled={primaryDisabled}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={primaryLabel}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -18 }}
          transition={SPRING}
          className="flex items-center gap-2"
        >
          {!primaryIconAtEnd && (
            <PrimaryIcon className="size-5 stroke-[2.4] max-[359px]:hidden" />
          )}
          {primaryLabel}
          {primaryIconAtEnd && (
            <PrimaryIcon className="size-[22px] stroke-[2.6]" />
          )}
          {primaryKey && (
            <kbd className="ml-1.5 rounded-lg bg-primary-foreground/15 px-2 py-1 font-sans text-[13px] font-bold tracking-normal">
              {primaryKey}
            </kbd>
          )}
        </motion.span>
      </AnimatePresence>
    </Button>
  );
  // Desktop: space or enter presses the primary button during a round, shown as a key hint on it.
  const primaryKey =
    isDesktop && gameState !== "setup"
      ? gameState === "end"
        ? "enter"
        : "space"
      : null;
  const onPrimaryKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== " " && event.key !== "Enter") return;
    // Holding the key must not run through the players; a focused control handles its own keys.
    if (event.repeat || hasOpenLayer) return;
    if (
      event.target instanceof Element &&
      event.target.closest("button, a, input, textarea, [role='button']")
    ) {
      return;
    }
    event.preventDefault();
    primaryAction();
  });
  useEffect(() => {
    if (!primaryKey) return;
    const handleKeyDown = (event: KeyboardEvent) => onPrimaryKey(event);
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [primaryKey]);

  const startHint = (
    <AnimatePresence initial={false}>
      {gameState === "setup" && primaryDisabled && (
        <motion.p
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={SPRING}
          className="overflow-hidden pt-2 text-center text-[13px] font-semibold text-pink"
        >
          {impostersCount >= playersCount
            ? "need more players than imposters."
            : !hasCategories
              ? "make a category to play."
              : isRandomMix
                ? "pick at least one category for the random mix."
                : "this category has no words to play with."}
        </motion.p>
      )}
    </AnimatePresence>
  );

  const renderCategoryTile = (key: string) => {
    const category = allCategories[key];

    if (!isRandomMix) {
      const isSelected = key === selectedCategory;
      const customCategory = category.custom
        ? customCategories.find((item) => CUSTOM_KEY_PREFIX + item.id === key)
        : undefined;
      const tile = (
        <motion.button
          key={key}
          variants={TILE}
          whileTap={{ scale: 0.96 }}
          type="button"
          aria-pressed={isSelected}
          onClick={() => {
            haptic.tap();
            pickSingleCategory(key);
          }}
          className={cn(
            "relative isolate flex h-[54px] w-full cursor-pointer flex-col items-start justify-center gap-0.5 rounded-2xl bg-secondary px-3.5 text-left transition-colors duration-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60",
            customCategory && "pr-11",
            isSelected
              ? "text-primary-foreground"
              : "text-secondary-foreground",
          )}
        >
          {/* Pops in place: a pill gliding across a 2-column grid would cut over other tiles. */}
          <AnimatePresence initial={false}>
            {isSelected && (
              <motion.span
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={SPRING}
                className="absolute inset-0 -z-10 rounded-2xl bg-primary"
              />
            )}
          </AnimatePresence>
          <span
            className={cn(
              "max-w-full truncate text-[15px] leading-tight lowercase",
              isSelected ? "font-bold" : "font-semibold",
            )}
          >
            {category.label}
          </span>
          <span
            className={cn(
              "flex items-center gap-1.5 text-xs whitespace-nowrap transition-colors duration-200",
              isSelected
                ? "text-primary-foreground/70"
                : "text-muted-foreground/80",
            )}
          >
            {getUniqueCategoryWords(category, selectedDifficulty).length} words
            {category.tag && (
              <CategorySticker tag={category.tag} onPrimary={isSelected} />
            )}
          </span>
        </motion.button>
      );
      if (!customCategory) return tile;
      return (
        <div key={key} className="relative">
          {tile}
          <button
            type="button"
            aria-label={`Options for ${category.label}`}
            onClick={() => openCategoryActions(customCategory)}
            className={cn(
              "absolute top-1/2 right-1 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60",
              isSelected
                ? "text-primary-foreground/80 hover:text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Ellipsis className="size-5" />
          </button>
        </div>
      );
    }

    const isIncluded = isInPool(key);
    return (
      <motion.button
        key={key}
        variants={TILE}
        whileTap={{ scale: 0.96 }}
        type="button"
        role="checkbox"
        aria-checked={isIncluded}
        onClick={() => {
          haptic.tap();
          setRandomPool((prev) => ({
            ...prev,
            [key]: !isIncluded,
          }));
        }}
        className={cn(
          "relative flex h-[54px] cursor-pointer flex-col items-start justify-center gap-0.5 rounded-2xl border-[1.5px] px-3.5 text-left transition-colors duration-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60",
          isIncluded
            ? "border-transparent bg-secondary text-secondary-foreground"
            : "border-border bg-transparent text-muted-foreground",
        )}
      >
        <span
          className={cn(
            "max-w-[calc(100%-1.75rem)] truncate text-[15px] leading-tight lowercase",
            isIncluded ? "font-semibold" : "font-medium line-through",
          )}
        >
          {category.label}
        </span>
        <span className="flex items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground/80">
          {getUniqueCategoryWords(category, selectedDifficulty).length} words
          {category.tag && <CategorySticker tag={category.tag} />}
        </span>
        <span
          className="absolute top-2 right-2.5 flex size-5 items-center justify-center rounded-full border-2 border-muted-foreground/60"
          aria-hidden="true"
        >
          <AnimatePresence initial={false}>
            {isIncluded && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: "spring", stiffness: 800, damping: 32 }}
                className="absolute -inset-0.5 flex items-center justify-center rounded-full bg-primary text-primary-foreground"
              >
                <Check className="size-3 stroke-[3.5]" />
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      </motion.button>
    );
  };

  return (
    <PredictiveBackContext.Provider value={predictiveBackValues}>
      <MotionConfig reducedMotion="user">
        {showSplashReveal && (
          <SplashReveal
            variant={SPLASH_VARIANT}
            play={isSplashReady}
            onOpen={() => setHasLaunched(true)}
            onDone={() => setShowSplashReveal(false)}
          />
        )}
        <div className="relative flex h-dvh w-full justify-center overflow-hidden bg-background text-foreground transition-colors select-none">
          <div className="flex h-full w-full max-w-md flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] lg:max-w-6xl lg:pt-8 lg:pr-12 lg:pb-10 lg:pl-12">
            {/* Top bar: stays put while the content below changes */}
            <div className="shrink-0">
              <AnimatePresence mode="wait">
                {hasLaunched && gameState === "setup" && (
                  <motion.header
                    key="setup-bar"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0, transition: SOFT_SPRING }}
                    exit={FADE_OUT}
                    className="flex h-11 items-center justify-between lg:justify-end"
                  >
                    <h1 className="font-display text-[28px] font-extrabold leading-none tracking-[-0.03em] lg:hidden">
                      imposter
                    </h1>
                    <div className="-mr-2.5 flex">
                      {!interfacePrefs.hideInfo && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setShowInfoModal(true)}
                          aria-label="How to play"
                        >
                          <Info className="size-5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowSettings(true)}
                        aria-label="Settings"
                        className="[&_svg]:transition-transform [&_svg]:duration-300 hover:[&_svg]:rotate-45"
                      >
                        <Settings className="size-5" />
                      </Button>
                    </div>
                  </motion.header>
                )}
                {isInRound && (
                  <motion.div
                    key="round-bar"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0, transition: SOFT_SPRING }}
                    exit={FADE_OUT}
                  >
                    <RoundHeader
                      current={currentPlayer}
                      total={playersCount}
                      onEnd={endGame}
                    />
                  </motion.div>
                )}
                {isDesktop && gameState === "end" && (
                  <motion.div
                    key="end-bar"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0, transition: SOFT_SPRING }}
                    exit={FADE_OUT}
                    className="flex h-11 items-center justify-center gap-2.5 text-sm font-bold"
                  >
                    <span className="rounded-full bg-card px-3.5 py-2 lowercase">
                      {activeCategoryInfo?.label}
                    </span>
                    <span className="rounded-full bg-card px-3.5 py-2">
                      {playersCount} players
                    </span>
                    <span className="rounded-full bg-card px-3.5 py-2 text-pink">
                      {impostersCount}{" "}
                      {impostersCount === 1 ? "imposter" : "imposters"}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <main className="relative flex min-h-0 flex-1 flex-col [perspective:1200px]">
              <AnimatePresence mode="wait" custom={swipeDirection}>
                {hasLaunched && gameState === "setup" && (
                  <motion.div
                    key="setup"
                    variants={STAGGER}
                    initial="initial"
                    animate="animate"
                    exit={FADE_OUT}
                    className="-mx-5 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-5 pt-5 pb-2 lg:-mx-12 lg:flex-row lg:items-center-safe lg:gap-20 lg:px-12 lg:py-6"
                  >
                    {/* Desktop: a hero with the wordmark and play button, settings beside it. */}
                    {isDesktop && (
                      <motion.div
                        variants={RISE}
                        className="@container flex min-w-0 flex-1 flex-col items-start gap-8"
                      >
                        {/* Sized to the column (the word is ~5.6em wide) so it never runs into the settings. */}
                        <h1 className="-rotate-2 font-display text-[min(8rem,17cqi)] leading-[0.95] font-extrabold tracking-[-0.045em] [text-shadow:6px_6px_0_var(--pink)]">
                          imposter
                        </h1>
                        <p className="max-w-md text-lg leading-relaxed text-muted-foreground">
                          everyone gets the secret word, except the imposter.
                          pass the screen around, then talk it out and find
                          them.
                        </p>
                        <div className="flex w-full max-w-sm flex-col">
                          {renderPrimaryButton()}
                          {startHint}
                        </div>
                      </motion.div>
                    )}

                    <div className="contents lg:flex lg:w-[26rem] lg:shrink-0 lg:flex-col lg:gap-5">
                      {/* Auto-update on: just a quiet status chip while it downloads / waits to install. */}
                      <AnimatePresence initial={false}>
                        {showUpdateChip && (
                          <motion.button
                            key="update-chip"
                            type="button"
                            initial={{ opacity: 0, y: -8, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.95 }}
                            transition={SPRING}
                            onClick={
                              updateStatus === "ready"
                                ? installUpdate
                                : undefined
                            }
                            disabled={updateStatus !== "ready"}
                            className="flex h-9 shrink-0 cursor-pointer items-center gap-2 self-center rounded-full bg-card px-4 text-[13px] font-semibold tabular-nums disabled:cursor-default"
                          >
                            {updateStatus === "ready" ? (
                              <>
                                <Download className="size-3.5 text-pink" />v
                                {updateVersion} ready · install
                              </>
                            ) : (
                              <>
                                <Loader2 className="size-3.5 animate-spin text-pink" />
                                updating to v{updateVersion} ·{" "}
                                {Math.round(downloadProgress * 100)}%
                              </>
                            )}
                          </motion.button>
                        )}
                      </AnimatePresence>

                      {/* Auto-update off: a banner you can install from or dismiss for this version. */}
                      <AnimatePresence initial={false}>
                        {showUpdateBanner && (
                          <motion.div
                            key="update-banner"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={SPRING}
                            className="shrink-0 overflow-hidden"
                          >
                            <div className="flex items-center gap-1 rounded-[20px] bg-pink py-2 pr-1.5 pl-[18px] text-pink-foreground">
                              <span className="flex min-w-0 flex-1 flex-col">
                                <span className="text-[15px] font-bold">
                                  update available
                                </span>
                                <span className="text-[13px] font-medium opacity-80">
                                  v{updateVersion} is out
                                </span>
                              </span>
                              <motion.button
                                type="button"
                                onClick={installUpdate}
                                whileTap={{ scale: 0.95 }}
                                className="flex h-11 cursor-pointer items-center gap-1.5 rounded-full bg-pink-foreground px-4 text-sm font-bold text-pink tabular-nums"
                              >
                                {updateStatus === "downloading" ? (
                                  <>
                                    <Loader2 className="size-4 animate-spin" />
                                    {Math.round(downloadProgress * 100)}%
                                  </>
                                ) : (
                                  <>
                                    <Download className="size-4" />
                                    install
                                  </>
                                )}
                              </motion.button>
                              <button
                                type="button"
                                onClick={dismissUpdate}
                                aria-label="Dismiss update"
                                className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-[background-color] hover:bg-pink-foreground/10"
                              >
                                <X className="size-5 stroke-[2.4]" />
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <motion.div
                        variants={RISE}
                        className="grid shrink-0 grid-cols-2 rounded-[24px] bg-card pt-4 pb-[18px]"
                      >
                        {/* Narrow phones: less side padding so two-digit counts fit between − and +. */}
                        <div className="flex flex-col items-center gap-2 border-r border-border/70 px-3.5 max-[374px]:px-2">
                          <label
                            htmlFor="players"
                            className="text-[13px] font-semibold text-muted-foreground"
                          >
                            Players
                          </label>
                          <NumberStepper
                            id="players"
                            label="players"
                            min={3}
                            max={20}
                            value={playersCount}
                            onChange={applyPlayersCount}
                            onPick={() => openNumberPicker("players")}
                          />
                        </div>
                        <div className="flex flex-col items-center gap-2 px-3.5 max-[374px]:px-2">
                          <label
                            htmlFor="imposters"
                            className="text-[13px] font-semibold text-muted-foreground"
                          >
                            Imposters
                          </label>
                          <NumberStepper
                            id="imposters"
                            label="imposters"
                            min={1}
                            max={Math.max(1, playersCount - 1)}
                            value={impostersCount}
                            onChange={setImpostersCount}
                            onPick={() => openNumberPicker("imposters")}
                            valueClassName="text-pink"
                          />
                        </div>
                      </motion.div>

                      <motion.div
                        variants={RISE}
                        className="shrink-0 py-1 pr-1.5"
                      >
                        <motion.button
                          type="button"
                          onClick={() => setShowCategorySheet(true)}
                          aria-haspopup="dialog"
                          whileTap={{ scale: 0.98 }}
                          className="relative flex min-h-[88px] w-full -rotate-1 cursor-pointer items-center justify-between gap-3 rounded-[24px] border-[1.5px] border-border bg-card py-3.5 pr-4 pl-5 text-left shadow-[6px_6px_0_var(--pink)] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60"
                        >
                          <AnimatePresence initial={false}>
                            {selectedCategoryInfo?.tag && (
                              <motion.span
                                key={selectedCategory}
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.5 }}
                                transition={SPRING}
                                className="absolute -top-[11px] right-[26px]"
                              >
                                <CategorySticker
                                  tag={selectedCategoryInfo.tag}
                                  className="px-2.5 py-[3px] text-xs"
                                />
                              </motion.span>
                            )}
                          </AnimatePresence>
                          <span className="relative flex min-w-0 flex-1 flex-col">
                            <AnimatePresence mode="popLayout" initial={false}>
                              <motion.span
                                key={selectedCategory}
                                initial={{ opacity: 0, y: 14 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -14 }}
                                transition={SPRING}
                                className="flex min-w-0 flex-col gap-[5px]"
                              >
                                <span className="text-[13px] font-semibold text-muted-foreground">
                                  Category
                                </span>
                                <span className="flex min-w-0 items-center gap-2">
                                  {isRandomMix && (
                                    <Shuffle className="size-5 shrink-0 text-pink" />
                                  )}
                                  <span className="truncate font-display text-[26px] leading-none font-extrabold lowercase tracking-[-0.03em] text-highlight">
                                    {isRandomMix
                                      ? "random mix"
                                      : (selectedCategoryInfo?.label ??
                                        "pick one")}
                                  </span>
                                </span>
                                <span className="flex items-baseline gap-1 text-[13px] text-muted-foreground">
                                  {isRandomMix ? (
                                    <>
                                      picks from{" "}
                                      <RollingNumber value={randomPoolCount} />{" "}
                                      of {allCategoryKeys.length}
                                    </>
                                  ) : (
                                    <>
                                      <RollingNumber
                                        value={selectedWordCount}
                                      />{" "}
                                      words
                                    </>
                                  )}
                                </span>
                              </motion.span>
                            </AnimatePresence>
                          </span>
                          <ChevronRight className="size-5 shrink-0 stroke-[2.2] text-muted-foreground" />
                        </motion.button>
                      </motion.div>

                      {/* A custom category with one word list has no easy/hard, so difficulty folds away.
                      -mt-5 cancels the column gap; the inner pt-5 brings it back while shown. */}
                      <motion.div variants={RISE} className="-mt-5 shrink-0">
                        <AnimatePresence initial={false}>
                          {!(
                            selectedCategoryInfo?.custom &&
                            selectedCategoryInfo.hard.length === 0
                          ) && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={SPRING}
                              className="overflow-hidden"
                            >
                              <div className="flex flex-col gap-2.5 pt-5">
                                <div className="flex items-baseline justify-between gap-3 px-1">
                                  <span
                                    id="difficulty-label"
                                    className="text-[13px] font-semibold text-muted-foreground"
                                  >
                                    Difficulty
                                  </span>
                                  <span className="relative h-5 min-w-0 flex-1 overflow-hidden text-right">
                                    <AnimatePresence
                                      mode="popLayout"
                                      initial={false}
                                    >
                                      <motion.span
                                        key={selectedDifficulty}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={SPRING}
                                        className="block truncate text-[13px] text-muted-foreground/80"
                                      >
                                        {
                                          DIFFICULTY_DESCRIPTIONS[
                                            selectedDifficulty
                                          ]
                                        }
                                      </motion.span>
                                    </AnimatePresence>
                                  </span>
                                </div>
                                <div
                                  role="radiogroup"
                                  aria-labelledby="difficulty-label"
                                  className="grid grid-cols-3 rounded-full bg-card p-1"
                                >
                                  {DIFFICULTIES.map((difficulty) => {
                                    const isSelected =
                                      difficulty === selectedDifficulty;
                                    return (
                                      <button
                                        key={difficulty}
                                        type="button"
                                        role="radio"
                                        aria-checked={isSelected}
                                        onClick={() => {
                                          haptic.tap();
                                          setSelectedDifficulty(difficulty);
                                        }}
                                        className={cn(
                                          "relative h-[42px] cursor-pointer rounded-full text-[15px] transition-colors duration-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60",
                                          isSelected
                                            ? "font-bold text-primary-foreground"
                                            : "font-semibold text-foreground",
                                        )}
                                      >
                                        {isSelected && (
                                          <motion.span
                                            layoutId="difficulty-pill"
                                            transition={SPRING}
                                            className="absolute inset-0 rounded-full bg-primary"
                                          />
                                        )}
                                        <span className="relative">
                                          {DIFFICULTY_LABELS[difficulty]}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>

                      <motion.div
                        variants={RISE}
                        className="flex shrink-0 flex-col divide-y divide-border/70 rounded-[24px] bg-card pr-3 pl-[18px]"
                      >
                        <SettingRow
                          id="randomize-starter"
                          title="Random first speaker"
                        >
                          <Switch
                            id="randomize-starter"
                            checked={randomizeStarter}
                            onCheckedChange={setRandomizeStarter}
                          />
                        </SettingRow>
                        <AnimatePresence initial={false}>
                          {canRevealFellows && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={SPRING}
                              className="overflow-hidden"
                            >
                              <SettingRow
                                id="fellow-imposters"
                                title="Imposters know each other"
                              >
                                <Switch
                                  id="fellow-imposters"
                                  checked={revealFellowImposters}
                                  onCheckedChange={setRevealFellowImposters}
                                />
                              </SettingRow>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        <SettingRow id="prank-probability" title="Prank rounds">
                          <NumberStepper
                            id="prank-probability"
                            label="prank chance"
                            size="sm"
                            min={0}
                            max={100}
                            value={prankProbability}
                            onChange={setPrankProbability}
                            onPick={() => openNumberPicker("prank")}
                            suffix="%"
                          />
                        </SettingRow>
                      </motion.div>
                    </div>
                  </motion.div>
                )}

                {gameState === "pass" && (
                  <motion.div
                    key={panelKey}
                    variants={PASS_VARIANTS}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 text-center"
                  >
                    <motion.span
                      variants={RISE}
                      className="text-base font-semibold text-muted-foreground lg:text-xl"
                    >
                      {isDesktop ? "pass the screen to" : "pass the phone to"}
                    </motion.span>
                    {isDesktop ? (
                      // Desktop: the face-down card, landscape, with the player's name on its back.
                      <motion.div
                        variants={CARD_VARIANTS}
                        className="mt-6 flex h-[min(400px,48dvh)] w-full max-w-[760px] flex-col justify-between rounded-[32px] bg-card p-8 text-left shadow-[12px_12px_0_var(--pink)]"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[15px] font-semibold text-muted-foreground">
                            face down
                          </span>
                          <VenetianMask
                            className="size-7 text-pink"
                            aria-hidden
                          />
                        </div>
                        <p className="text-center font-display text-[104px] leading-none font-extrabold tracking-[-0.045em] text-highlight">
                          player {currentPlayer}
                        </p>
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate rounded-full bg-secondary px-3.5 py-2 text-sm font-bold lowercase">
                            {activeCategoryInfo?.label}
                          </span>
                          <span className="shrink-0 text-sm text-muted-foreground">
                            {currentPlayer} / {playersCount}
                          </span>
                        </div>
                      </motion.div>
                    ) : (
                      <>
                        <motion.p
                          variants={PLAYER_POP}
                          className="font-display text-6xl font-extrabold tracking-[-0.03em] text-highlight"
                        >
                          player {currentPlayer}
                        </motion.p>
                        <motion.p
                          variants={RISE}
                          className="max-w-[16rem] text-sm text-muted-foreground"
                        >
                          make sure nobody else is peeking.
                        </motion.p>
                      </>
                    )}
                  </motion.div>
                )}

                {gameState === "reveal" && (
                  <motion.div
                    key={panelKey}
                    variants={STAGGER}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 py-5"
                  >
                    <motion.div
                      variants={CARD_VARIANTS}
                      className="h-[min(420px,52dvh)] w-full max-w-[310px] lg:h-[min(400px,48dvh)] lg:max-w-[760px]"
                    >
                      <SwipeCard onSwipe={passWithSwipe}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-muted-foreground">
                            {currentAssignment?.isImposter
                              ? "your role"
                              : "your word"}
                          </span>
                          <VenetianMask
                            className="size-6 text-pink"
                            aria-hidden
                          />
                        </div>
                        {currentAssignment?.isImposter ? (
                          <div className="flex flex-col items-center gap-2 text-center">
                            <span className="text-base font-semibold lg:text-xl">
                              you are the
                            </span>
                            <p className="font-display text-[40px] font-extrabold leading-[1.05] tracking-[-0.03em] text-pink lg:text-8xl lg:tracking-[-0.045em]">
                              imposter
                            </p>
                          </div>
                        ) : (
                          <FitWord
                            word={currentAssignment?.word ?? "no word"}
                            scale={isDesktop ? 2.2 : 1}
                            className="text-center font-display font-extrabold leading-[1.05] tracking-[-0.03em] text-balance hyphens-none text-highlight"
                          />
                        )}
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate rounded-full bg-secondary px-3.5 py-2 text-sm font-bold lowercase">
                            {activeCategoryInfo?.label}
                          </span>
                          <span className="shrink-0 text-[13px] text-muted-foreground">
                            {currentPlayer} / {playersCount}
                          </span>
                        </div>
                      </SwipeCard>
                    </motion.div>

                    {fellowImposters.length > 0 && (
                      <motion.div
                        variants={{ ...RISE, exit: FADE_OUT }}
                        className="flex items-center gap-2 rounded-full bg-card px-4 py-2.5 text-sm font-semibold"
                      >
                        <span className="text-muted-foreground">
                          {fellowImposters.length === 1
                            ? "fellow imposter:"
                            : "fellow imposters:"}
                        </span>
                        <span className="text-pink">
                          {fellowImposters
                            .map((number) => `player ${number}`)
                            .join(" · ")}
                        </span>
                      </motion.div>
                    )}

                    {activeCategoryInfo?.hint && (
                      <motion.div variants={{ ...RISE, exit: FADE_OUT }}>
                        <CategoryHint hint={activeCategoryInfo.hint} />
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {gameState === "end" && (
                  <motion.div
                    key="end"
                    variants={STAGGER}
                    initial="initial"
                    animate="animate"
                    exit={FADE_OUT}
                    className="flex min-h-0 flex-1 flex-col items-center justify-center gap-7 text-center"
                  >
                    {isDesktop ? (
                      // Desktop: the headline, then the first speaker on a wide card.
                      <>
                        <motion.h2
                          variants={RISE}
                          className="-rotate-2 font-display text-[112px] leading-[0.95] font-extrabold tracking-[-0.045em] [text-shadow:6px_6px_0_var(--pink)]"
                        >
                          all clear
                        </motion.h2>
                        {startingPlayer && (
                          <motion.div
                            variants={DROP_CARD}
                            className="mt-7 flex w-full max-w-[760px] items-center justify-between gap-6 rounded-[32px] bg-card p-8 text-left shadow-[12px_12px_0_var(--pink)]"
                          >
                            <div className="flex flex-col gap-2.5">
                              <span className="flex items-center gap-2 text-base font-semibold text-muted-foreground">
                                <Shuffle
                                  className="size-[18px] text-pink"
                                  aria-hidden
                                />
                                first to speak
                              </span>
                              <p className="font-display text-7xl leading-none font-extrabold tracking-[-0.04em] text-highlight">
                                player {startingPlayer}
                              </p>
                            </div>
                            <span className="flex size-30 shrink-0 items-center justify-center rounded-full bg-secondary">
                              <VenetianMask
                                className="size-15 text-pink"
                                aria-hidden
                              />
                            </span>
                          </motion.div>
                        )}
                      </>
                    ) : (
                      <>
                        <motion.span
                          variants={POP}
                          className="flex size-16 items-center justify-center rounded-full bg-card"
                        >
                          <VenetianMask
                            className="size-8 text-pink"
                            aria-hidden
                          />
                        </motion.span>
                        <motion.div
                          variants={RISE}
                          className="flex flex-col gap-2"
                        >
                          <h2 className="font-display text-4xl font-extrabold tracking-[-0.03em]">
                            all clear
                          </h2>
                          <p className="mx-auto max-w-xs text-[15px] text-muted-foreground">
                            everyone has seen their card. put the phone down and
                            start talking.
                          </p>
                        </motion.div>
                        {startingPlayer && (
                          <motion.div
                            variants={DROP_CARD}
                            className="w-full max-w-xs rounded-[28px] bg-card p-5 shadow-[8px_8px_0_var(--pink)]"
                          >
                            <span className="flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground">
                              <Shuffle
                                className="size-4 text-pink"
                                aria-hidden
                              />
                              first to speak
                            </span>
                            <p className="mt-2 font-display text-4xl font-extrabold tracking-[-0.03em] text-highlight">
                              player {startingPlayer}
                            </p>
                            <p className="mt-1 text-[13px] text-muted-foreground">
                              gives the first clue.
                            </p>
                          </motion.div>
                        )}
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </main>

            <motion.footer
              initial={{ opacity: 0, y: 16 }}
              animate={
                hasLaunched
                  ? {
                      opacity: 1,
                      y: 0,
                      transition: { ...SOFT_SPRING, delay: 0.12 },
                    }
                  : { opacity: 0, y: 16 }
              }
              className="shrink-0 pt-4 lg:mx-auto lg:w-full lg:max-w-[480px]"
            >
              {!(isDesktop && gameState === "setup") && (
                <>
                  {renderPrimaryButton()}
                  {startHint}
                </>
              )}
            </motion.footer>
          </div>

          {/* Category picker */}
          <Sheet
            open={showCategorySheet}
            predictive={backTarget === "category"}
            onClose={() => setShowCategorySheet(false)}
            labelledBy="category-sheet-title"
            desktopClassName="lg:max-w-2xl"
            header={
              <div className="flex h-11 items-center justify-between">
                <h2
                  id="category-sheet-title"
                  className="font-display text-[22px] font-extrabold tracking-[-0.02em]"
                >
                  pick a category
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className="-mr-2.5"
                  onClick={() => setShowCategorySheet(false)}
                  aria-label="Close"
                >
                  <X className="size-[18px] stroke-[2.2]" />
                </Button>
              </div>
            }
          >
            <div
              role="radiogroup"
              aria-label="Category mode"
              className="grid shrink-0 grid-cols-2 rounded-full bg-background p-1"
            >
              {[
                { random: false, label: "one category" },
                { random: true, label: "random mix" },
              ].map((mode) => {
                const isSelected = mode.random === isRandomMix;
                return (
                  <button
                    key={mode.label}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => {
                      haptic.tap();
                      setSelectedCategory(
                        mode.random ? "random" : lastSingleCategory,
                      );
                    }}
                    className={cn(
                      "relative flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full text-[15px] transition-colors duration-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60",
                      isSelected
                        ? "font-bold text-primary-foreground"
                        : "font-semibold text-foreground",
                    )}
                  >
                    {isSelected && (
                      <motion.span
                        layoutId="category-mode-pill"
                        transition={SPRING}
                        className="absolute inset-0 rounded-full bg-primary"
                      />
                    )}
                    {mode.random && (
                      <Shuffle
                        className={cn(
                          "relative size-4 transition-colors",
                          !isSelected && "text-pink",
                        )}
                        aria-hidden
                      />
                    )}
                    <span className="relative">{mode.label}</span>
                  </button>
                );
              })}
            </div>

            <AnimatePresence initial={false}>
              {isRandomMix && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={SPRING}
                  className="shrink-0 overflow-hidden"
                >
                  <div className="flex min-h-11 items-center justify-between">
                    <span className="flex items-baseline gap-1 text-sm text-muted-foreground">
                      picks from
                      <span className="flex items-baseline gap-1 font-bold text-foreground">
                        <RollingNumber value={randomPoolCount} /> of{" "}
                        {allCategoryKeys.length}
                      </span>
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-11 font-bold text-highlight hover:text-highlight"
                        onClick={() =>
                          setRandomPool(
                            Object.fromEntries(
                              allCategoryKeys.map((k) => [k, true]),
                            ),
                          )
                        }
                      >
                        select all
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-11"
                        onClick={() =>
                          setRandomPool(
                            Object.fromEntries(
                              allCategoryKeys.map((k) => [k, false]),
                            ),
                          )
                        }
                      >
                        clear
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="-mx-5 min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-0.5">
              <motion.div
                variants={{
                  initial: {},
                  animate: {
                    transition: { staggerChildren: 0.006, delayChildren: 0.02 },
                  },
                }}
                initial="initial"
                animate="animate"
                className="grid grid-cols-2 gap-1.5 lg:grid-cols-3"
              >
                {builtinCategoryKeys.map(renderCategoryTile)}
              </motion.div>

              {!interfacePrefs.hideCustomCategories && (
                <div
                  className={cn(
                    "flex flex-col gap-2.5 pb-1",
                    builtinCategoryKeys.length > 0 && "mt-5",
                  )}
                >
                  <span className="px-1 text-[13px] font-semibold text-muted-foreground">
                    Your categories
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-3">
                    {customCategoryKeys.map(renderCategoryTile)}
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      onClick={openAddSheet}
                      className="flex h-[54px] cursor-pointer items-center gap-2 rounded-2xl border-[1.5px] border-dashed border-pink/70 px-3.5 text-left text-[15px] font-semibold text-pink outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60"
                    >
                      <Plus className="size-4 stroke-[2.6]" />
                      new category
                    </motion.button>
                  </div>
                </div>
              )}
            </div>

            <Button
              size="lg"
              className="h-[52px] shrink-0 text-[17px]"
              onClick={() => setShowCategorySheet(false)}
            >
              done
            </Button>
          </Sheet>

          {/* Custom category editor: a numbered list of words, typed into an input docked
              at the bottom so it sits right above the keyboard. */}
          <Page
            open={isEditorOpen}
            predictive={backTarget === "editor"}
            onClose={requestCloseEditor}
            title={editorDraft.id ? "edit category" : "new category"}
            stacked
            action={
              <Button
                variant="ghost"
                size="icon"
                aria-label="Share category"
                // Needs a name and enough words, the same as saving.
                disabled={!canSaveDraft}
                // Shares the category as it stands in the editor, saved or not.
                onClick={() =>
                  openShareSheet({
                    name: draftName,
                    words: editorDraft.words,
                    hard: draftHard,
                  })
                }
              >
                <Share2 className="size-5 stroke-[2.2]" />
              </Button>
            }
            footer={
              <div className="flex flex-col gap-3">
                {editorDraft.levels && (
                  <div
                    role="radiogroup"
                    aria-label="Add words to"
                    className="flex rounded-full bg-card p-1"
                  >
                    {(["easy", "hard"] as const).map((level) => (
                      <button
                        key={level}
                        type="button"
                        role="radio"
                        aria-checked={addLevel === level}
                        // Keep focus (and the keyboard) in the input while switching.
                        onPointerDown={(event) => event.preventDefault()}
                        onClick={() => {
                          haptic.tap();
                          setAddLevel(level);
                        }}
                        className={cn(
                          "h-9 flex-1 cursor-pointer rounded-full text-sm font-bold transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60",
                          addLevel === level
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                )}
                <form
                  className="flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    addDraftWords([wordDraft.trim()].filter(Boolean));
                    setWordDraft("");
                  }}
                >
                  <Input
                    id="custom-category-word"
                    aria-label="Add a word"
                    value={wordDraft}
                    autoComplete="off"
                    enterKeyHint="enter"
                    placeholder={
                      editorDraft.levels
                        ? `add ${addLevel} words`
                        : "add a word, or paste a list"
                    }
                    onChange={(event) => setWordDraft(event.target.value)}
                    onFocus={() => setIsWordInputFocused(true)}
                    onBlur={() => setIsWordInputFocused(false)}
                    onPaste={(event) => {
                      const text = event.clipboardData.getData("text");
                      const shareCode = findShareCode(text);
                      if (shareCode) {
                        event.preventDefault();
                        void receiveShareCode(shareCode);
                        return;
                      }
                      const pasted = splitWords(text);
                      if (pasted.length > 1) {
                        event.preventDefault();
                        addDraftWords(pasted);
                      }
                    }}
                    className="h-12 flex-1 bg-card text-base"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    className="size-12 shrink-0"
                    aria-label="Add word"
                    disabled={!wordDraft.trim()}
                    // Keep focus (and the keyboard) in the input while adding words.
                    onPointerDown={(event) => event.preventDefault()}
                  >
                    <Plus className="size-5 stroke-[2.6]" />
                  </Button>
                </form>
                {/* While typing words the keyboard is up; save waits until it goes down. */}
                {!isTypingWords && (
                  <Button
                    size="lg"
                    className="h-14 w-full text-[17px]"
                    disabled={!canSaveDraft}
                    onClick={saveCategoryDraft}
                  >
                    {draftName.length === 0
                      ? "give it a name"
                      : missingWords > 0
                        ? `add ${missingWords} more ${editorDraft.levels ? "easy " : ""}word${missingWords === 1 ? "" : "s"}`
                        : missingHardWords > 0
                          ? `add ${missingHardWords} more hard word${missingHardWords === 1 ? "" : "s"}`
                          : editorDraft.id
                            ? "save changes"
                            : "save category"}
                  </Button>
                )}
              </div>
            }
          >
            <div className="flex flex-col gap-6 pb-2">
              <section className="flex flex-col gap-1">
                <label
                  htmlFor="custom-category-name"
                  className="px-1 text-[13px] font-semibold text-muted-foreground"
                >
                  Name
                </label>
                <input
                  id="custom-category-name"
                  value={editorDraft.name}
                  maxLength={MAX_CUSTOM_NAME_LENGTH}
                  autoComplete="off"
                  enterKeyHint="done"
                  placeholder="give it a name"
                  onChange={(event) =>
                    setEditorDraft((draft) => ({
                      ...draft,
                      name: event.target.value,
                    }))
                  }
                  className="w-full border-b-2 border-border bg-transparent px-1 pt-1 pb-2 font-display text-[26px] leading-tight font-extrabold tracking-[-0.03em] transition-colors outline-none placeholder:text-muted-foreground/50 focus:border-primary"
                />
              </section>

              <div className="rounded-[24px] bg-card px-[18px]">
                <SettingRow
                  id="custom-category-levels"
                  title="Easy and hard words"
                >
                  <Switch
                    id="custom-category-levels"
                    checked={editorDraft.levels}
                    onCheckedChange={setDraftLevels}
                  />
                </SettingRow>
              </div>

              {(editorDraft.levels
                ? (["words", "hard"] as const)
                : (["words"] as const)
              ).map((field) => {
                const list = editorDraft[field];
                const level = field === "hard" ? "hard" : "easy";
                return (
                  <section key={field} className="flex flex-col gap-2.5">
                    <div className="flex items-baseline justify-between px-1">
                      <span className="text-[13px] font-semibold text-muted-foreground">
                        {editorDraft.levels
                          ? field === "hard"
                            ? "Hard"
                            : "Easy"
                          : "Words"}
                      </span>
                      <span className="text-[13px] text-muted-foreground tabular-nums">
                        <RollingNumber value={list.length} />
                      </span>
                    </div>
                    {list.length === 0 ? (
                      <p className="rounded-[24px] bg-card px-[18px] py-4 text-[15px] text-muted-foreground">
                        {editorDraft.levels
                          ? `No ${level} words yet.`
                          : `No words yet. Type them below, one at a time, or paste a whole list. You need at least ${MIN_CUSTOM_WORDS}.`}
                      </p>
                    ) : (
                      <ol className="flex flex-col rounded-[24px] bg-card pr-1.5 pl-[18px]">
                        <AnimatePresence initial={false}>
                          {list.map((word, index) => (
                            <motion.li
                              key={word}
                              layout="position"
                              // Enters at full height so the list can scroll to it right away.
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={SPRING}
                              className="overflow-hidden border-b border-border/70 last:border-b-0"
                            >
                              <div className="flex min-h-[52px] items-center gap-3 py-1">
                                <span className="w-5 shrink-0 text-[13px] text-muted-foreground tabular-nums">
                                  {index + 1}
                                </span>
                                <span className="min-w-0 flex-1 text-base leading-snug [overflow-wrap:anywhere]">
                                  {word}
                                </span>
                                {editorDraft.levels && (
                                  <button
                                    type="button"
                                    aria-label={`Move ${word} to ${field === "hard" ? "easy" : "hard"}`}
                                    onClick={() => moveDraftWord(field, word)}
                                    className="-mr-3 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                                  >
                                    {field === "hard" ? (
                                      <ArrowUp className="size-4" />
                                    ) : (
                                      <ArrowDown className="size-4" />
                                    )}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  aria-label={`Remove ${word}`}
                                  onClick={() => removeDraftWord(field, word)}
                                  className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                                >
                                  <X className="size-4" />
                                </button>
                              </div>
                            </motion.li>
                          ))}
                        </AnimatePresence>
                      </ol>
                    )}
                    {/* New words scroll into view in the list they're added to. */}
                    {(field === "hard") ===
                      (editorDraft.levels && addLevel === "hard") && (
                      <div ref={editorListEnd} />
                    )}
                  </section>
                );
              })}
            </div>
          </Page>

          <ConfirmDialog
            open={showDiscardConfirm}
            predictive={backTarget === "discardConfirm"}
            icon={<Trash2 className="size-7" aria-hidden />}
            title="discard your changes?"
            confirmLabel="discard"
            cancelLabel="keep editing"
            onConfirm={discardCategoryDraft}
            onCancel={() => setShowDiscardConfirm(false)}
          />

          <ConfirmDialog
            open={showDeleteConfirm}
            predictive={backTarget === "deleteConfirm"}
            icon={<Trash2 className="size-7" aria-hidden />}
            title="delete this category?"
            confirmLabel="delete"
            cancelLabel="keep it"
            onConfirm={deleteActionsCategory}
            onCancel={() => setShowDeleteConfirm(false)}
          />

          {/* ⋯ on one of your categories: what you can do with it. */}
          <Sheet
            open={showActionsSheet}
            predictive={backTarget === "actions"}
            onClose={() => setShowActionsSheet(false)}
            labelledBy="actions-sheet-title"
            className="gap-5"
            stacked
            header={
              <div className="flex min-h-11 items-center justify-between gap-3">
                <h2
                  id="actions-sheet-title"
                  className="min-w-0 font-display text-[22px] font-extrabold tracking-[-0.02em] [overflow-wrap:anywhere] lowercase"
                >
                  {actionsCategory?.name}
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className="-mr-2.5 shrink-0"
                  onClick={() => setShowActionsSheet(false)}
                  aria-label="Close"
                >
                  <X className="size-5 stroke-[2.2]" />
                </Button>
              </div>
            }
          >
            <div className="flex flex-col divide-y divide-border/70 rounded-[24px] bg-secondary px-[18px]">
              {[
                {
                  icon: Share2,
                  label: "share",
                  onClick: () => {
                    if (!actionsCategory) return;
                    setShowActionsSheet(false);
                    openShareSheet(actionsCategory);
                  },
                },
                {
                  icon: Pencil,
                  label: "edit",
                  onClick: () => {
                    if (!actionsCategory) return;
                    setShowActionsSheet(false);
                    openCategoryEditor(actionsCategory);
                  },
                },
                {
                  icon: Trash2,
                  label: "delete",
                  onClick: () => {
                    haptic.tap();
                    setShowDeleteConfirm(true);
                  },
                },
              ].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={option.onClick}
                  className={cn(
                    "flex min-h-[58px] cursor-pointer items-center gap-3.5 text-left text-base font-semibold outline-none focus-visible:text-pink",
                    option.label === "delete" && "text-pink",
                  )}
                >
                  <option.icon className="size-5 shrink-0 text-pink" />
                  {option.label}
                </button>
              ))}
            </div>
          </Sheet>

          {/* New category: make one yourself, or add a shared one from its link or QR code. */}
          <Sheet
            open={showAddSheet}
            predictive={backTarget === "add"}
            onClose={() => setShowAddSheet(false)}
            labelledBy="add-sheet-title"
            className="gap-5"
            stacked
            header={
              <div className="flex h-11 items-center gap-1">
                {addMode !== "menu" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="-ml-3"
                    onClick={() => setAddMode("menu")}
                    aria-label="Back"
                  >
                    <ChevronLeft className="size-6 stroke-[2.2]" />
                  </Button>
                )}
                <h2
                  id="add-sheet-title"
                  className="font-display text-[22px] font-extrabold tracking-[-0.02em]"
                >
                  {addMode === "link"
                    ? "paste a link"
                    : addMode === "scan"
                      ? "scan a QR code"
                      : "new category"}
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className="-mr-2.5 ml-auto"
                  onClick={() => setShowAddSheet(false)}
                  aria-label="Close"
                >
                  <X className="size-5 stroke-[2.2]" />
                </Button>
              </div>
            }
          >
            {addMode === "menu" && (
              <div className="flex flex-col divide-y divide-border/70 rounded-[24px] bg-secondary px-[18px]">
                {[
                  {
                    icon: PenLine,
                    label: "make your own",
                    onClick: () => {
                      setShowAddSheet(false);
                      openCategoryEditor();
                    },
                  },
                  {
                    icon: Link,
                    label: "paste a link",
                    onClick: () => openAddMode("link"),
                  },
                  ...(canUseCamera
                    ? [
                        {
                          icon: ScanLine,
                          label: "scan a QR code",
                          onClick: () => openAddMode("scan"),
                        },
                      ]
                    : []),
                ].map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={option.onClick}
                    className="flex min-h-[58px] cursor-pointer items-center gap-3.5 text-left text-base font-semibold outline-none focus-visible:text-pink"
                  >
                    <option.icon className="size-5 shrink-0 text-pink" />
                    <span className="flex-1">{option.label}</span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}

            {addMode === "link" && (
              <form
                className="flex flex-col gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitLink();
                }}
              >
                <Input
                  aria-label="Shared category link"
                  value={linkDraft}
                  autoFocus
                  autoComplete="off"
                  enterKeyHint="go"
                  placeholder="tjeneritz.se/c#…"
                  onChange={(event) => {
                    setLinkDraft(event.target.value);
                    setLinkError(false);
                  }}
                  className="h-12 bg-secondary text-base"
                />
                {linkError && (
                  <p className="px-1 text-sm text-pink">Invalid link.</p>
                )}
                <Button
                  type="submit"
                  size="lg"
                  className="h-14 w-full text-[17px]"
                  disabled={!linkDraft.trim()}
                >
                  continue
                </Button>
              </form>
            )}

            {addMode === "scan" && (
              <div className="flex flex-col items-center gap-4 pb-2">
                <div className="relative aspect-square w-full max-w-[272px] overflow-hidden rounded-[24px] bg-secondary">
                  {/* Android's web view draws a grey play-button placeholder until the first
                      frame; a blank poster and staying hidden until the camera runs avoid it. */}
                  <video
                    ref={scannerVideo}
                    muted
                    playsInline
                    poster="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="
                    className={cn(
                      "size-full object-cover transition-opacity duration-200",
                      scanStatus !== "scanning" && "opacity-0",
                    )}
                  />
                  {scanStatus === "starting" && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="size-6 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {(scanStatus === "denied" ||
                    scanStatus === "unavailable") && (
                    <div className="absolute inset-0 flex items-center justify-center bg-secondary p-6 text-center text-[15px] text-muted-foreground">
                      {scanStatus === "denied"
                        ? "Camera access denied."
                        : "Camera unavailable."}
                    </div>
                  )}
                </div>
                {scannedOtherCode && (
                  <p className="text-center text-sm text-pink">
                    Not a category QR code.
                  </p>
                )}
                {(scanStatus === "denied" || scanStatus === "unavailable") && (
                  <Button
                    size="lg"
                    className="h-14 w-full text-[17px]"
                    onClick={() => openAddMode("link")}
                  >
                    paste a link
                  </Button>
                )}
              </div>
            )}
          </Sheet>

          {/* Share a category: a QR code to scan across the table, or a link to send. */}
          <Sheet
            open={showShareSheet}
            predictive={backTarget === "share"}
            onClose={() => setShowShareSheet(false)}
            labelledBy="share-sheet-title"
            className="gap-5"
            stacked
            header={
              <div className="flex h-11 items-center justify-between">
                <h2
                  id="share-sheet-title"
                  className="font-display text-[22px] font-extrabold tracking-[-0.02em]"
                >
                  share category
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className="-mr-2.5"
                  onClick={() => setShowShareSheet(false)}
                  aria-label="Close"
                >
                  <X className="size-5 stroke-[2.2]" />
                </Button>
              </div>
            }
          >
            <div className="flex flex-col items-center gap-4 overflow-y-auto">
              <div className="aspect-square w-full max-w-[272px]">
                {shareUrl ? (
                  <QrCode
                    className="size-full"
                    value={shareUrl}
                    label={`QR code for ${shareCategory?.name ?? "the category"}`}
                  />
                ) : (
                  <div className="flex size-full items-center justify-center rounded-[24px] bg-secondary">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex flex-col items-center gap-1 text-center">
                <span className="max-w-full font-display text-xl font-extrabold tracking-[-0.02em] [overflow-wrap:anywhere] lowercase">
                  {shareCategory?.name}
                </span>
                <span className="text-sm text-muted-foreground">
                  {(shareCategory?.words.length ?? 0) +
                    (shareCategory?.hard.length ?? 0)}{" "}
                  words
                </span>
              </div>
            </div>
            <Button
              size="lg"
              className="h-14 w-full shrink-0 text-[17px]"
              disabled={!shareUrl}
              onClick={() => void sendShareLink()}
            >
              {canUseShareMenu ? (
                <>
                  <Share2 className="size-5" />
                  send link
                </>
              ) : linkCopied ? (
                <>
                  <Check className="size-5" />
                  link copied
                </>
              ) : (
                "copy link"
              )}
            </Button>
          </Sheet>

          {/* A category from a share link, checked before anything is saved. The words stay
              hidden so whoever adds it can still play it. */}
          <Sheet
            open={showImportSheet}
            predictive={backTarget === "import"}
            onClose={() => setShowImportSheet(false)}
            labelledBy="import-sheet-title"
            className="gap-5"
            stacked
            header={
              <div className="flex h-11 items-center justify-between">
                <h2
                  id="import-sheet-title"
                  className="font-display text-[22px] font-extrabold tracking-[-0.02em]"
                >
                  {incoming.status === "ok"
                    ? "add this category?"
                    : incoming.status === "duplicate"
                      ? "already added"
                      : incoming.status === "newer"
                        ? "update needed"
                        : "invalid link"}
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className="-mr-2.5"
                  onClick={() => setShowImportSheet(false)}
                  aria-label="Close"
                >
                  <X className="size-5 stroke-[2.2]" />
                </Button>
              </div>
            }
          >
            {incoming.status === "ok" ? (
              <>
                <div className="flex flex-col gap-1 rounded-[20px] bg-secondary px-[18px] py-4">
                  <span className="font-display text-[26px] leading-tight font-extrabold tracking-[-0.03em] [overflow-wrap:anywhere] lowercase">
                    {incoming.name}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {incoming.words.length + incoming.hard.length} words
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    size="lg"
                    className="h-14 w-full text-[17px]"
                    onClick={addIncomingCategory}
                  >
                    <Plus className="size-5 stroke-[2.6]" />
                    add category
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-11"
                    onClick={() => setShowImportSheet(false)}
                  >
                    not now
                  </Button>
                </div>
              </>
            ) : (
              <Button
                size="lg"
                className="h-14 w-full text-[17px]"
                onClick={() => setShowImportSheet(false)}
              >
                ok
              </Button>
            )}
          </Sheet>

          {/* How to play */}
          <Sheet
            open={showInfoModal}
            predictive={backTarget === "info"}
            onClose={() => setShowInfoModal(false)}
            labelledBy="info-sheet-title"
            className="gap-5"
            header={
              <div className="flex h-11 items-center justify-between">
                <h2
                  id="info-sheet-title"
                  className="font-display text-[22px] font-extrabold tracking-[-0.02em]"
                >
                  how to play
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className="-mr-2.5"
                  onClick={() => setShowInfoModal(false)}
                  aria-label="Close"
                >
                  <X className="size-5 stroke-[2.2]" />
                </Button>
              </div>
            }
          >
            <motion.ol
              variants={STAGGER}
              initial="initial"
              animate="animate"
              className="flex flex-col gap-3.5 overflow-y-auto text-[15px] leading-relaxed"
            >
              {[
                "Pass the phone around so everyone can check their card in private.",
                "Most players see a secret word. The imposter only sees the category.",
                "Go around the room and say one clue each. Too obvious, and the imposter catches on. Too vague, and everyone votes you out.",
                "Once everyone has spoken, argue and point fingers.",
              ].map((step, index) => (
                <motion.li key={step} variants={RISE} className="flex gap-3">
                  <span className="w-4 shrink-0 font-display text-base font-extrabold text-pink">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </motion.li>
              ))}
            </motion.ol>
          </Sheet>

          {/* Number picker: tap a number instead of typing one */}
          <Sheet
            open={isNumberPickerOpen}
            predictive={backTarget === "picker"}
            onClose={() => setIsNumberPickerOpen(false)}
            labelledBy="number-picker-title"
            header={
              <div className="flex h-11 items-center justify-between">
                <h2
                  id="number-picker-title"
                  className="font-display text-[22px] font-extrabold tracking-[-0.02em]"
                >
                  {numberPicker.title}
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className="-mr-2.5"
                  onClick={() => setIsNumberPickerOpen(false)}
                  aria-label="Close"
                >
                  <X className="size-5 stroke-[2.2]" />
                </Button>
              </div>
            }
          >
            {numberPickerKind === "prank" ? (
              // Prank chance needs 1% precision, so it gets a slider instead of a grid.
              <motion.div
                variants={STAGGER}
                initial="initial"
                animate="animate"
                className="flex flex-col gap-5 pb-1"
              >
                <motion.div
                  variants={RISE}
                  className="flex items-center justify-between"
                >
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Less prank chance"
                    disabled={prankProbability <= 0}
                    onClick={() => {
                      haptic.tap();
                      setPrankProbability(Math.max(0, prankProbability - 1));
                    }}
                  >
                    <Minus className="size-5 stroke-[2.5]" />
                  </Button>
                  <span className="flex items-baseline font-display text-5xl font-extrabold tabular-nums">
                    <RollingNumber value={prankProbability} />
                    <span className="text-3xl">%</span>
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="More prank chance"
                    disabled={prankProbability >= 100}
                    onClick={() => {
                      haptic.tap();
                      setPrankProbability(Math.min(100, prankProbability + 1));
                    }}
                  >
                    <Plus className="size-5 stroke-[2.5]" />
                  </Button>
                </motion.div>
                <motion.input
                  variants={RISE}
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={prankProbability}
                  aria-label="Prank chance"
                  onChange={(event) => {
                    const nextValue = Number(event.target.value);
                    // Tick on every 5% so dragging feels notched without buzzing constantly.
                    if (nextValue % 5 === 0) haptic.tap();
                    setPrankProbability(nextValue);
                  }}
                  style={{ "--fill": `${prankProbability}%` } as CSSProperties}
                  className="range-slider w-full"
                />
                <motion.div variants={RISE} className="grid grid-cols-6 gap-2">
                  {PRANK_PRESETS.map((preset) => (
                    <motion.button
                      key={preset}
                      type="button"
                      whileTap={{ scale: 0.92 }}
                      onClick={() => {
                        haptic.tap();
                        setPrankProbability(preset);
                      }}
                      className={cn(
                        "h-11 cursor-pointer rounded-full text-sm font-bold tabular-nums transition-colors duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60",
                        preset === prankProbability
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground",
                      )}
                    >
                      {preset}%
                    </motion.button>
                  ))}
                </motion.div>
                <motion.div variants={RISE}>
                  <Button
                    size="lg"
                    className="h-[52px] w-full text-[17px]"
                    onClick={() => setIsNumberPickerOpen(false)}
                  >
                    done
                  </Button>
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                variants={{
                  initial: {},
                  animate: {
                    transition: { staggerChildren: 0.008, delayChildren: 0.02 },
                  },
                }}
                initial="initial"
                animate="animate"
                role="radiogroup"
                aria-labelledby="number-picker-title"
                className={cn(
                  "grid gap-2 pb-1",
                  numberPicker.suffix ? "grid-cols-4" : "grid-cols-6",
                )}
              >
                {numberPicker.options.map((option) => {
                  const isSelected = option === numberPicker.value;
                  return (
                    <motion.button
                      key={option}
                      variants={TILE}
                      whileTap={{ scale: 0.92 }}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => {
                        haptic.tap();
                        numberPicker.apply(option);
                        window.setTimeout(
                          () => setIsNumberPickerOpen(false),
                          140,
                        );
                      }}
                      className={cn(
                        "h-14 cursor-pointer rounded-2xl font-display text-xl font-extrabold tabular-nums transition-colors duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60",
                        isSelected
                          ? numberPickerKind === "imposters"
                            ? "bg-pink text-pink-foreground"
                            : "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground",
                      )}
                    >
                      {option}
                      {numberPicker.suffix}
                    </motion.button>
                  );
                })}
              </motion.div>
            )}
          </Sheet>

          {/* Settings */}
          <Page
            open={showSettings}
            predictive={backTarget === "settings"}
            onClose={() => setShowSettings(false)}
            title="settings"
          >
            <motion.div
              variants={STAGGER}
              initial="initial"
              animate="animate"
              className="flex flex-col gap-7"
            >
              <motion.section variants={RISE} className="flex flex-col gap-2.5">
                <span
                  id="theme-label"
                  className="px-1 text-[13px] font-semibold text-muted-foreground"
                >
                  Theme
                </span>
                <div
                  role="radiogroup"
                  aria-labelledby="theme-label"
                  className="grid grid-cols-3 rounded-full bg-card p-1"
                >
                  {THEME_OPTIONS.map(({ value: option, label }) => {
                    const isSelected = themePreference === option;
                    const ThemeIcon =
                      option === "system"
                        ? SunMoon
                        : option === "dark"
                          ? Moon
                          : Sun;
                    return (
                      <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => {
                          haptic.tap();
                          setThemePreference(option);
                        }}
                        className={cn(
                          "relative flex h-[42px] cursor-pointer items-center justify-center gap-2 rounded-full text-[15px] transition-colors duration-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60",
                          isSelected
                            ? "font-bold text-primary-foreground"
                            : "font-semibold text-foreground",
                        )}
                      >
                        {isSelected && (
                          <motion.span
                            layoutId="theme-pill"
                            transition={SPRING}
                            className="absolute inset-0 rounded-full bg-primary"
                          />
                        )}
                        <ThemeIcon className="relative size-4" />
                        <span className="relative">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </motion.section>

              <motion.section variants={RISE} className="flex flex-col gap-2.5">
                <span className="px-1 text-[13px] font-semibold text-muted-foreground">
                  Interface
                </span>
                <div className="flex flex-col divide-y divide-border/70 rounded-[24px] bg-card pr-3 pl-[18px]">
                  <SettingRow id="hide-info" title="Hide info button">
                    <Switch
                      id="hide-info"
                      checked={interfacePrefs.hideInfo}
                      onCheckedChange={(value) =>
                        setInterfacePref("hideInfo", value)
                      }
                    />
                  </SettingRow>
                  <SettingRow
                    id="hide-builtin"
                    title="Hide built-in categories"
                  >
                    <Switch
                      id="hide-builtin"
                      checked={interfacePrefs.hideBuiltinCategories}
                      disabled={interfacePrefs.hideCustomCategories}
                      onCheckedChange={(value) =>
                        setInterfacePref("hideBuiltinCategories", value)
                      }
                    />
                  </SettingRow>
                  <SettingRow id="hide-custom" title="Hide your categories">
                    <Switch
                      id="hide-custom"
                      checked={interfacePrefs.hideCustomCategories}
                      disabled={interfacePrefs.hideBuiltinCategories}
                      onCheckedChange={(value) =>
                        setInterfacePref("hideCustomCategories", value)
                      }
                    />
                  </SettingRow>
                </div>
              </motion.section>

              {isNativeApp && (
                <motion.section
                  variants={RISE}
                  className="rounded-[24px] bg-card pr-3 pl-[18px]"
                >
                  <SettingRow id="haptics" title="Vibrations">
                    <Switch
                      id="haptics"
                      checked={hapticsOn}
                      onCheckedChange={setHapticsOn}
                    />
                  </SettingRow>
                </motion.section>
              )}

              <motion.section variants={RISE} className="flex flex-col gap-2.5">
                <span className="px-1 text-[13px] font-semibold text-muted-foreground">
                  Version
                </span>
                <div className="flex flex-col divide-y divide-border/70 rounded-[24px] bg-card px-[18px]">
                  <div className="flex min-h-[54px] items-center justify-between">
                    <span className="text-[15px] font-medium">Version</span>
                    <span className="font-display text-sm font-extrabold">
                      v{APP_VERSION}
                    </span>
                  </div>

                  {isNativeApp ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          updateStatus === "available" ||
                          updateStatus === "ready"
                        ) {
                          void installUpdate();
                        } else if (
                          updateStatus !== "checking" &&
                          updateStatus !== "downloading"
                        ) {
                          void checkForUpdates();
                        }
                      }}
                      // relative: popLayout positions the outgoing status against this row, not the scrolled page.
                      className="relative flex min-h-[54px] cursor-pointer items-center justify-between gap-3 text-left"
                    >
                      <span className="text-[15px] font-medium">Updates</span>
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span
                          key={updateStatus}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={SPRING}
                          className={cn(
                            "flex items-center gap-1.5 text-sm font-semibold",
                            updateStatus === "available" ||
                              updateStatus === "downloading" ||
                              updateStatus === "ready"
                              ? "text-pink"
                              : updateStatus === "latest"
                                ? "text-muted-foreground"
                                : "text-highlight",
                          )}
                        >
                          {updateStatus === "checking" && (
                            <>
                              <Loader2 className="size-4 animate-spin" />
                              Checking…
                            </>
                          )}
                          {updateStatus === "latest" && (
                            <>
                              <Check className="size-4 stroke-[2.5]" />
                              Up to date
                            </>
                          )}
                          {updateStatus === "available" && (
                            <>v{updateVersion} available</>
                          )}
                          {updateStatus === "downloading" && (
                            <span className="tabular-nums">
                              Downloading {Math.round(downloadProgress * 100)}%
                            </span>
                          )}
                          {updateStatus === "ready" && (
                            <>v{updateVersion} ready</>
                          )}
                          {updateStatus === "error" && (
                            <>Couldn’t check · retry</>
                          )}
                          {updateStatus === "idle" && <>Check now</>}
                        </motion.span>
                      </AnimatePresence>
                    </button>
                  ) : isIOS && !isInstalledWebApp ? (
                    // iOS has no install prompt a web app can trigger, so explain the Share-sheet route.
                    <button
                      type="button"
                      onClick={() => {
                        haptic.tap();
                        setShowInstallHelp(true);
                      }}
                      className="flex min-h-[54px] cursor-pointer items-center justify-between gap-3 text-left"
                    >
                      <span className="text-[15px] font-medium">
                        Add to Home Screen
                      </span>
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        How
                        <ChevronRight className="size-4" />
                      </span>
                    </button>
                  ) : null}

                  {isNativeApp && (
                    <SettingRow id="auto-update" title="Auto-update">
                      <Switch
                        id="auto-update"
                        checked={autoUpdate}
                        onCheckedChange={setAutoUpdate}
                      />
                    </SettingRow>
                  )}
                </div>

                <AnimatePresence initial={false}>
                  {isNativeApp &&
                    (updateStatus === "available" ||
                      updateStatus === "downloading" ||
                      updateStatus === "ready") && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={SPRING}
                        className="overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={installUpdate}
                          disabled={updateStatus === "downloading"}
                          className="relative mt-1 flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-full bg-primary font-display text-[15px] font-extrabold text-primary-foreground transition-[scale] active:scale-[0.98] disabled:cursor-default"
                        >
                          {updateStatus === "downloading" && (
                            <motion.span
                              className="absolute inset-y-0 left-0 bg-primary-foreground/15"
                              animate={{
                                width: `${Math.round(downloadProgress * 100)}%`,
                              }}
                              transition={{ duration: 0.2 }}
                            />
                          )}
                          <span className="relative flex items-center gap-2 tabular-nums">
                            {updateStatus === "downloading" ? (
                              <>
                                <Loader2 className="size-4 animate-spin" />
                                downloading {Math.round(downloadProgress * 100)}
                                %
                              </>
                            ) : updateStatus === "ready" ? (
                              <>
                                <Download className="size-4" />
                                install v{updateVersion}
                              </>
                            ) : (
                              <>
                                <Download className="size-4" />
                                download & install v{updateVersion}
                              </>
                            )}
                          </span>
                        </button>
                      </motion.div>
                    )}
                </AnimatePresence>

                {!isNativeApp && !isIOS && (
                  <a
                    href={APK_DOWNLOAD_URL}
                    className="mt-1 flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground transition-[filter,scale] hover:brightness-105 active:scale-[0.98]"
                  >
                    <Download className="size-4" />
                    download for android
                  </a>
                )}
              </motion.section>

              <motion.section variants={RISE} className="flex flex-col gap-2.5">
                <span className="px-1 text-[13px] font-semibold text-muted-foreground">
                  About
                </span>
                <div className="flex flex-col divide-y divide-border/70 rounded-[24px] bg-card px-[18px]">
                  {[
                    { label: "Made by", value: AUTHOR_NAME, href: AUTHOR_URL },
                    // In a browser tab you're already on the website.
                    ...(isNativeApp || isInstalledWebApp
                      ? [
                          {
                            label: "Website",
                            value: "tjeneritz.se",
                            href: WEBSITE_URL,
                          },
                        ]
                      : []),
                    {
                      label: "Source code",
                      value: "GitHub",
                      href: githubRepoUrl,
                    },
                  ].map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      target={externalLinkTarget}
                      rel="noreferrer"
                      className="flex min-h-[54px] items-center justify-between gap-3"
                    >
                      <span className="text-[15px] font-medium">
                        {link.label}
                      </span>
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        {link.value}
                        <ExternalLink className="size-3.5" />
                      </span>
                    </a>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      haptic.tap();
                      setShowLicense(true);
                    }}
                    className="flex min-h-[54px] cursor-pointer items-center justify-between gap-3 text-left"
                  >
                    <span className="text-[15px] font-medium">License</span>
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      GPL-3.0
                      <ChevronRight className="size-4" />
                    </span>
                  </button>
                </div>
              </motion.section>

              <motion.div variants={RISE} className="flex justify-center pb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[13px]"
                  onClick={() => {
                    haptic.press();
                    resetSettings();
                  }}
                >
                  <RotateCcw className="size-3.5" />
                  Reset game settings
                </Button>
              </motion.div>
            </motion.div>
          </Page>

          <ConfirmDialog
            open={showEndConfirm}
            predictive={backTarget === "confirm"}
            icon={<VenetianMask className="size-7" aria-hidden />}
            title="end this round?"
            confirmLabel="end round"
            cancelLabel="keep playing"
            onConfirm={confirmEndGame}
            onCancel={() => setShowEndConfirm(false)}
          />

          {/* iPhone: how to install from Safari */}
          <Sheet
            open={showInstallHelp}
            predictive={backTarget === "installHelp"}
            onClose={() => setShowInstallHelp(false)}
            labelledBy="install-help-title"
            className="gap-5"
            header={
              <div className="flex h-11 items-center justify-between">
                <h2
                  id="install-help-title"
                  className="font-display text-[22px] font-extrabold tracking-[-0.02em]"
                >
                  add to home screen
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className="-mr-2.5"
                  onClick={() => setShowInstallHelp(false)}
                  aria-label="Close"
                >
                  <X className="size-5 stroke-[2.2]" />
                </Button>
              </div>
            }
          >
            <motion.ol
              variants={STAGGER}
              initial="initial"
              animate="animate"
              className="flex flex-col gap-3 pb-2"
            >
              {[
                { icon: Share, text: "Tap Share in Safari’s toolbar." },
                {
                  icon: SquarePlus,
                  text: "Scroll down and tap Add to Home Screen.",
                },
                {
                  icon: Check,
                  text: "Tap Add. Imposter opens full screen from your home screen.",
                },
              ].map((step, index) => (
                <motion.li
                  key={step.text}
                  variants={RISE}
                  className="flex items-center gap-4 rounded-[20px] bg-secondary py-3.5 pr-4 pl-3.5"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-card text-pink">
                    <step.icon className="size-5" />
                  </span>
                  <span className="text-[15px] leading-snug">
                    <span className="mr-1.5 font-display font-extrabold text-pink">
                      {index + 1}
                    </span>
                    {step.text}
                  </span>
                </motion.li>
              ))}
            </motion.ol>
          </Sheet>

          {/* License, readable in-app */}
          <Page
            open={showLicense}
            predictive={backTarget === "license"}
            onClose={() => setShowLicense(false)}
            title="license"
            stacked
          >
            <div className="flex flex-col gap-4 pb-4 text-[14px] leading-relaxed text-muted-foreground">
              {LICENSE_PARAGRAPHS.map((paragraph, index) => {
                // Short lines are the license's own headings ("TERMS AND CONDITIONS", "0. Definitions.").
                const isHeading =
                  paragraph.length < 60 && !paragraph.endsWith(",");
                return isHeading ? (
                  <h2
                    key={index}
                    className={cn(
                      "font-semibold text-foreground",
                      index === 0 &&
                        "font-display text-lg font-extrabold leading-snug",
                    )}
                  >
                    {paragraph}
                  </h2>
                ) : (
                  <p key={index}>{paragraph}</p>
                );
              })}
            </div>
          </Page>
        </div>
      </MotionConfig>
    </PredictiveBackContext.Provider>
  );
}

export default App;
