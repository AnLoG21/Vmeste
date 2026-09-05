import ClientInspectionsPanel from "./ClientInspectionsPanel.jsx";
import {
  bookingSlotStatusModifier,
  bookingStatusLabel,
  formatBookingPrice,
  reviewIsSupplemented,
  ReviewTextContent,
  formatBookingDateTimeParts,
} from "./bookingDisplay.jsx";
import { reviewImageUrl } from "./chatHelpers.jsx";
import { bookingPayStillOpen } from "./bookingCalendarUtils.jsx";
import { repairStatusButtonSuffix, repairStatusClientHistoryCta } from "./inspectionRepair.js";

function BookingHistoryReview({
  booking,
  me,
  getBookingReview,
  openClientReviewModal,
}) {
  const review = getBookingReview(booking);
  if (!review) {
    if (me?.role === "client" && booking.status === "done") {
      return (
        <div className="booking-history-review">
          <button
            type="button"
            className="ghost-btn small"
            onClick={() => openClientReviewModal(booking)}
          >
            Оставить отзыв
          </button>
        </div>
      );
    }
    return null;
  }
  const photos = review.photos || [];
  return (
    <div className="booking-history-review">
      <div className="booking-history-review-head">
        <span className="review-stars" aria-label={`Оценка ${review.rating}`}>
          {"★".repeat(review.rating)}
          <span className="review-stars-empty">{"☆".repeat(5 - review.rating)}</span>
        </span>
        {me?.role === "client" && booking.status === "done" && !reviewIsSupplemented(review) && (
          <button
            type="button"
            className="ghost-btn small booking-history-review-supplement"
            onClick={() => openClientReviewModal(booking, review)}
          >
            Дополнить отзыв
          </button>
        )}
      </div>
      <ReviewTextContent
        review={review}
        mainClassName="booking-history-review-text"
        supplementClassName="booking-history-review-text review-text-supplement"
      />
      {photos.length > 0 && (
        <div className="booking-history-review-photos">
          {photos.map((ph) => (
            <a key={ph.id} href={reviewImageUrl(ph, "full")} target="_blank" rel="noreferrer">
              <img src={reviewImageUrl(ph, "thumb")} alt="" loading="lazy" decoding="async" />
            </a>
          ))}
        </div>
      )}
      {review.reply?.text ? (
        <p className="booking-history-review-reply muted small">
          <strong>Ответ организации:</strong> {review.reply.text}
        </p>
      ) : null}
    </div>
  );
}

/** История записей (и вкладка диагностик для клиента). */
export default function BookingHistory({
  me,
  bookings,
  historyTab,
  setHistoryTab,
  authFetch,
  API_URL,
  pendingInspectionId,
  setPendingInspectionId,
  openOrgPhotoLightbox,
  bookingClientLabel,
  openOrgCardFromHistory,
  openChatWithClient,
  resumeBookingPayment,
  canManageBookings,
  openInspectionFromBooking,
  startInspectionFromBooking,
  setCurrentView,
  getBookingReview,
  openClientReviewModal,
}) {
  const isClient = me?.role === "client";
  const showDiagnosticsTab = isClient;
  const sorted = [...bookings].sort(
    (a, b) => new Date(b.slot_starts_at || 0) - new Date(a.slot_starts_at || 0),
  );
  return (
    <section className="card full-width booking-history-card">
      <h2>История записей</h2>
      {showDiagnosticsTab ? (
        <div className="history-switch" role="tablist" aria-label="Раздел истории">
          <button
            type="button"
            role="tab"
            className={["history-switch-btn", historyTab === "bookings" && "is-active"].filter(Boolean).join(" ")}
            aria-selected={historyTab === "bookings"}
            onClick={() => setHistoryTab("bookings")}
          >
            Записи
          </button>
          <button
            type="button"
            role="tab"
            className={["history-switch-btn", historyTab === "inspections" && "is-active"].filter(Boolean).join(" ")}
            aria-selected={historyTab === "inspections"}
            onClick={() => setHistoryTab("inspections")}
          >
            Диагностики
          </button>
        </div>
      ) : null}
      {showDiagnosticsTab && historyTab === "inspections" ? (
        <ClientInspectionsPanel
          embedded
          authFetch={authFetch}
          API_URL={API_URL}
          initialReportId={pendingInspectionId}
          onConsumedInitialReportId={() => setPendingInspectionId(null)}
          onOpenPhotos={openOrgPhotoLightbox}
        />
      ) : sorted.length === 0 ? (
        <p className="muted">Записей пока нет.</p>
      ) : (
        <ul className="booking-history-list">
          {sorted.map((b) => {
            const isManualHold = Boolean(b?.is_manual_hold || b?.status === "manual_hold");
            const staffName = (b.staff_display_name || "").trim();
            const staffJob = (b.staff_job_title || "").trim();
            const staffLine = [staffName, staffJob].filter(Boolean).join(" · ");
            const counterpartyLabel = isClient
              ? (b.organization_name || "Организация")
              : bookingClientLabel(b);
            const when = formatBookingDateTimeParts(b.slot_starts_at);
            const orgAvatar = (b.organization_avatar || "").trim();
            return (
              <li key={b.id} className={["booking-history-item", bookingSlotStatusModifier(b)].filter(Boolean).join(" ")}>
                <div className="booking-history-top">
                  <div className="booking-history-main">
                    <p className="booking-history-datetime">
                      <span className="booking-history-date">{when.date}</span>
                      {when.time ? <span className="booking-history-time">{when.time}</span> : null}
                    </p>
                    <p className="booking-history-service muted small">
                      {(b.service_name || "Услуга").trim()}
                      {staffLine ? ` · ${staffLine}` : ""}
                    </p>
                    <p className="booking-history-price">{formatBookingPrice(b.service_price)}</p>
                    <p className="booking-history-counterparty">
                      {isClient ? (
                        <>
                          <button
                            type="button"
                            className="booking-history-org"
                            onClick={() => openOrgCardFromHistory(b)}
                          >
                            {orgAvatar ? (
                              <img src={orgAvatar} alt="" className="booking-history-org-avatar" />
                            ) : (
                              <span className="booking-history-org-avatar booking-history-org-avatar--fallback" aria-hidden>
                                {(counterpartyLabel || "О").slice(0, 1).toUpperCase()}
                              </span>
                            )}
                            <span>{counterpartyLabel}</span>
                          </button>
                          {(b.status === "done" || b.status === "cancelled" || b.status === "no_show") && (
                            <button
                              type="button"
                              className="ghost-btn small booking-history-rebook"
                              onClick={() => openOrgCardFromHistory(b)}
                            >
                              Повторить
                            </button>
                          )}
                        </>
                      ) : (
                        isManualHold || !b.client ? (
                          <span className="booking-history-link" role="note">
                            {counterpartyLabel}
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="booking-history-link"
                            onClick={() => openChatWithClient(b.client)}
                          >
                            {counterpartyLabel}
                          </button>
                        )
                      )}
                    </p>
                  </div>
                  <span
                    className={[
                      "booking-history-status",
                      b.status === "cancelled" && "booking-history-status--cancelled",
                      b.status === "done" && "booking-history-status--done",
                      b.status === "confirmed" && "booking-history-status--confirmed",
                      b.status === "manual_hold" && "booking-history-status--manual-hold",
                      b.payment_status === "pending" && "booking-history-status--pending",
                      b.payment_status === "paid" && b.status === "new" && "booking-history-status--paid",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {bookingStatusLabel(b)}
                  </span>
                </div>
                {isClient && bookingPayStillOpen(b) ? (
                  <button type="button" className="ghost-btn small booking-history-pay" onClick={(e) => resumeBookingPayment(b.id, e)}>
                    Оплатить {b.prepay_amount ? formatBookingPrice(b.prepay_amount) : ""}
                  </button>
                ) : null}
                {!isClient && me?.provider_sphere === "service_center" && canManageBookings() && b.client && !isManualHold ? (
                  b.inspection?.id ? (
                    <button
                      type="button"
                      className="ghost-btn small"
                      onClick={() => openInspectionFromBooking(b)}
                    >
                      Открыть приёмку
                      {b.inspection.repair_status && b.inspection.repair_status !== "none"
                        ? repairStatusButtonSuffix(b.inspection.repair_status)
                        : ""}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="ghost-btn small"
                      onClick={() => startInspectionFromBooking(b)}
                    >
                      Приёмка по записи
                    </button>
                  )
                ) : null}
                {isClient && b.inspection?.id ? (
                  <button
                    type="button"
                    className="ghost-btn small"
                    onClick={() => {
                      setPendingInspectionId(Number(b.inspection.id));
                      setCurrentView("inspections");
                    }}
                  >
                    {repairStatusClientHistoryCta(b.inspection)}
                  </button>
                ) : null}
                <BookingHistoryReview
                  booking={b}
                  me={me}
                  getBookingReview={getBookingReview}
                  openClientReviewModal={openClientReviewModal}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
