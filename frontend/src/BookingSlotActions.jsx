import { bookingPayStillOpen } from "./bookingCalendarUtils.jsx";
import { repairStatusButtonSuffix, repairStatusClientCta } from "./inspectionRepair.js";

/** Action buttons for a booking slot (calendar / day detail). */
export default function BookingSlotActions({
  it,
  me,
  canManageBookings,
  releaseManualHold,
  orgBookingAction,
  openInspectionFromBooking,
  startInspectionFromBooking,
  setPendingInspectionId,
  setCurrentView,
  openChatWithClient,
  bookingHasStarted,
  resumeBookingPayment,
  openChatWithProvider,
  clientCancelBooking,
  bookingHasReview,
  openClientReviewModal,
}) {
  if (!it?.id) return null;
  if (it?.is_manual_hold || it?.status === "manual_hold") {
    if (!canManageBookings()) return null;
    return (
      <div className="booking-actions-bar" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="booking-action-btn booking-action-btn--cancel"
          title="Снять ручную бронь"
          onClick={(e) => {
            e.stopPropagation();
            void releaseManualHold(it.slot_id || it.id);
          }}
        >
          ✕
        </button>
      </div>
    );
  }
  const isOrg = canManageBookings();
  const isClient = me?.role === "client";
  const cancelled = it.status === "cancelled";
  const done = it.status === "done";
  return (
    <div className="booking-actions-bar" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      {isOrg && !cancelled && it.status === "new" && it.payment_status !== "pending" && (
        <button type="button" className="booking-action-btn booking-action-btn--confirm" title="Подтвердить" onClick={(e) => orgBookingAction(it.id, "confirm", e)}>
          ✓
        </button>
      )}
      {isOrg && !cancelled && (it.status === "confirmed" || it.status === "new") && it.payment_status !== "pending" && (
        <button
          type="button"
          className="booking-action-btn"
          title="Клиент пришёл"
          onClick={(e) => orgBookingAction(it.id, "mark-arrived", e)}
        >
          ↓
        </button>
      )}
      {isOrg && !cancelled && !done && it.status !== "no_show" && (it.status === "confirmed" || it.status === "new" || it.status === "arrived") && (
        <button
          type="button"
          className="booking-action-btn booking-action-btn--cancel"
          title="Не пришёл (no-show)"
          onClick={(e) => orgBookingAction(it.id, "mark-no-show", e)}
        >
          ∅
        </button>
      )}
      {isOrg && !cancelled && it.client && (me?.provider_sphere === "service_center" || me?.employer_sphere === "service_center" || me?.role === "staff") && (
        it.inspection?.id ? (
          <button
            type="button"
            className="ghost-btn small"
            title="Открыть приёмку по записи"
            onClick={(e) => {
              e.stopPropagation();
              openInspectionFromBooking(it);
            }}
          >
            Приёмка
            {it.inspection.repair_status && it.inspection.repair_status !== "none"
              ? repairStatusButtonSuffix(it.inspection.repair_status)
              : it.inspection.status === "approved"
                ? " · утв."
                : it.inspection.status === "sent"
                  ? " · ждёт"
                  : ""}
          </button>
        ) : (
          <button
            type="button"
            className="ghost-btn small"
            title="Создать отчёт приёмки"
            onClick={(e) => {
              e.stopPropagation();
              void startInspectionFromBooking(it);
            }}
          >
            Приёмка
          </button>
        )
      )}
      {isClient && !cancelled && it.inspection?.id && (
        <button
          type="button"
          className="ghost-btn small"
          title="Открыть диагностику / статус ремонта"
          onClick={(e) => {
            e.stopPropagation();
            setPendingInspectionId(Number(it.inspection.id));
            setCurrentView("inspections");
          }}
        >
          {repairStatusClientCta(it.inspection)}
        </button>
      )}
      {isOrg && !cancelled && (
        <button type="button" className="booking-action-btn booking-action-btn--chat" title="Чат с клиентом" onClick={(e) => { e.stopPropagation(); openChatWithClient(it.client); }}>
          💬
        </button>
      )}
      {isOrg && !cancelled && (
        <button type="button" className="booking-action-btn booking-action-btn--cancel" title="Отменить" onClick={(e) => orgBookingAction(it.id, "cancel-by-org", e)}>
          ✕
        </button>
      )}
      {isOrg && !cancelled && !done && (
        <button
          type="button"
          className="ghost-btn small booking-action-done"
          disabled={!bookingHasStarted(it)}
          title={
            bookingHasStarted(it)
              ? "Отметить, что услуга оказана"
              : "Можно отметить только после начала записи по времени"
          }
          onClick={(e) => orgBookingAction(it.id, "mark-done", e)}
        >
          Услуга оказана
        </button>
      )}
      {isClient && !cancelled && bookingPayStillOpen(it) && (
        <button
          type="button"
          className="ghost-btn small"
          title="Оплатить предоплату"
          onClick={(e) => resumeBookingPayment(it.id, e)}
        >
          Оплатить
        </button>
      )}
      {isClient && !cancelled && (
        <button type="button" className="booking-action-btn booking-action-btn--chat" title="Чат с организацией" onClick={(e) => { e.stopPropagation(); openChatWithProvider(it.provider); }}>
          💬
        </button>
      )}
      {isClient && !cancelled && (
        <button type="button" className="booking-action-btn booking-action-btn--cancel" title="Отменить запись" onClick={(e) => clientCancelBooking(it.id, e)}>
          ✕
        </button>
      )}
      {isClient && done && !bookingHasReview(it.id) && (
        <button
          type="button"
          className="ghost-btn small"
          onClick={(e) => {
            e.stopPropagation();
            openClientReviewModal(it);
          }}
        >
          Отзыв
        </button>
      )}
    </div>
  );
}
