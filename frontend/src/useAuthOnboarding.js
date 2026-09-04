import { API_URL } from "./config.js";
import {
  simplifyCommaAddressLine,
  getCity,
  buildShortAddress,
} from "./addressFormat.js";
import { reverseGeocodeByCoords } from "./addressGeocode.js";
import { formatApiError } from "./bookingCalendarUtils.jsx";
import { loadYandexMaps } from "./yandexMapsLoader.js";
import { SITE_LEGAL } from "./legal/siteLegal.js";
import { showToast } from "./toast.js";

/**
 * Auth modal / registration / onboarding / password-reset URL handlers for App.
 * Token helpers (applyAuthTokens, loadMe) and logout stay in App when shared widely.
 */
export function useAuthOnboarding({
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
}) {
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

  return {
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
  };
}
