import logoMain from "./assets/logo-main.png";
import { useCallback, useEffect, useMemo, useState } from "react";
import { API_URL } from "./config.js";
import JsonLd from "./seo/JsonLd.jsx";
import { SITE_ORIGIN, breadcrumbListJsonLd } from "./seo/schema.js";
import { setPageMeta } from "./seo/setPageMeta.js";
import "./landing.css";
import "./cafeGuest.css";

const MODE_META = {
  dine_in: { label: "За столом", icon: "🍽️" },
  takeaway: { label: "Самовывоз", icon: "🛍️" },
  delivery: { label: "Доставка", icon: "🛵" },
};

const SERVICE_CHARGE_PERCENT = 3;

function pickDefaultMode(modes = {}) {
  if (modes.dine_in) return "dine_in";
  if (modes.takeaway) return "takeaway";
  if (modes.delivery) return "delivery";
  return "";
}

function cartLineKey(menuItemId, removed = []) {
  return `${menuItemId}:${[...removed].sort().join("|")}`;
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor">
      <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-1.99.9-1.99 2S15.9 22 17 22s2-.9 2-2-.9-2-2-2zM7.17 14h9.95c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0 0 21.58 5H6.21l-.94-2H2v2h2l3.6 7.59-1.35 2.44A2 2 0 0 0 8 18h12v-2H8l1.1-2z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor">
      <path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12l-4.89 4.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z" />
    </svg>
  );
}

function Stars({ value, onChange, readOnly = false }) {
  return (
    <span className="cafe-stars" aria-label={value ? `Оценка ${value}` : "Без оценки"}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`cafe-star${n <= value ? " is-on" : ""}`}
          disabled={readOnly}
          onClick={() => onChange?.(n)}
          aria-label={`${n} звёзд`}
        >
          ★
        </button>
      ))}
    </span>
  );
}

export default function CafeGuestPage({ mode = "table", keyId }) {
  const storageKey = `cafe_sess_${mode}_${keyId}`;
  const [info, setInfo] = useState(null);
  const [pin, setPin] = useState("");
  const [session, setSession] = useState(() => sessionStorage.getItem(storageKey) || "");
  const [unlock, setUnlock] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(`${storageKey}_meta`) || "null");
    } catch {
      return null;
    }
  });
  const [modeOrder, setModeOrder] = useState("");
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState([]);
  const [status, setStatus] = useState("");
  const [booting, setBooting] = useState(true);
  const [cartOpen, setCartOpen] = useState(false);
  const [payMethod, setPayMethod] = useState("cash");
  const [guestPhone, setGuestPhone] = useState("+7");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [tipPercent, setTipPercent] = useState(20);
  const [tipCustomMode, setTipCustomMode] = useState(false);
  const [tipCustomAmount, setTipCustomAmount] = useState("");
  const [includeServiceCharge, setIncludeServiceCharge] = useState(true);
  const [orderResult, setOrderResult] = useState(null);
  const [completedOrder, setCompletedOrder] = useState(null);
  const [ratingBusy, setRatingBusy] = useState(null);

  const menuById = useMemo(() => {
    const map = {};
    for (const cat of menu) {
      for (const item of cat.items || []) map[item.id] = item;
    }
    return map;
  }, [menu]);

  const applySession = useCallback(
    (data) => {
      if (!data?.session_token) return;
      sessionStorage.setItem(storageKey, data.session_token);
      try {
        sessionStorage.setItem(`${storageKey}_meta`, JSON.stringify(data));
      } catch {
        /* ignore quota */
      }
      setSession(data.session_token);
      setUnlock(data);
      setModeOrder((prev) => prev || pickDefaultMode(data.modes));
    },
    [storageKey],
  );

  useEffect(() => {
    setStatus("");
    setBooting(true);
    let cancelled = false;

    async function boot() {
      try {
        if (mode === "org") {
          const infoRes = await fetch(`${API_URL}/cafe/m/${encodeURIComponent(keyId)}/`);
          const infoData = await infoRes.json().catch(() => ({}));
          if (!infoRes.ok) throw new Error(infoData.detail || "Заведение не найдено");
          if (cancelled) return;
          setInfo(infoData);
          setPageMeta({
            title: `${infoData.organization_name || "Кафе"} — меню онлайн | Вместе`,
            description: `Меню «${infoData.organization_name || "заведения"}»${
              infoData.organization_address ? `, ${infoData.organization_address}` : ""
            }. Заказ онлайн через Вместе.`,
            path: `/m/${keyId}`,
            robots: "index,follow",
            imageAlt: `${infoData.organization_name || "Кафе"} — меню`,
          });
          if (!sessionStorage.getItem(storageKey)) {
            const openRes = await fetch(`${API_URL}/cafe/m/${encodeURIComponent(keyId)}/`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: "{}",
            });
            const openData = await openRes.json().catch(() => ({}));
            if (!openRes.ok) throw new Error(openData.detail || "Не удалось открыть меню");
            if (!cancelled) applySession(openData);
          }
          return;
        }

        const infoRes = await fetch(`${API_URL}/cafe/t/${encodeURIComponent(keyId)}/`);
        const infoData = await infoRes.json().catch(() => ({}));
        if (!infoRes.ok) throw new Error(infoData.detail || "Стол не найден");
        if (cancelled) return;
        setInfo(infoData);
        setPageMeta({
          title: `${infoData.organization_name || "Кафе"} · стол`,
          description: "Меню и заказ через Вместе",
          path: `/t/${keyId}`,
          robots: "noindex,nofollow",
        });
      } catch (e) {
        if (!cancelled) setStatus(e.message || "Ошибка загрузки");
      } finally {
        if (!cancelled) setBooting(false);
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, [mode, keyId, storageKey, applySession]);

  useEffect(() => {
    if (!session) return;
    fetch(`${API_URL}/cafe/guest/menu/`, { headers: { "X-Cafe-Session": session } })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          sessionStorage.removeItem(storageKey);
          sessionStorage.removeItem(`${storageKey}_meta`);
          setSession("");
          setUnlock(null);
          throw new Error(data.detail || "Сессия истекла");
        }
        setMenu(data.categories || []);
        if (!modeOrder) setModeOrder(pickDefaultMode(unlock?.modes || info?.modes));
      })
      .catch((e) => setStatus(e.message));
  }, [session, storageKey, unlock?.modes, info?.modes, modeOrder]);

  useEffect(() => {
    const pm = unlock?.pay_methods;
    if (!pm) return;
    setPayMethod((prev) => {
      if (prev === "online" && pm.online) return "online";
      if (prev === "cash" && pm.cash) return "cash";
      if (prev === "card_on_spot" && pm.card_on_spot) return "card_on_spot";
      if (pm.online) return "online";
      if (pm.cash) return "cash";
      if (pm.card_on_spot) return "card_on_spot";
      return prev;
    });
  }, [unlock?.pay_methods]);

  useEffect(() => {
    if (!session) return;
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("order");
    if (!orderId) return;
    let cancelled = false;
    let attempts = 0;

    async function loadOrder() {
      const res = await fetch(`${API_URL}/cafe/guest/order/${orderId}/`, {
        headers: { "X-Cafe-Session": session },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || cancelled) return;
      setCompletedOrder(data);
      if (data.status === "awaiting_payment" && attempts < 12) {
        attempts += 1;
        window.setTimeout(loadOrder, 2500);
      }
    }

    loadOrder();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const cartLines = useMemo(
    () =>
      cart
        .map((line) => {
          const item = menuById[line.menuItemId];
          if (!item) return null;
          return { ...item, ...line, key: line.key };
        })
        .filter(Boolean),
    [cart, menuById],
  );

  const itemsCount = cartLines.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cartLines.reduce((s, i) => s + Number(i.price) * i.quantity, 0);
  const tipAmount = tipCustomMode
    ? Math.max(0, Number(tipCustomAmount) || 0)
    : Math.round(cartTotal * (tipPercent / 100));
  const serviceChargeAmount = includeServiceCharge ? Math.round(cartTotal * (SERVICE_CHARGE_PERCENT / 100)) : 0;
  const deliveryAmount = modeOrder === "delivery" ? Number(unlock?.delivery_fee || 0) : 0;
  const grandTotal = cartTotal + tipAmount + deliveryAmount + serviceChargeAmount;

  function addToCart(menuItemId, delta = 1) {
    setCart((prev) => {
      // +/- в меню всегда к «чистой» позиции без убранных ингредиентов
      const key = cartLineKey(menuItemId, []);
      const idx = prev.findIndex((l) => l.key === key);
      if (idx >= 0) {
        const next = [...prev];
        const qty = Math.max(0, next[idx].quantity + delta);
        if (qty === 0) {
          next.splice(idx, 1);
          return next;
        }
        next[idx] = { ...next[idx], quantity: qty };
        return next;
      }
      if (delta <= 0) return prev;
      return [...prev, { key, menuItemId, quantity: delta, removed: [] }];
    });
  }

  function changeLineQty(lineKey, delta) {
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.key === lineKey);
      if (idx < 0) return prev;
      const next = [...prev];
      const qty = Math.max(0, next[idx].quantity + delta);
      if (qty === 0) {
        next.splice(idx, 1);
        return next;
      }
      next[idx] = { ...next[idx], quantity: qty };
      return next;
    });
  }

  function toggleRemoved(lineKey, ingredientName) {
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.key === lineKey);
      if (idx < 0) return prev;
      const line = prev[idx];
      // Если в линии несколько штук — отделяем одну с новой кастомизацией
      const working =
        line.quantity > 1
          ? { ...line, quantity: 1 }
          : line;
      const restQty = line.quantity > 1 ? line.quantity - 1 : 0;
      const removed = working.removed.includes(ingredientName)
        ? working.removed.filter((x) => x !== ingredientName)
        : [...working.removed, ingredientName];
      const newKey = cartLineKey(line.menuItemId, removed);
      let next = [...prev];
      if (restQty > 0) {
        next[idx] = { ...line, quantity: restQty };
      } else {
        next.splice(idx, 1);
      }
      const dup = next.findIndex((l) => l.key === newKey);
      if (dup >= 0) {
        next[dup] = { ...next[dup], quantity: next[dup].quantity + 1 };
      } else {
        next.push({ key: newKey, menuItemId: line.menuItemId, quantity: 1, removed });
      }
      return next;
    });
  }

  async function unlockTable(e) {
    e.preventDefault();
    setStatus("Проверяем PIN…");
    const res = await fetch(`${API_URL}/cafe/t/${encodeURIComponent(keyId)}/unlock/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(data.pin?.[0] || data.detail || "Неверный пароль");
      return;
    }
    applySession(data);
    setStatus("");
  }

  async function submitOrder(e) {
    e.preventDefault();
    if (!modeOrder) {
      setStatus("Выберите режим заказа");
      return;
    }
    if (!cartLines.length) {
      setStatus("Корзина пуста");
      return;
    }
    setStatus("Оформляем…");
    const res = await fetch(`${API_URL}/cafe/guest/order/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Cafe-Session": session },
      body: JSON.stringify({
        mode: modeOrder,
        pay_method: payMethod,
        guest_name: guestName,
        guest_phone: guestPhone,
        guest_email: guestEmail,
        tip_percent: tipCustomMode ? 0 : tipPercent,
        tip_amount: tipAmount,
        tip_custom: tipCustomMode,
        include_service_charge: includeServiceCharge,
        delivery_address: deliveryAddress,
        items: cartLines.map((i) => ({
          menu_item: i.menuItemId,
          quantity: i.quantity,
          removed_ingredients: i.removed || [],
        })),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(data.detail || data.items?.[0] || data.mode?.[0] || data.guest_email?.[0] || "Ошибка заказа");
      return;
    }
    setOrderResult(data);
    setStatus("");
    if (data.confirmation_url) {
      window.location.href = data.confirmation_url;
      return;
    }
    setCart([]);
    setCartOpen(false);
    setCompletedOrder(data);
  }

  async function rateDish(menuItemId, rating) {
    if (!completedOrder?.id) return;
    setRatingBusy(menuItemId);
    const res = await fetch(`${API_URL}/cafe/menu/items/${menuItemId}/rate/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Cafe-Session": session },
      body: JSON.stringify({ rating, order_id: completedOrder.id }),
    });
    const data = await res.json().catch(() => ({}));
    setRatingBusy(null);
    if (!res.ok) {
      setStatus(data.detail || data.order_id?.[0] || "Не удалось сохранить оценку");
      return;
    }
    setCompletedOrder((prev) => ({
      ...prev,
      item_ratings: [...(prev.item_ratings || []), { menu_item: menuItemId, rating }],
    }));
    setMenu((prev) =>
      prev.map((cat) => ({
        ...cat,
        items: (cat.items || []).map((item) =>
          item.id === menuItemId
            ? { ...item, rating_avg: data.rating_avg, rating_count: data.rating_count }
            : item,
        ),
      })),
    );
  }

  const modes = unlock?.modes || info?.modes || {};
  const ready = Boolean(session) && !booting;
  const needsPin = mode === "table" && !session;
  const ratedIds = new Set((completedOrder?.item_ratings || []).map((r) => r.menu_item));
  const orgName = info?.organization_name || unlock?.organization_name || "Кафе";
  const orgSlug = info?.provider_slug || unlock?.provider_slug || (mode === "org" ? keyId : "");

  const menuJsonLd = useMemo(() => {
    if (mode !== "org" || !orgSlug) return null;
    return [
      {
        "@context": "https://schema.org",
        "@type": "Restaurant",
        name: orgName,
        url: `${SITE_ORIGIN}/m/${orgSlug}`,
        menu: `${SITE_ORIGIN}/m/${orgSlug}`,
        address: info?.organization_address
          ? { "@type": "PostalAddress", streetAddress: info.organization_address, addressCountry: "RU" }
          : undefined,
        hasMenu: menu.length
          ? {
              "@type": "Menu",
              hasMenuSection: menu.map((cat) => ({
                "@type": "MenuSection",
                name: cat.name,
                hasMenuItem: (cat.items || []).slice(0, 30).map((item) => ({
                  "@type": "MenuItem",
                  name: item.name,
                  description: item.description || item.name,
                  offers: { "@type": "Offer", price: String(item.price ?? ""), priceCurrency: "RUB" },
                })),
              })),
            }
          : undefined,
      },
      breadcrumbListJsonLd([
        { name: "Главная", path: "/" },
        { name: orgName, path: `/o/${orgSlug}` },
        { name: "Меню", path: `/m/${orgSlug}` },
      ]),
    ];
  }, [mode, orgSlug, orgName, info?.organization_address, menu]);

  return (
    <div className="cafe-guest">
      {menuJsonLd ? <JsonLd id="vmeste-menu-jsonld" data={menuJsonLd} /> : null}
      <header className="cafe-guest-header">
        <a href="/" aria-label="Вместе">
          <img src={logoMain} alt="Вместе" className="cafe-guest-logo" />
        </a>
        <div className="cafe-guest-head-copy">
          <h1>{orgName}</h1>
          <p>
            {mode === "table"
              ? info?.table_label || unlock?.table_label
                ? `Стол: ${info?.table_label || unlock?.table_label}`
                : booting
                  ? "Открываем меню…"
                  : "Стол"
              : "Самовывоз и доставка"}
          </p>
          {mode === "org" && orgSlug ? (
            <p className="cafe-guest-seo-links">
              <a href={`/o/${orgSlug}`}>Карточка заведения</a>
              {" · "}
              <a href="/">Платформа Вместе</a>
            </p>
          ) : null}
        </div>
        {ready ? (
          <button type="button" className="cafe-cart-fab" onClick={() => setCartOpen(true)} aria-label="Открыть корзину">
            <span className="cafe-cart-fab-icon"><CartIcon /></span>
            <span className="cafe-cart-fab-price">{cartTotal.toLocaleString("ru-RU")} ₽</span>
            {itemsCount > 0 ? <span className="cafe-cart-fab-count">{itemsCount}</span> : null}
          </button>
        ) : null}
      </header>

      {booting && !info ? <p className="cafe-guest-status">Открываем меню…</p> : null}

      {needsPin ? (
        <form className="cafe-guest-card" onSubmit={unlockTable}>
          <h2>Введите пароль стола</h2>
          <p className="muted">Без верного PIN оформить заказ нельзя</p>
          <input
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            placeholder="••••••"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            required
          />
          <button type="submit" className="landing-btn landing-btn--primary">
            Войти в меню
          </button>
        </form>
      ) : null}

      {ready ? (
        <>
          <section className="cafe-guest-modes">
            {Object.entries(MODE_META).map(([key, meta]) =>
              modes[key] ? (
                <button
                  key={key}
                  type="button"
                  className={`cafe-mode-btn${modeOrder === key ? " is-active" : ""}`}
                  onClick={() => setModeOrder(key)}
                >
                  <span aria-hidden="true">{meta.icon}</span>
                  {meta.label}
                </button>
              ) : null,
            )}
          </section>

          {completedOrder?.can_rate ? (
            <section className="cafe-guest-card cafe-rating-panel">
              <h2>Оцените блюда из заказа #{completedOrder.id}</h2>
              <p className="muted small">Оценку можно поставить только после оформления заказа.</p>
              <ul className="cafe-rating-list">
                {(completedOrder.items || []).map((line) => {
                  const rated = ratedIds.has(line.menu_item);
                  const existing = (completedOrder.item_ratings || []).find((r) => r.menu_item === line.menu_item);
                  return (
                    <li key={line.id} className="cafe-rating-row">
                      <span>{line.name}</span>
                      <Stars
                        value={existing?.rating || 0}
                        readOnly={rated}
                        onChange={(n) => rateDish(line.menu_item, n)}
                      />
                      {ratingBusy === line.menu_item ? <span className="muted small">…</span> : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <section className="cafe-guest-menu">
            {menu.map((cat) => (
              <div key={cat.id} className="cafe-menu-cat">
                <h2>{cat.name}</h2>
                <div className="cafe-menu-grid">
                  {(cat.items || []).map((item) => (
                    <article key={item.id} className="cafe-menu-item">
                      {item.is_new || cat.is_novelties ? <span className="cafe-new-badge">Новинка</span> : null}
                      {item.photos?.[0]?.url ? (
                        <img src={item.photos[0].url} alt={item.name || "Блюдо"} loading="lazy" width={96} height={96} />
                      ) : (
                        <div className="cafe-menu-ph" />
                      )}
                      <h3>{item.name}</h3>
                      {item.rating_avg != null ? (
                        <p className="muted small cafe-rating-readonly">★ {item.rating_avg} ({item.rating_count})</p>
                      ) : (
                        <p className="muted small cafe-rating-readonly">Пока без оценок</p>
                      )}
                      {item.composition ? <p className="muted small">{item.composition}</p> : null}
                      <div className="cafe-menu-row">
                        <strong>{Number(item.price).toLocaleString("ru-RU")} ₽</strong>
                        <div className="cafe-qty">
                          <button type="button" onClick={() => addToCart(item.id, -1)}>−</button>
                          <span>{cart.filter((l) => l.menuItemId === item.id).reduce((s, l) => s + l.quantity, 0)}</span>
                          <button type="button" onClick={() => addToCart(item.id, 1)}>+</button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
            {!menu.length ? <p className="muted">Меню пока пустое — добавьте блюда в кабинете.</p> : null}
          </section>
        </>
      ) : null}

      {cartOpen ? (
        <div className="cafe-cart-modal" onClick={() => setCartOpen(false)}>
          <div className="cafe-cart-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="cafe-cart-sheet-head">
              <h2>Корзина</h2>
              <button type="button" className="cafe-cart-close" onClick={() => setCartOpen(false)} aria-label="Закрыть">
                <CloseIcon />
              </button>
            </div>
            {!cartLines.length ? <p className="muted">Корзина пока пустая.</p> : null}
            {cartLines.length > 0 ? (
              <form className="cafe-guest-card cafe-checkout" onSubmit={submitOrder}>
                <ul className="cafe-cart-lines">
                  {cartLines.map((i) => (
                    <li key={i.key} className="cafe-cart-line">
                      {i.photos?.[0]?.url ? (
                        <img className="cafe-cart-line-photo" src={i.photos[0].url} alt="" />
                      ) : (
                        <div className="cafe-cart-line-photo cafe-menu-ph" />
                      )}
                      <div className="cafe-cart-line-body">
                        <strong>{i.name}</strong>
                        <div className="cafe-qty cafe-cart-line-qty">
                          <button type="button" onClick={() => changeLineQty(i.key, -1)}>−</button>
                          <span>{i.quantity}</span>
                          <button type="button" onClick={() => changeLineQty(i.key, 1)}>+</button>
                          <span className="muted small">× {Number(i.price).toLocaleString("ru-RU")} ₽</span>
                        </div>
                        {(i.removed || []).length ? (
                          <p className="muted small">Без: {(i.removed || []).join(", ")}</p>
                        ) : null}
                        {(i.removable_ingredients || []).length > 0 ? (
                          <div className="cafe-ingredient-chips">
                            {(i.removable_ingredients || []).map((ing) => (
                              <button
                                key={ing.id || ing.name}
                                type="button"
                                className={`cafe-ingredient-chip${(i.removed || []).includes(ing.name) ? " is-removed" : ""}`}
                                onClick={() => toggleRemoved(i.key, ing.name)}
                              >
                                {(i.removed || []).includes(ing.name) ? "− " : ""}
                                {ing.name}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <strong className="cafe-cart-line-price">{(Number(i.price) * i.quantity).toLocaleString("ru-RU")} ₽</strong>
                    </li>
                  ))}
                </ul>
                {(modeOrder === "takeaway" || modeOrder === "delivery") && (
                  <>
                    <input placeholder="Имя" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
                    <input placeholder="Телефон *" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} required />
                  </>
                )}
                <input
                  placeholder="Email для чека (необязательно)"
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                />
                {modeOrder === "delivery" ? (
                  <textarea
                    placeholder="Адрес доставки *"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    required
                    rows={2}
                  />
                ) : null}
                <label>
                  Оплата
                  <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                    {unlock?.pay_methods?.online ? <option value="online">Онлайн</option> : null}
                    {unlock?.pay_methods?.cash ? <option value="cash">Наличные</option> : null}
                    {unlock?.pay_methods?.card_on_spot ? <option value="card_on_spot">Картой на месте</option> : null}
                  </select>
                </label>
                {!unlock?.pay_methods?.online && !unlock?.pay_methods?.cash && !unlock?.pay_methods?.card_on_spot ? (
                  <p className="muted small">Нет доступных способов оплаты. Организация ещё не настроила приём платежей.</p>
                ) : null}
                <label className="cafe-tip-block">
                  <span className="cafe-tip-head">
                    Чаевые: {tipCustomMode ? `${tipAmount.toLocaleString("ru-RU")} ₽` : `${tipPercent}% (${tipAmount.toLocaleString("ru-RU")} ₽)`}
                  </span>
                  <label className="checkbox cafe-tip-toggle">
                    <input type="checkbox" checked={tipCustomMode} onChange={(e) => setTipCustomMode(e.target.checked)} />
                    <span>Своя сумма</span>
                  </label>
                  {tipCustomMode ? (
                    <input
                      type="number"
                      min="0"
                      placeholder="Сумма чаевых, ₽"
                      value={tipCustomAmount}
                      onChange={(e) => setTipCustomAmount(e.target.value)}
                    />
                  ) : (
                    <input
                      type="range"
                      min="0"
                      max="50"
                      step="1"
                      value={tipPercent}
                      onChange={(e) => setTipPercent(Number(e.target.value) || 0)}
                    />
                  )}
                </label>
                <div className="cafe-total-block">
                  <p>Блюда: <strong>{cartTotal.toLocaleString("ru-RU")} ₽</strong></p>
                  {deliveryAmount > 0 ? <p>Доставка: <strong>{deliveryAmount.toLocaleString("ru-RU")} ₽</strong></p> : null}
                  {tipAmount > 0 ? <p>Чаевые: <strong>{tipAmount.toLocaleString("ru-RU")} ₽</strong></p> : null}
                  {serviceChargeAmount > 0 ? (
                    <p>Сервисный сбор ({SERVICE_CHARGE_PERCENT}%): <strong>{serviceChargeAmount.toLocaleString("ru-RU")} ₽</strong></p>
                  ) : null}
                  <p className="cafe-grand-total">Итого: <strong>{grandTotal.toLocaleString("ru-RU")} ₽</strong></p>
                </div>
                <label className="checkbox cafe-service-charge">
                  <input
                    type="checkbox"
                    checked={includeServiceCharge}
                    onChange={(e) => setIncludeServiceCharge(e.target.checked)}
                  />
                  <span>Сервисный сбор {SERVICE_CHARGE_PERCENT}% (поддержка платформы)</span>
                </label>
                <button type="submit" className="landing-btn landing-btn--primary">Оформить заказ</button>
                {orderResult && !orderResult.confirmation_url ? (
                  <p className="landing-form-status">
                    Заказ #{orderResult.id} принят{guestEmail ? `, чек отправим на ${guestEmail} после оплаты` : ""}
                  </p>
                ) : null}
              </form>
            ) : null}
          </div>
        </div>
      ) : null}

      {status ? <p className="cafe-guest-status">{status}</p> : null}
    </div>
  );
}
