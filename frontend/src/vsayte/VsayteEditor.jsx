import { useEffect, useRef, useState } from "react";
import grapesjs from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";
import webpagePlugin from "grapesjs-preset-webpage";
import {
  buildTemplateDocument,
  fontsForTier,
  palettesForTier,
  templatesForTier,
} from "./vsayteTemplates.js";
import { VSAYTE_GJS_RU } from "./vsayteI18n.js";
import { registerVsayteBlocks } from "./vsayteBlocks.js";
import {
  ALIGN_ACTIONS,
  LOOK_PRESETS,
  QUICK_ELEMENTS,
  SHAPE_PRESETS,
  SIZE_PRESETS,
  registerVsayteComponents,
} from "./vsayteComponents.js";
import {
  VSAYTE_INTERACTIVE_CSS,
  defaultSiteSettings,
  ensureInteractiveCss,
} from "./vsayteSiteCss.js";
import { sectionsByGroup } from "./vsayteSections.js";

const HOVER_PRESETS = [
  { id: "lift", label: "Подъём" },
  { id: "glow", label: "Свечение" },
  { id: "darken", label: "Темнее" },
  { id: "brighten", label: "Ярче" },
  { id: "press", label: "Нажатие" },
  { id: "none", label: "Нет" },
];

const COLOR_ROLES = [
  { key: "accent", label: "Акцент", hint: "Кнопки и акценты" },
  { key: "ink", label: "Текст", hint: "Основной цвет текста" },
  { key: "soft", label: "Фон", hint: "Фон страницы" },
  { key: "paper", label: "Карточки", hint: "Светлые поверхности" },
  { key: "muted", label: "Приглушённый", hint: "Подписи и второстепенный текст" },
];

function paletteToColors(palette) {
  const [accent, ink, soft, paper, muted] = palette.colors;
  return { accent, ink, soft, paper, muted };
}

function colorsToCssVars(colors) {
  return (
    `:root{` +
    `--vs-accent:${colors.accent};` +
    `--vs-ink:${colors.ink};` +
    `--vs-soft:${colors.soft};` +
    `--vs-paper:${colors.paper};` +
    `--vs-muted:${colors.muted};` +
    `}`
  );
}

function injectCssVars(css, colors) {
  const vars = colorsToCssVars(colors);
  const body = css || "";
  return /:root\{[^}]*--vs-accent/.test(body)
    ? body.replace(/:root\{[^}]*\}/, vars)
    : `${vars}\n${body}`;
}

function blankPage(name = "Новая страница", path = "/page") {
  return {
    id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    path,
    seoTitle: name,
    seoDescription: "",
    html: `<section style="padding:48px 24px;"><h1 style="margin:0 0 12px;">${name}</h1><p style="margin:0;color:#64748b;">Добавьте блоки слева или из панели «Блоки».</p></section>`,
    css: "body{margin:0}",
  };
}

function normalizePages(doc) {
  if (Array.isArray(doc?.pages) && doc.pages.length) {
    return doc.pages.map((p, i) => ({
      id: p.id || `page-${i}`,
      name: p.name || (i === 0 ? "Главная" : `Страница ${i + 1}`),
      path: p.path || (i === 0 ? "/" : `/page-${i + 1}`),
      seoTitle: p.seoTitle || p.name || (i === 0 ? "Главная" : `Страница ${i + 1}`),
      seoDescription: p.seoDescription || "",
      html: p.html || "",
      css: p.css || "",
    }));
  }
  return [
    {
      id: "home",
      name: "Главная",
      path: "/",
      seoTitle: doc?.meta?.seoTitle || "Главная",
      seoDescription: doc?.meta?.seoDescription || "",
      html: doc?.html || "",
      css: doc?.css || "",
    },
  ];
}

const ANIM_PRESETS = [
  { id: "none", label: "Без", style: { animation: "none", opacity: "1", transform: "none" } },
  { id: "fade", label: "Появление", style: { animation: "vs-fade-in .7s ease both" } },
  { id: "up", label: "Снизу", style: { animation: "vs-rise-in .7s ease both" } },
  { id: "scale", label: "Масштаб", style: { animation: "vs-scale-in .55s ease both" } },
];

const ANIM_KEYFRAMES = `
@keyframes vs-fade-in{from{opacity:0}to{opacity:1}}
@keyframes vs-rise-in{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
@keyframes vs-scale-in{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}
`;

function documentFromEditor(editor, pages, activePageId, meta = {}) {
  const html = editor.getHtml() || "";
  const css = ensureInteractiveCss(editor.getCss() || "");
  const nextPages = pages.map((p) =>
    p.id === activePageId ? { ...p, html, css } : p,
  );
  const home = nextPages.find((p) => p.path === "/") || nextPages[0];
  return {
    html: home?.html || html,
    css: home?.css || css,
    pages: nextPages,
    projectData: editor.getProjectData(),
    meta,
  };
}

function pathFromName(name, existing) {
  const base = String(name || "page")
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "page";
  let path = `/${base}`;
  let n = 2;
  const taken = new Set((existing || []).map((p) => p.path));
  while (taken.has(path)) {
    path = `/${base}-${n}`;
    n += 1;
  }
  return path;
}

function applyColorsToCanvas(editor, colors, previous) {
  // Replace previous palette hex values in CSS + inline styles of components
  let css = editor.getCss() || "";
  if (previous) {
    for (const key of Object.keys(colors)) {
      const from = (previous[key] || "").toLowerCase();
      const to = colors[key];
      if (from && to && from !== to.toLowerCase()) {
        const re = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
        css = css.replace(re, to);
      }
    }
  }
  css = injectCssVars(css, colors);
  editor.setStyle(css);

  const wrap = editor.getWrapper();
  if (!wrap) return;
  wrap.find("*").forEach((cmp) => {
    const style = cmp.getStyle() || {};
    let changed = false;
    const next = { ...style };
    for (const prop of ["color", "background-color", "background", "border-color"]) {
      const val = String(style[prop] || "").toLowerCase();
      if (!val || !previous) continue;
      for (const key of Object.keys(colors)) {
        const from = (previous[key] || "").toLowerCase();
        if (from && val.includes(from)) {
          next[prop] = String(style[prop]).replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), colors[key]);
          changed = true;
        }
      }
    }
    if (changed) cmp.setStyle(next);
  });
}

export default function VsayteEditor({
  initialDocument,
  editorTier = "basic",
  maxPages = 2,
  onChange,
  onReady,
  onUploadFile,
}) {
  const hostRef = useRef(null);
  const editorRef = useRef(null);
  const colorsRef = useRef(null);
  const pagesRef = useRef([]);
  const activePageIdRef = useRef("home");
  const libraryRef = useRef(initialDocument?.meta?.assets || []);
  const [library, setLibrary] = useState(() => initialDocument?.meta?.assets || []);
  const [pages, setPages] = useState(() => normalizePages(initialDocument));
  const [activePageId, setActivePageId] = useState(() => normalizePages(initialDocument)[0].id);

  const initialPalette = palettesForTier(editorTier).find((p) => p.id === initialDocument?.meta?.paletteId)
    || palettesForTier(editorTier)[0];
  const [paletteId, setPaletteId] = useState(initialPalette.id);
  const [colors, setColors] = useState(() => {
    if (initialDocument?.meta?.colors) return { ...initialDocument.meta.colors };
    return paletteToColors(initialPalette);
  });
  const [fontId, setFontId] = useState(
    initialDocument?.meta?.fontId || fontsForTier(editorTier)[0].id,
  );
  const [sideTab, setSideTab] = useState("elements"); // elements | design | pages | help
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState({ html: "", css: "", name: "" });
  const [hasSelection, setHasSelection] = useState(false);
  const [selectionLabel, setSelectionLabel] = useState("");
  const [device, setDevice] = useState("desktop");
  const [siteSettings, setSiteSettings] = useState(() =>
    defaultSiteSettings(initialDocument?.meta, initialDocument?.meta?.siteName || ""),
  );
  const siteSettingsRef = useRef(siteSettings);

  colorsRef.current = colors;
  pagesRef.current = pages;
  activePageIdRef.current = activePageId;
  libraryRef.current = library;
  siteSettingsRef.current = siteSettings;

  useEffect(() => {
    if (!hostRef.current || editorRef.current) return undefined;

    /** @type {import("grapesjs").Editor | null} */
    let editor = null;
    editor = grapesjs.init({
      container: hostRef.current,
      height: "100%",
      width: "auto",
      fromElement: false,
      storageManager: false,
      noticeOnUnload: false,
      showOffsets: true,
      showOffsetsSelected: true,
      i18n: {
        locale: "ru",
        detectLocale: false,
        messages: { ru: VSAYTE_GJS_RU },
      },
      plugins: [webpagePlugin],
      pluginsOpts: {
        "gjs-preset-webpage": {
          modalImportTitle: "Импорт HTML/CSS",
          modalImportButton: "Импортировать",
          modalImportLabel: "Вставьте HTML и CSS — они появятся на холсте.",
          textCleanCanvas: "Очистить холст? Все блоки будут удалены.",
          blocks: ["link-block", "quote", "text-basic"],
        },
      },
      canvas: {
        styles: [
          "https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&family=Roboto:wght@400;700&family=PT+Serif:wght@400;700&family=Playfair+Display:wght@500;700&family=Montserrat:wght@400;700&family=Raleway:wght@400;700&family=Oswald:wght@400;600&family=Source+Serif+4:wght@400;700&family=Nunito:wght@400;700&family=IBM+Plex+Sans:wght@400;600&display=swap",
        ],
      },
      deviceManager: {
        devices: [
          { id: "desktop", name: "Компьютер", width: "" },
          { id: "tablet", name: "Планшет", width: "768px", widthMedia: "992px" },
          { id: "mobile", name: "Телефон", width: "390px", widthMedia: "480px" },
        ],
      },
      styleManager: {
        sectors: [
          {
            name: "Размеры",
            open: true,
            buildProps: ["width", "height", "max-width", "min-width", "min-height", "margin", "padding"],
          },
          {
            name: "Типографика",
            open: false,
            buildProps: [
              "font-family",
              "font-size",
              "font-weight",
              "letter-spacing",
              "color",
              "line-height",
              "text-align",
              "text-decoration",
            ],
            properties: [{ property: "color", type: "color", defaults: "black" }],
          },
          {
            name: "Форма и рамка",
            open: true,
            buildProps: [
              "border-radius",
              "border-width",
              "border-style",
              "border-color",
              "border",
            ],
            properties: [
              {
                property: "border-radius",
                type: "slider",
                defaults: "0",
                units: ["px", "%"],
                min: 0,
                max: 100,
                step: 1,
              },
              {
                property: "border-width",
                type: "slider",
                defaults: "0",
                units: ["px"],
                min: 0,
                max: 20,
              },
              {
                property: "border-style",
                type: "select",
                defaults: "none",
                options: [
                  { id: "none", label: "Нет" },
                  { id: "solid", label: "Сплошная" },
                  { id: "dashed", label: "Пунктир" },
                  { id: "dotted", label: "Точки" },
                ],
              },
              { property: "border-color", type: "color" },
            ],
          },
          {
            name: "Оформление",
            open: true,
            buildProps: ["background-color", "background", "box-shadow", "opacity", "cursor"],
            properties: [
              { property: "background-color", type: "color" },
              { property: "background", type: "file" },
              {
                property: "cursor",
                type: "select",
                defaults: "auto",
                options: [
                  { id: "auto", label: "Авто" },
                  { id: "pointer", label: "Указатель" },
                  { id: "default", label: "Обычный" },
                  { id: "text", label: "Текст" },
                ],
              },
            ],
          },
          {
            name: "Макет",
            open: false,
            buildProps: [
              "display",
              "flex-direction",
              "justify-content",
              "align-items",
              "flex-wrap",
              "gap",
            ],
            properties: [
              {
                property: "gap",
                type: "slider",
                defaults: "0",
                units: ["px", "rem"],
                min: 0,
                max: 64,
              },
            ],
          },
        ],
      },
      assetManager: {
        embedAsBase64: false,
        multiUpload: true,
        autoAdd: 1,
        uploadName: "file",
        uploadFile: async (ev) => {
          const files = ev?.dataTransfer?.files || ev?.target?.files;
          if (!files?.length) return;
          const added = [];
          for (const file of Array.from(files)) {
            let asset = null;
            if (onUploadFile) {
              asset = await onUploadFile(file);
            } else {
              asset = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve({ src: reader.result, name: file.name });
                reader.onerror = reject;
                reader.readAsDataURL(file);
              });
            }
            if (asset?.src) added.push({ src: asset.src, name: asset.name, type: "image" });
          }
          if (added.length && editor) {
            editor.AssetManager.add(added);
            setLibrary((prev) => [...added, ...prev].slice(0, 40));
          }
        },
      },
    });

    editorRef.current = editor;
    registerVsayteComponents(editor);
    registerVsayteBlocks(editor);
    try {
      editor.Canvas.getDocument()?.head?.insertAdjacentHTML(
        "beforeend",
        `<style data-vsayte-interactive>${VSAYTE_INTERACTIVE_CSS}</style>`,
      );
    } catch {
      /* canvas may not be ready yet */
    }
    editor.on("canvas:frame:load", () => {
      const doc = editor.Canvas.getDocument();
      if (!doc?.head) return;
      if (!doc.getElementById("vsayte-interactive") && !doc.querySelector("[data-vsayte-interactive]")) {
        const style = doc.createElement("style");
        style.setAttribute("data-vsayte-interactive", "1");
        style.id = "vsayte-interactive";
        style.textContent = VSAYTE_INTERACTIVE_CSS;
        doc.head.appendChild(style);
      }
      let custom = doc.getElementById("vsayte-custom-css");
      if (!custom) {
        custom = doc.createElement("style");
        custom.id = "vsayte-custom-css";
        doc.head.appendChild(custom);
      }
      custom.textContent = siteSettingsRef.current?.customCss || "";
    });

    // Уже сохранённые ассеты документа
    const savedAssets = initialDocument?.meta?.assets || [];
    if (savedAssets.length) {
      editor.AssetManager.add(savedAssets.map((a) => ({ src: a.src, name: a.name, type: "image" })));
    }

    // Перевод кнопок панелей, которые preset оставляет на английском
    const panelBtns = [
      ["preview", "Предпросмотр"],
      ["fullscreen", "На весь экран"],
      ["sw-visibility", "Границы блоков"],
      ["export-template", "Код"],
      ["open-sm", "Стили"],
      ["open-tm", "Настройки"],
      ["open-layers", "Слои"],
      ["open-blocks", "Блоки"],
      ["gjs-open-import-webpage", "Импорт"],
      ["undo", "Отменить"],
      ["redo", "Повторить"],
      ["canvas-clear", "Очистить"],
    ];
    panelBtns.forEach(([id, title]) => {
      const btn = editor.Panels.getButton("options", id)
        || editor.Panels.getButton("views", id)
        || editor.Panels.getButton("devices-c", id);
      if (btn) btn.set("attributes", { ...(btn.get("attributes") || {}), title });
    });

    const startPages = normalizePages(initialDocument);
    const start = startPages[0];
    if (initialDocument?.projectData && startPages.length <= 1) {
      editor.loadProjectData(initialDocument.projectData);
    } else if (start?.html) {
      editor.setComponents(start.html);
      editor.setStyle(injectCssVars(start.css, colorsRef.current));
    } else {
      const built = buildTemplateDocument("landing", paletteId, fontId, editorTier);
      editor.setComponents(built.html);
      editor.setStyle(injectCssVars(built.css, colorsRef.current));
    }

    const emit = () =>
      onChange?.(
        documentFromEditor(editor, pagesRef.current, activePageIdRef.current, {
          paletteId,
          fontId,
          colors: colorsRef.current,
          assets: libraryRef.current,
        }),
      );
    editor.on("update", emit);
    const syncSelection = () => {
      const sel = editor.getSelected();
      setHasSelection(Boolean(sel));
      if (!sel) {
        setSelectionLabel("");
        return;
      }
      const tag = (sel.get("tagName") || sel.get("type") || "элемент").toString();
      const text = (sel.get("btnLabel") || sel.view?.el?.textContent || "").trim().slice(0, 28);
      setSelectionLabel(text ? `${tag}: ${text}` : tag);
    };
    editor.on("component:selected", syncSelection);
    editor.on("component:deselected", syncSelection);

    const onKey = (ev) => {
      const t = ev.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const sel = editor.getSelected();
      if (!sel) return;
      if (ev.key === "Delete" || ev.key === "Backspace") {
        ev.preventDefault();
        sel.remove();
        emit();
      } else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "d") {
        ev.preventDefault();
        const cloned = sel.clone();
        const parent = sel.parent();
        if (parent) parent.append(cloned);
        else editor.addComponents(cloned);
        editor.select(cloned);
        emit();
      }
    };
    window.addEventListener("keydown", onKey);

    onReady?.(editor);
    emit();

    return () => {
      window.removeEventListener("keydown", onKey);
      editor.destroy();
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function meta() {
    return {
      paletteId,
      fontId,
      colors,
      assets: libraryRef.current,
      site: siteSettingsRef.current,
    };
  }

  function patchSiteSettings(patch) {
    const next = { ...siteSettingsRef.current, ...patch };
    setSiteSettings(next);
    siteSettingsRef.current = next;
    if (Object.prototype.hasOwnProperty.call(patch, "customCss")) {
      syncCustomCssToCanvas();
    }
    const editor = editorRef.current;
    if (editor) emitDoc(editor);
  }

  function emitDoc(editor, nextPages = pages, nextActive = activePageId) {
    if (!editor) return;
    onChange?.(documentFromEditor(editor, nextPages, nextActive, meta()));
  }

  function snapshotActivePage(editor = editorRef.current) {
    if (!editor) return pages;
    const html = editor.getHtml() || "";
    const css = editor.getCss() || "";
    return pages.map((p) => (p.id === activePageId ? { ...p, html, css } : p));
  }

  function loadPageIntoEditor(page) {
    const editor = editorRef.current;
    if (!editor || !page) return;
    editor.setComponents(page.html || "");
    editor.setStyle(injectCssVars(page.css || "", colors));
  }

  function switchPage(pageId) {
    if (pageId === activePageId) return;
    const editor = editorRef.current;
    const snapped = snapshotActivePage(editor);
    const target = snapped.find((p) => p.id === pageId);
    if (!target) return;
    setPages(snapped);
    setActivePageId(pageId);
    pagesRef.current = snapped;
    activePageIdRef.current = pageId;
    loadPageIntoEditor(target);
    emitDoc(editor, snapped, pageId);
  }

  function addPage() {
    if (pages.length >= maxPages) {
      window.alert(`Лимит страниц на тарифе: ${maxPages}.`);
      return;
    }
    const editor = editorRef.current;
    const snapped = snapshotActivePage(editor);
    const name = `Страница ${snapped.length + 1}`;
    const page = blankPage(name, pathFromName(name, snapped));
    const next = [...snapped, page];
    setPages(next);
    setActivePageId(page.id);
    pagesRef.current = next;
    activePageIdRef.current = page.id;
    loadPageIntoEditor(page);
    emitDoc(editor, next, page.id);
    setSideTab("pages");
  }

  function renamePage(pageId, name, { syncPath = false } = {}) {
    const editor = editorRef.current;
    const snapped = snapshotActivePage(editor);
    const next = snapped.map((p) => {
      if (p.id !== pageId) return p;
      const trimmed = name.trim() || p.name;
      if (!syncPath || p.path === "/") return { ...p, name: trimmed };
      return {
        ...p,
        name: trimmed,
        path: pathFromName(trimmed, snapped.filter((x) => x.id !== pageId)),
      };
    });
    setPages(next);
    pagesRef.current = next;
    emitDoc(editor, next, activePageId);
  }

  function deletePage(pageId) {
    if (pages.length <= 1) {
      window.alert("Нельзя удалить единственную страницу.");
      return;
    }
    if (!window.confirm("Удалить эту страницу?")) return;
    const editor = editorRef.current;
    const snapped = snapshotActivePage(editor);
    const next = snapped.filter((p) => p.id !== pageId);
    const nextActive = activePageId === pageId ? next[0].id : activePageId;
    setPages(next);
    setActivePageId(nextActive);
    pagesRef.current = next;
    activePageIdRef.current = nextActive;
    if (activePageId === pageId) loadPageIntoEditor(next[0]);
    emitDoc(editor, next, nextActive);
  }

  function updatePageMeta(pageId, patch) {
    const editor = editorRef.current;
    const snapped = snapshotActivePage(editor);
    const next = snapped.map((p) => (p.id === pageId ? { ...p, ...patch } : p));
    setPages(next);
    pagesRef.current = next;
    emitDoc(editor, next, activePageId);
  }

  function duplicatePage(pageId) {
    if (pages.length >= maxPages) {
      window.alert(`Лимит страниц на тарифе: ${maxPages}.`);
      return;
    }
    const editor = editorRef.current;
    const snapped = snapshotActivePage(editor);
    const src = snapped.find((p) => p.id === pageId);
    if (!src) return;
    const name = `${src.name} копия`;
    const copy = {
      ...src,
      id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      path: pathFromName(name, snapped),
      seoTitle: `${src.seoTitle || src.name} — копия`,
    };
    const next = [...snapped, copy];
    setPages(next);
    setActivePageId(copy.id);
    pagesRef.current = next;
    activePageIdRef.current = copy.id;
    loadPageIntoEditor(copy);
    emitDoc(editor, next, copy.id);
  }

  function insertSiteMenu() {
    const editor = editorRef.current;
    if (!editor) return;
    const list = pagesRef.current.length ? pagesRef.current : pages;
    const links = list
      .map((p) => {
        const href = p.path === "/" ? "/" : p.path.endsWith("/") ? p.path : `${p.path}`;
        return `<a href="${href}" style="color:inherit;text-decoration:none;font-weight:600;">${p.name}</a>`;
      })
      .join("");
    editor.addComponents(`<header data-vs="site-nav" style="display:flex;justify-content:space-between;align-items:center;gap:16px;padding:16px 24px;border-bottom:1px solid #eee;background:#fff;flex-wrap:wrap;">
  <strong style="font-size:1.05rem;">Бренд</strong>
  <nav style="display:flex;gap:18px;flex-wrap:wrap;align-items:center;">${links}</nav>
</header>`);
    emitDoc(editor);
  }

  function linkSelectedToPage(pagePath) {
    const editor = editorRef.current;
    if (!editor) return;
    const sel = editor.getSelected();
    if (!sel) {
      window.alert("Сначала кликните кнопку или ссылку на холсте.");
      return;
    }
    const href = pagePath || "/";
    const tag = (sel.get("tagName") || "").toLowerCase();
    const type = sel.get("type");
    if (type === "vs-button" || tag === "a" || tag === "button") {
      sel.addAttributes({ href });
      if (type === "vs-button") {
        // keep as anchor-like link target
        sel.set("attributes", { ...(sel.getAttributes() || {}), href });
      }
      emitDoc(editor);
      return;
    }
    // wrap or set on closest link-like
    sel.addAttributes({ href });
    emitDoc(editor);
  }

  function syncCustomCssToCanvas() {
    const editor = editorRef.current;
    if (!editor) return;
    const doc = editor.Canvas.getDocument?.();
    if (!doc?.head) return;
    let el = doc.getElementById("vsayte-custom-css");
    if (!el) {
      el = doc.createElement("style");
      el.id = "vsayte-custom-css";
      doc.head.appendChild(el);
    }
    el.textContent = siteSettingsRef.current?.customCss || "";
  }

  function ensureAnimKeyframes(editor) {
    let css = editor.getCss() || "";
    if (!css.includes("@keyframes vs-fade-in")) {
      css = `${css}\n${ANIM_KEYFRAMES}`;
      editor.setStyle(css);
    }
  }

  function runSelectionAction(action) {
    const editor = editorRef.current;
    if (!editor) return;
    const sel = editor.getSelected();
    if (!sel) {
      window.alert("Сначала кликните элемент на холсте.");
      return;
    }
    if (action === "duplicate") {
      const cloned = sel.clone();
      const parent = sel.parent();
      if (parent) parent.append(cloned);
      else editor.addComponents(cloned);
      editor.select(cloned);
    } else if (action === "delete") {
      sel.remove();
    } else if (action === "up" || action === "down") {
      const parent = sel.parent();
      if (!parent) return;
      const kids = parent.components();
      const idx = kids.indexOf(sel);
      const nextIdx = action === "up" ? idx - 1 : idx + 1;
      if (nextIdx < 0 || nextIdx >= kids.length) return;
      if (typeof sel.move === "function") {
        sel.move(parent, { at: nextIdx });
      } else {
        kids.remove(sel);
        kids.add(sel, { at: nextIdx });
      }
    }
    emitDoc(editor);
  }

  function applyAlign(styleMap) {
    applyPresetStyle(styleMap);
  }

  function applyAnimation(preset) {
    const editor = editorRef.current;
    if (!editor) return;
    const sel = editor.getSelected();
    if (!sel) {
      window.alert("Сначала кликните элемент на холсте.");
      return;
    }
    if (preset.id !== "none") ensureAnimKeyframes(editor);
    sel.addStyle(preset.style);
    emitDoc(editor);
  }

  function applyHover(hoverId) {
    const editor = editorRef.current;
    if (!editor) return;
    const sel = editor.getSelected();
    if (!sel) {
      window.alert("Сначала кликните кнопку на холсте.");
      return;
    }
    if (sel.get("type") === "vs-button") {
      sel.set("btnHover", hoverId);
      sel.applyButtonDesign?.();
    } else {
      sel.addAttributes({ "data-hover": hoverId });
      const cls = String(sel.getClasses?.()?.join?.(" ") || sel.getAttributes?.()?.class || "");
      if (!cls.includes("vs-btn")) sel.addClass("vs-btn");
    }
    emitDoc(editor);
  }

  function setSiteAsset(field) {
    const editor = editorRef.current;
    const selected = library[0];
    if (!selected?.src) {
      window.alert("Сначала загрузите картинку во вкладке «Дизайн → Файлы».");
      return;
    }
    // Prefer currently selected asset if user clicked one recently — use prompt among library
    if (library.length === 1) {
      patchSiteSettings({ [field]: selected.src });
      return;
    }
    const names = library.map((a, i) => `${i + 1}. ${a.name || "файл"}`).join("\n");
    const pick = window.prompt(`Номер файла для ${field === "favicon" ? "favicon" : "OG-картинки"}:\n${names}`, "1");
    const idx = Math.max(0, (Number(pick) || 1) - 1);
    const asset = library[idx] || library[0];
    if (asset?.src) patchSiteSettings({ [field]: asset.src });
    if (editor) emitDoc(editor);
  }

  async function handleFilesPicked(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const editor = editorRef.current;
    const added = [];
    for (const file of files) {
      let asset = null;
      if (onUploadFile) {
        asset = await onUploadFile(file);
      } else {
        asset = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve({ src: reader.result, name: file.name, type: file.type });
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }
      if (asset?.src) added.push({ src: asset.src, name: asset.name || file.name, type: "image" });
    }
    if (!added.length) return;
    if (editor) editor.AssetManager.add(added);
    const nextLib = [...added, ...library].slice(0, 40);
    setLibrary(nextLib);
    if (editor) {
      onChange?.(
        documentFromEditor(editor, pagesRef.current, activePageIdRef.current, {
          ...meta(),
          assets: nextLib,
        }),
      );
    }
  }

  function applyAssetToSelected(asset, mode = "auto") {
    const editor = editorRef.current;
    if (!editor) return;
    const selected = editor.getSelected();
    if (!selected) {
      window.alert("Сначала кликните элемент на холсте (кнопку, блок, картинку).");
      return;
    }
    const tag = (selected.get("tagName") || "").toLowerCase();
    const type = selected.get("type");
    if (mode === "image" || tag === "img" || type === "image") {
      selected.set("src", asset.src);
      selected.addAttributes({ src: asset.src, alt: asset.name || "" });
    } else if (mode === "bg" || mode === "auto") {
      selected.addStyle({
        "background-image": `url("${asset.src}")`,
        "background-size": "cover",
        "background-position": "center",
        "background-repeat": "no-repeat",
      });
    }
    emitDoc(editor);
  }

  function insertImageBlock(asset) {
    const editor = editorRef.current;
    if (!editor) return;
    editor.addComponents(`<img src="${asset.src}" alt="${asset.name || ""}" style="max-width:100%;height:auto;display:block;"/>`);
    emitDoc(editor);
  }

  function applyTemplate(templateId) {
    const editor = editorRef.current;
    if (!editor) return;
    if (!window.confirm("Заменить содержимое текущей страницы выбранным шаблоном?")) return;
    const built = buildTemplateDocument(templateId, paletteId, fontId, editorTier, colors);
    editor.setComponents(built.html);
    editor.setStyle(injectCssVars(built.css, colors));
    const snapped = pages.map((p) =>
      p.id === activePageId
        ? { ...p, html: editor.getHtml() || "", css: editor.getCss() || "" }
        : p,
    );
    setPages(snapped);
    pagesRef.current = snapped;
    onChange?.({
      ...documentFromEditor(editor, snapped, activePageId, { ...meta(), templateId }),
    });
  }

  function applyPresetPalette(nextPaletteId) {
    const palette = palettesForTier(editorTier).find((p) => p.id === nextPaletteId);
    if (!palette) return;
    const next = paletteToColors(palette);
    const prev = { ...colors };
    setPaletteId(nextPaletteId);
    setColors(next);
    const editor = editorRef.current;
    if (!editor) return;
    applyColorsToCanvas(editor, next, prev);
    onChange?.(
      documentFromEditor(editor, pagesRef.current, activePageIdRef.current, {
        ...meta(),
        paletteId: nextPaletteId,
        colors: next,
      }),
    );
  }

  function updateColor(role, value) {
    const prev = { ...colors };
    const next = { ...colors, [role]: value };
    setColors(next);
    setPaletteId("custom");
    const editor = editorRef.current;
    if (!editor) return;
    applyColorsToCanvas(editor, next, prev);
    onChange?.(
      documentFromEditor(editor, pagesRef.current, activePageIdRef.current, {
        ...meta(),
        paletteId: "custom",
        colors: next,
      }),
    );
  }

  function applyFont(nextFontId) {
    setFontId(nextFontId);
    const editor = editorRef.current;
    if (!editor) return;
    const font = fontsForTier(editorTier).find((f) => f.id === nextFontId);
    if (!font) return;
    const wrapper = editor.getWrapper();
    if (wrapper) wrapper.addStyle({ "font-family": font.stack });
    onChange?.(
      documentFromEditor(editor, pagesRef.current, activePageIdRef.current, {
        ...meta(),
        fontId: nextFontId,
      }),
    );
  }

  function paintSelected(role) {
    const editor = editorRef.current;
    if (!editor) return;
    const selected = editor.getSelected();
    if (!selected) {
      window.alert("Сначала кликните элемент на холсте.");
      return;
    }
    const value = colors[role];
    if (role === "accent" || role === "soft" || role === "paper") {
      selected.addStyle({ "background-color": value });
    } else {
      selected.addStyle({ color: value });
    }
    emitDoc(editor);
  }

  function openPreview() {
    const editor = editorRef.current;
    const snapped = snapshotActivePage(editor);
    setPages(snapped);
    pagesRef.current = snapped;
    const cur = snapped.find((p) => p.id === activePageId) || snapped[0];
    setPreviewDoc({ html: cur?.html || "", css: cur?.css || "", name: cur?.name || "Страница" });
    setPreviewOpen(true);
  }

  function insertElement(content) {
    const editor = editorRef.current;
    if (!editor) return;
    const selected = editor.getSelected();
    if (selected && selected.get("droppable")) {
      selected.append(content);
    } else {
      editor.addComponents(content);
    }
    emitDoc(editor);
  }

  function insertSection(html) {
    const editor = editorRef.current;
    if (!editor) return;
    editor.addComponents(html);
    emitDoc(editor);
  }

  function switchDevice(next) {
    const editor = editorRef.current;
    setDevice(next);
    if (editor) editor.setDevice(next);
  }

  function applyPresetStyle(styleMap) {
    const editor = editorRef.current;
    if (!editor) return;
    const selected = editor.getSelected();
    if (!selected) {
      window.alert("Сначала кликните элемент на холсте.");
      return;
    }
    // For custom button/input — prefer component props when possible
    const type = selected.get("type");
    if (type === "vs-button") {
      if (styleMap["border-radius"] != null) {
        const r = String(styleMap["border-radius"]);
        const shape =
          r === "0px" || r === "0"
            ? "square"
            : r === "8px"
              ? "soft"
              : r === "999px" || r.includes("%")
                ? "pill"
                : "rounded";
        if (styleMap.aspectRatio) selected.set("btnShape", "pill");
        else selected.set("btnShape", shape);
      }
      if (styleMap.padding) {
        const pad = String(styleMap.padding);
        if (pad.startsWith("6px") || pad.startsWith("8px")) selected.set("btnSize", "sm");
        else if (pad.startsWith("16px") || pad.startsWith("20px")) selected.set("btnSize", "lg");
        else selected.set("btnSize", "md");
      }
      if (styleMap.background === "transparent" && styleMap.border) selected.set("btnVariant", "outline");
      else if (String(styleMap.background || "").includes("1f") || String(styleMap.background || "").includes("22")) {
        selected.set("btnVariant", "soft");
      } else if (styleMap.background && styleMap.background !== "transparent") {
        selected.set("btnVariant", "solid");
        if (/^#|rgb|hsl/.test(String(styleMap.background))) {
          selected.set("btnAccent", styleMap.background);
        }
      }
      selected.applyButtonDesign?.();
      emitDoc(editor);
      return;
    }
    if (type === "vs-input" || type === "vs-textarea") {
      if (styleMap["border-radius"] != null) {
        const r = String(styleMap["border-radius"]);
        const shape =
          r === "0px" || r === "0"
            ? "square"
            : r === "999px"
              ? "pill"
              : r === "12px" || r === "16px"
                ? "rounded"
                : "soft";
        selected.set("inputShape", shape);
        if (type === "vs-input") selected.applyInputDesign?.();
        else selected.applyTextareaDesign?.();
      }
      if (styleMap.padding && type === "vs-input") {
        const pad = String(styleMap.padding);
        if (pad.startsWith("6px") || pad.startsWith("8px")) selected.set("inputSize", "sm");
        else if (pad.startsWith("14px") || pad.startsWith("16px") || pad.startsWith("20px")) {
          selected.set("inputSize", "lg");
        } else selected.set("inputSize", "md");
        selected.applyInputDesign?.();
      }
      emitDoc(editor);
      return;
    }
    const next = { ...(selected.getStyle() || {}), ...styleMap };
    delete next.aspectRatio;
    if (styleMap.aspectRatio) {
      next["aspect-ratio"] = styleMap.aspectRatio;
    }
    selected.setStyle(next);
    emitDoc(editor);
  }

  const elementGroups = QUICK_ELEMENTS.reduce((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {});
  const sectionGroups = sectionsByGroup();

  const templates = templatesForTier(editorTier);
  const palettes = palettesForTier(editorTier);
  const fonts = fontsForTier(editorTier);

  const activePage = pages.find((p) => p.id === activePageId) || pages[0];

  return (
    <div className="vsayte-editor">
      <aside className="vsayte-editor-side" aria-label="Панель дизайна">
        <div className="vsayte-side-tabs vsayte-side-tabs--4" role="tablist">
          <button
            type="button"
            role="tab"
            className={sideTab === "elements" ? "is-active" : ""}
            aria-selected={sideTab === "elements"}
            onClick={() => setSideTab("elements")}
          >
            Элементы
          </button>
          <button
            type="button"
            role="tab"
            className={sideTab === "design" ? "is-active" : ""}
            aria-selected={sideTab === "design"}
            onClick={() => setSideTab("design")}
          >
            Дизайн
          </button>
          <button
            type="button"
            role="tab"
            className={sideTab === "pages" ? "is-active" : ""}
            aria-selected={sideTab === "pages"}
            onClick={() => setSideTab("pages")}
          >
            Страницы
          </button>
          <button
            type="button"
            role="tab"
            className={sideTab === "help" ? "is-active" : ""}
            aria-selected={sideTab === "help"}
            onClick={() => setSideTab("help")}
          >
            ?
          </button>
        </div>

        {sideTab === "help" ? (
          <div className="vsayte-side-block vsayte-help">
            <h4>Как пользоваться</h4>
            <ol>
              <li>«Элементы» — секции, кнопки, формы заявок, hover.</li>
              <li>ПК / планшет / телефон — превью ширины сверху.</li>
              <li>Форма заявки после публикации пишет в «Заявки».</li>
              <li>«Дизайн → Сайт» — favicon и OG; «Страницы» — SEO.</li>
              <li>Delete — удалить, Ctrl+D — дублировать, ↶↷ — история.</li>
            </ol>
          </div>
        ) : sideTab === "elements" ? (
          <>
            <div className="vsayte-side-block">
              <h4>Форма выделенного</h4>
              <p className="vsayte-side-hint">Кликните элемент на холсте, затем выберите пресет</p>
              <div className="vsayte-chip-row">
                {SHAPE_PRESETS.map((p) => (
                  <button key={p.id} type="button" className="vsayte-chip" onClick={() => applyPresetStyle(p.style)}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="vsayte-side-block">
              <h4>Размер</h4>
              <div className="vsayte-chip-row">
                {SIZE_PRESETS.map((p) => (
                  <button key={p.id} type="button" className="vsayte-chip" onClick={() => applyPresetStyle(p.style)}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="vsayte-side-block">
              <h4>Внешний вид</h4>
              <div className="vsayte-chip-row">
                {LOOK_PRESETS.map((p) => (
                  <button key={p.id} type="button" className="vsayte-chip" onClick={() => applyPresetStyle(p.style)}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="vsayte-side-block">
              <h4>Выравнивание</h4>
              <div className="vsayte-chip-row">
                {ALIGN_ACTIONS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="vsayte-chip"
                    title={p.title}
                    onClick={() => applyAlign(p.style)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="vsayte-side-block">
              <h4>Анимация</h4>
              <div className="vsayte-chip-row">
                {ANIM_PRESETS.map((p) => (
                  <button key={p.id} type="button" className="vsayte-chip" onClick={() => applyAnimation(p)}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="vsayte-side-block">
              <h4>Наведение на кнопку</h4>
              <div className="vsayte-chip-row">
                {HOVER_PRESETS.map((p) => (
                  <button key={p.id} type="button" className="vsayte-chip" onClick={() => applyHover(p.id)}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            {Object.entries(sectionGroups).map(([group, items]) => (
              <div key={`sec-${group}`} className="vsayte-side-block">
                <h4>Секции · {group}</h4>
                <div className="vsayte-chip-row">
                  {items.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="vsayte-chip vsayte-chip--accent"
                      onClick={() => insertSection(s.html)}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {Object.entries(elementGroups).map(([group, items]) => (
              <div key={group} className="vsayte-side-block">
                <h4>{group}</h4>
                <div className="vsayte-chip-row">
                  {items.map((el) => (
                    <button
                      key={el.id}
                      type="button"
                      className="vsayte-chip vsayte-chip--accent"
                      onClick={() => insertElement(el.content)}
                    >
                      {el.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <p className="muted small vsayte-tier-note">
              Ещё больше блоков — иконка «Блоки» над холстом. После вставки откройте «Настройки» (шестерёнка) для текста, ссылки, типа поля.
            </p>
          </>
        ) : sideTab === "pages" ? (
          <>
            <div className="vsayte-side-block">
              <div className="vsayte-pages-head">
                <h4>Страницы</h4>
                <span className="muted small">
                  {pages.length}/{maxPages}
                </span>
              </div>
              <p className="vsayte-side-hint">Переключайте страницы и редактируйте каждую отдельно.</p>
              <ul className="vsayte-pages-list">
                {pages.map((p) => (
                  <li key={p.id} className={p.id === activePageId ? "is-active" : ""}>
                    <button type="button" className="vsayte-page-open" onClick={() => switchPage(p.id)}>
                      <strong>{p.name}</strong>
                      <span>{p.path}</span>
                    </button>
                    <input
                      className="vsayte-page-rename"
                      value={p.name}
                      aria-label={`Имя страницы ${p.name}`}
                      onChange={(e) => renamePage(p.id, e.target.value)}
                      onBlur={(e) => renamePage(p.id, e.target.value, { syncPath: true })}
                    />
                    <div className="vsayte-page-actions">
                      <button type="button" className="vsayte-mini-btn" onClick={() => duplicatePage(p.id)} title="Дублировать">
                        ⧉
                      </button>
                      <button
                        type="button"
                        className="vsayte-mini-btn"
                        disabled={pages.length <= 1}
                        onClick={() => deletePage(p.id)}
                        title="Удалить"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <button type="button" className="vsayte-upload-btn" disabled={pages.length >= maxPages} onClick={addPage}>
                + Добавить страницу
              </button>
              <button type="button" className="vsayte-upload-btn vsayte-upload-btn--ghost" onClick={insertSiteMenu}>
                Вставить меню сайта
              </button>
            </div>
            <div className="vsayte-side-block">
              <h4>Ссылка на страницу</h4>
              <p className="vsayte-side-hint">Выделите кнопку или ссылку, затем выберите страницу</p>
              <div className="vsayte-chip-row">
                {pages.map((p) => (
                  <button
                    key={`link-${p.id}`}
                    type="button"
                    className="vsayte-chip vsayte-chip--accent"
                    onClick={() => linkSelectedToPage(p.path)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
            {activePage ? (
              <div className="vsayte-side-block">
                <h4>SEO · {activePage.name}</h4>
                <p className="vsayte-side-hint">Title и описание для поисковиков</p>
                <label className="vsayte-field">
                  <span>Title</span>
                  <input
                    className="vsayte-page-rename"
                    value={activePage.seoTitle || ""}
                    onChange={(e) => updatePageMeta(activePage.id, { seoTitle: e.target.value })}
                    placeholder={activePage.name}
                  />
                </label>
                <label className="vsayte-field">
                  <span>Description</span>
                  <textarea
                    className="vsayte-seo-desc"
                    rows={3}
                    value={activePage.seoDescription || ""}
                    onChange={(e) => updatePageMeta(activePage.id, { seoDescription: e.target.value })}
                    placeholder="Краткое описание страницы"
                  />
                </label>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div className="vsayte-side-block">
              <div className="vsayte-pages-head">
                <h4>Текущая страница</h4>
                <button type="button" className="vsayte-mini-btn" onClick={() => setSideTab("pages")}>
                  {activePage?.name || "Главная"}
                </button>
              </div>
            </div>

            <div className="vsayte-side-block">
              <h4>Сайт</h4>
              <p className="vsayte-side-hint">Имя, favicon и превью для соцсетей</p>
              <label className="vsayte-field">
                <span>Название сайта</span>
                <input
                  className="vsayte-page-rename"
                  value={siteSettings.name || ""}
                  onChange={(e) => patchSiteSettings({ name: e.target.value })}
                  placeholder="Моя компания"
                />
              </label>
              <label className="vsayte-field">
                <span>OG title</span>
                <input
                  className="vsayte-page-rename"
                  value={siteSettings.ogTitle || ""}
                  onChange={(e) => patchSiteSettings({ ogTitle: e.target.value })}
                  placeholder="Заголовок при шаринге"
                />
              </label>
              <label className="vsayte-field">
                <span>OG description</span>
                <textarea
                  className="vsayte-seo-desc"
                  rows={2}
                  value={siteSettings.ogDescription || ""}
                  onChange={(e) => patchSiteSettings({ ogDescription: e.target.value })}
                  placeholder="Короткое описание для соцсетей"
                />
              </label>
              <div className="vsayte-site-assets">
                <button type="button" className="vsayte-mini-btn" onClick={() => setSiteAsset("favicon")}>
                  {siteSettings.favicon ? "Сменить favicon" : "Favicon из файлов"}
                </button>
                <button type="button" className="vsayte-mini-btn" onClick={() => setSiteAsset("ogImage")}>
                  {siteSettings.ogImage ? "Сменить OG-фото" : "OG-фото из файлов"}
                </button>
              </div>
              {(siteSettings.favicon || siteSettings.ogImage) && (
                <div className="vsayte-site-previews">
                  {siteSettings.favicon ? (
                    <img src={siteSettings.favicon} alt="favicon" className="vsayte-site-favicon" />
                  ) : null}
                  {siteSettings.ogImage ? (
                    <img src={siteSettings.ogImage} alt="og" className="vsayte-site-og" />
                  ) : null}
                </div>
              )}
              <label className="vsayte-field" style={{ marginTop: 12 }}>
                <span>Свой CSS</span>
                <textarea
                  className="vsayte-seo-desc vsayte-custom-css"
                  rows={5}
                  value={siteSettings.customCss || ""}
                  onChange={(e) => patchSiteSettings({ customCss: e.target.value })}
                  placeholder={".hero { letter-spacing: .02em; }\nbutton:hover { opacity: .9; }"}
                  spellCheck={false}
                />
              </label>
            </div>

            <div className="vsayte-side-block">
              <h4>Шаблоны</h4>
              <div className="vsayte-chip-row">
                {templates.map((t) => (
                  <button key={t.id} type="button" className="vsayte-chip" onClick={() => applyTemplate(t.id)}>
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="vsayte-side-block">
              <h4>Готовые палитры</h4>
              <div className="vsayte-palette-row">
                {palettes.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`vsayte-palette ${paletteId === p.id ? "is-active" : ""}`}
                    title={p.name}
                    onClick={() => applyPresetPalette(p.id)}
                  >
                    {p.colors.slice(0, 5).map((c) => (
                      <span key={`${p.id}-${c}`} style={{ background: c }} />
                    ))}
                    <em>{p.name}</em>
                  </button>
                ))}
              </div>
            </div>

            <div className="vsayte-side-block">
              <h4>Свои цвета</h4>
              <p className="vsayte-side-hint">Любой оттенок — через пипетку или код #hex</p>
              <div className="vsayte-color-list">
                {COLOR_ROLES.map((role) => (
                  <div key={role.key} className="vsayte-color-row">
                    <label>
                      <span className="vsayte-color-label">{role.label}</span>
                      <span className="vsayte-color-hint">{role.hint}</span>
                    </label>
                    <div className="vsayte-color-controls">
                      <input
                        type="color"
                        value={/^#[0-9a-fA-F]{6}$/.test(colors[role.key]) ? colors[role.key] : "#000000"}
                        onChange={(e) => updateColor(role.key, e.target.value)}
                        aria-label={role.label}
                      />
                      <input
                        type="text"
                        className="vsayte-hex"
                        value={colors[role.key]}
                        onChange={(e) => {
                          const v = e.target.value.trim();
                          if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) updateColor(role.key, v);
                          else setColors((c) => ({ ...c, [role.key]: v }));
                        }}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) updateColor(role.key, v);
                        }}
                        spellCheck={false}
                      />
                      <button type="button" className="vsayte-mini-btn" onClick={() => paintSelected(role.key)} title="Покрасить выбранный элемент">
                        На элемент
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="vsayte-side-block">
              <h4>Шрифт</h4>
              <select className="vsayte-select" value={fontId} onChange={(e) => applyFont(e.target.value)}>
                {fonts.map((f) => (
                  <option key={f.id} value={f.id} style={{ fontFamily: f.stack }}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="vsayte-side-block">
              <h4>Файлы</h4>
              <p className="vsayte-side-hint">
                Загрузите картинку и примените к кнопке, блоку (фон) или вставьте как изображение.
              </p>
              <label className="vsayte-upload-btn">
                Загрузить файл
                <input
                  type="file"
                  accept="image/*,.svg,.webp,.png,.jpg,.jpeg,.gif,.ico"
                  multiple
                  hidden
                  onChange={(e) => {
                    handleFilesPicked(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              {library.length ? (
                <div className="vsayte-asset-grid">
                  {library.map((asset) => (
                    <div key={asset.src} className="vsayte-asset-card">
                      <button
                        type="button"
                        className="vsayte-asset-preview"
                        title={asset.name}
                        onClick={() => applyAssetToSelected(asset, "auto")}
                        style={{ backgroundImage: `url("${asset.src}")` }}
                      />
                      <div className="vsayte-asset-actions">
                        <button type="button" className="vsayte-mini-btn" onClick={() => applyAssetToSelected(asset, "bg")}>
                          Фон
                        </button>
                        <button type="button" className="vsayte-mini-btn" onClick={() => applyAssetToSelected(asset, "image")}>
                          В картинку
                        </button>
                        <button type="button" className="vsayte-mini-btn" onClick={() => insertImageBlock(asset)}>
                          Вставить
                        </button>
                        <button type="button" className="vsayte-mini-btn" onClick={() => patchSiteSettings({ favicon: asset.src })}>
                          Favicon
                        </button>
                        <button type="button" className="vsayte-mini-btn" onClick={() => patchSiteSettings({ ogImage: asset.src })}>
                          OG
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted small">Пока нет загруженных файлов.</p>
              )}
            </div>

            {editorTier !== "pro" ? (
              <p className="muted small vsayte-tier-note">
                На тарифе Pro доступны все шаблоны и шрифты.
              </p>
            ) : null}
          </>
        )}
      </aside>
      <div className="vsayte-editor-canvas-wrap">
        <div className="vsayte-canvas-bar">
          <span className="muted small">
            {activePage?.name || "Страница"} · {activePage?.path || "/"}
            {hasSelection && selectionLabel ? ` · ${selectionLabel}` : ""}
          </span>
          <div className="vsayte-canvas-bar-actions">
            <div className="vsayte-device-switch" role="group" aria-label="Устройство">
              {[
                { id: "desktop", label: "ПК" },
                { id: "tablet", label: "Планшет" },
                { id: "mobile", label: "Телефон" },
              ].map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`vsayte-mini-btn ${device === d.id ? "is-active" : ""}`}
                  onClick={() => switchDevice(d.id)}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <div className="vsayte-sel-actions" role="toolbar" aria-label="История и действия">
              <button
                type="button"
                className="vsayte-mini-btn"
                title="Отменить"
                onClick={() => editorRef.current?.runCommand("core:undo")}
              >
                ↶
              </button>
              <button
                type="button"
                className="vsayte-mini-btn"
                title="Повторить"
                onClick={() => editorRef.current?.runCommand("core:redo")}
              >
                ↷
              </button>
              {hasSelection ? (
                <>
                  <button type="button" className="vsayte-mini-btn" title="Выше" onClick={() => runSelectionAction("up")}>
                    ↑
                  </button>
                  <button type="button" className="vsayte-mini-btn" title="Ниже" onClick={() => runSelectionAction("down")}>
                    ↓
                  </button>
                  <button type="button" className="vsayte-mini-btn" title="Дублировать (Ctrl+D)" onClick={() => runSelectionAction("duplicate")}>
                    ⧉
                  </button>
                  <button type="button" className="vsayte-mini-btn" title="Удалить (Del)" onClick={() => runSelectionAction("delete")}>
                    ×
                  </button>
                  {ALIGN_ACTIONS.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className="vsayte-mini-btn"
                      title={a.title}
                      onClick={() => applyAlign(a.style)}
                    >
                      {a.label}
                    </button>
                  ))}
                </>
              ) : null}
            </div>
            <button
              type="button"
              className="vsayte-mini-btn"
              onClick={() => {
                const ed = editorRef.current;
                ed?.Panels.getButton("views", "open-tm")?.set("active", 1);
              }}
              title="Настройки выделенного элемента"
            >
              Настройки
            </button>
            <button
              type="button"
              className="vsayte-mini-btn"
              onClick={() => {
                const ed = editorRef.current;
                ed?.Panels.getButton("views", "open-sm")?.set("active", 1);
              }}
              title="Стили CSS"
            >
              Стили
            </button>
            <button type="button" className="ghost-btn small" onClick={openPreview}>
              Предпросмотр
            </button>
          </div>
        </div>
        <div className="vsayte-editor-canvas" ref={hostRef} />
      </div>

      {previewOpen ? (
        <div className="vsayte-preview-overlay" role="dialog" aria-modal="true" aria-label="Предпросмотр">
          <div className="vsayte-preview-panel">
            <header>
              <strong>Предпросмотр · {previewDoc.name}</strong>
              <button type="button" className="ghost-btn" onClick={() => setPreviewOpen(false)}>
                Закрыть
              </button>
            </header>
            <iframe
              title="Предпросмотр страницы"
              srcDoc={`<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>${siteSettings.favicon ? `<link rel="icon" href="${siteSettings.favicon}"/>` : ""}<title>${previewDoc.name || "Предпросмотр"}</title><style>${injectCssVars(previewDoc.css || "", colors)}\n${VSAYTE_INTERACTIVE_CSS}\n${siteSettings.customCss || ""}</style></head><body>${previewDoc.html || ""}</body></html>`}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
