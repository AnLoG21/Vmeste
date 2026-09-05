import logoMain from "./assets/logo-main.png";
import VmenuLogo from "./vmenu/VmenuLogo.jsx";
import { bookmarkLabel } from "./subnavBookmarks.js";
import { formatDistanceKm, sphereMapIconHref } from "./clientOrgFeatures.js";

function bookmarkMenuIcon(id) {
  const icons = {
    client_map: {
      color: "#2e7d32",
      d: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
    },
    bookings: {
      color: "#1565c0",
      d: "M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z",
    },
    my_bookings: {
      color: "#ef6c00",
      d: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",
    },
    analytics: {
      color: "#6a1b9a",
      d: "M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zm5.6 8H19v6h-2.8v-6z",
    },
    intervals: {
      color: "#00838f",
      d: "M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zM7 12h5v5H7z",
    },
    services: {
      color: "#c2185b",
      d: "M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z",
    },
    chats: {
      color: "#0277bd",
      d: "M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z",
    },
    reviews: {
      color: "#f9a825",
      d: "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z",
    },
    settings: {
      color: "#546e7a",
      d: "M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z",
    },
    profile: {
      color: "#5d4037",
      d: "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
    },
    booking_history: {
      color: "#455a64",
      d: "M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z",
    },
    subscriptions: {
      color: "#2e7d32",
      d: "M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z",
    },
    staff: {
      color: "#1565c0",
      d: "M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z",
    },
    organization: {
      color: "#6d4c41",
      d: "M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z",
    },
    cafe: {
      color: "#e65100",
      d: "M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.11 0 2-.9 2-2V5c0-1.11-.89-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z",
    },
    cafe_orders: {
      color: "#ad1457",
      d: "M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2V5c0-1.1-.89-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",
    },
    cafe_my_orders: {
      color: "#ef6c00",
      d: "M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2V5c0-1.1-.89-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",
    },
    activity: {
      color: "#5d4037",
      d: "M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z",
    },
    loyalty: {
      color: "#c62828",
      d: "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z",
    },
    inspections: {
      color: "#00897b",
      d: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l7.59-7.59L21 8l-9 9z",
    },
    marketplaces: {
      color: "#1565c0",
      d: "M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm0 10c-2.76 0-5-2.24-5-5h2c0 1.66 1.34 3 3 3s3-1.34 3-3h2c0 2.76-2.24 5-5 5z",
    },
    service_apps: {
      color: "#e65100",
      d: "M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm0 10h4v-4h-4v4zm6-6v4h4v-4h-4zm-6 6h4v-4h-4v4zm6 0h4v-4h-4v4z",
    },
    logout: {
      color: "#c62828",
      d: "M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z",
    },
  };
  const icon = icons[id] || icons.bookings;
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill={icon.color} aria-hidden="true">
      <path d={icon.d} />
    </svg>
  );
}

function SubnavBookmarkButton({
  id,
  currentView,
  marketplaceInitialTab,
  me,
  navigateBookmark,
  isBookmarkAvailable,
  unreadMessagesCount,
  missedReviewsCount,
}) {
  if (!isBookmarkAvailable(id)) return null;
  const active =
    currentView === id ||
    (id === "analytics" &&
      currentView === "marketplaces" &&
      marketplaceInitialTab === "analytics") ||
    (id === "reviews" &&
      currentView === "marketplaces" &&
      marketplaceInitialTab === "reviews");
  const label = bookmarkLabel(id, me?.role, me?.provider_sphere);
  if (id === "chats") {
    return (
      <button
        key={id}
        type="button"
        className={["app-subnav-chat", active && "active"].filter(Boolean).join(" ")}
        data-platform-tour={`nav-${id}`}
        onClick={() => navigateBookmark(id)}
      >
        <span className="app-subnav-chat-inner" aria-hidden="true">
          <svg className="app-subnav-chat-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
          </svg>
          <span>{label}</span>
        </span>
        {unreadMessagesCount > 0 && (
          <span className="app-subnav-badge" aria-label={`Непрочитанных сообщений: ${unreadMessagesCount}`}>
            {unreadMessagesCount > 99 ? "99+" : unreadMessagesCount}
          </span>
        )}
      </button>
    );
  }
  if (id === "reviews") {
    return (
      <button
        key={id}
        type="button"
        className={["app-subnav-reviews", active && "active"].filter(Boolean).join(" ")}
        data-platform-tour={`nav-${id}`}
        onClick={() => navigateBookmark(id)}
      >
        <span>{label}</span>
        {missedReviewsCount > 0 && (
          <span className="app-subnav-badge" aria-label={`Непросмотренных отзывов: ${missedReviewsCount}`}>
            {missedReviewsCount > 99 ? "99+" : missedReviewsCount}
          </span>
        )}
      </button>
    );
  }
  return (
    <button
      key={id}
      type="button"
      className={active ? "active" : ""}
      data-platform-tour={`nav-${id}`}
      onClick={() => navigateBookmark(id)}
    >
      {label}
    </button>
  );
}

function menuOverflowBookmarkIds(me, subnavBookmarks, isBookmarkAvailable) {
  const role = me?.role;
  if (!role) return [];
  const inSubnav = new Set(subnavBookmarks);
  const preferred = [
    "marketplaces",
    "cafe",
    "cafe_orders",
    "activity",
    "cafe_my_orders",
    "loyalty",
    "client_map",
    "my_bookings",
    "intervals",
    "services",
    "service_apps",
    "analytics",
    "bookings",
    "reviews",
    "chats",
  ];
  return preferred.filter((id) => !inSubnav.has(id) && isBookmarkAvailable(id));
}

/** Logged-in / guest cabinet chrome: header, menu drawer, demo banner, toast, subnav. */
export default function CabinetChrome({
  accessToken,
  me,
  currentView,
  setCurrentView,
  verifyStatus,
  clientHeaderSearchWrapRef,
  clientMapSearchInput,
  setClientMapSearchInput,
  setClientMapSearchFocused,
  showClientDiscoverSearchDropdown,
  clientDiscoverSearchOrgs,
  clientDiscoverSearch,
  sphereOptions,
  openOrgOnMap,
  setClientFilterModalDraft,
  clientDiscoverFilters,
  setClientFiltersOpen,
  menuOpen,
  setMenuOpen,
  menuWrapRef,
  chatActivity,
  navigateBookmark,
  isBookmarkAvailable,
  subnavBookmarks,
  unreadMessagesCount,
  missedReviewsCount,
  marketplaceInitialTab,
  canAccessStaffPage,
  canManageOrgSettings,
  exitDemoSession,
  openAuth,
  intervalToast,
  children,
}) {
  const overflowIds = menuOverflowBookmarkIds(me, subnavBookmarks, isBookmarkAvailable);

  return (
    <>
      <header className={`hero top-row${!accessToken ? " page-header-guest" : ""}`}>
        <button
          type="button"
          className="brand-link brand-btn"
          onClick={() => {
            if (currentView === "vmenu") {
              setCurrentView("service_apps");
              return;
            }
            if (!accessToken) window.scrollTo({ top: 0, behavior: "smooth" });
            else if (me?.role === "client") setCurrentView("client_map");
            else if (me?.provider_sphere === "marketplaces") setCurrentView("marketplaces");
            else if (me?.provider_sphere === "cafe_restaurant") setCurrentView("cafe_orders");
            else setCurrentView("bookings");
          }}
        >
          {currentView === "vmenu" ? (
            <span className="vmenu-app-header-brand">
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
              </svg>
              <VmenuLogo size={28} />
              <strong>Вменю</strong>
            </span>
          ) : (
            <img
              src={logoMain}
              alt="Вместе"
              className="brand-logo"
              width={320}
              height={160}
              decoding="async"
              fetchPriority="high"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}
        </button>
        <div>{verifyStatus && <p className="verify-note">{verifyStatus}</p>}</div>
        {accessToken && currentView !== "vmenu" && (me?.role === "client" || (me?.role === "provider" && currentView === "client_map")) && (
          <div className="client-header-search">
            <div className="client-header-search-input-wrap" ref={clientHeaderSearchWrapRef}>
              <input
                type="search"
                className="client-header-search-input"
                placeholder="Сфера или название организации…"
                value={clientMapSearchInput}
                onChange={(e) => setClientMapSearchInput(e.target.value)}
                onFocus={() => setClientMapSearchFocused(true)}
                autoComplete="off"
                aria-label="Поиск на карте"
                aria-expanded={showClientDiscoverSearchDropdown}
                aria-controls="client-org-search-list"
                aria-autocomplete="list"
              />
              {showClientDiscoverSearchDropdown && (
                <ul
                  id="client-org-search-list"
                  className="client-org-search-dropdown"
                  role="listbox"
                  aria-label="Организации"
                >
                  {clientDiscoverSearchOrgs.length === 0 &&
                    clientDiscoverSearch.trim() === clientMapSearchInput.trim() && (
                      <li className="client-org-search-empty" role="presentation">
                        Ничего не найдено
                      </li>
                    )}
                  {clientDiscoverSearchOrgs.map((loc) => {
                    const name = loc.organization_name || loc.title || "Организация";
                    const sphereLabel =
                      loc.sphere_label ||
                      sphereOptions.find((o) => o.key === loc.provider_sphere)?.value ||
                      "";
                    const rating =
                      loc.provider_average_rating != null
                        ? Number(loc.provider_average_rating).toFixed(1)
                        : null;
                    const distLabel = formatDistanceKm(loc.distance_km);
                    return (
                      <li key={loc.provider} role="option">
                        <button
                          type="button"
                          className="client-org-search-item"
                          onClick={() => {
                            setClientMapSearchFocused(false);
                            openOrgOnMap(loc);
                          }}
                        >
                          <span className="client-org-search-thumb">
                            {loc.provider_cover_url ? (
                              <img src={loc.provider_cover_url} alt="" loading="lazy" decoding="async" />
                            ) : (
                              <img
                                src={sphereMapIconHref(loc.provider_sphere)}
                                alt=""
                                className="client-org-search-thumb-sphere"
                              />
                            )}
                          </span>
                          <span className="client-org-search-body">
                            <span className="client-org-search-name">{name}</span>
                            <span className="client-org-search-meta">
                              {distLabel ? (
                                <span className="client-org-search-distance">{distLabel}</span>
                              ) : null}
                              {rating != null && (
                                <span className="client-org-search-rating">★ {rating}</span>
                              )}
                              {sphereLabel && (
                                <span className="client-org-search-sphere">{sphereLabel}</span>
                              )}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <button
              type="button"
              className="client-filter-icon-btn"
              aria-label="Фильтры"
              title="Фильтры"
              onClick={() => {
                setClientFilterModalDraft({ ...clientDiscoverFilters });
                setClientFiltersOpen(true);
              }}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z" />
              </svg>
            </button>
          </div>
        )}
        {!accessToken && (
          <div className="landing-header-auth">
            <button type="button" className="landing-header-btn landing-header-btn--login" onClick={() => openAuth("login")}>
              Войти
            </button>
            <button type="button" className="landing-header-btn landing-header-btn--primary" onClick={() => openAuth("register")}>
              Регистрация
            </button>
          </div>
        )}
        {accessToken && (
          <div className={`menu-wrap${menuOpen ? " menu-wrap--open" : ""}`} ref={menuWrapRef}>
            <div className="menu-btn-wrap">
              <button
                type="button"
                className="menu-btn menu-btn--icon"
                aria-label="Меню"
                aria-expanded={menuOpen}
                title="Меню"
                data-platform-tour="menu-btn"
                onClick={() => setMenuOpen((v) => !v)}
              >
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
                  <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
                </svg>
              </button>
              {(chatActivity?.badge_count ?? 0) > 0 && (
                <span className="menu-nav-badge" aria-hidden="true">
                  {chatActivity.badge_count > 99 ? "99+" : chatActivity.badge_count}
                </span>
              )}
            </div>
            {menuOpen && (
              <div className="menu-dropdown">
                <button type="button" className="menu-dropdown-item" onClick={() => { setCurrentView("profile"); setMenuOpen(false); }}>
                  <span className="menu-item-icon" aria-hidden="true">
                    {bookmarkMenuIcon("profile")}
                  </span>
                  <span className="menu-item-label">Личный кабинет</span>
                  {(chatActivity?.badge_count ?? 0) > 0 && (
                    <span className="menu-item-badge">{chatActivity.badge_count > 99 ? "99+" : chatActivity.badge_count}</span>
                  )}
                </button>
                {overflowIds.map((id) => (
                  <button
                    key={`menu-overflow-${id}`}
                    type="button"
                    className="menu-dropdown-item"
                    onClick={() => navigateBookmark(id)}
                  >
                    <span className="menu-item-icon" aria-hidden="true">
                      {bookmarkMenuIcon(id)}
                    </span>
                    <span className="menu-item-label">{bookmarkLabel(id, me?.role, me?.provider_sphere)}</span>
                    {id === "chats" && unreadMessagesCount > 0 && (
                      <span className="menu-item-badge">{unreadMessagesCount > 99 ? "99+" : unreadMessagesCount}</span>
                    )}
                    {id === "reviews" && missedReviewsCount > 0 && (
                      <span className="menu-item-badge">{missedReviewsCount > 99 ? "99+" : missedReviewsCount}</span>
                    )}
                  </button>
                ))}

                <button
                  type="button"
                  className="menu-dropdown-item"
                  data-platform-tour="menu-settings"
                  onClick={() => { setCurrentView("settings"); setMenuOpen(false); }}
                >
                  <span className="menu-item-icon" aria-hidden="true">
                    {bookmarkMenuIcon("settings")}
                  </span>
                  <span className="menu-item-label">Настройки</span>
                </button>
                {me?.provider_sphere !== "cafe_restaurant" && me?.provider_sphere !== "marketplaces" ? (
                  <button type="button" className="menu-dropdown-item" onClick={() => { setCurrentView("booking_history"); setMenuOpen(false); }}>
                    <span className="menu-item-icon" aria-hidden="true">
                      {bookmarkMenuIcon("booking_history")}
                    </span>
                    <span className="menu-item-label">История записей</span>
                  </button>
                ) : null}
                {me?.role !== "client" && (
                  <button type="button" className="menu-dropdown-item" onClick={() => { setCurrentView("subscriptions"); setMenuOpen(false); }}>
                    <span className="menu-item-icon" aria-hidden="true">
                      {bookmarkMenuIcon("subscriptions")}
                    </span>
                    <span className="menu-item-label">Подписки</span>
                  </button>
                )}
                {canAccessStaffPage && (
                  <button
                    type="button"
                    className="menu-dropdown-item"
                    data-platform-tour="menu-staff"
                    onClick={() => { setCurrentView("staff"); setMenuOpen(false); }}
                  >
                    <span className="menu-item-icon" aria-hidden="true">
                      {bookmarkMenuIcon("staff")}
                    </span>
                    <span className="menu-item-label">Сотрудники</span>
                  </button>
                )}
                {canManageOrgSettings && (
                  <button
                    type="button"
                    className="menu-dropdown-item"
                    data-platform-tour="menu-org"
                    onClick={() => { setCurrentView("organization"); setMenuOpen(false); }}
                  >
                    <span className="menu-item-icon" aria-hidden="true">
                      {bookmarkMenuIcon("organization")}
                    </span>
                    <span className="menu-item-label">Организация</span>
                  </button>
                )}
                {canManageOrgSettings && me?.provider_sphere === "cafe_restaurant" && !subnavBookmarks.includes("cafe") && (
                  <button type="button" className="menu-dropdown-item" onClick={() => { setCurrentView("cafe"); setMenuOpen(false); }}>
                    <span className="menu-item-icon" aria-hidden="true">{bookmarkMenuIcon("cafe")}</span>
                    <span className="menu-item-label">Зал и меню</span>
                  </button>
                )}
                {canManageOrgSettings && me?.provider_sphere === "cafe_restaurant" && !subnavBookmarks.includes("cafe_orders") && (
                  <button type="button" className="menu-dropdown-item" onClick={() => { setCurrentView("cafe_orders"); setMenuOpen(false); }}>
                    <span className="menu-item-icon" aria-hidden="true">{bookmarkMenuIcon("cafe_orders")}</span>
                    <span className="menu-item-label">Заказы</span>
                  </button>
                )}
                {canManageOrgSettings && me?.provider_sphere === "marketplaces" && !subnavBookmarks.includes("marketplaces") && (
                  <button type="button" className="menu-dropdown-item" onClick={() => { setCurrentView("marketplaces"); setMenuOpen(false); }}>
                    <span className="menu-item-icon" aria-hidden="true">{bookmarkMenuIcon("marketplaces")}</span>
                    <span className="menu-item-label">Маркетплейсы</span>
                  </button>
                )}
                {isBookmarkAvailable("inspections") && !subnavBookmarks.includes("inspections") && (
                  <button type="button" className="menu-dropdown-item" onClick={() => { setCurrentView("inspections"); setMenuOpen(false); }}>
                    <span className="menu-item-icon" aria-hidden="true">{bookmarkMenuIcon("inspections")}</span>
                    <span className="menu-item-label">Приёмка</span>
                  </button>
                )}
                {isBookmarkAvailable("service_apps") && (
                  <button type="button" className="menu-dropdown-item" onClick={() => navigateBookmark("service_apps")}>
                    <span className="menu-item-icon" aria-hidden="true">{bookmarkMenuIcon("service_apps")}</span>
                    <span className="menu-item-label">Сервисы</span>
                  </button>
                )}
                <button type="button" className="menu-dropdown-item" onClick={exitDemoSession}>
                  <span className="menu-item-icon" aria-hidden="true">
                    {bookmarkMenuIcon("logout")}
                  </span>
                  <span className="menu-item-label">{me?.is_demo ? "Выйти из демо" : "Выйти"}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {accessToken && me?.is_demo && (
        <div className="demo-mode-banner" role="status">
          <span>
            Демо-режим: общий кабинет «{me.organization_name || "Вместе"}». Можно нажимать и создавать.
            При выходе ваши новые данные удалятся, исходные останутся.
          </span>
          <button type="button" className="landing-btn landing-btn--outline" onClick={exitDemoSession}>
            Выйти из демо
          </button>
        </div>
      )}

      {intervalToast && (
        <div className="interval-toast" role="alert">
          {intervalToast}
        </div>
      )}

      {accessToken && me?.role && currentView !== "vmenu" && (
        <nav
          className={[
            "app-subnav",
            subnavBookmarks.filter((id) => isBookmarkAvailable(id)).length > 4 && "app-subnav--scroll",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label="Разделы"
          data-platform-tour="subnav"
        >
          {subnavBookmarks.map((id) => (
            <SubnavBookmarkButton
              key={id}
              id={id}
              currentView={currentView}
              marketplaceInitialTab={marketplaceInitialTab}
              me={me}
              navigateBookmark={navigateBookmark}
              isBookmarkAvailable={isBookmarkAvailable}
              unreadMessagesCount={unreadMessagesCount}
              missedReviewsCount={missedReviewsCount}
            />
          ))}
        </nav>
      )}

      {children}
    </>
  );
}
