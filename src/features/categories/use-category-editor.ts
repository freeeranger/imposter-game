import { useEffect, useRef, useState } from "react";

import { MIN_CUSTOM_WORDS } from "@/game/categories";
import type { CustomCategory } from "@/game/categories";
import { useKeyboard } from "@/lib/keyboard";
import { haptic } from "@/lib/native";
import type { GameSetup } from "@/features/setup/use-game-setup";

type EditorDraft = {
  id: string | null;
  name: string;
  words: string[];
  hard: string[];
  // Easy and hard words in separate lists; "words" holds the easy ones then.
  levels: boolean;
};

export type WordList = "words" | "hard";

// Making or editing one of your categories. The draft stays filled while the page animates
// away, and nothing is saved until you press save.
export function useCategoryEditor(setup: GameSetup) {
  const { customCategories, addCustomCategory, updateCustomCategory } = setup;
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [editorDraft, setEditorDraft] = useState<EditorDraft>({
    id: null,
    name: "",
    words: [],
    hard: [],
    levels: false,
  });
  // Which list typed words go into while levels are on.
  const [addLevel, setAddLevel] = useState<"easy" | "hard">("easy");
  const [wordDraft, setWordDraft] = useState<string>("");
  const [isWordInputFocused, setIsWordInputFocused] = useState<boolean>(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState<boolean>(false);
  const keyboard = useKeyboard();
  const editorListEnd = useRef<HTMLDivElement>(null);
  const scrollToNewWord = useRef(false);

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

  const setDraftName = (name: string) =>
    setEditorDraft((draft) => ({ ...draft, name }));

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

  const removeDraftWord = (field: WordList, word: string) => {
    haptic.tap();
    setEditorDraft((draft) => ({
      ...draft,
      [field]: draft[field].filter((item) => item !== word),
    }));
  };

  const moveDraftWord = (from: WordList, word: string) => {
    haptic.tap();
    const to = from === "words" ? "hard" : "words";
    setEditorDraft((draft) => ({
      ...draft,
      [from]: draft[from].filter((item) => item !== word),
      [to]: [...draft[to], word],
    }));
  };

  const saveCategoryDraft = () => {
    if (!canSaveDraft) return;
    haptic.success();
    const id = editorDraft.id;
    if (id) {
      updateCustomCategory({
        id,
        name: draftName,
        words: editorDraft.words,
        hard: draftHard,
      });
    } else {
      addCustomCategory(draftName, editorDraft.words, draftHard);
    }
    setIsEditorOpen(false);
  };

  return {
    isEditorOpen,
    editorDraft,
    draftName,
    draftHard,
    missingWords,
    missingHardWords,
    canSaveDraft,
    isEditorDirty,
    addLevel,
    setAddLevel,
    wordDraft,
    setWordDraft,
    setIsWordInputFocused,
    isTypingWords,
    editorListEnd,
    openCategoryEditor,
    requestCloseEditor,
    discardCategoryDraft,
    showDiscardConfirm,
    setShowDiscardConfirm,
    setDraftName,
    addDraftWords,
    setDraftLevels,
    removeDraftWord,
    moveDraftWord,
    saveCategoryDraft,
  };
}

export type CategoryEditor = ReturnType<typeof useCategoryEditor>;
