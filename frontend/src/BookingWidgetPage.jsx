import { useEffect, useMemo, useState } from "react";
import { API_URL } from "./config.js";
import MiniDatePicker from "./MiniDatePicker.jsx";
import "./bookingWidget.css";
import "./styles.css";

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatHm(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function staffLabel(link) {
  const u = link?.staff_user || {};
  const dn = (link?.display_name || "").trim();
  if (dn) return dn;
  const fn = (u.first_name || "").trim();
  const ln = (u.last_name || "").trim();
  if (fn && ln) return `${fn} ${ln[0]}.`;
  return fn || ln || link?.staff_username || "Мастер";
}

function windowKey(w) {
  return `${w.starts_at}|${w.ends_at}|${w.staff_id ?? ""}`;
}

export default function BookingWidgetPage({ slug }) {
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState("");
  const [staffId, setStaffId] = useState("any");
  const [serviceId, setServiceId] = useState("");
  const [optionIds, setOptionIds] = useState([]);
  const [bookDate, setBookDate] = useState(todayIso());
  const [availableDates, setAvailableDates] = useState([]);
  const [windows, setWindows] = useState([]);
  const [windowSel, setWindowSel] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState("");
  const [done, setDone] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/booking/public/${encodeURIComponent(slug)}/`);
        if (!res.ok) throw new Error("not found");
        const data = await res.json();
        if (!cancelled) {
          setCatalog(data);
          document.title = `Запись · ${data.organization_name || "Вместе"}`;
        }
      } catch {
        if (!cancelled) setError("Организация не найдена.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const services = useMemo(() => {
    const list = catalog?.services || [];
    if (staffId === "any") return list;
    const link = (catalog?.staff || []).find((s) => String(s.staff) === String(staffId));
    if (!link) return list;
    const svcIds = (link.assigned_service_ids || []).map(Number);
    const catIds = (link.assigned_category_ids || []).map(Number);
    if (!svcIds.length && !catIds.length) return list;
    return list.filter(
      (s) => svcIds.includes(Number(s.id)) || (s.category && catIds.includes(Number(s.category))),
    );
  }, [catalog, staffId]);

  const selectedService = services.find((s) => String(s.id) === String(serviceId));
  const extraMinutes = (selectedService?.options || [])
    .filter((o) => optionIds.map(Number).includes(Number(o.id)))
    .reduce((sum, o) => sum + (Number(o.extra_minutes) || 0), 0);

  useEffect(() => {
    if (!serviceId || !slug) {
      setAvailableDates([]);
      return undefined;
    }
    let cancelled = false;
    const from = todayIso();
    const toDate = new Date();
    toDate.setDate(toDate.getDate() + 60);
    const to = `${toDate.getFullYear()}-${String(toDate.getMonth() + 1).padStart(2, "0")}-${String(toDate.getDate()).padStart(2, "0")}`;
    const staffQ = staffId !== "any" ? `&staff=${encodeURIComponent(staffId)}` : "";
    (async () => {
      const res = await fetch(
        `${API_URL}/booking/public/${encodeURIComponent(slug)}/dates/?service=${encodeURIComponent(serviceId)}&from=${from}&to=${to}&extra_minutes=${extraMinutes}${staffQ}`,
      );
      if (cancelled || !res.ok) return;
      const data = await res.json();
      const dates = Array.isArray(data?.dates) ? data.dates.map(String) : [];
      setAvailableDates(dates);
      if (dates.length && !dates.includes(bookDate)) {
        setBookDate(dates[0]);
        setWindowSel("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, serviceId, staffId, extraMinutes]);

  useEffect(() => {
    if (!serviceId || !bookDate || !slug) {
      setWindows([]);
      return undefined;
    }
    let cancelled = false;
    const staffQ = staffId !== "any" ? `&staff=${encodeURIComponent(staffId)}` : "";
    (async () => {
      const res = await fetch(
        `${API_URL}/booking/public/${encodeURIComponent(slug)}/windows/?service=${encodeURIComponent(serviceId)}&date=${encodeURIComponent(bookDate)}&extra_minutes=${extraMinutes}${staffQ}`,
      );
      if (cancelled) return;
      if (!res.ok) {
        setWindows([]);
        return;
      }
      const data = await res.json();
      const now = Date.now();
      setWindows(
        (Array.isArray(data) ? data : []).filter((w) => {
          const t = new Date(w.starts_at).getTime();
          return Number.isFinite(t) && t > now;
        }),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, serviceId, bookDate, staffId, extraMinutes]);

  async function submit(e) {
    e.preventDefault();
    const win = windows.find((w) => windowKey(w) === windowSel);
    if (!win) {
      setStatus("Выберите время.");
      return;
    }
    if (!guestPhone.trim()) {
      setStatus("Укажите телефон.");
      return;
    }
    setSubmitting(true);
    setStatus("");
    try {
      const res = await fetch(`${API_URL}/booking/public/${encodeURIComponent(slug)}/book/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: Number(serviceId),
          starts_at: win.starts_at,
          ends_at: win.ends_at,
          staff: win.staff_id ?? null,
          guest_name: guestName.trim(),
          guest_phone: guestPhone.trim(),
          comment: comment.trim(),
          option_ids: optionIds,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(data.detail || "Не удалось записаться.");
        return;
      }
      setDone(data);
    } catch {
      setStatus("Ошибка сети.");
    } finally {
      setSubmitting(false);
    }
  }

  if (error) {
    return (
      <main className="bw-page">
        <p className="bw-error">{error}</p>
      </main>
    );
  }

  if (!catalog) {
    return (
      <main className="bw-page">
        <p className="bw-muted">Загрузка…</p>
      </main>
    );
  }

  if (done) {
    return (
      <main className="bw-page">
        <div className="bw-card">
          <h1>Вы записаны</h1>
          <p>
            {done.organization_name}: {done.service}
          </p>
          <p className="bw-muted">
            {formatHm(done.starts_at)} — {formatHm(done.ends_at)}
          </p>
          <p>{done.message}</p>
        </div>
      </main>
    );
  }

  const staffList = catalog.staff || [];

  return (
    <main className="bw-page">
      <div className="bw-card">
        <header className="bw-head">
          <p className="bw-brand">Вместе</p>
          <h1>{catalog.organization_name}</h1>
          {catalog.address ? <p className="bw-muted">{catalog.address}</p> : null}
        </header>

        <form className="bw-form" onSubmit={submit}>
          <p className="bw-label">Мастер</p>
          <div className="bw-staff-row">
            <button
              type="button"
              className={`bw-staff-chip${staffId === "any" ? " is-on" : ""}`}
              onClick={() => {
                setStaffId("any");
                setServiceId("");
                setWindowSel("");
              }}
            >
              Любой
            </button>
            {staffList.map((link) => (
              <button
                key={link.id}
                type="button"
                className={`bw-staff-chip${String(staffId) === String(link.staff) ? " is-on" : ""}`}
                onClick={() => {
                  setStaffId(String(link.staff));
                  setServiceId("");
                  setOptionIds([]);
                  setWindowSel("");
                }}
              >
                {staffLabel(link)}
                {link.job_title ? <span className="bw-staff-job">{link.job_title}</span> : null}
              </button>
            ))}
          </div>

          <label className="bw-label" htmlFor="bw-service">
            Услуга
          </label>
          <select
            id="bw-service"
            value={serviceId}
            required
            onChange={(e) => {
              setServiceId(e.target.value);
              setOptionIds([]);
              setWindowSel("");
            }}
          >
            <option value="">Выберите услугу</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {Number(s.price).toLocaleString("ru-RU")} ₽
              </option>
            ))}
          </select>

          {selectedService?.options?.filter((o) => o.is_active !== false).length > 0 ? (
            <div className="bw-options">
              {(selectedService.options || [])
                .filter((o) => o.is_active !== false)
                .map((o) => {
                  const on = optionIds.map(Number).includes(Number(o.id));
                  return (
                    <button
                      key={o.id}
                      type="button"
                      className={`bw-opt${on ? " is-on" : ""}`}
                      onClick={() =>
                        setOptionIds((cur) => {
                          const id = Number(o.id);
                          const nums = cur.map(Number);
                          return on ? nums.filter((x) => x !== id) : [...nums, id];
                        })
                      }
                    >
                      {o.name}
                      {Number(o.price) > 0 ? ` · +${Number(o.price).toLocaleString("ru-RU")} ₽` : ""}
                    </button>
                  );
                })}
            </div>
          ) : null}

          <MiniDatePicker
            id="bw-date"
            label="Дата"
            value={bookDate}
            alwaysOpen
            availableDates={serviceId ? availableDates : null}
            onChange={(iso) => {
              setBookDate(iso);
              setWindowSel("");
            }}
          />
          {serviceId && availableDates.length === 0 ? (
            <p className="bw-muted small">Нет свободных дат на ближайшие недели.</p>
          ) : null}

          {serviceId && bookDate ? (
            <>
              <p className="bw-label">Время</p>
              {windows.length === 0 ? (
                <p className="bw-muted small">Нет свободных слотов на эту дату.</p>
              ) : (
                <div className="bw-slots">
                  {windows.map((w) => {
                    const key = windowKey(w);
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`bw-slot${windowSel === key ? " is-on" : ""}`}
                        onClick={() => setWindowSel(key)}
                      >
                        <span>{formatHm(w.starts_at)}</span>
                        {staffId === "any" && w.staff_label ? (
                          <span className="bw-slot-master">{w.staff_label}</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : null}

          <label className="bw-label" htmlFor="bw-name">
            Имя
          </label>
          <input id="bw-name" value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Как к вам обращаться" />

          <label className="bw-label" htmlFor="bw-phone">
            Телефон
          </label>
          <input
            id="bw-phone"
            value={guestPhone}
            onChange={(e) => setGuestPhone(e.target.value)}
            placeholder="+7 …"
            required
          />

          <label className="bw-label" htmlFor="bw-comment">
            Комментарий
          </label>
          <input id="bw-comment" value={comment} onChange={(e) => setComment(e.target.value)} />

          <button type="submit" className="bw-submit" disabled={!windowSel || submitting}>
            {submitting ? "Отправка…" : "Записаться"}
          </button>
          {status ? <p className="bw-status">{status}</p> : null}
        </form>
      </div>
    </main>
  );
}
