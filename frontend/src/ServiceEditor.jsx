import { useState } from "react";
import { API_URL } from "./config.js";
import ServicePhotoCarousel from "./ServicePhotoCarousel.jsx";
import ServiceMaterialsBlock from "./ServiceMaterialsBlock.jsx";
import { showToast } from "./toast.js";
import { confirmDialog } from "./confirmDialog.js";

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

function CameraUploadBtn({ onFiles, title = "Добавить фото" }) {
  return (
    <label className="service-editor-camera-btn" title={title}>
      <input
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          void onFiles?.(e.target.files);
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
  );
}

function DeleteIconBtn({ onClick, disabled, label = "Удалить" }) {
  return (
    <button
      type="button"
      className="service-editor-icon-delete"
      disabled={disabled}
      title={label}
      aria-label={label}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path
          fill="currentColor"
          d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
        />
      </svg>
    </button>
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
  const [optDrafts, setOptDrafts] = useState({});

  function optLocal(opt) {
    const d = optDrafts[opt.id];
    if (d) return d;
    return {
      name: opt.name || "",
      price: String(opt.price ?? 0),
      extra_minutes: String(opt.extra_minutes ?? 0),
    };
  }

  function setOptDraft(optId, patch) {
    setOptDrafts((prev) => {
      const base =
        prev[optId] ||
        (() => {
          const o = options.find((x) => Number(x.id) === Number(optId));
          return {
            name: o?.name || "",
            price: String(o?.price ?? 0),
            extra_minutes: String(o?.extra_minutes ?? 0),
          };
        })();
      return { ...prev, [optId]: { ...base, ...patch } };
    });
  }

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

  async function patchOption(opt, patch) {
    setOptBusy(true);
    try {
      const res = await authFetch(`${API_URL}/catalog/services/${service.id}/options/${opt.id}/`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Не удалось обновить");
      const data = await res.json().catch(() => null);
      if (data?.id) {
        onOptionsChange?.(
          service.id,
          options.map((o) => (Number(o.id) === Number(opt.id) ? { ...o, ...data } : o))
        );
        setOptDrafts((prev) => {
          const next = { ...prev };
          delete next[opt.id];
          return next;
        });
      } else {
        await refreshOptions();
      }
    } catch (err) {
      showToast(err.message || "Ошибка", { tone: "error" });
    } finally {
      setOptBusy(false);
    }
  }

  async function saveOptionFields(opt) {
    const d = optLocal(opt);
    const name = (d.name || "").trim();
    if (!name) {
      showToast("Название не может быть пустым");
      return;
    }
    const next = {
      name,
      price: d.price || 0,
      extra_minutes: Number(d.extra_minutes) || 0,
    };
    if (
      next.name === (opt.name || "") &&
      Number(next.price) === Number(opt.price) &&
      Number(next.extra_minutes) === Number(opt.extra_minutes)
    ) {
      return;
    }
    await patchOption(opt, next);
  }

  async function toggleOption(opt) {
    await patchOption(opt, { is_active: !(opt.is_active !== false) });
  }

  async function removeOption(opt) {
    if (
      !(await confirmDialog({
        title: "Удалить опцию?",
        message: `Удалить «${opt.name}»?`,
        confirmLabel: "Удалить",
      }))
    ) {
      return;
    }
    setOptBusy(true);
    try {
      const res = await authFetch(`${API_URL}/catalog/services/${service.id}/options/${opt.id}/`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Не удалось удалить");
      setOptDrafts((prev) => {
        const next = { ...prev };
        delete next[opt.id];
        return next;
      });
      await refreshOptions();
    } catch (err) {
      showToast(err.message || "Ошибка", { tone: "error" });
    } finally {
      setOptBusy(false);
    }
  }

  async function uploadOptionPhotos(opt, fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setOptBusy(true);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("photos", f));
      const res = await authFetch(`${API_URL}/catalog/services/${service.id}/options/${opt.id}/photos/`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Не удалось загрузить фото");
      onOptionsChange?.(
        service.id,
        options.map((o) => (Number(o.id) === Number(opt.id) ? { ...o, ...data } : o))
      );
    } catch (err) {
      showToast(err.message || "Ошибка", { tone: "error" });
    } finally {
      setOptBusy(false);
    }
  }

  async function deleteOptionPhoto(opt, photoId) {
    setOptBusy(true);
    try {
      const res = await authFetch(
        `${API_URL}/catalog/services/${service.id}/options/${opt.id}/photos/${photoId}/`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Не удалось удалить фото");
      onOptionsChange?.(
        service.id,
        options.map((o) =>
          Number(o.id) === Number(opt.id)
            ? { ...o, photos: (o.photos || []).filter((p) => Number(p.id) !== Number(photoId)) }
            : o
        )
      );
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
        <CameraUploadBtn onFiles={(files) => onUploadPhotos?.(service.id, files)} />
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
        {options.map((o) => {
          const d = optLocal(o);
          const optPhotos = o.photos || [];
          return (
            <div
              key={o.id}
              className={["service-editor-option-block", o.is_active === false && "is-inactive"]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="service-editor-option-row service-editor-option-row--edit">
                <label className="checkbox service-editor-option-check" title="Показывать клиенту">
                  <input
                    type="checkbox"
                    checked={o.is_active !== false}
                    disabled={optBusy}
                    onChange={() => void toggleOption(o)}
                  />
                </label>
                <div className="service-editor-name service-editor-option-name">
                  <input
                    className="service-editor-option-name-input"
                    value={d.name}
                    disabled={optBusy}
                    onChange={(e) => setOptDraft(o.id, { name: e.target.value })}
                    onBlur={() => void saveOptionFields(o)}
                    placeholder="Название"
                  />
                  <CameraUploadBtn
                    onFiles={(files) => void uploadOptionPhotos(o, files)}
                    title="Фото доп. услуги"
                  />
                </div>
                <label className="service-editor-field">
                  <span className="small-label">Цена</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={d.price}
                    disabled={optBusy}
                    onChange={(e) => setOptDraft(o.id, { price: e.target.value })}
                    onBlur={() => void saveOptionFields(o)}
                    placeholder="Цена"
                  />
                </label>
                <label className="service-editor-field">
                  <span className="small-label">+ мин</span>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={d.extra_minutes}
                    disabled={optBusy}
                    onChange={(e) => setOptDraft(o.id, { extra_minutes: e.target.value })}
                    onBlur={() => void saveOptionFields(o)}
                    placeholder="Мин"
                  />
                </label>
                <DeleteIconBtn disabled={optBusy} onClick={() => void removeOption(o)} />
              </div>
              {optPhotos.length > 0 ? (
                <div className="service-editor-photo-list service-editor-option-photos">
                  {optPhotos.map((ph) => (
                    <button
                      key={ph.id}
                      type="button"
                      className="service-editor-photo-chip"
                      title="Удалить фото"
                      disabled={optBusy}
                      onClick={() => void deleteOptionPhoto(o, ph.id)}
                    >
                      <img src={ph.thumb_url || ph.image} alt="" loading="lazy" decoding="async" />
                      <span aria-hidden="true">×</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
        <form className="service-editor-option-row service-editor-option-row--edit service-editor-option-form" onSubmit={(e) => void addOption(e)}>
          <span className="service-editor-option-check-spacer" aria-hidden="true" />
          <div className="service-editor-name service-editor-option-name">
            <input
              className="service-editor-option-name-input"
              placeholder="Название допа"
              value={optForm.name}
              onChange={(e) => setOptForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <label className="service-editor-field">
            <span className="small-label">Цена</span>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="0"
              value={optForm.price}
              onChange={(e) => setOptForm((f) => ({ ...f, price: e.target.value }))}
            />
          </label>
          <label className="service-editor-field">
            <span className="small-label">+ мин</span>
            <input
              type="number"
              min="0"
              step="5"
              placeholder="0"
              value={optForm.extra_minutes}
              onChange={(e) => setOptForm((f) => ({ ...f, extra_minutes: e.target.value }))}
            />
          </label>
          <button type="submit" className="service-editor-icon-add" disabled={optBusy} title="Добавить" aria-label="Добавить">
            +
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
