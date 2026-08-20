import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  findOzonCategoryLabel,
  ozonBrowseChildren,
  ozonNodeHasChildren,
  ozonNodeKey,
  ozonNodeTitle,
  searchOzonCategoryLeaves,
} from "./marketplaceCategoryHelpers.js";

/**
 * Ozon: drill-down tree + capped search (no full flatten / no 10k DOM nodes).
 * WB: parent → subjects step; subjects loaded per parent.
 */
export default function MarketplaceCategoryPicker({
  marketplace = "ozon",
  tree = [],
  value = "",
  onChange,
  parents = [],
  subjects = [],
  parentId = "",
  onParentChange,
  subjectsLoading = false,
  disabled = false,
  placeholder = "Выберите категорию",
}) {
  const listId = useId();
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [stack, setStack] = useState([]); // [{ title, nodes, parentCategoryId }]

  const isWb = marketplace === "wildberries";
  const roots = useMemo(() => ozonBrowseChildren(tree), [tree]);
  const level = stack.length ? stack[stack.length - 1] : { nodes: roots, parentCategoryId: null, title: "" };
  const currentNodes = level.nodes || [];
  const parentCategoryId = level.parentCategoryId ?? null;

  const selectedLabel = useMemo(() => {
    if (isWb) {
      const sub = subjects.find((s) => String(s.id) === String(value));
      if (sub) return sub.parent ? `${sub.name} · ${sub.parent}` : sub.name;
      return value ? `subjectID ${value}` : "";
    }
    const [categoryId, typeId] = String(value || "").split(":");
    return findOzonCategoryLabel(tree, categoryId, typeId);
  }, [isWb, subjects, value, tree]);

  const searchHits = useMemo(() => {
    if (isWb) return [];
    return searchOzonCategoryLeaves(tree, deferredQuery, 50);
  }, [isWb, tree, deferredQuery]);

  const wbSubjectOptions = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const rows = subjects.map((item) => ({
      value: item.id,
      label: item.parent ? `${item.name} · ${item.parent}` : item.name,
    }));
    if (!q) return rows.slice(0, 120);
    return rows.filter((o) => o.label.toLowerCase().includes(q) || String(o.value).includes(q)).slice(0, 80);
  }, [subjects, deferredQuery]);

  const wbParentOptions = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const rows = parents.map((p) => ({ value: p.id, label: p.name }));
    if (!q) return rows.slice(0, 150);
    return rows.filter((o) => o.label.toLowerCase().includes(q)).slice(0, 80);
  }, [parents, deferredQuery]);

  useEffect(() => {
    if (!open) return undefined;
    setQuery("");
    setStack([]);
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

  function pickOzon(categoryId, typeId) {
    onChange?.(`${categoryId}:${typeId}`);
    setOpen(false);
  }

  function pickWbSubject(id) {
    onChange?.(id);
    setOpen(false);
  }

  function onOzonNodeClick(node) {
    const catId = node.description_category_id ?? parentCategoryId;
    const hasKids = ozonNodeHasChildren(node);
    if (node.type_id && catId && !hasKids) {
      pickOzon(catId, node.type_id);
      return;
    }
    if (hasKids) {
      setStack((prev) => [
        ...prev,
        {
          title: ozonNodeTitle(node),
          nodes: ozonBrowseChildren(node.children),
          parentCategoryId: catId,
        },
      ]);
      setQuery("");
      return;
    }
    if (node.type_id && catId) {
      pickOzon(catId, node.type_id);
    }
  }

  function renderOzonBrowse() {
    const searching = deferredQuery.trim().length >= 1;
    if (searching) {
      return (
        <ul id={listId} className="mp-sselect-list" role="listbox">
          {searchHits.map((hit) => (
            <li key={hit.value} role="option">
              <button type="button" onClick={() => pickOzon(hit.categoryId, hit.typeId)}>
                {hit.label}
              </button>
            </li>
          ))}
          {!searchHits.length ? <li className="mp-sselect-empty">Ничего не найдено — уточните запрос</li> : null}
          {searchHits.length >= 50 ? <li className="mp-sselect-empty">Показаны первые 50. Уточните поиск.</li> : null}
        </ul>
      );
    }

    return (
      <>
        {stack.length ? (
          <div className="mp-cat-nav">
            <button
              type="button"
              className="mp-cat-back"
              aria-label="Назад"
              title="Назад"
              onClick={() => setStack((prev) => prev.slice(0, -1))}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span className="muted small">{stack.map((s) => s.title).join(" → ")}</span>
          </div>
        ) : (
          <p className="muted small mp-cat-hint">Выберите раздел, затем тип. Или воспользуйтесь поиском.</p>
        )}
        <ul id={listId} className="mp-sselect-list" role="listbox">
          {currentNodes.map((node, idx) => {
            const hasKids = ozonNodeHasChildren(node);
            return (
              <li key={ozonNodeKey(node, idx)} role="option">
                <button type="button" onClick={() => onOzonNodeClick(node)}>
                  {ozonNodeTitle(node)}
                  {hasKids ? " →" : ""}
                </button>
              </li>
            );
          })}
          {!currentNodes.length ? <li className="mp-sselect-empty">Пусто на этом уровне</li> : null}
        </ul>
      </>
    );
  }

  function renderWbBrowse() {
    if (!parentId) {
      return (
        <>
          <p className="muted small mp-cat-hint">Сначала раздел WB, затем предмет.</p>
          <ul id={listId} className="mp-sselect-list" role="listbox">
            {wbParentOptions.map((opt) => (
              <li key={opt.value} role="option">
                <button
                  type="button"
                  onClick={() => {
                    onParentChange?.(opt.value);
                    setQuery("");
                  }}
                >
                  {opt.label} →
                </button>
              </li>
            ))}
            {!wbParentOptions.length ? <li className="mp-sselect-empty">Нет родительских категорий</li> : null}
          </ul>
        </>
      );
    }

    return (
      <>
        <div className="mp-cat-nav">
          <button
            type="button"
            className="mp-cat-back"
            aria-label="К разделам"
            title="К разделам"
            onClick={() => {
              onParentChange?.("");
              onChange?.("");
              setQuery("");
            }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="muted small">{parents.find((p) => String(p.id) === String(parentId))?.name || parentId}</span>
        </div>
        {subjectsLoading ? <p className="muted small mp-cat-hint">Загрузка предметов…</p> : null}
        <ul id={listId} className="mp-sselect-list" role="listbox">
          {wbSubjectOptions.map((opt) => (
            <li key={opt.value} role="option">
              <button
                type="button"
                className={String(opt.value) === String(value) ? "is-selected" : ""}
                onClick={() => pickWbSubject(opt.value)}
              >
                {opt.label}
              </button>
            </li>
          ))}
          {!subjectsLoading && !wbSubjectOptions.length ? (
            <li className="mp-sselect-empty">Нет предметов в этом разделе</li>
          ) : null}
        </ul>
      </>
    );
  }

  return (
    <div className={`mp-sselect mp-cat-picker${open ? " is-open" : ""}${disabled ? " is-disabled" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="mp-sselect-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => !disabled && setOpen((v) => !v)}
      >
        <span className={selectedLabel ? "" : "mp-sselect-placeholder"}>{selectedLabel || placeholder}</span>
        <span className="mp-sselect-chevron" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <div className="mp-sselect-panel mp-cat-panel" role="presentation">
          <input
            ref={searchRef}
            className="mp-sselect-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              isWb ? (parentId ? "Поиск предмета в разделе…" : "Поиск раздела…") : "Поиск типа…"
            }
            aria-label="Поиск категории"
          />
          {isWb ? renderWbBrowse() : renderOzonBrowse()}
        </div>
      ) : null}
    </div>
  );
}
