/** Короткое видео карточки: только перелистывание фото (canvas + MediaRecorder). */

function loadImage(url) {
  return new Promise((resolve) => {
    if (!url) {
      resolve(null);
      return;
    }
    const img = new Image();
    const local = url.startsWith("blob:") || url.startsWith("data:");
    if (!local) {
      try {
        const abs = new URL(url, window.location.href);
        if (abs.origin !== window.location.origin) img.crossOrigin = "anonymous";
      } catch {
        img.crossOrigin = "anonymous";
      }
    }
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function pickRecorderMime() {
  const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

export async function renderProductCardVideo({ images = [] } = {}) {
  const w = 1080;
  const h = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Нет canvas.");

  const urls = (images || [])
    .map((item) => {
      if (typeof item === "string") return item;
      if (item?.kind === "video") return "";
      return item?.previewUrl || item?.url || "";
    })
    .filter(Boolean)
    .slice(0, 12);
  const photos = (await Promise.all(urls.map(loadImage))).filter(Boolean);
  if (!photos.length) throw new Error("Нет фото для видео.");

  const drawFrame = (t) => {
    ctx.fillStyle = "#f4f4f4";
    ctx.fillRect(0, 0, w, h);

    const idx = Math.min(photos.length - 1, Math.floor(t * photos.length));
    const img = photos[idx];
    const pad = 48;
    const box = { x: pad, y: pad, w: w - pad * 2, h: h - pad * 2 };
    const scale = Math.min(box.w / img.width, box.h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, box.x + (box.w - dw) / 2, box.y + (box.h - dh) / 2, dw, dh);
  };

  drawFrame(0);

  const stream = canvas.captureStream(30);
  const mime = pickRecorderMime();
  if (typeof MediaRecorder === "undefined") throw new Error("Браузер не умеет записывать видео.");
  const recorder = mime
    ? new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_500_000 })
    : new MediaRecorder(stream, { videoBitsPerSecond: 2_500_000 });
  const chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  const finished = new Promise((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
    recorder.onerror = () => reject(new Error("Не удалось записать видео."));
  });
  recorder.start(200);

  const duration = Math.max(4000, photos.length * 1200);
  const start = performance.now();

  await new Promise((resolve) => {
    const draw = (now) => {
      const t = Math.min(1, (now - start) / duration);
      drawFrame(t);
      if (t < 1) requestAnimationFrame(draw);
      else resolve();
    };
    requestAnimationFrame(draw);
  });

  await new Promise((r) => setTimeout(r, 400));
  if (recorder.state !== "inactive") recorder.stop();
  const blob = await finished;
  if (!blob.size) throw new Error("Видео получилось пустым.");
  return blob;
}
