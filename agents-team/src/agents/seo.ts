import { askGemini } from "../llm/gemini.js";
import { ROLE_SEO } from "./roles.js";

export function runSeo(brief: string): Promise<string> {
  return askGemini(ROLE_SEO, brief);
}
