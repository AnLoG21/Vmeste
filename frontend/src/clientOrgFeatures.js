export const ORG_GALLERY_MAX_PHOTOS = 5;

export const ORG_WEEKDAYS = [
  { key: "mon", label: "Понедельник", short: "Пн" },
  { key: "tue", label: "Вторник", short: "Вт" },
  { key: "wed", label: "Среда", short: "Ср" },
  { key: "thu", label: "Четверг", short: "Чт" },
  { key: "fri", label: "Пятница", short: "Пт" },
  { key: "sat", label: "Суббота", short: "Сб" },
  { key: "sun", label: "Воскресенье", short: "Вс" },
];

export function defaultOrgWorkingHours() {
  const row = { open: "09:00", close: "18:00", closed: false };
  return Object.fromEntries(ORG_WEEKDAYS.map((d) => [d.key, { ...row }]));
}

export function normalizeOrgWorkingHours(raw) {
  if (!raw || typeof raw !== "object") return defaultOrgWorkingHours();
  const base = defaultOrgWorkingHours();
  ORG_WEEKDAYS.forEach(({ key }) => {
    const row = raw[key];
    if (row && typeof row === "object") {
      base[key] = {
        open: String(row.open || "09:00").slice(0, 5),
        close: String(row.close || "18:00").slice(0, 5),
        closed: Boolean(row.closed),
      };
    }
  });
  return base;
}

export function formatOrgWorkingHoursText(hours) {
  const h = normalizeOrgWorkingHours(hours);
  return ORG_WEEKDAYS.map(({ key, label }) => {
    const row = h[key];
    if (row.closed) return `${label}: выходной`;
    return `${label}: ${row.open} – ${row.close}`;
  }).join("\n");
}

const JS_DAY_TO_ORG_KEY = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function parseHmToMinutes(hm) {
  const [h, m] = String(hm || "00:00").split(":").map((x) => Number(x) || 0);
  return h * 60 + m;
}

function dayLabelForOffset(offset) {
  if (offset === 0) return "сегодня";
  if (offset === 1) return "завтра";
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const key = JS_DAY_TO_ORG_KEY[d.getDay()];
  const wd = ORG_WEEKDAYS.find((w) => w.key === key);
  return wd ? wd.label.toLowerCase() : "";
}

/** Ближайший рабочий день с временем открытия (offset 0 = сегодня). */
function findNextOpenDay(hours, fromDate, minOffset = 0) {
  const h = normalizeOrgWorkingHours(hours);
  for (let offset = minOffset; offset < 8; offset += 1) {
    const d = new Date(fromDate);
    d.setDate(d.getDate() + offset);
    const key = JS_DAY_TO_ORG_KEY[d.getDay()];
    const row = h[key];
    if (!row?.closed) {
      return { open: row.open, close: row.close, offset, dayLabel: dayLabelForOffset(offset) };
    }
  }
  return null;
}

/**
 * Краткий статус режима работы для карточки организации.
 * @returns {{ mainText: string, isRed: boolean, fullScheduleText: string }}
 */
export function getOrgWorkingHoursStatus(hours, now = new Date()) {
  const h = normalizeOrgWorkingHours(hours);
  const fullScheduleText = formatOrgWorkingHoursText(hours);
  const dayKey = JS_DAY_TO_ORG_KEY[now.getDay()];
  const row = h[dayKey];
  const nowMin = now.getHours() * 60 + now.getMinutes();

  if (row?.closed) {
    const next = findNextOpenDay(h, now, 1);
    if (next) {
      return {
        mainText: `Выходной. Откроется ${next.dayLabel} в ${next.open}`,
        isRed: true,
        fullScheduleText,
      };
    }
    return { mainText: "Сегодня выходной", isRed: true, fullScheduleText };
  }

  const openMin = parseHmToMinutes(row.open);
  const closeMin = parseHmToMinutes(row.close);

  if (nowMin < openMin) {
    const untilOpen = openMin - nowMin;
    if (untilOpen < 60) {
      return {
        mainText: `Откроется через ${untilOpen} мин.`,
        isRed: false,
        fullScheduleText,
      };
    }
    return {
      mainText: `Закрыто до ${row.open}`,
      isRed: true,
      fullScheduleText,
    };
  }

  if (nowMin >= closeMin) {
    const next = findNextOpenDay(h, now, 1);
    if (next) {
      const nextOpenDate = new Date(now);
      nextOpenDate.setDate(nextOpenDate.getDate() + next.offset);
      const openParts = parseHmToMinutes(next.open);
      nextOpenDate.setHours(Math.floor(openParts / 60), openParts % 60, 0, 0);
      const minsUntil = Math.max(0, Math.round((nextOpenDate - now) / 60000));
      if (minsUntil > 0 && minsUntil < 60) {
        return {
          mainText: `Закрыто. Откроется через ${minsUntil} мин.`,
          isRed: true,
          fullScheduleText,
        };
      }
      const prefix = next.offset === 1 ? "завтра" : next.dayLabel;
      return {
        mainText: `Закрыто до ${next.open} (${prefix})`,
        isRed: true,
        fullScheduleText,
      };
    }
    return { mainText: "Закрыто", isRed: true, fullScheduleText };
  }

  const untilClose = closeMin - nowMin;
  if (untilClose < 60) {
    return {
      mainText: `Закроется через ${untilClose} мин.`,
      isRed: true,
      fullScheduleText,
    };
  }

  return {
    mainText: `Открыто до ${row.close}`,
    isRed: false,
    fullScheduleText,
  };
}

/** Сейчас в рабочие часы (между open и close, не выходной). */
export function isOrganizationOpenNow(hours, now = new Date()) {
  const h = normalizeOrgWorkingHours(hours);
  const dayKey = JS_DAY_TO_ORG_KEY[now.getDay()];
  const row = h[dayKey];
  if (row?.closed) return false;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const openMin = parseHmToMinutes(row.open);
  const closeMin = parseHmToMinutes(row.close);
  return nowMin >= openMin && nowMin < closeMin;
}

export function getMapPinZoomTier(zoom) {
  const z = Number(zoom);
  if (!Number.isFinite(z)) return "near";
  if (z <= 9) return "vfar";
  if (z <= 11) return "far";
  if (z <= 13) return "mid";
  return "near";
}

function mapPinIconSizeForTier(tier) {
  if (tier === "vfar") return 20;
  if (tier === "far") return 26;
  if (tier === "mid") return 36;
  return 48;
}

export function buildOrgCarouselItems(profile) {
  if (!profile) return [];
  const org = (profile.gallery_photos || []).map((p) => ({
    id: `org-${p.id}`,
    url: p.url,
    source: "org",
  }));
  const rev = (profile.review_photos || []).map((p) => ({
    id: `rev-${p.id}`,
    url: p.url,
    source: "review",
    review_id: p.review_id,
    client_name: p.client_name,
    rating: p.rating,
    text: p.text,
  }));
  return [...org, ...rev];
}

function svgDataUrl(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Стикер ✂️ — салон красоты */
function scissorsStickerSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 52 52">
  <defs>
    <filter id="vmSc" x="-12%" y="-8%" width="124%" height="128%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#c9a227" flood-opacity="0.35"/>
    </filter>
  </defs>
  <g filter="url(#vmSc)">
    <rect x="4" y="3" width="44" height="44" rx="13" fill="#FFE082"/>
    <rect x="4" y="3" width="44" height="44" rx="13" fill="none" stroke="#fff" stroke-width="2.5"/>
  </g>
  <text x="26" y="33" text-anchor="middle" font-size="26" dominant-baseline="middle">✂️</text>
</svg>`;
}

/** Стикер «колесо» — сервисный центр */
function wheelStickerSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 52 52">
  <defs>
    <filter id="vmWh" x="-12%" y="-8%" width="124%" height="128%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#1e5a8a" flood-opacity="0.35"/>
    </filter>
  </defs>
  <g filter="url(#vmWh)">
    <rect x="4" y="3" width="44" height="44" rx="13" fill="#6CB4FF"/>
    <rect x="4" y="3" width="44" height="44" rx="13" fill="none" stroke="#fff" stroke-width="2.5"/>
  </g>
  <circle cx="26" cy="25" r="14" fill="#2d3436"/>
  <circle cx="26" cy="25" r="10.5" fill="#636e72"/>
  <circle cx="26" cy="25" r="4" fill="#dfe6e9"/>
  <g stroke="#b2bec3" stroke-width="2" stroke-linecap="round">
    <line x1="26" y1="15" x2="26" y2="35"/>
    <line x1="16" y1="25" x2="36" y2="25"/>
    <line x1="18.9" y1="17.9" x2="33.1" y2="32.1"/>
    <line x1="33.1" y1="17.9" x2="18.9" y2="32.1"/>
  </g>
</svg>`;
}

function defaultStickerSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 52 52">
  <rect x="4" y="3" width="44" height="44" rx="13" fill="#ff7a00"/>
  <circle cx="26" cy="25" r="6" fill="#fff"/>
</svg>`;
}

function plateStickerSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 52 52">
  <defs>
    <filter id="vmPl" x="-12%" y="-8%" width="124%" height="128%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#8d3e00" flood-opacity="0.35"/>
    </filter>
  </defs>
  <g filter="url(#vmPl)">
    <rect x="4" y="3" width="44" height="44" rx="13" fill="#e67e22"/>
    <rect x="4" y="3" width="44" height="44" rx="13" fill="none" stroke="#fff" stroke-width="2.5"/>
  </g>
  <text x="26" y="33" text-anchor="middle" font-size="26" dominant-baseline="middle">🍽️</text>
</svg>`;
}

function boxStickerSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 52 52">
  <defs>
    <filter id="vmBx" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#0d47a1" flood-opacity="0.35"/>
    </filter>
  </defs>
  <g filter="url(#vmBx)">
    <rect x="4" y="3" width="44" height="44" rx="13" fill="#1565c0"/>
    <rect x="4" y="3" width="44" height="44" rx="13" fill="none" stroke="#fff" stroke-width="2.5"/>
  </g>
  <text x="26" y="33" text-anchor="middle" font-size="26" dominant-baseline="middle">📦</text>
</svg>`;
}

export function sphereMapIconHref(sphere) {
  if (sphere === "hair_salon") return svgDataUrl(scissorsStickerSvg());
  if (sphere === "service_center") return svgDataUrl(wheelStickerSvg());
  if (sphere === "cafe_restaurant") return svgDataUrl(plateStickerSvg());
  if (sphere === "marketplaces") return svgDataUrl(boxStickerSvg());
  return svgDataUrl(defaultStickerSvg());
}

function compactIconSvg(paths, bg = "#fff3e8", fg = "#8d3e00") {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
  <rect width="40" height="40" rx="10" fill="${bg}"/>
  <g fill="none" stroke="${fg}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</g>
</svg>`;
}

/** Иконка подкатегории/категории услуг для фильтра. */
export function serviceCategoryIconHref(slugOrName = "") {
  const key = String(slugOrName || "").toLowerCase();
  if (/cut|стриж|ножниц|hair-cut|scissors/.test(key)) {
    return svgDataUrl(
      compactIconSvg(
        `<circle cx="14" cy="14" r="4"/><circle cx="14" cy="26" r="4"/><path d="M17.5 16.5 L28 28 M17.5 23.5 L28 12"/>`,
        "#FFF8E1",
        "#C9A227",
      ),
    );
  }
  if (/color|окраш|мелир|тонир|балаяж|омбре/.test(key)) {
    return svgDataUrl(
      compactIconSvg(
        `<circle cx="14" cy="16" r="5"/><circle cx="22" cy="22" r="5"/><circle cx="26" cy="14" r="4"/>`,
        "#F3E5F5",
        "#7B1FA2",
      ),
    );
  }
  if (/nail|маник|педик|ногт/.test(key)) {
    return svgDataUrl(
      compactIconSvg(`<path d="M16 10c0-2 2-4 4-4s4 2 4 4v16c0 2-2 4-4 4s-4-2-4-4V10z"/>`, "#FCE4EC", "#C2185B"),
    );
  }
  if (/brow|бров|lash|ресниц/.test(key)) {
    return svgDataUrl(compactIconSvg(`<path d="M8 22c4-8 20-8 24 0"/><circle cx="16" cy="20" r="2"/><circle cx="24" cy="20" r="2"/>`, "#E3F2FD", "#1565C0"));
  }
  if (/massag|массаж|spa|уход|face|космет/.test(key)) {
    return svgDataUrl(compactIconSvg(`<path d="M12 24c0-6 4-10 8-10s8 4 8 10"/><circle cx="20" cy="12" r="3"/>`, "#E8F5E9", "#2E7D32"));
  }
  if (/beard|бород|брить|barber/.test(key)) {
    return svgDataUrl(compactIconSvg(`<path d="M12 14c0 8 3 12 8 12s8-4 8-12"/><path d="M14 14h12"/>`, "#EFEBE9", "#5D4037"));
  }
  if (/wheel|шин|авто|диагност|service|ремонт/.test(key)) {
    return svgDataUrl(compactIconSvg(`<circle cx="20" cy="20" r="10"/><circle cx="20" cy="20" r="3"/><path d="M20 10v4M20 26v4M10 20h4M26 20h4"/>`, "#E3F2FD", "#1565C0"));
  }
  if (/makeup|макияж|визаж/.test(key)) {
    return svgDataUrl(compactIconSvg(`<path d="M14 28 L26 12"/><circle cx="27" cy="11" r="3"/>`, "#FCE4EC", "#AD1457"));
  }
  return svgDataUrl(compactIconSvg(`<circle cx="20" cy="20" r="6"/><path d="M20 10v4M20 26v4M10 20h4M26 20h4"/>`, "#FFF3E8", "#C45C26"));
}

/**
 * Группы услуг из шаблона сферы для UI фильтра.
 * @returns {{ id: string, name: string, icon: string, services: { value: string, label: string }[] }[]}
 */
export function filterServiceGroupsFromCatalog(catalog) {
  const groups = [];
  const seen = new Set();
  for (const cat of catalog?.categories || []) {
    const subs = Array.isArray(cat.subcategories) ? cat.subcategories : [];
    if (subs.length) {
      for (const sub of subs) {
        const services = [];
        for (const srv of sub.services || []) {
          const name = String(srv.name || "").trim();
          const slug = String(srv.slug || "").trim();
          const key = slug || name;
          if (!key || seen.has(key)) continue;
          seen.add(key);
          services.push({ value: slug || name, label: name });
        }
        if (!services.length) continue;
        groups.push({
          id: String(sub.slug || sub.name || `${cat.slug}-${groups.length}`),
          name: String(sub.name || cat.name || "Услуги"),
          icon: serviceCategoryIconHref(`${sub.slug || ""} ${sub.name || ""} ${cat.slug || ""}`),
          services,
        });
      }
    } else {
      const services = [];
      for (const srv of cat.services || []) {
        const name = String(srv.name || "").trim();
        const slug = String(srv.slug || "").trim();
        const key = slug || name;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        services.push({ value: slug || name, label: name });
      }
      if (!services.length) continue;
      groups.push({
        id: String(cat.slug || cat.name || `cat-${groups.length}`),
        name: String(cat.name || "Услуги"),
        icon: serviceCategoryIconHref(`${cat.slug || ""} ${cat.name || ""}`),
        services,
      });
    }
  }
  return groups;
}

/** Подобрать услугу провайдера под значение фильтра (slug или название). */
export function matchProviderServiceByFilter(services, filterValue) {
  const raw = String(filterValue || "").trim();
  if (!raw || !Array.isArray(services) || !services.length) return null;
  const lower = raw.toLowerCase();
  const bySlug = services.find((s) => String(s.template_slug || "") === raw);
  if (bySlug) return bySlug;
  const byExactName = services.find((s) => String(s.name || "").trim().toLowerCase() === lower);
  if (byExactName) return byExactName;
  const byIncludes = services.find((s) => String(s.name || "").toLowerCase().includes(lower));
  if (byIncludes) return byIncludes;
  const bySlugIncludes = services.find((s) => {
    const slug = String(s.template_slug || "");
    return slug && (slug.includes(raw) || raw.includes(slug));
  });
  return bySlugIncludes || null;
}

/** Одна запись на организацию для списка поиска (предпочитаем главный офис / обложку). */
export function uniqueDiscoverOrgs(locations) {
  if (!Array.isArray(locations)) return [];
  const byProvider = new Map();
  for (const loc of locations) {
    const pid = loc?.provider;
    if (pid == null) continue;
    const prev = byProvider.get(pid);
    if (!prev) {
      byProvider.set(pid, loc);
      continue;
    }
    const score = (x) =>
      (x.is_main_office ? 4 : 0) + (x.provider_cover_url ? 2 : 0) + (x.provider_average_rating != null ? 1 : 0);
    if (score(loc) > score(prev)) byProvider.set(pid, loc);
  }
  return [...byProvider.values()].sort((a, b) =>
    String(a.organization_name || a.title || "").localeCompare(
      String(b.organization_name || b.title || ""),
      "ru",
    ),
  );
}

export function escapeMapHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

let orgPinLayoutClass = null;

function getOrgPinLayoutClass(ymaps) {
  if (orgPinLayoutClass) return orgPinLayoutClass;

  orgPinLayoutClass = ymaps.templateLayoutFactory.createClass(
    '<div class="ymap-org-pin-host"></div>',
    {
      build: function buildPin() {
        orgPinLayoutClass.superclass.build.call(this);
        const host = this.getElement();
        if (!host) return;
        host.style.cssText =
          "position:absolute;left:0;top:0;pointer-events:none;transform:translate(-50%,-100%);";
        const props = this.getData().properties;
        const iconHref = props.get("iconHref") || "";
        const pinName = props.get("pinName") || "";
        const pinRating = props.get("pinRating");
        const pinClosed = Number(props.get("pinClosed")) === 1;
        const pinSelected = Number(props.get("pinSelected")) === 1;
        const tier = props.get("pinZoomTier") || "near";
        const iconSize = mapPinIconSizeForTier(tier);
        const hideLabel = tier !== "near";
        const ratingHtml =
          !hideLabel && !pinClosed && pinRating
            ? `<span class="ymap-pin-rating">★ ${escapeMapHtml(pinRating)}</span>`
            : "";
        const closedHtml =
          !hideLabel && pinClosed ? '<span class="ymap-pin-closed">Закрыто</span>' : "";
        const labelHtml = hideLabel
          ? ""
          : pinClosed
            ? `<div class="ymap-org-pin-label">
            <span class="ymap-org-pin-name">${pinName}</span>
            ${closedHtml}
          </div>`
            : `<div class="ymap-org-pin-label">
            <div class="ymap-org-pin-title-row">
              <span class="ymap-org-pin-name">${pinName}</span>${ratingHtml}
            </div>
          </div>`;
        const pinClass = [
          "ymap-org-pin",
          pinClosed && "ymap-org-pin--closed",
          pinSelected && "ymap-org-pin--selected",
          tier !== "near" && `ymap-org-pin--${tier}`,
        ]
          .filter(Boolean)
          .join(" ");
        host.innerHTML = `<div class="${pinClass}">
          <img class="ymap-org-pin-icon" src="${iconHref}" width="${iconSize}" height="${iconSize}" alt="" draggable="false" />
          ${labelHtml}
        </div>`;
      },
      getShape: function getPinShape() {
        const host = this.getElement();
        if (!host) return null;
        const pin = host.querySelector(".ymap-org-pin") || host;
        const w = pin.offsetWidth || 180;
        const h = pin.offsetHeight || 52;
        const half = Math.ceil(w / 2);
        return new ymaps.shape.Rectangle(
          new ymaps.geometry.pixel.Rectangle([[-half, -h], [half, 0]]),
        );
      },
    },
  );

  return orgPinLayoutClass;
}

export function buildYmapOrgPlacemark(ymaps, loc, onClick, now = new Date(), zoom = 14, opts = {}) {
  const lat = Number(loc.latitude);
  const lon = Number(loc.longitude);
  const name = escapeMapHtml(
    (loc.organization_name && String(loc.organization_name).trim()) || loc.title || "Организация",
  );
  const pinRating =
    loc.provider_average_rating != null ? Number(loc.provider_average_rating).toFixed(1) : "";
  const pinClosed = !isOrganizationOpenNow(loc.provider_working_hours, now);
  const pinZoomTier = getMapPinZoomTier(zoom);
  const iconHref = sphereMapIconHref(loc.provider_sphere);
  const layout = getOrgPinLayoutClass(ymaps);
  const selected = Boolean(opts?.selected);

  const pm = new ymaps.Placemark(
    [lat, lon],
    {
      iconHref,
      pinName: name,
      pinRating,
      pinClosed: pinClosed ? 1 : 0,
      pinZoomTier,
      pinSelected: selected ? 1 : 0,
      vmesteLoc: loc,
      hintContent: (loc.organization_name && String(loc.organization_name).trim()) || loc.title || "",
    },
    {
      iconLayout: layout,
      iconLayoutWidth: 220,
      iconLayoutHeight: 56,
      zIndex: selected ? 2000 : 1000,
      cursor: "pointer",
      hasHint: true,
      openBalloonOnClick: false,
    },
  );

  if (typeof onClick === "function") {
    pm.events.add("click", (e) => {
      e?.stopPropagation?.();
      onClick(loc);
    });
  }
  return pm;
}

export function resetOrgPinLayoutClass() {
  orgPinLayoutClass = null;
}
