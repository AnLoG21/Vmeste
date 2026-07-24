/** Normalize phone so +7 is always present and cannot be cleared. */
export function ensurePhonePlus7(raw) {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return "+7";
  // 8XXXXXXXXXX → 7XXXXXXXXXX
  if (digits.startsWith("8") && digits.length >= 11) {
    digits = `7${digits.slice(1)}`;
  }
  if (!digits.startsWith("7")) {
    digits = `7${digits}`;
  }
  return `+${digits}`;
}

/** Keep caret/selection after the locked "+7" prefix. */
function clampPhoneCaret(input) {
  if (!input) return;
  const start = input.selectionStart ?? 0;
  const end = input.selectionEnd ?? 0;
  if (start < 2 || end < 2) {
    const nextStart = Math.max(2, start);
    const nextEnd = Math.max(2, end);
    requestAnimationFrame(() => {
      try {
        input.setSelectionRange(nextStart, nextEnd);
      } catch {
        // ignore
      }
    });
  }
}

export function phoneFieldProps(value, onChange) {
  return {
    type: "tel",
    inputMode: "tel",
    autoComplete: "tel",
    value: value && String(value).startsWith("+7") ? value : ensurePhonePlus7(value || ""),
    onFocus: (e) => {
      const next = ensurePhonePlus7(e.target.value);
      if (next !== e.target.value) onChange(next);
      clampPhoneCaret(e.target);
    },
    onClick: (e) => clampPhoneCaret(e.target),
    onSelect: (e) => clampPhoneCaret(e.target),
    onKeyDown: (e) => {
      const input = e.target;
      const start = input.selectionStart ?? 0;
      const end = input.selectionEnd ?? 0;
      if (e.key === "Backspace" && start <= 2 && end <= 2) {
        e.preventDefault();
        return;
      }
      if (e.key === "Backspace" && start < 2 && end > 2) {
        e.preventDefault();
        onChange(`+7${String(input.value).slice(end).replace(/^\+?7?/, "")}`);
        return;
      }
      if (e.key === "Delete" && start < 2) {
        e.preventDefault();
      }
      if ((e.key === "ArrowLeft" || e.key === "Home") && start <= 2 && !e.shiftKey) {
        e.preventDefault();
        input.setSelectionRange(2, 2);
      }
    },
    onChange: (e) => onChange(ensurePhonePlus7(e.target.value)),
  };
}
