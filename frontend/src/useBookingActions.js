import { API_URL } from "./config.js";
import {
  isoMonthKey,
  normalizeBookingsList,
  normalizeSlotsList,
  mergeBookingsWithManualHolds,
  clientWindowKey,
} from "./bookingCalendarUtils.jsx";

/**
 * Booking list actions / client book / payment / inspection links for App.
 * Bookings state stays in App (shared with seller/staff loaders).
 */
export function useBookingActions({
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
}) {
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

  function bookingHasStarted(it) {
    if (!it?.slot_starts_at) return true;
    const start = new Date(it.slot_starts_at).getTime();
    return !Number.isNaN(start) && start <= Date.now();
  }

  async function reloadBookingsList() {
    const asClient = currentView === "my_bookings" || me?.role === "client";
    const bookingsRes = await authFetch(
      `${API_URL}/booking/${asClient && me?.role === "provider" ? "?as_client=1" : ""}`,
    );
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

  async function loadClientBookings() {
    await reloadBookingsList();
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
      err.code === "confirm_message_not_set" ||
      err.code === "cancel_message_not_set" ||
      err.code === "done_message_not_set" ||
      err.code === "booking_not_started_yet" ||
      err.code === "prepay_required"
    ) {
      setBookingMessageError({ code: err.code, detail: err.detail || "" });
    }
  }

  async function startInspectionFromBooking(booking) {
    if (!booking?.client) {
      setClientStatus("У записи нет клиента.");
      return;
    }
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

  return {
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
  };
}
