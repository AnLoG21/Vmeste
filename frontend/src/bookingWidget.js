import { Capacitor, registerPlugin } from "@capacitor/core";

const BookingWidget = registerPlugin("BookingWidget");

const SKIP_STATUSES = new Set(["cancelled", "no_show"]);
const UPCOMING_STATUSES = new Set(["new", "confirmed", "arrived"]);

function isRealBooking(it) {
  if (!it || it.is_manual_hold) return false;
  const status = String(it.status || "").toLowerCase();
  return !SKIP_STATUSES.has(status);
}

function localDayKeyFromDate(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function localDayKey(iso) {
  if (!iso) return "";
  return localDayKeyFromDate(new Date(iso));
}

function formatTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function clientKey(it) {
  if (it.client != null && it.client !== "") return `id:${it.client}`;
  const name = (it.client_display_name || it.client_username || "").trim().toLowerCase();
  if (name) return `n:${name}`;
  return `b:${it.id}`;
}

function ruCount(n, one, few, many) {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

function todayLineFor(count, asClient) {
  if (asClient) {
    const word = ruCount(count, "запись", "записи", "записей");
    return `Сегодня ${count} ${word}`;
  }
  const word = ruCount(count, "клиент", "клиента", "клиентов");
  return `Сегодня ${count} ${word}`;
}

function nextLineFor(it, asClient) {
  if (asClient) {
    const service = (it.service_name || "").trim();
    const staff = (it.staff_display_name || "").trim();
    return [service, staff].filter(Boolean).join(" · ") || "Запись";
  }
  const client = (it.client_display_name || it.client_username || "").trim() || "Клиент";
  const service = (it.service_name || "").trim();
  return service ? `${client} · ${service}` : client;
}

/**
 * Build widget snapshot from booking list (provider/staff/client).
 */
export function buildBookingWidgetSnapshot(bookings, { asClient = false } = {}) {
  const list = Array.isArray(bookings) ? bookings.filter(isRealBooking) : [];
  const todayKey = localDayKeyFromDate(new Date());
  const now = Date.now();

  const todayKeys = new Set();
  for (const it of list) {
    if (localDayKey(it.slot_starts_at) !== todayKey) continue;
    if (asClient) {
      todayKeys.add(String(it.id));
    } else {
      todayKeys.add(clientKey(it));
    }
  }

  let nearest = null;
  let nearestTs = Infinity;
  for (const it of list) {
    const status = String(it.status || "").toLowerCase();
    if (!UPCOMING_STATUSES.has(status)) continue;
    const ts = new Date(it.slot_starts_at).getTime();
    if (Number.isNaN(ts) || ts < now) continue;
    if (ts < nearestTs) {
      nearestTs = ts;
      nearest = it;
    }
  }

  return {
    todayLine: todayLineFor(todayKeys.size, asClient),
    nextLine: nearest ? nextLineFor(nearest, asClient) : "",
    nextTime: nearest ? formatTime(nearest.slot_starts_at) : "",
  };
}

/**
 * Push snapshot to the Android home-screen widget (no-op on web/iOS).
 */
export async function syncBookingWidget(bookings, options = {}) {
  if (Capacitor.getPlatform() !== "android") return;
  try {
    const snap = buildBookingWidgetSnapshot(bookings, options);
    await BookingWidget.update(snap);
  } catch {
    /* plugin missing on old APK */
  }
}

export async function clearBookingWidget() {
  if (Capacitor.getPlatform() !== "android") return;
  try {
    await BookingWidget.clear();
  } catch {
    /* ignore */
  }
}
