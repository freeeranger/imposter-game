import { useEffect, useEffectEvent, useState } from "react";

import {
  MAX_CUSTOM_NAME_LENGTH,
  MIN_CUSTOM_WORDS,
  wordSetKey,
} from "@/game/categories";
import { haptic, onAppLinkOpened } from "@/lib/native";
import {
  decodeCategory,
  findShareCode,
  takeShareCodeFromLocation,
} from "@/lib/share";
import type { GameSetup } from "@/features/setup/use-game-setup";

// A category arriving from a share link, already numbered if you have one with its name.
export type IncomingCategory =
  | { status: "ok"; name: string; words: string[]; hard: string[] }
  | { status: "duplicate"; name: string }
  | { status: "newer" | "invalid" };

// Categories shared with you: from a link (opened in the browser or the app), a pasted link
// or a scanned QR code. Nothing is saved until you choose to add it.
export function useIncomingCategory(setup: GameSetup) {
  const { customCategories, addCustomCategory, showCustomCategories } = setup;
  const [showImportSheet, setShowImportSheet] = useState<boolean>(false);
  const [incoming, setIncoming] = useState<IncomingCategory>({
    status: "invalid",
  });

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

  const addIncomingCategory = () => {
    if (incoming.status !== "ok") return;
    haptic.success();
    addCustomCategory(incoming.name, incoming.words, incoming.hard);
    showCustomCategories();
    setShowImportSheet(false);
  };

  return {
    incoming,
    showImportSheet,
    closeImportSheet: () => setShowImportSheet(false),
    receiveShareCode,
    addIncomingCategory,
  };
}

export type IncomingCategoryState = ReturnType<typeof useIncomingCategory>;
