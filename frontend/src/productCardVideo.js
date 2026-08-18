/** Короткое вертикальное видео карточки товара (холст + MediaRecorder). */

function loadImage(url) {
  return new Promise((resolve) => {
    if (!url) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

export async function renderProductCardVideo({
  name,
  brand,
  price,
  images = [],
  marketplace = "ozon",
} = {}) {
  const w = 1080;
  const h = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Нет canvas.");

  const urls = (images || [])
    .map((item) => (typeof item === "string" ? item : item?.kind === "video" ? "" : item?.url || ""))
    .filter(Boolean)
    .slice(0, 6);
  const photos = (await Promise.all(urls.map(loadImage))).filter(Boolean);

  const stream = canvas.captureStream(30);
  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
      ? "video/webm;codecs=vp8"
      : "video/webm";
  if (typeof MediaRecorder === "undefined") throw new Error("Браузер не умеет записывать видео.");
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 3_000_000 });
  const chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  const finished = new Promise((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
    recorder.onerror = () => reject(new Error("Не удалось записать видео."));
  });
  recorder.start();

  const duration = 6500;
  const start = performance.now();
  const ozon = marketplace !== "wildberries";
  const c0 = ozon ? [25, 118, 210] : [156, 39, 176];
  const c1 = ozon ? [77, 208, 225] : [233, 30, 99];

  await new Promise((resolve) => {
    const draw = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, `rgb(${c0.join(",")})`);
      g.addColorStop(1, `rgb(${c1.join(",")})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = "rgba(255,255,255,0.14)";
      roundRect(ctx, 60, 80, w - 120, 820, 36);
      ctx.fill();

      if (photos.length) {
        const idx = Math.min(photos.length - 1, Math.floor(t * photos.length));
        const img = photos[idx];
        const box = { x: 90, y: 110, w: w - 180, h: 760 };
        const scale = Math.min(box.w / img.width, box.h / img.height);
        const dw = img.width * scale;
        const dh = img.height * scale;
        ctx.save();
        roundRect(ctx, box.x, box.y, box.w, box.h, 28);
        ctx.clip();
        ctx.drawImage(img, box.x + (box.w - dw) / 2, box.y + (box.h - dh) / 2, dw, dh);
        ctx.restore();
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.font = "700 72px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(ozon ? "Ozon" : "Wildberries", w / 2, 480);
      }

      ctx.fillStyle = "#fff";
      ctx.textAlign = "left";
      ctx.font = "700 54px system-ui, sans-serif";
      const titleLines = wrapText(ctx, name || "Товар", w - 160);
      titleLines.forEach((line, i) => ctx.fillText(line, 80, 980 + i * 64));
      ctx.font = "600 36px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      const sub = [brand, price ? `${price} ₽` : ""].filter(Boolean).join("  ·  ");
      if (sub) ctx.fillText(sub, 80, 980 + titleLines.length * 64 + 28);

      if (t < 1) requestAnimationFrame(draw);
      else resolve();
    };
    requestAnimationFrame(draw);
  });

  await new Promise((r) => setTimeout(r, 120));
  if (recorder.state !== "inactive") recorder.stop();
  const blob = await finished;
  if (!blob.size) throw new Error("Видео получилось пустым.");
  return blob;
}
