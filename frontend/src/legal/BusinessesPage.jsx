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
  {
    id: "cafe_restaurant",
    emoji: "🍽️",
    title: "Кафе и рестораны",
    lead: "Соберите план зала, выдайте столам QR и PIN, ведите меню и принимайте заказы за столом, навынос и с доставкой.",
    highlights: [
      "Конструктор рассадки столов",
      "QR + 6-значный пароль на каждый стол",
      "Меню: категории, новинки, фото до 5, состав и ккал",
      "Режимы: за столом / самовывоз / доставка + оплата",
    ],
    categories: [
      {
        name: "Зал",
        items: ["План помещения", "Столы и PIN", "Ссылки QR"],
      },
      {
        name: "Меню",
        items: ["Категории и новинки", "Блюда и фото", "Граммы и калории"],
      },
      {
        name: "Заказы",
        items: ["Онлайн ЮKassa", "Наличные / карта на месте", "Статусы кухни"],
      },
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
