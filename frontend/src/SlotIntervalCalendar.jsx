import { createPortal } from "react-dom";
import {
  groupSavedIntervalsByStaff,
  staffIntervalOptionLabel,
} from "./bookingCalendarUtils.jsx";

/** Позиция portal-поповера сохранённого интервала относительно якоря. */
export function buildIntervalPopoverFixedStyle(anchorEl) {
  if (!anchorEl || typeof window === "undefined") return null;
  const r = anchorEl.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(300, Math.max(240, Math.min(vw - 16, 300)));
  const estimatedH = 220;
  // На узком экране — по центру вьюпорта; на широком — у якоря, с clamp по краям
  let left = vw <= 900 ? vw / 2 : r.left + r.width / 2;
  const half = width / 2;
  left = Math.max(half + 8, Math.min(vw - half - 8, left));
  let top = r.bottom + 8;
  if (top + estimatedH > vh - 8) {
    top = Math.max(8, r.top - estimatedH - 8);
  }
  return {
    position: "fixed",
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
    width: `${Math.round(width)}px`,
    maxWidth: "calc(100vw - 16px)",
    transform: "translateX(-50%)",
    zIndex: 9000,
    boxSizing: "border-box",
  };
}

/** Календарь свободных интервалов и ручных броней организации. */
export default function SlotIntervalCalendar({
  showCreateControls = false,
  calendarMonth,
  setCalendarMonth,
  me,
  orgStaff,
  savedIntervals,
  setSavedIntervals,
  selectedIntervalId,
  setSelectedIntervalId,
  dragIntervalId,
  setDragIntervalId,
  intervalPopoverId,
  setIntervalPopoverId,
  intervalPopoverAnchorRef,
  intervalPopoverFixedStyle,
  setIntervalPopoverFixedStyle,
  closeIntervalPopover,
  slots,
  setCalendarDayDetail,
  setSellerStatus,
  applyIntervalToDay,
  applyIntervalByPattern,
  deleteSlot,
  deleteSeries,
  releaseManualHold,
  manualHoldForm,
  setManualHoldForm,
  createManualHold,
  manualHoldBusy,
  manualHoldStatus,
  intervalForm,
  setIntervalForm,
  createSlotsByInterval,
  sellerStatus,
  services,
  addAnonymousSeat,
  intervalEditModal,
  setIntervalEditModal,
}) {
  const [year, month] = calendarMonth.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const offset = (firstDay.getDay() + 6) % 7;
  const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const activeIntervalStaff = orgStaff.filter(
    (l) =>
      l.is_active &&
      l.invitation_status !== "pending" &&
      l.invitation_status !== "rejected"
  );
  const groupedSavedIntervals = groupSavedIntervalsByStaff(savedIntervals, orgStaff);

  const renderSavedIntervalChip = (template) => (
    <div
      key={template.id}
      className={`template-chip ${selectedIntervalId === template.id ? "active" : ""}`}
      draggable
      onClick={(e) => {
        setSelectedIntervalId(template.id);
        if (intervalPopoverId === template.id) {
          closeIntervalPopover();
          return;
        }
        const chip = e.currentTarget;
        intervalPopoverAnchorRef.current = chip;
        setIntervalPopoverFixedStyle(buildIntervalPopoverFixedStyle(chip));
        setIntervalPopoverId(template.id);
      }}
      onDragStart={() => {
        setDragIntervalId(template.id);
        setSelectedIntervalId(template.id);
      }}
    >
      <div className="template-main">
        <strong>
          {template.start_time} - {template.end_time}
        </strong>
      </div>
      <button
        type="button"
        className="template-remove"
        onClick={(e) => {
          e.stopPropagation();
          setSavedIntervals((prev) => prev.filter((x) => x.id !== template.id));
          if (selectedIntervalId === template.id) setSelectedIntervalId(null);
          if (intervalPopoverId === template.id) closeIntervalPopover();
        }}
        aria-label="Удалить сохранённый интервал"
      >
        ×
      </button>
    </div>
  );

  const byDay = slots
    .filter((s) => s.starts_at?.slice(0, 7) === calendarMonth)
    // В календаре интервалов не показываем клиентские записи — только свободные и ручные брони организации.
    .filter((s) => !s.is_booked || Boolean(s.is_manual_hold))
    .reduce((acc, slot) => {
      const day = Number(slot.starts_at.slice(8, 10));
      if (!acc[day]) acc[day] = [];
      acc[day].push(slot);
      return acc;
    }, {});

  const cells = [];
  for (let i = 0; i < offset; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);

  return (
    <section className="card full-width interval-calendar">
      <h2>Календарь интервалов</h2>
      {showCreateControls && (
        <>
          <form onSubmit={createManualHold} className="form interval-manual-hold">
            <h3 className="interval-manual-hold-title">Забронировать</h3>
            <p className="muted small">Отметьте занятое время внутри свободного интервала (например, запись по телефону).</p>
            <div className="row-2">
              <label className="field-label">
                Дата
                <input
                  type="date"
                  value={manualHoldForm.date}
                  onChange={(e) => setManualHoldForm((p) => ({ ...p, date: e.target.value }))}
                  required
                />
              </label>
              <label className="field-label">
                ФИО (необязательно)
                <input
                  type="text"
                  placeholder="На кого бронь"
                  value={manualHoldForm.guest_name}
                  onChange={(e) => setManualHoldForm((p) => ({ ...p, guest_name: e.target.value }))}
                />
              </label>
            </div>
            <div className="row-2">
              <label className="field-label">
                С
                <input
                  type="time"
                  value={manualHoldForm.start_time}
                  onChange={(e) => setManualHoldForm((p) => ({ ...p, start_time: e.target.value }))}
                  required
                />
              </label>
              <label className="field-label">
                До
                <input
                  type="time"
                  value={manualHoldForm.end_time}
                  onChange={(e) => setManualHoldForm((p) => ({ ...p, end_time: e.target.value }))}
                  required
                />
              </label>
            </div>
            <button type="submit" disabled={manualHoldBusy}>
              {manualHoldBusy ? "Бронирование…" : "Забронировать интервал"}
            </button>
            {manualHoldStatus ? <p className="status">{manualHoldStatus}</p> : null}
          </form>
          <form onSubmit={createSlotsByInterval} className="form interval-free-form">
            <h3 className="interval-manual-hold-title">Свободные интервалы</h3>
            <div className="row-2">
              <input type="time" value={intervalForm.start_time} onChange={(e) => setIntervalForm({ ...intervalForm, start_time: e.target.value })} required />
              <input type="time" value={intervalForm.end_time} onChange={(e) => setIntervalForm({ ...intervalForm, end_time: e.target.value })} required />
            </div>
            <label className="field-label interval-free-staff-field">
              <span>Сотрудник</span>
              <div className="interval-free-staff-row">
                <select
                  value={intervalForm.assignee}
                  onChange={(e) =>
                    setIntervalForm({
                      ...intervalForm,
                      assignee: e.target.value,
                      service_ids: e.target.value.startsWith("anon:") ? intervalForm.service_ids : [],
                    })
                  }
                  required
                >
                  <option value="" disabled>
                    Выберите…
                  </option>
                  {Array.from({ length: Number(me?.anonymous_seat_count) || 0 }, (_, i) => i + 1).map((n) => (
                    <option key={`anon-${n}`} value={`anon:${n}`}>
                      Без сотрудников {n}
                    </option>
                  ))}
                  {activeIntervalStaff.map((link) => (
                    <option key={link.id} value={`staff:${link.staff}`}>
                      {staffIntervalOptionLabel(link)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="interval-anon-seat-btn"
                  title="Добавить «Без сотрудников»"
                  aria-label="Добавить место без сотрудника"
                  onClick={() => void addAnonymousSeat()}
                >
                  👤+
                </button>
              </div>
            </label>
            {String(intervalForm.assignee || "").startsWith("anon:") ? (
              <div className="interval-anon-services">
                <p className="field-label">Услуги для этого места</p>
                <div className="interval-anon-services-list">
                  {services.filter((s) => s.is_active).length === 0 ? (
                    <p className="muted small">Нет активных услуг в каталоге.</p>
                  ) : (
                    services
                      .filter((s) => s.is_active)
                      .map((s) => {
                        const checked = (intervalForm.service_ids || []).some((id) => Number(id) === Number(s.id));
                        return (
                          <label key={s.id} className="checkbox interval-anon-service-item">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setIntervalForm((p) => {
                                  const cur = new Set((p.service_ids || []).map(Number));
                                  if (e.target.checked) cur.add(Number(s.id));
                                  else cur.delete(Number(s.id));
                                  return { ...p, service_ids: [...cur] };
                                });
                              }}
                            />
                            <span>{s.name}</span>
                          </label>
                        );
                      })
                  )}
                </div>
              </div>
            ) : null}
            <button type="submit">Создать интервал</button>
          </form>
          <p className="status">{sellerStatus}</p>
        </>
      )}
      <input type="month" value={calendarMonth} onChange={(e) => setCalendarMonth(e.target.value)} />
      <div className="interval-templates">
        <h3>Сохранённые интервалы</h3>
        {savedIntervals.length === 0 && <p className="muted">Пока нет сохранённых интервалов.</p>}
        <div className="interval-staff-groups">
          {groupedSavedIntervals.map((group) => (
            <div
              key={
                group.anonymous_index != null
                  ? `anon:${group.anonymous_index}`
                  : group.staff_id ?? "none"
              }
              className="interval-staff-group"
            >
              <p className="interval-staff-group-name">
                {group.staff_label}
                {group.job_title ? <span className="interval-staff-group-job"> · {group.job_title}</span> : null}
              </p>
              <div className="template-list">{group.templates.map((template) => renderSavedIntervalChip(template))}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="calendar-grid">
        {weekdays.map((wd, wi) => (
          <div key={wd} className={`calendar-head ${wi >= 5 ? "weekend-head" : ""}`}>{wd}</div>
        ))}
        {cells.map((day, idx) => {
          const col = idx % 7;
          const weekend =
            day != null ? (offset + day - 1) % 7 >= 5 : col >= 5;
          const isToday =
            day != null &&
            year === new Date().getFullYear() &&
            month === new Date().getMonth() + 1 &&
            day === new Date().getDate();
          return (
          <div
            key={`${day ?? "empty"}-${idx}`}
            className={`calendar-cell ${day ? "clickable" : ""} ${day ? "" : "empty"} ${weekend ? "weekend-cell" : ""} ${isToday ? "calendar-cell--today" : ""}`}
            onClick={() => {
              if (!day) return;
              const selected = savedIntervals.find((x) => x.id === selectedIntervalId);
              if (!selected) {
                setSellerStatus("Выбери сохранённый интервал.");
                return;
              }
              applyIntervalToDay(day, selected);
            }}
            onDragOver={(e) => {
              if (!day) return;
              e.preventDefault();
            }}
            onDrop={(e) => {
              if (!day) return;
              e.preventDefault();
              const selected = savedIntervals.find((x) => x.id === dragIntervalId || x.id === selectedIntervalId);
              if (!selected) return;
              applyIntervalToDay(day, selected);
            }}
          >
            {day && (
              <>
                <div className="calendar-day-row">
                  <div className="calendar-day">{day}</div>
                  {(byDay[day] || []).length > 0 && (
                    <button
                      type="button"
                      className="calendar-day-expand"
                      aria-label="Открыть день"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCalendarDayDetail({
                          mode: "intervals",
                          day,
                          month: calendarMonth,
                          items: byDay[day] || [],
                        });
                      }}
                    >
                      ▾
                    </button>
                  )}
                </div>
                <div className="calendar-slots calendar-slots--desktop">
                  {(byDay[day] || []).map((s) => (
                    <div
                      key={s.id}
                      className={["slot-chip", s.is_booked && "slot-chip--booked"].filter(Boolean).join(" ")}
                      title={
                        s.is_booked
                          ? s.booking_client_name || s.hold_label || "Забронировано"
                          : "Свободный интервал"
                      }
                    >
                      <span className="slot-chip-label">
                        {new Date(s.starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {" – "}
                        {new Date(s.ends_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {s.is_booked
                          ? ` · ${s.booking_client_name || s.hold_label || "бронь"}`
                          : ""}
                      </span>
                      {!s.is_booked ? (
                        <button
                          type="button"
                          className="chip-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSlot(s.id);
                          }}
                        >
                          x
                        </button>
                      ) : s.is_manual_hold ? (
                        <button
                          type="button"
                          className="chip-btn"
                          title="Снять ручную бронь"
                          onClick={(e) => {
                            e.stopPropagation();
                            void releaseManualHold(s.id);
                          }}
                        >
                          x
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {(byDay[day] || []).some((s) => !s.is_booked && s.recurrence_group) && (
                    <button
                      type="button"
                      className="small-btn ghost-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        const grp = (byDay[day] || []).find((s) => !s.is_booked && s.recurrence_group)?.recurrence_group;
                        if (grp) deleteSeries(grp);
                      }}
                    >
                      Удалить серию
                    </button>
                  )}
                </div>
                <div className="calendar-slots calendar-slots--mobile">
                  {(byDay[day] || []).map((s) => (
                    <div
                      key={s.id}
                      className={[
                        "calendar-slot-compact",
                        "calendar-slot-compact--interval",
                        s.is_booked && "calendar-slot-compact--booked",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      title={
                        s.is_booked
                          ? s.booking_client_name || s.hold_label || "Забронировано"
                          : "Свободный интервал"
                      }
                    >
                      <span className="calendar-slot-compact-time">
                        <span className="calendar-slot-compact-start">
                          {new Date(s.starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="calendar-slot-compact-end">
                          {new Date(s.ends_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          );
        })}
      </div>
      {intervalPopoverId != null &&
        intervalPopoverFixedStyle &&
        typeof document !== "undefined" &&
        (() => {
          const popTemplate = savedIntervals.find((t) => t.id === intervalPopoverId);
          if (!popTemplate) return null;
          return createPortal(
            <div
              className="template-popover template-popover--portal"
              style={intervalPopoverFixedStyle}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-label="Действия с интервалом"
            >
              {popTemplate.anonymous_index != null ? (
                <button
                  type="button"
                  className="small-btn"
                  onClick={() => {
                    setIntervalEditModal({
                      id: popTemplate.id,
                      start_time: popTemplate.start_time,
                      end_time: popTemplate.end_time,
                      service_ids: [...(popTemplate.service_ids || [])].map(Number),
                    });
                    closeIntervalPopover();
                  }}
                >
                  ✎ Изменить
                </button>
              ) : null}
              <button type="button" className="small-btn" onClick={() => { setSelectedIntervalId(popTemplate.id); closeIntervalPopover(); }}>
                Выбрать
              </button>
              <button type="button" className="small-btn" onClick={() => { applyIntervalByPattern("daily", popTemplate); closeIntervalPopover(); }}>
                Применить на каждый день
              </button>
              <button type="button" className="small-btn" onClick={() => { applyIntervalByPattern("workweek", popTemplate); closeIntervalPopover(); }}>
                Применить на рабочую неделю
              </button>
              <button type="button" className="small-btn" onClick={() => { applyIntervalByPattern("weekend", popTemplate); closeIntervalPopover(); }}>
                Применить на выходные
              </button>
            </div>,
            document.body
          );
        })()}
      {intervalEditModal && typeof document !== "undefined" && createPortal(
        <div className="modal-backdrop" onClick={() => setIntervalEditModal(null)}>
          <div className="modal-card interval-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="staff-review-modal-head">
              <h3>Изменить интервал</h3>
              <button type="button" className="small-btn" onClick={() => setIntervalEditModal(null)}>
                ✕
              </button>
            </div>
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                const start = intervalEditModal.start_time;
                const end = intervalEditModal.end_time;
                if (!start || !end || start >= end) {
                  setSellerStatus("Некорректное время интервала.");
                  return;
                }
                const svcIds = (intervalEditModal.service_ids || []).map(Number).filter((n) => Number.isFinite(n));
                if (!svcIds.length) {
                  setSellerStatus("Выберите хотя бы одну услугу.");
                  return;
                }
                setSavedIntervals((prev) =>
                  prev.map((t) =>
                    t.id === intervalEditModal.id
                      ? { ...t, start_time: start, end_time: end, service_ids: svcIds }
                      : t,
                  ),
                );
                setIntervalEditModal(null);
                setSellerStatus("Интервал обновлён.");
              }}
            >
              <div className="row-2">
                <label className="field-label">
                  С
                  <input
                    type="time"
                    value={intervalEditModal.start_time}
                    onChange={(e) =>
                      setIntervalEditModal((p) => ({ ...p, start_time: e.target.value }))
                    }
                    required
                  />
                </label>
                <label className="field-label">
                  До
                  <input
                    type="time"
                    value={intervalEditModal.end_time}
                    onChange={(e) =>
                      setIntervalEditModal((p) => ({ ...p, end_time: e.target.value }))
                    }
                    required
                  />
                </label>
              </div>
              <div className="interval-anon-services">
                <p className="field-label">Услуги</p>
                <div className="interval-anon-services-list">
                  {services
                    .filter((s) => s.is_active)
                    .map((s) => {
                      const checked = (intervalEditModal.service_ids || []).some(
                        (id) => Number(id) === Number(s.id),
                      );
                      return (
                        <label key={s.id} className="checkbox interval-anon-service-item">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setIntervalEditModal((p) => {
                                const cur = new Set((p.service_ids || []).map(Number));
                                if (e.target.checked) cur.add(Number(s.id));
                                else cur.delete(Number(s.id));
                                return { ...p, service_ids: [...cur] };
                              });
                            }}
                          />
                          <span>{s.name}</span>
                        </label>
                      );
                    })}
                </div>
              </div>
              <div className="row-2">
                <button type="button" className="ghost-btn" onClick={() => setIntervalEditModal(null)}>
                  Отмена
                </button>
                <button type="submit">Сохранить</button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </section>
  );
}
