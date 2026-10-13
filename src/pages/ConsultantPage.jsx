import React, { useState, useEffect, useRef, useCallback } from "react";
import * as faceapi from "face-api.js";
import { useNavigate } from "react-router-dom";
import { createVoiceSession, STATE as VOICE } from "../lib/voiceSession";
import OrbStage from "../components/orb/OrbStage.jsx";
// ── Environment / Auth config ────────────────────────────────────────────────
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
const API_KEY     = import.meta.env.VITE_API_KEY     || "horizon-secure-key-2025";

const WINDOW_DURATION_MS    = 10000;
const FRAME_CAPTURE_MS      = 5000;   // capture frame every 5s — stored locally, no API call
const MAX_CAPTURED_FRAMES   = 60;     // ~5 min max at 5s intervals

// ── Authenticated API helper — attaches X-API-Key to every request ───────────
const apiFetch = (url, opts = {}) =>
    fetch(url, {
        ...opts,
        headers: {
            "X-API-Key": API_KEY,
            ...(opts.headers || {}),
        },
    });

// ──────────────────────────────────────────────────────────
// 🔵  CIRCULAR PROGRESS BAR
// ──────────────────────────────────────────────────────────
const CircularProgress = ({ progress }) => {
    const R = 54;
    const CIRCUMFERENCE = 2 * Math.PI * R;
    const offset = CIRCUMFERENCE - (progress / 100) * CIRCUMFERENCE;
    return (
        <div style={{ position: "relative", width: 140, height: 140, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="140" height="140" style={{ transform: "rotate(-90deg)", position: "absolute" }}>
                <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" />
                <circle
                    cx="70" cy="70" r={R} fill="none" stroke="#ffffff" strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={CIRCUMFERENCE} strokeDashoffset={offset}
                    style={{ transition: "stroke-dashoffset 0.4s ease" }}
                />
            </svg>
            <span style={{ position: "relative", zIndex: 1, fontSize: 22, fontWeight: 700, color: "#ffffff", letterSpacing: "-0.5px", fontFamily: "'Nunito', sans-serif" }}>
                {Math.round(progress)}%
            </span>
        </div>
    );
};

// ──────────────────────────────────────────────────────────
// 🎨  GLOBAL STYLES
// ──────────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap');

  html, body, #root { margin: 0 !important; padding: 0 !important; width: 100%; max-width: 100% !important; overflow-x: hidden; background: #E2EDFB; }
  *, *::before, *::after { box-sizing: border-box; font-family: 'Nunito', sans-serif; }

  .consultant-root { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 16px; }
  .video-window {
    position: relative; width: min(1000px, 95vw); aspect-ratio: 16 / 9; border-radius: 32px; overflow: hidden;
    background: linear-gradient(135deg, #E2EDFB 0%, #82B1FF 45%, #448AFF 70%, #82B1FF 100%);
    background-size: 200% 200%; animation: holoGradient 15s ease infinite; box-shadow: 0 12px 40px rgba(0,0,0,0.08);
  }
  @keyframes holoGradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }

  /* Camera feed — fills the entire video-window, mirrored like a selfie */
  .live-video {
    position: absolute; inset: 0; width: 100%; height: 100%;
    object-fit: cover; transform: scaleX(-1); /* mirror so it feels natural */
    border-radius: 32px;
  }
  /* Subtle dark gradient so text / timer stay readable over the camera */
  .video-overlay {
    position: absolute; inset: 0; border-radius: 32px; z-index: 1;
    background: linear-gradient(
      to bottom,
      rgba(0,0,0,0.35) 0%,
      rgba(0,0,0,0.0)  35%,
      rgba(0,0,0,0.0)  65%,
      rgba(0,0,0,0.40) 100%
    );
    pointer-events: none;
  }
  .timer { position: absolute; top: 30px; right: 40px; font-size: clamp(16px, 2vw, 20px); font-weight: 500; color: #ffffff; z-index: 10; letter-spacing: 1px; text-shadow: 0 1px 4px rgba(0,0,0,0.6); }

  /* The orb sits over the camera; a dark veil keeps its glow readable. */
  .orb-veil { position: absolute; inset: 0; z-index: 2; background: radial-gradient(ellipse at 50% 42%, rgba(5,11,24,0.55) 0%, rgba(5,11,24,0.25) 45%, rgba(5,11,24,0) 75%); pointer-events: none; }
  .orb-layer { position: absolute; inset: 0; z-index: 3; }
  .avatar-wrap { position: absolute; bottom: 9%; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 8px; z-index: 5; width: 100%; }
  .subtitle { font-size: clamp(15px, 1.8vw, 19px); font-weight: 500; color: #ffffff; text-align: center; max-width: 80%; margin: 0; transition: opacity 0.3s ease; text-shadow: 0 2px 10px rgba(0,0,0,0.7); }
  .listening-indicator { font-size: 13px; font-weight: 500; color: #7FD8E8; white-space: nowrap; animation: pulse 1.5s infinite; letter-spacing: 1px; text-transform: uppercase; }
  @keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }

  .analyzing-screen {
    position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 28px;
    background: linear-gradient(135deg, #1a2a5e 0%, #2962FF 50%, #448AFF 100%); background-size: 200% 200%; animation: holoGradient 8s ease infinite;
  }
  .preparing-text { font-size: clamp(15px, 2vw, 18px); font-weight: 500; color: #ffffff; letter-spacing: 3px; text-transform: uppercase; animation: blink 1.4s ease-in-out infinite; }
  @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
  .btn-row { display: flex; gap: 20px; margin-top: 36px; align-items: center; justify-content: center; }

  .voice-notice {
    position: absolute; bottom: 14px; left: 50%; transform: translateX(-50%);
    background: rgba(183,28,28,0.85); color: #fff;
    font-size: 11px; font-weight: 500; padding: 4px 12px;
    border-radius: 20px; z-index: 11; letter-spacing: 0.3px;
    max-width: 70%; text-align: center; backdrop-filter: blur(6px);
  }
  .deepface-badge {
    position: absolute; bottom: 14px; left: 16px;
    background: rgba(0,0,0,0.45); color: #fff;
    font-size: 11px; font-weight: 500; padding: 4px 10px;
    border-radius: 20px; z-index: 10; letter-spacing: 0.5px;
    backdrop-filter: blur(6px);
  }
`;

// ──────────────────────────────────────────────────────────
// 🚀  MAIN COMPONENT
// ──────────────────────────────────────────────────────────
export default function ConsultantPage() {
    const navigate = useNavigate();

    const loadSavedState = () => {
        try {
            const saved = sessionStorage.getItem("horizon_consultant_state");
            return saved ? JSON.parse(saved) : null;
        } catch (_err) {
            return null;
        }
    };
    const savedState = loadSavedState();

    // ── UI State ──
    const [phase, setPhase]               = useState(savedState?.phase || "session");
    const [secs, setSecs]                 = useState(savedState?.secs || 90);
    const [chatHistory, setChatHistory]   = useState(savedState?.chatHistory || []);
    const [held, setHeld]                 = useState(false);
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [aiText, setAiText]             = useState("Loading Secure Local AI Models...");
    const [voiceState, setVoiceState]     = useState(VOICE.IDLE);
    const [voiceNotice, setVoiceNotice]   = useState("");
    const [sessionStarted, setSessionStarted] = useState(false);

    // ── Emotion tracking state ──
    const [faceEmotions, setFaceEmotions]     = useState({});
    const [deepFaceEmotions, setDeepFaceEmotions] = useState({});
    const [capturedFrameCount, setCapturedFrameCount] = useState(0);  // local frame buffer counter
    const [globalBlinkCount, setGlobalBlinkCount]     = useState(0);
    const [globalEyeContact, setGlobalEyeContact]     = useState("Direct");
    const [analyzeProgress, setAnalyzeProgress]       = useState(0);

    // ── All refs declared upfront to avoid hoisting errors ──
    const phaseRef              = useRef(phase);
    const heldRef               = useRef(held);
    // True while the therapist is speaking, so her voice does not pollute the
    // facial-emotion sampling below.
    const isPlayingAudioRef     = useRef(false);
    const sessionStartedRef     = useRef(false);
    const chatHistoryRef        = useRef(chatHistory);
    const progressIntervalRef   = useRef(null);

    // ── Streaming-turn refs ──
    // Clips arrive one sentence at a time and must play in order; `turnActive`
    // marks a turn still streaming, so a momentarily empty queue is not
    // mistaken for "the therapist has finished speaking".
    const sessionRef = useRef(null);

    // ── ATMF temporal data refs ──
    const temporalTimeline   = useRef([]);
    const capturedFramesRef  = useRef([]);  // local frame buffer — sent to backend at session end
    const sessionIdRef       = useRef(`session_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    const currentWindow      = useRef({
        startTime: Date.now(),
        blinks: 0,
        eyeAvoidanceFrames: 0,
        totalFrames: 0,
        faceDetectedFrames: 0,
        emotions: {},
        transcripts: [],
        deepfaceEmotions: {},
    });

    // ── Media refs ──
    const videoRef         = useRef(null);
    const streamRef        = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef   = useRef([]);

    const cameraUtilsRef   = useRef(null);
    const finalizingRef    = useRef(false);

    // ── Keep refs in sync with state ──
    useEffect(() => { phaseRef.current = phase; }, [phase]);
    useEffect(() => { heldRef.current = held; }, [held]);
    useEffect(() => { sessionStartedRef.current = sessionStarted; }, [sessionStarted]);
    useEffect(() => { chatHistoryRef.current = chatHistory; }, [chatHistory]);

    // ── Close the voice session (socket, mic, playback) on unmount ──
    useEffect(() => () => {
        sessionRef.current?.close();
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    }, []);

    // ── Persist state to sessionStorage ──
    useEffect(() => {
        sessionStorage.setItem("horizon_consultant_state", JSON.stringify({ phase, secs, chatHistory }));
    }, [phase, secs, chatHistory]);

    // ── Progress bar animation during analyzing ──
    useEffect(() => {
        if (phase === "analyzing") {
            setAnalyzeProgress(0);
            progressIntervalRef.current = setInterval(() => {
                setAnalyzeProgress(prev => {
                    if (prev >= 92) { clearInterval(progressIntervalRef.current); return 92; }
                    const step = prev < 60 ? 2.2 : prev < 80 ? 1.1 : 0.45;
                    return Math.min(prev + step, 92);
                });
            }, 200);
        }
        return () => clearInterval(progressIntervalRef.current);
    }, [phase]);

    // ── System context init ──
    useEffect(() => {
        if (chatHistory.length > 0) return;
        try {
            const rawConfig = sessionStorage.getItem("horizon_session_config");
            if (rawConfig) {
                const config = JSON.parse(rawConfig);
                if (config.duration_seconds && !savedState) setSecs(config.duration_seconds);
                // The therapist persona and the Hindi-only rules now live in the
                // backend system prompt. Injecting them here as a fake first
                // user turn only polluted the history the model reads back.
            }
        } catch (_err) {
            // config parse failure is non-fatal
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Resume if page was refreshed during analysis ──
    useEffect(() => {
        if (phase === "analyzing" && savedState) {
            executeFinalCleanupAndAnalyze();
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Load face-api + MediaPipe models ──
    useEffect(() => {
        const loadExternalScriptsAndModels = async () => {
            const loadScript = (src) => new Promise((resolve, reject) => {
                if (document.querySelector(`script[src="${src}"]`)) return resolve();
                const script = document.createElement("script");
                script.src = src; script.crossOrigin = "anonymous";
                script.onload = resolve; script.onerror = reject;
                document.body.appendChild(script);
            });
            try {
                await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js");
                await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js");
                await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
                // Correct model file name is 'face_expression_model' (not 'face_expression_recognition_model')
                await faceapi.nets.faceExpressionNet.loadFromUri('/models');
                setModelsLoaded(true);
                setAiText("Click Start to begin your session.");
            } catch (_err) {
                // Non-fatal: face tracking unavailable but voice agent still works
                console.warn("[ConsultantPage] Face-api/MediaPipe models failed to load — running without face tracking.", _err);
                setModelsLoaded(true);
                setAiText("Click Start to begin your session.");
            }
        };
        loadExternalScriptsAndModels();
    }, []);

    // ── Lighting quality helper — useCallback so it's stable for useEffect deps ──
    const calculateLightingQuality = useCallback(() => {
        const videoEl = videoRef.current;
        if (!videoEl || videoEl.readyState !== 4) return 0.5;
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 64; canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(videoEl, 0, 0, 64, 64);
            const data = ctx.getImageData(0, 0, 64, 64).data;
            let brightness = 0;
            for (let i = 0; i < data.length; i += 4)
                brightness += (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
            brightness = brightness / (64 * 64);
            const quality = 1.0 - Math.abs(120 - brightness) / 120;
            return Math.max(0.1, Math.min(quality, 1.0));
        } catch (_err) {
            return 0.5;
        }
    }, []);

    // ── Temporal window archival every 10s ──
    useEffect(() => {
        if (!modelsLoaded || phase !== "session" || held) return;

        const archiveTemporalWindow = () => {
            const cw = currentWindow.current;
            if (cw.totalFrames === 0) return;

            const trackingConfidence = cw.faceDetectedFrames / cw.totalFrames;
            const lightingQuality    = calculateLightingQuality();
            const faceReliability    = (trackingConfidence * 0.7) + (lightingQuality * 0.3);
            const eyeAvoidanceRatio  = cw.faceDetectedFrames > 0
                ? parseFloat((cw.eyeAvoidanceFrames / cw.faceDetectedFrames).toFixed(2))
                : 0;
            const dominantEmotion = Object.keys(cw.emotions).length > 0
                ? Object.keys(cw.emotions).reduce((a, b) => cw.emotions[a] > cw.emotions[b] ? a : b)
                : "Neutral";
            const dominantDeepFace = Object.keys(cw.deepfaceEmotions).length > 0
                ? Object.keys(cw.deepfaceEmotions).reduce((a, b) => cw.deepfaceEmotions[a] > cw.deepfaceEmotions[b] ? a : b)
                : "N/A";

            temporalTimeline.current.push({
                timestamp_sec: Math.floor((Date.now() - cw.startTime) / 1000),
                reliability_scores: {
                    Rf_total:            parseFloat(faceReliability.toFixed(2)),
                    tracking_confidence: parseFloat(trackingConfidence.toFixed(2)),
                    lighting_quality:    parseFloat(lightingQuality.toFixed(2)),
                },
                face_metrics: {
                    blinks:              cw.blinks,
                    eye_avoidance_ratio: eyeAvoidanceRatio,
                    dominant_emotion:    dominantEmotion,
                },
                deepface_emotion: dominantDeepFace,
                transcripts: [...cw.transcripts],
            });

            currentWindow.current = {
                startTime: Date.now(),
                blinks: 0, eyeAvoidanceFrames: 0, totalFrames: 0, faceDetectedFrames: 0,
                emotions: {}, transcripts: [], deepfaceEmotions: {},
            };
        };

        const segmentTimer = setInterval(archiveTemporalWindow, WINDOW_DURATION_MS);
        return () => clearInterval(segmentTimer);
    }, [modelsLoaded, phase, held, calculateLightingQuality]);

    // ── Camera / MediaPipe / audio recording startup ──
    useEffect(() => {
        if (!modelsLoaded || phase !== "session" || held) return;

        const startUp = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                streamRef.current = stream;
                // Opens the socket and gives the session its microphone.
                ensureSession().attach(stream);
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    // Rejects harmlessly if the element reloads mid-play; an
                    // unhandled rejection here only clutters the console.
                    videoRef.current.play().catch(() => {});
                }

                // Audio recorder
                audioChunksRef.current = [];
                const audioStream = new MediaStream(stream.getAudioTracks());
                let options = { mimeType: 'audio/webm;codecs=opus' };
                if (!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: 'audio/webm' };
                if (!MediaRecorder.isTypeSupported(options.mimeType)) options = {};
                const mediaRecorder = new MediaRecorder(audioStream, options);
                mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
                mediaRecorder.start(500);
                mediaRecorderRef.current = mediaRecorder;

                // MediaPipe FaceMesh — blink + eye contact
                const FaceMesh = window.FaceMesh;
                const Camera   = window.Camera;
                if (FaceMesh && Camera) {
                    const faceMesh = new FaceMesh({
                        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
                    });
                    faceMesh.setOptions({
                        maxNumFaces: 1, refineLandmarks: true,
                        minDetectionConfidence: 0.5, minTrackingConfidence: 0.5,
                    });
                    faceMesh.onResults((results) => {
                        currentWindow.current.totalFrames += 1;
                        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
                            currentWindow.current.faceDetectedFrames += 1;
                            const landmarks    = results.multiFaceLandmarks[0];
                            const topEyelid    = landmarks[159];
                            const bottomEyelid = landmarks[145];
                            if (Math.abs(topEyelid.y - bottomEyelid.y) < 0.035) {
                                setGlobalBlinkCount(prev => prev + 1);
                                currentWindow.current.blinks += 1;
                            }
                            const leftIris = landmarks[468];
                            if (leftIris && leftIris.y > 0.55) {
                                setGlobalEyeContact("Avoiding (Looking Down)");
                                currentWindow.current.eyeAvoidanceFrames += 1;
                            } else {
                                setGlobalEyeContact("Direct Eye Contact");
                            }
                        }
                    });

                    // Use phaseRef/heldRef inside onFrame to avoid stale closures
                    const camera = new Camera(videoRef.current, {
                        onFrame: async () => {
                            if (videoRef.current && phaseRef.current === "session" && !heldRef.current) {
                                await faceMesh.send({ image: videoRef.current });
                            }
                        },
                        // 640x480 is ample for landmark tracking and costs
                        // ~4x less per frame than 720p. Face work competes
                        // with voice detection for the main thread.
                        width: 640, height: 480,
                    });
                    camera.start();
                    cameraUtilsRef.current = camera;
                }

                if (!sessionStartedRef.current) setAiText("Click Start to begin your session.");

            } catch (_err) {
                console.log("Camera/Mic access denied or unavailable");
            }
        };

        startUp();

        return () => {
            if (phaseRef.current !== "closing" && phaseRef.current !== "analyzing") {
                if (cameraUtilsRef.current) cameraUtilsRef.current.stop();
            }
        };
    }, [modelsLoaded, phase]); // held omitted intentionally — camera stays on during hold

    // ── Local frame capture every 5s (NO API call — deferred to end of session) ──
    useEffect(() => {
        if (!modelsLoaded || phase !== "session" || held) return;

        const captureFrameLocally = () => {
            if (capturedFramesRef.current.length >= MAX_CAPTURED_FRAMES) return;
            const videoEl = videoRef.current;
            if (!videoEl || videoEl.readyState !== 4) return;
            try {
                const canvas = document.createElement('canvas');
                // Capture at reduced resolution to save memory (320×240 is enough for DeepFace)
                canvas.width  = 320;
                canvas.height = 240;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(videoEl, 0, 0, 320, 240);
                const base64Image = canvas.toDataURL('image/jpeg', 0.6);
                capturedFramesRef.current.push(base64Image);
                setCapturedFrameCount(capturedFramesRef.current.length);
            } catch (_err) {
                // Non-fatal — silently skip
            }
        };

        const frameInterval = setInterval(captureFrameLocally, FRAME_CAPTURE_MS);
        return () => clearInterval(frameInterval);
    }, [modelsLoaded, phase, held]);

    // ── face-api.js lightweight polling every 1s ──
    useEffect(() => {
        if (!modelsLoaded || phase !== "session" || held) return;

        const detectFaceAPI = async () => {
            if (isPlayingAudioRef.current) return; // skip while the therapist speaks
            if (videoRef.current && videoRef.current.readyState === 4) {
                const detections = await faceapi
                    .detectSingleFace(
                        videoRef.current,
                        // Smaller input than the 416 default: expression
                        // detection stays reliable and the sampler stops
                        // stalling the conversation on slower machines.
                        new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }),
                    )
                    .withFaceExpressions();
                if (detections) {
                    const topEmotion = Object.keys(detections.expressions)
                        .reduce((a, b) => detections.expressions[a] > detections.expressions[b] ? a : b);
                    setFaceEmotions(prev => ({ ...prev, [topEmotion]: (prev[topEmotion] || 0) + 1 }));
                    currentWindow.current.emotions[topEmotion] =
                        (currentWindow.current.emotions[topEmotion] || 0) + 1;
                }
            }
        };

        const intervalAPI = setInterval(detectFaceAPI, 1000);
        return () => clearInterval(intervalAPI);
    }, [modelsLoaded, phase, held]);

    // ── Greeting fires when Start is clicked ──
    useEffect(() => {
        if (!sessionStarted || !modelsLoaded || phase !== "session") return;
        if (!savedState || (savedState && savedState.chatHistory.length <= 1)) {
            // Greeting text and audio both come from the backend, drawn from a
            // rotating pool so the session does not open the same way every time.
            setAiText("...");
            speakSessionLine("greeting");
        } else {
            setAiText("I am listening...");
            ensureSession().start();
        }
    }, [sessionStarted]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Timer countdown — only starts after user clicks Start ──
    useEffect(() => {
        if (phase !== "session" || held || !sessionStarted) return;
        if (secs <= 0) { initiateEnding(); return; }
        const id = setInterval(() => setSecs((s) => s - 1), 1000);
        return () => clearInterval(id);
    }, [phase, held, secs, sessionStarted]); // eslint-disable-line react-hooks/exhaustive-deps

    const displayTimer = `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;

    // ──────────────────────────────────────────────────────────────────────
    // 🎙️  REALTIME VOICE SESSION
    //
    // Capture, voice-activity detection, the WebSocket and reply playback all
    // live in src/lib/voiceSession.js. This component only reacts to what it
    // reports. See that file for why the transport is a socket and how it
    // recovers from a dropped connection or a silent microphone.
    // ──────────────────────────────────────────────────────────────────────
    const ensureSession = useCallback(() => {
        if (sessionRef.current) return sessionRef.current;

        sessionRef.current = createVoiceSession({
            backendUrl: BACKEND_URL,
            apiKey:     API_KEY,

            // The backend needs the conversation so far to stay on topic; the
            // ref avoids a stale closure over chatHistory.
            getHistory: () => chatHistoryRef.current,

            onState: (next) => {
                setVoiceState(next);
                isPlayingAudioRef.current = next === VOICE.SPEAKING;
                // The goodbye has played out once the loop returns to
                // listening — analyse now rather than waiting on the timer.
                if (phaseRef.current === "closing" && next === VOICE.LISTENING) {
                    executeFinalCleanupAndAnalyze();
                    return;
                }
                if (next === VOICE.LISTENING)     setAiText("I am listening...");
                else if (next === VOICE.THINKING) setAiText("Thinking...");
                else if (next === VOICE.PAUSED)   setAiText("Session paused.");
            },

            onTranscript: (text) => {
                currentWindow.current.transcripts.push(text);
                setChatHistory(prev => [...prev, { role: 'user', text }]);
            },

            onReply: (text) => {
                setChatHistory(prev => [...prev, { role: 'model', text }]);
                setAiText(text);
            },

            onNotice: (message) => {
                // Surfaced rather than swallowed: a silent mic or a dead socket
                // is exactly the failure that used to look like "still listening".
                console.warn("[voice]", message);
                setVoiceNotice(message);
            },
        });

        // Exposed for diagnosis: window.__voice.debug() reports the live
        // microphone levels and the last event received.
        if (typeof window !== "undefined") window.__voice = sessionRef.current;

        return sessionRef.current;
    }, []);

    // ── Opening / closing line: varied text + its audio in one round trip ──
    const speakSessionLine = useCallback(async (kind) => {
        const session = ensureSession();
        try {
            const res = await apiFetch(`${BACKEND_URL}/api/session-line`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ kind }),
            });
            const data = await res.json();
            const text = data.text || "";
            setAiText(text);
            if (kind === "greeting" && text) {
                setChatHistory(prev => [...prev, { role: 'model', text }]);
            }
            if (data.audio) {
                session.speak(data.audio);
            } else if (kind === "closing") {
                executeFinalCleanupAndAnalyze();
            } else {
                session.start();
            }
        } catch (_err) {
            // Backend unreachable — keep the session usable rather than stalling.
            const text = kind === "closing"
                ? "धन्यवाद, आज अपनी बातें साझा करने के लिए।"
                : "नमस्ते। आज आप कैसा महसूस कर रही हैं?";
            setAiText(text);
            if (kind === "closing") executeFinalCleanupAndAnalyze();
            else session.start();
        }
    }, [ensureSession]);   // eslint-disable-line react-hooks/exhaustive-deps

    // ── Ending sequence ──
    const initiateEnding = () => {
        if (phaseRef.current !== "session") return;
        setPhase("closing");
        phaseRef.current = "closing";      // apply now; the abort below reads it
        sessionRef.current?.interrupt();

        speakSessionLine("closing");

        // Safety net in case the closing audio never plays out.
        setTimeout(() => {
            if (phaseRef.current !== "analyzing") executeFinalCleanupAndAnalyze();
        }, 20000);
    };

    // ── Finalize & navigate ──
    const executeFinalCleanupAndAnalyze = () => {
        if (finalizingRef.current) return;
        finalizingRef.current = true;
        phaseRef.current = "analyzing";
        setPhase("analyzing");
        sessionRef.current?.close();
        if (cameraUtilsRef.current) cameraUtilsRef.current.stop();
        if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());

        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.onstop = () => {
                processFinalReport(new Blob(audioChunksRef.current, { type: 'audio/webm' }));
            };
            mediaRecorderRef.current.stop();
        } else {
            processFinalReport(new Blob([], { type: 'audio/webm' }));
        }
    };

    const processFinalReport = async (audioBlob) => {
        try {
            const sessionData     = JSON.parse(sessionStorage.getItem("horizon_consultant_state") || "{}");
            const historyToSubmit = sessionData.chatHistory || chatHistoryRef.current;

            const totalBlinks = temporalTimeline.current.reduce(
                (sum, seg) => sum + (seg.face_metrics?.blinks ?? 0), 0
            );

            const faceEmotionsFromRef = temporalTimeline.current.reduce((acc, seg) => {
                const e = seg.face_metrics?.dominant_emotion;
                if (e) acc[e] = (acc[e] || 0) + 1;
                return acc;
            }, {});

            const deepFaceEmotionsFromRef = temporalTimeline.current.reduce((acc, seg) => {
                const e = seg.deepface_emotion;
                if (e && e !== 'N/A') acc[e] = (acc[e] || 0) + 1;
                return acc;
            }, {});

            const dominantFallback = Object.keys(faceEmotionsFromRef).length > 0
                ? Object.keys(faceEmotionsFromRef).reduce((a, b) => faceEmotionsFromRef[a] > faceEmotionsFromRef[b] ? a : b)
                : "Neutral";
            const dominantDeepFace = Object.keys(deepFaceEmotionsFromRef).length > 0
                ? Object.keys(deepFaceEmotionsFromRef).reduce((a, b) => deepFaceEmotionsFromRef[a] > deepFaceEmotionsFromRef[b] ? a : b)
                : "Unavailable";

            const legacySummary = `Total Blinks: ${totalBlinks} | Eye Contact: ${globalEyeContact} | DeepFace: ${dominantDeepFace} | FaceAPI: ${dominantFallback}`;

            const deepfaceSummary = Object.keys(deepFaceEmotions).length > 0
                ? Object.entries(deepFaceEmotions)
                    .sort(([, a], [, b]) => b - a)
                    .map(([emotion, count]) => `${emotion}: ${count}x`)
                    .join(', ')
                : "No DeepFace data collected";

            const atmfPayload = {
                legacy_summary:    legacySummary,
                deepface_summary:  deepfaceSummary,
                temporal_segments: temporalTimeline.current,
            };

            const fullTranscript = historyToSubmit
                .map(msg => `${msg.role.toUpperCase()}: ${msg.text}`)
                .join("\n");

            const formData = new FormData();
            formData.append("audio",           audioBlob, "session_audio.webm");
            formData.append("transcript",       fullTranscript);
            formData.append("face_data",        JSON.stringify(atmfPayload));
            formData.append("session_id",       sessionIdRef.current);
            // Send locally captured frames as JSON array for batch DeepFace at backend
            formData.append("captured_frames",  JSON.stringify(capturedFramesRef.current));

            const response = await apiFetch(`${BACKEND_URL}/api/analyze-report`, { method: 'POST', body: formData });
            const data = await response.json();

            clearInterval(progressIntervalRef.current);
            setAnalyzeProgress(100);
            sessionStorage.removeItem("horizon_consultant_state");

            setTimeout(() => {
                sessionStorage.setItem("horizon_result", JSON.stringify({
                    report:           data.report,
                    fusionLog:        data.fusion_log,
                    maskingDetection: data.masking_detection,
                    voiceEmotion:     data.voice_emotion,
                    blinkCount:       totalBlinks,
                    eyeContact:       globalEyeContact,
                    faceEmotions:     faceEmotionsFromRef,
                    deepFaceEmotions: deepFaceEmotionsFromRef,
                    temporalSegments: temporalTimeline.current,
                }));
                if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
                navigate('/result-analysis');
            }, 500);

        } catch (_err) {
            console.error("Analysis failed");
            clearInterval(progressIntervalRef.current);
            setAnalyzeProgress(100);
            sessionStorage.removeItem("horizon_consultant_state");
            setTimeout(() => {
                if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
                navigate('/result-analysis', { state: { error: true } });
            }, 500);
        }
    };

    // ── Hold / Resume ──
    const toggleHold = () => {
        const newHeld = !held;
        setHeld(newHeld);
        heldRef.current = newHeld;      // apply now; session callbacks read it
        if (newHeld) {
            sessionRef.current?.pause();
        } else {
            ensureSession().resume();
        }
    };

    // ── Button styles ──
    const blueButtonStyle = {
        padding: "clamp(13px,2vw,16px) clamp(32px,5vw,52px)",
        borderRadius: "10px", border: "none", cursor: "pointer",
        color: "#FFFFFF", fontSize: "16px", fontWeight: "500",
        letterSpacing: "0.3px", fontFamily: "'Nunito', sans-serif",
        background: "#1A5FCC",
        boxShadow: "none",
        transition: "all 0.15s ease-out", outline: "none",
    };
    const darkButtonStyle = {
        padding: "clamp(13px,2vw,16px) clamp(32px,5vw,52px)",
        borderRadius: "10px", border: "none", cursor: "pointer",
        color: "#FFFFFF", fontSize: "16px", fontWeight: "500",
        letterSpacing: "0.3px", fontFamily: "'Nunito', sans-serif",
        background: "#1A5FCC",
        boxShadow: "none",
        transition: "all 0.15s ease-out", outline: "none",
    };
    const btnMouseDown  = (e) => { e.currentTarget.style.transform = "scale(0.98)"; e.currentTarget.style.boxShadow = "none"; };
    const btnMouseUp    = (style) => (e) => { e.currentTarget.style.transform = "scale(1) translateY(0)"; e.currentTarget.style.boxShadow = style.boxShadow; };
    const btnMouseLeave = (style) => (e) => { e.currentTarget.style.transform = "scale(1) translateY(0)"; e.currentTarget.style.boxShadow = style.boxShadow; };

    // ──────────────────────────────────────────────────────
    // RENDER
    // ──────────────────────────────────────────────────────
    return (
        <>
            <style>{STYLES}</style>
            <div className="consultant-root">
                <div className="video-window">
                    {/* Live camera feed — patient sees their own face */}
                    <video ref={videoRef} className="live-video" muted playsInline autoPlay />
                    {/* Gradient overlay for readability */}
                    <div className="video-overlay" />

                    {/* Timer */}
                    {(phase === "session" || phase === "closing") && (
                        <div className="timer">{displayTimer}</div>
                    )}

                    {/* Orb + subtitle */}
                    {(phase === "session" || phase === "closing") && (
                        <>
                            <div className="orb-veil" />
                            <div className="orb-layer">
                                <OrbStage
                                    speaking={voiceState === VOICE.SPEAKING}
                                    getLevels={() => sessionRef.current?.levels?.()}
                                    yFrac={0.4}
                                    rFrac={0.2}
                                />
                            </div>
                        </>
                    )}
                    {(phase === "session" || phase === "closing") && (
                        <div className="avatar-wrap">
                            <p className="subtitle">{aiText}</p>
                            {voiceState === VOICE.LISTENING && !held && phase === "session" && (
                                <div className="listening-indicator">Listening to you...</div>
                            )}
                        </div>
                    )}

                    {/* Voice diagnostics — a silent mic or dropped socket says so */}
                    {voiceNotice && phase === "session" && (
                        <div className="voice-notice">⚠ {voiceNotice}</div>
                    )}

                    {/* Frame capture counter badge (replaces live DeepFace badge) */}
                    {phase === "session" && sessionStarted && (
                        <div className="deepface-badge">
                            📷 Frames: {capturedFrameCount}/{MAX_CAPTURED_FRAMES}
                        </div>
                    )}

                    {/* Analyzing screen */}
                    {phase === "analyzing" && (
                        <div className="analyzing-screen">
                            <CircularProgress progress={analyzeProgress} />
                            <span className="preparing-text">Preparing...</span>
                        </div>
                    )}
                </div>

                {/* Buttons */}
                {phase === "session" && (
                    <div className="btn-row">
                        {!sessionStarted ? (
                            <button
                                onClick={() => {
                                    // Fullscreen and audio unlock need this click.
                                    document.documentElement.requestFullscreen?.().catch(() => {});
                                    ensureSession().unlock();
                                    setSessionStarted(true);
                                }}
                                style={blueButtonStyle}
                                onMouseDown={btnMouseDown}
                                onMouseUp={btnMouseUp(blueButtonStyle)}
                                onMouseLeave={btnMouseLeave(blueButtonStyle)}
                            >
                                Start
                            </button>
                        ) : (
                            <button
                                onClick={toggleHold}
                                style={blueButtonStyle}
                                onMouseDown={btnMouseDown}
                                onMouseUp={btnMouseUp(blueButtonStyle)}
                                onMouseLeave={btnMouseLeave(blueButtonStyle)}
                            >
                                {held ? "Resume" : "Hold"}
                            </button>
                        )}
                        <button
                            onClick={initiateEnding}
                            style={darkButtonStyle}
                            onMouseDown={btnMouseDown}
                            onMouseUp={btnMouseUp(darkButtonStyle)}
                            onMouseLeave={btnMouseLeave(darkButtonStyle)}
                        >
                            Leave
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}