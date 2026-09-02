import ServicePhotoCarousel from "./ServicePhotoCarousel.jsx";

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

export default function ServiceEditor({ service, draft, dirty, onDraftChange, onUploadPhotos, onDeletePhoto }) {
  const local = draft ?? buildServiceDraftFromService(service);
  const photos = service.photos || [];
  const gallery = service.gallery || [];

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
      {(service.options || []).length > 0 ? (
        <div className="service-editor-options">
          <span className="small-label">Дополнительно к услуге</span>
          {(service.options || []).map((o) => (
            <div key={o.id} className="service-editor-option-row">
              <span>
                + {o.name}
                {Number(o.price) > 0 ? ` · ${Number(o.price).toLocaleString("ru-RU")} ₽` : ""}
                {Number(o.extra_minutes) > 0 ? ` · +${o.extra_minutes} мин` : ""}
                {!o.is_active ? " (выкл.)" : ""}
              </span>
            </div>
          ))}
          <p className="muted small">Допы появляются после «Загрузить каталог». Гость отмечает их плюсиком при записи.</p>
        </div>
      ) : null}
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
