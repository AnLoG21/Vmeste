/** Reusable empty list / section placeholder (uses catalog-empty-state styles). */
export function EmptyState({ title, children, className = "" }) {
  return (
    <div className={["catalog-empty-state", className].filter(Boolean).join(" ")}>
      {title ? <h2>{title}</h2> : null}
      {children}
    </div>
  );
}
