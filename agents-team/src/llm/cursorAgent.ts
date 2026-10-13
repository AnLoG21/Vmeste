import { Agent, CursorAgentError } from "@cursor/sdk";
import { config } from "../config.js";

type AgentHandle = Awaited<ReturnType<typeof Agent.create>>;

export async function createCursorAgent(): Promise<AgentHandle> {
  if (!config.cursorApiKey) {
    throw new Error("CURSOR_API_KEY missing");
  }

  if (config.cursorRuntime === "local") {
    return Agent.create({
      apiKey: config.cursorApiKey,
      model: { id: config.cursorModel },
      local: { cwd: config.cursorWorkspace },
    });
  }

  return Agent.create({
    apiKey: config.cursorApiKey,
    model: { id: config.cursorModel },
    cloud: {
      repos: [{ url: config.cursorRepoUrl, startingRef: config.cursorRepoRef }],
      autoCreatePR: false,
    },
  });
}

export async function resumeOrCreateCursorAgent(agentId?: string): Promise<AgentHandle> {
  if (!config.cursorApiKey) {
    throw new Error("CURSOR_API_KEY missing");
  }

  if (agentId) {
    try {
      return await Agent.resume(agentId, { apiKey: config.cursorApiKey });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[agents-team] Cursor resume failed (${agentId}): ${msg} — creating new agent`);
    }
  }
  return createCursorAgent();
}

export async function runCursorPrompt(
  agent: { send: (p: string) => Promise<{ wait: () => Promise<{ status: string; id: string; result?: unknown }> }>; agentId: string },
  prompt: string
): Promise<string> {
  const run = await agent.send(prompt);
  const result = await run.wait();
  if (result.status === "error") {
    throw new Error(`Cursor run error (run ${result.id}, agent ${agent.agentId})`);
  }
  const text = typeof result.result === "string" ? result.result : JSON.stringify(result.result ?? "");
  return text?.trim() || `Готово (run ${result.id}, agent ${agent.agentId}).`;
}

export function isCursorStartupError(err: unknown): err is CursorAgentError {
  return err instanceof CursorAgentError;
}
