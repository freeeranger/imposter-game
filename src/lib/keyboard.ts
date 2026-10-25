import { useEffect, useState } from "react";

const KEYBOARD_MIN_HEIGHT = 120;

// Whether the on-screen keyboard is up, and how much of the page it covers.
// The Android app and Android Chrome (interactive-widget=resizes-content) shrink the page for
// the keyboard, so `inset` stays 0 there. iPhone Safari only shrinks the visual viewport and
// lays the keyboard over the page; `inset` is how much to lift bottom-docked content.
export const useKeyboard = () => {
  const [keyboard, setKeyboard] = useState({ open: false, inset: 0 });

  useEffect(() => {
    const viewport = window.visualViewport;
    let tallest = window.innerHeight;
    const update = () => {
      tallest = Math.max(tallest, window.innerHeight);
      const covered = viewport
        ? Math.round(window.innerHeight - viewport.height - viewport.offsetTop)
        : 0;
      const inset = covered > KEYBOARD_MIN_HEIGHT ? covered : 0;
      const open =
        inset > 0 || tallest - window.innerHeight > KEYBOARD_MIN_HEIGHT;
      setKeyboard((current) =>
        current.open === open && current.inset === inset
          ? current
          : { open, inset },
      );
    };
    window.addEventListener("resize", update);
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
    };
  }, []);

  return keyboard;
};
