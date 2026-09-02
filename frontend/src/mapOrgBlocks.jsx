import { useEffect, useMemo, useState } from "react";
import { getOrgWorkingHoursStatus } from "./clientOrgFeatures.js";

function formatWebsiteHref(url) {
  const s = String(url || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

export function MapOrgContactsBlock({ phones, websites }) {
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

export function PhotoLightboxReviewCaption({ photo }) {
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

export function MapOrgHoursBlock({ workingHours }) {
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
