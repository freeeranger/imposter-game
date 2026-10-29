import { useEffect, useState } from "react";

// localStorage can throw (private mode, storage disabled); the app then just doesn't remember.

export const readStorage = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const writeStorage = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore storage write errors (e.g. private mode)
  }
};

// An on/off preference that's on unless it was turned off, saved as "on" / "off".
export const useStoredToggle = (key: string) => {
  const [isOn, setIsOn] = useState<boolean>(() => readStorage(key) !== "off");
  useEffect(() => {
    writeStorage(key, isOn ? "on" : "off");
  }, [key, isOn]);
  return [isOn, setIsOn] as const;
};
