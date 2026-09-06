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
 * Публичная витрина магазина — тот же UX, что у гостевого меню кафе.
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
    if (!data?.products?.length) return;
    const params = new URLSearchParams(window.location.search);
    const pid = params.get("product");
    if (!pid) return;
    const found = data.products.find((p) => String(p.id) === String(pid));
    if (found) setProduct(found);
  }, [data]);

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

  const menuByCategory = useMemo(() => {
    const withProducts = categories
      .map((c) => ({
        ...c,
        items: products.filter((p) => String(p.category) === String(c.id)),
      }))
      .filter((c) => c.items.length);
    const loose = products.filter((p) => !p.category);
    if (loose.length) withProducts.push({ id: "loose", name: "Другое", items: loose });
    return withProducts;
  }, [categories, products]);

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
    setCart((prev) => {
      const nextQty = (prev[productId] || 0) + n;
      if (nextQty <= 0) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return { ...prev, [productId]: nextQty };
    });
  }

  function setQty(productId, qty) {
    setCart((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[productId];
      else next[productId] = qty;
      return next;
    });
  }

  async function checkout(e) {
    e?.preventDefault?.();
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
    } catch (err) {
      setError(err.message || "Ошибка заказа");
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) {
    return (
      <div className="cafe-guest">
        <header className="cafe-guest-header">
          <button type="button" className="cafe-guest-back" onClick={() => { window.location.href = "/"; }}>
            ←
          </button>
          <div className="cafe-guest-brand">
            <img src={logoMain} alt="Вместе" className="cafe-guest-logo" />
            <div className="cafe-guest-head-copy">
              <h1>Магазин</h1>
            </div>
          </div>
        </header>
        <p className="status error">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="cafe-guest">
        <p className="muted">Загрузка витрины…</p>
      </div>
    );
  }

  const orgName = data.provider?.organization_name || "Магазин";
  const logoUrl = data.provider?.logo_url || "";

  return (
    <div className="cafe-guest shop-public-page">
      <header className="cafe-guest-header">
        <button
          type="button"
          className="cafe-guest-back"
          aria-label="Назад на карту"
          title="Назад на карту"
          onClick={() => {
            window.location.href = "/";
          }}
        >
          ←
        </button>
        <div className="cafe-guest-brand">
          <img
            src={logoUrl || logoMain}
            alt={orgName}
            className={`cafe-guest-logo${logoUrl ? " is-org" : ""}`}
          />
          <div className="cafe-guest-head-copy">
            <h1>{orgName}</h1>
            <p>Товары · самовывоз и доставка</p>
          </div>
        </div>
        <button
          type="button"
          className="cafe-cart-fab"
          onClick={() => setCartOpen(true)}
          aria-label={`Корзина, ${itemsTotal.toLocaleString("ru-RU")} ₽`}
        >
          <span className="cafe-cart-fab-icon">
            <CartIcon />
          </span>
          <span className="cafe-cart-fab-price">{itemsTotal.toLocaleString("ru-RU")} ₽</span>
          {cartCount > 0 ? <span className="cafe-cart-fab-count">{cartCount}</span> : null}
        </button>
      </header>

      {orderInfo ? (
        <section className="cafe-guest-card">
          <h2>Заказ #{orderInfo.id}</h2>
          <p>
            Статус: <strong>{orderInfo.status}</strong>
            {orderInfo.total != null ? ` · ${Number(orderInfo.total).toLocaleString("ru-RU")} ₽` : ""}
          </p>
        </section>
      ) : null}

      {error ? <p className="status error">{error}</p> : null}

      <section className="cafe-guest-menu">
        {menuByCategory.map((cat) => (
          <div key={cat.id} className="cafe-menu-cat">
            <h2>{cat.name}</h2>
            <div className="cafe-menu-grid">
              {cat.items.map((p) => {
                const cover = p.photos?.[0]?.thumb_url || p.photos?.[0]?.image;
                const qty = cart[p.id] || 0;
                return (
                  <article key={p.id} className="cafe-menu-item">
                    {cover ? (
                      <button type="button" className="cafe-menu-photo-btn" onClick={() => setProduct(p)}>
                        <img src={cover} alt={p.name || "Товар"} loading="lazy" decoding="async" width={96} height={96} />
                      </button>
                    ) : (
                      <button type="button" className="cafe-menu-photo-btn" onClick={() => setProduct(p)}>
                        <div className="cafe-menu-ph" />
                      </button>
                    )}
                    <h3>
                      <button type="button" className="shop-menu-name-btn" onClick={() => setProduct(p)}>
                        {p.name}
                      </button>
                    </h3>
                    <div className="cafe-menu-row">
                      <button
                        type="button"
                        className="cafe-menu-cart-price"
                        onClick={() => addToCart(p.id, 1)}
                        aria-label={`В корзину, ${Number(p.price).toLocaleString("ru-RU")} ₽`}
                      >
                        <CartIcon />
                        <span>{Number(p.price).toLocaleString("ru-RU")} ₽</span>
                        {qty > 0 ? <em className="cafe-menu-cart-price-count">{qty}</em> : null}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ))}
        {!menuByCategory.length ? <p className="muted">Пока нет товаров на витрине.</p> : null}
      </section>

      {product ? (
        <div className="cafe-product-modal" onClick={() => setProduct(null)} role="dialog" aria-label="Карточка товара">
          <div className="cafe-product-sheet shop-product-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="cafe-cart-sheet-head">
              <h2>{product.name}</h2>
              <button type="button" className="cafe-cart-close" onClick={() => setProduct(null)} aria-label="Закрыть">
                <CloseIcon />
              </button>
            </div>
            <ServicePhotoCarousel
              items={(product.photos || []).map((ph) => ({
                id: ph.id,
                image: ph.image,
                thumb_url: ph.thumb_url,
                source: "product",
              }))}
              className="shop-product-carousel"
            />
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
              className="cafe-menu-cart-price cafe-menu-cart-price--wide"
              onClick={() => {
                addToCart(product.id, 1);
                setProduct(null);
                setCartOpen(true);
              }}
            >
              <CartIcon />
              <span>В корзину · {Number(product.price).toLocaleString("ru-RU")} ₽</span>
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
              <form className="cafe-guest-card cafe-checkout" onSubmit={(e) => void checkout(e)}>
                <ul className="cafe-cart-lines">
                  {cartLines.map((l) => {
                    const cover = l.product.photos?.[0]?.thumb_url || l.product.photos?.[0]?.image;
                    return (
                      <li key={l.product.id} className="cafe-cart-line">
                        {cover ? (
                          <img className="cafe-cart-line-photo" src={cover} alt="" loading="lazy" decoding="async" />
                        ) : (
                          <div className="cafe-cart-line-photo cafe-menu-ph" />
                        )}
                        <div className="cafe-cart-line-body">
                          <strong>{l.product.name}</strong>
                          <div className="cafe-qty cafe-cart-line-qty">
                            <button type="button" onClick={() => setQty(l.product.id, l.qty - 1)}>
                              −
                            </button>
                            <span>{l.qty}</span>
                            <button type="button" onClick={() => setQty(l.product.id, l.qty + 1)}>
                              +
                            </button>
                            <span className="muted small">× {Number(l.product.price).toLocaleString("ru-RU")} ₽</span>
                          </div>
                        </div>
                        <strong className="cafe-cart-line-price">
                          {(Number(l.product.price) * l.qty).toLocaleString("ru-RU")} ₽
                        </strong>
                      </li>
                    );
                  })}
                </ul>

                <div className="cafe-guest-modes" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  {settings.enable_pickup ? (
                    <button
                      type="button"
                      className={`cafe-mode-btn${mode === "pickup" ? " is-active" : ""}`}
                      onClick={() => setMode("pickup")}
                    >
                      <span>🏪</span>
                      Самовывоз
                    </button>
                  ) : null}
                  {settings.enable_delivery ? (
                    <button
                      type="button"
                      className={`cafe-mode-btn${mode === "delivery" ? " is-active" : ""}`}
                      onClick={() => setMode("delivery")}
                    >
                      <span>🚗</span>
                      Доставка
                    </button>
                  ) : null}
                </div>

                <input
                  placeholder="Имя"
                  value={guest.name}
                  onChange={(e) => setGuest((g) => ({ ...g, name: e.target.value }))}
                  autoComplete="name"
                />
                <input
                  placeholder="Телефон *"
                  value={guest.phone}
                  onChange={(e) => setGuest((g) => ({ ...g, phone: e.target.value }))}
                  required
                  autoComplete="tel"
                />
                <input
                  placeholder="Email для чека (необязательно)"
                  type="email"
                  value={guest.email}
                  onChange={(e) => setGuest((g) => ({ ...g, email: e.target.value }))}
                  autoComplete="email"
                />
                {mode === "delivery" ? (
                  <>
                    <input
                      placeholder="Адрес доставки *"
                      value={guest.address}
                      onChange={(e) => setGuest((g) => ({ ...g, address: e.target.value }))}
                      required
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
                ) : null}

                <p className="cafe-cart-total">
                  Итого: <strong>{itemsTotal.toLocaleString("ru-RU")} ₽</strong>
                </p>
                <button type="submit" className="landing-btn landing-btn--primary" disabled={busy}>
                  {busy ? "Оформляем…" : "Оплатить"}
                </button>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
