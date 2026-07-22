import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import PublicEntry from "./PublicEntry.jsx";
import "./styles.css";
import "./mobile.css";

async function initNativeShell() {
  if (!Capacitor.isNativePlatform()) return;
  document.documentElement.classList.add("native-app");
  try {
    await StatusBar.setBackgroundColor({ color: "#ffffff" });
    await StatusBar.setStyle({ style: Style.Light });
  } catch {
    /* status bar plugin optional on some devices */
  }
}

initNativeShell();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <PublicEntry />
  </StrictMode>
);
