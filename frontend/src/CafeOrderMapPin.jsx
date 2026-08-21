import { useEffect, useRef } from "react";
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
    const la = Number(lat);
    const lo = Number(lon);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) return undefined;

    // дать контейнеру отрисоваться с высотой
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
            const cLa = Number(courierLat);
            const cLo = Number(courierLon);
            if (Number.isFinite(cLa) && Number.isFinite(cLo)) {
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
            // принудительно пересчитать размер (модалка / смена вкладки)
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

  const la = Number(lat);
  const lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;

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
  const la = Number(lat);
  const lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return "";
  return `https://yandex.ru/maps/?pt=${lo},${la}&z=16&l=map`;
}
