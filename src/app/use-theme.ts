import { useEffect, useState } from "react";

import { setSystemBarsTheme } from "@/lib/native";
import { readStorage, writeStorage } from "@/lib/storage";

export type Theme = "light" | "dark";
export type ThemePreference = Theme | "system";
export const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "system" },
  { value: "dark", label: "dark" },
  { value: "light", label: "light" },
];

const THEME_STORAGE_KEY = "imposter-game-theme";
const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";

// Light, dark, or following the phone; applied to the page, the browser bar and Android's
// system bars.
export function useTheme() {
  const [themePreference, setThemePreference] = useState<ThemePreference>(
    () => {
      if (typeof window === "undefined") return "dark";

      const savedTheme = readStorage(THEME_STORAGE_KEY);
      if (
        savedTheme === "light" ||
        savedTheme === "dark" ||
        savedTheme === "system"
      ) {
        return savedTheme;
      }

      return "dark";
    },
  );
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(
    () => window.matchMedia(SYSTEM_DARK_QUERY).matches,
  );
  const theme: Theme =
    themePreference === "system"
      ? systemPrefersDark
        ? "dark"
        : "light"
      : themePreference;

  // Follow the phone's light/dark switch live while "system" is chosen.
  useEffect(() => {
    const query = window.matchMedia(SYSTEM_DARK_QUERY);
    const handleChange = (event: MediaQueryListEvent) =>
      setSystemPrefersDark(event.matches);
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#15111f" : "#f2f0f6");
    setSystemBarsTheme(theme);
  }, [theme]);

  useEffect(() => {
    writeStorage(THEME_STORAGE_KEY, themePreference);
  }, [themePreference]);

  return { theme, themePreference, setThemePreference };
}
