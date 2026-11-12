/** Private allowlist for Вмагнитоле. Hidden for everyone else. */
export const VMAGNITOL_ALLOWED_USERNAMES = ["a.loginov150"];

export function canAccessVmagnitol(me) {
  const u = String(me?.username || "")
    .trim()
    .toLowerCase();
  if (!u) return false;
  return VMAGNITOL_ALLOWED_USERNAMES.some((x) => x.toLowerCase() === u);
}
