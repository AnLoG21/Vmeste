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
import { buildServiceDraftFromService, serviceDraftEqualsService } from "./ServiceEditor.jsx";
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
  composePipeTailFromDetails,
  parseAddressDetailsPipeTail,
  emptyLocationFormState,
} from "./orgBranchUtils.js";
import {
  NOMINATIM_HEADERS,
  simplifyCommaAddressLine,
  mapPhotonFeatureToSuggestion,
  getCity,
  buildShortAddress,
  mergeStructuredOrgPartsFromMe,
} from "./addressFormat.js";
import {
  CHAT_PINS_STORAGE_KEY,
  MAX_PINNED_CHATS,
  formatLastSeenLabel,
  formatStaffFullName,
  conversationOrgDirectPeerTitle,
  conversationClientCorrespondenceTitle,
  defaultChatListNameForConversation,
  loadChatPinsFromStorage,
  reviewImageUrl,
  chatMessagePlainText,
} from "./chatHelpers.jsx";
import {
  bookingSlotStatusModifier,
  bookingSlotCompactIcon,
  formatInAppNotificationText,
  formatBookingPrice,
  reviewIsSupplemented,
  formatBookingDateTime,
  formatBookingDateTimeParts,
} from "./bookingDisplay.jsx";
import {
  reverseGeocodeByCoords,
  federalCityFromReverse,
  nominatimSearchRU,
  photonSuggestSearch,
  buildNominatimQuery,
  yandexGeocodeSuggestItems,
  yandexMapsNativeSuggestItems,
} from "./addressGeocode.js";
import {
  todayIsoDate,
  currentLocalMonthKey,
  isoMonthKey,
  normalizeBookingsList,
  normalizeSlotsList,
  mergeBookingsWithManualHolds,
  formatApiError,
  normalizeReviewsList,
  StarRating,
  clientWindowKey,
  parseIntervalAssignee,
  intervalAssigneeValue,
  intervalStaffConflicts,
} from "./bookingCalendarUtils.jsx";
import SalonLoyaltyPackagesPanel from "./SalonLoyaltyPackagesPanel.jsx";
import PlatformTour from "./PlatformTour.jsx";import {
  buildPlatformTourSteps,
  readPlatformTourDone,
  writePlatformTourDone,
} from "./platformTour.js";
import {
  BOOKMARK_CATALOG,
  SUBNAV_BOOKMARKS_KEY,
  loadSubnavBookmarks,
} from "./subnavBookmarks.js";
import {
  orgSphereOf,
} from "./staffPermissions.js";
import { getDevicePosition } from "./geoPosition.js";
import "./landing.css";
import {
  ORG_GALLERY_MAX_PHOTOS,
  buildYmapOrgPlacemark,
  resetOrgPinLayoutClass,
  defaultOrgWorkingHours,
  formatOrgWorkingHoursText,
  filterServiceGroupsFromCatalog,
  matchProviderServiceByFilter,
  normalizeOrgWorkingHours,
  uniqueDiscoverOrgs,
} from "./clientOrgFeatures.js";
import { loadYandexMaps } from "./yandexMapsLoader.js";
import { API_URL, AUTH_URL, BASE_URL, REFRESH_URL } from "./config.js";
import { createAuthFetch } from "./authFetch.js";
import { SITE_LEGAL } from "./legal/siteLegal.js";
import {
  blobToFile,
  groupChatMedia,
  guessAttachAccept,
  loadChatComposeMode,
  pickRecorderMime,
  resolveAttachmentUrl,
  saveChatComposeMode,
} from "./chatMedia.js";
import {
  initPushNotifications,
  maybeRequestWebNotificationPermission,
  resetPushRegistration,
  showLocalBrowserNotification,
} from "./pushNotifications.js";
import { ensurePhonePlus7 } from "./phone.js";
import { showToast } from "./toast.js";
import { navigateView, viewFromPath } from "./viewRoutes.js";
import { setNoIndexAppMeta, setPageMeta } from "./seo/setPageMeta.js";

function savedIntervalsStorageKey(providerId) {
  if (!providerId) return null;
  return `vmeste_saved_intervals_v2_${providerId}`;
}

const chatPrefsStorageKey = (id) => `vmeste_chat_prefs_v1_${id}`;
const APP_THEME_KEY = "vmeste_theme_v1";
const CHAT_RECEIPTS_KEY = "vmeste_chat_receipts_v1";

const chatNotifyStorageKey = (id) => `vmeste_chat_notify_v1_${id}`;

function loadReceiptsPref() {
  try {
    const raw = localStorage.getItem(CHAT_RECEIPTS_KEY);
    const p = raw ? JSON.parse(raw) : {};
    return p.mode === "classic" ? "classic" : "stickers";
  } catch {
    return "stickers";
  }
}

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

const CHAT_MSG_PAGE_SIZE = 50;

function isMobileChatLayout() {
  if (typeof window === "undefined") return false;
  if (document.documentElement.classList.contains("native-app")) return true;
  return window.matchMedia("(max-width: 900px)").matches;
}

function detectCameraFacingFromTrack(track, deviceLabel = "") {
  const settings = track?.getSettings?.() || {};
  if (settings.facingMode === "user" || settings.facingMode === "environment") {
    return settings.facingMode;
  }
  const label = `${deviceLabel || ""} ${track?.label || ""}`.toLowerCase();
  if (/back|rear|environment|задн|тыл|world/.test(label)) return "environment";
  if (/front|user|face|перед|фронт|selfie/.test(label)) return "user";
  return null;
}

async function pickOtherVideoDevice(currentDeviceId, wantFacing) {
  if (!navigator.mediaDevices?.enumerateDevices) return null;
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cams = devices.filter((d) => d.kind === "videoinput" && d.deviceId);
  if (cams.length < 2) return null;
  const others = cams.filter((d) => d.deviceId !== currentDeviceId);
  if (!others.length) return null;
  const byFacing = others.find((d) => detectCameraFacingFromTrack(null, d.label) === wantFacing);
  if (byFacing) return byFacing;
  // Round-robin to next camera in the list
  const idx = Math.max(
    0,
    cams.findIndex((d) => d.deviceId === currentDeviceId)
  );
  return cams[(idx + 1) % cams.length] || others[0];
}

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
  const [cabinetLoadError, setCabinetLoadError] = useState("");
  const [clientStatus, setClientStatus] = useState("");
  const [pendingInspectionId, setPendingInspectionId] = useState(null);
  const [verifyStatus, setVerifyStatus] = useState("");
  const [resendStatus, setResendStatus] = useState("");
  const [verifyEmailNotice, setVerifyEmailNotice] = useState(null);
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [detectedCity, setDetectedCity] = useState("");

  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [slots, setSlots] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [location, setLocation] = useState([]);
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
  const mapOrgCarouselTouchX = useRef(null);
  const [mapOrgPopup, setMapOrgPopup] = useState(null);
  const [mapOrgSheetCollapsed, setMapOrgSheetCollapsed] = useState(false);
  const [mapOrgSummary, setMapOrgSummary] = useState(null);
  const [mapOrgReviewsOpen, setMapOrgReviewsOpen] = useState(false);
  const [mapOrgReviews, setMapOrgReviews] = useState([]);
  const [mapOrgReviewsOrdering, setMapOrgReviewsOrdering] = useState("-created_at");
  const [mapOrgProfile, setMapOrgProfile] = useState(null);
  const [mapOrgStaff, setMapOrgStaff] = useState([]);
  const [mapOrgCarouselIndex, setMapOrgCarouselIndex] = useState(0);
  const [mapMarkersTick, setMapMarkersTick] = useState(0);
  const [orgPhotoLightbox, setOrgPhotoLightbox] = useState(null);
  const [staffReviewModal, setStaffReviewModal] = useState(null);

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
  const mapOrgSheetTouchY = useRef(null);

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

  const [orgProfileForm, setOrgProfileForm] = useState({
    working_hours: defaultOrgWorkingHours(),
    phones: [""],
    websites: [""],
    card_note: "",
  });
  const [orgGalleryPhotos, setOrgGalleryPhotos] = useState([]);
  const [orgProfileSaveStatus, setOrgProfileSaveStatus] = useState("");
  const [orgBookingMessages, setOrgBookingMessages] = useState({ confirm: "", cancel: "", done: "" });
  const [orgAcquiringForm, setOrgAcquiringForm] = useState({
    payment_provider: "yookassa",
    prepay_mode: "off",
    prepay_percent: 50,
    yookassa_shop_id: "",
    yookassa_secret_key: "",
    has_yookassa: false,
    tbank_terminal_key: "",
    tbank_password: "",
    has_tbank: false,
    cloudpayments_public_id: "",
    cloudpayments_api_secret: "",
    has_cloudpayments: false,
    robokassa_merchant_login: "",
    robokassa_password1: "",
    robokassa_password2: "",
    has_robokassa: false,
    has_payment_keys: false,
  });
  const [orgAcquiringSaveStatus, setOrgAcquiringSaveStatus] = useState("");
  const [orgCalendarLinks, setOrgCalendarLinks] = useState(null);
  const [orgCalendarStatus, setOrgCalendarStatus] = useState("");
  const [orgMessagingForm, setOrgMessagingForm] = useState({
    remind_clients: true,
    remind_org: true,
    notify_org_on_new: true,
    winback_enabled: false,
    winback_weeks: 4,
    winback_template: "",
    enable_telegram: false,
    enable_max: false,
    enable_whatsapp: false,
    enable_sms: false,
    telegram_bot_token: "",
    telegram_notify_chat_id: "",
    has_telegram: false,
    has_platform_telegram: false,
    has_org_telegram_token: false,
    max_bot_token: "",
    max_notify_chat_id: "",
    has_max: false,
    wa_api_url: "https://api.green-api.com",
    wa_id_instance: "",
    wa_api_token: "",
    has_whatsapp: false,
    sms_api_id: "",
    has_sms_org: false,
    new_booking_template: "",
  });
  const [orgMessagingSaveStatus, setOrgMessagingSaveStatus] = useState("");
  const [clientNotifyForm, setClientNotifyForm] = useState({
    notify_booking_reminders: true,
    notify_booking_status: true,
  });
  const [clientNotifyStatus, setClientNotifyStatus] = useState("");
  const [telegramLinkInfo, setTelegramLinkInfo] = useState(null);
  const [orgTelegramLinkInfo, setOrgTelegramLinkInfo] = useState(null);
  const [orgSettingsHighlight, setOrgSettingsHighlight] = useState("");
  const [bookingMessageError, setBookingMessageError] = useState(null);
  const [reviewModalBooking, setReviewModalBooking] = useState(null);
  const [reviewModalReview, setReviewModalReview] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, staff_rating: 5, text: "", staff_text: "" });
  const [reviewSubmitError, setReviewSubmitError] = useState("");
  const [providerReviews, setProviderReviews] = useState([]);
  const [providerReviewsOrdering, setProviderReviewsOrdering] = useState("-created_at");
  const [missedReviewsCount, setMissedReviewsCount] = useState(0);
  const [myReviews, setMyReviews] = useState([]);
  const [reviewReplyOpenId, setReviewReplyOpenId] = useState(null);
  const [reviewReplyForms, setReviewReplyForms] = useState({});
  const [reviewReplyFormError, setReviewReplyFormError] = useState("");
  const clientDiscoverMapRef = useRef(null);
  const clientDiscoverMapClickBoundRef = useRef(false);
  const clientDiscoverMapZoomTimerRef = useRef(null);
  const clientMyLocationPlacemarkRef = useRef(null);
  const clientMyLocationCoordsRef = useRef(null);
  const clientMyLocationWatchIdRef = useRef(null);
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
  const [mapOrgPackages, setMapOrgPackages] = useState([]);
  const [bookClientPackages, setBookClientPackages] = useState([]);

  const [categoryOpen, setCategoryOpen] = useState({});
  const [subcategoryOpen, setSubcategoryOpen] = useState({});
  const [catalogStatus, setCatalogStatus] = useState(null);
  const [catalogSeeding, setCatalogSeeding] = useState(false);
  const [slotForm, setSlotForm] = useState({ starts_at: "", ends_at: "" });
  const [intervalForm, setIntervalForm] = useState({
    date: "",
    start_time: "09:00",
    end_time: "18:00",
    repeat_type: "none",
    repeat_count: "1",
    assignee: "",
    service_ids: [],
  });
  const [intervalEditModal, setIntervalEditModal] = useState(null);
  const [manualHoldForm, setManualHoldForm] = useState(() => ({
    date: todayIsoDate(),
    start_time: "10:00",
    end_time: "11:00",
    guest_name: "",
  }));
  const [manualHoldStatus, setManualHoldStatus] = useState("");
  const [manualHoldBusy, setManualHoldBusy] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date().toISOString().slice(0, 7));
  const [bookingsMonth, setBookingsMonth] = useState(() => currentLocalMonthKey());

  const [intervalToast, setIntervalToast] = useState(null);
  const intervalToastTimerRef = useRef(null);
  const [savedIntervals, setSavedIntervals] = useState([]);
  const [serviceDrafts, setServiceDrafts] = useState({});
  const [serviceSavingAll, setServiceSavingAll] = useState(false);
  const [selectedIntervalId, setSelectedIntervalId] = useState(null);
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

  const [orgStaff, setOrgStaff] = useState([]);
  const [staffInviteForm, setStaffInviteForm] = useState({ invite_identifier: "" });
  const [staffInviteStatus, setStaffInviteStatus] = useState("");
  const [staffPermsOpenId, setStaffPermsOpenId] = useState(null);
  const [staffServicesOpenId, setStaffServicesOpenId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [vmenuChatContacts, setVmenuChatContacts] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [vmenuTab, setVmenuTab] = useState("feed");
  const [vmenuChatsHostEl, setVmenuChatsHostEl] = useState(null);
  const [mainChatsHostEl, setMainChatsHostEl] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatHasMoreOlder, setChatHasMoreOlder] = useState(false);
  const [chatLoadingOlder, setChatLoadingOlder] = useState(false);
  const [chatShowJumpBottom, setChatShowJumpBottom] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatStatus, setChatStatus] = useState("");
  /** id чата для модалки оформления (открывается из ⋮ в списке, без смены выбранного чата). */
  const [chatSettingsForId, setChatSettingsForId] = useState(null);
  const [chatRowMenuId, setChatRowMenuId] = useState(null);
  const [chatReceiptsSettingsOpen, setChatReceiptsSettingsOpen] = useState(false);
  const [chatPins, setChatPins] = useState(() => loadChatPinsFromStorage());
  const [chatDragPinConvId, setChatDragPinConvId] = useState(null);
  const [chatAttachMenuOpen, setChatAttachMenuOpen] = useState(false);
  const [chatMsgSearchOpen, setChatMsgSearchOpen] = useState(false);
  const [chatMsgSearchQuery, setChatMsgSearchQuery] = useState("");
  const [chatMsgSearchActiveIdx, setChatMsgSearchActiveIdx] = useState(0);
  const [chatInfoOpen, setChatInfoOpen] = useState(false);
  const [chatInfoTab, setChatInfoTab] = useState("photos");
  const [chatMembersView, setChatMembersView] = useState(null); // null | "list" | "add"
  const [groupAddStaffIds, setGroupAddStaffIds] = useState([]);
  const [groupAddStatus, setGroupAddStatus] = useState("");
  const [subnavBookmarks, setSubnavBookmarks] = useState(() =>
    loadSubnavBookmarks(localStorage.getItem("vmeste_role_hint") || "client")
  );
  const [chatInfoHeadMenuOpen, setChatInfoHeadMenuOpen] = useState(false);
  const [chatInfoPhotoMenuId, setChatInfoPhotoMenuId] = useState(null);
  const [chatComposeMode, setChatComposeMode] = useState(() => loadChatComposeMode());
  const [chatPendingFiles, setChatPendingFiles] = useState([]);
  const [chatPendingKind, setChatPendingKind] = useState("");
  const [chatRecordingKind, setChatRecordingKind] = useState(null);
  const [chatRecordLocked, setChatRecordLocked] = useState(false);
  const [chatRecordLiftHint, setChatRecordLiftHint] = useState(false);
  const [chatRecordSecs, setChatRecordSecs] = useState(0);
  const [chatRecordLevels, setChatRecordLevels] = useState(() => Array(24).fill(0.12));
  const [chatMediaPreview, setChatMediaPreview] = useState(null);
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
  const chatMediaRecorderRef = useRef(null);
  const chatRecordChunksRef = useRef([]);
  const chatRecordStreamRef = useRef(null);
  const chatRecordStartedAtRef = useRef(0);
  const chatHoldTimerRef = useRef(null);
  const chatDidHoldRef = useRef(false);
  const chatPointerStartYRef = useRef(0);
  const chatRecordLiftHintRef = useRef(false);
  const chatRecordLockedRef = useRef(false);
  const chatRecordTickRef = useRef(null);
  const chatAudioCtxRef = useRef(null);
  const chatAnalyserRef = useRef(null);
  const chatLevelRafRef = useRef(null);
  const chatLiveVideoRef = useRef(null);
  const chatPreviewMediaRef = useRef(null);
  const chatRecordMimeRef = useRef("audio/webm");
  const chatRecordKindRef = useRef(null);
  const chatCameraFacingRef = useRef("user");
  const chatKeepRecordingRef = useRef(false);
  const chatCameraStreamRef = useRef(null);
  const chatMirrorPipelineRef = useRef(null);
  const [chatCameraFacing, setChatCameraFacing] = useState("user");
  const [chatCameraSwitching, setChatCameraSwitching] = useState(false);
  const [chatSettingsTitle, setChatSettingsTitle] = useState("");
  const [groupForm, setGroupForm] = useState({ title: "", staff_ids: [] });
  const [chatFabOpen, setChatFabOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ first_name: "", last_name: "", patronymic: "", phone: "" });
  const [passwordForm, setPasswordForm] = useState({ old_password: "", new_password: "", new_password_confirm: "" });
  const [emailForm, setEmailForm] = useState({ new_email: "" });
  const [locationForm, setLocationForm] = useState({
    title: "",
    address: "",
    latitude: "55.751244",
    longitude: "37.618423",
    entrance: "",
    floor: "",
    apartment: "",
    intercom: "",
    address_details: "",
  });
  const mapRef = useRef(null);
  const placemarkRef = useRef(null);
  const profileMapRef = useRef(null);
  const profilePlacemarkRef = useRef(null);
  const suggestTimerRef = useRef(null);
  const suggestRequestSeqRef = useRef(0);
  const geoCityPromiseRef = useRef(null);
  const geoCityDeniedRef = useRef(false);
  const [orgAddressForm, setOrgAddressForm] = useState({
    organization_name: "",
    organization_address: "",
    organization_address_details: "",
    entrance: "",
    floor: "",
    apartment: "",
    intercom: "",
    organization_latitude: "55.751244",
    organization_longitude: "37.618423",
  });
  const [profileOrgStatus, setProfileOrgStatus] = useState("");
  const [deleteAccountForm, setDeleteAccountForm] = useState({ password: "", confirm: "" });
  const [deleteAccountStatus, setDeleteAccountStatus] = useState("");
  const [deleteAccountBusy, setDeleteAccountBusy] = useState(false);
  const [branchGeoStatus, setBranchGeoStatus] = useState("");
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
  const [chatLocalPrefs, setChatLocalPrefs] = useState({});
  const [chatSettingsAvatar, setChatSettingsAvatar] = useState("");
  const [chatSettingsWallpaper, setChatSettingsWallpaper] = useState("#e8f4ea");
  const [appTheme, setAppTheme] = useState(() => localStorage.getItem(APP_THEME_KEY) || "light");
  const [chatFolder, setChatFolder] = useState("org");
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [customColorPickerOpen, setCustomColorPickerOpen] = useState(false);
  const [chatSettingsNotify, setChatSettingsNotify] = useState("all");
  const [chatSettingsMuteUntil, setChatSettingsMuteUntil] = useState("");
  const [incomingToasts, setIncomingToasts] = useState([]);
  const [chatActivity, setChatActivity] = useState(null);
  const lastNotificationToastIdRef = useRef(null);
  const [chatReceiptsMode, setChatReceiptsMode] = useState(() => loadReceiptsPref());
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
    if (!me) return;
    setOrgBookingMessages({
      confirm: me.booking_confirm_message_default || "",
      cancel: me.booking_cancel_message_default || "",
      done: me.booking_done_message_default || "",
    });
  }, [me?.booking_confirm_message_default, me?.booking_cancel_message_default, me?.booking_done_message_default]);

  useEffect(() => {
    if (!me || me.role !== "provider") return;
    const phones = Array.isArray(me.organization_phones) ? me.organization_phones.filter(Boolean) : [];
    const websites = Array.isArray(me.organization_websites) ? me.organization_websites.filter(Boolean) : [];
    setOrgProfileForm({
      working_hours: normalizeOrgWorkingHours(me.organization_working_hours),
      phones: phones.length ? phones : [""],
      websites: websites.length ? websites : [""],
      card_note: me.organization_card_note || "",
    });
  }, [
    me?.id,
    me?.role,
    me?.organization_working_hours,
    me?.organization_phones,
    me?.organization_websites,
    me?.organization_card_note,
  ]);

  useEffect(() => {
    if (me?.role !== "provider" || currentView !== "organization") return;
    (async () => {
      const res = await authFetch(`${API_URL}/users/gallery/`);
      if (res.ok) {
        const data = await res.json();
        setOrgGalleryPhotos(Array.isArray(data) ? data : data.photos || []);
      }
      const acqRes = await authFetch(`${API_URL}/booking/acquiring/`);
      if (acqRes.ok) {
        const acq = await acqRes.json();
        setOrgAcquiringForm({
          payment_provider: acq.payment_provider || "yookassa",
          prepay_mode: acq.prepay_mode || "off",
          prepay_percent: acq.prepay_percent || 50,
          yookassa_shop_id: acq.yookassa_shop_id || "",
          yookassa_secret_key: "",
          has_yookassa: Boolean(acq.has_yookassa),
          tbank_terminal_key: acq.tbank_terminal_key || "",
          tbank_password: "",
          has_tbank: Boolean(acq.has_tbank),
          cloudpayments_public_id: acq.cloudpayments_public_id || "",
          cloudpayments_api_secret: "",
          has_cloudpayments: Boolean(acq.has_cloudpayments),
          robokassa_merchant_login: acq.robokassa_merchant_login || "",
          robokassa_password1: "",
          robokassa_password2: "",
          has_robokassa: Boolean(acq.has_robokassa),
          has_payment_keys: Boolean(acq.has_payment_keys),
        });
      }
      const calRes = await authFetch(`${API_URL}/booking/calendar/settings/`);
      if (calRes.ok) setOrgCalendarLinks(await calRes.json());
      const msgRes = await authFetch(`${API_URL}/booking/messaging/`);
      if (msgRes.ok) {
        const m = await msgRes.json();
        setOrgMessagingForm((p) => ({
          ...p,
          ...m,
          telegram_bot_token: "",
          max_bot_token: "",
          wa_api_token: "",
          sms_api_id: "",
        }));
      }
    })();
  }, [accessToken, me?.role, currentView]);

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

  function showIntervalToast(message) {
    if (intervalToastTimerRef.current) clearTimeout(intervalToastTimerRef.current);
    setIntervalToast(message);
    intervalToastTimerRef.current = setTimeout(() => {
      setIntervalToast(null);
      intervalToastTimerRef.current = null;
    }, 4200);
  }

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

  function openAuth(mode) {
    destroyRegMap();
    setAuthMode(mode);
    setShowAuthModal(true);
    setRegisterStep(1);
    // Не тащим «Для бизнеса» во вход/клиентскую регистрацию — иначе OAuth создаёт исполнителя.
    setForm({ ...emptyRegisterForm });
    if (mode === "register") {
      setVerifyEmailNotice(null);
      setResendStatus("");
    }
    fetch(`${API_URL}/users/auth/providers/`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setAuthProviders(data);
      })
      .catch(() => showToast("Не удалось загрузить способы входа.", { tone: "error" }));
  }

  function closeAuth() {
    destroyRegMap();
    setShowAuthModal(false);
    setVerifyEmailNotice(null);
    setResendStatus("");
    if (authMode === "reset") {
      setPasswordResetToken("");
      setResetForm({ new_password: "", new_password_confirm: "" });
    }
  }

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
        if (loc) void openOrgOnMap(loc);
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
    if (!accessToken || !canViewOrgReviews()) return;
    loadMissedReviewsCount();
    const id = setInterval(loadMissedReviewsCount, 12000);
    return () => clearInterval(id);
  }, [accessToken, me?.role, me?.id]);

  useEffect(() => {
    if (!accessToken) return;
    const ping = () => authFetch(`${API_URL}/users/presence/ping/`, { method: "POST", body: "{}" });
    ping();
    const id = setInterval(ping, 35000);
    return () => clearInterval(id);
  }, [accessToken]);

  useEffect(() => {
    if (accessToken && me?.role === "provider") loadSellerData();
  }, [accessToken, me]);

  useEffect(() => {
    if (!accessToken || (currentView !== "organization" && currentView !== "staff")) return;
    if (me?.role === "provider") loadSellerData();
    else if (me?.role === "staff" && staffEffectivePerms.can_delegate_permissions) loadStaffWorkspace();
  }, [accessToken, currentView, me?.role, staffEffectivePerms.can_delegate_permissions]);

  useEffect(() => {
    if (accessToken && me?.role === "staff") loadStaffWorkspace();
  }, [accessToken, me]);

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
    chatMessagesRef.current = chatMessages;
  }, [chatMessages]);

  useEffect(() => {
    if (chatRecordingKind !== "video_note") return undefined;
    attachLiveCameraPreview();
    const t1 = window.setTimeout(attachLiveCameraPreview, 50);
    const t2 = window.setTimeout(attachLiveCameraPreview, 250);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [chatRecordingKind, chatCameraFacing]);

  useEffect(() => {
    chatHasMoreOlderRef.current = chatHasMoreOlder;
  }, [chatHasMoreOlder]);

  useEffect(() => {
    if (!accessToken || !selectedChatId || !chatsSurfaceActive) return;
    let cancelled = false;
    setChatMessages([]);
    setChatHasMoreOlder(false);
    setChatShowJumpBottom(false);
    chatNearBottomRef.current = true;

    async function loadLatest() {
      const msgs = await fetchChatMessagesPage(selectedChatId, { limit: CHAT_MSG_PAGE_SIZE });
      if (cancelled || !msgs) return;
      setChatMessages(msgs);
      setChatHasMoreOlder(msgs.length >= CHAT_MSG_PAGE_SIZE);
      requestAnimationFrame(() => scrollChatToBottom(false));
      const last = msgs.length ? msgs[msgs.length - 1] : null;
      if (last) {
        await authFetch(`${API_URL}/chat/conversations/${selectedChatId}/mark-read/`, {
          method: "POST",
          body: JSON.stringify({ message_id: last.id }),
        });
        loadChats();
      }
    }

    async function pollNewer() {
      const current = chatMessagesRef.current;
      const lastId = current.length ? current[current.length - 1].id : null;
      if (!lastId) {
        await loadLatest();
        return;
      }
      const newer = await fetchChatMessagesPage(selectedChatId, {
        afterId: lastId,
        limit: CHAT_MSG_PAGE_SIZE,
      });
      if (cancelled || !newer?.length) return;
      setChatMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const add = newer.filter((m) => !seen.has(m.id));
        return add.length ? [...prev, ...add] : prev;
      });
      if (chatNearBottomRef.current) {
        requestAnimationFrame(() => scrollChatToBottom(true));
      } else {
        setChatShowJumpBottom(true);
      }
      const last = newer[newer.length - 1];
      if (last) {
        await authFetch(`${API_URL}/chat/conversations/${selectedChatId}/mark-read/`, {
          method: "POST",
          body: JSON.stringify({ message_id: last.id }),
        });
        loadChats();
      }
    }

    loadLatest();
    const id = setInterval(pollNewer, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [accessToken, selectedChatId, chatsSurfaceActive]);

  useEffect(() => {
    if (!me) return;
    setProfileForm({
      first_name: me.first_name || "",
      last_name: me.last_name || "",
      patronymic: me.patronymic || "",
      phone: ensurePhonePlus7(me.phone || "+7"),
    });
    setEmailForm({ new_email: me.email || "" });
  }, [me]);

  function syncOrgAddressFormFromMe() {
    if (!me || me.role !== "provider") return;
    const merged = mergeStructuredOrgPartsFromMe(me);
    const hasApiStructured =
      String(me.organization_entrance || "").trim() ||
      String(me.organization_floor || "").trim() ||
      String(me.organization_apartment || "").trim() ||
      String(me.organization_intercom || "").trim() ||
      String(me.organization_address_extra || "").trim();

    const raw = me.organization_address || "";
    const sep = " | ";
    const splitIdx = raw.indexOf(sep);
    const baseFromRaw = splitIdx >= 0 ? raw.slice(0, splitIdx).trim() : raw.trim();
    const tailFromRaw = splitIdx >= 0 ? raw.slice(splitIdx + sep.length).trim() : "";

    if (hasApiStructured) {
      const addrSource = splitIdx >= 0 ? baseFromRaw : String(me.organization_address || "").trim();
      setOrgAddressForm((prev) => ({
        ...prev,
        organization_name: me.organization_name || "",
        organization_address: simplifyCommaAddressLine(addrSource) || addrSource || prev.organization_address,
        entrance: merged.entrance,
        floor: merged.floor,
        apartment: merged.apartment,
        intercom: merged.intercom,
        organization_address_details: merged.extra,
        organization_latitude: String(me.organization_latitude ?? prev.organization_latitude ?? "55.751244"),
        organization_longitude: String(me.organization_longitude ?? prev.organization_longitude ?? "37.618423"),
      }));
      return;
    }

    const parsed = parseAddressDetailsPipeTail(tailFromRaw);
    setOrgAddressForm((prev) => ({
      ...prev,
      organization_name: me.organization_name || "",
      organization_address: simplifyCommaAddressLine(baseFromRaw) || baseFromRaw || prev.organization_address,
      entrance: parsed.entrance,
      floor: parsed.floor,
      apartment: parsed.apartment,
      intercom: parsed.intercom,
      organization_address_details: parsed.extraDetails,
      organization_latitude: String(me.organization_latitude ?? prev.organization_latitude ?? "55.751244"),
      organization_longitude: String(me.organization_longitude ?? prev.organization_longitude ?? "37.618423"),
    }));
  }

  useEffect(() => {
    if (orgMainEditOpen) return;
    syncOrgAddressFormFromMe();
  }, [
    orgMainEditOpen,
    me?.id,
    me?.role,
    me?.organization_address,
    me?.organization_name,
    me?.organization_latitude,
    me?.organization_longitude,
    me?.organization_entrance,
    me?.organization_floor,
    me?.organization_apartment,
    me?.organization_intercom,
    me?.organization_address_extra,
  ]);

  useEffect(() => {
    if (!chatsSurfaceActive || !conversations.length) return;
    lastConvMsgDigestRef.current = conversations.reduce((acc, c) => {
      acc[c.id] = c.last_message?.id ?? null;
      return acc;
    }, {});
    digestPrimedRef.current = true;
  }, [chatsSurfaceActive, conversations]);

  useEffect(() => {
    const next = {};
    for (const c of conversations) {
      try {
        const raw = localStorage.getItem(chatPrefsStorageKey(c.id));
        if (raw) next[c.id] = JSON.parse(raw);
      } catch {
        // ignore
      }
    }
    setChatLocalPrefs(next);
  }, [conversations]);

  useEffect(() => {
    if (chatSettingsForId == null) return;
    const p = chatLocalPrefs[chatSettingsForId] || {};
    const sel = conversations.find((x) => x.id === chatSettingsForId);
    const fallback = defaultChatListNameForConversation(sel, me?.id);
    setChatSettingsTitle(p.title || fallback);
    setChatSettingsAvatar(p.avatarDataUrl || "");
    setChatSettingsWallpaper(p.wallpaper || "#dfe9e2");
    let notify = "all";
    try {
      const raw = localStorage.getItem(chatNotifyStorageKey(chatSettingsForId));
      const st = raw ? JSON.parse(raw) : {};
      if (st.muted) notify = "off";
      else if (st.mutedUntil && Date.now() < Number(st.mutedUntil)) notify = "1h";
    } catch {
      // ignore
    }
    setChatSettingsNotify(notify);
    // Только при смене чата: иначе polling conversations / chatLocalPrefs сбрасывает ввод в поле «Имя».
  }, [chatSettingsForId]);

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_PINS_STORAGE_KEY, JSON.stringify(chatPins));
    } catch {
      // ignore
    }
  }, [chatPins]);

  useEffect(() => {
    if (!conversations.length) return;
    const ids = new Set(conversations.map((c) => Number(c.id)));
    setChatPins((prev) => {
      const org = (prev.org || []).filter((id) => ids.has(Number(id)));
      const clients = (prev.clients || []).filter((id) => ids.has(Number(id)));
      if (org.length === (prev.org || []).length && clients.length === (prev.clients || []).length) return prev;
      return { org, clients };
    });
  }, [conversations]);

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
    if (!customColorPickerOpen) return;
    function onDocMouseDown(e) {
      if (e.target.closest(".tg-color-popover") || e.target.closest(".tg-color-picker-toggle")) return;
      setCustomColorPickerOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown, true);
    return () => document.removeEventListener("mousedown", onDocMouseDown, true);
  }, [customColorPickerOpen]);

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
    if (!accessToken || me?.role !== "client") return;
    loadMyReviews();
  }, [accessToken, me?.role, me?.id]);

  useEffect(() => {
    if (!accessToken || currentView !== "reviews" || !canViewOrgReviews()) return;
    loadProviderReviewsList(providerReviewsOrdering);
    markReviewsSeen();
  }, [accessToken, currentView, me?.role, providerReviewsOrdering, staffEffectivePerms]);

  useEffect(() => {
    if (!accessToken || currentView !== "services" || me?.role !== "provider") return;
    loadCatalogStatus();
  }, [accessToken, currentView, me?.role, me?.provider_sphere]);

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
    if (me?.role === "client") loadMyReviews();
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
    if (chatRowMenuId == null) return undefined;
    function onDoc(e) {
      if (e.target?.closest?.(".tg-chat-row-menu-wrap")) return;
      setChatRowMenuId(null);
    }
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, [chatRowMenuId]);

  useEffect(() => {
    const map = clientDiscoverMapRef.current;
    if (!map || currentView !== "client_map" || (me?.role !== "client" && me?.role !== "provider")) return;
    const lockMap = Boolean(clientBookModalOpen || clientFiltersOpen);
    try {
      if (lockMap) {
        map.behaviors.disable(["drag", "scrollZoom", "dblClickZoom", "multiTouch"]);
      } else {
        map.behaviors.enable(["drag", "scrollZoom", "dblClickZoom", "multiTouch"]);
      }
    } catch {
      // ignore
    }
  }, [clientBookModalOpen, clientFiltersOpen, currentView, me?.role]);

  useEffect(() => {
    if (currentView !== "client_map" || (me?.role !== "client" && me?.role !== "provider")) return undefined;
    if (mapOrgPopup) {
      window.setTimeout(fitClientDiscoverMapViewport, 0);
      window.setTimeout(fitClientDiscoverMapViewport, 200);
    } else {
      window.setTimeout(fitClientDiscoverMapViewport, 0);
    }
    return undefined;
  }, [mapOrgPopup, mapOrgReviewsOpen, currentView, me?.role]);

  useEffect(() => {
    if (currentView !== "client_map" || (me?.role !== "client" && me?.role !== "provider")) {
      destroyClientDiscoverMap();
      return undefined;
    }
    const t = setTimeout(() => {
      void loadYandexMaps()
        .then(() => {
          const ymaps = window.ymaps;
          if (!ymaps || clientDiscoverMapRef.current) return;
          if (!document.getElementById("client-discover-map")) return;
          ymaps.ready(() => {
            if (clientDiscoverMapRef.current) return;
            const cityKey = (new URLSearchParams(window.location.search).get("city") || "").toLowerCase();
            const cityCenters = {
              moscow: { center: [55.751244, 37.618423], zoom: 11, name: "Москва" },
              spb: { center: [59.9342802, 30.3350986], zoom: 11, name: "Санкт-Петербург" },
            };
            const city = cityCenters[cityKey];
            if (city?.name) setDetectedCity(city.name);
            const map = new ymaps.Map("client-discover-map", {
              center: city ? city.center : [55.751244, 37.618423],
              zoom: city ? city.zoom : 10,
              controls: ["zoomControl", "fullscreenControl", "geolocationControl"],
            });
            clientDiscoverMapRef.current = map;
            if (!map._vmesteZoomBound) {
              map._vmesteZoomBound = true;
              map.events.add("boundschange", () => {
                if (clientDiscoverMapZoomTimerRef.current) {
                  window.clearTimeout(clientDiscoverMapZoomTimerRef.current);
                }
                clientDiscoverMapZoomTimerRef.current = window.setTimeout(() => {
                  if (clientDiscoverMapRef.current) {
                    paintClientDiscoverMapMarkers(allLocationsRef.current, { fitView: false });
                  }
                }, 160);
              });
            }
            paintClientDiscoverMapMarkers(allLocationsRef.current, { fitView: !city });
            if (city) {
              try {
                map.setCenter(city.center, city.zoom);
              } catch {
                /* ignore */
              }
            }
            startClientMyLocationTracking();
          });
        })
        .catch(() => showToast("Не удалось загрузить карту.", { tone: "error" }));
    }, 280);
    return () => {
      clearTimeout(t);
      destroyClientDiscoverMap();
    };
  }, [currentView, me?.role]);

  useEffect(() => {
    if (currentView !== "client_map" || (me?.role !== "client" && me?.role !== "provider")) return undefined;
    const id = window.setInterval(() => setMapMarkersTick((t) => t + 1), 60000);
    return () => window.clearInterval(id);
  }, [currentView, me?.role]);

  useEffect(() => {
    if (currentView !== "client_map" || (me?.role !== "client" && me?.role !== "provider") || !clientDiscoverMapRef.current) return;
    paintClientDiscoverMapMarkers(allLocations, { fitView: true });
  }, [allLocations, currentView, me?.role]);

  useEffect(() => {
    if (currentView !== "client_map" || (me?.role !== "client" && me?.role !== "provider") || !clientDiscoverMapRef.current) return;
    paintClientDiscoverMapMarkers(allLocations, { fitView: false });
  }, [mapMarkersTick, currentView, me?.role]);

  useEffect(() => {
    if (currentView !== "client_map" || (me?.role !== "client" && me?.role !== "provider") || !clientDiscoverMapRef.current) return;
    paintClientDiscoverMapMarkers(allLocations, {
      fitView: false,
      selectedId: mapOrgPopup?.id ?? null,
    });
  }, [mapOrgPopup?.id, currentView, me?.role]);

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
    setSubnavBookmarks(loadSubnavBookmarks(me.role, sphere));
  }, [me?.role, me?.provider_sphere, me?.employer_sphere]);

  useEffect(() => {
    if (!me?.role) return;
    try {
      const raw = localStorage.getItem(SUBNAV_BOOKMARKS_KEY);
      const all = raw ? JSON.parse(raw) : {};
      all[me.role] = subnavBookmarks;
      localStorage.setItem(SUBNAV_BOOKMARKS_KEY, JSON.stringify(all));
    } catch {
      /* ignore */
    }
  }, [subnavBookmarks, me?.role]);

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
    if ((showAuthModal || needsOnboarding) && (authMode === "register" || needsOnboarding) && isProviderFlow) {
      initMap();
    }
  }, [showAuthModal, authMode, registerStep, form.role, form.provider_sphere, needsOnboarding, me?.role]);

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

  useEffect(() => {
    if (me?.role !== "provider" || !me?.id) {
      setSavedIntervals([]);
      setSelectedIntervalId(null);
      closeIntervalPopover();
      return;
    }
    const key = savedIntervalsStorageKey(me.id);
    try {
      const raw = localStorage.getItem(key);
      setSavedIntervals(raw ? JSON.parse(raw) : []);
    } catch {
      setSavedIntervals([]);
    }
    setSelectedIntervalId(null);
    closeIntervalPopover();
  }, [me?.id, me?.role, closeIntervalPopover]);

  useEffect(() => {
    if (me?.role !== "provider" || !me?.id) return;
    const key = savedIntervalsStorageKey(me.id);
    try {
      localStorage.setItem(key, JSON.stringify(savedIntervals));
    } catch {
      // Ignore storage quota/access errors.
    }
  }, [savedIntervals, me?.id, me?.role]);

  useEffect(() => {
    if (currentView !== "services" || me?.role !== "provider") return;
    setServiceDrafts((prev) => {
      const next = { ...prev };
      for (const s of services) {
        if (!next[s.id]) next[s.id] = buildServiceDraftFromService(s);
      }
      for (const id of Object.keys(next)) {
        if (!services.some((s) => String(s.id) === String(id))) delete next[id];
      }
      return next;
    });
  }, [services, currentView, me?.role]);

  useEffect(() => {
    if (selectedIntervalId && !savedIntervals.some((x) => x.id === selectedIntervalId)) {
      setSelectedIntervalId(null);
    }
    if (intervalPopoverId && !savedIntervals.some((x) => x.id === intervalPopoverId)) {
      closeIntervalPopover();
    }
  }, [savedIntervals, selectedIntervalId, intervalPopoverId, closeIntervalPopover]);

  async function loadRoles() {
    const response = await fetch(`${API_URL}/users/roles/`);
    if (response.ok) setRoles(await response.json());
  }

  async function loadSpheres() {
    const response = await fetch(`${API_URL}/users/spheres/`);
    if (response.ok) setSpheres(await response.json());
  }

  async function handleVerifyEmailFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const isVerifyPath = window.location.pathname.includes("/verify-email");
    const token = params.get("verify_email") || (isVerifyPath ? params.get("token") : "");
    if (!token) return;
    const response = await fetch(`${API_URL}/users/verify-email/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    setVerifyStatus(response.ok ? "Email подтвержден. Теперь можно войти." : "Ссылка подтверждения недействительна.");
    if (response.ok) {
      setAuthMode("login");
      setShowAuthModal(true);
      window.history.replaceState({}, document.title, "/");
    }
  }

  async function handleConfirmPasswordChangeFromUrl() {
    if (!window.location.pathname.includes("/confirm-password-change")) return;
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) return;
    const response = await fetch(`${API_URL}/users/confirm-password-change/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await response.json().catch(() => ({}));
    const detail = data.detail || (response.ok
      ? "Пароль изменён. Теперь можно войти."
      : "Ссылка подтверждения недействительна.");
    setVerifyStatus(detail);
    setAuthStatus(detail);
    if (response.ok) {
      window.history.replaceState({}, document.title, "/");
    }
    openAuth("login");
  }

  function handlePasswordResetFromUrl() {
    if (!window.location.pathname.includes("/reset-password")) return;
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) return;
    setPasswordResetToken(token);
    setResetForm({ new_password: "", new_password_confirm: "" });
    setAuthStatus("Задайте новый пароль.");
    openAuth("reset");
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

  async function loadMe() {
    const response = await authFetch(`${API_URL}/users/me/`);
    if (response.ok) setMe(await response.json());
  }

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

  async function startDemo(sphere) {
    const response = await fetch(`${API_URL}/users/demo-login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sphere }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || "Не удалось открыть демо.");
    }
    setAccessToken(data.access);
    setRefreshToken(data.refresh);
    localStorage.setItem("vmeste_access", data.access);
    localStorage.setItem("vmeste_refresh", data.refresh);
    localStorage.setItem("vmeste_demo", "1");
    setShowAuthModal(false);
    setCurrentView(sphere === "cafe_restaurant" ? "cafe" : sphere === "marketplaces" ? "marketplaces" : "bookings");
    setAuthStatus("");
  }

  async function deleteMyAccount(event) {
    event?.preventDefault?.();
    setDeleteAccountStatus("");
    if ((deleteAccountForm.confirm || "").trim().toLowerCase() !== "удалить") {
      setDeleteAccountStatus("Для подтверждения введите слово «удалить».");
      return;
    }
    if (!deleteAccountForm.password && me?.has_usable_password !== false) {
      setDeleteAccountStatus("Укажите пароль.");
      return;
    }
    setDeleteAccountBusy(true);
    const res = await authFetch(`${API_URL}/users/me/delete/`, {
      method: "POST",
      body: JSON.stringify({
        password: deleteAccountForm.password,
        confirm: "удалить",
      }),
    });
    setDeleteAccountBusy(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setDeleteAccountStatus(err.detail || err.password?.[0] || "Не удалось удалить аккаунт.");
      return;
    }
    setDeleteAccountForm({ password: "", confirm: "" });
    logout();
    setAuthStatus("Аккаунт удалён. Данные обезличены.");
  }

  async function onSubmit(event) {
    event.preventDefault();
    setAuthStatus("");
    if (form.password !== form.password_confirm) {
      setStatus("Пароли не совпадают.");
      return;
    }
    if (!form.age_confirmed) {
      setStatus("Подтвердите, что вам исполнилось 18 лет.");
      return;
    }
    if (!form.accept_privacy || !form.accept_offer) {
      setStatus("Нужно принять оферту и политику конфиденциальности.");
      return;
    }
    if (form.role === "provider" && !form.confirm_provider_authority) {
      setStatus("Подтвердите право оказывать услуги (и лицензию, если она требуется).");
      return;
    }
    setStatus("Сохраняем...");
    const payload = {
      ...form,
      organization_address: simplifyCommaAddressLine(form.organization_address.trim()) || form.organization_address.trim(),
      accept_privacy: Boolean(form.accept_privacy),
      accept_offer: Boolean(form.accept_offer),
      age_confirmed: Boolean(form.age_confirmed),
      confirm_provider_authority: Boolean(form.confirm_provider_authority),
      provider_license_number: (form.provider_license_number || "").trim(),
      privacy_version: SITE_LEGAL.privacyVersion,
      offer_version: SITE_LEGAL.offerVersion,
    };
    const response = await fetch(`${API_URL}/users/register/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (error.email) {
        setStatus(Array.isArray(error.email) ? error.email[0] : error.email);
      } else if (error.username) {
        setStatus(Array.isArray(error.username) ? error.username[0] : error.username);
      } else if (error.confirm_provider_authority) {
        setStatus(Array.isArray(error.confirm_provider_authority) ? error.confirm_provider_authority[0] : error.confirm_provider_authority);
      } else if (error.accept_privacy || error.accept_offer || error.age_confirmed) {
        setStatus("Нужно подтвердить возраст и принять оферту с политикой конфиденциальности.");
      } else {
        setStatus(error.detail || "Проверь поля регистрации.");
      }
      return;
    }
    const data = await response.json().catch(() => ({}));
    const savedUsername = form.username;
    const savedPassword = form.password;
    const savedEmail = form.email;
    setForm(emptyRegisterForm);
    setRegisterStep(1);
    setLoginForm({ username: savedUsername, password: savedPassword });
    setVerifyEmailNotice({
      email: savedEmail,
      detail:
        data.detail || "Регистрация успешна. Проверьте почту для подтверждения email.",
    });
    setResendStatus("");
    setStatus("");
    setAuthMode("login");
  }

  function continueProviderRegistration() {
    const requiredFields = [
      ["Фамилия", form.last_name],
      ["Имя", form.first_name],
      ["Логин", form.username],
      ["Email", form.email],
      ["Пароль", form.password],
    ];
    const missing = requiredFields.find(([, value]) => !String(value || "").trim());
    if (missing) {
      setAuthStatus(`Заполните поле «${missing[0]}».`);
      return;
    }
    if (form.password !== form.password_confirm) {
      setAuthStatus("Пароли не совпадают.");
      return;
    }
    if (!form.age_confirmed || !form.accept_privacy || !form.accept_offer) {
      setAuthStatus("Подтвердите возраст и примите оферту с политикой конфиденциальности.");
      return;
    }
    setAuthStatus("");
    setRegisterStep(2);
  }

  async function completeCredentialsSetup(event) {
    event.preventDefault();
    setAuthStatus("");
    const username = String(credentialsForm.username || "").trim();
    const password = String(credentialsForm.password || "");
    const passwordConfirm = String(credentialsForm.password_confirm || "");
    if (username.length < 3) {
      setAuthStatus("Логин должен быть не короче 3 символов.");
      return;
    }
    if (password.length < 8) {
      setAuthStatus("Пароль должен быть не короче 8 символов.");
      return;
    }
    if (password !== passwordConfirm) {
      setAuthStatus("Пароли не совпадают.");
      return;
    }
    setCredentialsBusy(true);
    const response = await authFetch(`${API_URL}/users/me/setup-credentials/`, {
      method: "POST",
      body: JSON.stringify({
        username,
        password,
        password_confirm: passwordConfirm,
      }),
    });
    const data = await response.json().catch(() => ({}));
    setCredentialsBusy(false);
    if (!response.ok) {
      setAuthStatus(
        data.detail ||
          data.username?.[0] ||
          data.password?.[0] ||
          data.password_confirm?.[0] ||
          formatApiError(data, response.status) ||
          "Не удалось сохранить логин и пароль."
      );
      return;
    }
    setMe(data);
    setCredentialsForm({ username: "", password: "", password_confirm: "" });
    setAuthStatus(data.detail || "Логин и пароль сохранены.");
    setLoginForm((p) => ({ ...p, username }));
  }

  async function completeOnboarding(event) {
    event.preventDefault();
    setAuthStatus("");
    setStatus("");
    if (!me?.id) return;
    if (!String(form.first_name || "").trim() || !String(form.last_name || "").trim()) {
      setAuthStatus("Укажите имя и фамилию.");
      return;
    }
    if (me.role === "provider") {
      if (!String(form.provider_sphere || "").trim()) {
        setAuthStatus("Выберите сферу услуг.");
        return;
      }
      if (!String(form.organization_name || "").trim()) {
        setAuthStatus("Укажите название организации.");
        return;
      }
      if (form.provider_sphere !== "marketplaces" && !String(form.organization_address || "").trim()) {
        setAuthStatus("Укажите адрес организации.");
        return;
      }
      if (!form.confirm_provider_authority && !me.provider_authority_confirmed) {
        setAuthStatus("Подтвердите право оказывать услуги.");
        return;
      }
    }
    setStatus("Сохраняем...");
    const payload = {
      first_name: String(form.first_name || "").trim(),
      last_name: String(form.last_name || "").trim(),
      patronymic: String(form.patronymic || "").trim(),
      phone: String(form.phone || "").trim(),
    };
    if (!(me.email || "").trim() && String(form.email || "").trim()) {
      payload.email = String(form.email || "").trim();
    }
    if (me.role === "provider") {
      payload.provider_sphere = form.provider_sphere;
      payload.organization_name = String(form.organization_name || "").trim();
      if (form.provider_sphere === "marketplaces") {
        payload.organization_address = "";
        payload.organization_latitude = null;
        payload.organization_longitude = null;
        payload.organization_entrance = "";
        payload.organization_floor = "";
        payload.organization_apartment = "";
        payload.organization_intercom = "";
        payload.organization_address_extra = "";
      } else {
        payload.organization_address =
          simplifyCommaAddressLine(String(form.organization_address || "").trim()) ||
          String(form.organization_address || "").trim();
        payload.organization_latitude = form.organization_latitude;
        payload.organization_longitude = form.organization_longitude;
        payload.organization_entrance = form.entrance || "";
        payload.organization_floor = form.floor || "";
        payload.organization_apartment = form.apartment || "";
        payload.organization_intercom = form.intercom || "";
        payload.organization_address_extra = form.organization_address_details || "";
      }
      payload.provider_license_number = String(form.provider_license_number || "").trim();
      payload.confirm_provider_authority = Boolean(form.confirm_provider_authority);
    }
    const response = await authFetch(`${API_URL}/users/me/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus("");
      setAuthStatus(
        data.detail ||
          data.email?.[0] ||
          data.organization_name?.[0] ||
          data.provider_sphere?.[0] ||
          "Не удалось сохранить данные. Проверьте поля."
      );
      return;
    }
    setMe((prev) => ({ ...prev, ...data }));
    setForm(emptyRegisterForm);
    setRegisterStep(1);
    destroyRegMap();
    setShowAuthModal(false);
    setStatus("");
    setAuthStatus("");
    onboardingPrefillIdRef.current = null;
    if (data.role === "provider" && data.provider_sphere === "cafe_restaurant") setCurrentView("cafe_orders");
    if (
      data.role === "staff" &&
      (data.employer_sphere === "cafe_restaurant" || data.provider_sphere === "cafe_restaurant")
    ) {
      setCurrentView("cafe_orders");
    }
    else if (data.role === "provider" && data.provider_sphere === "marketplaces") setCurrentView("marketplaces");
    else if (data.role === "provider") setCurrentView("bookings");
  }

  async function resendVerification() {
    setResendStatus("Отправляем письмо...");
    const email = me?.email || verifyEmailNotice?.email || form.email || "";
    await resendVerificationForEmail(email);
  }

  function destroyRegMap() {
    if (mapRef.current) {
      try {
        mapRef.current.destroy();
      } catch {
        // ignore map cleanup errors
      }
    }
    mapRef.current = null;
    placemarkRef.current = null;
  }

  function initMap() {
    const mapElement = document.getElementById("reg-map");
    if (!mapElement) {
      if (mapRef.current) destroyRegMap();
      return;
    }
    if (mapRef.current) return;
    const centerLat = Number(form.organization_latitude);
    const centerLon = Number(form.organization_longitude);
    const hasPoint = Number.isFinite(centerLat) && Number.isFinite(centerLon);
    void loadYandexMaps()
      .then(() => {
        const ymaps = window.ymaps;
        if (!ymaps || mapRef.current) return;
        ymaps.ready(() => {
          const currentMapElement = document.getElementById("reg-map");
          if (!currentMapElement) {
            if (mapRef.current) destroyRegMap();
            return;
          }
          if (mapRef.current) return;
          const center = hasPoint ? [centerLat, centerLon] : [55.751244, 37.618423];
          const hadPin =
            Boolean(String(form.organization_address || "").trim()) ||
            (hasPoint &&
              !(
                Math.abs(centerLat - 55.751244) < 1e-6 &&
                Math.abs(centerLon - 37.618423) < 1e-6
              ));
          const map = new ymaps.Map(currentMapElement, {
            center,
            zoom: hadPin ? 14 : 11,
          });
          mapRef.current = map;
          if (hadPin) {
            placemarkRef.current = new ymaps.Placemark(center);
            map.geoObjects.add(placemarkRef.current);
          }
          map.events.add("click", (e) => {
            const coords = e.get("coords");
            const [lat, lon] = coords;
            reverseGeocodeByCoords(lat, lon).then((result) => {
              const shortAddress = buildShortAddress(result?.address);
              const city = getCity(result?.address);
              setForm((prev) => ({
                ...prev,
                organization_latitude: lat.toFixed(6),
                organization_longitude: lon.toFixed(6),
                organization_address: simplifyCommaAddressLine(
                  shortAddress || result?.display_name || prev.organization_address
                ),
              }));
              if (city) setDetectedCity(city);
            });
            if (!placemarkRef.current) {
              placemarkRef.current = new ymaps.Placemark(coords);
              mapRef.current.geoObjects.add(placemarkRef.current);
            } else {
              placemarkRef.current.geometry.setCoordinates(coords);
            }
          });
        });
      })
      .catch(() => showToast("Не удалось загрузить карту.", { tone: "error" }));
  }

  async function geocodeAddress(addressValue) {
    const ymaps = window.ymaps;
    if (!ymaps || !mapRef.current || !addressValue?.trim()) return;
    const trimmed = addressValue.trim();
    const fromGeo = await ensureCityHintFromGeo();
    const cityHint = detectedCity || fromGeo;
    const queries = [buildNominatimQuery(trimmed, cityHint), buildNominatimQuery(trimmed, ""), trimmed];
    let data = [];
    for (const q of queries) {
      if (!q) continue;
      data = await nominatimSearchRU(q, 1);
      if (data.length) break;
    }
    if (!data.length) return;
    const first = data[0];
    const lat = Number(first.lat);
    const lon = Number(first.lon);
    const normalizedAddress = simplifyCommaAddressLine(
      buildShortAddress(first.address) || first.display_name || addressValue
    );
    const city = getCity(first.address);
    setForm((prev) => ({
      ...prev,
      organization_latitude: lat.toFixed(6),
      organization_longitude: lon.toFixed(6),
      organization_address: normalizedAddress,
    }));
    if (city) setDetectedCity(city);
    const coords = [lat, lon];
    mapRef.current.setCenter(coords, 14);
    if (!placemarkRef.current) {
      placemarkRef.current = new ymaps.Placemark(coords);
      mapRef.current.geoObjects.add(placemarkRef.current);
    } else {
      placemarkRef.current.geometry.setCoordinates(coords);
    }
  }

  function ensureCityHintFromGeo() {
    if (geoCityDeniedRef.current || !navigator.geolocation) return Promise.resolve("");
    if (geoCityPromiseRef.current) return geoCityPromiseRef.current;
    geoCityPromiseRef.current = new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const geo = await reverseGeocodeByCoords(position.coords.latitude, position.coords.longitude);
          const city = getCity(geo?.address) || federalCityFromReverse(geo?.address);
          if (city) setDetectedCity(city);
          geoCityPromiseRef.current = null;
          resolve(city || "");
        },
        (err) => {
          if (err && err.code === 1) geoCityDeniedRef.current = true;
          geoCityPromiseRef.current = null;
          resolve("");
        },
        { timeout: 9500, enableHighAccuracy: false }
      );
    });
    return geoCityPromiseRef.current;
  }

  async function fetchAddressSuggestions(query) {
    const trimmed = (query || "").trim();
    if (trimmed.length < 2) {
      setAddressSuggestions([]);
      return;
    }
    const seq = ++suggestRequestSeqRef.current;
    const YANDEX_SUGGEST_CAP_MS = 4500;
    try {
      void ensureCityHintFromGeo();
      const cityHint = detectedCity;

      async function loadPhotonSuggestionItems() {
        const primaryQ = buildNominatimQuery(trimmed, cityHint);
        let items = await photonSuggestSearch(primaryQ, 10);
        if (items.length === 0) {
          const secondQ = buildNominatimQuery(trimmed, "");
          if (secondQ !== primaryQ) items = await photonSuggestSearch(secondQ, 10);
        }
        if (items.length === 0 && primaryQ !== trimmed) {
          items = await photonSuggestSearch(trimmed, 10);
        }
        return items;
      }

      /** Без ключей Яндекса подсказки только через Photon (komoot) — бесплатно для типичного объёма. */
      const yandexAutocompleteEnabled = Boolean(
        import.meta.env.VITE_YANDEX_SUGGEST_API_KEY || import.meta.env.VITE_YANDEX_MAPS_API_KEY
      );

      if (yandexAutocompleteEnabled) {
        await loadYandexMaps().catch(() => showToast("Не удалось загрузить подсказки адреса.", { tone: "error" }));
      }

      const yaPromise =
        window.ymaps && yandexAutocompleteEnabled
          ? Promise.race([
              (async () => {
                const fromSuggest = await yandexMapsNativeSuggestItems(trimmed, cityHint);
                if (fromSuggest?.length) return fromSuggest;
                const fromGeocode = await yandexGeocodeSuggestItems(trimmed, cityHint);
                return fromGeocode && fromGeocode.length ? fromGeocode : [];
              })(),
              new Promise((resolve) => {
                setTimeout(() => resolve([]), YANDEX_SUGGEST_CAP_MS);
              }),
            ])
          : Promise.resolve([]);

      const [yaItems, photonItems] = await Promise.all([yaPromise, loadPhotonSuggestionItems()]);
      if (suggestRequestSeqRef.current !== seq) return;
      setAddressSuggestions(photonItems.length ? photonItems : yaItems);
    } catch (_error) {
      if (suggestRequestSeqRef.current === seq) setAddressSuggestions([]);
    }
  }

  function onAddressInput(value) {
    setForm((prev) => ({ ...prev, organization_address: value }));
    if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
    suggestTimerRef.current = setTimeout(() => {
      fetchAddressSuggestions(value);
    }, 280);
  }

  function pickSuggestion(item) {
    const ymaps = window.ymaps;
    const line = simplifyCommaAddressLine(String(item.value || "").trim()) || String(item.value || "").trim();
    setForm((prev) => ({
      ...prev,
      organization_address: line,
      organization_latitude: item.lat.toFixed(6),
      organization_longitude: item.lon.toFixed(6),
    }));
    if (item.city) setDetectedCity(item.city);
    setAddressSuggestions([]);
    if (!ymaps || !mapRef.current) return;
    const coords = [item.lat, item.lon];
    mapRef.current.setCenter(coords, 14);
    if (!placemarkRef.current) {
      placemarkRef.current = new ymaps.Placemark(coords);
      mapRef.current.geoObjects.add(placemarkRef.current);
    } else {
      placemarkRef.current.geometry.setCoordinates(coords);
    }
  }

  function destroyProfileMap() {
    if (profileMapRef.current) {
      try {
        profileMapRef.current.destroy();
      } catch (_e) {
        // ignore destroy errors
      }
      profileMapRef.current = null;
    }
    profilePlacemarkRef.current = null;
  }

  function destroyClientDiscoverMap() {
    if (clientMyLocationWatchIdRef.current != null && navigator.geolocation?.clearWatch) {
      try {
        navigator.geolocation.clearWatch(clientMyLocationWatchIdRef.current);
      } catch {
        /* ignore */
      }
      clientMyLocationWatchIdRef.current = null;
    }
    clientMyLocationPlacemarkRef.current = null;
    clientMyLocationCoordsRef.current = null;
    if (clientDiscoverMapRef.current) {
      try {
        clientDiscoverMapRef.current.destroy();
      } catch (_e) {
        // ignore
      }
      clientDiscoverMapRef.current = null;
    }
    clientDiscoverMapClickBoundRef.current = false;
    if (clientDiscoverMapZoomTimerRef.current) {
      window.clearTimeout(clientDiscoverMapZoomTimerRef.current);
      clientDiscoverMapZoomTimerRef.current = null;
    }
    resetOrgPinLayoutClass();
  }

  function ensureClientMyLocationMarker(coords) {
    const ymaps = window.ymaps;
    const map = clientDiscoverMapRef.current;
    if (!ymaps || !map || !coords) return;
    const [lat, lon] = coords;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    clientMyLocationCoordsRef.current = [lat, lon];
    if (clientMyLocationPlacemarkRef.current) {
      try {
        clientMyLocationPlacemarkRef.current.geometry.setCoordinates([lat, lon]);
      } catch {
        /* ignore */
      }
      try {
        map.geoObjects.remove(clientMyLocationPlacemarkRef.current);
      } catch {
        /* ignore */
      }
      try {
        map.geoObjects.add(clientMyLocationPlacemarkRef.current);
      } catch {
        /* ignore */
      }
      return;
    }
    const pm = new ymaps.Placemark(
      [lat, lon],
      { hintContent: "Вы здесь" },
      {
        preset: "islands#blueCircleDotIcon",
        zIndex: 700,
        zIndexHover: 700,
      },
    );
    clientMyLocationPlacemarkRef.current = pm;
    map.geoObjects.add(pm);
  }

  function startClientMyLocationTracking() {
    if (!navigator.geolocation || clientMyLocationWatchIdRef.current != null) return;
    const apply = (pos) => {
      const lat = pos?.coords?.latitude;
      const lon = pos?.coords?.longitude;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      ensureClientMyLocationMarker([lat, lon]);
    };
    navigator.geolocation.getCurrentPosition(apply, () => {}, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 30000,
    });
    try {
      clientMyLocationWatchIdRef.current = navigator.geolocation.watchPosition(
        apply,
        () => {},
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 15000 },
      );
    } catch {
      /* ignore */
    }
  }

  function paintClientDiscoverMapMarkers(locations, { fitView = false, selectedId = null } = {}) {
    const ymaps = window.ymaps;
    const map = clientDiscoverMapRef.current;
    if (!ymaps || !map || !Array.isArray(locations)) return;
    if (!clientDiscoverMapClickBoundRef.current) {
      clientDiscoverMapClickBoundRef.current = true;
      map.geoObjects.events.add("click", (e) => {
        const target = e.get("target");
        const loc = target?.properties?.get?.("vmesteLoc");
        if (loc) openOrgOnMap(loc);
      });
    }
    const zoom = map.getZoom();
    const selected = selectedId != null ? selectedId : mapOrgPopup?.id;
    map.geoObjects.removeAll();
    clientMyLocationPlacemarkRef.current = null;
    const coordsList = [];
    for (const loc of locations) {
      const lat = Number(loc.latitude);
      const lon = Number(loc.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const pm = buildYmapOrgPlacemark(
        ymaps,
        loc,
        () => {
          openOrgOnMap(loc);
        },
        new Date(),
        zoom,
        { selected: selected != null && String(loc.id) === String(selected) },
      );
      map.geoObjects.add(pm);
      coordsList.push([lat, lon]);
    }
    if (clientMyLocationCoordsRef.current) {
      ensureClientMyLocationMarker(clientMyLocationCoordsRef.current);
    } else {
      startClientMyLocationTracking();
    }
    if (!fitView) return;
    if (coordsList.length === 1) {
      map.setCenter(coordsList[0], 14);
    } else if (coordsList.length > 1) {
      map.setBounds(ymaps.util.bounds.fromPoints(coordsList), { checkZoomRange: true, zoomMargin: 52 });
    } else if (clientMyLocationCoordsRef.current) {
      map.setCenter(clientMyLocationCoordsRef.current, 14);
    } else {
      map.setCenter([55.751244, 37.618423], 10);
    }
  }

  function initProfileMapFromCoords(lat, lon) {
    if (profileMapRef.current) return;
    void loadYandexMaps()
      .then(() => {
        const ymaps = window.ymaps;
        if (!ymaps || profileMapRef.current) return;
        ymaps.ready(() => {
          if (profileMapRef.current || !document.getElementById("profile-address-map")) return;
          profileMapRef.current = new ymaps.Map("profile-address-map", {
            center: [lat, lon],
            zoom: 14,
          });
          profilePlacemarkRef.current = new ymaps.Placemark([lat, lon]);
          profileMapRef.current.geoObjects.add(profilePlacemarkRef.current);
          profileMapRef.current.events.add("click", (e) => {
            const coords = e.get("coords");
            const plat = coords[0];
            const plon = coords[1];
            reverseGeocodeByCoords(plat, plon).then((result) => {
              const shortAddress = buildShortAddress(result?.address);
              const city = getCity(result?.address);
              setOrgAddressForm((p) => ({
                ...p,
                organization_latitude: plat.toFixed(6),
                organization_longitude: plon.toFixed(6),
                organization_address: simplifyCommaAddressLine(
                  shortAddress || result?.display_name || p.organization_address
                ),
              }));
              if (city) setDetectedCity(city);
            });
            if (profilePlacemarkRef.current) {
              profilePlacemarkRef.current.geometry.setCoordinates(coords);
            }
          });
        });
      })
      .catch(() => showToast("Не удалось загрузить карту.", { tone: "error" }));
  }

  function destroyBranchDetailMap() {
    if (branchDetailMapRef.current) {
      try {
        branchDetailMapRef.current.destroy();
      } catch (_e) {
        // ignore
      }
      branchDetailMapRef.current = null;
    }
    branchDetailPlacemarkRef.current = null;
  }

  function destroyBranchEditMap() {
    if (branchEditMapRef.current) {
      try {
        branchEditMapRef.current.destroy();
      } catch (_e) {
        // ignore
      }
      branchEditMapRef.current = null;
    }
    branchEditPlacemarkRef.current = null;
  }

  function destroyBranchAddMap() {
    if (branchAddMapRef.current) {
      try {
        branchAddMapRef.current.destroy();
      } catch (_e) {
        // ignore
      }
      branchAddMapRef.current = null;
    }
    branchAddPlacemarkRef.current = null;
  }

  function initBranchDetailMapFromCoords(lat, lon) {
    void loadYandexMaps()
      .then(() => {
        const ymaps = window.ymaps;
        if (!ymaps) return;
        ymaps.ready(() => {
          if (!document.getElementById("branch-detail-map")) return;
          destroyBranchDetailMap();
          branchDetailMapRef.current = new ymaps.Map("branch-detail-map", {
            center: [lat, lon],
            zoom: 14,
          });
          branchDetailPlacemarkRef.current = new ymaps.Placemark([lat, lon]);
          branchDetailMapRef.current.geoObjects.add(branchDetailPlacemarkRef.current);
        });
      })
      .catch(() => showToast("Не удалось загрузить карту.", { tone: "error" }));
  }

  function initBranchEditMapFromCoords(lat, lon) {
    void loadYandexMaps()
      .then(() => {
        const ymaps = window.ymaps;
        if (!ymaps) return;
        ymaps.ready(() => {
          if (!document.getElementById("branch-edit-map")) return;
          destroyBranchEditMap();
          branchEditMapRef.current = new ymaps.Map("branch-edit-map", {
            center: [lat, lon],
            zoom: 14,
          });
          branchEditPlacemarkRef.current = new ymaps.Placemark([lat, lon]);
          branchEditMapRef.current.geoObjects.add(branchEditPlacemarkRef.current);
          branchEditMapRef.current.events.add("click", (e) => {
            const coords = e.get("coords");
            const plat = coords[0];
            const plon = coords[1];
            reverseGeocodeByCoords(plat, plon).then((result) => {
              const shortAddress = buildShortAddress(result?.address);
              const city = getCity(result?.address);
              setLocationForm((prev) => {
                const addr = simplifyCommaAddressLine(
                  shortAddress || result?.display_name || prev.address
                );
                return {
                  ...prev,
                  latitude: plat.toFixed(6),
                  longitude: plon.toFixed(6),
                  address: addr,
                };
              });
              if (city) setDetectedCity(city);
            });
            if (branchEditPlacemarkRef.current) {
              branchEditPlacemarkRef.current.geometry.setCoordinates(coords);
            }
          });
        });
      })
      .catch(() => showToast("Не удалось загрузить карту.", { tone: "error" }));
  }

  function initBranchAddMapFromCoords(lat, lon) {
    void loadYandexMaps()
      .then(() => {
        const ymaps = window.ymaps;
        if (!ymaps) return;
        ymaps.ready(() => {
          if (!document.getElementById("branch-add-map")) return;
          destroyBranchAddMap();
          branchAddMapRef.current = new ymaps.Map("branch-add-map", {
            center: [lat, lon],
            zoom: 14,
          });
          branchAddPlacemarkRef.current = new ymaps.Placemark([lat, lon]);
          branchAddMapRef.current.geoObjects.add(branchAddPlacemarkRef.current);
          branchAddMapRef.current.events.add("click", (e) => {
            const coords = e.get("coords");
            const plat = coords[0];
            const plon = coords[1];
            reverseGeocodeByCoords(plat, plon).then((result) => {
              const shortAddress = buildShortAddress(result?.address);
              const city = getCity(result?.address);
              setLocationForm((prev) => {
                const addr = simplifyCommaAddressLine(
                  shortAddress || result?.display_name || prev.address
                );
                return {
                  ...prev,
                  latitude: plat.toFixed(6),
                  longitude: plon.toFixed(6),
                  address: addr,
                };
              });
              if (city) setDetectedCity(city);
            });
            if (branchAddPlacemarkRef.current) {
              branchAddPlacemarkRef.current.geometry.setCoordinates(coords);
            }
          });
        });
      })
      .catch(() => showToast("Не удалось загрузить карту.", { tone: "error" }));
  }

  function onProfileAddressInput(value) {
    setOrgAddressForm((prev) => ({ ...prev, organization_address: value }));
    if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
    suggestTimerRef.current = setTimeout(() => {
      fetchAddressSuggestions(value);
    }, 280);
  }

  function onBranchAddressInput(value) {
    setLocationForm((prev) => ({ ...prev, address: value }));
    if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
    suggestTimerRef.current = setTimeout(() => {
      fetchAddressSuggestions(value);
    }, 280);
  }

  function pickBranchLocationSuggestion(item) {
    const ymaps = window.ymaps;
    setLocationForm((prev) => ({
      ...prev,
      address: item.value,
      latitude: item.lat.toFixed(6),
      longitude: item.lon.toFixed(6),
      entrance: "",
      floor: "",
      apartment: "",
      intercom: "",
      address_details: "",
    }));
    if (item.city) setDetectedCity(item.city);
    setAddressSuggestions([]);
    if (!ymaps) return;
    const coords = [item.lat, item.lon];
    const mapEl = orgBranchEditOpen ? branchEditMapRef.current : branchAddMapRef.current;
    const placemark = orgBranchEditOpen ? branchEditPlacemarkRef.current : branchAddPlacemarkRef.current;
    if (!mapEl) return;
    mapEl.setCenter(coords, 14);
    if (placemark) {
      placemark.geometry.setCoordinates(coords);
    } else {
      const pm = new ymaps.Placemark(coords);
      if (orgBranchEditOpen) {
        branchEditPlacemarkRef.current = pm;
        branchEditMapRef.current.geoObjects.add(pm);
      } else {
        branchAddPlacemarkRef.current = pm;
        branchAddMapRef.current.geoObjects.add(pm);
      }
    }
  }

  function pickProfileSuggestion(item) {
    const ymaps = window.ymaps;
    const line = simplifyCommaAddressLine(String(item.value || "").trim()) || String(item.value || "").trim();
    setOrgAddressForm((prev) => ({
      ...prev,
      organization_address: line,
      organization_latitude: item.lat.toFixed(6),
      organization_longitude: item.lon.toFixed(6),
    }));
    if (item.city) setDetectedCity(item.city);
    setAddressSuggestions([]);
    if (!ymaps || !profileMapRef.current) return;
    const coords = [item.lat, item.lon];
    profileMapRef.current.setCenter(coords, 14);
    if (!profilePlacemarkRef.current) {
      profilePlacemarkRef.current = new ymaps.Placemark(coords);
      profileMapRef.current.geoObjects.add(profilePlacemarkRef.current);
    } else {
      profilePlacemarkRef.current.geometry.setCoordinates(coords);
    }
  }

  async function geocodeProfileAddress(addressValue) {
    const ymaps = window.ymaps;
    if (!ymaps || !profileMapRef.current || !addressValue?.trim()) return;
    const trimmed = addressValue.trim();
    const fromGeo = await ensureCityHintFromGeo();
    const cityHint = detectedCity || fromGeo;
    const queries = [buildNominatimQuery(trimmed, cityHint), buildNominatimQuery(trimmed, ""), trimmed];
    let data = [];
    for (const q of queries) {
      if (!q) continue;
      data = await nominatimSearchRU(q, 1);
      if (data.length) break;
    }
    if (!data.length) return;
    const first = data[0];
    const lat = Number(first.lat);
    const lon = Number(first.lon);
    const normalizedAddress = simplifyCommaAddressLine(
      buildShortAddress(first.address) || first.display_name || addressValue
    );
    const city = getCity(first.address);
    setOrgAddressForm((prev) => ({
      ...prev,
      organization_latitude: lat.toFixed(6),
      organization_longitude: lon.toFixed(6),
      organization_address: normalizedAddress,
    }));
    if (city) setDetectedCity(city);
    const coords = [lat, lon];
    profileMapRef.current.setCenter(coords, 14);
    if (!profilePlacemarkRef.current) {
      profilePlacemarkRef.current = new ymaps.Placemark(coords);
      profileMapRef.current.geoObjects.add(profilePlacemarkRef.current);
    } else {
      profilePlacemarkRef.current.geometry.setCoordinates(coords);
    }
  }

  function buildSearchText(rawText) {
    if (!rawText) return "";
    if (!detectedCity) return rawText;
    const lower = rawText.toLowerCase();
    const cityLower = detectedCity.toLowerCase();
    if (lower.includes(cityLower)) return rawText;
    const startsWithDigit = /^\d/.test(rawText);
    if (startsWithDigit || rawText.split(" ").length <= 4) {
      return `${detectedCity}, ${rawText}`;
    }
    return rawText;
  }

  async function detectCityByGeolocation() {
    if (detectedCity || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const geo = await reverseGeocodeByCoords(latitude, longitude);
        const city = getCity(geo?.address) || federalCityFromReverse(geo?.address);
        if (city) setDetectedCity(city);
      },
      () => {},
      { timeout: 7000, enableHighAccuracy: false }
    );
  }

  function composeAddressWithDetails(baseAddress, sourceForm = form) {
    const tail = composePipeTailFromDetails({
      entrance: sourceForm.entrance,
      floor: sourceForm.floor,
      apartment: sourceForm.apartment,
      intercom: sourceForm.intercom,
      extra: sourceForm.organization_address_details,
    });
    return tail ? `${baseAddress} | ${tail}` : baseAddress;
  }

  async function reloadProviderSlots() {
    if (me?.role !== "provider") return;
    const slotRes = await authFetch(`${API_URL}/booking/slots/`);
    if (slotRes.ok) setSlots(await slotRes.json());
  }

  async function loadSellerData() {
    const [catRes, servRes, slotRes, bookingRes, locRes, staffRes] = await Promise.all([
      authFetch(`${API_URL}/catalog/categories/`),
      authFetch(`${API_URL}/catalog/services/`),
      authFetch(`${API_URL}/booking/slots/`),
      authFetch(`${API_URL}/booking/`),
      authFetch(`${API_URL}/locations/`),
      authFetch(`${API_URL}/booking/staff/`),
    ]);
    const failed = [catRes, servRes, slotRes, bookingRes, locRes, staffRes].some((r) => !r.ok);
    setCabinetLoadError(failed ? "Не удалось загрузить часть данных кабинета." : "");
    if (catRes.ok) setCategories(await catRes.json());
    if (servRes.ok) setServices(await servRes.json());
    const slotsData = slotRes.ok ? normalizeSlotsList(await slotRes.json()) : [];
    if (slotRes.ok) setSlots(slotsData);
    const staffData = staffRes.ok ? await staffRes.json() : orgStaff;
    if (staffRes.ok) setOrgStaff(staffData);
    if (bookingRes.ok) {
      const bookingsData = normalizeBookingsList(await bookingRes.json());
      setBookings(
        mergeBookingsWithManualHolds(bookingsData, slotsData, {
          orgStaff: staffData,
          providerId: me?.id,
          staffJobTitleForUser: (userId) => {
            const link = (staffData || []).find((l) => Number(l.staff) === Number(userId));
            return (link?.job_title || "").trim();
          },
        }),
      );
    }
    if (locRes.ok) setLocation(await locRes.json());
  }

  useEffect(() => {
    if ((currentView !== "profile" && currentView !== "organization") || me?.role !== "provider") {
      destroyProfileMap();
      return;
    }
    const lat = Number(orgAddressForm.organization_latitude) || 55.751244;
    const lon = Number(orgAddressForm.organization_longitude) || 37.618423;
    const t = setTimeout(() => {
      destroyProfileMap();
      initProfileMapFromCoords(lat, lon);
    }, 200);
    return () => {
      clearTimeout(t);
      destroyProfileMap();
    };
  }, [currentView, me?.role, orgAddressForm.organization_latitude, orgAddressForm.organization_longitude, orgMainEditOpen]);

  useEffect(() => {
    if (currentView !== "organization" || me?.role !== "provider") {
      destroyBranchDetailMap();
      return;
    }
    if (!selectedOrgBranchId || orgBranchAddOpen || orgBranchEditOpen) {
      destroyBranchDetailMap();
      return;
    }
    const br = location.find((l) => Number(l.id) === Number(selectedOrgBranchId));
    if (!br) {
      destroyBranchDetailMap();
      return;
    }
    const lat = Number(br.latitude);
    const lon = Number(br.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      destroyBranchDetailMap();
      return;
    }
    const t = setTimeout(() => {
      destroyBranchDetailMap();
      initBranchDetailMapFromCoords(lat, lon);
    }, 220);
    return () => {
      clearTimeout(t);
      destroyBranchDetailMap();
    };
  }, [currentView, me?.role, selectedOrgBranchId, orgBranchAddOpen, orgBranchEditOpen, location]);

  useEffect(() => {
    if (currentView !== "organization" || me?.role !== "provider" || !orgBranchEditOpen || !selectedOrgBranchId || orgBranchAddOpen) {
      destroyBranchEditMap();
      return;
    }
    const lat = Number(locationForm.latitude) || 55.751244;
    const lon = Number(locationForm.longitude) || 37.618423;
    const t = setTimeout(() => {
      destroyBranchEditMap();
      initBranchEditMapFromCoords(lat, lon);
    }, 220);
    return () => {
      clearTimeout(t);
      destroyBranchEditMap();
    };
  }, [currentView, me?.role, orgBranchEditOpen, selectedOrgBranchId, orgBranchAddOpen, locationForm.latitude, locationForm.longitude]);

  useEffect(() => {
    if (currentView !== "organization" || me?.role !== "provider" || !orgBranchAddOpen) {
      destroyBranchAddMap();
      return;
    }
    const lat = Number(locationForm.latitude) || 55.751244;
    const lon = Number(locationForm.longitude) || 37.618423;
    const t = setTimeout(() => {
      destroyBranchAddMap();
      initBranchAddMapFromCoords(lat, lon);
    }, 220);
    return () => {
      clearTimeout(t);
      destroyBranchAddMap();
    };
  }, [currentView, me?.role, orgBranchAddOpen, locationForm.latitude, locationForm.longitude]);

  async function loadStaffWorkspace() {
    const reqs = [
      authFetch(`${API_URL}/booking/staff/`),
      authFetch(`${API_URL}/chat/conversations/`),
      authFetch(`${API_URL}/booking/`),
      authFetch(`${API_URL}/booking/slots/`),
    ];
    if (me?.role === "staff" && staffEffectivePerms.can_delegate_permissions) {
      reqs.push(authFetch(`${API_URL}/catalog/categories/`), authFetch(`${API_URL}/catalog/services/`));
    }
    const results = await Promise.all(reqs);
    const failed = results.some((r) => !r.ok);
    setCabinetLoadError(failed ? "Не удалось загрузить часть данных кабинета." : "");
    const staffData = results[0].ok ? await results[0].json() : orgStaff;
    if (results[0].ok) setOrgStaff(staffData);
    if (results[1].ok) setConversations(await results[1].json());
    const slotsData = results[3]?.ok ? normalizeSlotsList(await results[3].json()) : [];
    if (results[3]?.ok) setSlots(slotsData);
    if (results[2].ok) {
      const bookingsData = normalizeBookingsList(await results[2].json());
      setBookings(
        mergeBookingsWithManualHolds(bookingsData, slotsData, {
          orgStaff: staffData,
          providerId: null,
          staffJobTitleForUser: (userId) => {
            const link = (staffData || []).find((l) => Number(l.staff) === Number(userId));
            return (link?.job_title || "").trim();
          },
        }),
      );
    }
    if (results[4]?.ok) setCategories(await results[4].json());
    if (results[5]?.ok) setServices(await results[5].json());
  }

  async function loadChats() {
    const isVmenu = currentViewRef.current === "vmenu";
    const url = isVmenu
      ? `${API_URL}/chat/conversations/?user_direct=1`
      : `${API_URL}/chat/conversations/`;
    const res = await authFetch(url);
    if (res.ok) setConversations(await res.json());
  }

  async function loadVmenuChatContacts() {
    const res = await authFetch(`${API_URL}/vmenu/chats/contacts/`);
    if (res.ok) {
      const data = await res.json();
      setVmenuChatContacts(Array.isArray(data?.followers) ? data.followers : []);
    }
  }

  async function openVmenuUserChat(userId) {
    const res = await authFetch(`${API_URL}/chat/conversations/create-user-direct/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    if (!res.ok) {
      setChatStatus("Не удалось открыть чат с пользователем.");
      return;
    }
    const conv = await res.json();
    await loadChats();
    await loadVmenuChatContacts();
    setSelectedChatId(conv.id);
    setChatStatus("");
  }

  function togglePinChatForFolder(convId, folder) {
    const n = Number(convId);
    const key = folder === "clients" ? "clients" : "org";
    setChatPins((prev) => {
      const list = [...(prev[key] || [])].map(Number);
      const i = list.indexOf(n);
      if (i >= 0) {
        list.splice(i, 1);
        return { ...prev, [key]: list };
      }
      if (list.length >= MAX_PINNED_CHATS) {
        queueMicrotask(() => setChatStatus(`Не больше ${MAX_PINNED_CHATS} закреплённых чатов.`));
        return prev;
      }
      return { ...prev, [key]: [...list, n] };
    });
  }

  function reorderPinnedChats(folder, draggedId, targetId) {
    const a = Number(draggedId);
    const b = Number(targetId);
    if (!a || !b || a === b) return;
    const key = folder === "clients" ? "clients" : "org";
    setChatPins((prev) => {
      const list = [...(prev[key] || [])].map(Number);
      const fi = list.indexOf(a);
      const ti = list.indexOf(b);
      if (fi < 0 || ti < 0) return prev;
      list.splice(fi, 1);
      list.splice(ti, 0, a);
      return { ...prev, [key]: list };
    });
  }

  function scrollChatToMessageId(mid) {
    const el = document.getElementById(`tg-msg-${mid}`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    if (el) {
      el.classList.add("tg-msg--flash");
      window.setTimeout(() => el.classList.remove("tg-msg--flash"), 1600);
    }
  }

  function jumpToChatMessage(mid) {
    setChatInfoOpen(false);
    window.setTimeout(() => scrollChatToMessageId(mid), 80);
  }

  function openChatPhotosLightbox(items, index = 0) {
    if (!items?.length) return;
    setOrgPhotoLightbox({ items, index: Math.max(0, Math.min(index, items.length - 1)) });
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

  function persistChatReceiptsMode(mode) {
    setChatReceiptsMode(mode);
    try {
      localStorage.setItem(CHAT_RECEIPTS_KEY, JSON.stringify({ mode }));
    } catch {
      // ignore
    }
  }

  async function inviteStaff(event) {
    event.preventDefault();
    setStaffInviteStatus("Добавляем...");
    const body = {};
    const idf = (staffInviteForm.invite_identifier || "").trim();
    if (idf) body.invite_identifier = idf;
    if (!body.invite_identifier) {
      setStaffInviteStatus("Укажи email или логин сотрудника.");
      return;
    }
    const response = await authFetch(`${API_URL}/booking/staff/`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = typeof err === "object" && err ? Object.values(err).flat().find(Boolean) : null;
      setStaffInviteStatus(msg || "Не удалось добавить сотрудника.");
      return;
    }
    setStaffInviteStatus("Приглашение отправлено. Сотрудник увидит запрос в чатах.");
    setStaffInviteForm({ invite_identifier: "" });
    if (me?.role === "provider") loadSellerData();
    else loadStaffWorkspace();
    loadChatActivity();
  }

  async function deactivateStaff(linkId) {
    const response = await authFetch(`${API_URL}/booking/staff/${linkId}/`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: false }),
    });
    if (!response.ok) {
      setStaffInviteStatus("Не удалось отключить сотрудника.");
      return;
    }
    setStaffInviteStatus("Сотрудник отключён.");
    loadSellerData();
  }

  async function patchStaffMeta(linkId, patch) {
    const response = await authFetch(`${API_URL}/booking/staff/${linkId}/`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    if (!response.ok) {
      setStaffInviteStatus("Не удалось сохранить изменения.");
      return;
    }
    setStaffInviteStatus("Сохранено.");
    if (me?.role === "provider") loadSellerData();
    else loadStaffWorkspace();
  }

  async function uploadStaffCard(linkId, { avatarFile, portfolioFiles, bio } = {}) {
    const fd = new FormData();
    if (bio != null) fd.append("bio", String(bio));
    if (avatarFile) fd.append("avatar", avatarFile);
    if (Array.isArray(portfolioFiles)) {
      for (const f of portfolioFiles) {
        if (f) fd.append("portfolio_photos", f);
      }
    }
    if (bio == null && !avatarFile && (!Array.isArray(portfolioFiles) || portfolioFiles.length === 0)) return;

    const response = await authFetch(`${API_URL}/booking/staff/${linkId}/card/`, {
      method: "POST",
      body: fd,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      setStaffInviteStatus(err.detail || "Не удалось сохранить карточку сотрудника.");
      return false;
    }
    const data = await response.json().catch(() => ({}));
    if (data?.staff) {
      setOrgStaff((prev) =>
        (prev || []).map((l) => (Number(l.id) === Number(linkId) ? { ...l, ...data.staff } : l)),
      );
    }
    setStaffInviteStatus("Карточка сохранена.");
    if (me?.role === "provider") loadSellerData();
    else if (me?.role === "staff") loadStaffWorkspace();
    return true;
  }

  async function deleteStaffPortfolioPhoto(linkId, photoId) {
    const response = await authFetch(
      `${API_URL}/booking/staff/${linkId}/portfolio/${encodeURIComponent(photoId)}/`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      setStaffInviteStatus("Не удалось удалить фото.");
      return;
    }
    const data = await response.json().catch(() => null);
    if (data) {
      setOrgStaff((prev) =>
        (prev || []).map((l) => (Number(l.id) === Number(linkId) ? { ...l, ...data } : l)),
      );
    } else if (me?.role === "staff") {
      loadStaffWorkspace();
    } else {
      loadSellerData();
    }
    setStaffInviteStatus("Фото удалено.");
  }

  async function createOrgGroup(event) {
    event.preventDefault();
    setChatStatus("");
    const staffIds = groupForm.staff_ids.map(Number);
    const response = await authFetch(`${API_URL}/chat/conversations/create-group/`, {
      method: "POST",
      body: JSON.stringify({ title: groupForm.title, staff_ids: staffIds }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      setChatStatus(err.detail || "Ошибка создания группы.");
      return;
    }
    setChatStatus("");
    setGroupForm({ title: "", staff_ids: [] });
    setChatFabOpen(false);
    loadChats();
  }

  async function openDirectChatWithStaff(staffId) {
    if (!staffId) return;
    setChatStatus("");
    const response = await authFetch(`${API_URL}/chat/conversations/create-direct/`, {
      method: "POST",
      body: JSON.stringify({ staff_id: Number(staffId) }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      setChatStatus(err.detail || "Ошибка.");
      return;
    }
    const conv = await response.json();
    await loadChats();
    setSelectedChatId(conv.id);
    setChatFabOpen(false);
  }

  function displayConversationTitle(conversation) {
    if (!conversation) return "";
    if (conversation.is_saved_messages) return "Избранное";
    const local = chatLocalPrefs[conversation.id];
    if (local?.title?.trim()) return local.title.trim();
    const clientPeer = conversationClientCorrespondenceTitle(conversation, me?.id, me?.role);
    if (clientPeer) return clientPeer;
    const peer = conversationOrgDirectPeerTitle(conversation, me?.id);
    if (peer) return peer;
    return conversation.title || `Чат #${conversation.id ?? ""}`;
  }

  function conversationAvatarLetter(conversation) {
    if (conversation?.is_saved_messages) return "★";
    return displayConversationTitle(conversation).slice(0, 1).toUpperCase();
  }

  async function patchStaffPermissions(linkId, permissions) {
    const response = await authFetch(`${API_URL}/booking/staff/${linkId}/`, {
      method: "PATCH",
      body: JSON.stringify({ permissions }),
    });
    if (!response.ok) {
      setStaffInviteStatus("Не удалось сохранить права.");
      return;
    }
    setStaffInviteStatus("Права обновлены.");
    if (me?.role === "provider") loadSellerData();
    else loadStaffWorkspace();
  }

  async function patchStaffServiceAssignment(linkId, serviceIds, categoryIds) {
    const response = await authFetch(`${API_URL}/booking/staff/${linkId}/`, {
      method: "PATCH",
      body: JSON.stringify({
        assigned_service_ids: serviceIds,
        assigned_category_ids: categoryIds,
      }),
    });
    if (!response.ok) {
      setStaffInviteStatus("Не удалось сохранить услуги сотрудника.");
      return;
    }
    setStaffInviteStatus("Услуги сотрудника обновлены.");
    if (me?.role === "provider") loadSellerData();
    else loadStaffWorkspace();
  }

  function toggleStaffPermission(link, key) {
    const merged = {
      manage_bookings: true,
      manage_intervals: false,
      manage_services: false,
      manage_chats: true,
      manage_staff: false,
      can_delegate_permissions: false,
      ...(link.permissions || {}),
    };
    const next = { ...merged, [key]: !merged[key] };
    patchStaffPermissions(link.id, next);
  }

  async function fetchChatMessagesPage(conversationId, { beforeId, afterId, limit = CHAT_MSG_PAGE_SIZE } = {}) {
    if (!conversationId) return null;
    const params = new URLSearchParams({
      conversation: String(conversationId),
      limit: String(limit),
    });
    if (beforeId) params.set("before_id", String(beforeId));
    if (afterId) params.set("after_id", String(afterId));
    const res = await authFetch(`${API_URL}/chat/messages/?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  function scrollChatToBottom(smooth = false) {
    const el = chatMessagesElRef.current;
    if (!el) return;
    chatNearBottomRef.current = true;
    setChatShowJumpBottom(false);
    if (smooth) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    else el.scrollTop = el.scrollHeight;
  }

  function updateChatScrollUi(el) {
    if (!el) return;
    const distBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distBottom < 100;
    chatNearBottomRef.current = nearBottom;
    setChatShowJumpBottom(!nearBottom && el.scrollHeight > el.clientHeight + 40);
    if (el.scrollTop < 72) {
      void loadOlderChatMessages();
    }
  }

  async function loadOlderChatMessages() {
    if (!selectedChatId || chatLoadingOlderRef.current || !chatHasMoreOlderRef.current) return;
    const oldest = chatMessagesRef.current[0];
    if (!oldest) return;
    chatLoadingOlderRef.current = true;
    setChatLoadingOlder(true);
    const el = chatMessagesElRef.current;
    const prevHeight = el?.scrollHeight || 0;
    const prevTop = el?.scrollTop || 0;
    try {
      const older = await fetchChatMessagesPage(selectedChatId, {
        beforeId: oldest.id,
        limit: CHAT_MSG_PAGE_SIZE,
      });
      if (!older) return;
      setChatHasMoreOlder(older.length >= CHAT_MSG_PAGE_SIZE);
      if (!older.length) return;
      setChatMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const add = older.filter((m) => !seen.has(m.id));
        return add.length ? [...add, ...prev] : prev;
      });
      requestAnimationFrame(() => {
        const box = chatMessagesElRef.current;
        if (!box) return;
        box.scrollTop = prevTop + (box.scrollHeight - prevHeight);
      });
    } finally {
      chatLoadingOlderRef.current = false;
      setChatLoadingOlder(false);
    }
  }

  async function refreshChatMessages(conversationId = selectedChatId) {
    if (!conversationId) return;
    const current = chatMessagesRef.current;
    const lastId = current.length ? current[current.length - 1].id : null;
    if (lastId && Number(conversationId) === Number(selectedChatId)) {
      const newer = await fetchChatMessagesPage(conversationId, {
        afterId: lastId,
        limit: CHAT_MSG_PAGE_SIZE,
      });
      if (newer?.length) {
        setChatMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const add = newer.filter((m) => !seen.has(m.id));
          return add.length ? [...prev, ...add] : prev;
        });
        requestAnimationFrame(() => scrollChatToBottom(true));
        const last = newer[newer.length - 1];
        await authFetch(`${API_URL}/chat/conversations/${conversationId}/mark-read/`, {
          method: "POST",
          body: JSON.stringify({ message_id: last.id }),
        });
        loadChats();
      }
      return;
    }
    const msgs = await fetchChatMessagesPage(conversationId, { limit: CHAT_MSG_PAGE_SIZE });
    if (!msgs) return;
    setChatMessages(msgs);
    setChatHasMoreOlder(msgs.length >= CHAT_MSG_PAGE_SIZE);
    requestAnimationFrame(() => scrollChatToBottom(false));
    const last = msgs.length ? msgs[msgs.length - 1] : null;
    if (last) {
      await authFetch(`${API_URL}/chat/conversations/${conversationId}/mark-read/`, {
        method: "POST",
        body: JSON.stringify({ message_id: last.id }),
      });
      loadChats();
    }
  }

  async function postChatMessage({ text = "", file = null, kind = "", durationSec = null, displayFlip = null }) {
    if (!selectedChatId) return false;
    const hasText = Boolean(String(text || "").trim());
    if (!hasText && !file) return false;
    let response;
    if (file) {
      const fd = new FormData();
      fd.append("conversation", String(selectedChatId));
      if (hasText) fd.append("text", String(text).trim());
      if (kind) fd.append("kind", kind);
      if (durationSec != null && Number(durationSec) > 0) {
        fd.append("duration_sec", String(Math.round(Number(durationSec))));
      }
      if (displayFlip != null) {
        fd.append("display_flip", displayFlip ? "true" : "false");
      }
      fd.append("attachment", file);
      response = await authFetch(`${API_URL}/chat/messages/`, { method: "POST", body: fd });
    } else {
      response = await authFetch(`${API_URL}/chat/messages/`, {
        method: "POST",
        body: JSON.stringify({ conversation: selectedChatId, text: String(text).trim(), kind: "text" }),
      });
    }
    if (!response.ok) {
      setChatStatus("Не удалось отправить сообщение.");
      return false;
    }
    setChatInput("");
    setChatPendingFiles([]);
    setChatPendingKind("");
    setChatStatus("");
    setChatAttachMenuOpen(false);
    await refreshChatMessages(selectedChatId);
    return true;
  }

  async function sendChatMessage(event) {
    event.preventDefault();
    if (chatPendingFiles.length) {
      const caption = chatInput.trim();
      const items = [...chatPendingFiles];
      setChatPendingFiles([]);
      setChatInput("");
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        await postChatMessage({
          text: i === 0 ? caption : "",
          file: item.file,
          kind: item.kind,
        });
      }
      return;
    }
    if (!chatInput.trim()) return;
    await postChatMessage({ text: chatInput.trim() });
  }

  function openChatAttachPicker(kind) {
    setChatPendingKind(kind);
    setChatAttachMenuOpen(false);
    const input = chatFileInputRef.current;
    if (!input) return;
    input.accept = guessAttachAccept(kind === "music" ? "music" : kind);
    input.multiple = true;
    input.value = "";
    input.click();
  }

  function onChatFilePicked(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const next = files.map((file) => {
      let kind = chatPendingKind;
      if (!kind || kind === "auto") {
        if (file.type.startsWith("image/")) kind = "image";
        else if (file.type.startsWith("video/")) kind = "video";
        else if (file.type.startsWith("audio/")) kind = "voice";
        else kind = "file";
      }
      if (kind === "music") kind = "file";
      return { file, kind };
    });
    setChatPendingFiles((prev) => [...prev, ...next]);
  }

  function toggleChatComposeMode() {
    const next = chatComposeMode === "voice" ? "video_note" : "voice";
    setChatComposeMode(next);
    saveChatComposeMode(next);
  }

  function clearChatRecordMeters() {
    if (chatRecordTickRef.current) {
      clearInterval(chatRecordTickRef.current);
      chatRecordTickRef.current = null;
    }
    if (chatLevelRafRef.current) {
      cancelAnimationFrame(chatLevelRafRef.current);
      chatLevelRafRef.current = null;
    }
    if (chatAudioCtxRef.current) {
      try {
        chatAudioCtxRef.current.close();
      } catch {
        /* ignore */
      }
      chatAudioCtxRef.current = null;
      chatAnalyserRef.current = null;
    }
    setChatRecordSecs(0);
    setChatRecordLevels(Array(24).fill(0.12));
    setChatRecordLiftHint(false);
  }

  function stopMirrorPipeline() {
    const pipe = chatMirrorPipelineRef.current;
    chatMirrorPipelineRef.current = null;
    if (!pipe) return;
    if (pipe.raf) {
      try {
        cancelAnimationFrame(pipe.raf);
      } catch {
        /* ignore */
      }
    }
    if (pipe.videoEl) {
      try {
        pipe.videoEl.srcObject = null;
      } catch {
        /* ignore */
      }
    }
    if (pipe.canvasStream) {
      try {
        pipe.canvasStream.getTracks().forEach((t) => t.stop());
      } catch {
        /* ignore */
      }
    }
  }

  /** Continuous canvas capture — camera switch must NOT restart MediaRecorder. */
  async function startCanvasRecordPipeline(cameraStream, mirror) {
    stopMirrorPipeline();
    if (!cameraStream) return null;

    const videoEl = document.createElement("video");
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.setAttribute("playsinline", "true");
    videoEl.srcObject = cameraStream;
    await new Promise((resolve) => {
      const done = () => resolve();
      if (videoEl.readyState >= 1) done();
      else {
        videoEl.onloadedmetadata = done;
        window.setTimeout(done, 1200);
      }
    });
    await videoEl.play().catch(() => {});

    const size = 480;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { alpha: false });
    const pipe = {
      videoEl,
      canvas,
      canvasStream: null,
      raf: 0,
      mirror: Boolean(mirror),
    };

    const draw = () => {
      const vw = videoEl.videoWidth || size;
      const vh = videoEl.videoHeight || size;
      if (vw > 0 && vh > 0 && ctx) {
        ctx.save();
        if (pipe.mirror) {
          ctx.translate(size, 0);
          ctx.scale(-1, 1);
        }
        const scale = Math.max(size / vw, size / vh);
        const dw = vw * scale;
        const dh = vh * scale;
        ctx.drawImage(videoEl, (size - dw) / 2, (size - dh) / 2, dw, dh);
        ctx.restore();
      }
      pipe.raf = requestAnimationFrame(draw);
    };
    draw();

    const canvasStream = canvas.captureStream(30);
    pipe.canvasStream = canvasStream;
    chatMirrorPipelineRef.current = pipe;

    return new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...cameraStream.getAudioTracks(),
    ]);
  }

  async function retargetCanvasPipeline(cameraStream, mirror) {
    const pipe = chatMirrorPipelineRef.current;
    if (!pipe?.videoEl) {
      return startCanvasRecordPipeline(cameraStream, mirror);
    }
    pipe.mirror = Boolean(mirror);
    // Force pick-up of replaced camera track (same MediaStream object)
    pipe.videoEl.srcObject = null;
    pipe.videoEl.srcObject = cameraStream;
    await new Promise((resolve) => {
      const done = () => resolve();
      if (pipe.videoEl.readyState >= 1) done();
      else {
        pipe.videoEl.onloadedmetadata = done;
        window.setTimeout(done, 800);
      }
    });
    await pipe.videoEl.play().catch(() => {});
    return null;
  }

  function attachLiveCameraPreview() {
    const stream = chatCameraStreamRef.current;
    const el = chatLiveVideoRef.current;
    if (!stream || !el) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }
    el.muted = true;
    el.playsInline = true;
    el.setAttribute("playsinline", "true");
    el.play?.().catch(() => {});
  }

  function stopChatRecordTracks() {
    stopMirrorPipeline();
    const recordStream = chatRecordStreamRef.current;
    chatRecordStreamRef.current = null;
    const cameraStream = chatCameraStreamRef.current;
    chatCameraStreamRef.current = null;
    if (recordStream) {
      try {
        recordStream.getTracks().forEach((t) => t.stop());
      } catch {
        /* ignore */
      }
    }
    if (cameraStream) {
      try {
        cameraStream.getTracks().forEach((t) => t.stop());
      } catch {
        /* ignore */
      }
    }
    if (chatLiveVideoRef.current) {
      try {
        chatLiveVideoRef.current.srcObject = null;
      } catch {
        /* ignore */
      }
    }
  }

  function finishChatRecordingToPreview() {
    const chunks = chatRecordChunksRef.current.slice();
    const mime = chatRecordMimeRef.current || "application/octet-stream";
    const kind = chatRecordKindRef.current || "voice";
    const elapsed = Date.now() - chatRecordStartedAtRef.current;
    chatMediaRecorderRef.current = null;
    chatRecordChunksRef.current = [];
    setChatRecordingKind(null);
    chatRecordLockedRef.current = false;
    setChatRecordLocked(false);
    clearChatRecordMeters();
    stopChatRecordTracks();
    if (elapsed < 400 || !chunks.length) {
      return;
    }
    const blob = new Blob(chunks, { type: mime });
    if (!blob.size) return;
    const url = URL.createObjectURL(blob);
    setChatMediaPreview({
      blob,
      url,
      kind: kind === "video_note" ? "video_note" : "voice",
      mime,
      durationSec: Math.max(1, Math.round(elapsed / 1000)),
      displayFlip: false,
      fileMirrored: true,
    });
  }

  function bindChatMediaRecorder(stream) {
    const mime = chatRecordMimeRef.current;
    const recorder = mime
      ? new MediaRecorder(stream, { mimeType: mime })
      : new MediaRecorder(stream);
    if (!mime && recorder.mimeType) chatRecordMimeRef.current = recorder.mimeType;
    chatMediaRecorderRef.current = recorder;
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chatRecordChunksRef.current.push(ev.data);
    };
    recorder.onstop = () => {
      if (chatKeepRecordingRef.current) {
        chatMediaRecorderRef.current = null;
        return;
      }
      finishChatRecordingToPreview();
    };
    recorder.start(250);
    return recorder;
  }

  async function switchChatCamera() {
    if (chatRecordingKind !== "video_note" || chatCameraSwitching) return;
    const cameraStream = chatCameraStreamRef.current;
    if (!cameraStream) return;
    const wantFacing = chatCameraFacingRef.current === "user" ? "environment" : "user";
    setChatCameraSwitching(true);
    try {
      const oldVideo = cameraStream.getVideoTracks()[0] || null;
      const currentId = oldVideo?.getSettings?.().deviceId || "";
      const nextCam = await pickOtherVideoDevice(currentId, wantFacing);
      if (!nextCam?.deviceId) {
        setChatStatus("Вторая камера не найдена на этом устройстве.");
        return;
      }

      // Keep MediaRecorder running on canvas stream; only swap camera video feeding the canvas
      cameraStream.getVideoTracks().forEach((t) => {
        try {
          cameraStream.removeTrack(t);
        } catch {
          /* ignore */
        }
        try {
          t.stop();
        } catch {
          /* ignore */
        }
      });

      let fresh = null;
      let newVideo = null;
      const videoTries = [
        {
          deviceId: { exact: nextCam.deviceId },
          width: { ideal: 480 },
          height: { ideal: 480 },
        },
        {
          facingMode: { exact: wantFacing },
          width: { ideal: 480 },
          height: { ideal: 480 },
        },
        {
          facingMode: { ideal: wantFacing },
          width: { ideal: 480 },
          height: { ideal: 480 },
        },
      ];
      let lastErr = null;
      for (const video of videoTries) {
        try {
          fresh = await navigator.mediaDevices.getUserMedia({ audio: false, video });
          newVideo = fresh.getVideoTracks()[0] || null;
          if (newVideo) break;
          fresh.getTracks().forEach((t) => t.stop());
          fresh = null;
        } catch (err) {
          lastErr = err;
          fresh = null;
          newVideo = null;
        }
      }
      if (!newVideo || !fresh) {
        throw lastErr || new Error("no video");
      }

      const newId = newVideo.getSettings?.().deviceId || "";
      if (currentId && newId && currentId === newId) {
        fresh.getTracks().forEach((t) => t.stop());
        throw new Error("same camera");
      }

      cameraStream.addTrack(newVideo);
      fresh.getAudioTracks().forEach((t) => t.stop());

      const actualFacing =
        detectCameraFacingFromTrack(newVideo, nextCam.label) || wantFacing;
      chatCameraFacingRef.current = actualFacing;
      setChatCameraFacing(actualFacing);

      await retargetCanvasPipeline(cameraStream, actualFacing === "user");
      attachLiveCameraPreview();
    } catch {
      setChatStatus("Не удалось переключить камеру.");
      const cam = chatCameraStreamRef.current;
      if (cam && !cam.getVideoTracks().length) {
        try {
          const fallback = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: { ideal: chatCameraFacingRef.current || "user" },
              width: { ideal: 480 },
              height: { ideal: 480 },
            },
          });
          const vt = fallback.getVideoTracks()[0];
          if (vt) cam.addTrack(vt);
          fallback.getAudioTracks().forEach((t) => t.stop());
          const facing = chatCameraFacingRef.current || "user";
          await retargetCanvasPipeline(cam, facing === "user");
          attachLiveCameraPreview();
        } catch {
          /* ignore */
        }
      }
    } finally {
      setChatCameraSwitching(false);
    }
  }

  async function startChatRecording(kind) {
    if (chatRecordingKind || chatMediaPreview || !selectedChatId) return;
    try {
      const facing = chatCameraFacingRef.current || "user";
      const constraints =
        kind === "video_note"
          ? {
              audio: true,
              video: {
                facingMode: { ideal: facing },
                width: { ideal: 480 },
                height: { ideal: 480 },
              },
            }
          : { audio: true };
      const cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      chatCameraStreamRef.current = kind === "video_note" ? cameraStream : null;
      const actualFacing =
        kind === "video_note"
          ? detectCameraFacingFromTrack(cameraStream.getVideoTracks()[0]) || facing || "user"
          : facing;
      if (kind === "video_note") {
        chatCameraFacingRef.current = actualFacing;
        setChatCameraFacing(actualFacing);
      }
      const recordStream =
        kind === "video_note"
          ? await startCanvasRecordPipeline(cameraStream, actualFacing === "user")
          : cameraStream;
      if (!recordStream) throw new Error("no record stream");
      chatRecordStreamRef.current = recordStream;
      chatRecordChunksRef.current = [];
      const mime = pickRecorderMime(kind);
      chatRecordMimeRef.current = mime || (kind === "video_note" ? "video/webm" : "audio/webm");
      chatRecordKindRef.current = kind;
      chatKeepRecordingRef.current = false;
      bindChatMediaRecorder(recordStream);
      chatRecordStartedAtRef.current = Date.now();
      setChatRecordingKind(kind);
      chatRecordLockedRef.current = false;
      setChatRecordLocked(false);
      setChatRecordSecs(0);
      chatRecordTickRef.current = setInterval(() => {
        setChatRecordSecs(Math.floor((Date.now() - chatRecordStartedAtRef.current) / 1000));
      }, 250);

      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          const source = ctx.createMediaStreamSource(cameraStream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          chatAudioCtxRef.current = ctx;
          chatAnalyserRef.current = analyser;
          const data = new Uint8Array(analyser.frequencyBinCount);
          const tickLevels = () => {
            if (!chatAnalyserRef.current) return;
            chatAnalyserRef.current.getByteFrequencyData(data);
            const step = Math.max(1, Math.floor(data.length / 24));
            const next = [];
            for (let i = 0; i < 24; i += 1) {
              next.push(Math.min(1, (data[i * step] || 0) / 180));
            }
            setChatRecordLevels(next);
            chatLevelRafRef.current = requestAnimationFrame(tickLevels);
          };
          tickLevels();
        }
      } catch {
        /* analyser optional */
      }
    } catch (_e) {
      setChatStatus("Нет доступа к микрофону/камере.");
      setChatRecordingKind(null);
      chatRecordLockedRef.current = false; setChatRecordLocked(false);
      clearChatRecordMeters();
      stopChatRecordTracks();
    }
  }

  function stopChatRecording() {
    const rec = chatMediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      try {
        if (typeof rec.requestData === "function") rec.requestData();
        rec.stop();
      } catch {
        setChatRecordingKind(null);
        chatRecordLockedRef.current = false; setChatRecordLocked(false);
        clearChatRecordMeters();
        stopChatRecordTracks();
      }
    } else {
      setChatRecordingKind(null);
      chatRecordLockedRef.current = false; setChatRecordLocked(false);
      clearChatRecordMeters();
      stopChatRecordTracks();
    }
  }

  function cancelChatRecording() {
    const rec = chatMediaRecorderRef.current;
    chatRecordChunksRef.current = [];
    chatRecordStartedAtRef.current = Date.now();
    if (rec && rec.state !== "inactive") {
      try {
        rec.onstop = () => {
          chatMediaRecorderRef.current = null;
          setChatRecordingKind(null);
          chatRecordLockedRef.current = false; setChatRecordLocked(false);
          clearChatRecordMeters();
          stopChatRecordTracks();
        };
        rec.stop();
      } catch {
        setChatRecordingKind(null);
        chatRecordLockedRef.current = false; setChatRecordLocked(false);
        clearChatRecordMeters();
        stopChatRecordTracks();
      }
    } else {
      setChatRecordingKind(null);
      chatRecordLockedRef.current = false; setChatRecordLocked(false);
      clearChatRecordMeters();
      stopChatRecordTracks();
    }
  }

  function discardChatMediaPreview() {
    if (chatMediaPreview?.url) URL.revokeObjectURL(chatMediaPreview.url);
    setChatMediaPreview(null);
  }

  async function sendChatMediaPreview() {
    if (!chatMediaPreview) return;
    const { blob, kind, mime, durationSec, displayFlip } = chatMediaPreview;
    const file = await blobToFile(
      blob,
      kind === "video_note" ? `video_note_${Date.now()}.webm` : `voice_${Date.now()}.webm`,
      mime
    );
    discardChatMediaPreview();
    await postChatMessage({
      file,
      kind,
      durationSec,
      displayFlip: kind === "video_note" ? Boolean(displayFlip) : null,
    });
  }

  function onComposeActionPointerDown(e) {
    if (chatInput.trim() || chatPendingFiles.length || chatMediaPreview) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    chatDidHoldRef.current = false;
    chatPointerStartYRef.current = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    chatRecordLiftHintRef.current = false;
    setChatRecordLiftHint(false);
    if (chatHoldTimerRef.current) clearTimeout(chatHoldTimerRef.current);
    // Short tap toggles voice/circle; hold ~0.45s starts recording (clicks often last >200ms).
    chatHoldTimerRef.current = setTimeout(() => {
      chatDidHoldRef.current = true;
      startChatRecording(chatComposeMode);
    }, 450);
  }

  function onComposeActionPointerMove(e) {
    if (!chatRecordingKind || chatRecordLockedRef.current) return;
    const y = e.clientY ?? e.touches?.[0]?.clientY ?? chatPointerStartYRef.current;
    const dy = chatPointerStartYRef.current - y;
    const lifted = dy > 40;
    chatRecordLiftHintRef.current = lifted;
    setChatRecordLiftHint(lifted);
    if (dy > 90) {
      chatRecordLockedRef.current = true;
      chatRecordLiftHintRef.current = false;
      setChatRecordLocked(true);
      setChatRecordLiftHint(false);
    }
  }

  function onComposeActionPointerUp(e) {
    if (chatHoldTimerRef.current) {
      clearTimeout(chatHoldTimerRef.current);
      chatHoldTimerRef.current = null;
    }
    try {
      e?.currentTarget?.releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    if (chatRecordingKind) {
      if (chatRecordLockedRef.current) return;
      if (chatRecordLiftHintRef.current) {
        chatRecordLockedRef.current = true;
        chatRecordLiftHintRef.current = false;
        setChatRecordLocked(true);
        setChatRecordLiftHint(false);
        return;
      }
      stopChatRecording();
      return;
    }
    if (!chatDidHoldRef.current) toggleChatComposeMode();
  }

  function onCircleSeekPointer(e, mediaEl) {
    if (!mediaEl || !Number.isFinite(mediaEl.duration) || mediaEl.duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const x = (e.clientX ?? e.touches?.[0]?.clientX) - cx;
    const y = (e.clientY ?? e.touches?.[0]?.clientY) - cy;
    let angle = Math.atan2(y, x); // -PI..PI, 0 at east
    angle = (angle + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2); // 0 at north, clockwise
    mediaEl.currentTime = (angle / (Math.PI * 2)) * mediaEl.duration;
  }

  function persistChatVisualSettings() {
    if (chatSettingsForId == null) return;
    let prev = {};
    try {
      prev = JSON.parse(localStorage.getItem(chatPrefsStorageKey(chatSettingsForId)) || "{}");
    } catch {
      prev = {};
    }
    const next = { ...prev };
    if (chatSettingsTitle.trim()) next.title = chatSettingsTitle.trim();
    else delete next.title;
    if (chatSettingsAvatar) next.avatarDataUrl = chatSettingsAvatar;
    else delete next.avatarDataUrl;
    if (chatSettingsWallpaper) next.wallpaper = chatSettingsWallpaper;
    else delete next.wallpaper;
    delete next.memberNames;
    try {
      localStorage.setItem(chatPrefsStorageKey(chatSettingsForId), JSON.stringify(next));
      setChatLocalPrefs((p) => ({ ...p, [chatSettingsForId]: next }));
    } catch (_e) {
      setChatStatus("Не удалось сохранить настройки (лимит хранилища браузера).");
      return;
    }
    const notify = {};
    if (chatSettingsNotify === "off") notify.muted = true;
    else if (chatSettingsNotify === "1h") notify.mutedUntil = Date.now() + 3600000;
    else if (chatSettingsNotify === "2h") notify.mutedUntil = Date.now() + 7200000;
    else if (chatSettingsNotify === "8h") notify.mutedUntil = Date.now() + 28800000;
    try {
      if (Object.keys(notify).length) localStorage.setItem(chatNotifyStorageKey(chatSettingsForId), JSON.stringify(notify));
      else localStorage.removeItem(chatNotifyStorageKey(chatSettingsForId));
    } catch {
      // ignore
    }
    setChatSettingsForId(null);
    setChatStatus("");
    setCustomColorPickerOpen(false);
  }

  function clearChatVisualSettings() {
    if (chatSettingsForId == null) return;
    localStorage.removeItem(chatNotifyStorageKey(chatSettingsForId));
    localStorage.removeItem(chatPrefsStorageKey(chatSettingsForId));
    setChatLocalPrefs((prev) => {
      const copy = { ...prev };
      delete copy[chatSettingsForId];
      return copy;
    });
    const sel = conversations.find((c) => c.id === chatSettingsForId);
    setChatSettingsTitle(defaultChatListNameForConversation(sel, me?.id));
    setChatSettingsAvatar("");
    setChatSettingsWallpaper("#dfe9e2");
    setChatSettingsForId(null);
  }

  function toggleGroupStaff(id) {
    const n = Number(id);
    setGroupForm((prev) => ({
      ...prev,
      staff_ids: prev.staff_ids.includes(n) ? prev.staff_ids.filter((x) => x !== n) : [...prev.staff_ids, n],
    }));
  }

  function toggleGroupAddStaff(id) {
    const n = Number(id);
    setGroupAddStaffIds((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  }

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

  async function addMembersToSelectedGroup() {
    if (!selectedChatId || !groupAddStaffIds.length) return;
    setGroupAddStatus("");
    const response = await authFetch(`${API_URL}/chat/conversations/${selectedChatId}/add-members/`, {
      method: "POST",
      body: JSON.stringify({ staff_ids: groupAddStaffIds.map(Number) }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      setGroupAddStatus(err.detail || "Не удалось добавить участников.");
      return;
    }
    const data = await response.json();
    if (data.conversation) {
      setConversations((prev) =>
        prev.map((c) => (Number(c.id) === Number(data.conversation.id) ? data.conversation : c))
      );
    } else {
      await loadChats();
    }
    setGroupAddStaffIds([]);
    setChatMembersView("list");
    setGroupAddStatus(data.added ? `Добавлено: ${data.added}` : "Уже в группе.");
  }

  async function deleteGroupChat(conv) {
    const target = conv || selectedConv;
    const chatId = target?.id ?? selectedChatId;
    if (!chatId || !target?.is_group) return;
    if (me?.role !== "provider" || Number(target.organization) !== Number(me?.id)) return;
    if (!window.confirm("Удалить группу для всех участников? Это действие нельзя отменить.")) return;
    setChatInfoHeadMenuOpen(false);
    setChatRowMenuId(null);
    const response = await authFetch(`${API_URL}/chat/conversations/${chatId}/delete-group/`, {
      method: "POST",
      body: "{}",
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      showToast(err.detail || "Не удалось удалить группу.");
      return;
    }
    setChatInfoOpen(false);
    setChatMembersView(null);
    if (Number(selectedChatId) === Number(chatId)) setSelectedChatId(null);
    setConversations((prev) => prev.filter((c) => Number(c.id) !== Number(chatId)));
    showToast("Группа удалена.");
  }

  function isBookmarkAvailable(id) {
    const role = me?.role;
    if (!role) return false;
    const def = BOOKMARK_CATALOG.find((b) => b.id === id);
    if (!def || !def.roles.includes(role)) return false;
    if (id === "reviews" && !canViewOrgReviews()) return false;
    if (id === "analytics" && role === "staff") {
      const sphere = orgSphereOf(me);
      if (sphere === "cafe_restaurant") {
        if (
          !staffHasPerm("cafe_orders") &&
          !staffHasPerm("cafe_kitchen") &&
          !staffHasPerm("cafe_settings")
        ) {
          return false;
        }
      } else if (sphere === "marketplaces") {
        if (!staffHasPerm("marketplace_manage_orders") && !staffHasPerm("marketplace_manage_catalog")) {
          return false;
        }
      } else if (!staffHasPerm("manage_bookings")) {
        return false;
      }
    }
    if (role === "staff") {
      if (id === "bookings" && !staffHasPerm("manage_bookings")) return false;
      if (id === "intervals" && !staffHasPerm("manage_intervals")) return false;
      if (id === "services" && !staffHasPerm("manage_services")) return false;
      if (id === "chats" && !staffHasPerm("manage_chats") && !staffHasPerm("manage_client_chats")) return false;
    }
    if (id === "organization" && !canManageOrgSettings) return false;
    if (id === "staff" && !canAccessStaffPage) return false;
    if (id === "activity" && role !== "client") return false;
    if (me?.provider_sphere === "cafe_restaurant" || me?.employer_sphere === "cafe_restaurant") {
      if (
        id === "intervals" ||
        id === "bookings" ||
        id === "services" ||
        id === "my_bookings" ||
        id === "booking_history"
      ) {
        return false;
      }
      if ((id === "cafe" || id === "cafe_orders") && !isCafeOrgUser) return false;
      if (id === "cafe" && role === "staff" && !staffHasPerm("cafe_menu") && !staffHasPerm("cafe_settings") && !staffHasPerm("cafe_seating")) {
        return false;
      }
      if (
        id === "cafe_orders" &&
        role === "staff" &&
        !staffHasPerm("cafe_orders") &&
        !staffHasPerm("cafe_kitchen") &&
        !staffHasPerm("cafe_seating") &&
        !staffHasPerm("cafe_delivery")
      ) {
        return false;
      }
    } else if (id === "cafe" || id === "cafe_orders") {
      return false;
    }
    if (id === "cafe_my_orders" || id === "loyalty") {
      return role === "client";
    }
    if (me?.provider_sphere === "marketplaces" || me?.employer_sphere === "marketplaces") {
      if (id === "intervals" || id === "bookings" || id === "services" || id === "my_bookings") return false;
      if (id === "analytics" || id === "reviews") {
        // Маркетплейсы: открываем внутренние вкладки кабинета
        return role === "provider" || role === "staff";
      }
      if (id === "marketplaces") {
        if (role === "provider") return me?.provider_sphere === "marketplaces";
        if (role === "staff") {
          return (
            staffHasPerm("marketplace_manage_orders") ||
            staffHasPerm("marketplace_manage_catalog") ||
            staffHasPerm("marketplace_view_keys")
          );
        }
        return false;
      }
    } else if (id === "marketplaces") {
      return false;
    }
    if (id === "inspections") {
      if (role === "client") return true;
      if (role === "provider") return me?.provider_sphere === "service_center";
      if (role === "staff") {
        return (
          (staffHasPerm("manage_inspections") || staffHasPerm("manage_bookings")) &&
          (me?.provider_sphere === "service_center" || me?.employer_sphere === "service_center")
        );
      }
      return false;
    }
    if (id === "service_apps" || id === "vmenu") return Boolean(accessToken);
    return true;
  }

  function navigateBookmark(id) {
    setMenuOpen(false);
    if (id === "chats" && isMobileChatLayout()) setSelectedChatId(null);
    if (id === "reviews") {
      if (me?.provider_sphere === "marketplaces" || me?.employer_sphere === "marketplaces") {
        setMarketplaceInitialTab("reviews");
        setCurrentView("marketplaces");
        return;
      }
      openProviderReviews();
      return;
    }
    if (id === "analytics" && (me?.provider_sphere === "marketplaces" || me?.employer_sphere === "marketplaces")) {
      setMarketplaceInitialTab("analytics");
      setCurrentView("marketplaces");
      return;
    }
    if (id === "cafe") setCafeWorkspaceTab("floor");
    setCurrentView(id);
  }

  function toggleSubnavBookmark(id) {
    setSubnavBookmarks((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev;
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  }

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

  async function loadClientBookings() {
    await reloadBookingsList();
  }

  async function loadCatalogStatus() {
    const res = await authFetch(`${API_URL}/catalog/seed-catalog/`);
    if (res.ok) setCatalogStatus(await res.json());
  }

  async function seedProviderCatalog() {
    if (!me?.provider_sphere) {
      setSellerStatus("Укажите сферу услуг в настройках организации.");
      return;
    }
    setCatalogSeeding(true);
    setSellerStatus("");
    const res = await authFetch(`${API_URL}/catalog/seed-catalog/`, {
      method: "POST",
      body: JSON.stringify({ sphere: me.provider_sphere }),
    });
    setCatalogSeeding(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setSellerStatus(formatApiError(err, res.status) || "Не удалось загрузить каталог.");
      return;
    }
    const data = await res.json();
    setCatalogStatus(data);
    const created = data.stats?.services_created ?? 0;
    setSellerStatus(
      created > 0
        ? `Каталог загружен: ${created} услуг. Включите нужные позиции и укажите цены.`
        : "Каталог обновлён. Проверьте цены и включите нужные услуги.",
    );
    await loadSellerData();
    const openCats = {};
    for (const c of categories) openCats[c.id] = false;
    setCategoryOpen((prev) => ({ ...openCats, ...prev }));
    setSubcategoryOpen((prev) => ({ ...prev }));
  }

  function updateServiceDraft(serviceId, patch) {
    setServiceDrafts((prev) => {
      const base =
        prev[serviceId] ?? buildServiceDraftFromService(services.find((s) => Number(s.id) === Number(serviceId)) || {});
      return { ...prev, [serviceId]: { ...base, ...patch } };
    });
  }

  async function uploadServicePhotos(serviceId, fileList) {
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) return;
    const fd = new FormData();
    files.forEach((f) => fd.append("photos", f));
    const res = await authFetch(`${API_URL}/catalog/services/${serviceId}/photos/`, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setSellerStatus(err.detail || "Не удалось загрузить фото услуги.");
      return;
    }
    const data = await res.json();
    setServices((prev) =>
      prev.map((s) =>
        Number(s.id) === Number(serviceId)
          ? { ...s, photos: data.photos || s.photos, gallery: data.gallery || s.gallery }
          : s,
      ),
    );
    setSellerStatus("Фото услуги добавлены.");
  }

  async function deleteServicePhoto(serviceId, photoId) {
    const res = await authFetch(`${API_URL}/catalog/services/${serviceId}/photos/${photoId}/`, {
      method: "DELETE",
    });
    if (!res.ok) {
      setSellerStatus("Не удалось удалить фото.");
      return;
    }
    setServices((prev) =>
      prev.map((s) => {
        if (Number(s.id) !== Number(serviceId)) return s;
        const photos = (s.photos || []).filter((p) => Number(p.id) !== Number(photoId));
        const gallery = (s.gallery || []).filter(
          (p) => !(p.source === "service" && Number(p.id) === Number(photoId)),
        );
        return { ...s, photos, gallery };
      }),
    );
  }

  const dirtyServiceCount = useMemo(
    () => services.filter((s) => !serviceDraftEqualsService(serviceDrafts[s.id], s)).length,
    [services, serviceDrafts],
  );

  const staffAssignableServices = useMemo(
    () =>
      services.filter((s) => {
        const draft = serviceDrafts[s.id];
        if (draft) return Boolean(draft.is_active);
        return Boolean(s.is_active);
      }),
    [services, serviceDrafts],
  );

  const staffAssignableCategories = useMemo(() => {
    const categoryIds = new Set(
      staffAssignableServices.map((s) => Number(s.category)).filter((id) => Number.isFinite(id) && id > 0),
    );
    return categories.filter((cat) => categoryIds.has(Number(cat.id)));
  }, [categories, staffAssignableServices]);

  async function saveAllServiceChanges() {
    const dirty = services.filter((s) => !serviceDraftEqualsService(serviceDrafts[s.id], s));
    if (!dirty.length) {
      setSellerStatus("Нет изменений для сохранения.");
      return;
    }
    setServiceSavingAll(true);
    setSellerStatus("");
    const results = await Promise.all(
      dirty.map((s) => {
        const d = serviceDrafts[s.id];
        return authFetch(`${API_URL}/catalog/services/${s.id}/`, {
          method: "PATCH",
          body: JSON.stringify({
            price: Number(d.price),
            duration_minutes: Number(d.duration_minutes),
            is_active: d.is_active,
          }),
        });
      }),
    );
    setServiceSavingAll(false);
    const failed = results.filter((r) => !r.ok).length;
    if (failed) {
      setSellerStatus(`Не удалось сохранить ${failed} из ${dirty.length} услуг.`);
      return;
    }
    setServices((prev) =>
      prev.map((s) => {
        const d = serviceDrafts[s.id];
        if (!dirty.some((x) => x.id === s.id)) return s;
        return {
          ...s,
          price: Number(d.price),
          duration_minutes: Number(d.duration_minutes),
          is_active: d.is_active,
        };
      }),
    );
    setServiceDrafts((prev) => {
      const next = { ...prev };
      for (const s of dirty) {
        next[s.id] = { ...serviceDrafts[s.id] };
      }
      return next;
    });
    setSellerStatus(`Сохранено услуг: ${dirty.length}.`);
  }

  async function updateService(id, patch) {
    const response = await authFetch(`${API_URL}/catalog/services/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    if (!response.ok) return setSellerStatus("Ошибка обновления услуги.");
    setSellerStatus("Услуга обновлена.");
    loadSellerData();
  }

  async function createManualHold(event) {
    event?.preventDefault?.();
    if (!manualHoldForm.date || !manualHoldForm.start_time || !manualHoldForm.end_time) {
      setManualHoldStatus("Укажите дату и время.");
      return;
    }
    const start = new Date(`${manualHoldForm.date}T${manualHoldForm.start_time}:00`);
    const end = new Date(`${manualHoldForm.date}T${manualHoldForm.end_time}:00`);
    if (!(start < end)) {
      setManualHoldStatus("Начало должно быть раньше конца.");
      return;
    }
    setManualHoldBusy(true);
    setManualHoldStatus("");
    const response = await authFetch(`${API_URL}/booking/slots/manual-hold/`, {
      method: "POST",
      body: JSON.stringify({
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        guest_name: (manualHoldForm.guest_name || "").trim(),
      }),
    });
    setManualHoldBusy(false);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      setManualHoldStatus(err.detail || "Не удалось забронировать интервал.");
      return;
    }
    setManualHoldStatus("Интервал забронирован.");
    setManualHoldForm((p) => ({ ...p, guest_name: "" }));
    await loadSellerData();
  }

  async function releaseManualHold(slotId) {
    const rawId = String(slotId ?? "").replace(/^hold-/, "");
    const response = await authFetch(`${API_URL}/booking/slots/${rawId}/release-hold/`, {
      method: "POST",
      body: "{}",
    });
    if (!(response.ok || response.status === 204)) {
      const err = await response.json().catch(() => ({}));
      setSellerStatus(err.detail || "Не удалось снять бронь.");
      return;
    }
    setSellerStatus("Ручная бронь снята.");
    await loadSellerData();
  }

  async function addAnonymousSeat() {
    const next = (Number(me?.anonymous_seat_count) || 0) + 1;
    const response = await authFetch(`${API_URL}/users/me/`, {
      method: "PATCH",
      body: JSON.stringify({ anonymous_seat_count: next }),
    });
    if (!response.ok) {
      setSellerStatus("Не удалось добавить место «Без сотрудников».");
      return;
    }
    const data = await response.json();
    setMe((prev) => ({ ...prev, ...data }));
    setIntervalForm((p) => ({ ...p, assignee: `anon:${next}` }));
    setSellerStatus(`Добавлено: Без сотрудников ${next}`);
  }

  async function createSlot(event) {
    event.preventDefault();
    const response = await authFetch(`${API_URL}/booking/slots/`, { method: "POST", body: JSON.stringify(slotForm) });
    if (!response.ok) return setSellerStatus("Ошибка при создании слота.");
    setSlotForm({ starts_at: "", ends_at: "" });
    setSellerStatus("Слот создан.");
    loadSellerData();
  }

  async function createSlotsByInterval(event) {
    event.preventDefault();
    if (!intervalForm.start_time || !intervalForm.end_time) {
      setSellerStatus("Укажи время начала и окончания.");
      return;
    }
    const baseDate = intervalForm.date || new Date().toISOString().slice(0, 10);
    const baseStart = new Date(`${baseDate}T${intervalForm.start_time}:00`);
    const baseEnd = new Date(`${baseDate}T${intervalForm.end_time}:00`);
    if (baseStart >= baseEnd) return setSellerStatus("Время начала должно быть раньше окончания.");
    const assignee = parseIntervalAssignee(intervalForm.assignee);
    const templateStaffId = assignee.staff_id;
    const templateAnon = assignee.anonymous_index;
    const hasDuplicate = savedIntervals.some(
      (s) =>
        s.start_time === intervalForm.start_time &&
        s.end_time === intervalForm.end_time &&
        (s.staff_id ?? null) === templateStaffId &&
        (s.anonymous_index ?? null) === templateAnon,
    );
    if (hasDuplicate) {
      const msg = "Такой интервал уже есть в сохранённых — выбери другой диапазон времени или сотрудника.";
      setSellerStatus(msg);
      showIntervalToast(msg);
      return;
    }
    if (templateStaffId == null && templateAnon == null) {
      setSellerStatus("Выбери сотрудника или место «Без сотрудников».");
      return;
    }
    if (templateAnon != null && !(intervalForm.service_ids || []).length) {
      setSellerStatus("Для «Без сотрудников» выберите хотя бы одну услугу.");
      return;
    }
    const template = {
      id: `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      start_time: intervalForm.start_time,
      end_time: intervalForm.end_time,
      staff_id: templateStaffId,
      anonymous_index: templateAnon,
      service_ids:
        templateAnon != null
          ? (intervalForm.service_ids || []).map((x) => Number(x)).filter((n) => Number.isFinite(n))
          : [],
    };
    setSavedIntervals((prev) => [template, ...prev]);
    setSelectedIntervalId(template.id);
    setSellerStatus("Интервал сохранён. Нажми на день в календаре для применения.");
  }

  async function applyIntervalToDay(day, template) {
    if (!template) return;
    const date = `${calendarMonth}-${String(day).padStart(2, "0")}`;
    const check = validateIntervalForDate(date, template);
    if (!check.ok) {
      setSellerStatus(check.reason);
      showIntervalToast(check.reason);
      return;
    }
    const start = new Date(`${date}T${template.start_time}:00`);
    const end = new Date(`${date}T${template.end_time}:00`);
    if (start >= end) {
      setSellerStatus("Некорректный интервал: начало позже конца.");
      return;
    }
    const response = await authFetch(`${API_URL}/booking/slots/`, {
      method: "POST",
      body: JSON.stringify({
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        ...(template.staff_id != null ? { staff: template.staff_id } : {}),
        ...(template.anonymous_index != null ? { anonymous_index: template.anonymous_index } : {}),
        ...(Array.isArray(template.service_ids) && template.service_ids.length
          ? { service_ids: template.service_ids }
          : {}),
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const detail = err?.detail || "Не удалось применить интервал на день.";
      showIntervalToast(detail);
      setSellerStatus(detail);
      return;
    }
    setSellerStatus(`Интервал применён на ${date}.`);
    loadSellerData();
  }

  async function applyIntervalByPattern(pattern, template) {
    if (!template) return;
    const [year, month] = calendarMonth.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const targets = [];
    for (let day = 1; day <= daysInMonth; day += 1) {
      const d = new Date(year, month - 1, day);
      const wd = d.getDay(); // 0..6
      const isWorkday = wd >= 1 && wd <= 5;
      const isWeekend = wd === 0 || wd === 6;
      if (pattern === "daily") targets.push(day);
      if (pattern === "workweek" && isWorkday) targets.push(day);
      if (pattern === "weekend" && isWeekend) targets.push(day);
    }
    let success = 0;
    let failed = 0;
    let skipped = 0;
    const errors = [];
    for (const day of targets) {
      const date = `${calendarMonth}-${String(day).padStart(2, "0")}`;
      const check = validateIntervalForDate(date, template);
      if (!check.ok) {
        skipped += 1;
        errors.push(check.reason);
        continue;
      }
      const start = new Date(`${date}T${template.start_time}:00`);
      const end = new Date(`${date}T${template.end_time}:00`);
      const response = await authFetch(`${API_URL}/booking/slots/`, {
        method: "POST",
        body: JSON.stringify({
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          ...(template.staff_id != null ? { staff: template.staff_id } : {}),
          ...(template.anonymous_index != null ? { anonymous_index: template.anonymous_index } : {}),
          ...(Array.isArray(template.service_ids) && template.service_ids.length
            ? { service_ids: template.service_ids }
            : {}),
        }),
      });
      if (response.ok) {
        success += 1;
      } else {
        failed += 1;
        const err = await response.json().catch(() => ({}));
        const detail = err?.detail || `Ошибка применения на ${date}`;
        errors.push(detail);
      }
    }
    const unique = [...new Set(errors)];
    if (unique.length) {
      showIntervalToast(unique.length === 1 ? unique[0] : `${unique[0]} (+ещё ${unique.length - 1})`);
    }
    setSellerStatus(`Применено: ${success}, пропущено: ${skipped}, ошибок: ${failed}`);
    loadSellerData();
  }

  function validateIntervalForDate(date, template) {
    const start = new Date(`${date}T${template.start_time}:00`);
    const end = new Date(`${date}T${template.end_time}:00`);
    if (start >= end) return { ok: false, reason: "Некорректный интервал: время начала должно быть раньше окончания." };

    const startMs = start.getTime();
    const endMs = end.getTime();
    // Разрешаем пересечение с уже занятими слотами (запись внутри рабочего интервала).
    // Запрещаем только перекрытие с существующими свободными интервалами.
    const daySlots = slots.filter((s) => s.starts_at?.slice(0, 10) === date && !s.is_booked);
    for (const slot of daySlots) {
      if (!intervalStaffConflicts(template, slot)) continue;
      const slotStartMs = new Date(slot.starts_at).getTime();
      const slotEndMs = new Date(slot.ends_at).getTime();
      const sameBounds = slotStartMs === startMs && slotEndMs === endMs;
      if (sameBounds) {
        return { ok: false, reason: `Интервал ${template.start_time}-${template.end_time} уже применён на ${date}.` };
      }
      const overlaps = startMs < slotEndMs && slotStartMs < endMs;
      if (overlaps) {
        return { ok: false, reason: `Интервал пересекается с существующим на ${date}.` };
      }
    }
    return { ok: true };
  }

  async function deleteSlot(slotId) {
    const response = await authFetch(`${API_URL}/booking/slots/${slotId}/`, { method: "DELETE" });
    if (!response.ok) return setSellerStatus("Не удалось удалить интервал.");
    setSellerStatus("Интервал удален.");
    setCalendarDayDetail((prev) => {
      if (!prev || prev.mode !== "intervals") return prev;
      const items = (prev.items || []).filter((x) => Number(x.id) !== Number(slotId));
      return { ...prev, items };
    });
    loadSellerData();
  }

  async function deleteSeries(group) {
    if (!group) return;
    const response = await authFetch(
      `${API_URL}/booking/slots/delete-series/?recurrence_group=${encodeURIComponent(group)}`,
      { method: "DELETE" }
    );
    if (!response.ok) return setSellerStatus("Не удалось удалить серию интервалов.");
    const data = await response.json();
    setSellerStatus(`Удалено интервалов в серии: ${data.deleted ?? 0}`);
    loadSellerData();
  }

  async function updateProfile(event) {
    event.preventDefault();
    const response = await authFetch(`${API_URL}/users/me/`, {
      method: "PATCH",
      body: JSON.stringify(profileForm),
    });
    if (!response.ok) return setStatus("Не удалось сохранить личные данные.");
    showToast("Данные сохранены");
    setStatus("Данные сохранены.");
    loadMe();
  }

  async function changePassword(event) {
    event.preventDefault();
    const response = await authFetch(`${API_URL}/users/change-password/`, {
      method: "POST",
      body: JSON.stringify(passwordForm),
    });
    const data = await response.json().catch(() => ({}));
    const detail = data.detail || (response.ok ? "Проверьте почту для подтверждения смены пароля." : "Не удалось сменить пароль.");
    if (!response.ok) return setStatus(detail);
    showToast(detail, { tone: "success", ms: 14000 });
    setStatus(detail);
    setPasswordForm({ old_password: "", new_password: "", new_password_confirm: "" });
  }

  async function requestPasswordResetFromSettings() {
    if (me?.is_demo) {
      setStatus("В демо-режиме пароль сбрасывать нельзя.");
      return;
    }
    setPasswordResetBusy(true);
    const response = await authFetch(`${API_URL}/users/request-password-reset/`, { method: "POST", body: "{}" });
    const data = await response.json().catch(() => ({}));
    const detail = data.detail || (response.ok ? "Проверьте почту — мы отправили ссылку для сброса." : "Не удалось отправить ссылку.");
    setPasswordResetBusy(false);
    if (!response.ok) return setStatus(detail);
    showToast(detail, { tone: "success", ms: 14000 });
    setStatus(detail);
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

  async function confirmPasswordReset(event) {
    event.preventDefault();
    if (!passwordResetToken) {
      setAuthStatus("Ссылка недействительна. Запросите сброс ещё раз.");
      return;
    }
    setPasswordResetBusy(true);
    const response = await fetch(`${API_URL}/users/confirm-password-reset/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: passwordResetToken,
        new_password: resetForm.new_password,
        new_password_confirm: resetForm.new_password_confirm,
      }),
    });
    const data = await response.json().catch(() => ({}));
    setPasswordResetBusy(false);
    const detail = data.detail || formatApiError(data, response.status) || (response.ok ? "Пароль обновлён." : "Не удалось сохранить пароль.");
    setAuthStatus(detail);
    if (!response.ok) return setStatus(detail);
    showToast(detail, { tone: "success", ms: 10000 });
    setPasswordResetToken("");
    setResetForm({ new_password: "", new_password_confirm: "" });
    window.history.replaceState({}, document.title, "/");
    if (accessToken) {
      setShowAuthModal(false);
      setStatus(detail);
    } else {
      openAuth("login");
    }
  }

  async function changeEmail(event) {
    event.preventDefault();
    const response = await authFetch(`${API_URL}/users/change-email/`, {
      method: "POST",
      body: JSON.stringify(emailForm),
    });
    const data = await response.json().catch(() => ({}));
    const detail = data.detail || (response.ok ? "Email изменен. Подтверди его по письму." : "Не удалось сменить email.");
    if (!response.ok) return setStatus(detail);
    showToast(detail, { tone: "success", ms: 14000 });
    setStatus(detail);
    loadMe();
  }

  async function saveProviderOrganization(event) {
    event.preventDefault();
    const isMp = me?.provider_sphere === "marketplaces";
    const response = await authFetch(`${API_URL}/users/me/`, {
      method: "PATCH",
      body: JSON.stringify(
        isMp
          ? {
              organization_name: orgAddressForm.organization_name,
              organization_address: "",
              organization_entrance: "",
              organization_floor: "",
              organization_apartment: "",
              organization_intercom: "",
              organization_address_extra: "",
              organization_latitude: null,
              organization_longitude: null,
            }
          : {
              organization_name: orgAddressForm.organization_name,
              organization_address:
                simplifyCommaAddressLine((orgAddressForm.organization_address || "").trim()) ||
                (orgAddressForm.organization_address || "").trim(),
              organization_entrance: (orgAddressForm.entrance || "").trim(),
              organization_floor: (orgAddressForm.floor || "").trim(),
              organization_apartment: (orgAddressForm.apartment || "").trim(),
              organization_intercom: (orgAddressForm.intercom || "").trim(),
              organization_address_extra: (orgAddressForm.organization_address_details || "").trim(),
              organization_latitude: orgAddressForm.organization_latitude,
              organization_longitude: orgAddressForm.organization_longitude,
            },
      ),
    });
    if (!response.ok) {
      setProfileOrgStatus(isMp ? "Не удалось сохранить название." : "Не удалось сохранить адрес организации.");
      return;
    }
    setProfileOrgStatus(isMp ? "Название организации обновлено." : "Адрес организации обновлён.");
    setOrgMainEditOpen(false);
    loadMe();
    loadSellerData();
  }

  async function geocodeBranchAddress() {
    const q = locationForm.address?.trim();
    if (!q) {
      setBranchGeoStatus("Укажи адрес филиала.");
      return;
    }
    setBranchGeoStatus("Ищем на карте…");
    const fromGeo = await ensureCityHintFromGeo();
    const cityHint = detectedCity || fromGeo;
    const queries = [buildNominatimQuery(q, cityHint), buildNominatimQuery(q, ""), q];
    let data = [];
    for (const queryStr of queries) {
      if (!queryStr) continue;
      data = await nominatimSearchRU(queryStr, 1);
      if (data.length) break;
    }
    if (!data.length) {
      setBranchGeoStatus("Адрес не найден.");
      return;
    }
    const first = data[0];
    const lat = Number(first.lat);
    const lon = Number(first.lon);
    setLocationForm((prev) => ({
      ...prev,
      latitude: lat.toFixed(6),
      longitude: lon.toFixed(6),
      address: simplifyCommaAddressLine(
        buildShortAddress(first.address) || first.display_name || prev.address
      ),
    }));
    const city = getCity(first.address);
    if (city) setDetectedCity(city);
    setBranchGeoStatus("Адрес найден на карте.");
    const ymaps = window.ymaps;
    if (ymaps && branchAddMapRef.current && branchAddPlacemarkRef.current) {
      const coords = [lat, lon];
      branchAddMapRef.current.setCenter(coords, 14);
      branchAddPlacemarkRef.current.geometry.setCoordinates(coords);
    }
    if (ymaps && branchEditMapRef.current && branchEditPlacemarkRef.current) {
      const coords = [lat, lon];
      branchEditMapRef.current.setCenter(coords, 14);
      branchEditPlacemarkRef.current.geometry.setCoordinates(coords);
    }
  }

  async function createProviderBranch(event) {
    event.preventDefault();
    setBranchGeoStatus("");
    const response = await authFetch(`${API_URL}/locations/`, {
      method: "POST",
      body: JSON.stringify({
        title: locationForm.title,
        address: locationForm.address.trim(),
        latitude: Number(locationForm.latitude),
        longitude: Number(locationForm.longitude),
        entrance: (locationForm.entrance || "").trim(),
        floor: (locationForm.floor || "").trim(),
        apartment: (locationForm.apartment || "").trim(),
        intercom: (locationForm.intercom || "").trim(),
        address_details: (locationForm.address_details || "").trim(),
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      setBranchGeoStatus(err.detail || Object.values(err).flat().find(Boolean) || "Не удалось добавить филиал.");
      return;
    }
    setLocationForm(emptyLocationFormState());
    setBranchGeoStatus("Филиал добавлен.");
    setOrgBranchAddOpen(false);
    destroyBranchAddMap();
    loadSellerData();
  }

  async function saveProviderBranchEdit(event) {
    event.preventDefault();
    if (!selectedOrgBranchId) return;
    setBranchGeoStatus("Сохраняем…");
    const response = await authFetch(`${API_URL}/locations/${selectedOrgBranchId}/`, {
      method: "PATCH",
      body: JSON.stringify({
        title: locationForm.title.trim(),
        address: locationForm.address.trim(),
        latitude: Number(locationForm.latitude),
        longitude: Number(locationForm.longitude),
        entrance: (locationForm.entrance || "").trim(),
        floor: (locationForm.floor || "").trim(),
        apartment: (locationForm.apartment || "").trim(),
        intercom: (locationForm.intercom || "").trim(),
        address_details: (locationForm.address_details || "").trim(),
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      setBranchGeoStatus(err.detail || Object.values(err).flat().find(Boolean) || "Не удалось сохранить филиал.");
      return;
    }
    setBranchGeoStatus("Филиал обновлён.");
    setOrgBranchEditOpen(false);
    loadSellerData();
  }

  async function deleteProviderBranch(id) {
    const response = await authFetch(`${API_URL}/locations/${id}/`, { method: "DELETE" });
    if (!response.ok) {
      setBranchGeoStatus("Не удалось удалить филиал.");
      return;
    }
    if (Number(selectedOrgBranchId) === Number(id)) {
      setSelectedOrgBranchId(null);
      setOrgBranchEditOpen(false);
    }
    setBranchGeoStatus("Филиал удалён.");
    loadSellerData();
  }

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
    const bookDate = presetDate || clientDiscoverFiltersRef.current?.slot_date || clientBookingForm.bookDate || todayIsoDate();
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

  async function createClientBooking(event) {
    event.preventDefault();
    const serviceId = Number(clientBookingForm.serviceId);
    if (!serviceId) {
      setClientStatus("Выберите услугу.");
      return;
    }
    const win = clientBookWindows.find((w) => clientWindowKey(w) === clientBookingForm.windowKey);
    if (!win) {
      setClientStatus("Выберите время записи.");
      return;
    }
    const response = await authFetch(`${API_URL}/booking/`, {
      method: "POST",
      body: JSON.stringify({
        provider: Number(clientBookingForm.provider),
        service: serviceId,
        starts_at: win.starts_at,
        ends_at: win.ends_at,
        staff: win.staff_id ?? null,
        comment: clientBookingForm.comment,
        option_ids: clientBookingForm.optionIds || [],
        loyalty_points:
          clientBookingForm.usePackage && bookClientPackages.length
            ? 0
            : Number(clientBookingForm.loyaltyPoints) || 0,
        use_package: Boolean(clientBookingForm.usePackage && clientBookingForm.clientPackageId),
        client_package: clientBookingForm.usePackage ? clientBookingForm.clientPackageId || null : null,
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      setClientStatus(err.detail || "Не удалось создать запись.");
      return;
    }
    const created = await response.json().catch(() => ({}));
    if (created.confirmation_url) {
      window.location.href = created.confirmation_url;
      return;
    }
    await reloadBookingsList();
    const monthKey = isoMonthKey(created.slot_starts_at || win.starts_at);
    if (monthKey) setBookingsMonth(monthKey);
    setClientStatus(
      created.client_package
        ? "Запись создана — списан визит по абонементу."
        : Number(created.loyalty_points_redeemed) > 0 &&
            (created.payment_status === "paid" || !created.confirmation_url)
          ? "Запись создана — баллы учтены в оплате."
          : "Запись создана.",
    );
    setClientBookingForm({
      locationId: "",
      provider: "",
      serviceId: "",
      optionIds: [],
      bookDate: clientDiscoverFilters.slot_date || "",
      windowKey: "",
      comment: "",
      loyaltyPoints: "",
      staffId: "any",
      usePackage: true,
      clientPackageId: "",
    });
    setBookLoyaltyInfo(null);
    setBookClientPackages([]);
    setClientBookWindows([]);
    setClientBookModalOpen(false);
    setMapOrgPopup(null);
    setCurrentView(me?.role === "provider" ? "my_bookings" : "bookings");
  }

  async function resumeBookingPayment(bookingId, event) {
    event?.stopPropagation?.();
    event?.preventDefault?.();
    const res = await authFetch(`${API_URL}/booking/${bookingId}/pay/`, { method: "POST", body: "{}" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setClientStatus(data.detail || "Не удалось открыть оплату.");
      return;
    }
    if (data.confirmation_url) {
      window.location.href = data.confirmation_url;
      return;
    }
    setClientStatus("Оплата уже обработана.");
    await reloadBookingsList();
  }

  function bookingClientLabel(it) {
    const n = (it.client_display_name || "").trim();
    if (n) return n;
    return it.client_username || "Клиент";
  }

  function bookingSlotSecondaryLabel(it) {
    if (me?.role === "client") {
      const master = (it.staff_display_name || "").trim();
      if (master) {
        const job = (it.staff_job_title || "").trim();
        return job ? `${master} · ${job}` : master;
      }
      return (it.service_name || "").trim() || "Мастер";
    }
    const client = bookingClientLabel(it);
    const service = (it.service_name || "").trim();
    const staffName = (it.staff_display_name || "").trim();
    const staffJob = (it.staff_job_title || "").trim();
    const staff = [staffName, staffJob].filter(Boolean).join(" · ");
    const parts = [client, service, staff].filter(Boolean);
    return parts.length ? parts.join(" · ") : "Запись";
  }

  async function reloadBookingsList() {
    const asClient = currentView === "my_bookings" || me?.role === "client";
    const bookingsRes = await authFetch(`${API_URL}/booking/${asClient && me?.role === "provider" ? "?as_client=1" : ""}`);
    if (!bookingsRes.ok) return [];
    let list = normalizeBookingsList(await bookingsRes.json());

    if (canManageBookings() && currentView !== "my_bookings") {
      const slotsRes = await authFetch(`${API_URL}/booking/slots/`);
      if (slotsRes.ok) {
        const slotsData = normalizeSlotsList(await slotsRes.json());
        setSlots(slotsData);
        list = mergeBookingsWithManualHolds(list, slotsData, {
          orgStaff,
          providerId: me?.id,
          staffJobTitleForUser,
        });
      }
    }

    setBookings(list);
    return list;
  }

  async function openChatWithClient(clientId) {
    const res = await authFetch(`${API_URL}/chat/conversations/create-with-client/`, {
      method: "POST",
      body: JSON.stringify({ client_id: Number(clientId) }),
    });
    if (!res.ok) return;
    const data = await res.json();
    await loadChats();
    setSelectedChatId(data.id);
    setChatFolder("clients");
    setCurrentView("chats");
    setMenuOpen(false);
  }

  async function openChatWithProvider(providerId) {
    const res = await authFetch(`${API_URL}/chat/conversations/create-with-provider/`, {
      method: "POST",
      body: JSON.stringify({ provider_id: Number(providerId) }),
    });
    if (!res.ok) return;
    const data = await res.json();
    await loadChats();
    setSelectedChatId(data.id);
    setCurrentView("chats");
    setMenuOpen(false);
  }

  async function orgBookingAction(bookingId, action, event) {
    event?.stopPropagation?.();
    event?.preventDefault?.();
    const res = await authFetch(`${API_URL}/booking/${bookingId}/${action}/`, { method: "POST", body: "{}" });
    if (res.ok) {
      await reloadBookingsList();
      return;
    }
    const err = await res.json().catch(() => ({}));
    if (
      err.code === "confirm_message_not_set"
      || err.code === "cancel_message_not_set"
      || err.code === "done_message_not_set"
      || err.code === "booking_not_started_yet"
      || err.code === "prepay_required"
    ) {
      setBookingMessageError({ code: err.code, detail: err.detail || "" });
    }
  }

  async function startInspectionFromBooking(booking) {
    if (!booking?.client) {
      setClientStatus("У записи нет клиента.");
      return;
    }
    // Reuse existing linked intake instead of creating duplicates.
    if (booking.inspection?.id) {
      setPendingInspectionId(Number(booking.inspection.id));
      setCurrentView("inspections");
      setClientStatus("Открыта приёмка по этой записи.");
      return;
    }
    const res = await authFetch(`${API_URL}/inspections/reports/`, {
      method: "POST",
      body: JSON.stringify({
        client: Number(booking.client),
        booking: Number(booking.id),
        vehicle_title: "",
        notes: booking.service_name ? `По записи: ${booking.service_name}` : "",
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setClientStatus(err.detail || err.client?.[0] || "Не удалось создать отчёт приёмки.");
      return;
    }
    const created = await res.json();
    setPendingInspectionId(Number(created.id));
    setCurrentView("inspections");
    setClientStatus("Черновик приёмки создан и открыт.");
    await reloadBookingsList();
  }

  function openInspectionFromBooking(booking) {
    const id = booking?.inspection?.id;
    if (!id) return;
    setPendingInspectionId(Number(id));
    setCurrentView("inspections");
  }

  function bookingHasStarted(it) {
    if (!it?.slot_starts_at) return true;
    const start = new Date(it.slot_starts_at).getTime();
    return !Number.isNaN(start) && start <= Date.now();
  }

  async function clientCancelBooking(bookingId, event) {
    event?.stopPropagation?.();
    event?.preventDefault?.();
    const res = await authFetch(`${API_URL}/booking/${bookingId}/cancel-by-client/`, { method: "POST", body: "{}" });
    if (res.ok) await reloadBookingsList();
  }

  function goOrgSettingsForBookingMessage(code) {
    setBookingMessageError(null);
    const highlight =
      code === "confirm_message_not_set" ? "confirm" : code === "done_message_not_set" ? "done" : "cancel";
    setOrgSettingsHighlight(highlight);
    setCurrentView("organization");
    setMenuOpen(false);
    setTimeout(() => setOrgSettingsHighlight(""), 2500);
  }

  async function loadMapOrgSummary(providerId) {
    const res = await authFetch(`${API_URL}/reviews/summary/?provider=${encodeURIComponent(providerId)}`);
    if (res.ok) setMapOrgSummary(await res.json());
  }

  async function loadMapOrgProfile(providerId) {
    const res = await authFetch(`${API_URL}/users/organization-profile/?provider=${encodeURIComponent(providerId)}`);
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

  function fitClientDiscoverMapViewport() {
    const map = clientDiscoverMapRef.current;
    if (!map) return;
    try {
      if (map.container?.fitToViewport) map.container.fitToViewport();
      else map.setSize?.([map.container?.getSize?.()?.[0], map.container?.getSize?.()?.[1]]);
    } catch {
      // ignore
    }
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

  async function waitForClientDiscoverMap(maxMs = 4500) {
    if (clientDiscoverMapRef.current) return clientDiscoverMapRef.current;
    const started = Date.now();
    while (Date.now() - started < maxMs) {
      await new Promise((r) => window.setTimeout(r, 80));
      if (clientDiscoverMapRef.current) return clientDiscoverMapRef.current;
    }
    return null;
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
        .then((list) => setMapOrgPackages(Array.isArray(list) ? list.filter((p) => p.is_active !== false) : []))
        .catch(() => setMapOrgPackages([]));
    }
    window.setTimeout(fitClientDiscoverMapViewport, 0);
  }

  async function saveOrgProfileInfo(event) {
    event?.preventDefault?.();
    const phones = orgProfileForm.phones.map((p) => String(p).trim()).filter(Boolean);
    const websites = orgProfileForm.websites.map((w) => String(w).trim()).filter(Boolean);
    const res = await authFetch(`${API_URL}/users/organization-info/`, {
      method: "PATCH",
      body: JSON.stringify({
        organization_working_hours: orgProfileForm.working_hours,
        organization_phones: phones,
        organization_websites: websites,
        organization_card_note: orgProfileForm.card_note,
      }),
    });
    if (!res.ok) {
      setOrgProfileSaveStatus("Не удалось сохранить.");
      return;
    }
    setOrgProfileSaveStatus("Сохранено.");
    loadMe();
  }

  async function saveOrgAcquiring(event) {
    event?.preventDefault?.();
    setOrgAcquiringSaveStatus("");
    const payload = {
      payment_provider: orgAcquiringForm.payment_provider || "yookassa",
      prepay_mode: orgAcquiringForm.prepay_mode,
      prepay_percent: Number(orgAcquiringForm.prepay_percent) || 50,
      yookassa_shop_id: orgAcquiringForm.yookassa_shop_id || "",
      tbank_terminal_key: orgAcquiringForm.tbank_terminal_key || "",
      cloudpayments_public_id: orgAcquiringForm.cloudpayments_public_id || "",
      robokassa_merchant_login: orgAcquiringForm.robokassa_merchant_login || "",
    };
    const secrets = [
      "yookassa_secret_key",
      "tbank_password",
      "cloudpayments_api_secret",
      "robokassa_password1",
      "robokassa_password2",
    ];
    for (const key of secrets) {
      if ((orgAcquiringForm[key] || "").trim()) payload[key] = orgAcquiringForm[key].trim();
    }
    const res = await authFetch(`${API_URL}/booking/acquiring/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setOrgAcquiringSaveStatus(data.detail || data.prepay_mode?.[0] || data.payment_provider?.[0] || "Не удалось сохранить.");
      return;
    }
    setOrgAcquiringForm((p) => ({
      ...p,
      payment_provider: data.payment_provider || p.payment_provider,
      prepay_mode: data.prepay_mode || p.prepay_mode,
      prepay_percent: data.prepay_percent || p.prepay_percent,
      yookassa_shop_id: data.yookassa_shop_id || "",
      yookassa_secret_key: "",
      has_yookassa: Boolean(data.has_yookassa),
      tbank_terminal_key: data.tbank_terminal_key || "",
      tbank_password: "",
      has_tbank: Boolean(data.has_tbank),
      cloudpayments_public_id: data.cloudpayments_public_id || "",
      cloudpayments_api_secret: "",
      has_cloudpayments: Boolean(data.has_cloudpayments),
      robokassa_merchant_login: data.robokassa_merchant_login || "",
      robokassa_password1: "",
      robokassa_password2: "",
      has_robokassa: Boolean(data.has_robokassa),
      has_payment_keys: Boolean(data.has_payment_keys),
    }));
    setOrgAcquiringSaveStatus("Сохранено.");
  }

  async function rotateOrgCalendarToken() {
    setOrgCalendarStatus("");
    const res = await authFetch(`${API_URL}/booking/calendar/settings/`, { method: "POST", body: "{}" });
    if (!res.ok) {
      setOrgCalendarStatus("Не удалось обновить ссылку.");
      return;
    }
    setOrgCalendarLinks(await res.json());
    setOrgCalendarStatus("Новая ссылка календаря создана. Старая больше не работает.");
  }

  async function saveOrgMessaging(event) {
    event?.preventDefault?.();
    setOrgMessagingSaveStatus("");
    const payload = {
      remind_clients: Boolean(orgMessagingForm.remind_clients),
      remind_org: Boolean(orgMessagingForm.remind_org),
      notify_org_on_new: Boolean(orgMessagingForm.notify_org_on_new),
      winback_enabled: Boolean(orgMessagingForm.winback_enabled),
      winback_weeks: Number(orgMessagingForm.winback_weeks) || 4,
      winback_template: orgMessagingForm.winback_template || "",
      enable_telegram: Boolean(orgMessagingForm.enable_telegram),
      enable_max: Boolean(orgMessagingForm.enable_max),
      enable_whatsapp: Boolean(orgMessagingForm.enable_whatsapp),
      enable_sms: Boolean(orgMessagingForm.enable_sms),
      telegram_notify_chat_id: orgMessagingForm.telegram_notify_chat_id || "",
      max_notify_chat_id: orgMessagingForm.max_notify_chat_id || "",
      wa_api_url: orgMessagingForm.wa_api_url || "https://api.green-api.com",
      wa_id_instance: orgMessagingForm.wa_id_instance || "",
      new_booking_template: orgMessagingForm.new_booking_template || "",
    };
    for (const key of ["telegram_bot_token", "max_bot_token", "wa_api_token", "sms_api_id"]) {
      if ((orgMessagingForm[key] || "").trim()) payload[key] = orgMessagingForm[key].trim();
    }
    const res = await authFetch(`${API_URL}/booking/messaging/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setOrgMessagingSaveStatus(data.detail || "Не удалось сохранить.");
      return;
    }
    setOrgMessagingForm((p) => ({
      ...p,
      ...data,
      telegram_bot_token: "",
      max_bot_token: "",
      wa_api_token: "",
      sms_api_id: "",
    }));
    setOrgMessagingSaveStatus("Сохранено.");
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

  async function loadOrgTelegramLink() {
    const res = await authFetch(`${API_URL}/booking/messaging/telegram-link/`);
    if (!res.ok) return;
    const data = await res.json();
    setOrgTelegramLinkInfo(data);
    if (data.telegram_notify_chat_id) {
      setOrgMessagingForm((p) => ({ ...p, telegram_notify_chat_id: data.telegram_notify_chat_id }));
    }
  }

  async function refreshOrgTelegramLink() {
    const linkRes = await authFetch(`${API_URL}/booking/messaging/telegram-link/`);
    if (!linkRes.ok) return;
    const data = await linkRes.json();
    setOrgTelegramLinkInfo(data);
    setOrgMessagingForm((p) => ({
      ...p,
      telegram_notify_chat_id: data.telegram_notify_chat_id || p.telegram_notify_chat_id,
      enable_telegram: true,
    }));
  }

  async function unlinkOrgTelegram() {
    await authFetch(`${API_URL}/booking/messaging/telegram-link/`, { method: "DELETE" });
    setOrgTelegramLinkInfo((p) =>
      p ? { ...p, linked: false, telegram_notify_chat_id: "" } : p,
    );
    setOrgMessagingForm((p) => ({ ...p, telegram_notify_chat_id: "" }));
  }

  async function uploadOrgGalleryPhoto(file) {
    if (!file) return false;
    if (orgGalleryPhotos.length >= ORG_GALLERY_MAX_PHOTOS) {
      setOrgProfileSaveStatus(`Можно загрузить не более ${ORG_GALLERY_MAX_PHOTOS} фото.`);
      return false;
    }
    const fd = new FormData();
    fd.append("image", file);
    const res = await authFetch(`${API_URL}/users/gallery/`, { method: "POST", body: fd });
    if (res.ok) {
      const row = await res.json();
      setOrgGalleryPhotos((p) => [...p, row].slice(0, ORG_GALLERY_MAX_PHOTOS));
      setOrgProfileSaveStatus("Фото добавлено.");
      return true;
    }
    const err = await res.json().catch(() => ({}));
    setOrgProfileSaveStatus(err.detail || "Не удалось загрузить фото.");
    return false;
  }

  async function deleteOrgGalleryPhoto(id) {
    const res = await authFetch(`${API_URL}/users/gallery/?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) setOrgGalleryPhotos((p) => p.filter((x) => Number(x.id) !== Number(id)));
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

  async function loadProviderReviewsList(ordering = providerReviewsOrdering) {
    const res = await authFetch(
      `${API_URL}/reviews/?ordering=${encodeURIComponent(ordering || "-created_at")}`,
    );
    if (res.ok) setProviderReviews(normalizeReviewsList(await res.json()));
  }

  async function loadMyReviews() {
    const res = await authFetch(`${API_URL}/reviews/`);
    if (res.ok) setMyReviews(normalizeReviewsList(await res.json()));
  }

  async function loadMissedReviewsCount() {
    if (me?.role !== "provider") return;
    const res = await authFetch(`${API_URL}/reviews/unread-count/`);
    if (res.ok) {
      const data = await res.json();
      setMissedReviewsCount(Number(data.count) || 0);
    }
  }

  async function markReviewsSeen() {
    if (me?.role !== "provider") return;
    const res = await authFetch(`${API_URL}/reviews/mark-seen/`, { method: "POST", body: "{}" });
    if (res.ok) setMissedReviewsCount(0);
  }

  function openProviderReviews() {
    setCurrentView("reviews");
    loadProviderReviewsList(providerReviewsOrdering);
    markReviewsSeen();
  }

  async function refreshReviewsAfterSubmit(providerId) {
    if (me?.role === "client") await loadMyReviews();
    if (me?.role === "provider") await loadProviderReviewsList(providerReviewsOrdering);
    if (mapOrgPopup && Number(mapOrgPopup.provider) === Number(providerId)) {
      await loadMapOrgSummary(providerId);
      if (mapOrgReviewsOpen) await loadMapOrgReviews(providerId, mapOrgReviewsOrdering);
    }
  }

  function bookingHasReview(bookingId) {
    const b = bookings.find((x) => Number(x.id) === Number(bookingId));
    if (b?.review?.id) return true;
    return myReviews.some((r) => Number(r.booking) === Number(bookingId));
  }

  function getBookingReview(booking) {
    if (booking?.review?.id) return booking.review;
    if (me?.role === "client") {
      return myReviews.find((r) => Number(r.booking) === Number(booking.id)) || null;
    }
    return null;
  }

  async function openOrgCardFromHistory(booking) {
    const providerId = booking?.provider;
    if (!providerId) return;
    let loc = allLocations.find((l) => Number(l.provider) === Number(providerId));
    if (!loc) {
      const res = await authFetch(`${API_URL}/locations/`);
      if (res.ok) {
        const list = await res.json();
        loc = list.find((l) => Number(l.provider) === Number(providerId));
        if (Array.isArray(list) && list.length) setAllLocations(list);
      }
    }
    if (!loc) {
      setClientStatus("Точка организации на карте не найдена.");
      return;
    }
    setCurrentView("client_map");
    await waitForClientDiscoverMap();
    await openOrgOnMap(loc);
    const serviceId = booking.service || booking.service_id;
    const staffId = booking.staff || booking.staff_id;
    await onClientLocationSelect(String(loc.id), todayIsoDate());
    setClientBookingForm((p) => ({
      ...p,
      provider: String(booking.provider || loc.provider || p.provider),
      locationId: String(loc.id),
      serviceId: serviceId ? String(serviceId) : p.serviceId,
      staffId: staffId ? String(staffId) : "any",
      windowKey: "",
    }));
    setClientBookModalOpen(true);
  }

  function patchReviewInLists(updated) {
    const merge = (list) => list.map((r) => (Number(r.id) === Number(updated.id) ? { ...r, ...updated } : r));
    setProviderReviews((list) => merge(list));
    setMapOrgReviews((list) => merge(list));
    setMyReviews((list) => merge(list));
  }

  async function toggleReviewLike(reviewId, likedByMe) {
    const path = likedByMe ? "unlike" : "like";
    const res = await authFetch(`${API_URL}/reviews/${reviewId}/${path}/`, { method: "POST", body: "{}" });
    if (!res.ok) return;
    const data = await res.json();
    const patch = (list) =>
      list.map((r) =>
        Number(r.id) === Number(reviewId)
          ? { ...r, liked_by_me: !likedByMe, likes_count: data.likes_count ?? r.likes_count }
          : r,
      );
    setProviderReviews(patch);
    setMapOrgReviews(patch);
  }

  async function submitReviewReply(reviewId) {
    const form = reviewReplyForms[reviewId] || {};
    const text = (form.text || "").trim();
    if (!text) {
      setReviewReplyFormError("Введите текст ответа.");
      return;
    }
    if (!form.publishReply && !form.viaChat) {
      setReviewReplyFormError("Отметьте хотя бы один способ: ответ на отзыв или сообщение в чат.");
      return;
    }
    setReviewReplyFormError("");
    const res = await authFetch(`${API_URL}/reviews/${reviewId}/reply/`, {
      method: "POST",
      body: JSON.stringify({
        text,
        publish_reply: form.publishReply,
        via_chat: form.viaChat,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setReviewReplyFormError(formatApiError(err, res.status) || "Не удалось отправить ответ.");
      return;
    }
    const updated = await res.json();
    patchReviewInLists(updated);
    setReviewReplyOpenId(null);
    setReviewReplyForms((p) => {
      const next = { ...p };
      delete next[reviewId];
      return next;
    });
  }

  function buildAllReviewPhotoLightboxItems(reviews) {
    const items = [];
    for (const r of reviews || []) {
      for (const p of r.photos || []) {
        items.push({
          id: `review-${r.id}-${p.id}`,
          url: reviewImageUrl(p, "full"),
          source: "review",
          review_id: r.id,
          client_name: r.client_name,
          rating: r.rating,
          text: r.text || "",
        });
      }
    }
    return items;
  }

  function findReviewPhotoGlobalIndex(reviews, reviewId, photoIndex) {
    let offset = 0;
    for (const r of reviews || []) {
      const photos = r.photos || [];
      if (r.id === reviewId) return offset + photoIndex;
      offset += photos.length;
    }
    return 0;
  }

  function openReviewPhotoLightbox(review, photoIndex = 0, reviewsList = null) {
    const reviews = reviewsList?.length ? reviewsList : [review];
    const items = buildAllReviewPhotoLightboxItems(reviews);
    if (!items.length) return;
    const globalIndex = findReviewPhotoGlobalIndex(reviews, review.id, photoIndex);
    openOrgPhotoLightbox(items, globalIndex);
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

  async function saveOrgBookingMessages(event) {
    event.preventDefault();
    const response = await authFetch(`${API_URL}/users/me/`, {
      method: "PATCH",
      body: JSON.stringify({
        booking_confirm_message_default: orgBookingMessages.confirm,
        booking_cancel_message_default: orgBookingMessages.cancel,
        booking_done_message_default: orgBookingMessages.done,
      }),
    });
    if (response.ok) {
      showToast("Сообщения сохранены", { tone: "success" });
      setProfileOrgStatus("Сообщения для записей сохранены.");
      loadMe();
    } else {
      setProfileOrgStatus("Не удалось сохранить сообщения.");
    }
  }

  async function submitClientReview(event) {
    event.preventDefault();
    if (!reviewModalBooking) return;
    setReviewSubmitError("");
    const input = document.getElementById("review-photos-input");
    const isSupplement = Boolean(reviewModalReview?.id);

    if (isSupplement) {
      const fd = new FormData();
      if ((reviewForm.text || "").trim()) fd.append("append_text", reviewForm.text.trim());
      if (input?.files) {
        for (const f of input.files) fd.append("photos", f);
      }
      const res = await authFetch(`${API_URL}/reviews/${reviewModalReview.id}/`, {
        method: "PATCH",
        body: fd,
      });
      if (res.ok) {
        const updated = await res.json();
        const bookingId = reviewModalBooking.id;
        const providerId = reviewModalBooking.provider;
        setBookings((prev) =>
          prev.map((b) =>
            Number(b.id) === Number(bookingId)
              ? {
                  ...b,
                  review: {
                    id: updated.id,
                    rating: updated.rating,
                    text: updated.text,
                    created_at: updated.created_at,
                    supplemented_at: updated.supplemented_at,
                    photos: updated.photos || [],
                    reply: updated.reply || null,
                  },
                }
              : b,
          ),
        );
        setMyReviews((prev) => {
          const has = prev.some((r) => Number(r.id) === Number(updated.id));
          if (has) return prev.map((r) => (Number(r.id) === Number(updated.id) ? { ...r, ...updated } : r));
          return [updated, ...prev];
        });
        setReviewModalBooking(null);
        setReviewModalReview(null);
        setReviewForm({ rating: 5, staff_rating: 5, text: "", staff_text: "" });
        if (input) input.value = "";
        setReviewSubmitError("");
        setClientStatus("Отзыв дополнен.");
        await refreshReviewsAfterSubmit(providerId);
        return;
      }
      const err = await res.json().catch(() => ({}));
      setReviewSubmitError(formatApiError(err, res.status) || "Не удалось дополнить отзыв.");
      return;
    }

    const fd = new FormData();
    fd.append("provider", String(reviewModalBooking.provider));
    fd.append("booking", String(reviewModalBooking.id));
    if (reviewModalBooking.staff_user_id) {
      fd.append("staff_user", String(reviewModalBooking.staff_user_id));
    }
    fd.append("rating", String(reviewForm.rating));
    if (reviewModalBooking.staff_user_id && reviewForm.staff_rating) {
      fd.append("staff_rating", String(reviewForm.staff_rating));
    }
    fd.append("text", reviewForm.text || "");
    if (reviewModalBooking.staff_user_id) {
      fd.append("staff_text", reviewForm.staff_text || "");
    }
    if (input?.files) {
      for (const f of input.files) fd.append("photos", f);
    }
    const res = await authFetch(`${API_URL}/reviews/`, { method: "POST", body: fd });
    if (res.ok) {
      const created = await res.json();
      const providerId = reviewModalBooking.provider;
      const bookingId = reviewModalBooking.id;
      setBookings((prev) =>
        prev.map((b) =>
          Number(b.id) === Number(bookingId)
            ? {
                ...b,
                review: {
                  id: created.id,
                  rating: created.rating,
                  text: created.text,
                  created_at: created.created_at,
                  supplemented_at: created.supplemented_at,
                  photos: created.photos || [],
                  reply: created.reply || null,
                },
              }
            : b,
        ),
      );
      setReviewModalBooking(null);
      setReviewModalReview(null);
      setReviewForm({ rating: 5, staff_rating: 5, text: "", staff_text: "" });
      if (input) input.value = "";
      setReviewSubmitError("");
      setClientStatus("Отзыв отправлен.");
      await refreshReviewsAfterSubmit(providerId);
      return;
    }
    const err = await res.json().catch(() => ({}));
    setReviewSubmitError(formatApiError(err, res.status) || "Не удалось отправить отзыв.");
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

  function openClientReviewModal(booking, existingReview = null) {
    if (existingReview && reviewIsSupplemented(existingReview)) return;
    setReviewSubmitError("");
    if (existingReview) {
      setReviewModalReview(existingReview);
      setReviewForm({
        rating: existingReview.rating,
        staff_rating: existingReview.staff_rating || 5,
        text: "",
        staff_text: "",
      });
    } else {
      setReviewModalReview(null);
      setReviewForm({ rating: 5, staff_rating: 5, text: "", staff_text: "" });
    }
    setReviewModalBooking({ ...booking, staff_user_id: booking.staff || null });
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

  const chatInfoPeer = useMemo(() => {
    if (!selectedConv) return null;
    const st = selectedConv.org_direct_peer_status;
    if (st) return st;
    const peers = (selectedConv.members || []).filter((m) => Number(m.user) !== Number(me?.id));
    if (!peers.length) return null;
    const p = peers[0];
    return {
      is_online: p.is_online,
      last_seen_at: p.last_seen_at,
      first_name: p.first_name,
      last_name: p.last_name,
      patronymic: p.patronymic,
      username: p.username,
      organization_name: p.organization_name,
      role: p.role,
    };
  }, [selectedConv, me?.id]);
  const activeChatWallpaper = selectedChatId ? chatLocalPrefs[selectedChatId]?.wallpaper : null;
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
