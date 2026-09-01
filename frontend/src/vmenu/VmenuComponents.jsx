import { forwardRef, useRef, useState } from "react";

export function VmenuBackButton({ onClick, label = "Назад" }) {
  return (
    <button type="button" className="vmenu-back-btn" onClick={onClick} aria-label={label}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
      </svg>
    </button>
  );
}

export function VmenuCloseButton({ onClick }) {
  return (
    <button type="button" className="vmenu-close-btn" onClick={onClick} aria-label="Закрыть">
      ×
    </button>
  );
}

export function VmenuTrashButton({ onClick, label = "Удалить" }) {
  return (
    <button type="button" className="vmenu-trash-btn" onClick={onClick} aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          fill="currentColor"
          d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
        />
      </svg>
    </button>
  );
}

export function VmenuConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Удалить",
  cancelLabel = "Отменить",
  danger = true,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;
  return (
    <div className="modal-backdrop vmenu-confirm-backdrop" role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="modal-card vmenu-confirm-card" onClick={(e) => e.stopPropagation()}>
        {title ? <h3 className="vmenu-confirm-title">{title}</h3> : null}
        {message ? <p className="vmenu-confirm-message">{message}</p> : null}
        <div className="vmenu-confirm-actions">
          <button type="button" className="ghost-btn" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? "vmenu-confirm-danger-btn" : "primary-btn"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function VmenuRatingBadge({ rating, inline = false }) {
  if (!rating || Number(rating) <= 0) return null;
  return (
    <div className={`vmenu-rating-badge ${inline ? "vmenu-rating-badge--inline" : ""}`} aria-label={`Рейтинг ${rating}`}>
      <span className="vmenu-rating-badge-star">★</span>
      <span>{Number(rating).toFixed(1)}</span>
    </div>
  );
}

export function VmenuStatWidget({ icon, value, label, onClick, avatars = [] }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} className="vmenu-stat-widget" onClick={onClick}>
      <span className="vmenu-stat-widget-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="vmenu-stat-widget-body">
        <strong>{value}</strong>
        <span className="vmenu-stat-widget-label-row">
          <span>{label}</span>
          {avatars?.length ? (
            <span className="vmenu-stat-avatars">
              {avatars.slice(0, 3).map((u) => (
                <span key={u.id} className="vmenu-stat-avatar" title={u.display_name}>
                  {u.avatar_url ? <img src={u.avatar_url} alt="" /> : u.display_name?.[0] || "?"}
                </span>
              ))}
            </span>
          ) : null}
        </span>
      </span>
    </Tag>
  );
}

/** Plus-button file upload with thumbnails (like cafe photo add). */
export function VmenuMediaUpload({
  label,
  accept,
  multiple = false,
  max = 1,
  files = [],
  previews = [],
  remotePreviews = [],
  mediaType = "image",
  onChange,
  onRemove,
  onRemoveRemote,
  error,
}) {
  const inputRef = useRef(null);
  const [lightbox, setLightbox] = useState(null);

  const remoteCount = remotePreviews.length;
  const totalCount = remoteCount + files.length;

  function pick(e) {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    if (multiple && max && picked.length + totalCount > max) {
      onChange?.(files, `Можно загрузить не более ${max} файлов`);
      e.target.value = "";
      return;
    }
    if (!multiple && max === 1) {
      onChange?.(picked.slice(0, 1), "");
    } else {
      onChange?.([...files, ...picked].slice(0, max - remoteCount), "");
    }
    e.target.value = "";
  }

  const fileThumbs = files.map((f) => (f instanceof File ? URL.createObjectURL(f) : f));
  const addLabel = mediaType === "video" ? "Видео" : "Фото";

  return (
    <div className="vmenu-media-upload">
      {label ? <div className="vmenu-field-label">{label}</div> : null}
      <div className="vmenu-media-upload-row">
        {totalCount < max ? (
          <label className="vmenu-photo-add-btn" title={label || `Добавить ${addLabel.toLowerCase()}`}>
            <span className="vmenu-photo-add-plus">+</span>
            <span>{addLabel}</span>
            <input ref={inputRef} type="file" accept={accept} multiple={multiple} hidden onChange={pick} />
          </label>
        ) : null}
        {remotePreviews.map((item, i) => (
          <button
            key={`remote-${item.id}`}
            type="button"
            className="vmenu-photo-thumb"
            onClick={() => setLightbox(item.url)}
          >
            <img src={item.thumb_url || item.url} alt="" />
            {onRemoveRemote ? (
              <span
                className="vmenu-photo-thumb-remove"
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveRemote(item.id);
                }}
                onKeyDown={(e) => e.key === "Enter" && onRemoveRemote(item.id)}
                aria-label="Удалить"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                  <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                </svg>
              </span>
            ) : null}
          </button>
        ))}
        {fileThumbs.map((src, i) => (
          <button key={`file-${i}`} type="button" className="vmenu-photo-thumb" onClick={() => setLightbox(src)}>
            {mediaType === "video" ? (
              <span className="vmenu-photo-thumb-video" aria-hidden="true">
                ▶
              </span>
            ) : (
              <img src={src} alt="" />
            )}
            {onRemove ? (
              <span
                className="vmenu-photo-thumb-remove"
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(i);
                }}
                onKeyDown={(e) => e.key === "Enter" && onRemove(i)}
                aria-label="Удалить"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                  <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                </svg>
              </span>
            ) : null}
          </button>
        ))}
        {previews.map((src, i) =>
          remoteCount || files.length ? null : (
            <button key={`preview-${i}`} type="button" className="vmenu-photo-thumb" onClick={() => setLightbox(src)}>
              {mediaType === "video" ? (
                <video src={src} className="vmenu-photo-thumb-vid" muted playsInline />
              ) : (
                <img src={src} alt="" />
              )}
              {onRemove ? (
                <span
                  className="vmenu-photo-thumb-remove"
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(i);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && onRemove(i)}
                  aria-label="Удалить"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                    <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                  </svg>
                </span>
              ) : null}
            </button>
          ),
        )}
      </div>
      {error ? <p className="status error">{error}</p> : null}
      {lightbox && mediaType !== "video" ? (
        <div className="vmenu-lightbox" role="dialog" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" />
        </div>
      ) : null}
    </div>
  );
}

export function VmenuFieldBlock({ label, children, className = "" }) {
  return (
    <div className={`vmenu-field-block ${className}`.trim()}>
      {label ? <div className="vmenu-field-label">{label}</div> : null}
      {children}
    </div>
  );
}

export const VmenuTextArea = forwardRef(function VmenuTextArea({ value, onChange, rows = 4, placeholder }, ref) {
  return (
    <textarea
      ref={ref}
      className="vmenu-textarea"
      rows={rows}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
    />
  );
});

export function VmenuTextInput({ value, onChange, placeholder, type = "text" }) {
  return (
    <input
      className="vmenu-textinput"
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
    />
  );
}
