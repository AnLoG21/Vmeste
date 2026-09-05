/**
 * Generate 50 logo + 50 favicon SVG proposals for Vmeste ("Вместе").
 * Brand accent: #FF7A00. Open brand-proposals/index.html to pick.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "brand-proposals");
const LOGO_DIR = path.join(ROOT, "logos");
const FAV_DIR = path.join(ROOT, "favicons");

const ORANGE = "#FF7A00";
const ORANGE_DEEP = "#E85F00";
const INK = "#1A1208";
const CREAM = "#FFF7F0";
const WHITE = "#FFFFFF";

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function pinPath(cx = 24, cy = 10, r = 9) {
  return `M${cx} ${cy - r}c-${r * 0.72} 0-${r * 1.3} ${r * 0.58}-${r * 1.3} ${r * 1.3} 0 ${r * 0.98} ${r * 1.3} ${r * 2.3} ${r * 1.3} ${r * 2.3}s${r * 1.3}-${r * 1.32} ${r * 1.3}-${r * 2.3}c0-${r * 0.72}-${r * 0.58}-${r * 1.3}-${r * 1.3}-${r * 1.3}z`;
}

/** Favicon marks: square icon only */
const FAVICON_BUILDERS = [
  (i) => `<circle cx="32" cy="32" r="28" fill="${ORANGE}"/><circle cx="32" cy="28" r="8" fill="${WHITE}"/><path d="M32 38v12" stroke="${WHITE}" stroke-width="4" stroke-linecap="round"/>`,
  (i) => `<rect x="4" y="4" width="56" height="56" rx="14" fill="${ORANGE}"/><path d="${pinPath(32, 18, 11)}" fill="${WHITE}"/><circle cx="32" cy="20" r="4" fill="${ORANGE}"/>`,
  (i) => `<rect width="64" height="64" rx="32" fill="${CREAM}"/><path d="${pinPath(32, 16, 12)}" fill="${ORANGE}"/><circle cx="32" cy="18" r="4.5" fill="${WHITE}"/>`,
  (i) => `<rect x="2" y="2" width="60" height="60" rx="12" fill="${INK}"/><text x="32" y="42" text-anchor="middle" font-family="Manrope,Arial,sans-serif" font-weight="800" font-size="28" fill="${ORANGE}">В</text>`,
  (i) => `<circle cx="32" cy="32" r="30" fill="${INK}"/><text x="32" y="41" text-anchor="middle" font-family="Manrope,Arial,sans-serif" font-weight="800" font-size="26" fill="${ORANGE}">Вм</text>`,
  (i) => `<rect width="64" height="64" fill="${ORANGE}"/><circle cx="22" cy="28" r="10" fill="${WHITE}" opacity=".95"/><circle cx="42" cy="28" r="10" fill="${WHITE}" opacity=".95"/><circle cx="32" cy="42" r="9" fill="${CREAM}"/>`,
  (i) => `<rect width="64" height="64" rx="16" fill="${CREAM}"/><path d="M18 40c0-10 14-22 14-22s14 12 14 22a14 14 0 0 1-28 0z" fill="${ORANGE}"/><circle cx="32" cy="38" r="5" fill="${WHITE}"/>`,
  (i) => `<circle cx="32" cy="32" r="30" stroke="${ORANGE}" stroke-width="4" fill="${CREAM}"/><path d="M20 36c4-10 12-16 12-16s8 6 12 16" stroke="${ORANGE}" stroke-width="3.5" fill="none" stroke-linecap="round"/><circle cx="32" cy="22" r="4" fill="${ORANGE}"/>`,
  (i) => `<rect x="4" y="4" width="56" height="56" rx="28" fill="${ORANGE_DEEP}"/><path d="M20 34h24M24 26h16M28 42h8" stroke="${WHITE}" stroke-width="3.5" stroke-linecap="round"/>`,
  (i) => `<rect width="64" height="64" rx="8" fill="${WHITE}" stroke="${ORANGE}" stroke-width="4"/><path d="${pinPath(32, 14, 10)}" fill="${ORANGE}"/><ellipse cx="32" cy="48" rx="12" ry="4" fill="${ORANGE}" opacity=".35"/>`,
  (i) => `<defs><linearGradient id="g${i}" x1="0" y1="0" x2="64" y2="64"><stop stop-color="${ORANGE}"/><stop offset="1" stop-color="${ORANGE_DEEP}"/></linearGradient></defs><rect width="64" height="64" rx="18" fill="url(#g${i})"/><path d="${pinPath(32, 16, 11)}" fill="${WHITE}"/>`,
  (i) => `<circle cx="32" cy="32" r="30" fill="${ORANGE}"/><path d="M18 34c6-2 10-8 14-8s8 6 14 8" stroke="${WHITE}" stroke-width="3" fill="none"/><circle cx="24" cy="26" r="4" fill="${WHITE}"/><circle cx="40" cy="26" r="4" fill="${WHITE}"/>`,
  (i) => `<rect width="64" height="64" rx="12" fill="${INK}"/><circle cx="32" cy="28" r="12" fill="${ORANGE}"/><rect x="30" y="38" width="4" height="14" rx="2" fill="${ORANGE}"/><ellipse cx="32" cy="52" rx="10" ry="3" fill="${ORANGE}" opacity=".5"/>`,
  (i) => `<path d="M8 12h48v40H8z" fill="${CREAM}"/><path d="M32 8l20 36H12L32 8z" fill="${ORANGE}"/><circle cx="32" cy="34" r="6" fill="${WHITE}"/>`,
  (i) => `<rect width="64" height="64" fill="${ORANGE}"/><text x="32" y="44" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="30" fill="${WHITE}">V</text>`,
  (i) => `<circle cx="32" cy="32" r="28" fill="${WHITE}" stroke="${INK}" stroke-width="3"/><path d="${pinPath(32, 18, 10)}" fill="${ORANGE}"/>`,
  (i) => `<rect x="6" y="6" width="52" height="52" rx="10" fill="${ORANGE}"/><path d="M20 40 L32 18 L44 40 Z" fill="${WHITE}"/><circle cx="32" cy="34" r="4" fill="${ORANGE}"/>`,
  (i) => `<rect width="64" height="64" rx="20" fill="${CREAM}"/><circle cx="24" cy="30" r="9" fill="${ORANGE}"/><circle cx="40" cy="30" r="9" fill="${ORANGE_DEEP}"/><path d="M18 44c6 6 22 6 28 0" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  (i) => `<defs><radialGradient id="r${i}" cx="35%" cy="30%"><stop stop-color="#FFB066"/><stop offset="1" stop-color="${ORANGE_DEEP}"/></radialGradient></defs><circle cx="32" cy="32" r="30" fill="url(#r${i})"/><circle cx="32" cy="28" r="7" fill="${WHITE}" opacity=".9"/>`,
  (i) => `<rect width="64" height="64" rx="4" fill="${INK}"/><rect x="14" y="14" width="36" height="36" rx="8" fill="${ORANGE}"/><circle cx="32" cy="32" r="8" fill="${INK}"/>`,
  (i) => `<path d="M32 4 L60 32 L32 60 L4 32 Z" fill="${ORANGE}"/><circle cx="32" cy="32" r="10" fill="${WHITE}"/>`,
  (i) => `<circle cx="32" cy="32" r="30" fill="${CREAM}"/><text x="32" y="40" text-anchor="middle" font-family="Manrope,Arial,sans-serif" font-weight="800" font-size="22" fill="${ORANGE}">+</text><circle cx="22" cy="26" r="6" fill="${ORANGE}"/><circle cx="42" cy="26" r="6" fill="${ORANGE}"/>`,
  (i) => `<rect width="64" height="64" rx="16" fill="${WHITE}"/><path d="M12 44c8-20 20-28 20-28s12 8 20 28" fill="${ORANGE}" opacity=".2"/><path d="${pinPath(32, 16, 11)}" fill="${ORANGE}"/>`,
  (i) => `<rect width="64" height="64" fill="${ORANGE_DEEP}"/><path d="M16 20h32v8H16zm0 12h24v8H16zm0 12h28v8H16z" fill="${WHITE}"/>`,
  (i) => `<circle cx="32" cy="32" r="30" fill="${ORANGE}"/><path d="M22 30h20v4H22zm2-8h16v4H24zm4 16h12v4H28z" fill="${WHITE}"/>`,
];

function faviconBody(i) {
  const builders = FAVICON_BUILDERS;
  const base = builders[i % builders.length](i);
  // Mutate palette / geometry slightly per index for 50 unique looks
  const rot = (i * 7) % 24;
  const scale = 0.88 + (i % 5) * 0.025;
  const bgAlt = [CREAM, WHITE, "#FFF3E8", "#1A1208", "#2A1810", ORANGE, "#FFE0C2", "#FFF"][i % 8];
  const accent = [ORANGE, ORANGE_DEEP, "#FF8C33", "#FF6A00", "#F07800"][i % 5];
  return `
  <rect width="64" height="64" rx="${8 + (i % 4) * 4}" fill="${bgAlt}"/>
  <g transform="translate(32 32) rotate(${rot}) scale(${scale}) translate(-32 -32)" style="color:${accent}">
    ${base.replaceAll(ORANGE, accent).replaceAll(ORANGE_DEEP, accent)}
  </g>`;
}

function logoSvg(i) {
  const accent = [ORANGE, ORANGE_DEEP, "#FF8C33", "#FF6A00", "#F07800"][i % 5];
  const ink = i % 7 === 0 ? WHITE : INK;
  const bg = i % 7 === 0 ? INK : i % 5 === 0 ? CREAM : WHITE;
  const styles = [
    "pin-between",
    "mark-left",
    "stacked",
    "badge-word",
    "outline",
    "mono",
    "serif",
    "rounded-pill",
    "map-orbit",
    "together-dots",
  ];
  const style = styles[i % styles.length];
  const label = "Вместе";
  let mark = "";
  let word = "";

  if (style === "pin-between") {
    mark = `<g transform="translate(118,18)"><path d="${pinPath(20, 8, 10)}" fill="${accent}"/><circle cx="20" cy="10" r="3.5" fill="${bg === INK ? INK : WHITE}"/></g>`;
    word = `<text x="40" y="52" font-family="Manrope,Arial,sans-serif" font-weight="800" font-size="42" fill="${ink}">В</text>
            <text x="168" y="52" font-family="Manrope,Arial,sans-serif" font-weight="800" font-size="42" fill="${ink}">месте</text>`;
  } else if (style === "mark-left") {
    mark = `<rect x="24" y="16" width="56" height="56" rx="14" fill="${accent}"/>
            <path d="${pinPath(52, 28, 12)}" fill="${WHITE}" transform="translate(0,0)"/><circle cx="52" cy="30" r="4" fill="${accent}"/>`;
    word = `<text x="100" y="56" font-family="Manrope,Arial,sans-serif" font-weight="800" font-size="40" fill="${ink}">${esc(label)}</text>`;
  } else if (style === "stacked") {
    mark = `<circle cx="200" cy="28" r="18" fill="${accent}"/><path d="${pinPath(200, 18, 8)}" fill="${WHITE}"/>`;
    word = `<text x="200" y="78" text-anchor="middle" font-family="Manrope,Arial,sans-serif" font-weight="800" font-size="36" fill="${ink}">${esc(label)}</text>`;
  } else if (style === "badge-word") {
    mark = `<rect x="40" y="12" width="320" height="64" rx="32" fill="${accent}"/>`;
    word = `<text x="200" y="54" text-anchor="middle" font-family="Manrope,Arial,sans-serif" font-weight="800" font-size="34" fill="${WHITE}">${esc(label)}</text>`;
  } else if (style === "outline") {
    mark = `<rect x="36" y="10" width="328" height="68" rx="16" fill="none" stroke="${accent}" stroke-width="3"/>`;
    word = `<text x="200" y="56" text-anchor="middle" font-family="Manrope,Arial,sans-serif" font-weight="700" font-size="36" fill="${ink}">${esc(label)}</text>`;
  } else if (style === "mono") {
    word = `<text x="200" y="54" text-anchor="middle" font-family="ui-monospace,Consolas,monospace" font-weight="700" font-size="38" letter-spacing="4" fill="${ink}">ВМЕСТЕ</text>`;
    mark = `<rect x="120" y="68" width="160" height="4" rx="2" fill="${accent}"/>`;
  } else if (style === "serif") {
    word = `<text x="200" y="56" text-anchor="middle" font-family="Georgia,'Source Serif 4',serif" font-weight="700" font-size="44" fill="${ink}">${esc(label)}</text>`;
    mark = `<circle cx="200" cy="74" r="4" fill="${accent}"/>`;
  } else if (style === "rounded-pill") {
    mark = `<rect x="48" y="18" width="304" height="52" rx="26" fill="${bg === CREAM ? WHITE : CREAM}" stroke="${accent}" stroke-width="2"/>`;
    word = `<text x="200" y="52" text-anchor="middle" font-family="Manrope,Arial,sans-serif" font-weight="800" font-size="30" fill="${accent}">${esc(label)}</text>`;
  } else if (style === "map-orbit") {
    mark = `<circle cx="70" cy="44" r="28" fill="none" stroke="${accent}" stroke-width="3" stroke-dasharray="4 6"/>
            <path d="${pinPath(70, 28, 10)}" fill="${accent}"/><circle cx="70" cy="30" r="3.5" fill="${WHITE}"/>`;
    word = `<text x="120" y="54" font-family="Manrope,Arial,sans-serif" font-weight="800" font-size="40" fill="${ink}">${esc(label)}</text>`;
  } else {
    mark = `<circle cx="56" cy="40" r="10" fill="${accent}"/><circle cx="80" cy="40" r="10" fill="${accent}" opacity=".75"/><circle cx="68" cy="54" r="8" fill="${ORANGE_DEEP}"/>`;
    word = `<text x="108" y="54" font-family="Manrope,Arial,sans-serif" font-weight="800" font-size="40" fill="${ink}">${esc(label)}</text>`;
  }

  const tag = `L${String(i + 1).padStart(2, "0")} · ${style}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="120" viewBox="0 0 400 120">
  <rect width="400" height="120" rx="12" fill="${bg}"/>
  ${mark}
  ${word}
  <text x="12" y="112" font-family="Manrope,Arial,sans-serif" font-size="10" fill="#998877">${esc(tag)}</text>
</svg>
`;
}

function favSvg(i) {
  const tag = `F${String(i + 1).padStart(2, "0")}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  ${faviconBody(i)}
  <!-- ${tag} -->
</svg>
`;
}

function galleryHtml(logos, favs) {
  const logoCards = logos
    .map(
      (f, i) => `<button type="button" class="card" data-kind="logo" data-id="L${i + 1}" data-file="${f}">
      <img src="logos/${f}" alt="Logo ${i + 1}" loading="lazy"/>
      <span>L${String(i + 1).padStart(2, "0")}</span>
    </button>`
    )
    .join("\n");
  const favCards = favs
    .map(
      (f, i) => `<button type="button" class="card card--fav" data-kind="favicon" data-id="F${i + 1}" data-file="${f}">
      <img src="favicons/${f}" alt="Favicon ${i + 1}" loading="lazy"/>
      <span>F${String(i + 1).padStart(2, "0")}</span>
    </button>`
    )
    .join("\n");

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Vmeste — выбор лого и фавикона</title>
  <style>
    :root { color-scheme: light; --ink:#1a1208; --accent:#ff7a00; --bg:#f6f1eb; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Manrope, system-ui, sans-serif; background: var(--bg); color: var(--ink); }
    header { position: sticky; top: 0; z-index: 5; background: #fff9f3ee; backdrop-filter: blur(8px); border-bottom: 1px solid #ecd9c6; padding: 14px 20px; display: flex; gap: 16px; flex-wrap: wrap; align-items: center; justify-content: space-between; }
    h1 { margin: 0; font-size: 1.15rem; }
    .picks { display: flex; gap: 12px; flex-wrap: wrap; font-size: 0.92rem; }
    .picks strong { color: var(--accent); }
    section { padding: 20px; }
    h2 { margin: 0 0 12px; font-size: 1rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
    .grid--fav { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); }
    .card { appearance: none; border: 2px solid transparent; background: #fff; border-radius: 14px; padding: 12px; cursor: pointer; text-align: center; display: grid; gap: 8px; transition: border-color .15s, transform .15s; }
    .card:hover { transform: translateY(-1px); border-color: #ffd0a8; }
    .card.is-selected { border-color: var(--accent); box-shadow: 0 0 0 3px #ff7a0033; }
    .card img { width: 100%; height: auto; display: block; }
    .card--fav img { width: 64px; height: 64px; margin: 0 auto; }
    .card span { font-size: 0.8rem; color: #7a6552; }
    .hint { margin: 0; color: #7a6552; font-size: 0.9rem; max-width: 52rem; }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Выбор брендинга Vmeste</h1>
      <p class="hint">Кликните по варианту. Напишите в чат номера, например: «лого L12, фавикон F07».</p>
    </div>
    <div class="picks">
      <div>Лого: <strong id="pick-logo">—</strong></div>
      <div>Фавикон: <strong id="pick-fav">—</strong></div>
    </div>
  </header>
  <section>
    <h2>Логотипы (50)</h2>
    <div class="grid" id="logos">${logoCards}</div>
  </section>
  <section>
    <h2>Фавиконки / app icon (50)</h2>
    <div class="grid grid--fav" id="favs">${favCards}</div>
  </section>
  <script>
    const pickLogo = document.getElementById('pick-logo');
    const pickFav = document.getElementById('pick-fav');
    const selected = { logo: null, favicon: null };
    document.body.addEventListener('click', (e) => {
      const btn = e.target.closest('.card');
      if (!btn) return;
      const kind = btn.dataset.kind;
      const id = btn.dataset.id;
      document.querySelectorAll('.card[data-kind="'+kind+'"]').forEach((c) => c.classList.remove('is-selected'));
      btn.classList.add('is-selected');
      if (kind === 'logo') { selected.logo = id; pickLogo.textContent = id + ' (' + btn.dataset.file + ')'; }
      else { selected.favicon = id; pickFav.textContent = id + ' (' + btn.dataset.file + ')'; }
      try { localStorage.setItem('vmeste_brand_pick', JSON.stringify(selected)); } catch {}
    });
    try {
      const saved = JSON.parse(localStorage.getItem('vmeste_brand_pick') || 'null');
      if (saved?.logo) {
        const b = document.querySelector('.card[data-id="'+saved.logo+'"]');
        b?.click();
      }
      if (saved?.favicon) {
        const b = document.querySelector('.card[data-id="'+saved.favicon+'"]');
        b?.click();
      }
    } catch {}
  </script>
</body>
</html>`;
}

fs.mkdirSync(LOGO_DIR, { recursive: true });
fs.mkdirSync(FAV_DIR, { recursive: true });

const logoFiles = [];
const favFiles = [];
for (let i = 0; i < 50; i++) {
  const lf = `logo-${String(i + 1).padStart(2, "0")}.svg`;
  const ff = `favicon-${String(i + 1).padStart(2, "0")}.svg`;
  fs.writeFileSync(path.join(LOGO_DIR, lf), logoSvg(i), "utf8");
  fs.writeFileSync(path.join(FAV_DIR, ff), favSvg(i), "utf8");
  logoFiles.push(lf);
  favFiles.push(ff);
}
fs.writeFileSync(path.join(ROOT, "index.html"), galleryHtml(logoFiles, favFiles), "utf8");
console.log(`Wrote 50 logos + 50 favicons → ${ROOT}`);
console.log("Open brand-proposals/index.html in a browser to choose.");
