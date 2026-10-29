import { useEffect, useState } from "react";

import { DEFAULT_CATEGORY, getUniqueCategoryWords } from "@/game/categories";
import { pickRandom, randomPlayerNumber } from "@/game/random";
import { dealRound } from "@/game/round";
import type { PlayerAssignment } from "@/game/round";
import { haptic, setKeepAwake } from "@/lib/native";
import type { GameSetup } from "@/features/setup/use-game-setup";

export type GameState = "setup" | "pass" | "reveal" | "end";

// A round: the phone goes around ("pass"), each player peeks at their card ("reveal"),
// and once everyone has seen theirs it's time to talk ("end").
export function useRound(setup: GameSetup) {
  const {
    allCategories,
    allCategoryKeys,
    isInPool,
    playersCount,
    impostersCount,
    selectedCategory,
    selectedDifficulty,
    randomizeStarter,
    prankProbability,
    revealFellowImposters,
  } = setup;
  const [gameState, setGameState] = useState<GameState>("setup");
  const [prankActive, setPrankActive] = useState<boolean>(false);
  const [playerAssignments, setPlayerAssignments] = useState<
    PlayerAssignment[]
  >([]);
  const [activeCategory, setActiveCategory] = useState<string>(
    DEFAULT_CATEGORY === "random" ? "" : DEFAULT_CATEGORY,
  );
  const [currentPlayer, setCurrentPlayer] = useState<number>(1);
  const [startingPlayer, setStartingPlayer] = useState<number | null>(null);
  // Which way the last card was flicked, so it flies off that side.
  const [swipeDirection, setSwipeDirection] = useState<1 | -1>(-1);
  const [showEndConfirm, setShowEndConfirm] = useState<boolean>(false);

  // Keep the screen on while the phone is passed around.
  useEffect(() => {
    setKeepAwake(gameState !== "setup");
  }, [gameState]);

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

    const { assignments, prankActive: isPrank } = dealRound({
      playersCount,
      impostersCount,
      prankProbability,
      revealFellowImposters,
      categoryWords,
    });

    setPlayerAssignments(assignments);
    setActiveCategory(chosenCategory);
    setCurrentPlayer(1);
    setPrankActive(isPrank);

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

  const passWithButton = () => {
    setSwipeDirection(-1);
    nextTurn();
  };

  const passWithSwipe = (direction: 1 | -1) => {
    setSwipeDirection(direction);
    nextTurn();
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

  // Back with nothing open: mid-round it asks to end the round, after it goes home.
  const goBack = () => {
    if (gameState === "pass" || gameState === "reveal") {
      haptic.tap();
      setShowEndConfirm(true);
    } else if (gameState === "end") {
      setGameState("setup");
    }
  };

  const isInRound = gameState === "pass" || gameState === "reveal";
  const panelKey = isInRound ? `${gameState}-${currentPlayer}` : gameState;
  const currentAssignment = playerAssignments[currentPlayer - 1];
  const activeCategoryInfo = allCategories[activeCategory];

  // With "imposters know each other" on, an imposter's card names the others.
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

  return {
    gameState,
    isInRound,
    panelKey,
    currentPlayer,
    currentAssignment,
    activeCategoryInfo,
    startingPlayer,
    swipeDirection,
    fellowImposters,
    startGame,
    revealRole,
    passWithButton,
    passWithSwipe,
    resetToSetup,
    endGame,
    confirmEndGame,
    showEndConfirm,
    setShowEndConfirm,
    goBack,
  };
}

export type Round = ReturnType<typeof useRound>;
