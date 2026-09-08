import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CafeGuestDeliveryMap from "../CafeGuestDeliveryMap.jsx";
import { fetchAddressSuggestions } from "../addressSuggest.js";
import { showToast } from "../toast.js";
import { HorizontalRail, ProductCard, orderStatusLabel } from "./VmagazineComponents.jsx";
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
          {!displayProducts.length ? <p className="muted vmagazine-empty">Ничего не найдено.</p> : null}
          <button type="button" className="ghost-btn" onClick={() => setMode("home")}>
            На главную
          </button>
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
            <p className="muted vmagazine-empty">Пока нет товаров в витринах.</p>
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

export function FavoritesTab({ authFetch, API_URL, onOpenProduct }) {
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
      {!loading && !items.length ? <p className="muted vmagazine-empty">Пока пусто — лайкайте товары в карточке.</p> : null}
    </div>
  );
}

export function CartTab({ authFetch, API_URL, me, onOpenProduct }) {
  const [items, setItems] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(() => new Set());
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [totalOpen, setTotalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState("delivery");
  const [addressId, setAddressId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("online");
  const [serviceFee, setServiceFee] = useState(true);
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

  const selectedRows = useMemo(
    () => items.filter((r) => selected.has(r.id)),
    [items, selected],
  );
  const selectedSum = useMemo(
    () => selectedRows.reduce((s, row) => s + Number(row.product?.price || 0) * Number(row.quantity || 0), 0),
    [selectedRows],
  );
  const feeAmount = serviceFee ? Math.round(selectedSum * 0.015 * 100) / 100 : 0;
  const payTotal = selectedSum + feeAmount;
  const allSelected = items.length > 0 && selected.size === items.length;
  const currentAddress = addresses.find((a) => a.id === addressId) || addresses[0];

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
      let lastUrl = "";
      for (const [slug, rows] of bySlug.entries()) {
        const body = {
          mode,
          payment_method: paymentMethod,
          service_fee: serviceFee,
          guest_name: guest.name.trim(),
          guest_phone: guest.phone.trim(),
          guest_email: guest.email.trim(),
          items: rows.map((r) => ({ product_id: r.product.id, quantity: r.quantity })),
          return_url: `${window.location.origin}/vmagazine`,
        };
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
        if (data.confirmation_url) lastUrl = data.confirmation_url;
        for (const r of rows) {
          await removeCartItem(authFetch, API_URL, r.product.id);
        }
      }
      showToast(paymentMethod === "online" ? "Заказ создан" : "Заказ оформлен");
      setCheckoutOpen(false);
      await load();
      if (lastUrl) window.location.href = lastUrl;
    } catch (e) {
      showToast(e.message || "Не удалось оформить");
    } finally {
      setBusy(false);
    }
  }

  if (checkoutOpen) {
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
            addresses.length ? (
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
            ) : (
              <p className="muted small">Добавьте адрес на главной Вмагазине.</p>
            )
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
        </section>

        <label className="vmag-check-row">
          <input type="checkbox" checked={serviceFee} onChange={(e) => setServiceFee(e.target.checked)} />
          <span>
            Сервисный сбор 1,5%
            <em>{feeAmount.toLocaleString("ru-RU")} ₽</em>
          </span>
        </label>

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
            {serviceFee ? (
              <li>
                <span>Сервисный сбор</span>
                <span>{feeAmount.toLocaleString("ru-RU")} ₽</span>
              </li>
            ) : null}
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
        {items.map((row) => {
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
                  <em className="muted">{row.product?.provider_name}</em>
                </div>
              </button>
              <div className="vmag-cart-item-actions">
                <div className="shop-cart-stepper">
                  <button
                    type="button"
                    onClick={() => {
                      const q = Math.max(0, Number(row.quantity) - 1);
                      if (q <= 0) void removeCartItem(authFetch, API_URL, row.product.id).then(load);
                      else void setCartItem(authFetch, API_URL, row.product.id, q, row.use_bonuses).then(load);
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
        })}
      </div>
      {!loading && !items.length ? <p className="muted vmagazine-empty">Корзина пуста.</p> : null}

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
              <ul className="muted small">
                {(o.items || []).map((it) => (
                  <li key={it.id}>
                    {it.name} × {it.quantity} — {Number(it.unit_price).toLocaleString("ru-RU")} ₽
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
