import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { API_URL } from "./config.js";
import "./landing.css";

const SEVERITY_META = {
  critical: { label: "Критично", order: 0 },
  recommended: { label: "Рекомендуется", order: 1 },
  ok: { label: "В порядке", order: 2 },
};

export function money(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return "0 ₽";
  return `${n.toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₽`;
}

export function lineTotal(it) {
  return Number(it.parts_price || 0) + Number(it.labor_price || 0);
}

export function InspectionPhotoLightbox({ items, index, onClose, onStep }) {
  const touchX = useRef(0);
  useEffect(() => {
    if (!items?.length) return undefined;
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
      if (e.key === "ArrowLeft") onStep?.(-1);
      if (e.key === "ArrowRight") onStep?.(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, onClose, onStep]);

  if (!items?.length || typeof document === "undefined") return null;
  return createPortal(
    <div className="photo-lightbox-backdrop" onClick={onClose} role="presentation">
      {items.length > 1 ? (
        <>
          <button type="button" className="photo-lightbox-nav photo-lightbox-nav--prev" aria-label="Назад" onClick={(e) => { e.stopPropagation(); onStep?.(-1); }}>
            ‹
          </button>
          <button type="button" className="photo-lightbox-nav photo-lightbox-nav--next" aria-label="Далее" onClick={(e) => { e.stopPropagation(); onStep?.(1); }}>
            ›
          </button>
          <p className="photo-lightbox-counter">
            {index + 1} / {items.length}
          </p>
        </>
      ) : null}
      <div className="photo-lightbox-inner" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Просмотр фото">
        <button type="button" className="photo-lightbox-close" aria-label="Закрыть" onClick={onClose}>
          ×
        </button>
        <div
          className="photo-lightbox-viewport"
          onTouchStart={(e) => {
            touchX.current = e.touches?.[0]?.clientX ?? 0;
          }}
          onTouchEnd={(e) => {
            if (items.length < 2) return;
            const x = e.changedTouches?.[0]?.clientX ?? 0;
            const dx = x - touchX.current;
            if (Math.abs(dx) > 40) onStep?.(dx < 0 ? 1 : -1);
          }}
        >
          {items.map((item, i) => (
            <div
              key={item.id || i}
              className={["photo-lightbox-slide", i === index && "photo-lightbox-slide--active"].filter(Boolean).join(" ")}
            >
              <img className="photo-lightbox-img" src={item.url} alt="" />
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function InspectionItemBlock({ it, severityLabel, showPrices = true }) {
  return (
    <div className="inspection-item-lines">
      <div className="inspection-item-title">{it.title}</div>
      {severityLabel ? (
        <div className={`inspection-item-severity inspection-item-severity--${it.severity}`}>
          {severityLabel}
        </div>
      ) : null}
      {showPrices && it.severity !== "ok" ? (
        <div className="inspection-item-prices">
          <span>Запчасти: {money(it.parts_price)}</span>
          <span>Работа: {money(it.labor_price)}</span>
          <span className="inspection-item-line-total">Итого: {money(lineTotal(it))}</span>
        </div>
      ) : null}
      {it.description ? <p className="inspection-item-desc muted small">{it.description}</p> : null}
    </div>
  );
}

/**
 * Public / authenticated client approval UI for an inspection report.
 */
export default function InspectionApproveView({
  mode = "public",
  token,
  reportId,
  authFetch,
  initialReport = null,
  onApproved,
  onBackToChats,
  onOpenPhotos,
}) {
  const [report, setReport] = useState(initialReport);
  const [selected, setSelected] = useState(() => new Set());
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(!initialReport);
  const [busy, setBusy] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  function openPhotos(photos, startIndex = 0) {
    const items = (photos || []).map((ph, i) => ({ id: ph.id || i, url: ph.url }));
    if (!items.length) return;
    if (onOpenPhotos) {
      onOpenPhotos(items, startIndex);
      return;
    }
    setLightbox({ items, index: startIndex });
  }

  useEffect(() => {
    if (initialReport) {
      setReport(initialReport);
      if (initialReport.status === "approved") {
        setSelected(new Set((initialReport.items || []).filter((i) => i.client_selected).map((i) => i.id)));
      } else {
        setSelected(
          new Set((initialReport.items || []).filter((i) => i.selectable && i.severity === "critical").map((i) => i.id)),
        );
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
    setStatus(
      data.repair_status === "in_progress"
        ? "Ремонт утверждён. Статус: в работе."
        : "Ремонт утверждён. Автосервис получил уведомление.",
    );
    onApproved?.(data);
  }

  async function downloadPdf(kind) {
    if (!report || report.status !== "approved") return;
    setBusy(true);
    setStatus("");
    const path = kind === "agreement" ? "agreement" : "work-order";
    try {
      let res;
      if (mode === "public" && token) {
        res = await fetch(`${API_URL}/inspections/public/${token}/${path}-pdf/`, {
          headers: { Accept: "application/pdf,*/*" },
        });
      } else if (authFetch && report.id) {
        res = await authFetch(`${API_URL}/inspections/reports/${report.id}/${path}-pdf/`, {
          method: "GET",
          headers: { Accept: "application/pdf,*/*" },
        });
      } else {
        setStatus("Нет доступа к PDF.");
        return;
      }
      const ctype = (res.headers.get("content-type") || "").toLowerCase();
      if (!res.ok || ctype.includes("application/json")) {
        const err = await res.json().catch(() => ({}));
        setStatus(err.detail || `Не удалось скачать PDF (${res.status}).`);
        return;
      }
      const blob = await res.blob();
      if (!blob || blob.size < 40) {
        setStatus("PDF пустой — попробуйте ещё раз.");
        return;
      }
      const pdfBlob = blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" });
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${kind}-${report.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      setStatus("Документ скачан.");
    } catch {
      setStatus("Ошибка сети при скачивании PDF.");
    } finally {
      setBusy(false);
    }
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
        {onBackToChats ? (
          <button type="button" className="ghost-btn" onClick={onBackToChats}>
            ← В чаты
          </button>
        ) : null}
      </div>
    );
  }

  const readOnly = report.status !== "sent";

  return (
    <div className="inspection-approve">
      {onBackToChats ? (
        <button type="button" className="ghost-btn inspection-back-chats" onClick={onBackToChats}>
          ← В чаты
        </button>
      ) : null}
      <header className="inspection-approve-head">
        <p className="muted small">{report.organization_name || "Автосервис"}</p>
        <h1>Согласование работ</h1>
        <p className="inspection-approve-vehicle">
          {[report.vehicle_title, report.vehicle_plate, report.vehicle_vin ? `VIN ${report.vehicle_vin}` : ""]
            .filter(Boolean)
            .join(" · ") || "Автомобиль"}
        </p>
        {report.booking_summary ? (
          <p className="muted small">
            По записи
            {report.booking_summary.service_name ? `: ${report.booking_summary.service_name}` : ""}
          </p>
        ) : null}
        {report.status === "approved" && (
          <>
            <p className="inspection-badge inspection-badge--approved">Утверждено</p>
            {report.repair_status === "in_progress" ? (
              <p className="inspection-badge inspection-badge--repair-in_progress">В работе</p>
            ) : null}
            {report.repair_status === "ready" ? (
              <p className="inspection-badge inspection-badge--repair-ready">Готов</p>
            ) : null}
          </>
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
                        <InspectionItemBlock it={it} showPrices />
                      </label>
                    ) : (
                      <InspectionItemBlock it={it} showPrices={false} />
                    )}
                    {(it.photos || []).length > 0 && (
                      <div className="inspection-photos">
                        {it.photos.map((ph, idx) => (
                          <button
                            key={ph.id}
                            type="button"
                            className="inspection-photo-btn"
                            onClick={() => openPhotos(it.photos, idx)}
                          >
                            <img src={ph.thumb_url || ph.url} alt="" loading="lazy" decoding="async" />
                          </button>
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
          Итого к оплате: <strong>{money(liveTotal)}</strong>
        </p>
        {!readOnly && (
          <button type="button" disabled={busy} onClick={approve}>
            Утвердить ремонт
          </button>
        )}
        {report.status === "approved" && (
          <div className="inspection-actions" style={{ marginTop: 8 }}>
            <button type="button" className="ghost-btn" disabled={busy} onClick={() => downloadPdf("agreement")}>
              Акт согласования (PDF)
            </button>
            <button type="button" className="ghost-btn" disabled={busy} onClick={() => downloadPdf("work-order")}>
              Заказ-наряд (PDF)
            </button>
          </div>
        )}
        {onBackToChats ? (
          <button type="button" className="ghost-btn" onClick={onBackToChats}>
            Вернуться в чаты
          </button>
        ) : null}
        {status ? <p className="status">{status}</p> : null}
      </footer>

      {lightbox ? (
        <InspectionPhotoLightbox
          items={lightbox.items}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onStep={(delta) =>
            setLightbox((prev) => {
              if (!prev?.items?.length) return prev;
              const n = prev.items.length;
              return { ...prev, index: (prev.index + delta + n) % n };
            })
          }
        />
      ) : null}
    </div>
  );
}

/** Standalone public page wrapper for /i/:token */
export function InspectionPublicPage({ token }) {
  return (
    <div className="landing-shell inspection-public-page">
      <div className="landing-container" style={{ maxWidth: 720, padding: "24px 16px 48px" }}>
        <p className="muted small" style={{ marginBottom: 12 }}>
          Войдите в кабинет Вместе, чтобы обсудить работы в чате с сервисом.
        </p>
        <InspectionApproveView mode="public" token={token} />
        <p style={{ marginTop: 16 }}>
          <a className="landing-btn landing-btn--outline" href="/">
            На главную Вместе
          </a>
        </p>
      </div>
    </div>
  );
}
