/** Smart-TV style catalog. External sites often block iframes — we open them as apps. */
export const VEFIRE_APPS = [
  {
    id: "find",
    title: "Найти",
    subtitle: "Поиск → сразу на ТВ",
    url: null,
    accent: "#3d7eff",
    letter: "⌕",
    kind: "find",
  },
  {
    id: "kinopoisk",
    title: "Кинопоиск",
    subtitle: "Фильмы и сериалы",
    url: "https://www.kinopoisk.ru/",
    accent: "#f60",
    letter: "К",
  },
  {
    id: "rutube",
    title: "RuTube",
    subtitle: "Видео и трансляции",
    url: "https://rutube.ru/",
    accent: "#1aa7ec",
    letter: "R",
  },
  {
    id: "vkvideo",
    title: "VK Видео",
    subtitle: "Клипы и шоу",
    url: "https://vkvideo.ru/",
    accent: "#0077ff",
    letter: "VK",
  },
  {
    id: "youtube",
    title: "YouTube",
    subtitle: "Видео и Shorts",
    url: "https://www.youtube.com/",
    accent: "#ff0033",
    letter: "▶",
  },
  {
    id: "link",
    title: "Ссылка",
    subtitle: "Из приложения / браузера",
    url: null,
    accent: "#FF7A00",
    letter: "🔗",
    kind: "link",
  },
];

export const VEFIRE_SEARCH_TARGETS = [
  {
    id: "youtube",
    title: "YouTube",
    build: (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
  },
  {
    id: "rutube",
    title: "RuTube",
    build: (q) => `https://rutube.ru/search/?query=${encodeURIComponent(q)}`,
  },
  {
    id: "vkvideo",
    title: "VK",
    build: (q) => `https://vkvideo.ru/?q=${encodeURIComponent(q)}`,
  },
  {
    id: "kinopoisk",
    title: "Кинопоиск",
    build: (q) => `https://www.kinopoisk.ru/index.php?kp_query=${encodeURIComponent(q)}`,
  },
];
