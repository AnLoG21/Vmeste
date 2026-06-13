const mapsKey = import.meta.env.VITE_YANDEX_MAPS_API_KEY ?? "";
const suggestKey = import.meta.env.VITE_YANDEX_SUGGEST_API_KEY ?? "";

let loadPromise = null;

/** Загружает api-maps.yandex.ru один раз; на лендинге и юр. страницах не вызывается. */
export function loadYandexMaps() {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.ymaps) {
    return new Promise((resolve) => {
      window.ymaps.ready(() => resolve(window.ymaps));
    });
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    let url = "https://api-maps.yandex.ru/2.1/?lang=ru_RU";
    if (mapsKey) url += `&apikey=${encodeURIComponent(mapsKey)}`;
    if (suggestKey) url += `&suggest_apikey=${encodeURIComponent(suggestKey)}`;
    const s = document.createElement("script");
    s.src = url;
    s.async = true;
    s.onload = () => {
      if (!window.ymaps) {
        loadPromise = null;
        reject(new Error("ymaps missing after load"));
        return;
      }
      window.ymaps.ready(() => resolve(window.ymaps));
    };
    s.onerror = () => {
      loadPromise = null;
      reject(new Error("Yandex Maps script failed"));
    };
    document.head.appendChild(s);
  });

  return loadPromise;
}
