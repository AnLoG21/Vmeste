import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CafeGuestDeliveryMap from "../CafeGuestDeliveryMap.jsx";
import { fetchAddressSuggestions } from "../addressSuggest.js";
import { showToast } from "../toast.js";
import { HorizontalRail, ProductCard, OrderStatusTrack, orderStatusLabel } from "./VmagazineComponents.jsx";
import {
  createReturn,
  deletePaymentCard,
  loadAddresses,
  loadBonuses,
  loadCart,
  loadHome,
  loadPaymentCards,
  loadProductLikes,
  loadProfileHub,
  loadRecentlyViewed,
  loadReturns,
  removeCartItem,
  saveAddress,
  savePaymentCard,
  searchSuggest,
  setCartItem,
} from "./vmagazineApi.js";

function EmptyState({ text, onGoHome }) {
  return (
    <div className="vmagazine-empty-block">
      <p className="muted vmagazine-empty">{text}</p>
      {onGoHome ? (
        <button type="button" className="ghost-btn" onClick={onGoHome}>
          На главную
        </button>
      ) : null}
    </div>
  );
}

function estimateBonusSpend(balance, itemsSum) {
  const bal = Math.max(0, Number(balance) || 0);
  const sum = Math.max(0, Number(itemsSum) || 0);
  const cap = Math.round(sum * 0.5 * 100) / 100;
  return Math.min(bal, cap, sum);
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="currentColor">
      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
    </svg>
  );
}

function BackArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden fill="currentColor">
      <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="currentColor">
      <path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12l-4.89 4.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z" />
    </svg>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden
      fill="currentColor"
      style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s ease" }}
    >
      <path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
    </svg>
  );
}

function MagnifierIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden fill="currentColor">
      <path d="M4 6h16v2H4V6zm3 5h10v2H7v-2zm2 5h6v2H9v-2z" />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden fill="currentColor">
      <path d="M8 7h12v2H8V7zm0 4h8v2H8v-2zm0 4h4v2H8v-2zM4 7h2v2H4V7zm0 4h2v2H4v-2zm0 4h2v2H4v-2z" />
    </svg>
  );
}

function CardBrandMark({ brand }) {
  const b = String(brand || "card").toLowerCase();
  const label = b === "mir" ? "МИР" : b === "visa" ? "VISA" : b === "mastercard" ? "MC" : b === "amex" ? "AMEX" : "CARD";
  const color =
    b === "mir" ? "#0f6e56" : b === "visa" ? "#1a1f71" : b === "mastercard" ? "#eb001b" : b === "amex" ? "#2e77bc" : "#6a4c93";
  return (
    <span className="vmag-card-brand" style={{ background: color }} aria-hidden>
      {label}
    </span>
  );
}

function detectBrandClient(number) {
  const n = String(number || "").replace(/\D/g, "");
  if (n.startsWith("220")) return "mir";
  if (n.startsWith("4")) return "visa";
  const two = Number(n.slice(0, 2));
  const four = Number(n.slice(0, 4));
  if ((two >= 51 && two <= 55) || (four >= 2221 && four <= 2720)) return "mastercard";
  if (n.startsWith("34") || n.startsWith("37")) return "amex";
  return "card";
}

function AddressPickerModal({ open, onClose, onSaved, authFetch, API_URL, existingCount }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [pin, setPin] = useState(null);
  const [form, setForm] = useState({
    address: "",
    entrance: "",
    floor: "",
    apartment: "",
    intercom: "",
    extra: "",
    label: "Дом",
  });
  const [busy, setBusy] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setQuery("");
    setSuggestions([]);
    setPin(null);
    setForm({
      address: "",
      entrance: "",
      floor: "",
      apartment: "",
      intercom: "",
      extra: "",
      label: "Дом",
    });
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(async () => {
      if (query.trim().length < 2) {
        setSuggestions([]);
        return;
      }
      const items = await fetchAddressSuggestions(query);
      setSuggestions(items || []);
    }, 250);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [query, open]);

  if (!open) return null;

  async function save() {
    if (!form.address.trim()) {
      showToast("Укажите адрес");
      return;
    }
    setBusy(true);
    try {
      await saveAddress(authFetch, API_URL, {
        ...form,
        lat: pin?.lat,
        lon: pin?.lon,
        is_default: existingCount === 0,
      });
      showToast("Адрес сохранён");
      onSaved?.();
      onClose?.();
    } catch (e) {
      showToast(e.message || "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="vmag-modal-overlay" role="dialog" aria-modal="true">
      <div className="vmag-modal">
        <div className="vmag-modal-head">
          <strong>Указать адрес</strong>
          <button type="button" className="ghost-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="vmag-modal-body">
          <div className="vmag-suggest-wrap">
            <input
              type="search"
              placeholder="Поиск адреса"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="street-address"
            />
            {suggestions.length ? (
              <ul className="vmag-addr-suggest">
                {suggestions.map((s) => (
                  <li key={`${s.value}-${s.lat}-${s.lon}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setForm((f) => ({ ...f, address: s.value || s.full || "" }));
                        setQuery(s.value || s.full || "");
                        if (s.lat != null && s.lon != null) setPin({ lat: s.lat, lon: s.lon, address: s.value });
                        setSuggestions([]);
                      }}
                    >
                      {s.value || s.full}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <CafeGuestDeliveryMap
            zones={[]}
            pin={pin}
            onPick={(next) => {
              setPin(next);
              if (next?.address) {
                setForm((f) => ({ ...f, address: next.address }));
                setQuery(next.address);
              }
            }}
          />
          <div className="vmag-addr-grid">
            <input
              placeholder="Адрес *"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
            <input
              placeholder="Подъезд"
              value={form.entrance}
              onChange={(e) => setForm((f) => ({ ...f, entrance: e.target.value }))}
            />
            <input
              placeholder="Этаж"
              value={form.floor}
              onChange={(e) => setForm((f) => ({ ...f, floor: e.target.value }))}
            />
            <input
              placeholder="Квартира"
              value={form.apartment}
              onChange={(e) => setForm((f) => ({ ...f, apartment: e.target.value }))}
            />
            <input
              placeholder="Домофон"
              value={form.intercom}
              onChange={(e) => setForm((f) => ({ ...f, intercom: e.target.value }))}
            />
            <input
              placeholder="Дополнительно"
              value={form.extra}
              onChange={(e) => setForm((f) => ({ ...f, extra: e.target.value }))}
            />
          </div>
          <button type="button" className="primary-btn" disabled={busy} onClick={() => void save()}>
            Сохранить адрес
          </button>
        </div>
      </div>
    </div>
  );
}

export function HomeTab({ authFetch, API_URL, onOpenProduct }) {
  const [addresses, setAddresses] = useState([]);
  const [addressId, setAddressId] = useState(null);
  const [addrMenuOpen, setAddrMenuOpen] = useState(false);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [draftQuery, setDraftQuery] = useState("");
  const [suggest, setSuggest] = useState({ suggestions: [], sections: [], products: [], filters: {} });
  const [recommended, setRecommended] = useState([]);
  const [mode, setMode] = useState("home"); // home | search
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [originalsOnly, setOriginalsOnly] = useState(false);
  const [sort, setSort] = useState("popular");
  const [attrFilters, setAttrFilters] = useState({});

  const refreshHome = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadHome(authFetch, API_URL);
      setAddresses(data.addresses || []);
      setRecommended(data.recommended || []);
      const def = (data.addresses || []).find((a) => a.is_default) || (data.addresses || [])[0];
      if (def) setAddressId(def.id);
    } catch (e) {
      showToast(e.message || "Не удалось загрузить витрину");
    } finally {
      setLoading(false);
    }
  }, [API_URL, authFetch]);

  useEffect(() => {
    void refreshHome();
  }, [refreshHome]);

  useEffect(() => {
    if (mode !== "search") return undefined;
    const t = window.setTimeout(async () => {
      try {
        const data = await searchSuggest(authFetch, API_URL, {
          q: query,
          originals: originalsOnly,
          sort,
        });
        setSuggest(data || { suggestions: [], sections: [], products: [], filters: {} });
      } catch {
        /* ignore */
      }
    }, 200);
    return () => window.clearTimeout(t);
  }, [API_URL, authFetch, query, originalsOnly, sort, mode]);

  // подсказки при наборе до запуска поиска
  useEffect(() => {
    if (mode === "search") return undefined;
    const t = window.setTimeout(async () => {
      if (!draftQuery.trim()) {
        setSuggest((s) => ({ ...s, suggestions: [], sections: [] }));
        return;
      }
      try {
        const data = await searchSuggest(authFetch, API_URL, { q: draftQuery });
        setSuggest((s) => ({
          ...s,
          suggestions: data.suggestions || [],
          sections: data.sections || [],
        }));
      } catch {
        /* ignore */
      }
    }, 220);
    return () => window.clearTimeout(t);
  }, [API_URL, authFetch, draftQuery, mode]);

  function patchLiked(id, liked) {
    setRecommended((prev) => prev.map((p) => (p.id === id ? { ...p, liked } : p)));
    setSuggest((s) => ({
      ...s,
      products: (s.products || []).map((p) => (p.id === id ? { ...p, liked } : p)),
    }));
  }

  function runSearch(nextQ = draftQuery) {
    const q = String(nextQ || "").trim();
    setQuery(q);
    setDraftQuery(q);
    setMode("search");
    setFilterOpen(false);
    setSortOpen(false);
  }

  const currentAddress = addresses.find((a) => a.id === addressId) || addresses[0];

  const filteredProducts = useMemo(() => {
    let list = suggest.products || [];
    if (originalsOnly) list = list.filter((p) => p.is_original);
    Object.entries(attrFilters).forEach(([key, val]) => {
      if (!val) return;
      list = list.filter((p) => String(p.attrs?.[key] ?? "") === String(val));
    });
    return list;
  }, [suggest.products, originalsOnly, attrFilters]);

  const displayProducts = filteredProducts;

  return (
    <div className="vmag-home">
      <div className="vmag-address-bar">
        {!addresses.length ? (
          <button type="button" className="vmag-address-cta" onClick={() => setAddressModalOpen(true)}>
            Указать адрес
          </button>
        ) : (
          <div className="vmag-address-current">
            <button
              type="button"
              className="vmag-address-main"
              onClick={() => setAddrMenuOpen((v) => !v)}
            >
              <span className="vmag-address-label">Доставка</span>
              <span className="vmag-address-line">
                <strong>{currentAddress?.address}</strong>
                <span className="vmag-address-chevron" aria-hidden>
                  {addrMenuOpen ? "▴" : "▾"}
                </span>
              </span>
            </button>
            <button
              type="button"
              className="vmag-address-plus"
              aria-label="Добавить адрес"
              onClick={() => setAddressModalOpen(true)}
            >
              +
            </button>
            {addrMenuOpen ? (
              <ul className="vmag-address-menu">
                {addresses.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      className={a.id === currentAddress?.id ? "is-active" : ""}
                      onClick={() => {
                        setAddressId(a.id);
                        setAddrMenuOpen(false);
                      }}
                    >
                      {a.label ? `${a.label}: ` : ""}
                      {a.address}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </div>

      <div className="vmag-search-row">
        <div className="vmag-search-input-wrap">
          <input
            type="search"
            placeholder="Искать товары и магазины"
            value={draftQuery}
            onChange={(e) => setDraftQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") runSearch();
            }}
          />
          {mode !== "search" && draftQuery.trim() && (suggest.suggestions || []).length ? (
            <ul className="vmag-suggest-dropdown">
              {suggest.suggestions.map((s) => (
                <li key={`${s.type}-${s.text}`}>
                  <button type="button" onClick={() => runSearch(s.text)}>
                    {s.text}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <button type="button" className="vmag-icon-btn" aria-label="Найти" onClick={() => runSearch()}>
          <MagnifierIcon />
        </button>
        {mode === "search" ? (
          <>
            <button
              type="button"
              className={`vmag-icon-btn${filterOpen ? " is-active" : ""}`}
              aria-label="Фильтры"
              onClick={() => {
                setFilterOpen((v) => !v);
                setSortOpen(false);
              }}
            >
              <FilterIcon />
            </button>
            <button
              type="button"
              className={`vmag-icon-btn${sortOpen ? " is-active" : ""}`}
              aria-label="Сортировка"
              onClick={() => {
                setSortOpen((v) => !v);
                setFilterOpen(false);
              }}
            >
              <SortIcon />
            </button>
          </>
        ) : null}
      </div>

      {mode === "search" && filterOpen ? (
        <div className="vmag-filter-sheet">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={originalsOnly}
              onChange={(e) => setOriginalsOnly(e.target.checked)}
            />
            Только оригинальные товары
          </label>
          {(suggest.filters?.attributes || []).map((facet) => (
            <label key={facet.key} className="vmag-filter-attr">
              <span>{facet.key}</span>
              <select
                value={attrFilters[facet.key] || ""}
                onChange={(e) =>
                  setAttrFilters((prev) => ({ ...prev, [facet.key]: e.target.value || undefined }))
                }
              >
                <option value="">Все</option>
                {(facet.values || []).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      ) : null}

      {mode === "search" && sortOpen ? (
        <div className="vmag-sort-sheet">
          {[
            ["popular", "По популярности"],
            ["price_asc", "Сначала дешевле"],
            ["price_desc", "Сначала дороже"],
            ["name", "По названию"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={sort === id ? "is-active" : ""}
              onClick={() => {
                setSort(id);
                setSortOpen(false);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {mode === "search" ? (
        <div className="vmag-suggest">
          {(suggest.sections || []).length ? (
            <HorizontalRail title="Перейти в раздел">
              {suggest.sections.map((sec) => (
                <button
                  key={`${sec.type}-${sec.id}`}
                  type="button"
                  className="vmag-section-card"
                  onClick={() => {
                    if (sec.shop_url) window.location.href = sec.shop_url;
                    else runSearch(sec.title);
                  }}
                >
                  {sec.cover_url ? <img src={sec.cover_url} alt="" /> : <div className="vmag-section-ph" />}
                  <span>{sec.title}</span>
                </button>
              ))}
            </HorizontalRail>
          ) : null}
          <div className="vmag-product-grid">
            {displayProducts.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                authFetch={authFetch}
                API_URL={API_URL}
                onLikedChange={patchLiked}
                onOpen={onOpenProduct}
              />
            ))}
          </div>
          {!displayProducts.length ? (
            <EmptyState text="Ничего не найдено." onGoHome={() => setMode("home")} />
          ) : null}
        </div>
      ) : (
        <>
          {loading ? <p className="muted">Загрузка…</p> : null}
          <div className="vmag-product-grid">
            {recommended.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                authFetch={authFetch}
                API_URL={API_URL}
                onLikedChange={patchLiked}
                onOpen={onOpenProduct}
              />
            ))}
          </div>
          {!loading && !recommended.length ? (
            <EmptyState text="Пока нет товаров в витринах." />
          ) : null}
        </>
      )}

      <AddressPickerModal
        open={addressModalOpen}
        onClose={() => setAddressModalOpen(false)}
        onSaved={() => void refreshHome()}
        authFetch={authFetch}
        API_URL={API_URL}
        existingCount={addresses.length}
      />
    </div>
  );
}

export function FavoritesTab({ authFetch, API_URL, onOpenProduct, onGoHome }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await loadProductLikes(authFetch, API_URL));
    } catch (e) {
      showToast(e.message || "Не удалось загрузить избранное");
    } finally {
      setLoading(false);
    }
  }, [API_URL, authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <h2>Избранное</h2>
      <p className="muted small">Товары, которым вы поставили лайк.</p>
      {loading ? <p className="muted">Загрузка…</p> : null}
      <div className="vmag-product-grid">
        {items.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            authFetch={authFetch}
            API_URL={API_URL}
            onOpen={onOpenProduct}
            onLikedChange={(id, liked) => {
              if (!liked) setItems((prev) => prev.filter((x) => x.id !== id));
            }}
          />
        ))}
      </div>
      {!loading && !items.length ? (
        <EmptyState text="Пока пусто — лайкайте товары в карточке." onGoHome={onGoHome} />
      ) : null}
    </div>
  );
}

export function CartTab({ authFetch, API_URL, me, onOpenProduct, onGoHome }) {
  const [items, setItems] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(() => new Set());
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [totalOpen, setTotalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState("delivery");
  const [addressId, setAddressId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("online");
  const [cardId, setCardId] = useState(null);
  const [serviceFee, setServiceFee] = useState(true);
  const [useBonusesBySlug, setUseBonusesBySlug] = useState({});
  const [guest, setGuest] = useState({
    name: "",
    phone: "",
    email: "",
  });
  const [agree, setAgree] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cart, addrs] = await Promise.all([
        loadCart(authFetch, API_URL),
        loadAddresses(authFetch, API_URL).catch(() => []),
      ]);
      setItems(cart || []);
      setAddresses(addrs || []);
      setSelected(new Set((cart || []).map((r) => r.id)));
      const def = (addrs || []).find((a) => a.is_default) || (addrs || [])[0];
      if (def) setAddressId(def.id);
    } catch (e) {
      showToast(e.message || "Не удалось загрузить корзину");
    } finally {
      setLoading(false);
    }
  }, [API_URL, authFetch]);

  const reloadAddresses = useCallback(async () => {
    try {
      const addrs = await loadAddresses(authFetch, API_URL);
      setAddresses(addrs || []);
      const def = (addrs || []).find((a) => a.is_default) || (addrs || [])[0];
      if (def) setAddressId((prev) => prev || def.id);
    } catch {
      /* ignore */
    }
  }, [API_URL, authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setGuest({
      name: [me?.first_name, me?.last_name].filter(Boolean).join(" ") || me?.username || "",
      phone: me?.phone || "",
      email: me?.email || "",
    });
  }, [me]);

  useEffect(() => {
    if (!checkoutOpen) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const list = await loadPaymentCards(authFetch, API_URL);
        if (cancelled) return;
        setCards(list || []);
        const def = (list || []).find((c) => c.is_default) || (list || [])[0];
        setCardId(def?.id ?? null);
      } catch {
        if (!cancelled) setCards([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [checkoutOpen, API_URL, authFetch]);

  const selectedRows = useMemo(
    () => items.filter((r) => selected.has(r.id)),
    [items, selected],
  );

  const shopGroups = useMemo(() => {
    const map = new Map();
    for (const row of items) {
      const slug = row.product?.shop_slug || `_noid_${row.product?.provider_name || row.id}`;
      if (!map.has(slug)) {
        map.set(slug, {
          slug: row.product?.shop_slug || "",
          provider_name: row.product?.provider_name || "Магазин",
          bonus_balance: Number(row.bonus_balance || 0),
          rows: [],
        });
      }
      const g = map.get(slug);
      g.rows.push(row);
      const bal = Number(row.bonus_balance || 0);
      if (bal > g.bonus_balance) g.bonus_balance = bal;
    }
    return [...map.values()];
  }, [items]);

  const selectedShopGroups = useMemo(() => {
    const map = new Map();
    for (const row of selectedRows) {
      const slug = row.product?.shop_slug || `_noid_${row.product?.provider_name || row.id}`;
      if (!map.has(slug)) {
        map.set(slug, {
          slug: row.product?.shop_slug || "",
          provider_name: row.product?.provider_name || "Магазин",
          bonus_balance: Number(row.bonus_balance || 0),
          rows: [],
          sum: 0,
        });
      }
      const g = map.get(slug);
      g.rows.push(row);
      g.sum += Number(row.product?.price || 0) * Number(row.quantity || 0);
      const bal = Number(row.bonus_balance || 0);
      if (bal > g.bonus_balance) g.bonus_balance = bal;
    }
    return [...map.values()];
  }, [selectedRows]);

  const selectedSum = useMemo(
    () => selectedRows.reduce((s, row) => s + Number(row.product?.price || 0) * Number(row.quantity || 0), 0),
    [selectedRows],
  );

  const bonusesEstimate = useMemo(() => {
    let total = 0;
    for (const g of selectedShopGroups) {
      if (!g.slug || !useBonusesBySlug[g.slug] || !(g.bonus_balance > 0)) continue;
      total += estimateBonusSpend(g.bonus_balance, g.sum);
    }
    return Math.round(total * 100) / 100;
  }, [selectedShopGroups, useBonusesBySlug]);

  const feeBase = Math.max(0, selectedSum - bonusesEstimate);
  const feeAmount = serviceFee ? Math.round(feeBase * 0.015 * 100) / 100 : 0;
  const payTotal = Math.max(0, Math.round((selectedSum - bonusesEstimate + feeAmount) * 100) / 100);
  const allSelected = items.length > 0 && selected.size === items.length;
  const currentAddress = addresses.find((a) => a.id === addressId) || addresses[0];

  function shopWord(n) {
    const abs = Math.abs(n) % 100;
    const last = abs % 10;
    if (abs > 10 && abs < 20) return "магазинов";
    if (last === 1) return "магазин";
    if (last >= 2 && last <= 4) return "магазина";
    return "магазинов";
  }

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function placeOrders() {
    if (!agree) {
      showToast("Нужно согласие с условиями");
      return;
    }
    if (!selectedRows.length) {
      showToast("Выберите товары");
      return;
    }
    if (mode === "delivery" && !currentAddress?.address) {
      showToast("Укажите адрес доставки");
      return;
    }
    if (!guest.name.trim() || !guest.phone.trim()) {
      showToast("Укажите имя и телефон получателя");
      return;
    }
    setBusy(true);
    try {
      const bySlug = new Map();
      for (const row of selectedRows) {
        const slug = row.product?.shop_slug;
        if (!slug) throw new Error(`Нет витрины у «${row.product?.name}»`);
        if (!bySlug.has(slug)) bySlug.set(slug, []);
        bySlug.get(slug).push(row);
      }
      const slugList = [...bySlug.keys()];
      const onlineQueue = paymentMethod === "online" && slugList.length > 1;
      const processSlugs = onlineQueue ? [slugList[0]] : slugList;
      let lastUrl = "";
      let orderCount = 0;
      let first = true;
      for (const slug of processSlugs) {
        const rows = bySlug.get(slug);
        const shopSum = rows.reduce(
          (s, r) => s + Number(r.product?.price || 0) * Number(r.quantity || 0),
          0,
        );
        const bal = Number(rows[0]?.bonus_balance || 0);
        const wantBonuses = Boolean(useBonusesBySlug[slug]) && bal > 0;
        const bonusAmount = wantBonuses ? estimateBonusSpend(bal, shopSum) : 0;
        const body = {
          mode,
          payment_method: paymentMethod,
          service_fee: first && serviceFee,
          guest_name: guest.name.trim(),
          guest_phone: guest.phone.trim(),
          guest_email: guest.email.trim(),
          items: rows.map((r) => ({
            product_id: r.product.id,
            quantity: r.quantity,
            selected_size: r.selected_size || "",
          })),
          return_url: `${window.location.origin}/vmagazine`,
        };
        if (wantBonuses) {
          body.use_bonuses = true;
          body.bonus_amount = bonusAmount;
        }
        if (paymentMethod === "online" && cardId) {
          body.payment_card_id = cardId;
        }
        if (mode === "delivery" && currentAddress) {
          body.delivery_address = currentAddress.address;
          body.apartment = currentAddress.apartment || "";
          body.entrance = currentAddress.entrance || "";
          body.intercom = currentAddress.intercom || "";
          body.delivery_lat = currentAddress.lat;
          body.delivery_lon = currentAddress.lon;
          body.delivery_method = "own";
        }
        const res = await authFetch(`${API_URL}/shop/public/${encodeURIComponent(slug)}/order/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || `Ошибка заказа (${slug})`);
        orderCount += 1;
        if (data.confirmation_url) lastUrl = data.confirmation_url;
        for (const r of rows) {
          await removeCartItem(authFetch, API_URL, r.product.id);
        }
        first = false;
      }
      if (paymentMethod === "online") {
        showToast(
          onlineQueue
            ? "Оплатите заказ первого магазина — остальные останутся в корзине"
            : "Заказ создан",
        );
      } else {
        showToast(orderCount > 1 ? `Оформлено ${orderCount} заказа` : "Заказ оформлен");
      }
      setCheckoutOpen(false);
      await load();
      if (lastUrl) window.location.href = lastUrl;
    } catch (e) {
      showToast(e.message || "Не удалось оформить");
    } finally {
      setBusy(false);
    }
  }

  function renderCartItem(row) {
    const cover = row.product?.cover_url || row.product?.photos?.[0]?.thumb_url;
    const line = Number(row.product?.price || 0) * Number(row.quantity || 0);
    return (
      <article key={row.id} className="vmag-cart-item">
        <label className="vmag-cart-check">
          <input
            type="checkbox"
            checked={selected.has(row.id)}
            onChange={() => toggleOne(row.id)}
          />
        </label>
        <button
          type="button"
          className="vmag-cart-item-main"
          onClick={() => onOpenProduct?.(row.product)}
        >
          {cover ? <img src={cover} alt="" /> : <div className="vmag-cart-ph" />}
          <div className="vmag-cart-item-body">
            <strong>{line.toLocaleString("ru-RU")} ₽</strong>
            <span>{row.product?.name}</span>
            {row.selected_size ? <em>Размер: {row.selected_size}</em> : null}
          </div>
        </button>
        <div className="vmag-cart-item-actions">
          <div className="shop-cart-stepper">
            <button
              type="button"
              onClick={() => {
                const q = Math.max(0, Number(row.quantity) - 1);
                if (q <= 0) void removeCartItem(authFetch, API_URL, row.product.id).then(load);
                else
                  void setCartItem(
                    authFetch,
                    API_URL,
                    row.product.id,
                    q,
                    row.use_bonuses,
                    row.selected_size,
                  ).then(load);
              }}
            >
              −
            </button>
            <span>{row.quantity}</span>
            <button
              type="button"
              onClick={() =>
                void setCartItem(
                  authFetch,
                  API_URL,
                  row.product.id,
                  Number(row.quantity) + 1,
                  row.use_bonuses,
                  row.selected_size,
                ).then(load)
              }
            >
              +
            </button>
          </div>
          <button
            type="button"
            className="vmag-cart-trash"
            aria-label="Удалить"
            onClick={() => void removeCartItem(authFetch, API_URL, row.product.id).then(load)}
          >
            <TrashIcon />
          </button>
        </div>
      </article>
    );
  }

  if (checkoutOpen) {
    const hasMapPin =
      currentAddress?.lat != null &&
      currentAddress?.lon != null &&
      Number.isFinite(Number(currentAddress.lat)) &&
      Number.isFinite(Number(currentAddress.lon));

    return (
      <div className="vmag-checkout">
        <header className="vmag-checkout-head">
          <button
            type="button"
            className="vmag-icon-btn"
            aria-label="Назад в корзину"
            onClick={() => setCheckoutOpen(false)}
          >
            <BackArrowIcon />
          </button>
          <h2>Оформление</h2>
          <button
            type="button"
            className="vmag-icon-btn"
            aria-label="Закрыть"
            onClick={() => setCheckoutOpen(false)}
          >
            <CloseIcon />
          </button>
        </header>

        <section className="vmag-widget">
          <h3>
            Заказы: {selectedShopGroups.length} {shopWord(selectedShopGroups.length)}
          </h3>
          <ul className="vmag-total-breakdown muted small">
            {selectedShopGroups.map((g) => (
              <li key={g.slug || g.provider_name}>
                <span>{g.provider_name}</span>
                <span>{g.sum.toLocaleString("ru-RU")} ₽</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="vmag-widget">
          <h3>Способ получения</h3>
          <div className="vmag-seg" role="group" aria-label="Способ получения">
            <button
              type="button"
              className={mode === "delivery" ? "is-on" : ""}
              onClick={() => setMode("delivery")}
            >
              Доставка
            </button>
            <button
              type="button"
              className={mode === "pickup" ? "is-on" : ""}
              onClick={() => setMode("pickup")}
            >
              Самовывоз
            </button>
          </div>
          {mode === "delivery" ? (
            <>
              {addresses.length ? (
                <>
                  <div className="vmag-cart-address-chips" style={{ marginTop: "0.55rem" }}>
                    {addresses.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        className={`shop-size-chip${Number(addressId) === Number(a.id) ? " is-on" : ""}`}
                        onClick={() => setAddressId(a.id)}
                      >
                        {a.label || a.address}
                      </button>
                    ))}
                  </div>
                  <label className="vmag-field">
                    <span>Адрес</span>
                    <select value={addressId || ""} onChange={(e) => setAddressId(Number(e.target.value))}>
                      {addresses.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label ? `${a.label}: ` : ""}
                          {a.address}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                <p className="muted small">Добавьте адрес доставки.</p>
              )}
              <button type="button" className="ghost-btn" onClick={() => setAddressModalOpen(true)}>
                + Адрес
              </button>
              {hasMapPin ? (
                <div className="vmag-checkout-map" style={{ marginTop: "0.5rem", minHeight: 160 }}>
                  <CafeGuestDeliveryMap
                    zones={[]}
                    pin={{
                      lat: Number(currentAddress.lat),
                      lon: Number(currentAddress.lon),
                      address: currentAddress.address || "",
                    }}
                    onPick={() => {}}
                  />
                </div>
              ) : null}
            </>
          ) : (
            <p className="muted small">Заберёте заказ в магазине продавца.</p>
          )}
        </section>

        <section className="vmag-widget">
          <h3>Получатель</h3>
          <label className="vmag-field">
            <span>Имя</span>
            <input
              value={guest.name}
              onChange={(e) => setGuest((g) => ({ ...g, name: e.target.value }))}
              autoComplete="name"
            />
          </label>
          <label className="vmag-field">
            <span>Телефон</span>
            <input
              value={guest.phone}
              onChange={(e) => setGuest((g) => ({ ...g, phone: e.target.value }))}
              autoComplete="tel"
              inputMode="tel"
            />
          </label>
          <label className="vmag-field">
            <span>Email</span>
            <input
              value={guest.email}
              onChange={(e) => setGuest((g) => ({ ...g, email: e.target.value }))}
              autoComplete="email"
              inputMode="email"
            />
          </label>
        </section>

        <section className="vmag-widget">
          <h3>Оплата</h3>
          <div className="vmag-seg" role="group" aria-label="Способ оплаты">
            <button
              type="button"
              className={paymentMethod === "online" ? "is-on" : ""}
              onClick={() => setPaymentMethod("online")}
            >
              Онлайн
            </button>
            <button
              type="button"
              className={paymentMethod === "on_receipt" ? "is-on" : ""}
              onClick={() => setPaymentMethod("on_receipt")}
            >
              При получении
            </button>
          </div>
          {paymentMethod === "online" ? (
            <div style={{ marginTop: "0.65rem" }}>
              {cards.filter((c) => c.has_token).length ? (
                <div className="vmag-cards-grid">
                  {cards
                    .filter((c) => c.has_token)
                    .map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`vmag-pay-card${Number(cardId) === Number(c.id) ? " is-on" : ""}`}
                      onClick={() => setCardId(c.id)}
                      style={{
                        textAlign: "left",
                        cursor: "pointer",
                        outline: Number(cardId) === Number(c.id) ? "2px solid #6a4c93" : undefined,
                      }}
                    >
                      <div className="vmag-pay-card-top">
                        <CardBrandMark brand={c.brand} />
                      </div>
                      <p className="vmag-pay-masked">
                        •••• •••• •••• <span>{c.last4}</span>
                      </p>
                      <p className="muted small">
                        {String(c.exp_month).padStart(2, "0")}/{String(c.exp_year).slice(-2)}
                        {c.provider_name ? ` · ${c.provider_name}` : ""}
                        {c.is_default ? " · основная" : ""}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="muted small">
                  Привязанных карт пока нет — после первой оплаты карта сохранится в ЮKassa автоматически.
                </p>
              )}
              <p className="muted small" style={{ marginTop: "0.45rem" }}>
                {cardId
                  ? "Спишем с выбранной карты; при 3‑D Secure откроется страница банка."
                  : "Оплата на странице ЮKassa; карта сохранится для следующих заказов этого магазина."}
              </p>
            </div>
          ) : null}
        </section>

        {selectedShopGroups.some((g) => g.slug && g.bonus_balance > 0) ? (
          <section className="vmag-widget">
            <h3>Вбонусы</h3>
            {selectedShopGroups.map((g) => {
              if (!g.slug || !(g.bonus_balance > 0)) return null;
              const maxSpend = estimateBonusSpend(g.bonus_balance, g.sum);
              return (
                <label key={g.slug} className="vmag-check-row">
                  <input
                    type="checkbox"
                    checked={Boolean(useBonusesBySlug[g.slug])}
                    onChange={(e) =>
                      setUseBonusesBySlug((prev) => ({ ...prev, [g.slug]: e.target.checked }))
                    }
                  />
                  <span>
                    Списать Вбонусы (до {maxSpend.toLocaleString("ru-RU")} ₽)
                    <em className="muted"> · {g.provider_name}</em>
                  </span>
                </label>
              );
            })}
          </section>
        ) : null}

        <label className="vmag-check-row">
          <input type="checkbox" checked={serviceFee} onChange={(e) => setServiceFee(e.target.checked)} />
          <span>
            Сервисный сбор 1,5%
            <em>{feeAmount.toLocaleString("ru-RU")} ₽</em>
          </span>
        </label>
        {selectedShopGroups.length > 1 ? (
          <p className="muted small">Сервисный сбор начисляется один раз на все заказы.</p>
        ) : null}

        <button type="button" className="vmag-total-toggle" onClick={() => setTotalOpen((v) => !v)}>
          <span className="vmag-total-toggle-label">
            Итого
            <ChevronIcon open={totalOpen} />
          </span>
          <strong>{payTotal.toLocaleString("ru-RU")} ₽</strong>
        </button>
        {totalOpen ? (
          <ul className="vmag-total-breakdown muted small">
            <li>
              <span>Товары</span>
              <span>{selectedSum.toLocaleString("ru-RU")} ₽</span>
            </li>
            {bonusesEstimate > 0 ? (
              <li>
                <span>Вбонусы</span>
                <span>−{bonusesEstimate.toLocaleString("ru-RU")} ₽</span>
              </li>
            ) : null}
            {serviceFee ? (
              <li>
                <span>Сервисный сбор</span>
                <span>{feeAmount.toLocaleString("ru-RU")} ₽</span>
              </li>
            ) : null}
            <li>
              <span>К оплате</span>
              <span>{payTotal.toLocaleString("ru-RU")} ₽</span>
            </li>
          </ul>
        ) : null}

        <button type="button" className="primary-btn" disabled={busy} onClick={() => void placeOrders()}>
          {paymentMethod === "online" ? "Оплатить онлайн" : "Заказать"} · {payTotal.toLocaleString("ru-RU")} ₽
        </button>

        <label className="vmag-check-row vmag-checkout-agree">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>
            Нажимая кнопку, вы соглашаетесь с{" "}
            <a href="/offer" target="_blank" rel="noopener noreferrer">
              публичной офертой
            </a>{" "}
            и{" "}
            <a href="/privacy" target="_blank" rel="noopener noreferrer">
              политикой конфиденциальности
            </a>
          </span>
        </label>

        <AddressPickerModal
          open={addressModalOpen}
          onClose={() => setAddressModalOpen(false)}
          onSaved={() => void reloadAddresses()}
          authFetch={authFetch}
          API_URL={API_URL}
          existingCount={addresses.length}
        />
      </div>
    );
  }

  return (
    <div className="vmag-cart">
      <h2>Корзина</h2>
      {addresses.length ? (
        <div className="vmag-cart-addresses">
          <p className="muted small" style={{ margin: "0 0 0.35rem" }}>
            Адрес доставки
          </p>
          <div className="vmag-cart-address-chips">
            {addresses.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`shop-size-chip${Number(addressId) === Number(a.id) ? " is-on" : ""}`}
                onClick={() => setAddressId(a.id)}
              >
                {a.label || a.address}
              </button>
            ))}
          </div>
          {currentAddress?.address ? (
            <p className="muted small vmag-cart-address">{currentAddress.address}</p>
          ) : null}
        </div>
      ) : (
        <p className="muted small">Укажите адрес на главной — он понадобится для доставки.</p>
      )}

      {items.length ? (
        <label className="vmag-check-row vmag-cart-select-all">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() => {
              if (allSelected) setSelected(new Set());
              else setSelected(new Set(items.map((r) => r.id)));
            }}
          />
          <span>Выбрать все</span>
        </label>
      ) : null}

      {loading ? <p className="muted">Загрузка…</p> : null}
      <div className="vmag-cart-list">
        {shopGroups.map((g) => (
          <div key={g.slug || g.provider_name} className="vmag-cart-shop-group">
            <h3 className="vmag-cart-shop-title" style={{ margin: "0.35rem 0 0.45rem", fontSize: "1rem" }}>
              {g.provider_name}
            </h3>
            {g.rows.map((row) => renderCartItem(row))}
          </div>
        ))}
      </div>
      {!loading && !items.length ? <EmptyState text="Корзина пуста." onGoHome={onGoHome} /> : null}

      {items.length ? (
        <div className="vmag-cart-footer">
          <button
            type="button"
            className="primary-btn"
            disabled={!selectedRows.length}
            onClick={() => setCheckoutOpen(true)}
          >
            К оформлению · {selectedSum.toLocaleString("ru-RU")} ₽
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function ProfileTab({ authFetch, API_URL, onOpenProduct }) {
  const [hub, setHub] = useState(null);
  const [bonuses, setBonuses] = useState([]);
  const [cards, setCards] = useState([]);
  const [recent, setRecent] = useState([]);
  const [returns, setReturns] = useState([]);
  const [recentAll, setRecentAll] = useState(false);
  const [cardFormOpen, setCardFormOpen] = useState(false);
  const [cardForm, setCardForm] = useState({ number: "", exp_month: "", exp_year: "" });
  const [returnForm, setReturnForm] = useState(null); // { orderId, itemId, name }

  async function reloadCards() {
    setCards(await loadPaymentCards(authFetch, API_URL));
  }

  async function reloadReturns() {
    setReturns(await loadReturns(authFetch, API_URL));
  }

  useEffect(() => {
    (async () => {
      try {
        const [p, b, c, r, ret] = await Promise.all([
          loadProfileHub(authFetch, API_URL),
          loadBonuses(authFetch, API_URL),
          loadPaymentCards(authFetch, API_URL),
          loadRecentlyViewed(authFetch, API_URL, { all: false }),
          loadReturns(authFetch, API_URL).catch(() => []),
        ]);
        setHub(p);
        setBonuses(b || []);
        setCards(c || []);
        setRecent(r || []);
        setReturns(ret || []);
      } catch (e) {
        showToast(e.message || "Не удалось загрузить профиль");
      }
    })();
  }, [API_URL, authFetch]);

  async function openAllRecent() {
    setRecentAll(true);
    try {
      setRecent(await loadRecentlyViewed(authFetch, API_URL, { all: true }));
    } catch (e) {
      showToast(e.message || "Не удалось загрузить историю");
    }
  }

  const previewBrand = detectBrandClient(cardForm.number);
  const returnableOrders = useMemo(() => {
    const list = [];
    for (const o of hub?.purchases || []) list.push(o);
    for (const o of hub?.active_orders || []) {
      if (["ready", "delivering", "done"].includes(String(o.status))) list.push(o);
    }
    const seen = new Set();
    return list.filter((o) => {
      if (seen.has(o.id)) return false;
      seen.add(o.id);
      return true;
    });
  }, [hub]);

  function returnStatusLabel(status) {
    return (
      {
        pending: "На рассмотрении",
        approved: "Одобрен",
        rejected: "Отклонён",
        done: "Выполнен",
      }[status] || status
    );
  }

  return (
    <div className="vmag-profile">
      <h2>Профиль</h2>

      <section className="vmag-widget">
        <h3>Заказы</h3>
        <div className="vmagazine-list">
          {(hub?.active_orders || []).map((o) => (
            <article key={o.id} className="vmagazine-card">
              <div className="vmagazine-card-head">
                <div>
                  <strong>{o.provider_name || `Заказ #${o.id}`}</strong>
                  <p className="muted small">
                    {orderStatusLabel(o.status)}
                    {o.eta_text ? ` · ≈ ${o.eta_text}` : ""}
                  </p>
                </div>
                <strong>{Number(o.total).toLocaleString("ru-RU")} ₽</strong>
              </div>
              <OrderStatusTrack status={o.status} mode={o.mode || "delivery"} />
            </article>
          ))}
          {!hub?.active_orders?.length ? <p className="muted">Нет активных заказов.</p> : null}
        </div>
      </section>

      <section className="vmag-widget">
        <h3>Оставить отзыв</h3>
        <div className="vmagazine-list">
          {(hub?.reviewable || []).map((r) => (
            <article key={`${r.order_id}-${r.product_id}`} className="vmagazine-card">
              <strong>{r.name}</strong>
              <p className="muted small">{r.provider_name}</p>
              <button
                type="button"
                onClick={() => {
                  if (r.shop_url) window.location.href = r.shop_url;
                }}
              >
                Оставить отзыв на витрине
              </button>
            </article>
          ))}
          {!hub?.reviewable?.length ? <p className="muted">Пока нет товаров для отзыва.</p> : null}
        </div>
      </section>

      <section className="vmag-widget">
        <h3>Возвраты</h3>
        <div className="vmagazine-list">
          {returnableOrders.map((o) => (
            <article key={`ret-src-${o.id}`} className="vmagazine-card">
              <div className="vmagazine-card-head">
                <div>
                  <strong>{o.provider_name || `Заказ #${o.id}`}</strong>
                  <p className="muted small">
                    {o.created_at ? new Date(o.created_at).toLocaleDateString("ru-RU") : ""} ·{" "}
                    {orderStatusLabel(o.status)}
                  </p>
                </div>
                <strong>{Number(o.total).toLocaleString("ru-RU")} ₽</strong>
              </div>
              <ul className="muted small">
                {(o.items || []).map((it) => {
                  const existing = returns.find((r) => Number(r.order_item_id) === Number(it.id));
                  return (
                    <li key={it.id}>
                      {it.name} × {it.quantity}
                      {existing ? (
                        <span> — {returnStatusLabel(existing.status)}</span>
                      ) : (
                        <button
                          type="button"
                          className="ghost-btn"
                          style={{ marginLeft: 8 }}
                          onClick={() =>
                            setReturnForm({
                              orderId: o.id,
                              itemId: it.id,
                              name: it.name,
                              reason: "",
                            })
                          }
                        >
                          Вернуть
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </article>
          ))}
          {!returnableOrders.length ? <p className="muted">Нет заказов для возврата.</p> : null}
        </div>
        {returnForm ? (
          <div className="vmag-return-form">
            <strong>Возврат: {returnForm.name}</strong>
            <textarea
              placeholder="Причина возврата"
              value={returnForm.reason}
              onChange={(e) => setReturnForm((f) => ({ ...f, reason: e.target.value }))}
            />
            <div className="vmag-return-actions">
              <button
                type="button"
                className="vmag-icon-btn"
                aria-label="Закрыть"
                onClick={() => setReturnForm(null)}
              >
                <CloseIcon />
              </button>
              <button
                type="button"
                className="primary-btn"
                onClick={async () => {
                  try {
                    await createReturn(authFetch, API_URL, {
                      order_id: returnForm.orderId,
                      order_item_id: returnForm.itemId,
                      reason: returnForm.reason,
                    });
                    setReturnForm(null);
                    await reloadReturns();
                    showToast("Заявка на возврат отправлена");
                  } catch (e) {
                    showToast(e.message || "Не удалось создать заявку");
                  }
                }}
              >
                Отправить
              </button>
            </div>
          </div>
        ) : null}
        {returns.length ? (
          <div className="vmagazine-list" style={{ marginTop: "0.75rem" }}>
            <h4 style={{ margin: 0 }}>Мои заявки</h4>
            {returns.map((r) => (
              <article key={r.id} className="vmagazine-card">
                <strong>{r.product_name}</strong>
                <p className="muted small">
                  {r.provider_name} · {returnStatusLabel(r.status)}
                </p>
                {r.reason ? <p className="small">{r.reason}</p> : null}
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section className="vmag-widget">
        <h3>Покупки</h3>
        <div className="vmagazine-list">
          {(hub?.purchases || []).map((o) => (
            <article key={o.id} className="vmagazine-card">
              <div className="vmagazine-card-head">
                <div>
                  <strong>{o.provider_name}</strong>
                  <p className="muted small">
                    {o.created_at ? new Date(o.created_at).toLocaleDateString("ru-RU") : ""} ·{" "}
                    {orderStatusLabel(o.status)}
                  </p>
                </div>
                <strong>{Number(o.total).toLocaleString("ru-RU")} ₽</strong>
              </div>
              <OrderStatusTrack status={o.status} mode={o.mode || "delivery"} />
              <ul className="muted small">
                {(o.items || []).map((it) => (
                  <li key={it.id}>
                    {it.name}
                    {it.selected_size ? ` · ${it.selected_size}` : ""} × {it.quantity} —{" "}
                    {Number(it.unit_price).toLocaleString("ru-RU")} ₽
                  </li>
                ))}
              </ul>
            </article>
          ))}
          {!hub?.purchases?.length ? <p className="muted">Покупок пока нет.</p> : null}
        </div>
      </section>

      <section className="vmag-widget">
        <div className="vmag-widget-head">
          <h3>Карты</h3>
          <button
            type="button"
            className="vmag-address-plus"
            aria-label="Добавить карту"
            onClick={() => setCardFormOpen((v) => !v)}
          >
            +
          </button>
        </div>
        <div className="vmag-cards-grid">
          {cards.map((c) => (
            <article key={c.id} className="vmag-pay-card">
              <div className="vmag-pay-card-top">
                <CardBrandMark brand={c.brand} />
                <button
                  type="button"
                  className="ghost-btn"
                  aria-label="Удалить карту"
                  onClick={async () => {
                    try {
                      await deletePaymentCard(authFetch, API_URL, c.id);
                      await reloadCards();
                    } catch (e) {
                      showToast(e.message || "Не удалось удалить");
                    }
                  }}
                >
                  ✕
                </button>
              </div>
              <p className="vmag-pay-masked">•••• •••• •••• <span>{c.last4}</span></p>
              <p className="muted small">
                {String(c.exp_month).padStart(2, "0")}/{String(c.exp_year).slice(-2)}
                {c.is_default ? " · основная" : ""}
              </p>
            </article>
          ))}
        </div>
        {cardFormOpen ? (
          <div className="vmag-card-form">
            <div className="vmag-card-form-brand">
              <CardBrandMark brand={previewBrand} />
              <span className="muted small">Бренд определится автоматически</span>
            </div>
            <input
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="Номер карты"
              value={cardForm.number.replace(/(\d{4})(?=\d)/g, "$1 ").trim()}
              onChange={(e) =>
                setCardForm((f) => ({
                  ...f,
                  number: e.target.value.replace(/\D/g, "").slice(0, 19),
                }))
              }
            />
            <div className="vmag-addr-grid">
              <input
                inputMode="numeric"
                placeholder="ММ"
                maxLength={2}
                value={cardForm.exp_month}
                onChange={(e) => setCardForm((f) => ({ ...f, exp_month: e.target.value.replace(/\D/g, "").slice(0, 2) }))}
              />
              <input
                inputMode="numeric"
                placeholder="ГГГГ"
                maxLength={4}
                value={cardForm.exp_year}
                onChange={(e) => setCardForm((f) => ({ ...f, exp_year: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
              />
            </div>
            <button
              type="button"
              className="primary-btn"
              onClick={async () => {
                try {
                  await savePaymentCard(authFetch, API_URL, {
                    number: cardForm.number,
                    exp_month: Number(cardForm.exp_month),
                    exp_year: Number(cardForm.exp_year),
                  });
                  setCardForm({ number: "", exp_month: "", exp_year: "" });
                  setCardFormOpen(false);
                  await reloadCards();
                  showToast("Карта добавлена");
                } catch (e) {
                  showToast(e.message || "Проверьте данные карты");
                }
              }}
            >
              Сохранить карту
            </button>
          </div>
        ) : null}
        {!cards.length && !cardFormOpen ? <p className="muted">Добавьте карту плюсиком.</p> : null}
      </section>

      <section className="vmag-widget">
        <h3>Вбонусы</h3>
        <div className="vmagazine-list">
          {bonuses.map((b) => (
            <article key={b.provider_id} className="vmagazine-card">
              <div className="vmagazine-card-head">
                <strong>{b.provider_name}</strong>
                <strong>{Number(b.balance).toLocaleString("ru-RU")} бон.</strong>
              </div>
              <p className="muted small">Можно списать при заказе в этом магазине и в корзине.</p>
              {b.shop_url ? (
                <button type="button" onClick={() => (window.location.href = b.shop_url)}>
                  В магазин
                </button>
              ) : null}
            </article>
          ))}
          {!bonuses.length ? (
            <p className="muted">Пока нет Вбонусов — появятся после покупок у продавцов с программой.</p>
          ) : null}
        </div>
      </section>

      <HorizontalRail title="Вы смотрели" onTitleClick={() => void openAllRecent()}>
        {recent.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            authFetch={authFetch}
            API_URL={API_URL}
            compact
            onOpen={onOpenProduct}
          />
        ))}
      </HorizontalRail>
      {recentAll ? <p className="muted small">Показаны все недавние просмотры (до 80).</p> : null}
    </div>
  );
}
