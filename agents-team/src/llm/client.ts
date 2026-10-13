import { config } from "../config.js";
import { askGemini } from "./gemini.js";
import { askGroq } from "./groq.js";
import { askMistral } from "./mistral.js";

/** Team brain for non-coding roles (PM, analyst, SEO, debate, briefs). */
export async function askLlm(system: string, user: string): Promise<string> {
  if (config.llmProvider === "groq") return askGroq(system, user);
  if (config.llmProvider === "mistral") return askMistral(system, user);
  return askGemini(system, user);
}
