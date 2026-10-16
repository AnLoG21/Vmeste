import { useEffect, useMemo, useRef, useState } from "react";
import { reverseGeocodeByCoords } from "../addressGeocode.js";
import { buildShortAddress, simplifyCommaAddressLine } from "../addressFormat.js";
import { fetchAddressSuggestions, reverseGeocodeLatLon } from "../addressSuggest.js";
import { DEFAULT_FILTERS, ROOM_OPTIONS, SORT_OPTIONS } from "./vkvartireApi.js";

const COMMUTE_PRESETS = [15, 20, 30, 45, 60];

function IconFilter({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 6h16M7 12h10M10 18h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity={active ? 1 : 0.9}
      />
    </svg>
  );
}

function IconSort() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 6v12M8 6l-3 3M8 6l3 3M16 18V6M16 18l-3-3M16 18l3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function pluralListings(n) {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return "объявлений";
  if (last === 1) return "объявление";
  if (last >= 2 && last <= 4) return "объявления";
  return "объявлений";
}

function countSheetFilters(filters) {
  let n = 0;
  if (filters.deal_type && filters.deal_type !== "rent") n += 1;
  if ((filters.rooms || []).length) n += 1;
  if (filters.price_min || filters.price_max) n += 1;
  if (filters.area_min || filters.area_max) n += 1;
  if (filters.floor_min || filters.floor_max) n += 1;
  if (filters.no_agents) n += 1;
  if (filters.q) n += 1;
  if (filters.anchor_lat != null && filters.anchor_lon != null) n += 1;
  if (filters.max_commute_min) n += 1;
  return n;
}

function buildActiveChips(filters) {
  const chips = [];
  chips.push({
    id: "deal",
    label: filters.deal_type === "sale" ? "Продажа" : "Аренда",
    clearable: false,
  });

  if ((filters.rooms || []).length) {
    const labels = (filters.rooms || []).map((r) => {
      const opt = ROOM_OPTIONS.find((o) => o.value === r);
      return opt?.label || String(r);
    });
    chips.push({
      id: "rooms",
      label: labels.join(", ") + " комн.",
      clear: (f) => ({ ...f, rooms: [] }),
    });
  }

  if (filters.price_min || filters.price_max) {
    const unit = filters.deal_type === "sale" ? "₽" : "₽/мес";
    const a = filters.price_min ? `от ${Number(filters.price_min).toLocaleString("ru-RU")}` : "";
    const b = filters.price_max ? `до ${Number(filters.price_max).toLocaleString("ru-RU")}` : "";
    chips.push({
      id: "price",
      label: [a, b].filter(Boolean).join(" ") + ` ${unit}`,
      clear: (f) => ({ ...f, price_min: "", price_max: "" }),
    });
  }

  if (filters.anchor_lat != null && filters.anchor_lon != null) {
    const place = filters.anchor_label || "Точка на карте";
    const short = place.length > 28 ? `${place.slice(0, 26)}…` : place;
    const mins = filters.max_commute_min
      ? ` · ≤${filters.max_commute_min} мин ${filters.commute_mode === "transit" ? "транспорт" : "пешком"}`
      : "";
    chips.push({
      id: "anchor",
      label: `${short}${mins}`,
      clear: (f) => ({
        ...f,
        anchor_lat: null,
        anchor_lon: null,
        anchor_label: "",
        max_commute_min: "",
      }),
    });
  }

  if (filters.area_min || filters.area_max) {
    const a = filters.area_min ? `от ${filters.area_min}` : "";
    const b = filters.area_max ? `до ${filters.area_max}` : "";
    chips.push({
      id: "area",
      label: `${[a, b].filter(Boolean).join(" ")} м²`,
      clear: (f) => ({ ...f, area_min: "", area_max: "" }),
    });
  }

  if (filters.floor_min || filters.floor_max) {
    const a = filters.floor_min ? `с ${filters.floor_min}` : "";
    const b = filters.floor_max ? `по ${filters.floor_max}` : "";
    chips.push({
      id: "floor",
      label: `Этаж ${[a, b].filter(Boolean).join(" ")}`,
      clear: (f) => ({ ...f, floor_min: "", floor_max: "" }),
    });
  }

  if (filters.no_agents) {
    chips.push({
      id: "no_agents",
      label: "Без агентов",
      clear: (f) => ({ ...f, no_agents: false }),
    });
  }

  if (filters.q) {
    chips.push({
      id: "q",
      label: `«${filters.q}»`,
      clear: (f) => ({ ...f, q: "" }),
    });
  }

  if (filters.sort && filters.sort !== "newest") {
    const opt = SORT_OPTIONS.find((o) => o.value === filters.sort);
    chips.push({
      id: "sort",
      label: opt?.label || "Сортировка",
      clear: (f) => ({ ...f, sort: "newest" }),
    });
  }

  return chips;
}

export default function VkvartireFilters({
  filters,
  onChange,
  commuteNote,
  resultTotal,
  savedSearches = [],
  onSaveSearch,
  onApplySaved,
  onDeleteSaved,
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const [suggests, setSuggests] = useState([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveNotify, setSaveNotify] = useState(false);
  const timerRef = useRef(null);
  const wrapRef = useRef(null);

  const priceUnit = draft.deal_type === "sale" ? "₽" : "₽/мес";
  const activeCount = countSheetFilters(filters);
  const hasAnchor = draft.anchor_lat != null && draft.anchor_lon != null;
  const chips = useMemo(() => buildActiveChips(filters), [filters]);
  const sortLabel = SORT_OPTIONS.find((o) => o.value === filters.sort)?.label || "Сортировка";

  function openSheet() {
    setDraft({ ...filters });
    setSuggests([]);
    setSuggestOpen(false);
    setSheetOpen(true);
  }

  function applySheet() {
    onChange({ ...draft });
    setSheetOpen(false);
  }

  function resetAll() {
    const next = { ...DEFAULT_FILTERS, deal_type: filters.deal_type || "rent" };
    onChange(next);
    setDraft(next);
  }

  async function pickMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        let label = "Моё местоположение";
        try {
          const result = await reverseGeocodeByCoords(lat, lon);
          const short = buildShortAddress(result?.address);
          label = simplifyCommaAddressLine(short || result?.display_name || "") || label;
        } catch {
          try {
            label = (await reverseGeocodeLatLon(lat, lon)) || label;
          } catch {
            /* keep fallback */
          }
        }
        setDraft((d) => ({
          ...d,
          anchor_lat: lat,
          anchor_lon: lon,
          anchor_label: label,
          max_commute_min: d.max_commute_min || "30",
        }));
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
    setDraft((d) => ({ ...d, anchor_label: value, anchor_lat: null, anchor_lon: null }));
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
        const looksMetro = /метро|м\.\s|станция/i.test(q) || q.length <= 22;
        const queries = looksMetro
          ? [q, `метро ${q}, Москва`, `станция метро ${q}`, `${q}, Москва`]
          : [q, `${q}, Москва`, `улица ${q}, Москва`];
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
    }, 280);
  }

  function pickSuggest(item) {
    setDraft((d) => ({
      ...d,
      anchor_lat: item.lat,
      anchor_lon: item.lon,
      anchor_label: item.value || item.full || "",
      max_commute_min: d.max_commute_min || "30",
    }));
    setSuggestOpen(false);
    setSuggests([]);
  }

  function toggleRoom(value) {
    setDraft((d) => {
      const cur = Array.isArray(d.rooms) ? [...d.rooms] : [];
      const i = cur.indexOf(value);
      if (i >= 0) cur.splice(i, 1);
      else cur.push(value);
      return { ...d, rooms: cur };
    });
  }

  return (
    <>
      <div className="vkvartire-filter-bar">
        <div className="vkvartire-filter-bar-actions">
          <button
            type="button"
            className={`vkvartire-icon-btn${activeCount ? " is-active" : ""}`}
            onClick={openSheet}
            aria-label="Фильтры"
            title="Фильтры"
          >
            <IconFilter active={Boolean(activeCount)} />
            {activeCount ? <span className="vkvartire-icon-badge">{activeCount}</span> : null}
          </button>
          <button
            type="button"
            className={`vkvartire-icon-btn${filters.sort && filters.sort !== "newest" ? " is-active" : ""}`}
            onClick={() => setSortOpen(true)}
            aria-label={`Сортировка: ${sortLabel}`}
            title="Сортировка"
          >
            <IconSort />
          </button>
          {typeof resultTotal === "number" ? (
            <span className="vkvartire-filter-bar-count">
              {resultTotal.toLocaleString("ru-RU")} {pluralListings(resultTotal)}
            </span>
          ) : null}
        </div>

        <div className="vkvartire-active-chips" role="list" aria-label="Активные фильтры">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              role="listitem"
              className={`vkvartire-active-chip${chip.clear ? "" : " is-static"}`}
              onClick={() => {
                if (chip.clear) onChange(chip.clear(filters));
                else openSheet();
              }}
            >
              <span>{chip.label}</span>
              {chip.clear ? (
                <span
                  className="vkvartire-active-chip-x"
                  aria-hidden="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(chip.clear(filters));
                  }}
                >
                  ×
                </span>
              ) : null}
            </button>
          ))}
          {activeCount > 0 ? (
            <button type="button" className="vkvartire-active-chip vkvartire-active-chip--reset" onClick={resetAll}>
              Сбросить
            </button>
          ) : null}
        </div>
      </div>

      {sheetOpen ? (
        <div className="vkvartire-more-backdrop" role="presentation" onClick={() => setSheetOpen(false)}>
          <div
            className="vkvartire-more-sheet vkvartire-filter-sheet"
            role="dialog"
            aria-label="Фильтры"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="vkvartire-sheet-head">
              <h3>Фильтры</h3>
              <button type="button" className="vkvartire-listing-sheet-close" onClick={() => setSheetOpen(false)} aria-label="Закрыть">
                ×
              </button>
            </div>

            <div className="vkvartire-filter-block">
              <div className="vkvartire-filter-label">Тип сделки</div>
              <div className="vkvartire-segment" role="group" aria-label="Тип сделки">
                <button
                  type="button"
                  className={draft.deal_type === "rent" ? "is-active" : ""}
                  onClick={() => setDraft({ ...draft, deal_type: "rent" })}
                >
                  Аренда
                </button>
                <button
                  type="button"
                  className={draft.deal_type === "sale" ? "is-active" : ""}
                  onClick={() => setDraft({ ...draft, deal_type: "sale" })}
                >
                  Продажа
                </button>
              </div>
            </div>

            <div className="vkvartire-filter-block">
              <div className="vkvartire-filter-label">Комнаты</div>
              <div className="vkvartire-filter-row" role="group" aria-label="Комнаты">
                {ROOM_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`vkvartire-chip${(draft.rooms || []).includes(opt.value) ? " is-active" : ""}`}
                    onClick={() => toggleRoom(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="vkvartire-filter-block">
              <div className="vkvartire-filter-label">Цена, {priceUnit}</div>
              <div className="vkvartire-price-inputs">
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="от"
                  value={draft.price_min}
                  onChange={(e) => setDraft({ ...draft, price_min: e.target.value })}
                  aria-label="Цена от"
                />
                <span className="vkvartire-price-sep" aria-hidden="true">
                  —
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="до"
                  value={draft.price_max}
                  onChange={(e) => setDraft({ ...draft, price_max: e.target.value })}
                  aria-label="Цена до"
                />
              </div>
            </div>

            <div className="vkvartire-filter-block" ref={wrapRef}>
              <div className="vkvartire-filter-label">Где искать</div>
              <p className="vkvartire-filter-hint">
                Метро, улица или район — выберите из подсказок. Или поставьте точку на карте.
              </p>
              <div className="vkvartire-anchor-row">
                <div className="vkvartire-anchor-suggest-wrap">
                  <input
                    type="text"
                    placeholder="Например: м. Сокол или Тверская"
                    value={draft.anchor_label || ""}
                    onChange={(e) => onAnchorInput(e.target.value)}
                    onFocus={() => suggests.length && setSuggestOpen(true)}
                    aria-label="Адрес, метро или район"
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
                <button type="button" className="vkvartire-chip" onClick={pickMyLocation}>
                  Рядом
                </button>
              </div>

              <div className="vkvartire-filter-row vkvartire-commute-modes" role="group" aria-label="Способ">
                <button
                  type="button"
                  className={`vkvartire-chip${draft.commute_mode === "walk" ? " is-active" : ""}`}
                  onClick={() => setDraft({ ...draft, commute_mode: "walk" })}
                >
                  Пешком
                </button>
                <button
                  type="button"
                  className={`vkvartire-chip${draft.commute_mode === "transit" ? " is-active" : ""}`}
                  onClick={() => setDraft({ ...draft, commute_mode: "transit" })}
                >
                  На транспорте
                </button>
              </div>

              <div className="vkvartire-filter-row" role="group" aria-label="Минуты">
                {COMMUTE_PRESETS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`vkvartire-chip${String(draft.max_commute_min) === String(m) ? " is-active" : ""}`}
                    onClick={() => setDraft({ ...draft, max_commute_min: String(m) })}
                    disabled={!hasAnchor && !draft.anchor_label}
                    title={!hasAnchor ? "Сначала выберите адрес из подсказки" : undefined}
                  >
                    {m} мин
                  </button>
                ))}
                {hasAnchor ? (
                  <button
                    type="button"
                    className="vkvartire-chip vkvartire-chip--muted"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        anchor_lat: null,
                        anchor_lon: null,
                        anchor_label: "",
                        max_commute_min: "",
                      })
                    }
                  >
                    Сбросить точку
                  </button>
                ) : null}
              </div>
              {hasAnchor && draft.max_commute_min ? (
                <p className="vkvartire-commute-note">
                  Радиус ≈ {draft.max_commute_min} мин{" "}
                  {draft.commute_mode === "transit" ? "на транспорте" : "пешком"} от «
                  {draft.anchor_label || "точки"}».
                </p>
              ) : null}
              {commuteNote && hasAnchor ? <p className="vkvartire-commute-note">{commuteNote}</p> : null}
            </div>

            <div className="vkvartire-filter-block">
              <div className="vkvartire-filter-label">Площадь и этаж</div>
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
                  Площадь до, м²
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
                  Этаж до
                  <input
                    type="number"
                    value={draft.floor_max}
                    onChange={(e) => setDraft({ ...draft, floor_max: e.target.value })}
                  />
                </label>
              </div>
            </div>

            <div className="vkvartire-filter-block">
              <label className="vkvartire-more-check">
                <input
                  type="checkbox"
                  checked={Boolean(draft.no_agents)}
                  onChange={(e) => setDraft({ ...draft, no_agents: e.target.checked })}
                />
                Только без посредников
              </label>
              <label className="vkvartire-field" style={{ marginTop: "0.65rem" }}>
                Текст в адресе или описании
                <input
                  type="text"
                  value={draft.q || ""}
                  onChange={(e) => setDraft({ ...draft, q: e.target.value })}
                  placeholder="Балкон, новостройка…"
                />
              </label>
            </div>

            {savedSearches.length ? (
              <div className="vkvartire-filter-block">
                <div className="vkvartire-filter-label">Сохранённые поиски</div>
                <div className="vkvartire-filter-row vkvartire-saved-row">
                  {savedSearches.map((s) => (
                    <span key={s.id} className="vkvartire-saved-chip">
                      <button
                        type="button"
                        className="vkvartire-chip is-active"
                        onClick={() => {
                          onApplySaved?.(s);
                          setSheetOpen(false);
                        }}
                      >
                        {s.name}
                        {s.notify ? " · ✉" : ""}
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
              </div>
            ) : null}

            <div className="vkvartire-more-actions vkvartire-filter-sheet-actions">
              <button type="button" className="ghost" onClick={() => setSaveOpen(true)}>
                Сохранить поиск
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  const next = { ...DEFAULT_FILTERS, deal_type: draft.deal_type || "rent" };
                  setDraft(next);
                }}
              >
                Сбросить
              </button>
              <button type="button" className="primary" onClick={applySheet}>
                Показать
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {sortOpen ? (
        <div className="vkvartire-more-backdrop" role="presentation" onClick={() => setSortOpen(false)}>
          <div
            className="vkvartire-more-sheet vkvartire-sort-sheet"
            role="dialog"
            aria-label="Сортировка"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="vkvartire-sheet-head">
              <h3>Сортировка</h3>
              <button type="button" className="vkvartire-listing-sheet-close" onClick={() => setSortOpen(false)} aria-label="Закрыть">
                ×
              </button>
            </div>
            <div className="vkvartire-sort-list" role="listbox" aria-label="Варианты сортировки">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={filters.sort === opt.value}
                  className={`vkvartire-sort-option${filters.sort === opt.value ? " is-active" : ""}`}
                  onClick={() => {
                    onChange({ ...filters, sort: opt.value });
                    setSortOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              ))}
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
            <label className="vkvartire-field">
              Название
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Например: 2к у работы"
              />
            </label>
            <label className="vkvartire-more-check" style={{ marginTop: "0.75rem" }}>
              <input type="checkbox" checked={saveNotify} onChange={(e) => setSaveNotify(e.target.checked)} />
              Уведомлять о новых объявлениях
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
                  await onSaveSearch?.({ name, notify: saveNotify, filters: draft });
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
