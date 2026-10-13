import { AsyncLocalStorage } from "node:async_hooks";

export type ChatContext = {
  chatId: number;
  userId: number;
  /** Formatted Telegram history for the current turn */
  history: string;
};

const als = new AsyncLocalStorage<ChatContext>();

export function runWithChatContext<T>(ctx: ChatContext, fn: () => Promise<T>): Promise<T> {
  return als.run(ctx, fn);
}

export function getChatContext(): ChatContext | undefined {
  return als.getStore();
}
