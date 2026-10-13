"""
main.py — Horizon Mental Health Platform · FastAPI Backend
All secrets loaded from .env · Single API key guards all routes

Changes v4:
  - Chat: Sarvam `sarvam-105b-conversations` via llm_service. The previous
    OpenRouter free-tier chain was rate-limited on every model except one
    reasoning model, which took ~17 s and emitted its own scratchpad; when the
    chain failed it returned a single hardcoded line, so the agent appeared to
    repeat itself.
  - Conversation transport: WS /ws/session carries the whole session on one
    socket. Audio is uploaded while the patient is still speaking, so the clip
    is already here when they stop; there is no per-utterance connection setup;
    and a mid-reply "cancel" enables barge-in. POST /api/converse remains as an
    SSE fallback and runs the identical pipeline (converse_events).
    Speech for the first sentence is synthesised while the model is still
    writing the second, so audio starts ~2.5 s after the patient stops speaking
    instead of ~21 s.
  - TTS/STT: Sarvam AI REST API — Hindi only.
  - DeepFace: DEFERRED — frames stored in-memory per session during session,
    batch-processed at /api/analyze-report time only (zero ML latency during chat)
"""
import os

# ── Suppress TensorFlow / oneDNN startup noise before any TF import ───────────
os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS",   "0")   # silence oneDNN info msgs
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL",     "2")   # suppress TF C++ INFO/WARN
os.environ.setdefault("TF_ENABLE_DEPRECATION_WARNINGS", "0")
os.environ.setdefault("ABSL_LOGGING_VMODULE",     "")    # suppress absl port.cc msgs

import warnings
warnings.filterwarnings("ignore", category=DeprecationWarning)
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", message=".*sparse_softmax_cross_entropy.*")

import io
import base64
import json
import logging
import asyncio
import tempfile
import collections
from concurrent.futures import ThreadPoolExecutor

import cv2
import numpy as np
import requests
import PyPDF2

from fastapi import (
    FastAPI, UploadFile, File, Form, Request, HTTPException,
    Depends, BackgroundTasks, WebSocket, WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from dotenv import load_dotenv

from deepface import DeepFace
from llm_service import (
    generate_chat_response,
    generate_medical_report,
    validate_response_relevance,
    stream_chat_response,
    finalize_reply,
    get_greeting,
    get_closing,
)
from audio_processor import analyze_audio_emotion
from languages import normalize_lang, normalize_dialect
from clinical_engine import build_clinical_report

# ── Sarvam AI SDK (optional — kept for future use, REST calls used directly) ──
try:
    from sarvamai import SarvamAI
    SARVAM_SDK_AVAILABLE = True
    logging.info("[main] Sarvam AI SDK loaded (REST mode only — WebSocket disabled).")
except ImportError:
    SARVAM_SDK_AVAILABLE = False
    logging.info("[main] sarvamai SDK not installed — using direct REST calls.")

# ── DB (psycopg2 direct — no Prisma binary needed) ───────────────────────────
try:
    from db import upsert_user, create_session, create_report, get_sessions_for_user, db_health_check
    DB_AVAILABLE = True
    logging.info("[main] DB module loaded.")
except Exception as _db_err:
    DB_AVAILABLE = False
    logging.warning(f"[main] DB not available: {_db_err}")

# ─────────────────────────────────────────────────────────────────────────────
# INIT
# ─────────────────────────────────────────────────────────────────────────────
load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SARVAM_API_KEY   = os.getenv("SARVAM_API_KEY", "")
API_SECRET_KEY   = os.getenv("API_SECRET_KEY", "horizon-secure-key-2025")
# bulbul:v3 voices are multilingual, so one speaker serves every language.
TTS_SPEAKER      = os.getenv("SARVAM_TTS_SPEAKER", "shubh")

app = FastAPI(title="Horizon Mental Health API", version="3.0.0")

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],        # Tighten in production to your Vercel domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────────────────────
# IN-MEMORY FRAME STORE  (keyed by session_id sent from frontend)
# Frames are stored here during the session and batch-processed at report time.
# Max 60 frames per session to cap memory usage.
# ─────────────────────────────────────────────────────────────────────────────
_frame_store: dict[str, list[str]] = collections.defaultdict(list)
MAX_FRAMES_PER_SESSION = 60


# ─────────────────────────────────────────────────────────────────────────────
# API KEY MIDDLEWARE  (All routes require X-API-Key header)
# ─────────────────────────────────────────────────────────────────────────────
@app.middleware("http")
async def api_key_middleware(request: Request, call_next):
    # Skip key check for health / docs / openapi, and OPTIONS (CORS preflight)
    if request.method == "OPTIONS" or request.url.path in ["/", "/docs", "/openapi.json", "/redoc"]:
        return await call_next(request)

    api_key = request.headers.get("X-API-Key")
    if api_key != API_SECRET_KEY:
        return JSONResponse(
            status_code=403,
            content={"detail": "Invalid or missing X-API-Key header."},
        )
    return await call_next(request)


# ─────────────────────────────────────────────────────────────────────────────
# ── LIFECYCLE ────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def on_startup():
    if DB_AVAILABLE:
        ok = db_health_check()
        logger.info(f"[startup] Neon DB health: {'OK' if ok else 'UNREACHABLE'}")
    logger.info(f"[startup] Sarvam SDK: {'Available' if SARVAM_SDK_AVAILABLE else 'Fallback requests'}")


@app.on_event("shutdown")
async def on_shutdown():
    logger.info("[shutdown] Backend shutting down.")


# ─────────────────────────────────────────────────────────────────────────────
# PYDANTIC MODELS
# ─────────────────────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    history: list
    message: str


class FrameStoreRequest(BaseModel):
    image_base64: str
    session_id:   str = "default"


class ValidationRequest(BaseModel):
    user_message: str
    ai_response:  str


# ─────────────────────────────────────────────────────────────────────────────
# ATMF-MSI FUSION ENGINE  (unchanged proprietary logic)
# ─────────────────────────────────────────────────────────────────────────────
class TemporalFusionEngine:
    @staticmethod
    def softmax(x):
        e_x = np.exp(x - np.max(x))
        return e_x / e_x.sum()

    @staticmethod
    def process_fusion(temporal_segments, voice_data, transcript):
        Rv            = voice_data.get("reliability", 0.5)
        voice_emotion = voice_data.get("dominant", "neutral").lower()
        Rt            = 0.8 if len(transcript) > 10 else 0.3

        fusion_log     = []
        conflict_count = 0

        for idx, segment in enumerate(temporal_segments):
            Rf           = segment["reliability_scores"]["Rf_total"]
            face_emotion = segment["face_metrics"]["dominant_emotion"].lower()

            weights    = TemporalFusionEngine.softmax([Rf, Rv, Rt])
            Wf, Wv, Wt = weights[0], weights[1], weights[2]

            resolved_state = face_emotion
            positive_face  = face_emotion in ["happy", "joy"]
            negative_voice = voice_emotion in ["sad", "angry", "fear", "disgust", "anxious"]

            if positive_face and negative_voice:
                conflict_count += 1
                if Wv > Wf:
                    resolved_state = f"{voice_emotion} (Voice overrode Face — Wv:{Wv:.2f})"
                else:
                    resolved_state = f"{face_emotion} (Face validated — Wf:{Wf:.2f})"

            deepface_emotion = segment.get("deepface_emotion", "N/A")
            fusion_log.append(
                f"T{idx+1} [Wf:{Wf:.2f}|Wv:{Wv:.2f}|Wt:{Wt:.2f}]: "
                f"FaceAPI={face_emotion}, DeepFace={deepface_emotion}, Voice={voice_emotion} "
                f"| RESOLVED: {resolved_state} "
                f"| Blinks:{segment['face_metrics']['blinks']} "
                f"| EyeAvoidance:{segment['face_metrics']['eye_avoidance_ratio']}"
            )

        masking_trigger = (
            "HIGH PROBABILITY OF EMOTIONAL MASKING DETECTED"
            if conflict_count > 0 else "CONSISTENT EMOTIONAL PRESENTATION"
        )

        return {
            "fusion_log":      "\n".join(fusion_log) if fusion_log else "No temporal data collected.",
            "masking_trigger": masking_trigger,
        }


# ─────────────────────────────────────────────────────────────────────────────
# HELPER — Extract text from uploaded file
# ─────────────────────────────────────────────────────────────────────────────
def extract_file_text(file_bytes: bytes, filename: str) -> str:
    """Extracts plain text from TXT or PDF files."""
    fname = filename.lower()
    try:
        if fname.endswith(".txt"):
            return file_bytes.decode("utf-8", errors="ignore")[:5000]
        elif fname.endswith(".pdf"):
            reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
            text   = " ".join(page.extract_text() or "" for page in reader.pages)
            return text[:5000]
        else:
            return file_bytes.decode("utf-8", errors="ignore")[:5000]
    except Exception as e:
        logger.warning(f"[extract_file_text] Failed: {e}")
        return ""


# ─────────────────────────────────────────────────────────────────────────────
# HELPER — DeepFace batch analysis on stored frames
# ─────────────────────────────────────────────────────────────────────────────
def _batch_deepface_analyze(frames_b64: list[str]) -> dict:
    """
    Runs DeepFace on a list of base64 JPEG frames.
    Returns aggregated emotion counts and dominant emotion.
    Processes at most MAX_FRAMES_PER_SESSION frames.
    """
    emotion_counts: dict[str, int] = {}
    processed = 0

    for b64 in frames_b64[:MAX_FRAMES_PER_SESSION]:
        try:
            raw = b64.split(",")[1] if "," in b64 else b64
            nparr = np.frombuffer(base64.b64decode(raw), np.uint8)
            img   = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                continue
            # Un-mirror (frontend mirrors for display)
            img = cv2.flip(img, 1)
            analysis = DeepFace.analyze(
                img, actions=["emotion"],
                enforce_detection=False, silent=True,
            )
            dominant = str(analysis[0].get("dominant_emotion", "unknown"))
            emotion_counts[dominant] = emotion_counts.get(dominant, 0) + 1
            processed += 1
        except Exception as e:
            logger.debug(f"[deepface_batch] Frame skipped: {e}")

    dominant_overall = (
        max(emotion_counts, key=emotion_counts.get)
        if emotion_counts else "Unavailable"
    )
    summary = (
        ", ".join(f"{k}: {v}x" for k, v in sorted(emotion_counts.items(), key=lambda x: -x[1]))
        if emotion_counts else "No DeepFace data collected"
    )

    logger.info(f"[deepface_batch] Processed {processed}/{len(frames_b64)} frames. Dominant: {dominant_overall}")
    return {
        "emotion_counts":   emotion_counts,
        "dominant_emotion": dominant_overall,
        "summary":          summary,
        "frames_processed": processed,
    }


# ─────────────────────────────────────────────────────────────────────────────
# ═══════════════════════  API ENDPOINTS  ════════════════════════════════════
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"status": "Horizon API running", "version": "3.0.0"}


# ── 2. Sarvam TTS (direct REST — no SDK WebSocket) ──────────────────────────
@app.post("/api/tts")
async def generate_tts(request: Request):
    """Converts Hindi text to speech via Sarvam AI REST API (bulbul:v3)."""
    data = await request.json()
    text = data.get("text", "")

    if not text.strip():
        raise HTTPException(status_code=400, detail="Text is required.")

    if not SARVAM_API_KEY:
        raise HTTPException(status_code=500, detail="SARVAM_API_KEY not configured.")

    response = requests.post(
        "https://api.sarvam.ai/text-to-speech",
        headers={
            "api-subscription-key": SARVAM_API_KEY,
            "Content-Type":         "application/json",
        },
        json={
            "inputs":               [text],
            "target_language_code": "hi-IN",
            "speaker":              "shubh",
            "model":                "bulbul:v3",
            "pace":                 1.05,
            "enable_preprocessing": True,
        },
        timeout=15,
    )
    if response.status_code != 200:
        logger.error(f"[tts] Sarvam TTS error {response.status_code}: {response.text}")
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()


# ── 3. Sarvam STT (direct REST — no SDK WebSocket) ──────────────────────────
@app.post("/api/stt")
async def speech_to_text(audio: UploadFile = File(...)):
    """
    Transcribes Hindi speech using Sarvam AI REST API (saarika:v2.5).
    Accepts webm/wav audio. Returns transcript string.
    """
    audio_bytes = await audio.read()

    if len(audio_bytes) < 1000:
        return {"transcript": ""}

    if not SARVAM_API_KEY:
        return {"transcript": "", "error": "SARVAM_API_KEY not configured."}

    response = requests.post(
        "https://api.sarvam.ai/speech-to-text",
        headers={"api-subscription-key": SARVAM_API_KEY},
        files={"file": ("speech.webm", audio_bytes, "audio/webm")},
        data={
            "model":           "saarika:v2.5",
            "language_code":   "hi-IN",
            "with_timestamps": "false",
        },
        timeout=12,
    )

    if response.status_code == 200:
        transcript = response.json().get("transcript", "")
        logger.info(f"[stt] Sarvam transcript: '{transcript[:80]}'")
        return {"transcript": transcript}

    logger.error(f"[stt] Sarvam STT error {response.status_code}: {response.text}")
    return {"transcript": "", "error": response.text}


# ── 4. LLM Chat ───────────────────────────────────────────────────────────────
@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest, background_tasks: BackgroundTasks):
    """
    Sends patient message to OpenRouter (meta-llama/llama-3.1-8b-instruct:free).
    Returns Hindi response. Non-blocking relevance validation fires in background.
    """
    reply = generate_chat_response(req.history, req.message)

    # Non-blocking filter — does NOT affect response time
    background_tasks.add_task(validate_response_relevance, req.message, reply)

    return {"reply": reply}


# -----------------------------------------------------------------------------
# 4b. REAL-TIME CONVERSATION PIPELINE  (Server-Sent Events over plain HTTP)
#
# Replaces the old three-round-trip sequence (POST /stt -> POST /chat -> POST
# /tts), where the browser sat idle between each leg and nothing could start
# until the one before it had completely finished.
#
# One POST now carries the audio up and streams every stage back down as it
# becomes ready. Deliberately SSE rather than a WebSocket: this is a strictly
# one-directional server->client push per utterance, so a plain chunked HTTP
# response gives identical latency with no socket lifecycle to manage, no
# reconnect handling, and no interference with the ordinary request flow.
#
# The real win is overlap. The reply is streamed out of the LLM token by token;
# the moment the first *sentence* is complete, its speech synthesis is
# dispatched on a worker thread while the model is still writing the second
# sentence. Audio for sentence one therefore reaches the browser well before
# the reply has finished generating.
#
# Event stream (one JSON object per `data:` line):
#   {"type":"transcript","text":...}         what we heard
#   {"type":"reply","text":...}              the full therapist reply
#   {"type":"audio","index":n,"b64":...}     speech, in order, as it is ready
#   {"type":"done"} | {"type":"error","message":...}
# -----------------------------------------------------------------------------

_tts_pool = ThreadPoolExecutor(max_workers=4)

# Hindi danda plus western sentence enders.
_SENTENCE_END = ("\u0964", "?", "!", ".")


def _sse(obj: dict) -> str:
    """Encode one SSE frame."""
    return "data: " + json.dumps(obj, ensure_ascii=False) + "\n\n"


def _sarvam_tts(text: str, lang: str = "hi-IN") -> str:
    """Synthesise speech in `lang`. Returns base64 WAV, or '' on failure."""
    text = (text or "").strip()
    if not text or not SARVAM_API_KEY:
        return ""
    try:
        r = requests.post(
            "https://api.sarvam.ai/text-to-speech",
            headers={"api-subscription-key": SARVAM_API_KEY,
                     "Content-Type": "application/json"},
            json={
                "inputs":               [text],
                "target_language_code": normalize_lang(lang),
                "speaker":              TTS_SPEAKER,
                "model":                "bulbul:v3",
                "pace":                 1.02,
                "enable_preprocessing": True,
            },
            timeout=15,
        )
        if r.status_code == 200:
            audios = r.json().get("audios") or []
            return audios[0] if audios else ""
        logger.error(f"[tts] HTTP {r.status_code}: {r.text[:160]}")
    except Exception as e:
        logger.error(f"[tts] {e}")
    return ""


def _sarvam_stt(audio_bytes: bytes, lang: str = "hi-IN") -> str:
    """Transcribe speech in `lang`. Returns '' when nothing usable was heard."""
    if len(audio_bytes) < 1000 or not SARVAM_API_KEY:
        return ""
    try:
        r = requests.post(
            "https://api.sarvam.ai/speech-to-text",
            headers={"api-subscription-key": SARVAM_API_KEY},
            files={"file": ("speech.webm", audio_bytes, "audio/webm")},
            data={"model": "saarika:v2.5", "language_code": normalize_lang(lang),
                  "with_timestamps": "false"},
            timeout=12,
        )
        if r.status_code == 200:
            return (r.json().get("transcript") or "").strip()
        logger.error(f"[stt] HTTP {r.status_code}: {r.text[:160]}")
    except Exception as e:
        logger.error(f"[stt] {e}")
    return ""


def _split_ready_sentence(buffer: str):
    """
    Pull the first complete sentence off the front of `buffer`.

    Returns (sentence, remainder), or (None, buffer) when nothing is complete
    yet. Sentences under 12 characters are held back so the first audio clip is
    never a stray fragment.
    """
    for i, ch in enumerate(buffer):
        if ch in _SENTENCE_END:
            sentence = buffer[:i + 1].strip()
            if len(sentence) >= 12:
                return sentence, buffer[i + 1:]
    return None, buffer


def converse_events(chat_history, transcript, lang="hi-IN", mode="therapist", dialect=""):
    """
    The whole therapist turn, as a stream of plain dicts.

    Generation and speech synthesis overlap: each finished sentence is handed to
    TTS on a worker thread while the model is still writing the next one, so the
    first clip is usually ready before the reply is.

    Shared verbatim by the WebSocket session and the HTTP fallback, so both
    transports behave identically and there is only one pipeline to reason about.
    """
    buffer   = ""
    full     = ""
    pending  = []   # (index, Future) in emission order
    spoken   = []   # sentences already dispatched to TTS
    next_idx = 0

    try:
        for delta in stream_chat_response(chat_history, transcript, mode, lang, dialect):
            buffer += delta
            full   += delta

            # Dispatch each finished sentence immediately. Capped at two,
            # matching the reply length the prompt asks for.
            if len(spoken) < 2:
                sentence, buffer = _split_ready_sentence(buffer)
                if sentence:
                    spoken.append(sentence)
                    pending.append((next_idx, _tts_pool.submit(_sarvam_tts, sentence, lang)))
                    next_idx += 1

            # Flush any clip that finished while the model kept writing.
            while pending and pending[0][1].done():
                idx, fut = pending.pop(0)
                b64 = fut.result()
                if b64:
                    yield {"type": "audio", "index": idx, "b64": b64}
    except Exception as e:
        logger.error(f"[converse] generation failed: {e}")

    reply, _recent = finalize_reply(full, chat_history, lang)

    if not reply:
        # The stream produced nothing usable, or an outright repeat. Fall back
        # to the guarded non-streaming path and drop audio already synthesised
        # from the rejected text.
        for _idx, fut in pending:
            fut.cancel()
        reply = generate_chat_response(chat_history, transcript, mode, lang, dialect)
        yield {"type": "reply", "text": reply}
        b64 = _sarvam_tts(reply, lang)
        if b64:
            yield {"type": "audio", "index": 0, "b64": b64}
        return

    yield {"type": "reply", "text": reply}

    for idx, fut in pending:
        try:
            b64 = fut.result(timeout=15)
        except Exception:
            b64 = ""
        if b64:
            yield {"type": "audio", "index": idx, "b64": b64}

    # The sanitiser may have kept text that never formed a complete sentence.
    leftover = reply
    for sent in spoken:
        leftover = leftover.replace(sent, "", 1)
    leftover = leftover.strip()
    if leftover and len(leftover) >= 6:
        b64 = _sarvam_tts(leftover, lang)
        if b64:
            yield {"type": "audio", "index": next_idx, "b64": b64}


# -----------------------------------------------------------------------------
# WEBSOCKET SESSION  --  the primary conversation transport
#
# One socket carries the whole session. That buys three things the per-utterance
# HTTP request could not:
#
#   1. Audio uploads *while the patient is still speaking*. Each MediaRecorder
#      timeslice is sent the moment it exists, so when they stop talking the
#      clip is already on the server and recognition starts immediately. The
#      upload leg leaves the critical path entirely.
#   2. No per-turn connection setup - no TCP/TLS handshake and no CORS preflight
#      on every single utterance.
#   3. Barge-in: a "cancel" arrives mid-reply and the turn is dropped at once.
#
# Protocol
#   client -> server : {"type":"begin_utterance"}  start a fresh recording
#                      binary frames = raw audio chunks for that utterance
#                      {"type":"utterance_end","turn":n}  finish and answer
#                      {"type":"history","history":[...]}  replace context
#                      {"type":"cancel"}   abandon the in-flight turn
#                      {"type":"ping"}
#   server -> client : {"type":"ready"}
#                      {"type":"transcript","text":...}
#                      {"type":"reply","text":...}
#                      {"type":"audio","index":n,"b64":...}
#                      {"type":"turn_end","turn":n}
#                      {"type":"error","message":...} | {"type":"pong"}
#
# Every turn-scoped message carries the turn number it belongs to, so a reply
# the client has already cancelled can never be mistaken for the current one.
# -----------------------------------------------------------------------------

@app.websocket("/ws/session")
async def ws_session(websocket: WebSocket):
    # The browser cannot set headers on a WebSocket handshake, and the HTTP
    # middleware does not run for this scope, so the key is checked here.
    if websocket.query_params.get("key") != API_SECRET_KEY:
        await websocket.close(code=4401, reason="Invalid API key")
        return

    # Which agent, in which language. Fixed for the life of the socket.
    lang    = normalize_lang(websocket.query_params.get("lang"))
    mode    = "consultant" if websocket.query_params.get("mode") == "consultant" else "therapist"
    dialect = normalize_dialect(websocket.query_params.get("dialect"))

    await websocket.accept()
    loop = asyncio.get_running_loop()

    chunks: list[bytes] = []
    history: list       = []
    turn_id             = 0
    active: asyncio.Task | None = None

    await websocket.send_json({"type": "ready"})

    async def run_turn(audio: bytes, my_turn: int, hist: list):
        """Recognise, answer and speak one utterance."""
        try:
            transcript = await asyncio.to_thread(_sarvam_stt, audio, lang)
            if not transcript:
                await websocket.send_json({"type": "transcript", "text": "", "turn": my_turn})
                await websocket.send_json({"type": "turn_end", "turn": my_turn,
                                           "reason": "no_speech"})
                return

            await websocket.send_json({"type": "transcript", "text": transcript,
                                       "turn": my_turn})

            # converse_events is a blocking generator; drain it on a worker
            # thread and hand each event back through an asyncio queue so the
            # event loop stays free and cancellation stays responsive.
            queue: asyncio.Queue = asyncio.Queue()

            def produce():
                try:
                    for ev in converse_events(hist, transcript, lang, mode, dialect):
                        loop.call_soon_threadsafe(queue.put_nowait, ev)
                except Exception as exc:
                    logger.error(f"[ws] turn {my_turn} failed: {exc}")
                finally:
                    loop.call_soon_threadsafe(queue.put_nowait, None)

            loop.run_in_executor(None, produce)

            while True:
                ev = await queue.get()
                if ev is None:
                    break
                ev["turn"] = my_turn
                await websocket.send_json(ev)

            await websocket.send_json({"type": "turn_end", "turn": my_turn})

        except asyncio.CancelledError:
            logger.info(f"[ws] turn {my_turn} cancelled")
            raise
        except Exception as e:
            logger.error(f"[ws] turn {my_turn} error: {e}")
            try:
                await websocket.send_json({"type": "error", "message": str(e),
                                           "turn": my_turn})
                await websocket.send_json({"type": "turn_end", "turn": my_turn})
            except Exception:
                pass

    try:
        while True:
            msg = await websocket.receive()

            if msg["type"] == "websocket.disconnect":
                break

            # ---- binary: one audio chunk of the utterance in progress ----
            if msg.get("bytes") is not None:
                chunks.append(msg["bytes"])
                continue

            raw = msg.get("text")
            if not raw:
                continue
            try:
                data = json.loads(raw)
            except Exception:
                continue

            kind = data.get("type")

            if kind == "ping":
                await websocket.send_json({"type": "pong"})

            elif kind == "history":
                history = data.get("history") or []

            elif kind == "cancel":
                if active and not active.done():
                    active.cancel()
                chunks = []

            elif kind == "begin_utterance":
                # A fresh recording starts here. Drop anything still buffered
                # from a recording the client abandoned (the therapist began
                # speaking, or the session paused), so a partial clip can never
                # be prepended to this one and make it undecodable.
                chunks = []

            elif kind == "utterance_end":
                audio  = b"".join(chunks)
                chunks = []
                if data.get("history") is not None:
                    history = data["history"]

                if active and not active.done():
                    active.cancel()

                # The client supplies the turn id and we echo it on every
                # message of that turn. Keeping a second counter here would
                # drift out of step the first time a turn was cancelled, and
                # the client would then discard every reply as stale.
                turn_id = data.get("turn", turn_id + 1)
                active = asyncio.create_task(run_turn(audio, turn_id, list(history)))

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.warning(f"[ws] session ended: {e}")
    finally:
        if active and not active.done():
            active.cancel()
        logger.info("[ws] session closed")


@app.post("/api/converse")
async def converse_endpoint(
    audio:      UploadFile = File(None),
    text:       str        = Form(""),
    history:    str        = Form("[]"),
    session_id: str        = Form("default"),
    lang:       str        = Form("hi-IN"),
    mode:       str        = Form("therapist"),
    dialect:    str        = Form(""),
):
    """
    HTTP fallback for the WebSocket session, streaming the same turn as
    Server-Sent Events. Used when a socket cannot be established (blocked
    proxy, older browser), so the conversation still works.
    """
    audio_bytes = await audio.read() if audio is not None else b""
    given_text  = (text or "").strip()

    try:
        chat_history = json.loads(history)
    except Exception:
        chat_history = []

    lang    = normalize_lang(lang)
    mode    = "consultant" if mode == "consultant" else "therapist"
    dialect = normalize_dialect(dialect)

    def event_stream():
        transcript = given_text or _sarvam_stt(audio_bytes, lang)
        if not transcript:
            yield _sse({"type": "transcript", "text": ""})
            yield _sse({"type": "done", "reason": "no_speech"})
            return

        yield _sse({"type": "transcript", "text": transcript})
        for ev in converse_events(chat_history, transcript, lang, mode, dialect):
            yield _sse(ev)
        yield _sse({"type": "done"})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":     "no-cache, no-transform",
            "Connection":        "keep-alive",
            "X-Accel-Buffering": "no",   # stop proxies buffering the stream
        },
    )


# -- 4c. Session opening / closing lines (varied text + audio in one trip) -----
@app.post("/api/session-line")
async def session_line_endpoint(request: Request):
    """
    Return a greeting or closing line together with its audio.

    The line comes from a rotating pool rather than being hardcoded in the
    frontend, so two sessions never open with the identical sentence.
    """
    body = await request.json()
    kind = (body.get("kind") or "greeting").lower()
    lang = normalize_lang(body.get("lang"))
    mode = "consultant" if body.get("mode") == "consultant" else "therapist"
    text = (get_closing if kind == "closing" else get_greeting)(mode, lang)
    audio = await asyncio.to_thread(_sarvam_tts, text, lang)
    return {"text": text, "audio": audio}


# -- 4d. Consultant: end-of-session clinical report ---------------------------
@app.post("/api/clinical-report")
async def clinical_report_endpoint(request: Request):
    """
    Everything analytical happens here, once, after the call has ended — the
    conversation itself never waits on it. See clinical_engine.py:
      1. History extraction (local Ollama clinical model), every field tied
         back to the patient's verbatim words.
      2. ATMF-MSI fusion of verbal, behavioural (speech timing) and
         physiological (smartwatch heart rate) channels, turn by turn.
      3. A structured clinical summary for the doctor.
    """
    body = await request.json()
    return await asyncio.to_thread(build_clinical_report, body)


# ── 5. Background relevance validation log endpoint ───────────────────────────
@app.post("/api/validate-response")
async def validate_response_endpoint(req: ValidationRequest, background_tasks: BackgroundTasks):
    """Manually trigger validation check (for testing)."""
    background_tasks.add_task(validate_response_relevance, req.user_message, req.ai_response)
    return {"status": "validation queued"}


# ── 6. DEFERRED frame storage (replaces live /api/analyze-frame) ──────────────
@app.post("/api/store-frame")
async def store_frame_endpoint(req: FrameStoreRequest):
    """
    Stores a webcam frame in memory for batch DeepFace analysis at session end.
    Does NOT run DeepFace here — zero ML latency during the session.
    """
    bucket = _frame_store[req.session_id]
    if len(bucket) < MAX_FRAMES_PER_SESSION:
        bucket.append(req.image_base64)
        return {"stored": len(bucket), "max": MAX_FRAMES_PER_SESSION}
    return {"stored": len(bucket), "max": MAX_FRAMES_PER_SESSION, "note": "cap reached"}


# ── 6b. Legacy analyze-frame (kept for compatibility, wraps store-frame) ──────
@app.post("/api/analyze-frame")
async def analyze_frame_endpoint(request: Request):
    """
    LEGACY: Now acts as a lightweight frame store only.
    DeepFace is deferred to /api/analyze-report for zero session latency.
    """
    try:
        body = await request.json()
        b64  = body.get("image_base64", "")
        sid  = body.get("session_id", "default")
        if b64:
            bucket = _frame_store[sid]
            if len(bucket) < MAX_FRAMES_PER_SESSION:
                bucket.append(b64)
        return {"dominant_emotion": "Deferred", "emotions": {}, "raw_scores": {}, "note": "Frame stored for end-of-session analysis"}
    except Exception as e:
        return {"dominant_emotion": "Unknown", "emotions": {}, "raw_scores": {}, "error": str(e)}


# ── 7. Full session report analysis (DeepFace batch runs HERE) ────────────────
@app.post("/api/analyze-report")
async def analyze_report_endpoint(
    audio:           UploadFile = File(...),
    transcript:      str        = Form(...),
    face_data:       str        = Form(...),
    previous_report: str        = Form(""),
    session_id:      str        = Form("default"),
    captured_frames: str        = Form("[]"),   # JSON array of base64 frames from frontend
):
    """
    Full ATMF-MSI pipeline (ALL ML runs here, not during session):
      1. Batch DeepFace on captured frames (stored in-memory + any sent directly)
      2. Wav2Vec2 vocal analysis
      3. ATMF-MSI temporal fusion
      4. OpenRouter LLM generates English clinical report
    """
    # ── 1. Collect all frames: in-memory store + any sent directly ──
    stored_frames   = _frame_store.pop(session_id, [])
    try:
        direct_frames = json.loads(captured_frames)
    except Exception:
        direct_frames = []

    all_frames = stored_frames + direct_frames
    logger.info(f"[analyze-report] Total frames for DeepFace: {len(all_frames)} (stored={len(stored_frames)}, direct={len(direct_frames)})")

    # ── 2. Batch DeepFace analysis ──
    deepface_result = _batch_deepface_analyze(all_frames) if all_frames else {
        "emotion_counts":   {},
        "dominant_emotion": "Unavailable",
        "summary":          "No frames captured for DeepFace analysis.",
        "frames_processed": 0,
    }

    # ── 3. Parse ATMF-MSI payload ──
    try:
        parsed_data       = json.loads(face_data)
        legacy_summary    = parsed_data.get("legacy_summary", face_data)
        temporal_segments = parsed_data.get("temporal_segments", [])
    except Exception:
        legacy_summary    = face_data
        temporal_segments = []

    # Inject batch DeepFace results into temporal segments
    # (fills in deepface_emotion for each segment proportionally)
    if temporal_segments and deepface_result["emotion_counts"]:
        dominant_df = deepface_result["dominant_emotion"]
        for seg in temporal_segments:
            if seg.get("deepface_emotion") in [None, "N/A", "Unavailable", ""]:
                seg["deepface_emotion"] = dominant_df

    # ── 4. Vocal analysis ──
    audio_bytes = await audio.read()
    if len(audio_bytes) > 1000:
        voice_data = analyze_audio_emotion(audio_bytes)
        if isinstance(voice_data, str):
            voice_data = {"analysis": voice_data, "reliability": 0.5, "dominant": "neutral"}
    else:
        voice_data = {"analysis": "No audio captured.", "reliability": 0.0, "dominant": "neutral"}

    # ── 5. ATMF-MSI fusion ──
    fusion_results = TemporalFusionEngine.process_fusion(
        temporal_segments, voice_data, transcript
    )

    # ── 6. Build grounded clinical context ──
    clinical_context = (
        f"--- ATMF-MSI ENGINE RESULTS ---\n"
        f"Legacy Summary: {legacy_summary}\n"
        f"DeepFace Batch Analysis ({deepface_result['frames_processed']} frames): {deepface_result['summary']}\n"
        f"Dominant DeepFace Emotion: {deepface_result['dominant_emotion']}\n"
        f"Emotional Masking Assessment: {fusion_results['masking_trigger']}\n\n"
        f"Chronological Temporal Log (10-second slices):\n"
        f"{fusion_results['fusion_log']}"
    )

    # ── 7. Generate English clinical report ──
    report = generate_medical_report(
        transcript=transcript,
        face_data=clinical_context,
        voice_data=voice_data["analysis"],
        previous_report=previous_report,
    )

    return {
        "voice_emotion":     voice_data["analysis"],
        "fusion_log":        fusion_results["fusion_log"],
        "masking_detection": fusion_results["masking_trigger"],
        "report":            report,
        "deepface_summary":  deepface_result["summary"],
        "frames_processed":  deepface_result["frames_processed"],
    }


# ── 8. Save session to Neon DB ───────────────────────────────────────────────
@app.post("/api/sessions")
async def save_session(request: Request):
    """
    Saves the completed session + report to Neon PostgreSQL.
    """
    if not DB_AVAILABLE:
        return {"status": "DB unavailable — session not persisted"}

    body = await request.json()
    try:
        session_row = create_session(
            user_id          = "anonymous_user",
            duration_seconds = body.get("durationSeconds", 0),
            transcript       = body.get("transcript", ""),
            fusion_log       = body.get("fusionLog", ""),
            masking_detection= body.get("maskingDetection", ""),
            voice_emotion    = body.get("voiceEmotion", ""),
            blink_count      = body.get("blinkCount", 0),
            eye_contact      = body.get("eyeContact", ""),
        )
        if body.get("report"):
            create_report(
                session_id         = session_row["id"],
                full_report_text   = body["report"],
                face_emotions      = body.get("faceEmotions", {}),
                deep_face_emotions = body.get("deepFaceEmotions", {}),
                temporal_segments  = body.get("temporalSegments", []),
            )
        return {"status": "saved", "sessionId": session_row["id"]}
    except Exception as e:
        logger.error(f"[save_session] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── 9. Get past sessions for a user ──────────────────────────────────────────
@app.get("/api/sessions")
async def get_user_sessions():
    """Returns the last 20 sessions."""
    if not DB_AVAILABLE:
        return {"sessions": []}
    try:
        rows = get_sessions_for_user("anonymous_user", limit=20)
        # Convert datetime objects to ISO strings for JSON serialization
        for row in rows:
            for k, v in row.items():
                if hasattr(v, "isoformat"):
                    row[k] = v.isoformat()
        return {"sessions": rows}
    except Exception as e:
        logger.error(f"[get_sessions] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn, socket, subprocess, sys

    PORT = 8000

    # Auto-kill any existing process holding our port so restarts never conflict
    def _free_port(port: int) -> None:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", port)) != 0:
                return  # port is already free
        logger.info(f"[startup] Port {port} in use — killing existing process...")
        if sys.platform == "win32":
            result = subprocess.run(
                ["netstat", "-ano"], capture_output=True, text=True
            )
            for line in result.stdout.splitlines():
                if f":{port}" in line and "LISTENING" in line:
                    parts = line.split()
                    pid = parts[-1]
                    subprocess.run(["taskkill", "/F", "/PID", pid],
                                   capture_output=True)
                    logger.info(f"[startup] Killed PID {pid} on port {port}")
        else:
            subprocess.run(["fuser", "-k", f"{port}/tcp"], capture_output=True)

    _free_port(PORT)
    uvicorn.run(app, host="0.0.0.0", port=PORT, reload=False)