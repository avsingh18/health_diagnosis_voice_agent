import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import SiteHeader from "../components/SiteHeader.jsx";
import OrbStage from "../components/orb/OrbStage.jsx";
import { createVoiceSession, STATE as VOICE } from "../lib/voiceSession";
import { CONSULT_LANGUAGES } from "../lib/languages.js";
import {
    createWatchLink, createDemoHeartRate, createVitalsSimulator, isBluetoothSupported,
} from "../lib/smartwatch.js";

// "Meet the Consultant": a multilingual voice intake.
//
//   setup      pick a language, pair the Boult watch (or use demo data)
//   session    fullscreen; the orb greets and the conversation runs in
//              realtime over the WebSocket (src/lib/voiceSession.js)
//   closing    the orb says goodbye
//   analyzing  the whole session goes to /api/clinical-report once; the
//              history extraction and ATMF-MSI fusion happen there, never
//              during the conversation
//
// Everything the analysis needs is recorded with times relative to the
// session start: each turn (with its speech timing) and each heart-rate sample,
// so the report can line up what was said with what the heart was doing.

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
const API_KEY     = import.meta.env.VITE_API_KEY     || "horizon-secure-key-2025";
const MAX_SESSION_S = 15 * 60;
const REPORT_KEY = "horizon_clinical_report";

const apiFetch = (url, opts = {}) =>
    fetch(url, { ...opts, headers: { "X-API-Key": API_KEY, ...(opts.headers || {}) } });

const ANALYSIS_STEPS = [
    "Compiling the conversation",
    "Extracting clinical history · horizon-clinical",
    "Linking every finding to the patient's words",
    "ATMF-MSI fusion · speech, behaviour, heart rate",
    "Composing the clinical report",
];

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
  html, body, #root { margin: 0 !important; padding: 0 !important; width: 100%; max-width: 100% !important; overflow-x: hidden; background: #F5F8FF; }
  * { box-sizing: border-box; font-family: 'Nunito', sans-serif; }

  /* ── setup ── */
  .cn-setup { text-align: left; max-width: 980px; margin: 0 auto; padding: clamp(24px, 5vw, 48px) 20px 64px; }
  .cn-title { font-size: clamp(28px, 4vw, 42px); font-weight: 700; color: #1F2937; letter-spacing: -0.8px; line-height: 1.2; margin: 0 0 14px; }
  .cn-sub { color: #5B6475; font-size: 16px; line-height: 1.6; margin: 0 0 28px; max-width: 640px; }
  .cn-card { background: #fff; border: 1.5px solid #E3EAF8; border-radius: 22px; padding: 22px 22px 24px; margin-bottom: 18px; }
  .cn-card h3 { margin: 0 0 4px; font-size: 18px; font-weight: 700; color: #1F2937; }
  .cn-card .hint { margin: 0 0 16px; color: #7A8496; font-size: 14px; }
  .cn-langs { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
  .cn-lang { border: 2px solid #E3EAF8; border-radius: 16px; padding: 14px 14px 12px; cursor: pointer; background: #fff; text-align: left; transition: all .15s; }
  .cn-lang:hover { border-color: #9DBBFF; }
  .cn-lang.sel { border-color: #19B4CF; background: #ECFAFD; box-shadow: 0 6px 18px rgba(25,180,207,0.18); }
  .cn-lang .native { font-size: 20px; font-weight: 600; color: #1F2937; display: block; }
  .cn-lang .en { font-size: 13px; font-weight: 500; color: #7A8496; }
  .cn-watch { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
  .cn-watch-state { flex: 1; min-width: 220px; display: flex; align-items: center; gap: 12px; }
  .cn-dot { width: 10px; height: 10px; border-radius: 50%; background: #C3CAD6; flex-shrink: 0; }
  .cn-dot.on { background: #12B76A; box-shadow: 0 0 0 4px rgba(18,183,106,0.18); }
  .cn-dot.demo { background: #F79009; box-shadow: 0 0 0 4px rgba(247,144,9,0.18); }
  .cn-watch-label { font-weight: 600; color: #1F2937; }
  .cn-watch-detail { font-size: 13px; color: #7A8496; }
  .cn-bpm { font-size: 28px; font-weight: 700; color: #E0157A; min-width: 90px; text-align: right; }
  .cn-bpm small { font-size: 13px; color: #7A8496; font-weight: 500; margin-left: 4px; }
  .cn-btn { padding: 11px 22px; border-radius: 10px; border: none; cursor: pointer; font-size: 15px; font-weight: 500; color: #fff; background: #1A5FCC; transition: background .15s; }
  .cn-btn:hover:not(:disabled) { background: #154FAD; }
  .cn-btn.ghost { background: #fff; color: #1A5FCC; border: 1.5px solid #C9D8F5; }
  .cn-btn.ghost:hover:not(:disabled) { background: #F0F5FF; }
  .cn-btn:disabled { opacity: .5; cursor: not-allowed; }
  .cn-err { color: #B42318; font-size: 13px; margin-top: 10px; }
  .cn-start { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-top: 26px; }
  .cn-start p { margin: 0; color: #7A8496; font-size: 14px; max-width: 520px; line-height: 1.55; }
  .cn-start .cn-btn { padding: 16px 40px; font-size: 17px; }

  /* ── fullscreen session ── */
  .cn-stage { position: fixed; inset: 0; z-index: 1000; background: radial-gradient(ellipse at 50% 40%, #0C2240 0%, #050B18 62%, #02050C 100%); color: #E6F1FF; overflow: hidden; }
  .cn-top { position: absolute; top: 0; left: 0; right: 0; display: flex; justify-content: space-between; align-items: flex-start; padding: 22px 28px; z-index: 5; gap: 16px; }
  .cn-brand { display: flex; flex-direction: column; gap: 6px; }
  .cn-brand b { font-size: 20px; font-weight: 700; letter-spacing: .4px; }
  .cn-chip { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; padding: 5px 11px; border-radius: 100px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: #BFD3EE; }
  .cn-timer { font-variant-numeric: tabular-nums; font-size: 18px; font-weight: 600; color: #BFD3EE; }
  .cn-vitals { display: flex; flex-direction: column; gap: 8px; min-width: 200px; }
  .cn-vital { background: rgba(9,22,42,0.72); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 10px 14px; backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .cn-vital .k { font-size: 11px; font-weight: 600; letter-spacing: .8px; text-transform: uppercase; color: #8FA6C4; }
  .cn-vital .v { font-size: 18px; font-weight: 700; color: #fff; font-variant-numeric: tabular-nums; }
  .cn-vital.hr .v { font-size: 26px; color: #FF7AB8; }
  .cn-vital .src { font-size: 10px; font-weight: 600; color: #7FD8E8; letter-spacing: .4px; }
  .cn-vital .src.sim { color: #F5B547; }
  .cn-heart { display: inline-block; animation: beat var(--beat, 0.8s) ease-in-out infinite; }
  @keyframes beat { 0%, 100% { transform: scale(1); } 15% { transform: scale(1.25); } 30% { transform: scale(1); } }
  .cn-caption { position: absolute; left: 50%; bottom: 128px; transform: translateX(-50%); width: min(820px, 90vw); text-align: center; z-index: 5; }
  .cn-caption .who { font-size: 12px; font-weight: 600; letter-spacing: 1.6px; text-transform: uppercase; color: #7FD8E8; margin-bottom: 8px; }
  .cn-caption .who.talk { color: #FF7AB8; }
  .cn-caption .line { font-size: clamp(17px, 2.2vw, 24px); font-weight: 500; line-height: 1.45; color: #F2F7FF; text-shadow: 0 2px 12px rgba(0,0,0,0.6); }
  .cn-caption .you { margin-top: 10px; font-size: 14px; color: #8FA6C4; font-weight: 500; }
  .cn-controls { position: absolute; left: 0; right: 0; bottom: 36px; display: flex; justify-content: center; gap: 14px; z-index: 6; }
  .cn-ctl { padding: 12px 26px; border-radius: 10px; font-size: 15px; font-weight: 500; cursor: pointer; border: none; background: #1A5FCC; color: #fff; }
  .cn-ctl:hover { background: #154FAD; }
  .cn-notice { position: absolute; top: 84px; left: 50%; transform: translateX(-50%); background: rgba(180,35,24,0.85); color: #fff; font-size: 12px; font-weight: 500; padding: 6px 14px; border-radius: 100px; z-index: 7; max-width: 80vw; text-align: center; }

  .cn-analysis { position: absolute; left: 50%; bottom: 90px; transform: translateX(-50%); width: min(520px, 90vw); z-index: 5; }
  .cn-analysis h2 { text-align: center; margin: 0 0 18px; font-size: 22px; font-weight: 700; color: #fff; }
  .cn-step { display: flex; align-items: center; gap: 12px; padding: 7px 0; color: #6F86A6; font-weight: 500; font-size: 15px; transition: color .3s; }
  .cn-step.done { color: #7FD8E8; }
  .cn-step.now { color: #fff; }
  .cn-step i { width: 18px; height: 18px; border-radius: 50%; border: 2px solid currentColor; display: inline-flex; align-items: center; justify-content: center; font-style: normal; font-size: 11px; flex-shrink: 0; }
  .cn-step.now i { border-top-color: transparent; animation: spin 0.9s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  @media (max-width: 700px) {
    .cn-top { flex-direction: column; padding: 16px; }
    .cn-vitals { flex-direction: row; flex-wrap: wrap; min-width: 0; }
    .cn-vital { padding: 8px 10px; }
    .cn-caption { bottom: 116px; }
  }
`;

function fmt(s) {
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function ConsultNowPage() {
    const navigate = useNavigate();

    const [phase, setPhase]       = useState("setup");
    const [langId, setLangId]     = useState("hi");
    const [watch, setWatch]       = useState({ state: "idle", device: "", battery: null, error: "" });
    const [hrSource, setHrSource] = useState("none");   // "boult" | "simulated" | "none"
    const [bpm, setBpm]           = useState(null);
    const [vitals, setVitals]     = useState(null);
    const [elapsed, setElapsed]   = useState(0);
    const [voiceState, setVoiceState] = useState(VOICE.IDLE);
    const [aiLine, setAiLine]     = useState("");
    const [userLine, setUserLine] = useState("");
    const [notice, setNotice]     = useState("");
    const [held, setHeld]         = useState(false);
    const [step, setStep]         = useState(0);

    const lang = CONSULT_LANGUAGES.find((l) => l.id === langId) || CONSULT_LANGUAGES[0];

    const phaseRef   = useRef(phase);
    const sessionRef = useRef(null);
    const streamRef  = useRef(null);
    const watchRef   = useRef(null);
    const demoRef    = useRef(null);
    const simRef     = useRef(null);
    const t0Ref      = useRef(0);          // epoch ms of session start
    const turnsRef   = useRef([]);         // [{role, text, t, meta?}]
    const metaRef    = useRef(null);       // timing of the utterance awaiting its transcript
    const hrRef      = useRef([]);         // [{t, bpm}]
    const bpmRef     = useRef(null);
    const lastHrAt   = useRef(0);
    const endingRef  = useRef(false);
    // Read by finalize(), which runs from callbacks created at session start.
    const hrSourceRef = useRef(hrSource);
    const deviceRef   = useRef("");

    useEffect(() => { phaseRef.current = phase; }, [phase]);
    useEffect(() => { hrSourceRef.current = hrSource; }, [hrSource]);
    useEffect(() => { deviceRef.current = watch.device; }, [watch.device]);

    const rel = () => (t0Ref.current ? Date.now() - t0Ref.current : 0);

    // ── Heart rate in (watch or demo) ──
    const onHeartRate = useCallback((value) => {
        bpmRef.current = value;
        setBpm(value);
        // Keep ~1 sample per second; BLE notifications can be faster.
        const now = Date.now();
        if (t0Ref.current && now - lastHrAt.current >= 900 && phaseRef.current !== "setup") {
            lastHrAt.current = now;
            hrRef.current.push({ t: rel(), bpm: value });
        }
    }, []);

    const connectWatch = async () => {
        demoRef.current?.stop();
        demoRef.current = null;
        if (!watchRef.current) {
            watchRef.current = createWatchLink({
                onHeartRate,
                onStatus: (s) => {
                    setWatch((w) => ({ ...w, battery: null, error: "", ...s }));
                    if (s.state === "connected") setHrSource("boult");
                },
            });
        }
        await watchRef.current.connect();
    };

    const startDemo = () => {
        watchRef.current?.disconnect();
        demoRef.current?.stop();
        demoRef.current = createDemoHeartRate(onHeartRate);
        hrSourceRef.current = "simulated";
        setHrSource("simulated");
        setWatch({ state: "demo", device: "Demo data", battery: null, error: "" });
    };

    // Simulated metrics tick once a second for the whole page lifetime.
    useEffect(() => {
        simRef.current = createVitalsSimulator(() => bpmRef.current);
        setVitals(simRef.current.snapshot());
        const id = setInterval(() => {
            const inSession = t0Ref.current && phaseRef.current !== "setup";
            setVitals(simRef.current.tick(inSession ? rel() : undefined));
        }, 1000);
        return () => clearInterval(id);
    }, []);

    // ── Clean up everything on leave ──
    useEffect(() => () => {
        sessionRef.current?.close();
        streamRef.current?.getTracks().forEach((t) => t.stop());
        demoRef.current?.stop();
        watchRef.current?.disconnect();
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    }, []);

    // ── Session clock ──
    useEffect(() => {
        if (phase !== "session" || held) return undefined;
        const id = setInterval(() => setElapsed(Math.floor(rel() / 1000)), 500);
        return () => clearInterval(id);
    }, [phase, held]);

    const history = () => turnsRef.current.map(({ role, text }) => ({ role, text }));

    async function finalize() {
        if (endingRef.current) return;
        endingRef.current = true;
        setPhase("analyzing");
        phaseRef.current = "analyzing";
        const durationS = Math.round(rel() / 1000);
        sessionRef.current?.close();
        streamRef.current?.getTracks().forEach((t) => t.stop());

        setStep(0);
        const stepTimer = setInterval(() => setStep((s) => Math.min(s + 1, ANALYSIS_STEPS.length - 1)), 9000);

        const payload = {
            lang: lang.code,
            dialect: lang.dialect,
            duration_seconds: durationS,
            started_at: new Date(t0Ref.current).toISOString(),
            transcript: turnsRef.current,
            heart_rate: { source: hrSourceRef.current, device: deviceRef.current, samples: hrRef.current },
            vitals: simRef.current?.export(),
        };

        let report = null;
        try {
            const res = await apiFetch(`${BACKEND_URL}/api/clinical-report`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (res.ok) report = await res.json();
        } catch { /* shown on the report page */ }
        clearInterval(stepTimer);
        setStep(ANALYSIS_STEPS.length);

        sessionStorage.setItem(REPORT_KEY, JSON.stringify({ payload, report }));
        demoRef.current?.stop();
        watchRef.current?.disconnect();
        setTimeout(() => {
            if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
            navigate("/consultation/report");
        }, 700);
    }

    async function speakLine(kind) {
        const session = sessionRef.current;
        try {
            const res = await apiFetch(`${BACKEND_URL}/api/session-line`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ kind, lang: lang.code, mode: "consultant" }),
            });
            const data = await res.json();
            if (data.text) {
                setAiLine(data.text);
                if (kind === "greeting") turnsRef.current.push({ role: "model", text: data.text, t: rel() });
            }
            if (data.audio) session.speak(data.audio);
            else if (kind === "closing") finalize();
            else session.start();
        } catch {
            if (kind === "closing") finalize();
            else {
                setNotice("Backend unreachable — check that the server is running.");
                session?.start();
            }
        }
    }

    function endSession() {
        if (phaseRef.current !== "session") return;
        setPhase("closing");
        phaseRef.current = "closing";
        setHeld(false);
        sessionRef.current?.interrupt();
        speakLine("closing");
        // If the goodbye never plays out, do not strand the patient.
        setTimeout(() => { if (phaseRef.current === "closing") finalize(); }, 15000);
    }

    // Hard cap on session length.
    useEffect(() => {
        if (phase !== "session") return undefined;
        const id = setTimeout(endSession, Math.max(0, MAX_SESSION_S * 1000 - rel()));
        return () => clearTimeout(id);
    }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Voice session ──
    const buildSession = () => createVoiceSession({
        backendUrl: BACKEND_URL,
        apiKey: API_KEY,
        language: lang.code,
        dialect: lang.dialect,
        mode: "consultant",
        getHistory: history,
        onState: (next) => {
            setVoiceState(next);
            // The goodbye has finished playing once the loop goes back to
            // listening: now the report can be built.
            if (phaseRef.current === "closing" && next === VOICE.LISTENING) finalize();
        },
        onUtteranceMeta: (m) => {
            const t0 = t0Ref.current;
            metaRef.current = { listenStart: m.listenStart - t0, speechStart: m.speechStart - t0, end: m.end - t0 };
        },
        onTranscript: (text) => {
            turnsRef.current.push({ role: "user", text, t: rel(), meta: metaRef.current });
            metaRef.current = null;
            setUserLine(text);
        },
        onReply: (text) => {
            turnsRef.current.push({ role: "model", text, t: rel() });
            setAiLine(text);
        },
        onNotice: (msg) => {
            console.warn("[consult]", msg);
            setNotice(msg);
            setTimeout(() => setNotice((n) => (n === msg ? "" : n)), 6000);
        },
    });

    const startSession = async () => {
        // Fullscreen must be requested inside the click.
        document.documentElement.requestFullscreen?.().catch(() => {});
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            });
        } catch {
            if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
            setWatch((w) => ({ ...w, error: "Microphone permission is needed for the consultation." }));
            return;
        }
        if (hrSourceRef.current === "none") startDemo();

        streamRef.current = stream;
        t0Ref.current = Date.now();
        turnsRef.current = [];
        hrRef.current = [];
        endingRef.current = false;
        setElapsed(0);
        setAiLine("");
        setUserLine("");
        setPhase("session");
        phaseRef.current = "session";

        const session = buildSession();
        sessionRef.current = session;
        session.attach(stream);
        session.unlock();
        speakLine("greeting");
    };

    const toggleHold = () => {
        const next = !held;
        setHeld(next);
        if (next) sessionRef.current?.pause();
        else sessionRef.current?.resume();
    };


    // ─────────────────────────────── render ───────────────────────────────
    if (phase === "setup") {
        const live = watch.state === "connected";
        const demo = watch.state === "demo";
        return (
            <>
                <style>{STYLES}</style>
                <SiteHeader />
                <div className="cn-setup">
                    <h1 className="cn-title">Meet the Consultant</h1>
                    <p className="cn-sub">
                        Talk naturally, in your own language. Horizon asks about your health the way a
                        doctor's assistant would. When you finish, it prepares a clinical report with your
                        heart rate from your watch.
                    </p>

                    <div className="cn-card">
                        <h3>1 · Choose your language</h3>
                        <p className="hint">The consultant will listen and reply in this language.</p>
                        <div className="cn-langs">
                            {CONSULT_LANGUAGES.map((l) => (
                                <button key={l.id} className={`cn-lang ${l.id === langId ? "sel" : ""}`} onClick={() => setLangId(l.id)}>
                                    <span className="native">{l.native}</span>
                                    <span className="en">{l.label}{l.dialect ? " · via Hindi" : ""}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="cn-card">
                        <h3>2 · Connect your smartwatch</h3>
                        <p className="hint">
                            Boult or Smartwatch SJ: live heart rate over Bluetooth. Keep the watch on your wrist; measurement starts automatically.
                            SpO₂, stress, calories, sleep and workout are simulated until the watch exposes them.
                        </p>
                        <div className="cn-watch">
                            <div className="cn-watch-state">
                                <span className={`cn-dot ${live ? "on" : demo ? "demo" : ""}`} />
                                <div>
                                    <div className="cn-watch-label">
                                        {live ? `Connected · ${watch.device || "Smartwatch"}`
                                            : demo ? "Using demo heart-rate data"
                                            : watch.state === "pairing" ? "Pairing…"
                                            : watch.state === "reconnecting" ? "Reconnecting…"
                                            : "No watch connected"}
                                    </div>
                                    <div className="cn-watch-detail">
                                        {live && watch.battery != null ? `Battery ${watch.battery}% · ` : ""}
                                        {live ? "Heart rate · live" : demo ? "Marked as simulated in the report" : isBluetoothSupported() ? "Chrome / Edge Web Bluetooth" : "This browser has no Web Bluetooth"}
                                    </div>
                                </div>
                            </div>
                            {bpm != null && (live || demo) && (
                                <div className="cn-bpm"><span className="cn-heart" style={{ "--beat": `${60 / bpm}s` }}>♥</span> {bpm}<small>bpm</small></div>
                            )}
                            <button className="cn-btn" onClick={connectWatch} disabled={watch.state === "pairing" || !isBluetoothSupported()}>
                                {live ? "Reconnect" : "Connect watch"}
                            </button>
                            {!live && <button className="cn-btn ghost" onClick={startDemo}>Use demo data</button>}
                        </div>
                        {watch.error && <div className="cn-err">{watch.error}</div>}
                    </div>

                    <div className="cn-start">
                        <p>
                            The session opens fullscreen. Sit somewhere quiet and speak when the orb turns teal.
                            Press <b>End session</b> when you are done.
                        </p>
                        <button className="cn-btn" onClick={startSession}>Start session</button>
                    </div>
                </div>
            </>
        );
    }

    const speaking = voiceState === VOICE.SPEAKING;
    const status = phase === "analyzing" ? ""
        : phase === "closing" ? "Horizon"
        : held ? "Paused"
        : speaking ? "Horizon"
        : voiceState === VOICE.THINKING ? "Thinking…"
        : voiceState === VOICE.LISTENING ? "Listening…"
        : "Connecting…";
    const v = vitals || {};
    const hrSim = hrSource !== "boult";

    return (
        <>
            <style>{STYLES}</style>
            <div className="cn-stage">
                <OrbStage
                    speaking={speaking}
                    happy={phase === "analyzing"}
                    getLevels={() => sessionRef.current?.levels?.()}
                    yFrac={phase === "analyzing" ? 0.34 : 0.42}
                />

                <div className="cn-top">
                    <div className="cn-brand">
                        <b>HORIZON</b>
                        <span className="cn-chip">🌐 {lang.native} · {lang.label}</span>
                        {phase !== "analyzing" && <span className="cn-timer">{fmt(elapsed)}</span>}
                    </div>
                    {phase !== "analyzing" && (
                        <div className="cn-vitals">
                            <div className="cn-vital hr">
                                <div>
                                    <div className="k">Heart rate</div>
                                    <div className={`src ${hrSim ? "sim" : ""}`}>{hrSim ? "SIMULATED" : "WATCH · LIVE"}</div>
                                </div>
                                <div className="v">
                                    <span className="cn-heart" style={{ "--beat": `${60 / (bpm || 70)}s` }}>♥</span> {bpm ?? "--"}
                                </div>
                            </div>
                            <div className="cn-vital"><div><div className="k">SpO₂</div><div className="src sim">SIMULATED</div></div><div className="v">{v.spo2 ?? "--"}%</div></div>
                            <div className="cn-vital"><div><div className="k">Stress</div><div className="src sim">SIMULATED</div></div><div className="v">{v.stress ?? "--"}</div></div>
                            <div className="cn-vital"><div><div className="k">Calories</div><div className="src sim">SIMULATED</div></div><div className="v">{v.calories ?? "--"}</div></div>
                        </div>
                    )}
                </div>

                {notice && phase === "session" && <div className="cn-notice">⚠ {notice}</div>}

                {phase !== "analyzing" ? (
                    <div className="cn-caption">
                        <div className={`who ${speaking ? "talk" : ""}`}>{status}</div>
                        <div className="line">{aiLine || " "}</div>
                        {userLine && <div className="you">You: “{userLine}”</div>}
                    </div>
                ) : (
                    <div className="cn-analysis">
                        <h2>Preparing your clinical report</h2>
                        {ANALYSIS_STEPS.map((s, i) => (
                            <div key={s} className={`cn-step ${i < step ? "done" : i === step ? "now" : ""}`}>
                                <i>{i < step ? "✓" : ""}</i>{s}
                            </div>
                        ))}
                    </div>
                )}

                {phase === "session" && (
                    <div className="cn-controls">
                        <button className="cn-ctl" onClick={toggleHold}>{held ? "Resume" : "Pause"}</button>
                        <button className="cn-ctl end" onClick={endSession}>End session</button>
                    </div>
                )}
            </div>
        </>
    );
}
