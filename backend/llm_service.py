# -*- coding: utf-8 -*-
"""
llm_service.py — Conversational engine for the Hindi therapy agent.

Primary model: Sarvam `sarvam-105b-conversations` (Indic-native, ~0.8 s TTFT).
Chosen over the previous OpenRouter free-tier chain, which was the direct cause
of every symptom reported in testing:

  * `nvidia/nemotron-3.5-lightning:free` is a *reasoning* model. It emitted its
    scratchpad ("Here's a thinking process: 1. **Analyze User Input** ...") and
    took 17.6 s per turn.
  * Every other model in the chain returned 429 / 404, so the chain walked all
    four models (~17 s) and then returned the single hardcoded fallback string
    — which is why the agent appeared to "repeat one line again and again".

Everything here is built around three ideas: reply fast, stay grounded in what
the patient actually said, and never say the same thing twice.
"""
import os
import re
import json
import random
import logging
import difflib
import requests

from languages import (
    DIALECTS, LANGUAGES, normalize_lang, normalize_dialect, language_name, script_re,
)

logger = logging.getLogger(__name__)

# The two agents that share this engine. The therapist is the original
# Hindi-only CBT persona; the consultant takes a clinical history in whichever
# language the patient picked.
MODE_THERAPIST = "therapist"
MODE_CONSULTANT = "consultant"

# ── Endpoints ────────────────────────────────────────────────────────────────
SARVAM_CHAT_URL = "https://api.sarvam.ai/v1/chat/completions"
OPENROUTER_URL  = "https://openrouter.ai/api/v1/chat/completions"

SARVAM_CHAT_MODEL = os.getenv("SARVAM_CHAT_MODEL", "sarvam-105b-conversations")

# Fallback only. Deliberately excludes every reasoning model — with a small
# max_tokens budget they spend the whole budget thinking and return empty
# content, which is what silently forced the hardcoded fallback before.
FALLBACK_CHAT_MODELS = [
    "nex-agi/nex-n2.5-mini:free",
    "google/gemma-4-26b-a4b-it:free",
]

REPORT_MODEL = os.getenv("REPORT_MODEL", "nvidia/nemotron-3-super-120b-a12b:free")

# Generation budget. Two short Hindi sentences need ~90 tokens; at 70 the model
# was occasionally cut off mid-clause. Still tight, because brevity is both a
# therapeutic property here and a latency control.
MAX_REPLY_TOKENS = 95
CHAT_TIMEOUT     = 12


# ─────────────────────────────────────────────────────────────────────────────
# SYSTEM PROMPT
# Written in Hinglish on purpose: the Indic model follows instruction phrased in
# its own register far more reliably than the same rules written in English.
# ─────────────────────────────────────────────────────────────────────────────
SYSTEM_PROMPT = (
    "Tum ek kushal, warm Hindi-speaking therapist ho. Tum ek asli insaan ki tarah "
    "baat karti ho — script padhne wali machine ki tarah nahi.\n\n"

    "SABSE ZAROORI NIYAM:\n"
    "1. Sirf Hindi (Devanagari script) mein bolo. Ek bhi English shabd nahi.\n"
    "2. Zyada se zyada 2 chhote vaakya. 25 shabd se kam. Bas.\n"
    "3. Koi list, koi bullet, koi markdown, koi heading, koi star (*) nahi.\n"
    "4. Apni soch ya analysis kabhi mat likho. Sirf woh bolo jo therapist "
    "patient se bolti hai.\n"
    "5. Apne aap ko kabhi introduce mat karo (pehli baar ke alawa).\n\n"

    "KAISE BAAT KARNI HAI (har jawab mein):\n"
    "- Pehle unki BAAT ko chhuo: unhone abhi jo kaha, usi ka koi shabd ya "
    "bhaav apne shabdon mein laut kar do. Isse unhe lagta hai ki suna gaya.\n"
    "- Unki feeling ko normal karo — 'aisa hona swabhavik hai', 'samajh sakti "
    "hoon'. Unhe akela mehsoos mat hone do.\n"
    "- Phir EK khula sawal poocho jo unki hi baat se nikalta ho.\n\n"

    "EMOTION KE HISAAB SE:\n"
    "- Khush hain to unke saath khush ho, aur poocho kis cheez ne yeh khushi di.\n"
    "- Dukhi/thake/pareshan hain to pehle saantvana do, phir halke se poocho.\n"
    "- Dar ya sharm hai to bina judge kiye sweekar karo.\n"
    "- Chhota jawab de rahe hain ('hmm', 'pata nahi') to daba kar mat poocho — "
    "unhe samay do, narmi se aage badho.\n\n"

    "DOHRAAV BILKUL MANA HAI:\n"
    "Har jawab pichle jawab se alag hona chahiye — alag shuruaat, alag shabd, "
    "alag sawal. Ek hi vaakya do baar bolna sabse badi galti hai.\n\n"

    "Achhe jawab ke udaharan:\n"
    "Patient: मैं तो एकदम अच्छा महसूस कर रही हूँ।\n"
    "Tum: यह सुनकर बहुत अच्छा लगा। आज कुछ खास हुआ क्या?\n\n"
    "Patient: मुझे रात को नींद नहीं आती।\n"
    "Tum: नींद न आना सचमुच थका देता है। जब आँख नहीं लगती, तब मन में क्या चलता रहता है?\n\n"
    "Patient: हम्म।\n"
    "Tum: कोई बात नहीं, अपना समय लीजिए। जो मन में आए, वही कहिए।"
)

REPORT_PROMPT = """You are a Clinical Psychiatric Report Writer.
Generate a structured clinical report based ONLY on ACTUAL DATA provided.
STRICT RULES:
1. ZERO HALLUCINATION. Add nothing from your own knowledge.
2. Use ONLY [Transcript], [Facial Analysis], [Vocal Analysis] data.
3. Cite all findings: "Patient stated: '...'" / "Facial data shows:" / "Voice analysis indicates:"
4. If data is insufficient: "Data insufficient for [section name]."
5. Write in ENGLISH only.

Report Format:
# 1. Patient Presentation
# 2. Observed Clinical Indicators
- **Verbal/Cognitive**:
- **Facial Observations**:
- **Vocal/Acoustic**:
# 3. Data-Supported Clinical Impression
# 4. Session-Specific Interventions
# 5. Clinical Recommendations
"""

# ─────────────────────────────────────────────────────────────────────────────
# VARIED SAFETY NETS
# A single hardcoded string was the old failure mode. These pools are rotated
# and de-duplicated against the last thing actually said, so even a total API
# outage degrades into something that still sounds like a listening therapist.
# ─────────────────────────────────────────────────────────────────────────────
GENERIC_FALLBACKS = [
    "मैं सुन रही हूँ। इसके बारे में थोड़ा और बताइए।",
    "समझ सकती हूँ। यह बात आपके मन पर कैसे असर डालती है?",
    "आपने जो कहा, वह मायने रखता है। आगे क्या महसूस होता है?",
    "ठीक है, कोई जल्दी नहीं। जो मन में आए, कहिए।",
    "मैं आपके साथ हूँ। इस बारे में और क्या चल रहा है?",
    "अच्छा। यह सब आपको भीतर से कैसा महसूस कराता है?",
]

GREETINGS = [
    "नमस्ते। आज आप कैसा महसूस कर रही हैं?",
    "नमस्ते, अच्छा लगा आपसे मिलकर। मन आजकल कैसा चल रहा है?",
    "नमस्ते। बताइए, आज दिन कैसा बीता?",
    "नमस्ते। आज मन में क्या चल रहा है?",
]

CLOSINGS = [
    "आज अपनी बातें साझा करने के लिए धन्यवाद। मैं आपकी रिपोर्ट तैयार कर रही हूँ।",
    "आपने आज खुलकर बात की, इसके लिए शुक्रिया। अब मैं आपकी रिपोर्ट बना रही हूँ।",
    "यह बातचीत अच्छी रही, धन्यवाद। कुछ ही पल में आपकी रिपोर्ट तैयार होगी।",
]


# ─────────────────────────────────────────────────────────────────────────────
# CONSULTANT (clinical history-taking) PERSONA
# Written in English: the instruction has to hold for eleven languages, and the
# model follows an English rubric reliably while answering in the target one.
# Its job during the call is only to *gather* the history — all extraction and
# interpretation happens once, at the end of the session (clinical_engine.py),
# so nothing here slows a turn down.
# ─────────────────────────────────────────────────────────────────────────────
def consultant_prompt(lang: str, dialect: str = "") -> str:
    lang = normalize_lang(lang)
    name = language_name(lang)
    native = LANGUAGES[lang]["native"]
    script_rule = (
        "Write in plain English." if lang == "en-IN"
        else f"Write ONLY in {name} using its own script ({native}). Not a single word in Latin letters."
    )
    dialect_rule = ""
    if dialect:
        d = DIALECTS[dialect]["name"]
        dialect_rule = (
            f"\nThe patient speaks {d}. Expect {d} words for body parts and symptoms "
            "(e.g. 'pet mein jalan', 'chakkar aave', 'mathu dukhe') and understand them; "
            "reply in simple, everyday Hindi they will follow, using their own words back to them."
        )
    return (
        "You are Horizon, a warm, unhurried clinical consultant on a voice call. You are "
        "taking the patient's history the way a good doctor's assistant would before the "
        "doctor sees them. You are NOT diagnosing and NOT prescribing.\n\n"

        "HARD RULES:\n"
        f"1. {script_rule}\n"
        "2. At most 2 short sentences, under 25 words. Spoken language, no lists, no markdown, no asterisks.\n"
        "   Sound like a real person on a phone call: everyday words people actually say at home, "
        "warm and natural, never bookish, formal or translated-sounding. Your text is read aloud "
        "by a speech engine, so write it exactly as it should be spoken.\n"
        "3. Ask ONE question at a time. Never two questions in one turn.\n"
        "4. Never write your reasoning. Say only what you would say aloud.\n"
        "5. Never repeat a question that was already answered or a sentence you already said.\n"
        "6. Never name a disease, never suggest a medicine or dose.\n"
        "7. You speak with a male voice: in Hindi, Marathi, Gujarati and Punjabi always use "
        "masculine first-person forms (e.g. 'samajh sakta hoon', not 'sakti').\n\n"

        "HOW TO TAKE THE HISTORY (move naturally, follow what the patient says):\n"
        "- Main complaint in their words → where exactly → since when (duration/onset) → "
        "what it feels like → how bad (0–10 or effect on daily life) → when it is worse or "
        "better (time of day, food, movement) → anything else happening with it "
        "(associated symptoms) → past illnesses, current medicines, allergies → sleep, "
        "appetite, stress at home or work.\n"
        "- Start each reply by briefly reflecting the patient's own words, so they feel heard, "
        "then ask the next question.\n"
        "- If the patient seems worried, reassure them in one short phrase before asking.\n"
        "- DANGER SIGNS (chest pain with sweating or breathlessness, fainting, blood in vomit "
        "or stool, sudden weakness on one side, thoughts of self-harm): stop the history and "
        "gently tell them to seek emergency care right now.\n"
        "- When the main points are covered, ask if there is anything else they want the "
        "doctor to know."
        f"{dialect_rule}"
    )


# Opening, closing and safety-net lines, hand-written per language so they
# sound like everyday speech (masculine forms, to match the voice). Machine
# translation came back formal or code-mixed ("health problem", "report").
CONSULTANT_LINES = {
    "hi-IN": {
        "greeting": ["नमस्ते, मैं होराइज़न हूँ। बताइए, आज आपको क्या तकलीफ़ है?",
                     "नमस्ते, मैं होराइज़न हूँ। आराम से बताइए, आपको क्या परेशानी हो रही है?"],
        "closing":  ["सब कुछ बताने के लिए धन्यवाद। अब मैं डॉक्टर के लिए आपकी रिपोर्ट तैयार कर रहा हूँ।",
                     "धन्यवाद, आपने बहुत अच्छे से बताया। आपकी रिपोर्ट कुछ ही पल में तैयार होगी।"],
        "fallback": ["मैं सुन रहा हूँ। इसके बारे में थोड़ा और बताइए।",
                     "समझ गया। यह तकलीफ़ कब से हो रही है?",
                     "ठीक है। इसके साथ और कोई परेशानी होती है?",
                     "कोई जल्दी नहीं। यह सबसे ज़्यादा कब होता है?"],
    },
    "en-IN": {
        "greeting": ["Hello, I am Horizon. Tell me, what health problem are you having today?",
                     "Hello, I am Horizon. Take your time and tell me, what is troubling you?"],
        "closing":  ["Thank you for telling me all this. I am preparing your report for the doctor now.",
                     "Thank you, that was very helpful. Your report will be ready in a moment."],
        "fallback": ["I am listening. Could you tell me a little more about that?",
                     "I understand. Since when has this been happening?",
                     "Okay. Is anything else bothering you along with this?",
                     "No hurry. When does it feel the worst?"],
    },
    "mr-IN": {
        "greeting": ["नमस्कार, मी होरायझन. सांगा, आज तुम्हाला काय त्रास होतोय?",
                     "नमस्कार, मी होरायझन. निवांत सांगा, तुम्हाला काय त्रास आहे?"],
        "closing":  ["हे सगळं सांगितल्याबद्दल धन्यवाद. आता मी डॉक्टरांसाठी तुमचा रिपोर्ट तयार करतो.",
                     "धन्यवाद, तुम्ही छान सांगितलं. तुमचा रिपोर्ट थोड्याच वेळात तयार होईल."],
        "fallback": ["मी ऐकतोय. याबद्दल अजून थोडं सांगा.",
                     "समजलं. हा त्रास कधीपासून होतोय?",
                     "बरं. याच्यासोबत अजून काही त्रास होतो का?",
                     "काही घाई नाही. हे सगळ्यात जास्त कधी होतं?"],
    },
    "gu-IN": {
        "greeting": ["નમસ્તે, હું હોરાઇઝન છું. કહો, આજે તમને શું તકલીફ છે?",
                     "નમસ્તે, હું હોરાઇઝન છું. નિરાંતે કહો, તમને શું તકલીફ થાય છે?"],
        "closing":  ["આ બધું જણાવવા બદલ આભાર. હવે હું ડૉક્ટર માટે તમારો રિપોર્ટ તૈયાર કરું છું.",
                     "આભાર, તમે ખૂબ સરસ રીતે કહ્યું. તમારો રિપોર્ટ થોડી વારમાં તૈયાર થઈ જશે."],
        "fallback": ["હું સાંભળું છું. આના વિશે થોડું વધારે કહો.",
                     "સમજી ગયો. આ તકલીફ ક્યારથી છે?",
                     "બરાબર. આની સાથે બીજી કોઈ તકલીફ થાય છે?",
                     "કોઈ ઉતાવળ નથી. આ સૌથી વધારે ક્યારે થાય છે?"],
    },
    "pa-IN": {
        "greeting": ["ਸਤ ਸ੍ਰੀ ਅਕਾਲ, ਮੈਂ ਹੋਰਾਈਜ਼ਨ ਹਾਂ। ਦੱਸੋ, ਅੱਜ ਤੁਹਾਨੂੰ ਕੀ ਤਕਲੀਫ਼ ਹੈ?",
                     "ਸਤ ਸ੍ਰੀ ਅਕਾਲ, ਮੈਂ ਹੋਰਾਈਜ਼ਨ ਹਾਂ। ਆਰਾਮ ਨਾਲ ਦੱਸੋ, ਤੁਹਾਨੂੰ ਕੀ ਪਰੇਸ਼ਾਨੀ ਹੈ?"],
        "closing":  ["ਇਹ ਸਭ ਦੱਸਣ ਲਈ ਧੰਨਵਾਦ। ਹੁਣ ਮੈਂ ਡਾਕਟਰ ਲਈ ਤੁਹਾਡੀ ਰਿਪੋਰਟ ਤਿਆਰ ਕਰ ਰਿਹਾ ਹਾਂ।",
                     "ਧੰਨਵਾਦ, ਤੁਸੀਂ ਬਹੁਤ ਵਧੀਆ ਦੱਸਿਆ। ਤੁਹਾਡੀ ਰਿਪੋਰਟ ਥੋੜ੍ਹੀ ਦੇਰ ਵਿੱਚ ਤਿਆਰ ਹੋ ਜਾਵੇਗੀ।"],
        "fallback": ["ਮੈਂ ਸੁਣ ਰਿਹਾ ਹਾਂ। ਇਸ ਬਾਰੇ ਥੋੜ੍ਹਾ ਹੋਰ ਦੱਸੋ।",
                     "ਸਮਝ ਗਿਆ। ਇਹ ਤਕਲੀਫ਼ ਕਦੋਂ ਤੋਂ ਹੈ?",
                     "ਠੀਕ ਹੈ। ਇਸਦੇ ਨਾਲ ਹੋਰ ਕੋਈ ਤਕਲੀਫ਼ ਹੁੰਦੀ ਹੈ?",
                     "ਕੋਈ ਕਾਹਲੀ ਨਹੀਂ। ਇਹ ਸਭ ਤੋਂ ਵੱਧ ਕਦੋਂ ਹੁੰਦਾ ਹੈ?"],
    },
}


def _consultant_pool(kind: str, lang: str) -> list[str]:
    return CONSULTANT_LINES[normalize_lang(lang)][kind]


def get_greeting(mode: str = MODE_THERAPIST, lang: str = "hi-IN") -> str:
    if mode == MODE_CONSULTANT:
        return random.choice(_consultant_pool("greeting", lang))
    return random.choice(GREETINGS)


def get_closing(mode: str = MODE_THERAPIST, lang: str = "hi-IN") -> str:
    if mode == MODE_CONSULTANT:
        return random.choice(_consultant_pool("closing", lang))
    return random.choice(CLOSINGS)


def _pick_fallback(recent_replies, mode: str = MODE_THERAPIST, lang: str = "hi-IN") -> str:
    """Choose a safety-net line that was not just used."""
    pool = _consultant_pool("fallback", lang) if mode == MODE_CONSULTANT else GENERIC_FALLBACKS
    recent = {r.strip() for r in (recent_replies or [])}
    options = [f for f in pool if f not in recent]
    return random.choice(options or pool)


# ─────────────────────────────────────────────────────────────────────────────
# SANITISER
# ─────────────────────────────────────────────────────────────────────────────
_DEV_RE = re.compile(r"[ऀ-ॿ]")

# Openers that signal the model started narrating its own reasoning.
_THINKING_PREFIX = re.compile(
    r"^\s*(here'?s?\s+(a|my|the)\s+thinking|thinking\s+process|let me think|"
    r"okay,?\s+the\s+user|the\s+user\s+(is\s+)?(say|said|want)|"
    r"first,?\s+i\s+need|i\s+should\s+respond|as\s+an?\s+ai)\b",
    re.IGNORECASE,
)


def _sanitize_reply(raw: str, lang: str = "hi-IN") -> str:
    """
    Reduce whatever the model produced down to the one or two sentences, in the
    session's language and script, that the agent would actually speak aloud.
    """
    if not raw:
        return ""
    script = script_re(lang)   # None for English: Latin is the speech itself

    text = raw

    # Reasoning blocks, in every wrapper form models use.
    text = re.sub(r"<think>.*?</think>", " ", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<thinking>.*?</thinking>", " ", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<\|[^|]*\|>", " ", text)

    # An explicit label means the real reply is whatever follows it.
    label = re.search(
        r"(?:Reply|Output|Response|Therapist|Tum|जवाब|उत्तर)\s*[:：]\s*(.+)",
        text, re.IGNORECASE | re.DOTALL,
    )
    if label and (script.search(label.group(1)) if script else True):
        text = label.group(1)

    # Markdown furniture.
    text = re.sub(r"```.*?```", " ", text, flags=re.DOTALL)
    text = re.sub(r"[*_#`>]+", " ", text)

    # Keep only lines that are genuinely speech in the session's script,
    # dropping English commentary and any line that reads as a thinking preamble.
    kept = []
    for line in text.split("\n"):
        line = line.strip().lstrip("-•–—").strip()
        if not line or _THINKING_PREFIX.search(line):
            continue
        # Numbered analysis steps ("1. Analyze User Input:")
        if re.match(r"^\d+[\.\)]\s", line) and not (script and script.search(line)):
            continue
        if script is None:
            kept.append(line)
            continue
        native = len(script.findall(line))
        word   = len(re.findall(r"\w", line))
        if word and native / word >= 0.5:
            kept.append(line)

    text = " ".join(kept) if kept else text

    # Any leftover Latin-script run is model commentary, not speech.
    if script:
        text = re.sub(r"[A-Za-z]{2,}[A-Za-z\s,'\"-]*", " ", text)
    # Quote marks survive markdown stripping and only make the TTS read oddly.
    text = re.sub(r"[\"“”‘’]", " ", text)
    text = re.sub(r"\s+", " ", text).strip().strip("'").strip()

    if not text or (script and not script.search(text)):
        return ""

    # Hard cap at two sentences so the agent never monologues.
    parts = [p.strip() for p in re.split(r"(?<=[।?!\.])\s+", text) if p.strip()]
    # If the token budget cut the last sentence mid-clause, drop it rather than
    # speaking a fragment — provided something complete remains.
    if len(parts) > 1 and not re.search(r"[।?!\.]\s*$", parts[-1]):
        parts = parts[:-1]
    if len(parts) > 2:
        parts = parts[:2]
    text = " ".join(parts) if parts else text

    # Word cap as a second guard (a sentence without punctuation can run long).
    words = text.split()
    if len(words) > 32:
        text = " ".join(words[:32]).rstrip(",;") + "।"

    return text.strip()


def _too_similar(candidate: str, recent_replies) -> bool:
    """True if `candidate` is effectively a restatement of something just said."""
    if not candidate:
        return False
    for prev in (recent_replies or []):
        if not prev:
            continue
        if difflib.SequenceMatcher(None, candidate, prev).ratio() > 0.72:
            return True
        # Same opening clause is the repetition users actually notice.
        c_open = " ".join(candidate.split()[:4])
        p_open = " ".join(prev.split()[:4])
        if c_open and c_open == p_open:
            return True
    return False


# ─────────────────────────────────────────────────────────────────────────────
# MESSAGE ASSEMBLY
# ─────────────────────────────────────────────────────────────────────────────
def _clean_history(chat_history):
    """Drop injected [SYSTEM ...] markers and anything empty."""
    out = []
    for m in (chat_history or []):
        text = (m.get("text") or "").strip()
        if not text or text.startswith("[SYSTEM"):
            continue
        out.append({
            "role": "user" if m.get("role") == "user" else "assistant",
            "content": text,
        })
    return out


def _recent_assistant_replies(history, n=4):
    return [m["content"] for m in history if m["role"] == "assistant"][-n:]


def build_messages(chat_history, new_message, avoid=None, nudge=False,
                   mode=MODE_THERAPIST, lang="hi-IN", dialect=""):
    """
    Assemble the request. Twelve turns of history (not six) is what lets the
    agent refer back to something said earlier in the session instead of
    treating each utterance as a cold start.
    """
    history = _clean_history(chat_history)

    # If the caller already appended the incoming message to history, don't
    # send it twice — duplication makes the model answer itself.
    if history and history[-1]["role"] == "user" and history[-1]["content"].strip() == (new_message or "").strip():
        history = history[:-1]

    system = consultant_prompt(lang, dialect) if mode == MODE_CONSULTANT else SYSTEM_PROMPT
    messages = [{"role": "system", "content": system}]

    avoid = avoid or _recent_assistant_replies(history)
    if avoid:
        openers = {" ".join(a.split()[:3]) for a in avoid if a.strip()}
        if openers:
            messages.append({
                "role": "system",
                "content": (
                    "Tumne abhi ye baatein kahi hain — inhe dobara mat kaho, "
                    "aur in shabdon se jawab shuru mat karo: "
                    + " | ".join(sorted(openers))
                ),
            })

    messages.extend(history[-12:])

    if nudge:
        messages.append({
            "role": "system",
            "content": (
                "Pichla jawab dohraav jaisa tha. Is baar bilkul alag shabdon se, "
                "alag shuruaat ke saath, aur seedha unki aakhri baat par jawab do."
            ),
        })

    messages.append({"role": "user", "content": new_message})
    return messages


def _reply_budget(lang: str) -> int:
    # Indic scripts other than Devanagari tokenise into many more pieces per
    # word, so two short Tamil or Malayalam sentences need a larger budget.
    lang = normalize_lang(lang)
    return MAX_REPLY_TOKENS if lang in ("hi-IN", "en-IN", "mr-IN") else 170


def _payload(messages, temperature=0.85, max_tokens=MAX_REPLY_TOKENS):
    return {
        "messages":          messages,
        "temperature":       temperature,
        "top_p":             0.92,
        "max_tokens":        max_tokens,
        # Penalties are a real part of the anti-repetition fix, not decoration:
        # they discourage token sequences already used earlier in the context.
        "presence_penalty":  0.6,
        "frequency_penalty": 0.45,
    }


def _sarvam_headers():
    return {
        "api-subscription-key": os.getenv("SARVAM_API_KEY", ""),
        "Content-Type":         "application/json",
    }


def _openrouter_headers():
    return {
        "Authorization": f"Bearer {os.getenv('OPENROUTER_API_KEY', '')}",
        "HTTP-Referer":  "https://horizon-mental-health.app",
        "X-Title":       "Horizon Mental Health",
        "Content-Type":  "application/json",
    }


# ─────────────────────────────────────────────────────────────────────────────
# STREAMING GENERATION  (used by the /api/converse SSE pipeline)
# ─────────────────────────────────────────────────────────────────────────────
def stream_chat_response(chat_history, new_message, mode=MODE_THERAPIST, lang="hi-IN", dialect=""):
    """
    Yield reply text incrementally as the model produces it.

    Streaming is what makes the pipeline feel live: the caller can cut the first
    finished sentence off the front and start synthesising speech for it while
    the rest of the reply is still being written.
    """
    if not os.getenv("SARVAM_API_KEY", ""):
        yield _pick_fallback(_recent_assistant_replies(_clean_history(chat_history)), mode, lang)
        return

    messages = build_messages(chat_history, new_message, mode=mode, lang=lang, dialect=dialect)
    payload  = {**_payload(messages, max_tokens=_reply_budget(lang)),
                "model": SARVAM_CHAT_MODEL, "stream": True}

    emitted = False
    try:
        with requests.post(
            SARVAM_CHAT_URL, headers=_sarvam_headers(), json=payload,
            timeout=CHAT_TIMEOUT, stream=True,
        ) as r:
            if r.status_code != 200:
                logger.error(f"[llm] stream HTTP {r.status_code}: {r.text[:200]}")
            else:
                for line in r.iter_lines():
                    if not line:
                        continue
                    s = line.decode("utf-8", errors="ignore")
                    if not s.startswith("data: "):
                        continue
                    s = s[6:].strip()
                    if s == "[DONE]":
                        break
                    try:
                        chunk = json.loads(s)
                    except json.JSONDecodeError:
                        continue
                    delta = (chunk.get("choices") or [{}])[0].get("delta", {}).get("content") or ""
                    if delta:
                        emitted = True
                        yield delta
    except requests.exceptions.Timeout:
        logger.error("[llm] stream timeout")
    except Exception as e:
        logger.error(f"[llm] stream error: {e}")

    if not emitted:
        # Non-streaming path already has the full fallback chain.
        yield generate_chat_response(chat_history, new_message, mode, lang, dialect)


# ─────────────────────────────────────────────────────────────────────────────
# NON-STREAMING GENERATION  (legacy /api/chat + streaming fallback)
# ─────────────────────────────────────────────────────────────────────────────
def _call_sarvam(messages, temperature, max_tokens=MAX_REPLY_TOKENS):
    payload = {**_payload(messages, temperature, max_tokens), "model": SARVAM_CHAT_MODEL}
    r = requests.post(SARVAM_CHAT_URL, headers=_sarvam_headers(),
                      json=payload, timeout=CHAT_TIMEOUT)
    if r.status_code != 200:
        logger.error(f"[llm] sarvam HTTP {r.status_code}: {r.text[:200]}")
        return ""
    return (r.json().get("choices", [{}])[0].get("message", {}).get("content") or "").strip()


def _call_openrouter(messages, temperature, max_tokens=MAX_REPLY_TOKENS):
    if not os.getenv("OPENROUTER_API_KEY", ""):
        return ""
    for model_id in FALLBACK_CHAT_MODELS:
        payload = {**_payload(messages, temperature, max_tokens), "model": model_id}
        try:
            r = requests.post(OPENROUTER_URL, headers=_openrouter_headers(),
                              json=payload, timeout=CHAT_TIMEOUT)
            if r.status_code == 200:
                content = (r.json().get("choices", [{}])[0]
                           .get("message", {}).get("content") or "").strip()
                if content:
                    logger.info(f"[llm] fallback served by {model_id}")
                    return content
            else:
                logger.warning(f"[llm] {model_id} HTTP {r.status_code}")
        except Exception as e:
            logger.warning(f"[llm] {model_id} error: {e}")
    return ""


def generate_chat_response(chat_history, new_message, mode=MODE_THERAPIST, lang="hi-IN", dialect=""):
    """
    Produce one agent reply: in the session language, short, grounded in the
    last thing said, and verified not to echo a recent turn.
    """
    budget = _reply_budget(lang)
    history = _clean_history(chat_history)
    recent  = _recent_assistant_replies(history)

    # Attempt 1 — primary model. Attempt 2 — same model, nudged away from the
    # repetition. Attempt 3 — OpenRouter fallback.
    for attempt in range(3):
        nudge = attempt == 1
        messages = build_messages(chat_history, new_message, avoid=recent, nudge=nudge,
                                  mode=mode, lang=lang, dialect=dialect)
        temperature = 0.85 + (0.15 * attempt)

        try:
            raw = (_call_openrouter(messages, temperature, budget) if attempt == 2
                   else _call_sarvam(messages, temperature, budget))
        except requests.exceptions.Timeout:
            logger.error("[llm] timeout")
            continue
        except Exception as e:
            logger.error(f"[llm] error: {e}")
            continue

        reply = _sanitize_reply(raw, lang)
        if not reply:
            continue
        if _too_similar(reply, recent) and attempt < 2:
            logger.info(f"[llm] repetition rejected: {reply[:60]}")
            continue

        logger.info(f"[llm] reply: {reply}")
        return reply

    fallback = _pick_fallback(recent, mode, lang)
    logger.warning(f"[llm] all attempts failed — fallback: {fallback}")
    return fallback


def finalize_reply(raw_text, chat_history, lang="hi-IN"):
    """
    Clean a streamed reply and guarantee it is neither empty nor a repeat.
    Used by the SSE pipeline once the full stream has arrived.
    """
    recent = _recent_assistant_replies(_clean_history(chat_history))
    reply  = _sanitize_reply(raw_text, lang)
    if not reply or _too_similar(reply, recent):
        return "", recent
    return reply, recent


# ─────────────────────────────────────────────────────────────────────────────
# CLINICAL REPORT  (English, unchanged behaviour)
# ─────────────────────────────────────────────────────────────────────────────
def generate_medical_report(transcript, face_data, voice_data, previous_report=""):
    if not os.getenv("OPENROUTER_API_KEY", ""):
        return "OPENROUTER_API_KEY is not configured."

    prev = f"\n\n[Previous Session Report]\n{previous_report[:3000]}\n" if previous_report.strip() else ""
    tc = transcript.strip() or "No transcript available."
    fc = face_data.strip()  or "No facial data available."
    vc = voice_data.strip() or "No vocal data available."

    prompt = (
        f"{REPORT_PROMPT}\n\n--- CONFIDENTIAL SESSION DATA ---\n\n"
        f"[Transcript]\n{tc}\n\n[Facial Analysis]\n{fc}\n\n[Vocal Analysis]\n{vc}{prev}\n\n"
        f"--- Generate the Official Clinical Report ---\n"
    )
    payload = {
        "model": REPORT_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1,
        "max_tokens": 1500,
    }
    try:
        r = requests.post(OPENROUTER_URL, headers=_openrouter_headers(),
                          json=payload, timeout=60)
        if r.status_code == 200:
            return (r.json().get("choices", [{}])[0]
                    .get("message", {}).get("content", "Report generation failed.")).strip()
        return f"Report generation failed (HTTP {r.status_code})."
    except Exception as e:
        return f"Report generation failed: {e}"


def validate_response_relevance(user_message: str, ai_response: str) -> None:
    """Background observability only — never blocks or alters a reply."""
    has_hindi = bool(_DEV_RE.search(ai_response or ""))
    logger.info(
        f"[validate] user='{(user_message or '')[:60]}' | "
        f"hindi={has_hindi} | ai='{(ai_response or '')[:80]}'"
    )
