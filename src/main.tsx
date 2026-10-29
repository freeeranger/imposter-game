import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "@/app/App";
import { isNativeApp } from "@/lib/native";
import { registerWebApp } from "@/lib/pwa";

if (!isNativeApp) {
  registerWebApp();
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
