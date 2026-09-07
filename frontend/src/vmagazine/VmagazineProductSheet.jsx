import { useEffect, useState } from "react";
import logoMain from "../assets/logo-main.png";
import ServicePhotoCarousel from "../ServicePhotoCarousel.jsx";
import { showToast } from "../toast.js";
import { OriginalBadge } from "./VmagazineComponents.jsx";
import { loadProductDetail, removeCartItem, setCartItem, trackProductView } from "./vmagazineApi.js";

export default function VmagazineProductSheet({
  productId,
  authFetch,
  API_URL,
  onOpenRelated,
  onOpenShop,
  onClose,
  onOpenPhotos,
  onWriteSeller,
}) {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailTab, setDetailTab] = useState("description");
  const [detailExpanded, setDetailExpanded] = useState(false);
  const [selectedSize, setSelectedSize] = useState("");
  const [qty, setQty] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setDetailTab("description");
      setDetailExpanded(false);
      setSelectedSize("");
      try {
        const data = await loadProductDetail(authFetch, API_URL, productId);
        if (cancelled) return;
        setProduct(data);
        void trackProductView(authFetch, API_URL, productId).catch(() => {});
      } catch (e) {
        if (!cancelled) showToast(e.message || "Не удалось открыть товар");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [API_URL, authFetch, productId]);

  async function changeQty(next) {
    const n = Math.max(0, Number(next) || 0);
    try {
      if (n <= 0) {
        await removeCartItem(authFetch, API_URL, productId);
        setQty(0);
      } else {
        await setCartItem(authFetch, API_URL, productId, n, undefined, selectedSize);
        setQty(n);
      }
    } catch (e) {
      showToast(e.message || "Не удалось обновить корзину");
    }
  }

  if (loading) return <p className="muted vmagazine-empty">Загрузка карточки…</p>;
  if (!product) return <p className="muted vmagazine-empty">Товар не найден.</p>;

  const photos = (product.photos || []).map((ph) => ({
    id: ph.id,
    image: ph.image,
    thumb_url: ph.thumb_url,
    source: "product",
  }));

  return (
    <div className="vmag-product-sheet shop-product-sheet">
      <div className="vmag-product-sheet-toolbar">
        <button type="button" className="ghost-btn vmag-product-back" onClick={() => onClose?.()}>
          ← Назад
        </button>
      </div>

      {photos.length ? (
        <ServicePhotoCarousel
          items={photos}
          className="shop-product-carousel"
          onOpen={(list, idx) => onOpenPhotos?.(list, idx)}
        />
      ) : product.cover_url ? (
        <button
          type="button"
          className="vmag-product-sheet-cover-btn"
          onClick={() =>
            onOpenPhotos?.([{ id: "cover", url: product.cover_url, thumb_url: product.cover_url }], 0)
          }
        >
          <img className="vmag-product-sheet-cover" src={product.cover_url} alt="" />
        </button>
      ) : (
        <div className="vmag-product-sheet-cover is-empty" />
      )}

      {(product.related_products || []).length ? (
        <section className="shop-product-related">
          <h3>Связанные товары</h3>
          <div className="shop-product-related-scroll">
            {product.related_products.map((rp) => (
              <button
                key={rp.id}
                type="button"
                className="shop-product-related-card"
                onClick={() => onOpenRelated?.(rp.id)}
              >
                {rp.cover_url ? <img src={rp.cover_url} alt="" /> : <div className="shop-product-related-ph" />}
                <span>{rp.name}</span>
                <em>{Number(rp.price).toLocaleString("ru-RU")} ₽</em>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {(product.sizes || []).length ? (
        <section className="shop-product-sizes">
          <h3>Размер</h3>
          <div className="shop-size-chips">
            {product.sizes.map((sz) => (
              <button
                key={sz}
                type="button"
                className={`shop-size-chip${selectedSize === String(sz) ? " is-on" : ""}`}
                onClick={() => setSelectedSize(String(sz))}
              >
                {sz}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className="vmag-product-sheet-head">
        <h2>
          {product.name}
          {product.is_original ? (
            <span title="Оригинал" style={{ marginLeft: 8, display: "inline-flex", verticalAlign: "middle" }}>
              <OriginalBadge />
            </span>
          ) : null}
        </h2>
        <strong className="shop-product-price">{Number(product.price).toLocaleString("ru-RU")} ₽</strong>
      </div>

      <div className="shop-detail-tabs shop-detail-tabs--outlined">
        <button
          type="button"
          className={detailTab === "description" ? "is-active" : ""}
          onClick={() => {
            setDetailTab("description");
            setDetailExpanded(false);
          }}
        >
          Описание
        </button>
        <button
          type="button"
          className={detailTab === "attrs" ? "is-active" : ""}
          onClick={() => {
            setDetailTab("attrs");
            setDetailExpanded(false);
          }}
        >
          Характеристики
        </button>
      </div>

      <div className={`shop-detail-body${detailExpanded ? " is-expanded" : ""}`}>
        {detailTab === "description" ? (
          <p className="shop-product-desc">{product.description || "Описание пока не добавлено."}</p>
        ) : product.attrs && Object.keys(product.attrs).length ? (
          <dl className="shop-product-attrs">
            {Object.entries(product.attrs).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{String(v)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="muted small">Характеристики не указаны.</p>
        )}
        <button
          type="button"
          className="shop-detail-expand"
          aria-label={detailExpanded ? "Свернуть" : "Развернуть"}
          onClick={() => setDetailExpanded((v) => !v)}
        >
          {detailExpanded ? "▴" : "▾"}
        </button>
      </div>

      {qty > 0 ? (
        <div className="shop-cart-stepper shop-cart-stepper--wide">
          <button type="button" aria-label="Уменьшить" onClick={() => void changeQty(qty - 1)}>
            −
          </button>
          <span>{qty}</span>
          <button type="button" aria-label="Увеличить" onClick={() => void changeQty(qty + 1)}>
            +
          </button>
        </div>
      ) : (
        <button type="button" className="primary-btn" onClick={() => void changeQty(1)}>
          В корзину · {Number(product.price).toLocaleString("ru-RU")} ₽
        </button>
      )}

      <section className="shop-product-seller">
        <h3>Магазин</h3>
        <button
          type="button"
          className="shop-product-seller-card"
          onClick={() => onOpenShop?.(product.shop_slug, product)}
          disabled={!product.shop_slug}
        >
          <img
            src={product.shop_logo_url || logoMain}
            alt=""
            className={`shop-product-seller-logo${product.shop_logo_url ? " is-org" : ""}`}
          />
          <span className="shop-product-seller-copy">
            <strong>{product.provider_name || "Магазин"}</strong>
            <em>Все товары и доставка</em>
          </span>
          <span className="shop-product-seller-chevron" aria-hidden>
            →
          </span>
        </button>
        {product.provider_id && onWriteSeller ? (
          <button
            type="button"
            className="ghost-btn shop-write-seller"
            onClick={() => onWriteSeller(product.provider_id)}
          >
            Написать продавцу
          </button>
        ) : null}
      </section>
    </div>
  );
}
