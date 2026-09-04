import { useEffect, useRef, useState } from "react";
import { API_URL } from "./config.js";
import {
  todayIsoDate,
  parseIntervalAssignee,
  intervalStaffConflicts,
} from "./bookingCalendarUtils.jsx";

function savedIntervalsStorageKey(providerId) {
  if (!providerId) return null;
  return `vmeste_saved_intervals_v2_${providerId}`;
}

/**
 * Slot interval templates, manual holds, and slot CRUD for App.
 * `slots` / calendarMonth / popover UI stay in App (shared with seller loaders).
 */
export function useIntervalHandlers({
  authFetch,
  me,
  setMe,
  slots,
  calendarMonth,
  setSellerStatus,
  loadSellerData,
  setCalendarDayDetail,
  intervalPopoverId,
  closeIntervalPopover,
}) {
  const [slotForm, setSlotForm] = useState({ starts_at: "", ends_at: "" });
  const [intervalForm, setIntervalForm] = useState({
    date: "",
    start_time: "09:00",
    end_time: "18:00",
    repeat_type: "none",
    repeat_count: "1",
    assignee: "",
    service_ids: [],
  });
  const [manualHoldForm, setManualHoldForm] = useState(() => ({
    date: todayIsoDate(),
    start_time: "10:00",
    end_time: "11:00",
    guest_name: "",
  }));
  const [manualHoldStatus, setManualHoldStatus] = useState("");
  const [manualHoldBusy, setManualHoldBusy] = useState(false);
  const [intervalToast, setIntervalToast] = useState(null);
  const intervalToastTimerRef = useRef(null);
  const [savedIntervals, setSavedIntervals] = useState([]);
  const [selectedIntervalId, setSelectedIntervalId] = useState(null);

  function showIntervalToast(message) {
    if (intervalToastTimerRef.current) clearTimeout(intervalToastTimerRef.current);
    setIntervalToast(message);
    intervalToastTimerRef.current = setTimeout(() => {
      setIntervalToast(null);
      intervalToastTimerRef.current = null;
    }, 4200);
  }

  useEffect(() => {
    if (me?.role !== "provider" || !me?.id) {
      setSavedIntervals([]);
      setSelectedIntervalId(null);
      closeIntervalPopover();
      return;
    }
    const key = savedIntervalsStorageKey(me.id);
    try {
      const raw = localStorage.getItem(key);
      setSavedIntervals(raw ? JSON.parse(raw) : []);
    } catch {
      setSavedIntervals([]);
    }
    setSelectedIntervalId(null);
    closeIntervalPopover();
  }, [me?.id, me?.role, closeIntervalPopover]);

  useEffect(() => {
    if (me?.role !== "provider" || !me?.id) return;
    const key = savedIntervalsStorageKey(me.id);
    try {
      localStorage.setItem(key, JSON.stringify(savedIntervals));
    } catch {
      // Ignore storage quota/access errors.
    }
  }, [savedIntervals, me?.id, me?.role]);

  useEffect(() => {
    if (selectedIntervalId && !savedIntervals.some((x) => x.id === selectedIntervalId)) {
      setSelectedIntervalId(null);
    }
    if (intervalPopoverId && !savedIntervals.some((x) => x.id === intervalPopoverId)) {
      closeIntervalPopover();
    }
  }, [savedIntervals, selectedIntervalId, intervalPopoverId, closeIntervalPopover]);

  async function createManualHold(event) {
    event?.preventDefault?.();
    if (!manualHoldForm.date || !manualHoldForm.start_time || !manualHoldForm.end_time) {
      setManualHoldStatus("Укажите дату и время.");
      return;
    }
    const start = new Date(`${manualHoldForm.date}T${manualHoldForm.start_time}:00`);
    const end = new Date(`${manualHoldForm.date}T${manualHoldForm.end_time}:00`);
    if (!(start < end)) {
      setManualHoldStatus("Начало должно быть раньше конца.");
      return;
    }
    setManualHoldBusy(true);
    setManualHoldStatus("");
    const response = await authFetch(`${API_URL}/booking/slots/manual-hold/`, {
      method: "POST",
      body: JSON.stringify({
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        guest_name: (manualHoldForm.guest_name || "").trim(),
      }),
    });
    setManualHoldBusy(false);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      setManualHoldStatus(err.detail || "Не удалось забронировать интервал.");
      return;
    }
    setManualHoldStatus("Интервал забронирован.");
    setManualHoldForm((p) => ({ ...p, guest_name: "" }));
    await loadSellerData();
  }

  async function releaseManualHold(slotId) {
    const rawId = String(slotId ?? "").replace(/^hold-/, "");
    const response = await authFetch(`${API_URL}/booking/slots/${rawId}/release-hold/`, {
      method: "POST",
      body: "{}",
    });
    if (!(response.ok || response.status === 204)) {
      const err = await response.json().catch(() => ({}));
      setSellerStatus(err.detail || "Не удалось снять бронь.");
      return;
    }
    setSellerStatus("Ручная бронь снята.");
    await loadSellerData();
  }

  async function addAnonymousSeat() {
    const next = (Number(me?.anonymous_seat_count) || 0) + 1;
    const response = await authFetch(`${API_URL}/users/me/`, {
      method: "PATCH",
      body: JSON.stringify({ anonymous_seat_count: next }),
    });
    if (!response.ok) {
      setSellerStatus("Не удалось добавить место «Без сотрудников».");
      return;
    }
    const data = await response.json();
    setMe((prev) => ({ ...prev, ...data }));
    setIntervalForm((p) => ({ ...p, assignee: `anon:${next}` }));
    setSellerStatus(`Добавлено: Без сотрудников ${next}`);
  }

  async function createSlot(event) {
    event.preventDefault();
    const response = await authFetch(`${API_URL}/booking/slots/`, { method: "POST", body: JSON.stringify(slotForm) });
    if (!response.ok) return setSellerStatus("Ошибка при создании слота.");
    setSlotForm({ starts_at: "", ends_at: "" });
    setSellerStatus("Слот создан.");
    loadSellerData();
  }

  async function createSlotsByInterval(event) {
    event.preventDefault();
    if (!intervalForm.start_time || !intervalForm.end_time) {
      setSellerStatus("Укажи время начала и окончания.");
      return;
    }
    const baseDate = intervalForm.date || new Date().toISOString().slice(0, 10);
    const baseStart = new Date(`${baseDate}T${intervalForm.start_time}:00`);
    const baseEnd = new Date(`${baseDate}T${intervalForm.end_time}:00`);
    if (baseStart >= baseEnd) return setSellerStatus("Время начала должно быть раньше окончания.");
    const assignee = parseIntervalAssignee(intervalForm.assignee);
    const templateStaffId = assignee.staff_id;
    const templateAnon = assignee.anonymous_index;
    const hasDuplicate = savedIntervals.some(
      (s) =>
        s.start_time === intervalForm.start_time &&
        s.end_time === intervalForm.end_time &&
        (s.staff_id ?? null) === templateStaffId &&
        (s.anonymous_index ?? null) === templateAnon,
    );
    if (hasDuplicate) {
      const msg = "Такой интервал уже есть в сохранённых — выбери другой диапазон времени или сотрудника.";
      setSellerStatus(msg);
      showIntervalToast(msg);
      return;
    }
    if (templateStaffId == null && templateAnon == null) {
      setSellerStatus("Выбери сотрудника или место «Без сотрудников».");
      return;
    }
    if (templateAnon != null && !(intervalForm.service_ids || []).length) {
      setSellerStatus("Для «Без сотрудников» выберите хотя бы одну услугу.");
      return;
    }
    const template = {
      id: `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      start_time: intervalForm.start_time,
      end_time: intervalForm.end_time,
      staff_id: templateStaffId,
      anonymous_index: templateAnon,
      service_ids:
        templateAnon != null
          ? (intervalForm.service_ids || []).map((x) => Number(x)).filter((n) => Number.isFinite(n))
          : [],
    };
    setSavedIntervals((prev) => [template, ...prev]);
    setSelectedIntervalId(template.id);
    setSellerStatus("Интервал сохранён. Нажми на день в календаре для применения.");
  }

  function validateIntervalForDate(date, template) {
    const start = new Date(`${date}T${template.start_time}:00`);
    const end = new Date(`${date}T${template.end_time}:00`);
    if (start >= end) return { ok: false, reason: "Некорректный интервал: время начала должно быть раньше окончания." };

    const startMs = start.getTime();
    const endMs = end.getTime();
    const daySlots = slots.filter((s) => s.starts_at?.slice(0, 10) === date && !s.is_booked);
    for (const slot of daySlots) {
      if (!intervalStaffConflicts(template, slot)) continue;
      const slotStartMs = new Date(slot.starts_at).getTime();
      const slotEndMs = new Date(slot.ends_at).getTime();
      const sameBounds = slotStartMs === startMs && slotEndMs === endMs;
      if (sameBounds) {
        return { ok: false, reason: `Интервал ${template.start_time}-${template.end_time} уже применён на ${date}.` };
      }
      const overlaps = startMs < slotEndMs && slotStartMs < endMs;
      if (overlaps) {
        return { ok: false, reason: `Интервал пересекается с существующим на ${date}.` };
      }
    }
    return { ok: true };
  }

  async function applyIntervalToDay(day, template) {
    if (!template) return;
    const date = `${calendarMonth}-${String(day).padStart(2, "0")}`;
    const check = validateIntervalForDate(date, template);
    if (!check.ok) {
      setSellerStatus(check.reason);
      showIntervalToast(check.reason);
      return;
    }
    const start = new Date(`${date}T${template.start_time}:00`);
    const end = new Date(`${date}T${template.end_time}:00`);
    if (start >= end) {
      setSellerStatus("Некорректный интервал: начало позже конца.");
      return;
    }
    const response = await authFetch(`${API_URL}/booking/slots/`, {
      method: "POST",
      body: JSON.stringify({
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        ...(template.staff_id != null ? { staff: template.staff_id } : {}),
        ...(template.anonymous_index != null ? { anonymous_index: template.anonymous_index } : {}),
        ...(Array.isArray(template.service_ids) && template.service_ids.length
          ? { service_ids: template.service_ids }
          : {}),
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const detail = err?.detail || "Не удалось применить интервал на день.";
      showIntervalToast(detail);
      setSellerStatus(detail);
      return;
    }
    setSellerStatus(`Интервал применён на ${date}.`);
    loadSellerData();
  }

  async function applyIntervalByPattern(pattern, template) {
    if (!template) return;
    const [year, month] = calendarMonth.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const targets = [];
    for (let day = 1; day <= daysInMonth; day += 1) {
      const d = new Date(year, month - 1, day);
      const wd = d.getDay();
      const isWorkday = wd >= 1 && wd <= 5;
      const isWeekend = wd === 0 || wd === 6;
      if (pattern === "daily") targets.push(day);
      if (pattern === "workweek" && isWorkday) targets.push(day);
      if (pattern === "weekend" && isWeekend) targets.push(day);
    }
    let success = 0;
    let failed = 0;
    let skipped = 0;
    const errors = [];
    for (const day of targets) {
      const date = `${calendarMonth}-${String(day).padStart(2, "0")}`;
      const check = validateIntervalForDate(date, template);
      if (!check.ok) {
        skipped += 1;
        errors.push(check.reason);
        continue;
      }
      const start = new Date(`${date}T${template.start_time}:00`);
      const end = new Date(`${date}T${template.end_time}:00`);
      const response = await authFetch(`${API_URL}/booking/slots/`, {
        method: "POST",
        body: JSON.stringify({
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          ...(template.staff_id != null ? { staff: template.staff_id } : {}),
          ...(template.anonymous_index != null ? { anonymous_index: template.anonymous_index } : {}),
          ...(Array.isArray(template.service_ids) && template.service_ids.length
            ? { service_ids: template.service_ids }
            : {}),
        }),
      });
      if (response.ok) {
        success += 1;
      } else {
        failed += 1;
        const err = await response.json().catch(() => ({}));
        const detail = err?.detail || `Ошибка применения на ${date}`;
        errors.push(detail);
      }
    }
    const unique = [...new Set(errors)];
    if (unique.length) {
      showIntervalToast(unique.length === 1 ? unique[0] : `${unique[0]} (+ещё ${unique.length - 1})`);
    }
    setSellerStatus(`Применено: ${success}, пропущено: ${skipped}, ошибок: ${failed}`);
    loadSellerData();
  }

  async function deleteSlot(slotId) {
    const response = await authFetch(`${API_URL}/booking/slots/${slotId}/`, { method: "DELETE" });
    if (!response.ok) return setSellerStatus("Не удалось удалить интервал.");
    setSellerStatus("Интервал удален.");
    setCalendarDayDetail((prev) => {
      if (!prev || prev.mode !== "intervals") return prev;
      const items = (prev.items || []).filter((x) => Number(x.id) !== Number(slotId));
      return { ...prev, items };
    });
    loadSellerData();
  }

  async function deleteSeries(group) {
    if (!group) return;
    const response = await authFetch(
      `${API_URL}/booking/slots/delete-series/?recurrence_group=${encodeURIComponent(group)}`,
      { method: "DELETE" },
    );
    if (!response.ok) return setSellerStatus("Не удалось удалить серию интервалов.");
    const data = await response.json();
    setSellerStatus(`Удалено интервалов в серии: ${data.deleted ?? 0}`);
    loadSellerData();
  }

  return {
    slotForm,
    setSlotForm,
    intervalForm,
    setIntervalForm,
    manualHoldForm,
    setManualHoldForm,
    manualHoldStatus,
    setManualHoldStatus,
    manualHoldBusy,
    intervalToast,
    savedIntervals,
    setSavedIntervals,
    selectedIntervalId,
    setSelectedIntervalId,
    showIntervalToast,
    createManualHold,
    releaseManualHold,
    addAnonymousSeat,
    createSlot,
    createSlotsByInterval,
    validateIntervalForDate,
    applyIntervalToDay,
    applyIntervalByPattern,
    deleteSlot,
    deleteSeries,
  };
}
