import { askLlm } from "../llm/client.js";
import { ROLE_ANALYST } from "./roles.js";

export function runAnalyst(brief: string): Promise<string> {
  return askLlm(ROLE_ANALYST, brief);
}
