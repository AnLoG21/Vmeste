import { createPortal } from "react-dom";
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import logoMain from "./assets/logo-main.png";
import LandingPage from "./LandingPage.jsx";
import SubscriptionsPage from "./SubscriptionsPage.jsx";
import ChatVideoNotePlayer from "./ChatVideoNotePlayer.jsx";
import "./landing.css";
import {
  ORG_GALLERY_MAX_PHOTOS,
  ORG_WEEKDAYS,
  buildOrgCarouselItems,
  buildYmapOrgPlacemark,
  resetOrgPinLayoutClass,
  defaultOrgWorkingHours,
  formatOrgWorkingHoursText,
  getOrgWorkingHoursStatus,
  normalizeOrgWorkingHours,
  sphereMapIconHref,
  uniqueDiscoverOrgs,
} from "./clientOrgFeatures.js";
import { loadYandexMaps } from "./yandexMapsLoader.js";
import { API_URL, AUTH_URL, BASE_URL, REFRESH_URL } from "./config.js";
import {
  blobToFile,
  formatRecordClock,
  groupChatMedia,
  guessAttachAccept,
  loadChatComposeMode,
  mediaUrl,
  pickRecorderMime,
  resolveAttachmentUrl,
  saveChatComposeMode,
} from "./chatMedia.js";
import {
  initPushNotifications,
  maybeRequestWebNotificationPermission,
  resetPushRegistration,
  showLocalBrowserNotification,
} from "./pushNotifications.js";
import { ensurePhonePlus7, phoneFieldProps } from "./phone.js";
import PasswordInput from "./PasswordInput.jsx";
import { showToast } from "./toast.js";
import { navigateView, viewFromPath } from "./viewRoutes.js";

function formatWebsiteHref(url) {
  const s = String(url || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

function MapOrgContactsBlock({ phones, websites }) {
  const [open, setOpen] = useState(false);
  const phoneList = Array.isArray(phones) ? phones.filter(Boolean) : [];
  const siteList = Array.isArray(websites) ? websites.filter(Boolean) : [];
  if (!phoneList.length && !siteList.length) return null;

  return (
    <div className="map-org-contacts">
      <button
        type="button"
        className="staff-perms-toggle muted small-label map-org-contacts-toggle"
        onClick={() => setOpen((v) => !v)}
      >
        Контакты{open ? " ▲" : " ▼"}
      </button>
      {open ? (
        <div className="map-org-contacts-body">
          {phoneList.map((ph) => (
            <a key={ph} href={`tel:${ph.replace(/[^\d+]/g, "")}`} className="map-org-phone-link">
              {ph}
            </a>
          ))}
          {siteList.map((site) => (
            <a
              key={site}
              href={formatWebsiteHref(site)}
              className="map-org-website-link"
              target="_blank"
              rel="noreferrer noopener"
            >
              {site.replace(/^https?:\/\//i, "")}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PhotoLightboxReviewCaption({ photo }) {
  const [expanded, setExpanded] = useState(false);
  const text = String(photo?.text || "").trim();
  const isLong = text.split(/\n/).length > 2 || text.length > 90;
  const rating = Math.min(5, Math.max(0, Number(photo?.rating) || 0));

  useEffect(() => {
    setExpanded(false);
  }, [photo?.id, photo?.url]);

  return (
    <div className="photo-lightbox-review">
      <p className="photo-lightbox-review-head">
        <span className="photo-lightbox-stars-filled" aria-hidden>
          {"★".repeat(rating)}
        </span>
        <span className="photo-lightbox-stars-empty" aria-hidden>
          {"☆".repeat(5 - rating)}
        </span>
        {photo.client_name ? ` · ${photo.client_name}` : ""}
      </p>
      {text ? (
        <p
          className={[
            "photo-lightbox-review-text",
            !expanded && "photo-lightbox-review-text--clamped",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {text}
        </p>
      ) : null}
      {text && isLong ? (
        <button
          type="button"
          className="staff-perms-toggle muted small-label photo-lightbox-review-expand"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Свернуть отзыв ▲" : "Развернуть отзыв ▼"}
        </button>
      ) : null}
    </div>
  );
}

function MapOrgHoursBlock({ workingHours }) {
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  const status = useMemo(
    () => getOrgWorkingHoursStatus(workingHours, new Date(tick)),
    [workingHours, tick],
  );

  if (!workingHours) return null;

  return (
    <div className="map-org-hours">
      <p
        className={[
          "map-org-hours-status",
          status.isRed && "map-org-hours-status--closed",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {status.mainText}
      </p>
      <button
        type="button"
        className="staff-perms-toggle muted small-label map-org-hours-toggle"
        onClick={() => setScheduleOpen((v) => !v)}
      >
        График работы{scheduleOpen ? " ▲" : " ▼"}
      </button>
      {scheduleOpen ? (
        <pre className="map-org-hours-text">{status.fullScheduleText}</pre>
      ) : null}
    </div>
  );
}

const NOMINATIM_HEADERS = { Accept: "application/json", "Accept-Language": "ru,ru-RU;q=0.9,en;q=0.5" };
function savedIntervalsStorageKey(providerId) {
  if (!providerId) return null;
  return `vmeste_saved_intervals_v2_${providerId}`;
}

function buildServiceDraftFromService(service) {
  return {
    price: String(service.price ?? 0),
    duration_minutes: String(service.duration_minutes ?? 30),
    is_active: Boolean(service.is_active),
  };
}

function serviceDraftEqualsService(draft, service) {
  if (!draft) return true;
  return (
    Number(draft.price) === Number(service.price) &&
    Number(draft.duration_minutes) === Number(service.duration_minutes) &&
    Boolean(draft.is_active) === Boolean(service.is_active)
  );
}
const chatPrefsStorageKey = (id) => `vmeste_chat_prefs_v1_${id}`;
const CHAT_WALL_OPTIONS = [
  { label: "Мята", value: "#dfe9e2" },
  { label: "Облака", value: "#e3edf8" },
  { label: "Песок", value: "#f3e8d8" },
  { label: "Ночь", value: "#1e2a24" },
  { label: "Море", value: "linear-gradient(160deg,#b8dfe9,#6aa6b8)" },
];
const APP_THEME_KEY = "vmeste_theme_v1";
const CHAT_RECEIPTS_KEY = "vmeste_chat_receipts_v1";
const chatNotifyStorageKey = (id) => `vmeste_chat_notify_v1_${id}`;
const CHAT_PINS_STORAGE_KEY = "vmeste_chat_pins_v1";
const MAX_PINNED_CHATS = 5;

function loadReceiptsPref() {
  try {
    const raw = localStorage.getItem(CHAT_RECEIPTS_KEY);
    const p = raw ? JSON.parse(raw) : {};
    return p.mode === "classic" ? "classic" : "stickers";
  } catch {
    return "stickers";
  }
}

function formatLastSeenLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `был(а) ${d.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`;
}

function getOrgDmPeerMember(conversation, myUserId) {
  if (!conversation?.members || conversation.members.length !== 2) return null;
  if (conversation.is_group || conversation.is_saved_messages || conversation.is_client_correspondence) return null;
  return conversation.members.find((m) => Number(m.user) !== Number(myUserId)) || null;
}

function MessageReceiptIcon({ mode, viewed }) {
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
function formatStaffClientName(userLike) {
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
function formatStaffFullName(userLike) {
  if (!userLike) return "";
  const ln = String(userLike.last_name || "").trim();
  const fn = String(userLike.first_name || "").trim();
  const pat = String(userLike.patronymic || "").trim();
  const s = [ln, fn, pat].filter(Boolean).join(" ").trim();
  return s || String(userLike.username || "").trim();
}

/** Заголовок личного чата: имя и фамилия полностью. */
function formatChatPeerFullName(userLike) {
  if (!userLike) return "";
  const fn = String(userLike.first_name || "").trim();
  const ln = String(userLike.last_name || "").trim();
  const s = [fn, ln].filter(Boolean).join(" ").trim();
  return s || formatStaffClientName(userLike);
}

function formatMessageSenderLine(m) {
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

function conversationOrgDirectPeerTitle(conversation, myUserId) {
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

function conversationClientCorrespondenceTitle(conversation, myUserId, myRole) {
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
function defaultChatListNameForConversation(conversation, myUserId, myRole) {
  if (!conversation) return "";
  if (conversation.is_saved_messages) return "Избранное";
  const clientPeer = conversationClientCorrespondenceTitle(conversation, myUserId, myRole);
  if (clientPeer) return clientPeer;
  const peer = conversationOrgDirectPeerTitle(conversation, myUserId);
  if (peer) return peer;
  return conversation.title || `Чат #${conversation.id ?? ""}`;
}

function messageCalendarDayKey(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatMessageDayDividerRu(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

function formatRuMatchCount(n) {
  const x = Math.abs(Number(n)) || 0;
  if (x === 0) return "Нет совпадений";
  const m10 = x % 10;
  const m100 = x % 100;
  if (m10 === 1 && m100 !== 11) return `${x} совпадение`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${x} совпадения`;
  return `${x} совпадений`;
}

function loadChatPinsFromStorage() {
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

const ADDR_COUNTRY_SEGMENTS = new Set([
  "russia",
  "россия",
  "russian federation",
  "российская федерация",
]);

function trimAddrSeg(s) {
  if (s == null || s === "") return "";
  return String(s).trim().replace(/\s+/g, " ");
}

function dedupeAddrSegments(parts) {
  const out = [];
  const seen = new Set();
  for (const raw of parts) {
    const seg = trimAddrSeg(raw);
    if (!seg) continue;
    const k = seg.toLowerCase();
    if (ADDR_COUNTRY_SEGMENTS.has(k)) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(seg);
  }
  return out;
}

function looksLikeHouseSegment(s) {
  const t = trimAddrSeg(s).toLowerCase();
  if (!t) return false;
  if (/^д\.?\s*\d/.test(t)) return true;
  if (/^дом\s+\d/.test(t)) return true;
  if (/^стр\.?\s*\d/.test(t)) return true;
  if (/^корп\.?\s*\d/.test(t)) return true;
  if (/^к\.?\s*\d/.test(t)) return true;
  if (/^\d+[а-яa-z]?\s+к\.?\s*\d/.test(t)) return true;
  if (/^\d+[а-яa-z]?\s+к\d/.test(t)) return true;
  if (/^\d{1,5}[а-яa-z]?$/.test(t)) return true;
  return false;
}

function looksLikeStreetSegment(s) {
  const t = trimAddrSeg(s);
  if (!t || looksLikeHouseSegment(t)) return false;
  const low = t.toLowerCase();
  if (
    /\b(ул\.?|улиц|просп\.?|пр-т|переул|пр-д|линия|шоссе|наб\.?|бульв|туп\.?|аллея|пл\.?|проезд|микрорайон|мкрн?|квартал|набережн|бульвар|ш\.|тупик|спуск|снт|днп|тер\.?|вал|кольцо)\b/i.test(
      t
    )
  )
    return true;
  if (/^\d+-[яьюеёаио]\s/i.test(low) || /^\d+-я\s/i.test(low)) return true;
  if (/\bлиния\b/i.test(low)) return true;
  return false;
}

/** Город/субъект без явных признаков улицы (чтобы не принять «Иваново» за улицу рядом с «5»). */
function looksLikeAdminOnlySegment(s) {
  const st = trimAddrSeg(s);
  const t = st.toLowerCase();
  if (!t) return false;
  if (/область|край|округ|республик|автономн|федеральн|\bао\b|обл\.?$/.test(t)) return true;
  if (/^(г\.|г\s|пос\.|пгт|с\.|село|дер\.|деревня|п\.|станица|х\.|хутор)\s/i.test(st)) return true;
  const compact = t.replace(/\./g, "").replace(/\s+/g, " ").trim();
  if (
    /^(москва|moscow|санктпетербург|санкт-петербург|stpetersburg|saintpetersburg|saint petersburg|севастополь|байконур|bajkonur|спб|spb)$/i.test(
      compact
    )
  )
    return true;
  return false;
}

/** Убирает хвост «Moscow, Russia» после «улица, дом» (часто в ответе геокодера). */
function stripTrailingAdminSegmentsFromAddress(parts) {
  const p = [...parts];
  while (p.length > 1) {
    const last = p[p.length - 1];
    const k = trimAddrSeg(last).toLowerCase();
    if (ADDR_COUNTRY_SEGMENTS.has(k) || looksLikeAdminOnlySegment(last)) p.pop();
    else break;
  }
  return p;
}

/** Если в цепочке уже есть улица или дом — убираем ведущий «город/субъект» (дубль с хвостом). */
function stripLeadingAdminWhenStreetOrHousePresent(parts) {
  const p = [...parts];
  const hasStreetOrHouse = p.some((s) => looksLikeStreetSegment(s) || looksLikeHouseSegment(s));
  if (!hasStreetOrHouse) return p;
  while (p.length > 1 && looksLikeAdminOnlySegment(p[0])) p.shift();
  return p;
}

function addrSegNormKey(s) {
  return trimAddrSeg(s)
    .toLowerCase()
    .replace(/[.,']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Частые англоязычные сегменты OSM/Яндекс → русские подписи (публичный Photon `lang=ru` не даёт). */
const ADDR_EN_TO_RU = {
  moscow: "Москва",
  "saint petersburg": "Санкт-Петербург",
  saintpetersburg: "Санкт-Петербург",
  "st petersburg": "Санкт-Петербург",
  stpetersburg: "Санкт-Петербург",
  novosibirsk: "Новосибирск",
  yekaterinburg: "Екатеринбург",
  ekaterinburg: "Екатеринбург",
  "nizhny novgorod": "Нижний Новгород",
  kazan: "Казань",
  chelyabinsk: "Челябинск",
  omsk: "Омск",
  samara: "Самара",
  "rostov-on-don": "Ростов-на-Дону",
  "rostov on don": "Ростов-на-Дону",
  ufa: "Уфа",
  krasnoyarsk: "Красноярск",
  perm: "Пермь",
  voronezh: "Воронеж",
  volgograd: "Волгоград",
  krasnodar: "Краснодар",
  saratov: "Саратов",
  tyumen: "Тюмень",
  tolyatti: "Тольятти",
  togliatti: "Тольятти",
  izhevsk: "Ижевск",
  barnaul: "Барнаул",
  irkutsk: "Иркутск",
  ulyanovsk: "Ульяновск",
  khabarovsk: "Хабаровск",
  yaroslavl: "Ярославль",
  vladivostok: "Владивосток",
  makhachkala: "Махачкала",
  tomsk: "Томск",
  orenburg: "Оренбург",
  kemerovo: "Кемерово",
  astrakhan: "Астрахань",
  penza: "Пенза",
  lipetsk: "Липецк",
  kirov: "Киров",
  cheboksary: "Чебоксары",
  kaliningrad: "Калининград",
  tula: "Тула",
  kursk: "Курск",
  sochi: "Сочи",
  sevastopol: "Севастополь",
  baikonur: "Байконур",
  bajkonur: "Байконур",
  spb: "Санкт-Петербург",
};

const ADDR_EN_OBLAST_KRAI = {
  moscow: "Московская область",
  leningrad: "Ленинградская область",
  sverdlovsk: "Свердловская область",
  chelyabinsk: "Челябинская область",
  novosibirsk: "Новосибирская область",
  samara: "Самарская область",
  rostov: "Ростовская область",
  krasnodar: "Краснодарский край",
  krasnoyarsk: "Красноярский край",
  perm: "Пермский край",
  primorsky: "Приморский край",
  khabarovsk: "Хабаровский край",
  stavropol: "Ставропольский край",
  irkutsk: "Иркутская область",
  voronezh: "Воронежская область",
  "nizhny novgorod": "Нижегородская область",
};

function translateAddrSegToRu(seg) {
  const t = trimAddrSeg(seg);
  if (!t) return t;
  if (/[а-яё]/i.test(t)) return t;

  const key = addrSegNormKey(t);
  if (ADDR_EN_TO_RU[key]) return ADDR_EN_TO_RU[key];

  const ob = t.match(/^(.+?)\s+(oblast|krai)$/i);
  if (ob) {
    const base = addrSegNormKey(ob[1]);
    const ru = ADDR_EN_OBLAST_KRAI[base];
    if (ru) return ru;
  }

  const ao = t.match(/^(.+?)\s+autonomous okrug$/i);
  if (ao) {
    const b = addrSegNormKey(ao[1]);
    if (b === "chukotka") return "Чукотский автономный округ";
    if (b === "yamalo-nenets" || b === "yamalonenets") return "Ямало-Ненецкий автономный округ";
    if (b === "khanty-mansi" || b === "khantymansi") return "Ханты-Мансийский автономный округ — Югра";
    if (b === "nenets") return "Ненецкий автономный округ";
  }

  // Fallback: letter-by-letter latin → russian for leftover English OSM labels
  return transliterateLatinToRussian(t);
}

const LATIN_TO_RU_CHARS = {
  a: "а",
  b: "б",
  c: "к",
  d: "д",
  e: "е",
  f: "ф",
  g: "г",
  h: "х",
  i: "и",
  j: "дж",
  k: "к",
  l: "л",
  m: "м",
  n: "н",
  o: "о",
  p: "п",
  q: "к",
  r: "р",
  s: "с",
  t: "т",
  u: "у",
  v: "в",
  w: "в",
  x: "кс",
  y: "й",
  z: "з",
};

function transliterateLatinToRussian(text) {
  let s = String(text || "");
  const digraphs = [
    ["sch", "щ"],
    ["sh", "ш"],
    ["ch", "ч"],
    ["zh", "ж"],
    ["kh", "х"],
    ["ts", "ц"],
    ["yu", "ю"],
    ["ya", "я"],
    ["yo", "ё"],
    ["ye", "е"],
  ];
  let out = "";
  let i = 0;
  const lower = s.toLowerCase();
  while (i < lower.length) {
    const ch = lower[i];
    if (!/[a-z]/.test(ch)) {
      out += s[i];
      i += 1;
      continue;
    }
    let matched = false;
    for (const [lat, ru] of digraphs) {
      if (lower.startsWith(lat, i)) {
        const upper = s[i] === s[i].toUpperCase() && /[A-Z]/.test(s[i]);
        out += upper ? ru[0].toUpperCase() + ru.slice(1) : ru;
        i += lat.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    const ru = LATIN_TO_RU_CHARS[ch] || ch;
    const upper = /[A-Z]/.test(s[i]);
    out += upper ? ru[0].toUpperCase() + ru.slice(1) : ru;
    i += 1;
  }
  return out;
}

/** Латинские названия улиц из OSM (без кириллицы в сегменте) — типовые замены. */
function translateLatinStreetToken(seg) {
  const t = trimAddrSeg(seg);
  if (!t || /[а-яё]/i.test(t)) return t;
  const low = t.toLowerCase();
  if (/\bsevernaya\b/i.test(low) && /\bliniya\b/i.test(low)) return t.replace(/\b9-ya\b/gi, "9-я").replace(/\bsevernaya\b/gi, "Северная").replace(/\bliniya\b/gi, "линия");
  if (/\bliniya\b/i.test(low)) return t.replace(/\b(\d+)-ya\b/gi, "$1-я").replace(/\bliniya\b/gi, "линия");
  if (/\bulitsa\b|\bstreet\b|\bprospekt\b|\bavenue\b|\bpereulok\b|\bshosse\b/i.test(t))
    return t
      .replace(/\bulitsa\b/gi, "улица")
      .replace(/\bstreet\b/gi, "ул.")
      .replace(/\bprospekt\b/gi, "проспект")
      .replace(/\bavenue\b/gi, "проспект")
      .replace(/\bpereulok\b/gi, "переулок")
      .replace(/\bshosse\b/gi, "шоссе")
      .replace(/\bnaberezhnaya\b/gi, "набережная");
  return t;
}

function composePipeTailFromDetails({ entrance, floor, apartment, intercom, extra }) {
  const details = [];
  if (entrance) details.push(`подъезд ${entrance}`);
  if (floor) details.push(`этаж ${floor}`);
  if (apartment) details.push(`кв. ${apartment}`);
  if (intercom) details.push(`домофон ${intercom}`);
  if (extra) details.push(extra);
  return details.join(", ");
}

/** Разбор хвоста после « | » при загрузке организации/старых филиалов. */
function parseAddressDetailsPipeTail(tail) {
  const out = { entrance: "", floor: "", apartment: "", intercom: "", extraDetails: "" };
  const s = tail == null ? "" : String(tail).trim();
  if (!s) return out;
  const parts = s.split(",").map(trimAddrSeg).filter(Boolean);
  const extra = [];
  let matchedStructured = false;
  for (const p of parts) {
    if (/^подъезд\s+/i.test(p)) {
      out.entrance = p.replace(/^подъезд\s+/i, "").trim();
      matchedStructured = true;
    } else if (/^этаж\s+/i.test(p)) {
      out.floor = p.replace(/^этаж\s+/i, "").trim();
      matchedStructured = true;
    } else if (/^кв\.?\s+/i.test(p)) {
      out.apartment = p.replace(/^кв\.?\s+/i, "").trim();
      matchedStructured = true;
    } else if (/^домофон\s+/i.test(p)) {
      out.intercom = p.replace(/^домофон\s+/i, "").trim();
      matchedStructured = true;
    } else extra.push(p);
  }
  out.extraDetails = matchedStructured ? extra.join(", ") : parts.join(", ");
  return out;
}

/** Один сегмент «улица, Moscow» от геокодера → два сегмента. */
function splitMixedScriptCommaSegment(seg) {
  const t = trimAddrSeg(seg);
  if (!t.includes(",")) return [t];
  const hasCyr = /[а-яё]/i.test(t);
  const hasLat = /[a-z]/i.test(t);
  if (!hasCyr || !hasLat) return [t];
  return t.split(",").map(trimAddrSeg).filter(Boolean);
}

function finalizeAddressSuggestionFromParts(parts) {
  const flat = parts.flatMap((s) => splitMixedScriptCommaSegment(s));
  let p = dedupeAddrSegments(flat).filter(Boolean);
  p = p.map((s) => translateAddrSegToRu(s));
  p = p.map((s) => translateLatinStreetToken(s));
  p = stripTrailingAdminSegmentsFromAddress(p);
  p = stripLeadingAdminWhenStreetOrHousePresent(p);
  return shortenAddressToStreetHouse(p);
}

function composeBranchDisplay(br) {
  if (!br) return "";
  const tail = composePipeTailFromDetails({
    entrance: br.entrance,
    floor: br.floor,
    apartment: br.apartment,
    intercom: br.intercom,
    extra: br.address_details,
  });
  const base = br.address || "";
  return tail ? `${base} | ${tail}` : base;
}

function parseBranchRecordForForm(br) {
  const raw = String(br.address || "").trim();
  const sep = " | ";
  const idx = raw.indexOf(sep);
  const base = idx >= 0 ? raw.slice(0, idx).trim() : raw;
  const tail = idx >= 0 ? raw.slice(idx + sep.length).trim() : "";
  const fromApi = {
    entrance: br.entrance || "",
    floor: br.floor || "",
    apartment: br.apartment || "",
    intercom: br.intercom || "",
    address_details: br.address_details || "",
  };
  const hasCol =
    fromApi.entrance || fromApi.floor || fromApi.apartment || fromApi.intercom || fromApi.address_details;
  if (!hasCol && tail) {
    const p = parseAddressDetailsPipeTail(tail);
    return {
      title: br.title || "",
      address: base,
      latitude: String(br.latitude ?? ""),
      longitude: String(br.longitude ?? ""),
      entrance: p.entrance,
      floor: p.floor,
      apartment: p.apartment,
      intercom: p.intercom,
      address_details: p.extraDetails,
    };
  }
  return {
    title: br.title || "",
    address: base,
    latitude: String(br.latitude ?? ""),
    longitude: String(br.longitude ?? ""),
    ...fromApi,
  };
}

function emptyLocationFormState() {
  return {
    title: "",
    address: "",
    latitude: "55.751244",
    longitude: "37.618423",
    entrance: "",
    floor: "",
    apartment: "",
    intercom: "",
    address_details: "",
  };
}

/**
 * Короткая подпись для подсказок: «улица, дом», если хвост распознан;
 * иначе полная цепочка (регион, город, …).
 */
function shortenAddressToStreetHouse(segments) {
  const p = dedupeAddrSegments(segments).filter(Boolean);
  if (p.length === 0) return "";
  if (p.length === 1) return p[0];

  const last = p[p.length - 1];
  if (!looksLikeHouseSegment(last)) return p.join(", ");

  const prev = p[p.length - 2];

  if (p.length >= 3) {
    if (looksLikeStreetSegment(prev)) return `${prev}, ${last}`;
    if (!looksLikeAdminOnlySegment(prev)) return `${prev}, ${last}`;
    if (p.length >= 4) {
      const st = p[p.length - 3];
      if (looksLikeStreetSegment(st) || !looksLikeAdminOnlySegment(st)) return `${st}, ${last}`;
    }
    return p.join(", ");
  }

  if (looksLikeStreetSegment(prev)) return `${prev}, ${last}`;
  return p.join(", ");
}

/** Запятые перед лат. городом/страной после кириллицы или цифры — иначе сегмент с кириллицей не проходит EN→RU. */
function insertCommasBeforeLatinAdminRun(text) {
  let s = String(text || "").trim();
  if (!s) return s;
  s = s.replace(/\s*,\s*/g, ", ");
  const admins =
    "Moscow Oblast|Leningrad Oblast|Moscow|Saint Petersburg|St\\. Petersburg|St Petersburg|Sankt-Petersburg|Russia|Russian Federation";
  s = s.replace(new RegExp(`([\\u0400-\\u04FF0-9])(\\s+)(${admins})\\b`, "gi"), "$1, $3");
  s = s.replace(/\b(Moscow)\s*,\s*(Moscow)\b/gi, "$1, $2");
  s = s.replace(/\b(Moscow)\s*,\s*(Russia)\b/gi, "$1, $2");
  return s;
}

function mergeStructuredOrgPartsFromMe(m) {
  if (!m) return { entrance: "", floor: "", apartment: "", intercom: "", extra: "" };
  let entrance = String(m.organization_entrance || "").trim();
  let floor = String(m.organization_floor || "").trim();
  let apartment = String(m.organization_apartment || "").trim();
  let intercom = String(m.organization_intercom || "").trim();
  let extra = String(m.organization_address_extra || "").trim();

  const parsed = parseAddressDetailsPipeTail(extra);
  const parsedHas = parsed.entrance || parsed.floor || parsed.apartment || parsed.intercom;
  if (parsedHas) {
    entrance = entrance || parsed.entrance;
    floor = floor || parsed.floor;
    apartment = apartment || parsed.apartment;
    intercom = intercom || parsed.intercom;
    extra = parsed.extraDetails || "";
  }
  return { entrance, floor, apartment, intercom, extra };
}

/** Убирает страну и дубли; хвостовые «Moscow»; переводит EN→RU; по возможности «улица, дом». */
function simplifyCommaAddressLine(text) {
  if (!text || typeof text !== "string") return "";
  const prepared = insertCommasBeforeLatinAdminRun(insertCommasBeforeLatinAdminRun(text));
  const raw = prepared.split(",").map((x) => trimAddrSeg(x)).filter(Boolean);
  return finalizeAddressSuggestionFromParts(raw);
}

/** Строка адреса организации для отображения (отдельные поля API + старый формат «база | хвост»). */
function composeOrgDisplayFromMe(m) {
  if (!m) return "";
  const merged = mergeStructuredOrgPartsFromMe(m);
  const hasStructured =
    merged.entrance || merged.floor || merged.apartment || merged.intercom || merged.extra;

  const rawAddr = String(m.organization_address || "").trim();
  const sep = " | ";
  const splitIdx = rawAddr.indexOf(sep);
  const baseRaw = splitIdx >= 0 ? rawAddr.slice(0, splitIdx).trim() : rawAddr;

  if (!hasStructured && rawAddr.includes(sep)) {
    return simplifyCommaAddressLine(rawAddr);
  }
  const baseSource = hasStructured && splitIdx >= 0 ? baseRaw : rawAddr;
  const base = simplifyCommaAddressLine(baseSource);
  const tail = composePipeTailFromDetails({
    entrance: merged.entrance,
    floor: merged.floor,
    apartment: merged.apartment,
    intercom: merged.intercom,
    extra: merged.extra,
  });
  return tail ? `${base} | ${tail}` : base;
}

function formatPhotonHousePart(p) {
  const hn = trimAddrSeg(p.housenumber);
  let extra = trimAddrSeg(p.block || p.building || "");
  if (extra) {
    if (!/^к/i.test(extra) && !/^корп/i.test(extra) && !/^стр/i.test(extra) && !/^с\.\d/i.test(extra.replace(/\s/g, ""))) {
      const compact = extra.replace(/\s/g, "");
      if (/^\d+[а-яa-z]?$/i.test(compact)) extra = `к${compact}`;
    } else {
      extra = extra
        .replace(/^корп(?:ус)?\.?\s*/i, "к")
        .replace(/^к\.?\s*/i, "к")
        .replace(/\s+/g, "");
    }
  }
  if (hn && extra) return `${hn} ${extra}`.replace(/\s+/g, " ").trim();
  if (hn) return hn;
  return extra;
}

/** Подсказка Photon: субъект/район → населённый пункт → улица → дом (без страны, без дублей). */
function mapPhotonFeatureToSuggestion(feature) {
  const coords = feature?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lon = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const p = feature.properties || {};

  const primaryLocality = translateAddrSegToRu(
    trimAddrSeg(p.city || p.town || p.village || p.municipality || p.locality || "")
  );
  const innerRaw = [p.suburb, p.district, p.neighbourhood, p.quarter, p.hamlet]
    .map((x) => translateLatinStreetToken(translateAddrSegToRu(trimAddrSeg(x))))
    .filter(Boolean);
  const innerLocals = dedupeAddrSegments(innerRaw).filter(
    (x) => !primaryLocality || x.toLowerCase() !== primaryLocality.toLowerCase()
  );

  const adminChain = dedupeAddrSegments(
    [
      translateLatinStreetToken(translateAddrSegToRu(trimAddrSeg(p.state))),
      translateLatinStreetToken(translateAddrSegToRu(trimAddrSeg(p.county))),
      primaryLocality,
      ...innerLocals,
    ].filter(Boolean)
  );

  let streetLine = translateLatinStreetToken(translateAddrSegToRu(trimAddrSeg(p.street)));
  const nm = translateLatinStreetToken(translateAddrSegToRu(trimAddrSeg(p.name)));
  if (!streetLine && nm && (p.type === "street" || p.osm_key === "highway")) {
    streetLine = nm;
  }
  const housePart = formatPhotonHousePart(p);

  const ordered = [...adminChain];
  if (streetLine) ordered.push(streetLine);
  if (housePart) ordered.push(housePart);
  if (!streetLine && !housePart && nm && !adminChain.some((a) => a.toLowerCase() === nm.toLowerCase())) {
    ordered.push(nm);
  }

  const value = finalizeAddressSuggestionFromParts(ordered);
  if (!value) return null;

  const cityRaw = primaryLocality || innerLocals[0] || trimAddrSeg(p.state) || "";
  const city = translateAddrSegToRu(cityRaw);

  return {
    value,
    full: value,
    lat,
    lon,
    city,
  };
}

const emptyRegisterForm = {
  username: "",
  first_name: "",
  last_name: "",
  patronymic: "",
  email: "",
  phone: "+7",
  role: "client",
  password: "",
  password_confirm: "",
  provider_sphere: "",
  organization_name: "",
  organization_address: "",
  organization_address_details: "",
  entrance: "",
  apartment: "",
  intercom: "",
  floor: "",
  organization_latitude: "55.751244",
  organization_longitude: "37.618423",
};

const BOOKING_MSG_PRESETS = {
  confirm: [
    "Здравствуйте! Ваша запись подтверждена на {date}. Ждём вас!",
    "Запись на {date} подтверждена. Если планы изменятся — напишите нам заранее.",
    "Подтверждаем запись на {date}. До встречи!",
  ],
  cancel: [
    "К сожалению, запись на {date} отменена. При необходимости выберите другое время.",
    "Ваша запись на {date} отменена. Будем рады видеть вас в другой день.",
    "Запись на {date} снята. Если нужна помощь с новой записью — напишите нам.",
  ],
  done: [
    "Спасибо, что были с нами {date}! Будем рады отзыву и новой встрече.",
    "Услуга по записи на {date} оказана. Благодарим за визит!",
    "Запись на {date} завершена. Спасибо, что выбрали нас!",
  ],
};

const CHAT_MSG_PAGE_SIZE = 50;

function isMobileChatLayout() {
  if (typeof window === "undefined") return false;
  if (document.documentElement.classList.contains("native-app")) return true;
  return window.matchMedia("(max-width: 900px)").matches;
}

function detectCameraFacingFromTrack(track, deviceLabel = "") {
  const settings = track?.getSettings?.() || {};
  if (settings.facingMode === "user" || settings.facingMode === "environment") {
    return settings.facingMode;
  }
  const label = `${deviceLabel || ""} ${track?.label || ""}`.toLowerCase();
  if (/back|rear|environment|задн|тыл|world/.test(label)) return "environment";
  if (/front|user|face|перед|фронт|selfie/.test(label)) return "user";
  return null;
}

async function pickOtherVideoDevice(currentDeviceId, wantFacing) {
  if (!navigator.mediaDevices?.enumerateDevices) return null;
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cams = devices.filter((d) => d.kind === "videoinput" && d.deviceId);
  if (cams.length < 2) return null;
  const others = cams.filter((d) => d.deviceId !== currentDeviceId);
  if (!others.length) return null;
  const byFacing = others.find((d) => detectCameraFacingFromTrack(null, d.label) === wantFacing);
  if (byFacing) return byFacing;
  // Round-robin to next camera in the list
  const idx = Math.max(
    0,
    cams.findIndex((d) => d.deviceId === currentDeviceId)
  );
  return cams[(idx + 1) % cams.length] || others[0];
}

function buildIntervalPopoverFixedStyle(anchorEl) {
  if (!anchorEl || typeof window === "undefined") return null;
  const r = anchorEl.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(300, Math.max(240, Math.min(vw - 16, 300)));
  const estimatedH = 220;
  // На узком экране — по центру вьюпорта; на широком — у якоря, с clamp по краям
  let left = vw <= 900 ? vw / 2 : r.left + r.width / 2;
  const half = width / 2;
  left = Math.max(half + 8, Math.min(vw - half - 8, left));
  let top = r.bottom + 8;
  if (top + estimatedH > vh - 8) {
    top = Math.max(8, r.top - estimatedH - 8);
  }
  return {
    position: "fixed",
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
    width: `${Math.round(width)}px`,
    maxWidth: "calc(100vw - 16px)",
    transform: "translateX(-50%)",
    zIndex: 9000,
    boxSizing: "border-box",
  };
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function currentLocalMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function isoMonthKey(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function normalizeBookingsList(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

function formatApiError(err, status) {
  if (!err || typeof err !== "object") {
    if (status === 500) return "Ошибка сервера. Попробуйте позже.";
    return "";
  }
  if (typeof err.detail === "string") return err.detail;
  const parts = [];
  for (const val of Object.values(err)) {
    if (typeof val === "string") parts.push(val);
    else if (Array.isArray(val)) parts.push(...val.filter((x) => typeof x === "string"));
  }
  return parts.join(" ") || "";
}

function normalizeReviewsList(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

function reviewImageUrl(path) {
  if (!path) return "";
  if (String(path).startsWith("http")) return path;
  const base = BASE_URL.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function chatMessagePlainText(m) {
  if (!m) return "";
  if (m.kind === "review_reply" && m.payload) {
    const p = m.payload;
    return [p.review_text, p.reply_text].filter(Boolean).join(" ");
  }
  if (m.kind === "image") return m.text || "Фото";
  if (m.kind === "video") return m.text || "Видео";
  if (m.kind === "video_note") return m.text || "Видеосообщение";
  if (m.kind === "voice") return m.text || "Голосовое сообщение";
  if (m.kind === "file") return m.text || m.payload?.name || "Файл";
  return (m.display_text || m.text || "").trim();
}

function renderChatMessageBody(m, opts = {}) {
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
                <img src={reviewImageUrl(src)} alt="" />
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
    return (
      <div className="tg-msg-media">
        <button
          type="button"
          className="tg-msg-image-btn"
          onClick={() => opts.onOpenPhotos?.([{ id: m.id, url, source: "chat" }], 0)}
        >
          <img src={url} alt={m.text || "Фото"} className="tg-msg-image" loading="lazy" />
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

function bookingSlotStatusModifier(bookingOrStatus, endsAt) {
  const status = typeof bookingOrStatus === "object" && bookingOrStatus
    ? bookingOrStatus.status
    : bookingOrStatus;
  const endRaw =
    typeof bookingOrStatus === "object" && bookingOrStatus
      ? bookingOrStatus.slot_ends_at || bookingOrStatus.ends_at
      : endsAt;
  if (status === "cancelled") return "booking-slot--cancelled";
  if (status === "done") return "booking-slot--done";
  const endMs = endRaw ? new Date(endRaw).getTime() : NaN;
  if (Number.isFinite(endMs) && endMs < Date.now() && (status === "new" || status === "confirmed")) {
    return "booking-slot--overdue";
  }
  if (status === "confirmed") return "booking-slot--confirmed";
  if (status === "new") return "booking-slot--new";
  return "";
}

function bookingSlotCompactIcon(statusModifier) {
  if (statusModifier === "booking-slot--cancelled") return "✕";
  if (statusModifier === "booking-slot--done") return "✓";
  if (statusModifier === "booking-slot--overdue") return "!";
  if (statusModifier === "booking-slot--confirmed") return "●";
  return "○";
}

const BOOKING_STATUS_LABELS = {
  new: "Новая",
  confirmed: "Подтверждена",
  cancelled: "Отменена",
  done: "Оказана",
};

function bookingStatusLabel(status) {
  return BOOKING_STATUS_LABELS[status] || status || "";
}

function formatInAppNotificationText(n) {
  const title = (n?.payload?.title || "").trim();
  const body = (n?.payload?.body || "").trim();
  const when =
    (n?.payload?.when || "").trim() ||
    (n?.payload?.starts_at ? formatBookingDateTime(n.payload.starts_at) : "");
  if (title && body) return [title, body, when].filter(Boolean).join(" · ");
  if (body) return [body, when].filter(Boolean).join(" · ");
  if (title) return [title, when].filter(Boolean).join(" · ");
  if (n?.kind === "staff_invite_accepted") {
    return `Сотрудник ${n.payload?.staff_name || ""} принял приглашение.`.trim();
  }
  if (n?.kind === "booking") {
    const service = n?.payload?.service_name;
    const when = n?.payload?.when;
    const parts = [service, when].filter(Boolean);
    return parts.length ? `Запись: ${parts.join(" · ")}` : "Новая запись";
  }
  if (n?.kind === "chat_message") return "Новое сообщение в чате";
  if (n?.kind === "review") return "Новый отзыв";
  return "Уведомление";
}

function formatBookingPrice(price) {
  if (price == null || price === "") return "—";
  const n = Number(price);
  if (Number.isNaN(n)) return String(price);
  return `${n.toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₽`;
}

function reviewIsSupplemented(review) {
  return Boolean(review?.supplemented_at);
}

function splitSupplementedReviewText(review) {
  const text = String(review?.text || "").trim();
  if (!reviewIsSupplemented(review)) {
    return { main: text, supplement: "" };
  }
  const sep = text.lastIndexOf("\n\n");
  if (sep >= 0) {
    return {
      main: text.slice(0, sep).trim(),
      supplement: text.slice(sep + 2).trim(),
    };
  }
  return { main: text, supplement: "" };
}

function ReviewSupplementEnterIcon() {
  return (
    <span className="review-supplemented-enter-icon" aria-hidden="true">
      ↪
    </span>
  );
}

function ReviewTextContent({ review, mainClassName = "review-item-text", supplementClassName = "review-text-supplement" }) {
  const { main, supplement } = splitSupplementedReviewText(review);
  if (!reviewIsSupplemented(review)) {
    return main ? <p className={mainClassName}>{main}</p> : null;
  }
  const showSupplementBlock = Boolean(supplement) || reviewIsSupplemented(review);
  if (!main && !showSupplementBlock) return null;
  return (
    <div className="review-text-stack">
      {main ? <p className={mainClassName}>{main}</p> : null}
      {showSupplementBlock && (
        <div className="review-supplemented-block">
          <div className="review-supplemented-label-row">
            <ReviewSupplementEnterIcon />
            <span className="review-supplemented-label">Отзыв дополнен</span>
          </div>
          {supplement ? <p className={supplementClassName}>{supplement}</p> : null}
        </div>
      )}
    </div>
  );
}

function formatBookingDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StarRating({ value, onChange }) {
  return (
    <div className="star-rating" role="group" aria-label="Оценка">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={["star-rating-btn", n <= value && "star-rating-btn--active"].filter(Boolean).join(" ")}
          aria-label={`${n} из 5`}
          aria-pressed={n <= value}
          onClick={() => onChange(n)}
        >
          <span className="star-rating-icon" aria-hidden>★</span>
        </button>
      ))}
    </div>
  );
}

function formatTimeHm(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function clientWindowKey(w) {
  return `${w.starts_at}|${w.ends_at}|${w.staff_id ?? ""}`;
}

const BOOKING_MESSAGE_DATE_TOKEN = "{date}";
const bookingTokenDragRef = { el: null };
const bookingTokenPointerRef = { active: false, token: null, editorRoot: null, onComplete: null };

function stopBookingTokenPointerDrag() {
  document.getElementById("booking-token-ghost")?.remove();
  if (!bookingTokenPointerRef.active) return;
  bookingTokenPointerRef.active = false;
  bookingTokenPointerRef.token = null;
  bookingTokenPointerRef.editorRoot = null;
  bookingTokenPointerRef.onComplete = null;
  document.body.classList.remove("booking-token-pointer-dragging");
  document.removeEventListener("pointermove", onBookingTokenPointerMove);
  document.removeEventListener("pointerup", onBookingTokenPointerUp);
  document.removeEventListener("pointercancel", onBookingTokenPointerUp);
}

function onBookingTokenPointerMove(e) {
  if (!bookingTokenPointerRef.active) return;
  e.preventDefault();
  let ghost = document.getElementById("booking-token-ghost");
  if (!ghost) {
    ghost = document.createElement("div");
    ghost.id = "booking-token-ghost";
    ghost.textContent = "Дата и время";
    Object.assign(ghost.style, {
      position: "fixed",
      zIndex: "9999",
      pointerEvents: "none",
      padding: "6px 10px",
      borderRadius: "999px",
      background: "#fff",
      boxShadow: "0 4px 16px rgba(0,0,0,.18)",
    });
    document.body.appendChild(ghost);
  }
  ghost.style.left = `${e.clientX + 12}px`;
  ghost.style.top = `${e.clientY + 12}px`;
}

function onBookingTokenPointerUp(e) {
  const { token, editorRoot, onComplete } = bookingTokenPointerRef;
  token?.classList?.remove("booking-msg-token--dragging");
  stopBookingTokenPointerDrag();
  if (typeof onComplete === "function") onComplete(e.clientX, e.clientY, editorRoot);
}

function startBookingTokenPointerDrag({ token, editorRoot, onComplete }) {
  stopBookingTokenPointerDrag();
  bookingTokenPointerRef.active = true;
  bookingTokenPointerRef.token = token;
  bookingTokenPointerRef.editorRoot = editorRoot;
  bookingTokenPointerRef.onComplete = onComplete;
  token?.classList?.add("booking-msg-token--dragging");
  token?.classList?.add("booking-msg-token--pointer-enabled");
  document.body.classList.add("booking-token-pointer-dragging");
  document.addEventListener("pointermove", onBookingTokenPointerMove, { passive: false });
  document.addEventListener("pointerup", onBookingTokenPointerUp);
  document.addEventListener("pointercancel", onBookingTokenPointerUp);
}

function getBookingEditorCaretAtPoint(root, clientX, clientY, excludeToken = null) {
  if (!root) return null;

  if (document.caretRangeFromPoint) {
    const range = document.caretRangeFromPoint(clientX, clientY);
    if (range && root.contains(range.commonAncestorContainer)) {
      if (!excludeToken || !excludeToken.contains(range.commonAncestorContainer)) return range;
    }
  } else if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(clientX, clientY);
    if (pos?.offsetNode && root.contains(pos.offsetNode)) {
      if (!excludeToken || !excludeToken.contains(pos.offsetNode)) {
        const range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.collapse(true);
        return range;
      }
    }
  }

  let node = document.elementFromPoint(clientX, clientY);
  if (!node || !root.contains(node)) return null;

  const hitToken = node.closest?.("[data-booking-token='date']");
  if (hitToken && root.contains(hitToken) && hitToken !== excludeToken) {
    const range = document.createRange();
    const rect = hitToken.getBoundingClientRect();
    if (clientX > rect.left + rect.width / 2) range.setStartAfter(hitToken);
    else range.setStartBefore(hitToken);
    range.collapse(true);
    return range;
  }

  let child = node;
  while (child && child.parentNode !== root) child = child.parentNode;
  if (child && child !== root) {
    const range = document.createRange();
    const rect = child.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const midX = rect.left + rect.width / 2;
    if (clientY > midY || (clientY >= rect.top && clientX > midX)) {
      if (child.nextSibling) range.setStartBefore(child.nextSibling);
      else range.setStartAfter(child);
    } else {
      range.setStartBefore(child);
    }
    range.collapse(true);
    if (root.contains(range.commonAncestorContainer)) return range;
  }

  const fallback = document.createRange();
  fallback.selectNodeContents(root);
  fallback.collapse(false);
  return fallback;
}

function insertBookingTokenAtRange(root, range, token) {
  if (!root || !token) return;
  if (range && root.contains(range.commonAncestorContainer)) {
    range.insertNode(token);
    range.setStartAfter(token);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  } else {
    root.appendChild(token);
  }
}

function dropBookingTokenAtPoint(root, clientX, clientY, { moveToken = null, createNew = false, onAfterChange } = {}) {
  if (!root) return;
  const rect = root.getBoundingClientRect();
  if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return;

  const range = getBookingEditorCaretAtPoint(root, clientX, clientY, moveToken || null);
  let token = moveToken;
  if (createNew) token = createBookingTokenElement(root, onAfterChange);
  else if (token?.parentNode) token.remove();

  insertBookingTokenAtRange(root, range, token);
  resizeBookingEditor(root);
  onAfterChange?.();
}

function parseBookingMessage(value) {
  if (!value) return [""];
  return value.split(/(\{date\})/g);
}

function serializeBookingEditor(root) {
  if (!root) return "";
  let out = "";
  root.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent || "";
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node;
    if (el.dataset?.bookingToken === "date") {
      out += BOOKING_MESSAGE_DATE_TOKEN;
      return;
    }
    if (el.tagName === "BR") {
      out += "\n";
      return;
    }
    out += serializeBookingEditor(el);
  });
  return out;
}

function resizeBookingEditor(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.max(el.scrollHeight, 72)}px`;
}

function bindInlineBookingTokenDrag(token, editorRoot, onAfterChange) {
  if (!token || token.dataset.pointerDragBound) return;
  token.dataset.pointerDragBound = "1";
  token.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    if (e.target.closest(".booking-msg-token-remove")) return;
    e.preventDefault();
    e.stopPropagation();
    startBookingTokenPointerDrag({
      token,
      editorRoot,
      onComplete: (x, y, root) => {
        dropBookingTokenAtPoint(root || editorRoot, x, y, { moveToken: token, onAfterChange });
      },
    });
  });
  token.draggable = true;
  token.addEventListener("dragstart", (e) => {
    bookingTokenDragRef.el = token;
    token.classList.add("booking-msg-token--dragging");
    e.dataTransfer.setData("application/x-booking-token-move", "1");
    e.dataTransfer.setData("text/plain", BOOKING_MESSAGE_DATE_TOKEN);
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setDragImage(document.createElement("span"), 0, 0);
    } catch {
      // ignore
    }
  });
  token.addEventListener("dragend", () => {
    bookingTokenDragRef.el = null;
    token.classList.remove("booking-msg-token--dragging");
  });
}

function createBookingTokenElement(editorRoot, onAfterChange) {
  const wrap = document.createElement("span");
  wrap.contentEditable = "false";
  wrap.dataset.bookingToken = "date";
  wrap.className = "booking-msg-token booking-msg-token--inline";
  wrap.setAttribute("title", "Дата и время записи клиента");
  wrap.innerHTML =
    '<span class="booking-msg-token-grip" aria-hidden="true">⋮⋮</span> Дата и время записи <span class="booking-msg-token-remove" role="button" tabindex="0" aria-label="Убрать дату и время">×</span>';
  bindInlineBookingTokenDrag(wrap, editorRoot, onAfterChange);
  return wrap;
}

function insertBookingTokenAtPoint(root, clientX, clientY, onAfterChange) {
  dropBookingTokenAtPoint(root, clientX, clientY, { createNew: true, onAfterChange });
}

function syncBookingEditorFromValue(root, value, onAfterChange) {
  if (!root) return;
  root.innerHTML = "";
  parseBookingMessage(value).forEach((part) => {
    if (part === BOOKING_MESSAGE_DATE_TOKEN) {
      root.appendChild(createBookingTokenElement(root, onAfterChange));
    } else if (part) {
      root.appendChild(document.createTextNode(part));
    }
  });
  resizeBookingEditor(root);
}

function insertBookingTokenAtSelection(root, onAfterChange) {
  if (!root) return;
  root.focus();
  const token = createBookingTokenElement(root, onAfterChange);
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    root.appendChild(token);
  } else {
    const range = sel.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) {
      root.appendChild(token);
    } else {
      range.deleteContents();
      range.insertNode(token);
      range.setStartAfter(token);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }
  resizeBookingEditor(root);
  onAfterChange?.();
}

function BookingMsgDateToken({ onPointerDown, onDragStart, onRemove, onClick, className = "" }) {
  return (
    <button
      type="button"
      draggable
      className={["booking-msg-token", className].filter(Boolean).join(" ")}
      style={{ touchAction: "none" }}
      onPointerDown={onPointerDown}
      onDragStart={onDragStart}
      onClick={onClick}
      title="Перетащите в текст или нажмите для вставки"
    >
      <span className="booking-msg-token-grip" aria-hidden="true">
        ⋮⋮
      </span>
      Дата и время записи
      {onRemove ? (
        <span
          role="button"
          tabIndex={0}
          className="booking-msg-token-remove"
          aria-label="Убрать дату и время"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }
          }}
        >
          ×
        </span>
      ) : null}
    </button>
  );
}

function BookingMessageField({ id, label, value, onChange, placeholder, highlighted, presetKey }) {
  const hintPlaceholder =
    placeholder || BOOKING_MSG_PRESETS[presetKey]?.[0] || "Текст сообщения клиенту…";
  const editorRef = useRef(null);
  const syncingRef = useRef(false);
  const isEmpty = !value.trim();

  function emitFromEditor() {
    const el = editorRef.current;
    if (!el) return;
    syncingRef.current = true;
    onChange(serializeBookingEditor(el));
    syncingRef.current = false;
    resizeBookingEditor(el);
  }

  function onTokenDragStart(e) {
    e.dataTransfer.setData("text/plain", BOOKING_MESSAGE_DATE_TOKEN);
    e.dataTransfer.effectAllowed = "copy";
    try {
      e.dataTransfer.setDragImage(document.createElement("span"), 0, 0);
    } catch {
      // ignore
    }
  }

  function onPalettePointerDown(e) {
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const root = editorRef.current;
    startBookingTokenPointerDrag({
      token: e.currentTarget,
      editorRoot: root,
      onComplete: (x, y, editorRoot) => {
        if (Math.hypot(x - startX, y - startY) < 8) return;
        dropBookingTokenAtPoint(editorRoot || root, x, y, { createNew: true, onAfterChange: emitFromEditor });
      },
    });
  }

  function insertToken() {
    insertBookingTokenAtSelection(editorRef.current, emitFromEditor);
  }

  useEffect(() => {
    const el = editorRef.current;
    if (!el || syncingRef.current) return;
    if (serializeBookingEditor(el) !== value) {
      syncBookingEditorFromValue(el, value, emitFromEditor);
    }
  }, [value]);

  useEffect(() => () => stopBookingTokenPointerDrag(), []);

  return (
    <div className="booking-msg-field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div
        id={id}
        ref={editorRef}
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        contentEditable
        suppressContentEditableWarning
        className={[
          "booking-msg-composer",
          "booking-msg-editor",
          highlighted && "booking-msg-composer--highlight",
          isEmpty && "booking-msg-editor--empty",
        ]
          .filter(Boolean)
          .join(" ")}
        data-placeholder={hintPlaceholder}
        onInput={emitFromEditor}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = bookingTokenDragRef.el ? "move" : "copy";
        }}
        onDrop={(e) => {
          e.preventDefault();
          const el = editorRef.current;
          if (!el) return;
          const moving = bookingTokenDragRef.el;
          bookingTokenDragRef.el = null;
          if (moving?.parentNode) {
            dropBookingTokenAtPoint(el, e.clientX, e.clientY, { moveToken: moving, onAfterChange: emitFromEditor });
            return;
          }
          if (e.dataTransfer.getData("text/plain") === BOOKING_MESSAGE_DATE_TOKEN) {
            dropBookingTokenAtPoint(el, e.clientX, e.clientY, { createNew: true, onAfterChange: emitFromEditor });
          }
        }}
        onClick={(e) => {
          const removeBtn = e.target.closest(".booking-msg-token-remove");
          const token = e.target.closest("[data-booking-token='date']");
          if (removeBtn && token) {
            e.preventDefault();
            token.remove();
            emitFromEditor();
          }
        }}
        onKeyDown={(e) => {
          if (!(e.key === "Enter" || e.key === " ")) return;
          const removeBtn = e.target.closest?.(".booking-msg-token-remove");
          if (!removeBtn) return;
          e.preventDefault();
          removeBtn.closest("[data-booking-token]")?.remove();
          emitFromEditor();
        }}
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, text);
          emitFromEditor();
        }}
      />
      <BookingMsgDateToken
        className="booking-msg-token--palette"
        onPointerDown={onPalettePointerDown}
        onDragStart={onTokenDragStart}
        onClick={insertToken}
      />
    </div>
  );
}

function MiniDatePicker({ id, label, value, onChange, allowClear = false }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const today = todayIsoDate();
  const parsed = value ? new Date(`${value}T12:00:00`) : null;
  const initialMonth = parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
  const [viewMonth, setViewMonth] = useState(
    () => `${initialMonth.getFullYear()}-${String(initialMonth.getMonth() + 1).padStart(2, "0")}`,
  );

  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (wrapRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, [open]);

  useEffect(() => {
    if (!value) return;
    const d = new Date(`${value}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
  }, [value]);

  const [vy, vm] = viewMonth.split("-").map(Number);
  const first = new Date(vy, vm - 1, 1);
  const daysInMonth = new Date(vy, vm, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < offset; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);

  const displayLabel = value
    ? new Date(`${value}T12:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
    : "Выбрать дату";

  return (
    <div className="mini-date-picker" ref={wrapRef}>
      {label ? (
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
      ) : null}
      <button
        id={id}
        type="button"
        className={`mini-date-picker-btn${value ? "" : " mini-date-picker-btn--empty"}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {displayLabel}
      </button>
      {allowClear && value ? (
        <button
          type="button"
          className="ghost-btn mini-date-picker-clear"
          onClick={() => {
            onChange("");
            setOpen(false);
          }}
        >
          Не учитывать дату
        </button>
      ) : null}
      {open && (
        <div className="mini-date-picker-popover" role="dialog" aria-label="Календарь">
          <div className="mini-date-picker-nav">
            <button
              type="button"
              className="ghost-btn mini-date-nav-btn"
              onClick={() => {
                const d = new Date(vy, vm - 2, 1);
                setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
              }}
            >
              ‹
            </button>
            <span className="mini-date-picker-month">
              {first.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}
            </span>
            <button
              type="button"
              className="ghost-btn mini-date-nav-btn"
              onClick={() => {
                const d = new Date(vy, vm, 1);
                setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
              }}
            >
              ›
            </button>
          </div>
          <div className="mini-date-picker-weekdays">
            {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((wd) => (
              <span key={wd} className="mini-date-wd">
                {wd}
              </span>
            ))}
          </div>
          <div className="mini-date-picker-grid">
            {cells.map((day, idx) => {
              if (!day) return <span key={`e-${idx}`} className="mini-date-cell mini-date-cell--empty" />;
              const iso = `${vy}-${String(vm).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isToday = iso === today;
              const isSelected = iso === value;
              return (
                <button
                  key={iso}
                  type="button"
                  className={[
                    "mini-date-cell",
                    isToday && "mini-date-cell--today",
                    isSelected && "mini-date-cell--selected",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StaffServicesAssignment({ link, categories, services, onSave }) {
  const [treeOpen, setTreeOpen] = useState({});
  const visibleServiceIds = new Set(services.map((s) => Number(s.id)));
  const visibleCategoryIds = new Set(categories.map((c) => Number(c.id)));
  const svcSet = new Set(
    (link.assigned_service_ids || []).map(Number).filter((id) => visibleServiceIds.has(id)),
  );
  const catSet = new Set(
    (link.assigned_category_ids || []).map(Number).filter((id) => visibleCategoryIds.has(id)),
  );

  function emit(nextSvc, nextCat) {
    onSave(link.id, [...nextSvc], [...nextCat]);
  }

  function toggleCategory(catId) {
    const catServices = services.filter((s) => Number(s.category) === Number(catId)).map((s) => Number(s.id));
    const nextCat = new Set(catSet);
    const nextSvc = new Set(svcSet);
    if (nextCat.has(Number(catId))) {
      nextCat.delete(Number(catId));
      catServices.forEach((id) => nextSvc.delete(id));
    } else {
      nextCat.add(Number(catId));
      catServices.forEach((id) => nextSvc.add(id));
    }
    emit(nextSvc, nextCat);
  }

  function toggleService(svc) {
    const sid = Number(svc.id);
    const cid = svc.category ? Number(svc.category) : null;
    const nextSvc = new Set(svcSet);
    const nextCat = new Set(catSet);
    if (nextSvc.has(sid)) nextSvc.delete(sid);
    else nextSvc.add(sid);
    if (cid) {
      const catServices = services.filter((s) => Number(s.category) === cid);
      const allOn = catServices.length > 0 && catServices.every((s) => nextSvc.has(Number(s.id)));
      if (allOn) nextCat.add(cid);
      else nextCat.delete(cid);
    }
    emit(nextSvc, nextCat);
  }

  const uncategorized = services.filter((s) => !s.category);

  return (
    <div className="staff-services-tree">
      {categories.map((cat) => {
        const catServices = services.filter((s) => Number(s.category) === Number(cat.id));
        const isOpen = treeOpen[cat.id] ?? true;
        const catChecked = catSet.has(Number(cat.id));
        return (
          <div key={cat.id} className="staff-svc-cat">
            <div className="staff-svc-cat-row">
              <label className="checkbox staff-svc-check">
                <input type="checkbox" checked={catChecked} onChange={() => toggleCategory(cat.id)} />
              </label>
              <button type="button" className="tree-toggle staff-svc-toggle" onClick={() => setTreeOpen((p) => ({ ...p, [cat.id]: !isOpen }))}>
                {isOpen ? "▼" : "▶"} {cat.name}
              </button>
            </div>
            {isOpen && (
              <div className="staff-svc-children">
                {catServices.map((srv) => (
                  <label key={srv.id} className="checkbox staff-svc-item">
                    <input type="checkbox" checked={svcSet.has(Number(srv.id))} onChange={() => toggleService(srv)} />
                    {srv.name}
                  </label>
                ))}
                {catServices.length === 0 && <p className="muted small">Нет услуг в категории</p>}
              </div>
            )}
          </div>
        );
      })}
      {uncategorized.length > 0 && (
        <div className="staff-svc-cat">
          <div className="staff-svc-cat-row">
            <span className="muted small-label">Без категории</span>
          </div>
          <div className="staff-svc-children">
            {uncategorized.map((srv) => (
              <label key={srv.id} className="checkbox staff-svc-item">
                <input type="checkbox" checked={svcSet.has(Number(srv.id))} onChange={() => toggleService(srv)} />
                {srv.name}
              </label>
            ))}
          </div>
        </div>
      )}
      {categories.length === 0 && uncategorized.length === 0 && (
        <p className="muted small">В разделе «Услуги и категории» включите услуги (галочка «Оказываем»), чтобы назначать их сотрудникам.</p>
      )}
    </div>
  );
}

export default function App() {
  const [authMode, setAuthMode] = useState("login");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [registerStep, setRegisterStep] = useState(1);
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentView, setCurrentViewState] = useState(() => viewFromPath(window.location.pathname) || "bookings");
  const setCurrentView = useCallback((view) => {
    setCurrentViewState(view);
    navigateView(view);
  }, []);

  const [accessToken, setAccessToken] = useState(localStorage.getItem("vmeste_access") || "");
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem("vmeste_refresh") || "");
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [me, setMe] = useState(null);

  const [roles, setRoles] = useState([]);
  const [spheres, setSpheres] = useState([]);
  const [form, setForm] = useState(emptyRegisterForm);

  const [status, setStatus] = useState("");
  const [authStatus, setAuthStatus] = useState("");
  const [sellerStatus, setSellerStatus] = useState("");
  const [clientStatus, setClientStatus] = useState("");
  const [verifyStatus, setVerifyStatus] = useState("");
  const [resendStatus, setResendStatus] = useState("");
  const [verifyEmailNotice, setVerifyEmailNotice] = useState(null);
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [detectedCity, setDetectedCity] = useState("");

  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [slots, setSlots] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [location, setLocation] = useState([]);
  const [allLocations, setAllLocations] = useState([]);
  const allLocationsRef = useRef([]);
  const [clientMapSearchInput, setClientMapSearchInput] = useState("");
  const [clientMapSearchFocused, setClientMapSearchFocused] = useState(false);
  const clientHeaderSearchWrapRef = useRef(null);
  const [clientDiscoverSearch, setClientDiscoverSearch] = useState("");
  const emptyClientFilters = () => ({
    sphere: "",
    min_price: "",
    max_price: "",
    slot_date: "",
    time_from: "",
    time_to: "",
  });
  const clientDiscoverFiltersRef = useRef(emptyClientFilters());
  const [clientDiscoverFilters, setClientDiscoverFilters] = useState(emptyClientFilters);
  const [clientFilterModalDraft, setClientFilterModalDraft] = useState(emptyClientFilters);
  const [clientFiltersOpen, setClientFiltersOpen] = useState(false);
  const [clientBookModalOpen, setClientBookModalOpen] = useState(false);
  const [mapOrgPopup, setMapOrgPopup] = useState(null);
  const [mapOrgSummary, setMapOrgSummary] = useState(null);
  const [mapOrgReviewsOpen, setMapOrgReviewsOpen] = useState(false);
  const [mapOrgReviews, setMapOrgReviews] = useState([]);
  const [mapOrgReviewsOrdering, setMapOrgReviewsOrdering] = useState("-created_at");
  const [mapOrgProfile, setMapOrgProfile] = useState(null);
  const [mapOrgCarouselIndex, setMapOrgCarouselIndex] = useState(0);
  const [mapMarkersTick, setMapMarkersTick] = useState(0);
  const [orgPhotoLightbox, setOrgPhotoLightbox] = useState(null);

  function openOrgPhotoLightbox(items, index = 0) {
    if (!items?.length) return;
    setOrgPhotoLightbox({
      items,
      index: Math.max(0, Math.min(index, items.length - 1)),
    });
  }

  function stepOrgPhotoLightbox(delta) {
    setOrgPhotoLightbox((prev) => {
      if (!prev?.items?.length) return prev;
      const n = prev.items.length;
      return { ...prev, index: (prev.index + delta + n) % n };
    });
  }

  const orgPhotoLightboxTouchX = useRef(0);

  useEffect(() => {
    if (!orgPhotoLightbox?.items?.length) return undefined;
    function onKeyDown(e) {
      if (e.key === "Escape") setOrgPhotoLightbox(null);
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        stepOrgPhotoLightbox(-1);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        stepOrgPhotoLightbox(1);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [orgPhotoLightbox?.items?.length, orgPhotoLightbox?.index]);

  const [orgProfileForm, setOrgProfileForm] = useState({
    working_hours: defaultOrgWorkingHours(),
    phones: [""],
    websites: [""],
    card_note: "",
  });
  const [orgGalleryPhotos, setOrgGalleryPhotos] = useState([]);
  const [orgProfileSaveStatus, setOrgProfileSaveStatus] = useState("");
  const [orgBookingMessages, setOrgBookingMessages] = useState({ confirm: "", cancel: "", done: "" });
  const [orgSettingsHighlight, setOrgSettingsHighlight] = useState("");
  const [bookingMessageError, setBookingMessageError] = useState(null);
  const [reviewModalBooking, setReviewModalBooking] = useState(null);
  const [reviewModalReview, setReviewModalReview] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, text: "" });
  const [reviewSubmitError, setReviewSubmitError] = useState("");
  const [providerReviews, setProviderReviews] = useState([]);
  const [providerReviewsOrdering, setProviderReviewsOrdering] = useState("-created_at");
  const [missedReviewsCount, setMissedReviewsCount] = useState(0);
  const [myReviews, setMyReviews] = useState([]);
  const [reviewReplyOpenId, setReviewReplyOpenId] = useState(null);
  const [reviewReplyForms, setReviewReplyForms] = useState({});
  const [reviewReplyFormError, setReviewReplyFormError] = useState("");
  const clientDiscoverMapRef = useRef(null);
  const clientDiscoverMapClickBoundRef = useRef(false);
  const clientDiscoverMapZoomTimerRef = useRef(null);
  const clientMeBootstrappedRef = useRef(false);
  const [providerServices, setProviderServices] = useState([]);
  const [clientBookWindows, setClientBookWindows] = useState([]);
  const [clientBookingForm, setClientBookingForm] = useState({
    locationId: "",
    provider: "",
    serviceId: "",
    bookDate: "",
    windowKey: "",
    comment: "",
  });

  const [categoryOpen, setCategoryOpen] = useState({});
  const [subcategoryOpen, setSubcategoryOpen] = useState({});
  const [catalogStatus, setCatalogStatus] = useState(null);
  const [catalogSeeding, setCatalogSeeding] = useState(false);
  const [slotForm, setSlotForm] = useState({ starts_at: "", ends_at: "" });
  const [intervalForm, setIntervalForm] = useState({
    date: "",
    start_time: "09:00",
    end_time: "18:00",
    repeat_type: "none",
    repeat_count: "1",
  });
  const [calendarMonth, setCalendarMonth] = useState(new Date().toISOString().slice(0, 7));
  const [bookingsMonth, setBookingsMonth] = useState(currentLocalMonthKey);
  const [intervalToast, setIntervalToast] = useState(null);
  const intervalToastTimerRef = useRef(null);
  const [savedIntervals, setSavedIntervals] = useState([]);
  const [serviceDrafts, setServiceDrafts] = useState({});
  const [serviceSavingAll, setServiceSavingAll] = useState(false);
  const [selectedIntervalId, setSelectedIntervalId] = useState(null);
  const [dragIntervalId, setDragIntervalId] = useState(null);
  const [intervalPopoverId, setIntervalPopoverId] = useState(null);
  const intervalPopoverAnchorRef = useRef(null);
  const [intervalPopoverFixedStyle, setIntervalPopoverFixedStyle] = useState(null);
  const closeIntervalPopover = useCallback(() => {
    setIntervalPopoverId(null);
    setIntervalPopoverFixedStyle(null);
    intervalPopoverAnchorRef.current = null;
  }, []);

  useLayoutEffect(() => {
    if (intervalPopoverId == null) return undefined;
    const tick = () => {
      const el = intervalPopoverAnchorRef.current;
      if (el?.isConnected) setIntervalPopoverFixedStyle(buildIntervalPopoverFixedStyle(el));
    };
    tick();
    window.addEventListener("resize", tick);
    window.addEventListener("scroll", tick, true);
    return () => {
      window.removeEventListener("resize", tick);
      window.removeEventListener("scroll", tick, true);
    };
  }, [intervalPopoverId]);

  useEffect(() => {
    if (intervalPopoverId == null) return undefined;
    const onDown = (ev) => {
      const anchor = intervalPopoverAnchorRef.current;
      const pop = document.querySelector(".template-popover--portal");
      if (anchor?.contains(ev.target)) return;
      if (pop?.contains(ev.target)) return;
      closeIntervalPopover();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [intervalPopoverId, closeIntervalPopover]);

  const [orgStaff, setOrgStaff] = useState([]);
  const [staffInviteForm, setStaffInviteForm] = useState({ invite_identifier: "" });
  const [staffInviteStatus, setStaffInviteStatus] = useState("");
  const [staffPermsOpenId, setStaffPermsOpenId] = useState(null);
  const [staffServicesOpenId, setStaffServicesOpenId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatHasMoreOlder, setChatHasMoreOlder] = useState(false);
  const [chatLoadingOlder, setChatLoadingOlder] = useState(false);
  const [chatShowJumpBottom, setChatShowJumpBottom] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatStatus, setChatStatus] = useState("");
  /** id чата для модалки оформления (открывается из ⋮ в списке, без смены выбранного чата). */
  const [chatSettingsForId, setChatSettingsForId] = useState(null);
  const [chatReceiptsSettingsOpen, setChatReceiptsSettingsOpen] = useState(false);
  const [chatPins, setChatPins] = useState(() => loadChatPinsFromStorage());
  const [chatDragPinConvId, setChatDragPinConvId] = useState(null);
  const [chatAttachMenuOpen, setChatAttachMenuOpen] = useState(false);
  const [chatMsgSearchOpen, setChatMsgSearchOpen] = useState(false);
  const [chatMsgSearchQuery, setChatMsgSearchQuery] = useState("");
  const [chatMsgSearchActiveIdx, setChatMsgSearchActiveIdx] = useState(0);
  const [chatInfoOpen, setChatInfoOpen] = useState(false);
  const [chatInfoTab, setChatInfoTab] = useState("photos");
  const [chatInfoHeadMenuOpen, setChatInfoHeadMenuOpen] = useState(false);
  const [chatInfoPhotoMenuId, setChatInfoPhotoMenuId] = useState(null);
  const [chatComposeMode, setChatComposeMode] = useState(() => loadChatComposeMode());
  const [chatPendingFiles, setChatPendingFiles] = useState([]);
  const [chatPendingKind, setChatPendingKind] = useState("");
  const [chatRecordingKind, setChatRecordingKind] = useState(null);
  const [chatRecordLocked, setChatRecordLocked] = useState(false);
  const [chatRecordLiftHint, setChatRecordLiftHint] = useState(false);
  const [chatRecordSecs, setChatRecordSecs] = useState(0);
  const [chatRecordLevels, setChatRecordLevels] = useState(() => Array(24).fill(0.12));
  const [chatMediaPreview, setChatMediaPreview] = useState(null);
  const [calendarDayDetail, setCalendarDayDetail] = useState(null);
  const menuWrapRef = useRef(null);
  const tgAttachMenuRef = useRef(null);
  const tgMsgSearchWrapRef = useRef(null);
  const chatMsgSearchInputRef = useRef(null);
  const chatFileInputRef = useRef(null);
  const chatMessagesRef = useRef([]);
  const chatMessagesElRef = useRef(null);
  const chatNearBottomRef = useRef(true);
  const chatLoadingOlderRef = useRef(false);
  const chatHasMoreOlderRef = useRef(false);
  const chatMediaRecorderRef = useRef(null);
  const chatRecordChunksRef = useRef([]);
  const chatRecordStreamRef = useRef(null);
  const chatRecordStartedAtRef = useRef(0);
  const chatHoldTimerRef = useRef(null);
  const chatDidHoldRef = useRef(false);
  const chatPointerStartYRef = useRef(0);
  const chatRecordLiftHintRef = useRef(false);
  const chatRecordLockedRef = useRef(false);
  const chatRecordTickRef = useRef(null);
  const chatAudioCtxRef = useRef(null);
  const chatAnalyserRef = useRef(null);
  const chatLevelRafRef = useRef(null);
  const chatLiveVideoRef = useRef(null);
  const chatPreviewMediaRef = useRef(null);
  const chatRecordMimeRef = useRef("audio/webm");
  const chatRecordKindRef = useRef(null);
  const chatCameraFacingRef = useRef("user");
  const chatKeepRecordingRef = useRef(false);
  const chatCameraStreamRef = useRef(null);
  const chatMirrorPipelineRef = useRef(null);
  const [chatCameraFacing, setChatCameraFacing] = useState("user");
  const [chatCameraSwitching, setChatCameraSwitching] = useState(false);
  const [chatSettingsTitle, setChatSettingsTitle] = useState("");
  const [groupForm, setGroupForm] = useState({ title: "", staff_ids: [] });
  const [chatFabOpen, setChatFabOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ first_name: "", last_name: "", patronymic: "", phone: "" });
  const [passwordForm, setPasswordForm] = useState({ old_password: "", new_password: "", new_password_confirm: "" });
  const [emailForm, setEmailForm] = useState({ new_email: "" });
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
  const mapRef = useRef(null);
  const placemarkRef = useRef(null);
  const profileMapRef = useRef(null);
  const profilePlacemarkRef = useRef(null);
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
  const [profileOrgStatus, setProfileOrgStatus] = useState("");
  const [branchGeoStatus, setBranchGeoStatus] = useState("");
  const [orgMainEditOpen, setOrgMainEditOpen] = useState(false);
  const [selectedOrgBranchId, setSelectedOrgBranchId] = useState(null);
  const [orgBranchAddOpen, setOrgBranchAddOpen] = useState(false);
  const [orgBranchEditOpen, setOrgBranchEditOpen] = useState(false);
  const branchDetailMapRef = useRef(null);
  const branchDetailPlacemarkRef = useRef(null);
  const branchEditMapRef = useRef(null);
  const branchEditPlacemarkRef = useRef(null);
  const branchAddMapRef = useRef(null);
  const branchAddPlacemarkRef = useRef(null);
  const [chatLocalPrefs, setChatLocalPrefs] = useState({});
  const [chatSettingsAvatar, setChatSettingsAvatar] = useState("");
  const [chatSettingsWallpaper, setChatSettingsWallpaper] = useState("#e8f4ea");
  const [appTheme, setAppTheme] = useState(() => localStorage.getItem(APP_THEME_KEY) || "light");
  const [chatFolder, setChatFolder] = useState("org");
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [customColorPickerOpen, setCustomColorPickerOpen] = useState(false);
  const [chatSettingsNotify, setChatSettingsNotify] = useState("all");
  const [chatSettingsMuteUntil, setChatSettingsMuteUntil] = useState("");
  const [incomingToasts, setIncomingToasts] = useState([]);
  const [chatActivity, setChatActivity] = useState(null);
  const lastNotificationToastIdRef = useRef(null);
  const [chatReceiptsMode, setChatReceiptsMode] = useState(() => loadReceiptsPref());
  const currentViewRef = useRef(currentView);
  const meRef = useRef(me);
  const lastConvMsgDigestRef = useRef({});
  const digestPrimedRef = useRef(false);

  const fullName = useMemo(() => {
    if (!me) return "пользователь";
    return [me.last_name, me.first_name, me.patronymic].filter(Boolean).join(" ") || me.username;
  }, [me]);

  const staffEffectivePerms = useMemo(() => {
    const base = {
      manage_bookings: true,
      manage_intervals: false,
      manage_services: false,
      manage_chats: true,
      manage_client_chats: true,
      manage_staff: false,
      can_delegate_permissions: false,
    };
    if (!me || me.role !== "staff") return base;
    const link = orgStaff.find((l) => Number(l.staff) === Number(me.id));
    return { ...base, ...(link?.permissions || {}) };
  }, [me, orgStaff]);

  useEffect(() => {
    if (!me) return;
    setOrgBookingMessages({
      confirm: me.booking_confirm_message_default || "",
      cancel: me.booking_cancel_message_default || "",
      done: me.booking_done_message_default || "",
    });
  }, [me?.booking_confirm_message_default, me?.booking_cancel_message_default, me?.booking_done_message_default]);

  useEffect(() => {
    if (!me || me.role !== "provider") return;
    const phones = Array.isArray(me.organization_phones) ? me.organization_phones.filter(Boolean) : [];
    const websites = Array.isArray(me.organization_websites) ? me.organization_websites.filter(Boolean) : [];
    setOrgProfileForm({
      working_hours: normalizeOrgWorkingHours(me.organization_working_hours),
      phones: phones.length ? phones : [""],
      websites: websites.length ? websites : [""],
      card_note: me.organization_card_note || "",
    });
  }, [
    me?.id,
    me?.role,
    me?.organization_working_hours,
    me?.organization_phones,
    me?.organization_websites,
    me?.organization_card_note,
  ]);

  useEffect(() => {
    if (me?.role !== "provider" || currentView !== "organization") return;
    (async () => {
      const res = await authFetch(`${API_URL}/users/gallery/`);
      if (res.ok) {
        const data = await res.json();
        setOrgGalleryPhotos(Array.isArray(data) ? data : data.photos || []);
      }
    })();
  }, [accessToken, me?.role, currentView]);

  function staffHasPerm(key) {
    if (me?.role === "provider") return true;
    if (me?.role !== "staff") return false;
    return Boolean(staffEffectivePerms[key]);
  }

  function canManageBookings() {
    if (me?.role === "provider") return true;
    if (me?.role === "staff") return staffHasPerm("manage_bookings");
    return false;
  }

  function canViewOrgReviews() {
    return me?.role === "provider" || (me?.role === "staff" && staffHasPerm("manage_bookings"));
  }

  const canManageOrgSettings =
    me?.role === "provider" || (me?.role === "staff" && Boolean(staffEffectivePerms.can_delegate_permissions));

  const orgActiveStaffIdsKey = useMemo(
    () =>
      orgStaff
        .filter((l) => l.is_active && Number(l.staff) !== Number(me?.id))
        .map((l) => Number(l.staff))
        .sort((a, b) => a - b)
        .join(","),
    [orgStaff, me?.id],
  );

  useEffect(() => {
    if (!accessToken || currentView !== "chats" || me?.role !== "provider" || !orgActiveStaffIdsKey) return;
    const ids = orgActiveStaffIdsKey.split(",").map(Number).filter(Boolean);
    if (!ids.length) return;
    let cancelled = false;
    (async () => {
      for (const sid of ids) {
        if (cancelled) break;
        await authFetch(`${API_URL}/chat/conversations/create-direct/`, {
          method: "POST",
          body: JSON.stringify({ staff_id: sid }),
        });
      }
      if (!cancelled) loadChats();
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, currentView, me?.role, orgActiveStaffIdsKey]);

  function showIntervalToast(message) {
    if (intervalToastTimerRef.current) clearTimeout(intervalToastTimerRef.current);
    setIntervalToast(message);
    intervalToastTimerRef.current = setTimeout(() => {
      setIntervalToast(null);
      intervalToastTimerRef.current = null;
    }, 4200);
  }

  const roleOptions = roles.length
    ? roles
    : [
        { key: "client", value: "Клиент" },
        { key: "provider", value: "Исполнитель" },
        { key: "staff", value: "Сотрудник" },
      ];
  const sphereOptions = spheres.length
    ? spheres
    : [
        { key: "hair_salon", value: "Салон красоты" },
        { key: "service_center", value: "Сервисный центр" },
      ];

  useEffect(() => {
    loadRoles();
    loadSpheres();
    handleVerifyEmailFromUrl();
    handleConfirmPasswordChangeFromUrl();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const paymentId = params.get("payment_id");
    if (payment !== "success" || !paymentId || !accessToken) return;
    authFetch(`${API_URL}/subscriptions/confirm/`, {
      method: "POST",
      body: JSON.stringify({ payment_id: Number(paymentId) }),
    })
      .then((r) => r.json())
      .then((data) => {
        setVerifyStatus(data.detail || "Оплата обработана.");
        setCurrentView("subscriptions");
      })
      .catch(() => {});
    window.history.replaceState({}, document.title, window.location.pathname);
  }, [accessToken]);

  function openAuth(mode) {
    destroyRegMap();
    setAuthMode(mode);
    setShowAuthModal(true);
    setRegisterStep(1);
    if (mode === "register") {
      setVerifyEmailNotice(null);
      setResendStatus("");
    }
  }

  function closeAuth() {
    destroyRegMap();
    setShowAuthModal(false);
    setVerifyEmailNotice(null);
    setResendStatus("");
  }

  async function resendVerificationForEmail(email) {
    const normalized = String(email || "").trim();
    if (!normalized) return;
    setResendStatus("Отправляем письмо...");
    const response = await fetch(`${API_URL}/users/resend-verification/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalized }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setResendStatus(data.detail || "Не удалось отправить письмо.");
      return;
    }
    setResendStatus(data.detail || "Письмо отправлено.");
  }

  useEffect(() => {
    if (accessToken) loadMe();
    else setMe(null);
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) {
      resetPushRegistration();
      return;
    }
    initPushNotifications(authFetch, accessToken);
    maybeRequestWebNotificationPermission();
  }, [accessToken]);

  useEffect(() => {
    const notifications = chatActivity?.notifications || [];
    if (!notifications.length) return;
    const newest = [...notifications].sort((a, b) => {
      const aTime = new Date(a.created_at || 0).getTime();
      const bTime = new Date(b.created_at || 0).getTime();
      return bTime - aTime || Number(b.id || 0) - Number(a.id || 0);
    })[0];
    if (!newest || newest.id === lastNotificationToastIdRef.current) return;
    lastNotificationToastIdRef.current = newest.id;
    showToast(newest.payload?.body || formatInAppNotificationText(newest));
  }, [chatActivity?.notifications]);

  useEffect(() => {
    function onPop() {
      const v = viewFromPath(window.location.pathname);
      if (v) setCurrentViewState(v);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const chatActivityBadgeRef = useRef(0);
  useEffect(() => {
    const next = Number(chatActivity?.badge_count) || 0;
    const prev = chatActivityBadgeRef.current;
    chatActivityBadgeRef.current = next;
    if (prev > 0 && next > prev) {
      const note = chatActivity?.notifications?.[0];
      const title = note?.payload?.title || "Вместе";
      const body = note?.payload?.body || "Есть новые уведомления";
      showLocalBrowserNotification(title, body);
    }
  }, [chatActivity?.badge_count]);

  useEffect(() => {
    if (!accessToken) return;
    loadChatActivity();
    const id = setInterval(loadChatActivity, 12000);
    return () => clearInterval(id);
  }, [accessToken, me?.id]);

  useEffect(() => {
    if (!accessToken || !me?.role) return;
    const refresh = () => {
      if (me.role === "client" || me.role === "provider") loadChats();
      else if (me.role === "staff" && staffHasPerm("manage_chats")) loadChats();
    };
    refresh();
    const id = setInterval(refresh, 12000);
    return () => clearInterval(id);
  }, [accessToken, me?.role, me?.id, staffEffectivePerms.manage_chats]);

  useEffect(() => {
    if (!accessToken || !canViewOrgReviews()) return;
    loadMissedReviewsCount();
    const id = setInterval(loadMissedReviewsCount, 12000);
    return () => clearInterval(id);
  }, [accessToken, me?.role, me?.id]);

  useEffect(() => {
    if (!accessToken) return;
    const ping = () => authFetch(`${API_URL}/users/presence/ping/`, { method: "POST", body: "{}" });
    ping();
    const id = setInterval(ping, 35000);
    return () => clearInterval(id);
  }, [accessToken]);

  useEffect(() => {
    if (accessToken && me?.role === "provider") loadSellerData();
  }, [accessToken, me]);

  useEffect(() => {
    if (!accessToken || (currentView !== "organization" && currentView !== "staff")) return;
    if (me?.role === "provider") loadSellerData();
    else if (me?.role === "staff" && staffEffectivePerms.can_delegate_permissions) loadStaffWorkspace();
  }, [accessToken, currentView, me?.role, staffEffectivePerms.can_delegate_permissions]);

  useEffect(() => {
    if (accessToken && me?.role === "staff") loadStaffWorkspace();
  }, [accessToken, me]);

  useEffect(() => {
    if (!accessToken || currentView !== "chats") return;
    if (me?.role === "provider") {
      loadChats();
      authFetch(`${API_URL}/booking/staff/`).then((r) => {
        if (r.ok) return r.json();
        return null;
      }).then((d) => {
        if (Array.isArray(d)) setOrgStaff(d);
      });
    } else if (me?.role === "staff") {
      loadStaffWorkspace();
    } else if (me?.role === "client") {
      loadChats();
    }
  }, [accessToken, currentView, me?.role]);

  useEffect(() => {
    chatMessagesRef.current = chatMessages;
  }, [chatMessages]);

  useEffect(() => {
    if (chatRecordingKind !== "video_note") return undefined;
    attachLiveCameraPreview();
    const t1 = window.setTimeout(attachLiveCameraPreview, 50);
    const t2 = window.setTimeout(attachLiveCameraPreview, 250);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [chatRecordingKind, chatCameraFacing]);

  useEffect(() => {
    chatHasMoreOlderRef.current = chatHasMoreOlder;
  }, [chatHasMoreOlder]);

  useEffect(() => {
    if (!accessToken || !selectedChatId || currentView !== "chats") return;
    let cancelled = false;
    setChatMessages([]);
    setChatHasMoreOlder(false);
    setChatShowJumpBottom(false);
    chatNearBottomRef.current = true;

    async function loadLatest() {
      const msgs = await fetchChatMessagesPage(selectedChatId, { limit: CHAT_MSG_PAGE_SIZE });
      if (cancelled || !msgs) return;
      setChatMessages(msgs);
      setChatHasMoreOlder(msgs.length >= CHAT_MSG_PAGE_SIZE);
      requestAnimationFrame(() => scrollChatToBottom(false));
      const last = msgs.length ? msgs[msgs.length - 1] : null;
      if (last) {
        await authFetch(`${API_URL}/chat/conversations/${selectedChatId}/mark-read/`, {
          method: "POST",
          body: JSON.stringify({ message_id: last.id }),
        });
        loadChats();
      }
    }

    async function pollNewer() {
      const current = chatMessagesRef.current;
      const lastId = current.length ? current[current.length - 1].id : null;
      if (!lastId) {
        await loadLatest();
        return;
      }
      const newer = await fetchChatMessagesPage(selectedChatId, {
        afterId: lastId,
        limit: CHAT_MSG_PAGE_SIZE,
      });
      if (cancelled || !newer?.length) return;
      setChatMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const add = newer.filter((m) => !seen.has(m.id));
        return add.length ? [...prev, ...add] : prev;
      });
      if (chatNearBottomRef.current) {
        requestAnimationFrame(() => scrollChatToBottom(true));
      } else {
        setChatShowJumpBottom(true);
      }
      const last = newer[newer.length - 1];
      if (last) {
        await authFetch(`${API_URL}/chat/conversations/${selectedChatId}/mark-read/`, {
          method: "POST",
          body: JSON.stringify({ message_id: last.id }),
        });
        loadChats();
      }
    }

    loadLatest();
    const id = setInterval(pollNewer, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [accessToken, selectedChatId, currentView]);

  useEffect(() => {
    if (!me) return;
    setProfileForm({
      first_name: me.first_name || "",
      last_name: me.last_name || "",
      patronymic: me.patronymic || "",
      phone: ensurePhonePlus7(me.phone || "+7"),
    });
    setEmailForm({ new_email: me.email || "" });
  }, [me]);

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

  useEffect(() => {
    if (currentView !== "chats" || !conversations.length) return;
    lastConvMsgDigestRef.current = conversations.reduce((acc, c) => {
      acc[c.id] = c.last_message?.id ?? null;
      return acc;
    }, {});
    digestPrimedRef.current = true;
  }, [currentView, conversations]);

  useEffect(() => {
    const next = {};
    for (const c of conversations) {
      try {
        const raw = localStorage.getItem(chatPrefsStorageKey(c.id));
        if (raw) next[c.id] = JSON.parse(raw);
      } catch {
        // ignore
      }
    }
    setChatLocalPrefs(next);
  }, [conversations]);

  useEffect(() => {
    if (chatSettingsForId == null) return;
    const p = chatLocalPrefs[chatSettingsForId] || {};
    const sel = conversations.find((x) => x.id === chatSettingsForId);
    const fallback = defaultChatListNameForConversation(sel, me?.id);
    setChatSettingsTitle(p.title || fallback);
    setChatSettingsAvatar(p.avatarDataUrl || "");
    setChatSettingsWallpaper(p.wallpaper || "#dfe9e2");
    let notify = "all";
    try {
      const raw = localStorage.getItem(chatNotifyStorageKey(chatSettingsForId));
      const st = raw ? JSON.parse(raw) : {};
      if (st.muted) notify = "off";
      else if (st.mutedUntil && Date.now() < Number(st.mutedUntil)) notify = "1h";
    } catch {
      // ignore
    }
    setChatSettingsNotify(notify);
    // Только при смене чата: иначе polling conversations / chatLocalPrefs сбрасывает ввод в поле «Имя».
  }, [chatSettingsForId]);

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_PINS_STORAGE_KEY, JSON.stringify(chatPins));
    } catch {
      // ignore
    }
  }, [chatPins]);

  useEffect(() => {
    if (!conversations.length) return;
    const ids = new Set(conversations.map((c) => Number(c.id)));
    setChatPins((prev) => {
      const org = (prev.org || []).filter((id) => ids.has(Number(id)));
      const clients = (prev.clients || []).filter((id) => ids.has(Number(id)));
      if (org.length === (prev.org || []).length && clients.length === (prev.clients || []).length) return prev;
      return { org, clients };
    });
  }, [conversations]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e) {
      if (menuWrapRef.current?.contains(e.target)) return;
      setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, [menuOpen]);

  useEffect(() => {
    if (!chatAttachMenuOpen) return;
    function onDoc(e) {
      if (tgAttachMenuRef.current?.contains(e.target)) return;
      setChatAttachMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, [chatAttachMenuOpen]);

  useEffect(() => {
    if (!chatMsgSearchOpen) return;
    function onDoc(e) {
      if (tgMsgSearchWrapRef.current?.contains(e.target)) return;
      setChatMsgSearchOpen(false);
      setChatMsgSearchQuery("");
      setChatMsgSearchActiveIdx(0);
    }
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, [chatMsgSearchOpen]);

  useEffect(() => {
    if (!customColorPickerOpen) return;
    function onDocMouseDown(e) {
      if (e.target.closest(".tg-color-popover") || e.target.closest(".tg-color-picker-toggle")) return;
      setCustomColorPickerOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown, true);
    return () => document.removeEventListener("mousedown", onDocMouseDown, true);
  }, [customColorPickerOpen]);

  useEffect(() => {
    const t = setTimeout(() => setClientDiscoverSearch(clientMapSearchInput), 420);
    return () => clearTimeout(t);
  }, [clientMapSearchInput]);

  const clientDiscoverSearchOrgs = useMemo(() => {
    if (!clientMapSearchInput.trim()) return [];
    return uniqueDiscoverOrgs(allLocations);
  }, [allLocations, clientMapSearchInput]);

  const showClientDiscoverSearchDropdown =
    clientMapSearchFocused && clientMapSearchInput.trim().length > 0;

  useEffect(() => {
    if (!clientMapSearchFocused) return undefined;
    const onDocDown = (e) => {
      if (clientHeaderSearchWrapRef.current?.contains(e.target)) return;
      setClientMapSearchFocused(false);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [clientMapSearchFocused]);

  useEffect(() => {
    if (!accessToken || !me || me.role !== "client") return;
    if (!clientMeBootstrappedRef.current) {
      clientMeBootstrappedRef.current = true;
      setCurrentView("client_map");
    }
  }, [accessToken, me?.id, me?.role]);

  useEffect(() => {
    if (!accessToken || me?.role !== "client") return;
    const p = new URLSearchParams();
    const q = clientDiscoverSearch.trim();
    if (q) p.set("search", q);
    const f = clientDiscoverFilters;
    if (f.sphere) p.set("sphere", f.sphere);
    if (String(f.min_price).trim() !== "") p.set("min_price", String(f.min_price).trim());
    if (String(f.max_price).trim() !== "") p.set("max_price", String(f.max_price).trim());
    if (f.slot_date) {
      p.set("slot_date_from", f.slot_date);
      p.set("slot_date_to", f.slot_date);
    }
    if (f.time_from) p.set("time_from", f.time_from);
    if (f.time_to) p.set("time_to", f.time_to);
    const qs = p.toString();
    const url = qs ? `${API_URL}/locations/?${qs}` : `${API_URL}/locations/`;
    let cancelled = false;
    (async () => {
      const locationsRes = await authFetch(url);
      if (cancelled || !locationsRes.ok) return;
      setAllLocations(await locationsRes.json());
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, me?.role, clientDiscoverSearch, clientDiscoverFilters]);

  useEffect(() => {
    if (!accessToken || me?.role !== "client") return;
    let cancelled = false;
    (async () => {
      const bookingsRes = await authFetch(`${API_URL}/booking/`);
      if (cancelled || !bookingsRes.ok) return;
      setBookings(normalizeBookingsList(await bookingsRes.json()));
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, me?.id, me?.role]);

  useEffect(() => {
    if (!accessToken || me?.role !== "client") return;
    loadMyReviews();
  }, [accessToken, me?.role, me?.id]);

  useEffect(() => {
    if (!accessToken || currentView !== "reviews" || !canViewOrgReviews()) return;
    loadProviderReviewsList(providerReviewsOrdering);
    markReviewsSeen();
  }, [accessToken, currentView, me?.role, providerReviewsOrdering, staffEffectivePerms]);

  useEffect(() => {
    if (!accessToken || currentView !== "services" || me?.role !== "provider") return;
    loadCatalogStatus();
  }, [accessToken, currentView, me?.role, me?.provider_sphere]);

  useEffect(() => {
    if (!accessToken || me?.role !== "provider") return;
    if (currentView !== "intervals" && currentView !== "bookings") return;
    reloadProviderSlots();
    const id = setInterval(reloadProviderSlots, 15000);
    return () => clearInterval(id);
  }, [accessToken, me?.role, currentView]);

  useEffect(() => {
    if (!accessToken || currentView !== "bookings") return;
    if (me?.role === "client") reloadBookingsList();
    else if (me?.role === "provider") loadSellerData();
    else if (me?.role === "staff" && staffHasPerm("manage_bookings")) reloadBookingsList();
  }, [accessToken, currentView, me?.role, me?.id]);

  useEffect(() => {
    if (!accessToken || currentView !== "booking_history") return;
    reloadBookingsList();
    if (me?.role === "client") loadMyReviews();
  }, [accessToken, currentView, me?.role, me?.id]);

  useEffect(() => {
    allLocationsRef.current = allLocations;
  }, [allLocations]);

  useEffect(() => {
    clientDiscoverFiltersRef.current = clientDiscoverFilters;
  }, [clientDiscoverFilters]);

  useEffect(() => {
    if (currentView === "client_book" && me?.role === "client" && clientDiscoverFilters.slot_date && !clientBookingForm.bookDate) {
      setClientBookingForm((p) => ({ ...p, bookDate: clientDiscoverFilters.slot_date }));
    }
  }, [currentView, me?.role, clientDiscoverFilters.slot_date]);

  useEffect(() => {
    if (me?.role !== "client") return;
    const { provider, serviceId, bookDate } = clientBookingForm;
    if (!provider || !serviceId || !bookDate) {
      setClientBookWindows([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await authFetch(
        `${API_URL}/booking/slots/available-windows/?provider=${encodeURIComponent(provider)}&service=${encodeURIComponent(serviceId)}&date=${encodeURIComponent(bookDate)}`,
      );
      if (cancelled) return;
      if (res.ok) {
        const data = await res.json();
        const now = Date.now();
        setClientBookWindows(
          (Array.isArray(data) ? data : []).filter((w) => {
            const t = new Date(w.starts_at).getTime();
            return Number.isFinite(t) && t > now;
          })
        );
      } else setClientBookWindows([]);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientBookingForm.provider, clientBookingForm.serviceId, clientBookingForm.bookDate, me?.role]);

  useEffect(() => {
    const map = clientDiscoverMapRef.current;
    if (!map || currentView !== "client_map" || me?.role !== "client") return;
    const lockMap = Boolean(clientBookModalOpen || clientFiltersOpen);
    try {
      if (lockMap) {
        map.behaviors.disable(["drag", "scrollZoom", "dblClickZoom", "multiTouch"]);
      } else {
        map.behaviors.enable(["drag", "scrollZoom", "dblClickZoom", "multiTouch"]);
      }
    } catch {
      // ignore
    }
  }, [clientBookModalOpen, clientFiltersOpen, currentView, me?.role]);

  useEffect(() => {
    if (currentView !== "client_map" || me?.role !== "client") return undefined;
    if (mapOrgPopup) {
      window.setTimeout(fitClientDiscoverMapViewport, 0);
      window.setTimeout(fitClientDiscoverMapViewport, 200);
    } else {
      window.setTimeout(fitClientDiscoverMapViewport, 0);
    }
    return undefined;
  }, [mapOrgPopup, mapOrgReviewsOpen, currentView, me?.role]);

  useEffect(() => {
    if (currentView !== "client_map" || me?.role !== "client") {
      destroyClientDiscoverMap();
      return undefined;
    }
    const t = setTimeout(() => {
      void loadYandexMaps()
        .then(() => {
          const ymaps = window.ymaps;
          if (!ymaps || clientDiscoverMapRef.current) return;
          if (!document.getElementById("client-discover-map")) return;
          ymaps.ready(() => {
            if (clientDiscoverMapRef.current) return;
            const map = new ymaps.Map("client-discover-map", {
              center: [55.751244, 37.618423],
              zoom: 10,
              controls: ["zoomControl", "fullscreenControl", "geolocationControl"],
            });
            clientDiscoverMapRef.current = map;
            if (!map._vmesteZoomBound) {
              map._vmesteZoomBound = true;
              map.events.add("boundschange", () => {
                if (clientDiscoverMapZoomTimerRef.current) {
                  window.clearTimeout(clientDiscoverMapZoomTimerRef.current);
                }
                clientDiscoverMapZoomTimerRef.current = window.setTimeout(() => {
                  if (clientDiscoverMapRef.current) {
                    paintClientDiscoverMapMarkers(allLocationsRef.current, { fitView: false });
                  }
                }, 160);
              });
            }
            paintClientDiscoverMapMarkers(allLocationsRef.current, { fitView: true });
          });
        })
        .catch(() => {});
    }, 280);
    return () => {
      clearTimeout(t);
      destroyClientDiscoverMap();
    };
  }, [currentView, me?.role]);

  useEffect(() => {
    if (currentView !== "client_map" || me?.role !== "client") return undefined;
    const id = window.setInterval(() => setMapMarkersTick((t) => t + 1), 60000);
    return () => window.clearInterval(id);
  }, [currentView, me?.role]);

  useEffect(() => {
    if (currentView !== "client_map" || me?.role !== "client" || !clientDiscoverMapRef.current) return;
    paintClientDiscoverMapMarkers(allLocations, { fitView: true });
  }, [allLocations, currentView, me?.role]);

  useEffect(() => {
    if (currentView !== "client_map" || me?.role !== "client" || !clientDiscoverMapRef.current) return;
    paintClientDiscoverMapMarkers(allLocations, { fitView: false });
  }, [mapMarkersTick, currentView, me?.role]);

  useEffect(() => {
    currentViewRef.current = currentView;
  }, [currentView]);

  useEffect(() => {
    meRef.current = me;
  }, [me]);

  useLayoutEffect(() => {
    try {
      localStorage.setItem(APP_THEME_KEY, appTheme);
    } catch {
      // ignore
    }
    document.documentElement.setAttribute("data-theme", appTheme);
    document.body.classList.toggle("theme-dark", appTheme === "dark");
  }, [appTheme]);

  useEffect(() => {
    if (!accessToken || currentView === "chats") return;
    const canPoll =
      me?.role === "provider" ||
      (me?.role === "staff" && (staffEffectivePerms.manage_chats || staffEffectivePerms.manage_client_chats));
    if (!canPoll) return;
    let cancelled = false;
    async function poll() {
      const res = await authFetch(`${API_URL}/chat/conversations/`);
      if (cancelled || !res.ok) return;
      const list = await res.json();
      const myId = Number(meRef.current?.id);
      if (currentViewRef.current !== "chats" && digestPrimedRef.current) {
        const prev = lastConvMsgDigestRef.current;
        for (const c of list) {
          const mid = c.last_message?.id;
          const senderId = c.last_message?.sender_id != null ? Number(c.last_message.sender_id) : null;
          if (!mid || prev[c.id] === mid) continue;
          if (senderId === myId) continue;
          let muted = false;
          try {
            const raw = localStorage.getItem(chatNotifyStorageKey(c.id));
            const st = raw ? JSON.parse(raw) : {};
            if (st.muted) muted = true;
            if (st.mutedUntil && Date.now() < Number(st.mutedUntil)) muted = true;
          } catch {
            // ignore
          }
          if (muted) continue;
          const title = (() => {
            try {
              const pr = localStorage.getItem(chatPrefsStorageKey(c.id));
              if (pr) {
                const p = JSON.parse(pr);
                if (p.title?.trim()) return p.title.trim();
              }
            } catch {
              // ignore
            }
            if (c.is_saved_messages) return "Избранное";
            const peer = conversationOrgDirectPeerTitle(c, myId);
            if (peer) return peer;
            return c.title || `Чат #${c.id}`;
          })();
          const text = (c.last_message?.text || "").slice(0, 140);
          const toastId = `${c.id}-${mid}-${Date.now()}`;
          setIncomingToasts((t) => [...t, { id: toastId, convId: c.id, title, text, fade: false }]);
          setTimeout(() => {
            setIncomingToasts((t) => t.map((x) => (x.id === toastId ? { ...x, fade: true } : x)));
          }, 12000);
          setTimeout(() => {
            setIncomingToasts((t) => t.filter((x) => x.id !== toastId));
          }, 12600);
        }
      }
      digestPrimedRef.current = true;
      lastConvMsgDigestRef.current = list.reduce((acc, c) => {
        acc[c.id] = c.last_message?.id ?? null;
        return acc;
      }, {});
      setConversations(list);
    }
    poll();
    const id = setInterval(poll, 6000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [accessToken, currentView, me?.role, me?.id, staffEffectivePerms.manage_chats]);

  useEffect(() => {
    if (showAuthModal && authMode === "register" && form.role === "provider") initMap();
  }, [showAuthModal, authMode, registerStep, form.role]);

  useEffect(() => {
    if (showAuthModal && authMode === "register" && form.role === "provider" && registerStep === 2) {
      detectCityByGeolocation();
    }
  }, [showAuthModal, authMode, form.role, registerStep]);

  useEffect(() => {
    if (me?.role !== "provider" || !me?.id) {
      setSavedIntervals([]);
      setSelectedIntervalId(null);
      closeIntervalPopover();
      return;
    }
    const key = savedIntervalsStorageKey(me.id);
    try {
      const raw = localStorage.getItem(key);
      setSavedIntervals(raw ? JSON.parse(raw) : []);
    } catch {
      setSavedIntervals([]);
    }
    setSelectedIntervalId(null);
    closeIntervalPopover();
  }, [me?.id, me?.role, closeIntervalPopover]);

  useEffect(() => {
    if (me?.role !== "provider" || !me?.id) return;
    const key = savedIntervalsStorageKey(me.id);
    try {
      localStorage.setItem(key, JSON.stringify(savedIntervals));
    } catch {
      // Ignore storage quota/access errors.
    }
  }, [savedIntervals, me?.id, me?.role]);

  useEffect(() => {
    if (currentView !== "services" || me?.role !== "provider") return;
    setServiceDrafts((prev) => {
      const next = { ...prev };
      for (const s of services) {
        if (!next[s.id]) next[s.id] = buildServiceDraftFromService(s);
      }
      for (const id of Object.keys(next)) {
        if (!services.some((s) => String(s.id) === String(id))) delete next[id];
      }
      return next;
    });
  }, [services, currentView, me?.role]);

  useEffect(() => {
    if (selectedIntervalId && !savedIntervals.some((x) => x.id === selectedIntervalId)) {
      setSelectedIntervalId(null);
    }
    if (intervalPopoverId && !savedIntervals.some((x) => x.id === intervalPopoverId)) {
      closeIntervalPopover();
    }
  }, [savedIntervals, selectedIntervalId, intervalPopoverId, closeIntervalPopover]);

  async function loadRoles() {
    const response = await fetch(`${API_URL}/users/roles/`);
    if (response.ok) setRoles(await response.json());
  }

  async function loadSpheres() {
    const response = await fetch(`${API_URL}/users/spheres/`);
    if (response.ok) setSpheres(await response.json());
  }

  async function handleVerifyEmailFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const isVerifyPath = window.location.pathname.includes("/verify-email");
    const token = params.get("verify_email") || (isVerifyPath ? params.get("token") : "");
    if (!token) return;
    const response = await fetch(`${API_URL}/users/verify-email/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    setVerifyStatus(response.ok ? "Email подтвержден. Теперь можно войти." : "Ссылка подтверждения недействительна.");
    if (response.ok) {
      setAuthMode("login");
      setShowAuthModal(true);
      window.history.replaceState({}, document.title, "/");
    }
  }

  async function handleConfirmPasswordChangeFromUrl() {
    if (!window.location.pathname.includes("/confirm-password-change")) return;
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) return;
    const response = await fetch(`${API_URL}/users/confirm-password-change/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await response.json().catch(() => ({}));
    const detail = data.detail || (response.ok
      ? "Пароль изменён. Теперь можно войти."
      : "Ссылка подтверждения недействительна.");
    setVerifyStatus(detail);
    setAuthStatus(detail);
    if (response.ok) {
      window.history.replaceState({}, document.title, "/");
    }
    openAuth("login");
  }

  async function refreshAccessToken() {
    if (!refreshToken) return null;
    const response = await fetch(REFRESH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    });
    if (!response.ok) {
      logout();
      return null;
    }
    const data = await response.json();
    if (data.access) {
      setAccessToken(data.access);
      localStorage.setItem("vmeste_access", data.access);
    }
    if (data.refresh) {
      setRefreshToken(data.refresh);
      localStorage.setItem("vmeste_refresh", data.refresh);
    }
    return data.access;
  }

  async function authFetch(url, options = {}) {
    const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
    const doRequest = async (tokenValue) => {
      const headers = {
        Authorization: `Bearer ${tokenValue}`,
        ...(options.headers || {}),
      };
      if (!isFormData && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
      }
      return fetch(url, { ...options, headers });
    };

    let response = await doRequest(accessToken);
    if (response.status !== 401) return response;
    const newToken = await refreshAccessToken();
    if (!newToken) return response;
    response = await doRequest(newToken);
    return response;
  }

  async function loadMe() {
    const response = await authFetch(`${API_URL}/users/me/`);
    if (response.ok) setMe(await response.json());
  }

  async function onLogin(event) {
    event.preventDefault();
    setAuthStatus("Входим...");
    const response = await fetch(AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(loginForm),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const msg = error.detail || (typeof error === "object" && error.non_field_errors?.[0]) || "Ошибка входа.";
      setAuthStatus(typeof msg === "string" ? msg : "Ошибка входа.");
      return;
    }
    const data = await response.json();
    setAccessToken(data.access);
    setRefreshToken(data.refresh);
    localStorage.setItem("vmeste_access", data.access);
    localStorage.setItem("vmeste_refresh", data.refresh);
    setAuthStatus("Вход выполнен.");
    setShowAuthModal(false);
  }

  function logout() {
    localStorage.removeItem("vmeste_access");
    localStorage.removeItem("vmeste_refresh");
    setAccessToken("");
    setRefreshToken("");
    setMe(null);
    clientMeBootstrappedRef.current = false;
    setCurrentView("bookings");
    setAuthStatus("Вы вышли.");
    resetPushRegistration();
  }

  async function onSubmit(event) {
    event.preventDefault();
    setAuthStatus("");
    if (form.password !== form.password_confirm) {
      setStatus("Пароли не совпадают.");
      return;
    }
    setStatus("Сохраняем...");
    const payload = {
      ...form,
      organization_address: simplifyCommaAddressLine(form.organization_address.trim()) || form.organization_address.trim(),
    };
    const response = await fetch(`${API_URL}/users/register/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (error.email) {
        setStatus(Array.isArray(error.email) ? error.email[0] : error.email);
      } else if (error.username) {
        setStatus(Array.isArray(error.username) ? error.username[0] : error.username);
      } else {
        setStatus(error.detail || "Проверь поля регистрации.");
      }
      return;
    }
    const data = await response.json().catch(() => ({}));
    const savedUsername = form.username;
    const savedPassword = form.password;
    const savedEmail = form.email;
    setForm(emptyRegisterForm);
    setRegisterStep(1);
    setLoginForm({ username: savedUsername, password: savedPassword });
    setVerifyEmailNotice({
      email: savedEmail,
      detail:
        data.detail || "Регистрация успешна. Проверьте почту для подтверждения email.",
    });
    setResendStatus("");
    setStatus("");
    setAuthMode("login");
  }

  function continueProviderRegistration() {
    const requiredFields = [
      ["Фамилия", form.last_name],
      ["Имя", form.first_name],
      ["Логин", form.username],
      ["Email", form.email],
      ["Пароль", form.password],
    ];
    const missing = requiredFields.find(([, value]) => !String(value || "").trim());
    if (missing) {
      setAuthStatus(`Заполните поле «${missing[0]}».`);
      return;
    }
    if (form.password !== form.password_confirm) {
      setAuthStatus("Пароли не совпадают.");
      return;
    }
    setAuthStatus("");
    setRegisterStep(2);
  }

  async function resendVerification() {
    setResendStatus("Отправляем письмо...");
    const email = me?.email || verifyEmailNotice?.email || form.email || "";
    await resendVerificationForEmail(email);
  }

  function destroyRegMap() {
    if (mapRef.current) {
      try {
        mapRef.current.destroy();
      } catch {
        // ignore map cleanup errors
      }
    }
    mapRef.current = null;
    placemarkRef.current = null;
  }

  function initMap() {
    const mapElement = document.getElementById("reg-map");
    if (!mapElement) {
      if (mapRef.current) destroyRegMap();
      return;
    }
    if (mapRef.current) return;
    const centerLat = Number(form.organization_latitude);
    const centerLon = Number(form.organization_longitude);
    const hasPoint = Number.isFinite(centerLat) && Number.isFinite(centerLon);
    void loadYandexMaps()
      .then(() => {
        const ymaps = window.ymaps;
        if (!ymaps || mapRef.current) return;
        ymaps.ready(() => {
          const currentMapElement = document.getElementById("reg-map");
          if (!currentMapElement) {
            if (mapRef.current) destroyRegMap();
            return;
          }
          if (mapRef.current) return;
          const center = hasPoint ? [centerLat, centerLon] : [55.751244, 37.618423];
          const hadPin =
            Boolean(String(form.organization_address || "").trim()) ||
            (hasPoint &&
              !(
                Math.abs(centerLat - 55.751244) < 1e-6 &&
                Math.abs(centerLon - 37.618423) < 1e-6
              ));
          const map = new ymaps.Map(currentMapElement, {
            center,
            zoom: hadPin ? 14 : 11,
          });
          mapRef.current = map;
          if (hadPin) {
            placemarkRef.current = new ymaps.Placemark(center);
            map.geoObjects.add(placemarkRef.current);
          }
          map.events.add("click", (e) => {
            const coords = e.get("coords");
            const [lat, lon] = coords;
            reverseGeocodeByCoords(lat, lon).then((result) => {
              const shortAddress = buildShortAddress(result?.address);
              const city = getCity(result?.address);
              setForm((prev) => ({
                ...prev,
                organization_latitude: lat.toFixed(6),
                organization_longitude: lon.toFixed(6),
                organization_address: simplifyCommaAddressLine(
                  shortAddress || result?.display_name || prev.organization_address
                ),
              }));
              if (city) setDetectedCity(city);
            });
            if (!placemarkRef.current) {
              placemarkRef.current = new ymaps.Placemark(coords);
              mapRef.current.geoObjects.add(placemarkRef.current);
            } else {
              placemarkRef.current.geometry.setCoordinates(coords);
            }
          });
        });
      })
      .catch(() => {});
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

  async function reverseGeocodeByCoords(lat, lon) {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`,
      { headers: NOMINATIM_HEADERS }
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data || null;
  }

  function federalCityFromReverse(addressObj) {
    if (!addressObj) return "";
    const st = String(addressObj.state || "").toLowerCase();
    if (["москва", "moscow"].some((x) => st.includes(x))) return "Москва";
    if (["санкт-петербург", "saint petersburg", "st petersburg", "петербург"].some((x) => st.includes(x))) {
      return "Санкт-Петербург";
    }
    return "";
  }

  async function nominatimSearchRU(q, limit = 8) {
    const params = new URLSearchParams({
      format: "json",
      addressdetails: "1",
      limit: String(limit),
      countrycodes: "ru",
      q: q.trim(),
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: NOMINATIM_HEADERS,
    });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  /** Подсказки при вводе: Photon (разрешён для autocomplete). Nominatim с клиента для autocomplete запрещён политикой OSM. */

  async function photonSuggestSearch(q, limit = 10) {
    const trimmed = (q || "").trim();
    if (trimmed.length < 2) return [];
    const params = new URLSearchParams({
      q: trimmed,
      limit: String(limit),
    });
    try {
      const response = await fetch(`https://photon.komoot.io/api/?${params}`, {
        headers: {
          Accept: "application/json",
          "Accept-Language": "ru-RU, ru;q=0.9, en;q=0.8",
        },
      });
      if (!response.ok) return [];
      const data = await response.json();
      const features = Array.isArray(data?.features) ? data.features : [];
      const seen = new Set();
      const out = [];
      for (const f of features) {
        const item = mapPhotonFeatureToSuggestion(f);
        if (!item || seen.has(item.value)) continue;
        seen.add(item.value);
        out.push(item);
        if (out.length >= limit) break;
      }
      return out;
    } catch {
      return [];
    }
  }

  function mapNominatimToSuggestions(data) {
    return data.map((item) => ({
      value: simplifyCommaAddressLine(buildShortAddress(item.address) || item.display_name || ""),
      full: item.display_name,
      lat: Number(item.lat),
      lon: Number(item.lon),
      city: getCity(item.address),
    }));
  }

  function buildNominatimQuery(trimmed, cityHint) {
    if (!trimmed) return "";
    const ru = ", Россия";
    const withRu = trimmed.toLowerCase().includes("росси") ? trimmed : `${trimmed}${ru}`;
    if (cityHint) {
      const lower = trimmed.toLowerCase();
      const ch = cityHint.toLowerCase();
      if (lower.includes(ch)) return withRu;
      const words = trimmed.split(/\s+/).filter(Boolean).length;
      if (/^\d/.test(trimmed) || words <= 4) return `${cityHint}, ${trimmed}`;
    }
    return withRu;
  }

  function geocodeResultLabel(obj) {
    if (!obj) return "";
    if (typeof obj.getAddressLine === "function") {
      const a = obj.getAddressLine();
      if (a) return String(a).trim();
    }
    if (obj.properties && typeof obj.properties.get === "function") {
      const meta = obj.properties.get("GeocoderMetaData");
      if (meta && typeof meta.get === "function") {
        const t = meta.get("text");
        if (t) return String(t).trim();
      }
      const t2 =
        obj.properties.get("text") || obj.properties.get("name") || obj.properties.get("description");
      if (t2) return String(t2).trim();
    }
    return "";
  }

  function geocodeResultCoords(obj) {
    const coords = obj?.geometry?.getCoordinates?.();
    if (!coords || coords.length < 2) return null;
    let lat = Number(coords[0]);
    let lon = Number(coords[1]);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
    if (Math.abs(lat) > 90) {
      const t = lat;
      lat = lon;
      lon = t;
    }
    return { lat, lon };
  }

  function ymapsReadyPromise(ymaps) {
    return new Promise((resolve, reject) => {
      try {
        // API передаёт namespace в successCallback; первый аргумент — НЕ ошибка.
        ymaps.ready(() => resolve(), (err) => reject(err || new Error("ymaps.ready")));
      } catch (e) {
        reject(e);
      }
    });
  }

  function ymapsGeocodePromise(ymaps, query, options) {
    const g = ymaps.geocode(query, options);
    if (g && typeof g.then === "function") {
      return new Promise((resolve, reject) => {
        g.then(resolve, reject);
      });
    }
    return Promise.resolve(g);
  }

  function geoObjectsToArray(coll) {
    if (!coll) return [];
    const n = typeof coll.getLength === "function" ? coll.getLength() : 0;
    if (n > 0 && typeof coll.get === "function") {
      const out = [];
      for (let i = 0; i < n; i += 1) out.push(coll.get(i));
      return out;
    }
    if (typeof coll.each === "function") {
      const out = [];
      coll.each((obj) => {
        out.push(obj);
      });
      return out;
    }
    return [];
  }

  async function yandexGeocodeSuggestItems(trimmed, cityHint) {
    const ymaps = window.ymaps;
    if (!ymaps || !trimmed) return null;
    try {
      await ymapsReadyPromise(ymaps);
    } catch {
      return null;
    }

    const queries = [];
    const pushQ = (q) => {
      const t = (q || "").trim();
      if (!t || queries.includes(t)) return;
      queries.push(t);
    };

    pushQ(buildNominatimQuery(trimmed, cityHint));
    if (cityHint) pushQ(`${cityHint}, ${trimmed}`);
    const withRu = trimmed.toLowerCase().includes("росси") ? trimmed : `${trimmed}, Россия`;
    pushQ(withRu);
    pushQ(trimmed);

    const items = [];
    const seenLines = new Set();

    for (const q of queries) {
      try {
        const res = await ymapsGeocodePromise(ymaps, q, { results: 10 });
        const coll = res?.geoObjects;
        const objs = geoObjectsToArray(coll);
        for (const obj of objs) {
          const label = geocodeResultLabel(obj);
          const display = simplifyCommaAddressLine(label);
          if (!display || seenLines.has(display.toLowerCase())) continue;
          const pos = geocodeResultCoords(obj);
          if (!pos) continue;
          seenLines.add(display.toLowerCase());
          let locCity = cityHint || "";
          if (!locCity && typeof obj.getLocalities === "function") {
            const loc = obj.getLocalities();
            if (Array.isArray(loc) && loc.length) [locCity] = loc;
          }
          items.push({
            value: display,
            full: display,
            lat: pos.lat,
            lon: pos.lon,
            city: locCity || "",
          });
          if (items.length >= 8) return items;
        }
      } catch {
        // try next query variant
      }
      if (items.length >= 8) break;
    }

    return items.length ? items : null;
  }

  /**
   * Подсказки Яндекс.Карт через Geosuggest (ymaps.suggest) — как в поиске на карте.
   * Нужен ключ VITE_YANDEX_SUGGEST_API_KEY и подключение скрипта с suggest_apikey (см. main.jsx).
   * Координаты подтягиваются отдельным геокодированием по полю value подсказки.
   */
  async function yandexMapsNativeSuggestItems(trimmed, cityHint) {
    if (!import.meta.env.VITE_YANDEX_SUGGEST_API_KEY) return null;
    const ymaps = window.ymaps;
    if (!ymaps || !trimmed || typeof ymaps.suggest !== "function") return null;
    try {
      await ymapsReadyPromise(ymaps);
    } catch {
      return null;
    }

    const q = cityHint ? `${cityHint}, ${trimmed}` : trimmed;
    let raw;
    try {
      raw = await ymaps.suggest(q, { results: 10 });
    } catch {
      return null;
    }
    if (!Array.isArray(raw) || !raw.length) return null;

    const rows = await Promise.all(
      raw.slice(0, 10).map(async (it) => {
        const geoQuery = String(it.value || it.displayName || "").trim();
        if (!geoQuery) return null;
        try {
          const res = await ymapsGeocodePromise(ymaps, geoQuery, { results: 1 });
          const objs = geoObjectsToArray(res?.geoObjects);
          const obj = objs[0];
          if (!obj) return null;
          const pos = geocodeResultCoords(obj);
          if (!pos) return null;
          const display = simplifyCommaAddressLine(
            (it.displayName && String(it.displayName).trim()) || geocodeResultLabel(obj) || geoQuery
          );
          if (!display) return null;
          let locCity = cityHint || "";
          if (!locCity && typeof obj.getLocalities === "function") {
            const loc = obj.getLocalities();
            if (Array.isArray(loc) && loc.length) [locCity] = loc;
          }
          return { value: display, full: display, lat: pos.lat, lon: pos.lon, city: locCity || "" };
        } catch {
          return null;
        }
      })
    );

    const out = [];
    const seen = new Set();
    for (const row of rows) {
      if (!row) continue;
      const k = row.value.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(row);
      if (out.length >= 8) break;
    }
    return out.length ? out : null;
  }

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
        await loadYandexMaps().catch(() => {});
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

  function destroyProfileMap() {
    if (profileMapRef.current) {
      try {
        profileMapRef.current.destroy();
      } catch (_e) {
        // ignore destroy errors
      }
      profileMapRef.current = null;
    }
    profilePlacemarkRef.current = null;
  }

  function destroyClientDiscoverMap() {
    if (clientDiscoverMapRef.current) {
      try {
        clientDiscoverMapRef.current.destroy();
      } catch (_e) {
        // ignore
      }
      clientDiscoverMapRef.current = null;
    }
    clientDiscoverMapClickBoundRef.current = false;
    if (clientDiscoverMapZoomTimerRef.current) {
      window.clearTimeout(clientDiscoverMapZoomTimerRef.current);
      clientDiscoverMapZoomTimerRef.current = null;
    }
    resetOrgPinLayoutClass();
  }

  function paintClientDiscoverMapMarkers(locations, { fitView = false } = {}) {
    const ymaps = window.ymaps;
    const map = clientDiscoverMapRef.current;
    if (!ymaps || !map || !Array.isArray(locations)) return;
    if (!clientDiscoverMapClickBoundRef.current) {
      clientDiscoverMapClickBoundRef.current = true;
      map.geoObjects.events.add("click", (e) => {
        const target = e.get("target");
        const loc = target?.properties?.get?.("vmesteLoc");
        if (loc) openOrgOnMap(loc);
      });
    }
    const zoom = map.getZoom();
    map.geoObjects.removeAll();
    const coordsList = [];
    for (const loc of locations) {
      const lat = Number(loc.latitude);
      const lon = Number(loc.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const pm = buildYmapOrgPlacemark(ymaps, loc, () => {
        openOrgOnMap(loc);
      }, new Date(), zoom);
      map.geoObjects.add(pm);
      coordsList.push([lat, lon]);
    }
    if (!fitView) return;
    if (coordsList.length === 1) {
      map.setCenter(coordsList[0], 14);
    } else if (coordsList.length > 1) {
      map.setBounds(ymaps.util.bounds.fromPoints(coordsList), { checkZoomRange: true, zoomMargin: 52 });
    } else {
      map.setCenter([55.751244, 37.618423], 10);
    }
  }

  function initProfileMapFromCoords(lat, lon) {
    if (profileMapRef.current) return;
    void loadYandexMaps()
      .then(() => {
        const ymaps = window.ymaps;
        if (!ymaps || profileMapRef.current) return;
        ymaps.ready(() => {
          if (profileMapRef.current || !document.getElementById("profile-address-map")) return;
          profileMapRef.current = new ymaps.Map("profile-address-map", {
            center: [lat, lon],
            zoom: 14,
          });
          profilePlacemarkRef.current = new ymaps.Placemark([lat, lon]);
          profileMapRef.current.geoObjects.add(profilePlacemarkRef.current);
          profileMapRef.current.events.add("click", (e) => {
            const coords = e.get("coords");
            const plat = coords[0];
            const plon = coords[1];
            reverseGeocodeByCoords(plat, plon).then((result) => {
              const shortAddress = buildShortAddress(result?.address);
              const city = getCity(result?.address);
              setOrgAddressForm((p) => ({
                ...p,
                organization_latitude: plat.toFixed(6),
                organization_longitude: plon.toFixed(6),
                organization_address: simplifyCommaAddressLine(
                  shortAddress || result?.display_name || p.organization_address
                ),
              }));
              if (city) setDetectedCity(city);
            });
            if (profilePlacemarkRef.current) {
              profilePlacemarkRef.current.geometry.setCoordinates(coords);
            }
          });
        });
      })
      .catch(() => {});
  }

  function destroyBranchDetailMap() {
    if (branchDetailMapRef.current) {
      try {
        branchDetailMapRef.current.destroy();
      } catch (_e) {
        // ignore
      }
      branchDetailMapRef.current = null;
    }
    branchDetailPlacemarkRef.current = null;
  }

  function destroyBranchEditMap() {
    if (branchEditMapRef.current) {
      try {
        branchEditMapRef.current.destroy();
      } catch (_e) {
        // ignore
      }
      branchEditMapRef.current = null;
    }
    branchEditPlacemarkRef.current = null;
  }

  function destroyBranchAddMap() {
    if (branchAddMapRef.current) {
      try {
        branchAddMapRef.current.destroy();
      } catch (_e) {
        // ignore
      }
      branchAddMapRef.current = null;
    }
    branchAddPlacemarkRef.current = null;
  }

  function initBranchDetailMapFromCoords(lat, lon) {
    void loadYandexMaps()
      .then(() => {
        const ymaps = window.ymaps;
        if (!ymaps) return;
        ymaps.ready(() => {
          if (!document.getElementById("branch-detail-map")) return;
          destroyBranchDetailMap();
          branchDetailMapRef.current = new ymaps.Map("branch-detail-map", {
            center: [lat, lon],
            zoom: 14,
          });
          branchDetailPlacemarkRef.current = new ymaps.Placemark([lat, lon]);
          branchDetailMapRef.current.geoObjects.add(branchDetailPlacemarkRef.current);
        });
      })
      .catch(() => {});
  }

  function initBranchEditMapFromCoords(lat, lon) {
    void loadYandexMaps()
      .then(() => {
        const ymaps = window.ymaps;
        if (!ymaps) return;
        ymaps.ready(() => {
          if (!document.getElementById("branch-edit-map")) return;
          destroyBranchEditMap();
          branchEditMapRef.current = new ymaps.Map("branch-edit-map", {
            center: [lat, lon],
            zoom: 14,
          });
          branchEditPlacemarkRef.current = new ymaps.Placemark([lat, lon]);
          branchEditMapRef.current.geoObjects.add(branchEditPlacemarkRef.current);
          branchEditMapRef.current.events.add("click", (e) => {
            const coords = e.get("coords");
            const plat = coords[0];
            const plon = coords[1];
            reverseGeocodeByCoords(plat, plon).then((result) => {
              const shortAddress = buildShortAddress(result?.address);
              const city = getCity(result?.address);
              setLocationForm((prev) => {
                const addr = simplifyCommaAddressLine(
                  shortAddress || result?.display_name || prev.address
                );
                return {
                  ...prev,
                  latitude: plat.toFixed(6),
                  longitude: plon.toFixed(6),
                  address: addr,
                };
              });
              if (city) setDetectedCity(city);
            });
            if (branchEditPlacemarkRef.current) {
              branchEditPlacemarkRef.current.geometry.setCoordinates(coords);
            }
          });
        });
      })
      .catch(() => {});
  }

  function initBranchAddMapFromCoords(lat, lon) {
    void loadYandexMaps()
      .then(() => {
        const ymaps = window.ymaps;
        if (!ymaps) return;
        ymaps.ready(() => {
          if (!document.getElementById("branch-add-map")) return;
          destroyBranchAddMap();
          branchAddMapRef.current = new ymaps.Map("branch-add-map", {
            center: [lat, lon],
            zoom: 14,
          });
          branchAddPlacemarkRef.current = new ymaps.Placemark([lat, lon]);
          branchAddMapRef.current.geoObjects.add(branchAddPlacemarkRef.current);
          branchAddMapRef.current.events.add("click", (e) => {
            const coords = e.get("coords");
            const plat = coords[0];
            const plon = coords[1];
            reverseGeocodeByCoords(plat, plon).then((result) => {
              const shortAddress = buildShortAddress(result?.address);
              const city = getCity(result?.address);
              setLocationForm((prev) => {
                const addr = simplifyCommaAddressLine(
                  shortAddress || result?.display_name || prev.address
                );
                return {
                  ...prev,
                  latitude: plat.toFixed(6),
                  longitude: plon.toFixed(6),
                  address: addr,
                };
              });
              if (city) setDetectedCity(city);
            });
            if (branchAddPlacemarkRef.current) {
              branchAddPlacemarkRef.current.geometry.setCoordinates(coords);
            }
          });
        });
      })
      .catch(() => {});
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

  function getCity(addressObj) {
    if (!addressObj) return "";
    return (
      addressObj.city ||
      addressObj.town ||
      addressObj.village ||
      addressObj.hamlet ||
      addressObj.municipality ||
      addressObj.city_district ||
      addressObj.suburb ||
      addressObj.quarter ||
      addressObj.state_district ||
      ""
    );
  }

  function buildShortAddress(addressObj) {
    if (!addressObj) return "";
    const road =
      addressObj.road ||
      addressObj.pedestrian ||
      addressObj.footway ||
      addressObj.path ||
      addressObj.residential ||
      addressObj.neighbourhood ||
      addressObj.quarter ||
      "";
    const house = addressObj.house_number || "";
    const building = [addressObj.block, addressObj.building, addressObj.construction].filter(Boolean).join(" ");
    return [road, house, building].filter(Boolean).join(", ");
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

  function composeAddressWithDetails(baseAddress, sourceForm = form) {
    const tail = composePipeTailFromDetails({
      entrance: sourceForm.entrance,
      floor: sourceForm.floor,
      apartment: sourceForm.apartment,
      intercom: sourceForm.intercom,
      extra: sourceForm.organization_address_details,
    });
    return tail ? `${baseAddress} | ${tail}` : baseAddress;
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
    if (catRes.ok) setCategories(await catRes.json());
    if (servRes.ok) setServices(await servRes.json());
    if (slotRes.ok) setSlots(await slotRes.json());
    if (bookingRes.ok) setBookings(normalizeBookingsList(await bookingRes.json()));
    if (locRes.ok) setLocation(await locRes.json());
    if (staffRes.ok) setOrgStaff(await staffRes.json());
  }

  useEffect(() => {
    if ((currentView !== "profile" && currentView !== "organization") || me?.role !== "provider") {
      destroyProfileMap();
      return;
    }
    const lat = Number(orgAddressForm.organization_latitude) || 55.751244;
    const lon = Number(orgAddressForm.organization_longitude) || 37.618423;
    const t = setTimeout(() => {
      destroyProfileMap();
      initProfileMapFromCoords(lat, lon);
    }, 200);
    return () => {
      clearTimeout(t);
      destroyProfileMap();
    };
  }, [currentView, me?.role, orgAddressForm.organization_latitude, orgAddressForm.organization_longitude, orgMainEditOpen]);

  useEffect(() => {
    if (currentView !== "organization" || me?.role !== "provider") {
      destroyBranchDetailMap();
      return;
    }
    if (!selectedOrgBranchId || orgBranchAddOpen || orgBranchEditOpen) {
      destroyBranchDetailMap();
      return;
    }
    const br = location.find((l) => Number(l.id) === Number(selectedOrgBranchId));
    if (!br) {
      destroyBranchDetailMap();
      return;
    }
    const lat = Number(br.latitude);
    const lon = Number(br.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      destroyBranchDetailMap();
      return;
    }
    const t = setTimeout(() => {
      destroyBranchDetailMap();
      initBranchDetailMapFromCoords(lat, lon);
    }, 220);
    return () => {
      clearTimeout(t);
      destroyBranchDetailMap();
    };
  }, [currentView, me?.role, selectedOrgBranchId, orgBranchAddOpen, orgBranchEditOpen, location]);

  useEffect(() => {
    if (currentView !== "organization" || me?.role !== "provider" || !orgBranchEditOpen || !selectedOrgBranchId || orgBranchAddOpen) {
      destroyBranchEditMap();
      return;
    }
    const lat = Number(locationForm.latitude) || 55.751244;
    const lon = Number(locationForm.longitude) || 37.618423;
    const t = setTimeout(() => {
      destroyBranchEditMap();
      initBranchEditMapFromCoords(lat, lon);
    }, 220);
    return () => {
      clearTimeout(t);
      destroyBranchEditMap();
    };
  }, [currentView, me?.role, orgBranchEditOpen, selectedOrgBranchId, orgBranchAddOpen, locationForm.latitude, locationForm.longitude]);

  useEffect(() => {
    if (currentView !== "organization" || me?.role !== "provider" || !orgBranchAddOpen) {
      destroyBranchAddMap();
      return;
    }
    const lat = Number(locationForm.latitude) || 55.751244;
    const lon = Number(locationForm.longitude) || 37.618423;
    const t = setTimeout(() => {
      destroyBranchAddMap();
      initBranchAddMapFromCoords(lat, lon);
    }, 220);
    return () => {
      clearTimeout(t);
      destroyBranchAddMap();
    };
  }, [currentView, me?.role, orgBranchAddOpen, locationForm.latitude, locationForm.longitude]);

  async function loadStaffWorkspace() {
    const reqs = [
      authFetch(`${API_URL}/booking/staff/`),
      authFetch(`${API_URL}/chat/conversations/`),
      authFetch(`${API_URL}/booking/`),
    ];
    if (me?.role === "staff" && staffEffectivePerms.can_delegate_permissions) {
      reqs.push(authFetch(`${API_URL}/catalog/categories/`), authFetch(`${API_URL}/catalog/services/`));
    }
    const results = await Promise.all(reqs);
    if (results[0].ok) setOrgStaff(await results[0].json());
    if (results[1].ok) setConversations(await results[1].json());
    if (results[2].ok) setBookings(normalizeBookingsList(await results[2].json()));
    if (results[3]?.ok) setCategories(await results[3].json());
    if (results[4]?.ok) setServices(await results[4].json());
  }

  async function loadChats() {
    const res = await authFetch(`${API_URL}/chat/conversations/`);
    if (res.ok) setConversations(await res.json());
  }

  function togglePinChatForFolder(convId, folder) {
    const n = Number(convId);
    const key = folder === "clients" ? "clients" : "org";
    setChatPins((prev) => {
      const list = [...(prev[key] || [])].map(Number);
      const i = list.indexOf(n);
      if (i >= 0) {
        list.splice(i, 1);
        return { ...prev, [key]: list };
      }
      if (list.length >= MAX_PINNED_CHATS) {
        queueMicrotask(() => setChatStatus(`Не больше ${MAX_PINNED_CHATS} закреплённых чатов.`));
        return prev;
      }
      return { ...prev, [key]: [...list, n] };
    });
  }

  function reorderPinnedChats(folder, draggedId, targetId) {
    const a = Number(draggedId);
    const b = Number(targetId);
    if (!a || !b || a === b) return;
    const key = folder === "clients" ? "clients" : "org";
    setChatPins((prev) => {
      const list = [...(prev[key] || [])].map(Number);
      const fi = list.indexOf(a);
      const ti = list.indexOf(b);
      if (fi < 0 || ti < 0) return prev;
      list.splice(fi, 1);
      list.splice(ti, 0, a);
      return { ...prev, [key]: list };
    });
  }

  function scrollChatToMessageId(mid) {
    const el = document.getElementById(`tg-msg-${mid}`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    if (el) {
      el.classList.add("tg-msg--flash");
      window.setTimeout(() => el.classList.remove("tg-msg--flash"), 1600);
    }
  }

  function jumpToChatMessage(mid) {
    setChatInfoOpen(false);
    window.setTimeout(() => scrollChatToMessageId(mid), 80);
  }

  function openChatPhotosLightbox(items, index = 0) {
    if (!items?.length) return;
    setOrgPhotoLightbox({ items, index: Math.max(0, Math.min(index, items.length - 1)) });
  }

  async function loadChatActivity() {
    const res = await authFetch(`${API_URL}/chat/activity/`);
    if (res.ok) setChatActivity(await res.json());
  }

  async function acceptStaffInvite(linkId) {
    const res = await authFetch(`${API_URL}/booking/staff/${linkId}/accept-invite/`, { method: "POST", body: "{}" });
    if (!res.ok) {
      setChatStatus("Не удалось принять приглашение.");
      return;
    }
    setChatStatus("");
    loadChatActivity();
    loadMe();
    if (me?.role === "provider") loadSellerData();
    else loadStaffWorkspace();
  }

  async function rejectStaffInvite(linkId) {
    const res = await authFetch(`${API_URL}/booking/staff/${linkId}/reject-invite/`, { method: "POST", body: "{}" });
    if (!res.ok) {
      setChatStatus("Не удалось отклонить приглашение.");
      return;
    }
    setChatStatus("");
    loadChatActivity();
    loadMe();
    if (me?.role === "provider") loadSellerData();
    else loadStaffWorkspace();
  }

  async function markInAppNotificationsRead(ids) {
    if (!ids?.length) return;
    await authFetch(`${API_URL}/notifications/in-app/mark-read/`, {
      method: "POST",
      body: JSON.stringify({ ids }),
    });
    loadChatActivity();
  }

  function persistChatReceiptsMode(mode) {
    setChatReceiptsMode(mode);
    try {
      localStorage.setItem(CHAT_RECEIPTS_KEY, JSON.stringify({ mode }));
    } catch {
      // ignore
    }
  }

  async function inviteStaff(event) {
    event.preventDefault();
    setStaffInviteStatus("Добавляем...");
    const body = {};
    const idf = (staffInviteForm.invite_identifier || "").trim();
    if (idf) body.invite_identifier = idf;
    if (!body.invite_identifier) {
      setStaffInviteStatus("Укажи email или логин сотрудника.");
      return;
    }
    const response = await authFetch(`${API_URL}/booking/staff/`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = typeof err === "object" && err ? Object.values(err).flat().find(Boolean) : null;
      setStaffInviteStatus(msg || "Не удалось добавить сотрудника.");
      return;
    }
    setStaffInviteStatus("Приглашение отправлено. Сотрудник увидит запрос в чатах.");
    setStaffInviteForm({ invite_identifier: "" });
    loadSellerData();
    loadChatActivity();
  }

  async function deactivateStaff(linkId) {
    const response = await authFetch(`${API_URL}/booking/staff/${linkId}/`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: false }),
    });
    if (!response.ok) {
      setStaffInviteStatus("Не удалось отключить сотрудника.");
      return;
    }
    setStaffInviteStatus("Сотрудник отключён.");
    loadSellerData();
  }

  async function patchStaffMeta(linkId, patch) {
    const response = await authFetch(`${API_URL}/booking/staff/${linkId}/`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    if (!response.ok) {
      setStaffInviteStatus("Не удалось сохранить изменения.");
      return;
    }
    setStaffInviteStatus("Сохранено.");
    if (me?.role === "provider") loadSellerData();
    else loadStaffWorkspace();
  }

  async function createOrgGroup(event) {
    event.preventDefault();
    setChatStatus("");
    const staffIds = groupForm.staff_ids.map(Number);
    const response = await authFetch(`${API_URL}/chat/conversations/create-group/`, {
      method: "POST",
      body: JSON.stringify({ title: groupForm.title, staff_ids: staffIds }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      setChatStatus(err.detail || "Ошибка создания группы.");
      return;
    }
    setChatStatus("");
    setGroupForm({ title: "", staff_ids: [] });
    setChatFabOpen(false);
    loadChats();
  }

  async function openDirectChatWithStaff(staffId) {
    if (!staffId) return;
    setChatStatus("");
    const response = await authFetch(`${API_URL}/chat/conversations/create-direct/`, {
      method: "POST",
      body: JSON.stringify({ staff_id: Number(staffId) }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      setChatStatus(err.detail || "Ошибка.");
      return;
    }
    const conv = await response.json();
    await loadChats();
    setSelectedChatId(conv.id);
    setChatFabOpen(false);
  }

  function displayConversationTitle(conversation) {
    if (!conversation) return "";
    if (conversation.is_saved_messages) return "Избранное";
    const local = chatLocalPrefs[conversation.id];
    if (local?.title?.trim()) return local.title.trim();
    const clientPeer = conversationClientCorrespondenceTitle(conversation, me?.id, me?.role);
    if (clientPeer) return clientPeer;
    const peer = conversationOrgDirectPeerTitle(conversation, me?.id);
    if (peer) return peer;
    return conversation.title || `Чат #${conversation.id ?? ""}`;
  }

  function conversationAvatarLetter(conversation) {
    if (conversation?.is_saved_messages) return "★";
    return displayConversationTitle(conversation).slice(0, 1).toUpperCase();
  }

  async function patchStaffPermissions(linkId, permissions) {
    const response = await authFetch(`${API_URL}/booking/staff/${linkId}/`, {
      method: "PATCH",
      body: JSON.stringify({ permissions }),
    });
    if (!response.ok) {
      setStaffInviteStatus("Не удалось сохранить права.");
      return;
    }
    setStaffInviteStatus("Права обновлены.");
    if (me?.role === "provider") loadSellerData();
    else loadStaffWorkspace();
  }

  async function patchStaffServiceAssignment(linkId, serviceIds, categoryIds) {
    const response = await authFetch(`${API_URL}/booking/staff/${linkId}/`, {
      method: "PATCH",
      body: JSON.stringify({
        assigned_service_ids: serviceIds,
        assigned_category_ids: categoryIds,
      }),
    });
    if (!response.ok) {
      setStaffInviteStatus("Не удалось сохранить услуги сотрудника.");
      return;
    }
    setStaffInviteStatus("Услуги сотрудника обновлены.");
    if (me?.role === "provider") loadSellerData();
    else loadStaffWorkspace();
  }

  function toggleStaffPermission(link, key) {
    const merged = {
      manage_bookings: true,
      manage_intervals: false,
      manage_services: false,
      manage_chats: true,
      manage_staff: false,
      can_delegate_permissions: false,
      ...(link.permissions || {}),
    };
    const next = { ...merged, [key]: !merged[key] };
    patchStaffPermissions(link.id, next);
  }

  async function fetchChatMessagesPage(conversationId, { beforeId, afterId, limit = CHAT_MSG_PAGE_SIZE } = {}) {
    if (!conversationId) return null;
    const params = new URLSearchParams({
      conversation: String(conversationId),
      limit: String(limit),
    });
    if (beforeId) params.set("before_id", String(beforeId));
    if (afterId) params.set("after_id", String(afterId));
    const res = await authFetch(`${API_URL}/chat/messages/?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  function scrollChatToBottom(smooth = false) {
    const el = chatMessagesElRef.current;
    if (!el) return;
    chatNearBottomRef.current = true;
    setChatShowJumpBottom(false);
    if (smooth) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    else el.scrollTop = el.scrollHeight;
  }

  function updateChatScrollUi(el) {
    if (!el) return;
    const distBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distBottom < 100;
    chatNearBottomRef.current = nearBottom;
    setChatShowJumpBottom(!nearBottom && el.scrollHeight > el.clientHeight + 40);
    if (el.scrollTop < 72) {
      void loadOlderChatMessages();
    }
  }

  async function loadOlderChatMessages() {
    if (!selectedChatId || chatLoadingOlderRef.current || !chatHasMoreOlderRef.current) return;
    const oldest = chatMessagesRef.current[0];
    if (!oldest) return;
    chatLoadingOlderRef.current = true;
    setChatLoadingOlder(true);
    const el = chatMessagesElRef.current;
    const prevHeight = el?.scrollHeight || 0;
    const prevTop = el?.scrollTop || 0;
    try {
      const older = await fetchChatMessagesPage(selectedChatId, {
        beforeId: oldest.id,
        limit: CHAT_MSG_PAGE_SIZE,
      });
      if (!older) return;
      setChatHasMoreOlder(older.length >= CHAT_MSG_PAGE_SIZE);
      if (!older.length) return;
      setChatMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const add = older.filter((m) => !seen.has(m.id));
        return add.length ? [...add, ...prev] : prev;
      });
      requestAnimationFrame(() => {
        const box = chatMessagesElRef.current;
        if (!box) return;
        box.scrollTop = prevTop + (box.scrollHeight - prevHeight);
      });
    } finally {
      chatLoadingOlderRef.current = false;
      setChatLoadingOlder(false);
    }
  }

  async function refreshChatMessages(conversationId = selectedChatId) {
    if (!conversationId) return;
    const current = chatMessagesRef.current;
    const lastId = current.length ? current[current.length - 1].id : null;
    if (lastId && Number(conversationId) === Number(selectedChatId)) {
      const newer = await fetchChatMessagesPage(conversationId, {
        afterId: lastId,
        limit: CHAT_MSG_PAGE_SIZE,
      });
      if (newer?.length) {
        setChatMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const add = newer.filter((m) => !seen.has(m.id));
          return add.length ? [...prev, ...add] : prev;
        });
        requestAnimationFrame(() => scrollChatToBottom(true));
        const last = newer[newer.length - 1];
        await authFetch(`${API_URL}/chat/conversations/${conversationId}/mark-read/`, {
          method: "POST",
          body: JSON.stringify({ message_id: last.id }),
        });
        loadChats();
      }
      return;
    }
    const msgs = await fetchChatMessagesPage(conversationId, { limit: CHAT_MSG_PAGE_SIZE });
    if (!msgs) return;
    setChatMessages(msgs);
    setChatHasMoreOlder(msgs.length >= CHAT_MSG_PAGE_SIZE);
    requestAnimationFrame(() => scrollChatToBottom(false));
    const last = msgs.length ? msgs[msgs.length - 1] : null;
    if (last) {
      await authFetch(`${API_URL}/chat/conversations/${conversationId}/mark-read/`, {
        method: "POST",
        body: JSON.stringify({ message_id: last.id }),
      });
      loadChats();
    }
  }

  async function postChatMessage({ text = "", file = null, kind = "", durationSec = null, displayFlip = null }) {
    if (!selectedChatId) return false;
    const hasText = Boolean(String(text || "").trim());
    if (!hasText && !file) return false;
    let response;
    if (file) {
      const fd = new FormData();
      fd.append("conversation", String(selectedChatId));
      if (hasText) fd.append("text", String(text).trim());
      if (kind) fd.append("kind", kind);
      if (durationSec != null && Number(durationSec) > 0) {
        fd.append("duration_sec", String(Math.round(Number(durationSec))));
      }
      if (displayFlip != null) {
        fd.append("display_flip", displayFlip ? "true" : "false");
      }
      fd.append("attachment", file);
      response = await authFetch(`${API_URL}/chat/messages/`, { method: "POST", body: fd });
    } else {
      response = await authFetch(`${API_URL}/chat/messages/`, {
        method: "POST",
        body: JSON.stringify({ conversation: selectedChatId, text: String(text).trim(), kind: "text" }),
      });
    }
    if (!response.ok) {
      setChatStatus("Не удалось отправить сообщение.");
      return false;
    }
    setChatInput("");
    setChatPendingFiles([]);
    setChatPendingKind("");
    setChatStatus("");
    setChatAttachMenuOpen(false);
    await refreshChatMessages(selectedChatId);
    return true;
  }

  async function sendChatMessage(event) {
    event.preventDefault();
    if (chatPendingFiles.length) {
      const caption = chatInput.trim();
      const items = [...chatPendingFiles];
      setChatPendingFiles([]);
      setChatInput("");
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        await postChatMessage({
          text: i === 0 ? caption : "",
          file: item.file,
          kind: item.kind,
        });
      }
      return;
    }
    if (!chatInput.trim()) return;
    await postChatMessage({ text: chatInput.trim() });
  }

  function openChatAttachPicker(kind) {
    setChatPendingKind(kind);
    setChatAttachMenuOpen(false);
    const input = chatFileInputRef.current;
    if (!input) return;
    input.accept = guessAttachAccept(kind === "music" ? "music" : kind);
    input.multiple = true;
    input.value = "";
    input.click();
  }

  function onChatFilePicked(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const next = files.map((file) => {
      let kind = chatPendingKind;
      if (!kind || kind === "auto") {
        if (file.type.startsWith("image/")) kind = "image";
        else if (file.type.startsWith("video/")) kind = "video";
        else if (file.type.startsWith("audio/")) kind = "voice";
        else kind = "file";
      }
      if (kind === "music") kind = "file";
      return { file, kind };
    });
    setChatPendingFiles((prev) => [...prev, ...next]);
  }

  function toggleChatComposeMode() {
    const next = chatComposeMode === "voice" ? "video_note" : "voice";
    setChatComposeMode(next);
    saveChatComposeMode(next);
  }

  function clearChatRecordMeters() {
    if (chatRecordTickRef.current) {
      clearInterval(chatRecordTickRef.current);
      chatRecordTickRef.current = null;
    }
    if (chatLevelRafRef.current) {
      cancelAnimationFrame(chatLevelRafRef.current);
      chatLevelRafRef.current = null;
    }
    if (chatAudioCtxRef.current) {
      try {
        chatAudioCtxRef.current.close();
      } catch {
        /* ignore */
      }
      chatAudioCtxRef.current = null;
      chatAnalyserRef.current = null;
    }
    setChatRecordSecs(0);
    setChatRecordLevels(Array(24).fill(0.12));
    setChatRecordLiftHint(false);
  }

  function stopMirrorPipeline() {
    const pipe = chatMirrorPipelineRef.current;
    chatMirrorPipelineRef.current = null;
    if (!pipe) return;
    if (pipe.raf) {
      try {
        cancelAnimationFrame(pipe.raf);
      } catch {
        /* ignore */
      }
    }
    if (pipe.videoEl) {
      try {
        pipe.videoEl.srcObject = null;
      } catch {
        /* ignore */
      }
    }
    if (pipe.canvasStream) {
      try {
        pipe.canvasStream.getTracks().forEach((t) => t.stop());
      } catch {
        /* ignore */
      }
    }
  }

  async function buildChatRecordStream(cameraStream, mirror) {
    stopMirrorPipeline();
    if (!mirror || !cameraStream) return cameraStream;

    const videoEl = document.createElement("video");
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.setAttribute("playsinline", "true");
    videoEl.srcObject = cameraStream;
    await new Promise((resolve) => {
      const done = () => resolve();
      if (videoEl.readyState >= 1) done();
      else {
        videoEl.onloadedmetadata = done;
        window.setTimeout(done, 1200);
      }
    });
    await videoEl.play().catch(() => {});

    const size = 480;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { alpha: false });
    const pipe = { videoEl, canvas, canvasStream: null, raf: 0 };

    const draw = () => {
      const vw = videoEl.videoWidth || size;
      const vh = videoEl.videoHeight || size;
      if (vw > 0 && vh > 0 && ctx) {
        ctx.save();
        ctx.translate(size, 0);
        ctx.scale(-1, 1);
        const scale = Math.max(size / vw, size / vh);
        const dw = vw * scale;
        const dh = vh * scale;
        ctx.drawImage(videoEl, (size - dw) / 2, (size - dh) / 2, dw, dh);
        ctx.restore();
      }
      pipe.raf = requestAnimationFrame(draw);
    };
    draw();

    const canvasStream = canvas.captureStream(30);
    pipe.canvasStream = canvasStream;
    chatMirrorPipelineRef.current = pipe;

    return new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...cameraStream.getAudioTracks(),
    ]);
  }

  function attachLiveCameraPreview() {
    const stream = chatCameraStreamRef.current;
    const el = chatLiveVideoRef.current;
    if (!stream || !el) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }
    el.muted = true;
    el.playsInline = true;
    el.setAttribute("playsinline", "true");
    el.play?.().catch(() => {});
  }

  function stopChatRecordTracks() {
    stopMirrorPipeline();
    const recordStream = chatRecordStreamRef.current;
    chatRecordStreamRef.current = null;
    const cameraStream = chatCameraStreamRef.current;
    chatCameraStreamRef.current = null;
    if (recordStream) {
      try {
        recordStream.getTracks().forEach((t) => {
          // audio tracks may be shared with cameraStream — stop once via camera
          if (t.kind === "video") t.stop();
        });
      } catch {
        /* ignore */
      }
    }
    if (cameraStream) {
      try {
        cameraStream.getTracks().forEach((t) => t.stop());
      } catch {
        /* ignore */
      }
    }
    if (chatLiveVideoRef.current) {
      try {
        chatLiveVideoRef.current.srcObject = null;
      } catch {
        /* ignore */
      }
    }
  }

  function finishChatRecordingToPreview() {
    const chunks = chatRecordChunksRef.current.slice();
    const mime = chatRecordMimeRef.current || "application/octet-stream";
    const kind = chatRecordKindRef.current || "voice";
    const elapsed = Date.now() - chatRecordStartedAtRef.current;
    const facing = chatCameraFacingRef.current || "user";
    // Front camera is baked mirrored into the file via canvas — never CSS-flip again
    const fileMirrored = kind === "video_note" && facing === "user";
    chatMediaRecorderRef.current = null;
    chatRecordChunksRef.current = [];
    setChatRecordingKind(null);
    chatRecordLockedRef.current = false;
    setChatRecordLocked(false);
    clearChatRecordMeters();
    stopChatRecordTracks();
    if (elapsed < 400 || !chunks.length) {
      return;
    }
    const blob = new Blob(chunks, { type: mime });
    if (!blob.size) return;
    const url = URL.createObjectURL(blob);
    setChatMediaPreview({
      blob,
      url,
      kind: kind === "video_note" ? "video_note" : "voice",
      mime,
      durationSec: Math.max(1, Math.round(elapsed / 1000)),
      displayFlip: false,
      fileMirrored,
    });
  }

  function bindChatMediaRecorder(stream) {
    const mime = chatRecordMimeRef.current;
    const recorder = mime
      ? new MediaRecorder(stream, { mimeType: mime })
      : new MediaRecorder(stream);
    if (!mime && recorder.mimeType) chatRecordMimeRef.current = recorder.mimeType;
    chatMediaRecorderRef.current = recorder;
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chatRecordChunksRef.current.push(ev.data);
    };
    recorder.onstop = () => {
      if (chatKeepRecordingRef.current) {
        chatMediaRecorderRef.current = null;
        return;
      }
      finishChatRecordingToPreview();
    };
    recorder.start(250);
    return recorder;
  }

  async function stopChatRecorderPreserveChunks() {
    const rec = chatMediaRecorderRef.current;
    if (!rec || rec.state === "inactive") {
      chatMediaRecorderRef.current = null;
      return;
    }
    await new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        chatMediaRecorderRef.current = null;
        resolve();
      };
      rec.onstop = () => done();
      try {
        if (typeof rec.requestData === "function") rec.requestData();
        rec.stop();
      } catch {
        done();
      }
      window.setTimeout(done, 500);
    });
  }

  async function switchChatCamera() {
    if (chatRecordingKind !== "video_note" || chatCameraSwitching) return;
    const cameraStream = chatCameraStreamRef.current;
    if (!cameraStream) return;
    const wantFacing = chatCameraFacingRef.current === "user" ? "environment" : "user";
    setChatCameraSwitching(true);
    try {
      const oldVideo = cameraStream.getVideoTracks()[0] || null;
      const currentId = oldVideo?.getSettings?.().deviceId || "";
      const nextCam = await pickOtherVideoDevice(currentId, wantFacing);
      if (!nextCam?.deviceId) {
        setChatStatus("Вторая камера не найдена на этом устройстве.");
        return;
      }

      chatKeepRecordingRef.current = true;
      await stopChatRecorderPreserveChunks();
      stopMirrorPipeline();

      cameraStream.getVideoTracks().forEach((t) => {
        try {
          cameraStream.removeTrack(t);
        } catch {
          /* ignore */
        }
        try {
          t.stop();
        } catch {
          /* ignore */
        }
      });

      let fresh = null;
      let newVideo = null;
      const videoTries = [
        {
          deviceId: { exact: nextCam.deviceId },
          width: { ideal: 480 },
          height: { ideal: 480 },
        },
        {
          facingMode: { exact: wantFacing },
          width: { ideal: 480 },
          height: { ideal: 480 },
        },
        {
          facingMode: { ideal: wantFacing },
          width: { ideal: 480 },
          height: { ideal: 480 },
        },
      ];
      let lastErr = null;
      for (const video of videoTries) {
        try {
          fresh = await navigator.mediaDevices.getUserMedia({ audio: false, video });
          newVideo = fresh.getVideoTracks()[0] || null;
          if (newVideo) break;
          fresh.getTracks().forEach((t) => t.stop());
          fresh = null;
        } catch (err) {
          lastErr = err;
          fresh = null;
          newVideo = null;
        }
      }
      if (!newVideo || !fresh) {
        throw lastErr || new Error("no video");
      }

      const newId = newVideo.getSettings?.().deviceId || "";
      if (currentId && newId && currentId === newId) {
        fresh.getTracks().forEach((t) => t.stop());
        throw new Error("same camera");
      }

      cameraStream.addTrack(newVideo);
      fresh.getAudioTracks().forEach((t) => t.stop());

      const actualFacing =
        detectCameraFacingFromTrack(newVideo, nextCam.label) || wantFacing;
      chatCameraFacingRef.current = actualFacing;
      setChatCameraFacing(actualFacing);

      const recordStream = await buildChatRecordStream(cameraStream, actualFacing === "user");
      chatRecordStreamRef.current = recordStream;
      bindChatMediaRecorder(recordStream);

      if (chatLiveVideoRef.current) {
        chatLiveVideoRef.current.srcObject = cameraStream;
        chatLiveVideoRef.current.muted = true;
        chatLiveVideoRef.current.playsInline = true;
        await chatLiveVideoRef.current.play?.().catch(() => {});
      } else {
        attachLiveCameraPreview();
      }
    } catch {
      chatKeepRecordingRef.current = false;
      setChatStatus("Не удалось переключить камеру.");
      const cam = chatCameraStreamRef.current;
      if (cam && (!chatMediaRecorderRef.current || chatMediaRecorderRef.current.state === "inactive")) {
        try {
          if (!cam.getVideoTracks().length) {
            try {
              const fallback = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                  facingMode: { ideal: chatCameraFacingRef.current || "user" },
                  width: { ideal: 480 },
                  height: { ideal: 480 },
                },
              });
              const vt = fallback.getVideoTracks()[0];
              if (vt) cam.addTrack(vt);
              fallback.getAudioTracks().forEach((t) => t.stop());
            } catch {
              /* ignore */
            }
          }
          const facing = chatCameraFacingRef.current || "user";
          const recordStream = await buildChatRecordStream(cam, facing === "user");
          chatRecordStreamRef.current = recordStream;
          bindChatMediaRecorder(recordStream);
          if (chatLiveVideoRef.current) {
            chatLiveVideoRef.current.srcObject = cam;
            chatLiveVideoRef.current.play?.().catch(() => {});
          }
        } catch {
          /* ignore */
        }
      }
    } finally {
      chatKeepRecordingRef.current = false;
      setChatCameraSwitching(false);
    }
  }

  async function startChatRecording(kind) {
    if (chatRecordingKind || chatMediaPreview || !selectedChatId) return;
    try {
      const facing = chatCameraFacingRef.current || "user";
      const constraints =
        kind === "video_note"
          ? {
              audio: true,
              video: {
                facingMode: { ideal: facing },
                width: { ideal: 480 },
                height: { ideal: 480 },
              },
            }
          : { audio: true };
      const cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      chatCameraStreamRef.current = kind === "video_note" ? cameraStream : null;
      const actualFacing =
        kind === "video_note"
          ? detectCameraFacingFromTrack(cameraStream.getVideoTracks()[0]) || facing || "user"
          : facing;
      if (kind === "video_note") {
        chatCameraFacingRef.current = actualFacing;
        setChatCameraFacing(actualFacing);
      }
      const recordStream =
        kind === "video_note"
          ? await buildChatRecordStream(cameraStream, actualFacing === "user")
          : cameraStream;
      chatRecordStreamRef.current = recordStream;
      chatRecordChunksRef.current = [];
      const mime = pickRecorderMime(kind);
      chatRecordMimeRef.current = mime || (kind === "video_note" ? "video/webm" : "audio/webm");
      chatRecordKindRef.current = kind;
      chatKeepRecordingRef.current = false;
      bindChatMediaRecorder(recordStream);
      chatRecordStartedAtRef.current = Date.now();
      setChatRecordingKind(kind);
      chatRecordLockedRef.current = false;
      setChatRecordLocked(false);
      setChatRecordSecs(0);
      chatRecordTickRef.current = setInterval(() => {
        setChatRecordSecs(Math.floor((Date.now() - chatRecordStartedAtRef.current) / 1000));
      }, 250);

      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          const source = ctx.createMediaStreamSource(cameraStream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          chatAudioCtxRef.current = ctx;
          chatAnalyserRef.current = analyser;
          const data = new Uint8Array(analyser.frequencyBinCount);
          const tickLevels = () => {
            if (!chatAnalyserRef.current) return;
            chatAnalyserRef.current.getByteFrequencyData(data);
            const step = Math.max(1, Math.floor(data.length / 24));
            const next = [];
            for (let i = 0; i < 24; i += 1) {
              next.push(Math.min(1, (data[i * step] || 0) / 180));
            }
            setChatRecordLevels(next);
            chatLevelRafRef.current = requestAnimationFrame(tickLevels);
          };
          tickLevels();
        }
      } catch {
        /* analyser optional */
      }
      // Live <video> mounts with overlay after setChatRecordingKind — attach in useEffect
    } catch (_e) {
      setChatStatus("Нет доступа к микрофону/камере.");
      setChatRecordingKind(null);
      chatRecordLockedRef.current = false; setChatRecordLocked(false);
      clearChatRecordMeters();
      stopChatRecordTracks();
    }
  }

  function stopChatRecording() {
    const rec = chatMediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      try {
        if (typeof rec.requestData === "function") rec.requestData();
        rec.stop();
      } catch {
        setChatRecordingKind(null);
        chatRecordLockedRef.current = false; setChatRecordLocked(false);
        clearChatRecordMeters();
        stopChatRecordTracks();
      }
    } else {
      setChatRecordingKind(null);
      chatRecordLockedRef.current = false; setChatRecordLocked(false);
      clearChatRecordMeters();
      stopChatRecordTracks();
    }
  }

  function cancelChatRecording() {
    const rec = chatMediaRecorderRef.current;
    chatRecordChunksRef.current = [];
    chatRecordStartedAtRef.current = Date.now();
    if (rec && rec.state !== "inactive") {
      try {
        rec.onstop = () => {
          chatMediaRecorderRef.current = null;
          setChatRecordingKind(null);
          chatRecordLockedRef.current = false; setChatRecordLocked(false);
          clearChatRecordMeters();
          stopChatRecordTracks();
        };
        rec.stop();
      } catch {
        setChatRecordingKind(null);
        chatRecordLockedRef.current = false; setChatRecordLocked(false);
        clearChatRecordMeters();
        stopChatRecordTracks();
      }
    } else {
      setChatRecordingKind(null);
      chatRecordLockedRef.current = false; setChatRecordLocked(false);
      clearChatRecordMeters();
      stopChatRecordTracks();
    }
  }

  function discardChatMediaPreview() {
    if (chatMediaPreview?.url) URL.revokeObjectURL(chatMediaPreview.url);
    setChatMediaPreview(null);
  }

  async function sendChatMediaPreview() {
    if (!chatMediaPreview) return;
    const { blob, kind, mime, durationSec, displayFlip } = chatMediaPreview;
    const file = await blobToFile(
      blob,
      kind === "video_note" ? `video_note_${Date.now()}.webm` : `voice_${Date.now()}.webm`,
      mime
    );
    discardChatMediaPreview();
    await postChatMessage({
      file,
      kind,
      durationSec,
      displayFlip: kind === "video_note" ? Boolean(displayFlip) : null,
    });
  }

  function onComposeActionPointerDown(e) {
    if (chatInput.trim() || chatPendingFiles.length || chatMediaPreview) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    chatDidHoldRef.current = false;
    chatPointerStartYRef.current = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    chatRecordLiftHintRef.current = false;
    setChatRecordLiftHint(false);
    if (chatHoldTimerRef.current) clearTimeout(chatHoldTimerRef.current);
    // Short tap toggles voice/circle; hold ~0.45s starts recording (clicks often last >200ms).
    chatHoldTimerRef.current = setTimeout(() => {
      chatDidHoldRef.current = true;
      startChatRecording(chatComposeMode);
    }, 450);
  }

  function onComposeActionPointerMove(e) {
    if (!chatRecordingKind || chatRecordLockedRef.current) return;
    const y = e.clientY ?? e.touches?.[0]?.clientY ?? chatPointerStartYRef.current;
    const dy = chatPointerStartYRef.current - y;
    const lifted = dy > 40;
    chatRecordLiftHintRef.current = lifted;
    setChatRecordLiftHint(lifted);
    if (dy > 90) {
      chatRecordLockedRef.current = true;
      chatRecordLiftHintRef.current = false;
      setChatRecordLocked(true);
      setChatRecordLiftHint(false);
    }
  }

  function onComposeActionPointerUp(e) {
    if (chatHoldTimerRef.current) {
      clearTimeout(chatHoldTimerRef.current);
      chatHoldTimerRef.current = null;
    }
    try {
      e?.currentTarget?.releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    if (chatRecordingKind) {
      if (chatRecordLockedRef.current) return;
      if (chatRecordLiftHintRef.current) {
        chatRecordLockedRef.current = true;
        chatRecordLiftHintRef.current = false;
        setChatRecordLocked(true);
        setChatRecordLiftHint(false);
        return;
      }
      stopChatRecording();
      return;
    }
    if (!chatDidHoldRef.current) toggleChatComposeMode();
  }

  function onCircleSeekPointer(e, mediaEl) {
    if (!mediaEl || !Number.isFinite(mediaEl.duration) || mediaEl.duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const x = (e.clientX ?? e.touches?.[0]?.clientX) - cx;
    const y = (e.clientY ?? e.touches?.[0]?.clientY) - cy;
    let angle = Math.atan2(y, x); // -PI..PI, 0 at east
    angle = (angle + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2); // 0 at north, clockwise
    mediaEl.currentTime = (angle / (Math.PI * 2)) * mediaEl.duration;
  }

  function persistChatVisualSettings() {
    if (chatSettingsForId == null) return;
    let prev = {};
    try {
      prev = JSON.parse(localStorage.getItem(chatPrefsStorageKey(chatSettingsForId)) || "{}");
    } catch {
      prev = {};
    }
    const next = { ...prev };
    if (chatSettingsTitle.trim()) next.title = chatSettingsTitle.trim();
    else delete next.title;
    if (chatSettingsAvatar) next.avatarDataUrl = chatSettingsAvatar;
    else delete next.avatarDataUrl;
    if (chatSettingsWallpaper) next.wallpaper = chatSettingsWallpaper;
    else delete next.wallpaper;
    delete next.memberNames;
    try {
      localStorage.setItem(chatPrefsStorageKey(chatSettingsForId), JSON.stringify(next));
      setChatLocalPrefs((p) => ({ ...p, [chatSettingsForId]: next }));
    } catch (_e) {
      setChatStatus("Не удалось сохранить настройки (лимит хранилища браузера).");
      return;
    }
    const notify = {};
    if (chatSettingsNotify === "off") notify.muted = true;
    else if (chatSettingsNotify === "1h") notify.mutedUntil = Date.now() + 3600000;
    else if (chatSettingsNotify === "2h") notify.mutedUntil = Date.now() + 7200000;
    else if (chatSettingsNotify === "8h") notify.mutedUntil = Date.now() + 28800000;
    try {
      if (Object.keys(notify).length) localStorage.setItem(chatNotifyStorageKey(chatSettingsForId), JSON.stringify(notify));
      else localStorage.removeItem(chatNotifyStorageKey(chatSettingsForId));
    } catch {
      // ignore
    }
    setChatSettingsForId(null);
    setChatStatus("");
    setCustomColorPickerOpen(false);
  }

  function clearChatVisualSettings() {
    if (chatSettingsForId == null) return;
    localStorage.removeItem(chatNotifyStorageKey(chatSettingsForId));
    localStorage.removeItem(chatPrefsStorageKey(chatSettingsForId));
    setChatLocalPrefs((prev) => {
      const copy = { ...prev };
      delete copy[chatSettingsForId];
      return copy;
    });
    const sel = conversations.find((c) => c.id === chatSettingsForId);
    setChatSettingsTitle(defaultChatListNameForConversation(sel, me?.id));
    setChatSettingsAvatar("");
    setChatSettingsWallpaper("#dfe9e2");
    setChatSettingsForId(null);
  }

  function toggleGroupStaff(id) {
    const n = Number(id);
    setGroupForm((prev) => ({
      ...prev,
      staff_ids: prev.staff_ids.includes(n) ? prev.staff_ids.filter((x) => x !== n) : [...prev.staff_ids, n],
    }));
  }

  async function loadClientBookings() {
    await reloadBookingsList();
  }

  async function loadCatalogStatus() {
    const res = await authFetch(`${API_URL}/catalog/seed-catalog/`);
    if (res.ok) setCatalogStatus(await res.json());
  }

  async function seedProviderCatalog() {
    if (!me?.provider_sphere) {
      setSellerStatus("Укажите сферу услуг в настройках организации.");
      return;
    }
    setCatalogSeeding(true);
    setSellerStatus("");
    const res = await authFetch(`${API_URL}/catalog/seed-catalog/`, {
      method: "POST",
      body: JSON.stringify({ sphere: me.provider_sphere }),
    });
    setCatalogSeeding(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setSellerStatus(formatApiError(err, res.status) || "Не удалось загрузить каталог.");
      return;
    }
    const data = await res.json();
    setCatalogStatus(data);
    const created = data.stats?.services_created ?? 0;
    setSellerStatus(
      created > 0
        ? `Каталог загружен: ${created} услуг. Включите нужные позиции и укажите цены.`
        : "Каталог обновлён. Проверьте цены и включите нужные услуги.",
    );
    await loadSellerData();
    const openCats = {};
    const openSubs = {};
    for (const c of categories) openCats[c.id] = true;
    setCategoryOpen((prev) => ({ ...openCats, ...prev }));
    setSubcategoryOpen((prev) => ({ ...openSubs, ...prev }));
  }

  function updateServiceDraft(serviceId, patch) {
    setServiceDrafts((prev) => {
      const base =
        prev[serviceId] ?? buildServiceDraftFromService(services.find((s) => Number(s.id) === Number(serviceId)) || {});
      return { ...prev, [serviceId]: { ...base, ...patch } };
    });
  }

  const dirtyServiceCount = useMemo(
    () => services.filter((s) => !serviceDraftEqualsService(serviceDrafts[s.id], s)).length,
    [services, serviceDrafts],
  );

  const staffAssignableServices = useMemo(
    () =>
      services.filter((s) => {
        const draft = serviceDrafts[s.id];
        if (draft) return Boolean(draft.is_active);
        return Boolean(s.is_active);
      }),
    [services, serviceDrafts],
  );

  const staffAssignableCategories = useMemo(() => {
    const categoryIds = new Set(
      staffAssignableServices.map((s) => Number(s.category)).filter((id) => Number.isFinite(id) && id > 0),
    );
    return categories.filter((cat) => categoryIds.has(Number(cat.id)));
  }, [categories, staffAssignableServices]);

  async function saveAllServiceChanges() {
    const dirty = services.filter((s) => !serviceDraftEqualsService(serviceDrafts[s.id], s));
    if (!dirty.length) {
      setSellerStatus("Нет изменений для сохранения.");
      return;
    }
    setServiceSavingAll(true);
    setSellerStatus("");
    const results = await Promise.all(
      dirty.map((s) => {
        const d = serviceDrafts[s.id];
        return authFetch(`${API_URL}/catalog/services/${s.id}/`, {
          method: "PATCH",
          body: JSON.stringify({
            price: Number(d.price),
            duration_minutes: Number(d.duration_minutes),
            is_active: d.is_active,
          }),
        });
      }),
    );
    setServiceSavingAll(false);
    const failed = results.filter((r) => !r.ok).length;
    if (failed) {
      setSellerStatus(`Не удалось сохранить ${failed} из ${dirty.length} услуг.`);
      return;
    }
    setServices((prev) =>
      prev.map((s) => {
        const d = serviceDrafts[s.id];
        if (!dirty.some((x) => x.id === s.id)) return s;
        return {
          ...s,
          price: Number(d.price),
          duration_minutes: Number(d.duration_minutes),
          is_active: d.is_active,
        };
      }),
    );
    setServiceDrafts((prev) => {
      const next = { ...prev };
      for (const s of dirty) {
        next[s.id] = { ...serviceDrafts[s.id] };
      }
      return next;
    });
    setSellerStatus(`Сохранено услуг: ${dirty.length}.`);
  }

  async function updateService(id, patch) {
    const response = await authFetch(`${API_URL}/catalog/services/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    if (!response.ok) return setSellerStatus("Ошибка обновления услуги.");
    setSellerStatus("Услуга обновлена.");
    loadSellerData();
  }

  async function createSlot(event) {
    event.preventDefault();
    const response = await authFetch(`${API_URL}/booking/slots/`, { method: "POST", body: JSON.stringify(slotForm) });
    if (!response.ok) return setSellerStatus("Ошибка при создании слота.");
    setSlotForm({ starts_at: "", ends_at: "" });
    setSellerStatus("Слот создан.");
    loadSellerData();
  }

  async function createSlotsByInterval(event) {
    event.preventDefault();
    if (!intervalForm.start_time || !intervalForm.end_time) {
      setSellerStatus("Укажи время начала и окончания.");
      return;
    }
    const baseDate = intervalForm.date || new Date().toISOString().slice(0, 10);
    const baseStart = new Date(`${baseDate}T${intervalForm.start_time}:00`);
    const baseEnd = new Date(`${baseDate}T${intervalForm.end_time}:00`);
    if (baseStart >= baseEnd) return setSellerStatus("Время начала должно быть раньше окончания.");
    const hasDuplicate = savedIntervals.some(
      (s) => s.start_time === intervalForm.start_time && s.end_time === intervalForm.end_time
    );
    if (hasDuplicate) {
      const msg = "Такой интервал уже есть в сохранённых — выбери другой диапазон времени.";
      setSellerStatus(msg);
      showIntervalToast(msg);
      return;
    }
    const template = {
      id: `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      start_time: intervalForm.start_time,
      end_time: intervalForm.end_time,
    };
    setSavedIntervals((prev) => [template, ...prev]);
    setSelectedIntervalId(template.id);
    setSellerStatus("Интервал сохранён. Нажми на день в календаре для применения.");
  }

  async function applyIntervalToDay(day, template) {
    if (!template) return;
    const date = `${calendarMonth}-${String(day).padStart(2, "0")}`;
    const check = validateIntervalForDate(date, template);
    if (!check.ok) {
      setSellerStatus(check.reason);
      showIntervalToast(check.reason);
      return;
    }
    const start = new Date(`${date}T${template.start_time}:00`);
    const end = new Date(`${date}T${template.end_time}:00`);
    if (start >= end) {
      setSellerStatus("Некорректный интервал: начало позже конца.");
      return;
    }
    const response = await authFetch(`${API_URL}/booking/slots/`, {
      method: "POST",
      body: JSON.stringify({
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const detail = err?.detail || "Не удалось применить интервал на день.";
      showIntervalToast(detail);
      setSellerStatus(detail);
      return;
    }
    setSellerStatus(`Интервал применён на ${date}.`);
    loadSellerData();
  }

  async function applyIntervalByPattern(pattern, template) {
    if (!template) return;
    const [year, month] = calendarMonth.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const targets = [];
    for (let day = 1; day <= daysInMonth; day += 1) {
      const d = new Date(year, month - 1, day);
      const wd = d.getDay(); // 0..6
      const isWorkday = wd >= 1 && wd <= 5;
      const isWeekend = wd === 0 || wd === 6;
      if (pattern === "daily") targets.push(day);
      if (pattern === "workweek" && isWorkday) targets.push(day);
      if (pattern === "weekend" && isWeekend) targets.push(day);
    }
    let success = 0;
    let failed = 0;
    let skipped = 0;
    const errors = [];
    for (const day of targets) {
      const date = `${calendarMonth}-${String(day).padStart(2, "0")}`;
      const check = validateIntervalForDate(date, template);
      if (!check.ok) {
        skipped += 1;
        errors.push(check.reason);
        continue;
      }
      const start = new Date(`${date}T${template.start_time}:00`);
      const end = new Date(`${date}T${template.end_time}:00`);
      const response = await authFetch(`${API_URL}/booking/slots/`, {
        method: "POST",
        body: JSON.stringify({ starts_at: start.toISOString(), ends_at: end.toISOString() }),
      });
      if (response.ok) {
        success += 1;
      } else {
        failed += 1;
        const err = await response.json().catch(() => ({}));
        const detail = err?.detail || `Ошибка применения на ${date}`;
        errors.push(detail);
      }
    }
    const unique = [...new Set(errors)];
    if (unique.length) {
      showIntervalToast(unique.length === 1 ? unique[0] : `${unique[0]} (+ещё ${unique.length - 1})`);
    }
    setSellerStatus(`Применено: ${success}, пропущено: ${skipped}, ошибок: ${failed}`);
    loadSellerData();
  }

  function validateIntervalForDate(date, template) {
    const start = new Date(`${date}T${template.start_time}:00`);
    const end = new Date(`${date}T${template.end_time}:00`);
    if (start >= end) return { ok: false, reason: "Некорректный интервал: время начала должно быть раньше окончания." };

    const startMs = start.getTime();
    const endMs = end.getTime();
    const daySlots = slots.filter((s) => s.starts_at?.slice(0, 10) === date);
    for (const slot of daySlots) {
      const slotStartMs = new Date(slot.starts_at).getTime();
      const slotEndMs = new Date(slot.ends_at).getTime();
      const sameBounds = slotStartMs === startMs && slotEndMs === endMs;
      if (sameBounds) {
        return { ok: false, reason: `Интервал ${template.start_time}-${template.end_time} уже применён на ${date}.` };
      }
      const overlaps = startMs < slotEndMs && slotStartMs < endMs;
      if (overlaps) {
        return { ok: false, reason: `Интервал пересекается с существующим на ${date}.` };
      }
    }
    return { ok: true };
  }

  async function deleteSlot(slotId) {
    const response = await authFetch(`${API_URL}/booking/slots/${slotId}/`, { method: "DELETE" });
    if (!response.ok) return setSellerStatus("Не удалось удалить интервал.");
    setSellerStatus("Интервал удален.");
    setCalendarDayDetail((prev) => {
      if (!prev || prev.mode !== "intervals") return prev;
      const items = (prev.items || []).filter((x) => Number(x.id) !== Number(slotId));
      return { ...prev, items };
    });
    loadSellerData();
  }

  async function deleteSeries(group) {
    if (!group) return;
    const response = await authFetch(
      `${API_URL}/booking/slots/delete-series/?recurrence_group=${encodeURIComponent(group)}`,
      { method: "DELETE" }
    );
    if (!response.ok) return setSellerStatus("Не удалось удалить серию интервалов.");
    const data = await response.json();
    setSellerStatus(`Удалено интервалов в серии: ${data.deleted ?? 0}`);
    loadSellerData();
  }

  async function updateProfile(event) {
    event.preventDefault();
    const response = await authFetch(`${API_URL}/users/me/`, {
      method: "PATCH",
      body: JSON.stringify(profileForm),
    });
    if (!response.ok) return setStatus("Не удалось сохранить личные данные.");
    showToast("Данные сохранены");
    setStatus("Данные сохранены.");
    loadMe();
  }

  async function changePassword(event) {
    event.preventDefault();
    const response = await authFetch(`${API_URL}/users/change-password/`, {
      method: "POST",
      body: JSON.stringify(passwordForm),
    });
    const data = await response.json().catch(() => ({}));
    const detail = data.detail || (response.ok ? "Проверьте почту для подтверждения смены пароля." : "Не удалось сменить пароль.");
    if (!response.ok) return setStatus(detail);
    showToast(detail, { tone: "success", ms: 14000 });
    setStatus(detail);
    setPasswordForm({ old_password: "", new_password: "", new_password_confirm: "" });
  }

  async function changeEmail(event) {
    event.preventDefault();
    const response = await authFetch(`${API_URL}/users/change-email/`, {
      method: "POST",
      body: JSON.stringify(emailForm),
    });
    const data = await response.json().catch(() => ({}));
    const detail = data.detail || (response.ok ? "Email изменен. Подтверди его по письму." : "Не удалось сменить email.");
    if (!response.ok) return setStatus(detail);
    showToast(detail, { tone: "success", ms: 14000 });
    setStatus(detail);
    loadMe();
  }

  async function saveProviderOrganization(event) {
    event.preventDefault();
    const response = await authFetch(`${API_URL}/users/me/`, {
      method: "PATCH",
      body: JSON.stringify({
        organization_name: orgAddressForm.organization_name,
        organization_address:
          simplifyCommaAddressLine((orgAddressForm.organization_address || "").trim()) ||
          (orgAddressForm.organization_address || "").trim(),
        organization_entrance: (orgAddressForm.entrance || "").trim(),
        organization_floor: (orgAddressForm.floor || "").trim(),
        organization_apartment: (orgAddressForm.apartment || "").trim(),
        organization_intercom: (orgAddressForm.intercom || "").trim(),
        organization_address_extra: (orgAddressForm.organization_address_details || "").trim(),
        organization_latitude: orgAddressForm.organization_latitude,
        organization_longitude: orgAddressForm.organization_longitude,
      }),
    });
    if (!response.ok) {
      setProfileOrgStatus("Не удалось сохранить адрес организации.");
      return;
    }
    setProfileOrgStatus("Адрес организации обновлён.");
    setOrgMainEditOpen(false);
    loadMe();
    loadSellerData();
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

  async function createProviderBranch(event) {
    event.preventDefault();
    setBranchGeoStatus("");
    const response = await authFetch(`${API_URL}/locations/`, {
      method: "POST",
      body: JSON.stringify({
        title: locationForm.title,
        address: locationForm.address.trim(),
        latitude: Number(locationForm.latitude),
        longitude: Number(locationForm.longitude),
        entrance: (locationForm.entrance || "").trim(),
        floor: (locationForm.floor || "").trim(),
        apartment: (locationForm.apartment || "").trim(),
        intercom: (locationForm.intercom || "").trim(),
        address_details: (locationForm.address_details || "").trim(),
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      setBranchGeoStatus(err.detail || Object.values(err).flat().find(Boolean) || "Не удалось добавить филиал.");
      return;
    }
    setLocationForm(emptyLocationFormState());
    setBranchGeoStatus("Филиал добавлен.");
    setOrgBranchAddOpen(false);
    destroyBranchAddMap();
    loadSellerData();
  }

  async function saveProviderBranchEdit(event) {
    event.preventDefault();
    if (!selectedOrgBranchId) return;
    setBranchGeoStatus("Сохраняем…");
    const response = await authFetch(`${API_URL}/locations/${selectedOrgBranchId}/`, {
      method: "PATCH",
      body: JSON.stringify({
        title: locationForm.title.trim(),
        address: locationForm.address.trim(),
        latitude: Number(locationForm.latitude),
        longitude: Number(locationForm.longitude),
        entrance: (locationForm.entrance || "").trim(),
        floor: (locationForm.floor || "").trim(),
        apartment: (locationForm.apartment || "").trim(),
        intercom: (locationForm.intercom || "").trim(),
        address_details: (locationForm.address_details || "").trim(),
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      setBranchGeoStatus(err.detail || Object.values(err).flat().find(Boolean) || "Не удалось сохранить филиал.");
      return;
    }
    setBranchGeoStatus("Филиал обновлён.");
    setOrgBranchEditOpen(false);
    loadSellerData();
  }

  async function deleteProviderBranch(id) {
    const response = await authFetch(`${API_URL}/locations/${id}/`, { method: "DELETE" });
    if (!response.ok) {
      setBranchGeoStatus("Не удалось удалить филиал.");
      return;
    }
    if (Number(selectedOrgBranchId) === Number(id)) {
      setSelectedOrgBranchId(null);
      setOrgBranchEditOpen(false);
    }
    setBranchGeoStatus("Филиал удалён.");
    loadSellerData();
  }

  async function onClientLocationSelect(locationId, presetDate = "") {
    const loc = allLocations.find((x) => String(x.id) === String(locationId));
    if (!loc) {
      setClientBookingForm((p) => ({
        ...p,
        locationId: "",
        provider: "",
        serviceId: "",
        windowKey: "",
      }));
      setProviderServices([]);
      setClientBookWindows([]);
      return;
    }
    const pid = String(loc.provider);
    const bookDate = presetDate || clientDiscoverFiltersRef.current?.slot_date || clientBookingForm.bookDate || todayIsoDate();
    setClientBookingForm((p) => ({
      ...p,
      locationId: String(loc.id),
      provider: pid,
      serviceId: "",
      windowKey: "",
      bookDate,
    }));
    const servicesRes = await authFetch(`${API_URL}/catalog/services/?provider=${encodeURIComponent(pid)}`);
    if (servicesRes.ok) {
      const list = await servicesRes.json();
      setProviderServices(list.filter((s) => s.is_active));
    } else {
      setProviderServices([]);
    }
    setClientBookWindows([]);
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
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      setClientStatus(err.detail || "Не удалось создать запись.");
      return;
    }
    const created = await response.json().catch(() => ({}));
    await reloadBookingsList();
    const monthKey = isoMonthKey(created.slot_starts_at || win.starts_at);
    if (monthKey) setBookingsMonth(monthKey);
    setClientStatus("Запись создана.");
    setClientBookingForm({
      locationId: "",
      provider: "",
      serviceId: "",
      bookDate: clientDiscoverFilters.slot_date || "",
      windowKey: "",
      comment: "",
    });
    setClientBookWindows([]);
    setClientBookModalOpen(false);
    setMapOrgPopup(null);
    setCurrentView("bookings");
  }

  function bookingClientLabel(it) {
    const n = (it.client_display_name || "").trim();
    if (n) return n;
    return it.client_username || "Клиент";
  }

  function bookingSlotSecondaryLabel(it) {
    if (me?.role === "client") {
      const master = (it.staff_display_name || "").trim();
      if (master) return master;
      return (it.service_name || "").trim() || "Мастер";
    }
    const client = bookingClientLabel(it);
    const service = (it.service_name || "").trim();
    if (client && service) return `${client} · ${service}`;
    return client || service || "Запись";
  }

  async function reloadBookingsList() {
    const bookingsRes = await authFetch(`${API_URL}/booking/`);
    if (!bookingsRes.ok) return [];
    const list = normalizeBookingsList(await bookingsRes.json());
    setBookings(list);
    return list;
  }

  async function openChatWithClient(clientId) {
    const res = await authFetch(`${API_URL}/chat/conversations/create-with-client/`, {
      method: "POST",
      body: JSON.stringify({ client_id: Number(clientId) }),
    });
    if (!res.ok) return;
    const data = await res.json();
    await loadChats();
    setSelectedChatId(data.id);
    setChatFolder("clients");
    setCurrentView("chats");
    setMenuOpen(false);
  }

  async function openChatWithProvider(providerId) {
    const res = await authFetch(`${API_URL}/chat/conversations/create-with-provider/`, {
      method: "POST",
      body: JSON.stringify({ provider_id: Number(providerId) }),
    });
    if (!res.ok) return;
    const data = await res.json();
    await loadChats();
    setSelectedChatId(data.id);
    setCurrentView("chats");
    setMenuOpen(false);
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
      err.code === "confirm_message_not_set"
      || err.code === "cancel_message_not_set"
      || err.code === "done_message_not_set"
      || err.code === "booking_not_started_yet"
    ) {
      setBookingMessageError({ code: err.code, detail: err.detail || "" });
    }
  }

  function bookingHasStarted(it) {
    if (!it?.slot_starts_at) return true;
    const start = new Date(it.slot_starts_at).getTime();
    return !Number.isNaN(start) && start <= Date.now();
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

  async function loadMapOrgSummary(providerId) {
    const res = await authFetch(`${API_URL}/reviews/summary/?provider=${encodeURIComponent(providerId)}`);
    if (res.ok) setMapOrgSummary(await res.json());
  }

  async function loadMapOrgProfile(providerId) {
    const res = await authFetch(`${API_URL}/users/organization-profile/?provider=${encodeURIComponent(providerId)}`);
    if (!res.ok) {
      setMapOrgProfile(null);
      return null;
    }
    const data = await res.json();
    setMapOrgProfile(data);
    setMapOrgCarouselIndex(0);
    return data;
  }

  function fitClientDiscoverMapViewport() {
    const map = clientDiscoverMapRef.current;
    if (!map) return;
    try {
      if (map.container?.fitToViewport) map.container.fitToViewport();
      else map.setSize?.([map.container?.getSize?.()?.[0], map.container?.getSize?.()?.[1]]);
    } catch {
      // ignore
    }
  }

  function closeMapOrgSheet() {
    setMapOrgPopup(null);
    setMapOrgProfile(null);
    setMapOrgReviewsOpen(false);
    setMapOrgReviews([]);
    window.setTimeout(fitClientDiscoverMapViewport, 0);
    window.setTimeout(fitClientDiscoverMapViewport, 120);
  }

  async function waitForClientDiscoverMap(maxMs = 4500) {
    if (clientDiscoverMapRef.current) return clientDiscoverMapRef.current;
    const started = Date.now();
    while (Date.now() - started < maxMs) {
      await new Promise((r) => window.setTimeout(r, 80));
      if (clientDiscoverMapRef.current) return clientDiscoverMapRef.current;
    }
    return null;
  }

  async function openOrgOnMap(loc) {
    setMapOrgPopup(loc);
    setMapOrgCarouselIndex(0);
    const profile = await loadMapOrgProfile(loc.provider);
    if (profile?.reviews_count > 0) {
      setMapOrgReviewsOpen(true);
      await loadMapOrgReviews(loc.provider, mapOrgReviewsOrdering);
    } else {
      setMapOrgReviewsOpen(false);
      setMapOrgReviews([]);
    }
    loadMapOrgSummary(loc.provider);
    window.setTimeout(fitClientDiscoverMapViewport, 0);
  }

  async function saveOrgProfileInfo(event) {
    event?.preventDefault?.();
    const phones = orgProfileForm.phones.map((p) => String(p).trim()).filter(Boolean);
    const websites = orgProfileForm.websites.map((w) => String(w).trim()).filter(Boolean);
    const res = await authFetch(`${API_URL}/users/organization-info/`, {
      method: "PATCH",
      body: JSON.stringify({
        organization_working_hours: orgProfileForm.working_hours,
        organization_phones: phones,
        organization_websites: websites,
        organization_card_note: orgProfileForm.card_note,
      }),
    });
    if (!res.ok) {
      setOrgProfileSaveStatus("Не удалось сохранить.");
      return;
    }
    setOrgProfileSaveStatus("Сохранено.");
    loadMe();
  }

  async function uploadOrgGalleryPhoto(file) {
    if (!file) return false;
    if (orgGalleryPhotos.length >= ORG_GALLERY_MAX_PHOTOS) {
      setOrgProfileSaveStatus(`Можно загрузить не более ${ORG_GALLERY_MAX_PHOTOS} фото.`);
      return false;
    }
    const fd = new FormData();
    fd.append("image", file);
    const res = await authFetch(`${API_URL}/users/gallery/`, { method: "POST", body: fd });
    if (res.ok) {
      const row = await res.json();
      setOrgGalleryPhotos((p) => [...p, row].slice(0, ORG_GALLERY_MAX_PHOTOS));
      setOrgProfileSaveStatus("Фото добавлено.");
      return true;
    }
    const err = await res.json().catch(() => ({}));
    setOrgProfileSaveStatus(err.detail || "Не удалось загрузить фото.");
    return false;
  }

  async function deleteOrgGalleryPhoto(id) {
    const res = await authFetch(`${API_URL}/users/gallery/?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) setOrgGalleryPhotos((p) => p.filter((x) => Number(x.id) !== Number(id)));
  }

  async function loadMapOrgReviews(providerId, ordering) {
    const res = await authFetch(
      `${API_URL}/reviews/?provider=${encodeURIComponent(providerId)}&ordering=${encodeURIComponent(ordering || "-created_at")}`,
    );
    if (res.ok) setMapOrgReviews(normalizeReviewsList(await res.json()));
  }

  async function loadProviderReviewsList(ordering = providerReviewsOrdering) {
    const res = await authFetch(
      `${API_URL}/reviews/?ordering=${encodeURIComponent(ordering || "-created_at")}`,
    );
    if (res.ok) setProviderReviews(normalizeReviewsList(await res.json()));
  }

  async function loadMyReviews() {
    const res = await authFetch(`${API_URL}/reviews/`);
    if (res.ok) setMyReviews(normalizeReviewsList(await res.json()));
  }

  async function loadMissedReviewsCount() {
    if (me?.role !== "provider") return;
    const res = await authFetch(`${API_URL}/reviews/unread-count/`);
    if (res.ok) {
      const data = await res.json();
      setMissedReviewsCount(Number(data.count) || 0);
    }
  }

  async function markReviewsSeen() {
    if (me?.role !== "provider") return;
    const res = await authFetch(`${API_URL}/reviews/mark-seen/`, { method: "POST", body: "{}" });
    if (res.ok) setMissedReviewsCount(0);
  }

  function openProviderReviews() {
    setCurrentView("reviews");
    loadProviderReviewsList(providerReviewsOrdering);
    markReviewsSeen();
  }

  async function refreshReviewsAfterSubmit(providerId) {
    if (me?.role === "client") await loadMyReviews();
    if (me?.role === "provider") await loadProviderReviewsList(providerReviewsOrdering);
    if (mapOrgPopup && Number(mapOrgPopup.provider) === Number(providerId)) {
      await loadMapOrgSummary(providerId);
      if (mapOrgReviewsOpen) await loadMapOrgReviews(providerId, mapOrgReviewsOrdering);
    }
  }

  function bookingHasReview(bookingId) {
    const b = bookings.find((x) => Number(x.id) === Number(bookingId));
    if (b?.review?.id) return true;
    return myReviews.some((r) => Number(r.booking) === Number(bookingId));
  }

  function getBookingReview(booking) {
    if (booking?.review?.id) return booking.review;
    if (me?.role === "client") {
      return myReviews.find((r) => Number(r.booking) === Number(booking.id)) || null;
    }
    return null;
  }

  async function openOrgCardFromHistory(booking) {
    const providerId = booking?.provider;
    if (!providerId) return;
    let loc = allLocations.find((l) => Number(l.provider) === Number(providerId));
    if (!loc) {
      const res = await authFetch(`${API_URL}/locations/`);
      if (res.ok) {
        const list = await res.json();
        loc = list.find((l) => Number(l.provider) === Number(providerId));
        if (Array.isArray(list) && list.length) setAllLocations(list);
      }
    }
    if (!loc) {
      setClientStatus("Точка организации на карте не найдена.");
      return;
    }
    setCurrentView("client_map");
    await waitForClientDiscoverMap();
    await openOrgOnMap(loc);
  }

  function patchReviewInLists(updated) {
    const merge = (list) => list.map((r) => (Number(r.id) === Number(updated.id) ? { ...r, ...updated } : r));
    setProviderReviews((list) => merge(list));
    setMapOrgReviews((list) => merge(list));
    setMyReviews((list) => merge(list));
  }

  async function toggleReviewLike(reviewId, likedByMe) {
    const path = likedByMe ? "unlike" : "like";
    const res = await authFetch(`${API_URL}/reviews/${reviewId}/${path}/`, { method: "POST", body: "{}" });
    if (!res.ok) return;
    const data = await res.json();
    const patch = (list) =>
      list.map((r) =>
        Number(r.id) === Number(reviewId)
          ? { ...r, liked_by_me: !likedByMe, likes_count: data.likes_count ?? r.likes_count }
          : r,
      );
    setProviderReviews(patch);
    setMapOrgReviews(patch);
  }

  function defaultReviewReplyForm(review) {
    return {
      text: review?.reply?.text || "",
      publishReply: true,
      viaChat: Boolean(review?.reply?.sent_via_chat),
    };
  }

  async function submitReviewReply(reviewId) {
    const form = reviewReplyForms[reviewId] || {};
    const text = (form.text || "").trim();
    if (!text) {
      setReviewReplyFormError("Введите текст ответа.");
      return;
    }
    if (!form.publishReply && !form.viaChat) {
      setReviewReplyFormError("Отметьте хотя бы один способ: ответ на отзыв или сообщение в чат.");
      return;
    }
    setReviewReplyFormError("");
    const res = await authFetch(`${API_URL}/reviews/${reviewId}/reply/`, {
      method: "POST",
      body: JSON.stringify({
        text,
        publish_reply: form.publishReply,
        via_chat: form.viaChat,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setReviewReplyFormError(formatApiError(err, res.status) || "Не удалось отправить ответ.");
      return;
    }
    const updated = await res.json();
    patchReviewInLists(updated);
    setReviewReplyOpenId(null);
    setReviewReplyForms((p) => {
      const next = { ...p };
      delete next[reviewId];
      return next;
    });
  }

  function buildAllReviewPhotoLightboxItems(reviews) {
    const items = [];
    for (const r of reviews || []) {
      for (const p of r.photos || []) {
        items.push({
          id: `review-${r.id}-${p.id}`,
          url: reviewImageUrl(p.image),
          source: "review",
          review_id: r.id,
          client_name: r.client_name,
          rating: r.rating,
          text: r.text || "",
        });
      }
    }
    return items;
  }

  function findReviewPhotoGlobalIndex(reviews, reviewId, photoIndex) {
    let offset = 0;
    for (const r of reviews || []) {
      const photos = r.photos || [];
      if (r.id === reviewId) return offset + photoIndex;
      offset += photos.length;
    }
    return 0;
  }

  function openReviewPhotoLightbox(review, photoIndex = 0, reviewsList = null) {
    const reviews = reviewsList?.length ? reviewsList : [review];
    const items = buildAllReviewPhotoLightboxItems(reviews);
    if (!items.length) return;
    const globalIndex = findReviewPhotoGlobalIndex(reviews, review.id, photoIndex);
    openOrgPhotoLightbox(items, globalIndex);
  }

  function renderReviewListItem(r, { showClientName = true, reviewsForGallery = null } = {}) {
    const galleryReviews = reviewsForGallery?.length ? reviewsForGallery : [r];
    return (
      <li key={r.id} className={["review-item", r.is_new && "review-item--new"].filter(Boolean).join(" ")}>
        <div className="review-item-head">
          {showClientName ? <strong>{r.client_name || "Клиент"}</strong> : null}
          {r.is_new ? <span className="review-new-pill">Новый</span> : null}
          <span className="review-stars" aria-label={`Оценка ${r.rating}`}>
            {"★".repeat(r.rating)}
            <span className="review-stars-empty">{"☆".repeat(Math.max(0, 5 - r.rating))}</span>
          </span>
        </div>
        {r.staff_name ? <p className="muted small">Мастер: {r.staff_name}</p> : null}
        <ReviewTextContent review={r} />
        {r.photos?.length > 0 && (
          <div className="review-photos">
            {r.photos.map((p, photoIdx) => (
              <button
                key={p.id}
                type="button"
                className="review-photo-btn"
                onClick={() => openReviewPhotoLightbox(r, photoIdx, galleryReviews)}
              >
                <img src={reviewImageUrl(p.image)} alt="" />
              </button>
            ))}
          </div>
        )}
        {r.reply?.text && reviewReplyOpenId !== r.id ? (
          <p className="review-reply">
            <strong>Ответ организации:</strong> {r.reply.text}
            {r.reply.sent_via_chat ? <span className="muted small"> (также в чате)</span> : null}
          </p>
        ) : null}
        <div className="review-item-actions">
          {accessToken && (
            <button
              type="button"
              className={["review-like-btn", r.liked_by_me && "review-like-btn--active"].filter(Boolean).join(" ")}
              onClick={() => toggleReviewLike(r.id, r.liked_by_me)}
              aria-pressed={Boolean(r.liked_by_me)}
            >
              <span className="review-like-icon" aria-hidden>{r.liked_by_me ? "♥" : "♡"}</span>
              <span>{Number(r.likes_count) || 0}</span>
            </button>
          )}
          {(me?.role === "provider" || me?.role === "staff") && (
            reviewReplyOpenId === r.id ? (
              <div className="review-reply-editor">
                <textarea
                  placeholder="Текст ответа"
                  value={reviewReplyForms[r.id]?.text ?? r.reply?.text ?? ""}
                  onChange={(e) =>
                    setReviewReplyForms((p) => ({
                      ...p,
                      [r.id]: { ...defaultReviewReplyForm(r), ...p[r.id], text: e.target.value },
                    }))
                  }
                  rows={3}
                />
                <div className="review-reply-options">
                  <label className="checkbox review-reply-option">
                    <input
                      type="checkbox"
                      checked={reviewReplyForms[r.id]?.publishReply ?? true}
                      onChange={(e) =>
                        setReviewReplyForms((p) => ({
                          ...p,
                          [r.id]: { ...defaultReviewReplyForm(r), ...p[r.id], publishReply: e.target.checked },
                        }))
                      }
                    />
                    Ответ на отзыв (виден всем)
                  </label>
                  <label className="checkbox review-reply-option">
                    <input
                      type="checkbox"
                      checked={reviewReplyForms[r.id]?.viaChat ?? false}
                      onChange={(e) =>
                        setReviewReplyForms((p) => ({
                          ...p,
                          [r.id]: { ...defaultReviewReplyForm(r), ...p[r.id], viaChat: e.target.checked },
                        }))
                      }
                    />
                    Отправить клиенту в чат
                  </label>
                </div>
                {reviewReplyFormError ? <p className="status error">{reviewReplyFormError}</p> : null}
                <div className="review-reply-editor-actions">
                  <button
                    type="button"
                    className="ghost-btn small"
                    onClick={() => {
                      setReviewReplyOpenId(null);
                      setReviewReplyFormError("");
                    }}
                  >
                    Отмена
                  </button>
                  <button type="button" className="small" onClick={() => submitReviewReply(r.id)}>
                    Отправить
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="ghost-btn small review-reply-open-btn"
                onClick={() => {
                  setReviewReplyOpenId(r.id);
                  setReviewReplyFormError("");
                  setReviewReplyForms((p) => ({ ...p, [r.id]: defaultReviewReplyForm(r) }));
                }}
              >
                {r.reply?.text ? "Изменить ответ" : "Ответить"}
              </button>
            )
          )}
        </div>
      </li>
    );
  }

  function renderProviderReviewsBlock() {
    return (
      <section className="card full-width reviews-page">
        <h2>Отзывы</h2>
        <label className="field-label" htmlFor="provider-reviews-order">Сортировка</label>
        <select
          id="provider-reviews-order"
          value={providerReviewsOrdering}
          onChange={(e) => {
            setProviderReviewsOrdering(e.target.value);
            loadProviderReviewsList(e.target.value);
          }}
        >
          <option value="-created_at">Сначала новые</option>
          <option value="-rating">Сначала положительные</option>
          <option value="rating">Сначала негативные</option>
        </select>
        {providerReviews.length === 0 ? (
          <p className="muted">Пока нет отзывов.</p>
        ) : (
          <ul className="list review-list">
            {providerReviews.map((r) => renderReviewListItem(r, { reviewsForGallery: providerReviews }))}
          </ul>
        )}
      </section>
    );
  }

  async function saveOrgBookingMessages(event) {
    event.preventDefault();
    const response = await authFetch(`${API_URL}/users/me/`, {
      method: "PATCH",
      body: JSON.stringify({
        booking_confirm_message_default: orgBookingMessages.confirm,
        booking_cancel_message_default: orgBookingMessages.cancel,
        booking_done_message_default: orgBookingMessages.done,
      }),
    });
    if (response.ok) {
      showToast("Сообщения сохранены", { tone: "success" });
      setProfileOrgStatus("Сообщения для записей сохранены.");
      loadMe();
    } else {
      setProfileOrgStatus("Не удалось сохранить сообщения.");
    }
  }

  async function submitClientReview(event) {
    event.preventDefault();
    if (!reviewModalBooking) return;
    setReviewSubmitError("");
    const input = document.getElementById("review-photos-input");
    const isSupplement = Boolean(reviewModalReview?.id);

    if (isSupplement) {
      const fd = new FormData();
      if ((reviewForm.text || "").trim()) fd.append("append_text", reviewForm.text.trim());
      if (input?.files) {
        for (const f of input.files) fd.append("photos", f);
      }
      const res = await authFetch(`${API_URL}/reviews/${reviewModalReview.id}/`, {
        method: "PATCH",
        body: fd,
      });
      if (res.ok) {
        const updated = await res.json();
        const bookingId = reviewModalBooking.id;
        const providerId = reviewModalBooking.provider;
        setBookings((prev) =>
          prev.map((b) =>
            Number(b.id) === Number(bookingId)
              ? {
                  ...b,
                  review: {
                    id: updated.id,
                    rating: updated.rating,
                    text: updated.text,
                    created_at: updated.created_at,
                    supplemented_at: updated.supplemented_at,
                    photos: updated.photos || [],
                    reply: updated.reply || null,
                  },
                }
              : b,
          ),
        );
        setMyReviews((prev) => {
          const has = prev.some((r) => Number(r.id) === Number(updated.id));
          if (has) return prev.map((r) => (Number(r.id) === Number(updated.id) ? { ...r, ...updated } : r));
          return [updated, ...prev];
        });
        setReviewModalBooking(null);
        setReviewModalReview(null);
        setReviewForm({ rating: 5, text: "" });
        if (input) input.value = "";
        setReviewSubmitError("");
        setClientStatus("Отзыв дополнен.");
        await refreshReviewsAfterSubmit(providerId);
        return;
      }
      const err = await res.json().catch(() => ({}));
      setReviewSubmitError(formatApiError(err, res.status) || "Не удалось дополнить отзыв.");
      return;
    }

    const fd = new FormData();
    fd.append("provider", String(reviewModalBooking.provider));
    fd.append("booking", String(reviewModalBooking.id));
    if (reviewModalBooking.staff_user_id) {
      fd.append("staff_user", String(reviewModalBooking.staff_user_id));
    }
    fd.append("rating", String(reviewForm.rating));
    fd.append("text", reviewForm.text || "");
    if (input?.files) {
      for (const f of input.files) fd.append("photos", f);
    }
    const res = await authFetch(`${API_URL}/reviews/`, { method: "POST", body: fd });
    if (res.ok) {
      const created = await res.json();
      const providerId = reviewModalBooking.provider;
      const bookingId = reviewModalBooking.id;
      setBookings((prev) =>
        prev.map((b) =>
          Number(b.id) === Number(bookingId)
            ? {
                ...b,
                review: {
                  id: created.id,
                  rating: created.rating,
                  text: created.text,
                  created_at: created.created_at,
                  supplemented_at: created.supplemented_at,
                  photos: created.photos || [],
                  reply: created.reply || null,
                },
              }
            : b,
        ),
      );
      setReviewModalBooking(null);
      setReviewModalReview(null);
      setReviewForm({ rating: 5, text: "" });
      if (input) input.value = "";
      setReviewSubmitError("");
      setClientStatus("Отзыв отправлен.");
      await refreshReviewsAfterSubmit(providerId);
      return;
    }
    const err = await res.json().catch(() => ({}));
    setReviewSubmitError(formatApiError(err, res.status) || "Не удалось отправить отзыв.");
  }

  function renderBookingSlotActions(it) {
    if (!it?.id) return null;
    const isOrg = canManageBookings();
    const isClient = me?.role === "client";
    const cancelled = it.status === "cancelled";
    const done = it.status === "done";
    return (
      <div className="booking-actions-bar" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
        {isOrg && !cancelled && it.status === "new" && (
          <button type="button" className="booking-action-btn booking-action-btn--confirm" title="Подтвердить" onClick={(e) => orgBookingAction(it.id, "confirm", e)}>
            ✓
          </button>
        )}
        {isOrg && !cancelled && (
          <button type="button" className="booking-action-btn booking-action-btn--chat" title="Чат с клиентом" onClick={(e) => { e.stopPropagation(); openChatWithClient(it.client); }}>
            💬
          </button>
        )}
        {isOrg && !cancelled && (
          <button type="button" className="booking-action-btn booking-action-btn--cancel" title="Отменить" onClick={(e) => orgBookingAction(it.id, "cancel-by-org", e)}>
            ✕
          </button>
        )}
        {isOrg && !cancelled && !done && (
          <button
            type="button"
            className="ghost-btn small booking-action-done"
            disabled={!bookingHasStarted(it)}
            title={
              bookingHasStarted(it)
                ? "Отметить, что услуга оказана"
                : "Можно отметить только после начала записи по времени"
            }
            onClick={(e) => orgBookingAction(it.id, "mark-done", e)}
          >
            Услуга оказана
          </button>
        )}
        {isClient && !cancelled && (
          <button type="button" className="booking-action-btn booking-action-btn--chat" title="Чат с организацией" onClick={(e) => { e.stopPropagation(); openChatWithProvider(it.provider); }}>
            💬
          </button>
        )}
        {isClient && !cancelled && (
          <button type="button" className="booking-action-btn booking-action-btn--cancel" title="Отменить запись" onClick={(e) => clientCancelBooking(it.id, e)}>
            ✕
          </button>
        )}
        {isClient && done && !bookingHasReview(it.id) && (
          <button
            type="button"
            className="ghost-btn small"
            onClick={(e) => {
              e.stopPropagation();
              openClientReviewModal(it);
            }}
          >
            Отзыв
          </button>
        )}
      </div>
    );
  }

  function renderBookingCalendar(title = "Записи") {
    const [year, month] = bookingsMonth.split("-").map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const offset = (firstDay.getDay() + 6) % 7;
    const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

    const byDay = bookings
      .filter((b) => isoMonthKey(b.slot_starts_at) === bookingsMonth)
      .reduce((acc, item) => {
        const d = new Date(item.slot_starts_at);
        const day = Number.isNaN(d.getTime()) ? Number(String(item.slot_starts_at).slice(8, 10)) : d.getDate();
        if (!acc[day]) acc[day] = [];
        acc[day].push(item);
        return acc;
      }, {});

    const cells = [];
    for (let i = 0; i < offset; i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);

    return (
      <section className="card full-width booking-calendar">
        <h2>{title}</h2>
        <input type="month" value={bookingsMonth} onChange={(e) => setBookingsMonth(e.target.value)} />
        <p className="muted small calendar-mobile-hint">На телефоне нажмите на день, чтобы открыть записи</p>
        <div className="calendar-grid">
          {weekdays.map((wd, wi) => (
            <div key={wd} className={`calendar-head ${wi >= 5 ? "weekend-head" : ""}`}>{wd}</div>
          ))}
          {cells.map((day, idx) => {
            const col = idx % 7;
            const weekend =
              day != null ? (offset + day - 1) % 7 >= 5 : col >= 5;
            const dayItems = day ? byDay[day] || [] : [];
            const isToday =
              day != null &&
              year === new Date().getFullYear() &&
              month === new Date().getMonth() + 1 &&
              day === new Date().getDate();
            return (
            <div
              key={`${day ?? "empty"}-${idx}`}
              className={`calendar-cell ${day ? "clickable calendar-cell--bookings" : "empty"} ${weekend ? "weekend-cell" : ""} ${dayItems.length ? "calendar-cell--has-items" : ""} ${isToday ? "calendar-cell--today" : ""}`}
              onClick={() => {
                if (!day) return;
                setCalendarDayDetail({
                  mode: "bookings",
                  day,
                  month: bookingsMonth,
                  items: dayItems,
                });
              }}
            >
              {day && (
                <>
                  <div className="calendar-day">{day}</div>
                  <div className="calendar-slots calendar-slots--desktop">
                    {dayItems.map((it) => (
                      <div
                        key={it.id}
                        className={["calendar-slot", "booking", bookingSlotStatusModifier(it)].filter(Boolean).join(" ")}
                      >
                        <div className="booking-slot-time">
                          {new Date(it.slot_starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          {" – "}
                          {new Date(it.slot_ends_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        <div className="booking-slot-name">{bookingSlotSecondaryLabel(it)}</div>
                        {it.status && it.status !== "confirmed" && (
                          <div className="booking-slot-status">{bookingStatusLabel(it.status)}</div>
                        )}
                        {renderBookingSlotActions(it)}
                      </div>
                    ))}
                  </div>
                  <div className="calendar-slots calendar-slots--mobile">
                    {dayItems.slice(0, 4).map((it) => {
                      const mod = bookingSlotStatusModifier(it);
                      const time = new Date(it.slot_starts_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      return (
                        <div
                          key={it.id}
                          className={["calendar-slot-compact", mod].filter(Boolean).join(" ")}
                          title={`${time} · ${bookingSlotSecondaryLabel(it)} · ${bookingStatusLabel(it.status)}`}
                          aria-label={`${time} ${bookingStatusLabel(it.status)}`}
                        >
                          <span className="calendar-slot-compact-icon" aria-hidden>
                            {bookingSlotCompactIcon(mod)}
                          </span>
                        </div>
                      );
                    })}
                    {dayItems.length > 4 ? <div className="calendar-slot-more">+{dayItems.length - 4}</div> : null}
                  </div>
                </>
              )}
            </div>
            );
          })}
        </div>
      </section>
    );
  }

  function renderBookingsBlock(title = "Записи") {
    return renderBookingCalendar(title);
  }

  function openClientReviewModal(booking, existingReview = null) {
    if (existingReview && reviewIsSupplemented(existingReview)) return;
    setReviewSubmitError("");
    if (existingReview) {
      setReviewModalReview(existingReview);
      setReviewForm({ rating: existingReview.rating, text: "" });
    } else {
      setReviewModalReview(null);
      setReviewForm({ rating: 5, text: "" });
    }
    setReviewModalBooking({ ...booking, staff_user_id: booking.staff || null });
  }

  function renderBookingHistoryReview(booking) {
    const review = getBookingReview(booking);
    if (!review) {
      if (me?.role === "client" && booking.status === "done") {
        return (
          <div className="booking-history-review">
            <button
              type="button"
              className="ghost-btn small"
              onClick={() => openClientReviewModal(booking)}
            >
              Оставить отзыв
            </button>
          </div>
        );
      }
      return null;
    }
    const photos = review.photos || [];
    return (
      <div className="booking-history-review">
        <div className="booking-history-review-head">
          <span className="review-stars" aria-label={`Оценка ${review.rating}`}>
            {"★".repeat(review.rating)}
            <span className="review-stars-empty">{"☆".repeat(5 - review.rating)}</span>
          </span>
          {me?.role === "client" && booking.status === "done" && !reviewIsSupplemented(review) && (
            <button
              type="button"
              className="ghost-btn small booking-history-review-supplement"
              onClick={() => openClientReviewModal(booking, review)}
            >
              Дополнить отзыв
            </button>
          )}
        </div>
        <ReviewTextContent
          review={review}
          mainClassName="booking-history-review-text"
          supplementClassName="booking-history-review-text review-text-supplement"
        />
        {photos.length > 0 && (
          <div className="booking-history-review-photos">
            {photos.map((ph) => (
              <a key={ph.id} href={reviewImageUrl(ph.url || ph.image)} target="_blank" rel="noreferrer">
                <img src={reviewImageUrl(ph.url || ph.image)} alt="" />
              </a>
            ))}
          </div>
        )}
        {review.reply?.text ? (
          <p className="booking-history-review-reply muted small">
            <strong>Ответ организации:</strong> {review.reply.text}
          </p>
        ) : null}
      </div>
    );
  }

  function renderBookingHistory() {
    const isClient = me?.role === "client";
    const sorted = [...bookings].sort(
      (a, b) => new Date(b.slot_starts_at || 0) - new Date(a.slot_starts_at || 0),
    );
    return (
      <section className="card full-width booking-history-card">
        <h2>История записей</h2>
        {sorted.length === 0 ? (
          <p className="muted">Записей пока нет.</p>
        ) : (
          <ul className="booking-history-list">
            {sorted.map((b) => {
              const counterpartyLabel = isClient
                ? (b.organization_name || "Организация")
                : bookingClientLabel(b);
              return (
                <li key={b.id} className={["booking-history-item", bookingSlotStatusModifier(b)].filter(Boolean).join(" ")}>
                  <div className="booking-history-top">
                    <div className="booking-history-main">
                      <p className="booking-history-datetime">{formatBookingDateTime(b.slot_starts_at)}</p>
                      <p className="booking-history-service muted small">
                        {(b.service_name || "Услуга").trim()}
                        {b.staff_display_name ? ` · ${b.staff_display_name}` : ""}
                      </p>
                      <p className="booking-history-price">{formatBookingPrice(b.service_price)}</p>
                      <p className="booking-history-counterparty">
                        {isClient ? (
                          <button
                            type="button"
                            className="booking-history-link"
                            onClick={() => openOrgCardFromHistory(b)}
                          >
                            {counterpartyLabel}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="booking-history-link"
                            onClick={() => openChatWithClient(b.client)}
                          >
                            {counterpartyLabel}
                          </button>
                        )}
                      </p>
                    </div>
                    <span
                      className={[
                        "booking-history-status",
                        b.status === "cancelled" && "booking-history-status--cancelled",
                        b.status === "done" && "booking-history-status--done",
                        b.status === "confirmed" && "booking-history-status--confirmed",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {bookingStatusLabel(b.status)}
                    </span>
                  </div>
                  {renderBookingHistoryReview(b)}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    );
  }

  function renderSlotCalendar(showCreateControls = false) {
    const [year, month] = calendarMonth.split("-").map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const offset = (firstDay.getDay() + 6) % 7;
    const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

    const byDay = slots
      .filter((s) => !s.is_booked && s.starts_at?.slice(0, 7) === calendarMonth)
      .reduce((acc, slot) => {
        const day = Number(slot.starts_at.slice(8, 10));
        if (!acc[day]) acc[day] = [];
        acc[day].push(slot);
        return acc;
      }, {});

    const cells = [];
    for (let i = 0; i < offset; i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);

    return (
      <section className="card full-width interval-calendar">
        <h2>Календарь интервалов</h2>
        {showCreateControls && (
          <>
            <form onSubmit={createSlotsByInterval} className="form">
              <div className="row-2">
                <input type="time" value={intervalForm.start_time} onChange={(e) => setIntervalForm({ ...intervalForm, start_time: e.target.value })} required />
                <input type="time" value={intervalForm.end_time} onChange={(e) => setIntervalForm({ ...intervalForm, end_time: e.target.value })} required />
              </div>
              <button type="submit">Создать интервал</button>
            </form>
            <p className="status">{sellerStatus}</p>
          </>
        )}
        <input type="month" value={calendarMonth} onChange={(e) => setCalendarMonth(e.target.value)} />
        <div className="interval-templates">
          <h3>Сохранённые интервалы</h3>
          {savedIntervals.length === 0 && <p className="muted">Пока нет сохранённых интервалов.</p>}
          <div className="template-list">
            {savedIntervals.map((template) => (
              <div
                key={template.id}
                className={`template-chip ${selectedIntervalId === template.id ? "active" : ""}`}
                draggable
                onClick={(e) => {
                  setSelectedIntervalId(template.id);
                  if (intervalPopoverId === template.id) {
                    closeIntervalPopover();
                    return;
                  }
                  const chip = e.currentTarget;
                  intervalPopoverAnchorRef.current = chip;
                  setIntervalPopoverFixedStyle(buildIntervalPopoverFixedStyle(chip));
                  setIntervalPopoverId(template.id);
                }}
                onDragStart={() => {
                  setDragIntervalId(template.id);
                  setSelectedIntervalId(template.id);
                }}
              >
                <div className="template-main"><strong>{template.start_time} - {template.end_time}</strong></div>
                <button
                  type="button"
                  className="template-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSavedIntervals((prev) => prev.filter((x) => x.id !== template.id));
                    if (selectedIntervalId === template.id) setSelectedIntervalId(null);
                    if (intervalPopoverId === template.id) closeIntervalPopover();
                  }}
                  aria-label="Удалить сохранённый интервал"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="calendar-grid">
          {weekdays.map((wd, wi) => (
            <div key={wd} className={`calendar-head ${wi >= 5 ? "weekend-head" : ""}`}>{wd}</div>
          ))}
          {cells.map((day, idx) => {
            const col = idx % 7;
            const weekend =
              day != null ? (offset + day - 1) % 7 >= 5 : col >= 5;
            const isToday =
              day != null &&
              year === new Date().getFullYear() &&
              month === new Date().getMonth() + 1 &&
              day === new Date().getDate();
            return (
            <div
              key={`${day ?? "empty"}-${idx}`}
              className={`calendar-cell ${day ? "clickable" : ""} ${day ? "" : "empty"} ${weekend ? "weekend-cell" : ""} ${isToday ? "calendar-cell--today" : ""}`}
              onClick={() => {
                if (!day) return;
                const selected = savedIntervals.find((x) => x.id === selectedIntervalId);
                if (!selected) {
                  setSellerStatus("Выбери сохранённый интервал.");
                  return;
                }
                applyIntervalToDay(day, selected);
              }}
              onDragOver={(e) => {
                if (!day) return;
                e.preventDefault();
              }}
              onDrop={(e) => {
                if (!day) return;
                e.preventDefault();
                const selected = savedIntervals.find((x) => x.id === dragIntervalId || x.id === selectedIntervalId);
                if (!selected) return;
                applyIntervalToDay(day, selected);
              }}
            >
              {day && (
                <>
                  <div className="calendar-day-row">
                    <div className="calendar-day">{day}</div>
                    {(byDay[day] || []).length > 0 && (
                      <button
                        type="button"
                        className="calendar-day-expand"
                        aria-label="Открыть день"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCalendarDayDetail({
                            mode: "intervals",
                            day,
                            month: calendarMonth,
                            items: byDay[day] || [],
                          });
                        }}
                      >
                        ▾
                      </button>
                    )}
                  </div>
                  <div className="calendar-slots calendar-slots--desktop">
                    {(byDay[day] || []).slice(0, 5).map((s) => (
                      <div
                        key={s.id}
                        className="slot-chip"
                        title="Свободный интервал"
                      >
                        <span className="slot-chip-label">
                          {new Date(s.starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          {" – "}
                          {new Date(s.ends_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <button
                          type="button"
                          className="chip-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSlot(s.id);
                          }}
                        >
                          x
                        </button>
                      </div>
                    ))}
                    {(byDay[day] || []).length > 5 && <div className="muted">+{(byDay[day] || []).length - 5}</div>}
                    {(byDay[day] || []).some((s) => s.recurrence_group) && (
                      <button
                        type="button"
                        className="small-btn ghost-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          const grp = (byDay[day] || []).find((s) => s.recurrence_group)?.recurrence_group;
                          if (grp) deleteSeries(grp);
                        }}
                      >
                        Удалить серию
                      </button>
                    )}
                  </div>
                  <div className="calendar-slots calendar-slots--mobile">
                    {(byDay[day] || []).slice(0, 3).map((s) => (
                      <div key={s.id} className="calendar-slot-compact calendar-slot-compact--interval" title="Свободный интервал">
                        <span className="calendar-slot-compact-time">
                          <span className="calendar-slot-compact-start">
                            {new Date(s.starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <span className="calendar-slot-compact-end">
                            {new Date(s.ends_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </span>
                      </div>
                    ))}
                    {(byDay[day] || []).length > 3 ? (
                      <div className="calendar-slot-more">+{(byDay[day] || []).length - 3}</div>
                    ) : null}
                  </div>
                </>
              )}
            </div>
            );
          })}
        </div>
        {intervalPopoverId != null &&
          intervalPopoverFixedStyle &&
          typeof document !== "undefined" &&
          (() => {
            const popTemplate = savedIntervals.find((t) => t.id === intervalPopoverId);
            if (!popTemplate) return null;
            return createPortal(
              <div
                className="template-popover template-popover--portal"
                style={intervalPopoverFixedStyle}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-label="Действия с интервалом"
              >
                <button type="button" className="small-btn" onClick={() => { setSelectedIntervalId(popTemplate.id); closeIntervalPopover(); }}>
                  Выбрать
                </button>
                <button type="button" className="small-btn" onClick={() => { applyIntervalByPattern("daily", popTemplate); closeIntervalPopover(); }}>
                  Применить на каждый день
                </button>
                <button type="button" className="small-btn" onClick={() => { applyIntervalByPattern("workweek", popTemplate); closeIntervalPopover(); }}>
                  Применить на рабочую неделю
                </button>
                <button type="button" className="small-btn" onClick={() => { applyIntervalByPattern("weekend", popTemplate); closeIntervalPopover(); }}>
                  Применить на выходные
                </button>
              </div>,
              document.body
            );
          })()}
      </section>
    );
  }

  function groupCategoryServices(cat) {
    const catServices = services.filter((s) => Number(s.category) === Number(cat.id));
    const groups = (cat.subcategories || []).map((sub) => ({
      sub,
      items: catServices.filter((s) => Number(s.subcategory) === Number(sub.id)),
    }));
    const loose = catServices.filter(
      (s) => !s.subcategory || !groups.some((g) => Number(g.sub.id) === Number(s.subcategory)),
    );
    return { groups, loose };
  }

  function renderServiceTree() {
    const activeCount = services.filter((s) => s.is_active).length;
    const sphereLabel =
      catalogStatus?.sphere_label ||
      sphereOptions.find((o) => o.key === me?.provider_sphere)?.value ||
      "";

    if (!catalogStatus?.catalog_seeded) {
      return (
        <div className="catalog-empty-state">
          <h2>Каталог услуг</h2>
          <p className="muted">
            Для сферы «{sphereLabel || "вашей сферы"}» подготовлен готовый каталог. Загрузите его и отметьте услуги,
            которые оказываете: укажите цену и длительность.
          </p>
          {catalogStatus?.has_template === false && (
            <p className="status error">Для этой сферы шаблон каталога пока недоступен.</p>
          )}
          <button
            type="button"
            disabled={catalogSeeding || catalogStatus?.has_template === false}
            onClick={seedProviderCatalog}
          >
            {catalogSeeding ? "Загрузка…" : "Загрузить каталог услуг"}
          </button>
        </div>
      );
    }

    return (
      <div>
        <div className="catalog-tree-head">
          <h2>Каталог услуг</h2>
          <p className="muted small">
            Сфера: {sphereLabel}. Активно {activeCount} из {services.length}.
            {dirtyServiceCount > 0 ? ` · Не сохранено: ${dirtyServiceCount}` : ""}
          </p>
        </div>
        <div className="tree-list catalog-tree">
          {categories.map((cat) => {
            const { groups, loose } = groupCategoryServices(cat);
            const catOpen = categoryOpen[cat.id] ?? true;
            const catActive = services.filter((s) => Number(s.category) === Number(cat.id) && s.is_active).length;
            return (
              <div key={cat.id} className="tree-node catalog-tree-category">
                <button
                  type="button"
                  className="tree-toggle"
                  onClick={() => setCategoryOpen((prev) => ({ ...prev, [cat.id]: !catOpen }))}
                >
                  {catOpen ? "▼" : "▶"} {cat.name}
                  <span className="catalog-tree-meta">{catActive} активн.</span>
                </button>
                {catOpen && (
                  <div className="tree-children">
                    {groups.map(({ sub, items }) => {
                      const subKey = `${cat.id}-${sub.id}`;
                      const subOpen = subcategoryOpen[subKey] ?? true;
                      return (
                        <div key={sub.id} className="catalog-tree-subcategory">
                          <button
                            type="button"
                            className="tree-toggle tree-toggle--sub"
                            onClick={() => setSubcategoryOpen((prev) => ({ ...prev, [subKey]: !subOpen }))}
                          >
                            {subOpen ? "▼" : "▶"} {sub.name}
                            <span className="catalog-tree-meta">
                              {items.filter((x) => x.is_active).length}/{items.length}
                            </span>
                          </button>
                          {subOpen && (
                            <div className="tree-children catalog-tree-services">
                              {items.map((srv) => (
                                <ServiceEditor
                                  key={srv.id}
                                  service={srv}
                                  draft={serviceDrafts[srv.id]}
                                  dirty={!serviceDraftEqualsService(serviceDrafts[srv.id], srv)}
                                  onDraftChange={updateServiceDraft}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {loose.length > 0 && (
                      <div className="catalog-tree-subcategory">
                        <div className="tree-toggle tree-toggle--sub">Прочее</div>
                        <div className="tree-children catalog-tree-services">
                          {loose.map((srv) => (
                            <ServiceEditor
                              key={srv.id}
                              service={srv}
                              draft={serviceDrafts[srv.id]}
                              dirty={!serviceDraftEqualsService(serviceDrafts[srv.id], srv)}
                              onDraftChange={updateServiceDraft}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const chatsTabUnreadChatsCount = useMemo(
    () => conversations.filter((c) => (Number(c.unread_message_count) || 0) > 0).length,
    [conversations],
  );

  const unreadMessagesCount = useMemo(() => {
    const fromList = conversations.reduce((s, c) => s + (Number(c.unread_message_count) || 0), 0);
    if (fromList > 0) return fromList;
    return Number(chatActivity?.unread_chat_messages_count) || 0;
  }, [conversations, chatActivity?.unread_chat_messages_count]);

  const orgFolderUnreadChatsCount = useMemo(
    () =>
      conversations.filter((c) => !c.is_client_correspondence && (Number(c.unread_message_count) || 0) > 0).length,
    [conversations],
  );

  const clientsFolderUnreadChatsCount = useMemo(
    () =>
      conversations.filter((c) => c.is_client_correspondence && (Number(c.unread_message_count) || 0) > 0).length,
    [conversations],
  );

  const filteredSidebarChats = useMemo(() => {
    let list = conversations;
    if (me?.role === "client") {
      list = list.filter((c) => c.is_client_correspondence && !c.is_saved_messages);
    } else {
      const folder = chatFolder;
      list = list.filter((c) => (folder === "clients" ? c.is_client_correspondence : !c.is_client_correspondence));
    }
    const q = chatSearchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => displayConversationTitle(c).toLowerCase().includes(q));
    }
    const folder = me?.role === "client" ? "clients" : chatFolder;
    const pins = folder === "clients" ? chatPins.clients : chatPins.org;
    const pinSet = new Set(pins.map(Number));
    const lastTs = (c) => {
      const t = c.last_message?.created_at;
      if (!t) return 0;
      const x = new Date(t).getTime();
      return Number.isNaN(x) ? 0 : x;
    };
    const pinnedList = pins.map((id) => list.find((c) => Number(c.id) === Number(id))).filter(Boolean);
    const unpinned = list.filter((c) => !pinSet.has(Number(c.id)));
    unpinned.sort((a, b) => {
      const d = lastTs(b) - lastTs(a);
      if (d !== 0) return d;
      return Number(b.id) - Number(a.id);
    });
    return [...pinnedList, ...unpinned];
  }, [conversations, chatFolder, chatSearchQuery, chatLocalPrefs, chatPins, me?.role]);

  function renderGeneralSettings() {
    return (
      <section className="card profile-card">
        <h2>Настройки</h2>
        <div className="form">
          <h3>Оформление</h3>
          <p className="muted">Тёмная тема сохраняется в этом браузере.</p>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={appTheme === "dark"}
              onChange={(e) => setAppTheme(e.target.checked ? "dark" : "light")}
            />
            Тёмная тема
          </label>
        </div>
        <form onSubmit={changePassword} className="form">
          <h3>Смена пароля</h3>
          <PasswordInput
            value={passwordForm.old_password}
            onChange={(e) => setPasswordForm({ ...passwordForm, old_password: e.target.value })}
            placeholder="Старый пароль"
            autoComplete="current-password"
          />
          <PasswordInput
            value={passwordForm.new_password}
            onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
            placeholder="Новый пароль"
            autoComplete="new-password"
          />
          <PasswordInput
            value={passwordForm.new_password_confirm}
            onChange={(e) => setPasswordForm({ ...passwordForm, new_password_confirm: e.target.value })}
            placeholder="Повтори новый пароль"
            autoComplete="new-password"
          />
          <button type="submit">Сменить пароль</button>
        </form>
        <form onSubmit={changeEmail} className="form">
          <h3>Смена почты</h3>
          <input type="email" value={emailForm.new_email} onChange={(e) => setEmailForm({ new_email: e.target.value })} placeholder="Новый email" />
          <button type="submit">Сменить email</button>
        </form>
        {!me?.email_verified && (
          <>
            <p className="status">Подтверди email для полноценной работы.</p>
            <button type="button" onClick={resendVerification}>Отправить письмо повторно</button>
            <p className="status">{resendStatus}</p>
          </>
        )}
      </section>
    );
  }

  function renderOrganizationSettings() {
    if (!canManageOrgSettings) return null;
    return (
      <section className="card profile-card">
        <h2>Организация</h2>
        {me?.role === "staff" && staffEffectivePerms.can_delegate_permissions && (
          <p className="muted">Адрес организации и филиалы настраивает руководитель. Команду, должности и права — в разделе «Сотрудники».</p>
        )}
        {me?.role === "provider" && (
          <>
            <h3 id="org-booking-messages">Сообщения при работе с записями</h3>
            <form
              onSubmit={saveOrgBookingMessages}
              className={[
                "form booking-messages-form",
                orgSettingsHighlight && "org-settings-highlight",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <BookingMessageField
                  id="org-msg-confirm"
                  presetKey="confirm"
                  label="Подтверждение записи"
                  value={orgBookingMessages.confirm}
                  onChange={(v) => setOrgBookingMessages((p) => ({ ...p, confirm: v }))}
                  highlighted={orgSettingsHighlight === "confirm"}
                />
                <BookingMessageField
                  id="org-msg-cancel"
                  presetKey="cancel"
                  label="Отмена записи"
                  value={orgBookingMessages.cancel}
                  onChange={(v) => setOrgBookingMessages((p) => ({ ...p, cancel: v }))}
                  highlighted={orgSettingsHighlight === "cancel"}
                />
                <BookingMessageField
                  id="org-msg-done"
                  presetKey="done"
                  label="Услуга оказана"
                  value={orgBookingMessages.done}
                  onChange={(v) => setOrgBookingMessages((p) => ({ ...p, done: v }))}
                  highlighted={orgSettingsHighlight === "done"}
                />
              <button type="submit">Сохранить сообщения</button>
            </form>
            <aside className="booking-messages-hint" aria-labelledby="booking-messages-hint-title">
              <h4 id="booking-messages-hint-title">Как это работает</h4>
              <p>
                Перетащите метку <strong>«Дата и время записи»</strong> в поле сообщения или нажмите на неё под полем —
                в тексте она отобразится такой же кнопкой, а не кодом.
              </p>
              <p>
                Когда вы подтверждаете, отменяете или завершаете запись, метка автоматически заменяется на дату и время
                клиента, например <strong>17.05.2026 14:30</strong>.
              </p>
              <p className="muted small booking-messages-hint-example">
                Пример: «Ваша запись подтверждена на» + метка «Дата и время записи» + «. Ждём вас!»
              </p>
            </aside>

            

            <h3>Карточка для клиентов</h3>

            <p className="muted small">Режим работы, телефоны, фото и дополнительная информация отображаются при выборе организации на карте.</p>

            <form onSubmit={saveOrgProfileInfo} className="form org-profile-form">

              <p className="field-label">Режим работы</p>

              <div className="org-hours-grid">

                {ORG_WEEKDAYS.map(({ key, label }) => (

                  <div key={key} className="org-hours-row">

                    <label className="checkbox org-hours-closed">

                      <input

                        type="checkbox"

                        checked={Boolean(orgProfileForm.working_hours[key]?.closed)}

                        onChange={(e) =>

                          setOrgProfileForm((p) => ({

                            ...p,

                            working_hours: {

                              ...p.working_hours,

                              [key]: { ...p.working_hours[key], closed: e.target.checked },

                            },

                          }))

                        }

                      />

                      {label} — выходной

                    </label>

                    <div className="org-hours-times">

                      <input

                        type="time"

                        disabled={orgProfileForm.working_hours[key]?.closed}

                        value={orgProfileForm.working_hours[key]?.open || "09:00"}

                        onChange={(e) =>

                          setOrgProfileForm((p) => ({

                            ...p,

                            working_hours: {

                              ...p.working_hours,

                              [key]: { ...p.working_hours[key], open: e.target.value },

                            },

                          }))

                        }

                      />

                      <span>—</span>

                      <input

                        type="time"

                        disabled={orgProfileForm.working_hours[key]?.closed}

                        value={orgProfileForm.working_hours[key]?.close || "18:00"}

                        onChange={(e) =>

                          setOrgProfileForm((p) => ({

                            ...p,

                            working_hours: {

                              ...p.working_hours,

                              [key]: { ...p.working_hours[key], close: e.target.value },

                            },

                          }))

                        }

                      />

                    </div>

                  </div>

                ))}

              </div>

              <label className="field-label">Телефоны</label>

              {orgProfileForm.phones.map((ph, idx) => (

                <div key={idx} className="org-phone-row">

                  <input

                    type="tel"

                    placeholder="+7 …"

                    value={ph}

                    onChange={(e) =>

                      setOrgProfileForm((p) => {

                        const phones = [...p.phones];

                        phones[idx] = e.target.value;

                        return { ...p, phones };

                      })

                    }

                  />

                  <button

                    type="button"

                    className="ghost-btn"

                    onClick={() =>

                      setOrgProfileForm((p) => ({

                        ...p,

                        phones: p.phones.filter((_, i) => i !== idx),

                      }))

                    }

                  >

                    ✕

                  </button>

                </div>

              ))}

              <button

                type="button"

                className="ghost-btn"

                onClick={() => setOrgProfileForm((p) => ({ ...p, phones: [...p.phones, ""] }))}

              >

                + Телефон

              </button>

              <label className="field-label">Сайты</label>

              {orgProfileForm.websites.map((site, idx) => (
                <div key={idx} className="org-phone-row">
                  <input
                    type="url"
                    placeholder="https://example.ru"
                    value={site}
                    onChange={(e) =>
                      setOrgProfileForm((p) => {
                        const websites = [...p.websites];
                        websites[idx] = e.target.value;
                        return { ...p, websites };
                      })
                    }
                  />
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() =>
                      setOrgProfileForm((p) => ({
                        ...p,
                        websites: p.websites.filter((_, i) => i !== idx),
                      }))
                    }
                  >
                    ✕
                  </button>
                </div>
              ))}

              <button
                type="button"
                className="ghost-btn"
                onClick={() => setOrgProfileForm((p) => ({ ...p, websites: [...p.websites, ""] }))}
              >
                + Сайт
              </button>

              <label className="field-label" htmlFor="org-card-note">Дополнительно (для клиентов)</label>

              <textarea

                id="org-card-note"

                rows={3}

                placeholder="Например: парковка во дворе, вход со двора"

                value={orgProfileForm.card_note}

                onChange={(e) => setOrgProfileForm((p) => ({ ...p, card_note: e.target.value }))}

              />

              <label className="field-label">
                Фото организации ({orgGalleryPhotos.length}/{ORG_GALLERY_MAX_PHOTOS})
              </label>
              <p className="muted small">Не более {ORG_GALLERY_MAX_PHOTOS} фото. Сначала показываются они, затем фото из отзывов.</p>
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={orgGalleryPhotos.length >= ORG_GALLERY_MAX_PHOTOS}
                onChange={async (e) => {
                  const files = [...(e.target.files || [])];
                  const slotsLeft = ORG_GALLERY_MAX_PHOTOS - orgGalleryPhotos.length;
                  for (const f of files.slice(0, slotsLeft)) {
                    const ok = await uploadOrgGalleryPhoto(f);
                    if (!ok) break;
                  }
                  e.target.value = "";
                }}
              />

              {orgGalleryPhotos.length > 0 && (

                <div className="org-gallery-grid">

                  {orgGalleryPhotos.map((ph) => (

                    <div key={ph.id} className="org-gallery-item">

                      <img src={ph.url} alt="" />

                      <button type="button" className="ghost-btn" onClick={() => deleteOrgGalleryPhoto(ph.id)}>

                        Удалить

                      </button>

                    </div>

                  ))}

                </div>

              )}

              <button type="submit">Сохранить карточку</button>

              <p className="status">{orgProfileSaveStatus}</p>

            </form>

<h3>Адрес организации (основной)</h3>
            {!orgMainEditOpen ? (
              <div className="org-main-display">
                <p className="org-display-line"><strong>{orgAddressForm.organization_name || "—"}</strong></p>
                <p className="org-display-line">{composeOrgDisplayFromMe(me) || "Адрес не указан."}</p>
                <div id="profile-address-map" className="map-box" />
                <button type="button" className="ghost-btn" onClick={() => { syncOrgAddressFormFromMe(); setOrgMainEditOpen(true); }}>Изменить</button>
                <p className="status">{profileOrgStatus}</p>
              </div>
            ) : (
              <form onSubmit={saveProviderOrganization} className="form org-main-edit-form">
                <input
                  placeholder="Название организации"
                  value={orgAddressForm.organization_name}
                  onChange={(e) => setOrgAddressForm({ ...orgAddressForm, organization_name: e.target.value })}
                  required
                />
                <input
                  placeholder="Адрес (улица, дом)"
                  value={orgAddressForm.organization_address}
                  onChange={(e) => onProfileAddressInput(e.target.value)}
                  onBlur={(e) => geocodeProfileAddress(e.target.value)}
                  required
                />
                {detectedCity && <p className="hint">Город поиска: {detectedCity}</p>}
                {addressSuggestions.length > 0 && (
                  <div className="suggestions">
                    {addressSuggestions.map((item, idx) => (
                      <button
                        key={`${item.value}-${idx}`}
                        type="button"
                        className="suggestion-item"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pickProfileSuggestion(item)}
                      >
                        {item.value}
                      </button>
                    ))}
                  </div>
                )}
                <div id="profile-address-map" className="map-box" />
                <div className="address-details-grid">
                  <input placeholder="Подъезд" value={orgAddressForm.entrance} onChange={(e) => setOrgAddressForm({ ...orgAddressForm, entrance: e.target.value })} />
                  <input placeholder="Этаж" value={orgAddressForm.floor} onChange={(e) => setOrgAddressForm({ ...orgAddressForm, floor: e.target.value })} />
                  <input placeholder="Квартира/офис" value={orgAddressForm.apartment} onChange={(e) => setOrgAddressForm({ ...orgAddressForm, apartment: e.target.value })} />
                  <input placeholder="Домофон" value={orgAddressForm.intercom} onChange={(e) => setOrgAddressForm({ ...orgAddressForm, intercom: e.target.value })} />
                </div>
                <input
                  placeholder="Доп. ориентир (необязательно)"
                  value={orgAddressForm.organization_address_details}
                  onChange={(e) => setOrgAddressForm({ ...orgAddressForm, organization_address_details: e.target.value })}
                />
                <div className="row-2">
                  <button type="submit">Сохранить</button>
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => {
                      syncOrgAddressFormFromMe();
                      setOrgMainEditOpen(false);
                      setProfileOrgStatus("");
                    }}
                  >
                    Отмена
                  </button>
                </div>
                <p className="status">{profileOrgStatus}</p>
              </form>
            )}

            <h3>Филиалы</h3>
            <button
              type="button"
              className="ghost-btn org-branch-add-toggle"

              onClick={() => {
                setOrgBranchAddOpen((v) => {
                  const next = !v;
                  if (next) {
                    setSelectedOrgBranchId(null);
                    setOrgBranchEditOpen(false);
                    setLocationForm(emptyLocationFormState());
                    setBranchGeoStatus("");
                    setAddressSuggestions([]);
                  }
                  return next;
                });
              }}
            >
              {orgBranchAddOpen ? "Закрыть форму добавления" : "Добавить филиал"}
            </button>
            {orgBranchAddOpen && (
              <form onSubmit={createProviderBranch} className="form org-branch-add-form">
                <input placeholder="Название филиала" value={locationForm.title} onChange={(e) => setLocationForm({ ...locationForm, title: e.target.value })} required />
                <input
                  placeholder="Адрес филиала"
                  value={locationForm.address}
                  onChange={(e) => onBranchAddressInput(e.target.value)}
                  onBlur={() => geocodeBranchAddress()}
                  required
                />
                {detectedCity && <p className="hint">Город поиска: {detectedCity}</p>}
                {addressSuggestions.length > 0 && (
                  <div className="suggestions">
                    {addressSuggestions.map((item, idx) => (
                      <button
                        key={`branch-add-${item.value}-${idx}`}
                        type="button"
                        className="suggestion-item"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pickBranchLocationSuggestion(item)}
                      >
                        {item.value}
                      </button>
                    ))}
                  </div>
                )}
                <button type="button" className="ghost-btn" onClick={geocodeBranchAddress}>Найти адрес на карте</button>
                <div id="branch-add-map" className="map-box" />
                <div className="address-details-grid">
                  <input placeholder="Подъезд" value={locationForm.entrance} onChange={(e) => setLocationForm({ ...locationForm, entrance: e.target.value })} />
                  <input placeholder="Этаж" value={locationForm.floor} onChange={(e) => setLocationForm({ ...locationForm, floor: e.target.value })} />
                  <input placeholder="Квартира/офис" value={locationForm.apartment} onChange={(e) => setLocationForm({ ...locationForm, apartment: e.target.value })} />
                  <input placeholder="Домофон" value={locationForm.intercom} onChange={(e) => setLocationForm({ ...locationForm, intercom: e.target.value })} />
                </div>
                <input
                  placeholder="Доп. ориентир (необязательно)"
                  value={locationForm.address_details}
                  onChange={(e) => setLocationForm({ ...locationForm, address_details: e.target.value })}
                />
                <button type="submit">Сохранить филиал</button>
              </form>
            )}
            <ul className="list org-branch-list">
              {location.map((loc) => (
                <li key={loc.id}>
                  <button
                    type="button"
                    className={`org-branch-pick ${Number(selectedOrgBranchId) === Number(loc.id) ? "active" : ""}`}
                    onClick={() => {
                      setSelectedOrgBranchId(loc.id);
                      setOrgBranchAddOpen(false);
                      setOrgBranchEditOpen(false);
                      setBranchGeoStatus("");
                    }}
                  >
                    <span className="org-branch-pick-title">{loc.title}</span>
                    <span className="org-branch-pick-addr muted">{composeBranchDisplay(loc)}</span>
                  </button>
                </li>
              ))}
            </ul>
            {location.length === 0 && !orgBranchAddOpen && <p className="muted">Пока нет филиалов.</p>}
            {selectedOrgBranchId != null && !orgBranchAddOpen && (() => {
              const br = location.find((l) => Number(l.id) === Number(selectedOrgBranchId));
              if (!br) return null;
              return (
                <div className="org-branch-detail">
                  <h4>{br.title}</h4>
                  <p className="org-branch-detail-addr">{composeBranchDisplay(br)}</p>
                  {!orgBranchEditOpen ? (
                    <>
                      <div id="branch-detail-map" className="map-box" />
                      <div className="row-2">
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => {
                            setAddressSuggestions([]);
                            setOrgBranchEditOpen(true);
                            setLocationForm(parseBranchRecordForForm(br));
                          }}
                        >
                          Изменить
                        </button>
                        <button type="button" className="ghost-btn" onClick={() => deleteProviderBranch(br.id)}>Удалить</button>
                      </div>
                    </>
                  ) : (
                    <form onSubmit={saveProviderBranchEdit} className="form">
                      <input placeholder="Название филиала" value={locationForm.title} onChange={(e) => setLocationForm({ ...locationForm, title: e.target.value })} required />
                      <input
                        placeholder="Адрес"
                        value={locationForm.address}
                        onChange={(e) => onBranchAddressInput(e.target.value)}
                        onBlur={() => geocodeBranchAddress()}
                        required
                      />
                      {detectedCity && <p className="hint">Город поиска: {detectedCity}</p>}
                      {addressSuggestions.length > 0 && (
                        <div className="suggestions">
                          {addressSuggestions.map((item, idx) => (
                            <button
                              key={`branch-edit-${item.value}-${idx}`}
                              type="button"
                              className="suggestion-item"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => pickBranchLocationSuggestion(item)}
                            >
                              {item.value}
                            </button>
                          ))}
                        </div>
                      )}
                      <button type="button" className="ghost-btn" onClick={geocodeBranchAddress}>Найти адрес на карте</button>
                      <div id="branch-edit-map" className="map-box" />
                      <div className="address-details-grid">
                        <input placeholder="Подъезд" value={locationForm.entrance} onChange={(e) => setLocationForm({ ...locationForm, entrance: e.target.value })} />
                        <input placeholder="Этаж" value={locationForm.floor} onChange={(e) => setLocationForm({ ...locationForm, floor: e.target.value })} />
                        <input placeholder="Квартира/офис" value={locationForm.apartment} onChange={(e) => setLocationForm({ ...locationForm, apartment: e.target.value })} />
                        <input placeholder="Домофон" value={locationForm.intercom} onChange={(e) => setLocationForm({ ...locationForm, intercom: e.target.value })} />
                      </div>
                      <input
                        placeholder="Доп. ориентир (необязательно)"
                        value={locationForm.address_details}
                        onChange={(e) => setLocationForm({ ...locationForm, address_details: e.target.value })}
                      />
                      <div className="row-2">
                        <button type="submit">Сохранить</button>
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => {
                            setOrgBranchEditOpen(false);
                            setLocationForm(parseBranchRecordForForm(br));
                          }}
                        >
                          Отмена
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              );
            })()}
            <p className="status">{branchGeoStatus}</p>
          </>
        )}
      </section>
    );
  }

  function renderStaffManagement() {
    if (!canManageOrgSettings) return null;
    return (
      <section className="card profile-card">
        <h2>Сотрудники</h2>
        {me?.role === "staff" && staffEffectivePerms.can_delegate_permissions && (
          <p className="muted">Адрес организации и филиалы настраивает руководитель в разделе «Организация». Здесь — команда, должности и права доступа.</p>
        )}
        {me?.role === "provider" && (
          <p className="muted">Руководитель настраивает всё. Сотрудник с правом «Может настраивать права других» видит этот раздел и может менять права коллег.</p>
        )}
        {me?.role === "provider" && (
          <form onSubmit={inviteStaff} className="form">
            <input
              placeholder="Email или логин сотрудника"
              value={staffInviteForm.invite_identifier}
              onChange={(e) => setStaffInviteForm({ ...staffInviteForm, invite_identifier: e.target.value })}
            />
            <button type="submit">Добавить сотрудника</button>
          </form>
        )}
        <p className="status">{staffInviteStatus}</p>
        <ul className="list staff-list">
          {orgStaff.map((link) => {
            const permBase = {
              manage_bookings: true,
              manage_intervals: false,
              manage_services: false,
              manage_chats: true,
              manage_client_chats: true,
              manage_staff: false,
              can_delegate_permissions: false,
              ...(link.permissions || {}),
            };
            const permLabels = [
              ["manage_bookings", "Записи клиентов"],
              ["manage_intervals", "Календарь интервалов"],
              ["manage_services", "Услуги и категории"],
              ["manage_chats", "Чаты организации"],
              ["manage_client_chats", "Чаты с клиентами"],
              ["manage_staff", "Добавление сотрудников"],
              ["can_delegate_permissions", "Может настраивать права других"],
            ];
            const rowName = formatStaffClientName(link.staff_user);
            const permsOpen = staffPermsOpenId === link.id;
            return (
              <li key={link.id} className="staff-block">
                <div className="staff-row">
                  <span>
                    {rowName}
                    {link.invitation_status === "pending"
                      ? " — ожидает подтверждения"
                      : link.is_active
                        ? ""
                        : " — отключён"}
                  </span>
                </div>
                <div className="staff-job-deact-row">
                  <div className="staff-job-col">
                    <label className="muted small-label">Должность</label>
                    <input
                      className="job-title-input"
                      placeholder="Например, администратор"
                      defaultValue={link.job_title || ""}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== (link.job_title || "").trim()) patchStaffMeta(link.id, { job_title: v });
                      }}
                    />
                  </div>
                  {me?.role === "provider" && link.is_active && link.invitation_status !== "pending" && (
                    <div className="staff-deact-cell">
                      <button type="button" className="staff-deactivate-btn ghost-btn" onClick={() => deactivateStaff(link.id)}>
                        Отключить
                      </button>
                    </div>
                  )}
                </div>
                {link.is_active && (me?.role === "provider" || staffEffectivePerms.can_delegate_permissions) && (
                  <div className="staff-perms">
                    <button
                      type="button"
                      className="staff-perms-toggle muted small-label"
                      onClick={() => setStaffPermsOpenId((id) => (id === link.id ? null : link.id))}
                    >
                      Права доступа{permsOpen ? " ▲" : " ▼"}
                    </button>
                    {permsOpen && (
                      <div className="perm-grid">
                        {permLabels.map(([key, label]) => (
                          <label key={key} className="checkbox perm-item">
                            <input
                              type="checkbox"
                              checked={Boolean(permBase[key])}
                              onChange={() => toggleStaffPermission(link, key)}
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {link.is_active && (me?.role === "provider" || staffEffectivePerms.can_delegate_permissions) && (
                  <div className="staff-perms">
                    <button
                      type="button"
                      className="staff-perms-toggle muted small-label"
                      onClick={() => setStaffServicesOpenId((id) => (id === link.id ? null : link.id))}
                    >
                      Услуги сотрудника{staffServicesOpenId === link.id ? " ▲" : " ▼"}
                    </button>
                    {staffServicesOpenId === link.id && (
                      <StaffServicesAssignment
                        link={link}
                        categories={staffAssignableCategories}
                        services={staffAssignableServices}
                        onSave={patchStaffServiceAssignment}
                      />
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {orgStaff.length === 0 && <p className="muted">Пока нет привязанных сотрудников.</p>}
      </section>
    );
  }

  const selectedConv = useMemo(
    () => conversations.find((c) => Number(c.id) === Number(selectedChatId)),
    [conversations, selectedChatId],
  );

  const chatPeerPresenceLine = useMemo(() => {
    if (!selectedConv?.org_direct_peer_status) return "";
    const s = selectedConv.org_direct_peer_status;
    if (s.is_online) return "в сети";
    if (s.last_seen_at) return formatLastSeenLabel(s.last_seen_at);
    return "не в сети";
  }, [selectedConv]);

  const chatMsgSearchHits = useMemo(() => {
    const q = chatMsgSearchQuery.trim().toLowerCase();
    if (!q) return [];
    return chatMessages.filter((m) => chatMessagePlainText(m).toLowerCase().includes(q));
  }, [chatMessages, chatMsgSearchQuery]);

  useEffect(() => {
    setChatMsgSearchActiveIdx((i) => {
      if (!chatMsgSearchHits.length) return 0;
      return Math.min(i, chatMsgSearchHits.length - 1);
    });
  }, [chatMsgSearchHits]);

  useEffect(() => {
    if (!chatMsgSearchOpen) return;
    const hit = chatMsgSearchHits[chatMsgSearchActiveIdx];
    if (!hit) return;
    scrollChatToMessageId(hit.id);
  }, [chatMsgSearchActiveIdx, chatMsgSearchHits, chatMsgSearchOpen]);

  useEffect(() => {
    if (chatMsgSearchOpen) {
      requestAnimationFrame(() => chatMsgSearchInputRef.current?.focus());
    }
  }, [chatMsgSearchOpen]);

  useEffect(() => {
    if (!selectedChatId) {
      setChatMsgSearchOpen(false);
      setChatMsgSearchQuery("");
      setChatMsgSearchActiveIdx(0);
      setChatInfoOpen(false);
      setChatPendingFiles([]);
      setChatPendingKind("");
      discardChatMediaPreview();
      if (chatRecordingKind) cancelChatRecording();
    }
  }, [selectedChatId]);

  const chatMediaGroups = useMemo(() => groupChatMedia(chatMessages, BASE_URL), [chatMessages]);

  const chatInfoPeer = useMemo(() => {
    if (!selectedConv) return null;
    const st = selectedConv.org_direct_peer_status;
    if (st) return st;
    const peers = (selectedConv.members || []).filter((m) => Number(m.user) !== Number(me?.id));
    if (!peers.length) return null;
    const p = peers[0];
    return {
      is_online: p.is_online,
      last_seen_at: p.last_seen_at,
      first_name: p.first_name,
      last_name: p.last_name,
      patronymic: p.patronymic,
      username: p.username,
      organization_name: p.organization_name,
      role: p.role,
    };
  }, [selectedConv, me?.id]);
  const activeChatWallpaper = selectedChatId ? chatLocalPrefs[selectedChatId]?.wallpaper : null;
  const tgMainStyle = activeChatWallpaper
    ? String(activeChatWallpaper).includes("gradient")
      ? { background: activeChatWallpaper, backgroundSize: "cover" }
      : { backgroundColor: activeChatWallpaper }
    : undefined;
  const tgMainDark = activeChatWallpaper === "#1e2a24";
  const centeredWorkspace = accessToken && ["profile", "organization", "staff", "settings", "subscriptions"].includes(currentView);

  return (
    <div className={`page${accessToken ? " page-logged" : " page--guest"}`}>
      <header className={`hero top-row${!accessToken ? " page-header-guest" : ""}`}>
        <button
          type="button"
          className="brand-link brand-btn"
          onClick={() => {
            if (!accessToken) window.scrollTo({ top: 0, behavior: "smooth" });
            else setCurrentView(me?.role === "client" ? "client_map" : "bookings");
          }}
        >
          <img
            src={logoMain}
            alt="Вместе"
            className="brand-logo"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </button>
        <div>{verifyStatus && <p className="verify-note">{verifyStatus}</p>}</div>
        {accessToken && me?.role === "client" && (
          <div className="client-header-search">
            <div className="client-header-search-input-wrap" ref={clientHeaderSearchWrapRef}>
              <input
                type="search"
                className="client-header-search-input"
                placeholder="Сфера или название организации…"
                value={clientMapSearchInput}
                onChange={(e) => setClientMapSearchInput(e.target.value)}
                onFocus={() => setClientMapSearchFocused(true)}
                autoComplete="off"
                aria-label="Поиск на карте"
                aria-expanded={showClientDiscoverSearchDropdown}
                aria-controls="client-org-search-list"
                aria-autocomplete="list"
              />
              {showClientDiscoverSearchDropdown && (
                <ul
                  id="client-org-search-list"
                  className="client-org-search-dropdown"
                  role="listbox"
                  aria-label="Организации"
                >
                  {clientDiscoverSearchOrgs.length === 0 &&
                    clientDiscoverSearch.trim() === clientMapSearchInput.trim() && (
                      <li className="client-org-search-empty" role="presentation">
                        Ничего не найдено
                      </li>
                    )}
                  {clientDiscoverSearchOrgs.map((loc) => {
                    const name = loc.organization_name || loc.title || "Организация";
                    const sphereLabel =
                      loc.sphere_label ||
                      sphereOptions.find((o) => o.key === loc.provider_sphere)?.value ||
                      "";
                    const rating =
                      loc.provider_average_rating != null
                        ? Number(loc.provider_average_rating).toFixed(1)
                        : null;
                    return (
                      <li key={loc.provider} role="option">
                        <button
                          type="button"
                          className="client-org-search-item"
                          onClick={() => {
                            setClientMapSearchFocused(false);
                            openOrgOnMap(loc);
                          }}
                        >
                          <span className="client-org-search-thumb">
                            {loc.provider_cover_url ? (
                              <img src={loc.provider_cover_url} alt="" />
                            ) : (
                              <img
                                src={sphereMapIconHref(loc.provider_sphere)}
                                alt=""
                                className="client-org-search-thumb-sphere"
                              />
                            )}
                          </span>
                          <span className="client-org-search-body">
                            <span className="client-org-search-name">{name}</span>
                            <span className="client-org-search-meta">
                              {rating != null && (
                                <span className="client-org-search-rating">★ {rating}</span>
                              )}
                              {sphereLabel && (
                                <span className="client-org-search-sphere">{sphereLabel}</span>
                              )}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <button
              type="button"
              className="client-filter-icon-btn"
              aria-label="Фильтры"
              title="Фильтры"
              onClick={() => {
                setClientFilterModalDraft({ ...clientDiscoverFilters });
                setClientFiltersOpen(true);
              }}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z" />
              </svg>
            </button>
          </div>
        )}
        {!accessToken && (
          <div className="landing-header-auth">
            <button type="button" className="landing-header-btn landing-header-btn--login" onClick={() => openAuth("login")}>
              Войти
            </button>
            <button type="button" className="landing-header-btn landing-header-btn--primary" onClick={() => openAuth("register")}>
              Регистрация
            </button>
          </div>
        )}
        {accessToken && (
          <div className={`menu-wrap${menuOpen ? " menu-wrap--open" : ""}`} ref={menuWrapRef}>
            <div className="menu-btn-wrap">
              <button
                type="button"
                className="menu-btn menu-btn--icon"
                aria-label="Меню"
                aria-expanded={menuOpen}
                title="Меню"
                onClick={() => setMenuOpen((v) => !v)}
              >
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
                  <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
                </svg>
              </button>
              {(chatActivity?.badge_count ?? 0) > 0 && (
                <span className="menu-nav-badge" aria-hidden="true">
                  {chatActivity.badge_count > 99 ? "99+" : chatActivity.badge_count}
                </span>
              )}
            </div>
            {menuOpen && (
              <div className="menu-dropdown">
                <button type="button" className="menu-dropdown-item" onClick={() => { setCurrentView("profile"); setMenuOpen(false); }}>
                  <span className="menu-item-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
                  </span>
                  <span className="menu-item-label">Личный кабинет</span>
                  {(chatActivity?.badge_count ?? 0) > 0 && (
                    <span className="menu-item-badge">{chatActivity.badge_count > 99 ? "99+" : chatActivity.badge_count}</span>
                  )}
                </button>
                <button type="button" className="menu-dropdown-item" onClick={() => { setCurrentView("settings"); setMenuOpen(false); }}>
                  <span className="menu-item-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" /></svg>
                  </span>
                  <span className="menu-item-label">Настройки</span>
                </button>
                <button type="button" className="menu-dropdown-item" onClick={() => { setCurrentView("booking_history"); setMenuOpen(false); }}>
                  <span className="menu-item-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" /></svg>
                  </span>
                  <span className="menu-item-label">История записей</span>
                </button>
                <button type="button" className="menu-dropdown-item" onClick={() => { setCurrentView("subscriptions"); setMenuOpen(false); }}>
                  <span className="menu-item-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z" /></svg>
                  </span>
                  <span className="menu-item-label">Подписки</span>
                </button>
                {canManageOrgSettings && (
                  <button type="button" className="menu-dropdown-item" onClick={() => { setCurrentView("staff"); setMenuOpen(false); }}>
                    <span className="menu-item-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" /></svg>
                    </span>
                    <span className="menu-item-label">Сотрудники</span>
                  </button>
                )}
                {canManageOrgSettings && (
                  <button type="button" className="menu-dropdown-item" onClick={() => { setCurrentView("organization"); setMenuOpen(false); }}>
                    <span className="menu-item-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z" /></svg>
                    </span>
                    <span className="menu-item-label">Организация</span>
                  </button>
                )}
                <button type="button" className="menu-dropdown-item" onClick={logout}>
                  <span className="menu-item-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" /></svg>
                  </span>
                  <span className="menu-item-label">Выйти</span>
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {intervalToast && (
        <div className="interval-toast" role="alert">
          {intervalToast}
        </div>
      )}

      {accessToken && me?.role === "client" && (
        <nav className="app-subnav" aria-label="Разделы клиента">
          <button type="button" className={currentView === "client_map" ? "active" : ""} onClick={() => setCurrentView("client_map")}>
            Карта
          </button>
          <button type="button" className={currentView === "bookings" ? "active" : ""} onClick={() => setCurrentView("bookings")}>
            Мои записи
          </button>
          <button
            type="button"
            className={["app-subnav-chat", currentView === "chats" && "active"].filter(Boolean).join(" ")}
            onClick={() => {
              if (isMobileChatLayout()) setSelectedChatId(null);
              setCurrentView("chats");
            }}
          >
            <span>Чаты</span>
            {unreadMessagesCount > 0 && (
              <span className="app-subnav-badge" aria-label={`Непрочитанных сообщений: ${unreadMessagesCount}`}>
                {unreadMessagesCount > 99 ? "99+" : unreadMessagesCount}
              </span>
            )}
          </button>
        </nav>
      )}

      {accessToken && me?.role === "provider" && (
        <nav className="app-subnav app-subnav--scroll" aria-label="Разделы исполнителя">
          <button type="button" className={currentView === "bookings" ? "active" : ""} onClick={() => setCurrentView("bookings")}>Записи</button>
          <button
            type="button"
            className={["app-subnav-reviews", currentView === "reviews" && "active"].filter(Boolean).join(" ")}
            onClick={openProviderReviews}
          >
            <span>Отзывы</span>
            {missedReviewsCount > 0 && (
              <span className="app-subnav-badge" aria-label={`Непросмотренных отзывов: ${missedReviewsCount}`}>
                {missedReviewsCount > 99 ? "99+" : missedReviewsCount}
              </span>
            )}
          </button>
          <button type="button" className={currentView === "intervals" ? "active" : ""} onClick={() => setCurrentView("intervals")}>Календарь интервалов</button>
          <button type="button" className={currentView === "services" ? "active" : ""} onClick={() => setCurrentView("services")}>Услуги и категории</button>
          <button
            type="button"
            className={["app-subnav-chat", currentView === "chats" && "active"].filter(Boolean).join(" ")}
            onClick={() => {
              if (isMobileChatLayout()) setSelectedChatId(null);
              setCurrentView("chats");
            }}
          >
            <span className="app-subnav-chat-inner" aria-hidden="true">
              <svg className="app-subnav-chat-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
              </svg>
              <span>Чаты</span>
            </span>
            {unreadMessagesCount > 0 && (
              <span className="app-subnav-badge" aria-label={`Непрочитанных сообщений: ${unreadMessagesCount}`}>
                {unreadMessagesCount > 99 ? "99+" : unreadMessagesCount}
              </span>
            )}
          </button>
        </nav>
      )}

      {accessToken && me?.role === "staff" && (
        <nav className="app-subnav app-subnav--scroll" aria-label="Разделы сотрудника">
          {staffHasPerm("manage_bookings") && (
            <button type="button" className={currentView === "bookings" ? "active" : ""} onClick={() => setCurrentView("bookings")}>Записи</button>
          )}
          {canViewOrgReviews() && (
            <button
              type="button"
              className={["app-subnav-reviews", currentView === "reviews" && "active"].filter(Boolean).join(" ")}
              onClick={openProviderReviews}
            >
              <span>Отзывы</span>
              {missedReviewsCount > 0 && (
                <span className="app-subnav-badge" aria-label={`Непросмотренных отзывов: ${missedReviewsCount}`}>
                  {missedReviewsCount > 99 ? "99+" : missedReviewsCount}
                </span>
              )}
            </button>
          )}
          {staffHasPerm("manage_chats") && (
            <button
              type="button"
              className={["app-subnav-chat", currentView === "chats" && "active"].filter(Boolean).join(" ")}
              onClick={() => {
              if (isMobileChatLayout()) setSelectedChatId(null);
              setCurrentView("chats");
            }}
            >
              <span className="app-subnav-chat-inner" aria-hidden="true">
                <svg className="app-subnav-chat-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
                </svg>
                <span>Чаты</span>
              </span>
              {unreadMessagesCount > 0 && (
                <span className="app-subnav-badge" aria-label={`Непрочитанных сообщений: ${unreadMessagesCount}`}>
                  {unreadMessagesCount > 99 ? "99+" : unreadMessagesCount}
                </span>
              )}
            </button>
          )}
        </nav>
      )}

      <main className={`grid${centeredWorkspace ? " grid-centered-workspace" : ""}`}>
        {!accessToken && (
          <LandingPage onLogin={() => openAuth("login")} onRegister={() => openAuth("register")} />
        )}

        {!accessToken && showAuthModal && createPortal(
          <div className="auth-modal-overlay" role="presentation">
            <div className="auth-modal" role="dialog" aria-modal="true">
              <button type="button" className="auth-modal-close" onClick={closeAuth} aria-label="Закрыть">×</button>
              {verifyEmailNotice ? (
                <div className="auth-verify-panel">
                  <h2>Подтвердите email</h2>
                  <p className="auth-verify-lead">{verifyEmailNotice.detail}</p>
                  <p>
                    Мы отправили письмо на{" "}
                    <strong>{verifyEmailNotice.email}</strong>. Перейдите по ссылке в письме, затем
                    войдите в аккаунт.
                  </p>
                  <p className="hint">Не видите письмо? Проверьте папку «Спам» или «Промоакции».</p>
                  <div className="auth-verify-actions">
                    <button type="button" onClick={() => resendVerificationForEmail(verifyEmailNotice.email)}>
                      Отправить письмо ещё раз
                    </button>
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() => {
                        setVerifyEmailNotice(null);
                        setResendStatus("");
                      }}
                    >
                      Перейти ко входу
                    </button>
                  </div>
                  {resendStatus ? <p className="status">{resendStatus}</p> : null}
                </div>
              ) : (
                <>
              <h2>{authMode === "login" ? "Вход" : "Регистрация"}</h2>
              {authMode === "login" ? (
                <form onSubmit={onLogin} className="form">
                  <input placeholder="Логин" value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })} required />
                  <PasswordInput
                    placeholder="Пароль"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    required
                    autoComplete="current-password"
                  />
                  <button type="submit">Войти</button>
                </form>
              ) : (
                <form onSubmit={onSubmit} className="form">
                  {registerStep === 1 && (
                    <>
                      <input placeholder="Фамилия" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
                      <input placeholder="Имя" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
                      <input placeholder="Отчество (если есть)" value={form.patronymic} onChange={(e) => setForm({ ...form, patronymic: e.target.value })} />
                      <input placeholder="Логин" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
                      <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                      <input
                        placeholder="Телефон"
                        {...phoneFieldProps(form.phone, (phone) => setForm({ ...form, phone }))}
                      />
                      <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                        {roleOptions.map((item) => <option key={item.key} value={item.key}>{item.value}</option>)}
                      </select>
                      <PasswordInput
                        placeholder="Пароль"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        required
                        autoComplete="new-password"
                      />
                      <PasswordInput
                        placeholder="Повторите пароль"
                        value={form.password_confirm}
                        onChange={(e) => setForm({ ...form, password_confirm: e.target.value })}
                        required
                        autoComplete="new-password"
                      />
                      {form.role === "provider" ? <button type="button" onClick={continueProviderRegistration}>Продолжить</button> : <button type="submit">Создать аккаунт</button>}
                    </>
                  )}
                  {registerStep === 2 && form.role === "provider" && (
                    <>
                      <select value={form.provider_sphere} onChange={(e) => setForm({ ...form, provider_sphere: e.target.value })} required>
                        <option value="">Выбери сферу услуг</option>
                        {sphereOptions.map((s) => <option key={s.key} value={s.key}>{s.value}</option>)}
                      </select>
                      <input placeholder="Название организации" value={form.organization_name} onChange={(e) => setForm({ ...form, organization_name: e.target.value })} required />
                      <input
                        placeholder="Адрес"
                        value={form.organization_address}
                        onChange={(e) => onAddressInput(e.target.value)}
                        onBlur={(e) => geocodeAddress(e.target.value)}
                        required
                      />
                      {detectedCity && <p className="hint">Город поиска: {detectedCity}</p>}
                      {addressSuggestions.length > 0 && (
                        <div className="suggestions">
                          {addressSuggestions.map((item, idx) => (
                            <button
                              key={`${item.value}-${idx}`}
                              type="button"
                              className="suggestion-item"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => pickSuggestion(item)}
                            >
                              {item.value}
                            </button>
                          ))}
                        </div>
                      )}
                      <div id="reg-map" className="map-box" />
                      <div className="address-details-grid">
                        <input placeholder="Подъезд" value={form.entrance} onChange={(e) => setForm({ ...form, entrance: e.target.value })} />
                        <input placeholder="Этаж" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} />
                        <input placeholder="Квартира/офис" value={form.apartment} onChange={(e) => setForm({ ...form, apartment: e.target.value })} />
                        <input placeholder="Домофон" value={form.intercom} onChange={(e) => setForm({ ...form, intercom: e.target.value })} />
                      </div>
                      <input
                        placeholder="Доп. ориентир (необязательно)"
                        value={form.organization_address_details}
                        onChange={(e) => setForm({ ...form, organization_address_details: e.target.value })}
                      />
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => {
                          destroyRegMap();
                          setRegisterStep(1);
                        }}
                      >
                        Назад
                      </button>
                      <button type="submit">Завершить регистрацию</button>
                    </>
                  )}
                </form>
              )}
              <p className="auth-switch-text">{authMode === "login" ? "Нет аккаунта?" : "Уже есть аккаунт?"}</p>
              <button className="ghost-btn" type="button" onClick={() => setAuthMode((prev) => (prev === "login" ? "register" : "login"))}>
                {authMode === "login" ? "Регистрация" : "Войти"}
              </button>
              <p className="status">{authMode === "login" ? authStatus : authStatus || status}</p>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}

        {accessToken && currentView === "profile" && (
          <section className="card profile-card">
            <div className="profile-title-row">
              <h2 className="profile-title-h2">Личный кабинет</h2>
              {(chatActivity?.badge_count ?? 0) > 0 && (
                <span className="profile-title-badge" title="Есть уведомления">
                  {chatActivity.badge_count > 99 ? "99+" : chatActivity.badge_count}
                </span>
              )}
            </div>
            <p>Вы вошли как: <strong>{fullName}</strong></p>
            {(me?.role === "client" || me?.role === "staff") && (chatActivity?.pending_staff_invites?.length ?? 0) > 0 && (
              <div className="chat-invites-banner">
                {chatActivity.pending_staff_invites.map((inv) => (
                  <div key={inv.id} className="chat-invite-card">
                    <p>
                      Приглашение присоединиться к организации{" "}
                      <strong>{inv.provider_user?.organization_name || inv.provider_user?.username || "—"}</strong>.
                    </p>
                    <div className="chat-invite-actions">
                      <button type="button" className="invite-accept-btn" onClick={() => acceptStaffInvite(inv.id)}>
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                        </svg>
                        Подтвердить
                      </button>
                      <button type="button" className="invite-reject-btn" onClick={() => rejectStaffInvite(inv.id)}>
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                        </svg>
                        Отклонить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {(chatActivity?.notifications?.length ?? 0) > 0 && (
              <div className="chat-notif-banner">
                {chatActivity.notifications.map((n) => (
                  <div key={n.id} className="chat-notif-card">
                    <p>{formatInAppNotificationText(n)}</p>
                    {n.payload?.when ? <p className="muted small">{n.payload.when}</p> : null}
                    <button type="button" className="ghost-btn" onClick={() => markInAppNotificationsRead([n.id])}>
                      Понятно
                    </button>
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={updateProfile} className="form">
              <h3>Личная информация</h3>
              <input value={profileForm.last_name} onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })} placeholder="Фамилия" />
              <input value={profileForm.first_name} onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })} placeholder="Имя" />
              <input value={profileForm.patronymic} onChange={(e) => setProfileForm({ ...profileForm, patronymic: e.target.value })} placeholder="Отчество" />
              <input
                placeholder="Телефон"
                {...phoneFieldProps(profileForm.phone, (phone) => setProfileForm({ ...profileForm, phone }))}
              />
              <div className="profile-save-row">
                <button type="submit">Сохранить данные</button>
              </div>
            </form>
            <div className="row-2 profile-quick-nav">
              <button type="button" className="ghost-btn" onClick={() => setCurrentView("settings")}>Настройки</button>
              <button type="button" className="ghost-btn" onClick={() => setCurrentView("subscriptions")}>Подписки</button>
              {canManageOrgSettings && (
                <button type="button" className="ghost-btn" onClick={() => setCurrentView("organization")}>Организация</button>
              )}
            </div>
            {!me?.email_verified && (
              <>
                <p className="status">Подтверди email для полноценной работы.</p>
                <button type="button" onClick={resendVerification}>Отправить письмо повторно</button>
                <p className="status">{resendStatus}</p>
              </>
            )}
            {me?.role === "staff" && orgStaff.length > 0 && (
              <>
                <h3>Моя организация</h3>
                <p className="muted">Разделы «Записи» и «Чаты» — под оранжевой шапкой (доступ по правам, их настраивает исполнитель).</p>
              </>
            )}
          </section>
        )}

        {accessToken && currentView === "subscriptions" && (
          <SubscriptionsPage
            apiUrl={API_URL}
            authFetch={authFetch}
            me={me}
          />
        )}

        {accessToken && currentView === "settings" && renderGeneralSettings()}
        {accessToken && currentView === "organization" && canManageOrgSettings && renderOrganizationSettings()}
        {accessToken && currentView === "staff" && canManageOrgSettings && renderStaffManagement()}

        {accessToken && canViewOrgReviews() && currentView === "reviews" && renderProviderReviewsBlock()}
        {accessToken && me?.role === "provider" && currentView === "bookings" && renderBookingsBlock("Записи клиентов")}
        {accessToken && me?.role === "provider" && currentView === "intervals" && renderSlotCalendar(true)}
        {accessToken && me?.role === "staff" && currentView === "bookings" && staffHasPerm("manage_bookings") && renderBookingsBlock("Записи")}
        {accessToken && currentView === "chats" && (me?.role === "client" || me?.role === "provider" || me?.role === "staff") && (
          <section className="card full-width tg-chats-card">
            <div
              className={[
                "tg-body",
                selectedChatId ? "tg-body--mobile-thread" : "tg-body--mobile-list",
              ].join(" ")}
            >
              <aside className="tg-sidebar">
                <div className="tg-sidebar-head">
                  <span className="tg-sidebar-title">Чаты</span>
                  {me?.role === "provider" && (
                    <div className="tg-fab-wrap">
                      <button type="button" className="tg-fab" onClick={() => setChatFabOpen((v) => !v)}>+</button>
                      {chatFabOpen && (
                        <div className="tg-fab-menu">
                          <form onSubmit={createOrgGroup} className="form tg-popover-form">
                            <div className="tg-popover-title">Новая группа</div>
                            <p className="muted tg-popover-hint">Можно не отмечать сотрудников — группа только для тебя. Или добавь участников.</p>
                            <input
                              placeholder="Название группы"
                              value={groupForm.title}
                              onChange={(e) => setGroupForm({ ...groupForm, title: e.target.value })}
                              required
                            />
                            <div className="staff-pick-grid">
                              {orgStaff
                                .filter((l) => l.is_active && (l.invitation_status === "accepted" || !l.invitation_status))
                                .map((link) => (
                                <label key={link.id} className="checkbox">
                                  <input
                                    type="checkbox"
                                    checked={groupForm.staff_ids.includes(link.staff)}
                                    onChange={() => toggleGroupStaff(link.staff)}
                                  />
                                  {formatStaffFullName(link.staff_user) || `id ${link.staff}`}
                                </label>
                              ))}
                            </div>
                            <button type="submit">Создать группу</button>
                          </form>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <input
                  type="search"
                  className="tg-chat-search"
                  placeholder="Поиск по чатам..."
                  value={chatSearchQuery}
                  onChange={(e) => setChatSearchQuery(e.target.value)}
                />
                {(me?.role === "provider" || me?.role === "staff") && (
                <div className="tg-folder-tabs">
                  <button type="button" className={chatFolder === "org" ? "active" : ""} onClick={() => setChatFolder("org")}>
                    <span className="tg-folder-tab-label">Организация</span>
                    {orgFolderUnreadChatsCount > 0 && (
                      <span className="tg-folder-tab-badge">{orgFolderUnreadChatsCount > 99 ? "99+" : orgFolderUnreadChatsCount}</span>
                    )}
                  </button>
                  <button type="button" className={chatFolder === "clients" ? "active" : ""} onClick={() => setChatFolder("clients")}>
                    <span className="tg-folder-tab-label">Клиенты</span>
                    {clientsFolderUnreadChatsCount > 0 && (
                      <span className="tg-folder-tab-badge">{clientsFolderUnreadChatsCount > 99 ? "99+" : clientsFolderUnreadChatsCount}</span>
                    )}
                  </button>
                </div>
                )}
                <div className="tg-chat-list">
                  {filteredSidebarChats.map((c) => {
                    const peerM = chatFolder === "org" ? getOrgDmPeerMember(c, me?.id) : null;
                    const showPresenceDot = Boolean(peerM) && !c.is_group && !c.is_saved_messages && !c.is_client_correspondence;
                    const pinsList = chatFolder === "clients" ? chatPins.clients : chatPins.org;
                    const isPinned = pinsList.map(Number).includes(Number(c.id));
                    const unreadN = Number(c.unread_message_count) || 0;
                    return (
                    <div
                      key={c.id}
                      draggable={isPinned}
                      onDragStart={(e) => {
                        if (!isPinned) {
                          e.preventDefault();
                          return;
                        }
                        setChatDragPinConvId(c.id);
                        try {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", String(c.id));
                        } catch {
                          // ignore
                        }
                      }}
                      onDragEnd={() => setChatDragPinConvId(null)}
                      onDragOver={(e) => {
                        if (chatDragPinConvId != null && isPinned) e.preventDefault();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (chatDragPinConvId == null || !isPinned) return;
                        reorderPinnedChats(chatFolder, chatDragPinConvId, c.id);
                        setChatDragPinConvId(null);
                      }}
                      className={[
                        "tg-chat-item-row",
                        selectedChatId === c.id && "active",
                        c.is_saved_messages && "saved",
                        unreadN > 0 && "tg-chat-item-row--unread",
                        isPinned && "tg-chat-item-row--pinned",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <button
                        type="button"
                        className="tg-chat-item-main"
                        onClick={() => setSelectedChatId(c.id)}
                      >
                        <span className="tg-avatar-wrap">
                          <span className={`tg-avatar ${c.is_saved_messages ? "tg-avatar-saved" : ""}`}>
                            {chatLocalPrefs[c.id]?.avatarDataUrl ? (
                              <img src={chatLocalPrefs[c.id].avatarDataUrl} alt="" className="tg-avatar-img" />
                            ) : (
                              conversationAvatarLetter(c)
                            )}
                          </span>
                          {showPresenceDot && (
                            <span className={`tg-presence-dot ${peerM.is_online ? "tg-presence-dot--on" : "tg-presence-dot--off"}`} title={peerM.is_online ? "в сети" : "не в сети"} />
                          )}
                        </span>
                        <span className="tg-chat-item-text">
                          <span className="tg-chat-item-title">{displayConversationTitle(c)}</span>
                          <span className="tg-chat-item-sub">
                            {c.last_message?.text ? `${(c.last_message.text || "").slice(0, 42)}${(c.last_message.text || "").length > 42 ? "…" : ""}` : c.is_group ? "Группа" : c.is_saved_messages ? "Личный раздел" : "Нет сообщений"}
                          </span>
                        </span>
                      </button>
                      {unreadN > 0 && (
                        <span className="tg-chat-unread-badge" aria-label={`Непрочитано сообщений: ${unreadN}`}>
                          {unreadN > 99 ? "99+" : unreadN}
                        </span>
                      )}
                      <div className="tg-chat-row-actions">
                        <button
                          type="button"
                          className={["tg-chat-row-icon-btn", isPinned && "tg-chat-row-icon-btn--on"].filter(Boolean).join(" ")}
                          aria-label={isPinned ? "Открепить" : "Закрепить"}
                          title={isPinned ? "Открепить" : "Закрепить (до 5)"}
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePinChatForFolder(c.id, chatFolder);
                          }}
                        >
                          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                            <path
                              fill="currentColor"
                              d="M16 12V4h-2V2h-4v2H8v8l-4 4v2h16v-2l-4-4zm-6 0V5h4v7h-4zm-2 9h8v2H8v-2z"
                            />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="tg-chat-row-icon-btn"
                          aria-label="Настройки чата"
                          title="Настройки чата"
                          onClick={(e) => {
                            e.stopPropagation();
                            setChatSettingsForId(c.id);
                          }}
                        >
                          <span className="tg-chat-row-dots" aria-hidden="true">
                            ⋯
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                  })}
                </div>
                {filteredSidebarChats.length === 0 && <p className="tg-empty">{chatFolder === "clients" ? "Пока нет чатов с клиентами — они появятся здесь автоматически." : "Нет чатов в этой папке."}</p>}
              </aside>
              <div className={`tg-main ${tgMainDark ? "tg-main--dark" : ""}`} style={tgMainStyle}>
                <div className="tg-main-head">
                  {selectedChatId ? (
                    <div className="tg-main-head-bar">
                      <div className="tg-main-head-left">
                        <button
                          type="button"
                          className="tg-chat-back-btn"
                          aria-label="К списку чатов"
                          title="Назад к списку"
                          onClick={() => setSelectedChatId(null)}
                        >
                          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                            <path
                              fill="currentColor"
                              d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"
                            />
                          </svg>
                        </button>
                      </div>
                      <button
                        type="button"
                        className="tg-main-head-peer"
                        onClick={() => setChatInfoOpen(true)}
                        title="Информация о чате"
                      >
                        <span className="tg-avatar tg-main-head-avatar">
                          {chatLocalPrefs[selectedChatId]?.avatarDataUrl ? (
                            <img src={chatLocalPrefs[selectedChatId].avatarDataUrl} alt="" className="tg-avatar-img" />
                          ) : (
                            (displayConversationTitle(conversations.find((c) => c.id === selectedChatId)) || "?")
                              .slice(0, 1)
                              .toUpperCase()
                          )}
                        </span>
                        <span className="tg-main-head-peer-text">
                          <span className="tg-main-title">
                            {displayConversationTitle(conversations.find((c) => c.id === selectedChatId))}
                          </span>
                          {chatPeerPresenceLine ? <span className="tg-main-head-presence">{chatPeerPresenceLine}</span> : null}
                        </span>
                      </button>
                      <div className="tg-main-head-right">
                        <div className="tg-msg-search-wrap" ref={tgMsgSearchWrapRef}>
                          <button
                            type="button"
                            className={["tg-head-icon-btn", chatMsgSearchOpen && "tg-head-icon-btn--on"].filter(Boolean).join(" ")}
                            aria-label="Поиск в чате"
                            aria-expanded={chatMsgSearchOpen}
                            title="Поиск по сообщениям"
                            onClick={() => {
                              if (chatMsgSearchOpen) {
                                setChatMsgSearchOpen(false);
                                setChatMsgSearchQuery("");
                                setChatMsgSearchActiveIdx(0);
                              } else {
                                setChatMsgSearchOpen(true);
                              }
                            }}
                          >
                            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                              <path
                                fill="currentColor"
                                d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
                              />
                            </svg>
                          </button>
                          {chatMsgSearchOpen && (
                            <div className="tg-msg-search-panel" role="search">
                              <input
                                ref={chatMsgSearchInputRef}
                                type="search"
                                className="tg-msg-search-field"
                                value={chatMsgSearchQuery}
                                onChange={(e) => {
                                  setChatMsgSearchQuery(e.target.value);
                                  setChatMsgSearchActiveIdx(0);
                                }}
                                onKeyDown={(e) => {
                                  const hits = chatMsgSearchHits;
                                  if (!hits.length) return;
                                  if (e.key === "ArrowDown") {
                                    e.preventDefault();
                                    setChatMsgSearchActiveIdx((i) => Math.min(hits.length - 1, i + 1));
                                  } else if (e.key === "ArrowUp") {
                                    e.preventDefault();
                                    setChatMsgSearchActiveIdx((i) => Math.max(0, i - 1));
                                  }
                                }}
                                placeholder="Поиск…"
                                aria-autocomplete="list"
                              />
                              <div className="tg-msg-search-count" aria-live="polite">
                                {chatMsgSearchQuery.trim()
                                  ? formatRuMatchCount(chatMsgSearchHits.length)
                                  : "Введите запрос"}
                              </div>
                              {chatMsgSearchQuery.trim() ? (
                                <ul className="tg-msg-search-hits tg-msg-search-hits--panel" role="listbox">
                                  {chatMsgSearchHits.map((m, i) => (
                                    <li key={m.id} role="option" aria-selected={i === chatMsgSearchActiveIdx}>
                                      <button
                                        type="button"
                                        className={["tg-msg-search-hit", i === chatMsgSearchActiveIdx && "tg-msg-search-hit--active"].filter(Boolean).join(" ")}
                                        onClick={() => setChatMsgSearchActiveIdx(i)}
                                      >
                                        <span className="tg-msg-search-hit-date">
                                          {new Date(m.created_at).toLocaleString("ru-RU", {
                                            day: "numeric",
                                            month: "long",
                                            year: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          })}
                                        </span>
                                        <span className="tg-msg-search-hit-text">{chatMessagePlainText(m) || "—"}</span>
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                              <p className="tg-msg-search-keys-hint muted">В поле поиска: ↑ ↓ — к совпадениям в чате</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="tg-main-head-bar tg-main-head-bar--empty">
                      <div className="tg-main-head-center">
                        <span className="tg-main-title">Выбери чат</span>
                      </div>
                    </div>
                  )}
                </div>
                {selectedChatId ? (
                  <>
                    <div className="tg-messages-wrap">
                    <div
                      className="tg-messages"
                      ref={chatMessagesElRef}
                      onScroll={(e) => updateChatScrollUi(e.currentTarget)}
                    >
                      {chatLoadingOlder ? (
                        <div className="tg-messages-loading-older" aria-live="polite">
                          Загрузка…
                        </div>
                      ) : null}
                      {chatMessages.map((m, idx) => {
                        const prev = chatMessages[idx - 1];
                        const showDay =
                          !prev || messageCalendarDayKey(prev.created_at) !== messageCalendarDayKey(m.created_at);
                        return (
                          <Fragment key={m.id}>
                            {showDay && (
                              <div className="tg-msg-day-sep" role="separator">
                                <span className="tg-msg-day-chip">{formatMessageDayDividerRu(m.created_at)}</span>
                              </div>
                            )}
                            <div
                              id={`tg-msg-${m.id}`}
                              className={[
                                "tg-msg",
                                Number(m.sender) === Number(me?.id) && "tg-msg-own",
                                (m.kind === "voice" || m.kind === "video_note") && "tg-msg--media-bare",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                            >
                              <div className="tg-msg-author">
                                {formatMessageSenderLine(m) || m.sender_username}
                              </div>
                              {renderChatMessageBody(m, {
                                onOpenPhotos: (items, index) => openChatPhotosLightbox(items, index),
                              })}
                              <div className="tg-msg-meta">
                                <div className="tg-msg-time">
                                  {new Date(m.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                                </div>
                                {Number(m.sender) === Number(me?.id) && m.viewed_by_peer != null && (
                                  <MessageReceiptIcon mode={chatReceiptsMode} viewed={Boolean(m.viewed_by_peer)} />
                                )}
                              </div>
                            </div>
                          </Fragment>
                        );
                      })}
                    </div>
                    {chatShowJumpBottom ? (
                      <button
                        type="button"
                        className="tg-jump-bottom-btn"
                        aria-label="К последним сообщениям"
                        title="Вниз"
                        onClick={() => scrollChatToBottom(true)}
                      >
                        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                          <path fill="currentColor" d="M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z" />
                        </svg>
                      </button>
                    ) : null}
                    </div>
                    {(chatRecordingKind === "video_note" || chatMediaPreview?.kind === "video_note") &&
                      typeof document !== "undefined" &&
                      createPortal(
                        <div
                          className={[
                            "tg-circle-stage",
                            "tg-circle-stage--overlay",
                            chatRecordingKind === "video_note" && "tg-circle-stage--live",
                            chatMediaPreview?.kind === "video_note" && "tg-circle-stage--preview",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          aria-live="polite"
                        >
                          {chatRecordingKind === "video_note" ? (
                            <>
                              <div className="tg-circle-live-wrap">
                                <video
                                  ref={chatLiveVideoRef}
                                  className={[
                                    "tg-circle-live-video",
                                    chatCameraFacing === "user" && "tg-circle-live-video--mirror",
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                  playsInline
                                  muted
                                  autoPlay
                                />
                                <span className="tg-circle-live-timer">{formatRecordClock(chatRecordSecs)}</span>
                              </div>
                              <div className="tg-circle-stage-actions">
                                <button
                                  type="button"
                                  className="tg-circle-stage-btn tg-circle-stage-btn--discard"
                                  aria-label="Отменить запись"
                                  title="Отменить"
                                  onClick={cancelChatRecording}
                                >
                                  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                                    <path
                                      fill="currentColor"
                                      d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                                    />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  className="tg-circle-stage-btn tg-circle-stage-btn--stop"
                                  aria-label="Остановить запись"
                                  title="Стоп"
                                  onClick={stopChatRecording}
                                >
                                  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                                    <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  className="tg-circle-stage-btn tg-circle-stage-btn--flip"
                                  aria-label="Сменить камеру"
                                  title="Сменить камеру"
                                  disabled={chatCameraSwitching}
                                  onPointerDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                  }}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    void switchChatCamera();
                                  }}
                                >
                                  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                                    <path
                                      fill="currentColor"
                                      d="M16 7h-1l-1-1h-4L9 7H8c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm-4 9c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"
                                    />
                                    <path
                                      fill="currentColor"
                                      d="M9.1 3.1 7.7 1.7 2 7.4l1.4 1.4 2.3-2.3V9h2V4.5L9.1 3.1zm12.5 12.1-1.4-1.4-2.3 2.3V15h-2v4.5l1.4 1.4 5.7-5.7z"
                                    />
                                  </svg>
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="tg-circle-preview-player">
                                <ChatVideoNotePlayer
                                  key={chatMediaPreview.url}
                                  src={chatMediaPreview.url}
                                  size={Math.min(280, typeof window !== "undefined" ? window.innerWidth * 0.72 : 280)}
                                  mirror={Boolean(chatMediaPreview.displayFlip)}
                                  previewMode
                                />
                              </div>
                              <div className="tg-circle-stage-actions">
                                <button
                                  type="button"
                                  className="tg-circle-stage-btn tg-circle-stage-btn--discard"
                                  aria-label="Удалить кружок"
                                  title="Удалить"
                                  onClick={discardChatMediaPreview}
                                >
                                  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                                    <path
                                      fill="currentColor"
                                      d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                                    />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  className="tg-circle-stage-btn tg-circle-stage-btn--send"
                                  aria-label="Отправить кружок"
                                  title="Отправить"
                                  onClick={sendChatMediaPreview}
                                >
                                  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                                    <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                                  </svg>
                                </button>
                              </div>
                            </>
                          )}
                        </div>,
                        document.body
                      )}
                    <form onSubmit={sendChatMessage} className="tg-compose">
                      <input
                        ref={chatFileInputRef}
                        type="file"
                        className="tg-file-input-hidden"
                        onChange={onChatFilePicked}
                        multiple
                        hidden
                      />
                      {chatMediaPreview && chatMediaPreview.kind !== "video_note" ? (
                        <div className="tg-media-preview tg-media-preview--compose">
                          <audio
                            key={chatMediaPreview.url}
                            ref={chatPreviewMediaRef}
                            src={chatMediaPreview.url}
                            controls
                            preload="auto"
                            autoPlay
                          />
                          <div className="tg-media-preview-actions">
                            <button type="button" className="ghost-btn" onClick={discardChatMediaPreview}>
                              Удалить
                            </button>
                            <button type="button" className="primary" onClick={sendChatMediaPreview}>
                              Отправить
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="tg-attach-wrap tg-attach-wrap--compose" ref={tgAttachMenuRef}>
                            <button
                              type="button"
                              className="tg-compose-icon-btn"
                              aria-label="Вложения"
                              title="Вложения"
                              disabled={Boolean(chatRecordingKind) || Boolean(chatMediaPreview)}
                              onClick={() => setChatAttachMenuOpen((v) => !v)}
                            >
                              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                                <path
                                  fill="currentColor"
                                  d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S5 2.79 5 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"
                                />
                              </svg>
                            </button>
                            {chatAttachMenuOpen && (
                              <div className="tg-attach-menu tg-attach-menu--up" role="menu">
                                <button type="button" className="tg-attach-menu-item" onClick={() => openChatAttachPicker("image")}>
                                  Фото
                                </button>
                                <button type="button" className="tg-attach-menu-item" onClick={() => openChatAttachPicker("video")}>
                                  Видео
                                </button>
                                <button type="button" className="tg-attach-menu-item" onClick={() => openChatAttachPicker("file")}>
                                  Файл
                                </button>
                                <button type="button" className="tg-attach-menu-item" onClick={() => openChatAttachPicker("music")}>
                                  Музыка
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="tg-compose-main">
                            {chatPendingFiles.length ? (
                              <div className="tg-compose-pending">
                                <span>
                                  {chatPendingFiles.length === 1
                                    ? chatPendingFiles[0].file.name
                                    : `${chatPendingFiles.length} файлов`}
                                </span>
                                <button
                                  type="button"
                                  className="tg-compose-pending-clear"
                                  onClick={() => {
                                    setChatPendingFiles([]);
                                    setChatPendingKind("");
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            ) : null}
                            {chatRecordingKind === "voice" ? (
                              <div className="tg-voice-live" aria-live="polite">
                                <span className="tg-voice-live-timer">{formatRecordClock(chatRecordSecs)}</span>
                                <div className="tg-voice-wave" aria-hidden>
                                  {chatRecordLevels.map((lvl, i) => (
                                    <span key={i} style={{ height: `${12 + lvl * 22}px` }} />
                                  ))}
                                </div>
                                {chatRecordLocked ? (
                                  <button type="button" className="tg-record-stop-btn tg-record-stop-btn--inline" onClick={stopChatRecording}>
                                    Стоп
                                  </button>
                                ) : null}
                              </div>
                            ) : chatRecordingKind === "video_note" ? (
                              <div className="tg-compose-circle-status muted">
                                Запись · {formatRecordClock(chatRecordSecs)}
                                {chatRecordLiftHint ? " · отпустите, чтобы закрепить" : ""}
                              </div>
                            ) : chatMediaPreview?.kind === "video_note" ? (
                              <div className="tg-compose-circle-status muted">Кружок готов к отправке</div>
                            ) : (
                              <input
                                className="tg-compose-input"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                placeholder="Сообщение..."
                                disabled={Boolean(chatRecordingKind)}
                              />
                            )}
                          </div>
                          {chatMediaPreview?.kind === "video_note" ? (
                            <button type="button" className="tg-send-btn" aria-label="Отправить кружок" title="Отправить" onClick={sendChatMediaPreview}>
                              <svg className="tg-send-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                                <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                              </svg>
                            </button>
                          ) : chatInput.trim() || chatPendingFiles.length ? (
                            <button type="submit" className="tg-send-btn" aria-label="Отправить сообщение" title="Отправить">
                              <svg className="tg-send-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                                <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                              </svg>
                            </button>
                          ) : chatRecordLocked ? (
                            <button type="button" className="tg-send-btn tg-record-btn tg-record-btn--active" onClick={stopChatRecording} title="Остановить">
                              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                                <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
                              </svg>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className={[
                                "tg-send-btn",
                                "tg-record-btn",
                                chatComposeMode === "video_note" && "tg-record-btn--circle",
                                chatRecordingKind && "tg-record-btn--active",
                                chatRecordLiftHint && "tg-record-btn--lift",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              aria-label={
                                chatComposeMode === "video_note"
                                  ? "Кружок: короткий тап — голосовое, удержание — запись"
                                  : "Голосовое: короткий тап — кружок, удержание — запись"
                              }
                              title={
                                chatComposeMode === "video_note"
                                  ? "Кружок (тап — сменить режим)"
                                  : "Голосовое (тап — сменить режим)"
                              }
                              onPointerDown={onComposeActionPointerDown}
                              onPointerMove={onComposeActionPointerMove}
                              onPointerUp={onComposeActionPointerUp}
                              onPointerCancel={onComposeActionPointerUp}
                              onContextMenu={(e) => e.preventDefault()}
                            >
                              {chatComposeMode === "video_note" ? (
                                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                                  <path
                                    fill="currentColor"
                                    d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"
                                  />
                                </svg>
                              ) : (
                                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                                  <path
                                    fill="currentColor"
                                    d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"
                                  />
                                </svg>
                              )}
                            </button>
                          )}
                        </>
                      )}
                    </form>
                  </>
                ) : (
                  <div className="tg-empty">Выбери чат слева.</div>
                )}
                {chatStatus ? <p className="tg-status">{chatStatus}</p> : null}
              </div>
            </div>
            {chatReceiptsSettingsOpen && (
              <div
                className="modal-backdrop"
                onClick={() => {
                  setChatReceiptsSettingsOpen(false);
                }}
              >
                <div className="modal-card tg-settings-card" onClick={(e) => e.stopPropagation()}>
                  <h3>Прочтение сообщений</h3>
                  <p className="muted">Как показывать, просмотрел ли собеседник твоё сообщение (только для твоих исходящих).</p>
                  <div className="form chat-receipts-settings">
                    <label className="checkbox">
                      <input
                        type="radio"
                        name="receipt-mode-chat"
                        checked={chatReceiptsMode === "stickers"}
                        onChange={() => persistChatReceiptsMode("stickers")}
                      />
                      Стикеры (обезьянки)
                    </label>
                    <label className="checkbox">
                      <input
                        type="radio"
                        name="receipt-mode-chat"
                        checked={chatReceiptsMode === "classic"}
                        onChange={() => persistChatReceiptsMode("classic")}
                      />
                      Стандарт
                    </label>
                    <div className="chat-receipts-preview">
                      <span className="muted small-label">Как будет в переписке</span>
                      <div className="chat-receipts-preview-bubbles">
                        <div className="chat-receipt-preview-msg tg-msg-own">
                          <div className="tg-msg-text">Пример</div>
                          <div className="tg-msg-meta">
                            <span className="tg-msg-time">12:00</span>
                            <MessageReceiptIcon mode={chatReceiptsMode} viewed={false} />
                          </div>
                        </div>
                        <div className="chat-receipt-preview-msg tg-msg-own">
                          <div className="tg-msg-text">Пример</div>
                          <div className="tg-msg-meta">
                            <span className="tg-msg-time">12:01</span>
                            <MessageReceiptIcon mode={chatReceiptsMode} viewed />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="tg-settings-actions">
                    <button type="button" className="primary" onClick={() => setChatReceiptsSettingsOpen(false)}>
                      Готово
                    </button>
                  </div>
                </div>
              </div>
            )}
            {chatSettingsForId != null && (
              <div
                className="modal-backdrop modal-backdrop--chat-settings"
                onClick={() => {
                  setChatSettingsForId(null);
                  setCustomColorPickerOpen(false);
                }}
              >
                <div className="modal-card tg-settings-card" onClick={(e) => e.stopPropagation()}>
                  <h3>Настройки чата</h3>
                  <p className="muted">Название в списке, аватар и фон чата. Хранится в браузере на этом устройстве.</p>
                  <label className="tg-settings-label">
                    Имя
                    <input value={chatSettingsTitle} onChange={(e) => setChatSettingsTitle(e.target.value)} />
                  </label>
                  <label className="tg-settings-label">
                    Аватар (картинка)
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => setChatSettingsAvatar(typeof reader.result === "string" ? reader.result : "");
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                  {chatSettingsAvatar && (
                    <div className="tg-settings-preview">
                      <img src={chatSettingsAvatar} alt="" />
                      <button type="button" className="ghost-btn" onClick={() => setChatSettingsAvatar("")}>
                        Убрать аватар
                      </button>
                    </div>
                  )}
                  <div className="tg-wall-label">Фон переписки</div>
                  <div className="tg-wall-grid">
                    {CHAT_WALL_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`tg-wall-swatch ${chatSettingsWallpaper === opt.value ? "active" : ""}`}
                        style={{ background: opt.value }}
                        title={opt.label}
                        onClick={() => {
                          setChatSettingsWallpaper(opt.value);
                          setCustomColorPickerOpen(false);
                        }}
                      />
                    ))}
                  </div>
                  <div className="tg-wall-label">Свой цвет</div>
                  <div className="tg-color-row">
                    <button
                      type="button"
                      className="ghost-btn tg-color-picker-toggle"
                      onClick={() => setCustomColorPickerOpen((v) => !v)}
                    >
                      {customColorPickerOpen ? "Закрыть палитру" : "Открыть палитру"}
                    </button>
                    {customColorPickerOpen && (
                      <div className="tg-color-popover">
                        <input
                          type="color"
                          value={
                            chatSettingsWallpaper && chatSettingsWallpaper.startsWith("#") && chatSettingsWallpaper.length >= 4
                              ? chatSettingsWallpaper.slice(0, 7)
                              : "#dfe9e2"
                          }
                          onChange={(e) => setChatSettingsWallpaper(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                  <div className="tg-wall-label">Уведомления</div>
                  <select value={chatSettingsNotify} onChange={(e) => setChatSettingsNotify(e.target.value)} className="tg-notify-select">
                    <option value="all">Включены</option>
                    <option value="off">Заглушить</option>
                    <option value="1h">Заглушить на 1 час</option>
                    <option value="2h">Заглушить на 2 часа</option>
                    <option value="8h">Заглушить на 8 часов</option>
                  </select>
                  <div className="tg-settings-actions">
                    <button type="button" className="primary" onClick={persistChatVisualSettings}>
                      Сохранить
                    </button>
                    <button type="button" className="ghost-btn" onClick={clearChatVisualSettings}>
                      Сбросить оформление
                    </button>
                    <button type="button" className="ghost-btn" onClick={() => setChatSettingsForId(null)}>
                      Закрыть
                    </button>
                  </div>
                  <button
                    type="button"
                    className="ghost-btn"
                    style={{ marginTop: 8 }}
                    onClick={() => {
                      setChatSettingsForId(null);
                      setChatReceiptsSettingsOpen(true);
                    }}
                  >
                    Прочтение сообщений…
                  </button>
                </div>
              </div>
            )}
            {chatInfoOpen && selectedChatId && (
              <div
                className="modal-backdrop"
                onClick={() => {
                  setChatInfoOpen(false);
                  setChatInfoHeadMenuOpen(false);
                  setChatInfoPhotoMenuId(null);
                }}
              >
                <div className="modal-card tg-chat-info-card" onClick={(e) => e.stopPropagation()}>
                  <div className="tg-chat-info-head">
                    <span className="tg-avatar tg-chat-info-avatar">
                      {chatLocalPrefs[selectedChatId]?.avatarDataUrl ? (
                        <img src={chatLocalPrefs[selectedChatId].avatarDataUrl} alt="" className="tg-avatar-img" />
                      ) : (
                        (displayConversationTitle(selectedConv) || "?").slice(0, 1).toUpperCase()
                      )}
                    </span>
                    <div className="tg-chat-info-titles">
                      <h3>{displayConversationTitle(selectedConv)}</h3>
                      <p className="muted small">
                        {chatPeerPresenceLine ||
                          (chatInfoPeer?.is_online
                            ? "в сети"
                            : chatInfoPeer?.last_seen_at
                              ? formatLastSeenLabel(chatInfoPeer.last_seen_at)
                              : "—")}
                      </p>
                    </div>
                    <div className="tg-chat-info-head-actions">
                      <div className="tg-chat-info-menu-wrap">
                        <button
                          type="button"
                          className="tg-chat-info-icon-btn"
                          aria-label="Ещё"
                          aria-expanded={chatInfoHeadMenuOpen}
                          onClick={() => {
                            setChatInfoPhotoMenuId(null);
                            setChatInfoHeadMenuOpen((v) => !v);
                          }}
                        >
                          ⋮
                        </button>
                        {chatInfoHeadMenuOpen && (
                          <div className="tg-chat-info-dropdown" role="menu">
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setChatInfoHeadMenuOpen(false);
                                setChatInfoOpen(false);
                                setChatSettingsForId(selectedChatId);
                              }}
                            >
                              Настройки чата
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setChatInfoHeadMenuOpen(false);
                                setChatInfoOpen(false);
                                setChatReceiptsSettingsOpen(true);
                              }}
                            >
                              Прочтение сообщений
                            </button>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        className="tg-chat-info-close"
                        aria-label="Закрыть"
                        onClick={() => {
                          setChatInfoOpen(false);
                          setChatInfoHeadMenuOpen(false);
                          setChatInfoPhotoMenuId(null);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  {chatInfoPeer ? (
                    <div className="tg-chat-info-meta">
                      {(chatInfoPeer.first_name || chatInfoPeer.last_name) && (
                        <p>
                          {[chatInfoPeer.last_name, chatInfoPeer.first_name, chatInfoPeer.patronymic]
                            .filter(Boolean)
                            .join(" ")}
                        </p>
                      )}
                      {chatInfoPeer.organization_name ? <p>Организация: {chatInfoPeer.organization_name}</p> : null}
                      {chatInfoPeer.username ? <p className="muted">@{chatInfoPeer.username}</p> : null}
                    </div>
                  ) : null}
                  <div className="tg-chat-info-tabs">
                    {[
                      ["photos", "Фото"],
                      ["videos", "Видео"],
                      ["files", "Файлы"],
                      ["links", "Ссылки"],
                      ["music", "Музыка"],
                      ["voice", "Голосовые"],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        className={chatInfoTab === key ? "active" : ""}
                        onClick={() => setChatInfoTab(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="tg-chat-info-body">
                    {chatInfoTab === "photos" &&
                      (chatMediaGroups.photos.length ? (
                        <div className="tg-chat-info-grid">
                          {chatMediaGroups.photos.map((m) => (
                            <div key={m.id} className="tg-chat-info-thumb-wrap">
                              <button
                                type="button"
                                className="tg-chat-info-thumb"
                                onClick={() => {
                                  setChatInfoPhotoMenuId(null);
                                  openChatPhotosLightbox(
                                    chatMediaGroups.photos.map((x) => ({ id: x.id, url: x.url, source: "chat" })),
                                    chatMediaGroups.photos.findIndex((x) => x.id === m.id)
                                  );
                                }}
                              >
                                <img src={m.url} alt="" />
                              </button>
                              <div className="tg-chat-info-thumb-more">
                                <button
                                  type="button"
                                  className="tg-chat-info-thumb-dots"
                                  aria-label="Действия"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setChatInfoHeadMenuOpen(false);
                                    setChatInfoPhotoMenuId((id) => (id === m.id ? null : m.id));
                                  }}
                                >
                                  ⋮
                                </button>
                                {chatInfoPhotoMenuId === m.id && (
                                  <div className="tg-chat-info-dropdown tg-chat-info-dropdown--thumb" role="menu">
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={() => {
                                        setChatInfoPhotoMenuId(null);
                                        jumpToChatMessage(m.id);
                                      }}
                                    >
                                      К сообщению
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="muted">Пока нет фото</p>
                      ))}
                    {chatInfoTab === "videos" &&
                      (chatMediaGroups.videos.length ? (
                        <ul className="tg-chat-info-list">
                          {chatMediaGroups.videos.map((m) => (
                            <li key={m.id} className="tg-chat-info-row">
                              <video src={m.url} controls preload="metadata" />
                              <button type="button" className="ghost-btn small-btn" onClick={() => jumpToChatMessage(m.id)}>
                                К сообщению
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="muted">Пока нет видео</p>
                      ))}
                    {chatInfoTab === "files" &&
                      (chatMediaGroups.files.length ? (
                        <ul className="tg-chat-info-list">
                          {chatMediaGroups.files.map((m) => (
                            <li key={m.id} className="tg-chat-info-row">
                              <a href={m.url} target="_blank" rel="noreferrer">
                                {m.name || "Файл"}
                              </a>
                              <button type="button" className="ghost-btn small-btn" onClick={() => jumpToChatMessage(m.id)}>
                                К сообщению
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="muted">Пока нет файлов</p>
                      ))}
                    {chatInfoTab === "links" &&
                      (chatMediaGroups.links.length ? (
                        <ul className="tg-chat-info-list">
                          {chatMediaGroups.links.map((m) => (
                            <li key={m.id} className="tg-chat-info-row">
                              <a href={(m.text || "").match(/https?:\/\/\S+/)?.[0] || "#"} target="_blank" rel="noreferrer">
                                {m.text}
                              </a>
                              <button type="button" className="ghost-btn small-btn" onClick={() => jumpToChatMessage(m.id)}>
                                К сообщению
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="muted">Пока нет ссылок</p>
                      ))}
                    {chatInfoTab === "music" &&
                      (chatMediaGroups.music.length ? (
                        <ul className="tg-chat-info-list">
                          {chatMediaGroups.music.map((m) => (
                            <li key={m.id} className="tg-chat-info-row">
                              <div>{m.name}</div>
                              <audio src={m.url} controls preload="metadata" />
                              <button type="button" className="ghost-btn small-btn" onClick={() => jumpToChatMessage(m.id)}>
                                К сообщению
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="muted">Пока нет музыки</p>
                      ))}
                    {chatInfoTab === "voice" &&
                      (chatMediaGroups.voice.length ? (
                        <ul className="tg-chat-info-list">
                          {chatMediaGroups.voice.map((m) => (
                            <li key={m.id} className="tg-chat-info-row">
                              <audio src={m.url} controls preload="metadata" />
                              <button type="button" className="ghost-btn small-btn" onClick={() => jumpToChatMessage(m.id)}>
                                К сообщению
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="muted">Пока нет голосовых</p>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {accessToken && me?.role === "provider" && currentView === "services" && (
          <div className="services-layout">
            <section className="card">
              {renderServiceTree()}
            </section>
            <section className="card right-stack catalog-help-panel">
              <h2>Как настроить</h2>
              <ol className="catalog-help-list">
                <li>Загрузите готовый каталог для вашей сферы.</li>
                <li>Включите «Оказываем» у нужных услуг.</li>
                <li>Укажите цену и длительность и нажмите «Сохранить все изменения».</li>
              </ol>
              {dirtyServiceCount > 0 && (
                <button
                  type="button"
                  className="catalog-save-all-btn"
                  disabled={serviceSavingAll}
                  onClick={saveAllServiceChanges}
                >
                  {serviceSavingAll ? "Сохранение…" : `Сохранить все изменения (${dirtyServiceCount})`}
                </button>
              )}
              {catalogStatus?.catalog_seeded && (
                <button type="button" className="ghost-btn" disabled={catalogSeeding} onClick={seedProviderCatalog}>
                  Обновить каталог из шаблона
                </button>
              )}
              <p className="status">{sellerStatus}</p>
            </section>
          </div>
        )}

        {accessToken && me?.role === "client" && currentView === "client_map" && (
          <section className="card full-width client-discover-card">
            <div className="client-discover-top">
              <h2 className="client-discover-title" id="client-map-title">
                Карта услуг
              </h2>
              <p className="muted client-discover-meta">Найдено точек: {allLocations.length}</p>
            </div>
            <div
              className={[
                "client-discover-map-wrap",
                mapOrgPopup && "client-discover-map-wrap--has-sheet",
                mapOrgReviewsOpen && "client-discover-map-wrap--org-reviews",
                (clientBookModalOpen || clientFiltersOpen) && "client-discover-map-wrap--blocked",
                (clientBookModalOpen || clientFiltersOpen) && "client-discover-map-wrap--sheet-inert",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div id="client-discover-map" className="client-discover-map" role="application" aria-label="Карта точек записи" />
              {mapOrgPopup && (
                <div
                  className={["map-org-sheet", mapOrgReviewsOpen && "map-org-sheet--reviews-open"].filter(Boolean).join(" ")}
                  role="dialog"
                  aria-label="Организация на карте"
                >
                  <div className="map-org-sheet-sticky-top">
                    <button
                      type="button"
                      className="map-org-sheet-close map-org-sheet-close--float"
                      aria-label="Закрыть"
                      onClick={(e) => {
                        e.stopPropagation();
                        closeMapOrgSheet();
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <div className="map-org-sheet-header">
                    {(() => {
                      const sphereKey = mapOrgPopup.provider_sphere || mapOrgProfile?.provider_sphere;
                      const sphereLabel =
                        mapOrgPopup.sphere_label ||
                        mapOrgProfile?.sphere_label ||
                        sphereOptions.find((o) => o.key === sphereKey)?.value ||
                        "";
                      return sphereLabel ? (
                        <p className="map-org-sheet-sphere">{sphereLabel}</p>
                      ) : null;
                    })()}
                    <h3 className="map-org-sheet-title">
                      {mapOrgPopup.organization_name || mapOrgPopup.title}
                    </h3>
                    {(mapOrgProfile?.average_rating != null || mapOrgSummary?.average_rating != null) && (
                      <p className="map-org-sheet-rating">
                        ★ {Number(mapOrgProfile?.average_rating ?? mapOrgSummary?.average_rating).toFixed(2)}
                        {" "}
                        ({mapOrgProfile?.reviews_count ?? mapOrgSummary?.reviews_count ?? 0} отзывов)
                      </p>
                    )}
                  </div>

                  {buildOrgCarouselItems(mapOrgProfile).length > 0 && (

                    <div className="map-org-carousel">

                      <button

                        type="button"

                        className="map-org-carousel-main"

                        onClick={() => {
                          const items = buildOrgCarouselItems(mapOrgProfile);
                          openOrgPhotoLightbox(items, mapOrgCarouselIndex);
                        }}

                      >

                        <img

                          src={buildOrgCarouselItems(mapOrgProfile)[mapOrgCarouselIndex]?.url}

                          alt=""

                        />

                      </button>

                      {buildOrgCarouselItems(mapOrgProfile).length > 1 && (

                        <div className="map-org-carousel-thumbs">

                          {buildOrgCarouselItems(mapOrgProfile).map((ph, idx) => (

                            <button

                              key={ph.id}

                              type="button"

                              className={["map-org-carousel-thumb", idx === mapOrgCarouselIndex && "map-org-carousel-thumb--active"].filter(Boolean).join(" ")}

                              onClick={() => setMapOrgCarouselIndex(idx)}

                            >

                              <img src={ph.url} alt="" />

                            </button>

                          ))}

                        </div>

                      )}

                    </div>

                  )}

                  {(mapOrgProfile?.phones?.length > 0 || mapOrgProfile?.websites?.length > 0) && (
                    <MapOrgContactsBlock phones={mapOrgProfile.phones} websites={mapOrgProfile.websites} />
                  )}

                  {mapOrgProfile?.card_note ? (

                    <p className="map-org-card-note">{mapOrgProfile.card_note}</p>

                  ) : null}

                  {mapOrgProfile?.working_hours ? (
                    <MapOrgHoursBlock workingHours={mapOrgProfile.working_hours} />
                  ) : null}

                  {mapOrgPopup.address && <p className="muted small">{mapOrgPopup.address}</p>}

                  <div className="map-org-sheet-actions row-2">

                    <button

                      type="button"

                      onClick={() => {

                        const filterDate = clientDiscoverFiltersRef.current?.slot_date || todayIsoDate();

                        onClientLocationSelect(String(mapOrgPopup.id), filterDate);

                        setClientBookModalOpen(true);

                      }}

                    >

                      Записаться

                    </button>

                    <button type="button" onClick={() => openChatWithProvider(mapOrgPopup.provider)}>

                      Чат

                    </button>

                  </div>

                  {(mapOrgProfile?.reviews_count > 0 || mapOrgReviews.length > 0) && (

                    <div className="map-org-reviews">

                      <div className="map-org-reviews-head">

                        <p className="field-label">Отзывы</p>

                        <select

                          value={mapOrgReviewsOrdering}

                          onChange={(e) => {

                            setMapOrgReviewsOrdering(e.target.value);

                            loadMapOrgReviews(mapOrgPopup.provider, e.target.value);

                          }}

                        >

                          <option value="-created_at">Сначала новые</option>

                          <option value="-rating">Сначала положительные</option>

                          <option value="rating">Сначала негативные</option>

                        </select>

                      </div>

                      <ul className="list review-list">

                        {mapOrgReviews.length === 0 ? (

                          <li className="muted">Загрузка…</li>

                        ) : (

                          mapOrgReviews.map((r) => renderReviewListItem(r, { reviewsForGallery: mapOrgReviews }))

                        )}

                      </ul>

                    </div>

                  )}

                </div>
              )}
            </div>
            <p className="muted client-discover-hint">Нажми на метку, чтобы открыть карточку организации.</p>
          </section>
        )}

        {accessToken && me?.role === "client" && false && currentView === "client_book" && (
          <section className="card client-book-card">
            <h2>Записаться</h2>
            <p className="muted">
              Список точек совпадает с фильтрами на вкладке «Карта». Можно выбрать организацию и свободное время.
            </p>
            <form onSubmit={createClientBooking} className="form">
              <label className="field-label" htmlFor="client-book-location">Точка / организация</label>
              <select
                id="client-book-location"
                value={clientBookingForm.locationId}
                onChange={(e) => onClientLocationSelect(e.target.value)}
                required
              >
                <option value="">Выбери точку</option>
                {allLocations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {[item.organization_name, item.title].filter(Boolean).join(" · ") || "Организация"} — {item.address}
                  </option>
                ))}
              </select>
              <MiniDatePicker
                id="client-book-date"
                label="Дата записи"
                value={clientBookingForm.bookDate}
                onChange={(iso) => setClientBookingForm((p) => ({ ...p, bookDate: iso, windowKey: "" }))}
              />
              <label className="field-label" htmlFor="client-book-service">Услуга</label>
              <select
                id="client-book-service"
                value={clientBookingForm.serviceId}
                onChange={(e) => setClientBookingForm((p) => ({ ...p, serviceId: e.target.value, windowKey: "" }))}
                required
                disabled={!clientBookingForm.provider}
              >
                <option value="">Выбери услугу</option>
                {providerServices.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.price} ₽ ({s.duration_minutes} мин)
                  </option>
                ))}
              </select>
              {clientBookingForm.serviceId && clientBookingForm.bookDate && (
                <>
                  <p className="field-label">Свободное время</p>
                  {clientBookWindows.length === 0 ? (
                    <p className="muted small">Нет свободных интервалов на эту дату.</p>
                  ) : (
                    <div className="client-slot-strip" role="listbox" aria-label="Доступное время">
                      {clientBookWindows.map((w) => {
                        const key = clientWindowKey(w);
                        const active = clientBookingForm.windowKey === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            role="option"
                            aria-selected={active}
                            className={["client-slot-chip", active && "client-slot-chip--active"].filter(Boolean).join(" ")}
                            onClick={() => setClientBookingForm((p) => ({ ...p, windowKey: key }))}
                          >
                            <span className="client-slot-chip-time">
                              {formatTimeHm(w.starts_at)} — {formatTimeHm(w.ends_at)}
                            </span>
                            <span className="client-slot-chip-master">{w.staff_label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
              <input
                placeholder="Комментарий к записи"
                value={clientBookingForm.comment}
                onChange={(e) => setClientBookingForm({ ...clientBookingForm, comment: e.target.value })}
              />
              <button type="submit" disabled={!clientBookingForm.windowKey}>
                Подтвердить запись
              </button>
            </form>
            <p className="status">{clientStatus}</p>
          </section>
        )}

        {accessToken && me?.role === "client" && currentView === "bookings" && renderBookingsBlock("Мои записи")}

        {accessToken && currentView === "booking_history" && renderBookingHistory()}

        {accessToken && me?.role === "client" && clientFiltersOpen && typeof document !== "undefined" && createPortal(
          <div
            className="modal-backdrop modal-backdrop--app-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="client-filters-title"
            onClick={() => setClientFiltersOpen(false)}
          >
            <div className="modal-card client-filters-modal" onClick={(e) => e.stopPropagation()}>
              <h3 id="client-filters-title">Фильтры</h3>
              <div className="form">
                <label className="field-label" htmlFor="client-filter-sphere">
                  Сфера услуг
                </label>
                <select
                  id="client-filter-sphere"
                  value={clientFilterModalDraft.sphere}
                  onChange={(e) => setClientFilterModalDraft((d) => ({ ...d, sphere: e.target.value }))}
                >
                  <option value="">Любая</option>
                  {sphereOptions.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.value}
                    </option>
                  ))}
                </select>
                <div className="row-2">
                  <div>
                    <label className="field-label" htmlFor="client-filter-minp">
                      Цена от (₽)
                    </label>
                    <input
                      id="client-filter-minp"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="не важно"
                      value={clientFilterModalDraft.min_price}
                      onChange={(e) => setClientFilterModalDraft((d) => ({ ...d, min_price: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="client-filter-maxp">
                      Цена до (₽)
                    </label>
                    <input
                      id="client-filter-maxp"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="не важно"
                      value={clientFilterModalDraft.max_price}
                      onChange={(e) => setClientFilterModalDraft((d) => ({ ...d, max_price: e.target.value }))}
                    />
                  </div>
                </div>
                <p className="muted small">Учитывается диапазон цен активных услуг исполнителя.</p>
                <MiniDatePicker
                  id="client-filter-date"
                  label="Дата записи"
                  value={clientFilterModalDraft.slot_date}
                  allowClear
                  onChange={(iso) => setClientFilterModalDraft((d) => ({ ...d, slot_date: iso }))}
                />
                <p className="muted small">Дату и время указывайте только если нужны исполнители со свободным слотом. Для фильтра по сфере оставьте дату пустой.</p>
                <div className="row-2">
                  <div>
                    <label className="field-label" htmlFor="client-filter-tf">
                      Время с
                    </label>
                    <input
                      id="client-filter-tf"
                      type="time"
                      value={clientFilterModalDraft.time_from}
                      onChange={(e) => setClientFilterModalDraft((d) => ({ ...d, time_from: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="client-filter-tt">
                      Время до
                    </label>
                    <input
                      id="client-filter-tt"
                      type="time"
                      value={clientFilterModalDraft.time_to}
                      onChange={(e) => setClientFilterModalDraft((d) => ({ ...d, time_to: e.target.value }))}
                    />
                  </div>
                </div>
                <p className="muted small">Время учитывается только вместе с выбранной датой или диапазоном дат на сервере.</p>
              </div>
              <div className="client-filters-actions">
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => {
                    const empty = emptyClientFilters();
                    setClientFilterModalDraft(empty);
                    setClientDiscoverFilters(empty);
                    setClientFiltersOpen(false);
                  }}
                >
                  Сбросить всё
                </button>
                <button type="button" className="ghost-btn" onClick={() => setClientFiltersOpen(false)}>
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const slotDate = String(clientFilterModalDraft.slot_date || "").trim();
                    const timeFrom = String(clientFilterModalDraft.time_from || "").trim();
                    const timeTo = String(clientFilterModalDraft.time_to || "").trim();
                    const nextFilters = {
                      ...clientFilterModalDraft,
                      slot_date: slotDate,
                      time_from: slotDate ? timeFrom : "",
                      time_to: slotDate ? timeTo : "",
                    };
                    setClientDiscoverFilters(nextFilters);
                    setClientBookingForm((p) => ({
                      ...p,
                      bookDate: slotDate || p.bookDate || todayIsoDate(),
                    }));
                    setClientFiltersOpen(false);
                  }}
                >
                  Применить
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
      </main>

      {bookingMessageError && typeof document !== "undefined" && createPortal(
        <div
          className="modal-backdrop modal-backdrop--app-overlay"
          role="alertdialog"
          onClick={() => setBookingMessageError(null)}
        >
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>
              {bookingMessageError.code === "booking_not_started_yet"
                ? "Рано отмечать выполнение"
                : "Сообщение не задано"}
            </h3>
            <p className="muted">
              {bookingMessageError.code === "booking_not_started_yet"
                ? bookingMessageError.detail
                  || "Отметить «услуга оказана» можно только после начала записи по времени."
                : bookingMessageError.code === "confirm_message_not_set"
                  ? "Сообщение для подтверждения записи не задано. Задайте его в настройках организации."
                  : bookingMessageError.code === "done_message_not_set"
                    ? "Сообщение при отметке «услуга оказана» не задано. Задайте его в настройках организации."
                    : "Сообщение об отмене записи не задано. Задайте его в настройках организации."}
            </p>
            <div className="row-2">
              {bookingMessageError.code !== "booking_not_started_yet" ? (
                <button type="button" onClick={() => goOrgSettingsForBookingMessage(bookingMessageError.code)}>
                  Перейти в настройки
                </button>
              ) : null}
              <button type="button" className="ghost-btn" onClick={() => setBookingMessageError(null)}>
                Закрыть
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {orgPhotoLightbox?.items?.length > 0 && typeof document !== "undefined" && createPortal(
        <div
          className="photo-lightbox-backdrop"
          onClick={() => setOrgPhotoLightbox(null)}
        >
          {orgPhotoLightbox.items.length > 1 ? (
            <>
              <button
                type="button"
                className="photo-lightbox-nav photo-lightbox-nav--prev"
                aria-label="Предыдущее фото"
                onClick={(e) => {
                  e.stopPropagation();
                  stepOrgPhotoLightbox(-1);
                }}
              >
                ‹
              </button>
              <button
                type="button"
                className="photo-lightbox-nav photo-lightbox-nav--next"
                aria-label="Следующее фото"
                onClick={(e) => {
                  e.stopPropagation();
                  stepOrgPhotoLightbox(1);
                }}
              >
                ›
              </button>
              <p className="photo-lightbox-counter">
                {orgPhotoLightbox.index + 1} / {orgPhotoLightbox.items.length}
              </p>
            </>
          ) : null}
          <div className="photo-lightbox-inner" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Просмотр фото">
            <button type="button" className="photo-lightbox-close" aria-label="Закрыть" onClick={() => setOrgPhotoLightbox(null)}>
              ×
            </button>
            <div
              className="photo-lightbox-viewport"
              onTouchStart={(e) => {
                orgPhotoLightboxTouchX.current = e.touches?.[0]?.clientX ?? 0;
              }}
              onTouchEnd={(e) => {
                if (orgPhotoLightbox.items.length < 2) return;
                const x = e.changedTouches?.[0]?.clientX ?? 0;
                const dx = x - orgPhotoLightboxTouchX.current;
                if (Math.abs(dx) < 48) return;
                e.stopPropagation();
                stepOrgPhotoLightbox(dx > 0 ? -1 : 1);
              }}
            >
              {orgPhotoLightbox.items.map((item, i) => (
                <img
                  key={item.id || item.url}
                  src={item.url}
                  alt=""
                  draggable={false}
                  className={[
                    "photo-lightbox-slide",
                    i === orgPhotoLightbox.index && "photo-lightbox-slide--active",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                />
              ))}
            </div>
            {orgPhotoLightbox.items[orgPhotoLightbox.index]?.source === "review" && (
              <PhotoLightboxReviewCaption
                key={orgPhotoLightbox.items[orgPhotoLightbox.index]?.id || orgPhotoLightbox.index}
                photo={orgPhotoLightbox.items[orgPhotoLightbox.index]}
              />
            )}
          </div>
        </div>,
        document.body,
      )}

      {reviewModalBooking && typeof document !== "undefined" && createPortal(
        <div
          className="modal-backdrop modal-backdrop--app-overlay"
          onClick={() => {
            setReviewModalBooking(null);
            setReviewModalReview(null);
          }}
        >
          <div
            className="modal-card review-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="review-modal-title"
          >
            <div className="review-modal-head">
              <h3 id="review-modal-title">{reviewModalReview?.id ? "Дополнить отзыв" : "Отзыв"}</h3>
              <button
                type="button"
                className="review-modal-close"
                aria-label="Закрыть"
                onClick={() => {
                  setReviewModalBooking(null);
                  setReviewModalReview(null);
                }}
              >
                ×
              </button>
            </div>
            <form onSubmit={submitClientReview} className="form review-modal-form">
              <div className="review-modal-body">
                {reviewModalReview?.id ? (
                  <p className="muted small review-modal-existing">
                    Текущая оценка: {"★".repeat(reviewModalReview.rating)}
                    {reviewModalReview.text ? (
                      <>
                        <br />
                        {reviewModalReview.text}
                      </>
                    ) : null}
                  </p>
                ) : (
                  <>
                    <p className="field-label">Оценка</p>
                    <StarRating
                      value={reviewForm.rating}
                      onChange={(rating) => setReviewForm((p) => ({ ...p, rating }))}
                    />
                  </>
                )}
                <textarea
                  placeholder={reviewModalReview?.id ? "Дополнительный текст к отзыву" : "Комментарий (необязательно)"}
                  value={reviewForm.text}
                  onChange={(e) => setReviewForm((p) => ({ ...p, text: e.target.value }))}
                  rows={4}
                />
                <label className="field-label" htmlFor="review-photos-input">
                  {reviewModalReview?.id ? "Добавить фото" : "Фото (необязательно)"}
                </label>
                <input id="review-photos-input" type="file" accept="image/*" multiple />
                {reviewSubmitError ? <p className="status error">{reviewSubmitError}</p> : null}
              </div>
              <div className="review-modal-actions">
                <button type="submit" className="review-modal-submit">
                  {reviewModalReview?.id ? "Сохранить дополнение" : "Отправить отзыв"}
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => {
                    setReviewModalBooking(null);
                    setReviewModalReview(null);
                  }}
                >
                  {reviewModalReview?.id ? "Отмена" : "Пропустить"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}

      <div className="incoming-toast-stack" aria-live="polite">

        {clientBookModalOpen && typeof document !== "undefined" && createPortal(
          <div className="modal-backdrop modal-backdrop--app-overlay" onClick={() => setClientBookModalOpen(false)}>
            <div className="modal-card client-book-overlay" onClick={(e) => e.stopPropagation()}>
              <h3>Запись{mapOrgPopup?.organization_name ? ` · ${mapOrgPopup.organization_name}` : ""}</h3>
              {mapOrgProfile?.phones?.length > 0 && (
                <div className="client-book-phones">
                  {mapOrgProfile.phones.map((ph) => (
                    <a key={ph} href={`tel:${ph.replace(/[^\d+]/g, "")}`}>
                      {ph}
                    </a>
                  ))}
                </div>
              )}
              <form onSubmit={createClientBooking} className="form">
                <select value={clientBookingForm.serviceId} onChange={(e) => setClientBookingForm((p) => ({ ...p, serviceId: e.target.value, windowKey: "" }))} required disabled={!clientBookingForm.provider || providerServices.length === 0}>
                  <option value="">Услуга</option>
                  {providerServices.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} — {s.price} ₽</option>
                  ))}
                </select>
                {clientBookingForm.provider && providerServices.length === 0 ? (
                  <p className="muted small">Нет услуг, которые оказывают мастера организации. Назначьте услуги в настройках сотрудников.</p>
                ) : null}
                <MiniDatePicker label="Дата" value={clientBookingForm.bookDate} onChange={(iso) => setClientBookingForm((p) => ({ ...p, bookDate: iso, windowKey: "" }))} />
                {clientBookingForm.serviceId && clientBookingForm.bookDate && (
                  <>
                    <p className="field-label">Свободное время</p>
                    {clientBookWindows.length === 0 ? (
                      <p className="muted small">Нет свободных интервалов на эту дату.</p>
                    ) : (
                      <div className="client-slot-strip client-book-slot-strip" role="listbox" aria-label="Доступное время">
                        {clientBookWindows.map((w) => {
                          const key = clientWindowKey(w);
                          const active = clientBookingForm.windowKey === key;
                          return (
                            <button
                              key={key}
                              type="button"
                              role="option"
                              aria-selected={active}
                              className={["client-slot-chip", active && "client-slot-chip--active"].filter(Boolean).join(" ")}
                              onClick={() => setClientBookingForm((p) => ({ ...p, windowKey: key }))}
                            >
                              <span className="client-slot-chip-time">
                                {formatTimeHm(w.starts_at)} — {formatTimeHm(w.ends_at)}
                              </span>
                              {w.staff_label ? <span className="client-slot-chip-master">{w.staff_label}</span> : null}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
                <input
                  placeholder="Комментарий к записи"
                  value={clientBookingForm.comment}
                  onChange={(e) => setClientBookingForm((p) => ({ ...p, comment: e.target.value }))}
                />
                <button type="submit" disabled={!clientBookingForm.windowKey}>Подтвердить</button>
              </form>
              <p className="status">{clientStatus}</p>
            </div>
          </div>,
          document.body,
        )}

        {incomingToasts.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`incoming-toast ${t.fade ? "incoming-toast--fade" : ""}`}
            onClick={() => {
              setCurrentView("chats");
              setSelectedChatId(t.convId);
            }}
          >
            <strong>{t.title}</strong>
            <span>{t.text}</span>
          </button>
        ))}

        {calendarDayDetail &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              className="modal-backdrop modal-backdrop--app-overlay"
              onClick={() => setCalendarDayDetail(null)}
            >
              <div className="modal-card calendar-day-sheet" onClick={(e) => e.stopPropagation()} role="dialog">
                <div className="calendar-day-sheet-head">
                  <h3>
                    {(() => {
                      const ym = String(calendarDayDetail.month || "");
                      const [y, m] = ym.split("-").map(Number);
                      if (y && m) {
                        const d = new Date(y, m - 1, calendarDayDetail.day);
                        return d.toLocaleDateString("ru-RU", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        });
                      }
                      return `${calendarDayDetail.day}`;
                    })()}
                  </h3>
                  <button
                    type="button"
                    className="calendar-day-sheet-close"
                    aria-label="Закрыть"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCalendarDayDetail(null);
                    }}
                  >
                    ×
                  </button>
                </div>
                {!calendarDayDetail.items?.length ? (
                  <p className="muted calendar-day-sheet-empty">На этот день записей нет</p>
                ) : (
                  <ul className="calendar-day-sheet-list">
                    {calendarDayDetail.items.map((it) => (
                      <li key={it.id} className="calendar-day-sheet-item">
                        {calendarDayDetail.mode === "bookings" ? (
                          <>
                            <strong>
                              {new Date(it.slot_starts_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                              {" – "}
                              {new Date(it.slot_ends_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </strong>
                            <div>{bookingSlotSecondaryLabel(it)}</div>
                            {it.status ? <div className="muted">{bookingStatusLabel(it.status)}</div> : null}
                            {renderBookingSlotActions(it)}
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="calendar-day-sheet-item-delete"
                              aria-label="Удалить интервал"
                              title="Удалить"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteSlot(it.id);
                              }}
                            >
                              ×
                            </button>
                            <strong>
                              {new Date(it.starts_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                              {" – "}
                              {new Date(it.ends_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </strong>
                            <div className="muted">Свободно</div>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>,
            document.body
          )}
      </div>
    </div>
  );
}

function ServiceEditor({ service, draft, dirty, onDraftChange }) {
  const local = draft ?? buildServiceDraftFromService(service);

  return (
    <div
      className={[
        "service-editor",
        "service-editor-row",
        !local.is_active && "service-editor--inactive",
        dirty && "service-editor--dirty",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="service-editor-name">
        <strong>{service.name}</strong>
        {dirty ? <span className="service-editor-dirty-mark">●</span> : null}
      </div>
      <label className="service-editor-field">
        <span className="small-label">Цена</span>
        <input
          type="number"
          min="0"
          step="1"
          value={local.price}
          onChange={(e) => onDraftChange(service.id, { price: e.target.value })}
          placeholder="Цена"
        />
      </label>
      <label className="service-editor-field">
        <span className="small-label">Длительность (минуты)</span>
        <input
          type="number"
          min="5"
          step="5"
          value={local.duration_minutes}
          onChange={(e) => onDraftChange(service.id, { duration_minutes: e.target.value })}
          placeholder="Мин"
        />
      </label>
      <label className="checkbox service-editor-active">
        <input
          type="checkbox"
          checked={local.is_active}
          onChange={(e) => onDraftChange(service.id, { is_active: e.target.checked })}
        />
        Оказываем
      </label>
    </div>
  );
}
