import os, sys, io, warnings, subprocess, tempfile

# ── Suppress TF / oneDNN startup noise before any heavy imports ───────────────
os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS",  "0")
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL",    "3")
warnings.filterwarnings("ignore", category=DeprecationWarning)
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)

# ── Stub out removed audioop for pydub compatibility on Python 3.13 ───────────
# audioop was removed in Python 3.13; this stub prevents ImportError on import
if sys.version_info >= (3, 13):
    import types
    _audioop_stub = types.ModuleType("audioop")
    sys.modules.setdefault("audioop",    _audioop_stub)
    sys.modules.setdefault("pyaudioop", _audioop_stub)

import logging
import numpy as np

# ── Patch for Windows Application Control blocking sklearn DLLs ─────────
import sys
import types
if "sklearn.metrics" not in sys.modules:
    dummy = types.ModuleType("sklearn.metrics")
    dummy.roc_curve = lambda *args, **kwargs: None
    sys.modules["sklearn.metrics"] = dummy
# ────────────────────────────────────────────────────────────────────────

import librosa
import torch
from transformers import pipeline

# Configure standard production logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

logger.info("Loading Clinical Voice Emotion Model... (This will take a moment on the first run)")

# Automatically use GPU if available to prevent server bottlenecking
device = 0 if torch.cuda.is_available() else -1

emotion_classifier = pipeline(
    "audio-classification",
    model="ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition",
    device=device
)


# ── WebM → WAV converter (pydub-free, Python 3.13 safe) ──────────────────────
def _webm_to_wav_bytes(audio_bytes: bytes) -> io.BytesIO:
    """
    Converts WebM audio bytes to WAV (16kHz mono) without pydub.
    Strategy 1: ffmpeg subprocess (fastest, most reliable)
    Strategy 2: soundfile + librosa direct load (fallback)
    Strategy 3: librosa direct load with audioread backend
    """
    # ── Strategy 1: ffmpeg ──
    try:
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f_in:
            f_in.write(audio_bytes)
            in_path = f_in.name

        out_path = in_path.replace(".webm", ".wav")
        result = subprocess.run(
            ["ffmpeg", "-y", "-i", in_path, "-ac", "1", "-ar", "16000",
             "-f", "wav", out_path],
            capture_output=True, timeout=30
        )
        if result.returncode == 0:
            with open(out_path, "rb") as f:
                wav_bytes = f.read()
            os.unlink(in_path)
            os.unlink(out_path)
            return io.BytesIO(wav_bytes)
        os.unlink(in_path)
        if os.path.exists(out_path):
            os.unlink(out_path)
    except (FileNotFoundError, subprocess.TimeoutExpired, Exception) as e:
        logger.debug(f"[audio] ffmpeg strategy failed: {e}")

    # ── Strategy 2: soundfile direct ──
    try:
        import soundfile as sf
        data, sr = sf.read(io.BytesIO(audio_bytes), dtype="float32", always_2d=False)
        if len(data.shape) > 1:
            data = data.mean(axis=1)   # stereo → mono
        wav_io = io.BytesIO()
        sf.write(wav_io, data, sr, format="WAV", subtype="PCM_16")
        wav_io.seek(0)
        return wav_io
    except Exception as e:
        logger.debug(f"[audio] soundfile strategy failed: {e}")

    # ── Strategy 3: librosa with audioread ──
    speech, sr = librosa.load(io.BytesIO(audio_bytes), sr=16000, mono=True)
    wav_io = io.BytesIO()
    import soundfile as sf
    sf.write(wav_io, speech, sr, format="WAV", subtype="PCM_16")
    wav_io.seek(0)
    return wav_io


# ── ATMF-MSI STEP 3: Voice Reliability Rv(t) ─────────────────────────────────
def calculate_voice_reliability(speech: np.ndarray, rate: int) -> float:
    """
    Calculates an advanced Signal-to-Noise Ratio (SNR) proxy to determine acoustic reliability.
    Includes safeguards for completely silent or highly distorted audio.
    """
    try:
        rms = librosa.feature.rms(y=speech)[0]
        if len(rms) < 10:
            return 0.1

        noise_floor  = np.percentile(rms, 10)
        signal_level = np.percentile(rms, 90)

        if noise_floor <= 1e-6:
            noise_floor = 1e-6

        if signal_level <= noise_floor * 1.1:
            return 0.1

        snr = 20 * np.log10(signal_level / noise_floor)
        reliability = np.clip((snr - 5.0) / 25.0, 0.1, 1.0)
        return float(reliability)

    except Exception as e:
        logger.warning(f"Voice reliability calculation failed: {e}")
        return 0.3


def analyze_audio_emotion(audio_bytes: bytes) -> dict:
    """
    Processes raw webm audio bytes into clinical paralinguistic metrics and emotional states.
    Returns a dictionary formatted for the ATMF-MSI engine.
    Python 3.13 safe — no pydub/audioop dependency.
    """
    try:
        # 1. Decode webm → wav using pydub-free converter
        wav_io = _webm_to_wav_bytes(audio_bytes)

        # 2. Load with Librosa at 16kHz mono
        speech, rate = librosa.load(wav_io, sr=16000, mono=True)
        duration = librosa.get_duration(y=speech, sr=rate)

        if duration < 1.0:
            return {
                "analysis":   "Audio segment too short for clinical acoustic analysis (< 1s).",
                "reliability": 0.0,
                "dominant":    "neutral"
            }

        # ==========================================================
        # PART A: Wav2Vec2 Deep Emotion Classification
        # ==========================================================
        results = emotion_classifier(speech)

        top_emotions = [f"{r['label'].capitalize()} ({round(r['score']*100)}%)" for r in results[:2]]
        emotion_str  = ", ".join(top_emotions)
        top_emotion  = results[0]['label'].lower() if results else "neutral"

        # ==========================================================
        # PART B: Advanced Acoustic Paralinguistics (Prosody & Rhythm)
        # ==========================================================
        notes = []

        # 1. Speech Rhythm (Syllables per second)
        onset_env   = librosa.onset.onset_strength(y=speech, sr=rate)
        peaks       = librosa.util.peak_pick(onset_env, pre_max=3, post_max=3,
                                              pre_avg=3, post_avg=5, delta=0.5, wait=10)
        speech_rate = len(peaks) / duration

        if speech_rate < 2.0:
            notes.append(f"Significantly reduced speech rate ({speech_rate:.1f} syl/sec) "
                         "indicating potential psychomotor retardation or high cognitive load.")
        elif speech_rate > 5.5:
            notes.append(f"Rapid, pressured speech rate ({speech_rate:.1f} syl/sec) "
                         "correlating with hyper-arousal or anxiety markers.")
        else:
            notes.append(f"Normal conversational speech rhythm ({speech_rate:.1f} syl/sec).")

        # 2. Pitch Variance (Affect flattening)
        f0, _, _  = librosa.pyin(speech, fmin=65, fmax=300, sr=rate)
        valid_f0  = f0[~np.isnan(f0)]
        pitch_std = np.std(valid_f0) if len(valid_f0) > 0 else 0

        if len(valid_f0) < (rate * 0.1 * duration):
            notes.append("High volume of pauses or prolonged silences detected.")
        elif pitch_std < 15.0:
            notes.append(f"Restricted pitch variance (StdDev: {pitch_std:.1f} Hz) "
                         "indicating blunted or flat affect.")
        elif pitch_std > 45.0:
            notes.append(f"Highly variable pitch (StdDev: {pitch_std:.1f} Hz) "
                         "indicating heightened emotional volatility.")
        else:
            notes.append("Expressive and standard intonation variance.")

        # ==========================================================
        # PART C: Voice Reliability Scoring (ATMF-MSI)
        # ==========================================================
        Rv = calculate_voice_reliability(speech, rate)

        return {
            "analysis":   f"Vocal Emotion Profile: {emotion_str}\n"
                          f"Clinical Acoustic Prosody: {' '.join(notes)}",
            "reliability": Rv,
            "dominant":    top_emotion,
        }

    except Exception as e:
        logger.error(f"Clinical Audio Processing Failure: {str(e)}")
        return {
            "analysis":   "Acoustic data corrupted or unreadable due to severe noise/interference.",
            "reliability": 0.0,
            "dominant":    "neutral",
        }