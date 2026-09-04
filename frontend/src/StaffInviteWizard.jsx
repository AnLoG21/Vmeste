import { useMemo } from "react";
import {
  buildPermissionsFromPreset,
  staffPermLabelsForSphere,
  staffRolePresetsForSphere,
  STAFF_PERM_DEFAULTS,
} from "./staffPermissions.js";

const emptyInvite = (sphere) => {
  const presets = staffRolePresetsForSphere(sphere);
  const first = presets[0]?.id || "admin";
  return {
    invite_identifier: "",
    rolePresetId: first,
    job_title: presets[0]?.jobTitle || "",
    permissions: buildPermissionsFromPreset(sphere, first),
    fineTuneOpen: false,
  };
};

/** Мастер приглашения: идентификатор → роль → должность → тонкая настройка прав. */
export default function StaffInviteWizard({
  sphere,
  form,
  onChange,
  onSubmit,
  status,
}) {
  const presets = useMemo(() => staffRolePresetsForSphere(sphere), [sphere]);
  const permLabels = useMemo(() => staffPermLabelsForSphere(sphere), [sphere]);
  const perms = { ...STAFF_PERM_DEFAULTS, ...(form.permissions || {}) };

  function selectPreset(presetId) {
    const preset = presets.find((p) => p.id === presetId);
    onChange({
      ...form,
      rolePresetId: presetId,
      job_title: preset?.jobTitle || form.job_title,
      permissions: buildPermissionsFromPreset(sphere, presetId),
    });
  }

  function togglePerm(key) {
    onChange({
      ...form,
      permissions: { ...perms, [key]: !Boolean(perms[key]) },
    });
  }

  return (
    <form onSubmit={onSubmit} className="form staff-invite-wizard">
      <h3 className="staff-invite-wizard__title">Пригласить сотрудника</h3>
      <p className="muted small-label">
        Сначала выберите роль — права заполнятся автоматически. При необходимости уточните галочки.
      </p>

      <label className="muted small-label">Email или логин</label>
      <input
        placeholder="email@example.com или login"
        value={form.invite_identifier}
        onChange={(e) => onChange({ ...form, invite_identifier: e.target.value })}
        autoComplete="off"
      />

      <label className="muted small-label">Роль в организации</label>
      <div className="staff-role-presets" role="listbox" aria-label="Роль сотрудника">
        {presets.map((preset) => {
          const active = form.rolePresetId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              role="option"
              aria-selected={active}
              className={["staff-role-preset", active && "staff-role-preset--active"].filter(Boolean).join(" ")}
              title={preset.hint}
              onClick={() => selectPreset(preset.id)}
            >
              <span className="staff-role-preset__label">{preset.label}</span>
              <span className="staff-role-preset__hint muted">{preset.hint}</span>
            </button>
          );
        })}
      </div>

      <label className="muted small-label">Должность (как в карточке)</label>
      <input
        placeholder="Например, администратор"
        value={form.job_title || ""}
        onChange={(e) => onChange({ ...form, job_title: e.target.value })}
      />

      <button
        type="button"
        className="staff-perms-toggle muted small-label"
        onClick={() => onChange({ ...form, fineTuneOpen: !form.fineTuneOpen })}
      >
        Настроить права{form.fineTuneOpen ? " ▲" : " ▼"}
      </button>
      {form.fineTuneOpen ? (
        <div className="perm-grid staff-invite-wizard__perms">
          {permLabels.map(([key, label]) => (
            <label key={key} className="checkbox perm-item">
              <input type="checkbox" checked={Boolean(perms[key])} onChange={() => togglePerm(key)} />
              {label}
            </label>
          ))}
        </div>
      ) : null}

      <button type="submit" className="primary-btn">
        Отправить приглашение
      </button>
      {status ? <p className="status">{status}</p> : null}
    </form>
  );
}

export { emptyInvite };
