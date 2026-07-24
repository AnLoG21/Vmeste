import { useEffect, useMemo, useRef, useState } from "react";
import "./landing.css";
import { SITE_LEGAL } from "./legal/siteLegal.js";
import { API_URL } from "./config.js";
import JsonLd from "./seo/JsonLd.jsx";
import {
  organizationJsonLd,
  softwareApplicationJsonLd,
  websiteJsonLd,
} from "./seo/schema.js";
import { phoneFieldProps } from "./phone.js";

function formatPlanPrice(price) {
  const value = Number(price);
  if (!value) return "По заявке";
  return `${value.toLocaleString("ru-RU")} ₽ / месяц`;
}

export default function LandingPage({ onLogin, onRegister }) {
  const requestRef = useRef(null);
  const pricingRef = useRef(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "+7", telegram: "", message: "" });
  const [formStatus, setFormStatus] = useState("");
  const [plans, setPlans] = useState([]);

  const homeJsonLd = useMemo(
    () => [organizationJsonLd(), websiteJsonLd(), softwareApplicationJsonLd()],
    []
  );

  useEffect(() => {
    fetch(`${API_URL}/subscriptions/plans/`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setPlans(Array.isArray(data) ? data : []))
      .catch(() => setPlans([]));
  }, []);

  useEffect(() => {
    if (window.location.hash === "#pricing") {
      pricingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (window.location.hash === "#request" || window.location.hash === "#automation-request") {
      requestRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  function scrollToRequest() {
    requestRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function scrollToPricing() {
    pricingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function submitRequest(e) {
    e.preventDefault();
    setFormStatus("Отправляем...");
    const response = await fetch(`${API_URL}/users/automation-request/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err =
        data.detail ||
        (typeof data === "object" && Object.values(data).flat?.()[0]) ||
        "Не удалось отправить заявку.";
      setFormStatus(typeof err === "string" ? err : "Не удалось отправить заявку.");
      return;
    }
    setFormStatus(data.detail || "Заявка отправлена!");
    setForm({ name: "", email: "", phone: "+7", telegram: "", message: "" });
  }

  return (
    <div className="landing">
      <JsonLd id="vmeste-home-jsonld" data={homeJsonLd} />
      <section className="landing-hero">
        <div className="landing-hero-content">
          <h1 className="landing-hero-title">
            Вместе — платформа для записи и автоматизации вашего бизнеса
          </h1>
          <p className="landing-hero-lead">
            Онлайн-запись клиентов, каталог услуг, чаты, карта организаций и управление командой —
            всё в одном сервисе. Подключайтесь за минуты или закажите индивидуальную автоматизацию
            под процессы вашей компании.
          </p>
          <div className="landing-hero-actions">
            <button type="button" className="landing-btn landing-btn--primary" onClick={onRegister}>
              Начать бесплатно
            </button>
            <button type="button" className="landing-btn landing-btn--outline" onClick={scrollToPricing}>
              Тарифы
            </button>
            <button type="button" className="landing-btn landing-btn--outline" onClick={scrollToRequest}>
              Заказать автоматизацию
            </button>
          </div>
        </div>
        <div className="landing-hero-visual" aria-hidden="true">
          <div className="landing-hero-card">
            <span className="landing-hero-card-icon">📅</span>
            <strong>Онлайн-запись</strong>
            <p>Клиенты записываются сами — вы управляете расписанием</p>
          </div>
          <div className="landing-hero-card">
            <span className="landing-hero-card-icon">💬</span>
            <strong>Чаты</strong>
            <p>Общение с клиентами прямо в платформе</p>
          </div>
          <div className="landing-hero-card">
            <span className="landing-hero-card-icon">🗺️</span>
            <strong>Карта</strong>
            <p>Клиенты находят вас на интерактивной карте</p>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <h2>Что такое Вместе?</h2>
        <p className="landing-section-lead">
          Вместе — это современная экосистема для сервисного бизнеса: салонов красоты, сервисных
          центров, студий и любых организаций, где важны запись, коммуникация и прозрачность.
        </p>
        <div className="landing-features">
          <article className="landing-feature">
            <h3>Для клиентов</h3>
            <ul>
              <li>Поиск организаций на карте по сфере и рейтингу</li>
              <li>Запись на удобное время без звонков</li>
              <li>Чат с исполнителем и история визитов</li>
              <li>Отзывы и оценки</li>
            </ul>
          </article>
          <article className="landing-feature">
            <h3>Для бизнеса</h3>
            <ul>
              <li>Каталог услуг и категорий</li>
              <li>Календарь интервалов и управление сотрудниками</li>
              <li>Подтверждение и отмена записей</li>
              <li>Галерея, контакты и график работы организации</li>
            </ul>
          </article>
          <article className="landing-feature landing-feature--accent">
            <h3>Подписка</h3>
            <p>
              После регистрации выберите тариф и оплачивайте подписку онлайн через ЮKassa.
              Продлевайте, управляйте автопродлением и следите за статусом в разделе «Подписки».
            </p>
          </article>
        </div>
      </section>

      <section className="landing-section landing-pricing" ref={pricingRef} id="pricing">
        <h2>Тарифы и цены</h2>
        <p className="landing-section-lead">
          Фиксированная стоимость подписки на доступ к платформе. Оплата онлайн через ЮKassa после
          регистрации в разделе «Подписки». Актуальные цены и описание услуг указаны ниже.
        </p>
        <div className="subscriptions-plans landing-pricing-grid">
          {plans.map((plan) => (
            <article key={plan.id} className="subscriptions-plan-card">
              <h3>{plan.name}</h3>
              <p className="subscriptions-plan-desc">{plan.description}</p>
              <p className="subscriptions-plan-price">{formatPlanPrice(plan.price_monthly)}</p>
              {Array.isArray(plan.features) && plan.features.length > 0 && (
                <ul className="subscriptions-plan-features">
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              )}
              {Number(plan.price_monthly) > 0 ? (
                <button type="button" className="landing-btn landing-btn--primary" onClick={onRegister}>
                  Выбрать тариф
                </button>
              ) : (
                <button type="button" className="landing-btn landing-btn--outline" onClick={scrollToRequest}>
                  Оставить заявку
                </button>
              )}
            </article>
          ))}
        </div>
        <p className="landing-note">
          Оплачивая подписку, вы принимаете условия{" "}
          <a href="/offer">публичной оферты</a>.
        </p>
      </section>

      <section className="landing-section landing-delivery">
        <h2>Получение услуги после оплаты</h2>
        <p className="landing-section-lead">
          Вместе — облачный онлайн-сервис (SaaS). Физическая доставка товаров не производится.
        </p>
        <ol className="landing-steps">
          <li>Зарегистрируйтесь на сайте и подтвердите email.</li>
          <li>Войдите в личный кабинет и откройте раздел «Подписки».</li>
          <li>Выберите тариф и оплатите через ЮKassa.</li>
          <li>
            После успешной оплаты доступ активируется автоматически в течение нескольких минут —
            статус подписки станет «Активна».
          </li>
        </ol>
      </section>

      <section className="landing-section landing-section--automation">
        <div className="landing-automation-text">
          <h2>Индивидуальная автоматизация</h2>
          <p>
            Нужно больше, чем стандартный функционал? Мы разработаем персональное решение под ваш
            бизнес: интеграции, нестандартные сценарии записи, отчёты, брендирование и обучение
            команды.
          </p>
          <ol className="landing-steps">
            <li>Оставьте заявку с контактами (email обязателен)</li>
            <li>Мы свяжемся с вами и обсудим задачи</li>
            <li>Реализуем автоматизацию и подключим к платформе</li>
            <li>Вы пользуетесь сервисом и оплачиваете подписку</li>
          </ol>
          <p className="landing-note">
            Для работы с подпиской и личным кабинетом{" "}
            <button type="button" className="landing-link-btn" onClick={onRegister}>
              зарегистрируйтесь
            </button>
            {" "}на платформе.
          </p>
        </div>
      </section>

      <section className="landing-section landing-request" ref={requestRef} id="automation-request">
        <h2>Оставить заявку на автоматизацию</h2>
        <p className="landing-section-lead">
          Укажите email — он обязателен, чтобы мы могли ответить. Телефон и Telegram — по желанию,
          заполните хотя бы один удобный способ связи.
        </p>
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
          <input
            placeholder="Телефон"
            {...phoneFieldProps(form.phone, (phone) => setForm({ ...form, phone }))}
          />
          <input
            placeholder="Telegram (@username)"
            value={form.telegram}
            onChange={(e) => setForm({ ...form, telegram: e.target.value })}
          />
          <textarea
            placeholder="Расскажите о вашем бизнесе и задачах"
            rows={4}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
          />
          <button type="submit" className="landing-btn landing-btn--primary">
            Отправить заявку
          </button>
          {formStatus && <p className="landing-form-status">{formStatus}</p>}
        </form>
      </section>

      <section className="landing-section landing-roadmap">
        <h2>Функционал платформы</h2>
        <p className="landing-section-lead">
          Мы развиваем Вместе поэтапно: сначала базовые инструменты для записи и коммуникации,
          затем — оплата, автоматизация и расширенная аналитика.
        </p>
        <div className="landing-roadmap-grid">
          <article className="landing-roadmap-card landing-roadmap-card--now">
            <h3>Уже доступно</h3>
            <ul>
              <li>Регистрация и вход с подтверждением email</li>
              <li>Роли: клиент, исполнитель (организация), сотрудник</li>
              <li>Онлайн-запись и календарь интервалов</li>
              <li>Каталог услуг с готовыми шаблонами (салон красоты, автосервис)</li>
              <li>Карта организаций, поиск и фильтры для клиентов</li>
              <li>Чаты между клиентами и организациями</li>
              <li>Отзывы и рейтинг организаций</li>
              <li>Управление сотрудниками и правами доступа</li>
              <li>Профиль организации: адрес, график, галерея, контакты</li>
              <li>История записей и уведомления в личном кабинете</li>
              <li>Подписки и оплата через ЮKassa</li>
              <li>Заявка на индивидуальную автоматизацию</li>
            </ul>
          </article>
          <article className="landing-roadmap-card landing-roadmap-card--planned">
            <h3>В планах</h3>
            <ul>
              <li>Email- и SMS-уведомления о записях и напоминания</li>
              <li>Push-уведомления и мобильное приложение</li>
              <li>Онлайн-оплата услуг при записи (не только подписка)</li>
              <li>Отчёты и аналитика для бизнеса</li>
              <li>Несколько филиалов у одной организации</li>
              <li>Интеграции: 1С, CRM, мессенджеры, телефония</li>
              <li>Новые сферы бизнеса и отраслевые шаблоны</li>
              <li>Программа лояльности и абонементы для клиентов</li>
              <li>Онлайн-запись через виджет на сайте организации</li>
              <li>Расширенная автоматизация под ключ для крупного бизнеса</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="landing-section landing-cta">
        <h2>Готовы начать?</h2>
        <p>Создайте аккаунт за пару минут и откройте все возможности Вместе.</p>
        <div className="landing-hero-actions">
          <button type="button" className="landing-btn landing-btn--primary" onClick={onRegister}>
            Зарегистрироваться
          </button>
          <button type="button" className="landing-btn landing-btn--ghost" onClick={onLogin}>
            Уже есть аккаунт — войти
          </button>
        </div>
      </section>

      <footer className="landing-footer">
        <p>
          {SITE_LEGAL.serviceName} · ИНН {SITE_LEGAL.inn} ·{" "}
          <a href={`mailto:${SITE_LEGAL.email}`}>{SITE_LEGAL.email}</a> ·{" "}
          <a href={`tel:${SITE_LEGAL.phoneRaw}`}>{SITE_LEGAL.phone}</a>
        </p>
        <p className="landing-footer-meta">
          {SITE_LEGAL.executorName} · {SITE_LEGAL.status} · {SITE_LEGAL.city}
        </p>
        <nav className="landing-footer-nav" aria-label="Разделы сайта">
          <a href="/#pricing">Тарифы</a>
          <a href="/#automation-request">Заявка на автоматизацию</a>
          <a href="/contacts">Контакты и реквизиты</a>
          <a href="/offer">Публичная оферта</a>
          <a href="/privacy">Политика конфиденциальности</a>
        </nav>
      </footer>
    </div>
  );
}
