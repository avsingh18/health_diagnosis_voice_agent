# -*- coding: utf-8 -*-
"""
clinical_engine.py — end-of-session analysis for the "Meet the Consultant" agent.

Nothing here runs during the call. The conversation stays fast and human; once
it ends, the whole session is handed over in one request and three things
happen:

1. HISTORY EXTRACTION — the local clinical model (Ollama, `horizon-clinical`)
   turns the patient's words into a structured history. Every field must carry
   the patient's exact words, and `link_quotes` then proves it: each quote is
   located in a real patient utterance (exact, or a close span that replaces the
   model's paraphrase). A field whose words cannot be found is kept but flagged,
   so the clinician never mistakes a model inference for something said.

       Patient: "Teen din se pet mein jalan hai, raat ko zyada hoti hai,
                 aur chakkar bhi aate hain."
       → Complaint  : Burning, abdomen  — "pet mein jalan"
       → Duration   : 3 days            — "teen din se"
       → Pattern    : Worse at night    — "raat ko zyada"
       → Associated : Dizziness         — "chakkar aate hain"

2. ATMF-MSI FUSION — the same reliability-weighted fusion the therapist uses
   for face/voice, applied per patient turn to three channels:
     verbal         symptom and distress language, clinical density of the turn
     behavioural    response latency and speaking rate (from the voice loop)
     physiological  heart-rate change from the patient's own baseline, measured
                    by the smartwatch while that turn was spoken
   Each channel's weight comes from a softmax over its reliability, so a missing
   watch or an unreliable turn simply drops out instead of skewing the result.
   Incongruence — "theek hoon" said while heart rate is climbing — is flagged as
   possible under-reporting, the consultation analogue of emotional masking.

3. SUMMARY — HPI, considerations, red flags and recommendations for the doctor,
   in English.
"""
import os
import re
import json
import time
import difflib
import logging
import statistics

import numpy as np
import requests

from languages import language_name, normalize_lang, DIALECTS, normalize_dialect

logger = logging.getLogger(__name__)

OLLAMA_URL          = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_REPORT_MODEL = os.getenv("OLLAMA_REPORT_MODEL", "horizon-clinical")
OLLAMA_FALLBACKS    = ["horizon-clinical", "llama3"]
OLLAMA_TIMEOUT      = int(os.getenv("OLLAMA_TIMEOUT", "300"))

SARVAM_CHAT_URL     = "https://api.sarvam.ai/v1/chat/completions"
SARVAM_REPORT_MODEL = os.getenv("SARVAM_REPORT_MODEL", os.getenv("SARVAM_CHAT_MODEL", "sarvam-105b-conversations"))

HISTORY_FIELDS = [
    "Complaint", "Location", "Duration", "Onset", "Character", "Severity",
    "Pattern", "Aggravating", "Relieving", "Associated", "Past history",
    "Medication", "Allergies", "Family history", "Lifestyle", "Sleep",
    "Appetite", "Psychosocial",
]

EXTRACTION_PROMPT = f"""You are Horizon Clinical, a clinical documentation model used by doctors in India.
You receive the transcript of a voice intake call between an assistant (A) and a patient (P1, P2, ...).
The patient may speak Hindi, Marwari, English, Marathi, Gujarati or Punjabi, in native script or romanised.

Return ONE JSON object and nothing else, with exactly these keys:
{{
  "history": [
    {{"field": one of {HISTORY_FIELDS},
      "value": "concise English clinical phrasing",
      "quote": "the patient's EXACT words, copied character for character from one P line, in its original script",
      "quote_en": "literal English meaning of the quote",
      "turn": the number of the P line the quote is from}}
  ],
  "summary": "History of presenting illness in 2-4 English sentences, clinical register",
  "impression": ["clinical considerations for the doctor, hedged ('consider', 'rule out'), never a final diagnosis"],
  "red_flags": ["danger signs actually reported, empty list if none"],
  "recommendations": ["next steps for the doctor or patient"],
  "triage": "routine" | "soon" | "urgent"
}}

STRICT RULES
1. Use ONLY what the patient said. Nothing from the assistant's lines, nothing invented.
2. Every history item must have a quote that appears verbatim in a P line. Keep quotes short (2-8 words).
3. One fact per item. Several associated symptoms = several "Associated" items.
4. If something was not discussed, leave it out. Do not write "not mentioned".
5. "red_flags" is ONLY for true danger signs: chest pain or pressure, breathlessness, fainting,
   blood in vomit/stool/urine/cough, sudden weakness or numbness, worst-ever headache, fever with
   stiff neck, seizures, bleeding in pregnancy, thoughts of self-harm. Ordinary symptoms are not red flags.
6. Medicines taken (or "none") go in "Medication"; allergies in "Allergies"; earlier illnesses in "Past history".
7. Quotes keep the transcript's script: a Devanagari P line is quoted in Devanagari, never romanised.

EXAMPLE
P1: Teen din se pet mein jalan hai, raat ko zyada hoti hai, aur chakkar bhi aate hain.
→ "history": [
  {{"field":"Complaint","value":"Burning sensation, abdomen","quote":"pet mein jalan","quote_en":"burning in the stomach","turn":1}},
  {{"field":"Duration","value":"3 days","quote":"Teen din se","quote_en":"for three days","turn":1}},
  {{"field":"Pattern","value":"Worse at night","quote":"raat ko zyada","quote_en":"more at night","turn":1}},
  {{"field":"Associated","value":"Dizziness","quote":"chakkar bhi aate hain","quote_en":"also getting dizzy spells","turn":1}}
]
The same line transcribed in Devanagari is quoted in Devanagari:
P1: तीन दिन से पेट में जलन है
→ {{"field":"Complaint","value":"Burning sensation, abdomen","quote":"पेट में जलन","quote_en":"burning in the stomach","turn":1}}"""

# ─────────────────────────────────────────────────────────────────────────────
# Lexicons for the verbal channel (five languages + romanised Hindi/Marwari)
# ─────────────────────────────────────────────────────────────────────────────
DISTRESS_TERMS = [
    # Hindi / Marwari (Devanagari + romanised)
    "दर्द", "जलन", "चक्कर", "उल्टी", "बुखार", "घबराहट", "डर", "परेशान", "सांस", "साँस",
    "तेज़", "तेज", "बहुत", "नींद नहीं", "कमज़ोरी", "कमजोरी", "सूजन", "खून",
    "dard", "jalan", "chakkar", "ulti", "bukhar", "ghabrahat", "pareshan", "saans",
    "bahut", "kamzori", "sujan", "khoon", "dukhe", "dukhta",
    # English
    "pain", "burning", "dizzy", "vomit", "fever", "anxious", "scared", "worried",
    "breath", "severe", "worse", "can't sleep", "weak", "swelling", "blood",
    # Marathi
    "दुखत", "त्रास", "ताप", "भीती", "थकवा",
    # Gujarati
    "દુખાવો", "દુખે", "તાવ", "ચક્કર", "બળતરા", "ઉલટી", "ગભરામણ",
    # Punjabi
    "ਦਰਦ", "ਬੁਖਾਰ", "ਚੱਕਰ", "ਜਲਨ", "ਪਰੇਸ਼ਾਨ", "ਉਲਟੀ", "ਘਬਰਾਹਟ",
]
MINIMISING_TERMS = [
    "ठीक हूँ", "ठीक हूं", "ठीक है", "कुछ नहीं", "थोड़ा सा", "ज़्यादा नहीं",
    "theek hoon", "thik hu", "kuch nahi", "thoda sa", "zyada nahi",
    "i'm fine", "i am fine", "nothing much", "not much", "just a little", "it's okay",
    "बरं आहे", "काही नाही", "ઠીક છું", "કંઈ નથી", "ਠੀਕ ਹਾਂ", "ਕੁਝ ਨਹੀਂ",
]

_PUNCT = re.compile(r"[।॥,.!?;:\"'“”‘’()\[\]\-–—…]")


def _norm(text: str) -> str:
    # \w would drop Indic vowel signs (they are combining marks), so strip
    # punctuation explicitly rather than keeping "word" characters.
    return re.sub(r"\s+", " ", _PUNCT.sub(" ", (text or "").lower())).strip()


# Rough Devanagari → Latin, only for *matching*: models often answer a
# Devanagari transcript with a romanised quote ("pet mein jalan" for
# "पेट में जलन"). The quote shown to the clinician is always the original span.
_DEV_VOWELS = {"अ": "a", "आ": "aa", "इ": "i", "ई": "ee", "उ": "u", "ऊ": "oo", "ऋ": "ri",
               "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au"}
_DEV_MATRAS = {"ा": "a", "ि": "i", "ी": "ee", "ु": "u", "ू": "oo", "ृ": "ri",
               "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ॅ": "e", "ॉ": "o"}
_DEV_CONS = dict(zip(
    "कखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसहळ",
    ["k", "kh", "g", "gh", "n", "ch", "chh", "j", "jh", "n", "t", "th", "d", "dh", "n",
     "t", "th", "d", "dh", "n", "p", "ph", "b", "bh", "m", "y", "r", "l", "v", "sh",
     "sh", "s", "h", "l"]))


def _romanise(word: str) -> str:
    out, i = [], 0
    while i < len(word):
        ch = word[i]
        if ch in _DEV_CONS:
            out.append(_DEV_CONS[ch])
            nxt = word[i + 1] if i + 1 < len(word) else ""
            if nxt == "़":
                i += 1
                nxt = word[i + 1] if i + 1 < len(word) else ""
            if nxt in _DEV_MATRAS:
                out.append(_DEV_MATRAS[nxt]); i += 1
            elif nxt == "्":
                i += 1
            elif nxt and nxt not in "ंँः":
                out.append("a")
            elif nxt in "ंँ":
                out.append("a")
        elif ch in _DEV_VOWELS:
            out.append(_DEV_VOWELS[ch])
        elif ch in "ंँ":
            out.append("n")
        elif ch in _DEV_MATRAS:
            out.append(_DEV_MATRAS[ch])
        elif ch not in "़्ः":
            out.append(ch)
        i += 1
    r = "".join(out)
    return r[:-1] if len(r) > 2 and r.endswith("a") and not r.endswith("aa") else r


def _is_latin(text: str) -> bool:
    return bool(re.search(r"[a-z]", text)) and text.isascii()


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, float(x)))


# ─────────────────────────────────────────────────────────────────────────────
# 1. HISTORY EXTRACTION
# ─────────────────────────────────────────────────────────────────────────────
def _transcript_for_model(turns):
    lines, n = [], 0
    for t in turns:
        if t["role"] == "user":
            n += 1
            lines.append(f"P{n}: {t['text']}")
        else:
            lines.append(f"A: {t['text']}")
    return "\n".join(lines)


def _parse_json(text: str):
    if not text:
        return None
    text = re.sub(r"```(?:json)?", "", text)
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        return json.loads(text[start:end + 1])
    except json.JSONDecodeError:
        return None


def _ollama_models():
    try:
        r = requests.get(f"{OLLAMA_URL}/api/tags", timeout=3)
        if r.status_code == 200:
            return [m.get("name", "").split(":")[0] for m in r.json().get("models", [])]
    except Exception:
        pass
    return []


def _ask_ollama(user_content: str):
    available = _ollama_models()
    candidates = [m for m in [OLLAMA_REPORT_MODEL, *OLLAMA_FALLBACKS] if m in available]
    for model in dict.fromkeys(candidates):
        try:
            r = requests.post(
                f"{OLLAMA_URL}/api/chat",
                json={
                    "model": model, "stream": False, "format": "json",
                    "messages": [{"role": "system", "content": EXTRACTION_PROMPT},
                                 {"role": "user", "content": user_content}],
                    "options": {"temperature": 0.1, "num_ctx": 6144, "num_predict": 1200},
                },
                timeout=OLLAMA_TIMEOUT,
            )
            if r.status_code == 200:
                parsed = _parse_json(r.json().get("message", {}).get("content", ""))
                if parsed:
                    return parsed, model
            logger.warning(f"[clinical] ollama {model} HTTP {r.status_code}")
        except Exception as e:
            logger.warning(f"[clinical] ollama {model}: {e}")
    return None, None


def _ask_sarvam(user_content: str):
    key = os.getenv("SARVAM_API_KEY", "")
    if not key:
        return None, None
    try:
        r = requests.post(
            SARVAM_CHAT_URL,
            headers={"api-subscription-key": key, "Content-Type": "application/json"},
            json={"model": SARVAM_REPORT_MODEL, "temperature": 0.1, "max_tokens": 1600,
                  "messages": [{"role": "system", "content": EXTRACTION_PROMPT},
                               {"role": "user", "content": user_content}]},
            timeout=90,
        )
        if r.status_code == 200:
            content = r.json().get("choices", [{}])[0].get("message", {}).get("content", "")
            content = re.sub(r"<think>.*?</think>", "", content or "", flags=re.DOTALL)
            parsed = _parse_json(content)
            if parsed:
                return parsed, SARVAM_REPORT_MODEL
        logger.warning(f"[clinical] sarvam HTTP {r.status_code}: {r.text[:200]}")
    except Exception as e:
        logger.warning(f"[clinical] sarvam: {e}")
    return None, None


def link_quotes(history, patient_texts):
    """
    Pin every history field to the patient's actual words.

    match = "exact"    quote found verbatim in a patient turn
            "close"    a near-identical span was found; the quote is replaced
                       with the patient's real words
            "unlinked" not found — kept, but shown as unverified
    """
    normed = [_norm(t) for t in patient_texts]
    out = []
    for item in history or []:
        if not isinstance(item, dict):
            continue
        quote = str(item.get("quote") or "").strip()
        value = str(item.get("value") or "").strip()
        field = str(item.get("field") or "").strip() or "Note"
        if not value:
            continue
        hint = item.get("turn")
        try:
            hint = int(hint) - 1
        except (TypeError, ValueError):
            hint = None

        nq = _norm(quote)
        match, turn, best_span = "unlinked", None, quote

        if nq:
            order = list(range(len(normed)))
            if hint is not None and 0 <= hint < len(normed):
                order.remove(hint)
                order.insert(0, hint)
            for i in order:
                if nq in normed[i]:
                    match, turn = "exact", i
                    break
            if match == "unlinked":
                q_words = nq.split()
                latin_quote = _is_latin(nq)
                best = (0.0, None, None)
                for i, text in enumerate(patient_texts):
                    words = text.split()
                    nwords = _norm(text).split()
                    if latin_quote and not _is_latin(normed[i]):
                        nwords = [_romanise(w) for w in nwords]
                    for size in {max(1, len(q_words) - 1), len(q_words), len(q_words) + 1}:
                        for s in range(0, max(1, len(nwords) - size + 1)):
                            cand = " ".join(nwords[s:s + size])
                            ratio = difflib.SequenceMatcher(None, nq, cand).ratio()
                            if ratio > best[0]:
                                # Same index range in the original (unnormalised)
                                # words, so the span keeps the patient's script.
                                span = " ".join(words[s:s + size]) if len(words) == len(nwords) else cand
                                best = (ratio, i, span)
                if best[0] >= (0.66 if latin_quote else 0.72):
                    match, turn, best_span = "close", best[1], best[2]

        out.append({
            "field":    field,
            "value":    value,
            "quote":    (best_span if match == "close" else quote).strip(" .,;:!?।\"'"),
            "quote_en": str(item.get("quote_en") or "").strip(),
            "turn":     turn,      # index into the patient's utterances
            "match":    match,
        })
    return out


# ─────────────────────────────────────────────────────────────────────────────
# 2. ATMF-MSI FUSION (verbal · behavioural · physiological)
# ─────────────────────────────────────────────────────────────────────────────
def _softmax_masked(scores):
    """Softmax over reliabilities; a channel with reliability 0 gets weight 0."""
    live = [i for i, s in enumerate(scores) if s > 0]
    w = [0.0] * len(scores)
    if not live:
        return w
    x = np.array([scores[i] for i in live]) * 3.0   # sharpen: favour reliable channels
    e = np.exp(x - x.max())
    e = e / e.sum()
    for k, i in enumerate(live):
        w[i] = float(e[k])
    return w


def summarise_heart_rate(samples):
    bpm = [float(s["bpm"]) for s in samples if s.get("bpm")]
    if not bpm:
        return None
    first_minute = [float(s["bpm"]) for s in samples if s.get("bpm") and s.get("t", 0) <= 60000]
    baseline = statistics.median(first_minute if len(first_minute) >= 5 else bpm)
    diffs = [abs(b - a) for a, b in zip(bpm, bpm[1:])]
    return {
        "samples":       len(bpm),
        "baseline":      round(baseline, 1),
        "mean":          round(statistics.fmean(bpm), 1),
        "min":           round(min(bpm)),
        "max":           round(max(bpm)),
        "sd":            round(statistics.pstdev(bpm), 1),
        "beat_to_beat_variation": round(statistics.fmean(diffs), 2) if diffs else 0.0,
        "pct_above_100": round(100 * sum(b > 100 for b in bpm) / len(bpm), 1),
        "tachycardia":   max(bpm) > 100,
        "bradycardia":   min(bpm) < 50,
    }


def fuse_session(turns, hr_samples, hr_source, history):
    hr_summary = summarise_heart_rate(hr_samples)
    baseline = hr_summary["baseline"] if hr_summary else None
    phys_rel = {"boult": 0.9, "bluetooth": 0.9, "simulated": 0.5}.get(hr_source, 0.0)

    fields_per_turn = {}
    for h in history:
        if h.get("turn") is not None:
            fields_per_turn[h["turn"]] = fields_per_turn.get(h["turn"], 0) + 1

    log, flags, segments = [], [], []
    patient_idx = -1
    for t in turns:
        if t["role"] != "user":
            continue
        patient_idx += 1
        text = t["text"]
        low = text.lower()
        meta = t.get("meta") or {}
        t_end = meta.get("end", t.get("t", 0))
        t_speech = meta.get("speechStart", t_end - 6000)

        # Verbal
        distress = sum(1 for w in DISTRESS_TERMS if w in low)
        minimising = any(w in low for w in MINIMISING_TERMS)
        density = fields_per_turn.get(patient_idx, 0)
        verbal = _clamp01(0.22 * distress + 0.15 * density)
        n_words = len(text.split())
        Rt = 0.85 if n_words >= 5 else 0.45

        # Behavioural
        latency = None
        behav, Rb = 0.0, 0.0
        if meta.get("listenStart") is not None and meta.get("speechStart") is not None:
            latency = max(0.0, (meta["speechStart"] - meta["listenStart"]) / 1000)
            dur = max(0.5, (t_end - meta["speechStart"]) / 1000)
            rate = n_words / dur
            hesitation = _clamp01((latency - 1.5) / 5)
            slow = _clamp01((1.6 - rate) / 1.6)
            behav = _clamp01(0.6 * hesitation + 0.4 * slow)
            Rb = 0.7
        else:
            rate = None

        # Physiological
        window = [float(s["bpm"]) for s in hr_samples
                  if s.get("bpm") and t_speech - 2000 <= s.get("t", -1) <= t_end + 3000]
        hr_mean = statistics.fmean(window) if window else None
        d_hr = (hr_mean - baseline) if (hr_mean is not None and baseline) else None
        phys = _clamp01((d_hr or 0) / 20)
        Rp = phys_rel if window else 0.0

        Wt, Wb, Wp = _softmax_masked([Rt, Rb, Rp])
        arousal = Wt * verbal + Wb * behav + Wp * phys

        turn_flags = []
        if d_hr is not None and d_hr >= 8 and verbal >= 0.2:
            turn_flags.append("Physiological arousal while describing symptoms")
        if d_hr is not None and d_hr >= 8 and minimising:
            turn_flags.append("Minimising language with raised heart rate — possible under-reporting")
        if latency is not None and latency > 5:
            turn_flags.append("Delayed response")
        for f in turn_flags:
            flags.append({"turn": patient_idx, "flag": f, "quote": text[:120]})

        segments.append({
            "turn": patient_idx, "t": t_end,
            "verbal": round(verbal, 2), "behavioural": round(behav, 2), "physiological": round(phys, 2),
            "weights": {"verbal": round(Wt, 2), "behavioural": round(Wb, 2), "physiological": round(Wp, 2)},
            "arousal": round(arousal, 2),
            "hr": round(hr_mean, 1) if hr_mean is not None else None,
            "d_hr": round(d_hr, 1) if d_hr is not None else None,
            "latency_s": round(latency, 2) if latency is not None else None,
            "words_per_s": round(rate, 2) if rate else None,
            "flags": turn_flags,
        })
        log.append(
            f"P{patient_idx + 1} [Wv:{Wt:.2f}|Wb:{Wb:.2f}|Wp:{Wp:.2f}] "
            f"verbal={verbal:.2f} behav={behav:.2f} phys={phys:.2f} "
            f"HR={'%.0f' % hr_mean if hr_mean else '–'} (Δ{'%+.0f' % d_hr if d_hr is not None else '–'}) "
            f"→ arousal {arousal:.2f}" + (f" | {'; '.join(turn_flags)}" if turn_flags else "")
        )

    incongruent = any("under-reporting" in f["flag"] for f in flags)
    overall = statistics.fmean([s["arousal"] for s in segments]) if segments else 0.0
    peak = max(segments, key=lambda s: s["arousal"]) if segments else None
    return {
        "segments":    segments,
        "flags":       flags,
        "fusion_log":  "\n".join(log) if log else "No patient turns recorded.",
        "overall_arousal": round(overall, 2),
        "arousal_level": "High" if overall >= 0.55 else "Moderate" if overall >= 0.3 else "Low",
        "peak_turn":   peak["turn"] if peak else None,
        "congruence":  ("INCONGRUENT — verbal report understates physiological response"
                        if incongruent else "CONGRUENT — verbal, behavioural and physiological channels agree"),
        "heart_rate":  hr_summary,
        "hr_source":   hr_source,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 3. ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────
def build_clinical_report(body: dict) -> dict:
    started = time.time()
    lang    = normalize_lang(body.get("lang"))
    dialect = normalize_dialect(body.get("dialect"))
    turns = [
        {"role": "user" if t.get("role") == "user" else "model",
         "text": str(t.get("text") or "").strip(),
         "t": t.get("t", 0), "meta": t.get("meta")}
        for t in (body.get("transcript") or []) if str(t.get("text") or "").strip()
    ]
    patient_texts = [t["text"] for t in turns if t["role"] == "user"]

    hr = body.get("heart_rate") or {}
    hr_samples = [s for s in (hr.get("samples") or []) if isinstance(s, dict)]
    hr_source = hr.get("source") or "none"
    vitals = body.get("vitals") or {}

    # 1. Extraction
    extracted, model = None, None
    if patient_texts:
        spoken = language_name(lang) + (f" ({DIALECTS[dialect]['name']} dialect)" if dialect else "")
        user_content = (
            f"Consultation language: {spoken}\n"
            f"Duration: {round((body.get('duration_seconds') or 0) / 60, 1)} min\n\n"
            f"TRANSCRIPT\n{_transcript_for_model(turns)}"
        )
        extracted, model = _ask_ollama(user_content)
        if not extracted:
            extracted, model = _ask_sarvam(user_content)

    extracted = extracted or {}
    history = link_quotes(extracted.get("history"), patient_texts)
    order = {f: i for i, f in enumerate(HISTORY_FIELDS)}
    history.sort(key=lambda h: (order.get(h["field"], 99), h["turn"] if h["turn"] is not None else 99))

    def _list(key):
        v = extracted.get(key) or []
        return [str(x).strip() for x in (v if isinstance(v, list) else [v]) if str(x).strip()]

    # 2. Fusion
    fusion = fuse_session(turns, hr_samples, hr_source, history)

    triage = str(extracted.get("triage") or "routine").lower()
    red_flags = _list("red_flags")
    if red_flags and triage == "routine":
        triage = "soon"

    if not patient_texts:
        summary = "No patient speech was captured during this session."
    elif not extracted:
        summary = "The clinical model was unavailable; the transcript and physiological data below are provided unprocessed."
    else:
        summary = str(extracted.get("summary") or "").strip()

    return {
        "report_id":    f"HZN-{time.strftime('%Y%m%d')}-{int(started) % 100000:05d}",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "model":        model or "unavailable",
        "processing_s": round(time.time() - started, 1),
        "language":     language_name(lang),
        "dialect":      DIALECTS[dialect]["name"] if dialect else "",
        "summary":      summary,
        "history":      history,
        "impression":   _list("impression"),
        "red_flags":    red_flags,
        "recommendations": _list("recommendations"),
        "triage":       triage if triage in ("routine", "soon", "urgent") else "routine",
        "fusion":       fusion,
        "vitals":       vitals,
        "patient_turns": patient_texts,
    }
