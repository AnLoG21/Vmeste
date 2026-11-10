import { useEffect } from "react";

const NAV_SECTIONS = ["demo", "pricing", "businesses", "faq", "start"];

/**
 * Scroll continuity for landing sections + active header nav.
 * Content stays visible if JS fails (class `is-ready` gates the hide).
 */
export default function LandingReveal({ rootSelector = ".landing" } = {}) {
  useEffect(() => {
    const root = document.querySelector(rootSelector);
    if (!root || typeof IntersectionObserver === "undefined") return;

    const targets = Array.from(root.querySelectorAll(".landing-reveal"));
    if (!targets.length) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    targets.forEach((el) => el.classList.add("is-ready"));

    if (reduce) {
      targets.forEach((el) => el.classList.add("is-in"));
      return undefined;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      },
      { root: null, rootMargin: "0px 0px -6% 0px", threshold: 0.08 }
    );

    targets.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.92) {
        el.classList.add("is-in");
      } else {
        io.observe(el);
      }
    });

    const failSafe = window.setTimeout(() => {
      targets.forEach((el) => el.classList.add("is-in"));
    }, 2500);

    return () => {
      window.clearTimeout(failSafe);
      io.disconnect();
    };
  }, [rootSelector]);

  useEffect(() => {
    const nodes = NAV_SECTIONS.map((id) => document.getElementById(id)).filter(Boolean);
    if (!nodes.length || typeof IntersectionObserver === "undefined") return undefined;

    const visible = new Map();
    const apply = () => {
      let bestId = "";
      let bestTop = Number.POSITIVE_INFINITY;
      for (const [id, ratio] of visible) {
        if (ratio <= 0) continue;
        const el = document.getElementById(id);
        if (!el) continue;
        const top = Math.abs(el.getBoundingClientRect().top - 96);
        if (top < bestTop) {
          bestTop = top;
          bestId = id;
        }
      }
      if (bestId) document.documentElement.dataset.landingSection = bestId;
      else delete document.documentElement.dataset.landingSection;
    };

    const spy = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visible.set(entry.target.id, entry.intersectionRatio);
        }
        apply();
      },
      { root: null, rootMargin: "-20% 0px -55% 0px", threshold: [0, 0.15, 0.35, 0.6, 1] }
    );

    nodes.forEach((el) => spy.observe(el));
    apply();

    return () => {
      spy.disconnect();
      delete document.documentElement.dataset.landingSection;
    };
  }, []);

  return null;
}
