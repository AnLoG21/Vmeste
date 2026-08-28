/** Platform-wide onboarding tour for provider/staff organizations. */

export const PLATFORM_TOUR_KEY = "vmeste_platform_tour_done";

export function platformTourStorageKey(userId) {
  return `${PLATFORM_TOUR_KEY}_${userId || "anon"}`;
}

export function readPlatformTourDone(userId) {
  try {
    return localStorage.getItem(platformTourStorageKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function writePlatformTourDone(userId) {
  try {
    localStorage.setItem(platformTourStorageKey(userId), "1");
  } catch {
    /* ignore */
  }
}

const SPHERE_INTROS = {
  marketplaces: "Кабинет для Ozon и Wildberries: карточки, заказы, аналитика и слайды товаров.",
  cafe_restaurant: "Кабинет ресторана: заказы, зал, меню и отзывы гостей.",
  service_center: "Кабинет автосервиса: записи, приёмка, услуги и чаты с клиентами.",
  hair_salon: "Кабинет салона: записи, услуги, мастера и отзывы клиентов.",
};

/**
 * @param {{ role: string, sphere: string, isBookmarkAvailable: (id: string) => boolean }} opts
 */
export function buildPlatformTourSteps({ role, sphere, isBookmarkAvailable }) {
  const intro = SPHERE_INTROS[sphere] || "Здесь вы управляете организацией: записи, клиенты и настройки.";
  const steps = [
    {
      id: "welcome-context",
      target: '[data-platform-tour="subnav"]',
      title: "Добро пожаловать",
      text: intro,
    },
    {
      id: "subnav",
      target: '[data-platform-tour="subnav"]',
      title: "Быстрые разделы",
      text: "Основные разделы — сверху. Порядок и состав можно изменить в «Настройках» → «Закладки главного меню».",
    },
    {
      id: "menu",
      target: '[data-platform-tour="menu-btn"]',
      title: "Меню",
      text: "Кнопка «☰» — организация, сотрудники, подписки и дополнительные разделы.",
    },
  ];

  const nav = (id, title, text) => {
    if (!isBookmarkAvailable?.(id)) return;
    steps.push({
      id: `nav-${id}`,
      target: `[data-platform-tour="nav-${id}"]`,
      title,
      text,
    });
  };

  if (sphere === "marketplaces") {
    nav("marketplaces", "Маркетплейсы", "Создание карточек, заказы, ключи API и аналитика продаж.");
    nav("analytics", "Аналитика", "Воронка, остатки, юнит-экономика и отчёты.");
  } else if (sphere === "cafe_restaurant") {
    nav("cafe_orders", "Заказы", "Входящие заказы из зала и доставки.");
    nav("cafe", "Зал и меню", "Столы, меню, зоны доставки.");
    nav("analytics", "Аналитика", "Выручка и статистика по заказам.");
  } else {
    nav("bookings", "Записи", "Расписание клиентов и новые заявки.");
    nav("services", "Услуги", "Каталог услуг, цены и категории.");
    nav("intervals", "Календарь", "Свободные слоты для записи.");
    if (sphere === "service_center") {
      nav("inspections", "Приёмка", "Осмотр автомобиля и согласование работ.");
    }
  }

  nav("chats", "Чаты", "Переписка с клиентами — ответы и уведомления.");
  nav("reviews", "Отзывы", "Отзывы клиентов и быстрые ответы.");

  if (role === "provider") {
    steps.push({
      id: "organization",
      target: '[data-platform-tour="menu-org"]',
      title: "Организация",
      text: "Заполните профиль компании: название, адрес, фото, расписание — клиенты увидят вас на карте.",
      prepare: "openMenu",
    });
    steps.push({
      id: "staff",
      target: '[data-platform-tour="menu-staff"]',
      title: "Сотрудники",
      text: "Пригласите мастеров и администраторов, назначьте права доступа.",
      prepare: "openMenu",
    });
    steps.push({
      id: "settings",
      target: '[data-platform-tour="menu-settings"]',
      title: "Настройки",
      text: "Пароль, тема оформления и закладки меню — всё в настройках.",
      prepare: "openMenu",
    });
  }

  return steps;
}
