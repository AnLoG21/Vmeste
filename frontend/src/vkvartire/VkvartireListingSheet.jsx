import { useRef } from "react";
import VkvartireListingCard from "./VkvartireListingCard.jsx";

/**
 * Bottom sheet mirroring org map sheet: peek / expand / close / swipe.
 */
export default function VkvartireListingSheet({
  listing,
  collapsed,
  onExpand,
  onCollapse,
  onClose,
  onToggleFavorite,
  onChatRealtor,
}) {
  const touchY = useRef(null);

  if (!listing) return null;

  function onHandleTouchStart(e) {
    touchY.current = e.touches?.[0]?.clientY ?? null;
  }

  function onHandleTouchEnd(e) {
    if (touchY.current == null) return;
    const y = e.changedTouches?.[0]?.clientY;
    if (y == null) return;
    const dy = y - touchY.current;
    touchY.current = null;
    if (dy > 56) {
      if (collapsed) onClose?.();
      else onCollapse?.();
    } else if (dy < -40) {
      onExpand?.();
    }
  }

  return (
    <div
      className={`vkvartire-listing-sheet map-org-sheet${collapsed ? " vkvartire-listing-sheet--collapsed map-org-sheet--collapsed" : ""}`}
      role="dialog"
      aria-label="Карточка квартиры"
    >
      <button
        type="button"
        className="vkvartire-listing-sheet-handle map-org-sheet-handle"
        aria-label={collapsed ? "Развернуть" : "Свернуть"}
        onClick={() => (collapsed ? onExpand?.() : onCollapse?.())}
        onTouchStart={onHandleTouchStart}
        onTouchEnd={onHandleTouchEnd}
      >
        <span className="vkvartire-listing-sheet-handle-bar map-org-sheet-handle-bar" />
      </button>

      {collapsed ? (
        <div
          className="vkvartire-listing-sheet-peek map-org-sheet-peek"
          onClick={onExpand}
          onKeyDown={(e) => e.key === "Enter" && onExpand?.()}
          role="button"
          tabIndex={0}
        >
          <div className="map-org-sheet-peek-title">
            {listing.price_label} · {listing.rooms_label}
          </div>
          <span className="muted small">Нажмите, чтобы открыть</span>
        </div>
      ) : (
        <>
          <button
            type="button"
            className="vkvartire-listing-sheet-close map-org-sheet-close"
            aria-label="Закрыть"
            onClick={onClose}
          >
            ×
          </button>
          <div className="vkvartire-listing-sheet-body map-org-sheet-body">
            <VkvartireListingCard
              listing={listing}
              onToggleFavorite={onToggleFavorite}
              onOpen={() => {}}
            />
            {listing.description ? (
              <p style={{ marginTop: "0.75rem", color: "#516578", fontSize: "0.9rem" }}>
                {listing.description}
              </p>
            ) : null}
            {(listing.realtor_name || listing.realtor_phone) && (
              <p style={{ marginTop: "0.65rem", fontSize: "0.9rem", color: "#516578" }}>
                {listing.realtor_name ? <strong>{listing.realtor_name}</strong> : "Контакт"}
                {listing.realtor_phone ? (
                  <>
                    {" · "}
                    <a href={`tel:${String(listing.realtor_phone).replace(/\s/g, "")}`}>
                      {listing.realtor_phone}
                    </a>
                  </>
                ) : null}
              </p>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.75rem" }}>
              {listing.can_chat ? (
                <button type="button" className="vkvartire-chip is-active" onClick={() => onChatRealtor?.(listing)}>
                  Написать риелтору
                </button>
              ) : null}
              {listing.external_url ? (
                <a className="vkvartire-chip" href={listing.external_url} target="_blank" rel="noopener noreferrer">
                  Источник
                </a>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
