import { useEffect, useMemo, useRef, useState } from "react";
import "./landing.css";
import { SITE_LEGAL } from "./legal/siteLegal.js";
import { API_URL } from "./config.js";
import JsonLd from "./seo/JsonLd.jsx";
import {
  organizationJsonLd,
  softwareApplicationJsonLd,
  websiteJsonLd,
  faqPageJsonLd,
  HOME_FAQ,
} from "./seo/schema.js";
import { setPageMeta } from "./seo/setPageMeta.js";
import { phoneFieldProps } from "./phone.js";
import LandingDemo from "./LandingDemo.jsx";

function formatPlanPrice(plan) {
  if (plan?.plan_type === "trial" || plan?.slug === "starter") return "7 дней бесплатно";
  const value = Number(plan?.price_monthly ?? plan);
  if (!value) return "По заявке";
  return `${value.toLocaleString("ru-RU")} ₽ / месяц`;
}

const CASES = [
  {
    initials: "АН",
    name: "Анна",
    role: "студия ламимейкинга",
    text: "Разгрузила вечер от звонков: клиенты записываются сами по ссылке и с карты. За первый месяц — десятки новых обращений без рекламы в соцсетях.",
  },
  {
    initials: "ДК",
    name: "Дмитрий",
    role: "автосервис",
    text: "Вынес прайс и слоты в онлайн: меньше «пересечений» в гараже, понятный календарь по мастерам и история обращений в одном месте.",
  },
  {
    initials: "МЛ",
    name: "Марина",
    role: "салон красоты",
    text: "Добавила мастеров с отдельными графиками. Владелец видит записи и аналитику, сотрудники — только своё расписание и чаты с клиентами.",
  },
  {
    initials: "ИС",
    name: "Игорь",
    role: "кафе",
    text: "Гости заказывают с телефона по QR: меню с фото, статусы столов и оплата без очереди к официанту на кассе.",
  },
];

const INTEGRATIONS = [
  {
    title: "Google Календарь",
    status: "soon",
    text: "Двусторонняя синхронизация слотов с Google Calendar — в подключении. Сейчас расписание живёт в кабинете Вместе.",
  },
  {
    title: "Яндекс Календарь",
    status: "soon",
    text: "Выгрузка и приём событий из Яндекс Календаря — в подключении, можно заказать как кастом.",
  },
  {
    title: "Telegram",
    status: "soon",
    text: "Сервисные сообщения и акции в Telegram-бот — в подключении. Сейчас клиент видит статус в чате платформы.",
  },
  {
    title: "WhatsApp",
    status: "soon",
    text: "Напоминания и подтверждения в WhatsApp — в подключении / через индивидуальную автоматизацию.",
  },
  {
    title: "SMS",
    status: "soon",
    text: "SMS о подтверждении и напоминании о визите — в дорожной карте.",
  },
  {
    title: "Push-уведомления",
    status: "now",
    text: "Клиент и мастер получают push в Android-приложении Вместе (если разрешили уведомления).",
  },
  {
    title: "Кабинет и чат",
    status: "now",
    text: "Подтверждение сеанса сразу видно в личном кабинете и в чате с организацией — без звонка.",
  },
  {
    title: "ЮKassa (эквайринг)",
    status: "now",
    text: "Подписка платформы, онлайн-заказы в кафе и предоплата записи на услуги — через магазин ЮKassa организации.",
  },
];

export default function LandingPage({ onLogin, onRegister, onStartDemo }) {
  const requestRef = useRef(null);
  const pricingRef = useRef(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "+7",
    telegram: "",
    message: "",
    accept_privacy: false,
  });
  const [formStatus, setFormStatus] = useState("");
  const [plans, setPlans] = useState([]);
  const [demoOpen, setDemoOpen] = useState(false);

  async function startFromPage(sphere) {
    if (!onStartDemo) {
      setDemoOpen(true);
      return;
    }
    try {
      await onStartDemo(sphere);
    } catch {
      setDemoOpen(true);
    }
  }

  const homeJsonLd = useMemo(
    () => [organizationJsonLd(), websiteJsonLd(), softwareApplicationJsonLd(), faqPageJsonLd(HOME_FAQ)],
    []
  );

  useEffect(() => {
    setPageMeta({
      title: "Вместе — онлайн-запись клиентов и автоматизация бизнеса",
      description:
        "Вместе — платформа для онлайн-записи клиентов, каталога услуг и чатов. Старт — 7 дней бесплатно, Бизнес — 990 ₽/мес.",
      path: "/",
    });
  }, []);

  useEffect(() => {
    const run = () => {
      fetch(`${API_URL}/subscriptions/plans/`)
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setPlans(Array.isArray(data) ? data : []))
        .catch(() => setPlans([]));
    };
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(run, { timeout: 2500 });
      return () => cancelIdleCallback(id);
    }
    const t = setTimeout(run, 800);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash === "#pricing") {
      pricingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (hash === "#request" || hash === "#automation-request") {
      requestRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (hash === "#demo") {
      setDemoOpen(true);
    } else if (hash && hash.length > 1) {
      const el = document.getElementById(hash.slice(1));
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    setForm({ name: "", email: "", phone: "+7", telegram: "", message: "", accept_privacy: false });
  }

  return (
    <div className="landing">
      <JsonLd id="vmeste-home-jsonld" data={homeJsonLd} />
      <LandingDemo
        open={demoOpen}
        onClose={() => setDemoOpen(false)}
        onRegister={onRegister}
        onStartDemo={onStartDemo}
      />

      <main>
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
                Попробовать бесплатно
              </button>
              <button
                type="button"
                className="landing-btn landing-btn--outline"
                onClick={() => setDemoOpen(true)}
              >
                Посмотреть демо
              </button>
              <button type="button" className="landing-btn landing-btn--outline" onClick={scrollToPricing}>
                Тарифы
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

        <section className="landing-section" id="quick-start">
          <h2>Быстрый старт за 3 шага</h2>
          <p className="landing-section-lead">
            Настройка не займёт недели. Базовый запуск — в день регистрации.
          </p>
          <ol className="landing-timeline">
            <li>
              <span className="landing-timeline-step">1</span>
              <div>
                <strong>Зарегистрируйтесь за 2 минуты</strong>
                <p>Email, подтверждение и вход в кабинет.</p>
              </div>
            </li>
            <li>
              <span className="landing-timeline-step">2</span>
              <div>
                <strong>Внесите услуги и цены</strong>
                <p>Готовые шаблоны для салона, сервиса и кафе — или свой список.</p>
              </div>
            </li>
            <li>
              <span className="landing-timeline-step">3</span>
              <div>
                <strong>Поделитесь ссылкой</strong>
                <p>Вставьте в соцсети, на сайт или отправьте клиентам — запись пойдёт сама.</p>
              </div>
            </li>
          </ol>
          <div className="landing-hero-actions">
            <button type="button" className="landing-btn landing-btn--primary" onClick={onRegister}>
              Начать использовать
            </button>
            <button type="button" className="landing-btn landing-btn--outline" onClick={() => setDemoOpen(true)}>
              Сначала демо
            </button>
          </div>
        </section>

        <section className="landing-section" id="demo">
          <h2>Живое демо кабинета</h2>
          <p className="landing-section-lead">
            Не картинки, а настоящий общий аккаунт. Выберите сферу — внутри уже есть сотрудники,
            услуги, записи и заказы. Можно создавать своё. При выходе из демо новые данные
            очищаются, исходные остаются.
          </p>
          <div className="landing-demo-spheres landing-demo-spheres--page">
            <button type="button" className="landing-demo-sphere" onClick={() => startFromPage("hair_salon")}>
              <span className="landing-demo-sphere-emoji" aria-hidden="true">💇</span>
              <strong>Салон красоты</strong>
              <span>Мастера, прайс, календарь записей</span>
              <em>Открыть кабинет</em>
            </button>
            <button type="button" className="landing-demo-sphere" onClick={() => startFromPage("service_center")}>
              <span className="landing-demo-sphere-emoji" aria-hidden="true">🔧</span>
              <strong>Автосервис</strong>
              <span>Приёмка, механики, слоты диагностики</span>
              <em>Открыть кабинет</em>
            </button>
            <button type="button" className="landing-demo-sphere" onClick={() => startFromPage("cafe_restaurant")}>
              <span className="landing-demo-sphere-emoji" aria-hidden="true">🍽️</span>
              <strong>Кафе</strong>
              <span>Зал, PIN столов, меню и заказы</span>
              <em>Открыть кабинет</em>
            </button>
          </div>
        </section>

        <section className="landing-section">
          <h2>Что такое Вместе?</h2>
          <p className="landing-section-lead">
            Вместе — современная экосистема для сервисного бизнеса: салонов красоты, сервисных
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
                Сначала можно активировать <strong>бесплатную неделю «Старт»</strong> — один раз.
                Дальше тариф «Бизнес» за 990 ₽/мес с полным функционалом. Оплата через ЮKassa, перед
                оплатой можно ввести промокод.
              </p>
            </article>
          </div>
        </section>

        <section className="landing-section" id="cases">
          <h2>Как бизнес использует Вместе</h2>
          <p className="landing-section-lead">
            Типовые сценарии запуска — чтобы было понятно, какую задачу закрывает платформа на
            практике.
          </p>
          <div className="landing-cases">
            {CASES.map((c) => (
              <article key={c.name + c.role} className="landing-case">
                <div className="landing-case-avatar" aria-hidden="true">
                  {c.initials}
                </div>
                <div>
                  <h3>
                    {c.name}, {c.role}
                  </h3>
                  <p>{c.text}</p>
                </div>
              </article>
            ))}
          </div>
          <p className="landing-note">
            Хотите опубликовать свой кейс с фото? Напишите на{" "}
            <a href={`mailto:${SITE_LEGAL.email}`}>{SITE_LEGAL.email}</a>.
          </p>
        </section>

        <section className="landing-section landing-businesses" id="businesses">
          <h2>Для каких бизнесов уже готово</h2>
          <p className="landing-section-lead">
            Подключайте готовую сферу с каталогом услуг — или закажите индивидуальную настройку.
          </p>
          <div className="landing-businesses-grid">
            <a className="landing-biz-card" href="/businesses#hair_salon">
              <span className="landing-biz-emoji" aria-hidden="true">
                💇
              </span>
              <strong>Салоны красоты</strong>
              <span>Запись, мастера, услуги</span>
              <span className="landing-biz-link">Подробнее →</span>
            </a>
            <a className="landing-biz-card" href="/businesses#service_center">
              <span className="landing-biz-emoji" aria-hidden="true">
                🔧
              </span>
              <strong>Сервисные центры</strong>
              <span>Диагностика и ремонт</span>
              <span className="landing-biz-link">Подробнее →</span>
            </a>
            <a className="landing-biz-card" href="/businesses#cafe_restaurant">
              <span className="landing-biz-emoji" aria-hidden="true">
                🍽️
              </span>
              <strong>Кафе и рестораны</strong>
              <span>Зал, QR, меню, оплата</span>
              <span className="landing-biz-link">Подробнее →</span>
            </a>
            <a className="landing-biz-card landing-biz-card--more" href="/#automation-request">
              <span className="landing-biz-emoji" aria-hidden="true">
                ✨
              </span>
              <strong>Другая сфера</strong>
              <span>Индивидуальная автоматизация</span>
              <span className="landing-biz-link">Оставить заявку →</span>
            </a>
          </div>
        </section>

        <section className="landing-section" id="value">
          <h2>Больше, чем просто запись</h2>
          <p className="landing-section-lead">
            CRM-ценность — в возврате клиентов, оплатах и цифрах для решений. Ниже — что уже работает
            и что готовим.
          </p>
          <div className="landing-value-grid">
            <article className="landing-value-card">
              <h3>Удержание клиентов</h3>
              <ul>
                <li>
                  <strong>Чаты и история визитов</strong> — клиент не «теряется» после первой записи.
                </li>
                <li>
                  <strong>Уведомления в кабинете и push</strong> — статусы записей под рукой.
                </li>
                <li>
                  <strong>Автонапоминания «не был 4 недели»</strong>, кэшбэк и бонусы — в планах и
                  доступны как кастом при автоматизации.
                </li>
              </ul>
            </article>
            <article className="landing-value-card landing-value-card--accent">
              <h3>Встроенный эквайринг</h3>
              <p className="landing-acquiring-lead">
                Борьба с неприходами: настройте частичную или полную предоплату за услуги через
                безопасный встроенный эквайринг.
              </p>
              <ul>
                <li>Оплата через ЮKassa — без «серых» переводов</li>
                <li>Онлайн-оплата заказов в кафе уже работает</li>
                <li>Предоплата записи: частичная или полная — в настройках организации</li>
              </ul>
            </article>
            <article className="landing-value-card">
              <h3>Аналитика руководителя</h3>
              <ul>
                <li>График выручки и динамика записей</li>
                <li>Рейтинг популярных услуг</li>
                <li>Обзор нагрузки — чтобы видеть, что приносит деньги</li>
              </ul>
              <button type="button" className="landing-link-btn" onClick={() => startFromPage("hair_salon")}>
                Открыть демо кабинета →
              </button>
            </article>
            <article className="landing-value-card">
              <h3>Команда и роли</h3>
              <ul>
                <li>Подходит соло-мастеру и студии</li>
                <li>Отдельные графики сотрудников</li>
                <li>Ограничение прав: сотрудник видит свои записи, без лишней финансовой базы</li>
              </ul>
            </article>
          </div>
        </section>

        <section className="landing-section" id="integrations">
          <h2>Интеграции, календари и уведомления</h2>
          <p className="landing-section-lead">
            Как клиент узнаёт, что сеанс подтверждён, и с чем можно связать календарь.
          </p>
          <div className="landing-notify-strip">
            <article>
              <h3>Подтверждение записи</h3>
              <p>
                Сейчас: статус в кабинете, чат с организацией и push в приложении. Далее — SMS,
                Telegram-бот и WhatsApp.
              </p>
            </article>
            <article>
              <h3>Календари</h3>
              <p>
                Google Календарь и Яндекс Календарь — в подключении (синхронизация слотов). Пока
                мастер ведёт расписание в Вместе.
              </p>
            </article>
          </div>
          <div className="landing-integrations">
            {INTEGRATIONS.map((item) => (
              <article key={item.title} className="landing-integration">
                <div className="landing-integration-top">
                  <h3>{item.title}</h3>
                  <span className={`landing-status landing-status--${item.status}`}>
                    {item.status === "now" ? "Доступно" : "В подключении"}
                  </span>
                </div>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section landing-pricing" ref={pricingRef} id="pricing">
          <h2>Тарифы и цены</h2>
          <p className="landing-section-lead">
            <strong>Старт</strong> — бесплатная неделя полного доступа (только один раз, потом
            пропадает). <strong>Бизнес</strong> — 990 ₽/мес за весь основной функционал. Перед
            оплатой можно ввести промокод или сразу перейти к ЮKassa.
          </p>
          <div className="subscriptions-plans landing-pricing-grid">
            {plans.map((plan) => (
              <article key={plan.id} className="subscriptions-plan-card">
                <h3>
                  {(plan.plan_type === "trial" || plan.slug === "starter") && "🎁 "}
                  {plan.slug === "business" && "💼 "}
                  {plan.plan_type === "custom" && "🛠️ "}
                  {plan.name}
                </h3>
                <p className="subscriptions-plan-desc">{plan.description}</p>
                <p className="subscriptions-plan-price">{formatPlanPrice(plan)}</p>
                {Array.isArray(plan.features) && plan.features.length > 0 && (
                  <ul className="subscriptions-plan-features">
                    {plan.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                )}
                {plan.plan_type === "trial" || plan.slug === "starter" ? (
                  <button type="button" className="landing-btn landing-btn--primary" onClick={onRegister}>
                    Попробовать бесплатно
                  </button>
                ) : Number(plan.price_monthly) > 0 ? (
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
            <a href="/offer">публичной оферты</a>. При досрочной отмене в день оплаты (не пробный
            период и не промокод) деньги возвращаются.
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
            <li>
              Активируйте бесплатную неделю «Старт» или оплатите «Бизнес» через ЮKassa (можно с
              промокодом).
            </li>
            <li>После активации доступ появляется сразу — статус подписки станет «Активна».</li>
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
              </button>{" "}
              на платформе.
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
            <label className="checkbox landing-consent-item">
              <input
                type="checkbox"
                checked={Boolean(form.accept_privacy)}
                onChange={(e) => setForm({ ...form, accept_privacy: e.target.checked })}
                required
              />
              <span>
                Согласен(на) на обработку персональных данных согласно{" "}
                <a href="/privacy" target="_blank" rel="noopener noreferrer">
                  политике конфиденциальности
                </a>{" "}
                (версия {SITE_LEGAL.privacyVersion})
              </span>
            </label>
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
                <li>Каталог услуг с шаблонами: салон красоты, сервисный центр, кафе/рестораны</li>
                <li>
                  Кафе: план зала, QR и PIN столов, меню (новинки, фото, кБЖУ), самовывоз/доставка,
                  оплата
                </li>
                <li>Публичные страницы организаций (/o/…) для SEO</li>
                <li>Карта организаций, поиск и фильтры для клиентов</li>
                <li>Чаты между клиентами и организациями</li>
                <li>Отзывы и рейтинг организаций</li>
                <li>Управление сотрудниками и правами доступа</li>
                <li>Аналитика: выручка, услуги, динамика записей</li>
                <li>Профиль организации: адрес, график, галерея, контакты</li>
                <li>История записей и уведомления в личном кабинете</li>
                <li>Подписки и оплата через ЮKassa</li>
                <li>Предоплата услуг при записи (частичная или полная) через ЮKassa организации</li>
                <li>Заявка на индивидуальную автоматизацию</li>
                <li>Согласия 152‑ФЗ, cookies/Метрика, удаление аккаунта</li>
              </ul>
            </article>
            <article className="landing-roadmap-card landing-roadmap-card--planned">
              <h3>В планах</h3>
              <ul>
                <li>Email- и SMS-уведомления о записях и напоминания</li>
                <li>Расширенные push-сценарии и доработка мобильного приложения</li>
                <li>Печать QR и конструктор рассадки — доработка UX</li>
                <li>Посадочные страницы по городам и сферам</li>
                <li>Несколько филиалов у одной организации</li>
                <li>Интеграции: календари, 1С, CRM, мессенджеры, телефония</li>
                <li>Новые сферы бизнеса и отраслевые шаблоны</li>
                <li>Программа лояльности и абонементы для клиентов</li>
                <li>Онлайн-запись через виджет на сайте организации</li>
                <li>Расширенная автоматизация под ключ для крупного бизнеса</li>
              </ul>
            </article>
          </div>
        </section>

        <section className="landing-section landing-faq" id="faq">
          <h2>Частые вопросы</h2>
          <p className="landing-section-lead">
            Ответы про запуск, отличия от аналогов, мобильный доступ и гео-поиск.
          </p>
          {HOME_FAQ.map((item) => (
            <details key={item.question} className="landing-faq-item">
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </section>

        <section className="landing-section landing-cta" id="start">
          <h2>Готовы начать?</h2>
          <p>
            Попробуйте бесплатно 7 дней или сначала откройте демо — без обязательств и без скролла
            обратно наверх.
          </p>
          <div className="landing-hero-actions">
            <button type="button" className="landing-btn landing-btn--primary" onClick={onRegister}>
              Попробовать бесплатно
            </button>
            <button type="button" className="landing-btn landing-btn--outline" onClick={() => setDemoOpen(true)}>
              Посмотреть демо
            </button>
            <button type="button" className="landing-btn landing-btn--ghost" onClick={onLogin}>
              Уже есть аккаунт — войти
            </button>
          </div>
        </section>

        </main>

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
          <a href="/#demo">Демо</a>
          <a href="/#cases">Кейсы</a>
          <a href="/businesses">Для бизнеса</a>
          <a href="/city/moscow">Москва</a>
          <a href="/city/spb">Санкт-Петербург</a>
          <a href="/#pricing">Тарифы</a>
          <a href="/#faq">Вопросы</a>
          <a href="/#automation-request">Заявка на автоматизацию</a>
          <a href="/contacts">Контакты и реквизиты</a>
          <a href="/offer">Публичная оферта</a>
          <a href="/privacy">Политика конфиденциальности</a>
        </nav>
      </footer>
    </div>
  );
}
