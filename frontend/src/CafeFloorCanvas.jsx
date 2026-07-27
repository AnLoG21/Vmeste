import { useMemo, useRef, useState } from "react";

const GRID = 20;

function snap(v, grid = GRID) {
  return Math.round(v / grid) * grid;
}

function orthoSnap(x1, y1, x2, y2) {
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  if (dx > dy * 2) return { x2: x2, y2: y1 };
  if (dy > dx * 2) return { x2: x1, y2: y2 };
  return { x2, y2 };
}

function ensureWallIds(drawings) {
  return (Array.isArray(drawings) ? drawings : []).map((d, i) =>
    d.id ? d : { ...d, id: `w-${i}-${Math.round((d.x1 || 0) + (d.y1 || 0))}` },
  );
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
    const chairs = [];
    for (let i = 0; i < n; i += 1) {
      const side = i % 4;
      const idx = Math.floor(i / 4);
      let x = 40;
      let y = 28;
      if (side === 0) {
        x = 18 + idx * 14;
        y = 4;
      } else if (side === 1) {
        x = 18 + idx * 14;
        y = 50;
      } else if (side === 2) {
        x = 4;
        y = 16 + idx * 12;
      } else {
        x = 76;
        y = 16 + idx * 12;
      }
      chairs.push(<rect key={i} x={x} y={y} width="10" height="8" rx="2" fill="#8d5a2b" />);
    }
    return (
      <svg viewBox="0 0 90 66" width="100%" height="100%" aria-hidden="true">
        {chairs}
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
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(data)}`;
}

/**
 * Floor canvas + wall editing.
 * props: floor, selectedTableId, selectedWallId, tool, zoom, onSelectTable, onSelectWall,
 * onPatchFloor, onPatchTable, onDraftHint
 */
export default function CafeFloorCanvas({
  floor,
  selectedTableId,
  selectedWallId,
  tool,
  zoom = 1,
  onSelectTable,
  onSelectWall,
  onPatchFloor,
  onPatchTable,
}) {
  const canvasRef = useRef(null);
  const [wallDraft, setWallDraft] = useState(null);
  const [guide, setGuide] = useState(null);
  const drawings = useMemo(() => ensureWallIds(floor?.drawings), [floor?.drawings]);

  function canvasPoint(e) {
    const el = canvasRef.current;
    if (!el || !floor) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const scaleX = floor.width / rect.width;
    const scaleY = floor.height / rect.height;
    return {
      x: Math.max(0, Math.min(floor.width, (e.clientX - rect.left) * scaleX)),
      y: Math.max(0, Math.min(floor.height, (e.clientY - rect.top) * scaleY)),
    };
  }

  function nearestEndpoint(p, excludeWallId = null) {
    let best = null;
    let bestDist = 14;
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

  function hitWall(p) {
    let best = null;
    let bestDist = 10;
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

  function saveDrawings(next) {
    onPatchFloor(floor.id, { drawings: next });
  }

  function onCanvasMouseDown(e) {
    if (!floor) return;
    if (e.target.closest(".cafe-table-node") || e.target.closest(".cafe-wall-handle")) return;
    const raw = canvasPoint(e);
    const p = { x: snap(raw.x), y: snap(raw.y) };
    const anchored = nearestEndpoint(p) || p;

    if (tool === "wall") {
      onSelectWall(null);
      setWallDraft({ id: `w-${Date.now()}`, type: "wall", x1: anchored.x, y1: anchored.y, x2: anchored.x, y2: anchored.y });
      return;
    }
    if (tool === "erase") {
      const wall = hitWall(raw);
      if (wall) saveDrawings(drawings.filter((d) => d.id !== wall.id));
      return;
    }
    // select
    const wall = hitWall(raw);
    if (wall) {
      onSelectWall(wall.id);
      onSelectTable(null);
    } else {
      onSelectWall(null);
    }
  }

  function onCanvasMouseMove(e) {
    if (!wallDraft) return;
    const raw = canvasPoint(e);
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
    if (len >= GRID) {
      saveDrawings([...drawings, wallDraft]);
      onSelectWall(wallDraft.id);
    }
    setWallDraft(null);
    setGuide(null);
  }

  function startHandleDrag(e, wallId, which) {
    e.preventDefault();
    e.stopPropagation();
    onSelectWall(wallId);
    function onMove(ev) {
      const raw = canvasPoint(ev);
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
      // optimistic local via parent patch
      onPatchFloor(floor.id, { drawings: next });
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function startTableDrag(e, table) {
    if (tool === "wall" || tool === "erase") return;
    e.preventDefault();
    e.stopPropagation();
    onSelectTable(table.id);
    onSelectWall(null);
    const startX = e.clientX;
    const startY = e.clientY;
    const ox = table.x;
    const oy = table.y;
    const node = e.currentTarget;
    function onMove(ev) {
      const nx = snap(Math.max(0, ox + (ev.clientX - startX) / zoom));
      const ny = snap(Math.max(0, oy + (ev.clientY - startY) / zoom));
      node.style.left = `${nx}px`;
      node.style.top = `${ny}px`;
      node.dataset.nx = String(nx);
      node.dataset.ny = String(ny);
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      const nx = Number(node.dataset.nx ?? ox);
      const ny = Number(node.dataset.ny ?? oy);
      onPatchTable(table.id, { x: nx, y: ny });
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  if (!floor) return null;
  const width = Math.round(floor.width * zoom);
  const height = Math.round(Math.min(floor.height, 520) * zoom);

  return (
    <div
      ref={canvasRef}
      className={`cafe-floor-canvas tool-${tool}`}
      style={{
        width: "100%",
        maxWidth: width,
        height,
        backgroundSize: `${GRID * zoom}px ${GRID * zoom}px`,
      }}
      onMouseDown={onCanvasMouseDown}
      onMouseMove={onCanvasMouseMove}
      onMouseUp={onCanvasMouseUp}
      onMouseLeave={onCanvasMouseUp}
    >
      <div className="cafe-floor-inner" style={{ width: floor.width, height: floor.height, transform: `scale(${zoom})` }}>
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
                <line x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2} stroke="transparent" strokeWidth="14" strokeLinecap="round" />
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
              <rect
                key={d.id}
                x={d.x}
                y={d.y}
                width={d.w}
                height={d.h}
                fill={d.color || "rgba(196,92,0,0.08)"}
                stroke="#c45c00"
                strokeDasharray="6 4"
              />
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
                  onMouseDown={(e) => startHandleDrag(e, d.id, "a")}
                  aria-label="Точка A"
                />
                <button
                  type="button"
                  className="cafe-wall-handle"
                  style={{ left: d.x2 - 7, top: d.y2 - 7 }}
                  onMouseDown={(e) => startHandleDrag(e, d.id, "b")}
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
            onMouseDown={(e) => startTableDrag(e, t)}
            onClick={() => {
              onSelectTable(t.id);
              onSelectWall(null);
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
