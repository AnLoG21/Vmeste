import { config } from "../config.js";

type GroqChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

export async function askGroq(system: string, user: string): Promise<string> {
  if (!config.groqApiKey) {
    return [
      "[stub — нет GROQ_API_KEY]",
      `Роль: ${system.slice(0, 120)}…`,
      `Задача: ${user}`,
      "Подключите GROQ_API_KEY в agents-team/.env",
    ].join("\n");
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.groqApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.groqModel,
      temperature: 0.3,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Groq HTTP ${res.status}: ${body.slice(0, 400)}`);
  }

  const data = (await res.json()) as GroqChatResponse;
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty Groq response");
  return text;
}
