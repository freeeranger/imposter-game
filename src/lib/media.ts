import { useSyncExternalStore } from "react";

// Matches Tailwind's `lg` breakpoint: from here the web app uses its desktop layout.
const DESKTOP_QUERY = "(min-width: 1024px)";

const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

// Wide screens: two-column setup, centered dialogs and side panels instead of phone sheets.
export const useIsDesktop = () =>
  useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
