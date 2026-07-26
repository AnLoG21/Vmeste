import { useMemo, useState } from "react";

/** Compact photo carousel for a service gallery (service + review photos). */
export default function ServicePhotoCarousel({ items, className = "", onOpen }) {
  const [index, setIndex] = useState(0);
  const list = useMemo(
    () =>
      (Array.isArray(items) ? items : [])
        .map((it) => ({
          id: it.id,
          url: it.image || it.url || "",
          source: it.source || "service",
        }))
        .filter((it) => it.url),
    [items],
  );

  if (!list.length) return null;
  const safeIndex = Math.min(index, list.length - 1);
  const current = list[safeIndex];

  return (
    <div className={["service-photo-carousel", className].filter(Boolean).join(" ")}>
      <button
        type="button"
        className="service-photo-carousel-main"
        onClick={() => onOpen?.(list, safeIndex)}
        aria-label="Фото услуги"
      >
        <img src={current.url} alt="" />
        {current.source === "review" ? <span className="service-photo-carousel-badge">Из отзыва</span> : null}
      </button>
      {list.length > 1 && (
        <div className="service-photo-carousel-nav">
          <button
            type="button"
            aria-label="Предыдущее"
            onClick={() => setIndex((i) => (i - 1 + list.length) % list.length)}
          >
            ‹
          </button>
          <span className="muted small">
            {safeIndex + 1}/{list.length}
          </span>
          <button type="button" aria-label="Следующее" onClick={() => setIndex((i) => (i + 1) % list.length)}>
            ›
          </button>
        </div>
      )}
      {list.length > 1 && (
        <div className="service-photo-carousel-thumbs">
          {list.map((ph, idx) => (
            <button
              key={ph.id ?? idx}
              type="button"
              className={[
                "service-photo-carousel-thumb",
                idx === safeIndex && "service-photo-carousel-thumb--active",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setIndex(idx)}
            >
              <img src={ph.url} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
