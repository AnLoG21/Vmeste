import { useEffect } from "react";
import "../landing.css";
import { SITE_LEGAL } from "./siteLegal.js";
import JsonLd from "../seo/JsonLd.jsx";
import { breadcrumbListJsonLd, faqPageJsonLd } from "../seo/schema.js";
import { setPageMeta } from "../seo/setPageMeta.js";
import LegalLayout from "./LegalLayout.jsx";

const BUSINESSES = [
  {
    id: "hair_salon",
    emoji: "💇",
    title: "Салон красоты",
    lead: "Готовый каталог парикмахерских и beauty-услуг, запись клиентов и работа мастеров в одном месте.",
    highlights: [
      "Стрижки, окрашивание, укладки и уход",
      "Ногтевой сервис и брови/ресницы",
      "Календарь слотов и сотрудники",
      "Чат с клиентом и отзывы",
    ],
    categories: [
      {
        name: "Волосы",
        items: ["Женская / мужская / детская стрижка", "Сложное окрашивание", "Укладки и уход"],
      },
      {
        name: "Ногти и брови",
        items: ["Маникюр и покрытие", "Педикюр", "Оформление бровей и ресниц"],
      },
      {
        name: "Организация",
        items: ["Онлайн-запись", "График мастеров", "Галерея и карта"],
      },
    ],
  },
  {
    id: "service_center",
    emoji: "🔧",
    title: "Сервисный центр",
    lead: "Приём техники в ремонт, каталог услуг по направлениям и понятная запись для клиентов.",
    highlights: [
      "Ремонт телефонов, ноутбуков и техники",
      "Диагностика и срочный ремонт",
      "Статусы записей и сообщения клиенту",
      "Команда мастеров и интервалы",
    ],
    categories: [
      {
        name: "Устройства",
        items: ["Смартфоны и планшеты", "Ноутбуки и ПК", "Бытовая техника"],
      },
      {
        name: "Сервис",
        items: ["Диагностика", "Замена комплектующих", "Срочный ремонт"],
      },
      {
        name: "Клиенты",
        items: ["Онлайн-запись", "Чат и уведомления", "История обращений"],
      },
    ],
  },
];

const FAQ = [
  {
    question: "Для каких бизнесов подходит Вместе?",
    answer:
      "Есть готовые сценарии для салонов красоты и сервисных центров. Другие сферы — через индивидуальную автоматизацию.",
  },
  {
    question: "Что входит в функционал для салона?",
    answer: "Каталог beauty-услуг, календарь слотов, сотрудники, чат с клиентом, отзывы, галерея и карта.",
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

  return (
    <LegalLayout
      title="Для каких бизнесов уже есть функционал"
      path="/businesses"
      description="Готовые каталоги услуг, запись, чаты и управление командой."
    >
      <JsonLd
        id="vmeste-businesses-jsonld"
        data={[
          breadcrumbListJsonLd([
            { name: "Главная", path: "/" },
            { name: "Для бизнеса", path: "/businesses" },
          ]),
          faqPageJsonLd(FAQ),
        ]}
      />
      <p className="businesses-lead">
        Готовые каталоги услуг, запись, чаты и управление командой — подключайте сферу и
        запускайтесь быстрее. Ниже подробности по каждой отрасли.
      </p>

      <div className="businesses-list">
        {BUSINESSES.map((biz) => (
          <section key={biz.id} id={biz.id} className="businesses-card">
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
          </section>
        ))}
      </div>

      <section className="landing-section" style={{ padding: "1.5rem 0 0" }}>
        <h2>Частые вопросы</h2>
        {FAQ.map((item) => (
          <details key={item.question} className="landing-faq-item">
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </section>

      <p>
        Нужна своя сфера? Оставьте заявку на{" "}
        <a href="/#automation-request">индивидуальную автоматизацию</a> — подключим каталог под ваш
        процесс.
      </p>
      <p className="landing-note">
        {SITE_LEGAL.serviceName} · <a href="/contacts">Контакты</a> · <a href="/offer">Оферта</a>
      </p>
    </LegalLayout>
  );
}
