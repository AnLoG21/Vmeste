import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config.js";

export async function askGemini(system: string, user: string): Promise<string> {
  if (!config.geminiApiKey) {
    return [
      "[stub — нет GEMINI_API_KEY]",
      `Роль: ${system.slice(0, 120)}…`,
      `Задача: ${user}`,
      "Подключите GEMINI_API_KEY в agents-team/.env для полноценных ответов.",
    ].join("\n");
  }

  const genAI = new GoogleGenerativeAI(config.geminiApiKey);
  const model = genAI.getGenerativeModel({
    model: config.geminiModel,
    systemInstruction: system,
  });
  const result = await model.generateContent(user);
  const text = result.response.text()?.trim();
  if (!text) throw new Error("Empty Gemini response");
  return text;
}
