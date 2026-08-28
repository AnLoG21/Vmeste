import { useEffect, useRef, useState } from "react";
import { PencilBrush } from "fabric";
import {
  FONT_OPTIONS,
  SLIDE_H,
  SLIDE_W,
  SMART_FIELDS,
  TOOLS,
  addImageFromSource,
  addProductPhotoSlot,
  addShape,
  addSmartField,
  addTextObject,
  buildStarterCanvasJson,
  createEditorCanvas,
  hasCanvasScene,
  loadSceneOntoCanvas,
  serializeCanvas,
} from "./cardSlideCanvas.js";
import { DEFAULT_CARD_STYLE } from "./productCardTemplates.js";
import "./cardSlideCanvasEditor.css";

function isTextObj(obj) {
  if (!obj) return false;
  const t = String(obj.type || "").toLowerCase();
  return t === "i-text" || t === "textbox" || t === "text" || obj.isType?.("i-text") || obj.isType?.("textbox");
}

function Icon({ children, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {children}
    </svg>
  );
}

const TOOL_ICONS = {
  select: (
    <Icon>
      <path d="M5 3l7.5 17 1.8-6.7L21 11.5 5 3z" fill="currentColor" />
    </Icon>
  ),
  text: (
    <Icon>
      <path d="M5 5h14v3h-5.5v11h-3V8H5V5z" fill="currentColor" />
    </Icon>
  ),
  rect: (
    <Icon>
      <rect x="4" y="6" width="16" height="12" rx="1.5" stroke="currentColor" strokeWidth="2" />
    </Icon>
  ),
  circle: (
    <Icon>
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="2" />
    </Icon>
  ),
  triangle: (
    <Icon>
      <path d="M12 4.5L20 19H4L12 4.5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </Icon>
  ),
  line: (
    <Icon>
      <path d="M4 18L20 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </Icon>
  ),
  draw: (
    <Icon>
      <path
        d="M15.5 4.5l4 4L9 19H5v-4L15.5 4.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M13.5 6.5l4 4" stroke="currentColor" strokeWidth="2" />
    </Icon>
  ),
  erase: (
    <Icon>
      <path
        d="M15.2 4.8l4 4-8.4 8.4H6.8l-2-2 10.4-10.4z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M5 19.5h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </Icon>
  ),
};

const ACTION_ICONS = {
  photo: (
    <Icon size={18}>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
      <circle cx="9" cy="11" r="2" fill="currentColor" />
      <path d="M12 16l3-3 4 4H7l2.5-2.5L12 16z" fill="currentColor" />
    </Icon>
  ),
  forward: (
    <Icon size={18}>
      <path d="M12 5l6 7H6l6-7z" fill="currentColor" />
      <path d="M6 18h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </Icon>
  ),
  backward: (
    <Icon size={18}>
      <path d="M12 19l6-7H6l6 7z" fill="currentColor" />
      <path d="M6 6h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </Icon>
  ),
  trash: (
    <Icon size={18}>
      <path d="M5 7h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 7V5h6v2" stroke="currentColor" strokeWidth="2" />
      <path d="M8 7l1 12h6l1-12" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </Icon>
  ),
  reset: (
    <Icon size={18}>
      <path
        d="M4 12a8 8 0 0113.5-5.8M20 12a8 8 0 01-13.5 5.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M17 3v4h4M7 21v-4H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  ),
  paste: (
    <Icon size={18}>
      <rect x="8" y="4" width="10" height="4" rx="1" stroke="currentColor" strokeWidth="2" />
      <path d="M7 6H5a2 2 0 00-2 2v11a2 2 0 002 2h12a2 2 0 002-2V8a2 2 0 00-2-2h-2" stroke="currentColor" strokeWidth="2" />
      <rect x="8" y="11" width="8" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
    </Icon>
  ),
  undo: (
    <Icon size={18}>
      <path
        d="M8 8H5v3.5L8.5 15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 11.5a7 7 0 1012.5 2.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Icon>
  ),
  redo: (
    <Icon size={18}>
      <path
        d="M16 8h3v3.5L15.5 15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 11.5a7 7 0 11-12.5 2.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Icon>
  ),
};

/**
 * Full photo-style editor for marketplace card slides.
 * onChange(canvasJson) debounced when scene mutates.
 */
export default function CardSlideCanvasEditor({
  canvasJson,
  layout = "hero",
  style = DEFAULT_CARD_STYLE,
  productImageUrl = "",
  onChange,
}) {
  const hostRef = useRef(null);
  const workspaceRef = useRef(null);
  const canvasRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const skipEmitRef = useRef(false);
  const restoringRef = useRef(false);
  const historyRef = useRef({ past: [], future: [] });
  const [tool, setTool] = useState("select");
  const [brushSize, setBrushSize] = useState(8);
  const [brushColor, setBrushColor] = useState("#1a242e");
  const [fillColor, setFillColor] = useState("#0f6e56");
  const [selectedMeta, setSelectedMeta] = useState(null);
  const [pasteStatus, setPasteStatus] = useState("");
  const [historyTick, setHistoryTick] = useState(0);
  const [scale, setScale] = useState(0.42);

  function commitCanvasChange(canvas, { skipHistory = false } = {}) {
    if (!canvas) return;
    const json = serializeCanvas(canvas);
    onChangeRef.current?.(json);
    if (skipHistory || restoringRef.current) return;
    const snap = JSON.stringify(json);
    const { past } = historyRef.current;
    if (past[past.length - 1] === snap) return;
    past.push(snap);
    if (past.length > 50) past.shift();
    historyRef.current.future = [];
    setHistoryTick((t) => t + 1);
  }

  async function restoreSnapshot(snap) {
    const canvas = canvasRef.current;
    if (!canvas || !snap) return;
    restoringRef.current = true;
    skipEmitRef.current = true;
    await loadSceneOntoCanvas(canvas, JSON.parse(snap));
    skipEmitRef.current = false;
    commitCanvasChange(canvas, { skipHistory: true });
    restoringRef.current = false;
    setHistoryTick((t) => t + 1);
  }

  function undo() {
    const { past, future } = historyRef.current;
    if (past.length <= 1) return;
    const current = past.pop();
    future.push(current);
    restoreSnapshot(past[past.length - 1]);
  }

  function redo() {
    const { past, future } = historyRef.current;
    if (!future.length) return;
    const next = future.pop();
    past.push(next);
    restoreSnapshot(next);
  }

  function insertSmartField(fieldId) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setTool("select");
    addSmartField(canvas, fieldId, style);
    commitCanvasChange(canvas);
  }

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const updateScale = () => {
      const host = workspaceRef.current;
      const maxW = Math.min((host?.clientWidth || 640) - 24, 860);
      const maxH = Math.min(window.innerHeight * 0.68, 1040);
      const s = Math.min(maxW / SLIDE_W, maxH / SLIDE_H);
      setScale(Math.max(0.28, Math.min(s, 0.82)));
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return undefined;
    const canvas = createEditorCanvas(el, { background: style?.bg || DEFAULT_CARD_STYLE.bg });
    canvasRef.current = canvas;

    const emit = () => {
      if (skipEmitRef.current) return;
      commitCanvasChange(canvas);
    };
    let emitTimer = null;
    const scheduleEmit = () => {
      clearTimeout(emitTimer);
      emitTimer = setTimeout(emit, 280);
    };

    const syncSelection = () => {
      const obj = canvas.getActiveObject();
      if (!obj) {
        setSelectedMeta(null);
        return;
      }
      setSelectedMeta({
        isText: isTextObj(obj),
        fontFamily: obj.fontFamily || FONT_OPTIONS[0].id,
        fontSize: Math.round(obj.fontSize || 24),
        fontWeight: String(obj.fontWeight || "normal"),
        fontStyle: String(obj.fontStyle || "normal"),
        underline: Boolean(obj.underline),
        fill: obj.fill || "#1a242e",
        stroke: obj.stroke || "#1a242e",
        strokeWidth: obj.strokeWidth || 0,
        opacity: obj.opacity == null ? 1 : obj.opacity,
      });
    };

    canvas.on("object:modified", scheduleEmit);
    canvas.on("object:added", scheduleEmit);
    canvas.on("object:removed", scheduleEmit);
    canvas.on("path:created", scheduleEmit);
    canvas.on("selection:created", syncSelection);
    canvas.on("selection:updated", syncSelection);
    canvas.on("selection:cleared", () => setSelectedMeta(null));
    canvas.on("text:changed", scheduleEmit);

    (async () => {
      skipEmitRef.current = true;
      const initial = hasCanvasScene(canvasJson) ? canvasJson : buildStarterCanvasJson(layout, style);
      await loadSceneOntoCanvas(canvas, initial);
      skipEmitRef.current = false;
      historyRef.current = { past: [JSON.stringify(serializeCanvas(canvas))], future: [] };
      setHistoryTick((t) => t + 1);
      if (!hasCanvasScene(canvasJson)) scheduleEmit();
    })();

    return () => {
      clearTimeout(emitTimer);
      canvas.dispose();
      canvasRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const isDraw = tool === "draw";
    const isErase = tool === "erase";
    canvas.isDrawingMode = isDraw;
    canvas.selection = tool === "select" || isErase;
    canvas.defaultCursor = isErase ? "pointer" : tool === "select" ? "default" : "crosshair";
    canvas.forEachObject((obj) => {
      const canSelect = tool === "select" || isErase;
      obj.selectable = canSelect;
      obj.evented = canSelect;
    });
    if (isDraw) {
      const brush = new PencilBrush(canvas);
      brush.width = brushSize;
      brush.color = brushColor;
      brush.globalCompositeOperation = "source-over";
      canvas.freeDrawingBrush = brush;
    }
    const onEraseClick = (opt) => {
      if (tool !== "erase") return;
      const t = opt.target;
      if (!t) return;
      canvas.remove(t);
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      commitCanvasChange(canvas);
    };
    canvas.on("mouse:down", onEraseClick);
    canvas.requestRenderAll();
    return () => {
      canvas.off("mouse:down", onEraseClick);
    };
  }, [tool, brushSize, brushColor]);

  function mutateActive(patch) {
    const canvas = canvasRef.current;
    const obj = canvas?.getActiveObject();
    if (!canvas || !obj) return;
    obj.set(patch);
    obj.setCoords();
    canvas.requestRenderAll();
    setSelectedMeta((m) => (m ? { ...m, ...patch, fontSize: patch.fontSize ?? m.fontSize } : m));
    commitCanvasChange(canvas);
  }

  function handleToolClick(id) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (id === "text") {
      setTool("select");
      addTextObject(canvas, { fill: fillColor });
      return;
    }
    if (["rect", "circle", "triangle", "line"].includes(id)) {
      setTool("select");
      addShape(canvas, id, { fill: fillColor, stroke: brushColor });
      return;
    }
    setTool(id);
  }

  async function insertProductPhoto() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setTool("select");
    await addProductPhotoSlot(canvas, productImageUrl);
    commitCanvasChange(canvas);
  }

  function deleteSelected() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObjects();
    if (!active.length) return;
    active.forEach((o) => canvas.remove(o));
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    commitCanvasChange(canvas);
  }

  function bringForward() {
    const canvas = canvasRef.current;
    const obj = canvas?.getActiveObject();
    if (!canvas || !obj) return;
    canvas.bringObjectForward(obj);
    canvas.requestRenderAll();
    commitCanvasChange(canvas);
  }

  function sendBackward() {
    const canvas = canvasRef.current;
    const obj = canvas?.getActiveObject();
    if (!canvas || !obj) return;
    canvas.sendObjectBackwards(obj);
    canvas.requestRenderAll();
    commitCanvasChange(canvas);
  }

  function resetStarter() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!window.confirm("Сбросить сцену к стартовому макету? Текущие объекты пропадут.")) return;
    (async () => {
      skipEmitRef.current = true;
      await loadSceneOntoCanvas(canvas, buildStarterCanvasJson(layout, style));
      skipEmitRef.current = false;
      historyRef.current = { past: [JSON.stringify(serializeCanvas(canvas))], future: [] };
      setHistoryTick((t) => t + 1);
      commitCanvasChange(canvas, { skipHistory: true });
    })();
  }

  async function insertImageBlob(blob) {
    const canvas = canvasRef.current;
    if (!canvas || !blob) return false;
    setTool("select");
    await addImageFromSource(canvas, blob);
    commitCanvasChange(canvas);
    setPasteStatus("Картинка вставлена");
    window.setTimeout(() => setPasteStatus(""), 1800);
    return true;
  }

  async function pasteImageFromEvent(e) {
    const items = Array.from(e?.clipboardData?.items || []);
    for (const item of items) {
      if (item.kind === "file" && String(item.type || "").startsWith("image/")) {
        const file = item.getAsFile();
        if (!file) continue;
        e.preventDefault();
        await insertImageBlob(file);
        return true;
      }
    }
    const files = Array.from(e?.clipboardData?.files || []);
    for (const file of files) {
      if (String(file.type || "").startsWith("image/")) {
        e.preventDefault();
        await insertImageBlob(file);
        return true;
      }
    }
    return false;
  }

  async function pasteFromClipboardButton() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      if (navigator.clipboard?.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const type = item.types.find((t) => t.startsWith("image/"));
          if (!type) continue;
          const blob = await item.getType(type);
          await insertImageBlob(blob);
          return;
        }
      }
      setPasteStatus("В буфере нет картинки — скопируйте снимок и нажмите Ctrl+V");
      window.setTimeout(() => setPasteStatus(""), 2800);
    } catch {
      setPasteStatus("Разрешите доступ к буферу или вставьте через Ctrl+V");
      window.setTimeout(() => setPasteStatus(""), 2800);
    }
  }

  function onWorkspaceDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer?.files || []);
    const image = files.find((f) => String(f.type || "").startsWith("image/"));
    if (image) insertImageBlob(image);
  }

  useEffect(() => {
    const onPaste = (e) => {
      if (!canvasRef.current) return;
      const tag = String(e.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      const active = canvasRef.current.getActiveObject?.();
      if (active?.isEditing) return;
      pasteImageFromEvent(e);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (!canvasRef.current) return;
      const tag = String(e.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || e.target?.isContentEditable) return;
      const active = canvasRef.current.getActiveObject?.();
      if (active?.isEditing) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelected();
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === "z") {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
          return;
        }
        if (key === "y") {
          e.preventDefault();
          redo();
          return;
        }
        return;
      }
      if (e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "v") setTool("select");
      if (key === "b") setTool("draw");
      if (key === "e") setTool("erase");
      if (key === "t") {
        const canvas = canvasRef.current;
        if (!canvas) return;
        setTool("select");
        addTextObject(canvas, { fill: fillColor });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fillColor]);

  const stageW = Math.round(SLIDE_W * scale);
  const stageH = Math.round(SLIDE_H * scale);
  const activeTool = TOOLS.find((t) => t.id === tool) || TOOLS[0];
  const isBold = selectedMeta?.fontWeight === "bold" || selectedMeta?.fontWeight === "700";
  const canUndo = historyRef.current.past.length > 1;
  const canRedo = historyRef.current.future.length > 0;
  void historyTick;

  return (
    <div className="cs-editor">
      <div className="cs-shell">
        <aside className="cs-rail" aria-label="Инструменты">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`cs-icon-btn${tool === t.id ? " is-active" : ""}`}
              onClick={() => handleToolClick(t.id)}
              title={`${t.label}${t.hotkey ? ` (${t.hotkey})` : ""}`}
              aria-label={t.label}
              aria-pressed={tool === t.id}
            >
              {TOOL_ICONS[t.id]}
              <span className="cs-tooltip">{t.label}{t.hotkey ? ` · ${t.hotkey}` : ""}</span>
            </button>
          ))}
          <div className="cs-rail-sep" />
          <button
            type="button"
            className="cs-icon-btn"
            onClick={undo}
            disabled={!canUndo}
            title="Отменить (Ctrl+Z)"
            aria-label="Отменить"
          >
            {ACTION_ICONS.undo}
            <span className="cs-tooltip">Отменить · Ctrl+Z</span>
          </button>
          <button
            type="button"
            className="cs-icon-btn"
            onClick={redo}
            disabled={!canRedo}
            title="Вернуть (Ctrl+Y)"
            aria-label="Вернуть"
          >
            {ACTION_ICONS.redo}
            <span className="cs-tooltip">Вернуть · Ctrl+Y</span>
          </button>
          <div className="cs-rail-sep" />
          <button
            type="button"
            className="cs-icon-btn"
            onClick={pasteFromClipboardButton}
            title="Вставить из буфера (Ctrl+V)"
            aria-label="Вставить из буфера"
          >
            {ACTION_ICONS.paste}
            <span className="cs-tooltip">Вставить · Ctrl+V</span>
          </button>
          <button
            type="button"
            className="cs-icon-btn"
            onClick={insertProductPhoto}
            title="Фото товара / слот"
            aria-label="Фото товара"
          >
            {ACTION_ICONS.photo}
            <span className="cs-tooltip">Фото товара</span>
          </button>
          <button
            type="button"
            className="cs-icon-btn"
            onClick={bringForward}
            disabled={!selectedMeta}
            title="Слой выше"
            aria-label="Слой выше"
          >
            {ACTION_ICONS.forward}
            <span className="cs-tooltip">Слой выше</span>
          </button>
          <button
            type="button"
            className="cs-icon-btn"
            onClick={sendBackward}
            disabled={!selectedMeta}
            title="Слой ниже"
            aria-label="Слой ниже"
          >
            {ACTION_ICONS.backward}
            <span className="cs-tooltip">Слой ниже</span>
          </button>
          <button
            type="button"
            className="cs-icon-btn"
            onClick={deleteSelected}
            disabled={!selectedMeta}
            title="Удалить (Delete)"
            aria-label="Удалить"
          >
            {ACTION_ICONS.trash}
            <span className="cs-tooltip">Удалить</span>
          </button>
          <button
            type="button"
            className="cs-icon-btn"
            onClick={resetStarter}
            title="Стартовый макет"
            aria-label="Стартовый макет"
          >
            {ACTION_ICONS.reset}
            <span className="cs-tooltip">Стартовый макет</span>
          </button>
        </aside>

        <div className="cs-main">
          <div className="cs-options" role="toolbar" aria-label="Параметры инструмента">
            <div className="cs-options-tool">
              <span className="cs-options-icon">{TOOL_ICONS[activeTool.id]}</span>
              <strong>{activeTool.label}</strong>
              {activeTool.hint ? <span className="cs-options-hint">{activeTool.hint}</span> : null}
            </div>

            <div className="cs-options-swatches">
              <label className="cs-swatch" title="Заливка новых фигур">
                <span>Заливка</span>
                <input type="color" value={fillColor} onChange={(e) => setFillColor(e.target.value)} />
              </label>
              <label className="cs-swatch" title="Цвет кисти / обводки">
                <span>Кисть</span>
                <input type="color" value={brushColor} onChange={(e) => setBrushColor(e.target.value)} />
              </label>
              {tool === "draw" ? (
                <label className="cs-size" title="Толщина кисти">
                  <span>Размер {brushSize}</span>
                  <input
                    type="range"
                    min={2}
                    max={48}
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                  />
                </label>
              ) : null}
            </div>

            <div className="cs-smart-fields">
              <span className="cs-smart-label">Поля товара</span>
              {SMART_FIELDS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="cs-field-btn"
                  onClick={() => insertSmartField(f.id)}
                  title={`Вставить: ${f.placeholder}`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {selectedMeta?.isText ? (
              <div className="cs-options-props">
                <select
                  value={selectedMeta.fontFamily}
                  onChange={(e) => mutateActive({ fontFamily: e.target.value })}
                  title="Шрифт"
                  aria-label="Шрифт"
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={10}
                  max={160}
                  value={selectedMeta.fontSize}
                  onChange={(e) => mutateActive({ fontSize: Number(e.target.value) || 24 })}
                  title="Размер шрифта"
                  aria-label="Размер шрифта"
                />
                <input
                  type="color"
                  value={typeof selectedMeta.fill === "string" ? selectedMeta.fill : "#1a242e"}
                  onChange={(e) => mutateActive({ fill: e.target.value })}
                  title="Цвет текста"
                  aria-label="Цвет текста"
                />
                <button
                  type="button"
                  className={`cs-chip${isBold ? " is-on" : ""}`}
                  onClick={() => mutateActive({ fontWeight: isBold ? "normal" : "700" })}
                  title="Жирный"
                >
                  <b>Ж</b>
                </button>
                <button
                  type="button"
                  className={`cs-chip${selectedMeta.fontStyle === "italic" ? " is-on" : ""}`}
                  onClick={() =>
                    mutateActive({ fontStyle: selectedMeta.fontStyle === "italic" ? "normal" : "italic" })
                  }
                  title="Курсив"
                >
                  <i>К</i>
                </button>
                <button
                  type="button"
                  className={`cs-chip${selectedMeta.underline ? " is-on" : ""}`}
                  onClick={() => mutateActive({ underline: !selectedMeta.underline })}
                  title="Подчёркнутый"
                >
                  <u>Ч</u>
                </button>
              </div>
            ) : selectedMeta ? (
              <div className="cs-options-props">
                <label className="cs-swatch">
                  <span>Заливка</span>
                  <input
                    type="color"
                    value={typeof selectedMeta.fill === "string" ? selectedMeta.fill : "#0f6e56"}
                    onChange={(e) => mutateActive({ fill: e.target.value })}
                  />
                </label>
                <label className="cs-swatch">
                  <span>Обводка</span>
                  <input
                    type="color"
                    value={typeof selectedMeta.stroke === "string" ? selectedMeta.stroke : "#1a242e"}
                    onChange={(e) =>
                      mutateActive({
                        stroke: e.target.value,
                        strokeWidth: Math.max(1, selectedMeta.strokeWidth || 2),
                      })
                    }
                  />
                </label>
                <label className="cs-size">
                  <span>Обводка {selectedMeta.strokeWidth || 0}</span>
                  <input
                    type="range"
                    min={0}
                    max={40}
                    value={selectedMeta.strokeWidth || 0}
                    onChange={(e) => mutateActive({ strokeWidth: Number(e.target.value) || 0 })}
                  />
                </label>
                <label className="cs-size">
                  <span>Непрозр. {Math.round((selectedMeta.opacity || 1) * 100)}%</span>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={selectedMeta.opacity}
                    onChange={(e) => mutateActive({ opacity: Number(e.target.value) })}
                  />
                </label>
              </div>
            ) : (
              <p className="cs-options-empty">
                {pasteStatus ||
                  "Ctrl+V или перетащите картинку на холст. Плейсхолдеры {{name}}, {{price}}, {{brand}} — при генерации."}
              </p>
            )}
          </div>

          <div
            className="cs-workspace"
            ref={workspaceRef}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }}
            onDrop={onWorkspaceDrop}
          >
            <div className="cs-stage" style={{ width: stageW, height: stageH }}>
              <div className="cs-stage-inner" style={{ transform: `scale(${scale})` }}>
                <canvas ref={hostRef} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
