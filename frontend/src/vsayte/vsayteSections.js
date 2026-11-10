/** Готовые секции для быстрой сборки страницы */

export const SECTION_GALLERY = [
  {
    id: "hero-split",
    name: "Hero с картинкой",
    group: "Hero",
    html: `<section style="display:grid;gap:32px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));align-items:center;padding:64px 24px;max-width:1100px;margin:0 auto;">
  <div>
    <p style="margin:0 0 10px;letter-spacing:.12em;text-transform:uppercase;font-size:12px;color:#8a8a8a;">Новый продукт</p>
    <h1 style="margin:0 0 14px;font-size:clamp(2rem,4vw,3rem);line-height:1.1;">Соберите сайт за вечер</h1>
    <p style="margin:0 0 22px;color:#64748b;max-width:420px;line-height:1.6;">Блоки, формы заявок и публикация — без кода.</p>
    <a class="vs-btn" data-vs="button" data-hover="lift" href="#lead" style="display:inline-block;background:#FF7A00;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:600;">Попробовать</a>
  </div>
  <div style="min-height:260px;border-radius:20px;background:linear-gradient(135deg,#fff7f0,#ffe0c2);"></div>
</section>`,
  },
  {
    id: "features-3",
    name: "Преимущества",
    group: "Контент",
    html: `<section style="padding:56px 24px;background:#f8fafc;">
  <div style="max-width:960px;margin:0 auto;text-align:center;">
    <h2 style="margin:0 0 8px;">Почему это удобно</h2>
    <p style="margin:0 0 28px;color:#64748b;">Три причины выбрать вас</p>
    <div style="display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));text-align:left;">
      <article style="padding:20px;border-radius:16px;background:#fff;border:1px solid #eee;"><h3 style="margin:0 0 8px;">Быстро</h3><p style="margin:0;color:#64748b;">Запуск без разработчика</p></article>
      <article style="padding:20px;border-radius:16px;background:#fff;border:1px solid #eee;"><h3 style="margin:0 0 8px;">Красиво</h3><p style="margin:0;color:#64748b;">Готовые секции и стили</p></article>
      <article style="padding:20px;border-radius:16px;background:#fff;border:1px solid #eee;"><h3 style="margin:0 0 8px;">С заявками</h3><p style="margin:0;color:#64748b;">Формы сразу пишут вам</p></article>
    </div>
  </div>
</section>`,
  },
  {
    id: "pricing-3",
    name: "Тарифы",
    group: "Контент",
    html: `<section style="padding:56px 24px;">
  <div style="max-width:960px;margin:0 auto;text-align:center;">
    <h2 style="margin:0 0 28px;">Тарифы</h2>
    <div style="display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));text-align:left;">
      <article style="padding:24px;border-radius:16px;border:1px solid #eee;background:#fff;"><h3 style="margin:0 0 6px;">Старт</h3><p style="margin:0 0 14px;font-size:1.5rem;font-weight:700;">0 ₽</p><p style="margin:0 0 16px;color:#64748b;">Для черновиков</p><a class="vs-btn" data-vs="button" data-hover="outline" href="#lead" style="color:#FF7A00;font-weight:600;text-decoration:none;">Выбрать</a></article>
      <article style="padding:24px;border-radius:16px;border:2px solid #FF7A00;background:#fff;"><h3 style="margin:0 0 6px;">Хостинг</h3><p style="margin:0 0 14px;font-size:1.5rem;font-weight:700;">300 ₽</p><p style="margin:0 0 16px;color:#64748b;">Публикация онлайн</p><a class="vs-btn" data-vs="button" data-hover="lift" href="#lead" style="display:inline-block;background:#FF7A00;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:600;">Выбрать</a></article>
      <article style="padding:24px;border-radius:16px;border:1px solid #eee;background:#fff;"><h3 style="margin:0 0 6px;">Pro</h3><p style="margin:0 0 14px;font-size:1.5rem;font-weight:700;">990 ₽</p><p style="margin:0 0 16px;color:#64748b;">Свой домен</p><a class="vs-btn" data-vs="button" href="#lead" style="color:#FF7A00;font-weight:600;text-decoration:none;">Выбрать</a></article>
    </div>
  </div>
</section>`,
  },
  {
    id: "faq",
    name: "FAQ",
    group: "Контент",
    html: `<section style="padding:56px 24px;max-width:720px;margin:0 auto;">
  <h2 style="margin:0 0 20px;text-align:center;">Вопросы</h2>
  <details style="padding:14px 0;border-bottom:1px solid #eee;"><summary style="cursor:pointer;font-weight:600;">Сколько занимает запуск?</summary><p style="margin:10px 0 0;color:#64748b;">Обычно несколько часов с готовыми секциями.</p></details>
  <details style="padding:14px 0;border-bottom:1px solid #eee;"><summary style="cursor:pointer;font-weight:600;">Можно свой домен?</summary><p style="margin:10px 0 0;color:#64748b;">Да, на тарифе Pro через REG.RU или свой.</p></details>
  <details style="padding:14px 0;border-bottom:1px solid #eee;"><summary style="cursor:pointer;font-weight:600;">Куда приходят заявки?</summary><p style="margin:10px 0 0;color:#64748b;">В кабинет Всайте — раздел «Заявки».</p></details>
</section>`,
  },
  {
    id: "testimonials",
    name: "Отзывы",
    group: "Контент",
    html: `<section style="padding:56px 24px;background:#fff7f0;">
  <div style="max-width:900px;margin:0 auto;display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));">
    <blockquote style="margin:0;padding:22px;border-radius:16px;background:#fff;"><p style="margin:0 0 12px;line-height:1.5;">«Собрали лендинг за день и сразу получили заявки.»</p><footer style="color:#8a8a8a;">— Анна</footer></blockquote>
    <blockquote style="margin:0;padding:22px;border-radius:16px;background:#fff;"><p style="margin:0 0 12px;line-height:1.5;">«Удобно менять блоки и цвета без дизайнера.»</p><footer style="color:#8a8a8a;">— Игорь</footer></blockquote>
  </div>
</section>`,
  },
  {
    id: "lead-form",
    name: "Форма заявки",
    group: "Формы",
    html: `<section id="lead" style="padding:56px 24px;background:#f8fafc;">
  <form class="vs-lead-form" data-vs="lead-form" style="max-width:420px;margin:0 auto;padding:28px;border-radius:18px;background:#fff;border:1px solid #eee;display:grid;gap:12px;">
    <h2 style="margin:0;">Оставить заявку</h2>
    <p style="margin:0;color:#64748b;font-size:14px;">Ответим в течение дня</p>
    <label style="display:grid;gap:6px;font-size:13px;font-weight:600;">Имя
      <input class="vs-input" data-vs="input" name="name" placeholder="Как к вам обращаться" required style="padding:11px 14px;border:1px solid #ddd;border-radius:10px;font-weight:400;"/>
    </label>
    <label style="display:grid;gap:6px;font-size:13px;font-weight:600;">Телефон или email
      <input class="vs-input" data-vs="input" name="contact" placeholder="+7… или email" required style="padding:11px 14px;border:1px solid #ddd;border-radius:10px;font-weight:400;"/>
    </label>
    <label style="display:grid;gap:6px;font-size:13px;font-weight:600;">Комментарий
      <textarea class="vs-textarea" data-vs="textarea" name="message" rows="3" placeholder="Коротко о задаче" style="padding:11px 14px;border:1px solid #ddd;border-radius:10px;font-weight:400;font-family:inherit;"></textarea>
    </label>
    <button class="vs-btn" data-vs="button" data-hover="lift" type="submit" style="padding:12px;border:0;border-radius:10px;background:#FF7A00;color:#fff;font-weight:600;cursor:pointer;">Отправить</button>
    <p class="vs-lead-status" style="margin:0;font-size:13px;color:#64748b;min-height:1.2em;"></p>
  </form>
</section>`,
  },
  {
    id: "cta-band",
    name: "Призыв",
    group: "Hero",
    html: `<section style="padding:64px 24px;text-align:center;background:#111;color:#fff;">
  <h2 style="margin:0 0 10px;">Готовы начать?</h2>
  <p style="margin:0 0 22px;opacity:.75;">Оставьте контакты — перезвоним.</p>
  <a class="vs-btn" data-vs="button" data-hover="lift" href="#lead" style="display:inline-block;background:#FF7A00;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;">Оставить заявку</a>
</section>`,
  },
  {
    id: "contacts",
    name: "Контакты",
    group: "Формы",
    html: `<section style="padding:56px 24px;">
  <div style="max-width:800px;margin:0 auto;display:grid;gap:24px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));">
    <div>
      <h2 style="margin:0 0 12px;">Контакты</h2>
      <p style="margin:0 0 8px;color:#64748b;">Москва</p>
      <p style="margin:0 0 8px;"><a href="tel:+79000000000" style="color:#1a1a1a;text-decoration:none;">+7 (900) 000-00-00</a></p>
      <p style="margin:0;"><a href="mailto:hello@example.com" style="color:#FF7A00;text-decoration:none;">hello@example.com</a></p>
    </div>
    <form class="vs-lead-form" data-vs="lead-form" style="padding:20px;border:1px solid #eee;border-radius:16px;display:grid;gap:10px;">
      <input class="vs-input" name="name" placeholder="Имя" required style="padding:10px 12px;border:1px solid #ddd;border-radius:8px;"/>
      <input class="vs-input" name="contact" placeholder="Телефон" required style="padding:10px 12px;border:1px solid #ddd;border-radius:8px;"/>
      <button class="vs-btn" type="submit" style="padding:12px;border:0;border-radius:8px;background:#FF7A00;color:#fff;font-weight:600;">Написать</button>
      <p class="vs-lead-status" style="margin:0;font-size:13px;color:#64748b;"></p>
    </form>
  </div>
</section>`,
  },
];

export function sectionsByGroup() {
  return SECTION_GALLERY.reduce((acc, s) => {
    if (!acc[s.group]) acc[s.group] = [];
    acc[s.group].push(s);
    return acc;
  }, {});
}
