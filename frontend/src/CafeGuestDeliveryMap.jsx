import { useEffect, useRef, useState } from "react";
import { loadYandexMaps } from "./yandexMapsLoader.js";
import { reverseGeocodeLatLon } from "./addressSuggest.js";

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

function setPinOnMap(ymaps, map, pinRef, lat, lon) {
  if (pinRef.current) map.geoObjects.remove(pinRef.current);
  pinRef.current = new ymaps.Placemark([lat, lon], {}, { preset: "islands#orangeDotIcon", draggable: true });
  map.geoObjects.add(pinRef.current);
  return pinRef.current;
}

/** Карта зон + выбор точки доставки для гостя (клик / перенос метки). */
export default function CafeGuestDeliveryMap({
  zones = [],
  centerLat = 55.751244,
  centerLon = 37.618423,
  pin,
  onPick,
}) {
  const hostRef = useRef(null);
  const mapRef = useRef(null);
  const pinRef = useRef(null);
  const onPickRef = useRef(onPick);
  const zonesRef = useRef(zones);
  const [error, setError] = useState("");
  const [hint, setHint] = useState(
    (zones || []).length
      ? "Нажмите на карту внутри зоны доставки или выберите адрес выше"
      : "Укажите точку на карте или адрес выше",
  );

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);
  useEffect(() => {
    zonesRef.current = zones;
  }, [zones]);

  function emitPick(lat, lon, address, outside) {
    const zone = findZoneAt(lat, lon, zonesRef.current);
    const hasZones = (zonesRef.current || []).length > 0;
    const isOutside = Boolean(outside) || (hasZones && !zone);
    if (isOutside) {
      setHint("Точка вне зоны доставки — выберите место внутри цветной области");
      onPickRef.current?.({ lat, lon, zone: null, address: address || "", outside: true });
      return;
    }
    setHint(
      zone
        ? `Зона «${zone.name}»: доставка ${Number(zone.fee || 0).toLocaleString("ru-RU")} ₽`
        : "Точка выбрана",
    );
    onPickRef.current?.({ lat, lon, zone: zone || null, address: address || "", outside: false });
  }

  useEffect(() => {
    let cancelled = false;
    loadYandexMaps()
      .then((ymaps) => {
        if (cancelled || !ymaps || !hostRef.current) return;
        ymaps.ready(() => {
          if (cancelled || mapRef.current) return;
          const map = new ymaps.Map(hostRef.current, {
            center: [
              pin?.lat || Number(centerLat) || 55.751244,
              pin?.lon || Number(centerLon) || 37.618423,
            ],
            zoom: pin ? 15 : 13,
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

          async function handleCoords(lat, lon) {
            const address = await reverseGeocodeLatLon(lat, lon);
            if (cancelled) return;
            setPinOnMap(ymaps, map, pinRef, lat, lon);
            pinRef.current.events.add("dragend", () => {
              const coords = pinRef.current.geometry.getCoordinates();
              handleCoords(coords[0], coords[1]);
            });
            emitPick(lat, lon, address);
          }

          map.events.add("click", (e) => {
            const coords = e.get("coords");
            handleCoords(coords[0], coords[1]);
          });

          if (pin?.lat != null && pin?.lon != null) {
            setPinOnMap(ymaps, map, pinRef, pin.lat, pin.lon);
            pinRef.current.events.add("dragend", () => {
              const coords = pinRef.current.geometry.getCoordinates();
              handleCoords(coords[0], coords[1]);
            });
          }

          mapRef.current = map;
        });
      })
      .catch(() => setError("Карта недоступна — укажите адрес текстом."));
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
    const ymaps = window.ymaps;
    const map = mapRef.current;
    if (!ymaps || !map || !pin || pin.lat == null || pin.lon == null) return;
    const existing = pinRef.current?.geometry?.getCoordinates?.();
    if (
      existing &&
      Math.abs(existing[0] - pin.lat) < 1e-6 &&
      Math.abs(existing[1] - pin.lon) < 1e-6
    ) {
      return;
    }
    setPinOnMap(ymaps, map, pinRef, pin.lat, pin.lon);
    map.setCenter([pin.lat, pin.lon], Math.max(map.getZoom(), 15));
    pinRef.current.events.add("dragend", () => {
      const coords = pinRef.current.geometry.getCoordinates();
      reverseGeocodeLatLon(coords[0], coords[1]).then((address) => {
        emitPick(coords[0], coords[1], address);
      });
    });
    const zone = findZoneAt(pin.lat, pin.lon, zones);
    if (zone) setHint(`Зона «${zone.name}»: доставка ${Number(zone.fee || 0).toLocaleString("ru-RU")} ₽`);
    else if ((zones || []).length) setHint("Точка вне зоны доставки");
    else setHint("Точка выбрана");
  }, [pin, zones]);

  return (
    <div className="cafe-guest-delivery-map">
      {error ? <p className="muted small">{error}</p> : null}
      <p className="muted small">{hint}</p>
      <div ref={hostRef} className="cafe-guest-delivery-map-host" />
    </div>
  );
}
