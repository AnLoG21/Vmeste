import { useState } from "react";
import { ROOM_OPTIONS } from "./vkvartireApi.js";

export default function VkvartireFilters({ filters, onChange, commuteNote }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [draft, setDraft] = useState(filters);

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
        </div>

        <div className="vkvartire-anchor-row">
          <input
            type="text"
            placeholder="Точка / адрес / метро"
            value={filters.anchor_label || ""}
            onChange={(e) => onChange({ ...filters, anchor_label: e.target.value })}
            aria-label="Якорь удалённости"
          />
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
            Укажите координаты через «Гео» или клик на карте.
          </p>
        ) : (
          <p className="vkvartire-commute-note">
            Главный фильтр: точка + минуты. Пока — приближение по прямой (~80 м/мин).
          </p>
        )}
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
              <label style={{ gridColumn: "1 / -1", flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
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
    </>
  );
}
