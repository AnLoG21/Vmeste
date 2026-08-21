/** Валидные географические координаты (не null и не Null Island). */
export function hasCoords(lat, lon) {
  if (lat == null || lon == null || lat === "" || lon === "") return false;
  const a = Number(lat);
  const b = Number(lon);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  if (Math.abs(a) > 90 || Math.abs(b) > 180) return false;
  // Number(null) === 0 — иначе метка улетает в океан у Африки
  if (Math.abs(a) < 0.0001 && Math.abs(b) < 0.0001) return false;
  return true;
}

function geoErrorMessage(err) {
  if (!err) return "Не удалось получить геолокацию";
  if (err.code === 1) return "Разрешите доступ к геолокации в браузере / системе";
  if (err.code === 2) return "Местоположение недоступно (проверьте GPS / сеть)";
  if (err.code === 3) return "Таймаут геолокации — попробуйте ещё раз";
  return err.message || "Не удалось получить геолокацию";
}

/**
 * Текущие координаты устройства. Без кэша, с явной валидацией.
 * @returns {Promise<{ lat: number, lon: number, accuracy?: number }>}
 */
export function getDevicePosition(options = {}) {
  const {
    enableHighAccuracy = true,
    timeout = 20000,
    maximumAge = 0,
  } = options;

  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Геолокация недоступна в этом браузере"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos?.coords?.latitude;
        const lon = pos?.coords?.longitude;
        if (!hasCoords(lat, lon)) {
          reject(new Error("Получены некорректные координаты — попробуйте ещё раз"));
          return;
        }
        resolve({
          lat: Number(lat),
          lon: Number(lon),
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => reject(new Error(geoErrorMessage(err))),
      { enableHighAccuracy, timeout, maximumAge },
    );
  });
}
