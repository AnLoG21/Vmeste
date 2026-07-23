/**
 * Visible breadcrumb trail (helps users + Yandex sitelinks / BreadcrumbList).
 * @param {{ name: string, href?: string }[]} items Last item is current page (no link).
 */
export default function Breadcrumbs({ items }) {
  if (!items?.length) return null;
  return (
    <nav className="breadcrumbs" aria-label="Навигационная цепочка">
      <ol className="breadcrumbs-list" itemScope itemType="https://schema.org/BreadcrumbList">
        {items.map((it, i) => {
          const last = i === items.length - 1;
          return (
            <li
              key={`${it.name}-${i}`}
              className="breadcrumbs-item"
              itemProp="itemListElement"
              itemScope
              itemType="https://schema.org/ListItem"
            >
              {last || !it.href ? (
                <span itemProp="name" aria-current={last ? "page" : undefined}>
                  {it.name}
                </span>
              ) : (
                <a href={it.href} itemProp="item">
                  <span itemProp="name">{it.name}</span>
                </a>
              )}
              <meta itemProp="position" content={String(i + 1)} />
              {!last ? <span className="breadcrumbs-sep" aria-hidden="true"> / </span> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
