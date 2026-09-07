import { useEffect, useState } from "react";
import { CartTab, FavoritesTab, HomeTab, ProfileTab } from "./VmagazinePanels.jsx";
import VmagazineLogo from "./VmagazineLogo.jsx";
import "./vmagazine.css";

const TABS = [
  { id: "home", label: "Главная", icon: "🏠" },
  { id: "chats", label: "Чаты", icon: "💬" },
  { id: "favorites", label: "Избранное", icon: "♥" },
  { id: "cart", label: "Корзина", icon: "🛒" },
  { id: "profile", label: "Профиль", icon: "👤" },
];

export default function VmagazineApp({
  authFetch,
  API_URL,
  onTabChange,
  onChatsHostReady,
}) {
  const [tab, setTab] = useState("home");

  useEffect(() => {
    onTabChange?.(tab);
  }, [tab, onTabChange]);

  useEffect(() => {
    if (tab !== "chats") onChatsHostReady?.(null);
  }, [tab, onChatsHostReady]);

  function switchTab(id) {
    setTab(id);
  }

  return (
    <section className={`card vmagazine-app${tab === "chats" ? " vmagazine-app--chats" : ""}`}>
      <div className="vmagazine-app-body">
        {tab === "home" ? <HomeTab authFetch={authFetch} API_URL={API_URL} /> : null}
        {tab === "chats" ? (
          <div
            className="vmenu-chats-host vmagazine-chats-host"
            ref={(el) => onChatsHostReady?.(el)}
          />
        ) : null}
        {tab === "favorites" ? <FavoritesTab authFetch={authFetch} API_URL={API_URL} /> : null}
        {tab === "cart" ? <CartTab authFetch={authFetch} API_URL={API_URL} /> : null}
        {tab === "profile" ? <ProfileTab authFetch={authFetch} API_URL={API_URL} /> : null}
      </div>
      <nav className="vmenu-bottom-nav vmagazine-bottom-nav" aria-label="Вмагазине">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? "active" : ""}
            onClick={() => switchTab(t.id)}
          >
            <span aria-hidden>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </section>
  );
}

export { VmagazineLogo };
