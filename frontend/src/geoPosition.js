import { Capacitor } from "@capacitor/core";
import { loadYandexMaps } from "./yandexMapsLoader.js";

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
  if (err.code === 3) return "Таймаут геолокации — попробуйте ещё раз или поставьте точку на карте";
  return err.message || "Не удалось получить геолокацию";
}

function browserGetPosition(options) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Геолокация недоступна в этом браузере"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

async function fromCapacitor() {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { Geolocation } = await import("@capacitor/geolocation");
    let perm = await Geolocation.checkPermissions();
    if (perm.location !== "granted" && perm.coarseLocation !== "granted") {
      perm = await Geolocation.requestPermissions();
    }
    if (perm.location !== "granted" && perm.coarseLocation !== "granted") {
      throw new Error("Разрешите доступ к геолокации в настройках приложения");
    }
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 25000,
      maximumAge: 5000,
    });
    const lat = pos?.coords?.latitude;
    const lon = pos?.coords?.longitude;
    if (!hasCoords(lat, lon)) throw new Error("Получены некорректные координаты");
    return { lat: Number(lat), lon: Number(lon), accuracy: pos.coords?.accuracy, source: "capacitor" };
  } catch (e) {
    if (e?.message?.includes("Разрешите")) throw e;
    return null;
  }
}

async function fromBrowser() {
  const attempts = [
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
  ];
  let lastErr = null;
  for (const opts of attempts) {
    try {
      const pos = await browserGetPosition(opts);
      const lat = pos?.coords?.latitude;
      const lon = pos?.coords?.longitude;
      if (!hasCoords(lat, lon)) {
        lastErr = new Error("Получены некорректные координаты");
        continue;
      }
      return {
        lat: Number(lat),
        lon: Number(lon),
        accuracy: pos.coords?.accuracy,
        source: "browser",
      };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("Не удалось получить геолокацию");
}

async function fromYandex(provider = "browser") {
  const ymaps = await loadYandexMaps();
  if (!ymaps?.geolocation?.get) return null;
  await new Promise((resolve) => ymaps.ready(resolve));
  const result = await ymaps.geolocation.get({
    provider,
    autoReverseGeocode: false,
    mapStateAutoApply: false,
  });
  const obj = result?.geoObjects?.get?.(0);
  const coords = obj?.geometry?.getCoordinates?.();
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lat = Number(coords[0]);
  const lon = Number(coords[1]);
  if (!hasCoords(lat, lon)) return null;
  return { lat, lon, source: `yandex:${provider}` };
}

let _cachedPosition = null;
let _cachedAt = 0;
const POSITION_TTL_MS = 60_000;

/**
 * Текущие координаты устройства (с коротким кэшем).
 * Порядок: Capacitor → браузер (GPS/сеть) → Яндекс browser → Яндекс IP.
 */
export async function getDevicePosition({ force = false } = {}) {
  const now = Date.now();
  if (!force && _cachedPosition && now - _cachedAt < POSITION_TTL_MS) {
    return _cachedPosition;
  }
  const native = await fromCapacitor();
  if (native) {
    _cachedPosition = native;
    _cachedAt = now;
    return native;
  }

  try {
    const browser = await fromBrowser();
    _cachedPosition = browser;
    _cachedAt = now;
    return browser;
  } catch (browserErr) {
    try {
      const yaBrowser = await fromYandex("browser");
      if (yaBrowser) {
        _cachedPosition = yaBrowser;
        _cachedAt = now;
        return yaBrowser;
      }
    } catch {
      /* ignore */
    }
    try {
      const yaIp = await fromYandex("yandex");
      if (yaIp) {
        _cachedPosition = yaIp;
        _cachedAt = now;
        return yaIp;
      }
    } catch {
      /* ignore */
    }
    throw new Error(geoErrorMessage(browserErr) || browserErr?.message || "Не удалось получить геолокацию");
  }
}

export function peekCachedPosition() {
  if (_cachedPosition && Date.now() - _cachedAt < POSITION_TTL_MS) return _cachedPosition;
  return null;
}
