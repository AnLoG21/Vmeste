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
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{js,jsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.{js,jsx}"],
      exclude: [
        "src/**/*.test.{js,jsx}",
        "src/main.jsx",
        "src/e2eHooks.js",
      ],
    },
  },
}));
