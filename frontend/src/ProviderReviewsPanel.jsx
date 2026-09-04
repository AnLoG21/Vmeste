import { ReviewTextContent } from "./bookingDisplay.jsx";
import { reviewImageUrl } from "./chatHelpers.jsx";

function defaultReviewReplyForm(review) {
  return {
    text: review?.reply?.text || "",
    publishReply: true,
    viaChat: Boolean(review?.reply?.sent_via_chat),
  };
}

/** Single review row (provider list + map-org reviews). */
export function ReviewListItem({
  review: r,
  showClientName = true,
  reviewsForGallery = null,
  accessToken,
  me,
  reviewReplyOpenId,
  reviewReplyForms,
  reviewReplyFormError,
  setReviewReplyOpenId,
  setReviewReplyForms,
  setReviewReplyFormError,
  toggleReviewLike,
  submitReviewReply,
  openReviewPhotoLightbox,
}) {
  const galleryReviews = reviewsForGallery?.length ? reviewsForGallery : [r];
  return (
    <li className={["review-item", r.is_new && "review-item--new"].filter(Boolean).join(" ")}>
      <div className="review-item-head">
        {showClientName ? <strong>{r.client_name || "Клиент"}</strong> : null}
        {r.is_new ? <span className="review-new-pill">Новый</span> : null}
        <span className="review-stars" aria-label={`Оценка ${r.rating}`}>
          {"★".repeat(r.rating)}
          <span className="review-stars-empty">{"☆".repeat(Math.max(0, 5 - r.rating))}</span>
        </span>
        {r.staff_rating ? (
          <span className="review-stars review-stars--staff" aria-label={`Оценка мастера ${r.staff_rating}`}>
            мастер {"★".repeat(r.staff_rating)}
            <span className="review-stars-empty">{"☆".repeat(Math.max(0, 5 - r.staff_rating))}</span>
          </span>
        ) : null}
      </div>
      {r.staff_name ? <p className="muted small">Мастер: {r.staff_name}</p> : null}
      <ReviewTextContent review={r} />
      {r.staff_text ? (
        <p className="review-item-text review-item-text--staff">
          <span className="muted small">Отзыв о сотруднике: </span>
          {r.staff_text}
        </p>
      ) : null}
      {r.photos?.length > 0 && (
        <div className="review-photos">
          {r.photos.map((p, photoIdx) => (
            <button
              key={p.id}
              type="button"
              className="review-photo-btn"
              onClick={() => openReviewPhotoLightbox(r, photoIdx, galleryReviews)}
            >
              <img src={reviewImageUrl(p, "thumb")} alt="" loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
      )}
      {r.reply?.text && reviewReplyOpenId !== r.id ? (
        <p className="review-reply">
          <strong>Ответ организации:</strong> {r.reply.text}
          {r.reply.sent_via_chat ? <span className="muted small"> (также в чате)</span> : null}
        </p>
      ) : null}
      <div className="review-item-actions">
        {accessToken && (
          <button
            type="button"
            className={["review-like-btn", r.liked_by_me && "review-like-btn--active"].filter(Boolean).join(" ")}
            onClick={() => toggleReviewLike(r.id, r.liked_by_me)}
            aria-pressed={Boolean(r.liked_by_me)}
          >
            <span className="review-like-icon" aria-hidden>
              {r.liked_by_me ? "♥" : "♡"}
            </span>
            <span>{Number(r.likes_count) || 0}</span>
          </button>
        )}
        {(me?.role === "provider" || me?.role === "staff") &&
          (reviewReplyOpenId === r.id ? (
            <div className="review-reply-editor">
              <textarea
                placeholder="Текст ответа"
                value={reviewReplyForms[r.id]?.text ?? r.reply?.text ?? ""}
                onChange={(e) =>
                  setReviewReplyForms((p) => ({
                    ...p,
                    [r.id]: { ...defaultReviewReplyForm(r), ...p[r.id], text: e.target.value },
                  }))
                }
                rows={3}
              />
              <div className="review-reply-options">
                <label className="checkbox review-reply-option">
                  <input
                    type="checkbox"
                    checked={reviewReplyForms[r.id]?.publishReply ?? true}
                    onChange={(e) =>
                      setReviewReplyForms((p) => ({
                        ...p,
                        [r.id]: { ...defaultReviewReplyForm(r), ...p[r.id], publishReply: e.target.checked },
                      }))
                    }
                  />
                  Ответ на отзыв (виден всем)
                </label>
                <label className="checkbox review-reply-option">
                  <input
                    type="checkbox"
                    checked={reviewReplyForms[r.id]?.viaChat ?? false}
                    onChange={(e) =>
                      setReviewReplyForms((p) => ({
                        ...p,
                        [r.id]: { ...defaultReviewReplyForm(r), ...p[r.id], viaChat: e.target.checked },
                      }))
                    }
                  />
                  Отправить клиенту в чат
                </label>
              </div>
              {reviewReplyFormError ? <p className="status error">{reviewReplyFormError}</p> : null}
              <div className="review-reply-editor-actions">
                <button
                  type="button"
                  className="ghost-btn small"
                  onClick={() => {
                    setReviewReplyOpenId(null);
                    setReviewReplyFormError("");
                  }}
                >
                  Отмена
                </button>
                <button type="button" className="small" onClick={() => submitReviewReply(r.id)}>
                  Отправить
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="ghost-btn small review-reply-open-btn"
              onClick={() => {
                setReviewReplyOpenId(r.id);
                setReviewReplyFormError("");
                setReviewReplyForms((p) => ({ ...p, [r.id]: defaultReviewReplyForm(r) }));
              }}
            >
              {r.reply?.text ? "Изменить ответ" : "Ответить"}
            </button>
          ))}
      </div>
    </li>
  );
}

/** Кабинет организации: список отзывов. */
export default function ProviderReviewsPanel({
  providerReviews,
  providerReviewsOrdering,
  setProviderReviewsOrdering,
  loadProviderReviewsList,
  accessToken,
  me,
  reviewReplyOpenId,
  reviewReplyForms,
  reviewReplyFormError,
  setReviewReplyOpenId,
  setReviewReplyForms,
  setReviewReplyFormError,
  toggleReviewLike,
  submitReviewReply,
  openReviewPhotoLightbox,
}) {
  const reviewItemProps = {
    accessToken,
    me,
    reviewReplyOpenId,
    reviewReplyForms,
    reviewReplyFormError,
    setReviewReplyOpenId,
    setReviewReplyForms,
    setReviewReplyFormError,
    toggleReviewLike,
    submitReviewReply,
    openReviewPhotoLightbox,
  };
  return (
    <section className="card full-width reviews-page">
      <h2>Отзывы</h2>
      <label className="field-label" htmlFor="provider-reviews-order">
        Сортировка
      </label>
      <select
        id="provider-reviews-order"
        value={providerReviewsOrdering}
        onChange={(e) => {
          setProviderReviewsOrdering(e.target.value);
          loadProviderReviewsList(e.target.value);
        }}
      >
        <option value="-created_at">Сначала новые</option>
        <option value="-rating">Сначала положительные</option>
        <option value="rating">Сначала негативные</option>
      </select>
      {providerReviews.length === 0 ? (
        <p className="muted">Пока нет отзывов.</p>
      ) : (
        <ul className="list review-list">
          {providerReviews.map((r) => (
            <ReviewListItem
              key={r.id}
              review={r}
              reviewsForGallery={providerReviews}
              {...reviewItemProps}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
