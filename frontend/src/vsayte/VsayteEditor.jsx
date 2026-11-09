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

function documentFromEditor(editor) {
  const html = editor.getHtml() || "";
  const css = editor.getCss() || "";
  return {
    html,
    css,
    pages: [{ id: "home", name: "Главная", path: "/", html, css }],
    projectData: editor.getProjectData(),
  };
}

export default function VsayteEditor({
  initialDocument,
  editorTier = "basic",
  onChange,
  onReady,
}) {
  const hostRef = useRef(null);
  const editorRef = useRef(null);
  const [paletteId, setPaletteId] = useState(
    initialDocument?.meta?.paletteId || palettesForTier(editorTier)[0].id,
  );
  const [fontId, setFontId] = useState(
    initialDocument?.meta?.fontId || fontsForTier(editorTier)[0].id,
  );

  useEffect(() => {
    if (!hostRef.current || editorRef.current) return undefined;

    const editor = grapesjs.init({
      container: hostRef.current,
      height: "100%",
      width: "auto",
      fromElement: false,
      storageManager: false,
      plugins: [webpagePlugin],
      pluginsOpts: {
        "gjs-preset-webpage": {
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
          { name: "Desktop", width: "" },
          { name: "Tablet", width: "768px", widthMedia: "992px" },
          { name: "Mobile", width: "375px", widthMedia: "480px" },
        ],
      },
    });

    editorRef.current = editor;

    const doc = initialDocument;
    if (doc?.projectData) {
      editor.loadProjectData(doc.projectData);
    } else if (doc?.html || doc?.pages?.[0]?.html) {
      const html = doc.pages?.[0]?.html || doc.html || "";
      const css = doc.pages?.[0]?.css || doc.css || "";
      editor.setComponents(html);
      editor.setStyle(css);
    } else {
      const built = buildTemplateDocument("landing", paletteId, fontId, editorTier);
      editor.setComponents(built.html);
      editor.setStyle(built.css);
    }

    const emit = () => onChange?.(documentFromEditor(editor));
    editor.on("update", emit);
    onReady?.(editor);
    emit();

    return () => {
      editor.destroy();
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyTemplate(templateId) {
    const editor = editorRef.current;
    if (!editor) return;
    const built = buildTemplateDocument(templateId, paletteId, fontId, editorTier);
    editor.setComponents(built.html);
    editor.setStyle(built.css);
    onChange?.({ ...built, projectData: editor.getProjectData() });
  }

  function applyPalette(nextPaletteId) {
    setPaletteId(nextPaletteId);
    const editor = editorRef.current;
    if (!editor) return;
    const palette = palettesForTier(editorTier).find((p) => p.id === nextPaletteId);
    if (!palette) return;
    const [accent] = palette.colors;
    const css = editor.getCss() || "";
    // Soft hint: inject CSS variables for further styling
    const vars = `:root{--vs-accent:${accent};--vs-ink:${palette.colors[1]};--vs-soft:${palette.colors[2]};}`;
    const next = /:root\{[^}]*\}/.test(css) ? css.replace(/:root\{[^}]*\}/, vars) : `${vars}\n${css}`;
    editor.setStyle(next);
    onChange?.(documentFromEditor(editor));
  }

  function applyFont(nextFontId) {
    setFontId(nextFontId);
    const editor = editorRef.current;
    if (!editor) return;
    const font = fontsForTier(editorTier).find((f) => f.id === nextFontId);
    if (!font) return;
    const wrapper = editor.getWrapper();
    if (wrapper) wrapper.addStyle({ "font-family": font.stack });
    onChange?.(documentFromEditor(editor));
  }

  const templates = templatesForTier(editorTier);
  const palettes = palettesForTier(editorTier);
  const fonts = fontsForTier(editorTier);

  return (
    <div className="vsayte-editor">
      <aside className="vsayte-editor-side">
        <div className="vsayte-side-block">
          <h4>Шаблоны</h4>
          <div className="vsayte-chip-row">
            {templates.map((t) => (
              <button key={t.id} type="button" className="ghost-btn small" onClick={() => applyTemplate(t.id)}>
                {t.name}
              </button>
            ))}
          </div>
        </div>
        <div className="vsayte-side-block">
          <h4>Палитры</h4>
          <div className="vsayte-palette-row">
            {palettes.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`vsayte-palette ${paletteId === p.id ? "is-active" : ""}`}
                title={p.name}
                onClick={() => applyPalette(p.id)}
              >
                {p.colors.slice(0, 4).map((c) => (
                  <span key={c} style={{ background: c }} />
                ))}
              </button>
            ))}
          </div>
        </div>
        <div className="vsayte-side-block">
          <h4>Шрифты</h4>
          <select className="vsayte-select" value={fontId} onChange={(e) => applyFont(e.target.value)}>
            {fonts.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        {editorTier !== "pro" ? (
          <p className="muted small">На Pro открываются все шаблоны, палитры, шрифты и загрузка своих файлов.</p>
        ) : null}
      </aside>
      <div className="vsayte-editor-canvas" ref={hostRef} />
    </div>
  );
}
