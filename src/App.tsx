import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, Users, Play, RotateCcw, Shuffle } from "lucide-react";

type CategoryFile = {
  name: string;
  easy: string[];
  hard: string[];
};

type Category = {
  label: string;
  easy: string[];
  hard: string[];
};

const categoryFiles = import.meta.glob<{ default: CategoryFile }>("./data/*.json", { eager: true });

const CATEGORIES: Record<string, Category> = Object.fromEntries(
  Object.entries(categoryFiles).map(([path, module]) => {
    const fileName = path.split("/").pop() ?? path;
    const key = fileName.replace(".json", "");
    const { name, easy, hard } = module.default;
    return [key, { label: name, easy, hard }];
  }),
);

const CATEGORY_KEYS = Object.keys(CATEGORIES);
const DEFAULT_CATEGORY = CATEGORY_KEYS[0] ?? "random";
type Difficulty = "easy" | "hard" | "all";
const DIFFICULTY_DESCRIPTIONS: Record<Difficulty, string> = {
  easy: "More obvious words that most players recognize quickly.",
  hard: "More niche words that are less obvious and trickier to discuss.",
  all: "Mixes both easy and hard words.",
};

const getCategoryWords = (category: Category, difficulty: Difficulty): string[] => {
  if (difficulty === "easy") return category.easy;
  if (difficulty === "hard") return category.hard;
  return [...category.easy, ...category.hard];
};

type GameState = "setup" | "pass" | "reveal" | "end";

function App() {
  const [gameState, setGameState] = useState<GameState>("setup");
  const [playersCount, setPlayersCount] = useState<number>(4);
  const [impostersCount, setImpostersCount] = useState<number>(1);
  const [selectedCategory, setSelectedCategory] = useState<string | "random">(DEFAULT_CATEGORY);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>("all");
  const [randomizeStarter, setRandomizeStarter] = useState<boolean>(true);
  
  const [randomPool, setRandomPool] = useState<Record<string, boolean>>(
    Object.fromEntries(CATEGORY_KEYS.map((key) => [key, true])),
  );

  const [imposterIndices, setImposterIndices] = useState<number[]>([]);
  const [targetWord, setTargetWord] = useState<string>("");
  const [activeCategory, setActiveCategory] = useState<string>(DEFAULT_CATEGORY === "random" ? "" : DEFAULT_CATEGORY);
  const [currentPlayer, setCurrentPlayer] = useState<number>(1);
  const [startingPlayer, setStartingPlayer] = useState<number | null>(null);

  const startGame = () => {
    if (playersCount < 3) return; // Need at least 3 players
    
    let chosenCategory: string;
    if (selectedCategory === "random") {
      const available = CATEGORY_KEYS.filter(
        (key) => randomPool[key] && getCategoryWords(CATEGORIES[key], selectedDifficulty).length > 0,
      );
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

    const categoryData = getCategoryWords(CATEGORIES[chosenCategory], selectedDifficulty);
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
    (selectedCategory === "random" &&
      !CATEGORY_KEYS.some((key) => randomPool[key] && getCategoryWords(CATEGORIES[key], selectedDifficulty).length > 0)) ||
    (selectedCategory !== "random" &&
      (!CATEGORIES[selectedCategory] || getCategoryWords(CATEGORIES[selectedCategory], selectedDifficulty).length === 0)) ||
    impostersCount >= playersCount;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md mx-auto shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold tracking-tight">Imposter</CardTitle>
          <CardDescription>Find the imposter among you.</CardDescription>
        </CardHeader>
        <CardContent>
          {gameState === "setup" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="players">Players (Min: 3)</Label>
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-muted-foreground" />
                    <Input
                      id="players"
                      type="number"
                      min={3}
                      max={20}
                      value={playersCount}
                      onChange={(e) => {
                        const val = Math.max(3, parseInt(e.target.value) || 3);
                        setPlayersCount(val);
                        if (impostersCount >= val) setImpostersCount(val - 1);
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="imposters">Imposters</Label>
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-red-500" />
                    <Input
                      id="imposters"
                      type="number"
                      min={1}
                      max={playersCount - 1}
                      value={impostersCount}
                      onChange={(e) => setImpostersCount(Math.max(1, Math.min(playersCount - 1, parseInt(e.target.value) || 1)))}
                    />
                  </div>
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

                <div className="space-y-2">
                  <Label htmlFor="difficulty">Word Difficulty</Label>
                  <Select
                    value={selectedDifficulty}
                    onValueChange={(value) => setSelectedDifficulty(value as Difficulty)}
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
                  <div className="bg-slate-100 dark:bg-slate-900 rounded-lg p-4 space-y-3 border">
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
              <div className="p-8 rounded-xl bg-slate-100 dark:bg-slate-800">
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
                  <div className="mt-6 p-4 bg-primary/10 rounded-lg border border-primary/20">
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
