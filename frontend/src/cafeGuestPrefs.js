/** Сохранённые контакты гостя кафе (localStorage по заведению). */

export function guestPrefsKey(orgKey) {
  const id = String(orgKey || "").trim() || "default";
  return `cafe_guest_prefs_${id}`;
}

export function loadGuestPrefs(orgKey) {
  try {
    const raw = localStorage.getItem(guestPrefsKey(orgKey));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    return {
      guestName: String(data.guestName || ""),
      guestPhone: String(data.guestPhone || "+7"),
      guestEmail: String(data.guestEmail || ""),
      deliveryAddress: String(data.deliveryAddress || ""),
      deliveryPin:
        data.deliveryPin &&
        Number.isFinite(Number(data.deliveryPin.lat)) &&
        Number.isFinite(Number(data.deliveryPin.lon))
          ? { lat: Number(data.deliveryPin.lat), lon: Number(data.deliveryPin.lon) }
          : null,
    };
  } catch {
    return null;
  }
}

export function saveGuestPrefs(orgKey, patch) {
  try {
    const prev = loadGuestPrefs(orgKey) || {};
    const next = {
      guestName: patch.guestName != null ? String(patch.guestName) : prev.guestName || "",
      guestPhone: patch.guestPhone != null ? String(patch.guestPhone) : prev.guestPhone || "+7",
      guestEmail: patch.guestEmail != null ? String(patch.guestEmail) : prev.guestEmail || "",
      deliveryAddress:
        patch.deliveryAddress != null ? String(patch.deliveryAddress) : prev.deliveryAddress || "",
      deliveryPin: patch.deliveryPin !== undefined ? patch.deliveryPin : prev.deliveryPin || null,
    };
    localStorage.setItem(guestPrefsKey(orgKey), JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
}
