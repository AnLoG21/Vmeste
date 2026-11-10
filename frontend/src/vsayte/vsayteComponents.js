/** Типы компонентов GrapesJS: кнопки, поля, ссылки — с traits формы и стиля */

const ACCENT = "#FF7A00";

const BTN_SHAPES = {
  square: "0px",
  soft: "8px",
  rounded: "12px",
  pill: "999px",
};

const BTN_SIZES = {
  sm: { padding: "8px 14px", fontSize: "13px" },
  md: { padding: "12px 22px", fontSize: "15px" },
  lg: { padding: "16px 28px", fontSize: "17px" },
};

function btnVariantStyles(variant, accent = ACCENT) {
  if (variant === "outline") {
    return {
      background: "transparent",
      color: accent,
      border: `2px solid ${accent}`,
      "box-shadow": "none",
    };
  }
  if (variant === "ghost") {
    return {
      background: "transparent",
      color: accent,
      border: "2px solid transparent",
      "box-shadow": "none",
    };
  }
  if (variant === "soft") {
    return {
      background: `${accent}22`,
      color: accent,
      border: "2px solid transparent",
      "box-shadow": "none",
    };
  }
  return {
    background: accent,
    color: "#ffffff",
    border: "2px solid transparent",
    "box-shadow": "0 8px 20px rgba(0,0,0,.08)",
  };
}

const INPUT_SHAPES = {
  square: "0px",
  soft: "8px",
  rounded: "12px",
  pill: "999px",
};

const INPUT_SIZES = {
  sm: { padding: "8px 12px", fontSize: "13px" },
  md: { padding: "11px 14px", fontSize: "15px" },
  lg: { padding: "14px 16px", fontSize: "16px" },
};

function applyStyleMap(model, map) {
  const style = { ...(model.getStyle() || {}), ...map };
  model.setStyle(style);
}

export function registerVsayteComponents(editor) {
  const domc = editor.DomComponents || editor.Components;

  domc.addType("vs-button", {
    isComponent: (el) =>
      el?.classList?.contains("vs-btn") || el?.getAttribute?.("data-vs") === "button",
    model: {
      defaults: {
        tagName: "a",
        droppable: false,
        editable: true,
        attributes: {
          class: "vs-btn",
          href: "#",
          "data-vs": "button",
          "data-hover": "lift",
        },
        components: "Кнопка",
        btnShape: "rounded",
        btnSize: "md",
        btnVariant: "solid",
        btnAccent: ACCENT,
        btnHover: "lift",
        traits: [
          { type: "text", name: "href", label: "Ссылка" },
          { type: "text", name: "title", label: "Подсказка" },
          {
            type: "text",
            name: "btnLabel",
            label: "Текст кнопки",
            changeProp: 1,
          },
          {
            type: "select",
            name: "btnShape",
            label: "Форма",
            changeProp: 1,
            options: [
              { id: "square", label: "Прямоугольник" },
              { id: "soft", label: "Мягкая" },
              { id: "rounded", label: "Скруглённая" },
              { id: "pill", label: "Капсула" },
            ],
          },
          {
            type: "select",
            name: "btnSize",
            label: "Размер",
            changeProp: 1,
            options: [
              { id: "sm", label: "Маленькая" },
              { id: "md", label: "Средняя" },
              { id: "lg", label: "Большая" },
            ],
          },
          {
            type: "select",
            name: "btnVariant",
            label: "Стиль",
            changeProp: 1,
            options: [
              { id: "solid", label: "Заливка" },
              { id: "outline", label: "Контур" },
              { id: "soft", label: "Мягкая заливка" },
              { id: "ghost", label: "Прозрачная" },
            ],
          },
          {
            type: "select",
            name: "btnHover",
            label: "При наведении",
            changeProp: 1,
            options: [
              { id: "lift", label: "Подъём" },
              { id: "glow", label: "Свечение" },
              { id: "darken", label: "Затемнение" },
              { id: "brighten", label: "Осветление" },
              { id: "press", label: "Нажатие" },
              { id: "none", label: "Без эффекта" },
            ],
          },
          {
            type: "text",
            name: "btnAccent",
            label: "Цвет (#hex)",
            changeProp: 1,
            placeholder: "#FF7A00",
          },
          {
            type: "select",
            name: "target",
            label: "Открывать",
            options: [
              { id: "", label: "В той же вкладке" },
              { id: "_blank", label: "В новой вкладке" },
            ],
          },
        ],
      },
      init() {
        this.on("change:btnShape change:btnSize change:btnVariant change:btnAccent change:btnHover", () =>
          this.applyButtonDesign(),
        );
        this.on("change:btnLabel", () => {
          const label = this.get("btnLabel");
          if (label != null && String(label).length) {
            this.components(String(label));
          }
        });
        if (!this.get("btnLabel")) {
          const text = this.getInnerHTML?.() || this.view?.el?.textContent || "Кнопка";
          this.set("btnLabel", String(text).trim() || "Кнопка");
        }
        this.applyButtonDesign();
      },
      applyButtonDesign() {
        const shape = this.get("btnShape") || "rounded";
        const size = this.get("btnSize") || "md";
        const variant = this.get("btnVariant") || "solid";
        const accent = this.get("btnAccent") || ACCENT;
        const hover = this.get("btnHover") || "lift";
        const sizeMap = BTN_SIZES[size] || BTN_SIZES.md;
        this.addAttributes({ "data-hover": hover });
        applyStyleMap(this, {
          display: "inline-block",
          "text-decoration": "none",
          "font-weight": "600",
          cursor: "pointer",
          "line-height": "1.2",
          "border-radius": BTN_SHAPES[shape] || BTN_SHAPES.rounded,
          padding: sizeMap.padding,
          "font-size": sizeMap.fontSize,
          ...btnVariantStyles(variant, accent),
        });
      },
    },
  });

  domc.addType("vs-input", {
    isComponent: (el) =>
      el?.tagName === "INPUT" &&
      (el.classList?.contains("vs-input") || el.getAttribute?.("data-vs") === "input"),
    model: {
      defaults: {
        tagName: "input",
        droppable: false,
        highlightable: true,
        attributes: {
          class: "vs-input",
          type: "text",
          placeholder: "Введите текст",
          "data-vs": "input",
        },
        inputShape: "soft",
        inputSize: "md",
        traits: [
          { type: "text", name: "name", label: "Имя поля" },
          { type: "text", name: "placeholder", label: "Подсказка" },
          {
            type: "select",
            name: "type",
            label: "Тип",
            options: [
              { id: "text", label: "Текст" },
              { id: "email", label: "Email" },
              { id: "tel", label: "Телефон" },
              { id: "password", label: "Пароль" },
              { id: "number", label: "Число" },
              { id: "url", label: "Ссылка" },
              { id: "date", label: "Дата" },
              { id: "search", label: "Поиск" },
            ],
          },
          {
            type: "select",
            name: "inputShape",
            label: "Форма",
            changeProp: 1,
            options: [
              { id: "square", label: "Прямоугольник" },
              { id: "soft", label: "Мягкая" },
              { id: "rounded", label: "Скруглённая" },
              { id: "pill", label: "Капсула" },
            ],
          },
          {
            type: "select",
            name: "inputSize",
            label: "Размер",
            changeProp: 1,
            options: [
              { id: "sm", label: "Маленькое" },
              { id: "md", label: "Среднее" },
              { id: "lg", label: "Большое" },
            ],
          },
          { type: "checkbox", name: "required", label: "Обязательное" },
          { type: "checkbox", name: "disabled", label: "Отключено" },
        ],
      },
      init() {
        this.on("change:inputShape change:inputSize", () => this.applyInputDesign());
        this.applyInputDesign();
      },
      applyInputDesign() {
        const shape = this.get("inputShape") || "soft";
        const size = this.get("inputSize") || "md";
        const sizeMap = INPUT_SIZES[size] || INPUT_SIZES.md;
        applyStyleMap(this, {
          width: "100%",
          "box-sizing": "border-box",
          border: "1px solid #ddd",
          background: "#fff",
          color: "#1a1a1a",
          outline: "none",
          "border-radius": INPUT_SHAPES[shape] || INPUT_SHAPES.soft,
          padding: sizeMap.padding,
          "font-size": sizeMap.fontSize,
        });
      },
    },
  });

  domc.addType("vs-textarea", {
    isComponent: (el) =>
      el?.tagName === "TEXTAREA" &&
      (el.classList?.contains("vs-textarea") || el.getAttribute?.("data-vs") === "textarea"),
    model: {
      defaults: {
        tagName: "textarea",
        droppable: false,
        attributes: {
          class: "vs-textarea",
          rows: "4",
          placeholder: "Ваш комментарий",
          "data-vs": "textarea",
        },
        inputShape: "soft",
        traits: [
          { type: "text", name: "name", label: "Имя поля" },
          { type: "text", name: "placeholder", label: "Подсказка" },
          { type: "number", name: "rows", label: "Строк" },
          {
            type: "select",
            name: "inputShape",
            label: "Форма",
            changeProp: 1,
            options: [
              { id: "square", label: "Прямоугольник" },
              { id: "soft", label: "Мягкая" },
              { id: "rounded", label: "Скруглённая" },
            ],
          },
          { type: "checkbox", name: "required", label: "Обязательное" },
        ],
      },
      init() {
        this.on("change:inputShape", () => this.applyTextareaDesign());
        this.applyTextareaDesign();
      },
      applyTextareaDesign() {
        const shape = this.get("inputShape") || "soft";
        applyStyleMap(this, {
          width: "100%",
          "box-sizing": "border-box",
          padding: "12px 14px",
          border: "1px solid #ddd",
          background: "#fff",
          color: "#1a1a1a",
          "border-radius": INPUT_SHAPES[shape] || INPUT_SHAPES.soft,
          "font-size": "15px",
          resize: "vertical",
          "font-family": "inherit",
        });
      },
    },
  });

  domc.addType("vs-select", {
    isComponent: (el) =>
      el?.tagName === "SELECT" &&
      (el.classList?.contains("vs-select") || el.getAttribute?.("data-vs") === "select"),
    model: {
      defaults: {
        tagName: "select",
        droppable: false,
        attributes: { class: "vs-select", "data-vs": "select" },
        components: [
          { tagName: "option", content: "Вариант 1", attributes: { value: "1" } },
          { tagName: "option", content: "Вариант 2", attributes: { value: "2" } },
          { tagName: "option", content: "Вариант 3", attributes: { value: "3" } },
        ],
        traits: [
          { type: "text", name: "name", label: "Имя поля" },
          { type: "checkbox", name: "required", label: "Обязательное" },
          { type: "checkbox", name: "multiple", label: "Несколько" },
        ],
        style: {
          width: "100%",
          padding: "11px 14px",
          "border-radius": "10px",
          border: "1px solid #ddd",
          background: "#fff",
          "font-size": "15px",
        },
      },
    },
  });

  domc.addType("vs-checkbox", {
    isComponent: (el) => el?.getAttribute?.("data-vs") === "checkbox",
    model: {
      defaults: {
        tagName: "label",
        attributes: { class: "vs-check", "data-vs": "checkbox" },
        droppable: false,
        components: [
          {
            tagName: "input",
            attributes: { type: "checkbox" },
            droppable: false,
            selectable: false,
            hoverable: false,
          },
          {
            type: "text",
            content: " Согласен с условиями",
          },
        ],
        traits: [{ type: "text", name: "checkLabel", label: "Подпись", changeProp: 1 }],
        style: {
          display: "flex",
          "align-items": "center",
          gap: "8px",
          cursor: "pointer",
          "font-size": "14px",
          color: "#1a1a1a",
        },
      },
      init() {
        this.on("change:checkLabel", () => {
          const label = this.get("checkLabel");
          if (label == null) return;
          const texts = this.findType("text");
          if (texts?.[0]) texts[0].set("content", ` ${label}`);
        });
      },
    },
  });

  domc.addType("vs-label", {
    isComponent: (el) => el?.getAttribute?.("data-vs") === "label",
    model: {
      defaults: {
        tagName: "label",
        attributes: { "data-vs": "label" },
        editable: true,
        components: "Подпись поля",
        style: {
          display: "block",
          "font-size": "13px",
          "font-weight": "600",
          "margin-bottom": "6px",
          color: "#334155",
        },
        traits: [{ type: "text", name: "for", label: "Для поля (id)" }],
      },
    },
  });

}

/** Пресеты формы/стиля для любого выбранного элемента */
export const SHAPE_PRESETS = [
  { id: "square", label: "Прямоуг.", style: { "border-radius": "0px" } },
  { id: "soft", label: "Мягкая", style: { "border-radius": "8px" } },
  { id: "rounded", label: "Круглая", style: { "border-radius": "16px" } },
  { id: "pill", label: "Капсула", style: { "border-radius": "999px" } },
  { id: "circle", label: "Круг", style: { "border-radius": "50%", aspectRatio: "1 / 1" } },
];

export const SIZE_PRESETS = [
  { id: "sm", label: "S", style: { padding: "6px 12px", "font-size": "13px" } },
  { id: "md", label: "M", style: { padding: "12px 20px", "font-size": "15px" } },
  { id: "lg", label: "L", style: { padding: "16px 28px", "font-size": "17px" } },
  { id: "xl", label: "XL", style: { padding: "20px 36px", "font-size": "19px" } },
];

export const LOOK_PRESETS = [
  {
    id: "solid",
    label: "Заливка",
    style: { background: ACCENT, color: "#fff", border: "0", "box-shadow": "0 8px 18px rgba(0,0,0,.1)" },
  },
  {
    id: "outline",
    label: "Контур",
    style: { background: "transparent", color: ACCENT, border: `2px solid ${ACCENT}`, "box-shadow": "none" },
  },
  {
    id: "soft",
    label: "Мягкий",
    style: { background: `${ACCENT}1f`, color: ACCENT, border: "0", "box-shadow": "none" },
  },
  {
    id: "dark",
    label: "Тёмный",
    style: { background: "#111", color: "#fff", border: "0", "box-shadow": "none" },
  },
  {
    id: "light",
    label: "Светлый",
    style: { background: "#fff", color: "#1a1a1a", border: "1px solid #e5e5e5", "box-shadow": "0 2px 8px rgba(0,0,0,.04)" },
  },
];

export const ALIGN_ACTIONS = [
  { id: "left", label: "←", title: "По левому краю", style: { "margin-left": "0", "margin-right": "auto", "text-align": "left", "align-self": "flex-start" } },
  { id: "center", label: "↔", title: "По центру", style: { "margin-left": "auto", "margin-right": "auto", "text-align": "center", "align-self": "center" } },
  { id: "right", label: "→", title: "По правому краю", style: { "margin-left": "auto", "margin-right": "0", "text-align": "right", "align-self": "flex-end" } },
  { id: "stretch", label: "⇔", title: "На всю ширину", style: { width: "100%", "max-width": "100%", "margin-left": "0", "margin-right": "0" } },
];

export const QUICK_ELEMENTS = [
  {
    id: "btn-solid",
    label: "Кнопка",
    group: "Кнопки",
    content: {
      type: "vs-button",
      btnLabel: "Кнопка",
      btnShape: "rounded",
      btnSize: "md",
      btnVariant: "solid",
      components: "Кнопка",
    },
  },
  {
    id: "btn-outline",
    label: "Контур",
    group: "Кнопки",
    content: {
      type: "vs-button",
      btnLabel: "Подробнее",
      btnShape: "pill",
      btnSize: "md",
      btnVariant: "outline",
      components: "Подробнее",
    },
  },
  {
    id: "btn-soft",
    label: "Мягкая",
    group: "Кнопки",
    content: {
      type: "vs-button",
      btnLabel: "Действие",
      btnShape: "soft",
      btnSize: "md",
      btnVariant: "soft",
      components: "Действие",
    },
  },
  {
    id: "btn-lg",
    label: "Большая",
    group: "Кнопки",
    content: {
      type: "vs-button",
      btnLabel: "Начать",
      btnShape: "pill",
      btnSize: "lg",
      btnVariant: "solid",
      components: "Начать",
    },
  },
  {
    id: "input-text",
    label: "Поле",
    group: "Поля",
    content: { type: "vs-input", attributes: { placeholder: "Имя" } },
  },
  {
    id: "input-email",
    label: "Email",
    group: "Поля",
    content: {
      type: "vs-input",
      attributes: { type: "email", placeholder: "email@example.com" },
    },
  },
  {
    id: "input-tel",
    label: "Телефон",
    group: "Поля",
    content: {
      type: "vs-input",
      attributes: { type: "tel", placeholder: "+7 (___) ___-__-__" },
      inputShape: "pill",
    },
  },
  {
    id: "textarea",
    label: "Текст",
    group: "Поля",
    content: { type: "vs-textarea" },
  },
  {
    id: "select",
    label: "Список",
    group: "Поля",
    content: { type: "vs-select" },
  },
  {
    id: "checkbox",
    label: "Чекбокс",
    group: "Поля",
    content: { type: "vs-checkbox", checkLabel: "Согласен с условиями" },
  },
  {
    id: "label",
    label: "Подпись",
    group: "Поля",
    content: { type: "vs-label", components: "Ваше имя" },
  },
  {
    id: "heading",
    label: "Заголовок",
    group: "Текст",
    content: `<h2 style="margin:0 0 8px;font-size:1.75rem;line-height:1.2;">Заголовок</h2>`,
  },
  {
    id: "text",
    label: "Абзац",
    group: "Текст",
    content: `<p style="margin:0;color:#64748b;line-height:1.6;">Текст абзаца — кликните, чтобы изменить.</p>`,
  },
  {
    id: "badge",
    label: "Бейдж",
    group: "Текст",
    content: `<span style="display:inline-block;padding:4px 10px;border-radius:999px;background:#fff7f0;color:#FF7A00;font-size:12px;font-weight:700;letter-spacing:.04em;">NEW</span>`,
  },
  {
    id: "link",
    label: "Ссылка",
    group: "Текст",
    content: `<a href="#" style="color:#FF7A00;font-weight:600;text-decoration:underline;">Ссылка</a>`,
  },
  {
    id: "divider",
    label: "Линия",
    group: "Макет",
    content: `<hr style="border:0;border-top:1px solid #e5e5e5;margin:24px 0;"/>`,
  },
  {
    id: "spacer",
    label: "Отступ",
    group: "Макет",
    content: `<div style="height:40px;"></div>`,
  },
  {
    id: "box",
    label: "Блок",
    group: "Макет",
    content: `<div style="padding:24px;border:1px dashed #cbd5e1;border-radius:14px;min-height:80px;background:#f8fafc;">Контейнер</div>`,
  },
  {
    id: "card",
    label: "Карточка",
    group: "Макет",
    content: `<article style="padding:20px;border:1px solid #eee;border-radius:16px;background:#fff;box-shadow:0 8px 24px rgba(0,0,0,.04);"><h3 style="margin:0 0 8px;">Карточка</h3><p style="margin:0;color:#64748b;">Описание</p></article>`,
  },
  {
    id: "image",
    label: "Картинка",
    group: "Макет",
    content: `<img src="https://placehold.co/640x360/fff7f0/ff7a00?text=Фото" alt="Изображение" style="display:block;width:100%;max-width:640px;height:auto;border-radius:14px;"/>`,
  },
  {
    id: "icon",
    label: "Иконка",
    group: "Макет",
    content: `<div style="width:56px;height:56px;border-radius:50%;background:#FF7A00;color:#fff;display:grid;place-items:center;font-weight:700;font-size:20px;">★</div>`,
  },
];
