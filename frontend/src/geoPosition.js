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

function withTimeout(promise, ms, message = "Таймаут геолокации") {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => {
      const err = new Error(message);
      err.code = 3;
      reject(err);
    }, ms);
    promise.then(
      (v) => {
        window.clearTimeout(t);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(t);
        reject(e);
      },
    );
  });
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
    const pos = await withTimeout(
      Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 15000,
      }),
      14000,
      "Таймаут геолокации (приложение)",
    );
    const lat = pos?.coords?.latitude;
    const lon = pos?.coords?.longitude;
    if (!hasCoords(lat, lon)) throw new Error("Получены некорректные координаты");
    return { lat: Number(lat), lon: Number(lon), accuracy: pos.coords?.accuracy, source: "capacitor" };
  } catch (e) {
    if (e?.message?.includes("Разрешите")) throw e;
    return null;
  }
}

/**
 * Браузерная геолокация.
 * На телефонах GPS с highAccuracy часто «висит» 15–30 с — сначала берём сеть/кэш (быстро),
 * затем при необходимости точнее.
 */
async function fromBrowser({ highAccuracyOnly = false, preferFast = true } = {}) {
  const attempts = highAccuracyOnly
    ? [{ enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }]
    : preferFast
      ? [
          // Сеть / недавний кэш ОС — обычно 0.5–3 с на телефоне
          { enableHighAccuracy: false, timeout: 7000, maximumAge: 180000 },
          // GPS, но с коротким таймаутом и допустимым кэшем
          { enableHighAccuracy: true, timeout: 9000, maximumAge: 30000 },
        ]
      : [
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
        ];

  let lastErr = null;
  for (const opts of attempts) {
    try {
      // Жёсткий потолок чуть выше browser timeout — на iOS timeout иногда не срабатывает.
      const pos = await withTimeout(
        browserGetPosition(opts),
        Math.max(2000, Number(opts.timeout || 8000) + 1500),
        "Таймаут геолокации",
      );
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
        source: opts.enableHighAccuracy ? "browser:gps" : "browser:network",
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
  const result = await withTimeout(
    ymaps.geolocation.get({
      provider,
      autoReverseGeocode: false,
      mapStateAutoApply: false,
    }),
    6000,
    "Таймаут геолокации (Яндекс)",
  );
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
const POSITION_TTL_MS = 90_000;

/** Один одновременный запрос — карта + «рядом» не дублируют GPS на телефоне. */
let _inflight = null;
let _inflightKey = "";

function cacheKey({ force, allowIpFallback, highAccuracyOnly, preferFast }) {
  return [force ? "1" : "0", allowIpFallback ? "1" : "0", highAccuracyOnly ? "1" : "0", preferFast ? "1" : "0"].join(
    ":",
  );
}

async function fetchDevicePosition({
  force = false,
  allowIpFallback = true,
  highAccuracyOnly = false,
  preferFast = true,
} = {}) {
  const now = Date.now();
  if (!force && _cachedPosition && now - _cachedAt < POSITION_TTL_MS) {
    const src = String(_cachedPosition.source || "");
    if (!allowIpFallback && src.startsWith("yandex:yandex")) {
      /* skip IP cache */
    } else if (highAccuracyOnly && Number(_cachedPosition.accuracy) > 8000) {
      /* skip coarse cache */
    } else {
      return _cachedPosition;
    }
  }

  const native = await fromCapacitor();
  if (native) {
    _cachedPosition = native;
    _cachedAt = Date.now();
    return native;
  }

  try {
    const browser = await fromBrowser({ highAccuracyOnly, preferFast });
    _cachedPosition = browser;
    _cachedAt = Date.now();
    return browser;
  } catch (browserErr) {
    try {
      const yaBrowser = await fromYandex("browser");
      if (yaBrowser) {
        _cachedPosition = yaBrowser;
        _cachedAt = Date.now();
        return yaBrowser;
      }
    } catch {
      /* ignore */
    }
    if (allowIpFallback) {
      try {
        const yaIp = await fromYandex("yandex");
        if (yaIp) {
          _cachedPosition = yaIp;
          _cachedAt = Date.now();
          return yaIp;
        }
      } catch {
        /* ignore */
      }
    }
    throw new Error(geoErrorMessage(browserErr) || browserErr?.message || "Не удалось получить геолокацию");
  }
}

/**
 * Текущие координаты устройства (с коротким кэшем).
 * Порядок: Capacitor → браузер (сеть → GPS) → Яндекс browser → Яндекс IP (если allowIpFallback).
 *
 * @param {{ force?: boolean, allowIpFallback?: boolean, highAccuracyOnly?: boolean, preferFast?: boolean }} opts
 */
export async function getDevicePosition(opts = {}) {
  const {
    force = false,
    allowIpFallback = true,
    highAccuracyOnly = false,
    preferFast = true,
  } = opts;

  const now = Date.now();
  if (!force && _cachedPosition && now - _cachedAt < POSITION_TTL_MS) {
    const src = String(_cachedPosition.source || "");
    if (!(!allowIpFallback && src.startsWith("yandex:yandex"))) {
      if (!(highAccuracyOnly && Number(_cachedPosition.accuracy) > 8000)) {
        return _cachedPosition;
      }
    }
  }

  const key = cacheKey({ force, allowIpFallback, highAccuracyOnly, preferFast });
  // Параллельные getCurrentPosition на телефоне часто «вешаются» — один запрос на всех.
  if (_inflight) {
    if (!force) return _inflight;
    try {
      await _inflight;
    } catch {
      /* continue with forced refresh */
    }
    if (!force && _cachedPosition && Date.now() - _cachedAt < POSITION_TTL_MS) {
      return _cachedPosition;
    }
  }

  _inflightKey = key;
  _inflight = fetchDevicePosition({ force, allowIpFallback, highAccuracyOnly, preferFast }).finally(() => {
    if (_inflightKey === key) {
      _inflight = null;
      _inflightKey = "";
    }
  });
  return _inflight;
}

/**
 * Быстрый фикс (кэш/сеть), затем уточнение GPS в фоне (не блокирует возврат).
 * onFix вызывается 1–2 раза — удобно для метки на карте на телефоне.
 */
export async function getDevicePositionProgressive({
  allowIpFallback = false,
  onFix,
  refineInBackground = true,
} = {}) {
  const cached = peekCachedPosition();
  const src = String(cached?.source || "");
  if (cached && hasCoords(cached.lat, cached.lon) && !src.startsWith("yandex:yandex")) {
    onFix?.(cached);
  }

  let first = null;
  try {
    first = await getDevicePosition({
      force: false,
      allowIpFallback,
      preferFast: true,
      highAccuracyOnly: false,
    });
    onFix?.(first);
  } catch (e) {
    if (!cached) throw e;
    return cached;
  }

  const needsRefine =
    first?.source === "browser:network" || (Number(first?.accuracy) || 99999) > 80;

  if (needsRefine) {
    const refine = async () => {
      try {
        const fine = await getDevicePosition({
          force: true,
          allowIpFallback: false,
          preferFast: false,
          highAccuracyOnly: true,
        });
        if (fine && hasCoords(fine.lat, fine.lon)) {
          onFix?.(fine);
          return fine;
        }
      } catch {
        /* оставляем первый фикс */
      }
      return first;
    };
    if (refineInBackground) {
      void refine();
      return first;
    }
    return refine();
  }
  return first;
}

export function peekCachedPosition() {
  if (_cachedPosition && Date.now() - _cachedAt < POSITION_TTL_MS) return _cachedPosition;
  return null;
}
