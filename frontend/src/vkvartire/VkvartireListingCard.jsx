import { useRef, useState } from "react";
import { SOURCE_LABELS } from "./vkvartireApi.js";

export default function VkvartireListingCard({ listing, onOpen, onToggleFavorite, compact }) {
  const photos = Array.isArray(listing?.photos) ? listing.photos.filter((p) => p?.url) : [];
  const urls = photos.length
    ? photos.map((p) => p.url)
    : listing?.cover_url
      ? [listing.cover_url]
      : [];
  const [idx, setIdx] = useState(0);
  const touchX = useRef(null);

  function onTouchStart(e) {
    touchX.current = e.touches?.[0]?.clientX ?? null;
  }

  function onTouchEnd(e) {
    if (touchX.current == null || urls.length < 2) return;
    const x = e.changedTouches?.[0]?.clientX;
    if (x == null) return;
    const dx = x - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) < 36) return;
    setIdx((cur) => {
      if (dx < 0) return Math.min(urls.length - 1, cur + 1);
      return Math.max(0, cur - 1);
    });
  }

  function step(dir) {
    if (urls.length < 2) return;
    setIdx((cur) => {
      if (dir > 0) return Math.min(urls.length - 1, cur + 1);
      return Math.max(0, cur - 1);
    });
  }

  const safeIdx = Math.min(idx, Math.max(0, urls.length - 1));
  const dealLabel = listing.deal_type === "sale" ? "Продажа" : "Аренда";

  return (
    <article className={`vkvartire-card${compact ? " vkvartire-card--compact" : ""}`}>
      <div
        className="vkvartire-card-photos"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={() => onOpen?.(listing)}
        role="presentation"
      >
        {urls[safeIdx] ? (
          <img src={urls[safeIdx]} alt="" draggable={false} />
        ) : (
          <div className="vkvartire-card-no-photo">Нет фото</div>
        )}
        <div className="vkvartire-card-photo-badges">
          <span className="vkvartire-card-deal">{dealLabel}</span>
          {listing.is_agent ? <span className="vkvartire-card-agent">Агент</span> : null}
        </div>
        <button
          type="button"
          className={`vkvartire-card-fav${listing.is_favorite ? " is-on" : ""}`}
          aria-label={listing.is_favorite ? "Убрать из избранного" : "В избранное"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite?.(listing);
          }}
        >
          {listing.is_favorite ? "♥" : "♡"}
        </button>
        {urls.length > 1 ? (
          <>
            <button
              type="button"
              className="vkvartire-card-nav vkvartire-card-nav--prev"
              aria-label="Предыдущее фото"
              onClick={(e) => {
                e.stopPropagation();
                step(-1);
              }}
              disabled={safeIdx === 0}
            >
              ‹
            </button>
            <button
              type="button"
              className="vkvartire-card-nav vkvartire-card-nav--next"
              aria-label="Следующее фото"
              onClick={(e) => {
                e.stopPropagation();
                step(1);
              }}
              disabled={safeIdx >= urls.length - 1}
            >
              ›
            </button>
            <div className="vkvartire-card-dots" aria-hidden="true">
              {urls.map((_, i) => (
                <span key={i} className={i === safeIdx ? "is-on" : ""} />
              ))}
            </div>
            <span className="vkvartire-card-photo-count">
              {safeIdx + 1}/{urls.length}
            </span>
          </>
        ) : null}
      </div>
      <div className="vkvartire-card-body" onClick={() => onOpen?.(listing)} role="presentation">
        <p className="vkvartire-card-price">{listing.price_label || `${listing.price} ₽`}</p>
        <p className="vkvartire-card-meta">
          <span>{listing.rooms_label}</span>
          {listing.area_m2 ? <span>{listing.area_m2} м²</span> : null}
          {listing.floor != null ? (
            <span>
              {listing.floor}/{listing.floors_total || "—"} эт.
            </span>
          ) : null}
        </p>
        {listing.metro_name ? (
          <p className="vkvartire-card-addr vkvartire-card-metro">
            <span className="vkvartire-metro-dot" aria-hidden="true" />
            {listing.metro_name}
            {listing.metro_walk_min != null ? ` · ${listing.metro_walk_min} мин пешком` : ""}
          </p>
        ) : null}
        {listing.address ? <p className="vkvartire-card-addr">{listing.address}</p> : null}
        <div className="vkvartire-card-footer">
          <span className="vkvartire-badge">{SOURCE_LABELS[listing.source] || listing.source}</span>
          {listing.realtor_name ? (
            <span className="vkvartire-card-realtor">{listing.realtor_name}</span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
