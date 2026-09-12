import { useEffect, useRef } from "react";
import { hasCoords } from "./geoPosition.js";
import { loadYandexMaps } from "./yandexMapsLoader.js";

/** Компактная карта с меткой(ами) адреса (и опционально курьера). */
export default function CafeOrderMapPin({
  lat,
  lon,
  courierLat,
  courierLon,
  /** Доп. точки: [{ lat, lon, label?, preset? }] — вместе с lat/lon или вместо них */
  markers = null,
  height = 220,
  className = "",
  mapKey = "",
  /** Если задан — клик по карте ставит точку курьера */
  onPickCourier = null,
  pickHint = "",
  primaryLabel = "Адрес",
}) {
  const hostRef = useRef(null);
  const mapRef = useRef(null);
  const onPickRef = useRef(onPickCourier);
  onPickRef.current = onPickCourier;

  const markerList = Array.isArray(markers)
    ? markers.filter((m) => hasCoords(m?.lat, m?.lon))
    : hasCoords(lat, lon)
      ? [{ lat, lon, label: primaryLabel, preset: "islands#orangeDotIcon" }]
      : [];

  const centerLat = markerList[0]?.lat ?? lat;
  const centerLon = markerList[0]?.lon ?? lon;

  useEffect(() => {
    let cancelled = false;
    if (!markerList.length) return undefined;

    const showCourier = hasCoords(courierLat, courierLon);
    const cLa = showCourier ? Number(courierLat) : null;
    const cLo = showCourier ? Number(courierLon) : null;

    const timer = window.setTimeout(() => {
      loadYandexMaps()
        .then((ymaps) => {
          if (cancelled || !ymaps || !hostRef.current) return;
          ymaps.ready(() => {
            if (cancelled || !hostRef.current) return;
            if (mapRef.current) {
              try {
                mapRef.current.destroy();
              } catch {
                /* ignore */
              }
              mapRef.current = null;
            }
            const map = new ymaps.Map(hostRef.current, {
              center: [Number(centerLat), Number(centerLon)],
              zoom: 15,
              controls: ["zoomControl"],
            });
            markerList.forEach((m, i) => {
              const label = m.label || (i === 0 ? primaryLabel : "Точка");
              map.geoObjects.add(
                new ymaps.Placemark(
                  [Number(m.lat), Number(m.lon)],
                  { hintContent: label, balloonContent: label },
                  { preset: m.preset || (i === 0 ? "islands#orangeDotIcon" : "islands#blueDotIcon") },
                ),
              );
            });
            if (showCourier) {
              map.geoObjects.add(
                new ymaps.Placemark(
                  [cLa, cLo],
                  { hintContent: "Курьер", balloonContent: "Курьер сейчас здесь" },
                  { preset: "islands#blueCircleDotIcon" },
                ),
              );
            }
            if (markerList.length > 1 || showCourier) {
              try {
                map.setBounds(map.geoObjects.getBounds(), { checkZoomRange: true, zoomMargin: 48 });
              } catch {
                /* ignore */
              }
            }
            if (typeof onPickRef.current === "function") {
              map.events.add("click", (e) => {
                const coords = e.get("coords");
                if (!Array.isArray(coords) || coords.length < 2) return;
                const plat = Number(coords[0]);
                const plon = Number(coords[1]);
                if (!hasCoords(plat, plon)) return;
                onPickRef.current({ lat: plat, lon: plon });
              });
            }
            try {
              map.container.fitToViewport();
            } catch {
              /* ignore */
            }
            mapRef.current = map;
          });
        })
        .catch(() => {});
    }, 50);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (mapRef.current) {
        try {
          mapRef.current.destroy();
        } catch {
          /* ignore */
        }
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- markerList serialized via mapKey + coords
  }, [centerLat, centerLon, courierLat, courierLon, mapKey, Boolean(onPickCourier), markerList.length]);

  if (!markerList.length) return null;

  return (
    <div className={`cafe-order-map-wrap ${className}`.trim()}>
      <div
        className="cafe-order-map-pin"
        style={{ height, width: "100%", position: "relative", minHeight: height }}
      >
        <div
          ref={hostRef}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            borderRadius: 10,
            overflow: "hidden",
            background: "#f0ebe4",
            cursor: onPickCourier ? "crosshair" : "default",
          }}
        />
      </div>
      {pickHint ? <p className="muted small">{pickHint}</p> : null}
    </div>
  );
}

export function yandexMapsPinUrl(lat, lon) {
  if (!hasCoords(lat, lon)) return "";
  return `https://yandex.ru/maps/?pt=${Number(lon)},${Number(lat)}&z=16&l=map`;
}
