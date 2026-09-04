import { useEffect, useRef, useState } from "react";
import {
  simplifyCommaAddressLine,
  getCity,
  buildShortAddress,
  mergeStructuredOrgPartsFromMe,
} from "./addressFormat.js";
import {
  reverseGeocodeByCoords,
  federalCityFromReverse,
  nominatimSearchRU,
  photonSuggestSearch,
  buildNominatimQuery,
  yandexGeocodeSuggestItems,
  yandexMapsNativeSuggestItems,
} from "./addressGeocode.js";
import { parseAddressDetailsPipeTail } from "./orgBranchUtils.js";
import { loadYandexMaps } from "./yandexMapsLoader.js";
import { showToast } from "./toast.js";

/**
 * Org / profile / branch address suggestions + geocode UI state for App.
 * Map DOM refs stay in App (shared with map init); this hook owns forms + suggest/geocode handlers.
 */
export function useOrgAddress({
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
}) {
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [detectedCity, setDetectedCity] = useState("");
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
  const [branchGeoStatus, setBranchGeoStatus] = useState("");

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

  return {
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
    ensureCityHintFromGeo,
    fetchAddressSuggestions,
    geocodeAddress,
    onAddressInput,
    pickSuggestion,
    onProfileAddressInput,
    onBranchAddressInput,
    pickBranchLocationSuggestion,
    pickProfileSuggestion,
    geocodeProfileAddress,
    geocodeBranchAddress,
    buildSearchText,
    detectCityByGeolocation,
  };
}
