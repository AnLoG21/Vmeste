import { Capacitor } from "@capacitor/core";
import { API_URL } from "./config.js";

let started = false;

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
 * Register for push on Capacitor native apps.
 * Requires google-services.json + FCM_SERVER_KEY on the server for delivery.
 */
export async function initPushNotifications(authFetch) {
  if (started || !authFetch) return;
  if (!Capacitor.isNativePlatform()) return;
  started = true;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") return;
    await PushNotifications.register();

    PushNotifications.addListener("registration", (token) => {
      const platform = Capacitor.getPlatform() === "ios" ? "ios" : "android";
      postToken(authFetch, token?.value, platform);
    });

    PushNotifications.addListener("registrationError", () => {
      /* ignore */
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
    });
  } catch {
    started = false;
  }
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
