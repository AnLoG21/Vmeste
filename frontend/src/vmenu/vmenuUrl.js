/** Persist Vmenu tab/screen in URL query while staying on /vmenu. */

export function readVmenuUrlState() {
  const p = new URLSearchParams(window.location.search);
  const tab = p.get("tab") || "feed";
  const screen = p.get("screen") || "main";
  const follows = p.get("follows") || "";
  return {
    tab: ["feed", "search", "chats", "book", "profile", "follows"].includes(tab) ? tab : "feed",
    screen: ["main", "user", "detail", "editor", "settings"].includes(screen) ? screen : "main",
    userId: p.get("user") ? Number(p.get("user")) : null,
    detailId: p.get("recipe") ? Number(p.get("recipe")) : null,
    editorId: p.get("edit") ? Number(p.get("edit")) : null,
    followsKind: follows === "followers" || follows === "following" ? follows : "",
  };
}

export function writeVmenuUrlState({ tab, screen, userId, detailId, editorId, followsKind }) {
  const p = new URLSearchParams();
  if (tab && tab !== "feed") p.set("tab", tab);
  if (screen && screen !== "main") p.set("screen", screen);
  if (screen === "user" && userId) p.set("user", String(userId));
  if (screen === "detail" && detailId) p.set("recipe", String(detailId));
  if (screen === "editor" && editorId) p.set("edit", String(editorId));
  if (tab === "follows" && followsKind) p.set("follows", followsKind);
  const qs = p.toString();
  const url = `/vmenu${qs ? `?${qs}` : ""}`;
  window.history.replaceState({ view: "vmenu" }, "", url);
}
