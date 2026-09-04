import { useEffect, useMemo, useState } from "react";
import { API_URL } from "./config.js";
import { formatApiError } from "./bookingCalendarUtils.jsx";
import { buildServiceDraftFromService, serviceDraftEqualsService } from "./ServiceEditor.jsx";

/**
 * Provider services catalog editor for App.
 * services/categories list state stays in useCabinetData.
 */
export function useServicesEditor({
  authFetch,
  accessToken,
  me,
  currentView,
  services,
  setServices,
  categories,
  setSellerStatus,
  loadSellerData,
  setCategoryOpen,
  setSubcategoryOpen,
}) {
  const [catalogStatus, setCatalogStatus] = useState(null);
  const [catalogSeeding, setCatalogSeeding] = useState(false);
  const [serviceDrafts, setServiceDrafts] = useState({});
  const [serviceSavingAll, setServiceSavingAll] = useState(false);

  useEffect(() => {
    if (currentView !== "services" || me?.role !== "provider") return;
    setServiceDrafts((prev) => {
      const next = { ...prev };
      for (const s of services) {
        if (!next[s.id]) next[s.id] = buildServiceDraftFromService(s);
      }
      for (const id of Object.keys(next)) {
        if (!services.some((s) => String(s.id) === String(id))) delete next[id];
      }
      return next;
    });
  }, [services, currentView, me?.role]);

  async function loadCatalogStatus() {
    const res = await authFetch(`${API_URL}/catalog/seed-catalog/`);
    if (res.ok) setCatalogStatus(await res.json());
  }

  useEffect(() => {
    if (!accessToken || currentView !== "services" || me?.role !== "provider") return;
    loadCatalogStatus();
  }, [accessToken, currentView, me?.role, me?.provider_sphere]);

  async function seedProviderCatalog() {
    if (!me?.provider_sphere) {
      setSellerStatus("Укажите сферу услуг в настройках организации.");
      return;
    }
    setCatalogSeeding(true);
    setSellerStatus("");
    const res = await authFetch(`${API_URL}/catalog/seed-catalog/`, {
      method: "POST",
      body: JSON.stringify({ sphere: me.provider_sphere }),
    });
    setCatalogSeeding(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setSellerStatus(formatApiError(err, res.status) || "Не удалось загрузить каталог.");
      return;
    }
    const data = await res.json();
    setCatalogStatus(data);
    const created = data.stats?.services_created ?? 0;
    setSellerStatus(
      created > 0
        ? `Каталог загружен: ${created} услуг. Включите нужные позиции и укажите цены.`
        : "Каталог обновлён. Проверьте цены и включите нужные услуги.",
    );
    await loadSellerData();
    const openCats = {};
    for (const c of categories) openCats[c.id] = false;
    setCategoryOpen((prev) => ({ ...openCats, ...prev }));
    setSubcategoryOpen((prev) => ({ ...prev }));
  }

  function updateServiceDraft(serviceId, patch) {
    setServiceDrafts((prev) => {
      const base =
        prev[serviceId] ?? buildServiceDraftFromService(services.find((s) => Number(s.id) === Number(serviceId)) || {});
      return { ...prev, [serviceId]: { ...base, ...patch } };
    });
  }

  async function uploadServicePhotos(serviceId, fileList) {
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) return;
    const fd = new FormData();
    files.forEach((f) => fd.append("photos", f));
    const res = await authFetch(`${API_URL}/catalog/services/${serviceId}/photos/`, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setSellerStatus(err.detail || "Не удалось загрузить фото услуги.");
      return;
    }
    const data = await res.json();
    setServices((prev) =>
      prev.map((s) =>
        Number(s.id) === Number(serviceId)
          ? { ...s, photos: data.photos || s.photos, gallery: data.gallery || s.gallery }
          : s,
      ),
    );
    setSellerStatus("Фото услуги добавлены.");
  }

  async function deleteServicePhoto(serviceId, photoId) {
    const res = await authFetch(`${API_URL}/catalog/services/${serviceId}/photos/${photoId}/`, {
      method: "DELETE",
    });
    if (!res.ok) {
      setSellerStatus("Не удалось удалить фото.");
      return;
    }
    setServices((prev) =>
      prev.map((s) => {
        if (Number(s.id) !== Number(serviceId)) return s;
        const photos = (s.photos || []).filter((p) => Number(p.id) !== Number(photoId));
        const gallery = (s.gallery || []).filter(
          (p) => !(p.source === "service" && Number(p.id) === Number(photoId)),
        );
        return { ...s, photos, gallery };
      }),
    );
  }

  const dirtyServiceCount = useMemo(
    () => services.filter((s) => !serviceDraftEqualsService(serviceDrafts[s.id], s)).length,
    [services, serviceDrafts],
  );

  const staffAssignableServices = useMemo(
    () =>
      services.filter((s) => {
        const draft = serviceDrafts[s.id];
        if (draft) return Boolean(draft.is_active);
        return Boolean(s.is_active);
      }),
    [services, serviceDrafts],
  );

  const staffAssignableCategories = useMemo(() => {
    const categoryIds = new Set(
      staffAssignableServices.map((s) => Number(s.category)).filter((id) => Number.isFinite(id) && id > 0),
    );
    return categories.filter((cat) => categoryIds.has(Number(cat.id)));
  }, [categories, staffAssignableServices]);

  async function saveAllServiceChanges() {
    const dirty = services.filter((s) => !serviceDraftEqualsService(serviceDrafts[s.id], s));
    if (!dirty.length) {
      setSellerStatus("Нет изменений для сохранения.");
      return;
    }
    setServiceSavingAll(true);
    setSellerStatus("");
    const results = await Promise.all(
      dirty.map((s) => {
        const d = serviceDrafts[s.id];
        return authFetch(`${API_URL}/catalog/services/${s.id}/`, {
          method: "PATCH",
          body: JSON.stringify({
            price: Number(d.price),
            duration_minutes: Number(d.duration_minutes),
            is_active: d.is_active,
          }),
        });
      }),
    );
    setServiceSavingAll(false);
    const failed = results.filter((r) => !r.ok).length;
    if (failed) {
      setSellerStatus(`Не удалось сохранить ${failed} из ${dirty.length} услуг.`);
      return;
    }
    setServices((prev) =>
      prev.map((s) => {
        const d = serviceDrafts[s.id];
        if (!dirty.some((x) => x.id === s.id)) return s;
        return {
          ...s,
          price: Number(d.price),
          duration_minutes: Number(d.duration_minutes),
          is_active: d.is_active,
        };
      }),
    );
    setServiceDrafts((prev) => {
      const next = { ...prev };
      for (const s of dirty) {
        next[s.id] = { ...serviceDrafts[s.id] };
      }
      return next;
    });
    setSellerStatus(`Сохранено услуг: ${dirty.length}.`);
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

  return {
    catalogStatus,
    catalogSeeding,
    serviceDrafts,
    serviceSavingAll,
    dirtyServiceCount,
    staffAssignableServices,
    staffAssignableCategories,
    loadCatalogStatus,
    seedProviderCatalog,
    updateServiceDraft,
    uploadServicePhotos,
    deleteServicePhoto,
    saveAllServiceChanges,
    updateService,
  };
}
