import { useEffect, useMemo, useState } from "react";
import ClientPickerSearch from "./ClientPickerSearch.jsx";
import { showToast } from "./toast.js";

function toLocalTimeValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function toLocalDateValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function combineLocalDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const d = new Date(`${dateStr}T${timeStr}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatHm(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Запись клиента из базы на свободное время.
 * props.slot — свободный интервал; props.dayDate — день YYYY-MM-DD (календарь записей);
 * props.initialDate/Start/End — из формы «Забронировать».
 */
export default function ProviderBookClientModal({
  slot = null,
  dayDate = "",
  services = [],
  authFetch,
  API_URL,
  providerId = null,
  initialPhone = "",
  initialName = "",
  initialDate = "",
  initialStart = "",
  initialEnd = "",
  onClose,
  onBooked,
}) {
  const [selectedClient, setSelectedClient] = useState(null);
  const [guestName, setGuestName] = useState(initialName || "");
  const [serviceId, setServiceId] = useState("");
  const [dateStr, setDateStr] = useState(
    () => initialDate || toLocalDateValue(slot?.starts_at) || dayDate || ""
  );
  const [startTime, setStartTime] = useState(
    () => initialStart || toLocalTimeValue(slot?.starts_at) || ""
  );
  const [endTime, setEndTime] = useState(
    () => initialEnd || (slot ? toLocalTimeValue(slot?.ends_at) : "") || ""
  );
  const [windows, setWindows] = useState([]);
  const [windowKey, setWindowKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const activeServices = useMemo(
    () => (services || []).filter((s) => s.is_active !== false),
    [services]
  );
  const dayMode = Boolean(dayDate || (!slot && dateStr));
  const slotEndTime = useMemo(() => toLocalTimeValue(slot?.ends_at), [slot?.ends_at]);

  useEffect(() => {
    if (!serviceId && activeServices[0]) setServiceId(String(activeServices[0].id));
  }, [activeServices, serviceId]);

  useEffect(() => {
    if (!dayMode || !serviceId || !dateStr || !authFetch) {
      setWindows([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const svc = activeServices.find((s) => String(s.id) === String(serviceId));
      const pid = providerId || svc?.provider;
      if (!pid) {
        setWindows([]);
        return;
      }
      const res = await authFetch(
        `${API_URL}/booking/slots/available-windows/?provider=${encodeURIComponent(pid)}&service=${encodeURIComponent(serviceId)}&date=${encodeURIComponent(dateStr)}`
      );
      if (cancelled) return;
      if (!res.ok) {
        setWindows([]);
        return;
      }
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setWindows(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [dayMode, serviceId, dateStr, authFetch, API_URL, activeServices, providerId]);

  async function submit(e) {
    e?.preventDefault?.();
    setStatus("");
    if (!serviceId) {
      setStatus("Выберите услугу.");
      return;
    }
    if (!selectedClient && !(guestName || "").trim()) {
      setStatus("Выберите клиента из базы или укажите имя.");
      return;
    }

    let start = combineLocalDateTime(dateStr, startTime);
    let endsAtIso = null;
    if (windowKey) {
      const w = windows.find((x) => `${x.starts_at}|${x.ends_at}|${x.staff_id ?? ""}` === windowKey);
      if (w) {
        start = new Date(w.starts_at);
        endsAtIso = w.ends_at;
      }
    }
    if (!start || Number.isNaN(start.getTime())) {
      setStatus("Укажите время начала.");
      return;
    }

    if (slot?.starts_at) {
      const slotStart = new Date(slot.starts_at);
      const slotEnd = slot.ends_at ? new Date(slot.ends_at) : null;
      if (start < slotStart) {
        setStatus("Время раньше начала свободного интервала.");
        return;
      }
      if (slotEnd && start >= slotEnd) {
        setStatus("Время выходит за свободный интервал.");
        return;
      }
    }

    const payload = {
      service: Number(serviceId),
      starts_at: start.toISOString(),
      comment: "",
    };
    if (endsAtIso) payload.ends_at = endsAtIso;
    else if (endTime && dateStr) {
      const end = combineLocalDateTime(dateStr, endTime);
      if (end && end > start) payload.ends_at = end.toISOString();
    }
    if (selectedClient?.id) {
      payload.client = selectedClient.id;
      payload.name = selectedClient.name || guestName;
      if (selectedClient.phone) payload.phone = selectedClient.phone;
    } else {
      payload.name = (guestName || "").trim();
    }
    if (slot?.staff != null && slot.staff !== "") {
      payload.staff = slot.staff;
    } else if (windowKey) {
      const w = windows.find((x) => `${x.starts_at}|${x.ends_at}|${x.staff_id ?? ""}` === windowKey);
      if (w?.staff_id) payload.staff = w.staff_id;
    }

    setBusy(true);
    try {
      const res = await authFetch(`${API_URL}/booking/book-for-client/`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(data.detail || "Не удалось записать.");
        return;
      }
      showToast("Клиент записан.", { tone: "success" });
      onBooked?.(data);
      onClose?.();
    } finally {
      setBusy(false);
    }
  }

  const selected = activeServices.find((s) => String(s.id) === String(serviceId));
  const durationHint = selected
    ? `${selected.duration_minutes || 30} мин · ${selected.name || ""}`
    : "";

  const subtitle = slot
    ? `${new Date(slot.starts_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} · свободно до ${slotEndTime}`
    : dateStr
      ? new Date(`${dateStr}T12:00:00`).toLocaleDateString("ru-RU", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "Запись клиента";

  return (
    <div
      className="modal-backdrop modal-backdrop--app-overlay modal-backdrop--bottom-sheet"
      onClick={() => onClose?.()}
    >
      <div
        className="modal-card provider-book-client-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="provider-book-client-title"
      >
        <div className="sheet-grab" aria-hidden />
        <div className="provider-book-client-head">
          <div>
            <h2 id="provider-book-client-title">Записать клиента</h2>
            <p className="muted small">{subtitle}</p>
          </div>
          <button type="button" className="client-memory-close" aria-label="Закрыть" onClick={() => onClose?.()}>
            ×
          </button>
        </div>

        <form className="form provider-book-client-form" onSubmit={submit}>
          <ClientPickerSearch
            authFetch={authFetch}
            API_URL={API_URL}
            initialQuery={initialPhone || initialName || ""}
            selectedClient={selectedClient}
            onSelect={(c) => {
              setSelectedClient(c);
              if (c.name) setGuestName(c.name);
            }}
            onClear={() => setSelectedClient(null)}
          />

          {!selectedClient ? (
            <label className="field-label">
              Имя (если нового клиента)
              <input
                type="text"
                placeholder="Как обращаться"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
              />
            </label>
          ) : null}

          <label className="field-label">
            Услуга
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} required>
              <option value="" disabled>
                Выберите…
              </option>
              {activeServices.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.duration_minutes ? ` (${s.duration_minutes} мин)` : ""}
                </option>
              ))}
            </select>
          </label>

          {!slot ? (
            <label className="field-label">
              Дата
              <input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} required />
            </label>
          ) : null}

          {dayMode && windows.length > 0 ? (
            <label className="field-label">
              Свободное время
              <select
                value={windowKey}
                onChange={(e) => {
                  const key = e.target.value;
                  setWindowKey(key);
                  const w = windows.find((x) => `${x.starts_at}|${x.ends_at}|${x.staff_id ?? ""}` === key);
                  if (w) setStartTime(toLocalTimeValue(w.starts_at));
                }}
              >
                <option value="">Выберите окно…</option>
                {windows.map((w) => {
                  const key = `${w.starts_at}|${w.ends_at}|${w.staff_id ?? ""}`;
                  return (
                    <option key={key} value={key}>
                      {formatHm(w.starts_at)} – {formatHm(w.ends_at)}
                    </option>
                  );
                })}
              </select>
            </label>
          ) : (
            <div className="row-2">
              <label className="field-label">
                Начало
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
              </label>
              {!slot ? (
                <label className="field-label">
                  До (необяз.)
                  <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </label>
              ) : (
                <p className="muted small" style={{ alignSelf: "end", margin: 0 }}>
                  {durationHint}
                </p>
              )}
            </div>
          )}
          {slot && durationHint ? <p className="muted small">Длительность: {durationHint}</p> : null}

          <div className="provider-book-client-actions">
            <button type="submit" disabled={busy}>
              {busy ? "Записываем…" : "Записать"}
            </button>
          </div>
          {status ? <p className="status">{status}</p> : null}
        </form>
      </div>
    </div>
  );
}
