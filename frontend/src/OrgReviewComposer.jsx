/**
 * Единый паттерн отзыва: звёзды + текст + опционально мастер и фото.
 */
export function Stars({ value, onChange, readOnly = false }) {
  return (
    <span className="cafe-stars" aria-label={value ? `Оценка ${value}` : "Без оценки"}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={n <= value ? "cafe-star is-on" : "cafe-star"}
          disabled={readOnly}
          onClick={() => !readOnly && onChange?.(n)}
          aria-label={`${n}`}
        >
          ★
        </button>
      ))}
    </span>
  );
}

export default function OrgReviewComposer({
  rating,
  text,
  onRatingChange,
  onTextChange,
  staffRating,
  onStaffRatingChange,
  staffText,
  onStaffTextChange,
  showStaff = false,
  photos,
  onPhotosChange,
  photoInputId,
  busy = false,
  onSubmit,
  submitLabel = "Отправить отзыв",
  orgLabel = "Оценка организации",
  placeholder = "Как всё прошло?",
  staffPlaceholder = "Отзыв о сотруднике (необязательно)",
  hideSubmit = false,
}) {
  return (
    <div className="org-review-composer form">
      <label className="muted small-label">{orgLabel}</label>
      <Stars value={rating} onChange={onRatingChange} readOnly={busy} />
      {showStaff ? (
        <>
          <label className="muted small-label">Оценка сотрудника</label>
          <Stars value={staffRating} onChange={onStaffRatingChange} readOnly={busy} />
        </>
      ) : null}
      <textarea
        rows={3}
        placeholder={placeholder}
        value={text}
        disabled={busy}
        onChange={(e) => onTextChange?.(e.target.value)}
      />
      {showStaff && typeof onStaffTextChange === "function" ? (
        <textarea
          rows={3}
          placeholder={staffPlaceholder}
          value={staffText}
          disabled={busy}
          onChange={(e) => onStaffTextChange?.(e.target.value)}
        />
      ) : null}
      {typeof onPhotosChange === "function" && (
        <input
          id={photoInputId}
          type="file"
          accept="image/*"
          multiple
          disabled={busy}
          onChange={(e) => onPhotosChange?.(Array.from(e.target.files || []))}
        />
      )}
      {Array.isArray(photos) && photos.length > 0 && (
        <p className="muted small">{photos.length} фото выбрано</p>
      )}
      {onSubmit && !hideSubmit && (
        <button type="button" disabled={busy || !rating} onClick={onSubmit}>
          {busy ? "Отправка…" : submitLabel}
        </button>
      )}
    </div>
  );
}
