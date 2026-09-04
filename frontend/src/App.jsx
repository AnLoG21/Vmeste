import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import "./styles.css";
import "./mobile.css";
import LandingPage from "./LandingPage.jsx";
import SubscriptionsPage from "./SubscriptionsPage.jsx";
import AnalyticsPage from "./AnalyticsPage.jsx";
import CafeOrdersPage from "./CafeOrdersPage.jsx";
import CafeProviderWorkspace from "./CafeProviderWorkspace.jsx";
import ChatsWorkspace from "./ChatsWorkspace.jsx";
import ClientCafeOrdersPage from "./ClientCafeOrdersPage.jsx";
import ClientLoyaltyPage from "./ClientLoyaltyPage.jsx";
import ClientActivityFeed from "./ClientActivityFeed.jsx";
import WaitlistPanel from "./WaitlistPanel.jsx";
import MarketplaceWorkspace from "./MarketplaceWorkspace.jsx";
import VmenuApp, { ServicesHub } from "./vmenu/VmenuApp.jsx";
import { CabinetErrorBoundary } from "./CabinetErrorBoundary.jsx";
import CabinetChrome from "./CabinetChrome.jsx";
import InspectionWorkspace from "./InspectionWorkspace.jsx";
import ClientInspectionsPanel from "./ClientInspectionsPanel.jsx";
import ProviderReviewsPanel from "./ProviderReviewsPanel.jsx";
import ServiceCatalogTree from "./ServiceCatalogTree.jsx";
import ClientMapPanel from "./ClientMapPanel.jsx";
import StaffManagementPanel from "./StaffManagementPanel.jsx";
import GeneralSettingsPanel from "./GeneralSettingsPanel.jsx";
import OrganizationSettingsPanel from "./OrganizationSettingsPanel.jsx";
import BookingCalendar from "./BookingCalendar.jsx";
import BookingHistory from "./BookingHistory.jsx";
import BookingSlotActions from "./BookingSlotActions.jsx";
import ProfileCabinetPanel from "./ProfileCabinetPanel.jsx";
import AuthModal from "./AuthModal.jsx";
import ClientMapFiltersModal from "./ClientMapFiltersModal.jsx";
import BookingMessageErrorModal from "./BookingMessageErrorModal.jsx";
import OrgPhotoLightbox from "./OrgPhotoLightbox.jsx";
import ReviewModal from "./ReviewModal.jsx";
import ClientBookModal from "./ClientBookModal.jsx";
import CalendarDayDetailModal from "./CalendarDayDetailModal.jsx";
import SlotIntervalCalendar, { buildIntervalPopoverFixedStyle } from "./SlotIntervalCalendar.jsx";
import { LoadErrorBanner } from "./LoadErrorBanner.jsx";
import {
  formatLastSeenLabel,
  formatStaffFullName,
  conversationOrgDirectPeerTitle,
  chatMessagePlainText,
} from "./chatHelpers.jsx";
import {
  bookingSlotStatusModifier,
  bookingSlotCompactIcon,
  formatInAppNotificationText,
  formatBookingPrice,
  formatBookingDateTime,
  formatBookingDateTimeParts,
} from "./bookingDisplay.jsx";
import {
  todayIsoDate,
  currentLocalMonthKey,
  normalizeBookingsList,
  normalizeSlotsList,
  mergeBookingsWithManualHolds,
  StarRating,
  intervalAssigneeValue,
} from "./bookingCalendarUtils.jsx";
import SalonLoyaltyPackagesPanel from "./SalonLoyaltyPackagesPanel.jsx";
import PlatformTour from "./PlatformTour.jsx";import {
  buildPlatformTourSteps,
  readPlatformTourDone,
  writePlatformTourDone,
} from "./platformTour.js";
import {
  SUBNAV_BOOKMARKS_KEY,
  loadSubnavBookmarks,
} from "./subnavBookmarks.js";
import { getDevicePosition } from "./geoPosition.js";
import "./landing.css";
import {
  filterServiceGroupsFromCatalog,
  uniqueDiscoverOrgs,
} from "./clientOrgFeatures.js";
import { API_URL, AUTH_URL, BASE_URL, REFRESH_URL } from "./config.js";
import { createAuthFetch } from "./authFetch.js";
import {
  groupChatMedia,
  resolveAttachmentUrl,
} from "./chatMedia.js";
import { useOrgAddress } from "./useOrgAddress.js";
import { useOrgSettings } from "./useOrgSettings.js";
import { useChatRecording } from "./useChatRecording.js";
import { useChatMessaging } from "./useChatMessaging.js";
import { useChatExtras } from "./useChatExtras.js";
import { useClientMap } from "./useClientMap.js";
import { useMapOrgSheet } from "./useMapOrgSheet.js";
import { useCabinetData } from "./useCabinetData.js";
import { useBookingActions } from "./useBookingActions.js";
import { useIntervalHandlers } from "./useIntervalHandlers.js";
import { useAuthOnboarding } from "./useAuthOnboarding.js";
import { useStaffInvite } from "./useStaffInvite.js";
import { useServicesEditor } from "./useServicesEditor.js";
import { useCabinetNavigation } from "./useCabinetNavigation.js";
import { useReviews } from "./useReviews.js";
import { useProfileAccount } from "./useProfileAccount.js";
import {
  initPushNotifications,
  maybeRequestWebNotificationPermission,
  resetPushRegistration,
  showLocalBrowserNotification,
} from "./pushNotifications.js";
import { showToast } from "./toast.js";
import { navigateView, viewFromPath } from "./viewRoutes.js";
import { setNoIndexAppMeta, setPageMeta } from "./seo/setPageMeta.js";

const chatPrefsStorageKey = (id) => `vmeste_chat_prefs_v1_${id}`;
const APP_THEME_KEY = "vmeste_theme_v1";
const chatNotifyStorageKey = (id) => `vmeste_chat_notify_v1_${id}`;

const emptyRegisterForm = {
  username: "",
  first_name: "",
  last_name: "",
  patronymic: "",
  email: "",
  phone: "+7",
  role: "client",
  password: "",
  password_confirm: "",
  provider_sphere: "",
  organization_name: "",
  organization_address: "",
  organization_address_details: "",
  entrance: "",
  apartment: "",
  intercom: "",
  floor: "",
  organization_latitude: "55.751244",
  organization_longitude: "37.618423",
  accept_privacy: false,
  accept_offer: false,
  age_confirmed: false,
  confirm_provider_authority: false,
  provider_license_number: "",
};

function consumeOAuthCallback() {
  if (typeof window === "undefined") return { access: "", refresh: "", error: "" };
  const hash = (window.location.hash || "").replace(/^#/, "");
  const hashParams = new URLSearchParams(hash);
  const query = new URLSearchParams(window.location.search);
  const error = hashParams.get("oauth_error") || query.get("oauth_error") || "";
  const access = hashParams.get("oauth_access") || "";
  const refresh = hashParams.get("oauth_refresh") || "";
  const touched = Boolean(access || refresh || error || hash.includes("oauth_") || query.has("oauth_error"));
  if (touched) {
    if (query.has("oauth_error")) query.delete("oauth_error");
    const q = query.toString();
    const next = `${window.location.pathname}${q ? `?${q}` : ""}`;
    window.history.replaceState({}, document.title, next);
    if (access && refresh) {
      localStorage.setItem("vmeste_access", access);
      localStorage.setItem("vmeste_refresh", refresh);
    }
  }
  return { access, refresh, error };
}

const oauthBoot = consumeOAuthCallback();

export default function App() {
  const [authMode, setAuthMode] = useState("login");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [registerStep, setRegisterStep] = useState(1);
  const [menuOpen, setMenuOpen] = useState(false);
  const [platformTourPhase, setPlatformTourPhase] = useState("hidden");
  const [platformTourStep, setPlatformTourStep] = useState(0);
  const platformTourOfferedRef = useRef(false);
  const [currentView, setCurrentViewState] = useState(() => viewFromPath(window.location.pathname) || "bookings");
  const setCurrentView = useCallback((view) => {
    setCurrentViewState(view);
    navigateView(view);
  }, []);
  const [cafeWorkspaceTab, setCafeWorkspaceTab] = useState("floor");
  const [marketplaceInitialTab, setMarketplaceInitialTab] = useState(null);
  const [historyTab, setHistoryTab] = useState("bookings");
  const [authProviders, setAuthProviders] = useState({ telegram: "" });
  const telegramLoginHostRef = useRef(null);

  const [accessToken, setAccessToken] = useState(oauthBoot.access || localStorage.getItem("vmeste_access") || "");
  const accessTokenRef = useRef(accessToken);
  accessTokenRef.current = accessToken;
  const [refreshToken, setRefreshToken] = useState(oauthBoot.refresh || localStorage.getItem("vmeste_refresh") || "");
  const [loginForm, setLoginForm] = useState({ username: "", password: "", email: "" });
  const [credentialsForm, setCredentialsForm] = useState({ username: "", password: "", password_confirm: "" });
  const [credentialsBusy, setCredentialsBusy] = useState(false);
  const [passwordResetToken, setPasswordResetToken] = useState("");
  const [resetForm, setResetForm] = useState({ new_password: "", new_password_confirm: "" });
  const [passwordResetBusy, setPasswordResetBusy] = useState(false);
  const [me, setMe] = useState(null);

  const [roles, setRoles] = useState([]);
  const [spheres, setSpheres] = useState([]);
  const [form, setForm] = useState(emptyRegisterForm);

  const [status, setStatus] = useState("");
  const [authStatus, setAuthStatus] = useState("");
  const [sellerStatus, setSellerStatus] = useState("");
  const [clientStatus, setClientStatus] = useState("");
  const [pendingInspectionId, setPendingInspectionId] = useState(null);
  const [verifyStatus, setVerifyStatus] = useState("");
  const [resendStatus, setResendStatus] = useState("");
  const [verifyEmailNotice, setVerifyEmailNotice] = useState(null);
  const [allLocations, setAllLocations] = useState([]);
  const allLocationsRef = useRef([]);
  const [clientMapSearchInput, setClientMapSearchInput] = useState("");
  const [clientMapSearchFocused, setClientMapSearchFocused] = useState(false);
  const clientHeaderSearchWrapRef = useRef(null);
  const [clientDiscoverSearch, setClientDiscoverSearch] = useState("");
  const emptyClientFilters = () => ({
    sphere: "",
    service: "",
    min_price: "",
    max_price: "",
    slot_date: "",
    time_from: "",
    time_to: "",
  });
  const clientDiscoverFiltersRef = useRef(emptyClientFilters());
  const [clientDiscoverFilters, setClientDiscoverFilters] = useState(emptyClientFilters);
  const [clientFilterModalDraft, setClientFilterModalDraft] = useState(emptyClientFilters);
  const [clientFiltersOpen, setClientFiltersOpen] = useState(false);
  const [clientFilterServiceGroups, setClientFilterServiceGroups] = useState([]);
  const [clientBookModalOpen, setClientBookModalOpen] = useState(false);
  const [bookAvailableDates, setBookAvailableDates] = useState([]);
  const [orgPhotoLightbox, setOrgPhotoLightbox] = useState(null);
  const openOrgOnMapRef = useRef(async () => {});
  const fitClientDiscoverMapViewportRef = useRef(() => {});

  function openOrgPhotoLightbox(items, index = 0) {
    if (!items?.length) return;
    setOrgPhotoLightbox({
      items,
      index: Math.max(0, Math.min(index, items.length - 1)),
    });
  }

  function stepOrgPhotoLightbox(delta) {
    setOrgPhotoLightbox((prev) => {
      if (!prev?.items?.length) return prev;
      const n = prev.items.length;
      return { ...prev, index: (prev.index + delta + n) % n };
    });
  }

  const orgPhotoLightboxTouchX = useRef(0);

  useEffect(() => {
    if (!orgPhotoLightbox?.items?.length) return undefined;
    function onKeyDown(e) {
      if (e.key === "Escape") setOrgPhotoLightbox(null);
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        stepOrgPhotoLightbox(-1);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        stepOrgPhotoLightbox(1);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [orgPhotoLightbox?.items?.length, orgPhotoLightbox?.index]);

  const [clientNotifyForm, setClientNotifyForm] = useState({
    notify_booking_reminders: true,
    notify_booking_status: true,
  });
  const [clientNotifyStatus, setClientNotifyStatus] = useState("");
  const [telegramLinkInfo, setTelegramLinkInfo] = useState(null);
  const [orgSettingsHighlight, setOrgSettingsHighlight] = useState("");
  const [bookingMessageError, setBookingMessageError] = useState(null);
  const clientMeBootstrappedRef = useRef(false);
  const [providerServices, setProviderServices] = useState([]);
  const [bookProviderStaff, setBookProviderStaff] = useState([]);
  const [clientBookWindows, setClientBookWindows] = useState([]);
  const [clientBookingForm, setClientBookingForm] = useState({
    locationId: "",
    provider: "",
    staffId: "any",
    serviceId: "",
    optionIds: [],
    bookDate: "",
    windowKey: "",
    comment: "",
    loyaltyPoints: "",
    usePackage: true,
    clientPackageId: "",
  });
  const [bookLoyaltyInfo, setBookLoyaltyInfo] = useState(null);
  const [bookClientPackages, setBookClientPackages] = useState([]);

  const [categoryOpen, setCategoryOpen] = useState({});
  const [subcategoryOpen, setSubcategoryOpen] = useState({});
  const [intervalEditModal, setIntervalEditModal] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date().toISOString().slice(0, 7));
  const [bookingsMonth, setBookingsMonth] = useState(() => currentLocalMonthKey());

  const [dragIntervalId, setDragIntervalId] = useState(null);
  const [intervalPopoverId, setIntervalPopoverId] = useState(null);
  const intervalPopoverAnchorRef = useRef(null);
  const [intervalPopoverFixedStyle, setIntervalPopoverFixedStyle] = useState(null);
  const closeIntervalPopover = useCallback(() => {
    setIntervalPopoverId(null);
    setIntervalPopoverFixedStyle(null);
    intervalPopoverAnchorRef.current = null;
  }, []);

  useLayoutEffect(() => {
    if (intervalPopoverId == null) return undefined;
    const tick = () => {
      const el = intervalPopoverAnchorRef.current;
      if (el?.isConnected) setIntervalPopoverFixedStyle(buildIntervalPopoverFixedStyle(el));
    };
    tick();
    window.addEventListener("resize", tick);
    window.addEventListener("scroll", tick, true);
    return () => {
      window.removeEventListener("resize", tick);
      window.removeEventListener("scroll", tick, true);
    };
  }, [intervalPopoverId]);

  useEffect(() => {
    if (intervalPopoverId == null) return undefined;
    const onDown = (ev) => {
      const anchor = intervalPopoverAnchorRef.current;
      const pop = document.querySelector(".template-popover--portal");
      if (anchor?.contains(ev.target)) return;
      if (pop?.contains(ev.target)) return;
      closeIntervalPopover();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [intervalPopoverId, closeIntervalPopover]);

  const [conversations, setConversations] = useState([]);
  const [vmenuChatContacts, setVmenuChatContacts] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const authFetchRef = useRef(async () => ({ ok: false }));
  const {
    cabinetLoadError,
    categories,
    setCategories,
    services,
    setServices,
    slots,
    setSlots,
    bookings,
    setBookings,
    location,
    setLocation,
    orgStaff,
    setOrgStaff,
    loadSellerData,
    loadStaffWorkspace,
    reloadProviderSlots,
  } = useCabinetData({
    authFetch: (...args) => authFetchRef.current(...args),
    accessToken,
    me,
    currentView,
    setConversations,
  });
  const [vmenuTab, setVmenuTab] = useState("feed");
  const [vmenuChatsHostEl, setVmenuChatsHostEl] = useState(null);
  const [mainChatsHostEl, setMainChatsHostEl] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatHasMoreOlder, setChatHasMoreOlder] = useState(false);
  const [chatLoadingOlder, setChatLoadingOlder] = useState(false);
  const [chatShowJumpBottom, setChatShowJumpBottom] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatStatus, setChatStatus] = useState("");
  const [chatAttachMenuOpen, setChatAttachMenuOpen] = useState(false);
  const [chatMsgSearchOpen, setChatMsgSearchOpen] = useState(false);
  const [chatMsgSearchQuery, setChatMsgSearchQuery] = useState("");
  const [chatMsgSearchActiveIdx, setChatMsgSearchActiveIdx] = useState(0);
  const [subnavBookmarks, setSubnavBookmarks] = useState(() =>
    loadSubnavBookmarks(localStorage.getItem("vmeste_role_hint") || "client")
  );
  /** Skip one localStorage write after hydrating from me (avoids racing stale role_hint list over saved prefs). */
  const skipSubnavBookmarksSaveRef = useRef(true);
  const [chatPendingFiles, setChatPendingFiles] = useState([]);
  const [chatPendingKind, setChatPendingKind] = useState("");
  const [calendarDayDetail, setCalendarDayDetail] = useState(null);
  const menuWrapRef = useRef(null);
  const tgAttachMenuRef = useRef(null);
  const tgMsgSearchWrapRef = useRef(null);
  const chatMsgSearchInputRef = useRef(null);
  const chatFileInputRef = useRef(null);
  const chatMessagesRef = useRef([]);
  const chatMessagesElRef = useRef(null);
  const chatNearBottomRef = useRef(true);
  const chatLoadingOlderRef = useRef(false);
  const chatHasMoreOlderRef = useRef(false);
  const mapRef = useRef(null);
  const placemarkRef = useRef(null);
  const profileMapRef = useRef(null);
  const profilePlacemarkRef = useRef(null);
  const [orgMainEditOpen, setOrgMainEditOpen] = useState(false);
  const [selectedOrgBranchId, setSelectedOrgBranchId] = useState(null);
  const [orgBranchAddOpen, setOrgBranchAddOpen] = useState(false);
  const [orgBranchEditOpen, setOrgBranchEditOpen] = useState(false);
  const branchDetailMapRef = useRef(null);
  const branchDetailPlacemarkRef = useRef(null);
  const branchEditMapRef = useRef(null);
  const branchEditPlacemarkRef = useRef(null);
  const branchAddMapRef = useRef(null);
  const branchAddPlacemarkRef = useRef(null);

  const {
    addressSuggestions,
    setAddressSuggestions,
    detectedCity,
    setDetectedCity,
    orgAddressForm,
    setOrgAddressForm,
    locationForm,
    setLocationForm,
    branchGeoStatus,
    setBranchGeoStatus,
    syncOrgAddressFormFromMe,
    onProfileAddressInput,
    onBranchAddressInput,
    onAddressInput,
    pickProfileSuggestion,
    pickBranchLocationSuggestion,
    pickSuggestion,
    geocodeProfileAddress,
    geocodeBranchAddress,
    geocodeAddress,
    detectCityByGeolocation,
  } = useOrgAddress({
    me,
    orgMainEditOpen,
    orgBranchEditOpen,
    profileMapRef,
    profilePlacemarkRef,
    branchAddMapRef,
    branchAddPlacemarkRef,
    branchEditMapRef,
    branchEditPlacemarkRef,
    mapRef,
    placemarkRef,
    setForm,
  });

  const postChatMessageRef = useRef(async () => false);
  const {
    chatComposeMode,
    chatRecordingKind,
    chatRecordLocked,
    chatRecordLiftHint,
    chatRecordSecs,
    chatRecordLevels,
    chatMediaPreview,
    chatCameraFacing,
    chatCameraSwitching,
    chatLiveVideoRef,
    chatPreviewMediaRef,
    stopChatRecording,
    cancelChatRecording,
    discardChatMediaPreview,
    sendChatMediaPreview,
    switchChatCamera,
    onComposeActionPointerDown,
    onComposeActionPointerMove,
    onComposeActionPointerUp,
  } = useChatRecording({
    selectedChatId,
    chatInput,
    chatPendingFiles,
    postChatMessage: (...args) => postChatMessageRef.current(...args),
    setChatStatus,
  });
  const [chatInfoOpen, setChatInfoOpen] = useState(false);
  const [chatFabOpen, setChatFabOpen] = useState(false);
  const [appTheme, setAppTheme] = useState(() => localStorage.getItem(APP_THEME_KEY) || "light");
  const [chatFolder, setChatFolder] = useState("org");
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [incomingToasts, setIncomingToasts] = useState([]);
  const [chatActivity, setChatActivity] = useState(null);
  const lastNotificationToastIdRef = useRef(null);
  const currentViewRef = useRef(currentView);
  const meRef = useRef(me);
  const chatsSurfaceActive =
    currentView === "chats" || (currentView === "vmenu" && vmenuTab === "chats");
  const chatsSurfaceActiveRef = useRef(chatsSurfaceActive);
  const lastConvMsgDigestRef = useRef({});
  const digestPrimedRef = useRef(false);

  const fullName = useMemo(() => {
    if (!me) return "пользователь";
    return [me.last_name, me.first_name, me.patronymic].filter(Boolean).join(" ") || me.username;
  }, [me]);

  const staffEffectivePerms = useMemo(() => {
    const base = {
      manage_bookings: true,
      manage_intervals: false,
      manage_services: false,
      manage_chats: true,
      manage_client_chats: true,
      manage_staff: false,
      can_delegate_permissions: false,
      manage_inspections: false,
      marketplace_view_keys: false,
      marketplace_manage_orders: true,
      marketplace_manage_catalog: false,
      cafe_orders: true,
      cafe_kitchen: false,
      cafe_seating: true,
      cafe_delivery: false,
      cafe_menu: false,
      cafe_settings: false,
    };
    if (!me || me.role !== "staff") return base;
    const fromMe = me.staff_permissions && typeof me.staff_permissions === "object" ? me.staff_permissions : {};
    const link = orgStaff.find((l) => Number(l.staff) === Number(me.id));
    return { ...base, ...fromMe, ...(link?.permissions || {}) };
  }, [me, orgStaff]);

  const cafeAccessPerms = useMemo(() => {
    if (me?.role === "provider" && me?.provider_sphere === "cafe_restaurant") {
      return {
        cafe_orders: true,
        cafe_kitchen: true,
        cafe_seating: true,
        cafe_delivery: true,
        cafe_menu: true,
        cafe_settings: true,
      };
    }
    return {
      cafe_orders: Boolean(staffEffectivePerms.cafe_orders),
      cafe_kitchen: Boolean(staffEffectivePerms.cafe_kitchen),
      cafe_seating: Boolean(staffEffectivePerms.cafe_seating),
      cafe_delivery: Boolean(staffEffectivePerms.cafe_delivery),
      cafe_menu: Boolean(staffEffectivePerms.cafe_menu),
      cafe_settings: Boolean(staffEffectivePerms.cafe_settings),
    };
  }, [me, staffEffectivePerms]);

  const isCafeOrgUser = useMemo(() => {
    if (me?.role === "provider" && me?.provider_sphere === "cafe_restaurant") return true;
    if (me?.role === "staff" && (me?.employer_sphere === "cafe_restaurant" || me?.provider_sphere === "cafe_restaurant")) {
      return (
        cafeAccessPerms.cafe_orders ||
        cafeAccessPerms.cafe_kitchen ||
        cafeAccessPerms.cafe_seating ||
        cafeAccessPerms.cafe_delivery ||
        cafeAccessPerms.cafe_menu ||
        cafeAccessPerms.cafe_settings
      );
    }
    return false;
  }, [me, cafeAccessPerms]);

  useEffect(() => {
    if (!me || (me.role !== "client" && me.role !== "staff")) return;
    setClientNotifyForm({
      notify_booking_reminders: me.notify_booking_reminders !== false,
      notify_booking_status: me.notify_booking_status !== false,
    });
  }, [me?.id, me?.notify_booking_reminders, me?.notify_booking_status, me?.role]);

  function staffHasPerm(key) {
    if (me?.role === "provider") return true;
    if (me?.role !== "staff") return false;
    return Boolean(staffEffectivePerms[key]);
  }

  function canManageBookings() {
    if (me?.role === "provider") return true;
    if (me?.role === "staff") return staffHasPerm("manage_bookings");
    return false;
  }

  function canViewOrgReviews() {
    if (me?.provider_sphere === "marketplaces" || me?.employer_sphere === "marketplaces") return false;
    return me?.role === "provider" || (me?.role === "staff" && staffHasPerm("manage_bookings"));
  }

  const canManageOrgSettings =
    me?.role === "provider" || (me?.role === "staff" && Boolean(staffEffectivePerms.can_delegate_permissions));

  const canInviteStaff =
    me?.role === "provider" || (me?.role === "staff" && Boolean(staffEffectivePerms.manage_staff));

  const canAccessStaffPage = canManageOrgSettings || canInviteStaff;

  const orgActiveStaffIdsKey = useMemo(
    () =>
      orgStaff
        .filter((l) => l.is_active && Number(l.staff) !== Number(me?.id))
        .map((l) => Number(l.staff))
        .sort((a, b) => a - b)
        .join(","),
    [orgStaff, me?.id],
  );

  useEffect(() => {
    if (!accessToken || !chatsSurfaceActive || me?.role !== "provider" || !orgActiveStaffIdsKey) return;
    const ids = orgActiveStaffIdsKey.split(",").map(Number).filter(Boolean);
    if (!ids.length) return;
    let cancelled = false;
    (async () => {
      for (const sid of ids) {
        if (cancelled) break;
        await authFetch(`${API_URL}/chat/conversations/create-direct/`, {
          method: "POST",
          body: JSON.stringify({ staff_id: sid }),
        });
      }
      if (!cancelled) loadChats();
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, currentView, me?.role, orgActiveStaffIdsKey]);

  const roleOptions = roles.length
    ? roles
    : [
        { key: "client", value: "Клиент" },
        { key: "provider", value: "Исполнитель" },
        { key: "staff", value: "Сотрудник" },
      ];
  const sphereOptions = spheres.length
    ? spheres
    : [
        { key: "hair_salon", value: "Салон красоты" },
        { key: "service_center", value: "Автосервис" },
        { key: "cafe_restaurant", value: "Кафе и рестораны" },
        { key: "marketplaces", value: "Маркетплейсы" },
      ];
  const needsCredentialsSetup = Boolean(accessToken && me && me.needs_credentials_setup);
  const needsOnboarding = Boolean(
    accessToken &&
      me &&
      !needsCredentialsSetup &&
      me.profile_complete === false &&
      me.role === "provider",
  );
  const onboardingPrefillIdRef = useRef(null);
  const credentialsPrefillIdRef = useRef(null);

  useEffect(() => {
    if (!needsCredentialsSetup || !me?.id) return;
    if (credentialsPrefillIdRef.current === me.id) return;
    credentialsPrefillIdRef.current = me.id;
    const provisional = /^(vk|ya|tg|user)_\d+$/i.test(String(me.username || "").trim());
    setCredentialsForm({
      username: provisional ? "" : String(me.username || ""),
      password: "",
      password_confirm: "",
    });
    setShowAuthModal(true);
    setAuthStatus("");
  }, [needsCredentialsSetup, me]);

  useEffect(() => {
    if (!needsOnboarding || !me?.id) return;
    if (onboardingPrefillIdRef.current === me.id) return;
    onboardingPrefillIdRef.current = me.id;
    setForm((p) => ({
      ...p,
      role: me.role || p.role,
      first_name: me.first_name || "",
      last_name: me.last_name || "",
      patronymic: me.patronymic || "",
      email: me.email || "",
      phone: me.phone || p.phone || "+7",
      provider_sphere: me.provider_sphere || "",
      organization_name: me.organization_name || "",
      organization_address: me.organization_address || "",
      entrance: me.organization_entrance || "",
      floor: me.organization_floor || "",
      apartment: me.organization_apartment || "",
      intercom: me.organization_intercom || "",
      organization_address_details: me.organization_address_extra || "",
      organization_latitude: String(me.organization_latitude || p.organization_latitude || "55.751244"),
      organization_longitude: String(me.organization_longitude || p.organization_longitude || "37.618423"),
      provider_license_number: me.provider_license_number || "",
      confirm_provider_authority: Boolean(me.provider_authority_confirmed),
    }));
    setRegisterStep(me.role === "provider" ? 2 : 1);
    setAuthMode("register");
    setShowAuthModal(true);
    setAuthStatus("");
  }, [needsOnboarding, me]);

  useEffect(() => {
    if (!accessToken || !me?.id) return;
    if (platformTourOfferedRef.current) return;
    if (me.role !== "provider" && me.role !== "staff") return;
    if (needsOnboarding || needsCredentialsSetup || me.profile_complete === false) return;
    if (me.is_demo) return;
    if (readPlatformTourDone(me.id)) return;
    platformTourOfferedRef.current = true;
    setPlatformTourStep(0);
    setPlatformTourPhase("welcome");
  }, [accessToken, me, needsOnboarding, needsCredentialsSetup]);

  useEffect(() => {
    if (!accessToken && !showAuthModal) return;
    loadRoles();
    loadSpheres();
  }, [accessToken, showAuthModal]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const paymentId = params.get("payment_id");
    if (payment !== "success" || !paymentId || !accessToken) return;
    authFetch(`${API_URL}/subscriptions/confirm/`, {
      method: "POST",
      body: JSON.stringify({ payment_id: Number(paymentId) }),
    })
      .then((r) => r.json())
      .then((data) => {
        setVerifyStatus(data.detail || "Оплата обработана.");
        if (me?.role !== "client") setCurrentView("subscriptions");
      })
      .catch(() => {
        showToast("Не удалось подтвердить оплату подписки.", { tone: "error" });
      });
    window.history.replaceState({}, document.title, window.location.pathname);
  }, [accessToken]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("booking_payment") !== "success" || !accessToken) return;
    setVerifyStatus("Проверяем оплату записи…");
    setCurrentView("bookings");
    const bookingId = params.get("booking_id");
    const reload = () => {
      authFetch(`${API_URL}/booking/`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) setBookings(normalizeBookingsList(data));
        })
        .catch(() => {
          showToast("Не удалось обновить список записей.", { tone: "error" });
        });
    };
    const afterSync = () => {
      reload();
      setVerifyStatus("Если оплата прошла, статус записи обновится в течение минуты.");
    };
    if (bookingId) {
      authFetch(`${API_URL}/booking/${bookingId}/pay/`, { method: "POST", body: "{}" })
        .then(() => afterSync())
        .catch(() => afterSync());
    } else {
      afterSync();
    }
    const t = window.setTimeout(reload, 2500);
    window.history.replaceState({}, document.title, window.location.pathname);
    return () => window.clearTimeout(t);
  }, [accessToken]);

  async function resendVerificationForEmail(email) {
    const normalized = String(email || "").trim();
    if (!normalized) return;
    setResendStatus("Отправляем письмо...");
    const response = await fetch(`${API_URL}/users/resend-verification/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalized }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setResendStatus(data.detail || "Не удалось отправить письмо.");
      return;
    }
    setResendStatus(data.detail || "Письмо отправлено.");
  }

  useEffect(() => {
    if (accessToken) loadMe();
    else setMe(null);
  }, [accessToken]);

  useEffect(() => {
    if (
      me?.role === "provider" &&
      me?.provider_sphere === "cafe_restaurant" &&
      (currentView === "bookings" ||
        currentView === "my_bookings" ||
        currentView === "booking_history" ||
        currentView === "reviews" ||
        currentView === "intervals" ||
        currentView === "services")
    ) {
      setCurrentView("cafe_orders");
    }
    if (
      me?.role === "provider" &&
      me?.provider_sphere === "marketplaces" &&
      (currentView === "bookings" || currentView === "analytics" || currentView === "reviews")
    ) {
      setCurrentView("marketplaces");
    }
  }, [me?.role, me?.provider_sphere, currentView, setCurrentView]);

  useEffect(() => {
    if (!accessToken) {
      setPageMeta({
        title: "Вместе — онлайн-запись клиентов и автоматизация бизнеса",
        description:
          "Вместе — платформа для онлайн-записи клиентов, каталога услуг и чатов. Записи бесплатно, Бизнес — 990 ₽/мес.",
        path: "/",
      });
      return;
    }
    setNoIndexAppMeta();
  }, [accessToken, currentView]);

  useEffect(() => {
    if (!accessToken) {
      resetPushRegistration();
      return;
    }
    initPushNotifications(authFetch, accessToken);
    maybeRequestWebNotificationPermission();
  }, [accessToken]);

  useEffect(() => {
    const notifications = chatActivity?.notifications || [];
    if (!notifications.length) return;
    const newest = [...notifications].sort((a, b) => {
      const aTime = new Date(a.created_at || 0).getTime();
      const bTime = new Date(b.created_at || 0).getTime();
      return bTime - aTime || Number(b.id || 0) - Number(a.id || 0);
    })[0];
    if (!newest || newest.id === lastNotificationToastIdRef.current) return;
    lastNotificationToastIdRef.current = newest.id;
    showToast(newest.payload?.body || formatInAppNotificationText(newest));
  }, [chatActivity?.notifications]);

  useEffect(() => {
    function onPop() {
      const v = viewFromPath(window.location.pathname);
      if (v) setCurrentViewState(v);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const chatActivityBadgeRef = useRef(0);
  useEffect(() => {
    const next = Number(chatActivity?.badge_count) || 0;
    const prev = chatActivityBadgeRef.current;
    chatActivityBadgeRef.current = next;
    if (prev > 0 && next > prev) {
      const note = chatActivity?.notifications?.[0];
      const title = note?.payload?.title || "Вместе";
      const body = note?.payload?.body || "Есть новые уведомления";
      showLocalBrowserNotification(title, body);
    }
  }, [chatActivity?.badge_count]);

  useEffect(() => {
    if (!accessToken) return;
    loadChatActivity();
    const id = setInterval(loadChatActivity, 12000);
    return () => clearInterval(id);
  }, [accessToken, me?.id]);

  useEffect(() => {
    const onCafe = () => {
      if (me?.role === "provider" || me?.role === "staff") setCurrentView("cafe_orders");
    };
    const onInspections = () => {
      if (me?.role === "provider" || me?.role === "staff" || me?.role === "client") {
        setCurrentView("inspections");
      }
    };
    const onBookings = () => {
      if (me?.role === "client") setCurrentView("bookings");
      else setCurrentView("bookings");
    };
    const onMap = (ev) => {
      if (me?.role !== "client" && me?.role !== "provider") return;
      setCurrentView("client_map");
      const providerId = ev?.detail?.providerId;
      if (providerId) {
        const loc = allLocations.find((l) => Number(l.provider) === Number(providerId));
        if (loc) void openOrgOnMapRef.current(loc);
      }
    };
    window.addEventListener("vmeste:open-cafe-orders", onCafe);
    window.addEventListener("vmeste:open-inspections", onInspections);
    window.addEventListener("vmeste:open-bookings", onBookings);
    window.addEventListener("vmeste:open-map", onMap);
    return () => {
      window.removeEventListener("vmeste:open-cafe-orders", onCafe);
      window.removeEventListener("vmeste:open-inspections", onInspections);
      window.removeEventListener("vmeste:open-bookings", onBookings);
      window.removeEventListener("vmeste:open-map", onMap);
    };
  }, [me?.role, allLocations]);

  useEffect(() => {
    if (!accessToken || !me?.role) return;
    const refresh = () => {
      if (me.role === "client" || me.role === "provider") loadChats();
      else if (me.role === "staff" && staffHasPerm("manage_chats")) loadChats();
    };
    refresh();
    const id = setInterval(refresh, 12000);
    return () => clearInterval(id);
  }, [accessToken, me?.role, me?.id, staffEffectivePerms.manage_chats]);

  useEffect(() => {
    if (!accessToken) return;
    const ping = () => authFetch(`${API_URL}/users/presence/ping/`, { method: "POST", body: "{}" });
    ping();
    const id = setInterval(ping, 35000);
    return () => clearInterval(id);
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || !chatsSurfaceActive) return;
    if (currentView === "vmenu") {
      loadChats();
      loadVmenuChatContacts();
      return;
    }
    if (me?.role === "provider") {
      loadChats();
      authFetch(`${API_URL}/booking/staff/`).then((r) => {
        if (r.ok) return r.json();
        return null;
      }).then((d) => {
        if (Array.isArray(d)) setOrgStaff(d);
      });
    } else if (me?.role === "staff") {
      loadStaffWorkspace();
    } else if (me?.role === "client") {
      loadChats();
    }
  }, [accessToken, chatsSurfaceActive, me?.role, currentView]);

  const prevVmenuChatsModeRef = useRef(false);
  useEffect(() => {
    const vmenuChatsMode = currentView === "vmenu" && vmenuTab === "chats";
    const was = prevVmenuChatsModeRef.current;
    prevVmenuChatsModeRef.current = vmenuChatsMode;
    if (was && !vmenuChatsMode && accessToken) {
      loadChats();
      setVmenuChatContacts([]);
    }
  }, [accessToken, currentView, vmenuTab]);

  useEffect(() => {
    if (!chatsSurfaceActive || !conversations.length) return;
    lastConvMsgDigestRef.current = conversations.reduce((acc, c) => {
      acc[c.id] = c.last_message?.id ?? null;
      return acc;
    }, {});
    digestPrimedRef.current = true;
  }, [chatsSurfaceActive, conversations]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e) {
      if (menuWrapRef.current?.contains(e.target)) return;
      setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, [menuOpen]);

  useEffect(() => {
    if (me?.role === "client" && currentView === "subscriptions") {
      setCurrentView("client_map");
    }
  }, [me?.role, currentView]);

  useEffect(() => {
    if (!chatAttachMenuOpen) return;
    function onDoc(e) {
      if (tgAttachMenuRef.current?.contains(e.target)) return;
      setChatAttachMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, [chatAttachMenuOpen]);

  useEffect(() => {
    if (!chatMsgSearchOpen) return;
    function onDoc(e) {
      if (tgMsgSearchWrapRef.current?.contains(e.target)) return;
      setChatMsgSearchOpen(false);
      setChatMsgSearchQuery("");
      setChatMsgSearchActiveIdx(0);
    }
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, [chatMsgSearchOpen]);

  useEffect(() => {
    const t = setTimeout(() => setClientDiscoverSearch(clientMapSearchInput), 420);
    return () => clearTimeout(t);
  }, [clientMapSearchInput]);

  const clientDiscoverSearchOrgs = useMemo(() => {
    if (!clientMapSearchInput.trim()) return [];
    return uniqueDiscoverOrgs(allLocations);
  }, [allLocations, clientMapSearchInput]);

  const showClientDiscoverSearchDropdown =
    clientMapSearchFocused && clientMapSearchInput.trim().length > 0;

  useEffect(() => {
    if (!clientMapSearchFocused) return undefined;
    const onDocDown = (e) => {
      if (clientHeaderSearchWrapRef.current?.contains(e.target)) return;
      setClientMapSearchFocused(false);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [clientMapSearchFocused]);

  useEffect(() => {
    if (!accessToken || !me || me.role !== "client") return;
    if (!clientMeBootstrappedRef.current) {
      clientMeBootstrappedRef.current = true;
      const fromPath = viewFromPath(window.location.pathname);
      if (fromPath && fromPath !== "bookings") return;
      setCurrentView("client_map");
    }
  }, [accessToken, me?.id, me?.role]);

  useEffect(() => {
    if (!accessToken || (me?.role !== "client" && me?.role !== "provider")) return;
    const p = new URLSearchParams();
    if (me?.role === "provider") p.set("discover", "1");
    const q = clientDiscoverSearch.trim();
    if (q) p.set("search", q);
    const f = clientDiscoverFilters;
    if (f.sphere) p.set("sphere", f.sphere);
    if (String(f.service || "").trim()) p.set("service", String(f.service).trim());
    if (String(f.min_price).trim() !== "") p.set("min_price", String(f.min_price).trim());
    if (String(f.max_price).trim() !== "") p.set("max_price", String(f.max_price).trim());
    if (f.slot_date) {
      p.set("slot_date_from", f.slot_date);
      p.set("slot_date_to", f.slot_date);
    }
    if (f.time_from) p.set("time_from", f.time_from);
    if (f.time_to) p.set("time_to", f.time_to);
    let cancelled = false;
    (async () => {
      // «Рядом»: сортировка по дистанции при известной геолокации (особенно с фильтром сферы/услуги).
      try {
        const pos = await getDevicePosition();
        if (pos && Number.isFinite(pos.lat) && Number.isFinite(pos.lon)) {
          p.set("near_lat", String(pos.lat));
          p.set("near_lon", String(pos.lon));
        }
      } catch {
        /* ignore geo */
      }
      if (cancelled) return;
      const qs = p.toString();
      const url = qs ? `${API_URL}/locations/?${qs}` : `${API_URL}/locations/`;
      const locationsRes = await authFetch(url);
      if (cancelled || !locationsRes.ok) return;
      setAllLocations(await locationsRes.json());
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, me?.role, clientDiscoverSearch, clientDiscoverFilters]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const sphere = clientDiscoverFilters?.sphere;
    const label = sphereOptions.find((s) => s.key === sphere)?.value;
    const service = String(clientDiscoverFilters?.service || "").trim();
    let title = "Вместе";
    if (label && service) title = `${service} · ${label} рядом — Вместе`;
    else if (label) title = `${label} рядом — Вместе`;
    else if (service) title = `${service} рядом — Вместе`;
    document.title = title;
    return () => {
      document.title = "Вместе";
    };
  }, [clientDiscoverFilters?.sphere, clientDiscoverFilters?.service, sphereOptions]);

  useEffect(() => {
    if (!accessToken || me?.role !== "client") return;
    let cancelled = false;
    (async () => {
      const bookingsRes = await authFetch(`${API_URL}/booking/`);
      if (cancelled || !bookingsRes.ok) return;
      setBookings(normalizeBookingsList(await bookingsRes.json()));
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, me?.id, me?.role]);

  useEffect(() => {
    if (!accessToken || me?.role !== "provider") return;
    if (currentView !== "intervals" && currentView !== "bookings") return;
    reloadProviderSlots();
    const id = setInterval(reloadProviderSlots, 15000);
    return () => clearInterval(id);
  }, [accessToken, me?.role, currentView]);

  useEffect(() => {
    if (!accessToken || (currentView !== "bookings" && currentView !== "my_bookings")) return;
    if (me?.role === "client") reloadBookingsList();
    else if (me?.role === "provider" && currentView === "my_bookings") reloadBookingsList();
    else if (me?.role === "provider") loadSellerData();
    else if (me?.role === "staff" && staffHasPerm("manage_bookings")) reloadBookingsList();
  }, [accessToken, currentView, me?.role, me?.id]);

  useEffect(() => {
    if (!accessToken || currentView !== "booking_history") return;
    reloadBookingsList();
  }, [accessToken, currentView, me?.role, me?.id]);

  useEffect(() => {
    allLocationsRef.current = allLocations;
  }, [allLocations]);

  useEffect(() => {
    clientDiscoverFiltersRef.current = clientDiscoverFilters;
  }, [clientDiscoverFilters]);

  useEffect(() => {
    if (currentView === "client_book" && me?.role === "client" && clientDiscoverFilters.slot_date && !clientBookingForm.bookDate) {
      setClientBookingForm((p) => ({ ...p, bookDate: clientDiscoverFilters.slot_date }));
    }
  }, [currentView, me?.role, clientDiscoverFilters.slot_date]);

  useEffect(() => {
    if (me?.role !== "client" && me?.role !== "provider") return;
    const { provider, serviceId, bookDate, optionIds, staffId } = clientBookingForm;
    if (!provider || !serviceId || !bookDate) {
      setClientBookWindows([]);
      return;
    }
    const selected = providerServices.find((s) => String(s.id) === String(serviceId));
    const extra = (selected?.options || [])
      .filter((o) => (optionIds || []).map(Number).includes(Number(o.id)))
      .reduce((sum, o) => sum + (Number(o.extra_minutes) || 0), 0);
    const staffQ =
      staffId && staffId !== "any" ? `&staff=${encodeURIComponent(staffId)}` : "";
    let cancelled = false;
    (async () => {
      const res = await authFetch(
        `${API_URL}/booking/slots/available-windows/?provider=${encodeURIComponent(provider)}&service=${encodeURIComponent(serviceId)}&date=${encodeURIComponent(bookDate)}&extra_minutes=${extra}${staffQ}`,
      );
      if (cancelled) return;
      if (res.ok) {
        const data = await res.json();
        const now = Date.now();
        setClientBookWindows(
          (Array.isArray(data) ? data : []).filter((w) => {
            const t = new Date(w.starts_at).getTime();
            return Number.isFinite(t) && t > now;
          })
        );
      } else setClientBookWindows([]);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientBookingForm.provider, clientBookingForm.serviceId, clientBookingForm.bookDate, clientBookingForm.optionIds, clientBookingForm.staffId, providerServices, me?.role]);

  useEffect(() => {
    if ((me?.role !== "client" && me?.role !== "provider") || !clientBookModalOpen) return undefined;
    const { provider, serviceId, optionIds, staffId } = clientBookingForm;
    if (!provider || !serviceId) {
      setBookAvailableDates([]);
      return undefined;
    }
    const selected = providerServices.find((s) => String(s.id) === String(serviceId));
    const extra = (selected?.options || [])
      .filter((o) => (optionIds || []).map(Number).includes(Number(o.id)))
      .reduce((sum, o) => sum + (Number(o.extra_minutes) || 0), 0);
    const staffQ =
      staffId && staffId !== "any" ? `&staff=${encodeURIComponent(staffId)}` : "";
    let cancelled = false;
    const from = todayIsoDate();
    const toDate = new Date();
    toDate.setDate(toDate.getDate() + 60);
    const to = `${toDate.getFullYear()}-${String(toDate.getMonth() + 1).padStart(2, "0")}-${String(toDate.getDate()).padStart(2, "0")}`;
    (async () => {
      const res = await authFetch(
        `${API_URL}/booking/slots/available-dates/?provider=${encodeURIComponent(provider)}&service=${encodeURIComponent(serviceId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&extra_minutes=${extra}${staffQ}`,
      );
      if (cancelled || !res.ok) return;
      const data = await res.json();
      const dates = Array.isArray(data?.dates) ? data.dates.map(String) : [];
      setBookAvailableDates(dates);
      setClientBookingForm((p) => {
        if (p.bookDate && dates.includes(p.bookDate)) return p;
        const nextDate = dates[0] || "";
        if (p.bookDate === nextDate) return p;
        return { ...p, bookDate: nextDate, windowKey: "" };
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [clientBookModalOpen, clientBookingForm.provider, clientBookingForm.serviceId, clientBookingForm.optionIds, clientBookingForm.staffId, providerServices, me?.role]);

  useEffect(() => {
    if (!clientFiltersOpen) return undefined;
    const sphere = clientFilterModalDraft.sphere;
    if (!sphere) {
      setClientFilterServiceGroups([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const res = await authFetch(`${API_URL}/catalog/sphere-template/?sphere=${encodeURIComponent(sphere)}`);
      if (cancelled || !res.ok) {
        if (!cancelled) setClientFilterServiceGroups([]);
        return;
      }
      const catalog = await res.json();
      setClientFilterServiceGroups(filterServiceGroupsFromCatalog(catalog));
    })();
    return () => {
      cancelled = true;
    };
  }, [clientFiltersOpen, clientFilterModalDraft.sphere]);

  useEffect(() => {
    currentViewRef.current = currentView;
  }, [currentView]);

  useEffect(() => {
    chatsSurfaceActiveRef.current = chatsSurfaceActive;
  }, [chatsSurfaceActive]);

  useEffect(() => {
    if (currentView !== "vmenu") setVmenuChatsHostEl(null);
  }, [currentView]);

  useEffect(() => {
    meRef.current = me;
  }, [me]);

  useLayoutEffect(() => {
    try {
      localStorage.setItem(APP_THEME_KEY, appTheme);
    } catch {
      // ignore
    }
    document.documentElement.setAttribute("data-theme", appTheme);
    document.body.classList.toggle("theme-dark", appTheme === "dark");
  }, [appTheme]);

  useEffect(() => {
    if (!me?.role) return;
    const sphere = me.provider_sphere || me.employer_sphere || "";
    skipSubnavBookmarksSaveRef.current = true;
    setSubnavBookmarks(loadSubnavBookmarks(me.role, sphere));
  }, [me?.role, me?.provider_sphere, me?.employer_sphere]);

  useEffect(() => {
    if (!me?.role) return;
    if (skipSubnavBookmarksSaveRef.current) {
      skipSubnavBookmarksSaveRef.current = false;
      return;
    }
    try {
      const raw = localStorage.getItem(SUBNAV_BOOKMARKS_KEY);
      const all = raw ? JSON.parse(raw) : {};
      const sphere = me.provider_sphere || me.employer_sphere || "";
      all[me.role] = subnavBookmarks;
      // Sphere-scoped copy so salon/cafe prefs don't overwrite each other on role-only key.
      if (sphere) all[`${me.role}:${sphere}`] = subnavBookmarks;
      localStorage.setItem(SUBNAV_BOOKMARKS_KEY, JSON.stringify(all));
    } catch {
      /* ignore */
    }
  }, [subnavBookmarks, me?.role, me?.provider_sphere, me?.employer_sphere]);

  useEffect(() => {
    if (!accessToken || chatsSurfaceActive) return;
    const canPoll =
      me?.role === "provider" ||
      (me?.role === "staff" && (staffEffectivePerms.manage_chats || staffEffectivePerms.manage_client_chats));
    if (!canPoll) return;
    let cancelled = false;
    async function poll() {
      const res = await authFetch(`${API_URL}/chat/conversations/`);
      if (cancelled || !res.ok) return;
      const list = await res.json();
      const myId = Number(meRef.current?.id);
      if (!chatsSurfaceActiveRef.current && digestPrimedRef.current) {
        const prev = lastConvMsgDigestRef.current;
        for (const c of list) {
          const mid = c.last_message?.id;
          const senderId = c.last_message?.sender_id != null ? Number(c.last_message.sender_id) : null;
          if (!mid || prev[c.id] === mid) continue;
          if (senderId === myId) continue;
          let muted = false;
          try {
            const raw = localStorage.getItem(chatNotifyStorageKey(c.id));
            const st = raw ? JSON.parse(raw) : {};
            if (st.muted) muted = true;
            if (st.mutedUntil && Date.now() < Number(st.mutedUntil)) muted = true;
          } catch {
            // ignore
          }
          if (muted) continue;
          const title = (() => {
            try {
              const pr = localStorage.getItem(chatPrefsStorageKey(c.id));
              if (pr) {
                const p = JSON.parse(pr);
                if (p.title?.trim()) return p.title.trim();
              }
            } catch {
              // ignore
            }
            if (c.is_saved_messages) return "Избранное";
            const peer = conversationOrgDirectPeerTitle(c, myId);
            if (peer) return peer;
            return c.title || `Чат #${c.id}`;
          })();
          const text = (c.last_message?.text || "").slice(0, 140);
          const toastId = `${c.id}-${mid}-${Date.now()}`;
          setIncomingToasts((t) => [...t, { id: toastId, convId: c.id, title, text, fade: false }]);
          setTimeout(() => {
            setIncomingToasts((t) => t.map((x) => (x.id === toastId ? { ...x, fade: true } : x)));
          }, 12000);
          setTimeout(() => {
            setIncomingToasts((t) => t.filter((x) => x.id !== toastId));
          }, 12600);
        }
      }
      digestPrimedRef.current = true;
      lastConvMsgDigestRef.current = list.reduce((acc, c) => {
        acc[c.id] = c.last_message?.id ?? null;
        return acc;
      }, {});
      setConversations(list);
    }
    poll();
    const id = setInterval(poll, 6000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [accessToken, currentView, me?.role, me?.id, staffEffectivePerms.manage_chats]);

  useEffect(() => {
    const isProviderFlow =
      needsOnboarding ? me?.role === "provider" : form.role === "provider";
    if (
      (showAuthModal || needsOnboarding) &&
      (authMode === "register" || needsOnboarding) &&
      isProviderFlow &&
      (registerStep === 2 || needsOnboarding)
    ) {
      detectCityByGeolocation();
    }
  }, [showAuthModal, authMode, form.role, registerStep, needsOnboarding, me?.role]);

  async function loadRoles() {
    const response = await fetch(`${API_URL}/users/roles/`);
    if (response.ok) setRoles(await response.json());
  }

  async function loadSpheres() {
    const response = await fetch(`${API_URL}/users/spheres/`);
    if (response.ok) setSpheres(await response.json());
  }

  const refreshAccessToken = useCallback(async () => {
    if (!refreshToken) return null;
    const response = await fetch(REFRESH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    });
    if (!response.ok) {
      logout();
      return null;
    }
    const data = await response.json();
    if (data.access) {
      setAccessToken(data.access);
      localStorage.setItem("vmeste_access", data.access);
    }
    if (data.refresh) {
      setRefreshToken(data.refresh);
      localStorage.setItem("vmeste_refresh", data.refresh);
    }
    return data.access;
  }, [refreshToken]);

  const authFetch = useMemo(
    () => createAuthFetch(() => accessTokenRef.current, refreshAccessToken),
    [refreshAccessToken],
  );
  authFetchRef.current = authFetch;

  // Chat messaging / send / mark-read — state (conversations, messages, …) stays above.
  const {
    loadChats,
    loadVmenuChatContacts,
    openVmenuUserChat,
    scrollChatToMessageId,
    jumpToChatMessage,
    openChatPhotosLightbox,
    openDirectChatWithStaff,
    openChatWithClient,
    openChatWithProvider,
    scrollChatToBottom,
    updateChatScrollUi,
    loadOlderChatMessages,
    refreshChatMessages,
    postChatMessage,
    sendChatMessage,
    openChatAttachPicker,
    onChatFilePicked,
  } = useChatMessaging({
    authFetch,
    accessToken,
    chatsSurfaceActive,
    currentViewRef,
    selectedChatId,
    setSelectedChatId,
    setConversations,
    setVmenuChatContacts,
    chatMessages,
    setChatMessages,
    chatHasMoreOlder,
    setChatHasMoreOlder,
    setChatLoadingOlder,
    setChatShowJumpBottom,
    chatInput,
    setChatInput,
    setChatStatus,
    chatPendingFiles,
    setChatPendingFiles,
    chatPendingKind,
    setChatPendingKind,
    setChatAttachMenuOpen,
    setChatInfoOpen,
    setChatFabOpen,
    setChatFolder,
    setCurrentView,
    setMenuOpen,
    setOrgPhotoLightbox,
    chatMessagesRef,
    chatMessagesElRef,
    chatNearBottomRef,
    chatLoadingOlderRef,
    chatHasMoreOlderRef,
    chatFileInputRef,
    postChatMessageRef,
  });

  const {
    chatSettingsForId,
    setChatSettingsForId,
    chatRowMenuId,
    setChatRowMenuId,
    chatReceiptsSettingsOpen,
    setChatReceiptsSettingsOpen,
    chatPins,
    chatDragPinConvId,
    setChatDragPinConvId,
    chatInfoTab,
    setChatInfoTab,
    chatMembersView,
    setChatMembersView,
    groupAddStaffIds,
    setGroupAddStaffIds,
    groupAddStatus,
    setGroupAddStatus,
    chatInfoHeadMenuOpen,
    setChatInfoHeadMenuOpen,
    chatInfoPhotoMenuId,
    setChatInfoPhotoMenuId,
    chatSettingsTitle,
    setChatSettingsTitle,
    groupForm,
    setGroupForm,
    chatLocalPrefs,
    chatSettingsAvatar,
    setChatSettingsAvatar,
    chatSettingsWallpaper,
    setChatSettingsWallpaper,
    customColorPickerOpen,
    setCustomColorPickerOpen,
    chatSettingsNotify,
    setChatSettingsNotify,
    chatReceiptsMode,
    persistChatReceiptsMode,
    togglePinChatForFolder,
    reorderPinnedChats,
    createOrgGroup,
    displayConversationTitle,
    conversationAvatarLetter,
    persistChatVisualSettings,
    clearChatVisualSettings,
    toggleGroupStaff,
    toggleGroupAddStaff,
    addMembersToSelectedGroup,
    deleteGroupChat,
    chatInfoPeer,
    activeChatWallpaper,
  } = useChatExtras({
    authFetch,
    me,
    conversations,
    setConversations,
    selectedChatId,
    setSelectedChatId,
    setChatStatus,
    loadChats,
    chatInfoOpen,
    setChatInfoOpen,
    chatFabOpen,
    setChatFabOpen,
  });

  useEffect(() => {
    if (!customColorPickerOpen) return;
    function onDocMouseDown(e) {
      if (e.target.closest(".tg-color-popover") || e.target.closest(".tg-color-picker-toggle")) return;
      setCustomColorPickerOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown, true);
    return () => document.removeEventListener("mousedown", onDocMouseDown, true);
  }, [customColorPickerOpen]);

  const {
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
    loadMapOrgReviews,
    closeMapOrgSheet,
    collapseMapOrgSheet,
    expandMapOrgSheet,
    openOrgOnMap,
  } = useMapOrgSheet({
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
    fitClientDiscoverMapViewport: (...args) => fitClientDiscoverMapViewportRef.current?.(...args),
  });
  openOrgOnMapRef.current = openOrgOnMap;

  const {
    fitClientDiscoverMapViewport,
    waitForClientDiscoverMap,
  } = useClientMap({
    currentView,
    meRole: me?.role,
    allLocations,
    allLocationsRef,
    mapOrgPopup,
    mapOrgReviewsOpen,
    clientBookModalOpen,
    clientFiltersOpen,
    setDetectedCity,
    openOrgOnMap: (loc) => openOrgOnMapRef.current(loc),
  });
  fitClientDiscoverMapViewportRef.current = fitClientDiscoverMapViewport;

  function staffJobTitleForUser(userId) {
    const link = orgStaff.find((l) => Number(l.staff) === Number(userId));
    return (link?.job_title || "").trim();
  }

  function memberDisplayName(member) {
    return (
      formatStaffFullName({
        first_name: member?.first_name,
        last_name: member?.last_name,
        patronymic: member?.patronymic,
        username: member?.username,
      }) || `id ${member?.user}`
    );
  }

  function memberInitial(member) {
    const name = memberDisplayName(member);
    return (name || "?").slice(0, 1).toUpperCase();
  }

  // Booking actions; bookings/bookingsMonth state stay in App (shared with seller/staff loaders).
  const {
    bookingClientLabel,
    bookingSlotSecondaryLabel,
    bookingHasStarted,
    reloadBookingsList,
    loadClientBookings,
    createClientBooking,
    resumeBookingPayment,
    orgBookingAction,
    startInspectionFromBooking,
    openInspectionFromBooking,
    clientCancelBooking,
    goOrgSettingsForBookingMessage,
  } = useBookingActions({
    authFetch,
    me,
    currentView,
    canManageBookings,
    orgStaff,
    staffJobTitleForUser,
    setBookings,
    setSlots,
    setBookingsMonth,
    setClientStatus,
    setBookingMessageError,
    setOrgSettingsHighlight,
    setCurrentView,
    setMenuOpen,
    setPendingInspectionId,
    clientBookingForm,
    setClientBookingForm,
    clientBookWindows,
    setClientBookWindows,
    bookClientPackages,
    setBookClientPackages,
    setBookLoyaltyInfo,
    clientDiscoverFilters,
    setClientBookModalOpen,
    setMapOrgPopup,
  });

  // Interval templates / holds; slots + calendarMonth + popover UI stay in App.
  const {
    slotForm,
    setSlotForm,
    intervalForm,
    setIntervalForm,
    manualHoldForm,
    setManualHoldForm,
    manualHoldStatus,
    setManualHoldStatus,
    manualHoldBusy,
    intervalToast,
    savedIntervals,
    setSavedIntervals,
    selectedIntervalId,
    setSelectedIntervalId,
    createManualHold,
    releaseManualHold,
    addAnonymousSeat,
    createSlot,
    createSlotsByInterval,
    applyIntervalToDay,
    applyIntervalByPattern,
    deleteSlot,
    deleteSeries,
  } = useIntervalHandlers({
    authFetch,
    me,
    setMe,
    slots,
    calendarMonth,
    setSellerStatus,
    loadSellerData,
    setCalendarDayDetail,
    intervalPopoverId,
    closeIntervalPopover,
  });

  const {
    staffInviteForm,
    setStaffInviteForm,
    staffInviteStatus,
    staffPermsOpenId,
    setStaffPermsOpenId,
    staffServicesOpenId,
    setStaffServicesOpenId,
    inviteStaff,
    deactivateStaff,
    patchStaffMeta,
    uploadStaffCard,
    deleteStaffPortfolioPhoto,
    patchStaffServiceAssignment,
    toggleStaffPermission,
  } = useStaffInvite({
    authFetch,
    me,
    setOrgStaff,
    loadSellerData,
    loadStaffWorkspace,
    setChatActivity,
  });

  const openProviderReviewsRef = useRef(() => {});
  const {
    reviewModalBooking,
    setReviewModalBooking,
    reviewModalReview,
    setReviewModalReview,
    reviewForm,
    setReviewForm,
    reviewSubmitError,
    providerReviews,
    providerReviewsOrdering,
    setProviderReviewsOrdering,
    missedReviewsCount,
    reviewReplyOpenId,
    setReviewReplyOpenId,
    reviewReplyForms,
    setReviewReplyForms,
    reviewReplyFormError,
    setReviewReplyFormError,
    loadProviderReviewsList,
    loadMyReviews,
    loadMissedReviewsCount,
    markReviewsSeen,
    openProviderReviews,
    bookingHasReview,
    getBookingReview,
    openOrgCardFromHistory,
    toggleReviewLike,
    submitReviewReply,
    openReviewPhotoLightbox,
    submitClientReview,
    openClientReviewModal,
  } = useReviews({
    authFetch,
    me,
    bookings,
    setBookings,
    allLocations,
    setAllLocations,
    setCurrentView,
    setClientStatus,
    setClientBookingForm,
    setClientBookModalOpen,
    mapOrgPopup,
    mapOrgReviewsOpen,
    mapOrgReviewsOrdering,
    setMapOrgReviews,
    loadMapOrgSummary,
    loadMapOrgReviews,
    waitForClientDiscoverMap,
    openOrgOnMap,
    onClientLocationSelect,
    openOrgPhotoLightbox,
  });
  openProviderReviewsRef.current = openProviderReviews;

  useEffect(() => {
    if (!accessToken || !canViewOrgReviews()) return;
    loadMissedReviewsCount();
    const id = setInterval(loadMissedReviewsCount, 12000);
    return () => clearInterval(id);
  }, [accessToken, me?.role, me?.id]);

  useEffect(() => {
    if (!accessToken || me?.role !== "client") return;
    loadMyReviews();
  }, [accessToken, me?.role, me?.id]);

  useEffect(() => {
    if (!accessToken || currentView !== "reviews" || !canViewOrgReviews()) return;
    loadProviderReviewsList(providerReviewsOrdering);
    markReviewsSeen();
  }, [accessToken, currentView, me?.role, providerReviewsOrdering, staffEffectivePerms]);

  useEffect(() => {
    if (!accessToken || currentView !== "booking_history") return;
    if (me?.role === "client") loadMyReviews();
  }, [accessToken, currentView, me?.role, me?.id]);


  const {
    catalogStatus,
    catalogSeeding,
    serviceDrafts,
    serviceSavingAll,
    dirtyServiceCount,
    staffAssignableServices,
    staffAssignableCategories,
    seedProviderCatalog,
    updateServiceDraft,
    uploadServicePhotos,
    deleteServicePhoto,
    saveAllServiceChanges,
  } = useServicesEditor({
    authFetch,
    accessToken,
    me,
    currentView,
    services,
    setServices,
    categories,
    setSellerStatus,
    loadSellerData,
    setCategoryOpen,
    setSubcategoryOpen,
  });

  async function loadMe() {
    const response = await authFetch(`${API_URL}/users/me/`);
    if (response.ok) setMe(await response.json());
  }

  // Org settings / branches maps+saves; address suggest state stays in useOrgAddress; map refs stay above.
  const {
    orgProfileForm,
    setOrgProfileForm,
    orgGalleryPhotos,
    orgProfileSaveStatus,
    orgBookingMessages,
    setOrgBookingMessages,
    orgAcquiringForm,
    setOrgAcquiringForm,
    orgAcquiringSaveStatus,
    orgCalendarLinks,
    orgCalendarStatus,
    setOrgCalendarStatus,
    orgMessagingForm,
    setOrgMessagingForm,
    orgMessagingSaveStatus,
    orgTelegramLinkInfo,
    profileOrgStatus,
    setProfileOrgStatus,
    saveProviderOrganization,
    createProviderBranch,
    saveProviderBranchEdit,
    deleteProviderBranch,
    saveOrgProfileInfo,
    saveOrgAcquiring,
    rotateOrgCalendarToken,
    saveOrgMessaging,
    loadOrgTelegramLink,
    refreshOrgTelegramLink,
    unlinkOrgTelegram,
    uploadOrgGalleryPhoto,
    deleteOrgGalleryPhoto,
    saveOrgBookingMessages,
  } = useOrgSettings({
    authFetch,
    accessToken,
    me,
    currentView,
    loadMe,
    loadSellerData,
    location,
    orgAddressForm,
    setOrgAddressForm,
    locationForm,
    setLocationForm,
    setBranchGeoStatus,
    setDetectedCity,
    orgMainEditOpen,
    setOrgMainEditOpen,
    selectedOrgBranchId,
    setSelectedOrgBranchId,
    orgBranchAddOpen,
    setOrgBranchAddOpen,
    orgBranchEditOpen,
    setOrgBranchEditOpen,
    profileMapRef,
    profilePlacemarkRef,
    branchDetailMapRef,
    branchDetailPlacemarkRef,
    branchEditMapRef,
    branchEditPlacemarkRef,
    branchAddMapRef,
    branchAddPlacemarkRef,
  });

  function applyAuthTokens(data) {
    if (!data?.access || !data?.refresh) return false;
    setAccessToken(data.access);
    setRefreshToken(data.refresh);
    localStorage.setItem("vmeste_access", data.access);
    localStorage.setItem("vmeste_refresh", data.refresh);
    setAuthStatus("Вход выполнен.");
    setShowAuthModal(false);
    return true;
  }

  const {
    openAuth,
    closeAuth,
    destroyRegMap,
    initMap,
    onSubmit,
    continueProviderRegistration,
    completeCredentialsSetup,
    completeOnboarding,
    startDemo,
    confirmPasswordReset,
    handleVerifyEmailFromUrl,
    handleConfirmPasswordChangeFromUrl,
    handlePasswordResetFromUrl,
  } = useAuthOnboarding({
    authFetch,
    accessToken,
    me,
    form,
    setForm,
    emptyRegisterForm,
    setLoginForm,
    credentialsForm,
    setCredentialsForm,
    setCredentialsBusy,
    passwordResetToken,
    setPasswordResetToken,
    resetForm,
    setResetForm,
    setPasswordResetBusy,
    authMode,
    setAuthMode,
    setShowAuthModal,
    setRegisterStep,
    setAuthProviders,
    setAuthStatus,
    setStatus,
    setVerifyStatus,
    setVerifyEmailNotice,
    setResendStatus,
    setAccessToken,
    setRefreshToken,
    setMe,
    setCurrentView,
    mapRef,
    placemarkRef,
    setDetectedCity,
    onboardingPrefillIdRef,
  });

  useEffect(() => {
    handleVerifyEmailFromUrl();
    handleConfirmPasswordChangeFromUrl();
    handlePasswordResetFromUrl();
    const params = new URLSearchParams(window.location.search);
    if (oauthBoot.error) {
      setAuthStatus(oauthBoot.error);
      openAuth("login");
    }
    if (params.get("register") === "1" || params.get("auth") === "register") {
      openAuth("register");
      params.delete("register");
      params.delete("auth");
      const q = params.toString();
      window.history.replaceState({}, document.title, `${window.location.pathname}${q ? `?${q}` : ""}${window.location.hash || ""}`);
    } else if (params.get("login") === "1" || params.get("auth") === "login") {
      openAuth("login");
      params.delete("login");
      params.delete("auth");
      const q = params.toString();
      window.history.replaceState({}, document.title, `${window.location.pathname}${q ? `?${q}` : ""}${window.location.hash || ""}`);
    }
  }, []);

  useEffect(() => {
    const isProviderFlow =
      needsOnboarding ? me?.role === "provider" : form.role === "provider";
    if ((showAuthModal || needsOnboarding) && (authMode === "register" || needsOnboarding) && isProviderFlow) {
      initMap();
    }
  }, [showAuthModal, authMode, registerStep, form.role, form.provider_sphere, needsOnboarding, me?.role]);

  useEffect(() => {
    window.__vmesteOnTelegramAuth = async (user) => {
      setAuthStatus("Входим через Telegram...");
      const role =
        authMode === "register" && (form.role === "client" || form.role === "provider")
          ? form.role
          : "";
      const response = await fetch(`${API_URL}/users/auth/telegram/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(role ? { ...user, role } : user),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setAuthStatus(data.detail || "Не удалось войти через Telegram.");
        return;
      }
      applyAuthTokens(data);
    };
    window.onTelegramAuth = window.__vmesteOnTelegramAuth;
    return () => {
      delete window.__vmesteOnTelegramAuth;
      delete window.onTelegramAuth;
    };
  }, [authMode, form.role]);

  useEffect(() => {
    const host = telegramLoginHostRef.current;
    const bot = String(authProviders.telegram || "").replace(/^@/, "");
    if (!showAuthModal || !host || !bot) return undefined;
    host.innerHTML = "";
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", bot);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-radius", "10");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    host.appendChild(script);
    return () => {
      host.innerHTML = "";
    };
  }, [showAuthModal, authProviders.telegram, authMode]);

  async function onLogin(event) {
    event.preventDefault();
    setAuthStatus("Входим...");
    const response = await fetch(AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(loginForm),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const msg = error.detail || (typeof error === "object" && error.non_field_errors?.[0]) || "Ошибка входа.";
      setAuthStatus(typeof msg === "string" ? msg : "Ошибка входа.");
      return;
    }
    const data = await response.json();
    applyAuthTokens(data);
  }

  function logout() {
    localStorage.removeItem("vmeste_access");
    localStorage.removeItem("vmeste_refresh");
    localStorage.removeItem("vmeste_demo");
    setAccessToken("");
    setRefreshToken("");
    setMe(null);
    clientMeBootstrappedRef.current = false;
    setCurrentView("bookings");
    setAuthStatus("Вы вышли.");
    resetPushRegistration();
    onboardingPrefillIdRef.current = null;
    credentialsPrefillIdRef.current = null;
    setShowAuthModal(false);
    setRegisterStep(1);
  }

  const {
    profileForm,
    setProfileForm,
    passwordForm,
    setPasswordForm,
    emailForm,
    setEmailForm,
    deleteAccountForm,
    setDeleteAccountForm,
    deleteAccountStatus,
    deleteAccountBusy,
    updateProfile,
    changePassword,
    changeEmail,
    deleteMyAccount,
    requestPasswordResetFromSettings,
  } = useProfileAccount({
    authFetch,
    me,
    loadMe,
    logout,
    setStatus,
    setAuthStatus,
    setPasswordResetBusy,
  });

  async function exitDemoSession() {
    const demo = localStorage.getItem("vmeste_demo") === "1" || Boolean(me?.is_demo);
    if (demo && accessToken) {
      try {
        await authFetch(`${API_URL}/users/demo-exit/`, { method: "POST" });
      } catch {
        /* still leave the cabinet */
      }
    }
    logout();
  }

  async function resendVerification() {
    setResendStatus("Отправляем письмо...");
    const email = me?.email || verifyEmailNotice?.email || form.email || "";
    await resendVerificationForEmail(email);
  }

  async function loadChatActivity() {
    const res = await authFetch(`${API_URL}/chat/activity/`);
    if (res.ok) setChatActivity(await res.json());
  }

  async function acceptStaffInvite(linkId) {
    const res = await authFetch(`${API_URL}/booking/staff/${linkId}/accept-invite/`, { method: "POST", body: "{}" });
    if (!res.ok) {
      setChatStatus("Не удалось принять приглашение.");
      return;
    }
    setChatStatus("");
    loadChatActivity();
    loadMe();
    if (me?.role === "provider") loadSellerData();
    else loadStaffWorkspace();
  }

  async function rejectStaffInvite(linkId) {
    const res = await authFetch(`${API_URL}/booking/staff/${linkId}/reject-invite/`, { method: "POST", body: "{}" });
    if (!res.ok) {
      setChatStatus("Не удалось отклонить приглашение.");
      return;
    }
    setChatStatus("");
    loadChatActivity();
    loadMe();
    if (me?.role === "provider") loadSellerData();
    else loadStaffWorkspace();
  }

  async function markInAppNotificationsRead(ids) {
    if (!ids?.length) return;
    await authFetch(`${API_URL}/notifications/in-app/mark-read/`, {
      method: "POST",
      body: JSON.stringify({ ids }),
    });
    loadChatActivity();
  }

  const {
    isBookmarkAvailable,
    navigateBookmark,
    toggleSubnavBookmark,
  } = useCabinetNavigation({
    me,
    accessToken,
    isCafeOrgUser,
    canViewOrgReviews,
    canManageOrgSettings,
    canAccessStaffPage,
    staffHasPerm,
    setMenuOpen,
    setSelectedChatId,
    setMarketplaceInitialTab,
    setCurrentView,
    setCafeWorkspaceTab,
    openProviderReviews: () => openProviderReviewsRef.current(),
    setSubnavBookmarks,
  });

  const platformTourSphere = me?.provider_sphere || me?.employer_sphere || "";
  const platformTourSteps = buildPlatformTourSteps({
    role: me?.role,
    sphere: platformTourSphere,
    isBookmarkAvailable,
  });

  function preparePlatformTourStep(step) {
    if (step?.prepare === "openMenu") setMenuOpen(true);
  }

  function finishPlatformTour() {
    if (me?.id) writePlatformTourDone(me.id);
    setPlatformTourPhase("hidden");
    setPlatformTourStep(0);
    setMenuOpen(false);
  }

  function startPlatformTour() {
    setPlatformTourStep(0);
    setPlatformTourPhase("running");
    preparePlatformTourStep(platformTourSteps[0]);
  }

  function replayPlatformTour() {
    setPlatformTourStep(0);
    setPlatformTourPhase("welcome");
    setMenuOpen(false);
  }

  async function requestPasswordResetFromLogin(event) {
    event.preventDefault();
    const email = (loginForm.email || "").trim();
    if (!email) {
      setAuthStatus("Укажите email аккаунта.");
      return;
    }
    setPasswordResetBusy(true);
    const response = await fetch(`${API_URL}/users/request-password-reset/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await response.json().catch(() => ({}));
    setPasswordResetBusy(false);
    setAuthStatus(data.detail || (response.ok ? "Если аккаунт есть, мы отправили ссылку на почту." : "Не удалось отправить ссылку."));
  }

  async function saveClientNotifyPrefs(event) {
    event?.preventDefault?.();
    setClientNotifyStatus("");
    const res = await authFetch(`${API_URL}/users/me/`, {
      method: "PATCH",
      body: JSON.stringify({
        notify_booking_reminders: Boolean(clientNotifyForm.notify_booking_reminders),
        notify_booking_status: Boolean(clientNotifyForm.notify_booking_status),
      }),
    });
    if (!res.ok) {
      setClientNotifyStatus("Не удалось сохранить.");
      return;
    }
    const data = await res.json().catch(() => ({}));
    setMe((prev) => (prev ? { ...prev, ...data } : prev));
    setClientNotifyStatus("Сохранено.");
  }

  async function loadTelegramLink() {
    const res = await authFetch(`${API_URL}/notifications/telegram/link/`);
    if (res.ok) setTelegramLinkInfo(await res.json());
  }

  async function unlinkTelegram() {
    await authFetch(`${API_URL}/notifications/telegram/link/`, { method: "DELETE" });
    setTelegramLinkInfo((p) => (p ? { ...p, linked: false, telegram_chat_id: "" } : p));
    loadMe();
  }

  function renderProviderReviewsBlock() {
    return (
      <ProviderReviewsPanel
        providerReviews={providerReviews}
        providerReviewsOrdering={providerReviewsOrdering}
        setProviderReviewsOrdering={setProviderReviewsOrdering}
        loadProviderReviewsList={loadProviderReviewsList}
        accessToken={accessToken}
        me={me}
        reviewReplyOpenId={reviewReplyOpenId}
        reviewReplyForms={reviewReplyForms}
        reviewReplyFormError={reviewReplyFormError}
        setReviewReplyOpenId={setReviewReplyOpenId}
        setReviewReplyForms={setReviewReplyForms}
        setReviewReplyFormError={setReviewReplyFormError}
        toggleReviewLike={toggleReviewLike}
        submitReviewReply={submitReviewReply}
        openReviewPhotoLightbox={openReviewPhotoLightbox}
      />
    );
  }

  function renderBookingSlotActions(it) {
    return (
      <BookingSlotActions
        it={it}
        me={me}
        canManageBookings={canManageBookings}
        releaseManualHold={releaseManualHold}
        orgBookingAction={orgBookingAction}
        openInspectionFromBooking={openInspectionFromBooking}
        startInspectionFromBooking={startInspectionFromBooking}
        setPendingInspectionId={setPendingInspectionId}
        setCurrentView={setCurrentView}
        openChatWithClient={openChatWithClient}
        bookingHasStarted={bookingHasStarted}
        resumeBookingPayment={resumeBookingPayment}
        openChatWithProvider={openChatWithProvider}
        clientCancelBooking={clientCancelBooking}
        bookingHasReview={bookingHasReview}
        openClientReviewModal={openClientReviewModal}
      />
    );
  }

  function renderBookingCalendar(title = "Записи") {
    return (
      <BookingCalendar
        title={title}
        bookingsMonth={bookingsMonth}
        setBookingsMonth={setBookingsMonth}
        bookings={bookings}
        setCalendarDayDetail={setCalendarDayDetail}
        bookingSlotSecondaryLabel={bookingSlotSecondaryLabel}
        renderBookingSlotActions={renderBookingSlotActions}
      />
    );
  }

  function renderBookingsBlock(title = "Записи") {
    return renderBookingCalendar(title);
  }

  function renderBookingHistory() {
    return (
      <BookingHistory
        me={me}
        bookings={bookings}
        historyTab={historyTab}
        setHistoryTab={setHistoryTab}
        authFetch={authFetch}
        API_URL={API_URL}
        pendingInspectionId={pendingInspectionId}
        setPendingInspectionId={setPendingInspectionId}
        openOrgPhotoLightbox={openOrgPhotoLightbox}
        bookingClientLabel={bookingClientLabel}
        openOrgCardFromHistory={openOrgCardFromHistory}
        openChatWithClient={openChatWithClient}
        resumeBookingPayment={resumeBookingPayment}
        canManageBookings={canManageBookings}
        openInspectionFromBooking={openInspectionFromBooking}
        startInspectionFromBooking={startInspectionFromBooking}
        setCurrentView={setCurrentView}
        getBookingReview={getBookingReview}
        openClientReviewModal={openClientReviewModal}
      />
    );
  }

  function renderSlotCalendar(showCreateControls = false) {
    return (
      <SlotIntervalCalendar
        showCreateControls={showCreateControls}
        calendarMonth={calendarMonth}
        setCalendarMonth={setCalendarMonth}
        me={me}
        orgStaff={orgStaff}
        savedIntervals={savedIntervals}
        setSavedIntervals={setSavedIntervals}
        selectedIntervalId={selectedIntervalId}
        setSelectedIntervalId={setSelectedIntervalId}
        dragIntervalId={dragIntervalId}
        setDragIntervalId={setDragIntervalId}
        intervalPopoverId={intervalPopoverId}
        setIntervalPopoverId={setIntervalPopoverId}
        intervalPopoverAnchorRef={intervalPopoverAnchorRef}
        intervalPopoverFixedStyle={intervalPopoverFixedStyle}
        setIntervalPopoverFixedStyle={setIntervalPopoverFixedStyle}
        closeIntervalPopover={closeIntervalPopover}
        slots={slots}
        setCalendarDayDetail={setCalendarDayDetail}
        setSellerStatus={setSellerStatus}
        applyIntervalToDay={applyIntervalToDay}
        applyIntervalByPattern={applyIntervalByPattern}
        deleteSlot={deleteSlot}
        deleteSeries={deleteSeries}
        releaseManualHold={releaseManualHold}
        manualHoldForm={manualHoldForm}
        setManualHoldForm={setManualHoldForm}
        createManualHold={createManualHold}
        manualHoldBusy={manualHoldBusy}
        manualHoldStatus={manualHoldStatus}
        intervalForm={intervalForm}
        setIntervalForm={setIntervalForm}
        createSlotsByInterval={createSlotsByInterval}
        sellerStatus={sellerStatus}
        services={services}
        addAnonymousSeat={addAnonymousSeat}
        intervalEditModal={intervalEditModal}
        setIntervalEditModal={setIntervalEditModal}
      />
    );
  }

  function renderServiceTree() {
    return (
      <ServiceCatalogTree
        services={services}
        catalogStatus={catalogStatus}
        sphereOptions={sphereOptions}
        me={me}
        catalogSeeding={catalogSeeding}
        seedProviderCatalog={seedProviderCatalog}
        dirtyServiceCount={dirtyServiceCount}
        categories={categories}
        categoryOpen={categoryOpen}
        setCategoryOpen={setCategoryOpen}
        subcategoryOpen={subcategoryOpen}
        setSubcategoryOpen={setSubcategoryOpen}
        serviceDrafts={serviceDrafts}
        updateServiceDraft={updateServiceDraft}
        uploadServicePhotos={uploadServicePhotos}
        deleteServicePhoto={deleteServicePhoto}
      />
    );
  }

  const chatsTabUnreadChatsCount = useMemo(
    () => conversations.filter((c) => (Number(c.unread_message_count) || 0) > 0).length,
    [conversations],
  );

  const unreadMessagesCount = useMemo(() => {
    const fromList = conversations.reduce((s, c) => s + (Number(c.unread_message_count) || 0), 0);
    if (fromList > 0) return fromList;
    return Number(chatActivity?.unread_chat_messages_count) || 0;
  }, [conversations, chatActivity?.unread_chat_messages_count]);

  const orgFolderUnreadChatsCount = useMemo(
    () =>
      conversations.filter((c) => !c.is_client_correspondence && (Number(c.unread_message_count) || 0) > 0).length,
    [conversations],
  );

  const clientsFolderUnreadChatsCount = useMemo(
    () =>
      conversations.filter((c) => c.is_client_correspondence && (Number(c.unread_message_count) || 0) > 0).length,
    [conversations],
  );

  const filteredSidebarChats = useMemo(() => {
    let list = conversations;
    if (currentView === "vmenu") {
      list = list.filter((c) => c.is_user_direct && !c.is_saved_messages);
    } else if (me?.role === "client") {
      list = list.filter((c) => c.is_client_correspondence && !c.is_saved_messages);
    } else {
      const folder = chatFolder;
      list = list.filter((c) => (folder === "clients" ? c.is_client_correspondence : !c.is_client_correspondence));
    }
    const q = chatSearchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => displayConversationTitle(c).toLowerCase().includes(q));
    }
    if (currentView === "vmenu") {
      const lastTs = (c) => {
        const t = c.last_message?.created_at;
        if (!t) return 0;
        const x = new Date(t).getTime();
        return Number.isNaN(x) ? 0 : x;
      };
      return [...list].sort((a, b) => {
        const d = lastTs(b) - lastTs(a);
        if (d !== 0) return d;
        return Number(b.id) - Number(a.id);
      });
    }
    const folder = me?.role === "client" ? "clients" : chatFolder;
    const pins = folder === "clients" ? chatPins.clients : chatPins.org;
    const pinSet = new Set(pins.map(Number));
    const lastTs = (c) => {
      const t = c.last_message?.created_at;
      if (!t) return 0;
      const x = new Date(t).getTime();
      return Number.isNaN(x) ? 0 : x;
    };
    const pinnedList = pins.map((id) => list.find((c) => Number(c.id) === Number(id))).filter(Boolean);
    const unpinned = list.filter((c) => !pinSet.has(Number(c.id)));
    unpinned.sort((a, b) => {
      const d = lastTs(b) - lastTs(a);
      if (d !== 0) return d;
      return Number(b.id) - Number(a.id);
    });
    return [...pinnedList, ...unpinned];
  }, [conversations, chatFolder, chatSearchQuery, chatLocalPrefs, chatPins, me?.role, currentView]);

  const filteredVmenuChatContacts = useMemo(() => {
    let list = vmenuChatContacts;
    const q = chatSearchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((u) => {
        const name = String(u.display_name || u.username || "").toLowerCase();
        return name.includes(q);
      });
    }
    return list;
  }, [vmenuChatContacts, chatSearchQuery]);

  function renderGeneralSettings() {
    return (
      <GeneralSettingsPanel
        me={me}
        appTheme={appTheme}
        setAppTheme={setAppTheme}
        replayPlatformTour={replayPlatformTour}
        subnavBookmarks={subnavBookmarks}
        setSubnavBookmarks={setSubnavBookmarks}
        isBookmarkAvailable={isBookmarkAvailable}
        toggleSubnavBookmark={toggleSubnavBookmark}
        passwordForm={passwordForm}
        setPasswordForm={setPasswordForm}
        changePassword={changePassword}
        passwordResetBusy={passwordResetBusy}
        requestPasswordResetFromSettings={requestPasswordResetFromSettings}
        emailForm={emailForm}
        setEmailForm={setEmailForm}
        changeEmail={changeEmail}
        resendVerification={resendVerification}
        resendStatus={resendStatus}
        clientNotifyForm={clientNotifyForm}
        setClientNotifyForm={setClientNotifyForm}
        saveClientNotifyPrefs={saveClientNotifyPrefs}
        clientNotifyStatus={clientNotifyStatus}
        telegramLinkInfo={telegramLinkInfo}
        loadTelegramLink={loadTelegramLink}
        unlinkTelegram={unlinkTelegram}
      />
    );
  }

  function renderOrganizationSettings() {
    return (
      <OrganizationSettingsPanel
        canManageOrgSettings={canManageOrgSettings}
        me={me}
        staffEffectivePerms={staffEffectivePerms}
        cabinetLoadError={cabinetLoadError}
        loadSellerData={loadSellerData}
        saveProviderOrganization={saveProviderOrganization}
        orgAddressForm={orgAddressForm}
        setOrgAddressForm={setOrgAddressForm}
        profileOrgStatus={profileOrgStatus}
        saveOrgMessaging={saveOrgMessaging}
        orgMessagingForm={orgMessagingForm}
        setOrgMessagingForm={setOrgMessagingForm}
        orgMessagingSaveStatus={orgMessagingSaveStatus}
        orgTelegramLinkInfo={orgTelegramLinkInfo}
        loadOrgTelegramLink={loadOrgTelegramLink}
        refreshOrgTelegramLink={refreshOrgTelegramLink}
        unlinkOrgTelegram={unlinkOrgTelegram}
        orgBookingMessages={orgBookingMessages}
        setOrgBookingMessages={setOrgBookingMessages}
        saveOrgBookingMessages={saveOrgBookingMessages}
        orgSettingsHighlight={orgSettingsHighlight}
        saveOrgAcquiring={saveOrgAcquiring}
        orgAcquiringForm={orgAcquiringForm}
        setOrgAcquiringForm={setOrgAcquiringForm}
        orgAcquiringSaveStatus={orgAcquiringSaveStatus}
        orgCalendarLinks={orgCalendarLinks}
        orgCalendarStatus={orgCalendarStatus}
        rotateOrgCalendarToken={rotateOrgCalendarToken}
        setOrgCalendarStatus={setOrgCalendarStatus}
        authFetch={authFetch}
        API_URL={API_URL}
        setCurrentView={setCurrentView}
        orgProfileForm={orgProfileForm}
        setOrgProfileForm={setOrgProfileForm}
        saveOrgProfileInfo={saveOrgProfileInfo}
        orgProfileSaveStatus={orgProfileSaveStatus}
        orgGalleryPhotos={orgGalleryPhotos}
        uploadOrgGalleryPhoto={uploadOrgGalleryPhoto}
        deleteOrgGalleryPhoto={deleteOrgGalleryPhoto}
        openOrgPhotoLightbox={openOrgPhotoLightbox}
        orgMainEditOpen={orgMainEditOpen}
        setOrgMainEditOpen={setOrgMainEditOpen}
        syncOrgAddressFormFromMe={syncOrgAddressFormFromMe}
        setProfileOrgStatus={setProfileOrgStatus}
        onProfileAddressInput={onProfileAddressInput}
        geocodeProfileAddress={geocodeProfileAddress}
        pickProfileSuggestion={pickProfileSuggestion}
        detectedCity={detectedCity}
        addressSuggestions={addressSuggestions}
        location={location}
        locationForm={locationForm}
        setLocationForm={setLocationForm}
        selectedOrgBranchId={selectedOrgBranchId}
        setSelectedOrgBranchId={setSelectedOrgBranchId}
        orgBranchAddOpen={orgBranchAddOpen}
        setOrgBranchAddOpen={setOrgBranchAddOpen}
        orgBranchEditOpen={orgBranchEditOpen}
        setOrgBranchEditOpen={setOrgBranchEditOpen}
        branchGeoStatus={branchGeoStatus}
        createProviderBranch={createProviderBranch}
        saveProviderBranchEdit={saveProviderBranchEdit}
        deleteProviderBranch={deleteProviderBranch}
        onBranchAddressInput={onBranchAddressInput}
        geocodeBranchAddress={geocodeBranchAddress}
        pickBranchLocationSuggestion={pickBranchLocationSuggestion}
        setAddressSuggestions={setAddressSuggestions}
        setBranchGeoStatus={setBranchGeoStatus}
      />
    );
  }

  function renderStaffManagement() {
    if (!canAccessStaffPage) return null;
    return (
      <StaffManagementPanel
        me={me}
        staffEffectivePerms={staffEffectivePerms}
        canInviteStaff={canInviteStaff}
        staffInviteForm={staffInviteForm}
        onStaffInviteFormChange={setStaffInviteForm}
        onInviteStaff={inviteStaff}
        staffInviteStatus={staffInviteStatus}
        orgStaff={orgStaff}
        staffPermsOpenId={staffPermsOpenId}
        onStaffPermsOpenIdChange={setStaffPermsOpenId}
        staffServicesOpenId={staffServicesOpenId}
        onStaffServicesOpenIdChange={setStaffServicesOpenId}
        onPatchStaffMeta={patchStaffMeta}
        onDeactivateStaff={deactivateStaff}
        onToggleStaffPermission={toggleStaffPermission}
        staffAssignableCategories={staffAssignableCategories}
        staffAssignableServices={staffAssignableServices}
        onPatchStaffServiceAssignment={patchStaffServiceAssignment}
      />
    );
  }

  const selectedConv = useMemo(
    () => conversations.find((c) => Number(c.id) === Number(selectedChatId)),
    [conversations, selectedChatId],
  );

  const chatPeerPresenceLine = useMemo(() => {
    if (!selectedConv?.org_direct_peer_status) return "";
    const s = selectedConv.org_direct_peer_status;
    if (s.is_online) return "в сети";
    if (s.last_seen_at) return formatLastSeenLabel(s.last_seen_at);
    return "не в сети";
  }, [selectedConv]);

  const chatMsgSearchHits = useMemo(() => {
    const q = chatMsgSearchQuery.trim().toLowerCase();
    if (!q) return [];
    return chatMessages.filter((m) => chatMessagePlainText(m).toLowerCase().includes(q));
  }, [chatMessages, chatMsgSearchQuery]);

  useEffect(() => {
    setChatMsgSearchActiveIdx((i) => {
      if (!chatMsgSearchHits.length) return 0;
      return Math.min(i, chatMsgSearchHits.length - 1);
    });
  }, [chatMsgSearchHits]);

  useEffect(() => {
    if (!chatMsgSearchOpen) return;
    const hit = chatMsgSearchHits[chatMsgSearchActiveIdx];
    if (!hit) return;
    scrollChatToMessageId(hit.id);
  }, [chatMsgSearchActiveIdx, chatMsgSearchHits, chatMsgSearchOpen]);

  useEffect(() => {
    if (chatMsgSearchOpen) {
      requestAnimationFrame(() => chatMsgSearchInputRef.current?.focus());
    }
  }, [chatMsgSearchOpen]);

  useEffect(() => {
    if (!selectedChatId) {
      setChatMsgSearchOpen(false);
      setChatMsgSearchQuery("");
      setChatMsgSearchActiveIdx(0);
      setChatInfoOpen(false);
      setChatMembersView(null);
      setGroupAddStaffIds([]);
      setGroupAddStatus("");
      setChatPendingFiles([]);
      setChatPendingKind("");
      discardChatMediaPreview();
      if (chatRecordingKind) cancelChatRecording();
    } else {
      setChatMembersView(null);
      setGroupAddStaffIds([]);
      setGroupAddStatus("");
    }
  }, [selectedChatId]);

  const chatMediaGroups = useMemo(() => groupChatMedia(chatMessages, BASE_URL), [chatMessages]);

  const tgMainStyle = activeChatWallpaper
    ? String(activeChatWallpaper).includes("gradient")
      ? { background: activeChatWallpaper, backgroundSize: "cover" }
      : { backgroundColor: activeChatWallpaper }
    : undefined;
  const tgMainDark = activeChatWallpaper === "#1e2a24";
  const chatsRoleOk =
    currentView === "vmenu" ||
    me?.role === "client" ||
    me?.role === "provider" ||
    me?.role === "staff";
  const chatsPortalTarget = currentView === "vmenu" ? vmenuChatsHostEl : mainChatsHostEl;
  const centeredWorkspace = accessToken && ["profile", "organization", "staff", "settings", "subscriptions", "cafe", "cafe_orders", "cafe_my_orders", "loyalty", "activity", "inspections", "marketplaces", "service_apps", "vmenu"].includes(currentView);
  const profileWide = accessToken && ["profile", "subscriptions"].includes(currentView);

  return (
    <div className={`page${accessToken ? " page-logged" : " page--guest"}`}>
      <CabinetErrorBoundary resetKey={accessToken ? `${me?.id || 0}:${currentView}` : "guest"}>
      <CabinetChrome
        accessToken={accessToken}
        me={me}
        currentView={currentView}
        setCurrentView={setCurrentView}
        verifyStatus={verifyStatus}
        clientHeaderSearchWrapRef={clientHeaderSearchWrapRef}
        clientMapSearchInput={clientMapSearchInput}
        setClientMapSearchInput={setClientMapSearchInput}
        setClientMapSearchFocused={setClientMapSearchFocused}
        showClientDiscoverSearchDropdown={showClientDiscoverSearchDropdown}
        clientDiscoverSearchOrgs={clientDiscoverSearchOrgs}
        clientDiscoverSearch={clientDiscoverSearch}
        sphereOptions={sphereOptions}
        openOrgOnMap={openOrgOnMap}
        setClientFilterModalDraft={setClientFilterModalDraft}
        clientDiscoverFilters={clientDiscoverFilters}
        setClientFiltersOpen={setClientFiltersOpen}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        menuWrapRef={menuWrapRef}
        chatActivity={chatActivity}
        navigateBookmark={navigateBookmark}
        isBookmarkAvailable={isBookmarkAvailable}
        subnavBookmarks={subnavBookmarks}
        unreadMessagesCount={unreadMessagesCount}
        missedReviewsCount={missedReviewsCount}
        marketplaceInitialTab={marketplaceInitialTab}
        canAccessStaffPage={canAccessStaffPage}
        canManageOrgSettings={canManageOrgSettings}
        exitDemoSession={exitDemoSession}
        openAuth={openAuth}
        intervalToast={intervalToast}
      >
      <main className={`grid${centeredWorkspace ? " grid-centered-workspace" : ""}${profileWide ? " grid-profile-wide" : ""}`}>
        {!accessToken && (
          <LandingPage
            onLogin={() => openAuth("login")}
            onRegister={() => openAuth("register")}
            onStartDemo={startDemo}
          />
        )}

        {(showAuthModal && (!accessToken || authMode === "reset" || needsOnboarding || needsCredentialsSetup)) && createPortal(
          <AuthModal
            needsOnboarding={needsOnboarding}
            needsCredentialsSetup={needsCredentialsSetup}
            closeAuth={closeAuth}
            verifyEmailNotice={verifyEmailNotice}
            setVerifyEmailNotice={setVerifyEmailNotice}
            resendVerificationForEmail={resendVerificationForEmail}
            resendStatus={resendStatus}
            setResendStatus={setResendStatus}
            completeCredentialsSetup={completeCredentialsSetup}
            credentialsForm={credentialsForm}
            setCredentialsForm={setCredentialsForm}
            credentialsBusy={credentialsBusy}
            authStatus={authStatus}
            setAuthStatus={setAuthStatus}
            me={me}
            authMode={authMode}
            setAuthMode={setAuthMode}
            confirmPasswordReset={confirmPasswordReset}
            resetForm={resetForm}
            setResetForm={setResetForm}
            passwordResetBusy={passwordResetBusy}
            requestPasswordResetFromLogin={requestPasswordResetFromLogin}
            loginForm={loginForm}
            setLoginForm={setLoginForm}
            onLogin={onLogin}
            completeOnboarding={completeOnboarding}
            onSubmit={onSubmit}
            registerStep={registerStep}
            setRegisterStep={setRegisterStep}
            form={form}
            setForm={setForm}
            logout={logout}
            continueProviderRegistration={continueProviderRegistration}
            sphereOptions={sphereOptions}
            onAddressInput={onAddressInput}
            geocodeAddress={geocodeAddress}
            detectedCity={detectedCity}
            addressSuggestions={addressSuggestions}
            pickSuggestion={pickSuggestion}
            destroyRegMap={destroyRegMap}
            emptyRegisterForm={emptyRegisterForm}
            authProviders={authProviders}
            telegramLoginHostRef={telegramLoginHostRef}
            status={status}
          />,
          document.body,
        )}

        {accessToken && currentView === "profile" && (
          <ProfileCabinetPanel
            chatActivity={chatActivity}
            fullName={fullName}
            me={me}
            acceptStaffInvite={acceptStaffInvite}
            rejectStaffInvite={rejectStaffInvite}
            markInAppNotificationsRead={markInAppNotificationsRead}
            setPendingInspectionId={setPendingInspectionId}
            setCurrentView={setCurrentView}
            updateProfile={updateProfile}
            profileForm={profileForm}
            setProfileForm={setProfileForm}
            canManageOrgSettings={canManageOrgSettings}
            deleteMyAccount={deleteMyAccount}
            deleteAccountForm={deleteAccountForm}
            setDeleteAccountForm={setDeleteAccountForm}
            deleteAccountBusy={deleteAccountBusy}
            deleteAccountStatus={deleteAccountStatus}
            resendVerification={resendVerification}
            resendStatus={resendStatus}
            orgStaff={orgStaff}
            uploadStaffCard={uploadStaffCard}
            deleteStaffPortfolioPhoto={deleteStaffPortfolioPhoto}
            staffInviteStatus={staffInviteStatus}
          />
        )}

        {accessToken && me?.role !== "client" && currentView === "subscriptions" && (
          <SubscriptionsPage
            apiUrl={API_URL}
            authFetch={authFetch}
            me={me}
          />
        )}

        {accessToken && (me?.role === "provider" || me?.role === "staff") && currentView === "analytics" && (
          <AnalyticsPage
            apiUrl={API_URL}
            authFetch={authFetch}
            providerSphere={me?.provider_sphere || me?.employer_sphere || ""}
          />
        )}

        {accessToken && currentView === "settings" && renderGeneralSettings()}
        {accessToken && currentView === "organization" && canManageOrgSettings && renderOrganizationSettings()}
        {accessToken && currentView === "cafe" && isCafeOrgUser && (cafeAccessPerms.cafe_menu || cafeAccessPerms.cafe_settings || cafeAccessPerms.cafe_seating) && (
          <CafeProviderWorkspace
            authFetch={authFetch}
            API_URL={API_URL}
            initialTab={cafeWorkspaceTab}
            onTabChange={setCafeWorkspaceTab}
            accessPerms={cafeAccessPerms}
          />
        )}
        {accessToken &&
          currentView === "cafe_orders" &&
          isCafeOrgUser &&
          (cafeAccessPerms.cafe_orders ||
            cafeAccessPerms.cafe_kitchen ||
            cafeAccessPerms.cafe_seating ||
            cafeAccessPerms.cafe_delivery) && (
          <CafeOrdersPage
            authFetch={authFetch}
            API_URL={API_URL}
            accessPerms={cafeAccessPerms}
            orgStaff={orgStaff}
            providerId={me?.role === "provider" ? me.id : me?.employer_id}
          />
        )}
        {accessToken && currentView === "service_apps" && (
          <ServicesHub onOpenVmenu={() => setCurrentView("vmenu")} />
        )}
        {accessToken && currentView === "vmenu" && (
          <VmenuApp
            authFetch={authFetch}
            API_URL={API_URL}
            me={me}
            selectedChatId={selectedChatId}
            onSelectChat={(convId) => setSelectedChatId(convId)}
            onTabChange={setVmenuTab}
            onChatsHostReady={setVmenuChatsHostEl}
            onExit={() => setCurrentView("service_apps")}
          />
        )}
        {accessToken &&
          currentView === "marketplaces" &&
          ((me?.role === "provider" && me?.provider_sphere === "marketplaces") ||
            (me?.role === "staff" &&
              (staffHasPerm("marketplace_manage_orders") ||
                staffHasPerm("marketplace_manage_catalog") ||
                staffHasPerm("marketplace_view_keys")))) && (
          <MarketplaceWorkspace
            authFetch={authFetch}
            API_URL={API_URL}
            initialTab={marketplaceInitialTab}
            onInitialTabConsumed={() => setMarketplaceInitialTab(null)}
            accessPerms={
              me?.role === "staff"
                ? {
                    marketplace_view_keys: Boolean(staffEffectivePerms.marketplace_view_keys),
                    marketplace_manage_orders: Boolean(staffEffectivePerms.marketplace_manage_orders),
                    marketplace_manage_catalog: Boolean(staffEffectivePerms.marketplace_manage_catalog),
                  }
                : {
                    marketplace_view_keys: true,
                    marketplace_manage_orders: true,
                    marketplace_manage_catalog: true,
                  }
            }
          />
        )}
        {accessToken && currentView === "inspections" && (me?.role === "provider" || me?.role === "staff") && (
          <InspectionWorkspace
            authFetch={authFetch}
            API_URL={API_URL}
            me={me}
            bookings={bookings}
            initialReportId={pendingInspectionId}
            onConsumedInitialReportId={() => setPendingInspectionId(null)}
            onOpenPhotos={openOrgPhotoLightbox}
          />
        )}
        {accessToken && currentView === "inspections" && me?.role === "client" && (
          <ClientInspectionsPanel
            authFetch={authFetch}
            API_URL={API_URL}
            initialReportId={pendingInspectionId}
            onConsumedInitialReportId={() => setPendingInspectionId(null)}
            onBackToChats={() => setCurrentView("chats")}
            onOpenPhotos={openOrgPhotoLightbox}
          />
        )}
        {accessToken && currentView === "staff" && canAccessStaffPage && renderStaffManagement()}

        {accessToken && canViewOrgReviews() && currentView === "reviews" && renderProviderReviewsBlock()}
        {accessToken && me?.role === "provider" && currentView === "bookings" && me?.provider_sphere !== "cafe_restaurant" && me?.provider_sphere !== "marketplaces" && (
          <>
            {cabinetLoadError ? (
              <LoadErrorBanner message={cabinetLoadError} onRetry={() => void loadSellerData()} />
            ) : null}
            {renderBookingsBlock("Записи клиентов")}
            {me?.provider_sphere === "hair_salon" ? (
              <WaitlistPanel authFetch={authFetch} API_URL={API_URL} mode="org" />
            ) : null}
          </>
        )}
        {accessToken && me?.role === "provider" && currentView === "intervals" && me?.provider_sphere !== "cafe_restaurant" && renderSlotCalendar(true)}
        {accessToken &&
          me?.role === "staff" &&
          currentView === "intervals" &&
          staffHasPerm("manage_intervals") &&
          me?.employer_sphere !== "cafe_restaurant" &&
          me?.provider_sphere !== "cafe_restaurant" &&
          renderSlotCalendar(true)}
        {accessToken && me?.role === "staff" && currentView === "bookings" && staffHasPerm("manage_bookings") && me?.provider_sphere !== "cafe_restaurant" && me?.employer_sphere !== "cafe_restaurant" && (
          <>
            {cabinetLoadError ? (
              <LoadErrorBanner message={cabinetLoadError} onRetry={() => void loadStaffWorkspace()} />
            ) : null}
            {renderBookingsBlock("Записи")}
            {(me?.employer_sphere === "hair_salon" || me?.provider_sphere === "hair_salon") ? (
              <WaitlistPanel authFetch={authFetch} API_URL={API_URL} mode="org" />
            ) : null}
          </>
        )}
        {accessToken && currentView === "chats" && chatsRoleOk && (
          <div ref={setMainChatsHostEl} className="tg-chats-portal-host card full-width" />
        )}
        {accessToken && chatsSurfaceActive && chatsRoleOk && chatsPortalTarget && createPortal(
          <ChatsWorkspace
            addMembersToSelectedGroup={addMembersToSelectedGroup}
            cancelChatRecording={cancelChatRecording}
            chatAttachMenuOpen={chatAttachMenuOpen}
            chatCameraFacing={chatCameraFacing}
            chatCameraSwitching={chatCameraSwitching}
            chatComposeMode={chatComposeMode}
            chatDragPinConvId={chatDragPinConvId}
            chatFabOpen={chatFabOpen}
            chatFileInputRef={chatFileInputRef}
            chatFolder={chatFolder}
            chatInfoHeadMenuOpen={chatInfoHeadMenuOpen}
            chatInfoOpen={chatInfoOpen}
            chatInfoPeer={chatInfoPeer}
            chatInfoPhotoMenuId={chatInfoPhotoMenuId}
            chatInfoTab={chatInfoTab}
            chatInput={chatInput}
            chatLiveVideoRef={chatLiveVideoRef}
            chatLoadingOlder={chatLoadingOlder}
            chatLocalPrefs={chatLocalPrefs}
            chatMediaGroups={chatMediaGroups}
            chatMediaPreview={chatMediaPreview}
            chatMembersView={chatMembersView}
            chatMessages={chatMessages}
            chatMessagesElRef={chatMessagesElRef}
            chatMsgSearchActiveIdx={chatMsgSearchActiveIdx}
            chatMsgSearchHits={chatMsgSearchHits}
            chatMsgSearchInputRef={chatMsgSearchInputRef}
            chatMsgSearchOpen={chatMsgSearchOpen}
            chatMsgSearchQuery={chatMsgSearchQuery}
            chatPeerPresenceLine={chatPeerPresenceLine}
            chatPendingFiles={chatPendingFiles}
            chatPins={chatPins}
            chatPreviewMediaRef={chatPreviewMediaRef}
            chatReceiptsMode={chatReceiptsMode}
            chatReceiptsSettingsOpen={chatReceiptsSettingsOpen}
            chatRecordingKind={chatRecordingKind}
            chatRecordLevels={chatRecordLevels}
            chatRecordLiftHint={chatRecordLiftHint}
            chatRecordLocked={chatRecordLocked}
            chatRecordSecs={chatRecordSecs}
            chatRowMenuId={chatRowMenuId}
            chatSearchQuery={chatSearchQuery}
            chatSettingsAvatar={chatSettingsAvatar}
            chatSettingsForId={chatSettingsForId}
            chatSettingsNotify={chatSettingsNotify}
            chatSettingsTitle={chatSettingsTitle}
            chatSettingsWallpaper={chatSettingsWallpaper}
            chatShowJumpBottom={chatShowJumpBottom}
            chatStatus={chatStatus}
            clearChatVisualSettings={clearChatVisualSettings}
            clientsFolderUnreadChatsCount={clientsFolderUnreadChatsCount}
            conversationAvatarLetter={conversationAvatarLetter}
            conversations={conversations}
            createOrgGroup={createOrgGroup}
            currentView={currentView}
            customColorPickerOpen={customColorPickerOpen}
            deleteGroupChat={deleteGroupChat}
            discardChatMediaPreview={discardChatMediaPreview}
            displayConversationTitle={displayConversationTitle}
            filteredSidebarChats={filteredSidebarChats}
            filteredVmenuChatContacts={filteredVmenuChatContacts}
            groupAddStaffIds={groupAddStaffIds}
            groupAddStatus={groupAddStatus}
            groupForm={groupForm}
            jumpToChatMessage={jumpToChatMessage}
            loadSellerData={loadSellerData}
            me={me}
            memberDisplayName={memberDisplayName}
            memberInitial={memberInitial}
            onChatFilePicked={onChatFilePicked}
            onComposeActionPointerDown={onComposeActionPointerDown}
            onComposeActionPointerMove={onComposeActionPointerMove}
            onComposeActionPointerUp={onComposeActionPointerUp}
            openChatAttachPicker={openChatAttachPicker}
            openChatPhotosLightbox={openChatPhotosLightbox}
            openVmenuUserChat={openVmenuUserChat}
            orgFolderUnreadChatsCount={orgFolderUnreadChatsCount}
            orgStaff={orgStaff}
            persistChatReceiptsMode={persistChatReceiptsMode}
            persistChatVisualSettings={persistChatVisualSettings}
            reorderPinnedChats={reorderPinnedChats}
            scrollChatToBottom={scrollChatToBottom}
            selectedChatId={selectedChatId}
            selectedConv={selectedConv}
            sendChatMediaPreview={sendChatMediaPreview}
            sendChatMessage={sendChatMessage}
            setChatAttachMenuOpen={setChatAttachMenuOpen}
            setChatDragPinConvId={setChatDragPinConvId}
            setChatFabOpen={setChatFabOpen}
            setChatFolder={setChatFolder}
            setChatInfoHeadMenuOpen={setChatInfoHeadMenuOpen}
            setChatInfoOpen={setChatInfoOpen}
            setChatInfoPhotoMenuId={setChatInfoPhotoMenuId}
            setChatInfoTab={setChatInfoTab}
            setChatInput={setChatInput}
            setChatMembersView={setChatMembersView}
            setChatMsgSearchActiveIdx={setChatMsgSearchActiveIdx}
            setChatMsgSearchOpen={setChatMsgSearchOpen}
            setChatMsgSearchQuery={setChatMsgSearchQuery}
            setChatPendingFiles={setChatPendingFiles}
            setChatPendingKind={setChatPendingKind}
            setChatReceiptsSettingsOpen={setChatReceiptsSettingsOpen}
            setChatRowMenuId={setChatRowMenuId}
            setChatSearchQuery={setChatSearchQuery}
            setChatSettingsAvatar={setChatSettingsAvatar}
            setChatSettingsForId={setChatSettingsForId}
            setChatSettingsNotify={setChatSettingsNotify}
            setChatSettingsTitle={setChatSettingsTitle}
            setChatSettingsWallpaper={setChatSettingsWallpaper}
            setCurrentView={setCurrentView}
            setCustomColorPickerOpen={setCustomColorPickerOpen}
            setGroupAddStaffIds={setGroupAddStaffIds}
            setGroupAddStatus={setGroupAddStatus}
            setGroupForm={setGroupForm}
            setMenuOpen={setMenuOpen}
            setPendingInspectionId={setPendingInspectionId}
            setSelectedChatId={setSelectedChatId}
            staffJobTitleForUser={staffJobTitleForUser}
            stopChatRecording={stopChatRecording}
            switchChatCamera={switchChatCamera}
            tgAttachMenuRef={tgAttachMenuRef}
            tgMainDark={tgMainDark}
            tgMainStyle={tgMainStyle}
            tgMsgSearchWrapRef={tgMsgSearchWrapRef}
            toggleGroupAddStaff={toggleGroupAddStaff}
            toggleGroupStaff={toggleGroupStaff}
            togglePinChatForFolder={togglePinChatForFolder}
            updateChatScrollUi={updateChatScrollUi}
          />,
          chatsPortalTarget,
        )}

        {accessToken &&
          currentView === "services" &&
          me?.provider_sphere !== "cafe_restaurant" &&
          me?.provider_sphere !== "marketplaces" &&
          me?.employer_sphere !== "cafe_restaurant" &&
          me?.employer_sphere !== "marketplaces" &&
          (me?.role === "provider" || (me?.role === "staff" && staffHasPerm("manage_services"))) && (
          <div className="services-layout">
            {cabinetLoadError ? (
              <LoadErrorBanner
                message={cabinetLoadError}
                onRetry={() => void (me?.role === "provider" ? loadSellerData() : loadStaffWorkspace())}
              />
            ) : null}
            <section className="card">
              {renderServiceTree()}
            </section>
            <section className="card right-stack catalog-help-panel">
              <h2>Как настроить</h2>
              <ol className="catalog-help-list">
                <li>Загрузите готовый каталог для вашей сферы.</li>
                <li>Включите «Оказываем» у нужных услуг.</li>
                <li>Укажите цену и длительность и нажмите «Сохранить все изменения».</li>
              </ol>
              {dirtyServiceCount > 0 && (
                <button
                  type="button"
                  className="catalog-save-all-btn"
                  disabled={serviceSavingAll}
                  onClick={saveAllServiceChanges}
                >
                  {serviceSavingAll ? "Сохранение…" : `Сохранить все изменения (${dirtyServiceCount})`}
                </button>
              )}
              {catalogStatus?.catalog_seeded && (
                <button type="button" className="ghost-btn" disabled={catalogSeeding} onClick={seedProviderCatalog}>
                  Обновить каталог из шаблона
                </button>
              )}
              <p className="status">{sellerStatus}</p>
            </section>
            {(me?.provider_sphere === "hair_salon") && (
              <SalonLoyaltyPackagesPanel
                authFetch={authFetch}
                API_URL={API_URL}
                services={services.filter((s) => s.is_active !== false)}
              />
            )}
            {me?.provider_sphere === "service_center" ? (
              <p className="muted small">
                Абонементы и баллы — для салонов. В автосервисе используйте приёмку и заказ-наряды.
              </p>
            ) : null}
          </div>
        )}

        {accessToken && (me?.role === "client" || me?.role === "provider") && currentView === "client_map" && (
          <ClientMapPanel
            allLocations={allLocations}
            mapOrgPopup={mapOrgPopup}
            mapOrgSheetCollapsed={mapOrgSheetCollapsed}
            mapOrgReviewsOpen={mapOrgReviewsOpen}
            clientBookModalOpen={clientBookModalOpen}
            clientFiltersOpen={clientFiltersOpen}
            mapOrgSheetTouchY={mapOrgSheetTouchY}
            expandMapOrgSheet={expandMapOrgSheet}
            collapseMapOrgSheet={collapseMapOrgSheet}
            closeMapOrgSheet={closeMapOrgSheet}
            mapOrgProfile={mapOrgProfile}
            mapOrgSummary={mapOrgSummary}
            sphereOptions={sphereOptions}
            mapOrgCarouselTouchX={mapOrgCarouselTouchX}
            openOrgPhotoLightbox={openOrgPhotoLightbox}
            mapOrgCarouselIndex={mapOrgCarouselIndex}
            setMapOrgCarouselIndex={setMapOrgCarouselIndex}
            mapOrgPackages={mapOrgPackages}
            authFetch={authFetch}
            API_URL={API_URL}
            showToast={showToast}
            clientDiscoverFiltersRef={clientDiscoverFiltersRef}
            onClientLocationSelect={onClientLocationSelect}
            setClientBookModalOpen={setClientBookModalOpen}
            openChatWithProvider={openChatWithProvider}
            mapOrgStaff={mapOrgStaff}
            setStaffReviewModal={setStaffReviewModal}
            loadMapOrgReviews={loadMapOrgReviews}
            mapOrgReviewsOrdering={mapOrgReviewsOrdering}
            staffReviewModal={staffReviewModal}
            mapOrgReviews={mapOrgReviews}
            setMapOrgReviewsOrdering={setMapOrgReviewsOrdering}
            accessToken={accessToken}
            me={me}
            reviewReplyOpenId={reviewReplyOpenId}
            reviewReplyForms={reviewReplyForms}
            reviewReplyFormError={reviewReplyFormError}
            setReviewReplyOpenId={setReviewReplyOpenId}
            setReviewReplyForms={setReviewReplyForms}
            setReviewReplyFormError={setReviewReplyFormError}
            toggleReviewLike={toggleReviewLike}
            submitReviewReply={submitReviewReply}
            openReviewPhotoLightbox={openReviewPhotoLightbox}
          />
        )}

        {accessToken && me?.role === "client" && currentView === "activity" && (
          <ClientActivityFeed
            authFetch={authFetch}
            API_URL={API_URL}
            onNavigate={(view) => setCurrentView(view)}
            onRebook={(booking) => openOrgCardFromHistory(booking)}
          />
        )}
        {accessToken && me?.role === "client" && currentView === "bookings" && renderBookingsBlock("Мои записи")}
        {accessToken && me?.role === "client" && currentView === "cafe_my_orders" && (
          <ClientCafeOrdersPage authFetch={authFetch} API_URL={API_URL} />
        )}
        {accessToken && me?.role === "client" && currentView === "loyalty" && (
          <ClientLoyaltyPage authFetch={authFetch} API_URL={API_URL} />
        )}
        {accessToken && me?.role === "provider" && currentView === "my_bookings" && me?.provider_sphere !== "cafe_restaurant" && me?.provider_sphere !== "marketplaces" && renderBookingsBlock("Мои записи")}

        {accessToken && currentView === "booking_history" && renderBookingHistory()}

        {accessToken && (me?.role === "client" || me?.role === "provider") && clientFiltersOpen && typeof document !== "undefined" && createPortal(
          <ClientMapFiltersModal
            clientFilterModalDraft={clientFilterModalDraft}
            setClientFilterModalDraft={setClientFilterModalDraft}
            sphereOptions={sphereOptions}
            clientFilterServiceGroups={clientFilterServiceGroups}
            setClientFiltersOpen={setClientFiltersOpen}
            setClientDiscoverFilters={setClientDiscoverFilters}
            setClientBookingForm={setClientBookingForm}
            emptyClientFilters={emptyClientFilters}
          />,
          document.body,
        )}
      </main>

      {bookingMessageError && typeof document !== "undefined" && createPortal(
        <BookingMessageErrorModal
          bookingMessageError={bookingMessageError}
          setBookingMessageError={setBookingMessageError}
          goOrgSettingsForBookingMessage={goOrgSettingsForBookingMessage}
        />,
        document.body,
      )}

      {orgPhotoLightbox?.items?.length > 0 && typeof document !== "undefined" && createPortal(
        <OrgPhotoLightbox
          orgPhotoLightbox={orgPhotoLightbox}
          setOrgPhotoLightbox={setOrgPhotoLightbox}
          stepOrgPhotoLightbox={stepOrgPhotoLightbox}
          orgPhotoLightboxTouchX={orgPhotoLightboxTouchX}
        />,
        document.body,
      )}

      {reviewModalBooking && typeof document !== "undefined" && createPortal(
        <ReviewModal
          reviewModalBooking={reviewModalBooking}
          setReviewModalBooking={setReviewModalBooking}
          reviewModalReview={reviewModalReview}
          setReviewModalReview={setReviewModalReview}
          reviewForm={reviewForm}
          setReviewForm={setReviewForm}
          reviewSubmitError={reviewSubmitError}
          submitClientReview={submitClientReview}
        />,
        document.body,
      )}

      <div className="incoming-toast-stack" aria-live="polite">

        {clientBookModalOpen && typeof document !== "undefined" && createPortal(
          <ClientBookModal
            setClientBookModalOpen={setClientBookModalOpen}
            mapOrgPopup={mapOrgPopup}
            mapOrgProfile={mapOrgProfile}
            createClientBooking={createClientBooking}
            bookProviderStaff={bookProviderStaff}
            providerServices={providerServices}
            clientBookingForm={clientBookingForm}
            setClientBookingForm={setClientBookingForm}
            openOrgPhotoLightbox={openOrgPhotoLightbox}
            bookAvailableDates={bookAvailableDates}
            clientBookWindows={clientBookWindows}
            authFetch={authFetch}
            API_URL={API_URL}
            bookClientPackages={bookClientPackages}
            bookLoyaltyInfo={bookLoyaltyInfo}
            clientStatus={clientStatus}
          />,
          document.body,
        )}

        {incomingToasts.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`incoming-toast ${t.fade ? "incoming-toast--fade" : ""}`}
            onClick={() => {
              setCurrentView("chats");
              setSelectedChatId(t.convId);
            }}
          >
            <strong>{t.title}</strong>
            <span>{t.text}</span>
          </button>
        ))}

        {calendarDayDetail &&
          typeof document !== "undefined" &&
          createPortal(
            <CalendarDayDetailModal
              calendarDayDetail={calendarDayDetail}
              setCalendarDayDetail={setCalendarDayDetail}
              bookingSlotSecondaryLabel={bookingSlotSecondaryLabel}
              renderBookingSlotActions={renderBookingSlotActions}
              deleteSlot={deleteSlot}
              releaseManualHold={releaseManualHold}
            />,
            document.body
          )}

        <PlatformTour
          phase={platformTourPhase}
          step={platformTourStep}
          steps={platformTourSteps}
          onStart={startPlatformTour}
          onSkip={finishPlatformTour}
          onFinish={finishPlatformTour}
          onNext={() => setPlatformTourStep((s) => Math.min(s + 1, platformTourSteps.length - 1))}
          onBack={() => setPlatformTourStep((s) => Math.max(0, s - 1))}
          onPrepareStep={preparePlatformTourStep}
        />
      </div>
      </CabinetChrome>
      </CabinetErrorBoundary>
    </div>
  );
}
