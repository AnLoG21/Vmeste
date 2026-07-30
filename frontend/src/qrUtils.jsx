import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Локальная генерация QR без внешних API (чтобы не зависеть от api.qrserver.com). */
export function qrImageUrl(data, size = 180) {
  // sync fallback placeholder; prefer <QrImg />
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="100%" height="100%" fill="#fff"/><text x="50%" y="50%" text-anchor="middle" fill="#999" font-size="12">QR…</text></svg>`,
  )}`;
}

export function QrImg({ data, size = 180, alt = "QR", className = "" }) {
  const [src, setSrc] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!data) {
      setSrc("");
      setErr("Нет ссылки");
      return undefined;
    }
    setErr("");
    QRCode.toDataURL(String(data), {
      width: size,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#1a1a1a", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setErr("Не удалось построить QR");
      });
    return () => {
      cancelled = true;
    };
  }, [data, size]);

  if (err) return <p className="muted small">{err}</p>;
  if (!src) return <p className="muted small">Генерируем QR…</p>;
  return <img src={src} width={size} height={size} alt={alt} className={className} />;
}

export default QrImg;
