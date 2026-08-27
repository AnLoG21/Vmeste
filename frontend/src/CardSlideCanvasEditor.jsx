import { useEffect, useRef, useState } from "react";
import { PencilBrush } from "fabric";
import {
  FONT_OPTIONS,
  SLIDE_H,
  SLIDE_W,
  TOOLS,
  addProductPhotoSlot,
  addShape,
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
  const canvasRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const skipEmitRef = useRef(false);
  const [tool, setTool] = useState("select");
  const [brushSize, setBrushSize] = useState(8);
  const [brushColor, setBrushColor] = useState("#1a242e");
  const [fillColor, setFillColor] = useState("#0f6e56");
  const [selectedMeta, setSelectedMeta] = useState(null);
  const [scale, setScale] = useState(0.42);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const updateScale = () => {
      const host = hostRef.current?.parentElement;
      const maxW = Math.min(host?.clientWidth || 640, 900);
      const maxH = Math.min(window.innerHeight * 0.72, 1100);
      const s = Math.min(maxW / SLIDE_W, maxH / SLIDE_H);
      setScale(Math.max(0.32, Math.min(s, 0.85)));
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
      onChangeRef.current?.(serializeCanvas(canvas));
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
      const initial = hasCanvasScene(canvasJson)
        ? canvasJson
        : buildStarterCanvasJson(layout, style);
      await loadSceneOntoCanvas(canvas, initial);
      skipEmitRef.current = false;
      if (!hasCanvasScene(canvasJson)) scheduleEmit();
    })();

    return () => {
      clearTimeout(emitTimer);
      canvas.dispose();
      canvasRef.current = null;
    };
    // mount once per editor open — parent remounts via key
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
      onChangeRef.current?.(serializeCanvas(canvas));
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
    onChangeRef.current?.(serializeCanvas(canvas));
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
    onChangeRef.current?.(serializeCanvas(canvas));
  }

  function deleteSelected() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObjects();
    if (!active.length) return;
    active.forEach((o) => canvas.remove(o));
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    onChangeRef.current?.(serializeCanvas(canvas));
  }

  function bringForward() {
    const canvas = canvasRef.current;
    const obj = canvas?.getActiveObject();
    if (!canvas || !obj) return;
    canvas.bringObjectForward(obj);
    canvas.requestRenderAll();
    onChangeRef.current?.(serializeCanvas(canvas));
  }

  function sendBackward() {
    const canvas = canvasRef.current;
    const obj = canvas?.getActiveObject();
    if (!canvas || !obj) return;
    canvas.sendObjectBackwards(obj);
    canvas.requestRenderAll();
    onChangeRef.current?.(serializeCanvas(canvas));
  }

  function resetStarter() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!window.confirm("Сбросить сцену к стартовому макету? Текущие объекты пропадут.")) return;
    (async () => {
      skipEmitRef.current = true;
      await loadSceneOntoCanvas(canvas, buildStarterCanvasJson(layout, style));
      skipEmitRef.current = false;
      onChangeRef.current?.(serializeCanvas(canvas));
    })();
  }

  useEffect(() => {
    const onKey = (e) => {
      if (!canvasRef.current) return;
      const tag = String(e.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || e.target?.isContentEditable) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const stageW = Math.round(SLIDE_W * scale);
  const stageH = Math.round(SLIDE_H * scale);

  return (
    <div className="cs-editor">
      <div className="cs-toolbar" role="toolbar" aria-label="Инструменты слайда">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`cs-tool${tool === t.id ? " is-active" : ""}`}
            onClick={() => handleToolClick(t.id)}
            title={t.label}
          >
            {t.label}
          </button>
        ))}
        <span className="cs-toolbar-sep" />
        <label className="cs-mini">
          Заливка
          <input type="color" value={fillColor} onChange={(e) => setFillColor(e.target.value)} />
        </label>
        <label className="cs-mini">
          Кисть
          <input type="color" value={brushColor} onChange={(e) => setBrushColor(e.target.value)} />
        </label>
        <label className="cs-mini">
          Толщина
          <input
            type="range"
            min={2}
            max={48}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="cs-actions">
        <button type="button" className="ghost-btn" onClick={insertProductPhoto}>
          Фото товара / слот
        </button>
        <button type="button" className="ghost-btn" onClick={bringForward} disabled={!selectedMeta}>
          Выше
        </button>
        <button type="button" className="ghost-btn" onClick={sendBackward} disabled={!selectedMeta}>
          Ниже
        </button>
        <button type="button" className="ghost-btn" onClick={deleteSelected} disabled={!selectedMeta}>
          Удалить
        </button>
        <button type="button" className="ghost-btn" onClick={resetStarter}>
          Стартовый макет
        </button>
      </div>

      {selectedMeta?.isText ? (
        <div className="cs-text-panel">
          <label>
            Шрифт
            <select
              value={selectedMeta.fontFamily}
              onChange={(e) => mutateActive({ fontFamily: e.target.value })}
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Размер
            <input
              type="number"
              min={10}
              max={160}
              value={selectedMeta.fontSize}
              onChange={(e) => mutateActive({ fontSize: Number(e.target.value) || 24 })}
            />
          </label>
          <label>
            Цвет
            <input
              type="color"
              value={typeof selectedMeta.fill === "string" ? selectedMeta.fill : "#1a242e"}
              onChange={(e) => mutateActive({ fill: e.target.value })}
            />
          </label>
          <button
            type="button"
            className={`cs-toggle${selectedMeta.fontWeight === "bold" || selectedMeta.fontWeight === "700" ? " is-on" : ""}`}
            onClick={() =>
              mutateActive({
                fontWeight:
                  selectedMeta.fontWeight === "bold" || selectedMeta.fontWeight === "700" ? "normal" : "700",
              })
            }
          >
            Жирный
          </button>
          <button
            type="button"
            className={`cs-toggle${selectedMeta.fontStyle === "italic" ? " is-on" : ""}`}
            onClick={() =>
              mutateActive({ fontStyle: selectedMeta.fontStyle === "italic" ? "normal" : "italic" })
            }
          >
            Курсив
          </button>
          <button
            type="button"
            className={`cs-toggle${selectedMeta.underline ? " is-on" : ""}`}
            onClick={() => mutateActive({ underline: !selectedMeta.underline })}
          >
            Подчёркнутый
          </button>
        </div>
      ) : selectedMeta ? (
        <div className="cs-text-panel">
          <label>
            Заливка
            <input
              type="color"
              value={typeof selectedMeta.fill === "string" ? selectedMeta.fill : "#0f6e56"}
              onChange={(e) => mutateActive({ fill: e.target.value })}
            />
          </label>
          <label>
            Обводка
            <input
              type="color"
              value={typeof selectedMeta.stroke === "string" ? selectedMeta.stroke : "#1a242e"}
              onChange={(e) => mutateActive({ stroke: e.target.value, strokeWidth: Math.max(1, selectedMeta.strokeWidth || 2) })}
            />
          </label>
          <label>
            Толщ. обводки
            <input
              type="number"
              min={0}
              max={40}
              value={selectedMeta.strokeWidth || 0}
              onChange={(e) => mutateActive({ strokeWidth: Number(e.target.value) || 0 })}
            />
          </label>
          <label>
            Прозрачность
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
        <p className="muted small cs-hint">
          Тяните углы объекта, чтобы масштабировать. Delete — удалить. «Стереть» — клик по объекту. Плейсхолдеры{" "}
          {"{{name}}"}, {"{{price}}"}, {"{{brand}}"} подставятся при генерации. Слот «фото товара» заменяется реальным
          фото.
        </p>
      )}

      <div className="cs-stage-wrap">
        <div className="cs-stage" style={{ width: stageW, height: stageH }}>
          <div className="cs-stage-inner" style={{ transform: `scale(${scale})` }}>
            <canvas ref={hostRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
