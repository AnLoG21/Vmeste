import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// Web deep links (/m/…, /t/…) need absolute base "/". Capacitor mobile keeps "./".
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === "mobile" ? "./" : "/",
  server: { port: 5173, host: true },
  esbuild: { legalComments: "none" },
  build: {
    sourcemap: false,
    reportCompressedSize: false,
    cssCodeSplit: true,
    minify: "esbuild",
    cssMinify: "esbuild",
    target: "es2020",
  },
}));
