import { useEffect, useRef, useState } from "react";

/**
 * Video note player: tap center to play/pause; drag the rim to seek.
 * previewMode — сразу кольцо перемотки (превью перед отправкой).
 * durationSec — запасная длительность (WebM из MediaRecorder часто без duration).
 */
export default function ChatVideoNotePlayer({
  src,
  size = 180,
  className = "",
  mirror = true,
  previewMode = false,
  durationSec = 0,
}) {
  const videoRef = useRef(null);
  const rootRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [enlarged, setEnlarged] = useState(Boolean(previewMode));
  const [showRing, setShowRing] = useState(Boolean(previewMode));
  const mutedLoopRef = useRef(false);
  const seekingRef = useRef(false);
  const seekMovedRef = useRef(false);
  const seekWasPlayingRef = useRef(false);
  const suppressClickRef = useRef(false);
  const rafRef = useRef(0);
  const progressRef = useRef(0);
  const durationRef = useRef(0);
  const seekCommitTimerRef = useRef(0);
  const discoveringRef = useRef(false);

  function fallbackDuration() {
    const n = Number(durationSec);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function videoNativeDuration(v) {
    if (!v) return 0;
    const d = v.duration;
    return Number.isFinite(d) && d > 0 && d !== Infinity ? d : 0;
  }

  function effectiveDuration() {
    return videoNativeDuration(videoRef.current) || durationRef.current || fallbackDuration();
  }

  function adoptDuration(d) {
    if (!(Number.isFinite(d) && d > 0)) return;
    durationRef.current = Math.max(durationRef.current || 0, d);
  }

  /** Discover WebM duration without blocking playback (runs in background). */
  function discoverDurationInBackground(v) {
    if (!v || discoveringRef.current) return;
    if (videoNativeDuration(v) > 0) {
      adoptDuration(videoNativeDuration(v));
      return;
    }
    if (fallbackDuration() > 0) adoptDuration(fallbackDuration());
    discoveringRef.current = true;
    const saved = v.currentTime || 0;
    const wasPaused = v.paused;
    const finish = (d) => {
      discoveringRef.current = false;
      try {
        v.currentTime = saved;
      } catch {
        /* ignore */
      }
      if (!wasPaused) v.play?.().catch(() => {});
      adoptDuration(d || fallbackDuration());
    };
    const onDone = () => {
      const d = videoNativeDuration(v);
      finish(d);
    };
    try {
      v.addEventListener("seeked", onDone, { once: true });
      v.currentTime = 1e101;
      window.setTimeout(() => {
        if (discoveringRef.current) onDone();
      }, 600);
    } catch {
      discoveringRef.current = false;
      adoptDuration(fallbackDuration());
    }
  }

  useEffect(() => {
    mutedLoopRef.current = false;
    setShowRing(Boolean(previewMode));
    setEnlarged(Boolean(previewMode));
    setProgress(0);
    progressRef.current = 0;
    seekingRef.current = false;
    discoveringRef.current = false;
    durationRef.current = fallbackDuration();
    const v = videoRef.current;
    if (v) {
      try {
        v.pause();
        v.currentTime = 0;
        v.muted = Boolean(previewMode);
      } catch {
        /* ignore */
      }
    }

    let cancelled = false;
    if (previewMode && v) {
      const start = async () => {
        try {
          v.muted = true;
          await v.play();
          if (cancelled) return;
          setPlaying(true);
          startTick();
          // After playback is up, quietly learn real duration if missing
          window.setTimeout(() => {
            if (!cancelled && !videoNativeDuration(v)) discoverDurationInBackground(v);
          }, 120);
        } catch {
          /* autoplay may fail */
        }
      };
      if (v.readyState >= 2) start();
      else v.addEventListener("loadeddata", start, { once: true });
    }

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (seekCommitTimerRef.current) window.clearTimeout(seekCommitTimerRef.current);
    };
  }, [src, previewMode, durationSec]);

  function setProgressSafe(p) {
    const next = Math.max(0, Math.min(1, Number(p) || 0));
    progressRef.current = next;
    setProgress(next);
  }

  function tick() {
    const v = videoRef.current;
    const dur = effectiveDuration();
    if (!seekingRef.current && v && dur > 0) {
      setProgressSafe(v.currentTime / dur);
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

  function previewSeek(clientX, clientY) {
    if (effectiveDuration() <= 0) return;
    setProgressSafe(angleToProgress(clientX, clientY));
  }

  function commitSeekNow() {
    const v = videoRef.current;
    const dur = effectiveDuration();
    if (!v || dur <= 0) return;
    try {
      v.currentTime = progressRef.current * dur;
    } catch {
      /* ignore */
    }
  }

  function scheduleCommitSeek() {
    if (seekCommitTimerRef.current) window.clearTimeout(seekCommitTimerRef.current);
    seekCommitTimerRef.current = window.setTimeout(() => {
      seekCommitTimerRef.current = 0;
      commitSeekNow();
    }, 90);
  }

  function waitSeeked(v) {
    return new Promise((resolve) => {
      if (!v) {
        resolve();
        return;
      }
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      v.addEventListener("seeked", finish, { once: true });
      window.setTimeout(finish, 220);
    });
  }

  async function resumeAfterSeek() {
    const v = videoRef.current;
    if (!v) return;
    if (seekCommitTimerRef.current) {
      window.clearTimeout(seekCommitTimerRef.current);
      seekCommitTimerRef.current = 0;
    }
    commitSeekNow();
    await waitSeeked(v);
    mutedLoopRef.current = false;
    setShowRing(true);
    setEnlarged(true);
    if (!seekWasPlayingRef.current && !previewMode) {
      setPlaying(false);
      stopTick();
      return;
    }
    try {
      v.muted = Boolean(previewMode);
      await v.play();
      setPlaying(true);
      startTick();
    } catch {
      try {
        v.muted = true;
        await v.play();
        if (!previewMode) v.muted = false;
        setPlaying(true);
        startTick();
      } catch {
        setPlaying(false);
      }
    }
  }

  function onSeekPointerDown(e) {
    if (!showRing || (!previewMode && mutedLoopRef.current)) return;
    const v = videoRef.current;
    if (effectiveDuration() <= 0) {
      discoverDurationInBackground(v);
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    seekWasPlayingRef.current = Boolean(v && !v.paused && !v.ended) || Boolean(previewMode);
    seekingRef.current = true;
    seekMovedRef.current = false;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    try {
      v?.pause?.();
    } catch {
      /* ignore */
    }
    stopTick();
    const x = e.clientX ?? e.touches?.[0]?.clientX;
    const y = e.clientY ?? e.touches?.[0]?.clientY;
    if (x != null && y != null) {
      previewSeek(x, y);
      commitSeekNow();
    }
  }

  function onSeekPointerMove(e) {
    if (!seekingRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    seekMovedRef.current = true;
    const x = e.clientX ?? e.touches?.[0]?.clientX;
    const y = e.clientY ?? e.touches?.[0]?.clientY;
    if (x != null && y != null) {
      previewSeek(x, y);
      scheduleCommitSeek();
    }
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
    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 280);
    void resumeAfterSeek();
  }

  async function playWithSoundFromStart() {
    const v = videoRef.current;
    if (!v) return;
    mutedLoopRef.current = false;
    stopTick();
    try {
      v.pause();
      v.currentTime = 0;
    } catch {
      /* ignore */
    }
    setProgressSafe(0);
    v.muted = false;
    setEnlarged(true);
    setShowRing(true);
    try {
      if (v.readyState < 2) v.load();
      await v.play();
      setPlaying(true);
      startTick();
      if (!videoNativeDuration(v) && !fallbackDuration()) {
        window.setTimeout(() => discoverDurationInBackground(v), 150);
      }
    } catch {
      try {
        v.muted = true;
        await v.play();
        v.muted = false;
        setShowRing(true);
        setEnlarged(true);
        setPlaying(true);
        startTick();
      } catch {
        setPlaying(false);
        setEnlarged(false);
        setShowRing(false);
      }
    }
  }

  async function togglePlay(e) {
    if (seekingRef.current || suppressClickRef.current) return;
    e?.preventDefault?.();
    e?.stopPropagation?.();
    const v = videoRef.current;
    if (!v) return;

    if (previewMode) {
      if (!v.paused && !v.ended) {
        v.pause();
        setPlaying(false);
        stopTick();
        return;
      }
      v.muted = false;
      setShowRing(true);
      setEnlarged(true);
      try {
        await v.play();
        setPlaying(true);
        startTick();
      } catch {
        try {
          v.muted = true;
          await v.play();
          setPlaying(true);
          startTick();
        } catch {
          /* ignore */
        }
      }
      return;
    }

    if (mutedLoopRef.current) {
      await playWithSoundFromStart();
      return;
    }

    if (!v.paused && !v.ended) {
      v.pause();
      setPlaying(false);
      stopTick();
      return;
    }

    v.muted = false;
    setEnlarged(true);
    setShowRing(true);
    try {
      if (v.readyState < 2) v.load();
      await v.play();
      setPlaying(true);
      startTick();
      if (!videoNativeDuration(v) && !fallbackDuration()) {
        window.setTimeout(() => discoverDurationInBackground(v), 150);
      }
    } catch {
      try {
        v.muted = true;
        await v.play();
        v.muted = false;
        setShowRing(true);
        setEnlarged(true);
        setPlaying(true);
        startTick();
      } catch {
        setPlaying(false);
        setEnlarged(false);
        setShowRing(false);
      }
    }
  }

  function onEnded() {
    const v = videoRef.current;
    if (!v) return;
    if (previewMode) {
      try {
        v.currentTime = 0;
      } catch {
        /* ignore */
      }
      setProgressSafe(0);
      v.play?.().catch(() => {});
      setPlaying(true);
      startTick();
      return;
    }
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
        (enlarged || previewMode) && "tg-circle-player--enlarged",
        playing && "tg-circle-player--playing",
        showRing && "tg-circle-player--ring",
        previewMode && "tg-circle-player--preview",
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
      aria-label={playing ? "Пауза" : "Смотреть кружок"}
    >
      <video
        ref={videoRef}
        className={["tg-msg-video-note", mirror && "tg-msg-video-note--mirror"].filter(Boolean).join(" ")}
        src={src}
        playsInline
        webkit-playsinline="true"
        preload="auto"
        controls={false}
        loop={Boolean(previewMode)}
        onEnded={onEnded}
        onLoadedMetadata={() => adoptDuration(videoNativeDuration(videoRef.current) || fallbackDuration())}
        onDurationChange={() => adoptDuration(videoNativeDuration(videoRef.current) || fallbackDuration())}
        onPause={() => {
          if (!mutedLoopRef.current && !seekingRef.current) setPlaying(false);
        }}
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
