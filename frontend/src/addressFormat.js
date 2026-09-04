import { trimAddrSeg, composePipeTailFromDetails, parseAddressDetailsPipeTail } from "./orgBranchUtils.js";

export const NOMINATIM_HEADERS = { Accept: "application/json", "Accept-Language": "ru,ru-RU;q=0.9,en;q=0.5" };

const ADDR_COUNTRY_SEGMENTS = new Set([
  "russia",
  "россия",
  "russian federation",
  "российская федерация",
]);

export function dedupeAddrSegments(parts) {
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

export function looksLikeHouseSegment(s) {
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

export function looksLikeStreetSegment(s) {
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
export function looksLikeAdminOnlySegment(s) {
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
export function stripTrailingAdminSegmentsFromAddress(parts) {
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
export function stripLeadingAdminWhenStreetOrHousePresent(parts) {
  const p = [...parts];
  const hasStreetOrHouse = p.some((s) => looksLikeStreetSegment(s) || looksLikeHouseSegment(s));
  if (!hasStreetOrHouse) return p;
  while (p.length > 1 && looksLikeAdminOnlySegment(p[0])) p.shift();
  return p;
}

export function addrSegNormKey(s) {
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

export function translateAddrSegToRu(seg) {
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

export function transliterateLatinToRussian(text) {
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
export function translateLatinStreetToken(seg) {
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

/** Один сегмент «улица, Moscow» от геокодера → два сегмента. */
export function splitMixedScriptCommaSegment(seg) {
  const t = trimAddrSeg(seg);
  if (!t.includes(",")) return [t];
  const hasCyr = /[а-яё]/i.test(t);
  const hasLat = /[a-z]/i.test(t);
  if (!hasCyr || !hasLat) return [t];
  return t.split(",").map(trimAddrSeg).filter(Boolean);
}

export function finalizeAddressSuggestionFromParts(parts) {
  const flat = parts.flatMap((s) => splitMixedScriptCommaSegment(s));
  let p = dedupeAddrSegments(flat).filter(Boolean);
  p = p.map((s) => translateAddrSegToRu(s));
  p = p.map((s) => translateLatinStreetToken(s));
  p = stripTrailingAdminSegmentsFromAddress(p);
  p = stripLeadingAdminWhenStreetOrHousePresent(p);
  return shortenAddressToStreetHouse(p);
}

/**
 * Короткая подпись для подсказок: «улица, дом», если хвост распознан;
 * иначе полная цепочка (регион, город, …).
 */
export function shortenAddressToStreetHouse(segments) {
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
export function insertCommasBeforeLatinAdminRun(text) {
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

export function mergeStructuredOrgPartsFromMe(m) {
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
export function simplifyCommaAddressLine(text) {
  if (!text || typeof text !== "string") return "";
  const prepared = insertCommasBeforeLatinAdminRun(insertCommasBeforeLatinAdminRun(text));
  const raw = prepared.split(",").map((x) => trimAddrSeg(x)).filter(Boolean);
  return finalizeAddressSuggestionFromParts(raw);
}

/** Строка адреса организации для отображения (отдельные поля API + старый формат «база | хвост»). */
export function composeOrgDisplayFromMe(m) {
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

export function formatPhotonHousePart(p) {
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
export function mapPhotonFeatureToSuggestion(feature) {
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

export function getCity(addressObj) {
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

export function buildShortAddress(addressObj) {
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
