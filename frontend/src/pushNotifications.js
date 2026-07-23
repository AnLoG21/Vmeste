import { Capacitor } from "@capacitor/core";
import { API_URL } from "./config.js";

let startedForToken = "";

async function postToken(authFetch, token, platform) {
  if (!token || !authFetch) return;
  try {
    await authFetch(`${API_URL}/notifications/push/register/`, {
      method: "POST",
      body: JSON.stringify({ token, platform }),
    });
  } catch {
    /* ignore */
  }
}

/**
 * Register for push on Capacitor native apps (FCM HTTP v1 + service account on server).
 */
export async function initPushNotifications(authFetch, accessToken = "") {
  if (!authFetch || !Capacitor.isNativePlatform()) return;
  const key = String(accessToken || "anon");
  if (startedForToken === key) return;
  startedForToken = key;

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive !== "granted") {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") {
      startedForToken = "";
      return;
    }

    await PushNotifications.removeAllListeners();

    PushNotifications.addListener("registration", (token) => {
      const platform = Capacitor.getPlatform() === "ios" ? "ios" : "android";
      postToken(authFetch, token?.value, platform);
    });

    PushNotifications.addListener("registrationError", () => {
      startedForToken = "";
    });

    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const data = action?.notification?.data || {};
      if (data.conversation_id) {
        try {
          window.dispatchEvent(
            new CustomEvent("vmeste:open-chat", { detail: { conversationId: Number(data.conversation_id) } })
          );
        } catch {
          /* ignore */
        }
      }
      if (data.view === "bookings" || data.booking_id) {
        try {
          window.dispatchEvent(new CustomEvent("vmeste:open-bookings", { detail: { bookingId: data.booking_id } }));
        } catch {
          /* ignore */
        }
      }
    });

    await PushNotifications.register();
  } catch {
    startedForToken = "";
  }
}

export function resetPushRegistration() {
  startedForToken = "";
}

/** Browser Notification API fallback (tab must be allowed). */
export async function maybeRequestWebNotificationPermission() {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    const p = await Notification.requestPermission();
    return p === "granted";
  } catch {
    return false;
  }
}

export function showLocalBrowserNotification(title, body) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    // eslint-disable-next-line no-new
    new Notification(title || "Вместе", { body: body || "", icon: "/favicon.png" });
  } catch {
    /* ignore */
  }
}
