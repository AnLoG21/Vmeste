/**
 * Generate 50 Open Graph cover proposals (1200×630) for Vmeste.
 * Open brand-proposals/index.html → section «OG cover».
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "brand-proposals");
const OG_DIR = path.join(ROOT, "og-covers");
const W = 1200;
const H = 630;

const ORANGE = "#FF7A00";
const ORANGE_DEEP = "#E85F00";
const INK = "#1A1208";
const CREAM = "#FFF7F0";
const WHITE = "#FFFFFF";
const PEACH = "#FFE8D4";

const TAGLINES = [
  "Онлайн-запись для бизнеса",
  "Салоны · автосервис · кафе",
  "Запись, чаты и автоматизация",
  "Платформа для локального бизнеса",
  "Клиенты рядом — вместе проще",
];

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function pinMark(cx, cy, scale = 1, fill = ORANGE, hole = WHITE) {
  const s = scale;
  return `
  <g transform="translate(${cx} ${cy}) scale(${s}) translate(-56 -70)">
    <path d="M56 8c-24.3 0-44 19.7-44 44 0 33.5 44 86 44 86s44-52.5 44-86c0-24.3-19.7-44-44-44z" fill="${fill}"/>
    <circle cx="56" cy="50" r="16" fill="${hole}"/>
  </g>`;
}

function wordmark(x, y, fill = INK, size = 96) {
  return `
  <g fill="${fill}" font-family="Manrope, Arial Black, Arial, sans-serif" font-weight="800" font-size="${size}">
    <text x="${x}" y="${y}">В</text>
    <text x="${x + size * 1.05}" y="${y}">месте</text>
  </g>
  ${pinMark(x + size * 0.72, y - size * 0.72, size / 148, ORANGE, fill === WHITE || fill === CREAM ? fill : WHITE)}`;
}

function bg(i) {
  const styles = [
    () => `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${CREAM}"/><stop offset="1" stop-color="${PEACH}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#bg)"/>`,
    () => `<defs><radialGradient id="bg" cx="50%" cy="35%" r="75%"><stop stop-color="#FFD4A8"/><stop offset="1" stop-color="${CREAM}"/></radialGradient></defs><rect width="${W}" height="${H}" fill="url(#bg)"/>`,
    () => `<rect width="${W}" height="${H}" fill="${INK}"/>`,
    () => `<defs><linearGradient id="bg" x1="0" y1="0.5" x2="1" y2="0.5"><stop stop-color="${ORANGE_DEEP}"/><stop offset="1" stop-color="${ORANGE}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#bg)"/>`,
    () => `<rect width="${W}" height="${H}" fill="${WHITE}"/><rect x="0" y="0" width="18" height="${H}" fill="${ORANGE}"/>`,
    () => `<rect width="${W}" height="${H}" fill="${CREAM}"/><circle cx="980" cy="120" r="220" fill="${ORANGE}" opacity="0.12"/><circle cx="160" cy="520" r="180" fill="${ORANGE}" opacity="0.1"/>`,
    () => `<defs><linearGradient id="bg" x1="0.5" y1="0" x2="0.5" y2="1"><stop stop-color="#2A1810"/><stop offset="1" stop-color="${INK}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#bg)"/>`,
    () => `<rect width="${W}" height="${H}" fill="${PEACH}"/><path d="M0 480 Q300 400 600 480 T1200 480 V630 H0 Z" fill="${ORANGE}" opacity="0.18"/>`,
    () => `<rect width="${W}" height="${H}" fill="${WHITE}"/><rect x="48" y="48" width="${W - 96}" height="${H - 96}" rx="28" fill="none" stroke="${ORANGE}" stroke-width="4"/>`,
    () => `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="0"><stop stop-color="${CREAM}"/><stop offset="0.55" stop-color="${CREAM}"/><stop offset="0.55" stop-color="${INK}"/><stop offset="1" stop-color="${INK}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#bg)"/>`,
  ];
  return styles[i % styles.length]();
}

function layout(i) {
  const tag = TAGLINES[i % TAGLINES.length];
  const darkBg = i % 10 === 2 || i % 10 === 3 || i % 10 === 6 || i % 10 === 9;
  const ink = darkBg && i % 10 !== 9 ? WHITE : INK;
  const muted = darkBg && i % 10 !== 9 ? "#FFD9BD" : "#7A6552";
  const mode = i % 10;

  if (mode === 0) {
    return `
      ${wordmark(220, 300, ink, 110)}
      <text x="600" y="390" text-anchor="middle" font-family="Manrope,Arial,sans-serif" font-size="34" fill="${muted}">${esc(tag)}</text>
      <text x="600" y="540" text-anchor="middle" font-family="Manrope,Arial,sans-serif" font-size="24" fill="${muted}">vsevmeste.space</text>`;
  }
  if (mode === 1) {
    return `
      ${pinMark(600, 160, 1.35, ORANGE, WHITE)}
      <text x="600" y="360" text-anchor="middle" font-family="Manrope,Arial,sans-serif" font-weight="800" font-size="92" fill="${ink}">Вместе</text>
      <text x="600" y="430" text-anchor="middle" font-family="Manrope,Arial,sans-serif" font-size="32" fill="${muted}">${esc(tag)}</text>
      <text x="600" y="560" text-anchor="middle" font-family="Manrope,Arial,sans-serif" font-size="22" fill="${muted}">vsevmeste.space</text>`;
  }
  if (mode === 2) {
    return `
      <text x="80" y="220" font-family="Manrope,Arial,sans-serif" font-weight="800" font-size="88" fill="${WHITE}">Вместе</text>
      <text x="80" y="300" font-family="Manrope,Arial,sans-serif" font-size="36" fill="#FFD9BD">${esc(tag)}</text>
      <g transform="translate(900 180)">${pinMark(0, 0, 1.6, ORANGE, INK)}</g>
      <text x="80" y="540" font-family="Manrope,Arial,sans-serif" font-size="24" fill="#C9B0A0">vsevmeste.space</text>`;
  }
  if (mode === 3) {
    return `
      <text x="600" y="260" text-anchor="middle" font-family="Manrope,Arial,sans-serif" font-weight="800" font-size="100" fill="${WHITE}">Вместе</text>
      <rect x="420" y="300" width="360" height="6" rx="3" fill="${WHITE}" opacity="0.85"/>
      <text x="600" y="380" text-anchor="middle" font-family="Manrope,Arial,sans-serif" font-size="34" fill="${WHITE}">${esc(tag)}</text>
      <text x="600" y="540" text-anchor="middle" font-family="Manrope,Arial,sans-serif" font-size="24" fill="${WHITE}" opacity="0.85">vsevmeste.space</text>`;
  }
  if (mode === 4) {
    return `
      <text x="100" y="250" font-family="Manrope,Arial,sans-serif" font-weight="800" font-size="86" fill="${INK}">Вместе</text>
      <text x="100" y="330" font-family="Manrope,Arial,sans-serif" font-size="34" fill="#7A6552">${esc(tag)}</text>
      <text x="100" y="520" font-family="Manrope,Arial,sans-serif" font-size="24" fill="#7A6552">vsevmeste.space</text>
      ${pinMark(980, 300, 1.8)}`;
  }
  if (mode === 5) {
    return `
      <rect x="90" y="120" width="1020" height="390" rx="32" fill="${WHITE}" opacity="0.92"/>
      ${wordmark(200, 300, INK, 96)}
      <text x="600" y="400" text-anchor="middle" font-family="Manrope,Arial,sans-serif" font-size="30" fill="#7A6552">${esc(tag)}</text>
      <text x="600" y="460" text-anchor="middle" font-family="Manrope,Arial,sans-serif" font-size="22" fill="#7A6552">vsevmeste.space</text>`;
  }
  if (mode === 6) {
    return `
      <rect x="70" y="90" width="220" height="220" rx="48" fill="#1A1208" stroke="${ORANGE}" stroke-width="0"/>
      <g transform="translate(110 120) scale(1.4)">${pinMark(56, 70, 1, ORANGE, INK)}</g>
      <text x="340" y="200" font-family="Manrope,Arial,sans-serif" font-weight="800" font-size="84" fill="${WHITE}">Вместе</text>
      <text x="340" y="280" font-family="Manrope,Arial,sans-serif" font-size="32" fill="#FFD9BD">${esc(tag)}</text>
      <text x="340" y="520" font-family="Manrope,Arial,sans-serif" font-size="24" fill="#C9B0A0">vsevmeste.space</text>`;
  }
  if (mode === 7) {
    return `
      <text x="80" y="200" font-family="Georgia,'Source Serif 4',serif" font-weight="700" font-size="92" fill="${INK}">Вместе</text>
      <text x="80" y="290" font-family="Manrope,Arial,sans-serif" font-size="34" fill="#7A6552">${esc(tag)}</text>
      ${pinMark(1000, 200, 1.2)}
      <text x="80" y="540" font-family="Manrope,Arial,sans-serif" font-size="24" fill="#7A6552">vsevmeste.space</text>`;
  }
  if (mode === 8) {
    return `
      ${wordmark(260, 280, INK, 100)}
      <text x="600" y="380" text-anchor="middle" font-family="Manrope,Arial,sans-serif" font-size="32" fill="#7A6552">${esc(tag)}</text>
      <text x="600" y="520" text-anchor="middle" font-family="Manrope,Arial,sans-serif" font-size="24" fill="#7A6552">vsevmeste.space</text>`;
  }
  // split cream / ink
  return `
    <text x="80" y="280" font-family="Manrope,Arial,sans-serif" font-weight="800" font-size="78" fill="${INK}">Вместе</text>
    <text x="80" y="360" font-family="Manrope,Arial,sans-serif" font-size="28" fill="#7A6552">${esc(tag)}</text>
    <text x="720" y="280" font-family="Manrope,Arial,sans-serif" font-weight="800" font-size="48" fill="${WHITE}">Онлайн</text>
    <text x="720" y="350" font-family="Manrope,Arial,sans-serif" font-size="28" fill="#FFD9BD">запись · чаты</text>
    <text x="80" y="540" font-family="Manrope,Arial,sans-serif" font-size="22" fill="#7A6552">vsevmeste.space</text>`;
}

function ogSvg(i) {
  const id = String(i + 1).padStart(2, "0");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${bg(i)}
  ${layout(i)}
  <text x="24" y="612" font-family="Manrope,Arial,sans-serif" font-size="16" fill="#998877" opacity="0.7">OG${id}</text>
</svg>`;
}

function rebuildGallery(ogFiles) {
  const indexPath = path.join(ROOT, "index.html");
  let html = fs.readFileSync(indexPath, "utf8");

  // Update title / picks / hint
  html = html.replace(
    "<title>Vmeste — выбор лого и фавикона</title>",
    "<title>Vmeste — выбор лого, фавикона и OG cover</title>"
  );
  if (!html.includes("pick-og")) {
    html = html.replace(
      `<div>Фавикон: <strong id="pick-fav">—</strong></div>
    </div>`,
      `<div>Фавикон: <strong id="pick-fav">—</strong></div>
      <div>OG cover: <strong id="pick-og">—</strong></div>
    </div>`
    );
  }
  html = html.replace(
    "«лого L12, фавикон F07»",
    "«лого L12, фавикон F07, OG15»"
  );

  const ogCards = ogFiles
    .map(
      (f, i) => `<button type="button" class="card card--og" data-kind="og" data-id="OG${i + 1}" data-file="${f}">
      <img src="og-covers/${f}" alt="OG ${i + 1}" loading="lazy"/>
      <span>OG${String(i + 1).padStart(2, "0")}</span>
    </button>`
    )
    .join("\n");

  const ogSection = `
  <section>
    <h2>OG cover — превью при шаринге (50)</h2>
    <p class="hint" style="margin-bottom:12px">Формат 1200×630. Выберите вариант для <code>og-cover.png</code>.</p>
    <div class="grid grid--og" id="ogs">${ogCards}</div>
  </section>`;

  if (html.includes('id="ogs"')) {
    html = html.replace(/<section>\s*<h2>OG cover[\s\S]*?<\/section>/, ogSection.trim());
  } else {
    html = html.replace("</header>", `</header>\n${ogSection}`);
  }

  if (!html.includes(".grid--og")) {
    html = html.replace(
      ".grid--fav { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); }",
      `.grid--fav { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); }
    .grid--og { grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }`
    );
  }

  // Extend click handler for og
  if (!html.includes("pick-og")) {
    // already handled picks HTML
  }
  if (!html.includes("selected.og")) {
    html = html.replace(
      "const selected = { logo: null, favicon: null };",
      "const selected = { logo: null, favicon: null, og: null };\n    const pickOg = document.getElementById('pick-og');"
    );
    html = html.replace(
      `if (kind === 'logo') { selected.logo = id; pickLogo.textContent = id + ' (' + btn.dataset.file + ')'; }
      else { selected.favicon = id; pickFav.textContent = id + ' (' + btn.dataset.file + ')'; }`,
      `if (kind === 'logo') { selected.logo = id; pickLogo.textContent = id + ' (' + btn.dataset.file + ')'; }
      else if (kind === 'favicon') { selected.favicon = id; pickFav.textContent = id + ' (' + btn.dataset.file + ')'; }
      else if (kind === 'og') { selected.og = id; if (pickOg) pickOg.textContent = id + ' (' + btn.dataset.file + ')'; }`
    );
    html = html.replace(
      `if (saved?.favicon) {
        const b = document.querySelector('.card[data-id="'+saved.favicon+'"]');
        b?.click();
      }`,
      `if (saved?.favicon) {
        const b = document.querySelector('.card[data-id="'+saved.favicon+'"]');
        b?.click();
      }
      if (saved?.og) {
        const b = document.querySelector('.card[data-id="'+saved.og+'"]');
        b?.click();
      }`
    );
  }

  fs.writeFileSync(indexPath, html, "utf8");
}

async function main() {
  fs.mkdirSync(OG_DIR, { recursive: true });
  const files = [];
  for (let i = 0; i < 50; i++) {
    const name = `og-${String(i + 1).padStart(2, "0")}.png`;
    const svg = ogSvg(i);
    fs.writeFileSync(path.join(OG_DIR, `og-${String(i + 1).padStart(2, "0")}.svg`), svg, "utf8");
    await sharp(Buffer.from(svg)).png().toFile(path.join(OG_DIR, name));
    files.push(name);
    process.stdout.write(`\rOG ${i + 1}/50`);
  }
  console.log("\nRasterized 50 OG covers");
  rebuildGallery(files);
  console.log(`Gallery updated → ${path.join(ROOT, "index.html")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
