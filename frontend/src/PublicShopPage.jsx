import { useEffect, useMemo, useState } from "react";
import { API_URL } from "./config.js";
import CafeGuestDeliveryMap from "./CafeGuestDeliveryMap.jsx";
import "./cafeGuest.css";

/**
 * Публичная витрина магазина организации: /s/{slug}
 */
export default function PublicShopPage({ slug }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [cart, setCart] = useState({});
  const [mode, setMode] = useState("pickup");
  const [guest, setGuest] = useState({ name: "", phone: "", email: "", address: "" });
  const [pin, setPin] = useState(null);
  const [busy, setBusy] = useState(false);
  const [orderInfo, setOrderInfo] = useState(null);
  const [openCat, setOpenCat] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/shop/public/${encodeURIComponent(slug)}/`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.detail || "Магазин не найден");
        if (!cancelled) {
          setData(json);
          const settings = json.settings || {};
          if (settings.enable_pickup) setMode("pickup");
          else if (settings.enable_delivery) setMode("delivery");
        }
      } catch (e) {
        if (!cancelled) setError(e.message || "Ошибка загрузки");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oid = params.get("order");
    if (!oid || !slug) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`${API_URL}/shop/public/${encodeURIComponent(slug)}/order/${oid}/`);
      if (!res.ok || cancelled) return;
      setOrderInfo(await res.json());
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const products = data?.products || [];
  const categories = data?.categories || [];
  const settings = data?.settings || {};

  const cartLines = useMemo(() => {
    return Object.entries(cart)
      .map(([id, qty]) => {
        const p = products.find((x) => String(x.id) === String(id));
        if (!p || qty < 1) return null;
        return { product: p, qty };
      })
      .filter(Boolean);
  }, [cart, products]);

  const itemsTotal = cartLines.reduce((s, l) => s + Number(l.product.price) * l.qty, 0);

  function addToCart(productId) {
    setCart((prev) => ({ ...prev, [productId]: (prev[productId] || 0) + 1 }));
  }

  function decCart(productId) {
    setCart((prev) => {
      const next = { ...prev };
      const q = (next[productId] || 0) - 1;
      if (q <= 0) delete next[productId];
      else next[productId] = q;
      return next;
    });
  }

  async function checkout() {
    if (!cartLines.length) return;
    setBusy(true);
    setError("");
    try {
      const body = {
        mode,
        items: cartLines.map((l) => ({ product_id: l.product.id, quantity: l.qty })),
        guest_name: guest.name,
        guest_phone: guest.phone,
        guest_email: guest.email,
        delivery_address: guest.address,
        delivery_lat: pin?.lat,
        delivery_lon: pin?.lon,
        return_url: `${window.location.origin}/s/${slug}`,
      };
      const res = await fetch(`${API_URL}/shop/public/${encodeURIComponent(slug)}/order/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.detail || "Не удалось оформить заказ");
      if (json.confirmation_url) {
        window.location.href = json.confirmation_url;
        return;
      }
      setOrderInfo({ id: json.order_id, status: json.status, total: json.total });
      setCart({});
    } catch (e) {
      setError(e.message || "Ошибка заказа");
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) {
    return (
      <main className="cafe-guest page">
        <h1>Магазин</h1>
        <p className="status error">{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="cafe-guest page">
        <p className="muted">Загрузка витрины…</p>
      </main>
    );
  }

  const orgName = data.provider?.organization_name || "Магазин";

  return (
    <main className="cafe-guest page shop-public-page">
      <header className="cafe-guest-header">
        <h1>{orgName}</h1>
        <p className="muted">Товары · самовывоз и доставка</p>
      </header>

      {orderInfo && (
        <section className="card" style={{ marginBottom: 16 }}>
          <h2>Заказ #{orderInfo.id}</h2>
          <p>
            Статус: <strong>{orderInfo.status}</strong>
            {orderInfo.total != null ? ` · ${Number(orderInfo.total).toLocaleString("ru-RU")} ₽` : ""}
          </p>
        </section>
      )}

      {error ? <p className="status error">{error}</p> : null}

      <div className="tree-list catalog-tree">
        {categories.map((cat) => {
          const open = openCat[cat.id] ?? true;
          const items = products.filter((p) => Number(p.category) === Number(cat.id));
          if (!items.length) return null;
          return (
            <div key={cat.id} className="tree-node">
              <button
                type="button"
                className="tree-toggle"
                onClick={() => setOpenCat((p) => ({ ...p, [cat.id]: !open }))}
              >
                {open ? "▼" : "▶"} {cat.name}
              </button>
              {open &&
                items.map((p) => (
                  <article key={p.id} className="loyalty-package-card" style={{ margin: "8px 0" }}>
                    {(p.photos?.[0]?.thumb_url || p.photos?.[0]?.image) && (
                      <img
                        src={p.photos[0].thumb_url || p.photos[0].image}
                        alt=""
                        className="loyalty-package-cover"
                      />
                    )}
                    <strong>{p.name}</strong>
                    <p className="muted small">{Number(p.price).toLocaleString("ru-RU")} ₽</p>
                    {p.description ? <p className="small">{p.description}</p> : null}
                    <div className="row-2">
                      <button type="button" onClick={() => addToCart(p.id)}>
                        В корзину {cart[p.id] ? `(${cart[p.id]})` : ""}
                      </button>
                      {cart[p.id] ? (
                        <button type="button" className="ghost-btn" onClick={() => decCart(p.id)}>
                          −
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
            </div>
          );
        })}
        {products
          .filter((p) => !p.category)
          .map((p) => (
            <article key={p.id} className="loyalty-package-card" style={{ margin: "8px 0" }}>
              <strong>{p.name}</strong>
              <p className="muted small">{Number(p.price).toLocaleString("ru-RU")} ₽</p>
              <button type="button" onClick={() => addToCart(p.id)}>
                В корзину {cart[p.id] ? `(${cart[p.id]})` : ""}
              </button>
            </article>
          ))}
      </div>

      {cartLines.length > 0 && (
        <section className="card" style={{ marginTop: 20, position: "sticky", bottom: 8 }}>
          <h2>Корзина · {itemsTotal.toLocaleString("ru-RU")} ₽</h2>
          <div className="row-2" style={{ marginBottom: 8 }}>
            {settings.enable_pickup && (
              <button
                type="button"
                className={mode === "pickup" ? "primary-btn" : "ghost-btn"}
                onClick={() => setMode("pickup")}
              >
                Самовывоз
              </button>
            )}
            {settings.enable_delivery && (
              <button
                type="button"
                className={mode === "delivery" ? "primary-btn" : "ghost-btn"}
                onClick={() => setMode("delivery")}
              >
                Доставка
              </button>
            )}
          </div>
          <input
            placeholder="Имя"
            value={guest.name}
            onChange={(e) => setGuest((g) => ({ ...g, name: e.target.value }))}
          />
          <input
            placeholder="Телефон"
            value={guest.phone}
            onChange={(e) => setGuest((g) => ({ ...g, phone: e.target.value }))}
          />
          <input
            placeholder="Email"
            value={guest.email}
            onChange={(e) => setGuest((g) => ({ ...g, email: e.target.value }))}
          />
          {mode === "delivery" && (
            <>
              <input
                placeholder="Адрес"
                value={guest.address}
                onChange={(e) => setGuest((g) => ({ ...g, address: e.target.value }))}
              />
              <CafeGuestDeliveryMap
                zones={settings.delivery_zones || []}
                pin={pin}
                onPick={(next) => {
                  setPin(next);
                  if (next?.address) setGuest((g) => ({ ...g, address: next.address }));
                }}
              />
            </>
          )}
          <button type="button" className="primary-btn" disabled={busy} onClick={() => void checkout()}>
            {busy ? "Оформляем…" : "Оплатить"}
          </button>
        </section>
      )}
    </main>
  );
}
