import { useEffect, useId, useMemo, useRef, useState } from "react";

/**
 * Compact combobox: type to filter long option lists (categories, dictionaries).
 * options: [{ value: string, label: string }]
 */
export default function SearchableSelect({
  value = "",
  options = [],
  onChange,
  placeholder = "Выберите…",
  searchPlaceholder = "Поиск…",
  emptyText = "Ничего не найдено",
  disabled = false,
  allowClear = true,
}) {
  const listId = useId();
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);

  const selected = useMemo(
    () => options.find((o) => String(o.value) === String(value)) || null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const label = String(o.label || "").toLowerCase();
      const val = String(o.value || "").toLowerCase();
      return label.includes(q) || val.includes(q);
    });
  }, [options, query]);

  useEffect(() => {
    if (!open) return undefined;
    setQuery("");
    setActiveIdx(0);
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [open]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  function pick(next) {
    onChange?.(next);
    setOpen(false);
  }

  function onTriggerKeyDown(e) {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
    }
  }

  function onSearchKeyDown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const row = filtered[activeIdx];
      if (row) pick(row.value);
    }
  }

  return (
    <div className={`mp-sselect${open ? " is-open" : ""}${disabled ? " is-disabled" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="mp-sselect-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
      >
        <span className={selected ? "" : "mp-sselect-placeholder"}>{selected?.label || placeholder}</span>
        <span className="mp-sselect-chevron" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <div className="mp-sselect-panel" role="presentation">
          <input
            ref={searchRef}
            className="mp-sselect-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
          />
          <ul id={listId} className="mp-sselect-list" role="listbox">
            {allowClear ? (
              <li role="option" aria-selected={!value}>
                <button type="button" className={!value ? "is-active" : ""} onClick={() => pick("")}>
                  {placeholder}
                </button>
              </li>
            ) : null}
            {filtered.map((opt, idx) => {
              const isSelected = String(opt.value) === String(value);
              const isActive = idx === activeIdx;
              return (
                <li key={opt.value} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    className={`${isSelected ? "is-selected" : ""} ${isActive ? "is-active" : ""}`.trim()}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => pick(opt.value)}
                  >
                    {opt.label}
                  </button>
                </li>
              );
            })}
            {!filtered.length ? <li className="mp-sselect-empty">{emptyText}</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
