/** Templates, palettes, fonts for Всайте editor. */

export const BASIC_FONTS = [
  { id: "manrope", label: "Manrope", stack: "'Manrope', system-ui, sans-serif" },
  { id: "roboto", label: "Roboto", stack: "'Roboto', system-ui, sans-serif" },
  { id: "pt-serif", label: "PT Serif", stack: "'PT Serif', Georgia, serif" },
];

export const PRO_FONTS = [
  ...BASIC_FONTS,
  { id: "playfair", label: "Playfair Display", stack: "'Playfair Display', Georgia, serif" },
  { id: "montserrat", label: "Montserrat", stack: "'Montserrat', system-ui, sans-serif" },
  { id: "raleway", label: "Raleway", stack: "'Raleway', system-ui, sans-serif" },
  { id: "oswald", label: "Oswald", stack: "'Oswald', system-ui, sans-serif" },
  { id: "source-serif", label: "Source Serif 4", stack: "'Source Serif 4', Georgia, serif" },
  { id: "nunito", label: "Nunito", stack: "'Nunito', system-ui, sans-serif" },
  { id: "ibm-plex", label: "IBM Plex Sans", stack: "'IBM Plex Sans', system-ui, sans-serif" },
];

export const BASIC_PALETTES = [
  { id: "orange", name: "Вместе", colors: ["#FF7A00", "#1a1a1a", "#fff7f0", "#ffffff", "#5c5c5c"] },
  { id: "slate", name: "Сланец", colors: ["#334155", "#0f172a", "#f8fafc", "#ffffff", "#64748b"] },
];

export const PRO_PALETTES = [
  ...BASIC_PALETTES,
  { id: "forest", name: "Лес", colors: ["#2d6a4f", "#081c15", "#d8f3dc", "#ffffff", "#40916c"] },
  { id: "wine", name: "Вино", colors: ["#9b2226", "#370617", "#fff0f3", "#ffffff", "#bb3e03"] },
  { id: "ocean", name: "Океан", colors: ["#0077b6", "#023e8a", "#caf0f8", "#ffffff", "#00b4d8"] },
  { id: "sand", name: "Песок", colors: ["#c9a227", "#3d2c02", "#faf6e9", "#ffffff", "#8a734a"] },
  { id: "ink", name: "Чернила", colors: ["#111827", "#030712", "#f3f4f6", "#ffffff", "#6b7280"] },
];

function landingHtml(palette, font) {
  const [accent, ink, soft, paper, muted] = palette.colors;
  return {
    html: `
<section style="font-family:${font.stack};background:${soft};color:${ink};padding:72px 24px;text-align:center;">
  <p style="letter-spacing:.12em;text-transform:uppercase;color:${muted};font-size:12px;margin:0 0 12px;">Ваш бренд</p>
  <h1 style="font-size:clamp(2rem,6vw,3.5rem);margin:0 0 16px;line-height:1.1;">Сайт, который продаёт без лишних слов</h1>
  <p style="max-width:540px;margin:0 auto 28px;color:${muted};font-size:1.1rem;">Соберите лендинг за вечер: блоки, палитры и шрифты уже готовы.</p>
  <a href="#cta" style="display:inline-block;background:${accent};color:#fff;padding:14px 28px;border-radius:999px;text-decoration:none;font-weight:600;">Оставить заявку</a>
</section>
<section style="font-family:${font.stack};background:${paper};padding:64px 24px;display:grid;gap:24px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));max-width:960px;margin:0 auto;">
  <div><h3 style="margin:0 0 8px;color:${ink};">Быстрый старт</h3><p style="margin:0;color:${muted};">Готовые секции и шаблоны под услуги, кафе и магазины.</p></div>
  <div><h3 style="margin:0 0 8px;color:${ink};">Свой стиль</h3><p style="margin:0;color:${muted};">Палитры, типографика и загрузка своих картинок.</p></div>
  <div><h3 style="margin:0 0 8px;color:${ink};">Публикация</h3><p style="margin:0;color:${muted};">Поддомен Всайте или свой домен через REG.RU.</p></div>
</section>
<section id="cta" style="font-family:${font.stack};background:${ink};color:#fff;padding:64px 24px;text-align:center;">
  <h2 style="margin:0 0 12px;">Готовы запуститься?</h2>
  <p style="margin:0 0 24px;opacity:.8;">Напишите нам — ответим в течение дня.</p>
  <a href="mailto:hello@example.com" style="display:inline-block;background:${accent};color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;">hello@example.com</a>
</section>`,
    css: `body{margin:0}`,
  };
}

function cardHtml(palette, font) {
  const [accent, ink, soft, paper, muted] = palette.colors;
  return {
    html: `
<section style="font-family:${font.stack};min-height:100vh;display:grid;place-items:center;background:${soft};padding:32px;">
  <article style="background:${paper};max-width:420px;width:100%;border-radius:24px;padding:40px 32px;box-shadow:0 20px 60px rgba(0,0,0,.08);text-align:center;">
    <div style="width:72px;height:72px;border-radius:50%;background:${accent};margin:0 auto 20px;"></div>
    <h1 style="margin:0 0 8px;color:${ink};font-size:1.75rem;">Имя Фамилия</h1>
    <p style="margin:0 0 20px;color:${muted};">Дизайнер · Москва</p>
    <p style="margin:0 0 28px;color:${ink};line-height:1.5;">Делаю понятные интерфейсы и сайты для сервисов.</p>
    <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
      <a href="#" style="background:${accent};color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;">Связаться</a>
      <a href="#" style="border:1px solid ${ink};color:${ink};padding:10px 18px;border-radius:999px;text-decoration:none;">Портфолио</a>
    </div>
  </article>
</section>`,
    css: `body{margin:0}`,
  };
}

function salonHtml(palette, font) {
  const [accent, ink, soft, paper, muted] = palette.colors;
  return {
    html: `
<header style="font-family:${font.stack};display:flex;justify-content:space-between;align-items:center;padding:20px 28px;background:${paper};border-bottom:1px solid #eee;">
  <strong style="color:${ink};">Studio Glow</strong>
  <a href="#book" style="color:${accent};text-decoration:none;font-weight:600;">Запись</a>
</header>
<section style="font-family:${font.stack};background:linear-gradient(135deg,${soft},${paper});padding:80px 28px;">
  <h1 style="max-width:640px;font-size:clamp(2rem,5vw,3.2rem);color:${ink};margin:0 0 16px;">Красота без спешки</h1>
  <p style="max-width:480px;color:${muted};margin:0 0 28px;">Стрижки, окрашивание и уход. Онлайн-запись в два клика.</p>
  <a id="book" href="#" style="background:${accent};color:#fff;padding:14px 26px;border-radius:12px;text-decoration:none;font-weight:600;">Записаться</a>
</section>
<section style="font-family:${font.stack};padding:56px 28px;display:grid;gap:20px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));background:${paper};">
  <div style="padding:20px;border:1px solid #eee;border-radius:16px;"><h3 style="margin:0 0 8px;color:${ink};">Стрижка</h3><p style="margin:0;color:${muted};">от 2 500 ₽</p></div>
  <div style="padding:20px;border:1px solid #eee;border-radius:16px;"><h3 style="margin:0 0 8px;color:${ink};">Окрашивание</h3><p style="margin:0;color:${muted};">от 4 900 ₽</p></div>
  <div style="padding:20px;border:1px solid #eee;border-radius:16px;"><h3 style="margin:0 0 8px;color:${ink};">Уход</h3><p style="margin:0;color:${muted};">от 3 200 ₽</p></div>
</section>`,
    css: `body{margin:0}`,
  };
}

function shopHtml(palette, font) {
  const [accent, ink, soft, paper, muted] = palette.colors;
  return {
    html: `
<section style="font-family:${font.stack};padding:48px 24px;background:${soft};">
  <h1 style="margin:0 0 8px;color:${ink};">Магазин недели</h1>
  <p style="margin:0 0 32px;color:${muted};">Подборка товаров с доставкой.</p>
  <div style="display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));max-width:900px;">
    ${[1, 2, 3, 4]
      .map(
        (n) => `<article style="background:${paper};border-radius:16px;overflow:hidden;border:1px solid #eee;">
      <div style="height:140px;background:linear-gradient(120deg,${accent}55,${soft});"></div>
      <div style="padding:14px;"><h3 style="margin:0 0 6px;color:${ink};font-size:1rem;">Товар ${n}</h3>
      <p style="margin:0;color:${muted};">${990 + n * 100} ₽</p></div></article>`,
      )
      .join("")}
  </div>
</section>`,
    css: `body{margin:0}`,
  };
}

function blankHtml(palette, font) {
  const [, ink, soft, , muted] = palette.colors;
  return {
    html: `<section style="font-family:${font.stack};min-height:60vh;display:grid;place-items:center;background:${soft};color:${ink};padding:40px;text-align:center;">
  <div><h1 style="margin:0 0 12px;">Пустая страница</h1><p style="margin:0;color:${muted};">Добавьте блоки из панели слева.</p></div>
</section>`,
    css: `body{margin:0}`,
  };
}

export const ALL_TEMPLATES = [
  { id: "landing", name: "Лендинг", tier: "basic", build: landingHtml },
  { id: "card", name: "Визитка", tier: "basic", build: cardHtml },
  { id: "blank", name: "Пустой", tier: "basic", build: blankHtml },
  { id: "salon", name: "Салон", tier: "pro", build: salonHtml },
  { id: "shop", name: "Магазин", tier: "pro", build: shopHtml },
  {
    id: "portfolio",
    name: "Портфолио",
    tier: "pro",
    build: (palette, font) => {
      const [accent, ink, soft, paper, muted] = palette.colors;
      return {
        html: `<section style="font-family:${font.stack};padding:64px 28px;background:${paper};">
  <h1 style="margin:0 0 8px;color:${ink};">Работы</h1>
  <p style="margin:0 0 28px;color:${muted};">Избранные проекты</p>
  <div style="display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));">
    <div style="aspect-ratio:4/3;border-radius:16px;background:${soft};border:1px solid #eee;"></div>
    <div style="aspect-ratio:4/3;border-radius:16px;background:linear-gradient(135deg,${accent}33,${soft});border:1px solid #eee;"></div>
    <div style="aspect-ratio:4/3;border-radius:16px;background:${ink};opacity:.12;border:1px solid #eee;"></div>
  </div>
</section>`,
        css: `body{margin:0}`,
      };
    },
  },
  {
    id: "cafe",
    name: "Кафе",
    tier: "pro",
    build: (palette, font) => {
      const [accent, ink, soft, paper, muted] = palette.colors;
      return {
        html: `<section style="font-family:${font.stack};padding:72px 28px;background:${ink};color:#fff;text-align:center;">
  <p style="opacity:.7;letter-spacing:.2em;text-transform:uppercase;font-size:12px;">Кафе</p>
  <h1 style="margin:12px 0;font-size:clamp(2rem,6vw,3.4rem);">Утренний стол</h1>
  <p style="opacity:.8;max-width:420px;margin:0 auto 24px;">Кофе, выпечка и тихие утра в центре города.</p>
  <a href="#" style="background:${accent};color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;">Открыть меню</a>
</section>
<section style="font-family:${font.stack};padding:48px 28px;background:${soft};color:${ink};display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));">
  <div style="background:${paper};padding:20px;border-radius:14px;"><strong>Эспрессо</strong><p style="margin:8px 0 0;color:${muted};">180 ₽</p></div>
  <div style="background:${paper};padding:20px;border-radius:14px;"><strong>Капучино</strong><p style="margin:8px 0 0;color:${muted};">250 ₽</p></div>
  <div style="background:${paper};padding:20px;border-radius:14px;"><strong>Круассан</strong><p style="margin:8px 0 0;color:${muted};">220 ₽</p></div>
</section>`,
        css: `body{margin:0}`,
      };
    },
  },
];

export function templatesForTier(tier) {
  if (tier === "pro") return ALL_TEMPLATES;
  return ALL_TEMPLATES.filter((t) => t.tier === "basic");
}

export function palettesForTier(tier) {
  return tier === "pro" ? PRO_PALETTES : BASIC_PALETTES;
}

export function fontsForTier(tier) {
  return tier === "pro" ? PRO_FONTS : BASIC_FONTS;
}

export function buildTemplateDocument(templateId, paletteId, fontId, tier = "basic", colorsOverride = null) {
  const template = ALL_TEMPLATES.find((t) => t.id === templateId) || ALL_TEMPLATES[0];
  const basePalette =
    palettesForTier(tier).find((p) => p.id === paletteId) || palettesForTier(tier)[0];
  const font = fontsForTier(tier).find((f) => f.id === fontId) || fontsForTier(tier)[0];
  const palette = colorsOverride
    ? {
        id: "custom",
        name: "Своя",
        colors: [
          colorsOverride.accent,
          colorsOverride.ink,
          colorsOverride.soft,
          colorsOverride.paper,
          colorsOverride.muted,
        ],
      }
    : basePalette;
  const built = template.build(palette, font);
  return {
    html: built.html,
    css: built.css,
    pages: [
      {
        id: "home",
        name: "Главная",
        path: "/",
        html: built.html,
        css: built.css,
      },
    ],
    meta: {
      templateId: template.id,
      paletteId: colorsOverride ? "custom" : palette.id,
      fontId: font.id,
      colors: colorsOverride || {
        accent: palette.colors[0],
        ink: palette.colors[1],
        soft: palette.colors[2],
        paper: palette.colors[3],
        muted: palette.colors[4],
      },
    },
  };
}
