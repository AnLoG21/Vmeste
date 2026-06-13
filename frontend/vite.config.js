import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { splitLargeAssetsPlugin } from "./scripts/splitLargeAssets.js";

function vendorChunk(id) {
  if (!id.includes("node_modules")) return undefined;
  const match = id.match(/node_modules\/(?:\.pnpm\/)?(@[^/]+\/[^/]+|[^/]+)/);
  if (!match) return "vendor";
  return `vendor-${match[1].replace("@", "").replace("/", "-")}`;
}

export default defineConfig({
  plugins: [react(), splitLargeAssetsPlugin()],
  server: { port: 5173, host: true },
  build: {
    minify: "terser",
    terserOptions: {
      format: {
        beautify: true,
        max_line_len: 8000,
      },
    },
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            return vendorChunk(id);
          }
          if (id.includes("/src/legal/")) {
            return "legal-pages";
          }
          if (id.includes("/src/LandingPage")) {
            return "landing-page";
          }
          if (id.includes("/src/SubscriptionsPage")) {
            return "subscriptions-page";
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
