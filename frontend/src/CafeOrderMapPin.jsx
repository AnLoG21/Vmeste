import { useEffect, useRef } from "react";
import { loadYandexMaps } from "./yandexMapsLoader.js";

/** Компактная карта с меткой адреса (и опционально курьера). */
export default function CafeOrderMapPin({
  lat,
  lon,
  courierLat,
  courierLon,
  height = 180,
  className = "",
}) {
  const hostRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    if (lat == null || lon == null) return undefined;
    loadYandexMaps()
      .then((ymaps) => {
        if (cancelled || !ymaps || !hostRef.current) return;
        ymaps.ready(() => {
          if (cancelled || mapRef.current) return;
          const map = new ymaps.Map(hostRef.current, {
            center: [Number(lat), Number(lon)],
            zoom: 15,
            controls: ["zoomControl"],
          });
          map.geoObjects.add(
            new ymaps.Placemark([Number(lat), Number(lon)], { hintContent: "Адрес доставки" }, { preset: "islands#orangeDotIcon" }),
          );
          if (courierLat != null && courierLon != null) {
            map.geoObjects.add(
              new ymaps.Placemark(
                [Number(courierLat), Number(courierLon)],
                { hintContent: "Курьер" },
                { preset: "islands#blueCircleDotIcon" },
              ),
            );
            try {
              map.setBounds(map.geoObjects.getBounds(), { checkZoomRange: true, zoomMargin: 40 });
            } catch {
              /* ignore */
            }
          }
          mapRef.current = map;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  }, [lat, lon, courierLat, courierLon]);

  if (lat == null || lon == null) return null;
  return (
    <div className={`cafe-order-map-pin ${className}`.trim()} style={{ height }}>
      <div ref={hostRef} style={{ width: "100%", height: "100%", borderRadius: 10, overflow: "hidden" }} />
    </div>
  );
}

export function yandexMapsPinUrl(lat, lon) {
  if (lat == null || lon == null) return "";
  return `https://yandex.ru/maps/?pt=${Number(lon)},${Number(lat)}&z=16&l=map`;
}
