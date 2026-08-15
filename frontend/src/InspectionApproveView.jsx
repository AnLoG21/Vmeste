import { useEffect, useMemo, useState } from "react";
import { API_URL } from "./config.js";
import "./landing.css";

const SEVERITY_META = {
  critical: { label: "Критично", order: 0 },
  recommended: { label: "Рекомендуется", order: 1 },
  ok: { label: "В порядке", order: 2 },
};

function money(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return "0 ₽";
  return `${n.toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₽`;
}

function lineTotal(it) {
  return Number(it.parts_price || 0) + Number(it.labor_price || 0);
}

/**
 * Public / authenticated client approval UI for an inspection report.
 * mode: "public" uses token; "cabinet" uses authFetch + report id.
 */
export default function InspectionApproveView({
  mode = "public",
  token,
  reportId,
  authFetch,
  initialReport = null,
  onApproved,
}) {
  const [report, setReport] = useState(initialReport);
  const [selected, setSelected] = useState(() => new Set());
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(!initialReport);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initialReport) {
      setReport(initialReport);
      const pre = new Set(
        (initialReport.items || [])
          .filter((i) => i.client_selected || (i.selectable && i.severity === "critical"))
          .map((i) => i.id),
      );
      if (initialReport.status === "sent") {
        // Pre-check critical for convenience when opening fresh
        const crit = (initialReport.items || []).filter((i) => i.selectable && i.severity === "critical").map((i) => i.id);
        setSelected(new Set(crit));
      } else {
        setSelected(pre);
      }
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        let res;
        if (mode === "public" && token) {
          res = await fetch(`${API_URL}/inspections/public/${token}/`);
        } else if (authFetch && reportId) {
          res = await authFetch(`${API_URL}/inspections/reports/${reportId}/`);
        } else {
          setStatus("Отчёт не найден.");
          setLoading(false);
          return;
        }
        if (!res.ok) {
          if (!cancelled) setStatus("Отчёт не найден или ещё не отправлен.");
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setReport(data);
        if (data.status === "approved") {
          setSelected(new Set((data.items || []).filter((i) => i.client_selected).map((i) => i.id)));
        } else {
          setSelected(
            new Set((data.items || []).filter((i) => i.selectable && i.severity === "critical").map((i) => i.id)),
          );
        }
      } catch {
        if (!cancelled) setStatus("Ошибка загрузки.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, token, reportId, authFetch, initialReport]);

  const groups = useMemo(() => {
    const items = [...(report?.items || [])].sort(
      (a, b) => (SEVERITY_META[a.severity]?.order ?? 9) - (SEVERITY_META[b.severity]?.order ?? 9),
    );
    const map = { critical: [], recommended: [], ok: [] };
    for (const it of items) {
      (map[it.severity] || map.recommended).push(it);
    }
    return map;
  }, [report]);

  const liveTotal = useMemo(() => {
    if (!report) return 0;
    if (report.status === "approved") return Number(report.grand_total || 0);
    return (report.items || [])
      .filter((i) => i.selectable && selected.has(i.id))
      .reduce((s, i) => s + lineTotal(i), 0);
  }, [report, selected]);

  function toggle(id) {
    if (report?.status !== "sent") return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function approve() {
    if (!report || report.status !== "sent") return;
    setBusy(true);
    setStatus("");
    const body = JSON.stringify({ selected_item_ids: [...selected] });
    let res;
    if (mode === "public" && token) {
      res = await fetch(`${API_URL}/inspections/public/${token}/approve/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
    } else if (authFetch && report.id) {
      res = await authFetch(`${API_URL}/inspections/reports/${report.id}/approve/`, {
        method: "POST",
        body,
      });
    }
    setBusy(false);
    if (!res?.ok) {
      const err = await res?.json().catch(() => ({}));
      setStatus(err?.detail || "Не удалось утвердить.");
      return;
    }
    const data = await res.json();
    setReport(data);
    setSelected(new Set((data.items || []).filter((i) => i.client_selected).map((i) => i.id)));
    setStatus("Ремонт утверждён. Сервис получил уведомление.");
    onApproved?.(data);
  }

  if (loading) {
    return (
      <div className="inspection-approve">
        <p className="muted">Загрузка отчёта…</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="inspection-approve">
        <p className="status">{status || "Отчёт не найден."}</p>
      </div>
    );
  }

  const readOnly = report.status !== "sent";

  return (
    <div className="inspection-approve">
      <header className="inspection-approve-head">
        <p className="muted small">{report.organization_name || "Сервисный центр"}</p>
        <h1>Согласование работ</h1>
        <p className="inspection-approve-vehicle">
          {[report.vehicle_title, report.vehicle_plate].filter(Boolean).join(" · ") || "Автомобиль"}
        </p>
        {report.status === "approved" && (
          <p className="inspection-badge inspection-badge--approved">Утверждено</p>
        )}
      </header>

      {["critical", "recommended", "ok"].map((sev) => {
        const items = groups[sev] || [];
        if (!items.length) return null;
        return (
          <section key={sev} className={`inspection-approve-section inspection-approve-section--${sev}`}>
            <h2>{SEVERITY_META[sev].label}</h2>
            <ul>
              {items.map((it) => {
                const selectable = it.selectable;
                const checked = selected.has(it.id);
                return (
                  <li key={it.id} className="inspection-approve-item">
                    {selectable ? (
                      <label className="inspection-approve-check">
                        <input
                          type="checkbox"
                          disabled={readOnly}
                          checked={checked}
                          onChange={() => toggle(it.id)}
                        />
                        <span>
                          <strong>{it.title}</strong>
                          {it.description ? <span className="muted small">{it.description}</span> : null}
                          <span className="inspection-approve-price">{money(lineTotal(it))}</span>
                        </span>
                      </label>
                    ) : (
                      <div>
                        <strong>{it.title}</strong>
                        {it.description ? <p className="muted small">{it.description}</p> : null}
                      </div>
                    )}
                    {(it.photos || []).length > 0 && (
                      <div className="inspection-photos">
                        {it.photos.map((ph) => (
                          <a key={ph.id} href={ph.url} target="_blank" rel="noreferrer">
                            <img src={ph.url} alt="" />
                          </a>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <footer className="inspection-approve-footer">
        <p className="inspection-total">
          Итого: <strong>{money(liveTotal)}</strong>
        </p>
        {!readOnly && (
          <button type="button" disabled={busy} onClick={approve}>
            Утвердить ремонт
          </button>
        )}
        {status ? <p className="status">{status}</p> : null}
      </footer>
    </div>
  );
}

/** Standalone public page wrapper for /i/:token */
export function InspectionPublicPage({ token }) {
  return (
    <div className="landing-shell inspection-public-page">
      <div className="landing-container" style={{ maxWidth: 720, padding: "24px 16px 48px" }}>
        <InspectionApproveView mode="public" token={token} />
      </div>
    </div>
  );
}
