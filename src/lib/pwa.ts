import { registerSW } from "virtual:pwa-register";

let applyUpdate: (() => void) | null = null;

// Web only: offline support. A new deploy downloads in the background and waits; it goes live
// on the next launch, or earlier via applyPendingWebUpdate when the app is idle in the background.
export const registerWebApp = () => {
  const updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh: () => {
      applyUpdate = () => void updateServiceWorker(true);
    },
  });
};

// Activates a downloaded update, which reloads the page. Only call when nothing would be lost.
export const applyPendingWebUpdate = () => {
  const apply = applyUpdate;
  applyUpdate = null;
  apply?.();
};
