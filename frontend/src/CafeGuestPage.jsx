import logoMain from "./assets/logo-main.png";
import { useCallback, useEffect, useMemo, useState } from "react";
import { API_URL } from "./config.js";
import { setPageMeta } from "./seo/setPageMeta.js";
import "./landing.css";
import "./cafeGuest.css";

const MODE_META = {
  dine_in: { label: "За столом", icon: "🍽️" },
  takeaway: { label: "Самовывоз", icon: "🛍️" },
  delivery: { label: "Доставка", icon: "🛵" },
};

function pickDefaultMode(modes = {}) {
  if (modes.dine_in) return "dine_in";
  if (modes.takeaway) return "takeaway";
  if (modes.delivery) return "delivery";
  return "";
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor">
      <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-1.99.9-1.99 2S15.9 22 17 22s2-.9 2-2-.9-2-2-2zM7.17 14h9.95c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0 0 21.58 5H6.21l-.94-2H2v2h2l3.6 7.59-1.35 2.44A2 2 0 0 0 8 18h12v-2H8l1.1-2z" />
    </svg>
  );
}

export default function CafeGuestPage({ mode = "table", keyId }) {
  const storageKey = `cafe_sess_${mode}_${keyId}`;
  const [info, setInfo] = useState(null);
  const [pin, setPin] = useState("");
  const [session, setSession] = useState(() => (mode === "org" ? sessionStorage.getItem(storageKey) || "" : ""));
  const [unlock, setUnlock] = useState(null);
  const [modeOrder, setModeOrder] = useState("");
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState({});
  const [status, setStatus] = useState("");
  const [booting, setBooting] = useState(true);
  const [cartOpen, setCartOpen] = useState(false);
  const [payMethod, setPayMethod] = useState("online");
  const [guestPhone, setGuestPhone] = useState("+7");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [tipPercent, setTipPercent] = useState(0);
  const [orderResult, setOrderResult] = useState(null);

  const applySession = useCallback(
    (data) => {
      if (!data?.session_token) return;
      sessionStorage.setItem(storageKey, data.session_token);
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
            title: `${infoData.organization_name || "Кафе"} · меню`,
            description: "Меню и заказ через Вместе",
            path: `/m/${keyId}`,
            robots: "index,follow",
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
          setSession("");
          setUnlock(null);
          throw new Error(data.detail || "Сессия истекла");
        }
        setMenu(data.categories || []);
        if (!modeOrder) setModeOrder(pickDefaultMode(unlock?.modes || info?.modes));
      })
      .catch((e) => setStatus(e.message));
  }, [session, storageKey, unlock?.modes, info?.modes, modeOrder]);

  const cartLines = useMemo(() => {
    const lines = [];
    for (const cat of menu) {
      for (const item of cat.items || []) {
        const q = cart[item.id] || 0;
        if (q > 0) lines.push({ ...item, quantity: q });
      }
    }
    return lines;
  }, [cart, menu]);

  const itemsCount = cartLines.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cartLines.reduce((s, i) => s + Number(i.price) * i.quantity, 0);
  const tipAmount = Math.round(cartTotal * (tipPercent / 100));
  const grandTotal = cartTotal + tipAmount + (modeOrder === "delivery" ? Number(unlock?.delivery_fee || 0) : 0);

  function addToCart(id, delta) {
    setCart((prev) => {
      const next = { ...prev, [id]: Math.max(0, (prev[id] || 0) + delta) };
      if (next[id] === 0) delete next[id];
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
        tip_percent: tipPercent,
        delivery_address: deliveryAddress,
        items: cartLines.map((i) => ({ menu_item: i.id, quantity: i.quantity })),
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
    setCart({});
    setCartOpen(false);
  }

  const modes = unlock?.modes || info?.modes || {};
  const ready = Boolean(session) && !booting;
  const needsPin = mode === "table" && !session;

  return (
    <div className="cafe-guest">
      <header className="cafe-guest-header">
        <img src={logoMain} alt="Вместе" className="cafe-guest-logo" />
        <div className="cafe-guest-head-copy">
          <h1>{info?.organization_name || unlock?.organization_name || "Кафе"}</h1>
          <p>
            {mode === "table"
              ? info?.table_label || unlock?.table_label
                ? `Стол: ${info?.table_label || unlock?.table_label}`
                : booting
                  ? "Открываем меню…"
                  : "Стол"
              : "Самовывоз и доставка"}
          </p>
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

          <section className="cafe-guest-menu">
            {menu.map((cat) => (
              <div key={cat.id} className="cafe-menu-cat">
                <h2>{cat.name}</h2>
                <div className="cafe-menu-grid">
                  {(cat.items || []).map((item) => (
                    <article key={item.id} className="cafe-menu-item">
                      {item.is_new || cat.is_novelties ? <span className="cafe-new-badge">Новинка</span> : null}
                      {item.photos?.[0]?.url ? <img src={item.photos[0].url} alt="" loading="lazy" /> : <div className="cafe-menu-ph" />}
                      <h3>{item.name}</h3>
                      {item.rating_avg != null ? <p className="muted small">★ {item.rating_avg} ({item.rating_count})</p> : null}
                      {item.composition ? <p className="muted small">{item.composition}</p> : null}
                      <div className="cafe-menu-row">
                        <strong>{Number(item.price).toLocaleString("ru-RU")} ₽</strong>
                        <div className="cafe-qty">
                          <button type="button" onClick={() => addToCart(item.id, -1)}>−</button>
                          <span>{cart[item.id] || 0}</span>
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
              <button type="button" className="ghost-btn" onClick={() => setCartOpen(false)}>Закрыть</button>
            </div>
            {!cartLines.length ? <p className="muted">Корзина пока пустая.</p> : null}
            {cartLines.length > 0 ? (
              <form className="cafe-guest-card cafe-checkout" onSubmit={submitOrder}>
                <ul className="cafe-cart-lines">
                  {cartLines.map((i) => (
                    <li key={i.id} className="cafe-cart-line">
                      <div>
                        <strong>{i.name}</strong>
                        <p>{i.quantity} × {Number(i.price).toLocaleString("ru-RU")} ₽</p>
                      </div>
                      <strong>{(Number(i.price) * i.quantity).toLocaleString("ru-RU")} ₽</strong>
                    </li>
                  ))}
                </ul>
                {(modeOrder === "takeaway" || modeOrder === "delivery") && (
                  <>
                    <input placeholder="Имя" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
                    <input placeholder="Телефон *" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} required />
                  </>
                )}
                <input placeholder="Email для чека *" type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} required />
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
                    {unlock?.pay_methods?.online !== false ? <option value="online">Онлайн</option> : null}
                    {unlock?.pay_methods?.cash ? <option value="cash">Наличные</option> : null}
                    {unlock?.pay_methods?.card_on_spot ? <option value="card_on_spot">Картой на месте</option> : null}
                  </select>
                </label>
                <label className="cafe-tip-block">
                  <span>Чаевые: {tipPercent}% ({tipAmount.toLocaleString("ru-RU")} ₽)</span>
                  <input type="range" min="0" max="20" step="1" value={tipPercent} onChange={(e) => setTipPercent(Number(e.target.value) || 0)} />
                </label>
                <div className="cafe-total-block">
                  <p>Блюда: <strong>{cartTotal.toLocaleString("ru-RU")} ₽</strong></p>
                  {modeOrder === "delivery" && Number(unlock?.delivery_fee || 0) > 0 ? <p>Доставка: <strong>{Number(unlock?.delivery_fee).toLocaleString("ru-RU")} ₽</strong></p> : null}
                  {tipAmount > 0 ? <p>Чаевые: <strong>{tipAmount.toLocaleString("ru-RU")} ₽</strong></p> : null}
                  <p className="cafe-grand-total">Итого: <strong>{grandTotal.toLocaleString("ru-RU")} ₽</strong></p>
                </div>
                <button type="submit" className="landing-btn landing-btn--primary">Оформить и получить чек</button>
                {orderResult && !orderResult.confirmation_url ? <p className="landing-form-status">Заказ #{orderResult.id} принят, чек отправлен на {guestEmail}</p> : null}
              </form>
            ) : null}
          </div>
        </div>
      ) : null}

      {status ? <p className="cafe-guest-status">{status}</p> : null}
    </div>
  );
}
