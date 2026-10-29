import { useEffect, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { VenetianMask } from "lucide-react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { CustomCategory } from "@/game/categories";
import { useIsDesktop } from "@/lib/media";
import { SOFT_SPRING } from "@/lib/motion";
import { haptic, setHapticsEnabled } from "@/lib/native";
import { PredictiveBackContext } from "@/lib/predictive-back";
import { useStoredToggle } from "@/lib/storage";
import { PrimaryButton, StartHint } from "@/app/primary-button";
import { TopBar } from "@/app/top-bar";
import { usePrimaryAction } from "@/app/use-primary-action";
import { useBackNavigation } from "@/app/use-back-navigation";
import { useTheme } from "@/app/use-theme";
import { CategoryActionsSheet } from "@/features/categories/category-actions-sheet";
import { CategoryEditor } from "@/features/categories/category-editor";
import { CategorySheet } from "@/features/categories/category-sheet";
import { ImportCategorySheet } from "@/features/categories/import-category-sheet";
import { NewCategorySheet } from "@/features/categories/new-category-sheet";
import type { NewCategoryMode } from "@/features/categories/new-category-sheet";
import { ShareCategorySheet } from "@/features/categories/share-category-sheet";
import { useCategoryEditor } from "@/features/categories/use-category-editor";
import { useIncomingCategory } from "@/features/categories/use-incoming-category";
import { useShareSheet } from "@/features/categories/use-share-sheet";
import { HowToPlaySheet } from "@/features/help/how-to-play-sheet";
import { SplashReveal } from "@/features/launch/splash-reveal";
import { useLaunch } from "@/features/launch/use-launch";
import { EndScreen } from "@/features/round/end-screen";
import { PassScreen } from "@/features/round/pass-screen";
import { RevealScreen } from "@/features/round/reveal-screen";
import { useRound } from "@/features/round/use-round";
import { InstallHelpSheet } from "@/features/settings/install-help-sheet";
import { LicensePage } from "@/features/settings/license-page";
import { SettingsPage } from "@/features/settings/settings-page";
import { NumberPickerSheet } from "@/features/setup/number-picker-sheet";
import type { NumberPickerKind } from "@/features/setup/number-picker-sheet";
import { SetupScreen } from "@/features/setup/setup-screen";
import { useGameSetup } from "@/features/setup/use-game-setup";
import {
  useAppUpdate,
  useWebUpdateWhenIdle,
} from "@/features/updates/use-app-update";

const HAPTICS_STORAGE_KEY = "imposter-game-haptics";

// Wires the app together: the state of each feature, the screen for the current step of the
// game, and the sheets and pages on top of it (which back closes, top-most first).
function App() {
  const { themePreference, setThemePreference } = useTheme();
  const launch = useLaunch();
  const isDesktop = useIsDesktop();
  const [hapticsOn, setHapticsOn] = useStoredToggle(HAPTICS_STORAGE_KEY);
  useEffect(() => {
    setHapticsEnabled(hapticsOn);
  }, [hapticsOn]);

  const setup = useGameSetup();
  const round = useRound(setup);
  const update = useAppUpdate({ isRoundOver: round.gameState === "setup" });
  const editor = useCategoryEditor(setup);
  const share = useShareSheet();
  const importing = useIncomingCategory(setup);
  // A web update can reload the page while nothing is lost.
  useWebUpdateWhenIdle(round.gameState === "setup" && !editor.isEditorOpen);

  // ----- Sheets and pages -----
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);
  const [showCategorySheet, setShowCategorySheet] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showLicense, setShowLicense] = useState<boolean>(false);
  const [showInstallHelp, setShowInstallHelp] = useState<boolean>(false);
  const [isNumberPickerOpen, setIsNumberPickerOpen] = useState<boolean>(false);
  // Kept after closing so the sheet still has content while it animates away.
  const [numberPickerKind, setNumberPickerKind] =
    useState<NumberPickerKind>("players");
  const [showAddSheet, setShowAddSheet] = useState<boolean>(false);
  const [addMode, setAddMode] = useState<NewCategoryMode>("menu");
  // The ⋯ sheet on one of your categories. Kept after closing so the sheet (and the delete
  // confirm) still know which category it was.
  const [showActionsSheet, setShowActionsSheet] = useState<boolean>(false);
  const [actionsCategory, setActionsCategory] = useState<CustomCategory | null>(
    null,
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);

  const openNumberPicker = (kind: NumberPickerKind) => {
    haptic.tap();
    setNumberPickerKind(kind);
    setIsNumberPickerOpen(true);
  };

  const openAddSheet = () => {
    haptic.tap();
    setAddMode("menu");
    setShowAddSheet(true);
  };

  const openCategoryActions = (category: CustomCategory) => {
    haptic.tap();
    setActionsCategory(category);
    setShowActionsSheet(true);
  };

  const deleteActionsCategory = () => {
    const id = actionsCategory?.id;
    if (!id) return;
    haptic.press();
    setup.deleteCustomCategory(id);
    setShowDeleteConfirm(false);
    setShowActionsSheet(false);
  };

  const { backTarget, predictiveBackValues, hasOpenLayer } = useBackNavigation({
    layers: [
      {
        id: "confirm",
        open: round.showEndConfirm,
        close: () => round.setShowEndConfirm(false),
      },
      {
        id: "deleteConfirm",
        open: showDeleteConfirm,
        close: () => setShowDeleteConfirm(false),
      },
      {
        id: "discardConfirm",
        open: editor.showDiscardConfirm,
        close: () => editor.setShowDiscardConfirm(false),
      },
      { id: "share", open: share.showShareSheet, close: share.closeShareSheet },
      {
        id: "import",
        open: importing.showImportSheet,
        close: importing.closeImportSheet,
      },
      {
        id: "add",
        open: showAddSheet,
        // From pasting or scanning, back goes to the menu first.
        close: () =>
          addMode === "menu" ? setShowAddSheet(false) : setAddMode("menu"),
      },
      {
        id: "actions",
        open: showActionsSheet,
        close: () => setShowActionsSheet(false),
      },
      {
        id: "picker",
        open: isNumberPickerOpen,
        close: () => setIsNumberPickerOpen(false),
      },
      {
        id: "editor",
        open: editor.isEditorOpen,
        close: editor.requestCloseEditor,
        previewable: !editor.isEditorDirty,
      },
      {
        id: "installHelp",
        open: showInstallHelp,
        close: () => setShowInstallHelp(false),
      },
      { id: "license", open: showLicense, close: () => setShowLicense(false) },
      {
        id: "settings",
        open: showSettings,
        close: () => setShowSettings(false),
      },
      {
        id: "category",
        open: showCategorySheet,
        close: () => setShowCategorySheet(false),
      },
      {
        id: "info",
        open: showInfoModal,
        close: () => setShowInfoModal(false),
      },
    ],
    canGoBackOutsideLayers: round.gameState !== "setup",
    goBackOutsideLayers: round.goBack,
  });

  const primary = usePrimaryAction({ setup, round, isDesktop, hasOpenLayer });
  const primaryButton = <PrimaryButton primary={primary} />;
  const startHint = <StartHint setup={setup} round={round} primary={primary} />;
  const { gameState } = round;

  return (
    <PredictiveBackContext.Provider value={predictiveBackValues}>
      <MotionConfig reducedMotion="user">
        {launch.showSplashReveal && (
          <SplashReveal
            play={launch.isSplashReady}
            onOpen={launch.onSplashOpen}
            onDone={launch.onSplashDone}
          />
        )}
        <div className="relative flex h-dvh w-full justify-center overflow-hidden bg-background text-foreground transition-colors select-none">
          <div className="flex h-full w-full max-w-md flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] lg:max-w-6xl lg:pt-8 lg:pr-12 lg:pb-10 lg:pl-12">
            <TopBar
              setup={setup}
              round={round}
              hasLaunched={launch.hasLaunched}
              isDesktop={isDesktop}
              onOpenInfo={() => setShowInfoModal(true)}
              onOpenSettings={() => setShowSettings(true)}
            />

            <main className="relative flex min-h-0 flex-1 flex-col [perspective:1200px]">
              <AnimatePresence mode="wait" custom={round.swipeDirection}>
                {launch.hasLaunched && gameState === "setup" && (
                  <SetupScreen
                    key="setup"
                    setup={setup}
                    update={update}
                    isDesktop={isDesktop}
                    primaryButton={primaryButton}
                    startHint={startHint}
                    onOpenCategories={() => setShowCategorySheet(true)}
                    onPickNumber={openNumberPicker}
                  />
                )}

                {gameState === "pass" && (
                  <PassScreen
                    key={round.panelKey}
                    currentPlayer={round.currentPlayer}
                    playersCount={setup.playersCount}
                    activeCategoryInfo={round.activeCategoryInfo}
                    isDesktop={isDesktop}
                  />
                )}

                {gameState === "reveal" && (
                  <RevealScreen
                    key={round.panelKey}
                    currentPlayer={round.currentPlayer}
                    playersCount={setup.playersCount}
                    currentAssignment={round.currentAssignment}
                    activeCategoryInfo={round.activeCategoryInfo}
                    fellowImposters={round.fellowImposters}
                    isDesktop={isDesktop}
                    onSwipe={round.passWithSwipe}
                  />
                )}

                {gameState === "end" && (
                  <EndScreen
                    key="end"
                    startingPlayer={round.startingPlayer}
                    isDesktop={isDesktop}
                  />
                )}
              </AnimatePresence>
            </main>

            <motion.footer
              initial={{ opacity: 0, y: 16 }}
              animate={
                launch.hasLaunched
                  ? {
                      opacity: 1,
                      y: 0,
                      transition: { ...SOFT_SPRING, delay: 0.12 },
                    }
                  : { opacity: 0, y: 16 }
              }
              className="shrink-0 pt-4 lg:mx-auto lg:w-full lg:max-w-[480px]"
            >
              {!(isDesktop && gameState === "setup") && (
                <>
                  {primaryButton}
                  {startHint}
                </>
              )}
            </motion.footer>
          </div>

          {/* Layers, in the order they stack. */}
          <CategorySheet
            setup={setup}
            open={showCategorySheet}
            predictive={backTarget === "category"}
            onClose={() => setShowCategorySheet(false)}
            onOpenActions={openCategoryActions}
            onAddCategory={openAddSheet}
          />

          <CategoryEditor
            editor={editor}
            predictive={backTarget === "editor"}
            discardPredictive={backTarget === "discardConfirm"}
            onShare={share.openShareSheet}
            onShareCode={(code) => void importing.receiveShareCode(code)}
          />

          <CategoryActionsSheet
            category={actionsCategory}
            open={showActionsSheet}
            predictive={backTarget === "actions"}
            onClose={() => setShowActionsSheet(false)}
            onShare={share.openShareSheet}
            onEdit={editor.openCategoryEditor}
            confirmingDelete={showDeleteConfirm}
            deletePredictive={backTarget === "deleteConfirm"}
            onRequestDelete={() => setShowDeleteConfirm(true)}
            onCancelDelete={() => setShowDeleteConfirm(false)}
            onDelete={deleteActionsCategory}
          />

          <NewCategorySheet
            open={showAddSheet}
            predictive={backTarget === "add"}
            onClose={() => setShowAddSheet(false)}
            mode={addMode}
            onModeChange={setAddMode}
            onMakeOwn={() => editor.openCategoryEditor()}
            onShareCode={(code) => void importing.receiveShareCode(code)}
          />

          <ShareCategorySheet
            share={share}
            predictive={backTarget === "share"}
          />

          <ImportCategorySheet
            importing={importing}
            predictive={backTarget === "import"}
          />

          <HowToPlaySheet
            open={showInfoModal}
            predictive={backTarget === "info"}
            onClose={() => setShowInfoModal(false)}
          />

          <NumberPickerSheet
            kind={numberPickerKind}
            setup={setup}
            open={isNumberPickerOpen}
            predictive={backTarget === "picker"}
            onClose={() => setIsNumberPickerOpen(false)}
          />

          <SettingsPage
            open={showSettings}
            predictive={backTarget === "settings"}
            onClose={() => setShowSettings(false)}
            themePreference={themePreference}
            setThemePreference={setThemePreference}
            setup={setup}
            update={update}
            hapticsOn={hapticsOn}
            setHapticsOn={setHapticsOn}
            launchAnimationOn={launch.launchAnimationOn}
            setLaunchAnimationOn={launch.setLaunchAnimationOn}
            onOpenInstallHelp={() => setShowInstallHelp(true)}
            onOpenLicense={() => setShowLicense(true)}
          />

          <ConfirmDialog
            open={round.showEndConfirm}
            predictive={backTarget === "confirm"}
            icon={<VenetianMask className="size-7" aria-hidden />}
            title="end this round?"
            confirmLabel="end round"
            cancelLabel="keep playing"
            onConfirm={round.confirmEndGame}
            onCancel={() => round.setShowEndConfirm(false)}
          />

          <InstallHelpSheet
            open={showInstallHelp}
            predictive={backTarget === "installHelp"}
            onClose={() => setShowInstallHelp(false)}
          />

          <LicensePage
            open={showLicense}
            predictive={backTarget === "license"}
            onClose={() => setShowLicense(false)}
          />
        </div>
      </MotionConfig>
    </PredictiveBackContext.Provider>
  );
}

export default App;
