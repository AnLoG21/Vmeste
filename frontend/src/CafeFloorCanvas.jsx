import { useMemo, useRef, useState } from "react";

const GRID = 20;

function snap(v, grid = GRID) {
  return Math.round(v / grid) * grid;
}

function orthoSnap(x1, y1, x2, y2) {
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  if (dx > dy * 2) return { x2, y2: y1 };
  if (dy > dx * 2) return { x2: x1, y2 };
  return { x2, y2 };
}

function ensureDrawingIds(drawings) {
  return (Array.isArray(drawings) ? drawings : []).map((d, i) =>
    d.id ? d : { ...d, id: `${d.type || "d"}-${i}-${Math.round((d.x1 || d.x || 0) + (d.y1 || d.y || 0))}` },
  );
}

function rectChairRects(n) {
  const counts = [0, 0, 0, 0];
  for (let i = 0; i < n; i += 1) counts[i % 4] += 1;
  const chairs = [];
  const place = (side, idx, total) => {
    const t = total === 1 ? 0.5 : idx / (total - 1);
    if (side === 0) chairs.push({ x: 14 + t * 62, y: 2 });
    if (side === 1) chairs.push({ x: 14 + t * 62, y: 54 });
    if (side === 2) chairs.push({ x: 2, y: 12 + t * 42 });
    if (side === 3) chairs.push({ x: 78, y: 12 + t * 42 });
  };
  counts.forEach((c, side) => {
    for (let i = 0; i < c; i += 1) place(side, i, c);
  });
  return chairs;
}

function TableIcon({ seats = 2, label = "", shape = "round", selected = false }) {
  const n = Math.max(1, Math.min(12, Number(seats) || 2));
  const fill = selected ? "#ffd7b0" : "#f0c49a";
  if (shape === "sofa") {
    return (
      <svg viewBox="0 0 100 70" width="100%" height="100%" aria-hidden="true">
        <rect x="8" y="18" width="84" height="36" rx="10" fill={fill} stroke="#c45c00" strokeWidth="2.5" />
        <rect x="12" y="8" width="22" height="14" rx="4" fill="#8d5a2b" />
        <rect x="66" y="8" width="22" height="14" rx="4" fill="#8d5a2b" />
        {Array.from({ length: Math.min(n, 6) }).map((_, i) => (
          <rect key={i} x={14 + i * 12} y="52" width="10" height="8" rx="2" fill="#8d5a2b" />
        ))}
        <text x="50" y="40" textAnchor="middle" fontSize="9" fontWeight="700" fill="#5a3a22">
          {String(label).slice(0, 10)}
        </text>
      </svg>
    );
  }
  if (shape === "rect") {
    return (
      <svg viewBox="0 0 90 66" width="100%" height="100%" aria-hidden="true">
        {rectChairRects(n).map((c, i) => (
          <rect key={i} x={c.x} y={c.y} width="10" height="8" rx="2" fill="#8d5a2b" />
        ))}
        <rect x="16" y="14" width="58" height="38" rx="6" fill={fill} stroke="#c45c00" strokeWidth="2.5" />
        <text x="45" y="38" textAnchor="middle" fontSize="9" fontWeight="700" fill="#5a3a22">
          {String(label).slice(0, 10)}
        </text>
      </svg>
    );
  }
  const chairs = [];
  for (let i = 0; i < n; i += 1) {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const cx = 40 + Math.cos(angle) * 28;
    const cy = 40 + Math.sin(angle) * 28;
    chairs.push(
      <rect
        key={i}
        x={cx - 5}
        y={cy - 4}
        width="10"
        height="8"
        rx="2"
        fill="#8d5a2b"
        transform={`rotate(${(angle * 180) / Math.PI + 90} ${cx} ${cy})`}
      />,
    );
  }
  return (
    <svg viewBox="0 0 80 80" width="100%" height="100%" aria-hidden="true">
      {chairs}
      <ellipse cx="40" cy="40" rx="18" ry="14" fill={fill} stroke="#c45c00" strokeWidth="2.5" />
      <text x="40" y="44" textAnchor="middle" fontSize="9" fontWeight="700" fill="#5a3a22">
        {String(label).slice(0, 8)}
      </text>
    </svg>
  );
}

export function qrImageUrl(data, size = 180) {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="100%" height="100%" fill="#fff"/><text x="50%" y="50%" text-anchor="middle" fill="#999" font-size="12">QR…</text></svg>`,
  )}`;
}

export { QrImg } from "./qrUtils.jsx";

export default function CafeFloorCanvas({
  floor,
  selectedTableId,
  selectedWallId,
  selectedZoneId,
  tool,
  zoom = 1,
  onSelectTable,
  onSelectWall,
  onSelectZone,
  onPatchFloor,
  onPatchTable,
  onDeleteTable,
}) {
  const canvasRef = useRef(null);
  const innerRef = useRef(null);
  const [wallDraft, setWallDraft] = useState(null);
  const [guide, setGuide] = useState(null);
  const drawings = useMemo(() => ensureDrawingIds(floor?.drawings), [floor?.drawings]);

  function floorPoint(e) {
    const inner = innerRef.current;
    if (!inner || !floor) return { x: 0, y: 0 };
    const rect = inner.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: 0, y: 0 };
    const src = e.touches?.[0] || e.changedTouches?.[0] || e;
    const cx = src.clientX ?? 0;
    const cy = src.clientY ?? 0;
    return {
      x: Math.max(0, Math.min(floor.width, ((cx - rect.left) / rect.width) * floor.width)),
      y: Math.max(0, Math.min(floor.height, ((cy - rect.top) / rect.height) * floor.height)),
    };
  }

  function nearestEndpoint(p, excludeWallId = null) {
    let best = null;
    let bestDist = 16;
    drawings.forEach((d) => {
      if (d.type !== "wall" || d.id === excludeWallId) return;
      [
        { x: d.x1, y: d.y1 },
        { x: d.x2, y: d.y2 },
      ].forEach((pt) => {
        const dist = Math.hypot(pt.x - p.x, pt.y - p.y);
        if (dist < bestDist) {
          bestDist = dist;
          best = pt;
        }
      });
    });
    return best;
  }

  function hitWall(p, tolerance = 14) {
    let best = null;
    let bestDist = tolerance;
    drawings.forEach((d) => {
      if (d.type !== "wall") return;
      const dx = d.x2 - d.x1;
      const dy = d.y2 - d.y1;
      const len2 = dx * dx + dy * dy || 1;
      let t = ((p.x - d.x1) * dx + (p.y - d.y1) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const proj = { x: d.x1 + t * dx, y: d.y1 + t * dy };
      const dist = Math.hypot(proj.x - p.x, proj.y - p.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = d;
      }
    });
    return best;
  }

  function hitZone(p) {
    for (let i = drawings.length - 1; i >= 0; i -= 1) {
      const d = drawings[i];
      if (d.type !== "zone") continue;
      if (p.x >= d.x && p.x <= d.x + d.w && p.y >= d.y && p.y <= d.y + d.h) return d;
    }
    return null;
  }

  function hitTable(p) {
    for (let i = (floor.tables || []).length - 1; i >= 0; i -= 1) {
      const t = floor.tables[i];
      const w = t.width || (t.shape === "sofa" ? 110 : t.shape === "rect" ? 100 : 88);
      const h = t.height || (t.shape === "sofa" ? 78 : t.shape === "rect" ? 72 : 88);
      if (p.x >= t.x && p.x <= t.x + w && p.y >= t.y && p.y <= t.y + h) return t;
    }
    return null;
  }

  function saveDrawings(next) {
    onPatchFloor(floor.id, { drawings: next });
  }

  function eraseAt(p) {
    const wall = hitWall(p, 18);
    if (wall) {
      saveDrawings(drawings.filter((d) => d.id !== wall.id));
      if (selectedWallId === wall.id) onSelectWall(null);
      return;
    }
    const zone = hitZone(p);
    if (zone) {
      saveDrawings(drawings.filter((d) => d.id !== zone.id));
      if (selectedZoneId === zone.id) onSelectZone?.(null);
      return;
    }
    const table = hitTable(p);
    if (table && onDeleteTable) onDeleteTable(table.id);
  }

  function onCanvasMouseDown(e) {
    if (!floor) return;
    if (e.target.closest(".cafe-table-node") || e.target.closest(".cafe-wall-handle")) return;
    const raw = floorPoint(e);
    const p = { x: snap(raw.x), y: snap(raw.y) };
    const anchored = nearestEndpoint(p) || p;

    if (tool === "wall") {
      onSelectWall(null);
      onSelectZone?.(null);
      onSelectTable(null);
      setWallDraft({ id: `w-${Date.now()}`, type: "wall", x1: anchored.x, y1: anchored.y, x2: anchored.x, y2: anchored.y });
      return;
    }
    if (tool === "erase") {
      eraseAt(raw);
      return;
    }

    const zone = hitZone(raw);
    if (zone) {
      onSelectZone?.(zone.id);
      onSelectWall(null);
      onSelectTable(null);
      return;
    }
    const wall = hitWall(raw);
    if (wall) {
      onSelectWall(wall.id);
      onSelectZone?.(null);
      onSelectTable(null);
      if (tool === "move") startWallBodyDrag(e, wall);
      return;
    }
    onSelectWall(null);
    onSelectZone?.(null);
  }

  function onCanvasMouseMove(e) {
    if (!wallDraft) return;
    const raw = floorPoint(e);
    let x2 = snap(raw.x);
    let y2 = snap(raw.y);
    const ortho = orthoSnap(wallDraft.x1, wallDraft.y1, x2, y2);
    x2 = snap(ortho.x2);
    y2 = snap(ortho.y2);
    const join = nearestEndpoint({ x: x2, y: y2 });
    if (join) {
      x2 = join.x;
      y2 = join.y;
    }
    setGuide({
      horizontal: Math.abs(y2 - wallDraft.y1) < 1,
      vertical: Math.abs(x2 - wallDraft.x1) < 1,
    });
    setWallDraft((d) => (d ? { ...d, x2, y2 } : null));
  }

  function onCanvasMouseUp() {
    if (!wallDraft || !floor) return;
    const len = Math.hypot(wallDraft.x2 - wallDraft.x1, wallDraft.y2 - wallDraft.y1);
    if (len >= GRID / 2) {
      saveDrawings([...drawings, wallDraft]);
      onSelectWall(wallDraft.id);
    }
    setWallDraft(null);
    setGuide(null);
  }

  function startWallBodyDrag(e, wall) {
    e.preventDefault();
    const start = floorPoint(e);
    const ox1 = wall.x1;
    const oy1 = wall.y1;
    const ox2 = wall.x2;
    const oy2 = wall.y2;
    function onMove(ev) {
      const p = floorPoint(ev);
      const dx = snap(p.x - start.x);
      const dy = snap(p.y - start.y);
      const next = drawings.map((d) => {
        if (d.id !== wall.id) return d;
        return {
          ...d,
          x1: Math.max(0, Math.min(floor.width, ox1 + dx)),
          y1: Math.max(0, Math.min(floor.height, oy1 + dy)),
          x2: Math.max(0, Math.min(floor.width, ox2 + dx)),
          y2: Math.max(0, Math.min(floor.height, oy2 + dy)),
        };
      });
      onPatchFloor(floor.id, { drawings: next });
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  function startHandleDrag(e, wallId, which) {
    e.preventDefault();
    e.stopPropagation();
    onSelectWall(wallId);
    function onMove(ev) {
      const raw = floorPoint(ev);
      let x = snap(raw.x);
      let y = snap(raw.y);
      const wall = drawings.find((d) => d.id === wallId);
      if (!wall) return;
      const fixed = which === "a" ? { x: wall.x2, y: wall.y2 } : { x: wall.x1, y: wall.y1 };
      const ortho = orthoSnap(fixed.x, fixed.y, x, y);
      x = snap(ortho.x2);
      y = snap(ortho.y2);
      const join = nearestEndpoint({ x, y }, wallId);
      if (join) {
        x = join.x;
        y = join.y;
      }
      const next = drawings.map((d) => {
        if (d.id !== wallId) return d;
        if (which === "a") return { ...d, x1: x, y1: y };
        return { ...d, x2: x, y2: y };
      });
      onPatchFloor(floor.id, { drawings: next });
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  function startTableDrag(e, table) {
    if (tool === "wall" || tool === "erase") return;
    e.preventDefault();
    e.stopPropagation();
    onSelectTable(table.id);
    onSelectWall(null);
    onSelectZone?.(null);
    const start = floorPoint(e);
    const ox = table.x;
    const oy = table.y;
    const node = e.currentTarget;
    function onMove(ev) {
      const p = floorPoint(ev);
      const nx = snap(Math.max(0, Math.min(floor.width - (table.width || 88), ox + p.x - start.x)));
      const ny = snap(Math.max(0, Math.min(floor.height - (table.height || 88), oy + p.y - start.y)));
      node.style.left = `${nx}px`;
      node.style.top = `${ny}px`;
      node.dataset.nx = String(nx);
      node.dataset.ny = String(ny);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      const nx = Number(node.dataset.nx ?? ox);
      const ny = Number(node.dataset.ny ?? oy);
      onPatchTable(table.id, { x: nx, y: ny });
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  if (!floor) return null;
  const displayW = Math.min(floor.width * zoom, typeof window !== "undefined" ? window.innerWidth - 32 : floor.width * zoom);
  const displayH = Math.min(floor.height * zoom, 520 * zoom);

  return (
    <div
      ref={canvasRef}
      className={`cafe-floor-canvas tool-${tool}`}
      style={{
        width: "100%",
        maxWidth: displayW,
        height: displayH,
        backgroundSize: `${GRID * zoom}px ${GRID * zoom}px`,
      }}
      onPointerDown={onCanvasMouseDown}
      onPointerMove={onCanvasMouseMove}
      onPointerUp={onCanvasMouseUp}
      onPointerLeave={onCanvasMouseUp}
      onPointerCancel={onCanvasMouseUp}
    >
      <div
        ref={innerRef}
        className="cafe-floor-inner"
        style={{ width: floor.width, height: floor.height, transform: `scale(${zoom})` }}
      >
        <svg className="cafe-floor-drawings" viewBox={`0 0 ${floor.width} ${floor.height}`} preserveAspectRatio="none">
          {guide?.horizontal && wallDraft ? (
            <line x1={0} y1={wallDraft.y1} x2={floor.width} y2={wallDraft.y1} stroke="#74b9ff" strokeWidth="1" strokeDasharray="4 4" />
          ) : null}
          {guide?.vertical && wallDraft ? (
            <line x1={wallDraft.x1} y1={0} x2={wallDraft.x1} y2={floor.height} stroke="#74b9ff" strokeWidth="1" strokeDasharray="4 4" />
          ) : null}
          {drawings.map((d) =>
            d.type === "wall" ? (
              <g key={d.id}>
                <line
                  x1={d.x1}
                  y1={d.y1}
                  x2={d.x2}
                  y2={d.y2}
                  stroke={selectedWallId === d.id ? "#c45c00" : "#5a3a22"}
                  strokeWidth={selectedWallId === d.id ? 8 : 6}
                  strokeLinecap="round"
                />
                <circle
                  className={`cafe-wall-anchor${selectedWallId === d.id ? " is-selected" : ""}`}
                  cx={d.x1}
                  cy={d.y1}
                  r={selectedWallId === d.id ? 6 : 4}
                />
                <circle
                  className={`cafe-wall-anchor${selectedWallId === d.id ? " is-selected" : ""}`}
                  cx={d.x2}
                  cy={d.y2}
                  r={selectedWallId === d.id ? 6 : 4}
                />
              </g>
            ) : d.type === "zone" ? (
              <g key={d.id}>
                <rect
                  x={d.x}
                  y={d.y}
                  width={d.w}
                  height={d.h}
                  fill={d.color || "rgba(196,92,0,0.08)"}
                  stroke={selectedZoneId === d.id ? "#c45c00" : "#c45c00"}
                  strokeWidth={selectedZoneId === d.id ? 2.5 : 1.5}
                  strokeDasharray="6 4"
                />
                {d.name ? (
                  <text x={d.x + 8} y={d.y + 18} fill="#8d3e00" fontSize="12" fontWeight="700">
                    {d.name}
                  </text>
                ) : null}
              </g>
            ) : null,
          )}
          {wallDraft ? (
            <g>
              <line
                x1={wallDraft.x1}
                y1={wallDraft.y1}
                x2={wallDraft.x2}
                y2={wallDraft.y2}
                stroke="#c45c00"
                strokeWidth="5"
                strokeDasharray="8 6"
                strokeLinecap="round"
              />
              <circle className="cafe-wall-anchor is-selected" cx={wallDraft.x1} cy={wallDraft.y1} r={5} />
              <circle className="cafe-wall-anchor is-selected" cx={wallDraft.x2} cy={wallDraft.y2} r={5} />
            </g>
          ) : null}
        </svg>

        {selectedWallId &&
          drawings
            .filter((d) => d.id === selectedWallId && d.type === "wall")
            .map((d) => (
              <div key={`${d.id}-handles`}>
                <button
                  type="button"
                  className="cafe-wall-handle"
                  style={{ left: d.x1 - 7, top: d.y1 - 7 }}
                  onPointerDown={(e) => startHandleDrag(e, d.id, "a")}
                  aria-label="Точка A"
                />
                <button
                  type="button"
                  className="cafe-wall-handle"
                  style={{ left: d.x2 - 7, top: d.y2 - 7 }}
                  onPointerDown={(e) => startHandleDrag(e, d.id, "b")}
                  aria-label="Точка B"
                />
              </div>
            ))}

        {(floor.tables || []).map((t) => (
          <div
            key={t.id}
            className={`cafe-table-node${selectedTableId === t.id ? " is-selected" : ""}`}
            style={{
              left: t.x,
              top: t.y,
              width: t.width || (t.shape === "sofa" ? 110 : t.shape === "rect" ? 100 : 88),
              height: t.height || (t.shape === "sofa" ? 78 : t.shape === "rect" ? 72 : 88),
              transform: `rotate(${t.rotation || 0}deg)`,
            }}
            onPointerDown={(e) => startTableDrag(e, t)}
            onClick={() => {
              onSelectTable(t.id);
              onSelectWall(null);
              onSelectZone?.(null);
            }}
          >
            <TableIcon seats={t.seats} label={t.label} shape={t.shape || "round"} selected={selectedTableId === t.id} />
          </div>
        ))}
      </div>
    </div>
  );
}

export { GRID, snap, TableIcon };
