import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "se.tjeneritz.imposter",
  appName: "Imposter",
  webDir: "dist",
  // Matches the dark theme so the app never flashes white while loading.
  backgroundColor: "#15111f",
  plugins: {
    // Back is handled by our PredictiveBack plugin (it supports the predictive back gesture).
    App: {
      disableBackButtonHandler: true,
    },
    // Held until the app has rendered (see hideSplashScreen), then faded out.
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: "#15111f",
      showSpinner: false,
    },
    SystemBars: {
      insetsHandling: "css",
      initialViewportFitValueHint: "cover",
      style: "DARK",
    },
  },
};

export default config;
