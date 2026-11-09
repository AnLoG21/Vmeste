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

function documentFromEditor(editor, meta = {}) {
  const html = editor.getHtml() || "";
  const css = editor.getCss() || "";
  return {
    html,
    css,
    pages: [{ id: "home", name: "Главная", path: "/", html, css }],
    projectData: editor.getProjectData(),
    meta,
  };
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
  onChange,
  onReady,
}) {
  const hostRef = useRef(null);
  const editorRef = useRef(null);
  const colorsRef = useRef(null);

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
  const [sideTab, setSideTab] = useState("design"); // design | blocks hint

  colorsRef.current = colors;

  useEffect(() => {
    if (!hostRef.current || editorRef.current) return undefined;

    const editor = grapesjs.init({
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
            open: false,
            buildProps: ["width", "height", "max-width", "min-height", "margin", "padding"],
          },
          {
            name: "Типографика",
            open: true,
            buildProps: ["font-family", "font-size", "font-weight", "letter-spacing", "color", "line-height", "text-align", "text-decoration"],
            properties: [
              {
                property: "color",
                type: "color",
                defaults: "black",
              },
            ],
          },
          {
            name: "Оформление",
            open: true,
            buildProps: ["background-color", "border-radius", "border", "box-shadow", "opacity"],
            properties: [
              {
                property: "background-color",
                type: "color",
              },
              {
                property: "border-color",
                type: "color",
              },
            ],
          },
          {
            name: "Макет",
            open: false,
            buildProps: ["display", "flex-direction", "justify-content", "align-items", "flex-wrap"],
          },
        ],
      },
    });

    editorRef.current = editor;

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

    const doc = initialDocument;
    if (doc?.projectData) {
      editor.loadProjectData(doc.projectData);
    } else if (doc?.html || doc?.pages?.[0]?.html) {
      const html = doc.pages?.[0]?.html || doc.html || "";
      const css = doc.pages?.[0]?.css || doc.css || "";
      editor.setComponents(html);
      editor.setStyle(injectCssVars(css, colorsRef.current));
    } else {
      const built = buildTemplateDocument("landing", paletteId, fontId, editorTier);
      editor.setComponents(built.html);
      editor.setStyle(injectCssVars(built.css, colorsRef.current));
    }

    const emit = () =>
      onChange?.(
        documentFromEditor(editor, {
          paletteId,
          fontId,
          colors: colorsRef.current,
        }),
      );
    editor.on("update", emit);
    onReady?.(editor);
    emit();

    return () => {
      editor.destroy();
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function meta() {
    return { paletteId, fontId, colors };
  }

  function applyTemplate(templateId) {
    const editor = editorRef.current;
    if (!editor) return;
    if (!window.confirm("Заменить содержимое холста выбранным шаблоном?")) return;
    const built = buildTemplateDocument(templateId, paletteId, fontId, editorTier, colors);
    editor.setComponents(built.html);
    editor.setStyle(injectCssVars(built.css, colors));
    onChange?.({
      ...built,
      html: editor.getHtml(),
      css: editor.getCss(),
      projectData: editor.getProjectData(),
      meta: { ...meta(), templateId },
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
    onChange?.(documentFromEditor(editor, { paletteId: nextPaletteId, fontId, colors: next }));
  }

  function updateColor(role, value) {
    const prev = { ...colors };
    const next = { ...colors, [role]: value };
    setColors(next);
    setPaletteId("custom");
    const editor = editorRef.current;
    if (!editor) return;
    applyColorsToCanvas(editor, next, prev);
    onChange?.(documentFromEditor(editor, { paletteId: "custom", fontId, colors: next }));
  }

  function applyFont(nextFontId) {
    setFontId(nextFontId);
    const editor = editorRef.current;
    if (!editor) return;
    const font = fontsForTier(editorTier).find((f) => f.id === nextFontId);
    if (!font) return;
    const wrapper = editor.getWrapper();
    if (wrapper) wrapper.addStyle({ "font-family": font.stack });
    onChange?.(documentFromEditor(editor, { paletteId, fontId: nextFontId, colors }));
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
    onChange?.(documentFromEditor(editor, meta()));
  }

  const templates = templatesForTier(editorTier);
  const palettes = palettesForTier(editorTier);
  const fonts = fontsForTier(editorTier);

  return (
    <div className="vsayte-editor">
      <aside className="vsayte-editor-side" aria-label="Панель дизайна">
        <div className="vsayte-side-tabs" role="tablist">
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
            className={sideTab === "help" ? "is-active" : ""}
            aria-selected={sideTab === "help"}
            onClick={() => setSideTab("help")}
          >
            Подсказка
          </button>
        </div>

        {sideTab === "help" ? (
          <div className="vsayte-side-block vsayte-help">
            <h4>Как пользоваться</h4>
            <ol>
              <li>Слева выберите шаблон или начните с пустого.</li>
              <li>Кликните блок на холсте — справа откроются стили.</li>
              <li>Любой цвет можно задать пипеткой ниже.</li>
              <li>Кнопка «На элемент» красит выбранный блок.</li>
              <li>Блоки, слои и стили — иконки сверху холста.</li>
            </ol>
          </div>
        ) : (
          <>
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

            {editorTier !== "pro" ? (
              <p className="muted small vsayte-tier-note">
                На тарифе Pro доступны все шаблоны, шрифты и загрузка своих файлов.
              </p>
            ) : null}
          </>
        )}
      </aside>
      <div className="vsayte-editor-canvas-wrap">
        <div className="vsayte-editor-canvas" ref={hostRef} />
      </div>
    </div>
  );
}
