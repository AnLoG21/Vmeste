import { useEffect, useRef, useState } from "react";
import { loadYandexMaps } from "./yandexMapsLoader.js";

/**
 * Поле адреса с подсказками Яндекс.Карт (suggest / geocode).
 */
export default function CafeGuestAddressInput({
  value,
  onChange,
  onSelectPlace,
  placeholder = "Адрес доставки *",
  required = false,
  cityHint = "",
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const seqRef = useRef(0);
  const timerRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, []);

  async function fetchSuggestions(query) {
    const trimmed = String(query || "").trim();
    const seq = ++seqRef.current;
    if (trimmed.length < 3) {
      setSuggestions([]);
      return;
    }
    try {
      const ymaps = await loadYandexMaps();
      if (!ymaps || seqRef.current !== seq) return;
      await new Promise((r) => ymaps.ready(r));
      if (seqRef.current !== seq) return;

      let items = [];
      const q = cityHint && !trimmed.toLowerCase().includes(String(cityHint).toLowerCase())
        ? `${cityHint}, ${trimmed}`
        : trimmed;

      if (typeof ymaps.suggest === "function") {
        try {
          const raw = await ymaps.suggest(q, { results: 8 });
          items = (raw || [])
            .map((it) => {
              const label = String(it.displayName || it.value || "").trim();
              return label ? { label, query: label } : null;
            })
            .filter(Boolean);
        } catch {
          items = [];
        }
      }

      if (!items.length) {
        try {
          const res = await ymaps.geocode(q, { results: 6 });
          const list = [];
          res.geoObjects.each((obj) => {
            const label = String(obj.getAddressLine?.() || obj.properties.get("text") || "").trim();
            const coords = obj.geometry.getCoordinates();
            if (label) list.push({ label, query: label, lat: coords[0], lon: coords[1] });
          });
          items = list;
        } catch {
          /* ignore */
        }
      }

      if (seqRef.current !== seq) return;
      setSuggestions(items);
      setOpen(items.length > 0);
    } catch {
      if (seqRef.current === seq) setSuggestions([]);
    }
  }

  function handleChange(e) {
    const v = e.target.value;
    onChange?.(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchSuggestions(v), 280);
  }

  async function pick(item) {
    setOpen(false);
    setSuggestions([]);
    onChange?.(item.label);
    let lat = item.lat;
    let lon = item.lon;
    if (lat == null || lon == null) {
      try {
        const ymaps = await loadYandexMaps();
        if (ymaps) {
          const res = await ymaps.geocode(item.query || item.label, { results: 1 });
          const first = res.geoObjects.get(0);
          if (first) {
            const coords = first.geometry.getCoordinates();
            lat = coords[0];
            lon = coords[1];
          }
        }
      } catch {
        /* ignore */
      }
    }
    if (lat != null && lon != null) {
      onSelectPlace?.({ address: item.label, lat, lon });
    }
  }

  async function geocodeTyped() {
    const trimmed = String(value || "").trim();
    if (trimmed.length < 5) return;
    try {
      const ymaps = await loadYandexMaps();
      if (!ymaps) return;
      const res = await ymaps.geocode(trimmed, { results: 1 });
      const first = res.geoObjects.get(0);
      if (!first) return;
      const coords = first.geometry.getCoordinates();
      const label = String(first.getAddressLine?.() || trimmed).trim();
      onSelectPlace?.({ address: label, lat: coords[0], lon: coords[1] });
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="cafe-guest-address" ref={wrapRef}>
      <textarea
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onFocus={() => suggestions.length && setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => {
            setOpen(false);
            if (!suggestions.length) geocodeTyped();
          }, 180);
        }}
        required={required}
        rows={2}
        autoComplete="street-address"
      />
      {open && suggestions.length ? (
        <ul className="cafe-guest-suggest" role="listbox">
          {suggestions.map((item, idx) => (
            <li key={`${item.label}-${idx}`}>
              <button
                type="button"
                className="cafe-guest-suggest-item"
                onPointerDown={(e) => {
                  e.preventDefault();
                  pick(item);
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
