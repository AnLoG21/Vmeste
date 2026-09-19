/** Public store / install links for the native Android app. */
export const ANDROID_PACKAGE_ID = "space.vsevmeste.app";

/** Official RuStore listing (primary install path for users in Russia). */
export const RUSTORE_APP_URL = `https://www.rustore.ru/catalog/app/${ANDROID_PACKAGE_ID}`;

/** Direct APK mirror on our site (fallback if RuStore is unavailable). */
export const ANDROID_APK_URL = "/downloads/vmeste-android.apk";

/** QR image for desktop → phone install (points to RuStore). */
export function rustoreQrUrl(size = 168) {
  const s = Math.min(320, Math.max(120, Number(size) || 168));
  return `https://api.qrserver.com/v1/create-qr-code/?size=${s}x${s}&margin=8&data=${encodeURIComponent(RUSTORE_APP_URL)}`;
}
