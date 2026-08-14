import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Web deep links (/m/…, /t/…) need absolute base "/". Capacitor mobile keeps "./".
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === "mobile" ? "./" : "/",
  server: { port: 5173, host: true },
  build: {
    // Source maps and gzip reports only slow Rollup's "rendering chunks" step on the VPS.
    sourcemap: false,
    reportCompressedSize: false,
    cssCodeSplit: true,
  },
}));
