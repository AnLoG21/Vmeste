import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Web deep links (/m/…, /t/…) need absolute base "/". Capacitor mobile keeps "./".
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === "mobile" ? "./" : "/",
  server: { port: 5173, host: true },
}));
