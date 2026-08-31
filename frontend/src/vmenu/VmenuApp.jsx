import { useCallback, useEffect, useRef, useState } from "react";
import "./vmenu.css";
import VmenuLogo from "./VmenuLogo.jsx";
import { vmenuFetch, VMENU_DRAFT_KEY } from "./vmenuApi.js";
import { VmenuChatsTab } from "./VmenuChatsTab.jsx";
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

export default function VmenuApp({ authFetch, API_URL, me, onExit, onSelectChat, selectedChatId }) {
  const [tab, setTab] = useState("feed");
  const [screen, setScreen] = useState("main");
  const [userId, setUserId] = useState(null);
  const [editorId, setEditorId] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [settingsProfile, setSettingsProfile] = useState(null);
  const [settingsCategories, setSettingsCategories] = useState([]);
  const [editorDraft, setEditorDraft] = useState(null);
  const editorSaveRef = useRef(null);

  function openUser(id) {
    setUserId(id);
    setScreen("user");
  }

  function openEditor(id = null) {
    setEditorId(id);
    setScreen("editor");
  }

  function openRecipe(id) {
    setDetailId(id);
    setScreen("detail");
  }

  async function openSettings() {
    const [data, cats] = await Promise.all([
      vmenuFetch(authFetch, API_URL, "/users/me/"),
      vmenuFetch(authFetch, API_URL, "/categories/"),
    ]);
    setSettingsProfile(data.profile);
    setSettingsCategories(cats || []);
    setScreen("settings");
  }

  async function saveSettings(payload) {
    const fd = new FormData();
    if (payload.bio != null) fd.append("bio", payload.bio);
    if (payload.allow_messages) fd.append("allow_messages", payload.allow_messages);
    if (payload.interest_tags) fd.append("interest_tags", JSON.stringify(payload.interest_tags));
    if (payload.avatar) fd.append("avatar", payload.avatar);
    await vmenuFetch(authFetch, API_URL, "/users/me/", { method: "PATCH", body: fd });
    setScreen("main");
    setTab("profile");
  }

  const switchTab = useCallback(
    async (nextTab) => {
      if (screen === "editor" && editorSaveRef.current) {
        await editorSaveRef.current(true);
      }
      setScreen("main");
      setTab(nextTab);
    },
    [screen],
  );

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
          onBack={() => setScreen("main")}
          onOpenRecipe={openRecipe}
          onOpenChat={(convId) => {
            onSelectChat?.(convId);
            setScreen("main");
            setTab("chats");
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
          onBack={() => setScreen("main")}
          onOpenUser={(id) => {
            setUserId(id);
            setScreen("user");
          }}
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
            setTab("book");
          }}
          onCancel={() => {
            setScreen("main");
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
          onClose={() => setScreen("main")}
        />
      );
    }
    if (tab === "chats") {
      return (
        <VmenuChatsTab
          authFetch={authFetch}
          API_URL={API_URL}
          me={me}
          initialChatId={selectedChatId}
          onChatOpen={onSelectChat}
        />
      );
    }
    if (tab === "feed") return <VmenuFeedTab authFetch={authFetch} API_URL={API_URL} onOpenUser={openUser} onOpenRecipe={openRecipe} />;
    if (tab === "search") return <VmenuSearchTab authFetch={authFetch} API_URL={API_URL} onOpenUser={openUser} onOpenRecipe={openRecipe} />;
    if (tab === "book") {
      return (
        <VmenuBookTab
          authFetch={authFetch}
          API_URL={API_URL}
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
          onCreate={() => openEditor()}
          onOpenSettings={openSettings}
          onOpenRecipe={openRecipe}
        />
      );
    }
    if (tab === "follows") return <VmenuFollowsTab authFetch={authFetch} API_URL={API_URL} onOpenUser={openUser} />;
    return null;
  }

  return (
    <section className="vmenu-app card">
      {renderMain()}
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
