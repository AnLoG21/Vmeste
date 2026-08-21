import { useEffect, useRef, useState } from "react";
import { detectCityHint, fetchAddressSuggestions } from "./addressSuggest.js";

/**
 * Поле адреса с подсказками — как при регистрации организации.
 */
export default function CafeGuestAddressInput({
  value,
  onChange,
  onSelectPlace,
  placeholder = "Адрес доставки *",
  required = false,
  cityHint: cityHintProp = "",
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [cityHint, setCityHint] = useState(cityHintProp || "");
  const seqRef = useRef(0);
  const timerRef = useRef(null);
  const wrapRef = useRef(null);
  const pickedRef = useRef(false);

  useEffect(() => {
    if (cityHintProp) setCityHint(cityHintProp);
  }, [cityHintProp]);

  useEffect(() => {
    if (cityHintProp) return undefined;
    let cancelled = false;
    detectCityHint().then((city) => {
      if (!cancelled && city) setCityHint(city);
    });
    return () => {
      cancelled = true;
    };
  }, [cityHintProp]);

  useEffect(() => {
    function onDoc(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, []);

  async function runSuggest(query) {
    const trimmed = String(query || "").trim();
    const seq = ++seqRef.current;
    if (trimmed.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const items = await fetchAddressSuggestions(trimmed, { cityHint });
    if (seqRef.current !== seq) return;
    setSuggestions(items);
    setOpen(items.length > 0);
  }

  function handleChange(e) {
    const v = e.target.value;
    pickedRef.current = false;
    onChange?.(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => runSuggest(v), 280);
  }

  function pick(item) {
    pickedRef.current = true;
    setOpen(false);
    setSuggestions([]);
    const line = String(item.value || "").trim();
    onChange?.(line);
    if (item.city) setCityHint(item.city);
    if (Number.isFinite(item.lat) && Number.isFinite(item.lon)) {
      onSelectPlace?.({ address: line, lat: item.lat, lon: item.lon });
    }
  }

  return (
    <div className="cafe-guest-address" ref={wrapRef}>
      <textarea
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onFocus={() => {
          if (suggestions.length) setOpen(true);
          else if (String(value || "").trim().length >= 2) runSuggest(value);
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 200);
        }}
        required={required}
        rows={2}
        autoComplete="street-address"
      />
      {cityHint ? <p className="hint cafe-guest-address-hint">Город поиска: {cityHint}</p> : null}
      {open && suggestions.length > 0 ? (
        <div className="suggestions cafe-guest-suggestions" role="listbox">
          {suggestions.map((item, idx) => (
            <button
              key={`${item.value}-${idx}`}
              type="button"
              className="suggestion-item"
              onPointerDown={(e) => {
                e.preventDefault();
                pick(item);
              }}
            >
              {item.value}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
