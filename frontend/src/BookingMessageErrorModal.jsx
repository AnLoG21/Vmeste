/** Booking message / prepay / timing error dialog. App wraps with createPortal(..., document.body). */
export default function BookingMessageErrorModal({
  bookingMessageError,
  setBookingMessageError,
  goOrgSettingsForBookingMessage,
}) {
  return (
    <div
      className="modal-backdrop modal-backdrop--app-overlay"
      role="alertdialog"
      onClick={() => setBookingMessageError(null)}
    >
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>
          {bookingMessageError.code === "booking_not_started_yet"
            ? "Рано отмечать готовым"
            : bookingMessageError.code === "prepay_required"
              ? "Нужна предоплата"
              : "Сообщение не задано"}
        </h3>
        <p className="muted">
          {bookingMessageError.code === "booking_not_started_yet"
            ? bookingMessageError.detail
              || "Отметить «услуга оказана» можно только после начала записи по времени."
            : bookingMessageError.code === "prepay_required"
              ? bookingMessageError.detail || "Клиент ещё не внёс предоплату — подтвердить запись нельзя."
            : bookingMessageError.code === "confirm_message_not_set"
              ? "Сообщение для подтверждения записи не задано. Задайте его в настройках организации."
              : bookingMessageError.code === "done_message_not_set"
                ? "Сообщение при отметке «услуга оказана» не задано. Задайте его в настройках организации."
                : "Сообщение об отмене записи не задано. Задайте его в настройках организации."}
        </p>
        <div className="row-2">
          {bookingMessageError.code !== "booking_not_started_yet" && bookingMessageError.code !== "prepay_required" ? (
            <button type="button" onClick={() => goOrgSettingsForBookingMessage(bookingMessageError.code)}>
              Перейти в настройки
            </button>
          ) : null}
          <button type="button" className="ghost-btn" onClick={() => setBookingMessageError(null)}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
