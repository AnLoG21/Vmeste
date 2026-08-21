/**
 * Подсказки адресов — тот же подход, что при регистрации организации:
 * Photon (komoot) + при наличии ключей Яндекс geocode/suggest.
 */

import { loadYandexMaps } from "./yandexMapsLoader.js";

function trimSeg(s) {
  return String(s || "").trim();
}

function simplifyLine(text) {
  if (!text || typeof text !== "string") return "";
  const parts = text
    .split(",")
    .map((x) => trimSeg(x))
    .filter(Boolean)
    .filter((p) => {
      const low = p.toLowerCase();
      return low !== "россия" && low !== "russia" && low !== "ru";
    });
  const seen = new Set();
  const out = [];
  for (const p of parts) {
    const k = p.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out.join(", ");
}

function mapPhotonFeature(feature) {
  const coords = feature?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lon = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const p = feature.properties || {};
  const city = trimSeg(p.city || p.town || p.village || p.municipality || p.locality || "");
  const state = trimSeg(p.state || "");
  const street = trimSeg(p.street || "");
  const house = trimSeg(p.housenumber || "");
  const name = trimSeg(p.name || "");
  const ordered = [state, city, street || name, house].filter(Boolean);
  const value = simplifyLine(ordered.join(", "));
  if (!value) return null;
  return { value, full: value, lat, lon, city: city || state || "" };
}

function buildQuery(trimmed, cityHint) {
  if (!trimmed) return "";
  const withRu = /росси/i.test(trimmed) ? trimmed : `${trimmed}, Россия`;
  if (cityHint) {
    const lower = trimmed.toLowerCase();
    const ch = cityHint.toLowerCase();
    if (lower.includes(ch)) return withRu;
    const words = trimmed.split(/\s+/).filter(Boolean).length;
    if (/^\d/.test(trimmed) || words <= 4) return `${cityHint}, ${trimmed}`;
  }
  return withRu;
}

export async function photonSuggestSearch(q, limit = 10) {
  const trimmed = trimSeg(q);
  if (trimmed.length < 2) return [];
  const params = new URLSearchParams({ q: trimmed, limit: String(limit) });
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
      const item = mapPhotonFeature(f);
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

async function yandexSuggestItems(trimmed, cityHint) {
  const hasKey = Boolean(
    import.meta.env.VITE_YANDEX_SUGGEST_API_KEY || import.meta.env.VITE_YANDEX_MAPS_API_KEY,
  );
  if (!hasKey) return [];
  try {
    const ymaps = await loadYandexMaps();
    if (!ymaps) return [];
    await new Promise((resolve, reject) => {
      try {
        ymaps.ready(resolve);
      } catch (e) {
        reject(e);
      }
    });
    const q = cityHint && !trimmed.toLowerCase().includes(cityHint.toLowerCase())
      ? `${cityHint}, ${trimmed}`
      : trimmed;
    const items = [];
    const seen = new Set();

    if (typeof ymaps.suggest === "function" && import.meta.env.VITE_YANDEX_SUGGEST_API_KEY) {
      try {
        const raw = await ymaps.suggest(q, { results: 8 });
        for (const it of raw || []) {
          const geoQuery = String(it.value || it.displayName || "").trim();
          if (!geoQuery) continue;
          const res = await ymaps.geocode(geoQuery, { results: 1 });
          const obj = res.geoObjects.get(0);
          if (!obj) continue;
          const coords = obj.geometry.getCoordinates();
          const label = simplifyLine(
            String(it.displayName || it.value || obj.getAddressLine?.() || geoQuery).trim(),
          );
          if (!label || seen.has(label.toLowerCase())) continue;
          seen.add(label.toLowerCase());
          items.push({ value: label, full: label, lat: coords[0], lon: coords[1], city: cityHint || "" });
          if (items.length >= 8) break;
        }
      } catch {
        /* fall through to geocode */
      }
    }

    if (!items.length) {
      try {
        const res = await ymaps.geocode(q, { results: 6 });
        res.geoObjects.each((obj) => {
          const label = simplifyLine(String(obj.getAddressLine?.() || obj.properties.get("text") || "").trim());
          if (!label || seen.has(label.toLowerCase())) return;
          const coords = obj.geometry.getCoordinates();
          seen.add(label.toLowerCase());
          items.push({ value: label, full: label, lat: coords[0], lon: coords[1], city: cityHint || "" });
        });
      } catch {
        /* ignore */
      }
    }
    return items;
  } catch {
    return [];
  }
}

/**
 * @returns {Promise<Array<{value:string,full:string,lat:number,lon:number,city:string}>>}
 */
export async function fetchAddressSuggestions(query, { cityHint = "" } = {}) {
  const trimmed = trimSeg(query);
  if (trimmed.length < 2) return [];

  const primaryQ = buildQuery(trimmed, cityHint);
  const [photonPrimary, yaItems] = await Promise.all([
    photonSuggestSearch(primaryQ, 10),
    yandexSuggestItems(trimmed, cityHint),
  ]);

  let photonItems = photonPrimary;
  if (!photonItems.length) {
    const secondQ = buildQuery(trimmed, "");
    if (secondQ !== primaryQ) photonItems = await photonSuggestSearch(secondQ, 10);
  }
  if (!photonItems.length && primaryQ !== trimmed) {
    photonItems = await photonSuggestSearch(trimmed, 10);
  }

  // Как при регистрации: приоритет Photon, иначе Яндекс
  return photonItems.length ? photonItems : yaItems;
}

export async function detectCityHint() {
  if (typeof navigator === "undefined" || !navigator.geolocation) return "";
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const params = new URLSearchParams({
            lat: String(latitude),
            lon: String(longitude),
            limit: "1",
          });
          const res = await fetch(`https://photon.komoot.io/reverse?${params}`, {
            headers: { Accept: "application/json", "Accept-Language": "ru" },
          });
          if (!res.ok) {
            resolve("");
            return;
          }
          const data = await res.json();
          const p = data?.features?.[0]?.properties || {};
          resolve(trimSeg(p.city || p.town || p.village || p.state || ""));
        } catch {
          resolve("");
        }
      },
      () => resolve(""),
      { timeout: 8000, enableHighAccuracy: false },
    );
  });
}
