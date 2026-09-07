/** Пул готовых категорий магазина (в духе витрины маркетплейса). */

export const SHOP_CATEGORY_POOL = [
  {
    key: "beauty",
    name: "Красота и уход",
    children: [
      {
        key: "beauty-hair",
        name: "Волосы",
        children: [
          { key: "beauty-hair-color", name: "Краска и осветление" },
          { key: "beauty-hair-care", name: "Шампуни и уход" },
          { key: "beauty-hair-styling", name: "Укладка и стайлинг" },
          { key: "beauty-hair-tools", name: "Инструменты для волос" },
          { key: "beauty-hair-ext", name: "Наращивание и аксессуары" },
          { key: "beauty-hair-masks", name: "Маски и масла" },
          { key: "beauty-hair-men", name: "Для мужчин" },
          { key: "beauty-hair-kids", name: "Детский уход" },
        ],
      },
      {
        key: "beauty-nails",
        name: "Ногти",
        children: [
          { key: "beauty-nails-polish", name: "Лаки и гель-лаки" },
          { key: "beauty-nails-care", name: "Уход за ногтями" },
          { key: "beauty-nails-tools", name: "Маникюрные инструменты" },
          { key: "beauty-nails-tips", name: "Типсы и формы" },
        ],
      },
      {
        key: "beauty-face",
        name: "Лицо и кожа",
        children: [
          { key: "beauty-face-care", name: "Уход за лицом" },
          { key: "beauty-face-makeup", name: "Декоративная косметика" },
          { key: "beauty-face-spa", name: "SPA и маски" },
          { key: "beauty-face-clean", name: "Очищение" },
          { key: "beauty-face-eyes", name: "Для глаз и бровей" },
          { key: "beauty-face-lips", name: "Для губ" },
          { key: "beauty-face-sun", name: "Солнцезащита" },
        ],
      },
      {
        key: "beauty-body",
        name: "Тело и гигиена",
        children: [
          { key: "beauty-body-care", name: "Уход за телом" },
          { key: "beauty-body-bath", name: "Ванна и душ" },
          { key: "beauty-body-deodor", name: "Дезодоранты" },
        ],
      },
      {
        key: "beauty-prof",
        name: "Профессиональная косметика",
        children: [
          { key: "beauty-prof-salon", name: "Для салона" },
          { key: "beauty-prof-dispos", name: "Расходники" },
        ],
      },
    ],
  },
  {
    key: "auto",
    name: "Автотовары",
    children: [
      {
        key: "auto-oils",
        name: "Масла и техжидкости",
        children: [
          { key: "auto-oils-engine", name: "Моторные масла" },
          { key: "auto-oils-trans", name: "Трансмиссионные масла" },
          { key: "auto-oils-coolant", name: "Охлаждающие жидкости" },
          { key: "auto-oils-brake", name: "Тормозная жидкость" },
          { key: "auto-oils-washer", name: "Омывающая жидкость" },
        ],
      },
      {
        key: "auto-parts",
        name: "Запчасти",
        children: [
          { key: "auto-parts-filters", name: "Фильтры" },
          { key: "auto-parts-brake", name: "Тормозная система" },
          { key: "auto-parts-susp", name: "Подвеска" },
          { key: "auto-parts-elec", name: "Электрика" },
          { key: "auto-parts-engine", name: "Двигатель" },
          { key: "auto-parts-body", name: "Кузов и оптика" },
        ],
      },
      {
        key: "auto-chem",
        name: "Автохимия",
        children: [
          { key: "auto-chem-wash", name: "Мойка и уход" },
          { key: "auto-chem-interior", name: "Салон" },
          { key: "auto-chem-engine", name: "Двигатель и топливо" },
        ],
      },
      {
        key: "auto-access",
        name: "Аксессуары",
        children: [
          { key: "auto-access-interior", name: "Для салона" },
          { key: "auto-access-ext", name: "Внешний тюнинг" },
          { key: "auto-access-tools", name: "Инструменты" },
          { key: "auto-access-season", name: "Сезонные" },
        ],
      },
      {
        key: "auto-tires",
        name: "Шины и диски",
        children: [
          { key: "auto-tires-summer", name: "Летние шины" },
          { key: "auto-tires-winter", name: "Зимние шины" },
          { key: "auto-tires-wheels", name: "Диски" },
        ],
      },
    ],
  },
  {
    key: "home",
    name: "Дом и сад",
    children: [
      {
        key: "home-clean",
        name: "Уборка",
        children: [
          { key: "home-clean-chem", name: "Бытовая химия" },
          { key: "home-clean-tools", name: "Инвентарь" },
        ],
      },
      {
        key: "home-textile",
        name: "Текстиль",
        children: [
          { key: "home-textile-bath", name: "Для ванной" },
          { key: "home-textile-bed", name: "Постельное" },
        ],
      },
      {
        key: "home-kitchen",
        name: "Кухня",
        children: [
          { key: "home-kitchen-ware", name: "Посуда и хранение" },
          { key: "home-kitchen-appl", name: "Мелкая техника" },
        ],
      },
      {
        key: "home-repair",
        name: "Ремонт",
        children: [
          { key: "home-repair-tools", name: "Инструменты" },
          { key: "home-repair-paint", name: "Краски и лаки" },
          { key: "home-repair-fast", name: "Крепёж" },
        ],
      },
      {
        key: "home-garden",
        name: "Сад и дача",
        children: [
          { key: "home-garden-plants", name: "Растения и грунты" },
          { key: "home-garden-tools", name: "Садовый инвентарь" },
        ],
      },
    ],
  },
  {
    key: "electronics",
    name: "Электроника",
    children: [
      {
        key: "electronics-phone",
        name: "Смартфоны и гаджеты",
        children: [
          { key: "electronics-phone-acc", name: "Аксессуары" },
          { key: "electronics-phone-audio", name: "Наушники" },
          { key: "electronics-phone-power", name: "Зарядка и powerbank" },
          { key: "electronics-phone-cases", name: "Чехлы и стёкла" },
          { key: "electronics-phone-smart", name: "Умные часы и браслеты" },
        ],
      },
      {
        key: "electronics-pc",
        name: "Компьютеры",
        children: [
          { key: "electronics-pc-periph", name: "Периферия" },
          { key: "electronics-pc-net", name: "Сеть" },
          { key: "electronics-pc-storage", name: "Накопители" },
        ],
      },
      {
        key: "electronics-home",
        name: "ТВ и аудио",
        children: [
          { key: "electronics-home-tv", name: "Телевизоры" },
          { key: "electronics-home-audio", name: "Аудиосистемы" },
        ],
      },
    ],
  },
  {
    key: "fashion",
    name: "Одежда и обувь",
    children: [
      {
        key: "fashion-women",
        name: "Женщинам",
        children: [
          { key: "fashion-women-clothes", name: "Одежда" },
          { key: "fashion-women-shoes", name: "Обувь" },
          { key: "fashion-women-acc", name: "Аксессуары" },
          { key: "fashion-women-bags", name: "Сумки" },
          { key: "fashion-women-underwear", name: "Бельё" },
          { key: "fashion-women-sport", name: "Спортивная одежда" },
        ],
      },
      {
        key: "fashion-men",
        name: "Мужчинам",
        children: [
          { key: "fashion-men-clothes", name: "Одежда" },
          { key: "fashion-men-shoes", name: "Обувь" },
          { key: "fashion-men-acc", name: "Аксессуары" },
          { key: "fashion-men-bags", name: "Сумки и рюкзаки" },
          { key: "fashion-men-underwear", name: "Бельё" },
          { key: "fashion-men-sport", name: "Спортивная одежда" },
        ],
      },
      {
        key: "fashion-kids",
        name: "Детям",
        children: [
          { key: "fashion-kids-clothes", name: "Одежда" },
          { key: "fashion-kids-shoes", name: "Обувь" },
          { key: "fashion-kids-acc", name: "Аксессуары" },
        ],
      },
    ],
  },
  {
    key: "sport",
    name: "Спорт и отдых",
    children: [
      {
        key: "sport-fit",
        name: "Фитнес",
        children: [
          { key: "sport-fit-gear", name: "Инвентарь" },
          { key: "sport-fit-wear", name: "Экипировка" },
        ],
      },
      {
        key: "sport-outdoor",
        name: "Туризм",
        children: [
          { key: "sport-outdoor-camp", name: "Кемпинг" },
          { key: "sport-outdoor-bike", name: "Велосипеды" },
        ],
      },
    ],
  },
  {
    key: "kids",
    name: "Детские товары",
    children: [
      {
        key: "kids-toys",
        name: "Игрушки",
        children: [
          { key: "kids-toys-edu", name: "Развивающие" },
          { key: "kids-toys-outdoor", name: "Уличные" },
        ],
      },
      {
        key: "kids-care",
        name: "Уход",
        children: [
          { key: "kids-care-hygiene", name: "Гигиена" },
          { key: "kids-care-feed", name: "Кормление" },
        ],
      },
      {
        key: "kids-school",
        name: "Школа",
        children: [
          { key: "kids-school-bags", name: "Рюкзаки" },
          { key: "kids-school-supply", name: "Канцелярия" },
        ],
      },
    ],
  },
  {
    key: "pets",
    name: "Зоотовары",
    children: [
      {
        key: "pets-dog",
        name: "Собаки",
        children: [
          { key: "pets-dog-food", name: "Корм" },
          { key: "pets-dog-care", name: "Уход и амуниция" },
        ],
      },
      {
        key: "pets-cat",
        name: "Кошки",
        children: [
          { key: "pets-cat-food", name: "Корм" },
          { key: "pets-cat-litter", name: "Наполнители" },
        ],
      },
      {
        key: "pets-other",
        name: "Другие питомцы",
        children: [
          { key: "pets-other-bird", name: "Птицы" },
          { key: "pets-other-fish", name: "Аквариум" },
        ],
      },
    ],
  },
  {
    key: "grocery",
    name: "Продукты",
    children: [
      {
        key: "grocery-drinks",
        name: "Напитки",
        children: [
          { key: "grocery-drinks-water", name: "Вода и соки" },
          { key: "grocery-drinks-tea", name: "Чай и кофе" },
        ],
      },
      {
        key: "grocery-snack",
        name: "Снеки",
        children: [
          { key: "grocery-snack-sweet", name: "Сладости" },
          { key: "grocery-snack-salty", name: "Солёные" },
        ],
      },
      {
        key: "grocery-dairy",
        name: "Молочное",
        children: [
          { key: "grocery-dairy-milk", name: "Молоко и йогурты" },
          { key: "grocery-dairy-cheese", name: "Сыры" },
        ],
      },
    ],
  },
  {
    key: "office",
    name: "Канцтовары",
    children: [
      {
        key: "office-paper",
        name: "Бумага",
        children: [
          { key: "office-paper-a4", name: "А4 и блокноты" },
          { key: "office-paper-print", name: "Для печати" },
        ],
      },
      {
        key: "office-write",
        name: "Письменные",
        children: [
          { key: "office-write-pens", name: "Ручки и маркеры" },
          { key: "office-write-pencils", name: "Карандаши" },
        ],
      },
      {
        key: "office-org",
        name: "Организация",
        children: [
          { key: "office-org-folders", name: "Папки" },
          { key: "office-org-desk", name: "На стол" },
        ],
      },
    ],
  },
  {
    key: "health",
    name: "Здоровье",
    children: [
      {
        key: "health-vitamins",
        name: "Витамины",
        children: [
          { key: "health-vitamins-complex", name: "Комплексы" },
          { key: "health-vitamins-sports", name: "Спортпит" },
        ],
      },
      {
        key: "health-devices",
        name: "Приборы",
        children: [
          { key: "health-devices-measure", name: "Измерение" },
          { key: "health-devices-care", name: "Уход" },
        ],
      },
      {
        key: "health-first",
        name: "Аптечка",
        children: [
          { key: "health-first-aid", name: "Перевязка" },
          { key: "health-first-hygiene", name: "Гигиена" },
        ],
      },
    ],
  },
  {
    key: "hobby",
    name: "Хобби и творчество",
    children: [
      {
        key: "hobby-craft",
        name: "Рукоделие",
        children: [
          { key: "hobby-craft-kits", name: "Наборы" },
          { key: "hobby-craft-yarn", name: "Пряжа и нитки" },
        ],
      },
      {
        key: "hobby-art",
        name: "Рисование",
        children: [
          { key: "hobby-art-paint", name: "Краски" },
          { key: "hobby-art-paper", name: "Бумага и холсты" },
        ],
      },
      {
        key: "hobby-games",
        name: "Игры",
        children: [
          { key: "hobby-games-board", name: "Настольные" },
          { key: "hobby-games-puzzle", name: "Пазлы" },
        ],
      },
    ],
  },
  {
    key: "appliances",
    name: "Бытовая техника",
    children: [
      {
        key: "appliances-kitchen",
        name: "Для кухни",
        children: [
          { key: "appliances-kitchen-small", name: "Мелкая техника" },
          { key: "appliances-kitchen-large", name: "Крупная техника" },
        ],
      },
      {
        key: "appliances-home",
        name: "Для дома",
        children: [
          { key: "appliances-home-clean", name: "Уборка" },
          { key: "appliances-home-climate", name: "Климат" },
        ],
      },
    ],
  },
  {
    key: "books",
    name: "Книги",
    children: [
      {
        key: "books-fiction",
        name: "Художественная",
        children: [
          { key: "books-fiction-novel", name: "Романы" },
          { key: "books-fiction-kids", name: "Детские" },
        ],
      },
      {
        key: "books-nonfic",
        name: "Нехудожественная",
        children: [
          { key: "books-nonfic-biz", name: "Бизнес" },
          { key: "books-nonfic-edu", name: "Учебная" },
        ],
      },
    ],
  },
  {
    key: "gifts",
    name: "Подарки и праздник",
    children: [
      {
        key: "gifts-wrap",
        name: "Упаковка",
        children: [
          { key: "gifts-wrap-paper", name: "Бумага и пакеты" },
          { key: "gifts-wrap-boxes", name: "Коробки" },
          { key: "gifts-wrap-ribbons", name: "Ленты и банты" },
        ],
      },
      {
        key: "gifts-sets",
        name: "Наборы",
        children: [
          { key: "gifts-sets-beauty", name: "Косметические" },
          { key: "gifts-sets-food", name: "Вкусные" },
          { key: "gifts-sets-home", name: "Для дома" },
        ],
      },
      {
        key: "gifts-party",
        name: "Праздник",
        children: [
          { key: "gifts-party-decor", name: "Декор" },
          { key: "gifts-party-candles", name: "Свечи" },
          { key: "gifts-party-balloons", name: "Шары" },
        ],
      },
    ],
  },
  {
    key: "tools",
    name: "Строительство и ремонт",
    children: [
      {
        key: "tools-hand",
        name: "Ручной инструмент",
        children: [
          { key: "tools-hand-basic", name: "Молотки и отвёртки" },
          { key: "tools-hand-measure", name: "Измерение" },
          { key: "tools-hand-cut", name: "Резка" },
        ],
      },
      {
        key: "tools-power",
        name: "Электроинструмент",
        children: [
          { key: "tools-power-drill", name: "Дрели и шуруповёрты" },
          { key: "tools-power-saw", name: "Пилы" },
          { key: "tools-power-acc", name: "Оснастка" },
        ],
      },
      {
        key: "tools-materials",
        name: "Материалы",
        children: [
          { key: "tools-materials-glue", name: "Клеи и герметики" },
          { key: "tools-materials-tape", name: "Ленты" },
          { key: "tools-materials-hardware", name: "Метизы" },
        ],
      },
    ],
  },
  {
    key: "jewelry",
    name: "Украшения и часы",
    children: [
      {
        key: "jewelry-bijou",
        name: "Бижутерия",
        children: [
          { key: "jewelry-bijou-earrings", name: "Серьги" },
          { key: "jewelry-bijou-neck", name: "Колье и цепочки" },
          { key: "jewelry-bijou-bracelets", name: "Браслеты" },
          { key: "jewelry-bijou-rings", name: "Кольца" },
        ],
      },
      {
        key: "jewelry-watches",
        name: "Часы",
        children: [
          { key: "jewelry-watches-women", name: "Женские" },
          { key: "jewelry-watches-men", name: "Мужские" },
          { key: "jewelry-watches-smart", name: "Смарт-часы" },
        ],
      },
    ],
  },
];

function walk(nodes, query, path, out) {
  for (const n of nodes || []) {
    const nextPath = [...path, { key: n.key, name: n.name }];
    const hay = `${n.name} ${n.key}`.toLowerCase();
    if (!n.children?.length) {
      if (!query || hay.includes(query)) out.push({ node: n, path: nextPath });
    } else if (query && hay.includes(query)) {
      walk(n.children, "", nextPath, out);
    } else {
      walk(n.children, query, nextPath, out);
    }
  }
}

export function searchShopCategoryPool(query, limit = 40) {
  const q = String(query || "")
    .trim()
    .toLowerCase();
  const out = [];
  walk(SHOP_CATEGORY_POOL, q, [], out);
  return out.slice(0, limit);
}

export function browseShopCategoryChildren(stackOrNull) {
  if (!stackOrNull?.length) return SHOP_CATEGORY_POOL;
  let nodes = SHOP_CATEGORY_POOL;
  for (const step of stackOrNull) {
    const cur = (nodes || []).find((n) => n.key === step.key);
    nodes = cur?.children || [];
  }
  return nodes || [];
}
