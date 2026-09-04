import { useEffect, useRef, useState } from "react";
import {
  blobToFile,
  loadChatComposeMode,
  pickRecorderMime,
  saveChatComposeMode,
} from "./chatMedia.js";

function detectCameraFacingFromTrack(track, deviceLabel = "") {
  const settings = track?.getSettings?.() || {};
  if (settings.facingMode === "user" || settings.facingMode === "environment") {
    return settings.facingMode;
  }
  const label = `${deviceLabel || ""} ${track?.label || ""}`.toLowerCase();
  if (/back|rear|environment|задн|тыл|world/.test(label)) return "environment";
  if (/front|user|face|перед|фронт|selfie/.test(label)) return "user";
  return null;
}

async function pickOtherVideoDevice(currentDeviceId, wantFacing) {
  if (!navigator.mediaDevices?.enumerateDevices) return null;
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cams = devices.filter((d) => d.kind === "videoinput" && d.deviceId);
  if (cams.length < 2) return null;
  const others = cams.filter((d) => d.deviceId !== currentDeviceId);
  if (!others.length) return null;
  const byFacing = others.find((d) => detectCameraFacingFromTrack(null, d.label) === wantFacing);
  if (byFacing) return byFacing;
  const idx = Math.max(
    0,
    cams.findIndex((d) => d.deviceId === currentDeviceId)
  );
  return cams[(idx + 1) % cams.length] || others[0];
}

/**
 * Chat voice / video_note recording + compose hold-to-record handlers.
 */
export function useChatRecording({
  selectedChatId,
  chatInput,
  chatPendingFiles,
  postChatMessage,
  setChatStatus,
}) {
  const [chatComposeMode, setChatComposeMode] = useState(() => loadChatComposeMode());
  const [chatRecordingKind, setChatRecordingKind] = useState(null);
  const [chatRecordLocked, setChatRecordLocked] = useState(false);
  const [chatRecordLiftHint, setChatRecordLiftHint] = useState(false);
  const [chatRecordSecs, setChatRecordSecs] = useState(0);
  const [chatRecordLevels, setChatRecordLevels] = useState(() => Array(24).fill(0.12));
  const [chatMediaPreview, setChatMediaPreview] = useState(null);
  const [chatCameraFacing, setChatCameraFacing] = useState("user");
  const [chatCameraSwitching, setChatCameraSwitching] = useState(false);

  const chatMediaRecorderRef = useRef(null);
  const chatRecordChunksRef = useRef([]);
  const chatRecordStreamRef = useRef(null);
  const chatRecordStartedAtRef = useRef(0);
  const chatHoldTimerRef = useRef(null);
  const chatDidHoldRef = useRef(false);
  const chatPointerStartYRef = useRef(0);
  const chatRecordLiftHintRef = useRef(false);
  const chatRecordLockedRef = useRef(false);
  const chatRecordTickRef = useRef(null);
  const chatAudioCtxRef = useRef(null);
  const chatAnalyserRef = useRef(null);
  const chatLevelRafRef = useRef(null);
  const chatLiveVideoRef = useRef(null);
  const chatPreviewMediaRef = useRef(null);
  const chatRecordMimeRef = useRef("audio/webm");
  const chatRecordKindRef = useRef(null);
  const chatCameraFacingRef = useRef("user");
  const chatKeepRecordingRef = useRef(false);
  const chatCameraStreamRef = useRef(null);
  const chatMirrorPipelineRef = useRef(null);

  useEffect(() => {
    if (chatRecordingKind !== "video_note") return undefined;
    attachLiveCameraPreview();
    const t1 = window.setTimeout(attachLiveCameraPreview, 50);
    const t2 = window.setTimeout(attachLiveCameraPreview, 250);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [chatRecordingKind, chatCameraFacing]);

  function toggleChatComposeMode() {
    const next = chatComposeMode === "voice" ? "video_note" : "voice";
    setChatComposeMode(next);
    saveChatComposeMode(next);
  }

  function clearChatRecordMeters() {
    if (chatRecordTickRef.current) {
      clearInterval(chatRecordTickRef.current);
      chatRecordTickRef.current = null;
    }
    if (chatLevelRafRef.current) {
      cancelAnimationFrame(chatLevelRafRef.current);
      chatLevelRafRef.current = null;
    }
    if (chatAudioCtxRef.current) {
      try {
        chatAudioCtxRef.current.close();
      } catch {
        /* ignore */
      }
      chatAudioCtxRef.current = null;
      chatAnalyserRef.current = null;
    }
    setChatRecordSecs(0);
    setChatRecordLevels(Array(24).fill(0.12));
    setChatRecordLiftHint(false);
  }

  function stopMirrorPipeline() {
    const pipe = chatMirrorPipelineRef.current;
    chatMirrorPipelineRef.current = null;
    if (!pipe) return;
    if (pipe.raf) {
      try {
        cancelAnimationFrame(pipe.raf);
      } catch {
        /* ignore */
      }
    }
    if (pipe.videoEl) {
      try {
        pipe.videoEl.srcObject = null;
      } catch {
        /* ignore */
      }
    }
    if (pipe.canvasStream) {
      try {
        pipe.canvasStream.getTracks().forEach((t) => t.stop());
      } catch {
        /* ignore */
      }
    }
  }

  /** Continuous canvas capture — camera switch must NOT restart MediaRecorder. */
  async function startCanvasRecordPipeline(cameraStream, mirror) {
    stopMirrorPipeline();
    if (!cameraStream) return null;

    const videoEl = document.createElement("video");
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.setAttribute("playsinline", "true");
    videoEl.srcObject = cameraStream;
    await new Promise((resolve) => {
      const done = () => resolve();
      if (videoEl.readyState >= 1) done();
      else {
        videoEl.onloadedmetadata = done;
        window.setTimeout(done, 1200);
      }
    });
    await videoEl.play().catch(() => {});

    const size = 480;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { alpha: false });
    const pipe = {
      videoEl,
      canvas,
      canvasStream: null,
      raf: 0,
      mirror: Boolean(mirror),
    };

    const draw = () => {
      const vw = videoEl.videoWidth || size;
      const vh = videoEl.videoHeight || size;
      if (vw > 0 && vh > 0 && ctx) {
        ctx.save();
        if (pipe.mirror) {
          ctx.translate(size, 0);
          ctx.scale(-1, 1);
        }
        const scale = Math.max(size / vw, size / vh);
        const dw = vw * scale;
        const dh = vh * scale;
        ctx.drawImage(videoEl, (size - dw) / 2, (size - dh) / 2, dw, dh);
        ctx.restore();
      }
      pipe.raf = requestAnimationFrame(draw);
    };
    draw();

    const canvasStream = canvas.captureStream(30);
    pipe.canvasStream = canvasStream;
    chatMirrorPipelineRef.current = pipe;

    return new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...cameraStream.getAudioTracks(),
    ]);
  }

  async function retargetCanvasPipeline(cameraStream, mirror) {
    const pipe = chatMirrorPipelineRef.current;
    if (!pipe?.videoEl) {
      return startCanvasRecordPipeline(cameraStream, mirror);
    }
    pipe.mirror = Boolean(mirror);
    pipe.videoEl.srcObject = null;
    pipe.videoEl.srcObject = cameraStream;
    await new Promise((resolve) => {
      const done = () => resolve();
      if (pipe.videoEl.readyState >= 1) done();
      else {
        pipe.videoEl.onloadedmetadata = done;
        window.setTimeout(done, 800);
      }
    });
    await pipe.videoEl.play().catch(() => {});
    return null;
  }

  function attachLiveCameraPreview() {
    const stream = chatCameraStreamRef.current;
    const el = chatLiveVideoRef.current;
    if (!stream || !el) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }
    el.muted = true;
    el.playsInline = true;
    el.setAttribute("playsinline", "true");
    el.play?.().catch(() => {});
  }

  function stopChatRecordTracks() {
    stopMirrorPipeline();
    const recordStream = chatRecordStreamRef.current;
    chatRecordStreamRef.current = null;
    const cameraStream = chatCameraStreamRef.current;
    chatCameraStreamRef.current = null;
    if (recordStream) {
      try {
        recordStream.getTracks().forEach((t) => t.stop());
      } catch {
        /* ignore */
      }
    }
    if (cameraStream) {
      try {
        cameraStream.getTracks().forEach((t) => t.stop());
      } catch {
        /* ignore */
      }
    }
    if (chatLiveVideoRef.current) {
      try {
        chatLiveVideoRef.current.srcObject = null;
      } catch {
        /* ignore */
      }
    }
  }

  function finishChatRecordingToPreview() {
    const chunks = chatRecordChunksRef.current.slice();
    const mime = chatRecordMimeRef.current || "application/octet-stream";
    const kind = chatRecordKindRef.current || "voice";
    const elapsed = Date.now() - chatRecordStartedAtRef.current;
    chatMediaRecorderRef.current = null;
    chatRecordChunksRef.current = [];
    setChatRecordingKind(null);
    chatRecordLockedRef.current = false;
    setChatRecordLocked(false);
    clearChatRecordMeters();
    stopChatRecordTracks();
    if (elapsed < 400 || !chunks.length) {
      return;
    }
    const blob = new Blob(chunks, { type: mime });
    if (!blob.size) return;
    const url = URL.createObjectURL(blob);
    setChatMediaPreview({
      blob,
      url,
      kind: kind === "video_note" ? "video_note" : "voice",
      mime,
      durationSec: Math.max(1, Math.round(elapsed / 1000)),
      displayFlip: false,
      fileMirrored: true,
    });
  }

  function bindChatMediaRecorder(stream) {
    const mime = chatRecordMimeRef.current;
    const recorder = mime
      ? new MediaRecorder(stream, { mimeType: mime })
      : new MediaRecorder(stream);
    if (!mime && recorder.mimeType) chatRecordMimeRef.current = recorder.mimeType;
    chatMediaRecorderRef.current = recorder;
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chatRecordChunksRef.current.push(ev.data);
    };
    recorder.onstop = () => {
      if (chatKeepRecordingRef.current) {
        chatMediaRecorderRef.current = null;
        return;
      }
      finishChatRecordingToPreview();
    };
    recorder.start(250);
    return recorder;
  }

  async function switchChatCamera() {
    if (chatRecordingKind !== "video_note" || chatCameraSwitching) return;
    const cameraStream = chatCameraStreamRef.current;
    if (!cameraStream) return;
    const wantFacing = chatCameraFacingRef.current === "user" ? "environment" : "user";
    setChatCameraSwitching(true);
    try {
      const oldVideo = cameraStream.getVideoTracks()[0] || null;
      const currentId = oldVideo?.getSettings?.().deviceId || "";
      const nextCam = await pickOtherVideoDevice(currentId, wantFacing);
      if (!nextCam?.deviceId) {
        setChatStatus("Вторая камера не найдена на этом устройстве.");
        return;
      }

      cameraStream.getVideoTracks().forEach((t) => {
        try {
          cameraStream.removeTrack(t);
        } catch {
          /* ignore */
        }
        try {
          t.stop();
        } catch {
          /* ignore */
        }
      });

      let fresh = null;
      let newVideo = null;
      const videoTries = [
        {
          deviceId: { exact: nextCam.deviceId },
          width: { ideal: 480 },
          height: { ideal: 480 },
        },
        {
          facingMode: { exact: wantFacing },
          width: { ideal: 480 },
          height: { ideal: 480 },
        },
        {
          facingMode: { ideal: wantFacing },
          width: { ideal: 480 },
          height: { ideal: 480 },
        },
      ];
      let lastErr = null;
      for (const video of videoTries) {
        try {
          fresh = await navigator.mediaDevices.getUserMedia({ audio: false, video });
          newVideo = fresh.getVideoTracks()[0] || null;
          if (newVideo) break;
          fresh.getTracks().forEach((t) => t.stop());
          fresh = null;
        } catch (err) {
          lastErr = err;
          fresh = null;
          newVideo = null;
        }
      }
      if (!newVideo || !fresh) {
        throw lastErr || new Error("no video");
      }

      const newId = newVideo.getSettings?.().deviceId || "";
      if (currentId && newId && currentId === newId) {
        fresh.getTracks().forEach((t) => t.stop());
        throw new Error("same camera");
      }

      cameraStream.addTrack(newVideo);
      fresh.getAudioTracks().forEach((t) => t.stop());

      const actualFacing =
        detectCameraFacingFromTrack(newVideo, nextCam.label) || wantFacing;
      chatCameraFacingRef.current = actualFacing;
      setChatCameraFacing(actualFacing);

      await retargetCanvasPipeline(cameraStream, actualFacing === "user");
      attachLiveCameraPreview();
    } catch {
      setChatStatus("Не удалось переключить камеру.");
      const cam = chatCameraStreamRef.current;
      if (cam && !cam.getVideoTracks().length) {
        try {
          const fallback = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: { ideal: chatCameraFacingRef.current || "user" },
              width: { ideal: 480 },
              height: { ideal: 480 },
            },
          });
          const vt = fallback.getVideoTracks()[0];
          if (vt) cam.addTrack(vt);
          fallback.getAudioTracks().forEach((t) => t.stop());
          const facing = chatCameraFacingRef.current || "user";
          await retargetCanvasPipeline(cam, facing === "user");
          attachLiveCameraPreview();
        } catch {
          /* ignore */
        }
      }
    } finally {
      setChatCameraSwitching(false);
    }
  }

  async function startChatRecording(kind) {
    if (chatRecordingKind || chatMediaPreview || !selectedChatId) return;
    try {
      const facing = chatCameraFacingRef.current || "user";
      const constraints =
        kind === "video_note"
          ? {
              audio: true,
              video: {
                facingMode: { ideal: facing },
                width: { ideal: 480 },
                height: { ideal: 480 },
              },
            }
          : { audio: true };
      const cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      chatCameraStreamRef.current = kind === "video_note" ? cameraStream : null;
      const actualFacing =
        kind === "video_note"
          ? detectCameraFacingFromTrack(cameraStream.getVideoTracks()[0]) || facing || "user"
          : facing;
      if (kind === "video_note") {
        chatCameraFacingRef.current = actualFacing;
        setChatCameraFacing(actualFacing);
      }
      const recordStream =
        kind === "video_note"
          ? await startCanvasRecordPipeline(cameraStream, actualFacing === "user")
          : cameraStream;
      if (!recordStream) throw new Error("no record stream");
      chatRecordStreamRef.current = recordStream;
      chatRecordChunksRef.current = [];
      const mime = pickRecorderMime(kind);
      chatRecordMimeRef.current = mime || (kind === "video_note" ? "video/webm" : "audio/webm");
      chatRecordKindRef.current = kind;
      chatKeepRecordingRef.current = false;
      bindChatMediaRecorder(recordStream);
      chatRecordStartedAtRef.current = Date.now();
      setChatRecordingKind(kind);
      chatRecordLockedRef.current = false;
      setChatRecordLocked(false);
      setChatRecordSecs(0);
      chatRecordTickRef.current = setInterval(() => {
        setChatRecordSecs(Math.floor((Date.now() - chatRecordStartedAtRef.current) / 1000));
      }, 250);

      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          const source = ctx.createMediaStreamSource(cameraStream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          chatAudioCtxRef.current = ctx;
          chatAnalyserRef.current = analyser;
          const data = new Uint8Array(analyser.frequencyBinCount);
          const tickLevels = () => {
            if (!chatAnalyserRef.current) return;
            chatAnalyserRef.current.getByteFrequencyData(data);
            const step = Math.max(1, Math.floor(data.length / 24));
            const next = [];
            for (let i = 0; i < 24; i += 1) {
              next.push(Math.min(1, (data[i * step] || 0) / 180));
            }
            setChatRecordLevels(next);
            chatLevelRafRef.current = requestAnimationFrame(tickLevels);
          };
          tickLevels();
        }
      } catch {
        /* analyser optional */
      }
    } catch (_e) {
      setChatStatus("Нет доступа к микрофону/камере.");
      setChatRecordingKind(null);
      chatRecordLockedRef.current = false;
      setChatRecordLocked(false);
      clearChatRecordMeters();
      stopChatRecordTracks();
    }
  }

  function stopChatRecording() {
    const rec = chatMediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      try {
        if (typeof rec.requestData === "function") rec.requestData();
        rec.stop();
      } catch {
        setChatRecordingKind(null);
        chatRecordLockedRef.current = false;
        setChatRecordLocked(false);
        clearChatRecordMeters();
        stopChatRecordTracks();
      }
    } else {
      setChatRecordingKind(null);
      chatRecordLockedRef.current = false;
      setChatRecordLocked(false);
      clearChatRecordMeters();
      stopChatRecordTracks();
    }
  }

  function cancelChatRecording() {
    const rec = chatMediaRecorderRef.current;
    chatRecordChunksRef.current = [];
    chatRecordStartedAtRef.current = Date.now();
    if (rec && rec.state !== "inactive") {
      try {
        rec.onstop = () => {
          chatMediaRecorderRef.current = null;
          setChatRecordingKind(null);
          chatRecordLockedRef.current = false;
          setChatRecordLocked(false);
          clearChatRecordMeters();
          stopChatRecordTracks();
        };
        rec.stop();
      } catch {
        setChatRecordingKind(null);
        chatRecordLockedRef.current = false;
        setChatRecordLocked(false);
        clearChatRecordMeters();
        stopChatRecordTracks();
      }
    } else {
      setChatRecordingKind(null);
      chatRecordLockedRef.current = false;
      setChatRecordLocked(false);
      clearChatRecordMeters();
      stopChatRecordTracks();
    }
  }

  function discardChatMediaPreview() {
    if (chatMediaPreview?.url) URL.revokeObjectURL(chatMediaPreview.url);
    setChatMediaPreview(null);
  }

  async function sendChatMediaPreview() {
    if (!chatMediaPreview) return;
    const { blob, kind, mime, durationSec, displayFlip } = chatMediaPreview;
    const file = await blobToFile(
      blob,
      kind === "video_note" ? `video_note_${Date.now()}.webm` : `voice_${Date.now()}.webm`,
      mime
    );
    discardChatMediaPreview();
    await postChatMessage({
      file,
      kind,
      durationSec,
      displayFlip: kind === "video_note" ? Boolean(displayFlip) : null,
    });
  }

  function onComposeActionPointerDown(e) {
    if (chatInput.trim() || chatPendingFiles.length || chatMediaPreview) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    chatDidHoldRef.current = false;
    chatPointerStartYRef.current = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    chatRecordLiftHintRef.current = false;
    setChatRecordLiftHint(false);
    if (chatHoldTimerRef.current) clearTimeout(chatHoldTimerRef.current);
    chatHoldTimerRef.current = setTimeout(() => {
      chatDidHoldRef.current = true;
      startChatRecording(chatComposeMode);
    }, 450);
  }

  function onComposeActionPointerMove(e) {
    if (!chatRecordingKind || chatRecordLockedRef.current) return;
    const y = e.clientY ?? e.touches?.[0]?.clientY ?? chatPointerStartYRef.current;
    const dy = chatPointerStartYRef.current - y;
    const lifted = dy > 40;
    chatRecordLiftHintRef.current = lifted;
    setChatRecordLiftHint(lifted);
    if (dy > 90) {
      chatRecordLockedRef.current = true;
      chatRecordLiftHintRef.current = false;
      setChatRecordLocked(true);
      setChatRecordLiftHint(false);
    }
  }

  function onComposeActionPointerUp(e) {
    if (chatHoldTimerRef.current) {
      clearTimeout(chatHoldTimerRef.current);
      chatHoldTimerRef.current = null;
    }
    try {
      e?.currentTarget?.releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    if (chatRecordingKind) {
      if (chatRecordLockedRef.current) return;
      if (chatRecordLiftHintRef.current) {
        chatRecordLockedRef.current = true;
        chatRecordLiftHintRef.current = false;
        setChatRecordLocked(true);
        setChatRecordLiftHint(false);
        return;
      }
      stopChatRecording();
      return;
    }
    if (!chatDidHoldRef.current) toggleChatComposeMode();
  }

  function onCircleSeekPointer(e, mediaEl) {
    if (!mediaEl || !Number.isFinite(mediaEl.duration) || mediaEl.duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const x = (e.clientX ?? e.touches?.[0]?.clientX) - cx;
    const y = (e.clientY ?? e.touches?.[0]?.clientY) - cy;
    let angle = Math.atan2(y, x);
    angle = (angle + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
    mediaEl.currentTime = (angle / (Math.PI * 2)) * mediaEl.duration;
  }

  return {
    chatComposeMode,
    setChatComposeMode,
    chatRecordingKind,
    chatRecordLocked,
    chatRecordLiftHint,
    chatRecordSecs,
    chatRecordLevels,
    chatMediaPreview,
    setChatMediaPreview,
    chatCameraFacing,
    chatCameraSwitching,
    chatLiveVideoRef,
    chatPreviewMediaRef,
    toggleChatComposeMode,
    startChatRecording,
    stopChatRecording,
    cancelChatRecording,
    discardChatMediaPreview,
    sendChatMediaPreview,
    switchChatCamera,
    onComposeActionPointerDown,
    onComposeActionPointerMove,
    onComposeActionPointerUp,
    onCircleSeekPointer,
  };
}
