import { useEffect } from "react";

export default function LandingLightbox({ open, title, children, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="landing-lightbox" role="presentation" onClick={onClose}>
      <div
        className="landing-lightbox-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title || "Просмотр"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="landing-lightbox-head">
          <strong>{title}</strong>
          <button type="button" className="landing-demo-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="landing-lightbox-body">{children}</div>
      </div>
    </div>
  );
}
