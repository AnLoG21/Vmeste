import { askLlm } from "../llm/client.js";
import { ROLE_SEO } from "./roles.js";

export function runSeo(brief: string): Promise<string> {
  return askLlm(ROLE_SEO, brief);
}
