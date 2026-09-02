import { useState } from "react";

export default function StaffServicesAssignment({ link, categories, services, onSave }) {
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
