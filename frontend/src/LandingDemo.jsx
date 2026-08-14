import { useEffect, useState } from "react";

const SPHERES = [
  {
    id: "hair_salon",
    emoji: "💇",
    title: "Салон красоты",
    text: "Мастера, услуги, календарь записей и отзывы — как у студии маникюра и парикмахерской.",
  },
  {
    id: "service_center",
    emoji: "🔧",
    title: "Автосервис",
    text: "Приёмка, механики, слоты диагностики и записи клиентов.",
  },
  {
    id: "cafe_restaurant",
    emoji: "🍽️",
    title: "Кафе",
    text: "Зал со столами, PIN, меню и заказы — кабинет ресторана.",
  },
];

export default function LandingDemo({ open, onClose, onRegister, onStartDemo }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  async function pick(sphere) {
    if (!onStartDemo) return;
    setError("");
    setBusy(sphere);
    try {
      await onStartDemo(sphere);
      onClose();
    } catch (err) {
      setError(err?.message || "Не удалось открыть демо.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="landing-demo-overlay" role="presentation" onClick={onClose}>
      <div
        className="landing-demo-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="landing-demo-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="landing-demo-modal-head">
          <div>
            <h2 id="landing-demo-title">Живое демо кабинета</h2>
            <p>
              Выберите сферу и войдите в общий рабочий аккаунт: сотрудники, услуги и записи уже
              заведены. Можно создавать своё. При выходе из демо ваши новые данные удалятся —
              останется исходный набор.
            </p>
          </div>
          <button type="button" className="landing-demo-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="landing-demo-spheres">
          {SPHERES.map((s) => (
            <button
              key={s.id}
              type="button"
              className="landing-demo-sphere"
              disabled={Boolean(busy)}
              onClick={() => pick(s.id)}
            >
              <span className="landing-demo-sphere-emoji" aria-hidden="true">
                {s.emoji}
              </span>
              <strong>{s.title}</strong>
              <span>{s.text}</span>
              <em>{busy === s.id ? "Открываем…" : "Войти в кабинет"}</em>
            </button>
          ))}
        </div>
        {error ? <p className="landing-form-status">{error}</p> : null}
        <p className="landing-demo-caption">
          Это общий демо-аккаунт, не ваша организация. Для своего бизнеса{" "}
          <button type="button" className="landing-link-btn" onClick={onRegister}>
            зарегистрируйтесь
          </button>
          .
        </p>
      </div>
    </div>
  );
}
