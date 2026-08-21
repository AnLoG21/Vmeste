import { useEffect, useRef } from "react";
import { hasCoords } from "./geoPosition.js";
import { loadYandexMaps } from "./yandexMapsLoader.js";

/** Компактная карта с меткой адреса (и опционально курьера). */
export default function CafeOrderMapPin({
  lat,
  lon,
  courierLat,
  courierLon,
  height = 220,
  className = "",
  mapKey = "",
}) {
  const hostRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    if (!hasCoords(lat, lon)) return undefined;

    const la = Number(lat);
    const lo = Number(lon);
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
              center: [la, lo],
              zoom: 15,
              controls: ["zoomControl"],
            });
            map.geoObjects.add(
              new ymaps.Placemark(
                [la, lo],
                { hintContent: "Адрес доставки", balloonContent: "Адрес доставки" },
                { preset: "islands#orangeDotIcon" },
              ),
            );
            if (showCourier) {
              map.geoObjects.add(
                new ymaps.Placemark(
                  [cLa, cLo],
                  { hintContent: "Курьер", balloonContent: "Курьер сейчас здесь" },
                  { preset: "islands#blueCircleDotIcon" },
                ),
              );
              try {
                map.setBounds(map.geoObjects.getBounds(), { checkZoomRange: true, zoomMargin: 48 });
              } catch {
                /* ignore */
              }
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
  }, [lat, lon, courierLat, courierLon, mapKey]);

  if (!hasCoords(lat, lon)) return null;

  return (
    <div
      className={`cafe-order-map-pin ${className}`.trim()}
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
        }}
      />
    </div>
  );
}

export function yandexMapsPinUrl(lat, lon) {
  if (!hasCoords(lat, lon)) return "";
  return `https://yandex.ru/maps/?pt=${Number(lon)},${Number(lat)}&z=16&l=map`;
}
