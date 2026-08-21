/**
 * Подсказки адресов — как при регистрации организации:
 * Photon + нормализация EN→RU; при наличии ключей — Яндекс.
 */

import { loadYandexMaps } from "./yandexMapsLoader.js";
import { mapPhotonFeatureToSuggestion, simplifyCommaAddressLine } from "./addressFormat.js";

function trimSeg(s) {
  return String(s || "").trim();
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
    const q =
      cityHint && !trimmed.toLowerCase().includes(cityHint.toLowerCase())
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
          const label = simplifyCommaAddressLine(
            String(it.displayName || it.value || obj.getAddressLine?.() || geoQuery).trim(),
          );
          if (!label || seen.has(label.toLowerCase())) continue;
          seen.add(label.toLowerCase());
          items.push({ value: label, full: label, lat: coords[0], lon: coords[1], city: cityHint || "" });
          if (items.length >= 8) break;
        }
      } catch {
        /* fall through */
      }
    }

    if (!items.length) {
      try {
        const res = await ymaps.geocode(q, { results: 6 });
        res.geoObjects.each((obj) => {
          const label = simplifyCommaAddressLine(
            String(obj.getAddressLine?.() || obj.properties.get("text") || "").trim(),
          );
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

export async function reverseGeocodeLatLon(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return "";

  try {
    const ymaps = await loadYandexMaps();
    if (ymaps) {
      await new Promise((resolve) => ymaps.ready(resolve));
      const res = await ymaps.geocode([lat, lon], { results: 1 });
      const first = res.geoObjects.get(0);
      const raw = String(first?.getAddressLine?.() || first?.properties?.get?.("text") || "").trim();
      if (raw) return simplifyCommaAddressLine(raw) || raw;
    }
  } catch {
    /* try photon */
  }

  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      limit: "1",
    });
    const res = await fetch(`https://photon.komoot.io/reverse?${params}`, {
      headers: { Accept: "application/json", "Accept-Language": "ru-RU, ru;q=0.9" },
    });
    if (!res.ok) return "";
    const data = await res.json();
    const feature = data?.features?.[0];
    const mapped = feature ? mapPhotonFeatureToSuggestion(feature) : null;
    return mapped?.value || "";
  } catch {
    return "";
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

  return photonItems.length ? photonItems : yaItems;
}

export async function detectCityHint() {
  if (typeof navigator === "undefined" || !navigator.geolocation) return "";
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const params = new URLSearchParams({
            lat: String(pos.coords.latitude),
            lon: String(pos.coords.longitude),
            limit: "1",
          });
          const res = await fetch(`https://photon.komoot.io/reverse?${params}`, {
            headers: { Accept: "application/json", "Accept-Language": "ru-RU, ru;q=0.9" },
          });
          if (!res.ok) {
            resolve("");
            return;
          }
          const data = await res.json();
          const mapped = data?.features?.[0] ? mapPhotonFeatureToSuggestion(data.features[0]) : null;
          resolve(mapped?.city || "");
        } catch {
          resolve("");
        }
      },
      () => resolve(""),
      { timeout: 8000, enableHighAccuracy: false },
    );
  });
}
