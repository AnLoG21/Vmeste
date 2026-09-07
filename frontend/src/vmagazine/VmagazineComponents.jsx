import { useEffect, useState } from "react";
import { showToast } from "../toast.js";
import { likeProduct, loadCart, removeCartItem, setCartItem, trackProductView, unlikeProduct } from "./vmagazineApi.js";

export function OriginalBadge() {
  return (
    <span className="vmag-original-badge" title="Оригинальный товар">
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
        <circle cx="8" cy="8" r="8" fill="#ff8a00" />
        <path d="M4.5 8.2l2.1 2.1 4.4-4.4" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function ProductCard({
  product,
  authFetch,
  API_URL,
  onLikedChange,
  onOpen,
  compact = false,
}) {
  const [qty, setQty] = useState(0);

  useEffect(() => {
    if (!product?.id || !authFetch || !API_URL) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const items = await loadCart(authFetch, API_URL);
        const row = (items || []).find((x) => Number(x.product?.id) === Number(product.id));
        if (!cancelled) setQty(Number(row?.quantity) || 0);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [API_URL, authFetch, product?.id]);

  if (!product) return null;

  async function openProduct() {
    try {
      await trackProductView(authFetch, API_URL, product.id);
    } catch {
      /* ignore */
    }
    if (onOpen) onOpen(product);
    else if (product.shop_url) window.location.href = product.shop_url;
    else showToast("Нет ссылки на витрину");
  }

  async function toggleLike(e) {
    e.stopPropagation();
    try {
      if (product.liked) {
        await unlikeProduct(authFetch, API_URL, product.id);
        onLikedChange?.(product.id, false);
        showToast("Убрано из избранного");
      } else {
        await likeProduct(authFetch, API_URL, product.id);
        onLikedChange?.(product.id, true);
        showToast("В избранном");
      }
    } catch (err) {
      showToast(err.message || "Не удалось обновить избранное");
    }
  }

  async function changeQty(e, next) {
    e.stopPropagation();
    const n = Math.max(0, Number(next) || 0);
    try {
      if (n <= 0) {
        await removeCartItem(authFetch, API_URL, product.id);
        setQty(0);
      } else {
        await setCartItem(authFetch, API_URL, product.id, n);
        setQty(n);
      }
    } catch (err) {
      showToast(err.message || "Не удалось обновить корзину");
    }
  }

  return (
    <article
      className={`vmag-product-card${compact ? " vmag-product-card--compact" : ""}`}
      onClick={() => void openProduct()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") void openProduct();
      }}
    >
      <div className="vmag-product-cover">
        {product.cover_url ? <img src={product.cover_url} alt="" loading="lazy" /> : <div className="vmag-product-cover-empty" />}
        {product.is_original ? <OriginalBadge /> : null}
        <button type="button" className="vmag-like-btn" onClick={toggleLike} aria-label="Избранное">
          {product.liked ? "♥" : "♡"}
        </button>
      </div>
      <div className="vmag-product-body">
        <strong>{Number(product.price).toLocaleString("ru-RU")} ₽</strong>
        <p className="vmag-product-name">{product.name}</p>
        {product.provider_name ? <p className="muted small">{product.provider_name}</p> : null}
        {!compact ? (
          qty > 0 ? (
            <div className="shop-cart-stepper vmag-cart-stepper" onClick={(e) => e.stopPropagation()}>
              <button type="button" aria-label="Уменьшить" onClick={(e) => void changeQty(e, qty - 1)}>
                −
              </button>
              <span>{qty}</span>
              <button type="button" aria-label="Увеличить" onClick={(e) => void changeQty(e, qty + 1)}>
                +
              </button>
            </div>
          ) : (
            <button type="button" className="ghost-btn vmag-cart-mini" onClick={(e) => void changeQty(e, 1)}>
              В корзину
            </button>
          )
        ) : null}
      </div>
    </article>
  );
}

export function HorizontalRail({ title, children, onTitleClick }) {
  return (
    <section className="vmag-rail">
      <div className="vmag-rail-head">
        {onTitleClick ? (
          <button type="button" className="vmag-rail-title-btn" onClick={onTitleClick}>
            {title} →
          </button>
        ) : (
          <h3>{title}</h3>
        )}
      </div>
      <div className="vmag-rail-scroll">{children}</div>
    </section>
  );
}

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

export function orderStatusLabel(status) {
  return ORDER_STATUS_LABELS[status] || status;
}
