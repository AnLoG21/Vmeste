import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { splitLargeAssetsPlugin } from "./scripts/splitLargeAssets.js";

const EXTERNAL_PACKAGES = [
  "react",
  "react-dom",
  "react-dom/client",
  "react/jsx-runtime",
  "scheduler",
];

function isExternal(id) {
  return EXTERNAL_PACKAGES.some((pkg) => id === pkg || id.startsWith(`${pkg}/`));
}

export default defineConfig({
  plugins: [react(), splitLargeAssetsPlugin()],
  server: { port: 5173, host: true },
  build: {
    minify: "terser",
    terserOptions: {
      format: {
        beautify: true,
        max_line_len: 5000,
      },
    },
    cssCodeSplit: true,
    rollupOptions: {
      external: isExternal,
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            return undefined;
          }
          if (id.includes("/src/legal/")) {
            return "legal-pages";
          }
          if (id.includes("/src/clientOrgFeatures")) {
            return "client-org-features";
          }
          if (id.includes("/src/yandexMapsLoader")) {
            return "yandex-maps";
          }
          if (id.includes("/src/App.jsx")) {
            return "app-main";
          }
          if (id.includes("/src/PublicEntry")) {
            return "public-entry";
          }
        },
      },
    },
  },
});
