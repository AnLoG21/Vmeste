export type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  at: number;
};

export type Conversation = {
  chatId: number;
  userId: number;
  history: ChatMessage[];
  /** Original request while waiting for answers */
  draftTask?: string;
  pendingQuestions?: string[];
  /** How many clarify rounds already asked for current draft (max 1) */
  clarifyRounds: number;
  /** Cursor SDK agent id for this Telegram chat (resume = same context) */
  cursorAgentId?: string;
  lastJobId?: string;
  busy: boolean;
  updatedAt: number;
};

const conversations = new Map<number, Conversation>();
const MAX_HISTORY = 24;

export function getConversation(chatId: number, userId: number): Conversation {
  let conv = conversations.get(chatId);
  if (!conv || conv.userId !== userId) {
    conv = {
      chatId,
      userId,
      history: [],
      clarifyRounds: 0,
      busy: false,
      updatedAt: Date.now(),
    };
    conversations.set(chatId, conv);
  }
  return conv;
}

export function pushMessage(conv: Conversation, role: "user" | "assistant", text: string) {
  conv.history.push({ role, text, at: Date.now() });
  if (conv.history.length > MAX_HISTORY) {
    conv.history = conv.history.slice(-MAX_HISTORY);
  }
  conv.updatedAt = Date.now();
}

export function setPendingClarification(conv: Conversation, draftTask: string, questions: string[]) {
  conv.draftTask = draftTask;
  conv.pendingQuestions = questions;
  conv.clarifyRounds = (conv.clarifyRounds || 0) + 1;
  conv.updatedAt = Date.now();
}

export function clearPendingClarification(conv: Conversation) {
  conv.draftTask = undefined;
  conv.pendingQuestions = undefined;
  conv.clarifyRounds = 0;
  conv.updatedAt = Date.now();
}

export function formatHistory(conv: Conversation, limit = 10): string {
  return conv.history
    .slice(-limit)
    .map((m) => `${m.role === "user" ? "Заказчик" : "Команда"}: ${m.text}`)
    .join("\n");
}
