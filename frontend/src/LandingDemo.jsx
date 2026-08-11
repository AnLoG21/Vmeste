import { useEffect, useState } from "react";

const DEMO_TABS = [
  { id: "client", label: "Глазами клиента" },
  { id: "admin", label: "Календарь записей" },
  { id: "analytics", label: "Аналитика" },
];

function DemoClient() {
  return (
    <div className="landing-demo-panel">
      <div className="landing-demo-phone" role="img" aria-label="Демо: профиль мастера маникюра">
        <div className="landing-demo-phone-bar">Студия «Линия» · маникюр</div>
        <div className="landing-demo-phone-body">
          <p className="landing-demo-rating">★ 4.9 · 128 отзывов · рядом с вами</p>
          <h4>Анна · мастер маникюра</h4>
          <ul className="landing-demo-services">
            <li>
              <span>Классический маникюр</span>
              <strong>1 500 ₽</strong>
            </li>
            <li>
              <span>Покрытие гель-лак</span>
              <strong>2 200 ₽</strong>
            </li>
            <li>
              <span>Укрепление</span>
              <strong>800 ₽</strong>
            </li>
          </ul>
          <div className="landing-demo-slots">
            <button type="button" className="landing-demo-slot">Сегодня 14:00</button>
            <button type="button" className="landing-demo-slot landing-demo-slot--active">
              Сегодня 16:30
            </button>
            <button type="button" className="landing-demo-slot">Завтра 11:00</button>
          </div>
          <div className="landing-demo-cta-bar">Записаться · 16:30</div>
        </div>
      </div>
      <p className="landing-demo-caption">
        Клиент видит услуги, свободные слоты и записывается без звонка — с карты или по вашей ссылке.
      </p>
    </div>
  );
}

function DemoAdmin() {
  const rows = [
    { time: "10:00", name: "Мария К.", service: "Стрижка", status: "подтверждена" },
    { time: "11:30", name: "Игорь П.", service: "Диагностика", status: "ожидает" },
    { time: "14:00", name: "Елена С.", service: "Маникюр", status: "подтверждена" },
    { time: "16:30", name: "— свободно —", service: "", status: "free" },
  ];
  return (
    <div className="landing-demo-panel">
      <div className="landing-demo-admin" role="img" aria-label="Демо: календарь записей администратора">
        <div className="landing-demo-admin-head">
          <strong>Записи · сегодня</strong>
          <span>3 мастера</span>
        </div>
        <ul className="landing-demo-admin-list">
          {rows.map((r) => (
            <li key={r.time} className={r.status === "free" ? "is-free" : ""}>
              <span className="landing-demo-admin-time">{r.time}</span>
              <span className="landing-demo-admin-main">
                <strong>{r.name}</strong>
                {r.service ? <em>{r.service}</em> : null}
              </span>
              {r.status !== "free" ? (
                <span className={`landing-demo-badge landing-demo-badge--${r.status === "ожидает" ? "wait" : "ok"}`}>
                  {r.status}
                </span>
              ) : (
                <span className="landing-demo-badge landing-demo-badge--free">свободно</span>
              )}
            </li>
          ))}
        </ul>
      </div>
      <p className="landing-demo-caption">
        В кабинете — календарь интервалов, подтверждение и отмена записей, сотрудники со своими графиками.
      </p>
    </div>
  );
}

function DemoAnalytics() {
  return (
    <div className="landing-demo-panel">
      <div className="landing-demo-analytics" role="img" aria-label="Демо: аналитика выручки">
        <div className="landing-demo-analytics-head">
          <strong>Выручка за 7 дней</strong>
          <span>124 800 ₽</span>
        </div>
        <div className="landing-demo-bars" aria-hidden="true">
          {[40, 55, 48, 70, 62, 85, 78].map((h, i) => (
            <div key={i} className="landing-demo-bar" style={{ height: `${h}%` }} />
          ))}
        </div>
        <ul className="landing-demo-metrics">
          <li>
            <span>Популярная услуга</span>
            <strong>Гель-лак</strong>
          </li>
          <li>
            <span>Записей</span>
            <strong>47</strong>
          </li>
          <li>
            <span>Средний чек</span>
            <strong>2 655 ₽</strong>
          </li>
        </ul>
      </div>
      <p className="landing-demo-caption">
        Дашборд руководителя: выручка, популярные услуги и динамика записей — уже в разделе «Аналитика».
      </p>
    </div>
  );
}

export default function LandingDemo({ open, onClose, onRegister }) {
  const [tab, setTab] = useState("client");

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
            <h2 id="landing-demo-title">Интерактивное демо</h2>
            <p>Посмотрите, как выглядит Вместе для клиента и для бизнеса — без регистрации.</p>
          </div>
          <button type="button" className="landing-demo-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="landing-demo-tabs" role="tablist" aria-label="Сценарии демо">
          {DEMO_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`landing-demo-tab${tab === t.id ? " is-active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="landing-demo-body" role="tabpanel">
          {tab === "client" && <DemoClient />}
          {tab === "admin" && <DemoAdmin />}
          {tab === "analytics" && <DemoAnalytics />}
        </div>
        <div className="landing-demo-modal-actions">
          <button type="button" className="landing-btn landing-btn--primary" onClick={onRegister}>
            Попробовать бесплатно
          </button>
          <button type="button" className="landing-btn landing-btn--outline" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
