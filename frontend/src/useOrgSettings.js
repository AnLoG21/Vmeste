import { useEffect, useState } from "react";
import { API_URL } from "./config.js";
import {
  simplifyCommaAddressLine,
  getCity,
  buildShortAddress,
} from "./addressFormat.js";
import { reverseGeocodeByCoords } from "./addressGeocode.js";
import { emptyLocationFormState } from "./orgBranchUtils.js";
import {
  ORG_GALLERY_MAX_PHOTOS,
  defaultOrgWorkingHours,
  normalizeOrgWorkingHours,
} from "./clientOrgFeatures.js";
import { loadYandexMaps } from "./yandexMapsLoader.js";
import { showToast } from "./toast.js";

/**
 * Organization settings + branches maps / save handlers for App.
 * Address suggest/geocode state stays in useOrgAddress; map DOM refs + branch UI flags stay in App.
 */
export function useOrgSettings({
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
}) {
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
  const [orgTelegramLinkInfo, setOrgTelegramLinkInfo] = useState(null);
  const [profileOrgStatus, setProfileOrgStatus] = useState("");

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

  return {
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
  };
}
