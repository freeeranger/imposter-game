import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NumberStepper } from "@/components/ui/number-stepper";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, Moon, Play, RotateCcw, Shuffle, Sun, Users } from "lucide-react";

type CategoryFile = {
  name: string;
  entries: string[];
};

type Category = {
  label: string;
  data: string[];
};

const categoryFiles = import.meta.glob<{ default: CategoryFile }>("./data/*.json", { eager: true });

const CATEGORIES: Record<string, Category> = Object.fromEntries(
  Object.entries(categoryFiles).map(([path, module]) => {
    const fileName = path.split("/").pop() ?? path;
    const key = fileName.replace(".json", "");
    const { name, entries } = module.default;
    return [key, { label: name, data: entries }];
  }),
);

const CATEGORY_KEYS = Object.keys(CATEGORIES);
const DEFAULT_CATEGORY = CATEGORY_KEYS[0] ?? "random";

type GameState = "setup" | "pass" | "reveal" | "end";
type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "imposter-game-theme";

function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";

    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === "light" || savedTheme === "dark") {
      return savedTheme;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [gameState, setGameState] = useState<GameState>("setup");
  const [playersCount, setPlayersCount] = useState<number>(4);
  const [impostersCount, setImpostersCount] = useState<number>(1);
  const [selectedCategory, setSelectedCategory] = useState<string | "random">(DEFAULT_CATEGORY);
  const [randomizeStarter, setRandomizeStarter] = useState<boolean>(true);
  
  const [randomPool, setRandomPool] = useState<Record<string, boolean>>(
    Object.fromEntries(CATEGORY_KEYS.map((key) => [key, true])),
  );

  const [imposterIndices, setImposterIndices] = useState<number[]>([]);
  const [targetWord, setTargetWord] = useState<string>("");
  const [activeCategory, setActiveCategory] = useState<string>(DEFAULT_CATEGORY === "random" ? "" : DEFAULT_CATEGORY);
  const [currentPlayer, setCurrentPlayer] = useState<number>(1);
  const [startingPlayer, setStartingPlayer] = useState<number | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const startGame = () => {
    if (playersCount < 3) return; // Need at least 3 players
    
    let chosenCategory: string;
    if (selectedCategory === "random") {
      const available = CATEGORY_KEYS.filter((key) => randomPool[key]);
      if (available.length === 0) return; // Must have at least one category selected
      chosenCategory = available[Math.floor(Math.random() * available.length)];
    } else {
      if (!CATEGORIES[selectedCategory]) return;
      chosenCategory = selectedCategory;
    }

    // Pick random indices for imposters
    const indices: number[] = [];
    while (indices.length < impostersCount) {
      const idx = Math.floor(Math.random() * playersCount);
      if (!indices.includes(idx)) {
        indices.push(idx);
      }
    }

    const categoryData = CATEGORIES[chosenCategory].data;
    if (categoryData.length === 0) return;
    const randomWord = categoryData[Math.floor(Math.random() * categoryData.length)];

    setImposterIndices(indices);
    setTargetWord(randomWord);
    setActiveCategory(chosenCategory);
    setCurrentPlayer(1);
    
    if (randomizeStarter) {
      setStartingPlayer(Math.floor(Math.random() * playersCount) + 1);
    } else {
      setStartingPlayer(null);
    }
    
    setGameState("pass");
  };

  const nextTurn = () => {
    if (currentPlayer < playersCount) {
      setCurrentPlayer(currentPlayer + 1);
      setGameState("pass");
    } else {
      setGameState("end");
    }
  };

  const hasCategories = CATEGORY_KEYS.length > 0;
  const isStartDisabled =
    !hasCategories ||
    (selectedCategory === "random" && !Object.values(randomPool).some(Boolean)) ||
    (selectedCategory !== "random" && !CATEGORIES[selectedCategory]) ||
    impostersCount >= playersCount;

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4 transition-colors">
      <Button
        variant="outline"
        size="icon"
        className="absolute right-4 top-4 rounded-full md:right-6 md:top-6"
        onClick={() => setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"))}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </Button>

      <Card className="mx-auto flex h-[36rem] max-h-[calc(100vh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-lg shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold tracking-tight">Imposter</CardTitle>
          <CardDescription>Find the imposter among you.</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
          {gameState === "setup" && (
            <div className="space-y-6">
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
                    iconClassName="text-red-500"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={selectedCategory}
                    onValueChange={(value) => setSelectedCategory(value as string | "random")}
                  >
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="random" className="font-semibold text-primary">
                        🎲 Random (Mixed)
                      </SelectItem>
                      {Object.entries(CATEGORIES).map(([key, cat]) => (
                        <SelectItem key={key} value={key}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedCategory === "random" && (
                  <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
                    <Label className="text-sm text-muted-foreground block mb-2">Include Categories:</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {CATEGORY_KEYS.map((key) => (
                        <div key={key} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`pool-${key}`} 
                            checked={randomPool[key]}
                            onCheckedChange={(checked) => 
                              setRandomPool(prev => ({...prev, [key]: checked === true}))
                            }
                          />
                          <label
                            htmlFor={`pool-${key}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {CATEGORIES[key].label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label className="text-base">Randomize Starting Player</Label>
                  <p className="text-sm text-muted-foreground">
                    Randomly picks someone to speak first.
                  </p>
                </div>
                <Switch
                  checked={randomizeStarter}
                  onCheckedChange={setRandomizeStarter}
                />
              </div>

              <Button 
                onClick={startGame} 
                className="w-full h-12 text-lg mt-4" 
                size="lg"
                disabled={isStartDisabled}
              >
                <Play className="mr-2 w-5 h-5" />
                Start Game
              </Button>
            </div>
          )}

          {gameState === "pass" && (
            <div className="text-center space-y-8 py-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold text-muted-foreground">Pass device to</h2>
                <p className="text-5xl font-bold text-primary">Player {currentPlayer}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Make sure no one else is looking at the screen.
              </p>
              <Button onClick={() => setGameState("reveal")} className="w-full h-14 text-xl" size="lg">
                <Eye className="mr-2 w-6 h-6" />
                Reveal Role
              </Button>
            </div>
          )}

          {gameState === "reveal" && (
            <div className="text-center space-y-8 py-6">
              <h2 className="text-xl font-semibold text-muted-foreground">Player {currentPlayer}</h2>
              <div className="rounded-lg bg-muted/60 p-8">
                {imposterIndices.includes(currentPlayer - 1) ? (
                  <div className="space-y-2">
                    <p className="text-4xl font-black text-red-500">YOU ARE THE IMPOSTER</p>
                    <p className="text-lg text-muted-foreground mt-4">
                      Category: <span className="font-semibold text-foreground">{CATEGORIES[activeCategory]?.label}</span>
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Try to blend in and guess the word!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm uppercase tracking-wider font-semibold text-muted-foreground">
                      The Word Is
                    </p>
                    <p className="text-4xl font-black text-primary">{targetWord}</p>
                    <p className="text-lg text-muted-foreground mt-4">
                      Category: <span className="font-semibold text-foreground">{CATEGORIES[activeCategory]?.label}</span>
                    </p>
                  </div>
                )}
              </div>
              <Button onClick={nextTurn} className="w-full h-14 text-xl" variant="secondary" size="lg">
                <EyeOff className="mr-2 w-6 h-6" />
                Hide & Next
              </Button>
            </div>
          )}

          {gameState === "end" && (
            <div className="text-center space-y-8 py-6">
              <div className="space-y-4">
                <h2 className="text-3xl font-bold text-primary">Game Started!</h2>
                <p className="text-lg text-muted-foreground">
                  Everyone has seen their role. Start discussing and find out who the imposter is!
                </p>
                {startingPlayer && (
                  <div className="mt-6 rounded-lg border border-primary/20 bg-primary/10 p-4">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Shuffle className="w-5 h-5 text-primary" />
                      <p className="text-sm font-semibold uppercase tracking-wider text-primary">Random Starter</p>
                    </div>
                    <p className="text-2xl font-bold text-foreground">Player {startingPlayer}</p>
                    <p className="text-sm text-muted-foreground mt-1">goes first this round!</p>
                  </div>
                )}
              </div>
              <Button onClick={() => setGameState("setup")} className="w-full h-14 text-xl mt-8" size="lg">
                <RotateCcw className="mr-2 w-6 h-6" />
                New Game
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default App;
