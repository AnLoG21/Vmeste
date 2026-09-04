import {
  NOMINATIM_HEADERS,
  simplifyCommaAddressLine,
  mapPhotonFeatureToSuggestion,
  getCity,
  buildShortAddress,
} from "./addressFormat.js";

export async function reverseGeocodeByCoords(lat, lon) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`,
    { headers: NOMINATIM_HEADERS }
  );
  if (!response.ok) return null;
  const data = await response.json();
  return data || null;
}

export function federalCityFromReverse(addressObj) {
  if (!addressObj) return "";
  const st = String(addressObj.state || "").toLowerCase();
  if (["москва", "moscow"].some((x) => st.includes(x))) return "Москва";
  if (["санкт-петербург", "saint petersburg", "st petersburg", "петербург"].some((x) => st.includes(x))) {
    return "Санкт-Петербург";
  }
  return "";
}

export async function nominatimSearchRU(q, limit = 8) {
  const params = new URLSearchParams({
    format: "json",
    addressdetails: "1",
    limit: String(limit),
    countrycodes: "ru",
    q: q.trim(),
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: NOMINATIM_HEADERS,
  });
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

/** Подсказки при вводе: Photon (разрешён для autocomplete). Nominatim с клиента для autocomplete запрещён политикой OSM. */

export async function photonSuggestSearch(q, limit = 10) {
  const trimmed = (q || "").trim();
  if (trimmed.length < 2) return [];
  const params = new URLSearchParams({
    q: trimmed,
    limit: String(limit),
  });
  try {
    const response = await fetch(`https://photon.komoot.io/api/?${params}`, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "ru-RU, ru;q=0.9, en;q=0.8",
      },
    });
    if (!response.ok) return [];
    const data = await response.json();
    const features = Array.isArray(data?.features) ? data.features : [];
    const seen = new Set();
    const out = [];
    for (const f of features) {
      const item = mapPhotonFeatureToSuggestion(f);
      if (!item || seen.has(item.value)) continue;
      seen.add(item.value);
      out.push(item);
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}

export function mapNominatimToSuggestions(data) {
  return data.map((item) => ({
    value: simplifyCommaAddressLine(buildShortAddress(item.address) || item.display_name || ""),
    full: item.display_name,
    lat: Number(item.lat),
    lon: Number(item.lon),
    city: getCity(item.address),
  }));
}

export function buildNominatimQuery(trimmed, cityHint) {
  if (!trimmed) return "";
  const ru = ", Россия";
  const withRu = trimmed.toLowerCase().includes("росси") ? trimmed : `${trimmed}${ru}`;
  if (cityHint) {
    const lower = trimmed.toLowerCase();
    const ch = cityHint.toLowerCase();
    if (lower.includes(ch)) return withRu;
    const words = trimmed.split(/\s+/).filter(Boolean).length;
    if (/^\d/.test(trimmed) || words <= 4) return `${cityHint}, ${trimmed}`;
  }
  return withRu;
}

export function geocodeResultLabel(obj) {
  if (!obj) return "";
  if (typeof obj.getAddressLine === "function") {
    const a = obj.getAddressLine();
    if (a) return String(a).trim();
  }
  if (obj.properties && typeof obj.properties.get === "function") {
    const meta = obj.properties.get("GeocoderMetaData");
    if (meta && typeof meta.get === "function") {
      const t = meta.get("text");
      if (t) return String(t).trim();
    }
    const t2 =
      obj.properties.get("text") || obj.properties.get("name") || obj.properties.get("description");
    if (t2) return String(t2).trim();
  }
  return "";
}

export function geocodeResultCoords(obj) {
  const coords = obj?.geometry?.getCoordinates?.();
  if (!coords || coords.length < 2) return null;
  let lat = Number(coords[0]);
  let lon = Number(coords[1]);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
  if (Math.abs(lat) > 90) {
    const t = lat;
    lat = lon;
    lon = t;
  }
  return { lat, lon };
}

export function ymapsReadyPromise(ymaps) {
  return new Promise((resolve, reject) => {
    try {
      // API передаёт namespace в successCallback; первый аргумент — НЕ ошибка.
      ymaps.ready(() => resolve(), (err) => reject(err || new Error("ymaps.ready")));
    } catch (e) {
      reject(e);
    }
  });
}

export function ymapsGeocodePromise(ymaps, query, options) {
  const g = ymaps.geocode(query, options);
  if (g && typeof g.then === "function") {
    return new Promise((resolve, reject) => {
      g.then(resolve, reject);
    });
  }
  return Promise.resolve(g);
}

export function geoObjectsToArray(coll) {
  if (!coll) return [];
  const n = typeof coll.getLength === "function" ? coll.getLength() : 0;
  if (n > 0 && typeof coll.get === "function") {
    const out = [];
    for (let i = 0; i < n; i += 1) out.push(coll.get(i));
    return out;
  }
  if (typeof coll.each === "function") {
    const out = [];
    coll.each((obj) => {
      out.push(obj);
    });
    return out;
  }
  return [];
}

export async function yandexGeocodeSuggestItems(trimmed, cityHint) {
  const ymaps = window.ymaps;
  if (!ymaps || !trimmed) return null;
  try {
    await ymapsReadyPromise(ymaps);
  } catch {
    return null;
  }

  const queries = [];
  const pushQ = (q) => {
    const t = (q || "").trim();
    if (!t || queries.includes(t)) return;
    queries.push(t);
  };

  pushQ(buildNominatimQuery(trimmed, cityHint));
  if (cityHint) pushQ(`${cityHint}, ${trimmed}`);
  const withRu = trimmed.toLowerCase().includes("росси") ? trimmed : `${trimmed}, Россия`;
  pushQ(withRu);
  pushQ(trimmed);

  const items = [];
  const seenLines = new Set();

  for (const q of queries) {
    try {
      const res = await ymapsGeocodePromise(ymaps, q, { results: 10 });
      const coll = res?.geoObjects;
      const objs = geoObjectsToArray(coll);
      for (const obj of objs) {
        const label = geocodeResultLabel(obj);
        const display = simplifyCommaAddressLine(label);
        if (!display || seenLines.has(display.toLowerCase())) continue;
        const pos = geocodeResultCoords(obj);
        if (!pos) continue;
        seenLines.add(display.toLowerCase());
        let locCity = cityHint || "";
        if (!locCity && typeof obj.getLocalities === "function") {
          const loc = obj.getLocalities();
          if (Array.isArray(loc) && loc.length) [locCity] = loc;
        }
        items.push({
          value: display,
          full: display,
          lat: pos.lat,
          lon: pos.lon,
          city: locCity || "",
        });
        if (items.length >= 8) return items;
      }
    } catch {
      // try next query variant
    }
    if (items.length >= 8) break;
  }

  return items.length ? items : null;
}

/**
 * Подсказки Яндекс.Карт через Geosuggest (ymaps.suggest) — как в поиске на карте.
 * Нужен ключ VITE_YANDEX_SUGGEST_API_KEY и подключение скрипта с suggest_apikey (см. main.jsx).
 * Координаты подтягиваются отдельным геокодированием по полю value подсказки.
 */
export async function yandexMapsNativeSuggestItems(trimmed, cityHint) {
  if (!import.meta.env.VITE_YANDEX_SUGGEST_API_KEY) return null;
  const ymaps = window.ymaps;
  if (!ymaps || !trimmed || typeof ymaps.suggest !== "function") return null;
  try {
    await ymapsReadyPromise(ymaps);
  } catch {
    return null;
  }

  const q = cityHint ? `${cityHint}, ${trimmed}` : trimmed;
  let raw;
  try {
    raw = await ymaps.suggest(q, { results: 10 });
  } catch {
    return null;
  }
  if (!Array.isArray(raw) || !raw.length) return null;

  const rows = await Promise.all(
    raw.slice(0, 10).map(async (it) => {
      const geoQuery = String(it.value || it.displayName || "").trim();
      if (!geoQuery) return null;
      try {
        const res = await ymapsGeocodePromise(ymaps, geoQuery, { results: 1 });
        const objs = geoObjectsToArray(res?.geoObjects);
        const obj = objs[0];
        if (!obj) return null;
        const pos = geocodeResultCoords(obj);
        if (!pos) return null;
        const display = simplifyCommaAddressLine(
          (it.displayName && String(it.displayName).trim()) || geocodeResultLabel(obj) || geoQuery
        );
        if (!display) return null;
        let locCity = cityHint || "";
        if (!locCity && typeof obj.getLocalities === "function") {
          const loc = obj.getLocalities();
          if (Array.isArray(loc) && loc.length) [locCity] = loc;
        }
        return { value: display, full: display, lat: pos.lat, lon: pos.lon, city: locCity || "" };
      } catch {
        return null;
      }
    })
  );

  const out = [];
  const seen = new Set();
  for (const row of rows) {
    if (!row) continue;
    const k = row.value.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(row);
    if (out.length >= 8) break;
  }
  return out.length ? out : null;
}

