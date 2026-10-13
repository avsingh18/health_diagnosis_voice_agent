# Horizon - AI Clinical Therapist

Horizon is a production-ready, highly secure, healthcare-grade AI therapy platform. It combines a seamless React frontend with a robust Python backend to provide real-time, low-latency, and highly empathetic clinical therapy sessions in Hindi. 

## Core Capabilities
- **Real-time Interaction:** Employs the browser's native Web Speech API for instantaneous Voice-to-Text translation, bypassing slow audio chunk uploading.
- **Advanced Facial Analysis:** Processes high-speed 3D facial landmarks directly in the browser (via MediaPipe & Face-api) to track micro-expressions, eye contact avoidance, and blink rates in real-time.
- **Deep Emotion Recognition:** Sends optimized image frames to the FastAPI backend for deep psychological analysis using DeepFace.
- **Privacy First LLM:** Feeds conversation history into a completely private, localized Llama-3 model running securely on your machine via Ollama, ensuring zero patient data leakage.
- **Lifelike TTS:** Uses Sarvam AI for natural and highly expressive text-to-speech output.
- **Comprehensive Clinical Reports:** Automatically aggregates temporal timeline data (emotions, tracking confidence, transcripts) to generate a full post-session clinical assessment.

## Architecture Highlights
A React frontend streaming data, processing high-speed 3D facial landmarks directly in the browser, extracting necessary frames to send to a FastAPI Python backend, running advanced paralinguistics, and feeding it all into a completely private, fine-tuned Llama-3 model running locally. Highly authenticated with API key security and JWT configurations.

## Core features
1. **Meet the Consultant** (`/consultation`) — multilingual voice intake (Hindi, Marwari via Hindi, English, Marathi, Gujarati, Punjabi). Sarvam AI does all speech (saarika STT, bulbul TTS); the LLM only writes text. Live heart rate from a Boult watch over Web Bluetooth (standard Heart Rate service; Chrome/Edge, https or localhost); SpO₂, stress, calories, sleep and workout are simulated and labelled. After the session, `/api/clinical-report` runs `backend/clinical_engine.py`: history extraction with the local Ollama model `horizon-clinical` (every field verified against the patient's exact words), ATMF-MSI fusion of speech, timing and heart rate, and the report at `/consultation/report`.
2. **Meet the Therapist** (`/therapy`) — the Hindi therapist, now with the orb agent UI and fullscreen sessions.
3. **Book a Doctor** (`/bookexpert`).

### Running locally
- `backend/.env`: `SARVAM_API_KEY` (required). Optional: `OLLAMA_REPORT_MODEL` (default `horizon-clinical`, falls back to `llama3`, then Sarvam), `OLLAMA_URL`, `SARVAM_TTS_SPEAKER` (default `shubh`).
- Ollama must be running for report generation (`ollama list` should show `horizon-clinical`).
- `.\start_dev.ps1` starts the backend and the Vite frontend.
