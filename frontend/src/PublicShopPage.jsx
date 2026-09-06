import logoMain from "./assets/logo-main.png";
import { useEffect, useMemo, useState } from "react";
import { API_URL } from "./config.js";
import CafeGuestDeliveryMap from "./CafeGuestDeliveryMap.jsx";
import ServicePhotoCarousel from "./ServicePhotoCarousel.jsx";
import { ReviewListItem } from "./ProviderReviewsPanel.jsx";
import "./landing.css";
import "./cafeGuest.css";

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden fill="currentColor">
      <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-1.99.9-1.99 2S15.9 22 17 22s2-.9 2-2-.9-2-2-2zM7.17 14h9.95c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0 0 21.58 5H6.21l-.94-2H2v2h2l3.6 7.59-1.35 2.44A2 2 0 0 0 8 18h12v-2H8l1.1-2z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="currentColor">
      <path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12l-4.89 4.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z" />
    </svg>
  );
}

/**
 * Публичная витрина магазина — UX как у гостевого меню кафе.
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
  const [cartOpen, setCartOpen] = useState(false);
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [catFilter, setCatFilter] = useState("");

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
    if (!oid || !slug) return undefined;
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

  useEffect(() => {
    const pid = data?.provider?.id;
    if (!pid) return undefined;
    let cancelled = false;
    (async () => {
      const res = await fetch(`${API_URL}/reviews/?provider=${encodeURIComponent(pid)}&ordering=-created_at`);
      if (!res.ok || cancelled) return;
      const list = await res.json();
      const rows = Array.isArray(list) ? list : list.results || [];
      if (!cancelled) setReviews(rows.slice(0, 12));
    })();
    return () => {
      cancelled = true;
    };
  }, [data?.provider?.id]);

  const products = data?.products || [];
  const categories = data?.categories || [];
  const settings = data?.settings || {};

  const visibleProducts = useMemo(() => {
    if (!catFilter) return products;
    return products.filter((p) => String(p.category) === String(catFilter));
  }, [products, catFilter]);

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
  const cartCount = cartLines.reduce((s, l) => s + l.qty, 0);

  function addToCart(productId, n = 1) {
    setCart((prev) => ({ ...prev, [productId]: (prev[productId] || 0) + n }));
  }

  function setQty(productId, qty) {
    setCart((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[productId];
      else next[productId] = qty;
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
      setCartOpen(false);
    } catch (e) {
      setError(e.message || "Ошибка заказа");
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) {
    return (
      <main className="cafe-guest page">
        <header className="cafe-guest-topbar">
          <a className="cafe-guest-back" href="/">
            ← На главную
          </a>
        </header>
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
      <header className="cafe-guest-topbar">
        <button
          type="button"
          className="cafe-guest-back"
          aria-label="Назад на карту"
          onClick={() => {
            window.location.href = "/map";
          }}
        >
          ←
        </button>
        <img src={logoMain} alt="Вместе" className="cafe-guest-logo" />
        <button type="button" className="cafe-guest-cart-btn" onClick={() => setCartOpen(true)} aria-label="Корзина">
          <CartIcon />
          {cartCount > 0 ? <span className="cafe-guest-cart-badge">{cartCount}</span> : null}
        </button>
      </header>

      <div className="cafe-guest-hero">
        <h1>{orgName}</h1>
        <p className="muted">Товары · самовывоз и доставка</p>
      </div>

      {orderInfo ? (
        <section className="card cafe-guest-order-card">
          <h2>Заказ #{orderInfo.id}</h2>
          <p>
            Статус: <strong>{orderInfo.status}</strong>
            {orderInfo.total != null ? ` · ${Number(orderInfo.total).toLocaleString("ru-RU")} ₽` : ""}
          </p>
        </section>
      ) : null}

      {error ? <p className="status error">{error}</p> : null}

      <div className="shop-public-cats">
        <button
          type="button"
          className={!catFilter ? "primary-btn" : "ghost-btn"}
          onClick={() => setCatFilter("")}
        >
          Все
        </button>
        {categories
          .filter((c) => products.some((p) => String(p.category) === String(c.id)))
          .map((c) => (
          <button
            key={c.id}
            type="button"
            className={String(catFilter) === String(c.id) ? "primary-btn" : "ghost-btn"}
            onClick={() => setCatFilter(String(c.id))}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="cafe-guest-menu-grid shop-public-grid">
        {visibleProducts.map((p) => {
          const cover = p.photos?.[0]?.thumb_url || p.photos?.[0]?.image;
          return (
            <article key={p.id} className="cafe-guest-dish-card" onClick={() => setProduct(p)}>
              {cover ? <img src={cover} alt="" className="cafe-guest-dish-photo" /> : <div className="cafe-guest-dish-photo is-empty" />}
              <div className="cafe-guest-dish-body">
                <strong>{p.name}</strong>
                <p className="muted small">{Number(p.price).toLocaleString("ru-RU")} ₽</p>
                <button
                  type="button"
                  className="landing-btn landing-btn--primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    addToCart(p.id);
                  }}
                >
                  В корзину
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {product ? (
        <div className="cafe-guest-sheet" role="dialog" aria-label="Карточка товара">
          <div className="cafe-guest-sheet-panel shop-product-sheet">
            <button type="button" className="cafe-guest-sheet-close" onClick={() => setProduct(null)} aria-label="Закрыть">
              <CloseIcon />
            </button>
            <ServicePhotoCarousel
              items={(product.photos || []).map((ph) => ({
                id: ph.id,
                image: ph.image,
                thumb_url: ph.thumb_url,
                source: "product",
              }))}
              className="shop-product-carousel"
            />
            <h2>{product.name}</h2>
            <p className="shop-product-price">{Number(product.price).toLocaleString("ru-RU")} ₽</p>
            {product.description ? <p className="shop-product-desc">{product.description}</p> : null}
            {product.attrs && Object.keys(product.attrs).length ? (
              <dl className="shop-product-attrs">
                {Object.entries(product.attrs).map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{String(v)}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            <button
              type="button"
              className="landing-btn landing-btn--primary"
              onClick={() => {
                addToCart(product.id);
                setProduct(null);
                setCartOpen(true);
              }}
            >
              В корзину
            </button>

            <section className="shop-product-reviews">
              <h3>Отзывы об организации</h3>
              {!reviews.length ? <p className="muted small">Пока нет отзывов.</p> : null}
              <ul className="reviews-list">
                {reviews.slice(0, 6).map((r) => (
                  <ReviewListItem key={r.id} review={r} showClientName />
                ))}
              </ul>
            </section>
          </div>
        </div>
      ) : null}

      {cartOpen ? (
        <div className="cafe-guest-sheet" role="dialog" aria-label="Корзина">
          <div className="cafe-guest-sheet-panel">
            <button type="button" className="cafe-guest-sheet-close" onClick={() => setCartOpen(false)} aria-label="Закрыть">
              <CloseIcon />
            </button>
            <h2>Корзина · {itemsTotal.toLocaleString("ru-RU")} ₽</h2>
            {!cartLines.length ? <p className="muted">Пока пусто</p> : null}
            <ul className="cafe-guest-cart-lines">
              {cartLines.map((l) => (
                <li key={l.product.id}>
                  <span>
                    {l.product.name} · {Number(l.product.price).toLocaleString("ru-RU")} ₽
                  </span>
                  <span className="cafe-guest-qty">
                    <button type="button" onClick={() => setQty(l.product.id, l.qty - 1)}>
                      −
                    </button>
                    <em>{l.qty}</em>
                    <button type="button" onClick={() => setQty(l.product.id, l.qty + 1)}>
                      +
                    </button>
                  </span>
                </li>
              ))}
            </ul>

            <div className="row-2" style={{ margin: "12px 0" }}>
              {settings.enable_pickup ? (
                <button
                  type="button"
                  className={mode === "pickup" ? "primary-btn" : "ghost-btn"}
                  onClick={() => setMode("pickup")}
                >
                  Самовывоз
                </button>
              ) : null}
              {settings.enable_delivery ? (
                <button
                  type="button"
                  className={mode === "delivery" ? "primary-btn" : "ghost-btn"}
                  onClick={() => setMode("delivery")}
                >
                  Доставка
                </button>
              ) : null}
            </div>

            <label className="shop-field">
              <span className="shop-field-label">Имя</span>
              <input value={guest.name} onChange={(e) => setGuest((g) => ({ ...g, name: e.target.value }))} />
            </label>
            <label className="shop-field">
              <span className="shop-field-label">Телефон</span>
              <input value={guest.phone} onChange={(e) => setGuest((g) => ({ ...g, phone: e.target.value }))} />
            </label>
            <label className="shop-field">
              <span className="shop-field-label">Email</span>
              <input value={guest.email} onChange={(e) => setGuest((g) => ({ ...g, email: e.target.value }))} />
            </label>
            {mode === "delivery" ? (
              <>
                <label className="shop-field">
                  <span className="shop-field-label">Адрес</span>
                  <input
                    value={guest.address}
                    onChange={(e) => setGuest((g) => ({ ...g, address: e.target.value }))}
                  />
                </label>
                <CafeGuestDeliveryMap
                  zones={settings.delivery_zones || []}
                  pin={pin}
                  onPick={(next) => {
                    setPin(next);
                    if (next?.address) setGuest((g) => ({ ...g, address: next.address }));
                  }}
                />
              </>
            ) : null}

            <button
              type="button"
              className="landing-btn landing-btn--primary"
              disabled={busy || !cartLines.length}
              onClick={() => void checkout()}
            >
              {busy ? "Оформляем…" : "Оплатить"}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
