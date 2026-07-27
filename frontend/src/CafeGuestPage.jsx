import { useEffect, useMemo, useState } from "react";
import { API_URL } from "./config.js";
import { setPageMeta } from "./seo/setPageMeta.js";
import "./landing.css";
import "./cafeGuest.css";

const MODE_META = {
  dine_in: { label: "За столом", icon: "🍽️" },
  takeaway: { label: "Самовывоз", icon: "🛍️" },
  delivery: { label: "Доставка", icon: "🛵" },
};

/**
 * mode: "table" | "org"
 * key: table token or org slug
 */
export default function CafeGuestPage({ mode = "table", keyId }) {
  const storageKey = `cafe_sess_${mode}_${keyId}`;
  const [info, setInfo] = useState(null);
  const [pin, setPin] = useState("");
  const [session, setSession] = useState(() => sessionStorage.getItem(storageKey) || "");
  const [unlock, setUnlock] = useState(null);
  const [modeOrder, setModeOrder] = useState("");
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState({});
  const [status, setStatus] = useState("");
  const [payMethod, setPayMethod] = useState("online");
  const [guestPhone, setGuestPhone] = useState("+7");
  const [guestName, setGuestName] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [orderResult, setOrderResult] = useState(null);

  useEffect(() => {
    setStatus("");
    if (mode === "org") {
      fetch(`${API_URL}/cafe/m/${encodeURIComponent(keyId)}/`)
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.detail || "Заведение не найдено");
          setInfo(data);
          setPageMeta({
            title: `${data.organization_name || "Кафе"} · меню`,
            description: "Меню и заказ через Вместе",
            path: `/m/${keyId}`,
            robots: "index,follow",
          });
        })
        .catch((e) => setStatus(e.message));
      return;
    }
    fetch(`${API_URL}/cafe/t/${encodeURIComponent(keyId)}/`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || "Стол не найден");
        setInfo(data);
        setPageMeta({
          title: `${data.organization_name || "Кафе"} · стол`,
          description: "Меню и заказ через Вместе",
          path: `/t/${keyId}`,
          robots: "noindex,nofollow",
        });
      })
      .catch((e) => setStatus(e.message));
  }, [mode, keyId]);

  useEffect(() => {
    if (!session) return;
    fetch(`${API_URL}/cafe/guest/menu/`, { headers: { "X-Cafe-Session": session } })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          sessionStorage.removeItem(storageKey);
          setSession("");
          throw new Error(data.detail || "Сессия истекла");
        }
        setMenu(data.categories || []);
      })
      .catch((e) => setStatus(e.message));
  }, [session, storageKey]);

  async function doUnlock(e) {
    e.preventDefault();
    setStatus("Открываем меню…");
    if (mode === "org") {
      const res = await fetch(`${API_URL}/cafe/m/${encodeURIComponent(keyId)}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(data.detail || "Не удалось открыть меню");
        return;
      }
      sessionStorage.setItem(storageKey, data.session_token);
      setSession(data.session_token);
      setUnlock(data);
      setStatus("");
      return;
    }
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
    sessionStorage.setItem(storageKey, data.session_token);
    setSession(data.session_token);
    setUnlock(data);
    setStatus("");
  }

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

  const cartTotal = cartLines.reduce((s, i) => s + Number(i.price) * i.quantity, 0);

  function addToCart(id, delta) {
    setCart((prev) => {
      const next = { ...prev, [id]: Math.max(0, (prev[id] || 0) + delta) };
      if (next[id] === 0) delete next[id];
      return next;
    });
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
        delivery_address: deliveryAddress,
        items: cartLines.map((i) => ({ menu_item: i.id, quantity: i.quantity })),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(data.detail || data.items?.[0] || data.mode?.[0] || "Ошибка заказа");
      return;
    }
    setOrderResult(data);
    setStatus("");
    if (data.confirmation_url) window.location.href = data.confirmation_url;
  }

  const modes = unlock?.modes || info?.modes || {};

  return (
    <div className="cafe-guest">
      <header className="cafe-guest-header">
        <a href="/">Вместе</a>
        <h1>{info?.organization_name || "Кафе"}</h1>
        <p>
          {mode === "table"
            ? info?.table_label
              ? `Стол: ${info.table_label}`
              : "Загрузка стола…"
            : "Самовывоз и доставка"}
        </p>
      </header>

      {!session ? (
        <form className="cafe-guest-card" onSubmit={doUnlock}>
          {mode === "table" ? (
            <>
              <h2>Введите пароль стола</h2>
              <p className="muted">6 цифр с карточки / QR</p>
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
            </>
          ) : (
            <>
              <h2>Меню заведения</h2>
              <p className="muted">Заказ навынос или с доставкой — без PIN стола</p>
              <button type="submit" className="landing-btn landing-btn--primary">
                Открыть меню
              </button>
            </>
          )}
        </form>
      ) : (
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
                      {item.photos?.[0]?.url ? (
                        <img src={item.photos[0].url} alt="" loading="lazy" />
                      ) : (
                        <div className="cafe-menu-ph" />
                      )}
                      <h3>{item.name}</h3>
                      {item.rating_avg != null ? (
                        <p className="muted small">
                          ★ {item.rating_avg} ({item.rating_count})
                        </p>
                      ) : null}
                      <div className="cafe-rate-row" aria-label="Оценить блюдо">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            className="cafe-rate-star"
                            onClick={async () => {
                              const res = await fetch(`${API_URL}/cafe/menu/items/${item.id}/rate/`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ rating: star }),
                              });
                              if (!res.ok) return;
                              const data = await res.json();
                              setMenu((prev) =>
                                prev.map((cat) => ({
                                  ...cat,
                                  items: (cat.items || []).map((it) =>
                                    it.id === item.id
                                      ? { ...it, rating_avg: data.rating_avg, rating_count: data.rating_count }
                                      : it,
                                  ),
                                })),
                              );
                            }}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                      {item.composition ? <p className="muted small">{item.composition}</p> : null}
                      <div className="cafe-menu-row">
                        <strong>{Number(item.price).toLocaleString("ru-RU")} ₽</strong>
                        <div className="cafe-qty">
                          <button type="button" onClick={() => addToCart(item.id, -1)}>
                            −
                          </button>
                          <span>{cart[item.id] || 0}</span>
                          <button type="button" onClick={() => addToCart(item.id, 1)}>
                            +
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
            {!menu.length ? <p className="muted">Меню пока пустое — добавьте блюда в кабинете.</p> : null}
          </section>

          {cartLines.length > 0 ? (
            <form className="cafe-guest-card cafe-checkout" onSubmit={submitOrder}>
              <h2>Заказ · {cartTotal.toLocaleString("ru-RU")} ₽</h2>
              <ul>
                {cartLines.map((i) => (
                  <li key={i.id}>
                    {i.name} × {i.quantity}
                  </li>
                ))}
              </ul>
              {(modeOrder === "takeaway" || modeOrder === "delivery") && (
                <>
                  <input placeholder="Имя" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
                  <input placeholder="Телефон *" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} required />
                </>
              )}
              {modeOrder === "delivery" && (
                <textarea
                  placeholder="Адрес доставки *"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  required
                  rows={2}
                />
              )}
              <label>
                Оплата
                <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                  {unlock?.pay_methods?.online !== false && <option value="online">Онлайн</option>}
                  {unlock?.pay_methods?.cash && <option value="cash">Наличные</option>}
                  {unlock?.pay_methods?.card_on_spot && <option value="card_on_spot">Картой на месте</option>}
                </select>
              </label>
              <button type="submit" className="landing-btn landing-btn--primary">
                Оформить
              </button>
              {orderResult && !orderResult.confirmation_url ? (
                <p className="landing-form-status">Заказ #{orderResult.id} принят</p>
              ) : null}
            </form>
          ) : null}
        </>
      )}
      {status ? <p className="cafe-guest-status">{status}</p> : null}
    </div>
  );
}
