import { useState } from "react";
import { API_URL } from "./config.js";
import ServicePhotoCarousel from "./ServicePhotoCarousel.jsx";
import ServiceMaterialsBlock from "./ServiceMaterialsBlock.jsx";
import { showToast } from "./toast.js";

export function buildServiceDraftFromService(service) {
  return {
    price: String(service.price ?? 0),
    duration_minutes: String(service.duration_minutes ?? 30),
    is_active: Boolean(service.is_active),
  };
}

export function serviceDraftEqualsService(draft, service) {
  if (!draft) return true;
  return (
    Number(draft.price) === Number(service.price) &&
    Number(draft.duration_minutes) === Number(service.duration_minutes) &&
    Boolean(draft.is_active) === Boolean(service.is_active)
  );
}

export default function ServiceEditor({
  service,
  draft,
  dirty,
  onDraftChange,
  onUploadPhotos,
  onDeletePhoto,
  onOptionsChange,
  authFetch,
}) {
  const local = draft ?? buildServiceDraftFromService(service);
  const photos = service.photos || [];
  const gallery = service.gallery || [];
  const options = service.options || [];
  const [optForm, setOptForm] = useState({ name: "", price: "0", extra_minutes: "0" });
  const [optBusy, setOptBusy] = useState(false);

  async function refreshOptions() {
    const res = await authFetch(`${API_URL}/catalog/services/${service.id}/options/`);
    if (!res.ok) return;
    const list = await res.json();
    onOptionsChange?.(service.id, Array.isArray(list) ? list : []);
  }

  async function addOption(e) {
    e?.preventDefault?.();
    const name = optForm.name.trim();
    if (!name) {
      showToast("Укажите название доп. услуги");
      return;
    }
    setOptBusy(true);
    try {
      const res = await authFetch(`${API_URL}/catalog/services/${service.id}/options/`, {
        method: "POST",
        body: JSON.stringify({
          name,
          price: optForm.price || 0,
          extra_minutes: Number(optForm.extra_minutes) || 0,
          is_active: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Не удалось добавить");
      setOptForm({ name: "", price: "0", extra_minutes: "0" });
      await refreshOptions();
      showToast("Доп. услуга добавлена");
    } catch (err) {
      showToast(err.message || "Ошибка", { tone: "error" });
    } finally {
      setOptBusy(false);
    }
  }

  async function toggleOption(opt) {
    setOptBusy(true);
    try {
      const res = await authFetch(`${API_URL}/catalog/services/${service.id}/options/${opt.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !opt.is_active }),
      });
      if (!res.ok) throw new Error("Не удалось обновить");
      await refreshOptions();
    } catch (err) {
      showToast(err.message || "Ошибка", { tone: "error" });
    } finally {
      setOptBusy(false);
    }
  }

  async function removeOption(opt) {
    if (!window.confirm(`Удалить «${opt.name}»?`)) return;
    setOptBusy(true);
    try {
      const res = await authFetch(`${API_URL}/catalog/services/${service.id}/options/${opt.id}/`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Не удалось удалить");
      await refreshOptions();
    } catch (err) {
      showToast(err.message || "Ошибка", { tone: "error" });
    } finally {
      setOptBusy(false);
    }
  }

  return (
    <div
      className={[
        "service-editor",
        "service-editor-row",
        "service-editor--with-photos",
        !local.is_active && "service-editor--inactive",
        dirty && "service-editor--dirty",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="service-editor-name">
        <strong>{service.name}</strong>
        {dirty ? <span className="service-editor-dirty-mark">●</span> : null}
        <label className="service-editor-camera-btn" title="Добавить фото">
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              void onUploadPhotos?.(service.id, e.target.files);
              e.target.value = "";
            }}
          />
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              fill="currentColor"
              d="M9 2 7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"
            />
            <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.35" />
          </svg>
          <span className="service-editor-camera-plus" aria-hidden="true">
            +
          </span>
        </label>
      </div>
      <label className="service-editor-field">
        <span className="small-label">Цена</span>
        <input
          type="number"
          min="0"
          step="1"
          value={local.price}
          onChange={(e) => onDraftChange(service.id, { price: e.target.value })}
          placeholder="Цена"
        />
      </label>
      <label className="service-editor-field">
        <span className="small-label">Длительность (минуты)</span>
        <input
          type="number"
          min="5"
          step="5"
          value={local.duration_minutes}
          onChange={(e) => onDraftChange(service.id, { duration_minutes: e.target.value })}
          placeholder="Мин"
        />
      </label>
      <label className="checkbox service-editor-active">
        <input
          type="checkbox"
          checked={local.is_active}
          onChange={(e) => onDraftChange(service.id, { is_active: e.target.checked })}
        />
        Оказываем
      </label>

      <div className="service-editor-options">
        <span className="small-label">Доп. услуги (с ценой)</span>
        {options.map((o) => (
          <div key={o.id} className="service-editor-option-row">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={o.is_active !== false}
                disabled={optBusy}
                onChange={() => void toggleOption(o)}
              />
              <span>
                {o.name}
                {Number(o.price) > 0 ? ` · ${Number(o.price).toLocaleString("ru-RU")} ₽` : ""}
                {Number(o.extra_minutes) > 0 ? ` · +${o.extra_minutes} мин` : ""}
              </span>
            </label>
            <button type="button" className="ghost-btn" disabled={optBusy} onClick={() => void removeOption(o)}>
              Удалить
            </button>
          </div>
        ))}
        <form className="service-editor-option-form" onSubmit={(e) => void addOption(e)}>
          <input
            placeholder="Название допа"
            value={optForm.name}
            onChange={(e) => setOptForm((f) => ({ ...f, name: e.target.value }))}
          />
          <input
            type="number"
            min="0"
            step="1"
            placeholder="Цена"
            value={optForm.price}
            onChange={(e) => setOptForm((f) => ({ ...f, price: e.target.value }))}
          />
          <input
            type="number"
            min="0"
            step="5"
            placeholder="Мин +"
            value={optForm.extra_minutes}
            onChange={(e) => setOptForm((f) => ({ ...f, extra_minutes: e.target.value }))}
          />
          <button type="submit" className="primary-btn" disabled={optBusy}>
            + Доп
          </button>
        </form>
        <p className="muted small">Клиент отметит галочкой при записи.</p>
      </div>

      <ServiceMaterialsBlock serviceId={service.id} authFetch={authFetch} />
      {(gallery.length > 0 || photos.length > 0) && (
        <div className="service-editor-photos">
          <ServicePhotoCarousel items={gallery.length ? gallery : photos} className="service-editor-carousel" />
          {photos.length > 0 && (
            <div className="service-editor-photo-list">
              {photos.map((ph) => (
                <button
                  key={ph.id}
                  type="button"
                  className="service-editor-photo-chip"
                  title="Удалить фото"
                  onClick={() => void onDeletePhoto?.(service.id, ph.id)}
                >
                  <img src={ph.thumb_url || ph.image} alt="" loading="lazy" decoding="async" />
                  <span aria-hidden="true">×</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
