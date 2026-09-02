import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function VmenuPostMenu({ onDelete, disabled, deleteLabel = "Удалить" }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) {
      setMenuPos(null);
      return undefined;
    }

    const update = () => {
      const rect = btnRef.current.getBoundingClientRect();
      const menuW = 168;
      const menuH = 44;
      let left = Math.min(rect.right - menuW, window.innerWidth - menuW - 8);
      left = Math.max(8, left);
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow < menuH + 12 ? Math.max(8, rect.top - menuH - 4) : rect.bottom + 4;
      setMenuPos({ top, left, width: menuW });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      const t = e.target;
      if (wrapRef.current?.contains(t)) return;
      const portal = document.getElementById("vmenu-post-menu-portal");
      if (portal?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (disabled) return null;

  const dropdown =
    open && menuPos
      ? createPortal(
          <div
            id="vmenu-post-menu-portal"
            className="vmenu-post-menu-dropdown vmenu-post-menu-dropdown--fixed"
            style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width }}
          >
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
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={`vmenu-post-menu${open ? " vmenu-post-menu--open" : ""}`} ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        className="vmenu-post-menu-btn"
        aria-label="Ещё"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        ⋯
      </button>
      {dropdown}
    </div>
  );
}
