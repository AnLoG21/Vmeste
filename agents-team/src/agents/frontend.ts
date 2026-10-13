import { askLlm } from "../llm/client.js";
import { ROLE_FRONTEND } from "./roles.js";

export function runFrontend(brief: string): Promise<string> {
  return askLlm(ROLE_FRONTEND, brief);
}
