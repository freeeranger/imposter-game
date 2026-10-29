import { useEffect, useEffectEvent } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Eye, EyeOff, RotateCcw } from "lucide-react";

import type { Round } from "@/features/round/use-round";
import type { GameSetup } from "@/features/setup/use-game-setup";

// The big button at the bottom moves the game along: play, show me, pass, play again.
export function usePrimaryAction({
  setup,
  round,
  isDesktop,
  hasOpenLayer,
}: {
  setup: GameSetup;
  round: Round;
  isDesktop: boolean;
  // A sheet or dialog is open, so keys belong to it.
  hasOpenLayer: boolean;
}) {
  const { isStartDisabled, playersCount } = setup;
  const {
    gameState,
    currentPlayer,
    startGame,
    revealRole,
    passWithButton,
    resetToSetup,
  } = round;

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

  return {
    primaryLabel,
    PrimaryIcon: primaryIcon,
    primaryIconAtEnd,
    primaryDisabled,
    primaryAction,
    primaryKey,
  };
}

export type PrimaryAction = ReturnType<typeof usePrimaryAction>;
