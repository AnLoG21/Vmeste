import MiniDatePicker from "./MiniDatePicker.jsx";
import { sphereMapIconHref } from "./clientOrgFeatures.js";
import { todayIsoDate } from "./bookingCalendarUtils.jsx";

/** Client/provider map filters modal content. App wraps with createPortal(..., document.body). */
export default function ClientMapFiltersModal({
  clientFilterModalDraft,
  setClientFilterModalDraft,
  sphereOptions,
  clientFilterServiceGroups,
  setClientFiltersOpen,
  setClientDiscoverFilters,
  setClientBookingForm,
  emptyClientFilters,
}) {
  return (
    <div
      className="modal-backdrop modal-backdrop--app-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-filters-title"
      onClick={() => setClientFiltersOpen(false)}
    >
      <div className="modal-card client-filters-modal" onClick={(e) => e.stopPropagation()}>
        <div className="client-filters-modal-head">
          <h3 id="client-filters-title">Фильтры</h3>
          <button
            type="button"
            className="modal-close-btn"
            aria-label="Закрыть"
            onClick={() => setClientFiltersOpen(false)}
          >
            ×
          </button>
        </div>
        <div className="form">
          <p className="field-label">Сфера услуг</p>
          <div className="filter-sphere-grid" role="listbox" aria-label="Сфера услуг">
            <button
              type="button"
              role="option"
              aria-selected={!clientFilterModalDraft.sphere}
              className={["filter-sphere-chip", !clientFilterModalDraft.sphere && "filter-sphere-chip--active"]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setClientFilterModalDraft((d) => ({ ...d, sphere: "", service: "" }))}
            >
              <span className="filter-sphere-chip-icon filter-sphere-chip-icon--any" aria-hidden="true">
                ✦
              </span>
              <span>Любая</span>
            </button>
            {sphereOptions.filter((s) => s.key !== "marketplaces").map((s) => (
              <button
                key={s.key}
                type="button"
                role="option"
                aria-selected={clientFilterModalDraft.sphere === s.key}
                className={[
                  "filter-sphere-chip",
                  clientFilterModalDraft.sphere === s.key && "filter-sphere-chip--active",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() =>
                  setClientFilterModalDraft((d) => ({
                    ...d,
                    sphere: s.key,
                    service: d.sphere === s.key ? d.service : "",
                  }))
                }
              >
                <img className="filter-sphere-chip-icon" src={sphereMapIconHref(s.key)} alt="" />
                <span>{s.value}</span>
              </button>
            ))}
          </div>
          <p className="field-label">Услуга</p>
          {clientFilterModalDraft.sphere && clientFilterServiceGroups.length > 0 ? (
            <div className="filter-service-tree">
              <button
                type="button"
                className={[
                  "filter-service-any",
                  !clientFilterModalDraft.service && "filter-service-any--active",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setClientFilterModalDraft((d) => ({ ...d, service: "" }))}
              >
                Любая услуга
              </button>
              {clientFilterServiceGroups.map((group) => (
                <div key={group.id} className="filter-service-group">
                  <div className="filter-service-group-head">
                    <img src={group.icon} alt="" className="filter-service-group-icon" />
                    <strong>{group.name}</strong>
                  </div>
                  <div className="filter-service-chips">
                    {group.services.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        className={[
                          "filter-service-chip",
                          clientFilterModalDraft.service === s.value && "filter-service-chip--active",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        title={s.label}
                        onClick={() =>
                          setClientFilterModalDraft((d) => ({
                            ...d,
                            service: d.service === s.value ? "" : s.value,
                          }))
                        }
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <input
              id="client-filter-service"
              type="search"
              placeholder="Название услуги"
              value={clientFilterModalDraft.service}
              onChange={(e) => setClientFilterModalDraft((d) => ({ ...d, service: e.target.value }))}
            />
          )}
          <div className="row-2">
            <div>
              <label className="field-label" htmlFor="client-filter-minp">
                Цена от (₽)
              </label>
              <input
                id="client-filter-minp"
                type="number"
                min="0"
                step="1"
                placeholder="не важно"
                value={clientFilterModalDraft.min_price}
                onChange={(e) => setClientFilterModalDraft((d) => ({ ...d, min_price: e.target.value }))}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="client-filter-maxp">
                Цена до (₽)
              </label>
              <input
                id="client-filter-maxp"
                type="number"
                min="0"
                step="1"
                placeholder="не важно"
                value={clientFilterModalDraft.max_price}
                onChange={(e) => setClientFilterModalDraft((d) => ({ ...d, max_price: e.target.value }))}
              />
            </div>
          </div>
          <p className="muted small">Учитывается диапазон цен активных услуг исполнителя.</p>
          <MiniDatePicker
            id="client-filter-date"
            label="Дата записи"
            value={clientFilterModalDraft.slot_date}
            allowClear
            onChange={(iso) => setClientFilterModalDraft((d) => ({ ...d, slot_date: iso }))}
          />
          <p className="muted small">Дату и время указывайте только если нужны исполнители со свободным слотом. Для фильтра по сфере оставьте дату пустой.</p>
          <div className="row-2">
            <div>
              <label className="field-label" htmlFor="client-filter-tf">
                Время с
              </label>
              <input
                id="client-filter-tf"
                type="time"
                value={clientFilterModalDraft.time_from}
                onChange={(e) => setClientFilterModalDraft((d) => ({ ...d, time_from: e.target.value }))}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="client-filter-tt">
                Время до
              </label>
              <input
                id="client-filter-tt"
                type="time"
                value={clientFilterModalDraft.time_to}
                onChange={(e) => setClientFilterModalDraft((d) => ({ ...d, time_to: e.target.value }))}
              />
            </div>
          </div>
          <p className="muted small">Время учитывается только вместе с выбранной датой или диапазоном дат на сервере.</p>
        </div>
        <div className="client-filters-actions">
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              const empty = emptyClientFilters();
              setClientFilterModalDraft(empty);
              setClientDiscoverFilters(empty);
              setClientFiltersOpen(false);
            }}
          >
            Сбросить всё
          </button>
          <button type="button" className="ghost-btn" onClick={() => setClientFiltersOpen(false)}>
            Отмена
          </button>
          <button
            type="button"
            onClick={() => {
              const slotDate = String(clientFilterModalDraft.slot_date || "").trim();
              const timeFrom = String(clientFilterModalDraft.time_from || "").trim();
              const timeTo = String(clientFilterModalDraft.time_to || "").trim();
              const nextFilters = {
                ...clientFilterModalDraft,
                slot_date: slotDate,
                time_from: slotDate ? timeFrom : "",
                time_to: slotDate ? timeTo : "",
              };
              setClientDiscoverFilters(nextFilters);
              setClientBookingForm((p) => ({
                ...p,
                bookDate: slotDate || p.bookDate || todayIsoDate(),
              }));
              setClientFiltersOpen(false);
            }}
          >
            Применить
          </button>
        </div>
      </div>
    </div>
  );
}
