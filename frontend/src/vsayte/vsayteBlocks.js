/** Кастомные блоки конструктора на русском */

export function registerVsayteBlocks(editor) {
  const bm = editor.BlockManager;

  const cats = {
    layout: "Макет",
    buttons: "Кнопки",
    forms: "Формы",
    text: "Текст",
    media: "Медиа",
    sections: "Секции",
  };

  bm.add("vs-section", {
    label: "Секция",
    category: cats.layout,
    content: `<section style="padding:48px 24px;background:#f8fafc;">
  <div style="max-width:960px;margin:0 auto;">
    <h2 style="margin:0 0 12px;">Заголовок секции</h2>
    <p style="margin:0;color:#64748b;">Текст секции — кликните, чтобы изменить.</p>
  </div>
</section>`,
  });

  bm.add("vs-container", {
    label: "Контейнер",
    category: cats.layout,
    content: `<div style="max-width:960px;margin:0 auto;padding:24px;"></div>`,
  });

  bm.add("vs-columns-2", {
    label: "2 колонки",
    category: cats.layout,
    content: `<div style="display:grid;gap:20px;grid-template-columns:1fr 1fr;padding:24px;">
  <div style="padding:16px;border-radius:12px;background:#f8fafc;min-height:100px;">Колонка 1</div>
  <div style="padding:16px;border-radius:12px;background:#f8fafc;min-height:100px;">Колонка 2</div>
</div>`,
  });

  bm.add("vs-columns-3", {
    label: "3 колонки",
    category: cats.layout,
    content: `<div style="display:grid;gap:16px;grid-template-columns:repeat(3,1fr);padding:24px;">
  <div style="padding:16px;border-radius:12px;background:#f8fafc;min-height:80px;">1</div>
  <div style="padding:16px;border-radius:12px;background:#f8fafc;min-height:80px;">2</div>
  <div style="padding:16px;border-radius:12px;background:#f8fafc;min-height:80px;">3</div>
</div>`,
  });

  bm.add("vs-divider", {
    label: "Разделитель",
    category: cats.layout,
    content: `<hr style="border:0;border-top:1px solid #e5e5e5;margin:28px 0;"/>`,
  });

  bm.add("vs-spacer", {
    label: "Отступ",
    category: cats.layout,
    content: `<div style="height:48px;" aria-hidden="true"></div>`,
  });

  bm.add("vs-card", {
    label: "Карточка",
    category: cats.layout,
    content: `<article style="padding:22px;border:1px solid #eee;border-radius:16px;background:#fff;box-shadow:0 8px 24px rgba(0,0,0,.04);max-width:320px;">
  <h3 style="margin:0 0 8px;">Карточка</h3>
  <p style="margin:0;color:#64748b;">Краткое описание</p>
</article>`,
  });

  bm.add("vs-cards-3", {
    label: "3 карточки",
    category: cats.layout,
    content: `<section style="padding:48px 24px;">
  <div style="display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));max-width:960px;margin:0 auto;">
    <article style="padding:20px;border:1px solid #eee;border-radius:14px;background:#fff;"><h3 style="margin:0 0 8px;">Карточка 1</h3><p style="margin:0;color:#64748b;">Описание</p></article>
    <article style="padding:20px;border:1px solid #eee;border-radius:14px;background:#fff;"><h3 style="margin:0 0 8px;">Карточка 2</h3><p style="margin:0;color:#64748b;">Описание</p></article>
    <article style="padding:20px;border:1px solid #eee;border-radius:14px;background:#fff;"><h3 style="margin:0 0 8px;">Карточка 3</h3><p style="margin:0;color:#64748b;">Описание</p></article>
  </div>
</section>`,
  });

  // Buttons
  bm.add("vs-button", {
    label: "Кнопка",
    category: cats.buttons,
    content: { type: "vs-button", btnLabel: "Кнопка", components: "Кнопка" },
  });

  bm.add("vs-button-pill", {
    label: "Капсула",
    category: cats.buttons,
    content: {
      type: "vs-button",
      btnLabel: "Оставить заявку",
      btnShape: "pill",
      btnSize: "md",
      btnVariant: "solid",
      components: "Оставить заявку",
    },
  });

  bm.add("vs-button-outline", {
    label: "Контурная",
    category: cats.buttons,
    content: {
      type: "vs-button",
      btnLabel: "Подробнее",
      btnShape: "rounded",
      btnVariant: "outline",
      components: "Подробнее",
    },
  });

  bm.add("vs-button-row", {
    label: "Ряд кнопок",
    category: cats.buttons,
    content: {
      tagName: "div",
      style: { display: "flex", gap: "12px", "flex-wrap": "wrap", padding: "8px 0" },
      components: [
        {
          type: "vs-button",
          btnLabel: "Основная",
          btnVariant: "solid",
          components: "Основная",
        },
        {
          type: "vs-button",
          btnLabel: "Вторичная",
          btnVariant: "outline",
          components: "Вторичная",
        },
      ],
    },
  });

  // Form elements
  bm.add("vs-input", {
    label: "Поле ввода",
    category: cats.forms,
    content: { type: "vs-input" },
  });

  bm.add("vs-input-email", {
    label: "Email",
    category: cats.forms,
    content: {
      type: "vs-input",
      attributes: { type: "email", placeholder: "email@example.com", class: "vs-input", "data-vs": "input" },
    },
  });

  bm.add("vs-input-phone", {
    label: "Телефон",
    category: cats.forms,
    content: {
      type: "vs-input",
      inputShape: "pill",
      attributes: { type: "tel", placeholder: "+7 (___) ___-__-__", class: "vs-input", "data-vs": "input" },
    },
  });

  bm.add("vs-textarea", {
    label: "Многострочное",
    category: cats.forms,
    content: { type: "vs-textarea" },
  });

  bm.add("vs-select", {
    label: "Выпадающий список",
    category: cats.forms,
    content: { type: "vs-select" },
  });

  bm.add("vs-checkbox", {
    label: "Чекбокс",
    category: cats.forms,
    content: { type: "vs-checkbox" },
  });

  bm.add("vs-label", {
    label: "Подпись",
    category: cats.forms,
    content: { type: "vs-label" },
  });

  bm.add("vs-field-group", {
    label: "Поле с подписью",
    category: cats.forms,
    content: {
      tagName: "div",
      style: { display: "grid", gap: "6px", "margin-bottom": "12px" },
      components: [
        { type: "vs-label", components: "Ваше имя" },
        { type: "vs-input", attributes: { placeholder: "Иван" } },
      ],
    },
  });

  bm.add("vs-form", {
    label: "Форма заявки",
    category: cats.forms,
    content: {
      tagName: "form",
      attributes: { class: "vs-lead-form", "data-vs": "lead-form" },
      style: {
        "max-width": "420px",
        margin: "24px auto",
        padding: "24px",
        border: "1px solid #eee",
        "border-radius": "16px",
        background: "#fff",
        display: "grid",
        gap: "12px",
      },
      components: [
        { tagName: "h3", components: "Заявка", style: { margin: "0" } },
        { type: "vs-label", components: "Имя" },
        { type: "vs-input", attributes: { placeholder: "Имя", name: "name" } },
        { type: "vs-label", components: "Телефон или email" },
        {
          type: "vs-input",
          attributes: { type: "tel", placeholder: "Контакт", name: "contact" },
        },
        { type: "vs-label", components: "Комментарий" },
        { type: "vs-textarea", attributes: { placeholder: "Комментарий", name: "message" } },
        {
          type: "vs-button",
          tagName: "button",
          attributes: { type: "submit", class: "vs-btn", "data-vs": "button", "data-hover": "lift" },
          btnLabel: "Отправить",
          btnHover: "lift",
          components: "Отправить",
        },
        {
          tagName: "p",
          attributes: { class: "vs-lead-status" },
          components: "",
          style: { margin: "0", "font-size": "13px", color: "#64748b", "min-height": "1.2em" },
        },
      ],
    },
  });

  // Text
  bm.add("vs-h1", {
    label: "H1",
    category: cats.text,
    content: `<h1 style="margin:0 0 12px;font-size:clamp(2rem,5vw,3rem);line-height:1.1;">Большой заголовок</h1>`,
  });

  bm.add("vs-h2", {
    label: "H2",
    category: cats.text,
    content: `<h2 style="margin:0 0 10px;font-size:1.75rem;line-height:1.2;">Заголовок</h2>`,
  });

  bm.add("vs-paragraph", {
    label: "Абзац",
    category: cats.text,
    content: `<p style="margin:0;color:#64748b;line-height:1.65;max-width:640px;">Обычный текст. Кликните, чтобы изменить.</p>`,
  });

  bm.add("vs-badge", {
    label: "Бейдж",
    category: cats.text,
    content: `<span style="display:inline-block;padding:4px 10px;border-radius:999px;background:#fff7f0;color:#FF7A00;font-size:12px;font-weight:700;">NEW</span>`,
  });

  bm.add("vs-quote", {
    label: "Отзыв",
    category: cats.text,
    content: `<blockquote style="margin:24px auto;max-width:640px;padding:28px;border-radius:16px;background:#fff7f0;border-left:4px solid #FF7A00;">
  <p style="margin:0 0 12px;font-size:1.1rem;line-height:1.5;">«Отличный сервис — всё понятно и быстро.»</p>
  <footer style="color:#8a8a8a;">— Клиент</footer>
</blockquote>`,
  });

  bm.add("vs-list", {
    label: "Список",
    category: cats.text,
    content: `<ul style="margin:0;padding-left:20px;color:#334155;line-height:1.7;">
  <li>Первый пункт</li>
  <li>Второй пункт</li>
  <li>Третий пункт</li>
</ul>`,
  });

  // Media
  bm.add("vs-image", {
    label: "Картинка",
    category: cats.media,
    content: `<img src="https://placehold.co/800x450/fff7f0/ff7a00?text=%D0%A4%D0%BE%D1%82%D0%BE" alt="Фото" style="display:block;width:100%;max-width:800px;height:auto;border-radius:16px;"/>`,
  });

  bm.add("vs-icon", {
    label: "Иконка-круг",
    category: cats.media,
    content: `<div style="width:56px;height:56px;border-radius:50%;background:#FF7A00;color:#fff;display:grid;place-items:center;font-weight:700;font-size:22px;">★</div>`,
  });

  bm.add("vs-video", {
    label: "Видео",
    category: cats.media,
    content: `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:16px;background:#111;">
  <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="Видео" style="position:absolute;inset:0;width:100%;height:100%;border:0;" allowfullscreen></iframe>
</div>`,
  });

  // Sections
  bm.add("vs-hero", {
    label: "Hero",
    category: cats.sections,
    content: `<section style="padding:72px 24px;text-align:center;background:linear-gradient(135deg,#fff7f0,#ffffff);">
  <p style="letter-spacing:.12em;text-transform:uppercase;font-size:12px;color:#8a8a8a;margin:0 0 10px;">Ваш бренд</p>
  <h1 style="margin:0 0 14px;font-size:clamp(2rem,5vw,3.2rem);line-height:1.1;">Сильный заголовок</h1>
  <p style="margin:0 auto 24px;max-width:520px;color:#5c5c5c;">Короткое описание предложения для клиента.</p>
</section>`,
  });

  bm.add("vs-cta", {
    label: "Призыв",
    category: cats.sections,
    content: `<section id="cta" style="padding:56px 24px;text-align:center;background:#1a1a1a;color:#fff;">
  <h2 style="margin:0 0 10px;">Готовы начать?</h2>
  <p style="margin:0 0 20px;opacity:.8;">Напишите нам — ответим в течение дня.</p>
</section>`,
  });

  bm.add("vs-nav", {
    label: "Меню",
    category: cats.sections,
    content: `<header style="display:flex;justify-content:space-between;align-items:center;padding:16px 24px;border-bottom:1px solid #eee;background:#fff;">
  <strong>Бренд</strong>
  <nav style="display:flex;gap:16px;">
    <a href="#" style="color:#1a1a1a;text-decoration:none;">Услуги</a>
    <a href="#" style="color:#1a1a1a;text-decoration:none;">Цены</a>
    <a href="#cta" style="color:#FF7A00;text-decoration:none;font-weight:600;">Контакты</a>
  </nav>
</header>`,
  });

  bm.add("vs-footer", {
    label: "Подвал",
    category: cats.sections,
    content: `<footer style="padding:28px 24px;background:#111;color:#bbb;text-align:center;font-size:14px;">
  <p style="margin:0;">© Ваша компания · Все права защищены</p>
</footer>`,
  });
}
