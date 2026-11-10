import { useEffect, useState } from "react";

const DESKTOP_MQ = "(min-width: 901px)";

export default function LandingSectionFold({
  id,
  title,
  lead,
  className = "",
  children,
  defaultOpenMobile = false,
  /** Keep accordion on desktop too — for secondary / long sections. */
  alwaysFold = false,
}) {
  const [desktop, setDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(DESKTOP_MQ).matches : true
  );
  const [open, setOpen] = useState(defaultOpenMobile);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ);
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const useFold = alwaysFold || !desktop;
  const expanded = useFold ? open : true;

  return (
    <section
      className={`landing-section landing-fold landing-reveal${expanded ? " is-open" : ""}${className ? ` ${className}` : ""}`}
      id={id}
    >
      {useFold ? (
        <button
          type="button"
          className="landing-fold-toggle"
          aria-expanded={expanded}
          onClick={() => setOpen((v) => !v)}
        >
          <h2>{title}</h2>
          <span className="landing-fold-chevron" aria-hidden="true" />
        </button>
      ) : (
        <h2>{title}</h2>
      )}
      {expanded && lead ? <p className="landing-section-lead">{lead}</p> : null}
      {expanded ? <div className="landing-fold-body">{children}</div> : null}
    </section>
  );
}
