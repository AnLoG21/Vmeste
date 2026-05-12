import { createPortal } from "react-dom";
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import logoMain from "./assets/logo-main.png";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
const NOMINATIM_HEADERS = { Accept: "application/json", "Accept-Language": "ru,ru-RU;q=0.9,en;q=0.5" };
const BASE_URL = API_URL.replace("/api", "");
const AUTH_URL = `${BASE_URL}/api/auth/token/`;
const REFRESH_URL = `${BASE_URL}/api/auth/token/refresh/`;
const INTERVALS_STORAGE_KEY = "vmeste_saved_intervals";
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

/** Имя в списке по умолчанию: собеседник (имя фамилия) или заголовок чата. */
function defaultChatListNameForConversation(conversation, myUserId) {
  if (!conversation) return "";
  if (conversation.is_saved_messages) return "Избранное";
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

  return t;
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
  phone: "",
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

function buildIntervalPopoverFixedStyle(anchorEl) {
  if (!anchorEl || typeof window === "undefined") return null;
  const r = anchorEl.getBoundingClientRect();
  const vw = window.innerWidth;
  const maxW = Math.min(300, Math.max(248, vw - 24));
  return {
    position: "fixed",
    top: `${Math.round(r.bottom + 8)}px`,
    left: `${Math.round(r.left + r.width / 2)}px`,
    width: `${maxW}px`,
    maxWidth: "calc(100vw - 16px)",
    transform: "translateX(-50%)",
    zIndex: 9000,
    boxSizing: "border-box",
  };
}

export default function App() {
  const [authMode, setAuthMode] = useState("login");
  const [registerStep, setRegisterStep] = useState(1);
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentView, setCurrentView] = useState("bookings");

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
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [detectedCity, setDetectedCity] = useState("");

  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [slots, setSlots] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [location, setLocation] = useState([]);
  const [allLocations, setAllLocations] = useState([]);
  const [providerServices, setProviderServices] = useState([]);
  const [providerSlots, setProviderSlots] = useState([]);
  const [clientBookingForm, setClientBookingForm] = useState({
    provider: "",
    slot: "",
    comment: "",
  });

  const [categoryForm, setCategoryForm] = useState({ name: "", allow_subcategory_booking: true });
  const [serviceForm, setServiceForm] = useState({
    category: "",
    name: "",
    price: "1000",
    duration_minutes: "30",
    is_active: true,
  });
  const [categoryOpen, setCategoryOpen] = useState({});
  const [slotForm, setSlotForm] = useState({ starts_at: "", ends_at: "" });
  const [intervalForm, setIntervalForm] = useState({
    date: "",
    start_time: "09:00",
    end_time: "18:00",
    repeat_type: "none",
    repeat_count: "1",
  });
  const [calendarMonth, setCalendarMonth] = useState(new Date().toISOString().slice(0, 7));
  const [bookingsMonth, setBookingsMonth] = useState(new Date().toISOString().slice(0, 7));
  const [intervalToast, setIntervalToast] = useState(null);
  const intervalToastTimerRef = useRef(null);
  const [savedIntervals, setSavedIntervals] = useState(() => {
    try {
      const raw = localStorage.getItem(INTERVALS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
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
  const [conversations, setConversations] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
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
  const tgAttachMenuRef = useRef(null);
  const tgMsgSearchWrapRef = useRef(null);
  const chatMsgSearchInputRef = useRef(null);
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
      manage_staff: false,
      can_delegate_permissions: false,
    };
    if (!me || me.role !== "staff") return base;
    const link = orgStaff.find((l) => Number(l.staff) === Number(me.id));
    return { ...base, ...(link?.permissions || {}) };
  }, [me, orgStaff]);

  function staffHasPerm(key) {
    if (me?.role === "provider") return true;
    if (me?.role !== "staff") return false;
    return Boolean(staffEffectivePerms[key]);
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
  }, []);

  useEffect(() => {
    if (accessToken) loadMe();
    else setMe(null);
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    loadChatActivity();
    const id = setInterval(loadChatActivity, 12000);
    return () => clearInterval(id);
  }, [accessToken, me?.id]);

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
    }
    if (me?.role === "staff") loadStaffWorkspace();
    const iv = setInterval(() => {
      if (me?.role === "provider") loadChats();
      else if (me?.role === "staff") loadStaffWorkspace();
    }, 12000);
    return () => clearInterval(iv);
  }, [accessToken, currentView, me?.role]);

  useEffect(() => {
    if (!accessToken || !selectedChatId || currentView !== "chats") return;
    let cancelled = false;
    async function tick() {
      const res = await authFetch(`${API_URL}/chat/messages/?conversation=${selectedChatId}`);
      if (!cancelled && res.ok) {
        const msgs = await res.json();
        setChatMessages(msgs);
        const last = msgs.length ? msgs[msgs.length - 1] : null;
        if (last) {
          await authFetch(`${API_URL}/chat/conversations/${selectedChatId}/mark-read/`, {
            method: "POST",
            body: JSON.stringify({ message_id: last.id }),
          });
          loadChats();
        }
      }
    }
    tick();
    const id = setInterval(tick, 5000);
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
      phone: me.phone || "",
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
    if (accessToken && me?.role === "client") loadClientData();
  }, [accessToken, me]);

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
    const canPoll = me?.role === "provider" || (me?.role === "staff" && staffEffectivePerms.manage_chats);
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
          }, 5000);
          setTimeout(() => {
            setIncomingToasts((t) => t.filter((x) => x.id !== toastId));
          }, 5600);
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
    if (authMode === "register" && form.role === "provider") initMap();
  }, [authMode, registerStep, form.role]);

  useEffect(() => {
    if (authMode === "register" && form.role === "provider" && registerStep === 2) {
      detectCityByGeolocation();
    }
  }, [authMode, form.role, registerStep]);

  useEffect(() => {
    try {
      localStorage.setItem(INTERVALS_STORAGE_KEY, JSON.stringify(savedIntervals));
    } catch {
      // Ignore storage quota/access errors.
    }
  }, [savedIntervals]);

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
    const token = params.get("verify_email");
    if (!token) return;
    const response = await fetch(`${API_URL}/users/verify-email/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    setVerifyStatus(response.ok ? "Email подтвержден. Теперь можно войти." : "Ссылка подтверждения недействительна.");
    window.history.replaceState({}, document.title, window.location.pathname);
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
    const doRequest = async (tokenValue) =>
      fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenValue}`,
          ...(options.headers || {}),
        },
      });

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
      setAuthStatus(error.detail || "Ошибка входа.");
      return;
    }
    const data = await response.json();
    setAccessToken(data.access);
    setRefreshToken(data.refresh);
    localStorage.setItem("vmeste_access", data.access);
    localStorage.setItem("vmeste_refresh", data.refresh);
    setAuthStatus("Вход выполнен.");
  }

  function logout() {
    localStorage.removeItem("vmeste_access");
    localStorage.removeItem("vmeste_refresh");
    setAccessToken("");
    setRefreshToken("");
    setMe(null);
    setCurrentView("bookings");
    setAuthStatus("Вы вышли.");
  }

  async function onSubmit(event) {
    event.preventDefault();
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
      setStatus(typeof error === "object" ? "Проверь поля регистрации." : "Ошибка регистрации.");
      return;
    }
    setStatus("Регистрация успешна. Подтверди email (ссылка в логе backend).");
    setForm(emptyRegisterForm);
    setRegisterStep(1);
    setLoginForm({ username: form.username, password: form.password });
    setAuthMode("login");
  }

  async function resendVerification() {
    setResendStatus("Отправляем письмо...");
    const response = await authFetch(`${API_URL}/users/resend-verification/`, {
      method: "POST",
      body: JSON.stringify({ email: me?.email || form.email || "" }),
    });
    if (!response.ok) {
      setResendStatus("Не удалось отправить письмо.");
      return;
    }
    const data = await response.json();
    setResendStatus(data.detail || "Письмо отправлено.");
  }

  function initMap() {
    const ymaps = window.ymaps;
    if (!ymaps || mapRef.current) return;
    ymaps.ready(() => {
      if (mapRef.current) return;
      mapRef.current = new ymaps.Map("reg-map", {
        center: [Number(form.organization_latitude), Number(form.organization_longitude)],
        zoom: 11,
      });
      mapRef.current.events.add("click", (e) => {
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

  function initProfileMapFromCoords(lat, lon) {
    const ymaps = window.ymaps;
    if (!ymaps) return;
    if (profileMapRef.current) return;
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
  }

  function initBranchEditMapFromCoords(lat, lon) {
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
          const addr = simplifyCommaAddressLine(shortAddress || result?.display_name || prev.address);
          setLocationForm((prev) => ({
            ...prev,
            latitude: plat.toFixed(6),
            longitude: plon.toFixed(6),
            address: addr,
          }));
          if (city) setDetectedCity(city);
        });
        if (branchEditPlacemarkRef.current) {
          branchEditPlacemarkRef.current.geometry.setCoordinates(coords);
        }
      });
    });
  }

  function initBranchAddMapFromCoords(lat, lon) {
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
          const addr = simplifyCommaAddressLine(shortAddress || result?.display_name || prev.address);
          setLocationForm((prev) => ({
            ...prev,
            latitude: plat.toFixed(6),
            longitude: plon.toFixed(6),
            address: addr,
          }));
          if (city) setDetectedCity(city);
        });
        if (branchAddPlacemarkRef.current) {
          branchAddPlacemarkRef.current.geometry.setCoordinates(coords);
        }
      });
    });
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
    if (bookingRes.ok) setBookings(await bookingRes.json());
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
    const [staffRes, convRes] = await Promise.all([
      authFetch(`${API_URL}/booking/staff/`),
      authFetch(`${API_URL}/chat/conversations/`),
    ]);
    if (staffRes.ok) setOrgStaff(await staffRes.json());
    if (convRes.ok) setConversations(await convRes.json());
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

  async function sendChatMessage(event) {
    event.preventDefault();
    if (!selectedChatId || !chatInput.trim()) return;
    const response = await authFetch(`${API_URL}/chat/messages/`, {
      method: "POST",
      body: JSON.stringify({ conversation: selectedChatId, text: chatInput.trim() }),
    });
    if (!response.ok) {
      setChatStatus("Не удалось отправить сообщение.");
      return;
    }
    setChatInput("");
    setChatStatus("");
    const res = await authFetch(`${API_URL}/chat/messages/?conversation=${selectedChatId}`);
    if (res.ok) {
      const msgs = await res.json();
      setChatMessages(msgs);
      const last = msgs.length ? msgs[msgs.length - 1] : null;
      if (last) {
        await authFetch(`${API_URL}/chat/conversations/${selectedChatId}/mark-read/`, {
          method: "POST",
          body: JSON.stringify({ message_id: last.id }),
        });
        loadChats();
      }
    }
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

  async function loadClientData() {
    const [locationsRes, bookingsRes] = await Promise.all([
      authFetch(`${API_URL}/locations/`),
      authFetch(`${API_URL}/booking/`),
    ]);
    if (locationsRes.ok) setAllLocations(await locationsRes.json());
    if (bookingsRes.ok) setBookings(await bookingsRes.json());
  }

  async function createCategory(event) {
    event.preventDefault();
    const response = await authFetch(`${API_URL}/catalog/categories/`, {
      method: "POST",
      body: JSON.stringify(categoryForm),
    });
    if (!response.ok) return setSellerStatus("Ошибка при создании категории.");
    setCategoryForm({ name: "", allow_subcategory_booking: true });
    setSellerStatus("Категория создана.");
    loadSellerData();
  }

  async function createService(event) {
    event.preventDefault();
    const payload = {
      ...serviceForm,
      category: serviceForm.category ? Number(serviceForm.category) : null,
      price: Number(serviceForm.price),
      duration_minutes: Number(serviceForm.duration_minutes),
    };
    const response = await authFetch(`${API_URL}/catalog/services/`, { method: "POST", body: JSON.stringify(payload) });
    if (!response.ok) return setSellerStatus("Ошибка при создании услуги.");
    setServiceForm({ category: "", name: "", price: "1000", duration_minutes: "30", is_active: true });
    setSellerStatus("Услуга создана.");
    loadSellerData();
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
    setStatus("Личные данные обновлены.");
    loadMe();
  }

  async function changePassword(event) {
    event.preventDefault();
    const response = await authFetch(`${API_URL}/users/change-password/`, {
      method: "POST",
      body: JSON.stringify(passwordForm),
    });
    if (!response.ok) return setStatus("Не удалось сменить пароль.");
    setStatus("Пароль успешно изменен.");
    setPasswordForm({ old_password: "", new_password: "", new_password_confirm: "" });
  }

  async function changeEmail(event) {
    event.preventDefault();
    const response = await authFetch(`${API_URL}/users/change-email/`, {
      method: "POST",
      body: JSON.stringify(emailForm),
    });
    if (!response.ok) return setStatus("Не удалось сменить email.");
    setStatus("Email изменен. Подтверди его по письму.");
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

  async function onProviderChange(providerId) {
    setClientBookingForm({ provider: providerId, slot: "", comment: "" });
    if (!providerId) return;
    const [servicesRes, slotsRes] = await Promise.all([
      authFetch(`${API_URL}/catalog/services/?provider=${providerId}`),
      authFetch(`${API_URL}/booking/slots/?provider=${providerId}`),
    ]);
    if (servicesRes.ok) setProviderServices(await servicesRes.json());
    if (slotsRes.ok) setProviderSlots(await slotsRes.json());
  }

  async function createClientBooking(event) {
    event.preventDefault();
    const serviceId = providerServices.find((s) => s.is_active)?.id;
    if (!serviceId) {
      setClientStatus("У исполнителя нет активных услуг для записи.");
      return;
    }
    const response = await authFetch(`${API_URL}/booking/`, {
      method: "POST",
      body: JSON.stringify({
        provider: Number(clientBookingForm.provider),
        service: Number(serviceId),
        slot: Number(clientBookingForm.slot),
        comment: clientBookingForm.comment,
      }),
    });
    if (!response.ok) return setClientStatus("Не удалось создать запись.");
    setClientStatus("Запись создана.");
    setClientBookingForm({ provider: "", slot: "", comment: "" });
    loadClientData();
  }

  function renderBookingCalendar(title = "Записи") {
    const [year, month] = bookingsMonth.split("-").map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const offset = (firstDay.getDay() + 6) % 7;
    const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

    const byDay = bookings
      .filter((b) => b.slot_starts_at?.slice(0, 7) === bookingsMonth)
      .reduce((acc, item) => {
        const day = Number(item.slot_starts_at.slice(8, 10));
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
        <div className="calendar-grid">
          {weekdays.map((wd, wi) => (
            <div key={wd} className={`calendar-head ${wi >= 5 ? "weekend-head" : ""}`}>{wd}</div>
          ))}
          {cells.map((day, idx) => {
            const col = idx % 7;
            const weekend =
              day != null ? (offset + day - 1) % 7 >= 5 : col >= 5;
            return (
            <div key={`${day ?? "empty"}-${idx}`} className={`calendar-cell ${day ? "" : "empty"} ${weekend ? "weekend-cell" : ""}`}>
              {day && (
                <>
                  <div className="calendar-day">{day}</div>
                  <div className="calendar-slots">
                    {(byDay[day] || []).map((it) => (
                      <div key={it.id} className="calendar-slot booking">
                        <span>
                          {new Date(it.slot_starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          {" - "}
                          {new Date(it.slot_ends_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <strong>{it.status}</strong>
                      </div>
                    ))}
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

  function renderSlotCalendar(showCreateControls = false) {
    const [year, month] = calendarMonth.split("-").map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const offset = (firstDay.getDay() + 6) % 7;
    const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

    const byDay = slots
      .filter((s) => s.starts_at?.slice(0, 7) === calendarMonth)
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
            return (
            <div
              key={`${day ?? "empty"}-${idx}`}
              className={`calendar-cell ${day ? "clickable" : ""} ${day ? "" : "empty"} ${weekend ? "weekend-cell" : ""}`}
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
                  <div className="calendar-day">{day}</div>
                  <div className="calendar-slots">
                    {(byDay[day] || []).slice(0, 3).map((s) => (
                      <div key={s.id} className="slot-chip">
                        <span>
                          {new Date(s.starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          {" - "}
                          {new Date(s.ends_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {!s.is_booked && (
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
                        )}
                      </div>
                    ))}
                    {(byDay[day] || []).length > 3 && <div className="muted">+{(byDay[day] || []).length - 3}</div>}
                    {(byDay[day] || []).some((s) => s.recurrence_group && !s.is_booked) && (
                      <button
                        type="button"
                        className="small-btn ghost-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          const grp = (byDay[day] || []).find((s) => s.recurrence_group && !s.is_booked)?.recurrence_group;
                          if (grp) deleteSeries(grp);
                        }}
                      >
                        Удалить серию
                      </button>
                    )}
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

  function renderServiceTree() {
    const uncategorized = services.filter((s) => !s.category);
    return (
      <div>
        <h2>Все услуги</h2>
        <div className="tree-list">
          {categories.map((cat) => {
            const catServices = services.filter((s) => s.category === cat.id);
            const isOpen = categoryOpen[cat.id] ?? true;
            return (
              <div key={cat.id} className="tree-node">
                <button
                  type="button"
                  className="tree-toggle"
                  onClick={() => setCategoryOpen((prev) => ({ ...prev, [cat.id]: !isOpen }))}
                >
                  {isOpen ? "▼" : "▶"} {cat.name}
                </button>
                {isOpen && (
                  <div className="tree-children">
                    {catServices.length === 0 && <p className="muted">Нет услуг</p>}
                    {catServices.map((srv) => (
                      <ServiceEditor
                        key={srv.id}
                        service={srv}
                        categories={categories}
                        onSave={updateService}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <div className="tree-node">
            <h4>Без категории</h4>
            <div className="tree-children">
              {uncategorized.length === 0 && <p className="muted">Нет услуг</p>}
              {uncategorized.map((srv) => (
                <ServiceEditor
                  key={srv.id}
                  service={srv}
                  categories={categories}
                  onSave={updateService}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const chatsTabUnreadChatsCount = useMemo(
    () => conversations.filter((c) => (Number(c.unread_message_count) || 0) > 0).length,
    [conversations],
  );

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
    const folder = chatFolder;
    let list = conversations.filter((c) => (folder === "clients" ? c.is_client_correspondence : !c.is_client_correspondence));
    const q = chatSearchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => displayConversationTitle(c).toLowerCase().includes(q));
    }
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
  }, [conversations, chatFolder, chatSearchQuery, chatLocalPrefs, chatPins]);

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
          <input type="password" value={passwordForm.old_password} onChange={(e) => setPasswordForm({ ...passwordForm, old_password: e.target.value })} placeholder="Старый пароль" />
          <input type="password" value={passwordForm.new_password} onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })} placeholder="Новый пароль" />
          <input type="password" value={passwordForm.new_password_confirm} onChange={(e) => setPasswordForm({ ...passwordForm, new_password_confirm: e.target.value })} placeholder="Повтори новый пароль" />
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
              manage_staff: false,
              can_delegate_permissions: false,
              ...(link.permissions || {}),
            };
            const permLabels = [
              ["manage_bookings", "Записи клиентов"],
              ["manage_intervals", "Календарь интервалов"],
              ["manage_services", "Услуги и категории"],
              ["manage_chats", "Чаты организации"],
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
    return chatMessages.filter((m) => (m.text || "").toLowerCase().includes(q));
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
    }
  }, [selectedChatId]);
  const activeChatWallpaper = selectedChatId ? chatLocalPrefs[selectedChatId]?.wallpaper : null;
  const tgMainStyle = activeChatWallpaper
    ? String(activeChatWallpaper).includes("gradient")
      ? { background: activeChatWallpaper, backgroundSize: "cover" }
      : { backgroundColor: activeChatWallpaper }
    : undefined;
  const tgMainDark = activeChatWallpaper === "#1e2a24";
  const centeredWorkspace = accessToken && ["profile", "organization", "staff", "settings"].includes(currentView);

  return (
    <div className={`page${accessToken ? " page-logged" : ""}`}>
      <header className="hero top-row">
        <button type="button" className="brand-link brand-btn" onClick={() => setCurrentView("bookings")}>
          <img
            src={logoMain}
            alt="Vmeste"
            className="brand-logo"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </button>
        <div>{verifyStatus && <p className="verify-note">{verifyStatus}</p>}</div>
        {accessToken && (
          <div className="menu-wrap">
            <div className="menu-btn-wrap">
              <button
                type="button"
                className="menu-btn menu-btn--icon"
                aria-label="Меню"
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

      {accessToken && me?.role === "provider" && (
        <nav className="app-subnav" aria-label="Разделы исполнителя">
          <button type="button" className={currentView === "bookings" ? "active" : ""} onClick={() => setCurrentView("bookings")}>Записи</button>
          <button type="button" className={currentView === "intervals" ? "active" : ""} onClick={() => setCurrentView("intervals")}>Календарь интервалов</button>
          <button type="button" className={currentView === "services" ? "active" : ""} onClick={() => setCurrentView("services")}>Услуги и категории</button>
          <button
            type="button"
            className={["app-subnav-chat", currentView === "chats" && "active"].filter(Boolean).join(" ")}
            onClick={() => setCurrentView("chats")}
          >
            <span className="app-subnav-chat-inner" aria-hidden="true">
              <svg className="app-subnav-chat-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
              </svg>
              <span>Чаты</span>
            </span>
            {chatsTabUnreadChatsCount > 0 && (
              <span className="app-subnav-badge" aria-hidden="true">
                {chatsTabUnreadChatsCount > 99 ? "99+" : chatsTabUnreadChatsCount}
              </span>
            )}
          </button>
        </nav>
      )}

      {accessToken && me?.role === "staff" && (
        <nav className="app-subnav" aria-label="Разделы сотрудника">
          {staffHasPerm("manage_bookings") && (
            <button type="button" className={currentView === "bookings" ? "active" : ""} onClick={() => setCurrentView("bookings")}>Записи</button>
          )}
          {staffHasPerm("manage_chats") && (
            <button
              type="button"
              className={["app-subnav-chat", currentView === "chats" && "active"].filter(Boolean).join(" ")}
              onClick={() => setCurrentView("chats")}
            >
              <span className="app-subnav-chat-inner" aria-hidden="true">
                <svg className="app-subnav-chat-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
                </svg>
                <span>Чаты</span>
              </span>
              {chatsTabUnreadChatsCount > 0 && (
                <span className="app-subnav-badge" aria-hidden="true">
                  {chatsTabUnreadChatsCount > 99 ? "99+" : chatsTabUnreadChatsCount}
                </span>
              )}
            </button>
          )}
        </nav>
      )}

      <main className={`grid ${!accessToken ? "grid-auth" : ""}${centeredWorkspace ? " grid-centered-workspace" : ""}`}>
        {!accessToken && (
          <section className="card profile-card">
            <h2>{authMode === "login" ? "Вход" : "Регистрация"}</h2>
            {authMode === "login" ? (
              <form onSubmit={onLogin} className="form">
                <input placeholder="Логин" value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })} required />
                <input placeholder="Пароль" type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} required />
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
                    <input placeholder="Телефон" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                    <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                      {roleOptions.map((item) => <option key={item.key} value={item.key}>{item.value}</option>)}
                    </select>
                    <input placeholder="Пароль" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
                    <input
                      placeholder="Повторите пароль"
                      type="password"
                      value={form.password_confirm}
                      onChange={(e) => setForm({ ...form, password_confirm: e.target.value })}
                      required
                    />
                    {form.role === "provider" ? <button type="button" onClick={() => setRegisterStep(2)}>Продолжить</button> : <button type="submit">Создать аккаунт</button>}
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
                      <input
                        placeholder="Подъезд"
                        value={form.entrance}
                        onChange={(e) => setForm({ ...form, entrance: e.target.value })}
                      />
                      <input
                        placeholder="Этаж"
                        value={form.floor}
                        onChange={(e) => setForm({ ...form, floor: e.target.value })}
                      />
                      <input
                        placeholder="Квартира/офис"
                        value={form.apartment}
                        onChange={(e) => setForm({ ...form, apartment: e.target.value })}
                      />
                      <input
                        placeholder="Домофон"
                        value={form.intercom}
                        onChange={(e) => setForm({ ...form, intercom: e.target.value })}
                      />
                    </div>
                    <input
                      placeholder="Доп. ориентир (необязательно)"
                      value={form.organization_address_details}
                      onChange={(e) => setForm({ ...form, organization_address_details: e.target.value })}
                    />
                    <button type="button" className="ghost-btn" onClick={() => setRegisterStep(1)}>Назад</button>
                    <button type="submit">Завершить регистрацию</button>
                  </>
                )}
              </form>
            )}
            <p className="auth-switch-text">{authMode === "login" ? "Нет аккаунта?" : "Уже есть аккаунт?"}</p>
            <button className="ghost-btn" type="button" onClick={() => setAuthMode((prev) => (prev === "login" ? "register" : "login"))}>
              {authMode === "login" ? "Регистрация" : "Войти"}
            </button>
            <p className="status">{authMode === "login" ? authStatus : status}</p>
          </section>
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
                    <p>
                      {n.kind === "staff_invite_accepted"
                        ? `Сотрудник ${n.payload?.staff_name || ""} принял приглашение.`
                        : n.kind}
                    </p>
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
              <input value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} placeholder="Телефон" />
              <button type="submit">Сохранить данные</button>
            </form>
            <div className="row-2 profile-quick-nav">
              <button type="button" className="ghost-btn" onClick={() => setCurrentView("settings")}>Настройки</button>
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

        {accessToken && currentView === "settings" && renderGeneralSettings()}
        {accessToken && currentView === "organization" && canManageOrgSettings && renderOrganizationSettings()}
        {accessToken && currentView === "staff" && canManageOrgSettings && renderStaffManagement()}

        {accessToken && me?.role === "provider" && currentView === "bookings" && renderBookingsBlock("Записи клиентов")}
        {accessToken && me?.role === "provider" && currentView === "intervals" && renderSlotCalendar(true)}
        {accessToken && me?.role === "staff" && currentView === "bookings" && staffHasPerm("manage_bookings") && renderBookingsBlock("Записи")}
        {accessToken && (me?.role === "provider" || me?.role === "staff") && currentView === "chats" && (
          <section className="card full-width tg-chats-card">
            <div className="tg-body">
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
                        <div className="tg-attach-wrap" ref={tgAttachMenuRef}>
                          <button
                            type="button"
                            className="tg-head-icon-btn"
                            aria-label="Вложения"
                            title="Вложения"
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
                            <div className="tg-attach-menu" role="menu">
                              <button type="button" className="tg-attach-menu-item" onClick={() => { setChatStatus("Фото или видео — скоро"); setChatAttachMenuOpen(false); }}>
                                Фото или видео
                              </button>
                              <button type="button" className="tg-attach-menu-item" onClick={() => { setChatStatus("Файл — скоро"); setChatAttachMenuOpen(false); }}>
                                Файл
                              </button>
                              <button type="button" className="tg-attach-menu-item" onClick={() => { setChatStatus("Ссылка — скоро"); setChatAttachMenuOpen(false); }}>
                                Ссылка
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="tg-main-head-center">
                        <div className="tg-main-title">
                          {displayConversationTitle(conversations.find((c) => c.id === selectedChatId))}
                        </div>
                        {chatPeerPresenceLine ? <div className="tg-main-head-presence">{chatPeerPresenceLine}</div> : null}
                      </div>
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
                                        <span className="tg-msg-search-hit-text">{m.text || "—"}</span>
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                              <p className="tg-msg-search-keys-hint muted">В поле поиска: ↑ ↓ — к совпадениям в чате</p>
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          className="tg-head-icon-btn"
                          onClick={() => setChatReceiptsSettingsOpen(true)}
                          aria-label="Прочтение сообщений"
                          title="Прочтение сообщений"
                        >
                          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                            <path
                              fill="currentColor"
                              d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"
                            />
                          </svg>
                        </button>
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
                    <div className="tg-messages">
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
                            <div id={`tg-msg-${m.id}`} className={`tg-msg ${Number(m.sender) === Number(me?.id) ? "tg-msg-own" : ""}`}>
                              <div className="tg-msg-author">
                                {formatMessageSenderLine(m) || m.sender_username}
                              </div>
                              <div className="tg-msg-text">{m.text}</div>
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
                    <form onSubmit={sendChatMessage} className="tg-compose">
                      <input className="tg-compose-input" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Сообщение..." />
                      <button type="submit" className="tg-send-btn" aria-label="Отправить сообщение" title="Отправить">
                        <svg className="tg-send-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                          <path
                            fill="currentColor"
                            d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"
                          />
                        </svg>
                      </button>
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
                className="modal-backdrop"
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
            <section className="card right-stack">
              <h2>Создать категорию</h2>
              <form onSubmit={createCategory} className="form">
                <input
                  placeholder="Название категории"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  required
                />
                <button type="submit">Добавить категорию</button>
              </form>
              <h2>Создать услугу</h2>
              <form onSubmit={createService} className="form">
                <input
                  placeholder="Название услуги"
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                  required
                />
                <input
                  type="number"
                  placeholder="Цена"
                  value={serviceForm.price}
                  onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })}
                  required
                />
                <input
                  type="number"
                  placeholder="Длительность (мин)"
                  value={serviceForm.duration_minutes}
                  onChange={(e) => setServiceForm({ ...serviceForm, duration_minutes: e.target.value })}
                  required
                />
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={serviceForm.is_active}
                    onChange={(e) => setServiceForm({ ...serviceForm, is_active: e.target.checked })}
                  />
                  Активна
                </label>
                <select
                  value={serviceForm.category}
                  onChange={(e) => setServiceForm({ ...serviceForm, category: e.target.value })}
                >
                  <option value="">Без категории</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button type="submit">Создать услугу</button>
              </form>
              <p className="status">{sellerStatus}</p>
            </section>
          </div>
        )}

        {accessToken && me?.role === "client" && (
          <>
            {currentView !== "bookings" && (
              <section className="card profile-card">
                <h2>Личный кабинет</h2>
                <p>Вы вошли как: <strong>{fullName}</strong></p>
                <button type="button" className="ghost-btn" onClick={() => setCurrentView("settings")}>Настройки</button>
              </section>
            )}
            <section className="card">
              <h2>Выбор точки и запись</h2>
              <form onSubmit={createClientBooking} className="form">
                <select value={clientBookingForm.provider} onChange={(e) => onProviderChange(e.target.value)} required>
                  <option value="">Выбери организацию</option>
                  {allLocations.map((item) => <option key={item.id} value={item.provider}>{item.title} - {item.address}</option>)}
                </select>
                <select value={clientBookingForm.slot} onChange={(e) => setClientBookingForm({ ...clientBookingForm, slot: e.target.value })} required>
                  <option value="">Выбери время</option>
                  {providerSlots.map((item) => <option key={item.id} value={item.id}>{new Date(item.starts_at).toLocaleString()}</option>)}
                </select>
                <input placeholder="Комментарий к записи" value={clientBookingForm.comment} onChange={(e) => setClientBookingForm({ ...clientBookingForm, comment: e.target.value })} />
                <button type="submit">Записаться</button>
              </form>
              <p className="status">{clientStatus}</p>
            </section>
            {currentView === "bookings" && renderBookingsBlock("Мои записи")}
          </>
        )}
      </main>
      <div className="incoming-toast-stack" aria-live="polite">
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
      </div>
    </div>
  );
}

function ServiceEditor({ service, categories, onSave }) {
  const [local, setLocal] = useState({
    name: service.name,
    price: service.price,
    duration_minutes: service.duration_minutes,
    is_active: service.is_active,
    category: service.category ?? "",
  });

  useEffect(() => {
    setLocal({
      name: service.name,
      price: service.price,
      duration_minutes: service.duration_minutes,
      is_active: service.is_active,
      category: service.category ?? "",
    });
  }, [service]);

  return (
    <div className="service-editor service-editor-row">
      <input value={local.name} onChange={(e) => setLocal({ ...local, name: e.target.value })} placeholder="Услуга" />
      <input type="number" value={local.price} onChange={(e) => setLocal({ ...local, price: e.target.value })} placeholder="Цена" />
      <input
        type="number"
        value={local.duration_minutes}
        onChange={(e) => setLocal({ ...local, duration_minutes: e.target.value })}
        placeholder="Длительность"
      />
      <select value={local.category} onChange={(e) => setLocal({ ...local, category: e.target.value })}>
        <option value="">Без категории</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={local.is_active}
          onChange={(e) => setLocal({ ...local, is_active: e.target.checked })}
        />
        Активна
      </label>
      <button
        type="button"
        className="save-btn"
        onClick={() =>
          onSave(service.id, {
            name: local.name,
            price: Number(local.price),
            duration_minutes: Number(local.duration_minutes),
            is_active: local.is_active,
            category: local.category ? Number(local.category) : null,
          })
        }
      >
        Сохранить
      </button>
    </div>
  );
}
