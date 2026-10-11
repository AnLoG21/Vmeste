const MAX = 3900;

export function chunkText(text: string, max = MAX): string[] {
  const clean = text.trim() || "—";
  if (clean.length <= max) return [clean];
  const chunks: string[] = [];
  let rest = clean;
  while (rest.length > max) {
    let cut = rest.lastIndexOf("\n", max);
    if (cut < max * 0.5) cut = max;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

export async function replyChunks(
  send: (text: string) => Promise<unknown>,
  prefix: string,
  body: string
): Promise<void> {
  const chunks = chunkText(body);
  for (let i = 0; i < chunks.length; i++) {
    const head = i === 0 ? prefix : `${prefix} (${i + 1}/${chunks.length})`;
    await send(`${head}\n\n${chunks[i]}`);
  }
}
