/** Private allowlist for Вэфире (TV launcher). Hidden for everyone else. */
export const VEFIRE_ALLOWED_USERNAMES = ["a.loginov150"];

export function canAccessVefire(me) {
  const u = String(me?.username || "")
    .trim()
    .toLowerCase();
  if (!u) return false;
  return VEFIRE_ALLOWED_USERNAMES.some((x) => x.toLowerCase() === u);
}
