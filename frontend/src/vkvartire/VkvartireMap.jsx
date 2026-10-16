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
  const clustererRef = useRef(null);
  const priceLayoutRef = useRef(null);
  const activeLayoutRef = useRef(null);
  const placemarksRef = useRef(new Map());
  const onPickAnchorRef = useRef(onPickAnchor);
  const showToastRef = useRef(showToast);
  const [pins, setPins] = useState([]);
  const [sheetListing, setSheetListing] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [busy, setBusy] = useState(false);
  const activeIdRef = useRef(null);

  useEffect(() => {
    onPickAnchorRef.current = onPickAnchor;
    showToastRef.current = showToast;
  }, [onPickAnchor, showToast]);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    loadMapPins(authFetch, API_URL, filters)
      .then((data) => {
        if (!cancelled) setPins(Array.isArray(data?.pins) ? data.pins : []);
      })
      .catch((e) => {
        if (!cancelled) showToastRef.current?.(e.message || "Не удалось загрузить карту", { tone: "error" });
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [API_URL, authFetch, filters]);

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

        priceLayoutRef.current = ymaps.templateLayoutFactory.createClass(
          '<div class="vkvartire-price-pin-wrap"><div class="vkvartire-price-pin">$[properties.iconContent]</div></div>'
        );
        activeLayoutRef.current = ymaps.templateLayoutFactory.createClass(
          '<div class="vkvartire-price-pin-wrap"><div class="vkvartire-price-pin is-active">$[properties.iconContent]</div></div>'
        );

        const clusterer = new ymaps.Clusterer({
          preset: "islands#invertedBlueClusterIcons",
          groupByCoordinates: false,
          clusterDisableClickZoom: false,
          clusterHideIconOnBalloonOpen: false,
          geoObjectHideIconOnBalloonOpen: false,
          minClusterSize: 3,
        });
        clustererRef.current = clusterer;
        map.geoObjects.add(clusterer);

        map.events.add("click", (e) => {
          if (activeIdRef.current) {
            activeIdRef.current = null;
            setSheetListing(null);
            refreshPinStyles();
            return;
          }
          const coords = e.get("coords");
          if (coords && onPickAnchorRef.current) {
            onPickAnchorRef.current({
              lat: coords[0],
              lon: coords[1],
              label: "Точка на карте",
            });
            showToastRef.current?.("Точка для фильтра удалённости установлена");
          }
        });

        // Show price labels more clearly when zoomed in (reduce clustering pressure)
        map.events.add("boundschange", () => {
          const z = map.getZoom();
          clusterer.options.set("minClusterSize", z >= 13 ? 99 : 3);
        });
      })
      .catch(() => {
        showToastRef.current?.("Не удалось загрузить Яндекс.Карты", { tone: "error" });
      });

    return () => {
      destroyed = true;
      try {
        mapRef.current?.destroy();
      } catch {
        /* ignore */
      }
      mapRef.current = null;
      clustererRef.current = null;
      placemarksRef.current = new Map();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map init once
  }, []);

  function refreshPinStyles() {
    const ymaps = window.ymaps;
    if (!ymaps || !priceLayoutRef.current) return;
    for (const [id, pm] of placemarksRef.current.entries()) {
      const active = Number(id) === Number(activeIdRef.current);
      pm.options.set(
        "iconLayout",
        active ? activeLayoutRef.current : priceLayoutRef.current
      );
    }
  }

  useEffect(() => {
    const map = mapRef.current;
    const clusterer = clustererRef.current;
    const ymaps = window.ymaps;
    if (!map || !clusterer || !ymaps || !priceLayoutRef.current) return;

    const marks = [];
    const nextMap = new Map();
    for (const p of pins) {
      if (p.lat == null || p.lon == null) continue;
      const label = formatPinPrice(p);
      const active = Number(p.id) === Number(activeIdRef.current);
      const pm = new ymaps.Placemark(
        [p.lat, p.lon],
        {
          iconContent: label,
          hintContent: `${label} · ${p.rooms != null ? p.rooms + "к" : ""}`.trim(),
          listingId: p.id,
        },
        {
          iconLayout: active ? activeLayoutRef.current : priceLayoutRef.current,
          iconShape: {
            type: "Rectangle",
            coordinates: [
              [-36, -28],
              [36, 4],
            ],
          },
          zIndex: active ? 700 : 100,
          cursor: "pointer",
        }
      );
      pm.events.add("click", (e) => {
        e.stopPropagation();
        void openPin(Number(p.id));
      });
      marks.push(pm);
      nextMap.set(p.id, pm);
    }
    clusterer.removeAll();
    clusterer.add(marks);
    placemarksRef.current = nextMap;

    if (filters.anchor_lat != null && filters.anchor_lon != null) {
      map.setCenter([filters.anchor_lat, filters.anchor_lon], Math.max(map.getZoom(), 12), {
        duration: 200,
      });
    }
  }, [pins, filters.anchor_lat, filters.anchor_lon]);

  async function openPin(id) {
    if (!id) return;
    activeIdRef.current = id;
    setCollapsed(false);
    refreshPinStyles();
    try {
      const detail = await loadListing(authFetch, API_URL, id);
      setSheetListing(detail);
      if (mapRef.current && detail.lat != null && detail.lon != null) {
        mapRef.current.setCenter([detail.lat, detail.lon], Math.max(mapRef.current.getZoom(), 14), {
          duration: 200,
        });
      }
      refreshPinStyles();
    } catch (e) {
      showToastRef.current?.(e.message || "Не удалось открыть объявление", { tone: "error" });
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
          refreshPinStyles();
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
