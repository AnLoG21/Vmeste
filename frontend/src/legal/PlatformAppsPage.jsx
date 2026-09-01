import { useEffect } from "react";
import "../landing.css";
import { SITE_LEGAL } from "./siteLegal.js";
import JsonLd from "../seo/JsonLd.jsx";
import { breadcrumbListJsonLd, faqPageJsonLd, organizationJsonLd } from "../seo/schema.js";
import { setPageMeta } from "../seo/setPageMeta.js";
import LandingAutomationRequest, { scrollLandingHash } from "../LandingAutomationRequest.jsx";

const PLATFORM_APPS = [
  {
    id: "vmenu",
    emoji: "🍳",
    accent: "#0f6e56",
    title: "Вменю",
    lead: "Социальная сеть рецептов внутри Вместе: лента, личная книга, подписки, чаты и редактор с импортом с популярных сайтов.",
    highlights: [
      "Лента рецептов от авторов, на которых вы подписаны",
      "Книга рецептов: черновики, публикация и импорт по ссылке",
      "Пересчёт порций и единиц измерения в карточке блюда",
      "Комментарии, оценки и личные чаты с подписчиками",
      "Поиск по ингредиентам, кухням и авторам",
    ],
    categories: [
      { name: "Для автора", items: ["Редактор рецепта с фото шагов", "Парсер с Gastronom и других сайтов", "Профиль и подписчики"] },
      { name: "Для читателя", items: ["Лента и поиск", "Масштабирование порций", "Сохранение в книгу"] },
      { name: "Доступ", items: ["Раздел «Сервисы» в кабинете", "Один аккаунт Вместе", "Работает в браузере и в приложении"] },
    ],
    cta: { label: "Открыть в кабинете", href: "/services" },
  },
  {
    id: "voice",
    emoji: "🎙️",
    accent: "#5c3d8a",
    title: "Голосовой ассистент",
    lead: "Исходящие звонки клиентам от имени организации: напоминания о записи, подтверждения и сценарии на базе Yandex SpeechKit.",
    highlights: [
      "Пакеты минут в разделе «Подписки»",
      "Синтез и распознавание речи в звонке",
      "Сценарии подтверждения и напоминаний",
      "Учёт 152‑ФЗ: озвучивание цели звонка",
      "Интеграция с Asterisk и телефонией организации",
    ],
    categories: [
      { name: "Настройка", items: ["Выбор пакета минут", "Сценарий и текст приветствия", "Расписание звонков"] },
      { name: "Использование", items: ["Напоминания о записи", "Подтверждение визита", "Статусы в кабинете"] },
      { name: "Тарифы", items: ["Отдельные пакеты минут", "Оплата через ЮKassa", "Продление и смена пакета"] },
    ],
    cta: { label: "Тарифы на минуты", href: "/#pricing" },
  },
];

const FAQ = [
  {
    question: "Чем сервисы отличаются от сфер бизнеса?",
    answer:
      "Сферы (салон, кафе, маркетплейсы) — это готовые кабинеты под тип организации. Сервисы — отдельные приложения платформы, которые подключаются поверх аккаунта Вместе.",
  },
  {
    question: "Нужна отдельная регистрация для Вменю?",
    answer: "Нет. Войдите в Вместе и откройте раздел «Сервисы» → «Вменю».",
  },
  {
    question: "Кто может пользоваться Вменю?",
    answer: "Любой зарегистрированный пользователь: клиенты, исполнители и сотрудники.",
  },
  {
    question: "Как подключить голосовые звонки?",
    answer:
      "В кабинете организации откройте «Подписки», выберите пакет минут голосового ассистента и настройте сценарий в разделе организации.",
  },
];

export default function PlatformAppsPage() {
  useEffect(() => {
    setPageMeta({
      title: "Сервисы платформы — Вменю и голосовой ассистент | Вместе",
      description:
        "Микросервисы Вместе: социальная сеть рецептов Вменю и голосовой ассистент для напоминаний клиентам. Подробности по каждому сервису.",
      path: "/apps",
    });
  }, []);

  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash;
      if (hash && hash.length > 1) {
        window.setTimeout(() => scrollLandingHash(hash), 80);
      }
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  return (
    <div className="landing businesses-landing platform-apps-landing">
      <JsonLd
        id="vmeste-apps-jsonld"
        data={[
          organizationJsonLd(),
          breadcrumbListJsonLd([
            { name: "Главная", path: "/" },
            { name: "Сервисы", path: "/apps" },
          ]),
          faqPageJsonLd(FAQ),
        ]}
      />

      <header className="businesses-topbar">
        <a href="/" className="businesses-brand" aria-label="Вместе — на главную">
          <span className="businesses-brand-mark" aria-hidden="true">
            В
          </span>
          <span>Вместе</span>
        </a>
        <nav className="businesses-topnav" aria-label="Разделы">
          <a href="/businesses">Сферы</a>
          <a href="/#pricing">Тарифы</a>
          <a href="/contacts">Контакты</a>
          <a href="/" className="landing-btn landing-btn--outline businesses-top-login">
            Войти
          </a>
          <a href="/?register=1" className="landing-btn landing-btn--primary businesses-top-cta">
            Регистрация
          </a>
        </nav>
      </header>

      <main>
        <section className="businesses-hero-band">
          <div className="businesses-hero-copy">
            <p className="businesses-kicker">Сервисы платформы</p>
            <h1>Отдельные приложения внутри Вместе</h1>
            <p className="businesses-lead">
              Микросервисы с единым входом: рецепты, голосовые звонки и другие модули — без отдельных
              аккаунтов. Ниже подробности по каждому сервису.
            </p>
            <div className="businesses-hero-actions">
              <a className="landing-btn landing-btn--primary" href="/?register=1">
                Попробовать бесплатно
              </a>
              <a className="landing-btn landing-btn--outline" href="/services">
                Открыть кабинет
              </a>
            </div>
          </div>
          <div className="businesses-jump" aria-label="Перейти к сервису">
            {PLATFORM_APPS.map((app) => (
              <a key={app.id} href={`#${app.id}`} className="businesses-jump-chip" style={{ "--biz-accent": app.accent }}>
                <span aria-hidden="true">{app.emoji}</span> {app.title}
              </a>
            ))}
          </div>
        </section>

        <div className="businesses-page">
          <div className="businesses-list">
            {PLATFORM_APPS.map((app) => (
              <section
                key={app.id}
                id={app.id}
                className="businesses-card"
                style={{ "--biz-accent": app.accent }}
              >
                <div className="businesses-card-head">
                  <span className="businesses-emoji" aria-hidden="true">
                    {app.emoji}
                  </span>
                  <div>
                    <h2>{app.title}</h2>
                    <p>{app.lead}</p>
                  </div>
                </div>
                <ul className="businesses-highlights">
                  {app.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
                <div className="businesses-cats">
                  {app.categories.map((cat) => (
                    <article key={cat.name} className="businesses-cat">
                      <h3>{cat.name}</h3>
                      <ul>
                        {cat.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
                <div className="businesses-card-actions">
                  <a className="landing-btn landing-btn--primary" href={app.cta.href}>
                    {app.cta.label}
                  </a>
                  <a className="landing-btn landing-btn--outline" href="/?register=1">
                    Регистрация
                  </a>
                </div>
              </section>
            ))}
          </div>

          <section className="landing-section businesses-faq">
            <h2>Частые вопросы</h2>
            {FAQ.map((item) => (
              <details key={item.question} className="landing-faq-item">
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </section>

          <section className="businesses-cta-band">
            <h2>Нужен свой сервис?</h2>
            <p>
              Расскажите о задаче — подключим индивидуальный модуль или автоматизацию под ваш бизнес.
            </p>
            <a
              className="landing-btn landing-btn--primary"
              href="#automation-request"
              onClick={(e) => {
                e.preventDefault();
                scrollLandingHash("#automation-request");
                if (window.location.hash !== "#automation-request") {
                  window.history.replaceState(null, "", "#automation-request");
                }
              }}
            >
              Оставить заявку
            </a>
          </section>

          <LandingAutomationRequest className="landing-section landing-request businesses-request" />
        </div>
      </main>

      <footer className="landing-footer">
        <p>
          {SITE_LEGAL.serviceName} · ИНН {SITE_LEGAL.inn} ·{" "}
          <a href={`mailto:${SITE_LEGAL.email}`}>{SITE_LEGAL.email}</a>
        </p>
        <nav className="landing-footer-nav" aria-label="Разделы сайта">
          <a href="/">Главная</a>
          <a href="/apps">Сервисы</a>
          <a href="/businesses">Для бизнеса</a>
          <a href="/contacts">Контакты</a>
          <a href="/offer">Оферта</a>
          <a href="/privacy">Конфиденциальность</a>
        </nav>
      </footer>
    </div>
  );
}
