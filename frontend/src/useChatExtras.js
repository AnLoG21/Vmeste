import { useEffect, useMemo, useState } from "react";
import { API_URL } from "./config.js";
import {
  CHAT_PINS_STORAGE_KEY,
  MAX_PINNED_CHATS,
  defaultChatListNameForConversation,
  loadChatPinsFromStorage,
  conversationOrgDirectPeerTitle,
  conversationClientCorrespondenceTitle,
} from "./chatHelpers.jsx";
import { showToast } from "./toast.js";

const chatPrefsStorageKey = (id) => `vmeste_chat_prefs_v1_${id}`;
const chatNotifyStorageKey = (id) => `vmeste_chat_notify_v1_${id}`;
const CHAT_RECEIPTS_KEY = "vmeste_chat_receipts_v1";

function loadReceiptsPref() {
  try {
    const raw = localStorage.getItem(CHAT_RECEIPTS_KEY);
    const p = raw ? JSON.parse(raw) : {};
    return p.mode === "classic" ? "classic" : "stickers";
  } catch {
    return "stickers";
  }
}

/**
 * Chat pins, groups, visual prefs, receipts mode, and related UI chrome for App.
 * Conversations / messages stay in useChatMessaging.
 * chatInfoOpen / chatFabOpen stay in App (shared with useChatMessaging).
 */
export function useChatExtras({
  authFetch,
  me,
  conversations,
  setConversations,
  selectedChatId,
  setSelectedChatId,
  setChatStatus,
  loadChats,
  chatInfoOpen,
  setChatInfoOpen,
  chatFabOpen,
  setChatFabOpen,
}) {
  const selectedConv = useMemo(
    () => conversations.find((c) => Number(c.id) === Number(selectedChatId)) || null,
    [conversations, selectedChatId],
  );
  const [chatSettingsForId, setChatSettingsForId] = useState(null);
  const [chatRowMenuId, setChatRowMenuId] = useState(null);
  const [chatReceiptsSettingsOpen, setChatReceiptsSettingsOpen] = useState(false);
  const [chatPins, setChatPins] = useState(() => loadChatPinsFromStorage());
  const [chatDragPinConvId, setChatDragPinConvId] = useState(null);
  const [chatInfoTab, setChatInfoTab] = useState("photos");
  const [chatMembersView, setChatMembersView] = useState(null);
  const [groupAddStaffIds, setGroupAddStaffIds] = useState([]);
  const [groupAddStatus, setGroupAddStatus] = useState("");
  const [chatInfoHeadMenuOpen, setChatInfoHeadMenuOpen] = useState(false);
  const [chatInfoPhotoMenuId, setChatInfoPhotoMenuId] = useState(null);
  const [chatSettingsTitle, setChatSettingsTitle] = useState("");
  const [groupForm, setGroupForm] = useState({ title: "", staff_ids: [] });
  const [chatLocalPrefs, setChatLocalPrefs] = useState({});
  const [chatSettingsAvatar, setChatSettingsAvatar] = useState("");
  const [chatSettingsWallpaper, setChatSettingsWallpaper] = useState("#e8f4ea");
  const [customColorPickerOpen, setCustomColorPickerOpen] = useState(false);
  const [chatSettingsNotify, setChatSettingsNotify] = useState("all");
  const [chatSettingsMuteUntil, setChatSettingsMuteUntil] = useState("");
  const [chatReceiptsMode, setChatReceiptsMode] = useState(() => loadReceiptsPref());

  useEffect(() => {
    const next = {};
    for (const c of conversations) {
      try {
        const raw = localStorage.getItem(chatPrefsStorageKey(c.id));
        if (raw) next[c.id] = JSON.parse(raw);
      } catch {
        // ignore
      }
    }
    setChatLocalPrefs(next);
  }, [conversations]);

  useEffect(() => {
    if (chatSettingsForId == null) return;
    const p = chatLocalPrefs[chatSettingsForId] || {};
    const sel = conversations.find((x) => x.id === chatSettingsForId);
    const fallback = defaultChatListNameForConversation(sel, me?.id);
    setChatSettingsTitle(p.title || fallback);
    setChatSettingsAvatar(p.avatarDataUrl || "");
    setChatSettingsWallpaper(p.wallpaper || "#dfe9e2");
    let notify = "all";
    try {
      const raw = localStorage.getItem(chatNotifyStorageKey(chatSettingsForId));
      const st = raw ? JSON.parse(raw) : {};
      if (st.muted) notify = "off";
      else if (st.mutedUntil && Date.now() < Number(st.mutedUntil)) notify = "1h";
    } catch {
      // ignore
    }
    setChatSettingsNotify(notify);
    // Только при смене чата: иначе polling conversations / chatLocalPrefs сбрасывает ввод в поле «Имя».
  }, [chatSettingsForId]);

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_PINS_STORAGE_KEY, JSON.stringify(chatPins));
    } catch {
      // ignore
    }
  }, [chatPins]);

  useEffect(() => {
    if (!conversations.length) return;
    const ids = new Set(conversations.map((c) => Number(c.id)));
    setChatPins((prev) => {
      const org = (prev.org || []).filter((id) => ids.has(Number(id)));
      const clients = (prev.clients || []).filter((id) => ids.has(Number(id)));
      if (org.length === (prev.org || []).length && clients.length === (prev.clients || []).length) return prev;
      return { org, clients };
    });
  }, [conversations]);

  useEffect(() => {
    if (chatRowMenuId == null) return undefined;
    function onDoc(e) {
      if (e.target?.closest?.(".tg-chat-row-menu-wrap")) return;
      setChatRowMenuId(null);
    }
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, [chatRowMenuId]);

  function togglePinChatForFolder(convId, folder) {
    const n = Number(convId);
    const key = folder === "clients" ? "clients" : "org";
    setChatPins((prev) => {
      const list = [...(prev[key] || [])].map(Number);
      const i = list.indexOf(n);
      if (i >= 0) {
        list.splice(i, 1);
        return { ...prev, [key]: list };
      }
      if (list.length >= MAX_PINNED_CHATS) {
        queueMicrotask(() => setChatStatus(`Не больше ${MAX_PINNED_CHATS} закреплённых чатов.`));
        return prev;
      }
      return { ...prev, [key]: [...list, n] };
    });
  }

  function reorderPinnedChats(folder, draggedId, targetId) {
    const a = Number(draggedId);
    const b = Number(targetId);
    if (!a || !b || a === b) return;
    const key = folder === "clients" ? "clients" : "org";
    setChatPins((prev) => {
      const list = [...(prev[key] || [])].map(Number);
      const fi = list.indexOf(a);
      const ti = list.indexOf(b);
      if (fi < 0 || ti < 0) return prev;
      list.splice(fi, 1);
      list.splice(ti, 0, a);
      return { ...prev, [key]: list };
    });
  }

  function persistChatReceiptsMode(mode) {
    setChatReceiptsMode(mode);
    try {
      localStorage.setItem(CHAT_RECEIPTS_KEY, JSON.stringify({ mode }));
    } catch {
      // ignore
    }
  }

  async function createOrgGroup(event) {
    event.preventDefault();
    setChatStatus("");
    const staffIds = groupForm.staff_ids.map(Number);
    const response = await authFetch(`${API_URL}/chat/conversations/create-group/`, {
      method: "POST",
      body: JSON.stringify({ title: groupForm.title, staff_ids: staffIds }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      setChatStatus(err.detail || "Ошибка создания группы.");
      return;
    }
    setChatStatus("");
    setGroupForm({ title: "", staff_ids: [] });
    setChatFabOpen(false);
    loadChats();
  }

  function displayConversationTitle(conversation) {
    if (!conversation) return "";
    if (conversation.is_saved_messages) return "Избранное";
    const local = chatLocalPrefs[conversation.id];
    if (local?.title?.trim()) return local.title.trim();
    const clientPeer = conversationClientCorrespondenceTitle(conversation, me?.id, me?.role);
    if (clientPeer) return clientPeer;
    const peer = conversationOrgDirectPeerTitle(conversation, me?.id);
    if (peer) return peer;
    return conversation.title || `Чат #${conversation.id ?? ""}`;
  }

  function conversationAvatarLetter(conversation) {
    if (conversation?.is_saved_messages) return "★";
    return displayConversationTitle(conversation).slice(0, 1).toUpperCase();
  }

  function persistChatVisualSettings() {
    if (chatSettingsForId == null) return;
    let prev = {};
    try {
      prev = JSON.parse(localStorage.getItem(chatPrefsStorageKey(chatSettingsForId)) || "{}");
    } catch {
      prev = {};
    }
    const next = { ...prev };
    if (chatSettingsTitle.trim()) next.title = chatSettingsTitle.trim();
    else delete next.title;
    if (chatSettingsAvatar) next.avatarDataUrl = chatSettingsAvatar;
    else delete next.avatarDataUrl;
    if (chatSettingsWallpaper) next.wallpaper = chatSettingsWallpaper;
    else delete next.wallpaper;
    delete next.memberNames;
    try {
      localStorage.setItem(chatPrefsStorageKey(chatSettingsForId), JSON.stringify(next));
      setChatLocalPrefs((p) => ({ ...p, [chatSettingsForId]: next }));
    } catch (_e) {
      setChatStatus("Не удалось сохранить настройки (лимит хранилища браузера).");
      return;
    }
    const notify = {};
    if (chatSettingsNotify === "off") notify.muted = true;
    else if (chatSettingsNotify === "1h") notify.mutedUntil = Date.now() + 3600000;
    else if (chatSettingsNotify === "2h") notify.mutedUntil = Date.now() + 7200000;
    else if (chatSettingsNotify === "8h") notify.mutedUntil = Date.now() + 28800000;
    try {
      if (Object.keys(notify).length) localStorage.setItem(chatNotifyStorageKey(chatSettingsForId), JSON.stringify(notify));
      else localStorage.removeItem(chatNotifyStorageKey(chatSettingsForId));
    } catch {
      // ignore
    }
    setChatSettingsForId(null);
    setChatStatus("");
    setCustomColorPickerOpen(false);
  }

  function clearChatVisualSettings() {
    if (chatSettingsForId == null) return;
    localStorage.removeItem(chatNotifyStorageKey(chatSettingsForId));
    localStorage.removeItem(chatPrefsStorageKey(chatSettingsForId));
    setChatLocalPrefs((prev) => {
      const copy = { ...prev };
      delete copy[chatSettingsForId];
      return copy;
    });
    const sel = conversations.find((c) => c.id === chatSettingsForId);
    setChatSettingsTitle(defaultChatListNameForConversation(sel, me?.id));
    setChatSettingsAvatar("");
    setChatSettingsWallpaper("#dfe9e2");
    setChatSettingsForId(null);
  }

  function toggleGroupStaff(id) {
    const n = Number(id);
    setGroupForm((prev) => ({
      ...prev,
      staff_ids: prev.staff_ids.includes(n) ? prev.staff_ids.filter((x) => x !== n) : [...prev.staff_ids, n],
    }));
  }

  function toggleGroupAddStaff(id) {
    const n = Number(id);
    setGroupAddStaffIds((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  }

  async function addMembersToSelectedGroup() {
    if (!selectedChatId || !groupAddStaffIds.length) return;
    setGroupAddStatus("");
    const response = await authFetch(`${API_URL}/chat/conversations/${selectedChatId}/add-members/`, {
      method: "POST",
      body: JSON.stringify({ staff_ids: groupAddStaffIds.map(Number) }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      setGroupAddStatus(err.detail || "Не удалось добавить участников.");
      return;
    }
    const data = await response.json();
    if (data.conversation) {
      setConversations((prev) =>
        prev.map((c) => (Number(c.id) === Number(data.conversation.id) ? data.conversation : c)),
      );
    } else {
      await loadChats();
    }
    setGroupAddStaffIds([]);
    setChatMembersView("list");
    setGroupAddStatus(data.added ? `Добавлено: ${data.added}` : "Уже в группе.");
  }

  async function deleteGroupChat(conv) {
    const target = conv || selectedConv;
    const chatId = target?.id ?? selectedChatId;
    if (!chatId || !target?.is_group) return;
    if (me?.role !== "provider" || Number(target.organization) !== Number(me?.id)) return;
    if (!window.confirm("Удалить группу для всех участников? Это действие нельзя отменить.")) return;
    setChatInfoHeadMenuOpen(false);
    setChatRowMenuId(null);
    const response = await authFetch(`${API_URL}/chat/conversations/${chatId}/delete-group/`, {
      method: "POST",
      body: "{}",
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      showToast(err.detail || "Не удалось удалить группу.");
      return;
    }
    setChatInfoOpen(false);
    setChatMembersView(null);
    if (Number(selectedChatId) === Number(chatId)) setSelectedChatId(null);
    setConversations((prev) => prev.filter((c) => Number(c.id) !== Number(chatId)));
    showToast("Группа удалена.");
  }

  function resetExtrasOnChatClose() {
    setChatInfoOpen(false);
    setChatMembersView(null);
    setGroupAddStaffIds([]);
    setGroupAddStatus("");
  }

  const chatInfoPeer = useMemo(() => {
    if (!selectedConv) return null;
    const st = selectedConv.org_direct_peer_status;
    if (st) return st;
    const peers = (selectedConv.members || []).filter((m) => Number(m.user) !== Number(me?.id));
    if (!peers.length) return null;
    const p = peers[0];
    return {
      is_online: p.is_online,
      last_seen_at: p.last_seen_at,
      first_name: p.first_name,
      last_name: p.last_name,
      patronymic: p.patronymic,
      username: p.username,
      organization_name: p.organization_name,
      role: p.role,
    };
  }, [selectedConv, me?.id]);

  const activeChatWallpaper = selectedChatId ? chatLocalPrefs[selectedChatId]?.wallpaper : null;

  return {
    chatSettingsForId,
    setChatSettingsForId,
    chatRowMenuId,
    setChatRowMenuId,
    chatReceiptsSettingsOpen,
    setChatReceiptsSettingsOpen,
    chatPins,
    setChatPins,
    chatDragPinConvId,
    setChatDragPinConvId,
    chatInfoTab,
    setChatInfoTab,
    chatMembersView,
    setChatMembersView,
    groupAddStaffIds,
    setGroupAddStaffIds,
    groupAddStatus,
    setGroupAddStatus,
    chatInfoHeadMenuOpen,
    setChatInfoHeadMenuOpen,
    chatInfoPhotoMenuId,
    setChatInfoPhotoMenuId,
    chatSettingsTitle,
    setChatSettingsTitle,
    groupForm,
    setGroupForm,
    chatLocalPrefs,
    setChatLocalPrefs,
    chatSettingsAvatar,
    setChatSettingsAvatar,
    chatSettingsWallpaper,
    setChatSettingsWallpaper,
    customColorPickerOpen,
    setCustomColorPickerOpen,
    chatSettingsNotify,
    setChatSettingsNotify,
    chatSettingsMuteUntil,
    setChatSettingsMuteUntil,
    chatReceiptsMode,
    setChatReceiptsMode,
    persistChatReceiptsMode,
    togglePinChatForFolder,
    reorderPinnedChats,
    createOrgGroup,
    displayConversationTitle,
    conversationAvatarLetter,
    persistChatVisualSettings,
    clearChatVisualSettings,
    toggleGroupStaff,
    toggleGroupAddStaff,
    addMembersToSelectedGroup,
    deleteGroupChat,
    resetExtrasOnChatClose,
    chatInfoPeer,
    activeChatWallpaper,
    chatPrefsStorageKey,
    chatNotifyStorageKey,
  };
}
