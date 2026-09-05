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

/** Remove white matte / light fringe left by AI PNG export. */
async function trimLogoTransparent(inputPath, outPath) {
  const { data, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let top = height;
  let left = width;
  let right = 0;
  let bottom = 0;
  const out = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const o = (y * width + x) * 4;
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];
      let a = channels > 3 ? data[i + 3] : 255;

      const maxc = Math.max(r, g, b);
      const minc = Math.min(r, g, b);
      const lum = (r + g + b) / 3;
      const isOrange = r > 170 && g > 60 && g < 210 && b < 140 && r - b > 50;
      const isDark = maxc < 95 && lum < 80;
      const isNearWhite = minc > 228 || (lum > 235 && maxc - minc < 18);
      const isLightFringe = !isOrange && !isDark && lum > 175 && maxc - minc < 40;

      if (a < 8 || isNearWhite || isLightFringe) {
        out[o + 3] = 0;
        continue;
      }

      if (!isOrange && lum > 140 && maxc - minc < 55) {
        const t = Math.min(1, (lum - 140) / 90);
        a = Math.round(a * (1 - t));
        if (a < 12) {
          out[o + 3] = 0;
          continue;
        }
        const inv = 1 - a / 255;
        const den = a / 255 || 1;
        r = Math.max(0, Math.min(255, Math.round((r - 255 * inv) / den)));
        g = Math.max(0, Math.min(255, Math.round((g - 255 * inv) / den)));
        b = Math.max(0, Math.min(255, Math.round((b - 255 * inv) / den)));
      }

      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
      out[o + 3] = a;

      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }

  if (right < left || bottom < top) {
    throw new Error("Logo trim failed: no opaque pixels");
  }

  const pad = 6;
  left = Math.max(0, left - pad);
  top = Math.max(0, top - pad);
  right = Math.min(width - 1, right + pad);
  bottom = Math.min(height - 1, bottom + pad);

  await sharp(out, { raw: { width, height, channels: 4 } })
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
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

  console.log("OK: cleaned logo-main.png (no white fringe) + favicons");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
