/** Concurrency gate so parallel roles don't stampede free-tier TPM. */
let active = 0;
let maxConcurrent = 1;
const waiters: Array<() => void> = [];

export function setLlmMaxConcurrent(n: number) {
  maxConcurrent = Math.max(1, Math.floor(n));
}

export function getLlmQueueDepth(): number {
  return active + waiters.length;
}

export async function enqueueLlm<T>(fn: () => Promise<T>): Promise<T> {
  await new Promise<void>((resolve) => {
    if (active < maxConcurrent) {
      active += 1;
      resolve();
    } else {
      waiters.push(() => {
        active += 1;
        resolve();
      });
    }
  });

  try {
    return await fn();
  } finally {
    active -= 1;
    const next = waiters.shift();
    if (next) next();
  }
}
