import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "se.tjeneritz.imposter",
  appName: "Imposter",
  webDir: "dist",
  // Matches the dark theme so the app never flashes white while loading.
  backgroundColor: "#15111f",
  plugins: {
    SystemBars: {
      insetsHandling: "css",
      initialViewportFitValueHint: "cover",
      style: "DARK",
    },
  },
};

export default config;
