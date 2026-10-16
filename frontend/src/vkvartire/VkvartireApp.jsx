import { useCallback, useEffect, useMemo, useState } from "react";
import { showToast } from "../toast.js";
import VkvartireFilters from "./VkvartireFilters.jsx";
import VkvartireListingCard from "./VkvartireListingCard.jsx";
import VkvartireMap from "./VkvartireMap.jsx";
import {
  DEFAULT_FILTERS,
  addFavorite,
  createSavedSearch,
  deleteSavedSearch,
  filtersFromSaved,
  loadFavorites,
  loadFeed,
  loadListing,
  loadSavedSearches,
  removeFavorite,
  startListingChat,
} from "./vkvartireApi.js";
import "./vkvartire.css";

const TABS = [
  { id: "feed", label: "Лента", icon: "🏠" },
  { id: "favorites", label: "Избранное", icon: "♥" },
];

export default function VkvartireApp({ authFetch, API_URL, onTabChange, onOpenConversation }) {
  const [tab, setTab] = useState("feed");
  const [viewMode, setViewMode] = useState("list"); // list | map
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [items, setItems] = useState([]);
  const [favItems, setFavItems] = useState([]);
  const [savedSearches, setSavedSearches] = useState([]);
  const [meta, setMeta] = useState(null);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);

  const filterKey = useMemo(() => JSON.stringify(filters), [filters]);

  const setTabSafe = useCallback(
    (id) => {
      setTab(id);
      onTabChange?.(id);
    },
    [onTabChange]
  );

  const refreshFeed = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadFeed(authFetch, API_URL, { ...filters, page: 1, page_size: 40 });
      setItems(Array.isArray(data?.results) ? data.results : []);
      setMeta(data?.meta || null);
      setTotal(typeof data?.total === "number" ? data.total : null);
    } catch (e) {
      showToast(e.message || "Не удалось загрузить ленту", { tone: "error" });
    } finally {
      setLoading(false);
    }
  }, [API_URL, authFetch, filters]);

  const refreshFavorites = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadFavorites(authFetch, API_URL);
      setFavItems(Array.isArray(data?.results) ? data.results : []);
    } catch (e) {
      showToast(e.message || "Не удалось загрузить избранное", { tone: "error" });
    } finally {
      setLoading(false);
    }
  }, [API_URL, authFetch]);

  const refreshSaved = useCallback(async () => {
    try {
      const data = await loadSavedSearches(authFetch, API_URL);
      setSavedSearches(Array.isArray(data?.results) ? data.results : []);
    } catch {
      /* ignore */
    }
  }, [API_URL, authFetch]);

  useEffect(() => {
    void refreshSaved();
  }, [refreshSaved]);

  useEffect(() => {
    if (tab === "feed") void refreshFeed();
  }, [tab, filterKey, refreshFeed]);

  useEffect(() => {
    if (tab === "favorites") void refreshFavorites();
  }, [tab, refreshFavorites]);

  async function toggleFavorite(listing) {
    const id = listing.id;
    const was = Boolean(listing.is_favorite);
    // optimistic
    const patch = (arr) =>
      arr.map((row) => (row.id === id ? { ...row, is_favorite: !was } : row));
    setItems((prev) => patch(prev));
    setFavItems((prev) =>
      was ? prev.filter((r) => r.id !== id) : [{ ...listing, is_favorite: true }, ...prev]
    );
    try {
      if (was) await removeFavorite(authFetch, API_URL, id);
      else await addFavorite(authFetch, API_URL, id);
    } catch (e) {
      showToast(e.message || "Не удалось обновить избранное", { tone: "error" });
      void refreshFeed();
      if (tab === "favorites") void refreshFavorites();
    }
  }

  async function openListing(listing) {
    try {
      const full = await loadListing(authFetch, API_URL, listing.id);
      setDetail(full);
    } catch (e) {
      showToast(e.message || "Не удалось открыть", { tone: "error" });
    }
  }

  async function chatRealtor(listing) {
    try {
      const data = await startListingChat(authFetch, API_URL, listing.id);
      if (data?.can_chat && data?.conversation_id) {
        onOpenConversation?.(Number(data.conversation_id));
        showToast("Чат с риелтором открыт");
        setDetail(null);
        return;
      }
      const phone = data?.contact?.realtor_phone;
      if (phone) {
        showToast(`Чат недоступен. Телефон: ${phone}`);
      } else {
        showToast(data?.detail || "Чат недоступен — нет риелтора во Вместе", { tone: "error" });
      }
    } catch (e) {
      showToast(e.message || "Не удалось открыть чат", { tone: "error" });
    }
  }

  const list = tab === "favorites" ? favItems : items;

  return (
    <section className="card vkvartire-app full-width">
      <div className={`vkvartire-app-body${tab === "feed" && viewMode === "map" ? " vkvartire-app-body--map" : ""}`}>
        {tab === "feed" ? (
          <>
            <div className="vkvartire-toolbar">
              <div className="vkvartire-toolbar-titles">
                <strong>Подбор квартир</strong>
                <span className="vkvartire-toolbar-sub">Аренда и продажа</span>
              </div>
              <div className="vkvartire-view-toggle" role="group" aria-label="Вид">
                <button
                  type="button"
                  className={viewMode === "list" ? "is-active" : ""}
                  onClick={() => setViewMode("list")}
                >
                  Список
                </button>
                <button
                  type="button"
                  className={viewMode === "map" ? "is-active" : ""}
                  onClick={() => setViewMode("map")}
                >
                  Карта
                </button>
              </div>
            </div>
            <VkvartireFilters
              filters={filters}
              onChange={setFilters}
              commuteNote={meta?.commute_note}
              resultTotal={total}
              savedSearches={savedSearches}
              onSaveSearch={async ({ name, notify, filters: draftFilters }) => {
                try {
                  const payload = draftFilters || filters;
                  await createSavedSearch(authFetch, API_URL, { name, filters: payload, notify });
                  if (draftFilters) setFilters(draftFilters);
                  showToast("Поиск сохранён");
                  void refreshSaved();
                } catch (e) {
                  showToast(e.message || "Не удалось сохранить", { tone: "error" });
                }
              }}
              onApplySaved={(s) => {
                setFilters(filtersFromSaved(s.filters, DEFAULT_FILTERS));
                showToast(`Применён: ${s.name}`);
              }}
              onDeleteSaved={async (s) => {
                try {
                  await deleteSavedSearch(authFetch, API_URL, s.id);
                  void refreshSaved();
                } catch (e) {
                  showToast(e.message || "Не удалось удалить", { tone: "error" });
                }
              }}
            />
            {viewMode === "map" ? (
              <VkvartireMap
                authFetch={authFetch}
                API_URL={API_URL}
                filters={filters}
                showToast={showToast}
                onPickAnchor={({ lat, lon, label }) =>
                  setFilters((f) => ({
                    ...f,
                    anchor_lat: lat,
                    anchor_lon: lon,
                    anchor_label: label || "Точка на карте",
                    max_commute_min: f.max_commute_min || 20,
                  }))
                }
                onToggleFavorite={toggleFavorite}
                onChatRealtor={chatRealtor}
              />
            ) : (
              <div className="vkvartire-feed">
                {loading && !list.length ? (
                  <p className="vkvartire-empty">Ищем объявления…</p>
                ) : null}
                {!loading && !list.length ? (
                  <div className="vkvartire-empty">
                    <strong>Ничего не найдено</strong>
                    <p>Попробуйте снять фильтр по времени в пути или расширить цену и комнаты.</p>
                    <button
                      type="button"
                      className="vkvartire-chip is-active"
                      onClick={() => setFilters({ ...DEFAULT_FILTERS, deal_type: filters.deal_type })}
                    >
                      Сбросить фильтры
                    </button>
                  </div>
                ) : null}
                {list.map((row) => (
                  <VkvartireListingCard
                    key={row.id}
                    listing={row}
                    onOpen={openListing}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="vkvartire-feed">
            <div className="vkvartire-toolbar">
              <div className="vkvartire-toolbar-titles">
                <strong>Избранное</strong>
                <span className="vkvartire-toolbar-sub">Сохранённые объявления</span>
              </div>
            </div>
            {loading && !favItems.length ? <p className="vkvartire-empty">Загрузка…</p> : null}
            {!loading && !favItems.length ? (
              <div className="vkvartire-empty">
                <strong>Пока пусто</strong>
                <p>Нажмите ♥ на карточке в ленте — объявление появится здесь.</p>
              </div>
            ) : null}
            {favItems.map((row) => (
              <VkvartireListingCard
                key={row.id}
                listing={row}
                onOpen={openListing}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        )}
      </div>

      {detail ? (
        <div className="vkvartire-more-backdrop" role="presentation" onClick={() => setDetail(null)}>
          <div
            className="vkvartire-more-sheet vkvartire-detail-sheet"
            role="dialog"
            aria-label="Объявление"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="vkvartire-listing-sheet-close"
              onClick={() => setDetail(null)}
              aria-label="Закрыть"
            >
              ×
            </button>
            <VkvartireListingCard
              listing={detail}
              onToggleFavorite={async (l) => {
                await toggleFavorite(l);
                setDetail((d) => (d ? { ...d, is_favorite: !d.is_favorite } : d));
              }}
            />
            {detail.description ? <p className="vkvartire-detail-desc">{detail.description}</p> : null}
            {(detail.realtor_name || detail.realtor_phone) && (
              <p className="vkvartire-detail-contact">
                {detail.realtor_name || "Контакт"}
                {detail.realtor_phone ? (
                  <>
                    {" · "}
                    <a href={`tel:${String(detail.realtor_phone).replace(/\s/g, "")}`}>
                      {detail.realtor_phone}
                    </a>
                  </>
                ) : null}
              </p>
            )}
            <div className="vkvartire-detail-actions">
              {detail.can_chat ? (
                <button type="button" className="vkvartire-chip is-active" onClick={() => chatRealtor(detail)}>
                  Написать риелтору
                </button>
              ) : null}
              {detail.external_url ? (
                <a className="vkvartire-chip" href={detail.external_url} target="_blank" rel="noopener noreferrer">
                  Источник
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <nav className="vmenu-bottom-nav vkvartire-bottom-nav" aria-label="Вквартире">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? "active" : ""}
            onClick={() => setTabSafe(t.id)}
          >
            <span aria-hidden="true">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </section>
  );
}
