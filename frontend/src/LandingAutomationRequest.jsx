import { useState } from "react";
import { API_URL } from "./config.js";
import { SITE_LEGAL } from "./legal/siteLegal.js";
import { phoneFieldProps } from "./phone.js";

const EMPTY = {
  name: "",
  email: "",
  phone: "+7",
  telegram: "",
  message: "",
  accept_privacy: false,
};

/** Shared «заявка на индивидуальную автоматизацию» form for landing pages. */
export default function LandingAutomationRequest({
  id = "automation-request",
  title = "Оставить заявку на автоматизацию",
  lead = "Укажите email — он обязателен, чтобы мы могли ответить. Телефон и Telegram — по желанию.",
  className = "landing-section landing-request",
}) {
  const [form, setForm] = useState({ ...EMPTY });
  const [formStatus, setFormStatus] = useState("");

  async function submitRequest(e) {
    e.preventDefault();
    if (!form.accept_privacy) {
      setFormStatus("Нужно согласие на обработку персональных данных.");
      return;
    }
    setFormStatus("Отправляем...");
    const response = await fetch(`${API_URL}/users/automation-request/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        privacy_version: SITE_LEGAL.privacyVersion,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err =
        data.detail ||
        data.accept_privacy?.[0] ||
        (typeof data === "object" && Object.values(data).flat?.()[0]) ||
        "Не удалось отправить заявку.";
      setFormStatus(typeof err === "string" ? err : "Не удалось отправить заявку.");
      return;
    }
    setFormStatus(data.detail || "Заявка отправлена!");
    setForm({ ...EMPTY });
  }

  return (
    <section className={className} id={id}>
      <h2>{title}</h2>
      <p className="landing-section-lead">{lead}</p>
      <form className="landing-request-form" onSubmit={submitRequest}>
        <input
          placeholder="Ваше имя *"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <input
          type="email"
          placeholder="Email *"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <input placeholder="Телефон" {...phoneFieldProps(form.phone, (phone) => setForm({ ...form, phone }))} />
        <input
          placeholder="Telegram (@username)"
          value={form.telegram}
          onChange={(e) => setForm({ ...form, telegram: e.target.value })}
        />
        <textarea
          placeholder="Кратко опишите задачу"
          rows={4}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
        />
        <label className="landing-consent-item">
          <input
            type="checkbox"
            checked={form.accept_privacy}
            onChange={(e) => setForm({ ...form, accept_privacy: e.target.checked })}
          />
          <span>
            Согласен(на) на обработку персональных данных по{" "}
            <a href="/privacy" target="_blank" rel="noreferrer">
              политике
            </a>{" "}
            (версия {SITE_LEGAL.privacyVersion}).
          </span>
        </label>
        <button type="submit" className="landing-btn landing-btn--primary">
          Отправить заявку
        </button>
        {formStatus ? <p className="landing-form-status">{formStatus}</p> : null}
      </form>
    </section>
  );
}

/** Scroll to hash target with sticky-header offset (mobile-safe). */
export function scrollLandingHash(hash, { behavior = "smooth" } = {}) {
  const id = String(hash || "").replace(/^#/, "");
  if (!id) return false;
  const el = document.getElementById(id);
  if (!el) return false;
  const top = el.getBoundingClientRect().top + window.scrollY - 88;
  window.scrollTo({ top: Math.max(0, top), behavior });
  return true;
}
