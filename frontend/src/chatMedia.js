/** Helpers for Telegram-like chat media compose */

export const CHAT_COMPOSE_MODE_KEY = "vmeste_chat_compose_mode_v1";

export function loadChatComposeMode() {
  try {
    const v = localStorage.getItem(CHAT_COMPOSE_MODE_KEY);
    if (v === "voice" || v === "video_note") return v;
  } catch {
    /* ignore */
  }
  return "voice";
}

export function saveChatComposeMode(mode) {
  try {
    localStorage.setItem(CHAT_COMPOSE_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function mediaUrl(path, baseUrl) {
  if (!path) return "";
  if (String(path).startsWith("http")) return path;
  const base = String(baseUrl || "").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function guessAttachAccept(kind) {
  if (kind === "image") return "image/*";
  if (kind === "video") return "video/*";
  if (kind === "audio" || kind === "music") return "audio/*";
  return "*/*";
}

export function groupChatMedia(messages, baseUrl) {
  const photos = [];
  const videos = [];
  const files = [];
  const links = [];
  const music = [];
  const voice = [];
  for (const m of messages || []) {
    const url = m.attachment_url || mediaUrl(m.attachment, baseUrl);
    const kind = m.kind || "text";
    if (kind === "image" && url) photos.push({ ...m, url });
    else if ((kind === "video" || kind === "video_note") && url) videos.push({ ...m, url });
    else if (kind === "voice" && url) voice.push({ ...m, url });
    else if (kind === "file" && url) {
      const name = (m.payload && m.payload.name) || m.text || "Файл";
      const lower = String(name).toLowerCase();
      if (/\.(mp3|m4a|flac|wav|aac|ogg)$/.test(lower)) music.push({ ...m, url, name });
      else files.push({ ...m, url, name });
    } else if (kind === "link" || /https?:\/\//i.test(m.text || "")) {
      links.push(m);
    }
  }
  return { photos, videos, files, links, music, voice };
}

export async function blobToFile(blob, filename, mime) {
  return new File([blob], filename, { type: mime || blob.type || "application/octet-stream" });
}
