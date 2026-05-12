import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

const mapsKey = import.meta.env.VITE_YANDEX_MAPS_API_KEY ?? "";
const suggestKey = import.meta.env.VITE_YANDEX_SUGGEST_API_KEY ?? "";

function loadYandexMaps() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.ymaps) {
    return new Promise((resolve) => {
      window.ymaps.ready(() => resolve());
    });
  }
  return new Promise((resolve, reject) => {
    let url = "https://api-maps.yandex.ru/2.1/?lang=ru_RU";
    if (mapsKey) url += `&apikey=${encodeURIComponent(mapsKey)}`;
    if (suggestKey) url += `&suggest_apikey=${encodeURIComponent(suggestKey)}`;
    const s = document.createElement("script");
    s.src = url;
    s.async = true;
    s.onload = () => {
      if (!window.ymaps) {
        reject(new Error("ymaps missing after load"));
        return;
      }
      window.ymaps.ready(() => resolve());
    };
    s.onerror = () => reject(new Error("Yandex Maps script failed"));
    document.head.appendChild(s);
  });
}

function mountApp() {
  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

loadYandexMaps().then(mountApp).catch(mountApp);
