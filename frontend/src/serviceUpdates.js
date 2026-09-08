/**
 * Обновления сервиса Вместе — блок на главной (landing).
 * kind: "added" | "fixed"
 */
export const SERVICE_UPDATES = [
  {
    date: "2026-09-08",
    items: [
      { kind: "added", text: "CRM «Помнить всё»: техкарта материалов и личные предпочтения клиента" },
      { kind: "added", text: "Вмагазине: доставка с ETA, трек курьера, отзывы и программа Вбонусов" },
      { kind: "added", text: "Возвраты: решение продавца → ЮKassa и корректировка бонусов" },
      { kind: "added", text: "Доп. услуги к записи: цена у продавца, выбор галочкой у клиента" },
      { kind: "fixed", text: "Лояльность: дни до конца абонемента, статус «Активен», пуш за день" },
      { kind: "fixed", text: "Маркетплейсы на телефоне: меню «☰» и выпадающий список в экране" },
      { kind: "fixed", text: "Посещение по абонементу больше не начисляет баллы лояльности" },
    ],
  },
  {
    date: "2026-09-01",
    items: [
      { kind: "added", text: "Кабинет селлера Ozon/WB: карточки, заказы, склады" },
      { kind: "added", text: "Кафе: зоны доставки, QR-столы, экран кухни" },
      { kind: "fixed", text: "Оплата и предоплата через ЮKassa организации" },
    ],
  },
];

export function formatUpdateDate(iso) {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
