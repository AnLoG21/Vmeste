import { useEffect, useRef, useState } from "react";
import { loadYandexMaps } from "./yandexMapsLoader.js";

const COLORS = ["#ff6a00", "#2f5d50", "#1565c0", "#8b3a2a", "#7b1fa2", "#c62828"];

function newId() {
  return `z_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
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
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [drawing, setDrawing] = useState(false);
  const zonesRef = useRef(zones);

  useEffect(() => {
    zonesRef.current = zones;
  }, [zones]);

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
            controls: ["zoomControl", "geolocationControl", "searchControl"],
          });
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
        } catch {
          /* ignore */
        }
      });
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
      polygonsRef.current = {};
    };
    // center only for initial mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function syncPolygonsFromZones(list) {
    const ymaps = window.ymaps;
    const map = mapRef.current;
    if (!ymaps || !map) return;
    const keep = new Set((list || []).map((z) => z.id));
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
        poly.events.add("click", () => setSelectedId(z.id));
        map.geoObjects.add(poly);
        polygonsRef.current[z.id] = poly;
      } else {
        poly.geometry.setCoordinates([coords]);
        poly.options.set("fillColor", `${z.color || "#ff6a00"}55`);
        poly.options.set("strokeColor", z.color || "#ff6a00");
        poly.properties.set("hintContent", z.name);
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
    emit((zonesRef.current || []).map((z) => (z.id === id ? { ...z, ...patch } : z)));
  }

  function removeZone(id) {
    const map = mapRef.current;
    if (map && polygonsRef.current[id]) {
      map.geoObjects.remove(polygonsRef.current[id]);
      delete polygonsRef.current[id];
    }
    const next = (zonesRef.current || []).filter((z) => z.id !== id);
    if (selectedId === id) setSelectedId(null);
    emit(next);
  }

  function startDraw() {
    const ymaps = window.ymaps;
    const map = mapRef.current;
    if (!ymaps || !map || drawing) return;
    setDrawing(true);
    const color = COLORS[(zonesRef.current || []).length % COLORS.length];
    const poly = new ymaps.Polygon(
      [[]],
      {},
      {
        fillColor: `${color}55`,
        strokeColor: color,
        strokeWidth: 2,
        editorDrawingCursor: "crosshair",
        editorMaxPoints: 40,
      },
    );
    map.geoObjects.add(poly);
    poly.editor.startDrawing();
    poly.editor.events.add("statechange", () => {
      if (poly.editor.state !== "drawing") {
        const ring = poly.geometry.getCoordinates()?.[0] || [];
        if (ring.length < 3) {
          map.geoObjects.remove(poly);
          setDrawing(false);
          return;
        }
        const id = newId();
        polygonsRef.current[id] = poly;
        poly.events.add("click", () => setSelectedId(id));
        const zone = {
          id,
          name: `Зона ${(zonesRef.current || []).length + 1}`,
          color,
          fee: String(defaultFee ?? "0"),
          min_order: String(defaultMinOrder ?? "0"),
          polygon: ring.map((p) => [Number(p[0]), Number(p[1])]),
        };
        setSelectedId(id);
        setDrawing(false);
        emit([...(zonesRef.current || []), zone]);
      }
    });
  }

  function editSelectedShape() {
    const id = selectedId;
    const poly = id ? polygonsRef.current[id] : null;
    if (!poly) return;
    poly.editor.startEditing();
    const stop = () => {
      const ring = poly.geometry.getCoordinates()?.[0] || [];
      if (ring.length >= 3) {
        updateZone(id, { polygon: ring.map((p) => [Number(p[0]), Number(p[1])]) });
      }
      poly.editor.stopEditing();
      poly.editor.events.remove("statechange", stop);
    };
    poly.editor.events.add("statechange", stop);
  }

  const selected = (zones || []).find((z) => z.id === selectedId) || null;

  return (
    <div className="cafe-zones cafe-form-span2">
      <h3>Зоны доставки на карте</h3>
      <p className="muted small">
        Нарисуйте полигоны районов. Если зоны заданы, гость сможет заказать доставку только внутрь них —
        стоимость и минимум берутся из зоны.
      </p>
      {mapError ? <p className="status">{mapError}</p> : null}
      <div className="cafe-toolbar">
        <button type="button" className="landing-btn landing-btn--primary" onClick={startDraw} disabled={!mapReady || drawing}>
          {drawing ? "Кликайте по карте…" : "+ Зона на карте"}
        </button>
        <button type="button" className="ghost-btn" onClick={editSelectedShape} disabled={!selectedId}>
          Править контур
        </button>
        <button type="button" className="ghost-btn" onClick={() => selectedId && removeZone(selectedId)} disabled={!selectedId}>
          Удалить зону
        </button>
      </div>
      <div ref={mapHostRef} className="cafe-zones-map" />
      {(zones || []).length ? (
        <ul className="cafe-zones-list">
          {zones.map((z) => (
            <li key={z.id}>
              <button
                type="button"
                className={`cafe-zones-list-item${z.id === selectedId ? " is-active" : ""}`}
                onClick={() => setSelectedId(z.id)}
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
      ) : (
        <p className="muted small">Зон пока нет — действует общая стоимость доставки ниже.</p>
      )}
      {selected ? (
        <div className="cafe-form-grid cafe-zones-edit">
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
      ) : null}
    </div>
  );
}
