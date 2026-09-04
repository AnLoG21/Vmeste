import { useEffect, useState } from "react";
import { API_URL } from "./config.js";
import { ensurePhonePlus7 } from "./phone.js";
import { showToast } from "./toast.js";

/**
 * Profile / password / email / delete-account settings for App.
 */
export function useProfileAccount({
  authFetch,
  me,
  loadMe,
  logout,
  setStatus,
  setAuthStatus,
  setPasswordResetBusy,
}) {
  const [profileForm, setProfileForm] = useState({ first_name: "", last_name: "", patronymic: "", phone: "" });
  const [passwordForm, setPasswordForm] = useState({ old_password: "", new_password: "", new_password_confirm: "" });
  const [emailForm, setEmailForm] = useState({ new_email: "" });
  const [deleteAccountForm, setDeleteAccountForm] = useState({ password: "", confirm: "" });
  const [deleteAccountStatus, setDeleteAccountStatus] = useState("");
  const [deleteAccountBusy, setDeleteAccountBusy] = useState(false);

  useEffect(() => {
    if (!me) return;
    setProfileForm({
      first_name: me.first_name || "",
      last_name: me.last_name || "",
      patronymic: me.patronymic || "",
      phone: ensurePhonePlus7(me.phone || "+7"),
    });
    setEmailForm({ new_email: me.email || "" });
  }, [me]);

  async function updateProfile(event) {
    event.preventDefault();
    const response = await authFetch(`${API_URL}/users/me/`, {
      method: "PATCH",
      body: JSON.stringify(profileForm),
    });
    if (!response.ok) return setStatus("Не удалось сохранить личные данные.");
    showToast("Данные сохранены");
    setStatus("Данные сохранены.");
    loadMe();
  }

  async function changePassword(event) {
    event.preventDefault();
    const response = await authFetch(`${API_URL}/users/change-password/`, {
      method: "POST",
      body: JSON.stringify(passwordForm),
    });
    const data = await response.json().catch(() => ({}));
    const detail = data.detail || (response.ok ? "Проверьте почту для подтверждения смены пароля." : "Не удалось сменить пароль.");
    if (!response.ok) return setStatus(detail);
    showToast(detail, { tone: "success", ms: 14000 });
    setStatus(detail);
    setPasswordForm({ old_password: "", new_password: "", new_password_confirm: "" });
  }

  async function requestPasswordResetFromSettings() {
    if (me?.is_demo) {
      setStatus("В демо-режиме пароль сбрасывать нельзя.");
      return;
    }
    setPasswordResetBusy(true);
    const response = await authFetch(`${API_URL}/users/request-password-reset/`, { method: "POST", body: "{}" });
    const data = await response.json().catch(() => ({}));
    const detail = data.detail || (response.ok ? "Проверьте почту — мы отправили ссылку для сброса." : "Не удалось отправить ссылку.");
    setPasswordResetBusy(false);
    if (!response.ok) return setStatus(detail);
    showToast(detail, { tone: "success", ms: 14000 });
    setStatus(detail);
  }

  async function changeEmail(event) {
    event.preventDefault();
    const response = await authFetch(`${API_URL}/users/change-email/`, {
      method: "POST",
      body: JSON.stringify(emailForm),
    });
    const data = await response.json().catch(() => ({}));
    const detail = data.detail || (response.ok ? "Email изменен. Подтверди его по письму." : "Не удалось сменить email.");
    if (!response.ok) return setStatus(detail);
    showToast(detail, { tone: "success", ms: 14000 });
    setStatus(detail);
    loadMe();
  }

  async function deleteMyAccount(event) {
    event?.preventDefault?.();
    setDeleteAccountStatus("");
    if ((deleteAccountForm.confirm || "").trim().toLowerCase() !== "удалить") {
      setDeleteAccountStatus("Для подтверждения введите слово «удалить».");
      return;
    }
    if (!deleteAccountForm.password && me?.has_usable_password !== false) {
      setDeleteAccountStatus("Укажите пароль.");
      return;
    }
    setDeleteAccountBusy(true);
    const res = await authFetch(`${API_URL}/users/me/delete/`, {
      method: "POST",
      body: JSON.stringify({
        password: deleteAccountForm.password,
        confirm: "удалить",
      }),
    });
    setDeleteAccountBusy(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setDeleteAccountStatus(err.detail || err.password?.[0] || "Не удалось удалить аккаунт.");
      return;
    }
    setDeleteAccountForm({ password: "", confirm: "" });
    logout();
    setAuthStatus("Аккаунт удалён. Данные обезличены.");
  }

  return {
    profileForm,
    setProfileForm,
    passwordForm,
    setPasswordForm,
    emailForm,
    setEmailForm,
    deleteAccountForm,
    setDeleteAccountForm,
    deleteAccountStatus,
    deleteAccountBusy,
    updateProfile,
    changePassword,
    changeEmail,
    deleteMyAccount,
    requestPasswordResetFromSettings,
  };
}
