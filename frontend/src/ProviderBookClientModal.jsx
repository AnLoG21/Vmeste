import { useEffect, useMemo, useState } from "react";
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

/**
 * Быстрая запись клиента по телефону на свободный интервал (2 клика после поиска).
 */
export default function ProviderBookClientModal({
  slot,
  services = [],
  authFetch,
  API_URL,
  initialPhone = "",
  initialName = "",
  onClose,
  onBooked,
}) {
  const [phone, setPhone] = useState(initialPhone || "");
  const [name, setName] = useState(initialName || "");
  const [lookup, setLookup] = useState(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [serviceId, setServiceId] = useState("");
  const [startTime, setStartTime] = useState(() => toLocalTimeValue(slot?.starts_at));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const dateStr = useMemo(() => toLocalDateValue(slot?.starts_at), [slot?.starts_at]);
  const slotEndTime = useMemo(() => toLocalTimeValue(slot?.ends_at), [slot?.ends_at]);
  const activeServices = useMemo(
    () => (services || []).filter((s) => s.is_active !== false),
    [services]
  );

  useEffect(() => {
    if (!serviceId && activeServices[0]) {
      setServiceId(String(activeServices[0].id));
    }
  }, [activeServices, serviceId]);

  useEffect(() => {
    if (!(initialPhone || "").trim()) return;
    void runLookup(initialPhone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runLookup(rawPhone) {
    const p = (rawPhone || phone || "").trim();
    if (p.replace(/\D/g, "").length < 10) {
      setLookup(null);
      setStatus("Введите телефон клиента.");
      return;
    }
    setLookupBusy(true);
    setStatus("");
    try {
      const res = await authFetch(
        `${API_URL}/booking/clients/lookup/?phone=${encodeURIComponent(p)}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(data.detail || "Не удалось найти клиента.");
        setLookup(null);
        return;
      }
      setLookup(data);
      if (data.found && data.client?.name) {
        setName(data.client.name);
      }
      if (data.normalized_phone) setPhone(data.normalized_phone);
    } finally {
      setLookupBusy(false);
    }
  }

  async function submit(e) {
    e?.preventDefault?.();
    setStatus("");
    if (!serviceId) {
      setStatus("Выберите услугу.");
      return;
    }
    const start = combineLocalDateTime(dateStr, startTime);
    if (!start) {
      setStatus("Укажите время начала.");
      return;
    }
    const slotStart = slot?.starts_at ? new Date(slot.starts_at) : null;
    const slotEnd = slot?.ends_at ? new Date(slot.ends_at) : null;
    if (slotStart && start < slotStart) {
      setStatus("Время раньше начала свободного интервала.");
      return;
    }
    if (slotEnd && start >= slotEnd) {
      setStatus("Время выходит за свободный интервал.");
      return;
    }

    const payload = {
      phone: (phone || "").trim(),
      name: (name || "").trim(),
      service: Number(serviceId),
      starts_at: start.toISOString(),
      comment: "",
    };
    if (lookup?.found && lookup.client?.id) {
      payload.client = lookup.client.id;
    }
    if (slot?.staff != null && slot.staff !== "") {
      payload.staff = slot.staff;
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
      showToast("Клиент записан. Уведомление отправлено.", { tone: "success" });
      onBooked?.(data);
      onClose?.();
    } finally {
      setBusy(false);
    }
  }

  const selected = activeServices.find((s) => String(s.id) === String(serviceId));
  const durationHint = selected
    ? `${selected.duration_minutes || 30} мин${selected.name ? ` · ${selected.name}` : ""}`
    : "";

  return (
    <div className="modal-backdrop modal-backdrop--app-overlay" onClick={() => onClose?.()}>
      <div
        className="modal-card provider-book-client-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="provider-book-client-title"
      >
        <div className="provider-book-client-head">
          <div>
            <h2 id="provider-book-client-title">Записать клиента</h2>
            <p className="muted small">
              {dateStr
                ? `${new Date(slot.starts_at).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "long",
                  })} · свободно до ${slotEndTime}`
                : "Свободный интервал"}
            </p>
          </div>
          <button type="button" className="client-memory-close" aria-label="Закрыть" onClick={() => onClose?.()}>
            ×
          </button>
        </div>

        <form className="form provider-book-client-form" onSubmit={submit}>
          <label className="field-label">
            Телефон
            <div className="provider-book-client-phone-row">
              <input
                type="tel"
                inputMode="tel"
                placeholder="+7 …"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setLookup(null);
                }}
                onBlur={() => void runLookup()}
                required
              />
              <button type="button" disabled={lookupBusy} onClick={() => void runLookup()}>
                {lookupBusy ? "…" : "Найти"}
              </button>
            </div>
          </label>

          {lookup?.found ? (
            <p className="provider-book-client-match muted small">
              В базе: <strong>{lookup.client.name}</strong>
              {lookup.client.visits_done != null ? ` · визитов: ${lookup.client.visits_done}` : ""}
            </p>
          ) : lookup && !lookup.found ? (
            <p className="provider-book-client-match muted small">Новый клиент — создадим карточку по телефону.</p>
          ) : null}

          <label className="field-label">
            Имя
            <input
              type="text"
              placeholder="Как обращаться"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

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

          <label className="field-label">
            Начало
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
          </label>
          {durationHint ? <p className="muted small">Длительность: {durationHint}</p> : null}

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
