import { useEffect, useRef, useState } from "react";
import { loadYandexMaps } from "./yandexMapsLoader.js";

const COLORS = ["#ff6a00", "#2f5d50", "#1565c0", "#8b3a2a", "#7b1fa2", "#c62828"];

function newId() {
  return `z_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function ringFromPolygon(poly) {
  const ring = poly?.geometry?.getCoordinates?.()?.[0] || [];
  return ring
    .map((p) => {
      if (!p || p.length < 2) return null;
      const a = Number(p[0]);
      const b = Number(p[1]);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      return [a, b];
    })
    .filter(Boolean);
}

function EditContourIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="currentColor">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="currentColor">
      <path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
    </svg>
  );
}

/**
 * Интерактивные зоны доставки на Яндекс.Карте (полигоны).
 * coords: [lat, lon] как в API Яндекс.Карт 2.1.
 */
export default function CafeDeliveryZonesEditor({
  zones = [],
  onChange,
  centerLat = 55.751244,
  centerLon = 37.618423,
  defaultFee = "0",
  defaultMinOrder = "0",
}) {
  const mapHostRef = useRef(null);
  const mapRef = useRef(null);
  const polygonsRef = useRef({});
  const draftPolyRef = useRef(null);
  const geometryBusyRef = useRef(null); // id зоны, у которой сейчас рисуем/правим контур — не перезаписывать с props
  const zonesRef = useRef(zones);
  const draftRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [drawing, setDrawing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  /** Черновик зоны, пока ставятся точки (ещё нет в zones) */
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    zonesRef.current = zones;
  }, [zones]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    let cancelled = false;
    setMapError("");
    loadYandexMaps()
      .then((ymaps) => {
        if (cancelled || !ymaps || !mapHostRef.current) return;
        ymaps.ready(() => {
          if (cancelled || mapRef.current) return;
          const map = new ymaps.Map(mapHostRef.current, {
            center: [Number(centerLat) || 55.751244, Number(centerLon) || 37.618423],
            zoom: 13,
            controls: ["zoomControl", "searchControl"],
          });
          map.controls.add(
            new ymaps.control.GeolocationControl({
              options: { provider: "browser" },
            }),
          );
          mapRef.current = map;
          setMapReady(true);
        });
      })
      .catch(() => {
        if (!cancelled) setMapError("Не удалось загрузить Яндекс.Карты. Проверьте ключ API.");
      });
    return () => {
      cancelled = true;
      Object.values(polygonsRef.current).forEach((p) => {
        try {
          p.editor?.stopEditing?.();
          p.editor?.stopDrawing?.();
        } catch {
          /* ignore */
        }
      });
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
      polygonsRef.current = {};
      draftPolyRef.current = null;
      geometryBusyRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function syncPolygonsFromZones(list) {
    const ymaps = window.ymaps;
    const map = mapRef.current;
    if (!ymaps || !map) return;
    const busy = geometryBusyRef.current;
    const keep = new Set((list || []).map((z) => z.id));
    if (busy) keep.add(busy);
    Object.keys(polygonsRef.current).forEach((id) => {
      if (!keep.has(id)) {
        map.geoObjects.remove(polygonsRef.current[id]);
        delete polygonsRef.current[id];
      }
    });
    (list || []).forEach((z) => {
      const coords = (z.polygon || []).map((p) => [p[0], p[1]]);
      if (coords.length < 3) return;
      let poly = polygonsRef.current[z.id];
      if (!poly) {
        poly = new ymaps.Polygon(
          [coords],
          { hintContent: z.name },
          {
            fillColor: `${z.color || "#ff6a00"}55`,
            strokeColor: z.color || "#ff6a00",
            strokeWidth: 2,
            opacity: 0.85,
            editorDrawingCursor: "crosshair",
          },
        );
        poly.events.add("click", () => {
          if (geometryBusyRef.current) return;
          setSelectedId(z.id);
        });
        map.geoObjects.add(poly);
        polygonsRef.current[z.id] = poly;
      } else if (z.id !== busy) {
        // Не трогаем геометрию пока пользователь правит/рисует — иначе откат «через пару секунд»
        try {
          poly.geometry.setCoordinates([coords]);
          poly.options.set("fillColor", `${z.color || "#ff6a00"}55`);
          poly.options.set("strokeColor", z.color || "#ff6a00");
          poly.properties.set("hintContent", z.name);
        } catch {
          /* ignore */
        }
      } else {
        try {
          poly.options.set("fillColor", `${z.color || "#ff6a00"}55`);
          poly.options.set("strokeColor", z.color || "#ff6a00");
          poly.properties.set("hintContent", z.name);
        } catch {
          /* ignore */
        }
      }
    });
  }

  useEffect(() => {
    if (!mapReady) return;
    syncPolygonsFromZones(zones);
  }, [zones, mapReady]);

  function emit(next) {
    zonesRef.current = next;
    onChange?.(next);
  }

  function updateZone(id, patch) {
    if (draft && draft.id === id) {
      setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
      const poly = draftPolyRef.current || polygonsRef.current[id];
      if (poly && (patch.color || patch.name)) {
        try {
          if (patch.color) {
            poly.options.set("fillColor", `${patch.color}55`);
            poly.options.set("strokeColor", patch.color);
          }
          if (patch.name) poly.properties.set("hintContent", patch.name);
        } catch {
          /* ignore */
        }
      }
      return;
    }
    emit((zonesRef.current || []).map((z) => (z.id === id ? { ...z, ...patch } : z)));
  }

  function removeZone(id) {
    if (editingId === id) stopEditing(false);
    if (draft && draft.id === id) {
      cancelDraft();
      return;
    }
    const map = mapRef.current;
    if (map && polygonsRef.current[id]) {
      map.geoObjects.remove(polygonsRef.current[id]);
      delete polygonsRef.current[id];
    }
    const next = (zonesRef.current || []).filter((z) => z.id !== id);
    if (selectedId === id) setSelectedId(null);
    emit(next);
  }

  function cancelDraft() {
    const map = mapRef.current;
    const poly = draftPolyRef.current;
    if (map && poly) {
      try {
        poly.editor?.stopDrawing?.();
      } catch {
        /* ignore */
      }
      map.geoObjects.remove(poly);
    }
    if (draft?.id) delete polygonsRef.current[draft.id];
    draftPolyRef.current = null;
    geometryBusyRef.current = null;
    setDraft(null);
    setDrawing(false);
    setSelectedId(null);
  }

  function finishDrawnPolygon(poly, draftZone) {
    const map = mapRef.current;
    const ring = ringFromPolygon(poly);
    if (ring.length < 3) {
      if (map) map.geoObjects.remove(poly);
      draftPolyRef.current = null;
      geometryBusyRef.current = null;
      setDraft(null);
      setDrawing(false);
      setSelectedId(null);
      return;
    }
    const id = draftZone.id;
    polygonsRef.current[id] = poly;
    draftPolyRef.current = null;
    geometryBusyRef.current = null;
    poly.events.add("click", () => {
      if (geometryBusyRef.current) return;
      setSelectedId(id);
    });
    const zone = {
      ...draftZone,
      polygon: ring,
    };
    setDraft(null);
    setDrawing(false);
    setSelectedId(id);
    emit([...(zonesRef.current || []), zone]);
  }

  function startDraw() {
    const ymaps = window.ymaps;
    const map = mapRef.current;
    if (!ymaps || !map || drawing || editingId) return;
    if (draft) cancelDraft();

    const color = COLORS[(zonesRef.current || []).length % COLORS.length];
    const id = newId();
    const draftZone = {
      id,
      name: `Зона ${(zonesRef.current || []).length + 1}`,
      color,
      fee: String(defaultFee ?? "0"),
      min_order: String(defaultMinOrder ?? "0"),
      polygon: [],
    };

    geometryBusyRef.current = id;
    setDraft(draftZone);
    setSelectedId(id);
    setDrawing(true);

    const poly = new ymaps.Polygon(
      [[]],
      { hintContent: draftZone.name },
      {
        fillColor: `${color}55`,
        strokeColor: color,
        strokeWidth: 2,
        editorDrawingCursor: "crosshair",
        editorMaxPoints: 40,
      },
    );
    map.geoObjects.add(poly);
    draftPolyRef.current = poly;
    polygonsRef.current[id] = poly;
    poly.editor.startDrawing();

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      try {
        poly.editor.events.remove("drawingstop", finish);
        poly.editor.events.remove("statechange", onState);
      } catch {
        /* ignore */
      }
      finishDrawnPolygon(poly, draftRef.current || draftZone);
    };
    const onState = () => {
      if (poly.editor.state !== "drawing") finish();
    };
    poly.editor.events.add("drawingstop", finish);
    poly.editor.events.add("statechange", onState);
  }

  function stopEditing(commit = true) {
    const id = editingId;
    if (!id) return;
    const poly = polygonsRef.current[id];
    if (poly) {
      if (commit) {
        const ring = ringFromPolygon(poly);
        if (ring.length >= 3) {
          emit((zonesRef.current || []).map((z) => (z.id === id ? { ...z, polygon: ring } : z)));
        }
      }
      try {
        poly.editor.stopEditing();
      } catch {
        /* ignore */
      }
    }
    geometryBusyRef.current = null;
    setEditingId(null);
  }

  function toggleEditContour() {
    const id = selectedId;
    if (!id || draft?.id === id) return;
    if (editingId === id) {
      stopEditing(true);
      return;
    }
    if (editingId) stopEditing(true);
    const poly = polygonsRef.current[id];
    if (!poly) return;
    geometryBusyRef.current = id;
    setEditingId(id);
    poly.editor.startEditing();
  }

  const selectedFromList = (zones || []).find((z) => z.id === selectedId) || null;
  const selected = (draft && draft.id === selectedId ? draft : selectedFromList) || draft || null;
  const selectedIsDraft = Boolean(draft && selected && draft.id === selected.id);

  return (
    <div className="cafe-zones cafe-form-span2">
      <h3>Зоны доставки на карте</h3>
      <p className="muted small">
        Нарисуйте полигоны районов. Как только начнёте ставить точки — внизу появятся настройки зоны.
        Двойной клик по последней точке завершает контур. Зоны сохраняются автоматически.
      </p>
      {mapError ? <p className="status">{mapError}</p> : null}
      <div className="cafe-toolbar cafe-zones-toolbar">
        <button
          type="button"
          className="landing-btn landing-btn--primary"
          onClick={startDraw}
          disabled={!mapReady || drawing || Boolean(editingId)}
        >
          {drawing ? "Ставьте точки на карте…" : "+ Зона на карте"}
        </button>
        {drawing ? (
          <button type="button" className="ghost-btn" onClick={cancelDraft}>
            Отмена
          </button>
        ) : null}
        {editingId ? (
          <button type="button" className="landing-btn landing-btn--outline" onClick={() => stopEditing(true)}>
            Готово — сохранить контур
          </button>
        ) : null}
      </div>
      <div ref={mapHostRef} className="cafe-zones-map" />
      {(zones || []).length ? (
        <ul className="cafe-zones-list">
          {zones.map((z) => (
            <li key={z.id}>
              <button
                type="button"
                className={`cafe-zones-list-item${z.id === selectedId && !selectedIsDraft ? " is-active" : ""}`}
                onClick={() => {
                  if (geometryBusyRef.current && geometryBusyRef.current !== z.id) return;
                  if (editingId && editingId !== z.id) stopEditing(true);
                  setSelectedId(z.id);
                }}
              >
                <i style={{ background: z.color || "#ff6a00" }} aria-hidden />
                <span>
                  {z.name} · {Number(z.fee || 0).toLocaleString("ru-RU")} ₽
                  {Number(z.min_order) > 0 ? ` · от ${Number(z.min_order).toLocaleString("ru-RU")} ₽` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : !draft ? (
        <p className="muted small">Зон пока нет — действует общая стоимость доставки ниже.</p>
      ) : null}

      {selected ? (
        <div className="cafe-zones-edit">
          <div className="cafe-zones-edit-head">
            <strong>{selectedIsDraft ? "Новая зона" : "Настройки зоны"}</strong>
            <div className="cafe-zones-edit-actions">
              {!selectedIsDraft ? (
                <button
                  type="button"
                  className={`cafe-zones-icon-btn${editingId === selected.id ? " is-active" : ""}`}
                  onClick={toggleEditContour}
                  title={editingId === selected.id ? "Завершить правку контура" : "Править контур"}
                  aria-label={editingId === selected.id ? "Завершить правку контура" : "Править контур"}
                >
                  <EditContourIcon />
                </button>
              ) : null}
              <button
                type="button"
                className="cafe-zones-icon-btn cafe-zones-icon-btn--danger"
                onClick={() => removeZone(selected.id)}
                title={selectedIsDraft ? "Отменить зону" : "Удалить зону"}
                aria-label={selectedIsDraft ? "Отменить зону" : "Удалить зону"}
              >
                <TrashIcon />
              </button>
            </div>
          </div>
          {editingId === selected.id ? (
            <p className="muted small cafe-zones-edit-hint">
              Тяните точки и рёбра на карте. Нажмите карандаш или «Готово», чтобы сохранить контур.
            </p>
          ) : null}
          {selectedIsDraft ? (
            <p className="muted small cafe-zones-edit-hint">
              Ставьте точки на карте. Двойной клик — завершить контур.
            </p>
          ) : null}
          <div className="cafe-form-grid">
            <label>
              Название
              <input
                value={selected.name}
                onChange={(e) => updateZone(selected.id, { name: e.target.value })}
              />
            </label>
            <label>
              Цвет
              <input
                type="color"
                value={selected.color || "#ff6a00"}
                onChange={(e) => updateZone(selected.id, { color: e.target.value })}
              />
            </label>
            <label>
              Доставка, ₽
              <input
                type="number"
                min="0"
                value={selected.fee}
                onChange={(e) => updateZone(selected.id, { fee: e.target.value })}
              />
            </label>
            <label>
              Мин. сумма, ₽
              <input
                type="number"
                min="0"
                value={selected.min_order}
                onChange={(e) => updateZone(selected.id, { min_order: e.target.value })}
              />
            </label>
          </div>
        </div>
      ) : null}
    </div>
  );
}
