import "../landing.css";
import { SITE_LEGAL } from "./siteLegal.js";

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

export default function BusinessesPage() {
  return (
    <div className="landing businesses-page">
      <header className="businesses-hero">
        <a className="businesses-back" href="/">
          ← На главную
        </a>
        <p className="businesses-kicker">Вместе · отрасли</p>
        <h1>Для каких бизнесов уже есть функционал</h1>
        <p className="businesses-lead">
          Готовые каталоги услуг, запись, чаты и управление командой — подключайте сферу и
          запускайтесь быстрее. Ниже подробности по каждой отрасли.
        </p>
      </header>

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

      <footer className="businesses-footer">
        <p>
          Нужна своя сфера? Оставьте заявку на{" "}
          <a href="/#automation-request">индивидуальную автоматизацию</a> — подключим каталог под
          ваш процесс.
        </p>
        <p className="landing-note">
          {SITE_LEGAL.serviceName} ·{" "}
          <a href="/contacts">Контакты</a> · <a href="/offer">Оферта</a>
        </p>
      </footer>
    </div>
  );
}
