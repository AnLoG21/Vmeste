import ChatVideoNotePlayer from "./ChatVideoNotePlayer.jsx";
import { BASE_URL } from "./config.js";
import { formatRecordClock, mediaUrl, resolveAttachmentUrl } from "./chatMedia.js";

export const CHAT_PINS_STORAGE_KEY = "vmeste_chat_pins_v1";
export const MAX_PINNED_CHATS = 5;

export function formatLastSeenLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `был(а) ${d.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`;
}

export function getOrgDmPeerMember(conversation, myUserId) {
  if (!conversation?.members || conversation.members.length !== 2) return null;
  if (conversation.is_group || conversation.is_saved_messages || conversation.is_client_correspondence) return null;
  return conversation.members.find((m) => Number(m.user) !== Number(myUserId)) || null;
}

export function MessageReceiptIcon({ mode, viewed }) {
  if (mode === "classic") {
    return (
      <span className={`tg-msg-receipt tg-msg-receipt--classic${viewed ? " tg-msg-receipt--seen" : ""}`} aria-hidden="true">
        ✓✓
      </span>
    );
  }
  return (
    <span className="tg-msg-receipt tg-msg-receipt--stickers" title={viewed ? "Просмотрено" : "Не просмотрено"} aria-hidden="true">
      {viewed ? "🐵" : "🙈"}
    </span>
  );
}

/** Имя полностью + первая буква фамилии с точкой + отчество целиком (если есть). Иначе логин. */
export function formatStaffClientName(userLike) {
  if (!userLike) return "";
  const fn = String(userLike.first_name || "").trim();
  const ln = String(userLike.last_name || "").trim();
  const pat = String(userLike.patronymic || "").trim();
  const parts = [];
  if (fn) parts.push(fn);
  if (ln) {
    const ch = ln[0];
    parts.push(ch ? `${ch.toUpperCase()}.` : ln);
  }
  if (pat) parts.push(pat);
  const s = parts.join(" ").trim();
  return s || String(userLike.username || "").trim();
}

/** Фамилия имя отчество (полные), для списка сотрудников. */
export function formatStaffFullName(userLike) {
  if (!userLike) return "";
  const ln = String(userLike.last_name || "").trim();
  const fn = String(userLike.first_name || "").trim();
  const pat = String(userLike.patronymic || "").trim();
  const s = [ln, fn, pat].filter(Boolean).join(" ").trim();
  return s || String(userLike.username || "").trim();
}

/** Заголовок личного чата: имя и фамилия полностью. */
export function formatChatPeerFullName(userLike) {
  if (!userLike) return "";
  const fn = String(userLike.first_name || "").trim();
  const ln = String(userLike.last_name || "").trim();
  const s = [fn, ln].filter(Boolean).join(" ").trim();
  return s || formatStaffClientName(userLike);
}

export function formatMessageSenderLine(m) {
  if (!m) return "";
  const fn = String(m.sender_first_name || "").trim();
  const ln = String(m.sender_last_name || "").trim();
  const s = [fn, ln].filter(Boolean).join(" ").trim();
  if (s) return s;
  return formatStaffClientName({
    first_name: m.sender_first_name,
    last_name: m.sender_last_name,
    patronymic: m.sender_patronymic,
    username: m.sender_username,
  });
}

export function conversationOrgDirectPeerTitle(conversation, myUserId) {
  if (!conversation || conversation.is_group || conversation.is_saved_messages || conversation.is_client_correspondence)
    return "";
  const members = conversation.members || [];
  if (members.length !== 2) return "";
  const other = members.find((m) => Number(m.user) !== Number(myUserId));
  if (!other) return "";
  return formatChatPeerFullName({
    first_name: other.first_name,
    last_name: other.last_name,
    patronymic: other.patronymic,
    username: other.username,
  });
}

export function conversationClientCorrespondenceTitle(conversation, myUserId, myRole) {
  if (!conversation?.is_client_correspondence) return "";
  const other = (conversation.members || []).find((m) => Number(m.user) !== Number(myUserId));
  if (!other) return "";
  if (myRole === "client") {
    const org = String(other.organization_name || "").trim();
    if (org) return org;
    return formatChatPeerFullName(other);
  }
  return formatChatPeerFullName(other);
}

/** Имя в списке по умолчанию: собеседник (имя фамилия) или заголовок чата. */
export function defaultChatListNameForConversation(conversation, myUserId, myRole) {
  if (!conversation) return "";
  if (conversation.is_saved_messages) return "Избранное";
  const clientPeer = conversationClientCorrespondenceTitle(conversation, myUserId, myRole);
  if (clientPeer) return clientPeer;
  const peer = conversationOrgDirectPeerTitle(conversation, myUserId);
  if (peer) return peer;
  return conversation.title || `Чат #${conversation.id ?? ""}`;
}

export function messageCalendarDayKey(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatMessageDayDividerRu(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

export function formatRuMatchCount(n) {
  const x = Math.abs(Number(n)) || 0;
  if (x === 0) return "Нет совпадений";
  const m10 = x % 10;
  const m100 = x % 100;
  if (m10 === 1 && m100 !== 11) return `${x} совпадение`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${x} совпадения`;
  return `${x} совпадений`;
}

export function loadChatPinsFromStorage() {
  try {
    const raw = localStorage.getItem(CHAT_PINS_STORAGE_KEY);
    const p = raw ? JSON.parse(raw) : {};
    const clip = (arr) =>
      Array.isArray(arr)
        ? arr.map(Number).filter((n) => Number.isFinite(n) && n > 0).slice(0, MAX_PINNED_CHATS)
        : [];
    return { org: clip(p.org), clients: clip(p.clients) };
  } catch {
    return { org: [], clients: [] };
  }
}

export function reviewImageUrl(path, variant = "full") {
  if (!path) return "";
  if (typeof path === "object") {
    return variant === "thumb" ? mediaThumbUrl(path) : mediaFullUrl(path);
  }
  if (String(path).startsWith("http")) return path;
  const base = BASE_URL.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function chatMessagePlainText(m) {
  if (!m) return "";
  if (m.kind === "review_reply" && m.payload) {
    const p = m.payload;
    return [p.review_text, p.reply_text].filter(Boolean).join(" ");
  }
  if (m.kind === "inspection") {
    if (m.text) return m.text;
    return m.payload?.vehicle ? `Диагностика: ${m.payload.vehicle}` : "Согласование диагностики";
  }
  if (m.kind === "image") return m.text || "Фото";
  if (m.kind === "video") return m.text || "Видео";
  if (m.kind === "video_note") return m.text || "Видеосообщение";
  if (m.kind === "voice") return m.text || "Голосовое сообщение";
  if (m.kind === "file") return m.text || m.payload?.name || "Файл";
  return (m.display_text || m.text || "").trim();
}

export function renderChatMessageBody(m, opts = {}) {
  if (m.kind === "inspection" && m.payload) {
    const p = m.payload;
    return (
      <div className="tg-msg-inspection-card">
        <div className="tg-msg-inspection-head">
          <span className="tg-msg-inspection-label">Диагностика</span>
          {p.organization_name ? (
            <span className="muted small">{p.organization_name}</span>
          ) : null}
        </div>
        <p className="tg-msg-inspection-vehicle">{p.vehicle || "Автомобиль"}</p>
        <p className="muted small">
          {p.items_count != null ? `Позиций к согласованию: ${p.items_count}` : "Согласуйте перечень работ"}
        </p>
        <button
          type="button"
          className="tg-msg-inspection-btn"
          onClick={() => opts.onOpenInspection?.(p.inspection_id)}
        >
          Открыть согласование
        </button>
      </div>
    );
  }
  if (m.kind === "review_reply" && m.payload) {
    const p = m.payload;
    const rating = Math.min(5, Math.max(0, Number(p.rating) || 0));
    const photos = Array.isArray(p.photo_paths) ? p.photo_paths : [];
    const replyText = (p.reply_text || m.display_text || m.text || "").trim();
    return (
      <div className="tg-msg-review-card">
        <div className="tg-msg-review-head">
          <span className="tg-msg-review-label">Отзыв</span>
          {p.client_name ? <span className="tg-msg-review-client muted small">{p.client_name}</span> : null}
        </div>
        {rating > 0 ? (
          <span className="review-stars tg-msg-review-stars" aria-label={`Оценка ${rating}`}>
            {"★".repeat(rating)}
            <span className="review-stars-empty">{"☆".repeat(5 - rating)}</span>
          </span>
        ) : null}
        {p.review_text ? <p className="tg-msg-review-text">{p.review_text}</p> : null}
        {photos.length > 0 ? (
          <div className="tg-msg-review-photos review-photos">
            {photos.map((src, i) => (
              <button
                type="button"
                key={`${src}-${i}`}
                className="tg-msg-image-link"
                onClick={() =>
                  opts.onOpenPhotos?.(
                    photos.map((s, idx) => ({
                      id: `review-${m.id}-${idx}`,
                      url: reviewImageUrl(s),
                      source: "chat",
                    })),
                    i
                  )
                }
              >
                <img src={reviewImageUrl(src, "thumb")} alt="" loading="lazy" decoding="async" />
              </button>
            ))}
          </div>
        ) : null}
        <div className="tg-msg-review-reply">
          <strong>Ответ организации</strong>
          {replyText ? <p>{replyText}</p> : null}
        </div>
      </div>
    );
  }
  const url = resolveAttachmentUrl(m, BASE_URL);
  const kind = m.kind || "text";
  if (kind === "image" && url) {
    const thumbUrl = m.attachment_thumb_url ? mediaUrl(m.attachment_thumb_url, BASE_URL) : url;
    return (
      <div className="tg-msg-media">
        <button
          type="button"
          className="tg-msg-image-btn"
          onClick={() => opts.onOpenPhotos?.([{ id: m.id, url, source: "chat" }], 0)}
        >
          <img src={thumbUrl} alt={m.text || "Фото"} className="tg-msg-image" loading="lazy" decoding="async" />
        </button>
        {m.text ? <div className="tg-msg-text">{m.text}</div> : null}
      </div>
    );
  }
  if (kind === "video_note" && url) {
    const flip = m.payload?.display_flip;
    return (
      <div className="tg-msg-media tg-msg-media--circle">
        <ChatVideoNotePlayer
          src={url}
          size={180}
          mirror={flip !== false}
          durationSec={Number(m.payload?.duration_sec) || 0}
        />
        {m.text ? <div className="tg-msg-text">{m.text}</div> : null}
      </div>
    );
  }
  if (kind === "video" && url) {
    return (
      <div className="tg-msg-media">
        <video className="tg-msg-video" src={url} controls playsInline preload="metadata" />
        {m.text ? <div className="tg-msg-text">{m.text}</div> : null}
      </div>
    );
  }
  if (kind === "voice" && url) {
    return (
      <div className="tg-msg-voice">
        <audio src={url} controls preload="metadata" />
        {m.payload?.duration_sec ? (
          <span className="tg-msg-voice-dur muted">{formatRecordClock(m.payload.duration_sec)}</span>
        ) : null}
        {m.text ? <div className="tg-msg-text">{m.text}</div> : null}
      </div>
    );
  }
  if (kind === "file" && url) {
    const name = m.payload?.name || m.text || "Файл";
    return (
      <div className="tg-msg-file">
        <a href={url} target="_blank" rel="noreferrer" download={name}>
          📎 {name}
        </a>
      </div>
    );
  }
  if (url) {
    return (
      <div className="tg-msg-file">
        <a href={url} target="_blank" rel="noreferrer">
          📎 Вложение
        </a>
        {m.text ? <div className="tg-msg-text">{m.text}</div> : null}
      </div>
    );
  }
  return <div className="tg-msg-text">{m.text}</div>;
}
