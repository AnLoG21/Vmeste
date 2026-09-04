import ServiceEditor, { serviceDraftEqualsService } from "./ServiceEditor.jsx";

function groupCategoryServices(cat, services) {
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

/** Дерево каталога услуг организации. */
export default function ServiceCatalogTree({
  services,
  catalogStatus,
  sphereOptions,
  me,
  catalogSeeding,
  seedProviderCatalog,
  dirtyServiceCount,
  categories,
  categoryOpen,
  setCategoryOpen,
  subcategoryOpen,
  setSubcategoryOpen,
  serviceDrafts,
  updateServiceDraft,
  uploadServicePhotos,
  deleteServicePhoto,
}) {
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
          const { groups, loose } = groupCategoryServices(cat, services);
          const catOpen = categoryOpen[cat.id] ?? false;
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
                    const subOpen = subcategoryOpen[subKey] ?? false;
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
                                onUploadPhotos={uploadServicePhotos}
                                onDeletePhoto={deleteServicePhoto}
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
                            onUploadPhotos={uploadServicePhotos}
                            onDeletePhoto={deleteServicePhoto}
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
