import { useEffect } from "react";
import "../landing.css";
import { SITE_LEGAL } from "./siteLegal.js";
import JsonLd from "../seo/JsonLd.jsx";
import { breadcrumbListJsonLd, faqPageJsonLd, organizationJsonLd } from "../seo/schema.js";
import { setPageMeta } from "../seo/setPageMeta.js";

const BUSINESSES = [
  {
    id: "hair_salon",
    emoji: "💇",
    accent: "#c45c00",
    title: "Салон красоты",
    lead: "Готовый каталог парикмахерских и beauty-услуг, запись клиентов и работа мастеров в одном месте.",
    highlights: [
      "Стрижки, окрашивание, укладки и уход",
      "Ногтевой сервис и брови/ресницы",
      "Календарь слотов и сотрудники",
      "Чат с клиентом и отзывы",
    ],
    categories: [
      { name: "Волосы", items: ["Женская / мужская / детская стрижка", "Сложное окрашивание", "Укладки и уход"] },
      { name: "Ногти и брови", items: ["Маникюр и покрытие", "Педикюр", "Оформление бровей и ресниц"] },
      { name: "Организация", items: ["Онлайн-запись", "График мастеров", "Галерея и карта"] },
    ],
  },
  {
    id: "service_center",
    emoji: "🔧",
    accent: "#2f5d50",
    title: "Сервисный центр",
    lead: "Приём техники в ремонт, каталог услуг по направлениям и понятная запись для клиентов.",
    highlights: [
      "Ремонт телефонов, ноутбуков и техники",
      "Диагностика и срочный ремонт",
      "Интерактивная приёмка: фото, галочки клиента, акт и заказ-наряд",
      "Статусы записей и сообщения клиенту",
      "Команда мастеров и интервалы",
    ],
    categories: [
      { name: "Устройства", items: ["Смартфоны и планшеты", "Ноутбуки и ПК", "Бытовая техника"] },
      { name: "Сервис", items: ["Диагностика", "Замена комплектующих", "Срочный ремонт"] },
      { name: "Клиенты", items: ["Онлайн-запись", "Чат и уведомления", "История обращений"] },
    ],
  },
  {
    id: "cafe_restaurant",
    emoji: "🍽️",
    accent: "#8b3a2a",
    title: "Кафе и рестораны",
    lead: "Соберите план зала, выдайте столам QR и PIN, ведите меню и принимайте заказы за столом, навынос и с доставкой.",
    highlights: [
      "Конструктор рассадки столов",
      "QR + 6-значный пароль на каждый стол",
      "Меню: категории, новинки, фото до 5, состав и ккал",
      "Режимы: за столом / самовывоз / доставка + оплата",
    ],
    categories: [
      { name: "Зал", items: ["План помещения", "Столы и PIN", "Ссылки QR"] },
      { name: "Меню", items: ["Категории и новинки", "Блюда и фото", "Граммы и калории"] },
      { name: "Заказы", items: ["Онлайн-эквайринг", "Наличные / карта на месте", "Статусы кухни"] },
    ],
  },
];

const FAQ = [
  {
    question: "Для каких бизнесов подходит Вместе?",
    answer:
      "Есть готовые сценарии для салонов красоты, сервисных центров и кафе/ресторанов. Другие сферы — через индивидуальную автоматизацию.",
  },
  {
    question: "Что входит в функционал для салона?",
    answer: "Каталог beauty-услуг, календарь слотов, сотрудники, чат с клиентом, отзывы, галерея и карта.",
  },
  {
    question: "Как работает меню в кафе?",
    answer:
      "Гость сканирует QR стола, вводит 6-значный PIN, выбирает режим (за столом, самовывоз или доставка) и заказывает из меню организации.",
  },
];

export default function BusinessesPage() {
  useEffect(() => {
    setPageMeta({
      title: "Для бизнеса — онлайн-запись для салонов и сервисов | Вместе",
      description:
        "Вместе для салонов красоты и сервисных центров: готовые каталоги услуг, онлайн-запись, чаты, сотрудники и карта.",
      path: "/businesses",
    });
  }, []);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.length > 1) {
      const el = document.getElementById(hash.slice(1));
      window.setTimeout(() => el?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    }
  }, []);

  return (
    <div className="landing businesses-landing">
      <JsonLd
        id="vmeste-businesses-jsonld"
        data={[
          organizationJsonLd(),
          breadcrumbListJsonLd([
            { name: "Главная", path: "/" },
            { name: "Для бизнеса", path: "/businesses" },
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
          <a href="/#pricing">Тарифы</a>
          <a href="/#demo">Демо</a>
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
            <p className="businesses-kicker">Для бизнеса</p>
            <h1>Готовые сценарии под вашу сферу</h1>
            <p className="businesses-lead">
              Каталоги услуг, запись, чаты и управление командой — подключайте сферу и запускайтесь быстрее.
              Ниже подробности по каждой отрасли.
            </p>
            <div className="businesses-hero-actions">
              <a className="landing-btn landing-btn--primary" href="/?register=1">
                Попробовать бесплатно
              </a>
              <a className="landing-btn landing-btn--outline" href="/#pricing">
                Тарифы
              </a>
            </div>
          </div>
          <div className="businesses-jump" aria-label="Перейти к сфере">
            {BUSINESSES.map((biz) => (
              <a key={biz.id} href={`#${biz.id}`} className="businesses-jump-chip" style={{ "--biz-accent": biz.accent }}>
                <span aria-hidden="true">{biz.emoji}</span> {biz.title}
              </a>
            ))}
          </div>
        </section>

        <div className="businesses-page">
          <div className="businesses-list">
            {BUSINESSES.map((biz) => (
              <section
                key={biz.id}
                id={biz.id}
                className="businesses-card"
                style={{ "--biz-accent": biz.accent }}
              >
                <div className="businesses-card-head">
                  <span className="businesses-emoji" aria-hidden="true">
                    {biz.emoji}
                  </span>
                  <div>
                    <h2>{biz.title}</h2>
                    <p>{biz.lead}</p>
                  </div>
                </div>
                <ul className="businesses-highlights">
                  {biz.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
                <div className="businesses-cats">
                  {biz.categories.map((cat) => (
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
                  <a className="landing-btn landing-btn--primary" href="/?register=1">
                    Подключить
                  </a>
                  <a className="landing-btn landing-btn--outline" href="/#demo">
                    Смотреть демо
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
            <h2>Нужна своя сфера?</h2>
            <p>
              Оставьте заявку на индивидуальную автоматизацию — подключим каталог и процессы под ваш бизнес.
            </p>
            <a className="landing-btn landing-btn--primary" href="/#automation-request">
              Оставить заявку
            </a>
          </section>
        </div>
      </main>

      <footer className="landing-footer">
        <p>
          {SITE_LEGAL.serviceName} · ИНН {SITE_LEGAL.inn} ·{" "}
          <a href={`mailto:${SITE_LEGAL.email}`}>{SITE_LEGAL.email}</a>
        </p>
        <nav className="landing-footer-nav" aria-label="Разделы сайта">
          <a href="/">Главная</a>
          <a href="/businesses">Для бизнеса</a>
          <a href="/contacts">Контакты</a>
          <a href="/offer">Оферта</a>
          <a href="/privacy">Конфиденциальность</a>
        </nav>
      </footer>
    </div>
  );
}
