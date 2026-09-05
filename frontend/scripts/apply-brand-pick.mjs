/**
 * Apply selected brand: AI-L01 wordmark + F13 favicon mark.
 * Usage: node scripts/apply-brand-pick.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const proposals = path.join(root, "brand-proposals");

const LOGO_SRC = path.join(proposals, "ai", "ai-logo-01-pin-wordmark.png");

const FAV_CLEAN = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#1A1208"/>
  <circle cx="32" cy="26" r="11" fill="#FF8C33"/>
  <rect x="30" y="36" width="4" height="12" rx="2" fill="#FF8C33"/>
  <ellipse cx="32" cy="50" rx="10" ry="3.2" fill="#FF8C33" opacity="0.55"/>
</svg>`;

async function trimLogoTransparent(inputPath, outPath) {
  const { data, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let top = height;
  let left = width;
  let right = 0;
  let bottom = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = channels > 3 ? data[i + 3] : 255;
      const isBg = a < 8 || (r > 245 && g > 245 && b > 245);
      if (!isBg) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  const pad = 8;
  left = Math.max(0, left - pad);
  top = Math.max(0, top - pad);
  right = Math.min(width - 1, right + pad);
  bottom = Math.min(height - 1, bottom + pad);

  const cropped = await sharp(inputPath)
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = Buffer.from(cropped.data);
  for (let i = 0; i < out.length; i += 4) {
    if (out[i] > 245 && out[i + 1] > 245 && out[i + 2] > 245) out[i + 3] = 0;
  }

  await sharp(out, {
    raw: { width: cropped.info.width, height: cropped.info.height, channels: 4 },
  })
    .png()
    .toFile(outPath);
}

async function svgPng(svg, size, outPath) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(outPath);
}

async function main() {
  const assets = path.join(root, "src", "assets");
  const pub = path.join(root, "public");

  fs.writeFileSync(path.join(pub, "favicon.svg"), FAV_CLEAN, "utf8");
  fs.writeFileSync(path.join(proposals, "selected-favicon.svg"), FAV_CLEAN, "utf8");

  const logoMain = path.join(assets, "logo-main.png");
  await trimLogoTransparent(LOGO_SRC, logoMain);
  await sharp(logoMain).png().toFile(path.join(pub, "logo-main.png"));

  await svgPng(FAV_CLEAN, 48, path.join(pub, "favicon.png"));
  await svgPng(FAV_CLEAN, 180, path.join(pub, "apple-touch-icon.png"));
  await svgPng(FAV_CLEAN, 192, path.join(pub, "icon-192.png"));
  await svgPng(FAV_CLEAN, 512, path.join(pub, "icon-512.png"));
  await svgPng(FAV_CLEAN, 128, path.join(assets, "logo-small.png"));

  const fgSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="432" height="432" viewBox="0 0 432 432">
  <rect width="432" height="432" fill="#1A1208"/>
  <g transform="translate(216 210) scale(4.6) translate(-32 -32)">
    <circle cx="32" cy="26" r="11" fill="#FF8C33"/>
    <rect x="30" y="36" width="4" height="12" rx="2" fill="#FF8C33"/>
    <ellipse cx="32" cy="50" rx="10" ry="3.2" fill="#FF8C33" opacity="0.55"/>
  </g>
</svg>`;

  const launcher = [
    ["mdpi", 48, 108],
    ["hdpi", 72, 162],
    ["xhdpi", 96, 216],
    ["xxhdpi", 144, 324],
    ["xxxhdpi", 192, 432],
  ];
  for (const [dens, iconSize, fgSize] of launcher) {
    const dir = path.join(root, "android", "app", "src", "main", "res", `mipmap-${dens}`);
    if (!fs.existsSync(dir)) continue;
    await svgPng(FAV_CLEAN, iconSize, path.join(dir, "ic_launcher.png"));
    await svgPng(FAV_CLEAN, iconSize, path.join(dir, "ic_launcher_round.png"));
    await sharp(Buffer.from(fgSvg)).resize(fgSize, fgSize).png().toFile(path.join(dir, "ic_launcher_foreground.png"));
  }

  const iosIcon = path.join(
    root,
    "ios",
    "App",
    "App",
    "Assets.xcassets",
    "AppIcon.appiconset",
    "AppIcon-512@2x.png"
  );
  if (fs.existsSync(path.dirname(iosIcon))) {
    await svgPng(FAV_CLEAN, 1024, iosIcon);
  }

  console.log("OK: AI-L01 → logo-main.png; F13 → favicons + launcher icons");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
