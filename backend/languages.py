# -*- coding: utf-8 -*-
"""
languages.py — the languages the voice agents can hold a conversation in.

Supported: Hindi, English, Marathi, Gujarati and Punjabi. Speech in and out
is Sarvam AI only (saarika STT, bulbul TTS); the LLM only ever writes text.

Every entry is a Sarvam AI language code (saarika STT, bulbul TTS and the chat
model all accept the same codes). `script` is the Unicode block a spoken reply
must be written in: the reply sanitiser uses it to throw away model commentary
in any other script, and TTS reads a reply in the wrong script badly or not at
all.

Dialects (Marwari, Haryanvi, Bhojpuri...) have no STT/TTS model of their own.
They ride on their parent language — the recogniser transcribes Marwari speech
as Devanagari Hindi well enough — and the prompt tells the model to expect the
dialect's vocabulary ("pet mein jalan", "chakkar aave") and answer in plain
Hindi the patient will understand.
"""
import re

LANGUAGES = {
    "hi-IN": {"name": "Hindi",     "native": "हिन्दी",   "script": r"[ऀ-ॿ]"},
    "en-IN": {"name": "English",   "native": "English",  "script": None},
    "mr-IN": {"name": "Marathi",   "native": "मराठी",     "script": r"[ऀ-ॿ]"},
    "gu-IN": {"name": "Gujarati",  "native": "ગુજરાતી",   "script": r"[઀-૿]"},
    "pa-IN": {"name": "Punjabi",   "native": "ਪੰਜਾਬੀ",    "script": r"[਀-੿]"},
}

DIALECTS = {
    "marwari":  {"name": "Marwari (Rajasthani)", "parent": "hi-IN"},
    "haryanvi": {"name": "Haryanvi",             "parent": "hi-IN"},
    "bhojpuri": {"name": "Bhojpuri",             "parent": "hi-IN"},
}

DEFAULT_LANG = "hi-IN"


def normalize_lang(code: str | None) -> str:
    return code if code in LANGUAGES else DEFAULT_LANG


def normalize_dialect(dialect: str | None) -> str:
    return dialect if dialect in DIALECTS else ""


def language_name(code: str) -> str:
    return LANGUAGES[normalize_lang(code)]["name"]


def script_re(code: str):
    """Compiled regex for the reply script, or None when Latin is expected."""
    pattern = LANGUAGES[normalize_lang(code)]["script"]
    return re.compile(pattern) if pattern else None
