import { useCallback, useEffect, useState } from "react";
import InspectionApproveView from "./InspectionApproveView.jsx";

const STATUS_LABELS = {
  sent: "Нужно согласовать",
  approved: "Утверждено",
  cancelled: "Отменён",
};

const REPAIR_STATUS_LABELS = {
  in_progress: "В работе",
  ready: "Готов",
};

export default function ClientInspectionsPanel({
  authFetch,
  API_URL,
  initialReportId = null,
  onConsumedInitialReportId,
  onBackToChats,
  onOpenPhotos,
  embedded = false,
}) {
  const [list, setList] = useState([]);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    const res = await authFetch(`${API_URL}/inspections/reports/`);
    if (!res.ok) {
      setStatus("Не удалось загрузить согласования.");
      return;
    }
    const data = await res.json();
    setList(Array.isArray(data) ? data : data.results || []);
  }, [API_URL, authFetch]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!initialReportId) return;
    let cancelled = false;
    (async () => {
      const res = await authFetch(`${API_URL}/inspections/reports/${initialReportId}/`);
      onConsumedInitialReportId?.();
      if (!res.ok || cancelled) return;
      setSelected(await res.json());
    })();
    return () => {
      cancelled = true;
    };
  }, [initialReportId, API_URL, authFetch, onConsumedInitialReportId]);

  if (selected) {
    return (
      <section className="card full-width">
        <InspectionApproveView
          mode="cabinet"
          reportId={selected.id}
          authFetch={authFetch}
          initialReport={selected}
          onApproved={(r) => {
            setSelected(r);
            load();
          }}
          onBackToChats={onBackToChats}
          onOpenPhotos={onOpenPhotos}
        />
        <button type="button" className="ghost-btn" style={{ marginTop: 12 }} onClick={() => setSelected(null)}>
          ← К списку согласований
        </button>
      </section>
    );
  }

  return (
      <section className={embedded ? "booking-history-inspections" : "card full-width"}>
      <div className="inspection-workspace-head">
        {embedded ? null : (
        <div>
          <h2>Диагностика и ремонт</h2>
          <p className="muted small">
            Согласуйте работы по авто и следите за статусом: в работе / готов.
          </p>
        </div>
        )}
        {onBackToChats && !embedded ? (
          <button type="button" className="ghost-btn" onClick={onBackToChats}>
            ← В чаты
          </button>
        ) : null}
      </div>
      <p className="status">{status}</p>
      {list.length === 0 ? (
        <p className="muted">Пока нет отчётов на согласование.</p>
      ) : (
        <ul className="inspection-list">
          {list.map((r) => {
            const repair =
              r.status === "approved" && r.repair_status && r.repair_status !== "none"
                ? REPAIR_STATUS_LABELS[r.repair_status] || r.repair_status
                : "";
            return (
              <li key={r.id}>
                <button type="button" className="inspection-list-item" onClick={() => setSelected(r)}>
                  <strong>
                    {r.organization_name || "Автосервис"} · {r.vehicle_title || r.vehicle_plate || `Отчёт #${r.id}`}
                  </strong>
                  <span className="muted small">
                    {STATUS_LABELS[r.status] || r.status}
                    {repair ? ` · ${repair}` : ""}
                    {r.booking ? " · по записи" : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
