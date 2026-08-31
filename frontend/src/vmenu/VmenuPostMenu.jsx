import { useEffect, useRef, useState } from "react";

export function VmenuPostMenu({ onDelete, disabled, deleteLabel = "Удалить" }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (disabled) return null;

  return (
    <div className="vmenu-post-menu" ref={wrapRef}>
      <button
        type="button"
        className="vmenu-post-menu-btn"
        aria-label="Ещё"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        ⋯
      </button>
      {open ? (
        <div className="vmenu-post-menu-dropdown">
          <button
            type="button"
            className="vmenu-post-menu-delete"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onDelete?.();
            }}
          >
            <span aria-hidden="true">🗑</span>
            {deleteLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
