import { useEffect, useRef, useState } from "react";
import { loadYandexMaps } from "../yandexMapsLoader.js";
import { loadListing, loadMapPins } from "./vkvartireApi.js";
import VkvartireListingSheet from "./VkvartireListingSheet.jsx";

function formatPinPrice(pin) {
  if (pin.price_short) return pin.price_short;
  const n = Number(pin.price) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")} млн`;
  if (n >= 1000) return `${Math.round(n / 1000)} тыс`;
  return String(n);
}

export default function VkvartireMap({
  authFetch,
  API_URL,
  filters,
  onPickAnchor,
  onToggleFavorite,
  showToast,
}) {
  const mapRef = useRef(null);
  const objectManagerRef = useRef(null);
  const [pins, setPins] = useState([]);
  const [sheetListing, setSheetListing] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [busy, setBusy] = useState(false);
  const activeIdRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    loadMapPins(authFetch, API_URL, filters)
      .then((data) => {
        if (!cancelled) setPins(Array.isArray(data?.pins) ? data.pins : []);
      })
      .catch((e) => {
        if (!cancelled) showToast?.(e.message || "Не удалось загрузить карту", { tone: "error" });
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [API_URL, authFetch, filters, showToast]);

  useEffect(() => {
    let destroyed = false;
    void loadYandexMaps()
      .then((ymaps) => {
        if (destroyed || !ymaps || mapRef.current) return;
        const center =
          filters.anchor_lat != null && filters.anchor_lon != null
            ? [filters.anchor_lat, filters.anchor_lon]
            : [55.751244, 37.618423];
        const map = new ymaps.Map("vkvartire-map", {
          center,
          zoom: 11,
          controls: ["zoomControl", "geolocationControl"],
        });
        mapRef.current = map;

        map.events.add("click", (e) => {
          if (sheetListing || activeIdRef.current) {
            activeIdRef.current = null;
            setSheetListing(null);
            return;
          }
          const coords = e.get("coords");
          if (coords && onPickAnchor) {
            onPickAnchor({
              lat: coords[0],
              lon: coords[1],
              label: "Точка на карте",
            });
            showToast?.("Точка для фильтра удалённости установлена");
          }
        });

        const om = new ymaps.ObjectManager({
          clusterize: true,
          gridSize: 64,
        });
        objectManagerRef.current = om;
        map.geoObjects.add(om);

        om.objects.events.add("click", (e) => {
          const id = e.get("objectId");
          void openPin(Number(id));
        });
      })
      .catch(() => {
        showToast?.("Не удалось загрузить Яндекс.Карты", { tone: "error" });
      });

    return () => {
      destroyed = true;
      try {
        mapRef.current?.destroy();
      } catch {
        /* ignore */
      }
      mapRef.current = null;
      objectManagerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map init once
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const om = objectManagerRef.current;
    if (!map || !om || !window.ymaps) return;

    const features = pins
      .filter((p) => p.lat != null && p.lon != null)
      .map((p) => ({
        type: "Feature",
        id: p.id,
        geometry: { type: "Point", coordinates: [p.lat, p.lon] },
        properties: {
          hintContent: formatPinPrice(p),
          iconContent: formatPinPrice(p),
        },
        options: {
          preset: "islands#blueStretchyIcon",
        },
      }));

    om.removeAll();
    om.add({ type: "FeatureCollection", features });

    // At higher zoom show price-like stretchy icons (Avito-style labels)
    const zoom = map.getZoom();
    if (zoom >= 13 && features.length && features.length <= 80) {
      // ObjectManager already uses stretchy icons with iconContent = price
    }
  }, [pins]);

  async function openPin(id) {
    if (!id) return;
    activeIdRef.current = id;
    setCollapsed(false);
    try {
      const detail = await loadListing(authFetch, API_URL, id);
      setSheetListing(detail);
      if (mapRef.current && detail.lat != null && detail.lon != null) {
        mapRef.current.setCenter([detail.lat, detail.lon], Math.max(mapRef.current.getZoom(), 14), {
          duration: 200,
        });
      }
    } catch (e) {
      showToast?.(e.message || "Не удалось открыть объявление", { tone: "error" });
    }
  }

  return (
    <div className={`vkvartire-map-wrap${sheetListing ? " vkvartire-map-wrap--sheet" : ""}`}>
      {busy ? (
        <p className="muted" style={{ position: "absolute", zIndex: 2, left: 12, top: 12, margin: 0 }}>
          Загрузка…
        </p>
      ) : null}
      <div id="vkvartire-map" />
      <VkvartireListingSheet
        listing={sheetListing}
        collapsed={collapsed}
        onExpand={() => setCollapsed(false)}
        onCollapse={() => setCollapsed(true)}
        onClose={() => {
          activeIdRef.current = null;
          setSheetListing(null);
        }}
        onToggleFavorite={async (listing) => {
          await onToggleFavorite?.(listing);
          setSheetListing((cur) =>
            cur && cur.id === listing.id ? { ...cur, is_favorite: !cur.is_favorite } : cur
          );
        }}
      />
    </div>
  );
}
