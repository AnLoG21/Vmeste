import { useRef } from "react";
import { ORG_GALLERY_MAX_PHOTOS, ORG_WEEKDAYS } from "./clientOrgFeatures.js";

/** Карточка организации для клиентов: график, контакты, фото, виджет записи. */
export default function OrgClientCardSection({
  form,
  onChange,
  onSubmit,
  saveStatus,
  galleryPhotos,
  onUploadGalleryPhotos,
  onDeleteGalleryPhoto,
  onOpenGalleryLightbox,
  organizationSlug,
  showBookingWidget,
}) {
  const galleryInputRef = useRef(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "https://vsevmeste.space";

  return (
    <>
      <h3>Карточка для клиентов</h3>
      <p className="muted small">
        Режим работы, телефоны, фото и дополнительная информация отображаются при выборе организации на карте.
      </p>

      {showBookingWidget && organizationSlug ? (
        <div className="org-widget-embed card-inset">
          <h3>Виджет записи на сайт</h3>
          <p className="muted small">
            Ссылка для клиентов и iframe для встраивания на сайт салона. Сценарий: мастер → услуга → слоты, запись по
            телефону.
          </p>
          <p>
            <a href={`/w/${organizationSlug}`} target="_blank" rel="noreferrer">
              {origin}/w/{organizationSlug}
            </a>
          </p>
          <p className="field-label">Код для сайта</p>
          <textarea
            readOnly
            rows={4}
            className="org-widget-code"
            value={`<iframe src="${origin}/w/${organizationSlug}" width="100%" height="720" style="border:0;border-radius:12px;max-width:480px" title="Онлайн-запись"></iframe>`}
            onFocus={(e) => e.target.select()}
          />
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="form org-profile-form">
        <p className="field-label">Режим работы</p>
        <div className="org-hours-grid">
          {ORG_WEEKDAYS.map(({ key, label }) => (
            <div key={key} className="org-hours-row">
              <label className="checkbox org-hours-closed">
                <input
                  type="checkbox"
                  checked={Boolean(form.working_hours[key]?.closed)}
                  onChange={(e) =>
                    onChange((p) => ({
                      ...p,
                      working_hours: {
                        ...p.working_hours,
                        [key]: { ...p.working_hours[key], closed: e.target.checked },
                      },
                    }))
                  }
                />
                {label} — выходной
              </label>
              <div className="org-hours-times">
                <input
                  type="time"
                  disabled={form.working_hours[key]?.closed}
                  value={form.working_hours[key]?.open || "09:00"}
                  onChange={(e) =>
                    onChange((p) => ({
                      ...p,
                      working_hours: {
                        ...p.working_hours,
                        [key]: { ...p.working_hours[key], open: e.target.value },
                      },
                    }))
                  }
                />
                <span>—</span>
                <input
                  type="time"
                  disabled={form.working_hours[key]?.closed}
                  value={form.working_hours[key]?.close || "18:00"}
                  onChange={(e) =>
                    onChange((p) => ({
                      ...p,
                      working_hours: {
                        ...p.working_hours,
                        [key]: { ...p.working_hours[key], close: e.target.value },
                      },
                    }))
                  }
                />
              </div>
            </div>
          ))}
        </div>

        <label className="field-label">Телефоны</label>
        {form.phones.map((ph, idx) => (
          <div key={idx} className="org-phone-row">
            <input
              type="tel"
              placeholder="+7 …"
              value={ph}
              onChange={(e) =>
                onChange((p) => {
                  const phones = [...p.phones];
                  phones[idx] = e.target.value;
                  return { ...p, phones };
                })
              }
            />
            <button
              type="button"
              className="org-icon-btn org-icon-btn--danger"
              aria-label="Удалить телефон"
              onClick={() => onChange((p) => ({ ...p, phones: p.phones.filter((_, i) => i !== idx) }))}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                />
              </svg>
            </button>
          </div>
        ))}
        <button type="button" className="org-text-btn" onClick={() => onChange((p) => ({ ...p, phones: [...p.phones, ""] }))}>
          + Телефон
        </button>

        <label className="field-label">Сайты</label>
        {form.websites.map((site, idx) => (
          <div key={idx} className="org-phone-row">
            <input
              type="url"
              placeholder="https://example.ru"
              value={site}
              onChange={(e) =>
                onChange((p) => {
                  const websites = [...p.websites];
                  websites[idx] = e.target.value;
                  return { ...p, websites };
                })
              }
            />
            <button
              type="button"
              className="org-icon-btn org-icon-btn--danger"
              aria-label="Удалить сайт"
              onClick={() => onChange((p) => ({ ...p, websites: p.websites.filter((_, i) => i !== idx) }))}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                />
              </svg>
            </button>
          </div>
        ))}
        <button
          type="button"
          className="org-text-btn"
          onClick={() => onChange((p) => ({ ...p, websites: [...p.websites, ""] }))}
        >
          + Сайт
        </button>

        <label className="field-label" htmlFor="org-card-note">
          Дополнительно (для клиентов)
        </label>
        <textarea
          id="org-card-note"
          rows={3}
          placeholder="Например: парковка во дворе, вход со двора"
          value={form.card_note}
          onChange={(e) => onChange((p) => ({ ...p, card_note: e.target.value }))}
        />

        <p className="field-label">
          Фото организации ({galleryPhotos.length}/{ORG_GALLERY_MAX_PHOTOS})
        </p>
        <p className="muted small">
          Не более {ORG_GALLERY_MAX_PHOTOS} фото. Сначала показываются они, затем фото из отзывов.
        </p>
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          disabled={galleryPhotos.length >= ORG_GALLERY_MAX_PHOTOS}
          onChange={async (e) => {
            const files = [...(e.target.files || [])];
            await onUploadGalleryPhotos(files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          className="org-gallery-upload-btn"
          disabled={galleryPhotos.length >= ORG_GALLERY_MAX_PHOTOS}
          onClick={() => galleryInputRef.current?.click()}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              fill="currentColor"
              d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"
            />
          </svg>
          Добавить фото
        </button>

        {galleryPhotos.length > 0 ? (
          <div className="org-gallery-grid">
            {galleryPhotos.map((ph, photoIdx) => (
              <div key={ph.id} className="org-gallery-item">
                <button
                  type="button"
                  className="org-gallery-open"
                  aria-label="Открыть фото"
                  onClick={() =>
                    onOpenGalleryLightbox(
                      galleryPhotos.map((p) => ({ id: p.id, url: p.url || p.thumb_url })),
                      photoIdx,
                    )
                  }
                >
                  <img src={ph.thumb_url || ph.url} alt="" loading="lazy" decoding="async" />
                </button>
                <button
                  type="button"
                  className="org-icon-btn org-icon-btn--danger org-gallery-delete"
                  aria-label="Удалить фото"
                  onClick={() => onDeleteGalleryPhoto(ph.id)}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <button type="submit">Сохранить карточку</button>
        <p className="status">{saveStatus}</p>
      </form>
    </>
  );
}
