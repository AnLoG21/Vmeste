import { useCallback, useEffect, useState } from "react";
import InspectionApproveView from "./InspectionApproveView.jsx";

const STATUS_LABELS = {
  sent: "Нужно согласовать",
  approved: "Утверждено",
  cancelled: "Отменён",
};

export default function ClientInspectionsPanel({
  authFetch,
  API_URL,
  initialReportId = null,
  onConsumedInitialReportId,
  onBackToChats,
  onOpenPhotos,
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
    <section className="card full-width">
      <div className="inspection-workspace-head">
        <div>
          <h2>Согласование диагностики</h2>
          <p className="muted small">Отчёты сервисных центров: отметьте работы и утвердите ремонт.</p>
        </div>
        {onBackToChats ? (
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
          {list.map((r) => (
            <li key={r.id}>
              <button type="button" className="inspection-list-item" onClick={() => setSelected(r)}>
                <strong>
                  {r.organization_name || "Сервис"} · {r.vehicle_title || r.vehicle_plate || `Отчёт #${r.id}`}
                </strong>
                <span className="muted small">{STATUS_LABELS[r.status] || r.status}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
