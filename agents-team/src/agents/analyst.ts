import { askGemini } from "../llm/gemini.js";
import { ROLE_ANALYST } from "./roles.js";

export function runAnalyst(brief: string): Promise<string> {
  return askGemini(ROLE_ANALYST, brief);
}
