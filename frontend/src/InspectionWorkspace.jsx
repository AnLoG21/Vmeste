import { useCallback, useEffect, useMemo, useState } from "react";
import { InspectionItemBlock, InspectionPhotoLightbox, money } from "./InspectionApproveView.jsx";

const SEVERITY_OPTIONS = [
  { value: "critical", label: "Критично" },
  { value: "recommended", label: "Рекомендуется" },
  { value: "ok", label: "В порядке" },
];

const STATUS_LABELS = {
  draft: "Черновик",
  sent: "Ожидает клиента",
  approved: "Утверждён",
  cancelled: "Отменён",
};

function emptyItemForm() {
  return {
    title: "",
    description: "",
    severity: "recommended",
    parts_price: "0",
    labor_price: "0",
  };
}

/**
 * Org/staff workspace for interactive vehicle intake reports.
 */
export default function InspectionWorkspace({
  authFetch,
  API_URL,
  me,
  bookings = [],
  initialReportId = null,
  onConsumedInitialReportId,
  onOpenPhotos,
}) {
  const [list, setList] = useState([]);
  const [status, setStatus] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [report, setReport] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    client: "",
    booking: "",
    vehicle_title: "",
    vehicle_plate: "",
    vehicle_vin: "",
    notes: "",
  });
  const [itemForm, setItemForm] = useState(emptyItemForm());
  const [busy, setBusy] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  function openItemPhotos(photos, startIndex = 0) {
    const items = (photos || []).map((ph, i) => ({ id: ph.id || i, url: ph.url }));
    if (!items.length) return;
    if (onOpenPhotos) {
      onOpenPhotos(items, startIndex);
      return;
    }
    setLightbox({ items, index: startIndex });
  }

  const clientOptions = useMemo(() => {
    const map = new Map();
    for (const b of bookings || []) {
      if (!b?.client || b.is_manual_hold) continue;
      const id = String(b.client);
      if (map.has(id)) continue;
      map.set(id, {
        id,
        label: b.client_display_name || b.client_username || `Клиент #${id}`,
      });
    }
    return [...map.values()];
  }, [bookings]);

  const bookingOptions = useMemo(() => {
    if (!createForm.client) return [];
    return (bookings || [])
      .filter((b) => String(b.client) === String(createForm.client) && !b.is_manual_hold)
      .map((b) => ({
        id: String(b.id),
        label: `${b.service_name || "Услуга"} · ${b.slot_starts_at ? new Date(b.slot_starts_at).toLocaleString("ru-RU") : `#${b.id}`}`,
      }));
  }, [bookings, createForm.client]);

  const loadList = useCallback(async () => {
    const res = await authFetch(`${API_URL}/inspections/reports/`);
    if (!res.ok) return;
    const data = await res.json();
    const rows = Array.isArray(data) ? data : data.results || [];
    setList(rows);
  }, [API_URL, authFetch]);

  const loadReport = useCallback(
    async (id) => {
      if (!id) {
        setReport(null);
        return;
      }
      const res = await authFetch(`${API_URL}/inspections/reports/${id}/`);
      if (!res.ok) {
        setStatus("Не удалось загрузить отчёт.");
        return;
      }
      setReport(await res.json());
    },
    [API_URL, authFetch],
  );

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (selectedId) loadReport(selectedId);
    else setReport(null);
  }, [selectedId, loadReport]);

  useEffect(() => {
    if (!initialReportId) return;
    setSelectedId(Number(initialReportId));
    onConsumedInitialReportId?.();
  }, [initialReportId, onConsumedInitialReportId]);

  async function createReport(e) {
    e.preventDefault();
    if (!createForm.client) {
      setStatus("Выберите клиента.");
      return;
    }
    setBusy(true);
    setStatus("");
    const body = {
      client: Number(createForm.client),
      vehicle_title: createForm.vehicle_title,
      vehicle_plate: createForm.vehicle_plate,
      vehicle_vin: createForm.vehicle_vin,
      notes: createForm.notes,
    };
    if (createForm.booking) body.booking = Number(createForm.booking);
    const res = await authFetch(`${API_URL}/inspections/reports/`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setStatus(err.detail || err.client?.[0] || "Не удалось создать отчёт.");
      return;
    }
    const created = await res.json();
    setCreating(false);
    setCreateForm({
      client: "",
      booking: "",
      vehicle_title: "",
      vehicle_plate: "",
      vehicle_vin: "",
      notes: "",
    });
    await loadList();
    setSelectedId(created.id);
    setStatus("Черновик создан.");
  }

  async function saveHeader(e) {
    e.preventDefault();
    if (!report || report.status !== "draft") return;
    setBusy(true);
    const res = await authFetch(`${API_URL}/inspections/reports/${report.id}/`, {
      method: "PATCH",
      body: JSON.stringify({
        vehicle_title: report.vehicle_title,
        vehicle_plate: report.vehicle_plate,
        vehicle_vin: report.vehicle_vin,
        notes: report.notes,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setStatus("Не удалось сохранить.");
      return;
    }
    setReport(await res.json());
    setStatus("Сохранено.");
    loadList();
  }

  async function addItem(e) {
    e.preventDefault();
    if (!report || report.status !== "draft") return;
    if (!(itemForm.title || "").trim()) {
      setStatus("Укажите название пункта.");
      return;
    }
    setBusy(true);
    const res = await authFetch(`${API_URL}/inspections/reports/${report.id}/items/`, {
      method: "POST",
      body: JSON.stringify({
        title: itemForm.title.trim(),
        description: itemForm.description,
        severity: itemForm.severity,
        parts_price: itemForm.parts_price || 0,
        labor_price: itemForm.labor_price || 0,
        sort_order: (report.items || []).length,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setStatus(err.detail || "Не удалось добавить пункт.");
      return;
    }
    setItemForm(emptyItemForm());
    await loadReport(report.id);
    setStatus("Пункт добавлен.");
  }

  async function removeItem(itemId) {
    if (!report || report.status !== "draft") return;
    setBusy(true);
    const res = await authFetch(`${API_URL}/inspections/items/${itemId}/`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setStatus("Не удалось удалить.");
      return;
    }
    await loadReport(report.id);
  }

  async function uploadPhoto(itemId, file) {
    if (!file || !report || report.status !== "draft") return;
    const fd = new FormData();
    fd.append("image", file);
    setBusy(true);
    const res = await authFetch(`${API_URL}/inspections/items/${itemId}/photos/`, {
      method: "POST",
      body: fd,
    });
    setBusy(false);
    if (!res.ok) {
      setStatus("Не удалось загрузить фото.");
      return;
    }
    await loadReport(report.id);
  }

  async function sendReport() {
    if (!report) return;
    setBusy(true);
    const res = await authFetch(`${API_URL}/inspections/reports/${report.id}/send/`, {
      method: "POST",
      body: "{}",
    });
    setBusy(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setStatus(err.detail || "Не удалось отправить.");
      return;
    }
    setReport(await res.json());
    setStatus("Отправлено клиенту.");
    loadList();
  }

  async function downloadPdf(kind) {
    if (!report) return;
    const path = kind === "agreement" ? `documents/agreement` : `documents/work-order`;
    const res = await authFetch(`${API_URL}/inspections/reports/${report.id}/${path}/`, {
      method: "GET",
      headers: { Accept: "application/pdf" },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setStatus(err.detail || "Документ пока недоступен.");
      return;
    }
    const blob = await res.blob();
    if (!blob || blob.size < 50) {
      setStatus("PDF пустой — попробуйте ещё раз.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${kind}-${report.id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus("Документ скачан.");
  }

  const isDraft = report?.status === "draft";

  return (
    <section className="card full-width inspection-workspace">
      <div className="inspection-workspace-head">
        <div>
          <h2>Интерактивная приёмка</h2>
          <p className="muted small">
            Составьте отчёт с фото дефектов, отправьте клиенту на согласование и скачайте акт / заказ-наряд.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCreating(true);
            setSelectedId(null);
          }}
        >
          Новый отчёт
        </button>
      </div>

      <p className="status">{status}</p>

      {creating && (
        <form className="form inspection-create-form" onSubmit={createReport}>
          <h3>Новый отчёт</h3>
          <label className="field-label">
            Клиент
            <select
              value={createForm.client}
              onChange={(e) => setCreateForm((p) => ({ ...p, client: e.target.value, booking: "" }))}
              required
            >
              <option value="">Выберите клиента из записей</option>
              {clientOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          {bookingOptions.length > 0 && (
            <label className="field-label">
              Запись (необязательно)
              <select
                value={createForm.booking}
                onChange={(e) => setCreateForm((p) => ({ ...p, booking: e.target.value }))}
              >
                <option value="">Без привязки</option>
                {bookingOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <input
            placeholder="Авто (марка, модель)"
            value={createForm.vehicle_title}
            onChange={(e) => setCreateForm((p) => ({ ...p, vehicle_title: e.target.value }))}
          />
          <div className="row-2">
            <input
              placeholder="Госномер"
              value={createForm.vehicle_plate}
              onChange={(e) => setCreateForm((p) => ({ ...p, vehicle_plate: e.target.value }))}
            />
            <input
              placeholder="VIN"
              value={createForm.vehicle_vin}
              onChange={(e) => setCreateForm((p) => ({ ...p, vehicle_vin: e.target.value }))}
            />
          </div>
          <textarea
            placeholder="Заметки мастера"
            value={createForm.notes}
            onChange={(e) => setCreateForm((p) => ({ ...p, notes: e.target.value }))}
            rows={2}
          />
          <div className="row-2">
            <button type="submit" disabled={busy}>
              Создать черновик
            </button>
            <button type="button" className="ghost-btn" onClick={() => setCreating(false)}>
              Отмена
            </button>
          </div>
        </form>
      )}

      <div className="inspection-layout">
        <aside className="inspection-list">
          <h3>Отчёты</h3>
          {list.length === 0 ? (
            <p className="muted small">Пока нет отчётов.</p>
          ) : (
            <ul>
              {list.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className={["inspection-list-item", selectedId === r.id && "is-active"].filter(Boolean).join(" ")}
                    onClick={() => {
                      setCreating(false);
                      setSelectedId(r.id);
                    }}
                  >
                    <strong>
                      #{r.id} · {r.vehicle_title || r.vehicle_plate || "Авто"}
                    </strong>
                    <span className="muted small">
                      {r.client_display_name || "Клиент"} · {STATUS_LABELS[r.status] || r.status}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="inspection-detail">
          {!report ? (
            <p className="muted">Выберите отчёт или создайте новый.</p>
          ) : (
            <>
              <div className="inspection-detail-top">
                <h3>
                  Отчёт #{report.id}{" "}
                  <span className={`inspection-badge inspection-badge--${report.status}`}>
                    {STATUS_LABELS[report.status] || report.status}
                  </span>
                </h3>
                {report.public_url && report.status !== "draft" && (
                  <p className="muted small">
                    Ссылка клиенту:{" "}
                    <a href={report.public_url} target="_blank" rel="noreferrer">
                      {report.public_url}
                    </a>
                  </p>
                )}
              </div>

              <form className="form" onSubmit={saveHeader}>
                <input
                  placeholder="Авто"
                  disabled={!isDraft}
                  value={report.vehicle_title || ""}
                  onChange={(e) => setReport((p) => ({ ...p, vehicle_title: e.target.value }))}
                />
                <div className="row-2">
                  <input
                    placeholder="Госномер"
                    disabled={!isDraft}
                    value={report.vehicle_plate || ""}
                    onChange={(e) => setReport((p) => ({ ...p, vehicle_plate: e.target.value }))}
                  />
                  <input
                    placeholder="VIN"
                    disabled={!isDraft}
                    value={report.vehicle_vin || ""}
                    onChange={(e) => setReport((p) => ({ ...p, vehicle_vin: e.target.value }))}
                  />
                </div>
                <textarea
                  placeholder="Заметки"
                  disabled={!isDraft}
                  rows={2}
                  value={report.notes || ""}
                  onChange={(e) => setReport((p) => ({ ...p, notes: e.target.value }))}
                />
                {isDraft && (
                  <button type="submit" disabled={busy}>
                    Сохранить данные авто
                  </button>
                )}
              </form>

              <h4>Пункты диагностики</h4>
              <ul className="inspection-items">
                {(report.items || []).map((it) => (
                  <li key={it.id} className={`inspection-item inspection-item--${it.severity}`}>
                    <div className="inspection-item-main">
                      <InspectionItemBlock
                        it={it}
                        severityLabel={SEVERITY_OPTIONS.find((s) => s.value === it.severity)?.label || it.severity}
                        showPrices={it.severity !== "ok"}
                      />
                      <div className="inspection-photos">
                        {(it.photos || []).map((ph, idx) => (
                          <button
                            key={ph.id}
                            type="button"
                            className="inspection-photo-btn"
                            onClick={() => openItemPhotos(it.photos, idx)}
                          >
                            <img src={ph.url} alt="" />
                          </button>
                        ))}
                      </div>
                      {isDraft && (
                        <div className="row-2 inspection-item-actions">
                          <label className="ghost-btn small">
                            Фото
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              hidden
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) uploadPhoto(it.id, f);
                                e.target.value = "";
                              }}
                            />
                          </label>
                          <button type="button" className="ghost-btn small" onClick={() => removeItem(it.id)}>
                            Удалить
                          </button>
                        </div>
                      )}
                      {!isDraft && it.selectable && (
                        <p className="muted small">
                          {it.client_selected ? "Клиент утвердил" : "Клиент не выбрал"}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {isDraft && (
                <form className="form inspection-add-item" onSubmit={addItem}>
                  <h4>Добавить пункт</h4>
                  <input
                    placeholder="Название (например, тормозные колодки)"
                    value={itemForm.title}
                    onChange={(e) => setItemForm((p) => ({ ...p, title: e.target.value }))}
                    required
                  />
                  <select
                    value={itemForm.severity}
                    onChange={(e) => setItemForm((p) => ({ ...p, severity: e.target.value }))}
                  >
                    {SEVERITY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <textarea
                    placeholder="Описание / комментарий"
                    rows={2}
                    value={itemForm.description}
                    onChange={(e) => setItemForm((p) => ({ ...p, description: e.target.value }))}
                  />
                  {itemForm.severity !== "ok" && (
                    <div className="row-2">
                      <label className="field-label">
                        Запчасти, ₽
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={itemForm.parts_price}
                          onChange={(e) => setItemForm((p) => ({ ...p, parts_price: e.target.value }))}
                        />
                      </label>
                      <label className="field-label">
                        Работа, ₽
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={itemForm.labor_price}
                          onChange={(e) => setItemForm((p) => ({ ...p, labor_price: e.target.value }))}
                        />
                      </label>
                    </div>
                  )}
                  <button type="submit" disabled={busy}>
                    Добавить пункт
                  </button>
                </form>
              )}

              <div className="inspection-actions">
                {isDraft && (
                  <button type="button" disabled={busy || !(report.items || []).length} onClick={sendReport}>
                    Отправить клиенту
                  </button>
                )}
                {report.status === "approved" && (
                  <>
                    <p className="inspection-total">
                      Итого утверждено: <strong>{money(report.grand_total)}</strong>
                    </p>
                    <button type="button" className="ghost-btn" onClick={() => downloadPdf("agreement")}>
                      Акт согласования (PDF)
                    </button>
                    <button type="button" className="ghost-btn" onClick={() => downloadPdf("work-order")}>
                      Заказ-наряд (PDF)
                    </button>
                  </>
                )}
                {report.status === "sent" && (
                  <p className="muted">Ожидаем выбор клиента. Итог появится после утверждения.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
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
    </section>
  );
}
