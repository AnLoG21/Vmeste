/** Полный доступ к Всайте (Pro без оплаты). */
export const VSAYTE_FULL_ACCESS_USERNAMES = ["a.loginov150"];

export function hasFullVsayteAccess(me) {
  const u = String(me?.username || "")
    .trim()
    .toLowerCase();
  if (!u) return false;
  return VSAYTE_FULL_ACCESS_USERNAMES.some((x) => x.toLowerCase() === u);
}
