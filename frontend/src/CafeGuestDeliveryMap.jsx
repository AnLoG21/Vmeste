import { useEffect, useRef, useState } from "react";
import { loadYandexMaps } from "./yandexMapsLoader.js";

function pointInPolygon(lat, lon, polygon) {
  if (!polygon || polygon.length < 3) return false;
  const pts = polygon[0] === polygon[polygon.length - 1] ? polygon : [...polygon, polygon[0]];
  let inside = false;
  let j = pts.length - 1;
  for (let i = 0; i < pts.length; i += 1) {
    const latI = Number(pts[i][0]);
    const lonI = Number(pts[i][1]);
    const latJ = Number(pts[j][0]);
    const lonJ = Number(pts[j][1]);
    if (latI > lat !== latJ > lat && lon < ((lonJ - lonI) * (lat - latI)) / ((latJ - latI) || 1e-12) + lonI) {
      inside = !inside;
    }
    j = i;
  }
  return inside;
}

export function findZoneAt(lat, lon, zones) {
  for (const z of zones || []) {
    if (pointInPolygon(lat, lon, z.polygon || [])) return z;
  }
  return null;
}

/** Карта зон + выбор точки доставки для гостя. */
export default function CafeGuestDeliveryMap({
  zones = [],
  centerLat = 55.751244,
  centerLon = 37.618423,
  pin,
  onPick,
  address = "",
}) {
  const hostRef = useRef(null);
  const mapRef = useRef(null);
  const pinRef = useRef(null);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("Нажмите на карту внутри зоны доставки");

  useEffect(() => {
    let cancelled = false;
    loadYandexMaps()
      .then((ymaps) => {
        if (cancelled || !ymaps || !hostRef.current) return;
        ymaps.ready(() => {
          if (cancelled || mapRef.current) return;
          const map = new ymaps.Map(hostRef.current, {
            center: [Number(centerLat) || 55.751244, Number(centerLon) || 37.618423],
            zoom: 13,
            controls: ["zoomControl", "geolocationControl"],
          });
          (zones || []).forEach((z) => {
            const ring = (z.polygon || []).map((p) => [p[0], p[1]]);
            if (ring.length < 3) return;
            const poly = new ymaps.Polygon(
              [ring],
              { hintContent: `${z.name}: ${Number(z.fee || 0)} ₽` },
              {
                fillColor: `${z.color || "#ff6a00"}44`,
                strokeColor: z.color || "#ff6a00",
                strokeWidth: 2,
                interactivityModel: "default#transparent",
              },
            );
            map.geoObjects.add(poly);
          });
          map.events.add("click", (e) => {
            const coords = e.get("coords");
            const lat = coords[0];
            const lon = coords[1];
            const zone = findZoneAt(lat, lon, zones);
            if (!zone && (zones || []).length) {
              setHint("Точка вне зоны доставки — выберите место внутри цветной области");
              return;
            }
            if (pinRef.current) map.geoObjects.remove(pinRef.current);
            pinRef.current = new ymaps.Placemark([lat, lon], {}, { preset: "islands#orangeDotIcon" });
            map.geoObjects.add(pinRef.current);
            setHint(zone ? `Зона «${zone.name}»: доставка ${Number(zone.fee || 0).toLocaleString("ru-RU")} ₽` : "Точка выбрана");
            onPick?.({ lat, lon, zone });
          });
          mapRef.current = map;
        });
      })
      .catch(() => setError("Карта недоступна — укажите адрес текстом, если зоны не обязательны."));
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
      pinRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current || !window.ymaps || !pin) return;
    const map = mapRef.current;
    if (pinRef.current) map.geoObjects.remove(pinRef.current);
    pinRef.current = new window.ymaps.Placemark([pin.lat, pin.lon], {}, { preset: "islands#orangeDotIcon" });
    map.geoObjects.add(pinRef.current);
  }, [pin]);

  useEffect(() => {
    const ymaps = window.ymaps;
    const map = mapRef.current;
    if (!ymaps || !map || !String(address || "").trim()) return undefined;
    let cancelled = false;
    const t = setTimeout(() => {
      ymaps.geocode(String(address).trim(), { results: 1 }).then((res) => {
        if (cancelled) return;
        const first = res.geoObjects.get(0);
        if (!first) return;
        const coords = first.geometry.getCoordinates();
        const lat = coords[0];
        const lon = coords[1];
        const zone = findZoneAt(lat, lon, zones);
        if (!zone && (zones || []).length) {
          setHint("Адрес вне зоны доставки");
          onPick?.({ lat, lon, zone: null });
          return;
        }
        if (pinRef.current) map.geoObjects.remove(pinRef.current);
        pinRef.current = new ymaps.Placemark([lat, lon], {}, { preset: "islands#orangeDotIcon" });
        map.geoObjects.add(pinRef.current);
        map.setCenter([lat, lon], 15);
        setHint(zone ? `Зона «${zone.name}»` : "Адрес найден");
        onPick?.({ lat, lon, zone });
      });
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [address, zones, onPick]);

  return (
    <div className="cafe-guest-delivery-map">
      {error ? <p className="muted small">{error}</p> : null}
      <p className="muted small">{hint}</p>
      <div ref={hostRef} className="cafe-guest-delivery-map-host" />
    </div>
  );
}
