export const CARD_EDITOR_TOUR_KEY = "vmeste_mp_card_editor_tour_v1";

export function readCardEditorTourDone() {
  try {
    return localStorage.getItem(CARD_EDITOR_TOUR_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeCardEditorTourDone() {
  try {
    localStorage.setItem(CARD_EDITOR_TOUR_KEY, "1");
  } catch {
    /* ignore */
  }
}

export const CARD_EDITOR_TOUR_STEPS = [
  {
    target: '[data-tour="cs-tools"]',
    title: "Панель инструментов",
    text: "Слева — иконки как в Photoshop: выбор, текст, фигуры, кисть и ластик. Наведите на иконку — увидите подсказку.",
  },
  {
    target: '[data-tour="cs-undo"]',
    title: "Отмена и возврат",
    text: "Стрелки отменяют и возвращают действия. Горячие клавиши: Ctrl+Z и Ctrl+Y.",
  },
  {
    target: '[data-tour="cs-fields"]',
    title: "Поля товара",
    text: "Кнопки вставляют название, цену, бренд и характеристики. При генерации подставятся данные из карточки.",
  },
  {
    target: '[data-tour="cs-canvas"]',
    title: "Холст",
    text: "Тяните углы объекта для масштаба. Ctrl+V — вставить картинку из буфера. Можно перетащить файл на холст.",
  },
  {
    target: '[data-tour="mp-save-design"]',
    title: "Сохранить шаблон",
    text: "Не забудьте сохранить — шаблон останется в вашем аккаунте и его можно выбрать снова.",
  },
  {
    target: '[data-tour="mp-generate-slide"]',
    title: "Генерация слайда",
    text: "После сохранения нажмите здесь — PNG появится в медиа товара и уйдёт на выгрузку.",
  },
];
