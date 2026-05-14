import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const buildDate = new Date();
const pad = (n: number) => String(n).padStart(2, "0");
const BUILD_DATE = `${buildDate.getFullYear()}.${pad(buildDate.getMonth() + 1)}.${pad(buildDate.getDate())}`;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(BUILD_DATE),
  },
  server: {
    host: true,
    allowedHosts: true,
    cors: true,
  },
});
