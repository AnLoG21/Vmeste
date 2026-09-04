import { useEffect } from "react";
import { API_URL } from "./config.js";
import { guessAttachAccept } from "./chatMedia.js";

export const CHAT_MSG_PAGE_SIZE = 50;

/**
 * Chat list / messages send / pagination / mark-read for App.
 * Pins, group admin, visual settings stay in App when tangled.
 */
export function useChatMessaging({
  authFetch,
  accessToken,
  chatsSurfaceActive,
  currentViewRef,
  selectedChatId,
  setSelectedChatId,
  setConversations,
  setVmenuChatContacts,
  chatMessages,
  setChatMessages,
  chatHasMoreOlder,
  setChatHasMoreOlder,
  setChatLoadingOlder,
  setChatShowJumpBottom,
  chatInput,
  setChatInput,
  setChatStatus,
  chatPendingFiles,
  setChatPendingFiles,
  chatPendingKind,
  setChatPendingKind,
  setChatAttachMenuOpen,
  setChatInfoOpen,
  setChatFabOpen,
  setChatFolder,
  setCurrentView,
  setMenuOpen,
  setOrgPhotoLightbox,
  chatMessagesRef,
  chatMessagesElRef,
  chatNearBottomRef,
  chatLoadingOlderRef,
  chatHasMoreOlderRef,
  chatFileInputRef,
  postChatMessageRef,
}) {
  useEffect(() => {
    chatMessagesRef.current = chatMessages;
  }, [chatMessages, chatMessagesRef]);

  useEffect(() => {
    chatHasMoreOlderRef.current = chatHasMoreOlder;
  }, [chatHasMoreOlder, chatHasMoreOlderRef]);

  async function loadChats() {
    const isVmenu = currentViewRef.current === "vmenu";
    const url = isVmenu
      ? `${API_URL}/chat/conversations/?user_direct=1`
      : `${API_URL}/chat/conversations/`;
    const res = await authFetch(url);
    if (res.ok) setConversations(await res.json());
  }

  async function loadVmenuChatContacts() {
    const res = await authFetch(`${API_URL}/vmenu/chats/contacts/`);
    if (res.ok) {
      const data = await res.json();
      setVmenuChatContacts(Array.isArray(data?.followers) ? data.followers : []);
    }
  }

  async function openVmenuUserChat(userId) {
    const res = await authFetch(`${API_URL}/chat/conversations/create-user-direct/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    if (!res.ok) {
      setChatStatus("Не удалось открыть чат с пользователем.");
      return;
    }
    const conv = await res.json();
    await loadChats();
    await loadVmenuChatContacts();
    setSelectedChatId(conv.id);
    setChatStatus("");
  }

  function scrollChatToMessageId(mid) {
    const el = document.getElementById(`tg-msg-${mid}`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    if (el) {
      el.classList.add("tg-msg--flash");
      window.setTimeout(() => el.classList.remove("tg-msg--flash"), 1600);
    }
  }

  function jumpToChatMessage(mid) {
    setChatInfoOpen(false);
    window.setTimeout(() => scrollChatToMessageId(mid), 80);
  }

  function openChatPhotosLightbox(items, index = 0) {
    if (!items?.length) return;
    setOrgPhotoLightbox({ items, index: Math.max(0, Math.min(index, items.length - 1)) });
  }

  async function openDirectChatWithStaff(staffId) {
    if (!staffId) return;
    setChatStatus("");
    const response = await authFetch(`${API_URL}/chat/conversations/create-direct/`, {
      method: "POST",
      body: JSON.stringify({ staff_id: Number(staffId) }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      setChatStatus(err.detail || "Ошибка.");
      return;
    }
    const conv = await response.json();
    await loadChats();
    setSelectedChatId(conv.id);
    setChatFabOpen(false);
  }

  async function openChatWithClient(clientId) {
    const res = await authFetch(`${API_URL}/chat/conversations/create-with-client/`, {
      method: "POST",
      body: JSON.stringify({ client_id: Number(clientId) }),
    });
    if (!res.ok) return;
    const data = await res.json();
    await loadChats();
    setSelectedChatId(data.id);
    setChatFolder("clients");
    setCurrentView("chats");
    setMenuOpen(false);
  }

  async function openChatWithProvider(providerId) {
    const res = await authFetch(`${API_URL}/chat/conversations/create-with-provider/`, {
      method: "POST",
      body: JSON.stringify({ provider_id: Number(providerId) }),
    });
    if (!res.ok) return;
    const data = await res.json();
    await loadChats();
    setSelectedChatId(data.id);
    setCurrentView("chats");
    setMenuOpen(false);
  }

  async function fetchChatMessagesPage(conversationId, { beforeId, afterId, limit = CHAT_MSG_PAGE_SIZE } = {}) {
    if (!conversationId) return null;
    const params = new URLSearchParams({
      conversation: String(conversationId),
      limit: String(limit),
    });
    if (beforeId) params.set("before_id", String(beforeId));
    if (afterId) params.set("after_id", String(afterId));
    const res = await authFetch(`${API_URL}/chat/messages/?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  function scrollChatToBottom(smooth = false) {
    const el = chatMessagesElRef.current;
    if (!el) return;
    chatNearBottomRef.current = true;
    setChatShowJumpBottom(false);
    if (smooth) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    else el.scrollTop = el.scrollHeight;
  }

  async function loadOlderChatMessages() {
    if (!selectedChatId || chatLoadingOlderRef.current || !chatHasMoreOlderRef.current) return;
    const oldest = chatMessagesRef.current[0];
    if (!oldest) return;
    chatLoadingOlderRef.current = true;
    setChatLoadingOlder(true);
    const el = chatMessagesElRef.current;
    const prevHeight = el?.scrollHeight || 0;
    const prevTop = el?.scrollTop || 0;
    try {
      const older = await fetchChatMessagesPage(selectedChatId, {
        beforeId: oldest.id,
        limit: CHAT_MSG_PAGE_SIZE,
      });
      if (!older) return;
      setChatHasMoreOlder(older.length >= CHAT_MSG_PAGE_SIZE);
      if (!older.length) return;
      setChatMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const add = older.filter((m) => !seen.has(m.id));
        return add.length ? [...add, ...prev] : prev;
      });
      requestAnimationFrame(() => {
        const box = chatMessagesElRef.current;
        if (!box) return;
        box.scrollTop = prevTop + (box.scrollHeight - prevHeight);
      });
    } finally {
      chatLoadingOlderRef.current = false;
      setChatLoadingOlder(false);
    }
  }

  function updateChatScrollUi(el) {
    if (!el) return;
    const distBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distBottom < 100;
    chatNearBottomRef.current = nearBottom;
    setChatShowJumpBottom(!nearBottom && el.scrollHeight > el.clientHeight + 40);
    if (el.scrollTop < 72) {
      void loadOlderChatMessages();
    }
  }

  async function refreshChatMessages(conversationId = selectedChatId) {
    if (!conversationId) return;
    const current = chatMessagesRef.current;
    const lastId = current.length ? current[current.length - 1].id : null;
    if (lastId && Number(conversationId) === Number(selectedChatId)) {
      const newer = await fetchChatMessagesPage(conversationId, {
        afterId: lastId,
        limit: CHAT_MSG_PAGE_SIZE,
      });
      if (newer?.length) {
        setChatMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const add = newer.filter((m) => !seen.has(m.id));
          return add.length ? [...prev, ...add] : prev;
        });
        requestAnimationFrame(() => scrollChatToBottom(true));
        const last = newer[newer.length - 1];
        await authFetch(`${API_URL}/chat/conversations/${conversationId}/mark-read/`, {
          method: "POST",
          body: JSON.stringify({ message_id: last.id }),
        });
        loadChats();
      }
      return;
    }
    const msgs = await fetchChatMessagesPage(conversationId, { limit: CHAT_MSG_PAGE_SIZE });
    if (!msgs) return;
    setChatMessages(msgs);
    setChatHasMoreOlder(msgs.length >= CHAT_MSG_PAGE_SIZE);
    requestAnimationFrame(() => scrollChatToBottom(false));
    const last = msgs.length ? msgs[msgs.length - 1] : null;
    if (last) {
      await authFetch(`${API_URL}/chat/conversations/${conversationId}/mark-read/`, {
        method: "POST",
        body: JSON.stringify({ message_id: last.id }),
      });
      loadChats();
    }
  }

  async function postChatMessage({ text = "", file = null, kind = "", durationSec = null, displayFlip = null }) {
    if (!selectedChatId) return false;
    const hasText = Boolean(String(text || "").trim());
    if (!hasText && !file) return false;
    let response;
    if (file) {
      const fd = new FormData();
      fd.append("conversation", String(selectedChatId));
      if (hasText) fd.append("text", String(text).trim());
      if (kind) fd.append("kind", kind);
      if (durationSec != null && Number(durationSec) > 0) {
        fd.append("duration_sec", String(Math.round(Number(durationSec))));
      }
      if (displayFlip != null) {
        fd.append("display_flip", displayFlip ? "true" : "false");
      }
      fd.append("attachment", file);
      response = await authFetch(`${API_URL}/chat/messages/`, { method: "POST", body: fd });
    } else {
      response = await authFetch(`${API_URL}/chat/messages/`, {
        method: "POST",
        body: JSON.stringify({ conversation: selectedChatId, text: String(text).trim(), kind: "text" }),
      });
    }
    if (!response.ok) {
      setChatStatus("Не удалось отправить сообщение.");
      return false;
    }
    setChatInput("");
    setChatPendingFiles([]);
    setChatPendingKind("");
    setChatStatus("");
    setChatAttachMenuOpen(false);
    await refreshChatMessages(selectedChatId);
    return true;
  }

  postChatMessageRef.current = postChatMessage;

  async function sendChatMessage(event) {
    event.preventDefault();
    if (chatPendingFiles.length) {
      const caption = chatInput.trim();
      const items = [...chatPendingFiles];
      setChatPendingFiles([]);
      setChatInput("");
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        await postChatMessage({
          text: i === 0 ? caption : "",
          file: item.file,
          kind: item.kind,
        });
      }
      return;
    }
    if (!chatInput.trim()) return;
    await postChatMessage({ text: chatInput.trim() });
  }

  function openChatAttachPicker(kind) {
    setChatPendingKind(kind);
    setChatAttachMenuOpen(false);
    const input = chatFileInputRef.current;
    if (!input) return;
    input.accept = guessAttachAccept(kind === "music" ? "music" : kind);
    input.multiple = true;
    input.value = "";
    input.click();
  }

  function onChatFilePicked(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const next = files.map((file) => {
      let kind = chatPendingKind;
      if (!kind || kind === "auto") {
        if (file.type.startsWith("image/")) kind = "image";
        else if (file.type.startsWith("video/")) kind = "video";
        else if (file.type.startsWith("audio/")) kind = "voice";
        else kind = "file";
      }
      if (kind === "music") kind = "file";
      return { file, kind };
    });
    setChatPendingFiles((prev) => [...prev, ...next]);
  }

  useEffect(() => {
    if (!accessToken || !selectedChatId || !chatsSurfaceActive) return;
    let cancelled = false;
    setChatMessages([]);
    setChatHasMoreOlder(false);
    setChatShowJumpBottom(false);
    chatNearBottomRef.current = true;

    async function loadLatest() {
      const msgs = await fetchChatMessagesPage(selectedChatId, { limit: CHAT_MSG_PAGE_SIZE });
      if (cancelled || !msgs) return;
      setChatMessages(msgs);
      setChatHasMoreOlder(msgs.length >= CHAT_MSG_PAGE_SIZE);
      requestAnimationFrame(() => scrollChatToBottom(false));
      const last = msgs.length ? msgs[msgs.length - 1] : null;
      if (last) {
        await authFetch(`${API_URL}/chat/conversations/${selectedChatId}/mark-read/`, {
          method: "POST",
          body: JSON.stringify({ message_id: last.id }),
        });
        loadChats();
      }
    }

    async function pollNewer() {
      const current = chatMessagesRef.current;
      const lastId = current.length ? current[current.length - 1].id : null;
      if (!lastId) {
        await loadLatest();
        return;
      }
      const newer = await fetchChatMessagesPage(selectedChatId, {
        afterId: lastId,
        limit: CHAT_MSG_PAGE_SIZE,
      });
      if (cancelled || !newer?.length) return;
      setChatMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const add = newer.filter((m) => !seen.has(m.id));
        return add.length ? [...prev, ...add] : prev;
      });
      if (chatNearBottomRef.current) {
        requestAnimationFrame(() => scrollChatToBottom(true));
      } else {
        setChatShowJumpBottom(true);
      }
      const last = newer[newer.length - 1];
      if (last) {
        await authFetch(`${API_URL}/chat/conversations/${selectedChatId}/mark-read/`, {
          method: "POST",
          body: JSON.stringify({ message_id: last.id }),
        });
        loadChats();
      }
    }

    loadLatest();
    const id = setInterval(pollNewer, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // Handlers intentionally close over latest selectedChatId / authFetch each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, selectedChatId, chatsSurfaceActive]);

  return {
    loadChats,
    loadVmenuChatContacts,
    openVmenuUserChat,
    scrollChatToMessageId,
    jumpToChatMessage,
    openChatPhotosLightbox,
    openDirectChatWithStaff,
    openChatWithClient,
    openChatWithProvider,
    fetchChatMessagesPage,
    scrollChatToBottom,
    updateChatScrollUi,
    loadOlderChatMessages,
    refreshChatMessages,
    postChatMessage,
    sendChatMessage,
    openChatAttachPicker,
    onChatFilePicked,
  };
}
