import { useCallback, useEffect, useMemo, useState } from "react";
import { showToast } from "../toast.js";
import { HorizontalRail, ProductCard, orderStatusLabel } from "./VmagazineComponents.jsx";
import {
  loadAddresses,
  loadBonuses,
  loadCart,
  loadHome,
  loadPaymentCards,
  loadProductLikes,
  loadProfileHub,
  loadRecentlyViewed,
  removeCartItem,
  saveAddress,
  savePaymentCard,
  searchSuggest,
  setCartItem,
} from "./vmagazineApi.js";

export function HomeTab({ authFetch, API_URL, originalsOnly, setOriginalsOnly }) {
  const [addresses, setAddresses] = useState([]);
  const [addressId, setAddressId] = useState(null);
  const [query, setQuery] = useState("");
  const [suggest, setSuggest] = useState({ suggestions: [], sections: [], products: [] });
  const [recommended, setRecommended] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newAddress, setNewAddress] = useState("");

  const refreshHome = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadHome(authFetch, API_URL, { originals: originalsOnly });
      setAddresses(data.addresses || []);
      setRecommended(data.recommended || []);
      const def = (data.addresses || []).find((a) => a.is_default) || (data.addresses || [])[0];
      if (def) setAddressId(def.id);
    } catch (e) {
      showToast(e.message || "Не удалось загрузить витрину");
    } finally {
      setLoading(false);
    }
  }, [API_URL, authFetch, originalsOnly]);

  useEffect(() => {
    void refreshHome();
  }, [refreshHome]);

  useEffect(() => {
    if (!searchOpen) return undefined;
    const t = window.setTimeout(async () => {
      try {
        const data = await searchSuggest(authFetch, API_URL, {
          q: query,
          originals: originalsOnly,
        });
        setSuggest(data || { suggestions: [], sections: [], products: [] });
      } catch {
        /* ignore */
      }
    }, 220);
    return () => window.clearTimeout(t);
  }, [API_URL, authFetch, query, originalsOnly, searchOpen]);

  function patchLiked(id, liked) {
    setRecommended((prev) => prev.map((p) => (p.id === id ? { ...p, liked } : p)));
    setSuggest((s) => ({
      ...s,
      products: (s.products || []).map((p) => (p.id === id ? { ...p, liked } : p)),
    }));
  }

  async function addAddress() {
    const address = newAddress.trim();
    if (!address) return;
    try {
      await saveAddress(authFetch, API_URL, { address, label: "Адрес", is_default: !addresses.length });
      setNewAddress("");
      await refreshHome();
      showToast("Адрес сохранён");
    } catch (e) {
      showToast(e.message || "Не удалось сохранить адрес");
    }
  }

  const currentAddress = addresses.find((a) => a.id === addressId) || addresses[0];

  return (
    <div className="vmag-home">
      <div className="vmag-address-bar">
        <label className="muted small">Куда доставить</label>
        {addresses.length ? (
          <select value={addressId || ""} onChange={(e) => setAddressId(Number(e.target.value))}>
            {addresses.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label ? `${a.label}: ` : ""}
                {a.address}
              </option>
            ))}
          </select>
        ) : (
          <div className="vmag-address-add">
            <input
              placeholder="Улица, дом"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
            />
            <button type="button" onClick={() => void addAddress()}>
              Сохранить
            </button>
          </div>
        )}
        {currentAddress ? <p className="muted small">{currentAddress.address}</p> : null}
      </div>

      <div className="vmag-search-box">
        <input
          type="search"
          placeholder="Искать товары и магазины"
          value={query}
          onFocus={() => setSearchOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setSearchOpen(true);
          }}
        />
        <label className="vmag-originals-filter checkbox">
          <input
            type="checkbox"
            checked={originalsOnly}
            onChange={(e) => setOriginalsOnly(e.target.checked)}
          />
          Только оригиналы
        </label>
      </div>

      {searchOpen && (query || (suggest.suggestions || []).length) ? (
        <div className="vmag-suggest">
          {(suggest.suggestions || []).length ? (
            <ul className="vmag-suggest-list">
              {suggest.suggestions.map((s) => (
                <li key={`${s.type}-${s.text}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery(s.text);
                      setSearchOpen(true);
                    }}
                  >
                    {s.text}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {(suggest.sections || []).length ? (
            <HorizontalRail title="Перейти в раздел">
              {suggest.sections.map((sec) => (
                <button
                  key={`${sec.type}-${sec.id}`}
                  type="button"
                  className="vmag-section-card"
                  onClick={() => {
                    if (sec.shop_url) window.location.href = sec.shop_url;
                    else setQuery(sec.title);
                  }}
                >
                  {sec.cover_url ? <img src={sec.cover_url} alt="" /> : <div className="vmag-section-ph" />}
                  <span>{sec.title}</span>
                </button>
              ))}
            </HorizontalRail>
          ) : null}
          {(suggest.products || []).length ? (
            <div className="vmag-product-grid">
              {suggest.products.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  authFetch={authFetch}
                  API_URL={API_URL}
                  onLikedChange={patchLiked}
                />
              ))}
            </div>
          ) : null}
          <button type="button" className="ghost-btn" onClick={() => setSearchOpen(false)}>
            Закрыть поиск
          </button>
        </div>
      ) : (
        <>
          <h3 className="vmag-section-title">Рекомендуем</h3>
          {loading ? <p className="muted">Загрузка…</p> : null}
          <div className="vmag-product-grid">
            {recommended.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                authFetch={authFetch}
                API_URL={API_URL}
                onLikedChange={patchLiked}
              />
            ))}
          </div>
          {!loading && !recommended.length ? (
            <p className="muted vmagazine-empty">Пока мало просмотров — загляните в магазины на карте.</p>
          ) : null}
        </>
      )}
    </div>
  );
}

export function FavoritesTab({ authFetch, API_URL }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await loadProductLikes(authFetch, API_URL));
    } catch (e) {
      showToast(e.message || "Не удалось загрузить избранное");
    } finally {
      setLoading(false);
    }
  }, [API_URL, authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <h2>Избранное</h2>
      <p className="muted small">Товары, которым вы поставили лайк.</p>
      {loading ? <p className="muted">Загрузка…</p> : null}
      <div className="vmag-product-grid">
        {items.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            authFetch={authFetch}
            API_URL={API_URL}
            onLikedChange={(id, liked) => {
              if (!liked) setItems((prev) => prev.filter((x) => x.id !== id));
            }}
          />
        ))}
      </div>
      {!loading && !items.length ? <p className="muted vmagazine-empty">Пока пусто — лайкайте товары в карточке.</p> : null}
    </div>
  );
}

export function CartTab({ authFetch, API_URL }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await loadCart(authFetch, API_URL));
    } catch (e) {
      showToast(e.message || "Не удалось загрузить корзину");
    } finally {
      setLoading(false);
    }
  }, [API_URL, authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = useMemo(
    () => items.reduce((s, row) => s + Number(row.product?.price || 0) * Number(row.quantity || 0), 0),
    [items],
  );

  return (
    <div>
      <h2>Корзина</h2>
      {loading ? <p className="muted">Загрузка…</p> : null}
      <div className="vmagazine-list">
        {items.map((row) => (
          <article key={row.id} className="vmagazine-card">
            <div className="vmagazine-card-head">
              <div>
                <strong>{row.product?.name}</strong>
                <p className="muted small">{row.product?.provider_name}</p>
                {Number(row.bonus_balance) > 0 ? (
                  <p className="muted small">Вбонусы магазина: {Number(row.bonus_balance).toLocaleString("ru-RU")}</p>
                ) : null}
              </div>
              <strong>{(Number(row.product?.price) * row.quantity).toLocaleString("ru-RU")} ₽</strong>
            </div>
            <div className="vmag-cart-row">
              <input
                type="number"
                min={1}
                value={row.quantity}
                onChange={(e) => {
                  const qty = Math.max(1, Number(e.target.value) || 1);
                  void setCartItem(authFetch, API_URL, row.product.id, qty, row.use_bonuses).then(load);
                }}
              />
              {Number(row.bonus_balance) > 0 ? (
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={Boolean(row.use_bonuses)}
                    onChange={(e) =>
                      void setCartItem(authFetch, API_URL, row.product.id, row.quantity, e.target.checked).then(load)
                    }
                  />
                  Списать Вбонусы
                </label>
              ) : null}
              <button
                type="button"
                className="ghost-btn"
                onClick={() => void removeCartItem(authFetch, API_URL, row.product.id).then(load)}
              >
                Удалить
              </button>
              <button
                type="button"
                onClick={() => {
                  if (row.product?.shop_url) window.location.href = row.product.shop_url;
                }}
              >
                К витрине
              </button>
            </div>
          </article>
        ))}
      </div>
      {items.length ? <p className="cafe-cart-total">Итого: <strong>{total.toLocaleString("ru-RU")} ₽</strong></p> : null}
      {!loading && !items.length ? <p className="muted vmagazine-empty">Корзина пуста.</p> : null}
    </div>
  );
}

export function ProfileTab({ authFetch, API_URL }) {
  const [hub, setHub] = useState(null);
  const [bonuses, setBonuses] = useState([]);
  const [cards, setCards] = useState([]);
  const [recent, setRecent] = useState([]);
  const [recentAll, setRecentAll] = useState(false);
  const [section, setSection] = useState("orders");
  const [cardForm, setCardForm] = useState({ last4: "", brand: "MIR" });

  useEffect(() => {
    (async () => {
      try {
        const [p, b, c, r] = await Promise.all([
          loadProfileHub(authFetch, API_URL),
          loadBonuses(authFetch, API_URL),
          loadPaymentCards(authFetch, API_URL),
          loadRecentlyViewed(authFetch, API_URL, { all: false }),
        ]);
        setHub(p);
        setBonuses(b || []);
        setCards(c || []);
        setRecent(r || []);
      } catch (e) {
        showToast(e.message || "Не удалось загрузить профиль");
      }
    })();
  }, [API_URL, authFetch]);

  async function openAllRecent() {
    setRecentAll(true);
    try {
      setRecent(await loadRecentlyViewed(authFetch, API_URL, { all: true }));
    } catch (e) {
      showToast(e.message || "Не удалось загрузить историю");
    }
  }

  return (
    <div className="vmag-profile">
      <h2>Профиль</h2>
      <div className="vmagazine-tabs" role="tablist">
        {[
          ["orders", "Заказы"],
          ["reviews", "Отзывы"],
          ["purchases", "Покупки"],
          ["cards", "Карты"],
          ["bonuses", "Вбонусы"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={section === id ? "is-active" : "ghost-btn"}
            onClick={() => setSection(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {section === "orders" ? (
        <div className="vmagazine-list">
          {(hub?.active_orders || []).map((o) => (
            <article key={o.id} className="vmagazine-card">
              <div className="vmagazine-card-head">
                <div>
                  <strong>{o.provider_name || `Заказ #${o.id}`}</strong>
                  <p className="muted small">
                    {orderStatusLabel(o.status)}
                    {o.eta_text ? ` · ≈ ${o.eta_text}` : ""}
                  </p>
                </div>
                <strong>{Number(o.total).toLocaleString("ru-RU")} ₽</strong>
              </div>
            </article>
          ))}
          {!hub?.active_orders?.length ? <p className="muted">Нет активных заказов.</p> : null}
        </div>
      ) : null}

      {section === "reviews" ? (
        <div className="vmagazine-list">
          {(hub?.reviewable || []).map((r) => (
            <article key={`${r.order_id}-${r.product_id}`} className="vmagazine-card">
              <strong>{r.name}</strong>
              <p className="muted small">{r.provider_name}</p>
              <button
                type="button"
                onClick={() => {
                  if (r.shop_url) window.location.href = r.shop_url;
                }}
              >
                Оставить отзыв на витрине
              </button>
            </article>
          ))}
          {!hub?.reviewable?.length ? <p className="muted">Пока нет товаров для отзыва.</p> : null}
        </div>
      ) : null}

      {section === "purchases" ? (
        <div className="vmagazine-list">
          {(hub?.purchases || []).map((o) => (
            <article key={o.id} className="vmagazine-card">
              <div className="vmagazine-card-head">
                <div>
                  <strong>{o.provider_name}</strong>
                  <p className="muted small">
                    {o.created_at ? new Date(o.created_at).toLocaleDateString("ru-RU") : ""} ·{" "}
                    {orderStatusLabel(o.status)}
                  </p>
                </div>
                <strong>{Number(o.total).toLocaleString("ru-RU")} ₽</strong>
              </div>
              <ul className="muted small">
                {(o.items || []).map((it) => (
                  <li key={it.id}>
                    {it.name} × {it.quantity} — {Number(it.unit_price).toLocaleString("ru-RU")} ₽
                  </li>
                ))}
              </ul>
            </article>
          ))}
          {!hub?.purchases?.length ? <p className="muted">Покупок пока нет.</p> : null}
        </div>
      ) : null}

      {section === "cards" ? (
        <div>
          <div className="vmagazine-list">
            {cards.map((c) => (
              <article key={c.id} className="vmagazine-card">
                <strong>
                  {c.brand} •••• {c.last4}
                </strong>
                <p className="muted small">
                  {String(c.exp_month).padStart(2, "0")}/{c.exp_year}
                  {c.is_default ? " · основная" : ""}
                </p>
              </article>
            ))}
          </div>
          <div className="vmag-address-add">
            <input
              placeholder="Последние 4 цифры"
              maxLength={4}
              value={cardForm.last4}
              onChange={(e) => setCardForm((f) => ({ ...f, last4: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
            />
            <input
              placeholder="Бренд"
              value={cardForm.brand}
              onChange={(e) => setCardForm((f) => ({ ...f, brand: e.target.value }))}
            />
            <button
              type="button"
              onClick={async () => {
                try {
                  await savePaymentCard(authFetch, API_URL, { ...cardForm, is_default: !cards.length });
                  setCards(await loadPaymentCards(authFetch, API_URL));
                  setCardForm({ last4: "", brand: "MIR" });
                  showToast("Карта добавлена");
                } catch (e) {
                  showToast(e.message || "Ошибка");
                }
              }}
            >
              Добавить
            </button>
          </div>
        </div>
      ) : null}

      {section === "bonuses" ? (
        <div className="vmagazine-list">
          {bonuses.map((b) => (
            <article key={b.provider_id} className="vmagazine-card">
              <div className="vmagazine-card-head">
                <strong>{b.provider_name}</strong>
                <strong>{Number(b.balance).toLocaleString("ru-RU")} бон.</strong>
              </div>
              <p className="muted small">Можно списать при заказе в этом магазине и в корзине.</p>
              {b.shop_url ? (
                <button type="button" onClick={() => (window.location.href = b.shop_url)}>
                  В магазин
                </button>
              ) : null}
            </article>
          ))}
          {!bonuses.length ? <p className="muted">Пока нет Вбонусов — появятся после покупок у продавцов с программой.</p> : null}
        </div>
      ) : null}

      <HorizontalRail title="Вы смотрели" onTitleClick={() => void openAllRecent()}>
        {recent.map((p) => (
          <ProductCard key={p.id} product={p} authFetch={authFetch} API_URL={API_URL} compact />
        ))}
      </HorizontalRail>
      {recentAll ? <p className="muted small">Показаны все недавние просмотры (до 80).</p> : null}
    </div>
  );
}
