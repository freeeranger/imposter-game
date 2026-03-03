import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import countries from "./data/countries.json";
import celebrities from "./data/celebrities.json";
import artists from "./data/artists.json";
import movies from "./data/movies.json";
import carBrands from "./data/car_brands.json";
import { Eye, EyeOff, Users, Play, RotateCcw, Shuffle } from "lucide-react";

type CategoryKey = "countries" | "celebrities" | "artists" | "movies" | "car_brands";

const CATEGORIES: Record<CategoryKey, { label: string; data: string[] }> = {
  countries: { label: "Countries", data: countries },
  celebrities: { label: "Celebrities", data: celebrities },
  artists: { label: "Artists", data: artists },
  movies: { label: "Movies", data: movies },
  car_brands: { label: "Car Brands", data: carBrands },
};

type GameState = "setup" | "pass" | "reveal" | "end";

function App() {
  const [gameState, setGameState] = useState<GameState>("setup");
  const [playersCount, setPlayersCount] = useState<number>(4);
  const [impostersCount, setImpostersCount] = useState<number>(1);
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | "random">("countries");
  const [randomizeStarter, setRandomizeStarter] = useState<boolean>(true);
  
  const [randomPool, setRandomPool] = useState<Record<CategoryKey, boolean>>({
    countries: true,
    celebrities: true,
    artists: true,
    movies: true,
    car_brands: true,
  });

  const [imposterIndices, setImposterIndices] = useState<number[]>([]);
  const [targetWord, setTargetWord] = useState<string>("");
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("countries");
  const [currentPlayer, setCurrentPlayer] = useState<number>(1);
  const [startingPlayer, setStartingPlayer] = useState<number | null>(null);

  const startGame = () => {
    if (playersCount < 3) return; // Need at least 3 players
    
    let chosenCategory: CategoryKey;
    if (selectedCategory === "random") {
      const available = (Object.keys(CATEGORIES) as CategoryKey[]).filter(key => randomPool[key]);
      if (available.length === 0) return; // Must have at least one category selected
      chosenCategory = available[Math.floor(Math.random() * available.length)];
    } else {
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

  const isStartDisabled = (selectedCategory === "random" && !(Object.values(randomPool).some(Boolean))) || impostersCount >= playersCount;

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
                    onValueChange={(value) => setSelectedCategory(value as CategoryKey | "random")}
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
                  <div className="bg-slate-100 dark:bg-slate-900 rounded-lg p-4 space-y-3 border">
                    <Label className="text-sm text-muted-foreground block mb-2">Include Categories:</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {(Object.keys(CATEGORIES) as CategoryKey[]).map((key) => (
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
                      Category: <span className="font-semibold text-foreground">{CATEGORIES[activeCategory].label}</span>
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
                      Category: <span className="font-semibold text-foreground">{CATEGORIES[activeCategory].label}</span>
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