import { useEffect, useState } from "react";
import { API_URL } from "./config.js";
import {
  normalizeBookingsList,
  normalizeSlotsList,
  mergeBookingsWithManualHolds,
} from "./bookingCalendarUtils.jsx";

/**
 * Seller / staff cabinet loaders and list state for App.
 * Owns bookings/slots/services/categories/orgStaff/location + load effects.
 */
export function useCabinetData({
  authFetch,
  accessToken,
  me,
  currentView,
  setConversations,
}) {
  const [cabinetLoadError, setCabinetLoadError] = useState("");
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [slots, setSlots] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [location, setLocation] = useState([]);
  const [orgStaff, setOrgStaff] = useState([]);

  function staffCanDelegatePermissions() {
    if (me?.role === "provider") return true;
    if (me?.role !== "staff") return false;
    const fromMe =
      me.staff_permissions && typeof me.staff_permissions === "object"
        ? Boolean(me.staff_permissions.can_delegate_permissions)
        : false;
    const link = orgStaff.find((l) => Number(l.staff) === Number(me.id));
    return fromMe || Boolean(link?.permissions?.can_delegate_permissions);
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

  async function loadStaffWorkspace() {
    const reqs = [
      authFetch(`${API_URL}/booking/staff/`),
      authFetch(`${API_URL}/chat/conversations/`),
      authFetch(`${API_URL}/booking/`),
      authFetch(`${API_URL}/booking/slots/`),
    ];
    if (me?.role === "staff" && staffCanDelegatePermissions()) {
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

  useEffect(() => {
    if (accessToken && me?.role === "provider") loadSellerData();
  }, [accessToken, me]);

  useEffect(() => {
    if (!accessToken || (currentView !== "organization" && currentView !== "staff")) return;
    if (me?.role === "provider") loadSellerData();
    else if (me?.role === "staff" && staffCanDelegatePermissions()) loadStaffWorkspace();
  }, [accessToken, currentView, me?.role, me?.staff_permissions, orgStaff]);

  useEffect(() => {
    if (accessToken && me?.role === "staff") loadStaffWorkspace();
  }, [accessToken, me]);

  return {
    cabinetLoadError,
    setCabinetLoadError,
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
  };
}
