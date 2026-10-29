import { motion } from "motion/react";
import {
  ChevronRight,
  ExternalLink,
  Moon,
  RotateCcw,
  Sun,
  SunMoon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Page } from "@/components/ui/page";
import { SettingRow } from "@/components/ui/setting-row";
import { Switch } from "@/components/ui/switch";
import { SPRING, RISE, STAGGER } from "@/lib/motion";
import {
  externalLinkTarget,
  haptic,
  isInstalledWebApp,
  isNativeApp,
} from "@/lib/native";
import { cn } from "@/lib/utils";
import { THEME_OPTIONS } from "@/app/use-theme";
import type { ThemePreference } from "@/app/use-theme";
import type { GameSetup } from "@/features/setup/use-game-setup";
import { VersionSection } from "@/features/updates/version-section";
import type { AppUpdate } from "@/features/updates/use-app-update";

const AUTHOR_NAME = "Lukas Viering";
const AUTHOR_URL = "https://freeranger.dev";
const WEBSITE_URL = "https://tjeneritz.se";
const githubRepoUrl = "https://github.com/freeeranger/imposter-game";

function SettingsPage({
  open,
  predictive,
  onClose,
  themePreference,
  setThemePreference,
  setup,
  update,
  hapticsOn,
  setHapticsOn,
  launchAnimationOn,
  setLaunchAnimationOn,
  onOpenInstallHelp,
  onOpenLicense,
}: {
  open: boolean;
  predictive: boolean;
  onClose: () => void;
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
  setup: GameSetup;
  update: AppUpdate;
  hapticsOn: boolean;
  setHapticsOn: (on: boolean) => void;
  launchAnimationOn: boolean;
  setLaunchAnimationOn: (on: boolean) => void;
  onOpenInstallHelp: () => void;
  onOpenLicense: () => void;
}) {
  const { interfacePrefs, setInterfacePref, resetSettings } = setup;
  // Settings
  return (
    <Page
      open={open}
      predictive={predictive}
      onClose={onClose}
      title="settings"
    >
      <motion.div
        variants={STAGGER}
        initial="initial"
        animate="animate"
        className="flex flex-col gap-7"
      >
        <motion.section variants={RISE} className="flex flex-col gap-2.5">
          <span
            id="theme-label"
            className="px-1 text-[13px] font-semibold text-muted-foreground"
          >
            Theme
          </span>
          <div
            role="radiogroup"
            aria-labelledby="theme-label"
            className="grid grid-cols-3 rounded-full bg-card p-1"
          >
            {THEME_OPTIONS.map(({ value: option, label }) => {
              const isSelected = themePreference === option;
              const ThemeIcon =
                option === "system" ? SunMoon : option === "dark" ? Moon : Sun;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => {
                    haptic.tap();
                    setThemePreference(option);
                  }}
                  className={cn(
                    "relative flex h-[42px] cursor-pointer items-center justify-center gap-2 rounded-full text-[15px] transition-colors duration-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60",
                    isSelected
                      ? "font-bold text-primary-foreground"
                      : "font-semibold text-foreground",
                  )}
                >
                  {isSelected && (
                    <motion.span
                      layoutId="theme-pill"
                      transition={SPRING}
                      className="absolute inset-0 rounded-full bg-primary"
                    />
                  )}
                  <ThemeIcon className="relative size-4" />
                  <span className="relative">{label}</span>
                </button>
              );
            })}
          </div>
        </motion.section>

        <motion.section variants={RISE} className="flex flex-col gap-2.5">
          <span className="px-1 text-[13px] font-semibold text-muted-foreground">
            Interface
          </span>
          <div className="flex flex-col divide-y divide-border/70 rounded-[24px] bg-card pr-3 pl-[18px]">
            <SettingRow id="hide-info" title="Hide info button">
              <Switch
                id="hide-info"
                checked={interfacePrefs.hideInfo}
                onCheckedChange={(value) => setInterfacePref("hideInfo", value)}
              />
            </SettingRow>
            <SettingRow id="hide-builtin" title="Hide built-in categories">
              <Switch
                id="hide-builtin"
                checked={interfacePrefs.hideBuiltinCategories}
                disabled={interfacePrefs.hideCustomCategories}
                onCheckedChange={(value) =>
                  setInterfacePref("hideBuiltinCategories", value)
                }
              />
            </SettingRow>
            <SettingRow id="hide-custom" title="Hide your categories">
              <Switch
                id="hide-custom"
                checked={interfacePrefs.hideCustomCategories}
                disabled={interfacePrefs.hideBuiltinCategories}
                onCheckedChange={(value) =>
                  setInterfacePref("hideCustomCategories", value)
                }
              />
            </SettingRow>
          </div>
        </motion.section>

        {isNativeApp && (
          <motion.section
            variants={RISE}
            className="flex flex-col divide-y divide-border/70 rounded-[24px] bg-card pr-3 pl-[18px]"
          >
            <SettingRow id="haptics" title="Vibrations">
              <Switch
                id="haptics"
                checked={hapticsOn}
                onCheckedChange={setHapticsOn}
              />
            </SettingRow>
            <SettingRow id="launch-animation" title="Launch animation">
              <Switch
                id="launch-animation"
                checked={launchAnimationOn}
                onCheckedChange={setLaunchAnimationOn}
              />
            </SettingRow>
          </motion.section>
        )}

        <VersionSection update={update} onOpenInstallHelp={onOpenInstallHelp} />

        <motion.section variants={RISE} className="flex flex-col gap-2.5">
          <span className="px-1 text-[13px] font-semibold text-muted-foreground">
            About
          </span>
          <div className="flex flex-col divide-y divide-border/70 rounded-[24px] bg-card px-[18px]">
            {[
              { label: "Made by", value: AUTHOR_NAME, href: AUTHOR_URL },
              // In a browser tab you're already on the website.
              ...(isNativeApp || isInstalledWebApp
                ? [
                    {
                      label: "Website",
                      value: "tjeneritz.se",
                      href: WEBSITE_URL,
                    },
                  ]
                : []),
              {
                label: "Source code",
                value: "GitHub",
                href: githubRepoUrl,
              },
            ].map((link) => (
              <a
                key={link.label}
                href={link.href}
                target={externalLinkTarget}
                rel="noreferrer"
                className="flex min-h-[54px] items-center justify-between gap-3"
              >
                <span className="text-[15px] font-medium">{link.label}</span>
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  {link.value}
                  <ExternalLink className="size-3.5" />
                </span>
              </a>
            ))}
            <button
              type="button"
              onClick={() => {
                haptic.tap();
                onOpenLicense();
              }}
              className="flex min-h-[54px] cursor-pointer items-center justify-between gap-3 text-left"
            >
              <span className="text-[15px] font-medium">License</span>
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                GPL-3.0
                <ChevronRight className="size-4" />
              </span>
            </button>
          </div>
        </motion.section>

        <motion.div variants={RISE} className="flex justify-center pb-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-[13px]"
            onClick={() => {
              haptic.press();
              resetSettings();
            }}
          >
            <RotateCcw className="size-3.5" />
            Reset game settings
          </Button>
        </motion.div>
      </motion.div>
    </Page>
  );
}

export { SettingsPage };
