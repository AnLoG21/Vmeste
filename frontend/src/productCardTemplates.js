/**
 * User-owned marketplace card slide designs → PNG compositor.
 * Design = { id?, name, layout: hero|benefits|specs, style: {...} }
 */

export const LAYOUT_OPTIONS = [
  { id: "hero", label: "Главный кадр", hint: "Фото + название + цена" },
  { id: "benefits", label: "Преимущества", hint: "Фото + 3 пункта" },
  { id: "specs", label: "Характеристики", hint: "Фото + поля карточки" },
];

export const DEFAULT_CARD_STYLE = {
  bg: "#f6f3ee",
  panel: "#ffffff",
  ink: "#1a242e",
  muted: "#5c6b78",
  accent: "#0f6e56",
  accentSoft: "#d8efe6",
  line: "#e2ddd4",
  badge: "#c45c26",
  brandBarText: "Моя витрина",
  benefitsTitle: "Почему берут",
  showPrice: true,
  showBrand: true,
  logoUrl: "",
};

/** @deprecated presets — use user card-designs from API */
export const PRODUCT_CARD_TEMPLATES = LAYOUT_OPTIONS.map((l) => ({
  id: l.id,
  label: l.label,
  hint: l.hint,
}));

export function emptyCardDesignForm() {
  return {
    id: null,
    name: "Новый шаблон",
    layout: "hero",
    style: { ...DEFAULT_CARD_STYLE },
  };
}

export function normalizeDesign(raw) {
  const d = raw && typeof raw === "object" ? raw : {};
  const style = { ...DEFAULT_CARD_STYLE, ...(d.style && typeof d.style === "object" ? d.style : {}) };
  const layout = ["hero", "benefits", "specs"].includes(d.layout) ? d.layout : "hero";
  return {
    id: d.id ?? null,
    name: String(d.name || "Шаблон").slice(0, 180),
    layout,
    style: {
      ...style,
      showPrice: Boolean(style.showPrice !== false),
      showBrand: Boolean(style.showBrand !== false),
      brandBarText: String(style.brandBarText || DEFAULT_CARD_STYLE.brandBarText).slice(0, 80),
      benefitsTitle: String(style.benefitsTitle || DEFAULT_CARD_STYLE.benefitsTitle).slice(0, 80),
      logoUrl: String(style.logoUrl || "").slice(0, 500),
    },
  };
}

function loadImage(url) {
  return new Promise((resolve) => {
    if (!url) {
      resolve(null);
      return;
    }
    const img = new Image();
    const local = url.startsWith("blob:") || url.startsWith("data:");
    if (!local) {
      try {
        const abs = new URL(url, window.location.href);
        if (abs.origin !== window.location.origin) img.crossOrigin = "anonymous";
      } catch {
        img.crossOrigin = "anonymous";
      }
    }
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function firstPhotoUrl(images) {
  for (const item of images || []) {
    if (typeof item === "string") {
      if (item && !/\.webm($|\?)/i.test(item)) return item;
      continue;
    }
    if (item?.kind === "video") continue;
    const u = item?.previewUrl || item?.url || item?.public_url || "";
    if (u && !/\.webm($|\?)/i.test(u)) return u;
  }
  return "";
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return [""];
  const lines = [];
  let line = words[0];
  for (let i = 1; i < words.length; i += 1) {
    const test = `${line} ${words[i]}`;
    if (ctx.measureText(test).width <= maxWidth) line = test;
    else {
      lines.push(line);
      line = words[i];
    }
  }
  lines.push(line);
  return lines;
}

function drawCover(ctx, img, x, y, w, h, style) {
  if (!img) {
    ctx.fillStyle = style.accentSoft;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = style.muted;
    ctx.font = "500 28px Segoe UI, Arial, sans-serif";
    ctx.fillText("Нет фото", x + w / 2 - 60, y + h / 2);
    return;
  }
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function pickBenefits(product, featuresText = "") {
  const fromFeatures = String(featuresText || "")
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromFeatures.length) return fromFeatures.slice(0, 3);
  const desc = String(product?.description || "")
    .split(/\n+/)
    .map((s) => s.replace(/^[-•*]\s*/, "").trim())
    .filter((s) => s.length > 2);
  if (desc.length) return desc.slice(0, 3);
  const fallback = [];
  if (product?.brand) fallback.push(`Бренд ${product.brand}`);
  if (product?.price) fallback.push(`Цена ${Number(product.price).toLocaleString("ru-RU")} ₽`);
  if (product?.barcode) fallback.push("Оригинал · с штрихкодом");
  while (fallback.length < 3) {
    fallback.push(["Качество проверено", "Быстрая отправка", "Поддержка продавца"][fallback.length]);
  }
  return fallback.slice(0, 3);
}

function pickSpecs(product) {
  const rows = [];
  if (product?.brand) rows.push(["Бренд", product.brand]);
  if (product?.offer_id) rows.push(["Артикул", product.offer_id]);
  if (product?.price) rows.push(["Цена", `${Number(product.price).toLocaleString("ru-RU")} ₽`]);
  if (product?.stock != null && product.stock !== "") rows.push(["Остаток", String(product.stock)]);
  const chars = product?.characteristics || {};
  for (const [k, v] of Object.entries(chars)) {
    if (rows.length >= 6) break;
    const val = Array.isArray(v) ? v.join(", ") : String(v || "").trim();
    if (!val) continue;
    const label = String(k).length > 24 ? `${String(k).slice(0, 22)}…` : String(k);
    rows.push([label, val.length > 40 ? `${val.slice(0, 38)}…` : val]);
  }
  if (!rows.length) rows.push(["Товар", product?.name || "Карточка"]);
  return rows.slice(0, 6);
}

async function drawChrome(ctx, w, h, style, subtitle) {
  const font = '"Segoe UI", "PT Sans", Arial, sans-serif';
  ctx.fillStyle = style.bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = style.accent;
  ctx.fillRect(0, 0, w, 56);
  let textX = 36;
  if (style.logoUrl) {
    const logo = await loadImage(style.logoUrl);
    if (logo) {
      const lh = 36;
      const lw = Math.min(120, (logo.width / logo.height) * lh);
      ctx.drawImage(logo, 28, 10, lw, lh);
      textX = 28 + lw + 16;
    }
  }
  ctx.fillStyle = "#fff";
  ctx.font = `600 22px ${font}`;
  ctx.fillText(String(style.brandBarText || "Витрина").slice(0, 40), textX, 36);
  ctx.font = `500 18px ${font}`;
  const sub = String(subtitle || "").slice(0, 28);
  ctx.fillText(sub, w - 36 - ctx.measureText(sub).width, 36);
}

/**
 * Render PNG from a user design (or legacy templateId).
 * @returns {Promise<Blob>}
 */
export async function renderProductCardSlide({
  design = null,
  templateId = "hero",
  product = {},
  images = [],
  featuresText = "",
} = {}) {
  const normalized = normalizeDesign(
    design || {
      name: LAYOUT_OPTIONS.find((l) => l.id === templateId)?.label || "Шаблон",
      layout: templateId,
      style: DEFAULT_CARD_STYLE,
    },
  );
  const style = normalized.style;
  const layout = normalized.layout;
  const font = '"Segoe UI", "PT Sans", Arial, sans-serif';
  const display = '"Georgia", "Times New Roman", serif';

  const w = 1080;
  const h = 1440;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Нет canvas.");

  const photoUrl = firstPhotoUrl(images);
  const img = await loadImage(photoUrl);
  const name = String(product.name || "Товар").trim() || "Товар";
  const price = product.price != null && product.price !== "" ? Number(product.price) : null;
  const priceLabel = price != null && Number.isFinite(price) ? `${price.toLocaleString("ru-RU")} ₽` : "";

  await drawChrome(ctx, w, h, style, normalized.name);

  if (layout === "hero") {
    const frame = { x: 48, y: 88, w: w - 96, h: 980 };
    roundRect(ctx, frame.x, frame.y, frame.w, frame.h, 28);
    ctx.fillStyle = style.panel;
    ctx.fill();
    roundRect(ctx, frame.x + 24, frame.y + 24, frame.w - 48, frame.h - 220, 20);
    ctx.fillStyle = style.panel;
    ctx.fill();
    drawCover(ctx, img, frame.x + 24, frame.y + 24, frame.w - 48, frame.h - 220, style);

    ctx.fillStyle = style.ink;
    ctx.font = `700 44px ${display}`;
    const lines = wrapText(ctx, name, frame.w - 80).slice(0, 2);
    let ty = frame.y + frame.h - 150;
    for (const line of lines) {
      ctx.fillText(line, frame.x + 40, ty);
      ty += 52;
    }
    if (style.showPrice && priceLabel) {
      ctx.fillStyle = style.badge;
      roundRect(ctx, frame.x + 40, ty + 8, Math.max(160, ctx.measureText(priceLabel).width + 48), 56, 14);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `700 28px ${font}`;
      ctx.fillText(priceLabel, frame.x + 64, ty + 46);
    }
    if (style.showBrand && product.brand) {
      ctx.fillStyle = style.muted;
      ctx.font = `500 22px ${font}`;
      ctx.fillText(String(product.brand), frame.x + 40, frame.y + frame.h - 28);
    }
  } else if (layout === "benefits") {
    const left = { x: 48, y: 88, w: 520, h: 1260 };
    const right = { x: 596, y: 88, w: 436, h: 1260 };
    roundRect(ctx, left.x, left.y, left.w, left.h, 28);
    ctx.fillStyle = style.panel;
    ctx.fill();
    drawCover(ctx, img, left.x + 20, left.y + 20, left.w - 40, left.h - 40, style);

    roundRect(ctx, right.x, right.y, right.w, right.h, 28);
    ctx.fillStyle = style.panel;
    ctx.fill();
    ctx.fillStyle = style.accent;
    ctx.font = `700 28px ${font}`;
    ctx.fillText(String(style.benefitsTitle || "Почему берут").slice(0, 24), right.x + 36, right.y + 64);
    ctx.fillStyle = style.ink;
    ctx.font = `600 26px ${display}`;
    const titleLines = wrapText(ctx, name, right.w - 72).slice(0, 3);
    let y = right.y + 120;
    for (const line of titleLines) {
      ctx.fillText(line, right.x + 36, y);
      y += 36;
    }
    const benefits = pickBenefits(product, featuresText);
    y += 24;
    benefits.forEach((b, i) => {
      roundRect(ctx, right.x + 28, y, right.w - 56, 120, 18);
      ctx.fillStyle = style.accentSoft;
      ctx.fill();
      ctx.fillStyle = style.accent;
      ctx.beginPath();
      ctx.arc(right.x + 64, y + 60, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `700 22px ${font}`;
      ctx.fillText(String(i + 1), right.x + 58, y + 68);
      ctx.fillStyle = style.ink;
      ctx.font = `500 22px ${font}`;
      const blines = wrapText(ctx, b, right.w - 140).slice(0, 3);
      let by = y + 42;
      for (const bl of blines) {
        ctx.fillText(bl, right.x + 100, by);
        by += 28;
      }
      y += 140;
    });
  } else {
    const top = { x: 48, y: 88, w: w - 96, h: 720 };
    roundRect(ctx, top.x, top.y, top.w, top.h, 28);
    ctx.fillStyle = style.panel;
    ctx.fill();
    drawCover(ctx, img, top.x + 24, top.y + 24, top.w - 48, top.h - 48, style);

    const bottom = { x: 48, y: 840, w: w - 96, h: 520 };
    roundRect(ctx, bottom.x, bottom.y, bottom.w, bottom.h, 28);
    ctx.fillStyle = style.panel;
    ctx.fill();
    ctx.fillStyle = style.ink;
    ctx.font = `700 34px ${display}`;
    const tlines = wrapText(ctx, name, bottom.w - 80).slice(0, 2);
    let y = bottom.y + 56;
    for (const line of tlines) {
      ctx.fillText(line, bottom.x + 40, y);
      y += 42;
    }
    if (style.showPrice && priceLabel) {
      ctx.fillStyle = style.badge;
      ctx.font = `700 26px ${font}`;
      const bw = ctx.measureText(priceLabel).width + 40;
      roundRect(ctx, bottom.x + 40, y + 8, bw, 48, 12);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillText(priceLabel, bottom.x + 60, y + 40);
      y += 72;
    } else y += 24;

    const specs = pickSpecs(product);
    for (const [k, v] of specs) {
      ctx.fillStyle = style.line;
      ctx.fillRect(bottom.x + 40, y, bottom.w - 80, 1);
      y += 28;
      ctx.fillStyle = style.muted;
      ctx.font = `500 20px ${font}`;
      ctx.fillText(k, bottom.x + 40, y);
      ctx.fillStyle = style.ink;
      ctx.font = `600 20px ${font}`;
      const vw = ctx.measureText(v).width;
      ctx.fillText(v, bottom.x + bottom.w - 40 - vw, y);
      y += 28;
      if (y > bottom.y + bottom.h - 36) break;
    }
  }

  ctx.fillStyle = style.muted;
  ctx.font = `400 16px ${font}`;
  ctx.fillText(`${normalized.name} · ${layout}`, 48, h - 24);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("Не удалось сохранить PNG."));
      else resolve(blob);
    }, "image/png");
  });
}
