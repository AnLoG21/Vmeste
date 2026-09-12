/** Optional hooks for Playwright. Active only when window.__VMESTE_E2E__ is set. */

export function installClientE2EHooks({
  onClientLocationSelect,
  setClientBookModalOpen,
  setClientBookingForm,
  setClientBookWindows,
  setMapOrgPopup,
  setMapOrgProfile,
  allLocations,
}) {
  if (typeof window === "undefined") return () => {};
  if (!window.__VMESTE_E2E__) return () => {};

  window.__vmesteE2E = {
    locationsCount() {
      return (allLocations || []).length;
    },
    selectOrg(locationId, date = "") {
      return onClientLocationSelect?.(String(locationId), date || undefined);
    },
    openOrgSheet(locationId) {
      const loc = (allLocations || []).find((l) => String(l.id) === String(locationId));
      if (loc) setMapOrgPopup?.(loc);
    },
    setOrgProfile(profile) {
      setMapOrgProfile?.(profile);
    },
    openBookModal() {
      setClientBookModalOpen?.(true);
    },
    patchBookForm(patch) {
      setClientBookingForm?.((p) => ({ ...p, ...patch }));
    },
    setBookWindows(windows) {
      setClientBookWindows?.(Array.isArray(windows) ? windows : []);
    },
  };

  return () => {
    delete window.__vmesteE2E;
  };
}
