import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CafeGuestDeliveryMap from "../CafeGuestDeliveryMap.jsx";
import { fetchAddressSuggestions } from "../addressSuggest.js";
import { showToast } from "../toast.js";
import { HorizontalRail, ProductCard, orderStatusLabel } from "./VmagazineComponents.jsx";
import {
  deletePaymentCard,
  loadBonuses,
  loadCart,
  loadHome,
  loadPaymentCards,
  loadProductLikes,
  loadProfileHub,
  loadRecentlyViewed,
  removeCartItem,
  saveAddress,
  savePaymentCard,
  searchSuggest,
  setCartItem,
} from "./vmagazineApi.js";

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

export function CartTab({ authFetch, API_URL }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await loadCart(authFetch, API_URL));
    } catch (e) {
      showToast(e.message || "Не удалось загрузить корзину");
    } finally {
      setLoading(false);
    }
  }, [API_URL, authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = useMemo(
    () => items.reduce((s, row) => s + Number(row.product?.price || 0) * Number(row.quantity || 0), 0),
    [items],
  );

  return (
    <div>
      <h2>Корзина</h2>
      {loading ? <p className="muted">Загрузка…</p> : null}
      <div className="vmagazine-list">
        {items.map((row) => (
          <article key={row.id} className="vmagazine-card">
            <div className="vmagazine-card-head">
              <div>
                <strong>{row.product?.name}</strong>
                <p className="muted small">{row.product?.provider_name}</p>
                {Number(row.bonus_balance) > 0 ? (
                  <p className="muted small">Вбонусы магазина: {Number(row.bonus_balance).toLocaleString("ru-RU")}</p>
                ) : null}
              </div>
              <strong>{(Number(row.product?.price) * row.quantity).toLocaleString("ru-RU")} ₽</strong>
            </div>
            <div className="vmag-cart-row">
              <input
                type="number"
                min={1}
                value={row.quantity}
                onChange={(e) => {
                  const qty = Math.max(1, Number(e.target.value) || 1);
                  void setCartItem(authFetch, API_URL, row.product.id, qty, row.use_bonuses).then(load);
                }}
              />
              {Number(row.bonus_balance) > 0 ? (
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={Boolean(row.use_bonuses)}
                    onChange={(e) =>
                      void setCartItem(authFetch, API_URL, row.product.id, row.quantity, e.target.checked).then(load)
                    }
                  />
                  Списать Вбонусы
                </label>
              ) : null}
              <button
                type="button"
                className="ghost-btn"
                onClick={() => void removeCartItem(authFetch, API_URL, row.product.id).then(load)}
              >
                Удалить
              </button>
              <button
                type="button"
                onClick={() => {
                  if (row.product?.shop_url) window.location.href = row.product.shop_url;
                }}
              >
                К витрине
              </button>
            </div>
          </article>
        ))}
      </div>
      {items.length ? (
        <p className="cafe-cart-total">
          Итого: <strong>{total.toLocaleString("ru-RU")} ₽</strong>
        </p>
      ) : null}
      {!loading && !items.length ? <p className="muted vmagazine-empty">Корзина пуста.</p> : null}
    </div>
  );
}

export function ProfileTab({ authFetch, API_URL, onOpenProduct }) {
  const [hub, setHub] = useState(null);
  const [bonuses, setBonuses] = useState([]);
  const [cards, setCards] = useState([]);
  const [recent, setRecent] = useState([]);
  const [recentAll, setRecentAll] = useState(false);
  const [cardFormOpen, setCardFormOpen] = useState(false);
  const [cardForm, setCardForm] = useState({ number: "", exp_month: "", exp_year: "" });

  async function reloadCards() {
    setCards(await loadPaymentCards(authFetch, API_URL));
  }

  useEffect(() => {
    (async () => {
      try {
        const [p, b, c, r] = await Promise.all([
          loadProfileHub(authFetch, API_URL),
          loadBonuses(authFetch, API_URL),
          loadPaymentCards(authFetch, API_URL),
          loadRecentlyViewed(authFetch, API_URL, { all: false }),
        ]);
        setHub(p);
        setBonuses(b || []);
        setCards(c || []);
        setRecent(r || []);
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
