// Languages the consultant speaks. Codes are Sarvam AI's; speech in and out is
// Sarvam (saarika STT, bulbul TTS). Marwari has no model of its own and rides
// on Hindi with a dialect hint (see backend/languages.py).
export const CONSULT_LANGUAGES = [
    { id: "hi",      code: "hi-IN", dialect: "",        label: "Hindi",    native: "हिन्दी",   hello: "नमस्ते" },
    { id: "marwari", code: "hi-IN", dialect: "marwari", label: "Marwari",  native: "मारवाड़ी", hello: "खम्मा घणी" },
    { id: "en",      code: "en-IN", dialect: "",        label: "English",  native: "English",  hello: "Hello" },
    { id: "mr",      code: "mr-IN", dialect: "",        label: "Marathi",  native: "मराठी",    hello: "नमस्कार" },
    { id: "gu",      code: "gu-IN", dialect: "",        label: "Gujarati", native: "ગુજરાતી",  hello: "નમસ્તે" },
    { id: "pa",      code: "pa-IN", dialect: "",        label: "Punjabi",  native: "ਪੰਜਾਬੀ",   hello: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ" },
];
