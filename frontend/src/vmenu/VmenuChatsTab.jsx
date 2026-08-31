import { useEffect, useState } from "react";
import { VmenuBackButton } from "./VmenuComponents.jsx";

export function VmenuChatsTab({ authFetch, API_URL, me, initialChatId, onChatOpen }) {
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(initialChatId || null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");

  async function loadConversations() {
    const res = await authFetch(`${API_URL}/chat/conversations/?user_direct=1`);
    if (!res.ok) return;
    const data = await res.json();
    setConversations(Array.isArray(data) ? data : data.results || []);
  }

  async function loadMessages(convId) {
    const res = await authFetch(`${API_URL}/chat/messages/?conversation=${convId}&limit=50`);
    if (!res.ok) return;
    setMessages(await res.json());
    await authFetch(`${API_URL}/chat/conversations/${convId}/mark-read/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
  }

  useEffect(() => {
    void loadConversations();
  }, []);

  useEffect(() => {
    if (initialChatId) setSelectedId(initialChatId);
  }, [initialChatId]);

  useEffect(() => {
    if (selectedId) void loadMessages(selectedId);
  }, [selectedId]);

  function peerTitle(conv) {
    if (conv.title) return conv.title;
    const peer = (conv.members || []).find((m) => Number(m.user?.id) !== Number(me?.id));
    const u = peer?.user;
    if (!u) return "Чат";
    const name = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
    return name || u.username || "Чат";
  }

  async function send() {
    if (!text.trim() || !selectedId) return;
    setStatus("");
    const res = await authFetch(`${API_URL}/chat/messages/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation: selectedId, text: text.trim() }),
    });
    if (!res.ok) {
      setStatus("Не удалось отправить");
      return;
    }
    setText("");
    await loadMessages(selectedId);
    await loadConversations();
  }

  if (selectedId) {
    const conv = conversations.find((c) => Number(c.id) === Number(selectedId));
    return (
      <div className="vmenu-tab vmenu-chats">
        <div className="vmenu-tab-head-row">
          <VmenuBackButton
            onClick={() => {
              setSelectedId(null);
              onChatOpen?.(null);
            }}
          />
          <h2>{conv ? peerTitle(conv) : "Чат"}</h2>
        </div>
        <div className="vmenu-chat-thread">
          {messages.map((m) => (
            <div
              key={m.id}
              className={Number(m.sender?.id) === Number(me?.id) ? "vmenu-chat-msg mine" : "vmenu-chat-msg"}
            >
              <p>{m.text}</p>
            </div>
          ))}
        </div>
        <div className="vmenu-chat-compose">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Сообщение…"
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
          />
          <button type="button" className="vmenu-send-btn" onClick={send} aria-label="Отправить">
            ➤
          </button>
        </div>
        {status ? <p className="status error">{status}</p> : null}
      </div>
    );
  }

  return (
    <div className="vmenu-tab vmenu-chats">
      <h2>Чаты Вменю</h2>
      <p className="muted small">Личные переписки с авторами рецептов.</p>
      <ul className="vmenu-chat-list">
        {conversations.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => {
                setSelectedId(c.id);
                onChatOpen?.(c.id);
              }}
            >
              <span className="vmenu-chat-list-title">{peerTitle(c)}</span>
              <span className="muted small">
                {(c.last_message?.text || "").slice(0, 60)}
                {(c.last_message?.text || "").length > 60 ? "…" : ""}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {!conversations.length ? <p className="muted">Пока нет чатов. Напишите автору из его профиля.</p> : null}
    </div>
  );
}
