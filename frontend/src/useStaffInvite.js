import { useEffect, useState } from "react";
import { API_URL } from "./config.js";
import { orgSphereOf, STAFF_PERM_DEFAULTS } from "./staffPermissions.js";
import { emptyInvite } from "./StaffInviteWizard.jsx";

/**
 * Staff invite CRUD / card / permissions for App.
 * orgStaff list state stays in useCabinetData (shared with seller/staff loaders).
 */
export function useStaffInvite({
  authFetch,
  me,
  setOrgStaff,
  loadSellerData,
  loadStaffWorkspace,
  setChatActivity,
}) {
  const [staffInviteForm, setStaffInviteForm] = useState(() => emptyInvite(orgSphereOf(me)));
  const [staffInviteStatus, setStaffInviteStatus] = useState("");
  const [staffPermsOpenId, setStaffPermsOpenId] = useState(null);
  const [staffServicesOpenId, setStaffServicesOpenId] = useState(null);

  const sphere = orgSphereOf(me);
  useEffect(() => {
    setStaffInviteForm((prev) => {
      if ((prev.invite_identifier || "").trim()) return prev;
      return emptyInvite(sphere);
    });
  }, [sphere]);

  async function inviteStaff(event) {
    event.preventDefault();
    setStaffInviteStatus("Добавляем...");
    const idf = (staffInviteForm.invite_identifier || "").trim();
    if (!idf) {
      setStaffInviteStatus("Укажи email или логин сотрудника.");
      return;
    }
    const body = {
      invite_identifier: idf,
      job_title: (staffInviteForm.job_title || "").trim(),
      permissions: staffInviteForm.permissions || {},
    };
    const response = await authFetch(`${API_URL}/booking/staff/`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = typeof err === "object" && err ? Object.values(err).flat().find(Boolean) : null;
      setStaffInviteStatus(msg || "Не удалось добавить сотрудника.");
      return;
    }
    setStaffInviteStatus("Приглашение отправлено. Сотрудник увидит запрос в чатах.");
    setStaffInviteForm(emptyInvite(orgSphereOf(me)));
    if (me?.role === "provider") loadSellerData();
    else loadStaffWorkspace();
    const actRes = await authFetch(`${API_URL}/chat/activity/`);
    if (actRes.ok) setChatActivity(await actRes.json());
  }

  async function deactivateStaff(linkId) {
    const response = await authFetch(`${API_URL}/booking/staff/${linkId}/`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: false }),
    });
    if (!response.ok) {
      setStaffInviteStatus("Не удалось отключить сотрудника.");
      return;
    }
    setStaffInviteStatus("Сотрудник отключён.");
    loadSellerData();
  }

  async function patchStaffMeta(linkId, patch) {
    const response = await authFetch(`${API_URL}/booking/staff/${linkId}/`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    if (!response.ok) {
      setStaffInviteStatus("Не удалось сохранить изменения.");
      return;
    }
    setStaffInviteStatus("Сохранено.");
    if (me?.role === "provider") loadSellerData();
    else loadStaffWorkspace();
  }

  async function uploadStaffCard(linkId, { avatarFile, portfolioFiles, bio } = {}) {
    const fd = new FormData();
    if (bio != null) fd.append("bio", String(bio));
    if (avatarFile) fd.append("avatar", avatarFile);
    if (Array.isArray(portfolioFiles)) {
      for (const f of portfolioFiles) {
        if (f) fd.append("portfolio_photos", f);
      }
    }
    if (bio == null && !avatarFile && (!Array.isArray(portfolioFiles) || portfolioFiles.length === 0)) return;

    const response = await authFetch(`${API_URL}/booking/staff/${linkId}/card/`, {
      method: "POST",
      body: fd,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      setStaffInviteStatus(err.detail || "Не удалось сохранить карточку сотрудника.");
      return false;
    }
    const data = await response.json().catch(() => ({}));
    if (data?.staff) {
      setOrgStaff((prev) =>
        (prev || []).map((l) => (Number(l.id) === Number(linkId) ? { ...l, ...data.staff } : l)),
      );
    }
    setStaffInviteStatus("Карточка сохранена.");
    if (me?.role === "provider") loadSellerData();
    else if (me?.role === "staff") loadStaffWorkspace();
    return true;
  }

  async function deleteStaffPortfolioPhoto(linkId, photoId) {
    const response = await authFetch(
      `${API_URL}/booking/staff/${linkId}/portfolio/${encodeURIComponent(photoId)}/`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      setStaffInviteStatus("Не удалось удалить фото.");
      return;
    }
    const data = await response.json().catch(() => null);
    if (data) {
      setOrgStaff((prev) =>
        (prev || []).map((l) => (Number(l.id) === Number(linkId) ? { ...l, ...data } : l)),
      );
    } else if (me?.role === "staff") {
      loadStaffWorkspace();
    } else {
      loadSellerData();
    }
    setStaffInviteStatus("Фото удалено.");
  }

  async function patchStaffPermissions(linkId, permissions) {
    const response = await authFetch(`${API_URL}/booking/staff/${linkId}/`, {
      method: "PATCH",
      body: JSON.stringify({ permissions }),
    });
    if (!response.ok) {
      setStaffInviteStatus("Не удалось сохранить права.");
      return;
    }
    setStaffInviteStatus("Права обновлены.");
    if (me?.role === "provider") loadSellerData();
    else loadStaffWorkspace();
  }

  async function patchStaffServiceAssignment(linkId, serviceIds, categoryIds) {
    const response = await authFetch(`${API_URL}/booking/staff/${linkId}/`, {
      method: "PATCH",
      body: JSON.stringify({
        assigned_service_ids: serviceIds,
        assigned_category_ids: categoryIds,
      }),
    });
    if (!response.ok) {
      setStaffInviteStatus("Не удалось сохранить услуги сотрудника.");
      return;
    }
    setStaffInviteStatus("Услуги сотрудника обновлены.");
    if (me?.role === "provider") loadSellerData();
    else loadStaffWorkspace();
  }

  function toggleStaffPermission(link, key) {
    const merged = {
      ...STAFF_PERM_DEFAULTS,
      ...(link.permissions || {}),
    };
    const next = { ...merged, [key]: !merged[key] };
    patchStaffPermissions(link.id, next);
  }

  return {
    staffInviteForm,
    setStaffInviteForm,
    staffInviteStatus,
    setStaffInviteStatus,
    staffPermsOpenId,
    setStaffPermsOpenId,
    staffServicesOpenId,
    setStaffServicesOpenId,
    inviteStaff,
    deactivateStaff,
    patchStaffMeta,
    uploadStaffCard,
    deleteStaffPortfolioPhoto,
    patchStaffPermissions,
    patchStaffServiceAssignment,
    toggleStaffPermission,
  };
}
