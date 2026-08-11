import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Web deep links (/m/…, /t/…) need absolute base "/". Capacitor mobile keeps "./".
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === "mobile" ? "./" : "/",
  server: { port: 5173, host: true },
  build: {
    cssCodeSplit: true,
    sourcemap: mode !== "mobile",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("node_modules/react-dom") ||
            id.includes("node_modules/react/") ||
            id.includes("node_modules/scheduler")
          ) {
            return "vendor-react";
          }
          if (id.includes("node_modules")) {
            return "vendor";
          }
        },
      },
    },
  },
}));
