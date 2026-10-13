import { Agent, CursorAgentError, configureCursorSdk } from "@cursor/sdk";
import { config } from "../config.js";

type AgentHandle = Awaited<ReturnType<typeof Agent.create>>;

let http1Configured = false;

/**
 * Same idea as Cursor IDE «Network → HTTP Compatibility Mode → HTTP/1.1»:
 * many VLESS/xray proxies break HTTP/2 agent streams.
 */
export function ensureCursorHttp1(): void {
  if (http1Configured || !config.cursorUseHttp1) return;
  configureCursorSdk({ local: { useHttp1ForAgent: true } });
  http1Configured = true;
  console.log("[agents-team] Cursor SDK: useHttp1ForAgent=true (HTTP/1.1 + SSE)");
}

export async function createCursorAgent(): Promise<AgentHandle> {
  if (!config.cursorApiKey) {
    throw new Error("CURSOR_API_KEY missing");
  }
  ensureCursorHttp1();

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
  ensureCursorHttp1();

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

function summarizeUnknown(value: unknown, max = 600): string {
  if (value == null) return "";
  if (typeof value === "string") return value.slice(0, max);
  try {
    return JSON.stringify(value).slice(0, max);
  } catch {
    return String(value).slice(0, max);
  }
}

export async function runCursorPrompt(agent: AgentHandle, prompt: string): Promise<string> {
  const run = await agent.send(prompt);
  const streamHints: string[] = [];

  try {
    for await (const event of run.stream()) {
      const t = (event as { type?: string }).type;
      if (t === "error") {
        streamHints.push(`stream_error=${summarizeUnknown(event, 300)}`);
      } else if (t === "assistant") {
        streamHints[0] = `last_assistant=${summarizeUnknown(event, 200)}`;
      }
    }
  } catch (streamErr) {
    streamHints.push(
      `stream_throw=${streamErr instanceof Error ? streamErr.message : String(streamErr)}`
    );
  }

  const result = await run.wait();
  if (result.status === "error") {
    let conversationHint = "";
    try {
      if (run.supports("conversation")) {
        conversationHint = summarizeUnknown(await run.conversation(), 400);
      }
    } catch {
      /* ignore */
    }
    const parts = [
      `Cursor run error (run ${result.id}, agent ${agent.agentId})`,
      summarizeUnknown(result.result, 400),
      ...streamHints.slice(0, 3),
      conversationHint ? `conversation=${conversationHint}` : "",
    ].filter(Boolean);
    throw new Error(parts.join(" | ").slice(0, 1200));
  }

  const text = typeof result.result === "string" ? result.result : JSON.stringify(result.result ?? "");
  return text?.trim() || `Готово (run ${result.id}, agent ${agent.agentId}).`;
}

export function isCursorStartupError(err: unknown): err is CursorAgentError {
  return err instanceof CursorAgentError;
}

export function isCursorBrainFallbackError(message: string): boolean {
  return (
    /permission_denied|not available in your region|unavailable in your region/i.test(message) ||
    /Cursor run error/i.test(message) ||
    /Cursor HTTP\/startup/i.test(message) ||
    /Cursor resume failed/i.test(message)
  );
}
