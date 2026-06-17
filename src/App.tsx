import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NumberStepper } from "@/components/ui/number-stepper";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  Eye,
  EyeOff,
  Github,
  Moon,
  Play,
  RotateCcw,
  Shuffle,
  Sun,
  Users,
  VenetianMask,
} from "lucide-react";
import type { ButtonProps } from "@/components/ui/button";

type CategoryFile = {
  name: string;
  easy: string[];
  hard: string[];
  wip?: boolean;
};

type Category = {
  label: string;
  easy: string[];
  hard: string[];
  wip: boolean;
};

const categoryFiles = import.meta.glob<{ default: CategoryFile }>(
  "./data/*.json",
  { eager: true },
);

const CATEGORIES: Record<string, Category> = Object.fromEntries(
  Object.entries(categoryFiles).map(([path, module]) => {
    const fileName = path.split("/").pop() ?? path;
    const key = fileName.replace(".json", "");
    const { name, easy, hard, wip } = module.default;
    return [key, { label: name, easy, hard, wip: wip === true }];
  }),
);

const APP_VERSION = __APP_VERSION__;

const CATEGORY_KEYS = Object.keys(CATEGORIES);
const DEFAULT_CATEGORY = CATEGORY_KEYS[0] ?? "random";
type Difficulty = "easy" | "hard" | "all";
const DIFFICULTY_DESCRIPTIONS: Record<Difficulty, string> = {
  easy: "More common and obvious words.",
  hard: "More niche and less obvious words.",
  all: "Mixes both easy and hard words.",
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
  prankProbability: 10,
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
const PANEL_TRANSITION = { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const };
const PANEL_VARIANTS = {
  initial: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? 30 : -30,
    scale: 0.995,
  }),
  animate: { opacity: 1, x: 0, scale: 1, transition: PANEL_TRANSITION },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? -24 : 24,
    scale: 0.995,
    transition: { duration: 0.14, ease: [0.4, 0, 1, 1] as const },
  }),
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
    if (typeof window === "undefined") return "light";

    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === "light" || savedTheme === "dark") {
      return savedTheme;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
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
  const [transitionDirection, setTransitionDirection] = useState<1 | -1>(1);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

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

    setTransitionDirection(1);
    setGameState("pass");
  };

  const nextTurn = () => {
    setTransitionDirection(1);
    if (currentPlayer < playersCount) {
      setCurrentPlayer(currentPlayer + 1);
      setGameState("pass");
    } else {
      setGameState("end");
    }
  };

  const revealRole = () => {
    setTransitionDirection(1);
    setGameState("reveal");
  };

  const resetToSetup = () => {
    setTransitionDirection(-1);
    setGameState("setup");
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

  let primaryLabel = "Start Game";
  let primaryIcon: LucideIcon = Play;
  let primaryVariant: ButtonProps["variant"] = "default";
  let primaryDisabled = isStartDisabled;
  let primaryAction = startGame;

  if (gameState === "pass") {
    primaryLabel = "Reveal Role";
    primaryIcon = Eye;
    primaryDisabled = false;
    primaryAction = revealRole;
  } else if (gameState === "reveal") {
    primaryLabel = "Hide & Next";
    primaryIcon = EyeOff;
    primaryVariant = "secondary";
    primaryDisabled = false;
    primaryAction = nextTurn;
  } else if (gameState === "end") {
    primaryLabel = "New Game";
    primaryIcon = RotateCcw;
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

  return (
    <div className="relative box-border flex h-dvh min-h-dvh w-full items-center justify-center overflow-hidden bg-background p-4 transition-colors">
      <a
        href={githubRepoUrl}
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-4 right-4 inline-flex items-center gap-2 border-2 border-border bg-background px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground shadow-brutal-sm transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:bg-accent hover:text-accent-foreground hover:shadow-none md:bottom-6 md:right-6"
        aria-label="Star freeeranger/imposter-game on GitHub"
      >
        <Github className="h-3.5 w-3.5" />
        <span>Star on GitHub</span>
      </a>
      <span
        className="absolute bottom-4 left-4 inline-flex items-center border-2 border-border bg-background px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground shadow-brutal-sm md:bottom-6 md:left-6"
        title={`Built ${APP_VERSION}`}
      >
        v{APP_VERSION}
      </span>
      <Button
        variant="outline"
        size="icon"
        className="absolute right-4 top-4 z-10 md:right-6 md:top-6"
        onClick={() =>
          setTheme((currentTheme) =>
            currentTheme === "dark" ? "light" : "dark",
          )
        }
        aria-label={
          theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
        }
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={theme}
            initial={{ opacity: 0, rotate: -35, scale: 0.8 }}
            animate={{
              opacity: 1,
              rotate: 0,
              scale: 1,
              transition: { duration: 0.16 },
            }}
            exit={{
              opacity: 0,
              rotate: 35,
              scale: 0.8,
              transition: { duration: 0.12 },
            }}
            className="inline-flex"
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </motion.span>
        </AnimatePresence>
      </Button>

      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.22 } }}
        className="mx-auto flex h-full w-full max-w-md items-center"
      >
        <Card
          className="flex w-full flex-col overflow-hidden"
          style={{
            minHeight: "min(38rem, calc(100dvh - 4rem))",
            maxHeight: "calc(100dvh - 4rem)",
          }}
        >
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold tracking-tight">
              Imposter Game
            </CardTitle>
            <CardDescription>Find the imposter among you.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
            <div className="flex min-h-full flex-col [justify-content:safe_center] py-2">
              <AnimatePresence
                mode="wait"
                initial={false}
                custom={transitionDirection}
              >
                {gameState === "setup" && (
                  <motion.div
                    key={panelKey}
                    custom={transitionDirection}
                    variants={PANEL_VARIANTS}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="space-y-6"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="players">Players</Label>
                        <NumberStepper
                          id="players"
                          min={3}
                          max={20}
                          value={playersCount}
                          onChange={(value) => {
                            setPlayersCount(value);
                            if (impostersCount >= value) {
                              setImpostersCount(Math.max(1, value - 1));
                            }
                          }}
                          icon={Users}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="imposters">Imposters</Label>
                        <NumberStepper
                          id="imposters"
                          min={1}
                          max={playersCount - 1}
                          value={impostersCount}
                          onChange={setImpostersCount}
                          icon={Users}
                          iconClassName="text-destructive"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="prank-probability">
                          Prank Probability
                        </Label>
                        <NumberStepper
                          id="prank-probability"
                          min={0}
                          max={100}
                          value={prankProbability}
                          onChange={setPrankProbability}
                          icon={VenetianMask}
                          iconClassName="text-primary"
                          suffix="%"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="category">Category</Label>
                        <Select
                          value={selectedCategory}
                          onValueChange={(value) =>
                            setSelectedCategory(value as string | "random")
                          }
                        >
                          <SelectTrigger id="category">
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem
                              value="random"
                              className="font-semibold"
                            >
                              Random category
                            </SelectItem>
                            {Object.entries(CATEGORIES).map(([key, cat]) => (
                              <SelectItem key={key} value={key}>
                                <span className="inline-flex items-center gap-2">
                                  {cat.label}
                                  {cat.wip && (
                                    <span className="inline-flex shrink-0 items-center border border-border bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-widest text-muted-foreground">
                                      WIP
                                    </span>
                                  )}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="difficulty">Word Difficulty</Label>
                        <Select
                          value={selectedDifficulty}
                          onValueChange={(value) =>
                            setSelectedDifficulty(value as Difficulty)
                          }
                        >
                          <SelectTrigger id="difficulty">
                            <SelectValue placeholder="Select word difficulty" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="easy">Easy</SelectItem>
                            <SelectItem value="hard">Hard</SelectItem>
                            <SelectItem value="all">All</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-sm text-muted-foreground">
                          {DIFFICULTY_DESCRIPTIONS[selectedDifficulty]}
                        </p>
                      </div>

                      {selectedCategory === "random" && (
                        <div className="space-y-3 border-2 border-border bg-muted/40 p-4">
                          <Label className="text-sm text-muted-foreground block mb-2">
                            Include Categories:
                          </Label>
                          <div className="grid grid-cols-2 gap-3">
                            {CATEGORY_KEYS.map((key) => (
                              <div
                                key={key}
                                className="flex items-center space-x-2"
                              >
                                <Checkbox
                                  id={`pool-${key}`}
                                  checked={randomPool[key]}
                                  onCheckedChange={(checked) =>
                                    setRandomPool((prev) => ({
                                      ...prev,
                                      [key]: checked === true,
                                    }))
                                  }
                                />
                                <label
                                  htmlFor={`pool-${key}`}
                                  className="inline-flex items-center gap-1.5 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                  {CATEGORIES[key].label}
                                  {CATEGORIES[key].wip && (
                                    <span className="inline-flex shrink-0 items-center border border-border bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-widest text-muted-foreground">
                                      WIP
                                    </span>
                                  )}
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between border-2 border-border p-4">
                      <div className="space-y-0.5">
                        <Label className="text-base">
                          Randomize Starting Player
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Randomly picks someone to speak first.
                        </p>
                      </div>
                      <Switch
                        checked={randomizeStarter}
                        onCheckedChange={setRandomizeStarter}
                      />
                    </div>

                    {impostersCount >= 2 && (
                      <div className="flex items-center justify-between border-2 border-border p-4">
                        <div className="space-y-0.5">
                          <Label className="text-base">
                            Imposters Know Each Other
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Each imposter is shown who the others are.
                          </p>
                        </div>
                        <Switch
                          checked={revealFellowImposters}
                          onCheckedChange={setRevealFellowImposters}
                        />
                      </div>
                    )}

                    <div className="flex justify-center pt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={resetSettings}
                      >
                        <RotateCcw />
                        Reset settings
                      </Button>
                    </div>
                  </motion.div>
                )}

                {gameState === "pass" && (
                  <motion.div
                    key={panelKey}
                    custom={transitionDirection}
                    variants={PANEL_VARIANTS}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="text-center space-y-8 py-6"
                  >
                    <div className="space-y-2">
                      <h2 className="text-2xl font-bold uppercase tracking-tight text-muted-foreground">
                        Pass device to
                      </h2>
                      <p className="text-5xl font-bold uppercase tracking-tighter text-primary">
                        Player {currentPlayer}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Make sure no one else is looking at the screen.
                    </p>
                  </motion.div>
                )}

                {gameState === "reveal" && (
                  <motion.div
                    key={panelKey}
                    custom={transitionDirection}
                    variants={PANEL_VARIANTS}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="text-center space-y-8 py-6"
                  >
                    <h2 className="text-xl font-bold uppercase tracking-tight text-muted-foreground">
                      Player {currentPlayer}
                    </h2>
                    <div className="border-2 border-border bg-muted p-8">
                      {currentAssignment?.isImposter ? (
                        <div className="space-y-2">
                          <p className="text-4xl font-black uppercase tracking-tight text-destructive">
                            YOU ARE THE IMPOSTER
                          </p>
                          <p className="text-lg text-muted-foreground mt-4">
                            Category:{" "}
                            <span className="font-semibold text-foreground">
                              {CATEGORIES[activeCategory]?.label}
                            </span>
                          </p>
                          <p className="text-sm text-muted-foreground mt-2">
                            Try to blend in with the rest of the table.
                          </p>
                          {fellowImposters.length > 0 && (
                            <div className="mt-4 border-2 border-border bg-background p-3">
                              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                                {fellowImposters.length === 1
                                  ? "Your fellow imposter"
                                  : "Your fellow imposters"}
                              </p>
                              <p className="mt-1 text-lg font-bold uppercase tracking-tight text-destructive">
                                {fellowImposters
                                  .map((number) => `Player ${number}`)
                                  .join(" · ")}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm uppercase tracking-wider font-semibold text-muted-foreground">
                            The Word Is
                          </p>
                          <p className="text-4xl font-black uppercase tracking-tight text-primary">
                            {currentAssignment?.word ?? "No word"}
                          </p>
                          <p className="text-lg text-muted-foreground mt-4">
                            Category:{" "}
                            <span className="font-semibold text-foreground">
                              {CATEGORIES[activeCategory]?.label}
                            </span>
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {gameState === "end" && (
                  <motion.div
                    key={panelKey}
                    custom={transitionDirection}
                    variants={PANEL_VARIANTS}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="text-center space-y-8 py-6"
                  >
                    <div className="space-y-4">
                      <h2 className="text-3xl font-bold uppercase tracking-tight text-primary">
                        Game Started!
                      </h2>
                      <p className="text-lg text-muted-foreground">
                        Everyone has seen their role. Start discussing and
                        figure out what is going on this round.
                      </p>
                      {startingPlayer && (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{
                            opacity: 1,
                            y: 0,
                            transition: { duration: 0.16, delay: 0.03 },
                          }}
                          className="mt-6 border-2 border-border bg-primary/10 p-4"
                        >
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <Shuffle className="w-5 h-5 text-primary" />
                            <p className="text-sm font-semibold uppercase tracking-wider text-primary">
                              Random Starter
                            </p>
                          </div>
                          <p className="text-2xl font-bold uppercase tracking-tight text-foreground">
                            Player {startingPlayer}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            goes first this round!
                          </p>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </CardContent>
          <CardFooter className="shrink-0 border-t-2 border-border bg-card px-6 pb-6 pt-4">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`footer-${panelKey}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.15 } }}
                exit={{ opacity: 0, y: -8, transition: { duration: 0.1 } }}
                className="w-full"
              >
                <Button
                  onClick={primaryAction}
                  className="h-14 w-full text-xl"
                  size="lg"
                  variant={primaryVariant}
                  disabled={primaryDisabled}
                >
                  <PrimaryIcon className="mr-2 h-6 w-6" />
                  {primaryLabel}
                </Button>
              </motion.div>
            </AnimatePresence>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}

export default App;
