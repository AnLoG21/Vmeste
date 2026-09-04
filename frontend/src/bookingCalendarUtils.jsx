import { formatStaffFullName } from "./chatHelpers.jsx";

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function currentLocalMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function isoMonthKey(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function normalizeBookingsList(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

export function normalizeSlotsList(data) {
  return normalizeBookingsList(data);
}

/** Manual org holds live as booked slots without a Booking row — map them into booking calendar items. */
export function manualHoldBookingItems(slots, { orgStaff = [], providerId = null, staffJobTitleForUser } = {}) {
  const staffLinkByStaffId = new Map((orgStaff || []).map((l) => [Number(l.staff), l]));
  const staffDisplayNameById = (staffId) => {
    const sid = staffId == null || staffId === "" ? null : Number(staffId);
    if (!sid) return "";
    const link = staffLinkByStaffId.get(sid);
    return link ? formatStaffFullName(link.staff_user) || `id ${sid}` : `id ${sid}`;
  };
  return (slots || [])
    .filter(
      (s) =>
        Boolean(s?.is_manual_hold) ||
        (Boolean(s?.is_booked) && String(s?.booking_service_name || "").trim() === "Ручная бронь"),
    )
    .map((s) => {
      const staffId = s?.staff ?? null;
      const job =
        typeof staffJobTitleForUser === "function" ? staffJobTitleForUser(staffId) : "";
      return {
        id: `hold-${s.id}`,
        slot_id: s.id,
        slot_starts_at: s.starts_at,
        slot_ends_at: s.ends_at,
        status: "manual_hold",
        is_manual_hold: true,
        service_name: (s.booking_service_name || "").trim() || "Ручная бронь",
        service_price: "",
        client_display_name: (s.booking_client_name || s.hold_label || "").trim() || "Ручная бронь",
        client_username: "",
        client: null,
        provider: providerId,
        staff: staffId,
        staff_display_name: staffDisplayNameById(staffId),
        staff_job_title: job || "",
      };
    });
}

export function mergeBookingsWithManualHolds(bookingsList, slotsList, opts = {}) {
  const list = Array.isArray(bookingsList) ? [...bookingsList] : [];
  const holds = manualHoldBookingItems(slotsList, opts);
  const existingHoldSlotIds = new Set(
    list.filter((b) => b?.is_manual_hold).map((b) => Number(b.slot_id || String(b.id).replace(/^hold-/, ""))),
  );
  for (const h of holds) {
    if (!existingHoldSlotIds.has(Number(h.slot_id))) list.push(h);
  }
  return list;
}

export function formatApiError(err, status) {
  if (!err || typeof err !== "object") {
    if (status === 500) return "Ошибка сервера. Попробуйте позже.";
    return "";
  }
  if (typeof err.detail === "string") return err.detail;
  const parts = [];
  for (const val of Object.values(err)) {
    if (typeof val === "string") parts.push(val);
    else if (Array.isArray(val)) parts.push(...val.filter((x) => typeof x === "string"));
  }
  return parts.join(" ") || "";
}

export function normalizeReviewsList(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

export const BOOKING_PAY_TTL_MS = 10 * 60 * 1000;

export function bookingPayStillOpen(booking) {
  if (!booking || booking.payment_status !== "pending" || booking.status === "cancelled") return false;
  const t = new Date(booking.created_at).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < BOOKING_PAY_TTL_MS;
}

export function StarRating({ value, onChange }) {
  return (
    <div className="star-rating" role="group" aria-label="Оценка">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={["star-rating-btn", n <= value && "star-rating-btn--active"].filter(Boolean).join(" ")}
          aria-label={`${n} из 5`}
          aria-pressed={n <= value}
          onClick={() => onChange(n)}
        >
          <span className="star-rating-icon" aria-hidden>★</span>
        </button>
      ))}
    </div>
  );
}

export function formatTimeHm(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export function clientWindowKey(w) {
  return `${w.starts_at}|${w.ends_at}|${w.staff_id ?? ""}`;
}

/** Group available windows by staff for per-master scroll strips. */
export function groupClientWindowsByStaff(windows) {
  const map = new Map();
  for (const w of windows || []) {
    const sid = w.staff_id == null || w.staff_id === "" ? "none" : String(w.staff_id);
    if (!map.has(sid)) {
      map.set(sid, {
        staff_id: w.staff_id ?? null,
        staff_label: w.staff_label || (sid === "none" ? "Без мастера" : "Мастер"),
        windows: [],
      });
    }
    map.get(sid).windows.push(w);
  }
  return [...map.values()].sort((a, b) => {
    if (a.staff_id == null && b.staff_id != null) return 1;
    if (a.staff_id != null && b.staff_id == null) return -1;
    return String(a.staff_label).localeCompare(String(b.staff_label), "ru");
  });
}

export function staffIntervalOptionLabel(link) {
  const name = formatStaffFullName(link?.staff_user) || `id ${link?.staff}`;
  const title = (link?.job_title || "").trim();
  return title ? `${name} — ${title}` : name;
}

export function parseIntervalAssignee(value) {
  const raw = String(value || "");
  if (raw.startsWith("anon:")) {
    const n = Number(raw.slice(5));
    return { staff_id: null, anonymous_index: Number.isFinite(n) && n > 0 ? n : null };
  }
  if (raw.startsWith("staff:")) {
    const n = Number(raw.slice(6));
    return { staff_id: Number.isFinite(n) ? n : null, anonymous_index: null };
  }
  if (raw && !Number.isNaN(Number(raw))) {
    return { staff_id: Number(raw), anonymous_index: null };
  }
  return { staff_id: null, anonymous_index: null };
}

export function intervalAssigneeValue(staffId, anonymousIndex) {
  if (anonymousIndex != null && anonymousIndex !== "") return `anon:${Number(anonymousIndex)}`;
  if (staffId != null && staffId !== "") return `staff:${Number(staffId)}`;
  return "";
}

export function intervalStaffConflicts(template, slot) {
  const tStaff =
    template?.staff_id == null || template?.staff_id === "" ? null : Number(template.staff_id);
  const tAnon =
    template?.anonymous_index == null || template?.anonymous_index === ""
      ? null
      : Number(template.anonymous_index);
  const sStaff = slot?.staff == null || slot?.staff === "" ? null : Number(slot.staff);
  const sAnon =
    slot?.anonymous_index == null || slot?.anonymous_index === ""
      ? null
      : Number(slot.anonymous_index);
  if (tStaff != null && sStaff != null) return tStaff === sStaff;
  if (tStaff == null && sStaff == null) {
    return Number(tAnon ?? 0) === Number(sAnon ?? 0);
  }
  return false;
}

/** Group saved interval templates by staff for per-employee rows. */
export function groupSavedIntervalsByStaff(intervals, orgStaff) {
  const linkByStaffId = new Map((orgStaff || []).map((l) => [Number(l.staff), l]));
  const map = new Map();
  for (const t of intervals || []) {
    const anon =
      t.anonymous_index != null && t.anonymous_index !== "" ? Number(t.anonymous_index) : null;
    const sid =
      anon != null
        ? `anon:${anon}`
        : t.staff_id == null || t.staff_id === ""
          ? "none"
          : String(t.staff_id);
    if (!map.has(sid)) {
      let staff_label = "Без сотрудника";
      let job_title = "";
      if (sid.startsWith("anon:")) {
        staff_label = `Без сотрудников ${anon}`;
      } else if (sid !== "none") {
        const link = linkByStaffId.get(Number(t.staff_id));
        staff_label = formatStaffFullName(link?.staff_user) || `Мастер ${t.staff_id}`;
        job_title = (link?.job_title || "").trim();
      }
      map.set(sid, { staff_id: t.staff_id ?? null, anonymous_index: anon, staff_label, job_title, templates: [] });
    }
    map.get(sid).templates.push(t);
  }
  return [...map.values()].sort((a, b) => {
    if (a.anonymous_index != null && b.anonymous_index == null) return 1;
    if (a.anonymous_index == null && b.anonymous_index != null) return -1;
    if (a.anonymous_index != null && b.anonymous_index != null) {
      return Number(a.anonymous_index) - Number(b.anonymous_index);
    }
    if (a.staff_id == null && b.staff_id != null) return 1;
    if (a.staff_id != null && b.staff_id == null) return -1;
    return String(a.staff_label).localeCompare(String(b.staff_label), "ru");
  });
}

