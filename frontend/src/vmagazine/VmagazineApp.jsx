import { useCallback, useEffect, useState } from "react";
import { showToast } from "../toast.js";
import {
  addFavorite,
  loadFavorites,
  loadMyOrders,
  removeFavorite,
  searchShops,
} from "./vmagazineApi.js";
import "./vmagazine.css";

const TABS = [
  { id: "search", label: "Поиск" },
  { id: "favorites", label: "Избранное" },
  { id: "orders", label: "Мои заказы" },
];

const ORDER_STATUS_LABELS = {
  awaiting_payment: "Ожидает оплаты",
  paid: "Оплачен",
  assembling: "Собирается",
  ready: "Готов",
  to_courier: "Курьеру",
  delivering: "В пути",
  done: "Завершён",
  cancelled: "Отменён",
};

function formatDistance(m) {
  if (m == null || Number.isNaN(Number(m))) return "";
  const n = Number(m);
  if (n < 1000) return `${Math.round(n)} м`;
  return `${(n / 1000).toFixed(n < 10000 ? 1 : 0)} км`;
}

function openShop(shop) {
  const url = shop?.shop_url || (shop?.organization_slug ? `/s/${shop.organization_slug}` : "");
  if (url) window.location.href = url;
  else showToast("У магазина ещё нет публичной витрины.");
}

export default function VmagazineApp({ authFetch, API_URL }) {
  const [tab, setTab] = useState("search");
  const [query, setQuery] = useState("");
  const [shops, setShops] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }, []);

  const runSearch = useCallback(
    async (q = query) => {
      setLoading(true);
      try {
        const data = await searchShops(authFetch, API_URL, {
          q,
          lat: coords?.lat,
          lon: coords?.lon,
        });
        setShops(Array.isArray(data) ? data : []);
      } catch (e) {
        showToast(e.message || "Не удалось загрузить магазины.");
      } finally {
        setLoading(false);
      }
    },
    [API_URL, authFetch, coords, query],
  );

  const runFavorites = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadFavorites(authFetch, API_URL);
      setFavorites(Array.isArray(data) ? data : []);
    } catch (e) {
      showToast(e.message || "Не удалось загрузить избранное.");
    } finally {
      setLoading(false);
    }
  }, [API_URL, authFetch]);

  const runOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadMyOrders(authFetch, API_URL);
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      showToast(e.message || "Не удалось загрузить заказы.");
    } finally {
      setLoading(false);
    }
  }, [API_URL, authFetch]);

  useEffect(() => {
    if (tab === "search") runSearch();
    else if (tab === "favorites") runFavorites();
    else if (tab === "orders") runOrders();
  }, [tab, runSearch, runFavorites, runOrders]);

  async function toggleFavorite(shop, currentlyFavorite) {
    const id = shop?.id;
    if (!id) return;
    try {
      if (currentlyFavorite) {
        await removeFavorite(authFetch, API_URL, id);
        showToast("Убрано из избранного.");
      } else {
        await addFavorite(authFetch, API_URL, id);
        showToast("Добавлено в избранное.");
      }
      setShops((prev) =>
        prev.map((s) => (s.id === id ? { ...s, is_favorite: !currentlyFavorite } : s)),
      );
      if (tab === "favorites") runFavorites();
    } catch (e) {
      showToast(e.message || "Не удалось обновить избранное.");
    }
  }

  function renderShopCard(shop, { favoriteOverride } = {}) {
    const isFav = favoriteOverride ?? Boolean(shop.is_favorite);
    return (
      <article key={shop.id} className="vmagazine-card" onClick={() => openShop(shop)}>
        <div className="vmagazine-card-head">
          <div>
            <strong>{shop.organization_name}</strong>
            {shop.sphere_label ? <p className="muted small">{shop.sphere_label}</p> : null}
          </div>
          <div className="vmagazine-card-actions" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="ghost-btn" onClick={() => toggleFavorite(shop, isFav)}>
              {isFav ? "★" : "☆"}
            </button>
            <button type="button" onClick={() => openShop(shop)}>
              Витрина
            </button>
          </div>
        </div>
        {shop.organization_address ? <p className="small">{shop.organization_address}</p> : null}
        <p className="muted small vmagazine-order-meta">
          {shop.distance_m != null ? <span>{formatDistance(shop.distance_m)}</span> : null}
          {shop.average_rating != null ? (
            <span>
              ★ {shop.average_rating}
              {shop.reviews_count ? ` · ${shop.reviews_count}` : ""}
            </span>
          ) : null}
        </p>
      </article>
    );
  }

  return (
    <section className="card vmagazine-app">
      <h2>Вмагазине</h2>
      <p className="muted">Поиск магазинов, избранное и ваши заказы с витрин Вместе.</p>

      <div className="vmagazine-tabs" role="tablist" aria-label="Вмагазине">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? "is-active" : "ghost-btn"}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "search" ? (
        <>
          <form
            className="vmagazine-search-row"
            onSubmit={(e) => {
              e.preventDefault();
              runSearch(query);
            }}
          >
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Название или адрес"
              aria-label="Поиск магазинов"
            />
            <button type="submit">Найти</button>
          </form>
          {loading ? <p className="muted">Загрузка…</p> : null}
          {!loading && shops.length === 0 ? (
            <p className="muted vmagazine-empty">Магазины не найдены. Попробуйте другой запрос.</p>
          ) : (
            <div className="vmagazine-list">{shops.map((s) => renderShopCard(s))}</div>
          )}
        </>
      ) : null}

      {tab === "favorites" ? (
        <>
          {loading ? <p className="muted">Загрузка…</p> : null}
          {!loading && favorites.length === 0 ? (
            <p className="muted vmagazine-empty">Пока нет избранных магазинов.</p>
          ) : (
            <div className="vmagazine-list">
              {favorites.map((f) => renderShopCard(f.provider || f, { favoriteOverride: true }))}
            </div>
          )}
        </>
      ) : null}

      {tab === "orders" ? (
        <>
          {loading ? <p className="muted">Загрузка…</p> : null}
          {!loading && orders.length === 0 ? (
            <p className="muted vmagazine-empty">Заказов пока нет — откройте витрину магазина и оформите покупку.</p>
          ) : (
            <div className="vmagazine-list">
              {orders.map((o) => (
                <article
                  key={o.id}
                  className="vmagazine-card"
                  onClick={() => {
                    if (o.shop_url) window.location.href = o.shop_url;
                  }}
                >
                  <div className="vmagazine-card-head">
                    <div>
                      <strong>{o.provider_name || `Заказ #${o.id}`}</strong>
                      <p className="muted small">
                        {ORDER_STATUS_LABELS[o.status] || o.status}
                        {o.mode === "delivery" ? " · Доставка" : " · Самовывоз"}
                      </p>
                    </div>
                    <strong>{Number(o.total).toLocaleString("ru-RU")} ₽</strong>
                  </div>
                  <p className="muted small">
                    {o.created_at
                      ? new Date(o.created_at).toLocaleString("ru-RU", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : null}
                    {o.shop_url ? " · Витрина" : ""}
                  </p>
                </article>
              ))}
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
