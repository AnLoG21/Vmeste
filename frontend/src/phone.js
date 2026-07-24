/** Normalize phone input to start with +7. */
export function ensurePhonePlus7(raw) {
  let s = String(raw ?? "");
  if (!s.trim()) return "+7";
  // Keep + and digits only for normalization decisions
  const digits = s.replace(/\D/g, "");
  if (!digits) return "+7";
  let d = digits;
  if (d.startsWith("8") && d.length >= 11) d = `7${d.slice(1)}`;
  if (d.startsWith("7")) {
    return `+${d}`;
  }
  if (s.trim().startsWith("+7")) return `+${d}`;
  // User typed local number without country code
  return `+7${d}`;
}

export function onPhoneFieldChange(value, setter) {
  const next = ensurePhonePlus7(value);
  setter(next);
}

export function phoneFieldProps(value, onChange) {
  return {
    type: "tel",
    inputMode: "tel",
    autoComplete: "tel",
    value: value || "+7",
    onFocus: (e) => {
      if (!String(e.target.value || "").trim()) onChange("+7");
    },
    onChange: (e) => onChange(ensurePhonePlus7(e.target.value)),
  };
}
