import { config } from "../config.js";

type MistralChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

export async function askMistral(system: string, user: string): Promise<string> {
  if (!config.mistralApiKey) {
    return [
      "[stub — нет MISTRAL_API_KEY]",
      `Роль: ${system.slice(0, 120)}…`,
      `Задача: ${user}`,
      "Подключите MISTRAL_API_KEY в agents-team/.env",
    ].join("\n");
  }

  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.mistralApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.mistralModel,
      temperature: 0.3,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Mistral HTTP ${res.status}: ${body.slice(0, 400)}`);
  }

  const data = (await res.json()) as MistralChatResponse;
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty Mistral response");
  return text;
}
