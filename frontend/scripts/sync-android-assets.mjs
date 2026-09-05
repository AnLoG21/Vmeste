/**
 * Copy Vite mobile dist into Android Capacitor assets without requiring
 * Android SDK / full `cap sync` (CI-friendly fresh-bundle gate).
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const assetsDir = join(root, "android", "app", "src", "main", "assets");
const publicDir = join(assetsDir, "public");

if (!existsSync(join(dist, "index.html"))) {
  console.error("dist/index.html missing — run npm run build:mobile first");
  process.exit(1);
}

mkdirSync(assetsDir, { recursive: true });
rmSync(publicDir, { recursive: true, force: true });
cpSync(dist, publicDir, { recursive: true });

const cfgPath = join(root, "capacitor.config.json");
const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
writeFileSync(join(assetsDir, "capacitor.config.json"), JSON.stringify(cfg));

const plugins = {
  packageClassList: [
    "com.capacitorjs.plugins.geolocation.GeolocationPlugin",
    "com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin",
    "com.capacitorjs.plugins.statusbar.StatusBarPlugin",
  ],
};
writeFileSync(join(assetsDir, "capacitor.plugins.json"), `${JSON.stringify(plugins, null, 2)}\n`);

console.log("Synced web assets → android/app/src/main/assets/public");
