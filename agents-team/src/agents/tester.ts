import { askLlm } from "../llm/client.js";
import { ROLE_TESTER } from "./roles.js";

export function runTester(brief: string): Promise<string> {
  return askLlm(ROLE_TESTER, brief);
}
