import { useEffect, useRef, useState } from "react";
import { fetchAddressSuggestions } from "../addressSuggest.js";
import { ROOM_OPTIONS } from "./vkvartireApi.js";

export default function VkvartireFilters({
  filters,
  onChange,
  commuteNote,
  savedSearches = [],
  onSaveSearch,
  onApplySaved,
  onDeleteSaved,
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const [suggests, setSuggests] = useState([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveNotify, setSaveNotify] = useState(false);
  const timerRef = useRef(null);
  const wrapRef = useRef(null);

  function toggleRoom(value) {
    const cur = Array.isArray(filters.rooms) ? [...filters.rooms] : [];
    const i = cur.indexOf(value);
    if (i >= 0) cur.splice(i, 1);
    else cur.push(value);
    onChange({ ...filters, rooms: cur });
  }

  function openMore() {
    setDraft({ ...filters });
    setMoreOpen(true);
  }

  function applyMore() {
    onChange({ ...filters, ...draft });
    setMoreOpen(false);
  }

  async function pickMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({
          ...filters,
          anchor_lat: pos.coords.latitude,
          anchor_lon: pos.coords.longitude,
          anchor_label: "Моё местоположение",
          max_commute_min: filters.max_commute_min || 20,
        });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }

  useEffect(() => {
    function onDoc(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setSuggestOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function onAnchorInput(value) {
    onChange({ ...filters, anchor_label: value });
    clearTimeout(timerRef.current);
    if (!value || value.trim().length < 2) {
      setSuggests([]);
      setSuggestOpen(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setSuggestBusy(true);
      try {
        const q = value.trim();
        const looksMetro = /метро|м\.\s/i.test(q) || q.length <= 24;
        const queries = looksMetro
          ? [q, `метро ${q}, Москва`, `${q}, Москва`]
          : [q, `${q}, Москва`];
        let items = [];
        for (const query of queries) {
          items = await fetchAddressSuggestions(query, { cityHint: "Москва" });
          if (items.length) break;
        }
        setSuggests(items.slice(0, 8));
        setSuggestOpen(items.length > 0);
      } catch {
        setSuggests([]);
      } finally {
        setSuggestBusy(false);
      }
    }, 320);
  }

  function pickSuggest(item) {
    onChange({
      ...filters,
      anchor_lat: item.lat,
      anchor_lon: item.lon,
      anchor_label: item.value || item.full || "",
      max_commute_min: filters.max_commute_min || 20,
    });
    setSuggestOpen(false);
    setSuggests([]);
  }

  return (
    <>
      <div className="vkvartire-filters">
        <div className="vkvartire-filter-row" role="group" aria-label="Тип сделки">
          <button
            type="button"
            className={`vkvartire-chip${filters.deal_type === "rent" ? " is-active" : ""}`}
            onClick={() => onChange({ ...filters, deal_type: "rent" })}
          >
            Аренда
          </button>
          <button
            type="button"
            className={`vkvartire-chip${filters.deal_type === "sale" ? " is-active" : ""}`}
            onClick={() => onChange({ ...filters, deal_type: "sale" })}
          >
            Продажа
          </button>
        </div>

        <div className="vkvartire-filter-row" role="group" aria-label="Комнаты">
          {ROOM_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`vkvartire-chip${(filters.rooms || []).includes(opt.value) ? " is-active" : ""}`}
              onClick={() => toggleRoom(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="vkvartire-filter-row">
          <div className="vkvartire-price-inputs">
            <input
              type="number"
              inputMode="numeric"
              placeholder="Цена от"
              value={filters.price_min}
              onChange={(e) => onChange({ ...filters, price_min: e.target.value })}
              aria-label="Цена от"
            />
            <span aria-hidden="true">—</span>
            <input
              type="number"
              inputMode="numeric"
              placeholder="до"
              value={filters.price_max}
              onChange={(e) => onChange({ ...filters, price_max: e.target.value })}
              aria-label="Цена до"
            />
          </div>
          <button type="button" className="vkvartire-chip" onClick={openMore}>
            Ещё
          </button>
          <button type="button" className="vkvartire-chip" onClick={() => setSaveOpen(true)}>
            Сохранить поиск
          </button>
        </div>

        <div className="vkvartire-anchor-row" ref={wrapRef}>
          <div className="vkvartire-anchor-suggest-wrap">
            <input
              type="text"
              placeholder="Адрес, метро или точка"
              value={filters.anchor_label || ""}
              onChange={(e) => onAnchorInput(e.target.value)}
              onFocus={() => suggests.length && setSuggestOpen(true)}
              aria-label="Якорь удалённости"
              autoComplete="off"
            />
            {suggestBusy ? <span className="vkvartire-suggest-busy">…</span> : null}
            {suggestOpen && suggests.length > 0 ? (
              <ul className="vkvartire-suggest-list" role="listbox">
                {suggests.map((item) => (
                  <li key={`${item.value}-${item.lat}-${item.lon}`}>
                    <button type="button" onClick={() => pickSuggest(item)}>
                      {item.value}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <input
            type="number"
            inputMode="numeric"
            placeholder="мин"
            title="Максимум минут пешком (примерно)"
            value={filters.max_commute_min}
            onChange={(e) => onChange({ ...filters, max_commute_min: e.target.value })}
            style={{ width: "4.2rem" }}
            aria-label="Минут до точки"
          />
          <button type="button" className="vkvartire-chip" onClick={pickMyLocation}>
            Гео
          </button>
          {filters.anchor_lat != null ? (
            <button
              type="button"
              className="vkvartire-chip"
              onClick={() =>
                onChange({
                  ...filters,
                  anchor_lat: null,
                  anchor_lon: null,
                  anchor_label: "",
                  max_commute_min: "",
                })
              }
            >
              Сброс точки
            </button>
          ) : null}
        </div>
        {commuteNote ? <p className="vkvartire-commute-note">{commuteNote}</p> : null}
        {filters.anchor_lat != null && filters.max_commute_min ? (
          <p className="vkvartire-commute-note">
            Радиус ≈ {filters.max_commute_min} мин пешком от «{filters.anchor_label || "точки"}».
          </p>
        ) : (
          <p className="vkvartire-commute-note">
            Главный фильтр: адрес / метро / гео + минуты. Пока приближение по прямой (~80 м/мин).
          </p>
        )}

        {savedSearches.length ? (
          <div className="vkvartire-filter-row vkvartire-saved-row" aria-label="Сохранённые поиски">
            {savedSearches.map((s) => (
              <span key={s.id} className="vkvartire-saved-chip">
                <button type="button" className="vkvartire-chip is-active" onClick={() => onApplySaved?.(s)}>
                  {s.name}
                  {s.notify ? " 🔔" : ""}
                </button>
                <button
                  type="button"
                  className="vkvartire-saved-del"
                  aria-label={`Удалить ${s.name}`}
                  onClick={() => onDeleteSaved?.(s)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {moreOpen ? (
        <div className="vkvartire-more-backdrop" role="presentation" onClick={() => setMoreOpen(false)}>
          <div
            className="vkvartire-more-sheet"
            role="dialog"
            aria-label="Дополнительные фильтры"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Ещё фильтры</h3>
            <div className="vkvartire-more-grid">
              <label>
                Площадь от, м²
                <input
                  type="number"
                  value={draft.area_min}
                  onChange={(e) => setDraft({ ...draft, area_min: e.target.value })}
                />
              </label>
              <label>
                до
                <input
                  type="number"
                  value={draft.area_max}
                  onChange={(e) => setDraft({ ...draft, area_max: e.target.value })}
                />
              </label>
              <label>
                Этаж от
                <input
                  type="number"
                  value={draft.floor_min}
                  onChange={(e) => setDraft({ ...draft, floor_min: e.target.value })}
                />
              </label>
              <label>
                до
                <input
                  type="number"
                  value={draft.floor_max}
                  onChange={(e) => setDraft({ ...draft, floor_max: e.target.value })}
                />
              </label>
              <label
                style={{ gridColumn: "1 / -1", flexDirection: "row", alignItems: "center", gap: "0.5rem" }}
              >
                <input
                  type="checkbox"
                  checked={Boolean(draft.no_agents)}
                  onChange={(e) => setDraft({ ...draft, no_agents: e.target.checked })}
                />
                Без посредников
              </label>
              <label style={{ gridColumn: "1 / -1" }}>
                Поиск по адресу / метро
                <input
                  type="text"
                  value={draft.q || ""}
                  onChange={(e) => setDraft({ ...draft, q: e.target.value })}
                  style={{ width: "100%" }}
                />
              </label>
            </div>
            <div className="vkvartire-more-actions">
              <button type="button" className="ghost" onClick={() => setMoreOpen(false)}>
                Отмена
              </button>
              <button type="button" className="primary" onClick={applyMore}>
                Применить
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {saveOpen ? (
        <div className="vkvartire-more-backdrop" role="presentation" onClick={() => setSaveOpen(false)}>
          <div
            className="vkvartire-more-sheet"
            role="dialog"
            aria-label="Сохранить поиск"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Сохранить поиск</h3>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              Название
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Например: 2к у Тверской"
                style={{ width: "100%", padding: "0.5rem", borderRadius: 10, border: "1px solid #c9d6e3" }}
              />
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginTop: "0.75rem",
                fontSize: "0.9rem",
              }}
            >
              <input type="checkbox" checked={saveNotify} onChange={(e) => setSaveNotify(e.target.checked)} />
              Уведомлять о новых (скоро)
            </label>
            <div className="vkvartire-more-actions">
              <button type="button" className="ghost" onClick={() => setSaveOpen(false)}>
                Отмена
              </button>
              <button
                type="button"
                className="primary"
                onClick={async () => {
                  const name = saveName.trim() || "Мой поиск";
                  await onSaveSearch?.({ name, notify: saveNotify });
                  setSaveOpen(false);
                  setSaveName("");
                  setSaveNotify(false);
                }}
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
