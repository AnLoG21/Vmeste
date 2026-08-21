/**
 * Единый паттерн отзыва: звёзды + текст + опционально фото.
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
  photos,
  onPhotosChange,
  busy = false,
  onSubmit,
  submitLabel = "Отправить отзыв",
  placeholder = "Как всё прошло?",
}) {
  return (
    <div className="org-review-composer form">
      <label className="muted small-label">Оценка организации</label>
      <Stars value={rating} onChange={onRatingChange} readOnly={busy} />
      <textarea
        rows={3}
        placeholder={placeholder}
        value={text}
        disabled={busy}
        onChange={(e) => onTextChange?.(e.target.value)}
      />
      {typeof onPhotosChange === "function" && (
        <input
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
      {onSubmit && (
        <button type="button" disabled={busy || !rating} onClick={onSubmit}>
          {busy ? "Отправка…" : submitLabel}
        </button>
      )}
    </div>
  );
}
