/**
 * Fabric.js card-slide scene helpers.
 * Logical canvas: 1080×1440 (WB/Ozon-friendly portrait).
 */

import { Canvas, Circle, FabricImage, FabricObject, IText, Line, Rect, Triangle } from "fabric";
import { DEFAULT_CARD_STYLE, LAYOUT_OPTIONS } from "./productCardTemplates.js";

// Persist custom roles across save/load (product photo slot, tokens, …)
FabricObject.customProperties = ["vmRole"];

export const SLIDE_W = 1080;
export const SLIDE_H = 1440;

export const FONT_OPTIONS = [
  { id: "Georgia, serif", label: "Georgia" },
  { id: '"Times New Roman", Times, serif', label: "Times" },
  { id: '"Segoe UI", Tahoma, sans-serif', label: "Segoe UI" },
  { id: "Arial, Helvetica, sans-serif", label: "Arial" },
  { id: '"Trebuchet MS", sans-serif', label: "Trebuchet" },
  { id: "Verdana, Geneva, sans-serif", label: "Verdana" },
  { id: '"Courier New", monospace', label: "Courier" },
  { id: "Impact, Charcoal, sans-serif", label: "Impact" },
];

export const TOOLS = [
  { id: "select", label: "Выбор", hotkey: "V", hint: "Перемещение и масштаб" },
  { id: "text", label: "Текст", hotkey: "T", hint: "Добавить текстовый слой" },
  { id: "rect", label: "Прямоугольник", hint: "Добавить прямоугольник" },
  { id: "circle", label: "Круг", hint: "Добавить круг" },
  { id: "triangle", label: "Треугольник", hint: "Добавить треугольник" },
  { id: "line", label: "Линия", hint: "Добавить линию" },
  { id: "draw", label: "Кисть", hotkey: "B", hint: "Свободное рисование" },
  { id: "erase", label: "Стереть", hotkey: "E", hint: "Клик по объекту удаляет его" },
];

export function hasCanvasScene(canvas) {
  return Boolean(canvas && typeof canvas === "object" && Array.isArray(canvas.objects) && canvas.objects.length);
}

export function emptyCanvasJson(bg = DEFAULT_CARD_STYLE.bg) {
  return {
    version: "6.0.0",
    objects: [],
    background: bg,
  };
}

function applyRole(obj, role) {
  if (!obj) return obj;
  obj.set("vmRole", role);
  return obj;
}

/** Build a starter Fabric scene from legacy layout + style. */
export function buildStarterCanvasJson(layout = "hero", style = DEFAULT_CARD_STYLE) {
  const s = { ...DEFAULT_CARD_STYLE, ...(style || {}) };
  const objects = [];

  objects.push({
    type: "Rect",
    version: "6.0.0",
    left: 0,
    top: 0,
    width: SLIDE_W,
    height: 56,
    fill: s.accent,
    strokeWidth: 0,
    selectable: true,
    vmRole: "brandBar",
  });
  objects.push({
    type: "IText",
    version: "6.0.0",
    left: 28,
    top: 14,
    text: String(s.brandBarText || "Моя витрина").slice(0, 40),
    fontSize: 22,
    fontFamily: '"Segoe UI", Tahoma, sans-serif',
    fontWeight: "600",
    fill: "#ffffff",
    vmRole: "brandText",
  });

  if (layout === "benefits") {
    objects.push({
      type: "Rect",
      version: "6.0.0",
      left: 48,
      top: 88,
      width: 520,
      height: 1260,
      rx: 28,
      ry: 28,
      fill: s.panel,
      strokeWidth: 0,
      vmRole: "panel",
    });
    objects.push({
      type: "Rect",
      version: "6.0.0",
      left: 68,
      top: 108,
      width: 480,
      height: 1220,
      fill: s.accentSoft,
      strokeWidth: 0,
      vmRole: "productPhoto",
    });
    objects.push({
      type: "Rect",
      version: "6.0.0",
      left: 596,
      top: 88,
      width: 436,
      height: 1260,
      rx: 28,
      ry: 28,
      fill: s.panel,
      strokeWidth: 0,
    });
    objects.push({
      type: "IText",
      version: "6.0.0",
      left: 632,
      top: 130,
      text: String(s.benefitsTitle || "Почему берут"),
      fontSize: 28,
      fontFamily: '"Segoe UI", Tahoma, sans-serif',
      fontWeight: "700",
      fill: s.accent,
    });
    objects.push({
      type: "IText",
      version: "6.0.0",
      left: 632,
      top: 180,
      text: "{{name}}",
      fontSize: 30,
      fontFamily: "Georgia, serif",
      fontWeight: "700",
      fill: s.ink,
      vmRole: "productName",
    });
    ["Качество", "Доставка", "Гарантия"].forEach((t, i) => {
      objects.push({
        type: "IText",
        version: "6.0.0",
        left: 632,
        top: 280 + i * 120,
        text: `${i + 1}. ${t}`,
        fontSize: 24,
        fontFamily: '"Segoe UI", Tahoma, sans-serif',
        fill: s.ink,
      });
    });
  } else if (layout === "specs") {
    objects.push({
      type: "Rect",
      version: "6.0.0",
      left: 48,
      top: 88,
      width: SLIDE_W - 96,
      height: 720,
      rx: 28,
      ry: 28,
      fill: s.panel,
      strokeWidth: 0,
    });
    objects.push({
      type: "Rect",
      version: "6.0.0",
      left: 72,
      top: 112,
      width: SLIDE_W - 144,
      height: 672,
      fill: s.accentSoft,
      strokeWidth: 0,
      vmRole: "productPhoto",
    });
    objects.push({
      type: "Rect",
      version: "6.0.0",
      left: 48,
      top: 840,
      width: SLIDE_W - 96,
      height: 520,
      rx: 28,
      ry: 28,
      fill: s.panel,
      strokeWidth: 0,
    });
    objects.push({
      type: "IText",
      version: "6.0.0",
      left: 88,
      top: 880,
      text: "{{name}}",
      fontSize: 34,
      fontFamily: "Georgia, serif",
      fontWeight: "700",
      fill: s.ink,
      vmRole: "productName",
    });
    objects.push({
      type: "IText",
      version: "6.0.0",
      left: 88,
      top: 940,
      text: "{{price}}",
      fontSize: 28,
      fontFamily: '"Segoe UI", Tahoma, sans-serif',
      fontWeight: "700",
      fill: s.badge,
      vmRole: "productPrice",
    });
  } else {
    objects.push({
      type: "Rect",
      version: "6.0.0",
      left: 48,
      top: 88,
      width: SLIDE_W - 96,
      height: 980,
      rx: 28,
      ry: 28,
      fill: s.panel,
      strokeWidth: 0,
    });
    objects.push({
      type: "Rect",
      version: "6.0.0",
      left: 72,
      top: 112,
      width: SLIDE_W - 144,
      height: 760,
      fill: s.accentSoft,
      strokeWidth: 0,
      vmRole: "productPhoto",
    });
    objects.push({
      type: "IText",
      version: "6.0.0",
      left: 88,
      top: 920,
      text: "{{name}}",
      fontSize: 42,
      fontFamily: "Georgia, serif",
      fontWeight: "700",
      fill: s.ink,
      vmRole: "productName",
    });
    objects.push({
      type: "IText",
      version: "6.0.0",
      left: 88,
      top: 990,
      text: "{{price}}",
      fontSize: 30,
      fontFamily: '"Segoe UI", Tahoma, sans-serif',
      fontWeight: "700",
      fill: "#ffffff",
      backgroundColor: s.badge,
      vmRole: "productPrice",
    });
    objects.push({
      type: "IText",
      version: "6.0.0",
      left: 88,
      top: 1050,
      text: "{{brand}}",
      fontSize: 22,
      fontFamily: '"Segoe UI", Tahoma, sans-serif',
      fill: s.muted,
      vmRole: "productBrand",
    });
  }

  return {
    version: "6.0.0",
    objects,
    background: s.bg,
  };
}

export function createEditorCanvas(el, { background } = {}) {
  const canvas = new Canvas(el, {
    width: SLIDE_W,
    height: SLIDE_H,
    backgroundColor: background || DEFAULT_CARD_STYLE.bg,
    preserveObjectStacking: true,
    selection: true,
    stopContextMenu: true,
  });
  return canvas;
}

export async function loadSceneOntoCanvas(canvas, json) {
  const data = hasCanvasScene(json) ? json : emptyCanvasJson();
  await canvas.loadFromJSON(data);
  canvas.requestRenderAll();
}

export function serializeCanvas(canvas) {
  return canvas.toJSON(["vmRole"]);
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

function formatPrice(product) {
  const price = product?.price != null && product?.price !== "" ? Number(product.price) : null;
  if (price != null && Number.isFinite(price)) return `${price.toLocaleString("ru-RU")} ₽`;
  return "";
}

async function replaceProductPhoto(canvas, url, slot) {
  if (!url || !slot) return;
  try {
    const img = await FabricImage.fromURL(url, { crossOrigin: "anonymous" });
    const bw = slot.getScaledWidth();
    const bh = slot.getScaledHeight();
    const scale = Math.max(bw / (img.width || 1), bh / (img.height || 1));
    img.set({
      left: slot.left,
      top: slot.top,
      originX: slot.originX || "left",
      originY: slot.originY || "top",
      scaleX: scale,
      scaleY: scale,
      angle: slot.angle || 0,
      selectable: false,
      evented: false,
      vmRole: "productPhoto",
    });
    // clip to slot size via clipPath
    const clip = new Rect({
      left: slot.left,
      top: slot.top,
      width: bw,
      height: bh,
      absolutePositioned: true,
      rx: slot.rx || 0,
      ry: slot.ry || 0,
    });
    img.clipPath = clip;
    canvas.remove(slot);
    canvas.add(img);
  } catch {
    /* keep placeholder */
  }
}

/**
 * Apply product data into a cloned scene and export PNG blob.
 */
export async function renderCanvasDesignToBlob({ canvasJson, product = {}, images = [] }) {
  const el = document.createElement("canvas");
  el.width = SLIDE_W;
  el.height = SLIDE_H;
  const canvas = new Canvas(el, {
    width: SLIDE_W,
    height: SLIDE_H,
    renderOnAddRemove: false,
  });
  try {
    const scene = hasCanvasScene(canvasJson) ? structuredClone(canvasJson) : emptyCanvasJson();
    await canvas.loadFromJSON(scene);

    const name = String(product.name || "Товар").trim() || "Товар";
    const brand = String(product.brand || "").trim();
    const priceLabel = formatPrice(product);
    const photoUrl = firstPhotoUrl(images);

    const objs = [...canvas.getObjects()];
    for (const obj of objs) {
      const role = obj.vmRole || obj.get?.("vmRole");
      if (obj.type === "i-text" || obj.type === "textbox" || obj.type === "text" || obj.isType?.("i-text")) {
        let text = String(obj.text || "");
        text = text.replaceAll("{{name}}", name).replaceAll("{{brand}}", brand).replaceAll("{{price}}", priceLabel || "—");
        if (role === "productName") text = name;
        if (role === "productBrand") text = brand || text;
        if (role === "productPrice") text = priceLabel || text;
        obj.set("text", text);
      }
      if (role === "productPhoto") {
        await replaceProductPhoto(canvas, photoUrl, obj);
      }
    }
    canvas.requestRenderAll();
    return await new Promise((resolve, reject) => {
      const lower = canvas.lowerCanvasEl || el;
      if (typeof canvas.toBlob === "function") {
        canvas.toBlob((blob) => {
          if (!blob) reject(new Error("Не удалось сохранить PNG."));
          else resolve(blob);
        }, "image/png");
        return;
      }
      lower.toBlob((blob) => {
        if (!blob) reject(new Error("Не удалось сохранить PNG."));
        else resolve(blob);
      }, "image/png");
    });
  } finally {
    canvas.dispose();
  }
}

export function addTextObject(canvas, { fill = "#1a242e", fontFamily } = {}) {
  const t = new IText("Текст", {
    left: SLIDE_W / 2 - 80,
    top: SLIDE_H / 2 - 20,
    fontSize: 36,
    fontFamily: fontFamily || FONT_OPTIONS[0].id,
    fill,
    editable: true,
  });
  canvas.add(t);
  canvas.setActiveObject(t);
  canvas.requestRenderAll();
  return t;
}

export function addShape(canvas, kind, { fill = "#0f6e56", stroke = "#1a242e" } = {}) {
  let obj;
  if (kind === "rect") {
    obj = new Rect({ left: 200, top: 400, width: 280, height: 180, fill, rx: 12, ry: 12, strokeWidth: 0 });
  } else if (kind === "circle") {
    obj = new Circle({ left: 300, top: 500, radius: 90, fill, strokeWidth: 0 });
  } else if (kind === "triangle") {
    obj = new Triangle({ left: 320, top: 520, width: 180, height: 160, fill, strokeWidth: 0 });
  } else if (kind === "line") {
    obj = new Line([200, 600, 700, 600], { stroke, strokeWidth: 6 });
  } else {
    return null;
  }
  canvas.add(obj);
  canvas.setActiveObject(obj);
  canvas.requestRenderAll();
  return obj;
}

export async function addProductPhotoSlot(canvas, imageUrl) {
  if (imageUrl) {
    try {
      const img = await FabricImage.fromURL(imageUrl, { crossOrigin: "anonymous" });
      const maxW = 900;
      const maxH = 900;
      const scale = Math.min(maxW / (img.width || 1), maxH / (img.height || 1), 1);
      img.set({
        left: (SLIDE_W - (img.width || 0) * scale) / 2,
        top: 160,
        scaleX: scale,
        scaleY: scale,
        vmRole: "productPhoto",
      });
      applyRole(img, "productPhoto");
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.requestRenderAll();
      return img;
    } catch {
      /* fall through */
    }
  }
  const slot = new Rect({
    left: 90,
    top: 160,
    width: 900,
    height: 900,
    fill: DEFAULT_CARD_STYLE.accentSoft,
    rx: 20,
    ry: 20,
    strokeWidth: 0,
    vmRole: "productPhoto",
  });
  applyRole(slot, "productPhoto");
  canvas.add(slot);
  canvas.setActiveObject(slot);
  canvas.requestRenderAll();
  return slot;
}

export { LAYOUT_OPTIONS };
