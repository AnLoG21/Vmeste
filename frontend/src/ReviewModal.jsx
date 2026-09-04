import OrgReviewComposer from "./OrgReviewComposer.jsx";

/** Client review create / supplement modal. App wraps with createPortal(..., document.body). */
export default function ReviewModal({
  reviewModalBooking,
  setReviewModalBooking,
  reviewModalReview,
  setReviewModalReview,
  reviewForm,
  setReviewForm,
  reviewSubmitError,
  submitClientReview,
}) {
  return (
    <div
      className="modal-backdrop modal-backdrop--app-overlay"
      onClick={() => {
        setReviewModalBooking(null);
        setReviewModalReview(null);
      }}
    >
      <div
        className="modal-card review-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="review-modal-title"
      >
        <div className="review-modal-head">
          <h3 id="review-modal-title">{reviewModalReview?.id ? "Дополнить отзыв" : "Отзыв"}</h3>
          <button
            type="button"
            className="review-modal-close"
            aria-label="Закрыть"
            onClick={() => {
              setReviewModalBooking(null);
              setReviewModalReview(null);
            }}
          >
            ×
          </button>
        </div>
        <form onSubmit={submitClientReview} className="form review-modal-form">
          <div className="review-modal-body">
            {reviewModalReview?.id ? (
              <p className="muted small review-modal-existing">
                Текущая оценка: {"★".repeat(reviewModalReview.rating)}
                {reviewModalReview.staff_rating
                  ? ` · мастер ${"★".repeat(reviewModalReview.staff_rating)}`
                  : ""}
                {reviewModalReview.text ? (
                  <>
                    <br />
                    {reviewModalReview.text}
                  </>
                ) : null}
              </p>
            ) : (
              <OrgReviewComposer
                orgLabel="Оценка услуги"
                rating={reviewForm.rating}
                onRatingChange={(rating) => setReviewForm((p) => ({ ...p, rating }))}
                text={reviewForm.text}
                onTextChange={(text) => setReviewForm((p) => ({ ...p, text }))}
                showStaff={Boolean(reviewModalBooking.staff_user_id)}
                staffRating={reviewForm.staff_rating}
                onStaffRatingChange={(staff_rating) => setReviewForm((p) => ({ ...p, staff_rating }))}
                staffText={reviewForm.staff_text}
                onStaffTextChange={(staff_text) => setReviewForm((p) => ({ ...p, staff_text }))}
                hideSubmit
                photoInputId="review-photos-input"
                onPhotosChange={() => {}}
                placeholder="Комментарий об услуге (необязательно)"
              />
            )}
            {reviewModalReview?.id ? (
              <>
                <textarea
                  placeholder="Дополнительный текст к отзыву"
                  value={reviewForm.text}
                  onChange={(e) => setReviewForm((p) => ({ ...p, text: e.target.value }))}
                  rows={3}
                />
                <label className="field-label" htmlFor="review-photos-input">
                  Добавить фото
                </label>
                <input id="review-photos-input" type="file" accept="image/*" multiple />
              </>
            ) : null}
            {reviewSubmitError ? <p className="status error">{reviewSubmitError}</p> : null}
          </div>
          <div className="review-modal-actions">
            <button type="submit" className="review-modal-submit">
              {reviewModalReview?.id ? "Сохранить дополнение" : "Отправить отзыв"}
            </button>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => {
                setReviewModalBooking(null);
                setReviewModalReview(null);
              }}
            >
              {reviewModalReview?.id ? "Отмена" : "Пропустить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
