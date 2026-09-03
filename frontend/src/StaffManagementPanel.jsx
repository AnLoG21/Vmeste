import StaffServicesAssignment from "./StaffServicesAssignment.jsx";
import { EmptyState } from "./EmptyState.jsx";
import {
  applyCafeRolePreset,
  CAFE_STAFF_ROLE_PRESETS,
  orgSphereOf,
  sphereUsesServiceAssignment,
  staffPermLabelsForSphere,
  STAFF_PERM_DEFAULTS,
} from "./staffPermissions.js";

function formatStaffClientName(userLike) {
  if (!userLike) return "";
  const fn = String(userLike.first_name || "").trim();
  const ln = String(userLike.last_name || "").trim();
  const pat = String(userLike.patronymic || "").trim();
  const parts = [];
  if (fn) parts.push(fn);
  if (ln) {
    const ch = ln[0];
    parts.push(ch ? `${ch.toUpperCase()}.` : ln);
  }
  if (pat) parts.push(pat);
  const s = parts.join(" ").trim();
  return s || String(userLike.username || "").trim();
}

/** Раздел «Сотрудники»: приглашения, должности, права и услуги. */
export default function StaffManagementPanel({
  me,
  staffEffectivePerms,
  canInviteStaff,
  staffInviteForm,
  onStaffInviteFormChange,
  onInviteStaff,
  staffInviteStatus,
  orgStaff,
  staffPermsOpenId,
  onStaffPermsOpenIdChange,
  staffServicesOpenId,
  onStaffServicesOpenIdChange,
  onPatchStaffMeta,
  onDeactivateStaff,
  onToggleStaffPermission,
  staffAssignableCategories,
  staffAssignableServices,
  onPatchStaffServiceAssignment,
}) {
  const orgSphere = orgSphereOf(me);
  const permLabels = staffPermLabelsForSphere(orgSphere);
  const showServiceAssignment = sphereUsesServiceAssignment(orgSphere);

  return (
    <section className="card profile-card">
      <h2>Сотрудники</h2>
      {me?.role === "staff" && staffEffectivePerms.can_delegate_permissions && (
        <p className="muted">
          Адрес организации и филиалы настраивает руководитель в разделе «Организация». Здесь — команда, должности и
          права доступа.
        </p>
      )}
      {me?.role === "provider" && (
        <p className="muted">
          Руководитель настраивает всё. Сотрудник с правом «Может настраивать права других» видит этот раздел и может
          менять права коллег.
        </p>
      )}
      {canInviteStaff ? (
        <form onSubmit={onInviteStaff} className="form">
          <input
            placeholder="Email или логин сотрудника"
            value={staffInviteForm.invite_identifier}
            onChange={(e) => onStaffInviteFormChange({ ...staffInviteForm, invite_identifier: e.target.value })}
          />
          <button type="submit">Добавить сотрудника</button>
        </form>
      ) : null}
      <p className="status">{staffInviteStatus}</p>
      <ul className="list staff-list">
        {orgStaff.map((link) => {
          const permBase = {
            ...STAFF_PERM_DEFAULTS,
            ...(link.permissions || {}),
          };
          const rowName = formatStaffClientName(link.staff_user);
          const permsOpen = staffPermsOpenId === link.id;
          const canEditPerms = me?.role === "provider" || Boolean(staffEffectivePerms.can_delegate_permissions);
          return (
            <li key={link.id} className="staff-block">
              <div className="staff-row">
                <span>
                  {rowName}
                  {link.invitation_status === "pending"
                    ? " — ожидает подтверждения"
                    : link.is_active
                      ? ""
                      : " — отключён"}
                </span>
              </div>
              <div className="staff-job-deact-row">
                <div className="staff-job-col">
                  <label className="muted small-label">Должность</label>
                  <input
                    className="job-title-input"
                    placeholder="Например, администратор"
                    defaultValue={link.job_title || ""}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (link.job_title || "").trim()) onPatchStaffMeta(link.id, { job_title: v });
                    }}
                  />
                </div>
                {me?.role === "provider" && link.is_active && link.invitation_status !== "pending" ? (
                  <div className="staff-deact-cell">
                    <button
                      type="button"
                      className="staff-deactivate-btn ghost-btn"
                      onClick={() => onDeactivateStaff(link.id)}
                    >
                      Отключить
                    </button>
                  </div>
                ) : null}
              </div>
              {link.is_active && canEditPerms ? (
                <div className="staff-perms">
                  <button
                    type="button"
                    className="staff-perms-toggle muted small-label"
                    onClick={() => onStaffPermsOpenIdChange((id) => (id === link.id ? null : link.id))}
                  >
                    Права доступа{permsOpen ? " ▲" : " ▼"}
                  </button>
                  {permsOpen ? (
                    <div className="perm-grid">
                      {orgSphere === "cafe_restaurant" ? (
                        <div className="staff-cafe-presets">
                          <p className="muted small-label">Быстрый пресет</p>
                          <div className="row-2">
                            {CAFE_STAFF_ROLE_PRESETS.map((preset) => (
                              <button
                                key={preset.id}
                                type="button"
                                className="ghost-btn"
                                title={preset.hint}
                                onClick={() => {
                                  const next = applyCafeRolePreset(permBase, preset.id);
                                  void onPatchStaffMeta(link.id, { permissions: next });
                                }}
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {permLabels.map(([key, label]) => (
                        <label key={key} className="checkbox perm-item">
                          <input
                            type="checkbox"
                            checked={Boolean(permBase[key])}
                            onChange={() => onToggleStaffPermission(link, key)}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {link.is_active && canEditPerms && showServiceAssignment ? (
                <div className="staff-perms">
                  <button
                    type="button"
                    className="staff-perms-toggle muted small-label"
                    onClick={() => onStaffServicesOpenIdChange((id) => (id === link.id ? null : link.id))}
                  >
                    Услуги сотрудника{staffServicesOpenId === link.id ? " ▲" : " ▼"}
                  </button>
                  {staffServicesOpenId === link.id ? (
                    <StaffServicesAssignment
                      link={link}
                      categories={staffAssignableCategories}
                      services={staffAssignableServices}
                      onSave={onPatchStaffServiceAssignment}
                    />
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {orgStaff.length === 0 ? (
        <EmptyState title="Пока нет сотрудников">
          <p className="muted">Пригласите сотрудника по email или логину — он появится в списке после подтверждения.</p>
        </EmptyState>
      ) : null}
    </section>
  );
}
