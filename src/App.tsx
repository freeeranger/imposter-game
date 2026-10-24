import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { NumberStepper } from "@/components/ui/number-stepper";
import { RollingNumber } from "@/components/ui/rolling-number";
import { Sheet } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useMotionValue,
  useTransform,
} from "motion/react";
import type { Variants } from "motion/react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Download,
  Check,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  Github,
  Info,
  Moon,
  Music,
  RotateCcw,
  Shuffle,
  Sun,
  VenetianMask,
  X,
} from "lucide-react";
import {
  APK_DOWNLOAD_URL,
  exitApp,
  externalLinkTarget,
  fetchLatestVersion,
  haptic,
  isNativeApp,
  isNewerVersion,
  onBackButton,
  setKeepAwake,
  setSystemBarsTheme,
} from "@/lib/native";
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

const CATEGORY_KEYS = Object.keys(CATEGORIES);
const DEFAULT_CATEGORY = CATEGORY_KEYS[0] ?? "random";
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

const RoundProgress = ({ current, total }: { current: number; total: number }) => (
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
      <Button variant="secondary" size="icon" onClick={onEnd} aria-label="End game">
        <X className="size-[18px] stroke-[2.2]" />
      </Button>
      <span className="flex items-baseline gap-1 text-[15px] font-bold">
        player <RollingNumber value={current} />
        <span className="font-medium text-muted-foreground">of {total}</span>
      </span>
      <span className="size-11" aria-hidden="true" />
    </div>
    <RoundProgress current={current} total={total} />
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
      className="flex h-full w-full cursor-grab touch-pan-y flex-col justify-between rounded-[32px] bg-card p-6 shadow-[10px_10px_0_var(--pink)] active:cursor-grabbing"
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
    <label htmlFor={id} className="flex min-w-0 cursor-pointer flex-col gap-0.5">
      <span className="text-[15px] font-semibold">{title}</span>
      {description && (
        <span className="text-[13px] text-muted-foreground">{description}</span>
      )}
    </label>
    {children}
  </div>
);

const wordSizeClass = (word: string) => {
  if (word.length > 22) return "text-[26px]";
  if (word.length > 14) return "text-[32px]";
  return "text-[42px]";
};

const getCategoryWords = (category: Category, difficulty: Difficulty): string[] => {
  if (difficulty === "easy") return category.easy;
  if (difficulty === "hard") return category.hard;
  return [...category.easy, ...category.hard];
};

type GameState = "setup" | "pass" | "reveal" | "end";
type Theme = "light" | "dark";
type PrankMode =
  | "everyone-imposter"
  | "different-words"
  | "no-imposter"
  | "two-imposters";
type PlayerAssignment = {
  isImposter: boolean;
  word: string | null;
};

const THEME_STORAGE_KEY = "imposter-game-theme";
const SETTINGS_STORAGE_KEY = "imposter-game-settings";

type PersistedSettings = {
  playersCount: number;
  impostersCount: number;
  selectedCategory: string;
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
    const category =
      parsed.selectedCategory === "random" ||
      (typeof parsed.selectedCategory === "string" &&
        CATEGORIES[parsed.selectedCategory])
        ? parsed.selectedCategory
        : DEFAULT_SETTINGS.selectedCategory;
    return {
      playersCount: players,
      impostersCount: clampInt(
        parsed.impostersCount,
        1,
        Math.max(1, players - 1),
        DEFAULT_SETTINGS.impostersCount,
      ),
      selectedCategory: category,
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
  animate: { opacity: 1, y: 0, transition: { duration: 0.16, ease: "easeOut" } },
};

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
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "dark";

    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === "light" || savedTheme === "dark") {
      return savedTheme;
    }

    return "dark";
  });
  const [settings] = useState(loadSettings);
  const [gameState, setGameState] = useState<GameState>("setup");
  const [playersCount, setPlayersCount] = useState<number>(
    settings.playersCount,
  );
  const [impostersCount, setImpostersCount] = useState<number>(
    settings.impostersCount,
  );
  const [selectedCategory, setSelectedCategory] = useState<string | "random">(
    settings.selectedCategory,
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

  const [playerAssignments, setPlayerAssignments] = useState<PlayerAssignment[]>(
    [],
  );
  const [activeCategory, setActiveCategory] = useState<string>(
    DEFAULT_CATEGORY === "random" ? "" : DEFAULT_CATEGORY,
  );
  const [currentPlayer, setCurrentPlayer] = useState<number>(1);
  const [startingPlayer, setStartingPlayer] = useState<number | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<1 | -1>(-1);
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);
  const [showCategorySheet, setShowCategorySheet] = useState<boolean>(false);
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [lastSingleCategory, setLastSingleCategory] = useState<string>(
    settings.selectedCategory !== "random"
      ? settings.selectedCategory
      : DEFAULT_CATEGORY,
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#15111f" : "#f5f1fc");
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    setSystemBarsTheme(theme);
  }, [theme]);

  // App only: offer the newest APK when GitHub has a newer release than this build.
  useEffect(() => {
    if (!isNativeApp) return;
    let isCancelled = false;
    void fetchLatestVersion().then((latestVersion) => {
      if (!isCancelled && latestVersion && isNewerVersion(latestVersion, APP_VERSION)) {
        setUpdateVersion(latestVersion);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, []);

  // Keep the screen on while the phone is passed around.
  useEffect(() => {
    setKeepAwake(gameState !== "setup");
  }, [gameState]);

  // Android back button: close what's open, step out of a round, then leave the app.
  useEffect(
    () =>
      onBackButton(() => {
        if (showCategorySheet) {
          setShowCategorySheet(false);
        } else if (showInfoModal) {
          setShowInfoModal(false);
        } else if (gameState === "pass" || gameState === "reveal") {
          if (window.confirm("End this round and go back to setup?")) {
            setGameState("setup");
          }
        } else if (gameState === "end") {
          setGameState("setup");
        } else {
          exitApp();
        }
      }),
    [showCategorySheet, showInfoModal, gameState],
  );

  useEffect(() => {
    if (!showInfoModal && !showCategorySheet) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowInfoModal(false);
        setShowCategorySheet(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showInfoModal, showCategorySheet]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify({
          playersCount,
          impostersCount,
          selectedCategory,
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
        ? CATEGORY_KEYS.filter(
            (key) =>
              randomPool[key] &&
              getUniqueCategoryWords(CATEGORIES[key], selectedDifficulty)
                .length > 0,
          )
        : CATEGORIES[selectedCategory]
          ? [selectedCategory]
          : [];

    if (availableCategories.length === 0) return;

    const chosenCategory = pickRandom(availableCategories);
    const categoryWords = getUniqueCategoryWords(
      CATEGORIES[chosenCategory],
      selectedDifficulty,
    );

    if (categoryWords.length === 0) return;

    let assignments: PlayerAssignment[];

    const shouldUsePrank =
      prankProbability > 0 && Math.random() < prankProbability / 100;

    if (shouldUsePrank) {
      const availablePranks: PrankMode[] = [
        "everyone-imposter",
        "no-imposter",
      ];

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
        shuffle(Array.from({ length: playersCount }, (_, index) => index)).slice(
          0,
          impostersCount,
        ),
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
      setStartingPlayer(Math.floor(Math.random() * playersCount) + 1);
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
    if (window.confirm("End this round and go back to setup?")) {
      resetToSetup();
    }
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

  const resetSettings = () => {
    setPlayersCount(DEFAULT_SETTINGS.playersCount);
    setImpostersCount(DEFAULT_SETTINGS.impostersCount);
    setSelectedCategory(DEFAULT_SETTINGS.selectedCategory);
    setSelectedDifficulty(DEFAULT_SETTINGS.selectedDifficulty);
    setRandomizeStarter(DEFAULT_SETTINGS.randomizeStarter);
    setPrankProbability(DEFAULT_SETTINGS.prankProbability);
    setRevealFellowImposters(DEFAULT_SETTINGS.revealFellowImposters);
    setRandomPool({ ...DEFAULT_SETTINGS.randomPool });
  };

  const hasCategories = CATEGORY_KEYS.length > 0;
  const isStartDisabled =
    !hasCategories ||
    (selectedCategory === "random" &&
      !CATEGORY_KEYS.some(
        (key) =>
          randomPool[key] &&
          getCategoryWords(CATEGORIES[key], selectedDifficulty).length > 0,
      )) ||
    (selectedCategory !== "random" &&
      (!CATEGORIES[selectedCategory] ||
        getCategoryWords(CATEGORIES[selectedCategory], selectedDifficulty)
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
  const selectedCategoryInfo = isRandomMix
    ? undefined
    : CATEGORIES[selectedCategory];
  const randomPoolCount = CATEGORY_KEYS.filter((key) => randomPool[key]).length;
  const selectedWordCount = selectedCategoryInfo
    ? getUniqueCategoryWords(selectedCategoryInfo, selectedDifficulty).length
    : 0;
  const activeCategoryInfo = CATEGORIES[activeCategory];
  const canRevealFellows = impostersCount >= 2;

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative flex h-dvh w-full justify-center overflow-hidden bg-background text-foreground transition-colors select-none">
        <div className="flex h-full w-full max-w-md flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))]">
          {/* Top bar: stays put while the content below changes */}
          <div className="shrink-0">
            <AnimatePresence mode="wait" initial={false}>
              {gameState === "setup" && (
                <motion.header
                  key="setup-bar"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0, transition: SOFT_SPRING }}
                  exit={FADE_OUT}
                  className="flex h-11 items-center justify-between"
                >
                  <h1 className="font-display text-[28px] font-extrabold leading-none tracking-[-0.03em]">
                    imposter
                  </h1>
                  <div className="-mr-2.5 flex">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowInfoModal(true)}
                      aria-label="How to play"
                    >
                      <Info className="size-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setTheme((currentTheme) =>
                          currentTheme === "dark" ? "light" : "dark",
                        )
                      }
                      aria-label={
                        theme === "dark"
                          ? "Switch to light mode"
                          : "Switch to dark mode"
                      }
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                          key={theme}
                          initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
                          animate={{ opacity: 1, rotate: 0, scale: 1 }}
                          exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
                          transition={SPRING}
                          className="inline-flex"
                        >
                          {theme === "dark" ? (
                            <Sun className="size-5" />
                          ) : (
                            <Moon className="size-5" />
                          )}
                        </motion.span>
                      </AnimatePresence>
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
            </AnimatePresence>
          </div>

          <main className="relative flex min-h-0 flex-1 flex-col [perspective:1200px]">
            <AnimatePresence mode="wait" initial={false} custom={swipeDirection}>
              {gameState === "setup" && (
                <motion.div
                  key="setup"
                  variants={STAGGER}
                  initial="initial"
                  animate="animate"
                  exit={FADE_OUT}
                  className="-mx-5 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-5 pt-5 pb-2"
                >
                  {updateVersion && (
                    <motion.a
                      variants={RISE}
                      href={APK_DOWNLOAD_URL}
                      whileTap={{ scale: 0.98 }}
                      className="flex shrink-0 items-center justify-between gap-3 rounded-[20px] bg-pink py-3 pr-3 pl-[18px] text-pink-foreground"
                    >
                      <span className="flex flex-col">
                        <span className="text-[15px] font-bold">update available</span>
                        <span className="text-[13px] font-medium opacity-80">
                          v{updateVersion} is out
                        </span>
                      </span>
                      <span className="flex h-11 items-center gap-1.5 rounded-full bg-pink-foreground px-4 text-sm font-bold text-pink">
                        <Download className="size-4" />
                        download
                      </span>
                    </motion.a>
                  )}
                  <motion.div
                    variants={RISE}
                    className="grid shrink-0 grid-cols-2 rounded-[24px] bg-card pt-4 pb-[18px]"
                  >
                    <div className="flex flex-col items-center gap-2 border-r border-border/70 px-3.5">
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
                        onChange={(value) => {
                          setPlayersCount(value);
                          if (impostersCount >= value) {
                            setImpostersCount(Math.max(1, value - 1));
                          }
                        }}
                      />
                    </div>
                    <div className="flex flex-col items-center gap-2 px-3.5">
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
                        valueClassName="text-pink"
                      />
                    </div>
                  </motion.div>

                  <motion.div variants={RISE} className="shrink-0 py-1 pr-1.5">
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
                                  : (selectedCategoryInfo?.label ?? "pick one")}
                              </span>
                            </span>
                            <span className="flex items-baseline gap-1 text-[13px] text-muted-foreground">
                              {isRandomMix ? (
                                <>
                                  picks from <RollingNumber value={randomPoolCount} /> of{" "}
                                  {CATEGORY_KEYS.length}
                                </>
                              ) : (
                                <>
                                  <RollingNumber value={selectedWordCount} /> words
                                </>
                              )}
                            </span>
                          </motion.span>
                        </AnimatePresence>
                      </span>
                      <ChevronRight className="size-5 shrink-0 stroke-[2.2] text-muted-foreground" />
                    </motion.button>
                  </motion.div>

                  <motion.div variants={RISE} className="flex shrink-0 flex-col gap-2.5">
                    <div className="flex items-baseline justify-between gap-3 px-1">
                      <span
                        id="difficulty-label"
                        className="text-[13px] font-semibold text-muted-foreground"
                      >
                        Difficulty
                      </span>
                      <span className="relative h-5 min-w-0 flex-1 overflow-hidden text-right">
                        <AnimatePresence mode="popLayout" initial={false}>
                          <motion.span
                            key={selectedDifficulty}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={SPRING}
                            className="block truncate text-[13px] text-muted-foreground/80"
                          >
                            {DIFFICULTY_DESCRIPTIONS[selectedDifficulty]}
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
                        const isSelected = difficulty === selectedDifficulty;
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
                  </motion.div>

                  <motion.div
                    variants={RISE}
                    className="flex shrink-0 flex-col divide-y divide-border/70 rounded-[24px] bg-card pr-3 pl-[18px]"
                  >
                    <SettingRow id="randomize-starter" title="Random first speaker">
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
                            description="They see each other’s player numbers."
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
                        step={5}
                        value={prankProbability}
                        onChange={setPrankProbability}
                        suffix="%"
                      />
                    </SettingRow>
                  </motion.div>

                  <motion.div variants={RISE} className="flex shrink-0 justify-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[13px] text-muted-foreground/80"
                      onClick={resetSettings}
                    >
                      Reset settings
                    </Button>
                  </motion.div>
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
                    className="text-base font-semibold text-muted-foreground"
                  >
                    pass the phone to
                  </motion.span>
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
                    className="h-[min(420px,52dvh)] w-full max-w-[310px]"
                  >
                    <SwipeCard onSwipe={passWithSwipe}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-muted-foreground">
                          {currentAssignment?.isImposter ? "your role" : "your word"}
                        </span>
                        <VenetianMask className="size-6 text-pink" aria-hidden />
                      </div>
                      {currentAssignment?.isImposter ? (
                        <div className="flex flex-col items-center gap-2 text-center">
                          <span className="text-base font-semibold">you are the</span>
                          <p className="font-display text-[40px] font-extrabold leading-[1.05] tracking-[-0.03em] text-pink">
                            imposter
                          </p>
                        </div>
                      ) : (
                        <p
                          className={cn(
                            "text-center font-display font-extrabold leading-[1.05] tracking-[-0.03em] break-words text-highlight",
                            wordSizeClass(currentAssignment?.word ?? ""),
                          )}
                        >
                          {currentAssignment?.word ?? "no word"}
                        </p>
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
                  <motion.span
                    variants={POP}
                    className="flex size-16 items-center justify-center rounded-full bg-card"
                  >
                    <VenetianMask className="size-8 text-pink" aria-hidden />
                  </motion.span>
                  <motion.div variants={RISE} className="flex flex-col gap-2">
                    <h2 className="font-display text-4xl font-extrabold tracking-[-0.03em]">
                      all clear
                    </h2>
                    <p className="mx-auto max-w-xs text-[15px] text-muted-foreground">
                      everyone has seen their card. put the phone down and start
                      talking.
                    </p>
                  </motion.div>
                  {startingPlayer && (
                    <motion.div
                      variants={DROP_CARD}
                      className="w-full max-w-xs rounded-[28px] bg-card p-5 shadow-[8px_8px_0_var(--pink)]"
                    >
                      <span className="flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground">
                        <Shuffle className="size-4 text-pink" aria-hidden />
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
                </motion.div>
              )}
            </AnimatePresence>
          </main>

          <footer className="shrink-0 pt-4">
            <Button
              onClick={primaryAction}
              size="lg"
              className="relative w-full overflow-hidden"
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
                    <PrimaryIcon className="size-5 stroke-[2.4]" />
                  )}
                  {primaryLabel}
                  {primaryIconAtEnd && (
                    <PrimaryIcon className="size-[22px] stroke-[2.6]" />
                  )}
                </motion.span>
              </AnimatePresence>
            </Button>
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
                    : "pick at least one category for the random mix."}
                </motion.p>
              )}
            </AnimatePresence>
          </footer>
        </div>

        {/* Category picker */}
        <Sheet
          open={showCategorySheet}
          onClose={() => setShowCategorySheet(false)}
          labelledBy="category-sheet-title"
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
                    setSelectedCategory(mode.random ? "random" : lastSingleCategory);
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
                      {CATEGORY_KEYS.length}
                    </span>
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-11 font-bold text-highlight hover:text-highlight"
                      onClick={() =>
                        setRandomPool(
                          Object.fromEntries(CATEGORY_KEYS.map((k) => [k, true])),
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
                          Object.fromEntries(CATEGORY_KEYS.map((k) => [k, false])),
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
                animate: { transition: { staggerChildren: 0.006, delayChildren: 0.02 } },
              }}
              initial="initial"
              animate="animate"
              className="grid grid-cols-2 gap-1.5"
            >
              {CATEGORY_KEYS.map((key) => {
                const category = CATEGORIES[key];

                if (!isRandomMix) {
                  const isSelected = key === selectedCategory;
                  return (
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
                        "relative isolate flex h-[54px] cursor-pointer flex-col items-start justify-center gap-0.5 rounded-2xl bg-secondary px-3.5 text-left transition-colors duration-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60",
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
                }

                const isIncluded = !!randomPool[key];
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
              })}
            </motion.div>
          </div>

          <Button
            size="lg"
            className="h-[52px] shrink-0 text-[17px]"
            onClick={() => setShowCategorySheet(false)}
          >
            done
          </Button>
        </Sheet>

        {/* How to play */}
        <Sheet
          open={showInfoModal}
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
                variant="raised"
                size="icon"
                onClick={() => setShowInfoModal(false)}
                aria-label="Close"
              >
                <X className="size-[18px] stroke-[2.2]" />
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

          <div className="flex shrink-0 flex-col gap-3">
            {!isNativeApp && (
              <a
                href={APK_DOWNLOAD_URL}
                className="flex h-12 items-center justify-between rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground transition-[filter,transform] hover:brightness-105 active:scale-[0.98]"
              >
                <span className="flex items-center gap-2">
                  <Download className="size-4" />
                  download for android
                </span>
                <span className="text-xs font-semibold opacity-70">apk · v{APP_VERSION}</span>
              </a>
            )}
            <a
              href={githubRepoUrl}
              target={externalLinkTarget}
              rel="noreferrer"
              className="flex h-12 items-center justify-between rounded-full bg-secondary px-5 text-sm font-bold transition-[filter,transform] hover:brightness-110 active:scale-[0.98]"
            >
              <span className="flex items-center gap-2">
                <Github className="size-4" />
                star on github
              </span>
              <ExternalLink className="size-3.5 text-muted-foreground" />
            </a>
            <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
              <span>tjeneritz.se</span>
              <span>v{APP_VERSION}</span>
            </div>
          </div>
        </Sheet>
      </div>
    </MotionConfig>
  );
}

export default App;
