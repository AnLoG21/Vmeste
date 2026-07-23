import { useEffect, useRef, useState } from "react";

/**
 * Video note player: tap to play/pause, rim progress + draggable knob on first play,
 * then muted loop without ring.
 */
export default function ChatVideoNotePlayer({ src, size = 180, className = "" }) {
  const videoRef = useRef(null);
  const rootRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [enlarged, setEnlarged] = useState(false);
  const [showRing, setShowRing] = useState(false);
  const mutedLoopRef = useRef(false);
  const seekingRef = useRef(false);
  const rafRef = useRef(0);
  const progressRef = useRef(0);

  useEffect(() => {
    mutedLoopRef.current = false;
    setShowRing(false);
    setEnlarged(false);
    setProgress(0);
    progressRef.current = 0;
    const v = videoRef.current;
    if (v) {
      try {
        v.pause();
        v.currentTime = 0;
        v.muted = false;
      } catch {
        /* ignore */
      }
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [src]);

  function setProgressSafe(p) {
    const v = Math.max(0, Math.min(1, Number(p) || 0));
    progressRef.current = v;
    setProgress(v);
  }

  function tick() {
    const v = videoRef.current;
    if (!seekingRef.current && v && Number.isFinite(v.duration) && v.duration > 0) {
      setProgressSafe(v.currentTime / v.duration);
    }
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

  function angleToProgress(clientX, clientY) {
    const el = rootRef.current;
    if (!el) return progressRef.current;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const x = clientX - cx;
    const y = clientY - cy;
    let angle = Math.atan2(y, x);
    angle = (angle + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
    return angle / (Math.PI * 2);
  }

  function applySeek(clientX, clientY) {
    const v = videoRef.current;
    if (!v || !Number.isFinite(v.duration) || v.duration <= 0) return;
    const p = angleToProgress(clientX, clientY);
    setProgressSafe(p);
    try {
      v.currentTime = p * v.duration;
    } catch {
      /* ignore */
    }
  }

  function onSeekPointerDown(e) {
    if (!showRing || mutedLoopRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    seekingRef.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const x = e.clientX ?? e.touches?.[0]?.clientX;
    const y = e.clientY ?? e.touches?.[0]?.clientY;
    if (x != null && y != null) applySeek(x, y);
  }

  function onSeekPointerMove(e) {
    if (!seekingRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const x = e.clientX ?? e.touches?.[0]?.clientX;
    const y = e.clientY ?? e.touches?.[0]?.clientY;
    if (x != null && y != null) applySeek(x, y);
  }

  function onSeekPointerUp(e) {
    if (!seekingRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    seekingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  async function togglePlay(e) {
    if (seekingRef.current) return;
    e?.preventDefault?.();
    e?.stopPropagation?.();
    const v = videoRef.current;
    if (!v) return;

    if (!v.paused && !v.ended) {
      v.pause();
      setPlaying(false);
      stopTick();
      return;
    }

    if (!mutedLoopRef.current) {
      v.muted = false;
      setEnlarged(true);
      setShowRing(true);
    } else {
      v.muted = true;
      setEnlarged(false);
      setShowRing(false);
    }

    try {
      // Some browsers need load() after src change
      if (v.readyState < 2) {
        v.load();
      }
      await v.play();
      setPlaying(true);
      startTick();
    } catch (err) {
      // Retry muted then unmute (mobile autoplay quirks)
      try {
        v.muted = true;
        await v.play();
        if (!mutedLoopRef.current) {
          v.muted = false;
          setShowRing(true);
          setEnlarged(true);
        }
        setPlaying(true);
        startTick();
      } catch {
        setPlaying(false);
        setEnlarged(false);
      }
    }
  }

  function onEnded() {
    const v = videoRef.current;
    if (!v) return;
    mutedLoopRef.current = true;
    v.muted = true;
    setEnlarged(false);
    setShowRing(false);
    setProgressSafe(0);
    stopTick();
    try {
      v.currentTime = 0;
    } catch {
      /* ignore */
    }
    v.play?.().catch(() => {});
    setPlaying(true);
  }

  const r = 46;
  const c = 2 * Math.PI * r;
  const dashOffset = c * (1 - progress);
  const knobAngle = progress * Math.PI * 2 - Math.PI / 2;
  const knobX = 50 + r * Math.cos(knobAngle);
  const knobY = 50 + r * Math.sin(knobAngle);

  return (
    <div
      ref={rootRef}
      className={[
        "tg-circle-player",
        enlarged && "tg-circle-player--enlarged",
        playing && "tg-circle-player--playing",
        showRing && "tg-circle-player--ring",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ width: size, height: size }}
      role="button"
      tabIndex={0}
      onClick={togglePlay}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          togglePlay(e);
        }
      }}
      aria-label={playing ? "Пауза кружка" : "Смотреть кружок"}
    >
      <video
        ref={videoRef}
        className="tg-msg-video-note"
        src={src}
        playsInline
        webkit-playsinline="true"
        preload="auto"
        controls={false}
        onEnded={onEnded}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
      />
      {showRing ? (
        <svg
          className="tg-circle-progress"
          viewBox="0 0 100 100"
          onPointerDown={onSeekPointerDown}
          onPointerMove={onSeekPointerMove}
          onPointerUp={onSeekPointerUp}
          onPointerCancel={onSeekPointerUp}
          onClick={(e) => e.stopPropagation()}
        >
          <circle className="tg-circle-progress-track" cx="50" cy="50" r={r} />
          <circle
            className="tg-circle-progress-value"
            cx="50"
            cy="50"
            r={r}
            strokeDasharray={c}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 50 50)"
          />
          <circle className="tg-circle-progress-hit" cx="50" cy="50" r={r} />
          <circle className="tg-circle-progress-knob" cx={knobX} cy={knobY} r="4.5" />
        </svg>
      ) : null}
    </div>
  );
}
