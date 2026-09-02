import { useCallback, useEffect, useRef, useState } from "react";
import "./vmenu.css";
import VmenuLogo from "./VmenuLogo.jsx";
import { vmenuFetch, VMENU_DRAFT_KEY } from "./vmenuApi.js";
import { VmenuErrorBoundary } from "./VmenuErrorBoundary.jsx";
import { readVmenuUrlState, writeVmenuUrlState } from "./vmenuUrl.js";
import {
  VmenuBookTab,
  VmenuFeedTab,
  VmenuFollowsTab,
  VmenuProfileTab,
  VmenuRecipeDetail,
  VmenuRecipeEditor,
  VmenuSearchTab,
  VmenuSettings,
  VmenuUserView,
} from "./VmenuPanels.jsx";

const TABS = [
  { id: "feed", label: "Лента", icon: "🏠" },
  { id: "search", label: "Поиск", icon: "🔍" },
  { id: "chats", label: "Чаты", icon: "💬" },
  { id: "book", label: "Книга", icon: "📖" },
  { id: "profile", label: "Профиль", icon: "👤" },
  { id: "follows", label: "Подписки", icon: "👥" },
];

const DRAFT_KEY = VMENU_DRAFT_KEY;

export default function VmenuApp({
  authFetch,
  API_URL,
  me,
  onSelectChat,
  onTabChange,
  onChatsHostReady,
}) {
  const initial = readVmenuUrlState();
  const [tab, setTab] = useState(initial.tab);
  const [screen, setScreen] = useState(initial.screen);
  const [userId, setUserId] = useState(initial.userId);
  const [editorId, setEditorId] = useState(initial.editorId);
  const [detailId, setDetailId] = useState(initial.detailId);
  const [followsKind, setFollowsKind] = useState(initial.followsKind || "following");
  const [settingsProfile, setSettingsProfile] = useState(null);
  const [settingsCategories, setSettingsCategories] = useState([]);
  const [editorDraft, setEditorDraft] = useState(null);
  const editorSaveRef = useRef(null);

  const syncUrl = useCallback(
    (next = {}) => {
      writeVmenuUrlState({
        tab: next.tab ?? tab,
        screen: next.screen ?? screen,
        userId: next.userId ?? userId,
        detailId: next.detailId ?? detailId,
        editorId: next.editorId ?? editorId,
        followsKind: next.followsKind ?? followsKind,
      });
    },
    [tab, screen, userId, detailId, editorId, followsKind],
  );

  const setActiveTab = useCallback(
    (nextTab, extra = {}) => {
      setTab(nextTab);
      onTabChange?.(nextTab);
      syncUrl({ tab: nextTab, screen: "main", ...extra });
    },
    [onTabChange, syncUrl],
  );

  function openUser(id) {
    setUserId(id);
    setScreen("user");
    syncUrl({ screen: "user", userId: id });
  }

  function openEditor(id = null) {
    setEditorId(id);
    setScreen("editor");
    syncUrl({ screen: "editor", editorId: id });
  }

  function openRecipe(id) {
    setDetailId(id);
    setScreen("detail");
    syncUrl({ screen: "detail", detailId: id });
  }

  function openFollows(kind = "following") {
    setFollowsKind(kind);
    setScreen("main");
    setActiveTab("follows", { followsKind: kind, screen: "main" });
  }

  async function openSettings() {
    const [data, cats] = await Promise.all([
      vmenuFetch(authFetch, API_URL, "/users/me/"),
      vmenuFetch(authFetch, API_URL, "/categories/"),
    ]);
    setSettingsProfile(data.profile);
    setSettingsCategories(cats || []);
    setScreen("settings");
    syncUrl({ screen: "settings" });
  }

  async function saveSettings(payload) {
    const fd = new FormData();
    if (payload.bio != null) fd.append("bio", payload.bio);
    if (payload.allow_messages) fd.append("allow_messages", payload.allow_messages);
    if (payload.interest_tags) fd.append("interest_tags", JSON.stringify(payload.interest_tags));
    if (payload.avatar) fd.append("avatar", payload.avatar);
    await vmenuFetch(authFetch, API_URL, "/users/me/", { method: "PATCH", body: fd });
    setScreen("main");
    setActiveTab("profile");
  }

  const switchTab = useCallback(
    async (nextTab) => {
      if (screen === "editor" && editorSaveRef.current) {
        await editorSaveRef.current(true);
      }
      setScreen("main");
      setActiveTab(nextTab, { screen: "main" });
    },
    [screen, setActiveTab],
  );

  useEffect(() => {
    onTabChange?.(tab);
  }, []);

  useEffect(() => {
    if (tab !== "chats") onChatsHostReady?.(null);
  }, [tab, onChatsHostReady]);

  useEffect(() => {
    if (screen !== "editor" || editorId) return;
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) setEditorDraft(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, [screen, editorId]);

  function renderMain() {
    if (screen === "user" && userId) {
      return (
        <VmenuUserView
          userId={userId}
          authFetch={authFetch}
          API_URL={API_URL}
          me={me}
          onBack={() => {
            setScreen("main");
            syncUrl({ screen: "main", userId: null });
          }}
          onOpenRecipe={openRecipe}
          onOpenChat={(convId) => {
            onSelectChat?.(convId);
            setScreen("main");
            setActiveTab("chats");
          }}
        />
      );
    }
    if (screen === "detail" && detailId) {
      return (
        <VmenuRecipeDetail
          recipeId={detailId}
          authFetch={authFetch}
          API_URL={API_URL}
          me={me}
          onBack={() => {
            setScreen("main");
            syncUrl({ screen: "main", detailId: null });
          }}
          onDeleted={() => {
            setDetailId(null);
            setScreen("main");
            syncUrl({ screen: "main", detailId: null });
          }}
          onOpenUser={openUser}
        />
      );
    }
    if (screen === "editor") {
      return (
        <VmenuRecipeEditor
          authFetch={authFetch}
          API_URL={API_URL}
          recipeId={editorId}
          initialDraft={editorDraft}
          registerDraftSaver={(fn) => {
            editorSaveRef.current = fn;
          }}
          onDone={() => {
            sessionStorage.removeItem(DRAFT_KEY);
            setEditorDraft(null);
            setScreen("main");
            setActiveTab("book");
          }}
          onCancel={() => {
            setScreen("main");
            syncUrl({ screen: "main", editorId: null });
          }}
        />
      );
    }
    if (screen === "settings" && settingsProfile) {
      return (
        <VmenuSettings
          profile={settingsProfile}
          categories={settingsCategories}
          onSave={saveSettings}
          onClose={() => {
            setScreen("main");
            syncUrl({ screen: "main" });
          }}
        />
      );
    }
    if (tab === "chats") {
      return <div className="vmenu-chats-host" ref={onChatsHostReady} />;
    }
    if (tab === "feed") {
      return (
        <VmenuFeedTab authFetch={authFetch} API_URL={API_URL} me={me} onOpenUser={openUser} onOpenRecipe={openRecipe} />
      );
    }
    if (tab === "search") {
      return (
        <VmenuSearchTab authFetch={authFetch} API_URL={API_URL} me={me} onOpenUser={openUser} onOpenRecipe={openRecipe} />
      );
    }
    if (tab === "book") {
      return (
        <VmenuBookTab
          authFetch={authFetch}
          API_URL={API_URL}
          me={me}
          onCreate={() => openEditor()}
          onOpenRecipe={openRecipe}
          onEditRecipe={(id) => openEditor(id)}
        />
      );
    }
    if (tab === "profile") {
      return (
        <VmenuProfileTab
          authFetch={authFetch}
          API_URL={API_URL}
          me={me}
          onOpenUser={openUser}
          onOpenFollows={openFollows}
          onCreate={() => openEditor()}
          onOpenSettings={openSettings}
          onOpenRecipe={openRecipe}
        />
      );
    }
    if (tab === "follows") {
      return (
        <VmenuFollowsTab
          authFetch={authFetch}
          API_URL={API_URL}
          initialKind={followsKind}
          onOpenUser={openUser}
        />
      );
    }
    return null;
  }

  return (
    <VmenuErrorBoundary>
      <section className={`vmenu-app card${tab === "chats" ? " vmenu-app--chats" : ""}${tab === "follows" ? " vmenu-app--follows" : ""}`}>
        <div className="vmenu-app-body">{renderMain()}</div>
        <nav className="vmenu-bottom-nav" aria-label="Вменю">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={tab === t.id && screen === "main" ? "active" : ""}
              onClick={() => switchTab(t.id)}
            >
              <span aria-hidden>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      </section>
    </VmenuErrorBoundary>
  );
}

export function ServicesHub({ onOpenVmenu }) {
  return (
    <section className="card services-hub">
      <h2>Сервисы</h2>
      <p className="muted">Микросервисы платформы Вместе — отдельные приложения внутри кабинета.</p>
      <button type="button" className="services-hub-card" onClick={onOpenVmenu}>
        <VmenuLogo size={48} />
        <div>
          <strong>Вменю</strong>
          <p className="muted small">Социальная сеть рецептов: лента, книга, подписки и чаты.</p>
        </div>
      </button>
    </section>
  );
}
