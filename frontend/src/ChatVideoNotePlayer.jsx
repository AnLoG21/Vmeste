import { useEffect, useRef, useState } from "react";

/**
 * Telegram-like video note: center tap play/pause, rim progress,
 * enlarge while sounding, then shrink + muted loop.
 */
export default function ChatVideoNotePlayer({ src, size = 180, className = "" }) {
  const videoRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [enlarged, setEnlarged] = useState(false);
  const mutedLoopRef = useRef(false);
  const rafRef = useRef(0);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  function tick() {
    const v = videoRef.current;
    if (!v || !Number.isFinite(v.duration) || v.duration <= 0) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    setProgress(Math.min(1, v.currentTime / v.duration));
    rafRef.current = requestAnimationFrame(tick);
  }

  function startTick() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }

  function stopTick() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  }

  async function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (!v.paused) {
      v.pause();
      setPlaying(false);
      stopTick();
      return;
    }
    if (!mutedLoopRef.current) {
      v.muted = false;
      setEnlarged(true);
    } else {
      v.muted = true;
      setEnlarged(false);
    }
    try {
      await v.play();
      setPlaying(true);
      startTick();
    } catch {
      setPlaying(false);
    }
  }

  function onEnded() {
    const v = videoRef.current;
    if (!v) return;
    mutedLoopRef.current = true;
    v.muted = true;
    setEnlarged(false);
    v.currentTime = 0;
    v.play?.().catch(() => {});
    setPlaying(true);
    startTick();
  }

  const r = 48;
  const c = 2 * Math.PI * r;
  const dash = c * progress;

  return (
    <div
      className={[
        "tg-circle-player",
        enlarged && "tg-circle-player--enlarged",
        playing && "tg-circle-player--playing",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ width: size, height: size }}
      onClick={togglePlay}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          togglePlay();
        }
      }}
      aria-label={playing ? "Пауза кружка" : "Смотреть кружок"}
    >
      <video
        ref={videoRef}
        className="tg-msg-video-note"
        src={src}
        playsInline
        preload="metadata"
        controls={false}
        onEnded={onEnded}
        onPause={() => setPlaying(false)}
        onPlay={() => {
          setPlaying(true);
          startTick();
        }}
      />
      <svg className="tg-circle-progress" viewBox="0 0 100 100" aria-hidden>
        <circle className="tg-circle-progress-track" cx="50" cy="50" r={r} />
        <circle
          className="tg-circle-progress-value"
          cx="50"
          cy="50"
          r={r}
          strokeDasharray={`${dash} ${c}`}
          transform="rotate(-90 50 50)"
        />
      </svg>
    </div>
  );
}
