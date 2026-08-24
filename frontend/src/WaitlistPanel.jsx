import { useCallback, useEffect, useState } from "react";

const STATUS_LABELS = {
  waiting: "Ждёт",
  notified: "Уведомлён",
  booked: "Записался",
  cancelled: "Отменён",
};

export function JoinWaitlistButton({
  authFetch,
  API_URL,
  providerId,
  serviceId,
  staffId,
  preferredDate,
  disabled,
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function join() {
    if (!providerId || !serviceId) return;
    setBusy(true);
    setError("");
    try {
      const staff =
        staffId && staffId !== "any" && String(staffId).trim() ? Number(staffId) : null;
      const res = await authFetch(`${API_URL}/booking/waitlist/`, {
        method: "POST",
        body: JSON.stringify({
          provider: Number(providerId),
          service: Number(serviceId),
          staff: staff,
          preferred_date: preferredDate || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || "Не удалось встать в лист ожидания.");
        return;
      }
      setDone(true);
    } catch {
      setError("Не удалось встать в лист ожидания.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return <p className="muted small">Вы в листе ожидания — напишем, когда появится время.</p>;
  }

  return (
    <div className="waitlist-join">
      <button type="button" className="ghost-btn" disabled={disabled || busy} onClick={join}>
        {busy ? "Отправляем…" : "Встать в лист ожидания"}
      </button>
      {error ? <p className="status">{error}</p> : null}
    </div>
  );
}

/**
 * Org list of waitlist entries; client can cancel own rows.
 */
export default function WaitlistPanel({ authFetch, API_URL, mode = "org" }) {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    const res = await authFetch(`${API_URL}/booking/waitlist/`);
    if (!res.ok) {
      setStatus("Не удалось загрузить лист ожидания.");
      return;
    }
    const data = await res.json();
    setItems(Array.isArray(data) ? data : data.results || []);
    setStatus("");
  }, [authFetch, API_URL]);

  useEffect(() => {
    load();
  }, [load]);

  async function cancel(id) {
    const res = await authFetch(`${API_URL}/booking/waitlist/${id}/`, {
      method: "PATCH",
      body: JSON.stringify({ status: "cancelled" }),
    });
    if (res.ok) load();
  }

  const waiting = items.filter((x) => x.status === "waiting" || x.status === "notified");
  if (!waiting.length && !status) {
    return null;
  }

  return (
    <section className="card waitlist-panel">
      <h3>{mode === "org" ? "Лист ожидания" : "Мой лист ожидания"}</h3>
      {status ? <p className="status">{status}</p> : null}
      <ul className="waitlist-list">
        {waiting.map((row) => (
          <li key={row.id}>
            <strong>{row.client_name || row.organization_name || "Клиент"}</strong>
            {" · "}
            {row.service_name || "услуга"}
            {row.preferred_date ? ` · ${row.preferred_date}` : ""}
            <span className="muted small"> · {STATUS_LABELS[row.status] || row.status}</span>
            <button type="button" className="ghost-btn small" onClick={() => cancel(row.id)}>
              Снять
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
