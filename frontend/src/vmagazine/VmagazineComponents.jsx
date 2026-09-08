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

const TRACK_STEPS_DELIVERY = [
  { id: "paid", label: "Оплачен" },
  { id: "assembling", label: "Сборка" },
  { id: "ready", label: "Готов" },
  { id: "delivering", label: "В пути" },
  { id: "done", label: "Получен" },
];

const TRACK_STEPS_PICKUP = [
  { id: "paid", label: "Оплачен" },
  { id: "assembling", label: "Сборка" },
  { id: "ready", label: "Готов" },
  { id: "done", label: "Получен" },
];

function trackStepIndex(status, steps) {
  const map = {
    awaiting_payment: -1,
    paid: 0,
    assembling: 1,
    ready: 2,
    to_courier: 3,
    delivering: 3,
    done: steps.length - 1,
    cancelled: -1,
  };
  if (status === "to_courier" && steps.length === 4) return 2;
  if (status === "delivering" && steps.length === 4) return 2;
  const idx = map[status];
  return typeof idx === "number" ? idx : 0;
}

export function OrderStatusTrack({ status, mode = "delivery" }) {
  if (status === "cancelled") {
    return <p className="muted small vmag-track-cancelled">Заказ отменён</p>;
  }
  const steps = mode === "pickup" ? TRACK_STEPS_PICKUP : TRACK_STEPS_DELIVERY;
  let active = trackStepIndex(status, steps);
  if (status === "awaiting_payment") active = -1;
  return (
    <ol className="vmag-status-track" aria-label="Статус заказа">
      {steps.map((step, i) => {
        const state = i < active ? "done" : i === active ? "current" : "todo";
        return (
          <li key={step.id} className={`vmag-status-step is-${state}`}>
            <span className="vmag-status-dot" aria-hidden />
            <span className="vmag-status-label">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
