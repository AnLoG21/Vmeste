import { useEffect, useMemo, useRef, useState } from "react";
import logoMain from "./assets/logo-main.png";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
const NOMINATIM_HEADERS = { Accept: "application/json", "Accept-Language": "ru,ru-RU;q=0.9,en;q=0.5" };
const BASE_URL = API_URL.replace("/api", "");
const AUTH_URL = `${BASE_URL}/api/auth/token/`;
const REFRESH_URL = `${BASE_URL}/api/auth/token/refresh/`;
const INTERVALS_STORAGE_KEY = "vmeste_saved_intervals";
const chatPrefsStorageKey = (id) => `vmeste_chat_prefs_v1_${id}`;
const CHAT_WALL_OPTIONS = [
  { label: "Мята", value: "#dfe9e2" },
  { label: "Облака", value: "#e3edf8" },
  { label: "Песок", value: "#f3e8d8" },
  { label: "Ночь", value: "#1e2a24" },
  { label: "Море", value: "linear-gradient(160deg,#b8dfe9,#6aa6b8)" },
];
const APP_THEME_KEY = "vmeste_theme_v1";
const chatNotifyStorageKey = (id) => `vmeste_chat_notify_v1_${id}`;

const emptyRegisterForm = {
  username: "",
  first_name: "",
  last_name: "",
  patronymic: "",
  email: "",
  phone: "",
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
};

export default function App() {
  const [authMode, setAuthMode] = useState("login");
  const [registerStep, setRegisterStep] = useState(1);
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentView, setCurrentView] = useState("bookings");

  const [accessToken, setAccessToken] = useState(localStorage.getItem("vmeste_access") || "");
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem("vmeste_refresh") || "");
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [me, setMe] = useState(null);

  const [roles, setRoles] = useState([]);
  const [spheres, setSpheres] = useState([]);
  const [form, setForm] = useState(emptyRegisterForm);

  const [status, setStatus] = useState("");
  const [authStatus, setAuthStatus] = useState("");
  const [sellerStatus, setSellerStatus] = useState("");
  const [clientStatus, setClientStatus] = useState("");
  const [verifyStatus, setVerifyStatus] = useState("");
  const [resendStatus, setResendStatus] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [detectedCity, setDetectedCity] = useState("");

  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [slots, setSlots] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [location, setLocation] = useState([]);
  const [allLocations, setAllLocations] = useState([]);
  const [providerServices, setProviderServices] = useState([]);
  const [providerSlots, setProviderSlots] = useState([]);
  const [clientBookingForm, setClientBookingForm] = useState({
    provider: "",
    slot: "",
    comment: "",
  });

  const [categoryForm, setCategoryForm] = useState({ name: "", allow_subcategory_booking: true });
  const [serviceForm, setServiceForm] = useState({
    category: "",
    name: "",
    price: "1000",
    duration_minutes: "30",
    is_active: true,
  });
  const [categoryOpen, setCategoryOpen] = useState({});
  const [slotForm, setSlotForm] = useState({ starts_at: "", ends_at: "" });
  const [intervalForm, setIntervalForm] = useState({
    date: "",
    start_time: "09:00",
    end_time: "18:00",
    repeat_type: "none",
    repeat_count: "1",
  });
  const [calendarMonth, setCalendarMonth] = useState(new Date().toISOString().slice(0, 7));
  const [bookingsMonth, setBookingsMonth] = useState(new Date().toISOString().slice(0, 7));
  const [intervalToast, setIntervalToast] = useState(null);
  const intervalToastTimerRef = useRef(null);
  const [savedIntervals, setSavedIntervals] = useState(() => {
    try {
      const raw = localStorage.getItem(INTERVALS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [selectedIntervalId, setSelectedIntervalId] = useState(null);
  const [dragIntervalId, setDragIntervalId] = useState(null);
  const [intervalPopoverId, setIntervalPopoverId] = useState(null);
  const [orgStaff, setOrgStaff] = useState([]);
  const [staffInviteForm, setStaffInviteForm] = useState({ invite_email: "", invite_username: "", display_name: "" });
  const [staffInviteStatus, setStaffInviteStatus] = useState("");
  const [conversations, setConversations] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatStatus, setChatStatus] = useState("");
  const [chatSettingsOpen, setChatSettingsOpen] = useState(false);
  const [chatSettingsTitle, setChatSettingsTitle] = useState("");
  const [groupForm, setGroupForm] = useState({ title: "", staff_ids: [] });
  const [directStaffId, setDirectStaffId] = useState("");
  const [chatFabOpen, setChatFabOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ first_name: "", last_name: "", patronymic: "", phone: "" });
  const [passwordForm, setPasswordForm] = useState({ old_password: "", new_password: "", new_password_confirm: "" });
  const [emailForm, setEmailForm] = useState({ new_email: "" });
  const [locationForm, setLocationForm] = useState({
    title: "",
    address: "",
    latitude: "55.751244",
    longitude: "37.618423",
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
  const [chatMemberNames, setChatMemberNames] = useState({});
  const [incomingToasts, setIncomingToasts] = useState([]);
  const currentViewRef = useRef(currentView);
  const meRef = useRef(me);
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
      manage_staff: false,
      can_delegate_permissions: false,
    };
    if (!me || me.role !== "staff") return base;
    const link = orgStaff.find((l) => Number(l.staff) === Number(me.id));
    return { ...base, ...(link?.permissions || {}) };
  }, [me, orgStaff]);

  function staffHasPerm(key) {
    if (me?.role === "provider") return true;
    if (me?.role !== "staff") return false;
    return Boolean(staffEffectivePerms[key]);
  }

  const canManageOrgSettings =
    me?.role === "provider" || (me?.role === "staff" && Boolean(staffEffectivePerms.can_delegate_permissions));

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
        { key: "service_center", value: "Сервисный центр" },
      ];

  useEffect(() => {
    loadRoles();
    loadSpheres();
    handleVerifyEmailFromUrl();
  }, []);

  useEffect(() => {
    if (accessToken) loadMe();
    else setMe(null);
  }, [accessToken]);

  useEffect(() => {
    if (accessToken && me?.role === "provider") loadSellerData();
  }, [accessToken, me]);

  useEffect(() => {
    if (!accessToken || currentView !== "organization") return;
    if (me?.role === "provider") loadSellerData();
    else if (me?.role === "staff" && staffEffectivePerms.can_delegate_permissions) loadStaffWorkspace();
  }, [accessToken, currentView, me?.role, staffEffectivePerms.can_delegate_permissions]);

  useEffect(() => {
    if (accessToken && me?.role === "staff") loadStaffWorkspace();
  }, [accessToken, me]);

  useEffect(() => {
    if (!accessToken || currentView !== "chats") return;
    if (me?.role === "provider") {
      loadChats();
      authFetch(`${API_URL}/booking/staff/`).then((r) => {
        if (r.ok) return r.json();
        return null;
      }).then((d) => {
        if (Array.isArray(d)) setOrgStaff(d);
      });
    }
    if (me?.role === "staff") loadStaffWorkspace();
  }, [accessToken, currentView, me?.role]);

  useEffect(() => {
    if (!accessToken || !selectedChatId || currentView !== "chats") return;
    let cancelled = false;
    async function tick() {
      const res = await authFetch(`${API_URL}/chat/messages/?conversation=${selectedChatId}`);
      if (!cancelled && res.ok) setChatMessages(await res.json());
    }
    tick();
    const id = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [accessToken, selectedChatId, currentView]);

  useEffect(() => {
    if (!me) return;
    setProfileForm({
      first_name: me.first_name || "",
      last_name: me.last_name || "",
      patronymic: me.patronymic || "",
      phone: me.phone || "",
    });
    setEmailForm({ new_email: me.email || "" });
  }, [me]);

  function syncOrgAddressFormFromMe() {
    if (!me || me.role !== "provider") return;
    const raw = me.organization_address || "";
    const sep = " | ";
    const splitIdx = raw.indexOf(sep);
    const base = splitIdx >= 0 ? raw.slice(0, splitIdx).trim() : raw.trim();
    const tail = splitIdx >= 0 ? raw.slice(splitIdx + sep.length).trim() : "";
    setOrgAddressForm((prev) => ({
      ...prev,
      organization_name: me.organization_name || "",
      organization_address: base || prev.organization_address,
      organization_address_details: tail,
      entrance: "",
      floor: "",
      apartment: "",
      intercom: "",
      organization_latitude: me.organization_latitude || prev.organization_latitude || "55.751244",
      organization_longitude: me.organization_longitude || prev.organization_longitude || "37.618423",
    }));
  }

  useEffect(() => {
    syncOrgAddressFormFromMe();
  }, [
    me?.id,
    me?.role,
    me?.organization_address,
    me?.organization_name,
    me?.organization_latitude,
    me?.organization_longitude,
  ]);

  useEffect(() => {
    if (currentView !== "chats" || !conversations.length) return;
    lastConvMsgDigestRef.current = conversations.reduce((acc, c) => {
      acc[c.id] = c.last_message?.id ?? null;
      return acc;
    }, {});
    digestPrimedRef.current = true;
  }, [currentView, conversations]);

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
    if (!chatSettingsOpen || !selectedChatId) return;
    const p = chatLocalPrefs[selectedChatId] || {};
    const sel = conversations.find((x) => x.id === selectedChatId);
    const fallback = sel?.is_saved_messages ? "Избранное" : sel?.title || `Чат #${selectedChatId}`;
    setChatSettingsTitle(p.title || fallback);
    setChatSettingsAvatar(p.avatarDataUrl || "");
    setChatSettingsWallpaper(p.wallpaper || "#dfe9e2");
    setChatMemberNames(p.memberNames && typeof p.memberNames === "object" ? p.memberNames : {});
    let notify = "all";
    try {
      const raw = localStorage.getItem(chatNotifyStorageKey(selectedChatId));
      const st = raw ? JSON.parse(raw) : {};
      if (st.muted) notify = "off";
      else if (st.mutedUntil && Date.now() < Number(st.mutedUntil)) notify = "1h";
    } catch {
      // ignore
    }
    setChatSettingsNotify(notify);
  }, [chatSettingsOpen, selectedChatId, conversations, chatLocalPrefs]);

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
    if (accessToken && me?.role === "client") loadClientData();
  }, [accessToken, me]);

  useEffect(() => {
    currentViewRef.current = currentView;
  }, [currentView]);

  useEffect(() => {
    meRef.current = me;
  }, [me]);

  useEffect(() => {
    try {
      localStorage.setItem(APP_THEME_KEY, appTheme);
    } catch {
      // ignore
    }
    document.body.classList.toggle("theme-dark", appTheme === "dark");
  }, [appTheme]);

  useEffect(() => {
    if (!accessToken || currentView === "chats") return;
    const canPoll = me?.role === "provider" || (me?.role === "staff" && staffEffectivePerms.manage_chats);
    if (!canPoll) return;
    let cancelled = false;
    async function poll() {
      const res = await authFetch(`${API_URL}/chat/conversations/`);
      if (cancelled || !res.ok) return;
      const list = await res.json();
      const myId = Number(meRef.current?.id);
      if (currentViewRef.current !== "chats" && digestPrimedRef.current) {
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
            return c.title || `Чат #${c.id}`;
          })();
          const text = (c.last_message?.text || "").slice(0, 140);
          const toastId = `${c.id}-${mid}-${Date.now()}`;
          setIncomingToasts((t) => [...t, { id: toastId, convId: c.id, title, text, fade: false }]);
          setTimeout(() => {
            setIncomingToasts((t) => t.map((x) => (x.id === toastId ? { ...x, fade: true } : x)));
          }, 5000);
          setTimeout(() => {
            setIncomingToasts((t) => t.filter((x) => x.id !== toastId));
          }, 5600);
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
    if (authMode === "register" && form.role === "provider") initMap();
  }, [authMode, registerStep, form.role]);

  useEffect(() => {
    if (authMode === "register" && form.role === "provider" && registerStep === 2) {
      detectCityByGeolocation();
    }
  }, [authMode, form.role, registerStep]);

  useEffect(() => {
    try {
      localStorage.setItem(INTERVALS_STORAGE_KEY, JSON.stringify(savedIntervals));
    } catch {
      // Ignore storage quota/access errors.
    }
  }, [savedIntervals]);

  useEffect(() => {
    if (selectedIntervalId && !savedIntervals.some((x) => x.id === selectedIntervalId)) {
      setSelectedIntervalId(null);
    }
    if (intervalPopoverId && !savedIntervals.some((x) => x.id === intervalPopoverId)) {
      setIntervalPopoverId(null);
    }
  }, [savedIntervals, selectedIntervalId, intervalPopoverId]);

  useEffect(() => {
    if (authMode === "register" && form.role === "provider" && registerStep === 2) {
      detectCityByGeolocation();
    }
  }, [authMode, form.role, registerStep]);

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
    const token = params.get("verify_email");
    if (!token) return;
    const response = await fetch(`${API_URL}/users/verify-email/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    setVerifyStatus(response.ok ? "Email подтвержден. Теперь можно войти." : "Ссылка подтверждения недействительна.");
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  async function refreshAccessToken() {
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
  }

  async function authFetch(url, options = {}) {
    const doRequest = async (tokenValue) =>
      fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenValue}`,
          ...(options.headers || {}),
        },
      });

    let response = await doRequest(accessToken);
    if (response.status !== 401) return response;
    const newToken = await refreshAccessToken();
    if (!newToken) return response;
    response = await doRequest(newToken);
    return response;
  }

  async function loadMe() {
    const response = await authFetch(`${API_URL}/users/me/`);
    if (response.ok) setMe(await response.json());
  }

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
      setAuthStatus(error.detail || "Ошибка входа.");
      return;
    }
    const data = await response.json();
    setAccessToken(data.access);
    setRefreshToken(data.refresh);
    localStorage.setItem("vmeste_access", data.access);
    localStorage.setItem("vmeste_refresh", data.refresh);
    setAuthStatus("Вход выполнен.");
  }

  function logout() {
    localStorage.removeItem("vmeste_access");
    localStorage.removeItem("vmeste_refresh");
    setAccessToken("");
    setRefreshToken("");
    setMe(null);
    setCurrentView("bookings");
    setAuthStatus("Вы вышли.");
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (form.password !== form.password_confirm) {
      setStatus("Пароли не совпадают.");
      return;
    }
    setStatus("Сохраняем...");
    const payload = {
      ...form,
      organization_address: composeAddressWithDetails(form.organization_address, form),
    };
    const response = await fetch(`${API_URL}/users/register/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      setStatus(typeof error === "object" ? "Проверь поля регистрации." : "Ошибка регистрации.");
      return;
    }
    setStatus("Регистрация успешна. Подтверди email (ссылка в логе backend).");
    setForm(emptyRegisterForm);
    setRegisterStep(1);
    setLoginForm({ username: form.username, password: form.password });
    setAuthMode("login");
  }

  async function resendVerification() {
    setResendStatus("Отправляем письмо...");
    const response = await authFetch(`${API_URL}/users/resend-verification/`, {
      method: "POST",
      body: JSON.stringify({ email: me?.email || form.email || "" }),
    });
    if (!response.ok) {
      setResendStatus("Не удалось отправить письмо.");
      return;
    }
    const data = await response.json();
    setResendStatus(data.detail || "Письмо отправлено.");
  }

  function initMap() {
    const ymaps = window.ymaps;
    if (!ymaps || mapRef.current) return;
    ymaps.ready(() => {
      if (mapRef.current) return;
      mapRef.current = new ymaps.Map("reg-map", {
        center: [Number(form.organization_latitude), Number(form.organization_longitude)],
        zoom: 11,
      });
      mapRef.current.events.add("click", (e) => {
        const coords = e.get("coords");
        const [lat, lon] = coords;
        reverseGeocodeByCoords(lat, lon).then((result) => {
          const shortAddress = buildShortAddress(result?.address);
          const city = getCity(result?.address);
          setForm((prev) => ({
            ...prev,
            organization_latitude: lat.toFixed(6),
            organization_longitude: lon.toFixed(6),
            organization_address: shortAddress || result?.display_name || prev.organization_address,
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
    const normalizedAddress = buildShortAddress(first.address) || first.display_name || addressValue;
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

  async function reverseGeocodeByCoords(lat, lon) {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`,
      { headers: NOMINATIM_HEADERS }
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data || null;
  }

  function federalCityFromReverse(addressObj) {
    if (!addressObj) return "";
    const st = String(addressObj.state || "").toLowerCase();
    if (["москва", "moscow"].some((x) => st.includes(x))) return "Москва";
    if (["санкт-петербург", "saint petersburg", "st petersburg", "петербург"].some((x) => st.includes(x))) {
      return "Санкт-Петербург";
    }
    return "";
  }

  async function nominatimSearchRU(q, limit = 8) {
    const params = new URLSearchParams({
      format: "json",
      addressdetails: "1",
      limit: String(limit),
      countrycodes: "ru",
      q: q.trim(),
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: NOMINATIM_HEADERS,
    });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  /** Подсказки при вводе: Photon (разрешён для autocomplete). Nominatim с клиента для autocomplete запрещён политикой OSM. */
  function mapPhotonFeatureToSuggestion(feature) {
    const coords = feature?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;
    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const p = feature.properties || {};
    const streetHouse = [p.street, p.housenumber].filter(Boolean).join(", ");
    const locality = p.city || p.town || p.village || p.district || "";
    const name = p.name && p.name !== p.street ? p.name : "";
    const head = streetHouse || name || locality || p.country || "";
    const tail = [locality && head !== locality ? locality : null, p.state, p.country].filter(Boolean);
    const value = [head, ...tail].filter(Boolean).join(", ") || head;
    if (!value) return null;
    return {
      value,
      full: value,
      lat,
      lon,
      city: locality || "",
    };
  }

  async function photonSuggestSearch(q, limit = 10) {
    const trimmed = (q || "").trim();
    if (trimmed.length < 2) return [];
    const params = new URLSearchParams({
      q: trimmed,
      limit: String(limit),
    });
    try {
      const response = await fetch(`https://photon.komoot.io/api/?${params}`, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return [];
      const data = await response.json();
      const features = Array.isArray(data?.features) ? data.features : [];
      const seen = new Set();
      const out = [];
      for (const f of features) {
        const item = mapPhotonFeatureToSuggestion(f);
        if (!item || seen.has(item.value)) continue;
        seen.add(item.value);
        out.push(item);
        if (out.length >= limit) break;
      }
      return out;
    } catch {
      return [];
    }
  }

  function mapNominatimToSuggestions(data) {
    return data.map((item) => ({
      value: buildShortAddress(item.address) || item.display_name,
      full: item.display_name,
      lat: Number(item.lat),
      lon: Number(item.lon),
      city: getCity(item.address),
    }));
  }

  function buildNominatimQuery(trimmed, cityHint) {
    if (!trimmed) return "";
    const ru = ", Россия";
    const withRu = trimmed.toLowerCase().includes("росси") ? trimmed : `${trimmed}${ru}`;
    if (cityHint) {
      const lower = trimmed.toLowerCase();
      const ch = cityHint.toLowerCase();
      if (lower.includes(ch)) return withRu;
      const words = trimmed.split(/\s+/).filter(Boolean).length;
      if (/^\d/.test(trimmed) || words <= 4) return `${cityHint}, ${trimmed}`;
    }
    return withRu;
  }

  function geocodeResultLabel(obj) {
    if (!obj) return "";
    if (typeof obj.getAddressLine === "function") {
      const a = obj.getAddressLine();
      if (a) return String(a).trim();
    }
    if (obj.properties && typeof obj.properties.get === "function") {
      const meta = obj.properties.get("GeocoderMetaData");
      if (meta && typeof meta.get === "function") {
        const t = meta.get("text");
        if (t) return String(t).trim();
      }
      const t2 =
        obj.properties.get("text") || obj.properties.get("name") || obj.properties.get("description");
      if (t2) return String(t2).trim();
    }
    return "";
  }

  function geocodeResultCoords(obj) {
    const coords = obj?.geometry?.getCoordinates?.();
    if (!coords || coords.length < 2) return null;
    let lat = Number(coords[0]);
    let lon = Number(coords[1]);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
    if (Math.abs(lat) > 90) {
      const t = lat;
      lat = lon;
      lon = t;
    }
    return { lat, lon };
  }

  function ymapsReadyPromise(ymaps) {
    return new Promise((resolve, reject) => {
      try {
        // API передаёт namespace в successCallback; первый аргумент — НЕ ошибка.
        ymaps.ready(() => resolve(), (err) => reject(err || new Error("ymaps.ready")));
      } catch (e) {
        reject(e);
      }
    });
  }

  function ymapsGeocodePromise(ymaps, query, options) {
    const g = ymaps.geocode(query, options);
    if (g && typeof g.then === "function") {
      return new Promise((resolve, reject) => {
        g.then(resolve, reject);
      });
    }
    return Promise.resolve(g);
  }

  function geoObjectsToArray(coll) {
    if (!coll) return [];
    const n = typeof coll.getLength === "function" ? coll.getLength() : 0;
    if (n > 0 && typeof coll.get === "function") {
      const out = [];
      for (let i = 0; i < n; i += 1) out.push(coll.get(i));
      return out;
    }
    if (typeof coll.each === "function") {
      const out = [];
      coll.each((obj) => {
        out.push(obj);
      });
      return out;
    }
    return [];
  }

  async function yandexGeocodeSuggestItems(trimmed, cityHint) {
    const ymaps = window.ymaps;
    if (!ymaps || !trimmed) return null;
    try {
      await ymapsReadyPromise(ymaps);
    } catch {
      return null;
    }

    const queries = [];
    const pushQ = (q) => {
      const t = (q || "").trim();
      if (!t || queries.includes(t)) return;
      queries.push(t);
    };

    pushQ(buildNominatimQuery(trimmed, cityHint));
    if (cityHint) pushQ(`${cityHint}, ${trimmed}`);
    const withRu = trimmed.toLowerCase().includes("росси") ? trimmed : `${trimmed}, Россия`;
    pushQ(withRu);
    pushQ(trimmed);

    const items = [];
    const seenLines = new Set();

    for (const q of queries) {
      try {
        const res = await ymapsGeocodePromise(ymaps, q, { results: 10 });
        const coll = res?.geoObjects;
        const objs = geoObjectsToArray(coll);
        for (const obj of objs) {
          const label = geocodeResultLabel(obj);
          if (!label || seenLines.has(label)) continue;
          const pos = geocodeResultCoords(obj);
          if (!pos) continue;
          seenLines.add(label);
          let locCity = cityHint || "";
          if (!locCity && typeof obj.getLocalities === "function") {
            const loc = obj.getLocalities();
            if (Array.isArray(loc) && loc.length) [locCity] = loc;
          }
          items.push({
            value: label,
            full: label,
            lat: pos.lat,
            lon: pos.lon,
            city: locCity || "",
          });
          if (items.length >= 8) return items;
        }
      } catch {
        // try next query variant
      }
      if (items.length >= 8) break;
    }

    return items.length ? items : null;
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

      const yaPromise = window.ymaps
        ? Promise.race([
            yandexGeocodeSuggestItems(trimmed, cityHint).then((list) => (list && list.length ? list : [])),
            new Promise((resolve) => {
              setTimeout(() => resolve([]), YANDEX_SUGGEST_CAP_MS);
            }),
          ])
        : Promise.resolve([]);

      const [yaItems, photonItems] = await Promise.all([yaPromise, loadPhotonSuggestionItems()]);
      if (suggestRequestSeqRef.current !== seq) return;
      setAddressSuggestions(yaItems.length ? yaItems : photonItems);
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
    setForm((prev) => ({
      ...prev,
      organization_address: item.value,
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

  function initProfileMapFromCoords(lat, lon) {
    const ymaps = window.ymaps;
    if (!ymaps) return;
    if (profileMapRef.current) return;
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
            organization_address: shortAddress || result?.display_name || p.organization_address,
          }));
          if (city) setDetectedCity(city);
        });
        if (profilePlacemarkRef.current) {
          profilePlacemarkRef.current.geometry.setCoordinates(coords);
        }
      });
    });
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
  }

  function initBranchEditMapFromCoords(lat, lon) {
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
          setLocationForm((p) => ({
            ...p,
            latitude: plat.toFixed(6),
            longitude: plon.toFixed(6),
            address: shortAddress || result?.display_name || p.address,
          }));
          if (city) setDetectedCity(city);
        });
        if (branchEditPlacemarkRef.current) {
          branchEditPlacemarkRef.current.geometry.setCoordinates(coords);
        }
      });
    });
  }

  function initBranchAddMapFromCoords(lat, lon) {
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
          setLocationForm((p) => ({
            ...p,
            latitude: plat.toFixed(6),
            longitude: plon.toFixed(6),
            address: shortAddress || result?.display_name || p.address,
          }));
          if (city) setDetectedCity(city);
        });
        if (branchAddPlacemarkRef.current) {
          branchAddPlacemarkRef.current.geometry.setCoordinates(coords);
        }
      });
    });
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
    setOrgAddressForm((prev) => ({
      ...prev,
      organization_address: item.value,
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
    const normalizedAddress = buildShortAddress(first.address) || first.display_name || addressValue;
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

  function getCity(addressObj) {
    if (!addressObj) return "";
    return (
      addressObj.city ||
      addressObj.town ||
      addressObj.village ||
      addressObj.hamlet ||
      addressObj.municipality ||
      addressObj.city_district ||
      addressObj.suburb ||
      addressObj.quarter ||
      addressObj.state_district ||
      ""
    );
  }

  function buildShortAddress(addressObj) {
    if (!addressObj) return "";
    const road =
      addressObj.road ||
      addressObj.pedestrian ||
      addressObj.footway ||
      addressObj.path ||
      addressObj.residential ||
      addressObj.neighbourhood ||
      addressObj.quarter ||
      "";
    const house = addressObj.house_number || "";
    const building = [addressObj.block, addressObj.building, addressObj.construction].filter(Boolean).join(" ");
    return [road, house, building].filter(Boolean).join(", ");
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
    const details = [];
    if (sourceForm.entrance) details.push(`подъезд ${sourceForm.entrance}`);
    if (sourceForm.floor) details.push(`этаж ${sourceForm.floor}`);
    if (sourceForm.apartment) details.push(`кв. ${sourceForm.apartment}`);
    if (sourceForm.intercom) details.push(`домофон ${sourceForm.intercom}`);
    if (sourceForm.organization_address_details) details.push(sourceForm.organization_address_details);
    return [baseAddress, details.length ? details.join(", ") : ""].filter(Boolean).join(" | ");
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
    if (catRes.ok) setCategories(await catRes.json());
    if (servRes.ok) setServices(await servRes.json());
    if (slotRes.ok) setSlots(await slotRes.json());
    if (bookingRes.ok) setBookings(await bookingRes.json());
    if (locRes.ok) setLocation(await locRes.json());
    if (staffRes.ok) setOrgStaff(await staffRes.json());
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
    const [staffRes, convRes] = await Promise.all([
      authFetch(`${API_URL}/booking/staff/`),
      authFetch(`${API_URL}/chat/conversations/`),
    ]);
    if (staffRes.ok) setOrgStaff(await staffRes.json());
    if (convRes.ok) setConversations(await convRes.json());
  }

  async function loadChats() {
    const res = await authFetch(`${API_URL}/chat/conversations/`);
    if (res.ok) setConversations(await res.json());
  }

  async function inviteStaff(event) {
    event.preventDefault();
    setStaffInviteStatus("Добавляем...");
    const body = { display_name: staffInviteForm.display_name || "" };
    if (staffInviteForm.invite_email.trim()) body.invite_email = staffInviteForm.invite_email.trim();
    if (staffInviteForm.invite_username.trim()) body.invite_username = staffInviteForm.invite_username.trim();
    if (!body.invite_email && !body.invite_username) {
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
    setStaffInviteStatus("Сотрудник добавлен.");
    setStaffInviteForm({ invite_email: "", invite_username: "", display_name: "" });
    loadSellerData();
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

  async function createOrgGroup(event) {
    event.preventDefault();
    setChatStatus("Создаём группу...");
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
    setChatStatus("Группа создана.");
    setGroupForm({ title: "", staff_ids: [] });
    setChatFabOpen(false);
    loadChats();
  }

  async function createDirectChat(event) {
    event.preventDefault();
    if (!directStaffId) return setChatStatus("Выбери сотрудника.");
    setChatStatus("Создаём чат...");
    const response = await authFetch(`${API_URL}/chat/conversations/create-direct/`, {
      method: "POST",
      body: JSON.stringify({ staff_id: Number(directStaffId) }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      setChatStatus(err.detail || "Ошибка.");
      return;
    }
    const conv = await response.json();
    setChatStatus("Чат создан.");
    setDirectStaffId("");
    setChatFabOpen(false);
    await loadChats();
    setSelectedChatId(conv.id);
  }

  function displayConversationTitle(conversation) {
    if (!conversation) return "";
    if (conversation.is_saved_messages) return "Избранное";
    const local = chatLocalPrefs[conversation.id];
    if (local?.title?.trim()) return local.title.trim();
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

  async function sendChatMessage(event) {
    event.preventDefault();
    if (!selectedChatId || !chatInput.trim()) return;
    const response = await authFetch(`${API_URL}/chat/messages/`, {
      method: "POST",
      body: JSON.stringify({ conversation: selectedChatId, text: chatInput.trim() }),
    });
    if (!response.ok) {
      setChatStatus("Не удалось отправить сообщение.");
      return;
    }
    setChatInput("");
    setChatStatus("");
    const res = await authFetch(`${API_URL}/chat/messages/?conversation=${selectedChatId}`);
    if (res.ok) setChatMessages(await res.json());
  }

  function persistChatVisualSettings() {
    if (!selectedChatId) return;
    let prev = {};
    try {
      prev = JSON.parse(localStorage.getItem(chatPrefsStorageKey(selectedChatId)) || "{}");
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
    if (chatMemberNames && Object.keys(chatMemberNames).length) next.memberNames = chatMemberNames;
    else delete next.memberNames;
    try {
      localStorage.setItem(chatPrefsStorageKey(selectedChatId), JSON.stringify(next));
      setChatLocalPrefs((p) => ({ ...p, [selectedChatId]: next }));
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
      if (Object.keys(notify).length) localStorage.setItem(chatNotifyStorageKey(selectedChatId), JSON.stringify(notify));
      else localStorage.removeItem(chatNotifyStorageKey(selectedChatId));
    } catch {
      // ignore
    }
    setChatSettingsOpen(false);
    setChatStatus("");
    setCustomColorPickerOpen(false);
  }

  function clearChatVisualSettings() {
    if (!selectedChatId) return;
    localStorage.removeItem(chatNotifyStorageKey(selectedChatId));
    localStorage.removeItem(chatPrefsStorageKey(selectedChatId));
    setChatLocalPrefs((prev) => {
      const copy = { ...prev };
      delete copy[selectedChatId];
      return copy;
    });
    const sel = conversations.find((c) => c.id === selectedChatId);
    setChatSettingsTitle(sel?.is_saved_messages ? "Избранное" : sel?.title || `Чат #${selectedChatId}`);
    setChatSettingsAvatar("");
    setChatSettingsWallpaper("#dfe9e2");
    setChatSettingsOpen(false);
  }

  function toggleGroupStaff(id) {
    const n = Number(id);
    setGroupForm((prev) => ({
      ...prev,
      staff_ids: prev.staff_ids.includes(n) ? prev.staff_ids.filter((x) => x !== n) : [...prev.staff_ids, n],
    }));
  }

  async function loadClientData() {
    const [locationsRes, bookingsRes] = await Promise.all([
      authFetch(`${API_URL}/locations/`),
      authFetch(`${API_URL}/booking/`),
    ]);
    if (locationsRes.ok) setAllLocations(await locationsRes.json());
    if (bookingsRes.ok) setBookings(await bookingsRes.json());
  }

  async function createCategory(event) {
    event.preventDefault();
    const response = await authFetch(`${API_URL}/catalog/categories/`, {
      method: "POST",
      body: JSON.stringify(categoryForm),
    });
    if (!response.ok) return setSellerStatus("Ошибка при создании категории.");
    setCategoryForm({ name: "", allow_subcategory_booking: true });
    setSellerStatus("Категория создана.");
    loadSellerData();
  }

  async function createService(event) {
    event.preventDefault();
    const payload = {
      ...serviceForm,
      category: serviceForm.category ? Number(serviceForm.category) : null,
      price: Number(serviceForm.price),
      duration_minutes: Number(serviceForm.duration_minutes),
    };
    const response = await authFetch(`${API_URL}/catalog/services/`, { method: "POST", body: JSON.stringify(payload) });
    if (!response.ok) return setSellerStatus("Ошибка при создании услуги.");
    setServiceForm({ category: "", name: "", price: "1000", duration_minutes: "30", is_active: true });
    setSellerStatus("Услуга создана.");
    loadSellerData();
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
    const hasDuplicate = savedIntervals.some(
      (s) => s.start_time === intervalForm.start_time && s.end_time === intervalForm.end_time
    );
    if (hasDuplicate) {
      const msg = "Такой интервал уже есть в сохранённых — выбери другой диапазон времени.";
      setSellerStatus(msg);
      showIntervalToast(msg);
      return;
    }
    const template = {
      id: `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      start_time: intervalForm.start_time,
      end_time: intervalForm.end_time,
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
        body: JSON.stringify({ starts_at: start.toISOString(), ends_at: end.toISOString() }),
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
    const daySlots = slots.filter((s) => s.starts_at?.slice(0, 10) === date);
    for (const slot of daySlots) {
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
    setStatus("Личные данные обновлены.");
    loadMe();
  }

  async function changePassword(event) {
    event.preventDefault();
    const response = await authFetch(`${API_URL}/users/change-password/`, {
      method: "POST",
      body: JSON.stringify(passwordForm),
    });
    if (!response.ok) return setStatus("Не удалось сменить пароль.");
    setStatus("Пароль успешно изменен.");
    setPasswordForm({ old_password: "", new_password: "", new_password_confirm: "" });
  }

  async function changeEmail(event) {
    event.preventDefault();
    const response = await authFetch(`${API_URL}/users/change-email/`, {
      method: "POST",
      body: JSON.stringify(emailForm),
    });
    if (!response.ok) return setStatus("Не удалось сменить email.");
    setStatus("Email изменен. Подтверди его по письму.");
    loadMe();
  }

  async function saveProviderOrganization(event) {
    event.preventDefault();
    setProfileOrgStatus("Сохраняем адрес...");
    const composed = composeAddressWithDetails(orgAddressForm.organization_address, orgAddressForm);
    const response = await authFetch(`${API_URL}/users/me/`, {
      method: "PATCH",
      body: JSON.stringify({
        organization_name: orgAddressForm.organization_name,
        organization_address: composed,
        organization_latitude: orgAddressForm.organization_latitude,
        organization_longitude: orgAddressForm.organization_longitude,
      }),
    });
    if (!response.ok) {
      setProfileOrgStatus("Не удалось сохранить адрес организации.");
      return;
    }
    setProfileOrgStatus("Адрес организации обновлён.");
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
      address: buildShortAddress(first.address) || first.display_name || prev.address,
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
        address: locationForm.address,
        latitude: Number(locationForm.latitude),
        longitude: Number(locationForm.longitude),
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      setBranchGeoStatus(err.detail || Object.values(err).flat().find(Boolean) || "Не удалось добавить филиал.");
      return;
    }
    setLocationForm({ title: "", address: "", latitude: "55.751244", longitude: "37.618423" });
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

  async function onProviderChange(providerId) {
    setClientBookingForm({ provider: providerId, slot: "", comment: "" });
    if (!providerId) return;
    const [servicesRes, slotsRes] = await Promise.all([
      authFetch(`${API_URL}/catalog/services/?provider=${providerId}`),
      authFetch(`${API_URL}/booking/slots/?provider=${providerId}`),
    ]);
    if (servicesRes.ok) setProviderServices(await servicesRes.json());
    if (slotsRes.ok) setProviderSlots(await slotsRes.json());
  }

  async function createClientBooking(event) {
    event.preventDefault();
    const serviceId = providerServices.find((s) => s.is_active)?.id;
    if (!serviceId) {
      setClientStatus("У исполнителя нет активных услуг для записи.");
      return;
    }
    const response = await authFetch(`${API_URL}/booking/`, {
      method: "POST",
      body: JSON.stringify({
        provider: Number(clientBookingForm.provider),
        service: Number(serviceId),
        slot: Number(clientBookingForm.slot),
        comment: clientBookingForm.comment,
      }),
    });
    if (!response.ok) return setClientStatus("Не удалось создать запись.");
    setClientStatus("Запись создана.");
    setClientBookingForm({ provider: "", slot: "", comment: "" });
    loadClientData();
  }

  function renderBookingCalendar(title = "Записи") {
    const [year, month] = bookingsMonth.split("-").map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const offset = (firstDay.getDay() + 6) % 7;
    const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

    const byDay = bookings
      .filter((b) => b.slot_starts_at?.slice(0, 7) === bookingsMonth)
      .reduce((acc, item) => {
        const day = Number(item.slot_starts_at.slice(8, 10));
        if (!acc[day]) acc[day] = [];
        acc[day].push(item);
        return acc;
      }, {});

    const cells = [];
    for (let i = 0; i < offset; i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);

    return (
      <section className="card full-width booking-calendar">
        <h2>{title}</h2>
        <input type="month" value={bookingsMonth} onChange={(e) => setBookingsMonth(e.target.value)} />
        <div className="calendar-grid">
          {weekdays.map((wd, wi) => (
            <div key={wd} className={`calendar-head ${wi >= 5 ? "weekend-head" : ""}`}>{wd}</div>
          ))}
          {cells.map((day, idx) => {
            const col = idx % 7;
            const weekend =
              day != null ? (offset + day - 1) % 7 >= 5 : col >= 5;
            return (
            <div key={`${day ?? "empty"}-${idx}`} className={`calendar-cell ${day ? "" : "empty"} ${weekend ? "weekend-cell" : ""}`}>
              {day && (
                <>
                  <div className="calendar-day">{day}</div>
                  <div className="calendar-slots">
                    {(byDay[day] || []).map((it) => (
                      <div key={it.id} className="calendar-slot booking">
                        <span>
                          {new Date(it.slot_starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          {" - "}
                          {new Date(it.slot_ends_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <strong>{it.status}</strong>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            );
          })}
        </div>
      </section>
    );
  }

  function renderBookingsBlock(title = "Записи") {
    return renderBookingCalendar(title);
  }

  function renderSlotCalendar(showCreateControls = false) {
    const [year, month] = calendarMonth.split("-").map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const offset = (firstDay.getDay() + 6) % 7;
    const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

    const byDay = slots
      .filter((s) => s.starts_at?.slice(0, 7) === calendarMonth)
      .reduce((acc, slot) => {
        const day = Number(slot.starts_at.slice(8, 10));
        if (!acc[day]) acc[day] = [];
        acc[day].push(slot);
        return acc;
      }, {});

    const cells = [];
    for (let i = 0; i < offset; i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);

    return (
      <section className="card full-width interval-calendar">
        <h2>Календарь интервалов</h2>
        {showCreateControls && (
          <>
            <form onSubmit={createSlotsByInterval} className="form">
              <div className="row-2">
                <input type="time" value={intervalForm.start_time} onChange={(e) => setIntervalForm({ ...intervalForm, start_time: e.target.value })} required />
                <input type="time" value={intervalForm.end_time} onChange={(e) => setIntervalForm({ ...intervalForm, end_time: e.target.value })} required />
              </div>
              <button type="submit">Создать интервал</button>
            </form>
            <p className="status">{sellerStatus}</p>
          </>
        )}
        <input type="month" value={calendarMonth} onChange={(e) => setCalendarMonth(e.target.value)} />
        <div className="interval-templates">
          <h3>Сохранённые интервалы</h3>
          {savedIntervals.length === 0 && <p className="muted">Пока нет сохранённых интервалов.</p>}
          <div className="template-list">
            {savedIntervals.map((template) => (
              <div
                key={template.id}
                className={`template-chip ${selectedIntervalId === template.id ? "active" : ""}`}
                draggable
                onClick={() => {
                  setSelectedIntervalId(template.id);
                  setIntervalPopoverId((prev) => (prev === template.id ? null : template.id));
                }}
                onDragStart={() => {
                  setDragIntervalId(template.id);
                  setSelectedIntervalId(template.id);
                }}
              >
                <div className="template-main"><strong>{template.start_time} - {template.end_time}</strong></div>
                <button
                  type="button"
                  className="template-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSavedIntervals((prev) => prev.filter((x) => x.id !== template.id));
                    if (selectedIntervalId === template.id) setSelectedIntervalId(null);
                    if (intervalPopoverId === template.id) setIntervalPopoverId(null);
                  }}
                  aria-label="Удалить сохранённый интервал"
                >
                  ×
                </button>
                {intervalPopoverId === template.id && (
                  <div className="template-popover" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="small-btn" onClick={() => { setSelectedIntervalId(template.id); setIntervalPopoverId(null); }}>
                      Выбрать
                    </button>
                    <button type="button" className="small-btn" onClick={() => { applyIntervalByPattern("daily", template); setIntervalPopoverId(null); }}>
                      Применить на каждый день
                    </button>
                    <button type="button" className="small-btn" onClick={() => { applyIntervalByPattern("workweek", template); setIntervalPopoverId(null); }}>
                      Применить на рабочую неделю
                    </button>
                    <button type="button" className="small-btn" onClick={() => { applyIntervalByPattern("weekend", template); setIntervalPopoverId(null); }}>
                      Применить на выходные
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="calendar-grid">
          {weekdays.map((wd, wi) => (
            <div key={wd} className={`calendar-head ${wi >= 5 ? "weekend-head" : ""}`}>{wd}</div>
          ))}
          {cells.map((day, idx) => {
            const col = idx % 7;
            const weekend =
              day != null ? (offset + day - 1) % 7 >= 5 : col >= 5;
            return (
            <div
              key={`${day ?? "empty"}-${idx}`}
              className={`calendar-cell ${day ? "clickable" : ""} ${day ? "" : "empty"} ${weekend ? "weekend-cell" : ""}`}
              onClick={() => {
                if (!day) return;
                const selected = savedIntervals.find((x) => x.id === selectedIntervalId);
                if (!selected) {
                  setSellerStatus("Выбери сохранённый интервал.");
                  return;
                }
                applyIntervalToDay(day, selected);
              }}
              onDragOver={(e) => {
                if (!day) return;
                e.preventDefault();
              }}
              onDrop={(e) => {
                if (!day) return;
                e.preventDefault();
                const selected = savedIntervals.find((x) => x.id === dragIntervalId || x.id === selectedIntervalId);
                if (!selected) return;
                applyIntervalToDay(day, selected);
              }}
            >
              {day && (
                <>
                  <div className="calendar-day">{day}</div>
                  <div className="calendar-slots">
                    {(byDay[day] || []).slice(0, 3).map((s) => (
                      <div key={s.id} className="slot-chip">
                        <span>
                          {new Date(s.starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          {" - "}
                          {new Date(s.ends_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {!s.is_booked && (
                          <button
                            type="button"
                            className="chip-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSlot(s.id);
                            }}
                          >
                            x
                          </button>
                        )}
                      </div>
                    ))}
                    {(byDay[day] || []).length > 3 && <div className="muted">+{(byDay[day] || []).length - 3}</div>}
                    {(byDay[day] || []).some((s) => s.recurrence_group && !s.is_booked) && (
                      <button
                        type="button"
                        className="small-btn ghost-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          const grp = (byDay[day] || []).find((s) => s.recurrence_group && !s.is_booked)?.recurrence_group;
                          if (grp) deleteSeries(grp);
                        }}
                      >
                        Удалить серию
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
            );
          })}
        </div>
      </section>
    );
  }

  function renderServiceTree() {
    const uncategorized = services.filter((s) => !s.category);
    return (
      <div>
        <h2>Все услуги</h2>
        <div className="tree-list">
          {categories.map((cat) => {
            const catServices = services.filter((s) => s.category === cat.id);
            const isOpen = categoryOpen[cat.id] ?? true;
            return (
              <div key={cat.id} className="tree-node">
                <button
                  type="button"
                  className="tree-toggle"
                  onClick={() => setCategoryOpen((prev) => ({ ...prev, [cat.id]: !isOpen }))}
                >
                  {isOpen ? "▼" : "▶"} {cat.name}
                </button>
                {isOpen && (
                  <div className="tree-children">
                    {catServices.length === 0 && <p className="muted">Нет услуг</p>}
                    {catServices.map((srv) => (
                      <ServiceEditor
                        key={srv.id}
                        service={srv}
                        categories={categories}
                        onSave={updateService}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <div className="tree-node">
            <h4>Без категории</h4>
            <div className="tree-children">
              {uncategorized.length === 0 && <p className="muted">Нет услуг</p>}
              {uncategorized.map((srv) => (
                <ServiceEditor
                  key={srv.id}
                  service={srv}
                  categories={categories}
                  onSave={updateService}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const filteredSidebarChats = useMemo(() => {
    let list = conversations.filter((c) => (chatFolder === "clients" ? c.is_client_correspondence : !c.is_client_correspondence));
    const q = chatSearchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => displayConversationTitle(c).toLowerCase().includes(q));
    }
    return list;
  }, [conversations, chatFolder, chatSearchQuery, chatLocalPrefs]);

  function renderGeneralSettings() {
    return (
      <section className="card profile-card">
        <h2>Настройки</h2>
        <div className="form">
          <h3>Оформление</h3>
          <p className="muted">Тёмная тема сохраняется в этом браузере.</p>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={appTheme === "dark"}
              onChange={(e) => setAppTheme(e.target.checked ? "dark" : "light")}
            />
            Тёмная тема
          </label>
        </div>
        <form onSubmit={changePassword} className="form">
          <h3>Смена пароля</h3>
          <input type="password" value={passwordForm.old_password} onChange={(e) => setPasswordForm({ ...passwordForm, old_password: e.target.value })} placeholder="Старый пароль" />
          <input type="password" value={passwordForm.new_password} onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })} placeholder="Новый пароль" />
          <input type="password" value={passwordForm.new_password_confirm} onChange={(e) => setPasswordForm({ ...passwordForm, new_password_confirm: e.target.value })} placeholder="Повтори новый пароль" />
          <button type="submit">Сменить пароль</button>
        </form>
        <form onSubmit={changeEmail} className="form">
          <h3>Смена почты</h3>
          <input type="email" value={emailForm.new_email} onChange={(e) => setEmailForm({ new_email: e.target.value })} placeholder="Новый email" />
          <button type="submit">Сменить email</button>
        </form>
        {!me?.email_verified && (
          <>
            <p className="status">Подтверди email для полноценной работы.</p>
            <button type="button" onClick={resendVerification}>Отправить письмо повторно</button>
            <p className="status">{resendStatus}</p>
          </>
        )}
      </section>
    );
  }

  function renderOrganizationSettings() {
    if (!canManageOrgSettings) return null;
    return (
      <section className="card profile-card">
        <h2>Организация</h2>
        {me?.role === "staff" && staffEffectivePerms.can_delegate_permissions && (
          <p className="muted">Адрес организации и филиалы настраивает руководитель. Здесь вы можете вести команду, должности и права доступа.</p>
        )}
        {me?.role === "provider" && (
          <>
            <h3>Адрес организации (основной)</h3>
            {!orgMainEditOpen ? (
              <div className="org-main-display">
                <p className="org-display-line"><strong>{orgAddressForm.organization_name || "—"}</strong></p>
                <p className="org-display-line">{me?.organization_address || "Адрес не указан."}</p>
                <div id="profile-address-map" className="map-box" />
                <button type="button" className="ghost-btn" onClick={() => setOrgMainEditOpen(true)}>Изменить</button>
                <p className="status">{profileOrgStatus}</p>
              </div>
            ) : (
              <form onSubmit={saveProviderOrganization} className="form org-main-edit-form">
                <input
                  placeholder="Название организации"
                  value={orgAddressForm.organization_name}
                  onChange={(e) => setOrgAddressForm({ ...orgAddressForm, organization_name: e.target.value })}
                  required
                />
                <input
                  placeholder="Адрес (улица, дом)"
                  value={orgAddressForm.organization_address}
                  onChange={(e) => onProfileAddressInput(e.target.value)}
                  onBlur={(e) => geocodeProfileAddress(e.target.value)}
                  required
                />
                {detectedCity && <p className="hint">Город поиска: {detectedCity}</p>}
                {addressSuggestions.length > 0 && (
                  <div className="suggestions">
                    {addressSuggestions.map((item, idx) => (
                      <button
                        key={`${item.value}-${idx}`}
                        type="button"
                        className="suggestion-item"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pickProfileSuggestion(item)}
                      >
                        {item.value}
                      </button>
                    ))}
                  </div>
                )}
                <div id="profile-address-map" className="map-box" />
                <div className="address-details-grid">
                  <input placeholder="Подъезд" value={orgAddressForm.entrance} onChange={(e) => setOrgAddressForm({ ...orgAddressForm, entrance: e.target.value })} />
                  <input placeholder="Этаж" value={orgAddressForm.floor} onChange={(e) => setOrgAddressForm({ ...orgAddressForm, floor: e.target.value })} />
                  <input placeholder="Квартира/офис" value={orgAddressForm.apartment} onChange={(e) => setOrgAddressForm({ ...orgAddressForm, apartment: e.target.value })} />
                  <input placeholder="Домофон" value={orgAddressForm.intercom} onChange={(e) => setOrgAddressForm({ ...orgAddressForm, intercom: e.target.value })} />
                </div>
                <input
                  placeholder="Доп. ориентир (необязательно)"
                  value={orgAddressForm.organization_address_details}
                  onChange={(e) => setOrgAddressForm({ ...orgAddressForm, organization_address_details: e.target.value })}
                />
                <div className="row-2">
                  <button type="submit">Сохранить</button>
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => {
                      syncOrgAddressFormFromMe();
                      setOrgMainEditOpen(false);
                      setProfileOrgStatus("");
                    }}
                  >
                    Отмена
                  </button>
                </div>
                <p className="status">{profileOrgStatus}</p>
              </form>
            )}

            <h3>Филиалы</h3>
            <button
              type="button"
              className="ghost-btn org-branch-add-toggle"
              onClick={() => {
                setOrgBranchAddOpen((v) => {
                  const next = !v;
                  if (next) {
                    setSelectedOrgBranchId(null);
                    setOrgBranchEditOpen(false);
                    setLocationForm({ title: "", address: "", latitude: "55.751244", longitude: "37.618423" });
                    setBranchGeoStatus("");
                    setAddressSuggestions([]);
                  }
                  return next;
                });
              }}
            >
              {orgBranchAddOpen ? "Закрыть форму добавления" : "Добавить филиал"}
            </button>
            {orgBranchAddOpen && (
              <form onSubmit={createProviderBranch} className="form org-branch-add-form">
                <input placeholder="Название филиала" value={locationForm.title} onChange={(e) => setLocationForm({ ...locationForm, title: e.target.value })} required />
                <input
                  placeholder="Адрес филиала"
                  value={locationForm.address}
                  onChange={(e) => onBranchAddressInput(e.target.value)}
                  onBlur={() => geocodeBranchAddress()}
                  required
                />
                {detectedCity && <p className="hint">Город поиска: {detectedCity}</p>}
                {addressSuggestions.length > 0 && (
                  <div className="suggestions">
                    {addressSuggestions.map((item, idx) => (
                      <button
                        key={`branch-add-${item.value}-${idx}`}
                        type="button"
                        className="suggestion-item"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pickBranchLocationSuggestion(item)}
                      >
                        {item.value}
                      </button>
                    ))}
                  </div>
                )}
                <button type="button" className="ghost-btn" onClick={geocodeBranchAddress}>Найти адрес на карте</button>
                <div id="branch-add-map" className="map-box" />
                <button type="submit">Сохранить филиал</button>
              </form>
            )}
            <ul className="list org-branch-list">
              {location.map((loc) => (
                <li key={loc.id}>
                  <button
                    type="button"
                    className={`org-branch-pick ${Number(selectedOrgBranchId) === Number(loc.id) ? "active" : ""}`}
                    onClick={() => {
                      setSelectedOrgBranchId(loc.id);
                      setOrgBranchAddOpen(false);
                      setOrgBranchEditOpen(false);
                      setBranchGeoStatus("");
                    }}
                  >
                    <span className="org-branch-pick-title">{loc.title}</span>
                    <span className="org-branch-pick-addr muted">{loc.address}</span>
                  </button>
                </li>
              ))}
            </ul>
            {location.length === 0 && !orgBranchAddOpen && <p className="muted">Пока нет филиалов.</p>}
            {selectedOrgBranchId != null && !orgBranchAddOpen && (() => {
              const br = location.find((l) => Number(l.id) === Number(selectedOrgBranchId));
              if (!br) return null;
              return (
                <div className="org-branch-detail">
                  <h4>{br.title}</h4>
                  <p className="org-branch-detail-addr">{br.address}</p>
                  {!orgBranchEditOpen ? (
                    <>
                      <div id="branch-detail-map" className="map-box" />
                      <div className="row-2">
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => {
                            setAddressSuggestions([]);
                            setOrgBranchEditOpen(true);
                            setLocationForm({
                              title: br.title,
                              address: br.address,
                              latitude: String(br.latitude),
                              longitude: String(br.longitude),
                            });
                          }}
                        >
                          Изменить
                        </button>
                        <button type="button" className="ghost-btn" onClick={() => deleteProviderBranch(br.id)}>Удалить</button>
                      </div>
                    </>
                  ) : (
                    <form onSubmit={saveProviderBranchEdit} className="form">
                      <input placeholder="Название филиала" value={locationForm.title} onChange={(e) => setLocationForm({ ...locationForm, title: e.target.value })} required />
                      <input
                        placeholder="Адрес"
                        value={locationForm.address}
                        onChange={(e) => onBranchAddressInput(e.target.value)}
                        onBlur={() => geocodeBranchAddress()}
                        required
                      />
                      {detectedCity && <p className="hint">Город поиска: {detectedCity}</p>}
                      {addressSuggestions.length > 0 && (
                        <div className="suggestions">
                          {addressSuggestions.map((item, idx) => (
                            <button
                              key={`branch-edit-${item.value}-${idx}`}
                              type="button"
                              className="suggestion-item"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => pickBranchLocationSuggestion(item)}
                            >
                              {item.value}
                            </button>
                          ))}
                        </div>
                      )}
                      <button type="button" className="ghost-btn" onClick={geocodeBranchAddress}>Найти адрес на карте</button>
                      <div id="branch-edit-map" className="map-box" />
                      <div className="row-2">
                        <button type="submit">Сохранить</button>
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => {
                            setOrgBranchEditOpen(false);
                            setLocationForm({
                              title: br.title,
                              address: br.address,
                              latitude: String(br.latitude),
                              longitude: String(br.longitude),
                            });
                          }}
                        >
                          Отмена
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              );
            })()}
            <p className="status">{branchGeoStatus}</p>
          </>
        )}

        <h3>Сотрудники и права</h3>
        <p className="muted">Руководитель настраивает всё. Сотрудник с правом «Может настраивать права других» видит этот блок и может менять права коллег.</p>
        {me?.role === "provider" && (
          <form onSubmit={inviteStaff} className="form">
            <input type="email" placeholder="Email сотрудника" value={staffInviteForm.invite_email} onChange={(e) => setStaffInviteForm({ ...staffInviteForm, invite_email: e.target.value })} />
            <input placeholder="Или логин сотрудника" value={staffInviteForm.invite_username} onChange={(e) => setStaffInviteForm({ ...staffInviteForm, invite_username: e.target.value })} />
            <input placeholder="Как показывать клиентам (необязательно)" value={staffInviteForm.display_name} onChange={(e) => setStaffInviteForm({ ...staffInviteForm, display_name: e.target.value })} />
            <button type="submit">Добавить сотрудника</button>
          </form>
        )}
        <p className="status">{staffInviteStatus}</p>
        <ul className="list staff-list">
          {orgStaff.map((link) => {
            const permBase = {
              manage_bookings: true,
              manage_intervals: false,
              manage_services: false,
              manage_chats: true,
              manage_staff: false,
              can_delegate_permissions: false,
              ...(link.permissions || {}),
            };
            const permLabels = [
              ["manage_bookings", "Записи клиентов"],
              ["manage_intervals", "Календарь интервалов"],
              ["manage_services", "Услуги и категории"],
              ["manage_chats", "Чаты организации"],
              ["manage_staff", "Добавление сотрудников"],
              ["can_delegate_permissions", "Может настраивать права других"],
            ];
            return (
              <li key={link.id} className="staff-block">
                <div className="staff-row">
                  <span>
                    {link.display_name || link.staff_user?.username || `id ${link.staff}`}{" "}
                    <span className="muted">({link.staff_user?.email || link.staff_user?.username}){link.is_active ? "" : " — отключён"}</span>
                  </span>
                  {me?.role === "provider" && link.is_active && (
                    <button type="button" className="small-btn ghost-btn" onClick={() => deactivateStaff(link.id)}>Отключить</button>
                  )}
                </div>
                <div className="staff-job-row">
                  <label className="muted small-label">Должность</label>
                  <input
                    className="job-title-input"
                    placeholder="Например, администратор"
                    defaultValue={link.job_title || ""}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (link.job_title || "").trim()) patchStaffMeta(link.id, { job_title: v });
                    }}
                  />
                </div>
                {link.is_active && (me?.role === "provider" || staffEffectivePerms.can_delegate_permissions) && (
                  <div className="staff-perms">
                    <div className="muted small-label">Права доступа</div>
                    <div className="perm-grid">
                      {permLabels.map(([key, label]) => (
                        <label key={key} className="checkbox perm-item">
                          <input
                            type="checkbox"
                            checked={Boolean(permBase[key])}
                            onChange={() => toggleStaffPermission(link, key)}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {orgStaff.length === 0 && <p className="muted">Пока нет привязанных сотрудников.</p>}
      </section>
    );
  }

  const activeChatWallpaper = selectedChatId ? chatLocalPrefs[selectedChatId]?.wallpaper : null;
  const tgMainStyle = activeChatWallpaper
    ? String(activeChatWallpaper).includes("gradient")
      ? { background: activeChatWallpaper, backgroundSize: "cover" }
      : { backgroundColor: activeChatWallpaper }
    : undefined;
  const tgMainDark = activeChatWallpaper === "#1e2a24";
  const centeredWorkspace = accessToken && ["profile", "organization", "settings"].includes(currentView);

  return (
    <div className={`page${accessToken ? " page-logged" : ""}`}>
      <header className="hero top-row">
        <button type="button" className="brand-link brand-btn" onClick={() => setCurrentView("bookings")}>
          <img
            src={logoMain}
            alt="Vmeste"
            className="brand-logo"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </button>
        <div>{verifyStatus && <p className="verify-note">{verifyStatus}</p>}</div>
        {accessToken && (
          <div className="menu-wrap">
            <button className="menu-btn" onClick={() => setMenuOpen((v) => !v)}>Меню</button>
            {menuOpen && (
              <div className="menu-dropdown">
                <button type="button" className="menu-dropdown-item" onClick={() => { setCurrentView("profile"); setMenuOpen(false); }}>
                  <span className="menu-item-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
                  </span>
                  <span className="menu-item-label">Личный кабинет</span>
                </button>
                <button type="button" className="menu-dropdown-item" onClick={() => { setCurrentView("settings"); setMenuOpen(false); }}>
                  <span className="menu-item-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" /></svg>
                  </span>
                  <span className="menu-item-label">Настройки</span>
                </button>
                {canManageOrgSettings && (
                  <button type="button" className="menu-dropdown-item" onClick={() => { setCurrentView("organization"); setMenuOpen(false); }}>
                    <span className="menu-item-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z" /></svg>
                    </span>
                    <span className="menu-item-label">Организация</span>
                  </button>
                )}
                <button type="button" className="menu-dropdown-item" onClick={logout}>
                  <span className="menu-item-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" /></svg>
                  </span>
                  <span className="menu-item-label">Выйти</span>
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {intervalToast && (
        <div className="interval-toast" role="alert">
          {intervalToast}
        </div>
      )}

      {accessToken && me?.role === "provider" && (
        <nav className="app-subnav" aria-label="Разделы исполнителя">
          <button type="button" className={currentView === "bookings" ? "active" : ""} onClick={() => setCurrentView("bookings")}>Записи</button>
          <button type="button" className={currentView === "intervals" ? "active" : ""} onClick={() => setCurrentView("intervals")}>Календарь интервалов</button>
          <button type="button" className={currentView === "services" ? "active" : ""} onClick={() => setCurrentView("services")}>Услуги и категории</button>
          <button type="button" className={currentView === "chats" ? "active" : ""} onClick={() => setCurrentView("chats")}>Чаты</button>
        </nav>
      )}

      {accessToken && me?.role === "staff" && (
        <nav className="app-subnav" aria-label="Разделы сотрудника">
          {staffHasPerm("manage_bookings") && (
            <button type="button" className={currentView === "bookings" ? "active" : ""} onClick={() => setCurrentView("bookings")}>Записи</button>
          )}
          {staffHasPerm("manage_chats") && (
            <button type="button" className={currentView === "chats" ? "active" : ""} onClick={() => setCurrentView("chats")}>Чаты</button>
          )}
        </nav>
      )}

      <main className={`grid ${!accessToken ? "grid-auth" : ""}${centeredWorkspace ? " grid-centered-workspace" : ""}`}>
        {!accessToken && (
          <section className="card profile-card">
            <h2>{authMode === "login" ? "Вход" : "Регистрация"}</h2>
            {authMode === "login" ? (
              <form onSubmit={onLogin} className="form">
                <input placeholder="Логин" value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })} required />
                <input placeholder="Пароль" type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} required />
                <button type="submit">Войти</button>
              </form>
            ) : (
              <form onSubmit={onSubmit} className="form">
                {registerStep === 1 && (
                  <>
                    <input placeholder="Фамилия" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
                    <input placeholder="Имя" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
                    <input placeholder="Отчество (если есть)" value={form.patronymic} onChange={(e) => setForm({ ...form, patronymic: e.target.value })} />
                    <input placeholder="Логин" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
                    <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                    <input placeholder="Телефон" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                    <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                      {roleOptions.map((item) => <option key={item.key} value={item.key}>{item.value}</option>)}
                    </select>
                    <input placeholder="Пароль" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
                    <input
                      placeholder="Повторите пароль"
                      type="password"
                      value={form.password_confirm}
                      onChange={(e) => setForm({ ...form, password_confirm: e.target.value })}
                      required
                    />
                    {form.role === "provider" ? <button type="button" onClick={() => setRegisterStep(2)}>Продолжить</button> : <button type="submit">Создать аккаунт</button>}
                  </>
                )}
                {registerStep === 2 && form.role === "provider" && (
                  <>
                    <select value={form.provider_sphere} onChange={(e) => setForm({ ...form, provider_sphere: e.target.value })} required>
                      <option value="">Выбери сферу услуг</option>
                      {sphereOptions.map((s) => <option key={s.key} value={s.key}>{s.value}</option>)}
                    </select>
                    <input placeholder="Название организации" value={form.organization_name} onChange={(e) => setForm({ ...form, organization_name: e.target.value })} required />
                    <input
                      placeholder="Адрес"
                      value={form.organization_address}
                      onChange={(e) => onAddressInput(e.target.value)}
                      onBlur={(e) => geocodeAddress(e.target.value)}
                      required
                    />
                    {detectedCity && <p className="hint">Город поиска: {detectedCity}</p>}
                    {addressSuggestions.length > 0 && (
                      <div className="suggestions">
                        {addressSuggestions.map((item, idx) => (
                          <button
                            key={`${item.value}-${idx}`}
                            type="button"
                            className="suggestion-item"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => pickSuggestion(item)}
                          >
                            {item.value}
                          </button>
                        ))}
                      </div>
                    )}
                    <div id="reg-map" className="map-box" />
                    <div className="address-details-grid">
                      <input
                        placeholder="Подъезд"
                        value={form.entrance}
                        onChange={(e) => setForm({ ...form, entrance: e.target.value })}
                      />
                      <input
                        placeholder="Этаж"
                        value={form.floor}
                        onChange={(e) => setForm({ ...form, floor: e.target.value })}
                      />
                      <input
                        placeholder="Квартира/офис"
                        value={form.apartment}
                        onChange={(e) => setForm({ ...form, apartment: e.target.value })}
                      />
                      <input
                        placeholder="Домофон"
                        value={form.intercom}
                        onChange={(e) => setForm({ ...form, intercom: e.target.value })}
                      />
                    </div>
                    <input
                      placeholder="Доп. ориентир (необязательно)"
                      value={form.organization_address_details}
                      onChange={(e) => setForm({ ...form, organization_address_details: e.target.value })}
                    />
                    <button type="button" className="ghost-btn" onClick={() => setRegisterStep(1)}>Назад</button>
                    <button type="submit">Завершить регистрацию</button>
                  </>
                )}
              </form>
            )}
            <p className="auth-switch-text">{authMode === "login" ? "Нет аккаунта?" : "Уже есть аккаунт?"}</p>
            <button className="ghost-btn" type="button" onClick={() => setAuthMode((prev) => (prev === "login" ? "register" : "login"))}>
              {authMode === "login" ? "Регистрация" : "Войти"}
            </button>
            <p className="status">{authMode === "login" ? authStatus : status}</p>
          </section>
        )}

        {accessToken && currentView === "profile" && (
          <section className="card profile-card">
            <h2>Личный кабинет</h2>
            <p>Вы вошли как: <strong>{fullName}</strong></p>
            <form onSubmit={updateProfile} className="form">
              <h3>Личная информация</h3>
              <input value={profileForm.last_name} onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })} placeholder="Фамилия" />
              <input value={profileForm.first_name} onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })} placeholder="Имя" />
              <input value={profileForm.patronymic} onChange={(e) => setProfileForm({ ...profileForm, patronymic: e.target.value })} placeholder="Отчество" />
              <input value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} placeholder="Телефон" />
              <button type="submit">Сохранить данные</button>
            </form>
            <div className="row-2 profile-quick-nav">
              <button type="button" className="ghost-btn" onClick={() => setCurrentView("settings")}>Настройки</button>
              {canManageOrgSettings && (
                <button type="button" className="ghost-btn" onClick={() => setCurrentView("organization")}>Организация</button>
              )}
            </div>
            {!me?.email_verified && (
              <>
                <p className="status">Подтверди email для полноценной работы.</p>
                <button type="button" onClick={resendVerification}>Отправить письмо повторно</button>
                <p className="status">{resendStatus}</p>
              </>
            )}
            {me?.role === "staff" && orgStaff.length > 0 && (
              <>
                <h3>Моя организация</h3>
                <p className="muted">Разделы «Записи» и «Чаты» — под оранжевой шапкой (доступ по правам, их настраивает исполнитель).</p>
              </>
            )}
          </section>
        )}

        {accessToken && currentView === "settings" && renderGeneralSettings()}
        {accessToken && currentView === "organization" && canManageOrgSettings && renderOrganizationSettings()}

        {accessToken && me?.role === "provider" && currentView === "bookings" && renderBookingsBlock("Записи клиентов")}
        {accessToken && me?.role === "provider" && currentView === "intervals" && renderSlotCalendar(true)}
        {accessToken && me?.role === "staff" && currentView === "bookings" && staffHasPerm("manage_bookings") && renderBookingsBlock("Записи")}
        {accessToken && (me?.role === "provider" || me?.role === "staff") && currentView === "chats" && (
          <section className="card full-width">
            <h2>Чаты внутри организации</h2>
            <div className="tg-body">
              <aside className="tg-sidebar">
                <div className="tg-sidebar-head">
                  <span className="tg-sidebar-title">Чаты</span>
                  {me?.role === "provider" && (
                    <div className="tg-fab-wrap">
                      <button type="button" className="tg-fab" onClick={() => setChatFabOpen((v) => !v)}>+</button>
                      {chatFabOpen && (
                        <div className="tg-fab-menu">
                          <form onSubmit={createOrgGroup} className="form tg-popover-form">
                            <div className="tg-popover-title">Новая группа</div>
                            <p className="muted tg-popover-hint">Можно не отмечать сотрудников — группа только для тебя. Или добавь участников.</p>
                            <input
                              placeholder="Название группы"
                              value={groupForm.title}
                              onChange={(e) => setGroupForm({ ...groupForm, title: e.target.value })}
                              required
                            />
                            <div className="staff-pick-grid">
                              {orgStaff.filter((l) => l.is_active).map((link) => (
                                <label key={link.id} className="checkbox">
                                  <input
                                    type="checkbox"
                                    checked={groupForm.staff_ids.includes(link.staff)}
                                    onChange={() => toggleGroupStaff(link.staff)}
                                  />
                                  {link.display_name || link.staff_user?.username || `id ${link.staff}`}
                                </label>
                              ))}
                            </div>
                            <button type="submit">Создать группу</button>
                          </form>
                          <form onSubmit={createDirectChat} className="form tg-popover-form">
                            <div className="tg-popover-title">Личный чат</div>
                            <select value={directStaffId} onChange={(e) => setDirectStaffId(e.target.value)} required>
                              <option value="">Выбери сотрудника</option>
                              {orgStaff.filter((l) => l.is_active).map((link) => (
                                <option key={link.id} value={link.staff}>
                                  {link.display_name || link.staff_user?.username}
                                </option>
                              ))}
                            </select>
                            <button type="submit">Начать чат</button>
                          </form>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <input
                  type="search"
                  className="tg-chat-search"
                  placeholder="Поиск по чатам..."
                  value={chatSearchQuery}
                  onChange={(e) => setChatSearchQuery(e.target.value)}
                />
                <div className="tg-folder-tabs">
                  <button type="button" className={chatFolder === "org" ? "active" : ""} onClick={() => setChatFolder("org")}>Организация</button>
                  <button type="button" className={chatFolder === "clients" ? "active" : ""} onClick={() => setChatFolder("clients")}>Клиенты</button>
                </div>
                {chatFolder === "org" && me?.role === "provider" && (
                  <div className="tg-org-block">
                    <div className="tg-org-label">Сотрудники</div>
                    <div className="tg-org-chips">
                      {orgStaff.filter((l) => l.is_active).map((link) => (
                        <button
                          key={link.id}
                          type="button"
                          className="tg-org-chip"
                          onClick={() => {
                            setDirectStaffId(String(link.staff));
                            setChatFabOpen(true);
                          }}
                        >
                          {link.display_name || link.staff_user?.username}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="tg-chat-list">
                  {filteredSidebarChats.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      className={`tg-chat-item ${selectedChatId === c.id ? "active" : ""} ${c.is_saved_messages ? "saved" : ""}`}
                      onClick={() => setSelectedChatId(c.id)}
                    >
                      <span className={`tg-avatar ${c.is_saved_messages ? "tg-avatar-saved" : ""}`}>
                        {chatLocalPrefs[c.id]?.avatarDataUrl ? (
                          <img src={chatLocalPrefs[c.id].avatarDataUrl} alt="" className="tg-avatar-img" />
                        ) : (
                          conversationAvatarLetter(c)
                        )}
                      </span>
                      <span className="tg-chat-item-text">
                        <span className="tg-chat-item-title">{displayConversationTitle(c)}</span>
                        <span className="tg-chat-item-sub">
                          {c.last_message?.text ? `${(c.last_message.text || "").slice(0, 42)}${(c.last_message.text || "").length > 42 ? "…" : ""}` : c.is_group ? "Группа" : c.is_saved_messages ? "Личный раздел" : "Диалог"}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
                {filteredSidebarChats.length === 0 && <p className="tg-empty">{chatFolder === "clients" ? "Пока нет чатов с клиентами — они появятся здесь автоматически." : "Нет чатов в этой папке."}</p>}
              </aside>
              <div className={`tg-main ${tgMainDark ? "tg-main--dark" : ""}`} style={tgMainStyle}>
                <div className="tg-main-head">
                  {selectedChatId ? displayConversationTitle(conversations.find((c) => c.id === selectedChatId)) : "Выбери чат"}
                  {selectedChatId && (
                    <button type="button" className="tg-gear" onClick={() => setChatSettingsOpen(true)}>⚙</button>
                  )}
                </div>
                {selectedChatId ? (
                  <>
                    <div className="tg-messages">
                      {chatMessages.map((m) => (
                        <div key={m.id} className={`tg-msg ${Number(m.sender) === Number(me?.id) ? "tg-msg-own" : ""}`}>
                          <div className="tg-msg-author">
                            {chatMemberNames[m.sender] ??
                              chatLocalPrefs[selectedChatId]?.memberNames?.[m.sender] ??
                              m.sender_username}
                          </div>
                          <div className="tg-msg-text">{m.text}</div>
                          <div className="tg-msg-time">{new Date(m.created_at).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                    <form onSubmit={sendChatMessage} className="tg-compose">
                      <input className="tg-compose-input" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Сообщение..." />
                      <button type="submit" className="tg-send-btn" aria-label="Отправить сообщение" title="Отправить">
                        <svg className="tg-send-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                          <path
                            fill="currentColor"
                            d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"
                          />
                        </svg>
                      </button>
                    </form>
                  </>
                ) : (
                  <div className="tg-empty">Выбери чат слева.</div>
                )}
                <p className="tg-status">{chatStatus}</p>
              </div>
            </div>
            {chatSettingsOpen && selectedChatId && (
              <div
                className="modal-backdrop"
                onClick={() => {
                  setChatSettingsOpen(false);
                  setCustomColorPickerOpen(false);
                }}
              >
                <div className="modal-card tg-settings-card" onClick={(e) => e.stopPropagation()}>
                  <h3>Настройки чата</h3>
                  <p className="muted">Как в Telegram: название, аватар и фон чата. Хранится в браузере на этом устройстве.</p>
                  <label className="tg-settings-label">
                    Название в списке
                    <input value={chatSettingsTitle} onChange={(e) => setChatSettingsTitle(e.target.value)} />
                  </label>
                  <label className="tg-settings-label">
                    Аватар (картинка)
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => setChatSettingsAvatar(typeof reader.result === "string" ? reader.result : "");
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                  {chatSettingsAvatar && (
                    <div className="tg-settings-preview">
                      <img src={chatSettingsAvatar} alt="" />
                      <button type="button" className="ghost-btn" onClick={() => setChatSettingsAvatar("")}>
                        Убрать аватар
                      </button>
                    </div>
                  )}
                  <div className="tg-wall-label">Фон переписки</div>
                  <div className="tg-wall-grid">
                    {CHAT_WALL_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`tg-wall-swatch ${chatSettingsWallpaper === opt.value ? "active" : ""}`}
                        style={{ background: opt.value }}
                        title={opt.label}
                        onClick={() => {
                          setChatSettingsWallpaper(opt.value);
                          setCustomColorPickerOpen(false);
                        }}
                      />
                    ))}
                  </div>
                  <div className="tg-wall-label">Свой цвет</div>
                  <div className="tg-color-row">
                    <button
                      type="button"
                      className="ghost-btn tg-color-picker-toggle"
                      onClick={() => setCustomColorPickerOpen((v) => !v)}
                    >
                      {customColorPickerOpen ? "Закрыть палитру" : "Открыть палитру"}
                    </button>
                    {customColorPickerOpen && (
                      <div className="tg-color-popover">
                        <input
                          type="color"
                          value={
                            chatSettingsWallpaper && chatSettingsWallpaper.startsWith("#") && chatSettingsWallpaper.length >= 4
                              ? chatSettingsWallpaper.slice(0, 7)
                              : "#dfe9e2"
                          }
                          onChange={(e) => setChatSettingsWallpaper(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                  <div className="tg-wall-label">Уведомления</div>
                  <select value={chatSettingsNotify} onChange={(e) => setChatSettingsNotify(e.target.value)} className="tg-notify-select">
                    <option value="all">Включены</option>
                    <option value="off">Заглушить</option>
                    <option value="1h">Заглушить на 1 час</option>
                    <option value="2h">Заглушить на 2 часа</option>
                    <option value="8h">Заглушить на 8 часов</option>
                  </select>
                  {(() => {
                    const sel = conversations.find((x) => x.id === selectedChatId);
                    if (!sel?.members?.length) return null;
                    return (
                      <div className="tg-members-block">
                        <div className="tg-wall-label">Имена в чате (только у тебя)</div>
                        {sel.members.map((mem) => (
                          <div key={mem.id} className="tg-member-row">
                            <span className="muted tg-member-login">{mem.username}</span>
                            <input
                              value={chatMemberNames[mem.user] ?? ""}
                              placeholder={`${mem.first_name || ""} ${mem.last_name || ""}`.trim() || mem.username}
                              onChange={(e) => setChatMemberNames((prev) => ({ ...prev, [mem.user]: e.target.value }))}
                            />
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  <div className="tg-settings-actions">
                    <button type="button" className="primary" onClick={persistChatVisualSettings}>
                      Сохранить
                    </button>
                    <button type="button" className="ghost-btn" onClick={clearChatVisualSettings}>
                      Сбросить оформление
                    </button>
                    <button type="button" className="ghost-btn" onClick={() => setChatSettingsOpen(false)}>
                      Закрыть
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {accessToken && me?.role === "provider" && currentView === "services" && (
          <div className="services-layout">
            <section className="card">
              {renderServiceTree()}
            </section>
            <section className="card right-stack">
              <h2>Создать категорию</h2>
              <form onSubmit={createCategory} className="form">
                <input
                  placeholder="Название категории"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  required
                />
                <button type="submit">Добавить категорию</button>
              </form>
              <h2>Создать услугу</h2>
              <form onSubmit={createService} className="form">
                <input
                  placeholder="Название услуги"
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                  required
                />
                <input
                  type="number"
                  placeholder="Цена"
                  value={serviceForm.price}
                  onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })}
                  required
                />
                <input
                  type="number"
                  placeholder="Длительность (мин)"
                  value={serviceForm.duration_minutes}
                  onChange={(e) => setServiceForm({ ...serviceForm, duration_minutes: e.target.value })}
                  required
                />
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={serviceForm.is_active}
                    onChange={(e) => setServiceForm({ ...serviceForm, is_active: e.target.checked })}
                  />
                  Активна
                </label>
                <select
                  value={serviceForm.category}
                  onChange={(e) => setServiceForm({ ...serviceForm, category: e.target.value })}
                >
                  <option value="">Без категории</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button type="submit">Создать услугу</button>
              </form>
              <p className="status">{sellerStatus}</p>
            </section>
          </div>
        )}

        {accessToken && me?.role === "client" && (
          <>
            {currentView !== "bookings" && (
              <section className="card profile-card">
                <h2>Личный кабинет</h2>
                <p>Вы вошли как: <strong>{fullName}</strong></p>
                <button type="button" className="ghost-btn" onClick={() => setCurrentView("settings")}>Настройки</button>
              </section>
            )}
            <section className="card">
              <h2>Выбор точки и запись</h2>
              <form onSubmit={createClientBooking} className="form">
                <select value={clientBookingForm.provider} onChange={(e) => onProviderChange(e.target.value)} required>
                  <option value="">Выбери организацию</option>
                  {allLocations.map((item) => <option key={item.id} value={item.provider}>{item.title} - {item.address}</option>)}
                </select>
                <select value={clientBookingForm.slot} onChange={(e) => setClientBookingForm({ ...clientBookingForm, slot: e.target.value })} required>
                  <option value="">Выбери время</option>
                  {providerSlots.map((item) => <option key={item.id} value={item.id}>{new Date(item.starts_at).toLocaleString()}</option>)}
                </select>
                <input placeholder="Комментарий к записи" value={clientBookingForm.comment} onChange={(e) => setClientBookingForm({ ...clientBookingForm, comment: e.target.value })} />
                <button type="submit">Записаться</button>
              </form>
              <p className="status">{clientStatus}</p>
            </section>
            {currentView === "bookings" && renderBookingsBlock("Мои записи")}
          </>
        )}
      </main>
      <div className="incoming-toast-stack" aria-live="polite">
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
      </div>
    </div>
  );
}

function ServiceEditor({ service, categories, onSave }) {
  const [local, setLocal] = useState({
    name: service.name,
    price: service.price,
    duration_minutes: service.duration_minutes,
    is_active: service.is_active,
    category: service.category ?? "",
  });

  useEffect(() => {
    setLocal({
      name: service.name,
      price: service.price,
      duration_minutes: service.duration_minutes,
      is_active: service.is_active,
      category: service.category ?? "",
    });
  }, [service]);

  return (
    <div className="service-editor service-editor-row">
      <input value={local.name} onChange={(e) => setLocal({ ...local, name: e.target.value })} placeholder="Услуга" />
      <input type="number" value={local.price} onChange={(e) => setLocal({ ...local, price: e.target.value })} placeholder="Цена" />
      <input
        type="number"
        value={local.duration_minutes}
        onChange={(e) => setLocal({ ...local, duration_minutes: e.target.value })}
        placeholder="Длительность"
      />
      <select value={local.category} onChange={(e) => setLocal({ ...local, category: e.target.value })}>
        <option value="">Без категории</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={local.is_active}
          onChange={(e) => setLocal({ ...local, is_active: e.target.checked })}
        />
        Активна
      </label>
      <button
        type="button"
        className="save-btn"
        onClick={() =>
          onSave(service.id, {
            name: local.name,
            price: Number(local.price),
            duration_minutes: Number(local.duration_minutes),
            is_active: local.is_active,
            category: local.category ? Number(local.category) : null,
          })
        }
      >
        Сохранить
      </button>
    </div>
  );
}
