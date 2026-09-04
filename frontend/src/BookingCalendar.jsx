import {
  bookingSlotStatusModifier,
  bookingSlotCompactIcon,
  bookingStatusLabel,
} from "./bookingDisplay.jsx";
import { isoMonthKey } from "./bookingCalendarUtils.jsx";

/** Месячный календарь записей (клиент / организация). */
export default function BookingCalendar({
  title = "Записи",
  bookingsMonth,
  setBookingsMonth,
  bookings,
  setCalendarDayDetail,
  bookingSlotSecondaryLabel,
  renderBookingSlotActions,
}) {
  const [year, month] = bookingsMonth.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const offset = (firstDay.getDay() + 6) % 7;
  const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  const byDay = bookings
    .filter((b) => isoMonthKey(b.slot_starts_at) === bookingsMonth)
    .reduce((acc, item) => {
      const d = new Date(item.slot_starts_at);
      const day = Number.isNaN(d.getTime()) ? Number(String(item.slot_starts_at).slice(8, 10)) : d.getDate();
      if (!acc[day]) acc[day] = [];
      acc[day].push(item);
      return acc;
    }, {});

  const cells = [];
  for (let i = 0; i < offset; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);

  return (
    <section className="card full-width booking-calendar">
      <h2>{title}</h2>
      <input type="month" value={bookingsMonth} onChange={(e) => setBookingsMonth(e.target.value)} />
      <p className="muted small calendar-mobile-hint">На телефоне нажмите на день, чтобы открыть записи</p>
      <div className="calendar-grid">
        {weekdays.map((wd, wi) => (
          <div key={wd} className={`calendar-head ${wi >= 5 ? "weekend-head" : ""}`}>{wd}</div>
        ))}
        {cells.map((day, idx) => {
          const col = idx % 7;
          const weekend =
            day != null ? (offset + day - 1) % 7 >= 5 : col >= 5;
          const dayItems = day ? byDay[day] || [] : [];
          const isToday =
            day != null &&
            year === new Date().getFullYear() &&
            month === new Date().getMonth() + 1 &&
            day === new Date().getDate();
          return (
          <div
            key={`${day ?? "empty"}-${idx}`}
            className={`calendar-cell ${day ? "clickable calendar-cell--bookings" : "empty"} ${weekend ? "weekend-cell" : ""} ${dayItems.length ? "calendar-cell--has-items" : ""} ${isToday ? "calendar-cell--today" : ""}`}
            onClick={() => {
              if (!day) return;
              setCalendarDayDetail({
                mode: "bookings",
                day,
                month: bookingsMonth,
                items: dayItems,
              });
            }}
          >
            {day && (
              <>
                <div className="calendar-day">{day}</div>
                <div className="calendar-slots calendar-slots--desktop">
                  {dayItems.map((it) => (
                    <div
                      key={it.id}
                      className={["calendar-slot", "booking", bookingSlotStatusModifier(it)].filter(Boolean).join(" ")}
                    >
                      <div className="booking-slot-time">
                        {new Date(it.slot_starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {" – "}
                        {new Date(it.slot_ends_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <div className="booking-slot-name">{bookingSlotSecondaryLabel(it)}</div>
                      {it.status && it.status !== "confirmed" && !it.is_manual_hold && it.status !== "manual_hold" && (
                        <div className="booking-slot-status">{bookingStatusLabel(it)}</div>
                      )}
                      {renderBookingSlotActions(it)}
                    </div>
                  ))}
                </div>
                <div className="calendar-slots calendar-slots--mobile">
                  {dayItems.slice(0, 4).map((it) => {
                    const mod = bookingSlotStatusModifier(it);
                    const time = new Date(it.slot_starts_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    return (
                      <div
                        key={it.id}
                        className={["calendar-slot-compact", mod].filter(Boolean).join(" ")}
                        title={`${time} · ${bookingSlotSecondaryLabel(it)} · ${bookingStatusLabel(it)}`}
                        aria-label={`${time} ${bookingStatusLabel(it)}`}
                      >
                        <span className="calendar-slot-compact-icon" aria-hidden>
                          {bookingSlotCompactIcon(mod)}
                        </span>
                      </div>
                    );
                  })}
                  {dayItems.length > 4 ? <div className="calendar-slot-more">+{dayItems.length - 4}</div> : null}
                </div>
              </>
            )}
          </div>
          );
        })}
      </div>
    </section>
  );
}
