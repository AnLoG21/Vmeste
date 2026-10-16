import { useRef, useState } from "react";
import { SOURCE_LABELS } from "./vkvartireApi.js";

export default function VkvartireListingCard({ listing, onOpen, onToggleFavorite }) {
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

  const safeIdx = Math.min(idx, Math.max(0, urls.length - 1));

  return (
    <article className="vkvartire-card">
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
          <div style={{ height: "100%", display: "grid", placeItems: "center", color: "#6a7f94" }}>
            Нет фото
          </div>
        )}
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
          <div className="vkvartire-card-dots" aria-hidden="true">
            {urls.map((_, i) => (
              <span key={i} className={i === safeIdx ? "is-on" : ""} />
            ))}
          </div>
        ) : null}
      </div>
      <div className="vkvartire-card-body" onClick={() => onOpen?.(listing)} role="presentation">
        <p className="vkvartire-card-price">{listing.price_label || `${listing.price} ₽`}</p>
        <p className="vkvartire-card-meta">
          {listing.rooms_label}
          {listing.area_m2 ? ` · ${listing.area_m2} м²` : ""}
          {listing.floor != null ? ` · ${listing.floor}/${listing.floors_total || "—"} эт.` : ""}
        </p>
        {listing.metro_name ? (
          <p className="vkvartire-card-addr">
            м. {listing.metro_name}
            {listing.metro_walk_min != null ? ` · ${listing.metro_walk_min} мин` : ""}
          </p>
        ) : null}
        {listing.address ? <p className="vkvartire-card-addr">{listing.address}</p> : null}
        <span className="vkvartire-badge">{SOURCE_LABELS[listing.source] || listing.source}</span>
      </div>
    </article>
  );
}
