import { useEffect, useMemo, useRef, useState } from "react";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

/** Календарь с подсветкой доступных дат (как в записи в приложении). */
export default function MiniDatePicker({
  id,
  label,
  value,
  onChange,
  allowClear = false,
  alwaysOpen = false,
  availableDates = null,
}) {
  const [open, setOpen] = useState(alwaysOpen);
  const wrapRef = useRef(null);
  const today = todayIsoDate();
  const availableSet = useMemo(() => {
    if (!availableDates) return null;
    if (availableDates instanceof Set) return availableDates;
    return new Set(Array.isArray(availableDates) ? availableDates.map(String) : []);
  }, [availableDates]);
  const parsed = value ? new Date(`${value}T12:00:00`) : null;
  const initialMonth = parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
  const [viewMonth, setViewMonth] = useState(
    () => `${initialMonth.getFullYear()}-${String(initialMonth.getMonth() + 1).padStart(2, "0")}`,
  );

  useEffect(() => {
    if (alwaysOpen || !open) return undefined;
    function onDoc(e) {
      if (wrapRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, [open, alwaysOpen]);

  useEffect(() => {
    if (alwaysOpen) setOpen(true);
  }, [alwaysOpen]);

  useEffect(() => {
    if (!value) return;
    const d = new Date(`${value}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
  }, [value]);

  const [vy, vm] = viewMonth.split("-").map(Number);
  const first = new Date(vy, vm - 1, 1);
  const daysInMonth = new Date(vy, vm, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < offset; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);

  const displayLabel = value
    ? new Date(`${value}T12:00:00`).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Выбрать дату";

  const calendar = (
    <div
      className={["mini-date-picker-popover", alwaysOpen && "mini-date-picker-popover--inline"]
        .filter(Boolean)
        .join(" ")}
      role="dialog"
      aria-label="Календарь"
    >
      <div className="mini-date-picker-nav">
        <button
          type="button"
          className="mini-date-nav-btn"
          aria-label="Предыдущий месяц"
          onClick={() => {
            const d = new Date(vy, vm - 2, 1);
            setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
          }}
        >
          ‹
        </button>
        <span className="mini-date-picker-month">
          {first.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}
        </span>
        <button
          type="button"
          className="mini-date-nav-btn"
          aria-label="Следующий месяц"
          onClick={() => {
            const d = new Date(vy, vm, 1);
            setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
          }}
        >
          ›
        </button>
      </div>
      <div className="mini-date-picker-weekdays">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((wd) => (
          <span key={wd} className="mini-date-wd">
            {wd}
          </span>
        ))}
      </div>
      <div className="mini-date-picker-grid">
        {cells.map((day, idx) => {
          if (!day) return <span key={`e-${idx}`} className="mini-date-cell mini-date-cell--empty" />;
          const iso = `${vy}-${String(vm).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isToday = iso === today;
          const isSelected = iso === value;
          const isBookable = !availableSet || availableSet.has(iso);
          const isPast = iso < today;
          const disabled = Boolean(availableSet) && (!isBookable || isPast);
          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              className={[
                "mini-date-cell",
                isToday && "mini-date-cell--today",
                isSelected && "mini-date-cell--selected",
                isBookable && availableSet && "mini-date-cell--available",
                disabled && "mini-date-cell--disabled",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => {
                if (disabled) return;
                onChange(iso);
                if (!alwaysOpen) setOpen(false);
              }}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div
      className={["mini-date-picker", alwaysOpen && "mini-date-picker--open"].filter(Boolean).join(" ")}
      ref={wrapRef}
    >
      {label ? (
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
      ) : null}
      {alwaysOpen ? (
        <div
          id={id}
          className={`mini-date-picker-btn${value ? "" : " mini-date-picker-btn--empty"}`}
          aria-live="polite"
        >
          {displayLabel}
        </div>
      ) : (
        <button
          id={id}
          type="button"
          className={`mini-date-picker-btn${value ? "" : " mini-date-picker-btn--empty"}`}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {displayLabel}
        </button>
      )}
      {allowClear && value ? (
        <button
          type="button"
          className="ghost-btn mini-date-picker-clear"
          onClick={() => {
            onChange("");
            if (!alwaysOpen) setOpen(false);
          }}
        >
          Не учитывать дату
        </button>
      ) : null}
      {(alwaysOpen || open) && calendar}
    </div>
  );
}
