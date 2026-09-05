/**
 * Rebuild AI-L01-style wordmark as clean SVG → PNG (no white fringe).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

// Clean vector lockup inspired by AI-L01: В + pin + месте
const LOGO_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="920" height="220" viewBox="0 0 920 220">
  <g fill="#1A1208" font-family="Manrope, Arial Black, Arial, sans-serif" font-weight="800" font-size="148">
    <text x="24" y="158">В</text>
    <text x="280" y="158">месте</text>
  </g>
  <!-- Map pin between В and месте -->
  <g transform="translate(168 28)">
    <path d="M56 8c-24.3 0-44 19.7-44 44 0 33.5 44 86 44 86s44-52.5 44-86c0-24.3-19.7-44-44-44z" fill="#FF7A00"/>
    <circle cx="56" cy="50" r="16" fill="#FFFFFF"/>
  </g>
</svg>`;

async function main() {
  const assets = path.join(root, "src", "assets");
  const pub = path.join(root, "public");
  const buf = await sharp(Buffer.from(LOGO_SVG))
    .resize({ width: 920, height: 220, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // Trim transparent padding
  const trimmed = await sharp(buf).trim({ threshold: 0 }).png().toBuffer();
  await sharp(trimmed).toFile(path.join(assets, "logo-main.png"));
  await sharp(trimmed).toFile(path.join(pub, "logo-main.png"));
  fs.writeFileSync(path.join(root, "brand-proposals", "selected-logo.svg"), LOGO_SVG, "utf8");
  console.log("OK: clean SVG wordmark → logo-main.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
