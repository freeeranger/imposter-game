import {
  pickRandom,
  randomPlayerNumber,
  rollChance,
  shuffle,
} from "@/game/random";

export type PrankMode =
  | "everyone-imposter"
  | "one-crewmate"
  | "different-words"
  | "no-imposter"
  | "two-imposters";
export type PlayerAssignment = {
  isImposter: boolean;
  word: string | null;
};

type DealOptions = {
  playersCount: number;
  impostersCount: number;
  prankProbability: number;
  revealFellowImposters: boolean;
  // The words this round's category can play (no repeats).
  categoryWords: string[];
};

// Hands out roles and words. Now and then (prankProbability percent of rounds) it's a prank
// round instead: everyone or nobody is the imposter, everyone gets a different word, and so on.
export const dealRound = ({
  playersCount,
  impostersCount,
  prankProbability,
  revealFellowImposters,
  categoryWords,
}: DealOptions) => {
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

  return { assignments, prankActive: shouldUsePrank };
};
