import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ArrowUp, Plus, Share2, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Page } from "@/components/ui/page";
import { RollingNumber } from "@/components/ui/rolling-number";
import { SettingRow } from "@/components/ui/setting-row";
import { Switch } from "@/components/ui/switch";
import {
  MAX_CUSTOM_NAME_LENGTH,
  MIN_CUSTOM_WORDS,
  splitWords,
} from "@/game/categories";
import { SPRING } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { findShareCode } from "@/lib/share";
import { cn } from "@/lib/utils";
import type { CategoryEditor as CategoryEditorState } from "@/features/categories/use-category-editor";
import type { ShareableCategory } from "@/features/categories/use-share-sheet";

// Making or editing one of your categories: a numbered list of words, typed into an input
// docked at the bottom so it sits right above the keyboard. Asks before throwing changes away.
function CategoryEditor({
  editor,
  predictive,
  discardPredictive,
  onShare,
  onShareCode,
}: {
  editor: CategoryEditorState;
  predictive: boolean;
  discardPredictive: boolean;
  onShare: (category: ShareableCategory) => void;
  // A share link pasted into the word box: add that category instead.
  onShareCode: (code: string) => void;
}) {
  const {
    isEditorOpen,
    editorDraft,
    draftName,
    draftHard,
    missingWords,
    missingHardWords,
    canSaveDraft,
    addLevel,
    setAddLevel,
    wordDraft,
    setWordDraft,
    setIsWordInputFocused,
    isTypingWords,
    editorListEnd,
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
  } = editor;
  return (
    <>
      {/* Custom category editor: a numbered list of words, typed into an input docked
              at the bottom so it sits right above the keyboard. */}
      <Page
        open={isEditorOpen}
        predictive={predictive}
        onClose={requestCloseEditor}
        title={editorDraft.id ? "edit category" : "new category"}
        stacked
        action={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Share category"
            // Needs a name and enough words, the same as saving.
            disabled={!canSaveDraft}
            // Shares the category as it stands in the editor, saved or not.
            onClick={() =>
              onShare({
                name: draftName,
                words: editorDraft.words,
                hard: draftHard,
              })
            }
          >
            <Share2 className="size-5 stroke-[2.2]" />
          </Button>
        }
        footer={
          <div className="flex flex-col gap-3">
            {editorDraft.levels && (
              <div
                role="radiogroup"
                aria-label="Add words to"
                className="flex rounded-full bg-card p-1"
              >
                {(["easy", "hard"] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    role="radio"
                    aria-checked={addLevel === level}
                    // Keep focus (and the keyboard) in the input while switching.
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() => {
                      haptic.tap();
                      setAddLevel(level);
                    }}
                    className={cn(
                      "h-9 flex-1 cursor-pointer rounded-full text-sm font-bold transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60",
                      addLevel === level
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {level}
                  </button>
                ))}
              </div>
            )}
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                addDraftWords([wordDraft.trim()].filter(Boolean));
                setWordDraft("");
              }}
            >
              <Input
                id="custom-category-word"
                aria-label="Add a word"
                value={wordDraft}
                autoComplete="off"
                enterKeyHint="enter"
                placeholder={
                  editorDraft.levels
                    ? `add ${addLevel} words`
                    : "add a word, or paste a list"
                }
                onChange={(event) => setWordDraft(event.target.value)}
                onFocus={() => setIsWordInputFocused(true)}
                onBlur={() => setIsWordInputFocused(false)}
                onPaste={(event) => {
                  const text = event.clipboardData.getData("text");
                  const shareCode = findShareCode(text);
                  if (shareCode) {
                    event.preventDefault();
                    onShareCode(shareCode);
                    return;
                  }
                  const pasted = splitWords(text);
                  if (pasted.length > 1) {
                    event.preventDefault();
                    addDraftWords(pasted);
                  }
                }}
                className="h-12 flex-1 bg-card text-base"
              />
              <Button
                type="submit"
                size="icon"
                className="size-12 shrink-0"
                aria-label="Add word"
                disabled={!wordDraft.trim()}
                // Keep focus (and the keyboard) in the input while adding words.
                onPointerDown={(event) => event.preventDefault()}
              >
                <Plus className="size-5 stroke-[2.6]" />
              </Button>
            </form>
            {/* While typing words the keyboard is up; save waits until it goes down. */}
            {!isTypingWords && (
              <Button
                size="lg"
                className="h-14 w-full text-[17px]"
                disabled={!canSaveDraft}
                onClick={saveCategoryDraft}
              >
                {draftName.length === 0
                  ? "give it a name"
                  : missingWords > 0
                    ? `add ${missingWords} more ${editorDraft.levels ? "easy " : ""}word${missingWords === 1 ? "" : "s"}`
                    : missingHardWords > 0
                      ? `add ${missingHardWords} more hard word${missingHardWords === 1 ? "" : "s"}`
                      : editorDraft.id
                        ? "save changes"
                        : "save category"}
              </Button>
            )}
          </div>
        }
      >
        <div className="flex flex-col gap-6 pb-2">
          <section className="flex flex-col gap-1">
            <label
              htmlFor="custom-category-name"
              className="px-1 text-[13px] font-semibold text-muted-foreground"
            >
              Name
            </label>
            <input
              id="custom-category-name"
              value={editorDraft.name}
              maxLength={MAX_CUSTOM_NAME_LENGTH}
              autoComplete="off"
              enterKeyHint="done"
              placeholder="give it a name"
              onChange={(event) => setDraftName(event.target.value)}
              className="w-full border-b-2 border-border bg-transparent px-1 pt-1 pb-2 font-display text-[26px] leading-tight font-extrabold tracking-[-0.03em] transition-colors outline-none placeholder:text-muted-foreground/50 focus:border-primary"
            />
          </section>

          <div className="rounded-[24px] bg-card px-[18px]">
            <SettingRow id="custom-category-levels" title="Easy and hard words">
              <Switch
                id="custom-category-levels"
                checked={editorDraft.levels}
                onCheckedChange={setDraftLevels}
              />
            </SettingRow>
          </div>

          {(editorDraft.levels
            ? (["words", "hard"] as const)
            : (["words"] as const)
          ).map((field) => {
            const list = editorDraft[field];
            const level = field === "hard" ? "hard" : "easy";
            return (
              <section key={field} className="flex flex-col gap-2.5">
                <div className="flex items-baseline justify-between px-1">
                  <span className="text-[13px] font-semibold text-muted-foreground">
                    {editorDraft.levels
                      ? field === "hard"
                        ? "Hard"
                        : "Easy"
                      : "Words"}
                  </span>
                  <span className="text-[13px] text-muted-foreground tabular-nums">
                    <RollingNumber value={list.length} />
                  </span>
                </div>
                {list.length === 0 ? (
                  <p className="rounded-[24px] bg-card px-[18px] py-4 text-[15px] text-muted-foreground">
                    {editorDraft.levels
                      ? `No ${level} words yet.`
                      : `No words yet. Type them below, one at a time, or paste a whole list. You need at least ${MIN_CUSTOM_WORDS}.`}
                  </p>
                ) : (
                  <ol className="flex flex-col rounded-[24px] bg-card pr-1.5 pl-[18px]">
                    <AnimatePresence initial={false}>
                      {list.map((word, index) => (
                        <motion.li
                          key={word}
                          layout="position"
                          // Enters at full height so the list can scroll to it right away.
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={SPRING}
                          className="overflow-hidden border-b border-border/70 last:border-b-0"
                        >
                          <div className="flex min-h-[52px] items-center gap-3 py-1">
                            <span className="w-5 shrink-0 text-[13px] text-muted-foreground tabular-nums">
                              {index + 1}
                            </span>
                            <span className="min-w-0 flex-1 text-base leading-snug [overflow-wrap:anywhere]">
                              {word}
                            </span>
                            {editorDraft.levels && (
                              <button
                                type="button"
                                aria-label={`Move ${word} to ${field === "hard" ? "easy" : "hard"}`}
                                onClick={() => moveDraftWord(field, word)}
                                className="-mr-3 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                              >
                                {field === "hard" ? (
                                  <ArrowUp className="size-4" />
                                ) : (
                                  <ArrowDown className="size-4" />
                                )}
                              </button>
                            )}
                            <button
                              type="button"
                              aria-label={`Remove ${word}`}
                              onClick={() => removeDraftWord(field, word)}
                              className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                            >
                              <X className="size-4" />
                            </button>
                          </div>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ol>
                )}
                {/* New words scroll into view in the list they're added to. */}
                {(field === "hard") ===
                  (editorDraft.levels && addLevel === "hard") && (
                  <div ref={editorListEnd} />
                )}
              </section>
            );
          })}
        </div>
      </Page>

      <ConfirmDialog
        open={showDiscardConfirm}
        predictive={discardPredictive}
        icon={<Trash2 className="size-7" aria-hidden />}
        title="discard your changes?"
        confirmLabel="discard"
        cancelLabel="keep editing"
        onConfirm={discardCategoryDraft}
        onCancel={() => setShowDiscardConfirm(false)}
      />
    </>
  );
}

export { CategoryEditor };
