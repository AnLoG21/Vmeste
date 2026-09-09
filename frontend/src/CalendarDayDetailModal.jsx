import { bookingStatusLabel } from "./bookingDisplay.jsx";

/** Calendar day detail sheet (bookings or free slots). App wraps with createPortal(..., document.body). */
export default function CalendarDayDetailModal({
  calendarDayDetail,
  setCalendarDayDetail,
  bookingSlotSecondaryLabel,
  renderBookingSlotActions,
  deleteSlot,
  releaseManualHold,
  onBookClient,
}) {
  const isBookings = calendarDayDetail.mode === "bookings";
  const dayIso = (() => {
    const ym = String(calendarDayDetail.month || "");
    const [y, m] = ym.split("-").map(Number);
    const day = Number(calendarDayDetail.day);
    if (!y || !m || !day) return "";
    return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  })();

  return (
    <div
      className="modal-backdrop modal-backdrop--app-overlay"
      onClick={() => setCalendarDayDetail(null)}
    >
      <div className="modal-card calendar-day-sheet" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="calendar-day-sheet-head">
          <h3>
            {(() => {
              const ym = String(calendarDayDetail.month || "");
              const [y, m] = ym.split("-").map(Number);
              if (y && m) {
                const d = new Date(y, m - 1, calendarDayDetail.day);
                return d.toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                });
              }
              return `${calendarDayDetail.day}`;
            })()}
          </h3>
          <button
            type="button"
            className="calendar-day-sheet-close"
            aria-label="Закрыть"
            onClick={(e) => {
              e.stopPropagation();
              setCalendarDayDetail(null);
            }}
          >
            ×
          </button>
        </div>

        {onBookClient && (isBookings || calendarDayDetail.mode === "intervals") ? (
          <button
            type="button"
            className="calendar-day-sheet-book-btn calendar-day-sheet-book-btn--day"
            onClick={(e) => {
              e.stopPropagation();
              if (isBookings) {
                onBookClient({ dayDate: dayIso });
              } else {
                const free = (calendarDayDetail.items || []).find((it) => !it.is_booked);
                if (free) onBookClient(free);
                else onBookClient({ dayDate: dayIso });
              }
            }}
          >
            Записать клиента
          </button>
        ) : null}

        {!calendarDayDetail.items?.length ? (
          <p className="muted calendar-day-sheet-empty">На этот день записей нет</p>
        ) : (
          <ul className="calendar-day-sheet-list">
            {calendarDayDetail.items.map((it) => (
              <li key={it.id} className="calendar-day-sheet-item">
                {isBookings ? (
                  <>
                    <strong>
                      {new Date(it.slot_starts_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {" – "}
                      {new Date(it.slot_ends_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </strong>
                    <div>{bookingSlotSecondaryLabel(it)}</div>
                    {it.status ? <div className="muted">{bookingStatusLabel(it)}</div> : null}
                    {renderBookingSlotActions(it)}
                  </>
                ) : (
                  <>
                    {!it.is_booked ? (
                      <button
                        type="button"
                        className="calendar-day-sheet-item-delete"
                        aria-label="Удалить интервал"
                        title="Удалить"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSlot(it.id);
                        }}
                      >
                        ×
                      </button>
                    ) : it.is_manual_hold ? (
                      <button
                        type="button"
                        className="calendar-day-sheet-item-delete"
                        aria-label="Снять ручную бронь"
                        title="Снять ручную бронь"
                        onClick={(e) => {
                          e.stopPropagation();
                          void releaseManualHold(it.id);
                        }}
                      >
                        ×
                      </button>
                    ) : null}
                    <strong>
                      {new Date(it.starts_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {" – "}
                      {new Date(it.ends_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </strong>
                    <div className="muted">
                      {it.is_manual_hold
                        ? `Ручная бронь${it.booking_client_name || it.hold_label ? ` · ${it.booking_client_name || it.hold_label}` : ""}`
                        : "Свободно"}
                    </div>
                    {!it.is_booked && onBookClient ? (
                      <button
                        type="button"
                        className="calendar-day-sheet-book-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onBookClient(it);
                        }}
                      >
                        Записать на это время
                      </button>
                    ) : null}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
