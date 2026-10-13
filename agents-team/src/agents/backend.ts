import { askLlm } from "../llm/client.js";
import { ROLE_BACKEND } from "./roles.js";

export function runBackend(brief: string): Promise<string> {
  return askLlm(ROLE_BACKEND, brief);
}
