import { useRef, useState } from "react";
import { API_URL } from "./config.js";
import { todayIsoDate, normalizeReviewsList } from "./bookingCalendarUtils.jsx";
import { matchProviderServiceByFilter } from "./clientOrgFeatures.js";

/**
 * Discover-map org sheet: popup state, profile/reviews/staff loaders, open/collapse.
 * Booking form fields touched by onClientLocationSelect stay in App (setters passed in).
 */
export function useMapOrgSheet({
  authFetch,
  accessToken,
  me,
  allLocations,
  clientDiscoverFiltersRef,
  clientBookingForm,
  setClientBookingForm,
  setProviderServices,
  setBookProviderStaff,
  setClientBookWindows,
  setBookLoyaltyInfo,
  setBookClientPackages,
  fitClientDiscoverMapViewport,
}) {
  const mapOrgCarouselTouchX = useRef(null);
  const mapOrgSheetTouchY = useRef(null);
  const [mapOrgPopup, setMapOrgPopup] = useState(null);
  const [mapOrgSheetCollapsed, setMapOrgSheetCollapsed] = useState(false);
  const [mapOrgSummary, setMapOrgSummary] = useState(null);
  const [mapOrgReviewsOpen, setMapOrgReviewsOpen] = useState(false);
  const [mapOrgReviews, setMapOrgReviews] = useState([]);
  const [mapOrgReviewsOrdering, setMapOrgReviewsOrdering] = useState("-created_at");
  const [mapOrgProfile, setMapOrgProfile] = useState(null);
  const [mapOrgStaff, setMapOrgStaff] = useState([]);
  const [mapOrgCarouselIndex, setMapOrgCarouselIndex] = useState(0);
  const [mapOrgPackages, setMapOrgPackages] = useState([]);
  const [staffReviewModal, setStaffReviewModal] = useState(null);

  async function onClientLocationSelect(locationId, presetDate = "") {
    const loc = allLocations.find((x) => String(x.id) === String(locationId));
    if (!loc) {
      setClientBookingForm((p) => ({
        ...p,
        locationId: "",
        provider: "",
        staffId: "any",
        serviceId: "",
        windowKey: "",
      }));
      setProviderServices([]);
      setBookProviderStaff([]);
      setClientBookWindows([]);
      return;
    }
    const pid = String(loc.provider);
    const bookDate =
      presetDate || clientDiscoverFiltersRef.current?.slot_date || clientBookingForm.bookDate || todayIsoDate();
    const filterService = String(clientDiscoverFiltersRef.current?.service || "").trim();
    setClientBookingForm((p) => ({
      ...p,
      locationId: String(loc.id),
      provider: pid,
      staffId: "any",
      serviceId: "",
      optionIds: [],
      windowKey: "",
      bookDate,
    }));
    const [servicesRes, staffRes] = await Promise.all([
      authFetch(`${API_URL}/catalog/services/?provider=${encodeURIComponent(pid)}`),
      authFetch(`${API_URL}/booking/staff/?provider=${encodeURIComponent(pid)}`),
    ]);
    if (servicesRes.ok) {
      const list = (await servicesRes.json()).filter((s) => s.is_active);
      setProviderServices(list);
      const matched = matchProviderServiceByFilter(list, filterService);
      if (matched) {
        setClientBookingForm((p) => ({
          ...p,
          locationId: String(loc.id),
          provider: pid,
          serviceId: String(matched.id),
          windowKey: "",
          bookDate,
        }));
      }
    } else {
      setProviderServices([]);
    }
    if (staffRes.ok) {
      const staffList = await staffRes.json();
      setBookProviderStaff(Array.isArray(staffList) ? staffList : []);
    } else {
      setBookProviderStaff([]);
    }
    setClientBookWindows([]);
    setBookLoyaltyInfo(null);
    setBookClientPackages([]);
    setClientBookingForm((p) => ({ ...p, loyaltyPoints: "", usePackage: true, clientPackageId: "" }));
    if (me?.role === "client" && accessToken) {
      authFetch(`${API_URL}/booking/loyalty/me/?provider=${encodeURIComponent(pid)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => setBookLoyaltyInfo(data))
        .catch(() => setBookLoyaltyInfo(null));
      authFetch(`${API_URL}/booking/client-packages/`)
        .then((r) => (r.ok ? r.json() : []))
        .then((list) => {
          const mine = (Array.isArray(list) ? list : []).filter(
            (p) =>
              Number(p.provider) === Number(pid) &&
              p.status === "active" &&
              Number(p.visits_remaining) > 0,
          );
          setBookClientPackages(mine);
          if (mine.length) {
            setClientBookingForm((p) => ({
              ...p,
              usePackage: true,
              clientPackageId: String(mine[0].id),
            }));
          }
        })
        .catch(() => setBookClientPackages([]));
    }
  }

  async function loadMapOrgSummary(providerId) {
    const res = await authFetch(`${API_URL}/reviews/summary/?provider=${encodeURIComponent(providerId)}`);
    if (res.ok) setMapOrgSummary(await res.json());
  }

  async function loadMapOrgProfile(providerId) {
    const res = await authFetch(
      `${API_URL}/users/organization-profile/?provider=${encodeURIComponent(providerId)}`,
    );
    if (!res.ok) {
      setMapOrgProfile(null);
      return null;
    }
    const data = await res.json();
    setMapOrgProfile(data);
    setMapOrgCarouselIndex(0);
    return data;
  }

  async function loadMapOrgStaff(providerId) {
    const res = await authFetch(`${API_URL}/booking/staff/?provider=${encodeURIComponent(providerId)}`);
    if (!res.ok) {
      setMapOrgStaff([]);
      return;
    }
    const data = await res.json();
    setMapOrgStaff(Array.isArray(data) ? data : data.results || []);
  }

  async function loadMapOrgReviews(providerId, ordering, staffLinkId = null) {
    const params = new URLSearchParams({
      provider: String(providerId),
      ordering: ordering || "-created_at",
    });
    if (staffLinkId != null && staffLinkId !== "") {
      params.set("staff", String(staffLinkId));
    }
    const res = await authFetch(`${API_URL}/reviews/?${params.toString()}`);
    if (res.ok) setMapOrgReviews(normalizeReviewsList(await res.json()));
  }

  function closeMapOrgSheet() {
    setMapOrgPopup(null);
    setMapOrgSheetCollapsed(false);
    setMapOrgProfile(null);
    setMapOrgStaff([]);
    setMapOrgReviewsOpen(false);
    setMapOrgReviews([]);
    setStaffReviewModal(null);
    window.setTimeout(fitClientDiscoverMapViewport, 0);
    window.setTimeout(fitClientDiscoverMapViewport, 120);
  }

  function collapseMapOrgSheet() {
    setMapOrgSheetCollapsed(true);
    window.setTimeout(fitClientDiscoverMapViewport, 0);
  }

  function expandMapOrgSheet() {
    setMapOrgSheetCollapsed(false);
    window.setTimeout(fitClientDiscoverMapViewport, 0);
  }

  async function openOrgOnMap(loc) {
    setMapOrgPopup(loc);
    setMapOrgSheetCollapsed(false);
    setMapOrgCarouselIndex(0);
    const profile = await loadMapOrgProfile(loc.provider);
    if (profile?.reviews_count > 0) {
      setMapOrgReviewsOpen(true);
      await loadMapOrgReviews(loc.provider, mapOrgReviewsOrdering);
    } else {
      setMapOrgReviewsOpen(false);
      setMapOrgReviews([]);
    }
    loadMapOrgSummary(loc.provider);
    // Публично показываем карточки сотрудников организации
    void loadMapOrgStaff(loc.provider);
    setMapOrgPackages([]);
    if (accessToken && me?.role === "client") {
      authFetch(`${API_URL}/booking/packages/?provider=${loc.provider}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((list) =>
          setMapOrgPackages(Array.isArray(list) ? list.filter((p) => p.is_active !== false) : []),
        )
        .catch(() => setMapOrgPackages([]));
    }
    window.setTimeout(fitClientDiscoverMapViewport, 0);
  }

  return {
    mapOrgCarouselTouchX,
    mapOrgSheetTouchY,
    mapOrgPopup,
    setMapOrgPopup,
    mapOrgSheetCollapsed,
    mapOrgSummary,
    mapOrgReviewsOpen,
    mapOrgReviews,
    setMapOrgReviews,
    mapOrgReviewsOrdering,
    setMapOrgReviewsOrdering,
    mapOrgProfile,
    mapOrgStaff,
    mapOrgCarouselIndex,
    setMapOrgCarouselIndex,
    mapOrgPackages,
    staffReviewModal,
    setStaffReviewModal,
    onClientLocationSelect,
    loadMapOrgSummary,
    loadMapOrgProfile,
    loadMapOrgStaff,
    loadMapOrgReviews,
    closeMapOrgSheet,
    collapseMapOrgSheet,
    expandMapOrgSheet,
    openOrgOnMap,
  };
}
