import { PhotoLightboxReviewCaption } from "./mapOrgBlocks.jsx";

/** Organization / review photo lightbox. App wraps with createPortal(..., document.body). */
export default function OrgPhotoLightbox({
  orgPhotoLightbox,
  setOrgPhotoLightbox,
  stepOrgPhotoLightbox,
  orgPhotoLightboxTouchX,
}) {
  return (
    <div
      className="photo-lightbox-backdrop"
      onClick={() => setOrgPhotoLightbox(null)}
    >
      {orgPhotoLightbox.items.length > 1 ? (
        <>
          <button
            type="button"
            className="photo-lightbox-nav photo-lightbox-nav--prev"
            aria-label="Предыдущее фото"
            onClick={(e) => {
              e.stopPropagation();
              stepOrgPhotoLightbox(-1);
            }}
          >
            ‹
          </button>
          <button
            type="button"
            className="photo-lightbox-nav photo-lightbox-nav--next"
            aria-label="Следующее фото"
            onClick={(e) => {
              e.stopPropagation();
              stepOrgPhotoLightbox(1);
            }}
          >
            ›
          </button>
          <p className="photo-lightbox-counter">
            {orgPhotoLightbox.index + 1} / {orgPhotoLightbox.items.length}
          </p>
        </>
      ) : null}
      <div className="photo-lightbox-inner" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Просмотр фото">
        <button type="button" className="photo-lightbox-close" aria-label="Закрыть" onClick={() => setOrgPhotoLightbox(null)}>
          ×
        </button>
        <div
          className="photo-lightbox-viewport"
          onTouchStart={(e) => {
            orgPhotoLightboxTouchX.current = e.touches?.[0]?.clientX ?? 0;
          }}
          onTouchEnd={(e) => {
            if (orgPhotoLightbox.items.length < 2) return;
            const x = e.changedTouches?.[0]?.clientX ?? 0;
            const dx = x - orgPhotoLightboxTouchX.current;
            if (Math.abs(dx) < 48) return;
            e.stopPropagation();
            stepOrgPhotoLightbox(dx > 0 ? -1 : 1);
          }}
        >
          {orgPhotoLightbox.items.map((item, i) => {
            const active = i === orgPhotoLightbox.index;
            const nearby = Math.abs(i - orgPhotoLightbox.index) <= 1;
            return (
            <img
              key={item.id || item.url}
              src={nearby ? item.url : undefined}
              alt=""
              draggable={false}
              loading={active ? "eager" : "lazy"}
              decoding="async"
              className={[
                "photo-lightbox-slide",
                active && "photo-lightbox-slide--active",
              ]
                .filter(Boolean)
                .join(" ")}
            />
            );
          })}
        </div>
        {orgPhotoLightbox.items[orgPhotoLightbox.index]?.source === "review" && (
          <PhotoLightboxReviewCaption
            key={orgPhotoLightbox.items[orgPhotoLightbox.index]?.id || orgPhotoLightbox.index}
            photo={orgPhotoLightbox.items[orgPhotoLightbox.index]}
          />
        )}
      </div>
    </div>
  );
}
