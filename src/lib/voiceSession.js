/**
 * voiceSession.js — the realtime Hindi conversation loop.
 *
 * Owns everything between the microphone and the speaker: level metering and
 * endpointing, the WebSocket to the backend, and ordered playback of the
 * reply. ConsultantPage only renders the state this reports.
 *
 * WHY A SOCKET
 * Each utterance used to be its own HTTP request, so the recording could not
 * start uploading until the patient had finished speaking. Here the recorder
 * emits a chunk every 250 ms and each one goes up immediately: by the time
 * they stop talking the audio is already on the server and recognition starts
 * at once. It also removes connection setup from every turn, and lets a
 * `cancel` abandon a reply mid-sentence.
 *
 * WHY THE METER RUNS CONTINUOUSLY
 * The first version measured the room once per utterance. That is what made
 * the session freeze on "Listening...": the noise floor was sampled from
 * whatever happened to be playing at that instant — the tail of the
 * therapist's reply, or the patient answering immediately — which pinned the
 * threshold above real speech, and it never recovered. Now one meter runs for
 * the whole session, so the floor is always current, and it deliberately
 * ignores the stretch while the therapist is speaking.
 *
 * RELIABILITY
 * Nothing here may leave the patient talking to a dead microphone:
 *   - the socket reconnects with backoff, then falls back to HTTP (SSE);
 *   - a watchdog recovers the turn if the backend goes quiet;
 *   - an utterance with no pause is submitted anyway at MAX_UTTERANCE_MS;
 *   - capture with no sound at all is torn down, re-armed, and reported;
 *   - debug() exposes the live levels for diagnosing a session in the field.
 *
 * States: "idle" | "listening" | "thinking" | "speaking" | "paused" | "error"
 */

const STATE = {
    IDLE:      "idle",
    LISTENING: "listening",
    THINKING:  "thinking",
    SPEAKING:  "speaking",
    PAUSED:    "paused",
    ERROR:     "error",
};

// Measured in Chrome: a quiet room sits near 0.0001 RMS and speech near 0.4,
// so the detector only has to land somewhere sensible in between — but it must
// never sit above real speech. Deciding on the gap between a running quiet
// level and a running loud level adapts to any room automatically.
const VAD = {
    FRAME_MS:         32,    // how often the waveform is sampled
    SETTLE_MS:        250,   // ignore the first moments after arming
    FLOOR_DOWN:       0.25,  // the quiet level falls quickly...
    FLOOR_UP:         0.002, // ...and rises only grudgingly
    PEAK_UP:          0.5,   // the loud level rises quickly...
    PEAK_DOWN:        0.005, // ...and decays over a few seconds
    SPEECH_FRACTION:  0.30,  // speech starts 30% of the way from floor to peak
    MIN_MARGIN:       0.004, // absolute minimum gap above the floor
    RELEASE_FRACTION: 0.6,   // lower bar to stay in speech, so words don't clip
    MIN_SPEECH_MS:    300,   // shorter than this is a click or a cough
    SILENCE_MS:       850,   // silence after speech that ends the utterance
    MAX_UTTERANCE_MS: 20000, // hard stop; answer rather than record forever
    NO_INPUT_MS:      30000, // nothing heard this long -> re-arm capture
};

const CHUNK_MS         = 250;    // recorder timeslice; each chunk ships at once
const WATCHDOG_MS      = 45000;  // backend silence after which a turn recovers
const PING_MS          = 20000;
const RECONNECT_MS     = [500, 1000, 2000, 4000, 8000];
const NO_METER_TURN_MS = 6000;   // fixed turn length when Web Audio is missing

/**
 * @param {object}   opts
 * @param {string}   opts.backendUrl
 * @param {string}   opts.apiKey
 * @param {function} opts.onState       (state) => void
 * @param {function} opts.onTranscript  (text)  => void  patient speech recognised
 * @param {function} opts.onReply       (text)  => void  therapist reply text
 * @param {function} opts.onNotice      (msg)   => void  non-fatal diagnostics
 * @param {function} opts.getHistory    ()      => [{role,text}]
 * @param {string}   [opts.language]    Sarvam language code (default hi-IN)
 * @param {string}   [opts.mode]        "therapist" | "consultant"
 * @param {string}   [opts.dialect]     e.g. "marwari" (rides on Hindi)
 * @param {function} [opts.onUtteranceMeta] ({listenStart, speechStart, end}) => void
 *                   epoch-ms timing of each submitted utterance, for the
 *                   behavioural channel of the end-of-session analysis
 */
export function createVoiceSession(opts) {
    const {
        backendUrl, apiKey,
        onState = () => {}, onTranscript = () => {},
        onReply = () => {}, onNotice = () => {}, getHistory = () => [],
        language = "hi-IN", mode = "therapist", dialect = "",
        onUtteranceMeta = () => {},
    } = opts;

    // ── Connection ──
    let ws             = null;
    let wsReady        = false;
    let wsGaveUp       = false;   // socket unusable here; stay on HTTP
    let reconnectAt    = 0;
    let reconnectTimer = null;
    let pingTimer      = null;
    let closed         = false;

    // ── Capture ──
    let stream        = null;
    let recorder      = null;
    let pendingSubmit = false;
    let httpChunks    = [];       // only retained on the HTTP fallback
    // Every outbound audio frame is serialised through this one chain, so
    // chunks, begin_utterance and utterance_end can never overtake each
    // other. Per-recorder chains allowed a stale chunk to arrive after the
    // next recording had begun, corrupting that utterance.
    let sendChain     = Promise.resolve();

    // ── Level meter (one per session) ──
    let audioCtx      = null;
    let meterTimer    = null;
    let meterSource   = null;
    let meterBroken   = false;
    let fallbackTimer = null;
    // The room does not change between turns, so these persist for the whole
    // session rather than being re-measured (and mis-measured) at every arm.
    let noiseFloor      = -1;
    let noisePeak       = 0;
    let everHeardSpeech = false;  // gates the dead-microphone warning
    let utt             = null;   // per-utterance decision state

    // ── Turn bookkeeping ──
    let state         = STATE.IDLE;
    let turnSeq       = 0;        // bumped whenever a turn is superseded
    let watchdogTimer = null;
    let turnStreaming = false;    // reply still arriving; empty queue != finished

    // ── Playback ──
    let queue        = [];
    let currentAudio = null;
    let playing      = false;

    // ── Output analysis (drives the orb's mouth and waveform) ──
    let outAnalyser  = null;
    let outFreq      = null;
    let outWave      = null;

    const debug = {
        rms: 0, floor: 0, peak: 0, onset: 0,
        speaking: false, confirmed: false, armed: false,
        turns: 0, lastEvent: "",
    };

    function setState(next) {
        if (state === next) return;
        state = next;
        onState(next);
    }

    // ─────────────────────────────────────────────────────────────────────
    // WebSocket
    // ─────────────────────────────────────────────────────────────────────
    function wsUrl() {
        const base = backendUrl.replace(/^http/i, "ws").replace(/\/+$/, "");
        const q = new URLSearchParams({ key: apiKey, lang: language, mode, dialect });
        return `${base}/ws/session?${q}`;
    }

    function connect() {
        if (closed || wsGaveUp) return;
        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

        let socket;
        try {
            socket = new WebSocket(wsUrl());
        } catch {
            scheduleReconnect();
            return;
        }
        socket.binaryType = "arraybuffer";
        ws = socket;

        socket.onopen = () => {
            wsReady     = true;
            reconnectAt = 0;
            clearInterval(pingTimer);
            pingTimer = setInterval(() => send({ type: "ping" }), PING_MS);
        };

        socket.onmessage = (e) => {
            let msg;
            try { msg = JSON.parse(e.data); } catch { return; }
            handleEvent(msg);
        };

        socket.onerror = () => { /* onclose always follows; handled there */ };

        socket.onclose = () => {
            wsReady = false;
            clearInterval(pingTimer);
            if (!closed) scheduleReconnect();
        };
    }

    function scheduleReconnect() {
        if (closed || wsGaveUp) return;
        clearTimeout(reconnectTimer);

        if (reconnectAt >= RECONNECT_MS.length) {
            // The socket is not going to work here. Keep the conversation alive
            // over HTTP rather than leaving a dead microphone.
            wsGaveUp = true;
            onNotice("Realtime socket unavailable — using HTTP fallback.");
            return;
        }
        reconnectTimer = setTimeout(connect, RECONNECT_MS[reconnectAt++]);
    }

    function send(obj) {
        if (ws && ws.readyState === WebSocket.OPEN) { ws.send(JSON.stringify(obj)); return true; }
        return false;
    }

    function sendAudio(buf) {
        if (ws && ws.readyState === WebSocket.OPEN) { ws.send(buf); return true; }
        return false;
    }

    // ─────────────────────────────────────────────────────────────────────
    // Turn events — identical shape over the socket and the HTTP fallback
    // ─────────────────────────────────────────────────────────────────────
    function handleEvent(msg) {
        debug.lastEvent = msg.type
            + (msg.text ? ":" + msg.text.slice(0, 40) : "")
            + (msg.reason ? ":" + msg.reason : "");

        if (msg.type === "pong" || msg.type === "ready") return;

        // Anything belonging to a superseded turn is ignored outright.
        if (msg.turn !== undefined && msg.turn !== turnSeq) return;

        kickWatchdog();

        switch (msg.type) {
            case "transcript":
                if (msg.text) onTranscript(msg.text);
                break;
            case "reply":
                if (msg.text) onReply(msg.text);
                break;
            case "audio":
                enqueue(msg.b64);
                break;
            case "error":
                onNotice(`Backend error: ${msg.message || "unknown"}`);
                break;
            case "turn_end":
            case "done":
                turnStreaming = false;
                clearTimeout(watchdogTimer);
                // Nothing was produced (silence, or the reply failed): playback
                // will not restart us, so re-arm here.
                if (!playing && queue.length === 0) resumeListening();
                break;
            default:
                break;
        }
    }

    function kickWatchdog() {
        clearTimeout(watchdogTimer);
        if (!turnStreaming) return;
        watchdogTimer = setTimeout(() => {
            onNotice("No response from the backend — listening again.");
            turnStreaming = false;
            resumeListening();
        }, WATCHDOG_MS);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Playback — clips arrive one sentence at a time and must play in order
    // ─────────────────────────────────────────────────────────────────────
    function enqueue(b64) {
        if (!b64 || closed || state === STATE.PAUSED) return;
        queue.push(b64);
        if (!playing) playNext();
    }

    function playNext() {
        if (closed || state === STATE.PAUSED) { playing = false; return; }

        const next = queue.shift();
        if (!next) {
            playing = false;
            if (turnStreaming) return;   // more of the reply is still coming
            resumeListening();
            return;
        }

        playing = true;
        setState(STATE.SPEAKING);
        stopRecording();                 // never record the therapist's own voice

        let url;
        try {
            const bytes = Uint8Array.from(atob(next), (c) => c.charCodeAt(0));
            url = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
        } catch {
            playNext();
            return;
        }

        const audio = new Audio(url);
        currentAudio = audio;
        routeThroughAnalyser(audio);

        const advance = () => {
            URL.revokeObjectURL(url);
            if (currentAudio === audio) currentAudio = null;
            playNext();
        };
        audio.onended = advance;
        audio.onerror = advance;
        audio.play().catch(advance);
    }

    /**
     * Send the reply through an analyser so its loudness and spectrum can be
     * read each frame. Only when the context is running: a media element wired
     * into a suspended context plays silence, and speech matters more than
     * the animation.
     */
    function routeThroughAnalyser(audio) {
        try {
            if (!audioCtx || audioCtx.state !== "running") return;
            if (!outAnalyser) {
                outAnalyser = audioCtx.createAnalyser();
                outAnalyser.fftSize = 512;
                outAnalyser.smoothingTimeConstant = 0.6;
                outAnalyser.connect(audioCtx.destination);
                outFreq = new Uint8Array(outAnalyser.frequencyBinCount);
                outWave = new Float32Array(outAnalyser.fftSize);
            }
            audioCtx.createMediaElementSource(audio).connect(outAnalyser);
        } catch { /* plain playback still works */ }
    }

    /** Loudness (0–1) and nine log-spaced bands (0–1) of the agent's voice. */
    function readLevels() {
        if (!outAnalyser || state !== STATE.SPEAKING) return { level: 0, bands: null };
        outAnalyser.getFloatTimeDomainData(outWave);
        let sum = 0;
        for (let i = 0; i < outWave.length; i++) sum += outWave[i] * outWave[i];
        const level = Math.min(1, Math.sqrt(sum / outWave.length) * 4.5);

        outAnalyser.getByteFrequencyData(outFreq);
        // Speech energy lives roughly between 90 Hz and 6 kHz.
        const nyquist = audioCtx.sampleRate / 2;
        const binHz = nyquist / outFreq.length;
        const bands = [];
        for (let b = 0; b < 9; b++) {
            const lo = 90 * Math.pow(6000 / 90, b / 9);
            const hi = 90 * Math.pow(6000 / 90, (b + 1) / 9);
            const i0 = Math.max(0, Math.floor(lo / binHz));
            const i1 = Math.max(i0 + 1, Math.ceil(hi / binHz));
            let m = 0;
            for (let i = i0; i < i1 && i < outFreq.length; i++) m = Math.max(m, outFreq[i]);
            bands.push(Math.pow(m / 255, 1.6));
        }
        return { level, bands };
    }

    function stopPlayback() {
        queue = [];
        playing = false;
        if (currentAudio) {
            currentAudio.onended = null;
            currentAudio.onerror = null;
            try { currentAudio.pause(); } catch { /* already stopped */ }
            currentAudio = null;
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Microphone
    // ─────────────────────────────────────────────────────────────────────
    function startRecording() {
        if (recorder || !stream || closed || state === STATE.PAUSED) return;

        const tracks = stream.getAudioTracks();
        if (!tracks.length) {
            setState(STATE.ERROR);
            onNotice("No microphone track available.");
            return;
        }

        let options = { mimeType: "audio/webm;codecs=opus" };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: "audio/webm" };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) options = {};

        let rec;
        try {
            rec = new MediaRecorder(new MediaStream(tracks), options);
        } catch (err) {
            setState(STATE.ERROR);
            onNotice(`MediaRecorder failed: ${err && err.message}`);
            return;
        }

        const useHttp = wsGaveUp || !wsReady;
        httpChunks = [];

        // Announce the new utterance on the shared chain. The server drops
        // anything still buffered, so a partial recording that was abandoned
        // (the therapist started speaking, the session paused) cannot be
        // prepended to this one.
        if (!useHttp) {
            sendChain = sendChain
                .then(() => send({ type: "begin_utterance" }))
                .catch(() => {});
        }

        rec.ondataavailable = (e) => {
            if (!e.data || e.data.size === 0) return;
            if (useHttp) {
                httpChunks.push(e.data);
            } else {
                // Ship each slice as it appears, so the upload is already done
                // when the patient stops talking.
                sendChain = sendChain
                    .then(() => e.data.arrayBuffer())
                    .then(sendAudio)
                    .catch(() => {});
            }
        };

        rec.onstop = () => {
            utt = null;
            if (recorder === rec) recorder = null;

            if (pendingSubmit) {
                pendingSubmit = false;
                submitUtterance(useHttp, rec.mimeType || "audio/webm");
            }
            // An abandoned recording needs no cleanup message: the next
            // begin_utterance clears the server buffer, and ordering on the
            // shared chain guarantees it arrives first.
        };

        rec.onerror = () => {
            utt = null;
            if (recorder === rec) recorder = null;
            onNotice("Recorder error — restarting capture.");
            setTimeout(() => { if (!closed) startRecording(); }, 400);
        };

        recorder = rec;
        try {
            rec.start(CHUNK_MS);
        } catch (err) {
            recorder = null;
            onNotice(`Could not start recording: ${err && err.message}`);
            return;
        }

        debug.armed = true;
        utt = {
            started: Date.now(), speechStart: null, silenceStart: null,
            confirmed: false, speaking: false, sawSignal: false,
        };
        setState(STATE.LISTENING);

        if (meterBroken) {
            // No level meter: submit a fixed-length turn so the conversation
            // still moves rather than recording indefinitely.
            clearTimeout(fallbackTimer);
            fallbackTimer = setTimeout(finishUtterance, NO_METER_TURN_MS);
        }
    }

    function stopRecording() {
        debug.armed = false;
        utt = null;
        clearTimeout(fallbackTimer);
        pendingSubmit = false;
        if (recorder && recorder.state !== "inactive") {
            try { recorder.stop(); } catch { /* already stopping */ }
        }
        recorder = null;
    }

    /** End the current utterance and ask the backend for a reply. */
    function finishUtterance() {
        if (!recorder || recorder.state === "inactive") return;
        if (utt) {
            onUtteranceMeta({
                listenStart: utt.started,
                speechStart: utt.speechStart || utt.started,
                end:         Date.now(),
            });
        }
        pendingSubmit = true;
        utt = null;
        debug.armed = false;
        clearTimeout(fallbackTimer);
        try { recorder.stop(); } catch { pendingSubmit = false; }
    }

    function submitUtterance(useHttp, mimeType) {
        turnSeq      += 1;
        debug.turns  += 1;
        turnStreaming = true;
        setState(STATE.THINKING);
        kickWatchdog();

        if (useHttp) {
            const blob = new Blob(httpChunks, { type: mimeType });
            httpChunks = [];
            postUtterance(blob, turnSeq);
        } else {
            // Only after every queued chunk has actually gone out, or the
            // server would answer a sentence missing its ending.
            const myTurn = turnSeq;
            sendChain = sendChain
                .then(() => {
                    if (myTurn !== turnSeq) return;   // superseded meanwhile
                    // The client owns the turn id and the server echoes it
                    // back. Two independent counters would drift apart the
                    // first time a turn was cancelled, and every reply after
                    // that would be discarded as stale.
                    send({ type: "utterance_end", turn: myTurn, history: getHistory() });
                })
                .catch(() => {});
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Level meter — one for the whole session (see the header note)
    // ─────────────────────────────────────────────────────────────────────
    function startMeter() {
        if (meterTimer || meterBroken) return;

        let analyser, buf;
        try {
            if (!audioCtx || audioCtx.state === "closed") {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtx.state === "suspended") audioCtx.resume();

            meterSource = audioCtx.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 1024;
            meterSource.connect(analyser);
            buf = new Float32Array(analyser.fftSize);
        } catch {
            onNotice("Voice detection unavailable — using fixed-length turns.");
            meterBroken = true;
            return;
        }

        meterTimer = setInterval(() => {
            // True waveform RMS. Frequency-bin magnitudes scale with gain and
            // codec; this is the actual signal level.
            analyser.getFloatTimeDomainData(buf);
            let sum = 0;
            for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
            const rms = Math.sqrt(sum / buf.length);
            debug.rms = rms;

            // Never learn the room from the therapist's own voice coming back
            // through the speakers.
            if (state !== STATE.SPEAKING) {
                if (noiseFloor < 0) { noiseFloor = rms; noisePeak = rms; }
                else if (rms < noiseFloor) noiseFloor = rms * VAD.FLOOR_DOWN + noiseFloor * (1 - VAD.FLOOR_DOWN);
                else                       noiseFloor = rms * VAD.FLOOR_UP   + noiseFloor * (1 - VAD.FLOOR_UP);

                if (rms > noisePeak) noisePeak = rms * VAD.PEAK_UP   + noisePeak * (1 - VAD.PEAK_UP);
                else                 noisePeak = rms * VAD.PEAK_DOWN + noisePeak * (1 - VAD.PEAK_DOWN);
                if (noisePeak < noiseFloor) noisePeak = noiseFloor;
            }

            const span    = Math.max(noisePeak - noiseFloor, 0);
            const onset   = noiseFloor + Math.max(span * VAD.SPEECH_FRACTION, VAD.MIN_MARGIN);
            const release = noiseFloor + (onset - noiseFloor) * VAD.RELEASE_FRACTION;

            debug.floor = noiseFloor;
            debug.peak  = noisePeak;
            debug.onset = onset;

            // Levels keep adapting even when not armed; endpointing does not.
            if (!utt || !recorder || recorder.state === "inactive") return;

            if (rms > 0.0001) utt.sawSignal = true;
            const elapsed = Date.now() - utt.started;
            if (elapsed < VAD.SETTLE_MS) return;

            // Speech starts partway up the observed dynamic range; once under
            // way the bar drops (but stays above the floor), so pauses between
            // words do not end the utterance early.
            utt.speaking    = rms > (utt.speaking ? release : onset);
            debug.speaking  = utt.speaking;
            debug.confirmed = utt.confirmed;

            if (utt.speaking) {
                if (!utt.speechStart) utt.speechStart = Date.now();
                utt.silenceStart = null;
                if (!utt.confirmed && Date.now() - utt.speechStart >= VAD.MIN_SPEECH_MS) {
                    utt.confirmed   = true;
                    everHeardSpeech = true;
                }
            } else if (!utt.confirmed) {
                if (utt.speechStart && Date.now() - utt.speechStart < VAD.MIN_SPEECH_MS) {
                    utt.speechStart = null;          // just a noise burst
                }
            } else {
                if (!utt.silenceStart) utt.silenceStart = Date.now();
                if (Date.now() - utt.silenceStart >= VAD.SILENCE_MS) {
                    finishUtterance();
                    return;
                }
            }

            // Someone talking without pause still gets answered.
            if (utt.confirmed && elapsed >= VAD.MAX_UTTERANCE_MS) {
                finishUtterance();
                return;
            }

            // Nothing at all for a long stretch: re-arm, so a wedged recorder
            // or a muted device cannot strand the session.
            if (!utt.confirmed && elapsed >= VAD.NO_INPUT_MS) {
                if (!everHeardSpeech && !utt.sawSignal) {
                    onNotice("No sound from the microphone — check your input device.");
                }
                stopRecording();
                setTimeout(() => { if (!closed) startRecording(); }, 200);
            }
        }, VAD.FRAME_MS);
    }

    function stopMeter() {
        clearInterval(meterTimer);
        meterTimer = null;
        if (meterSource) {
            try { meterSource.disconnect(); } catch { /* already gone */ }
            meterSource = null;
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // HTTP fallback — the same events, delivered as SSE
    // ─────────────────────────────────────────────────────────────────────
    async function postUtterance(blob, myTurn) {
        const fd = new FormData();
        fd.append("audio", blob, "speech.webm");
        fd.append("history", JSON.stringify(getHistory()));
        fd.append("lang", language);
        fd.append("mode", mode);
        fd.append("dialect", dialect);

        try {
            const res = await fetch(`${backendUrl}/api/converse`, {
                method: "POST",
                headers: { "X-API-Key": apiKey },
                body: fd,
            });
            if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

            const reader  = res.body.getReader();
            const decoder = new TextDecoder();
            let   buffer  = "";

            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                if (myTurn !== turnSeq) { reader.cancel().catch(() => {}); return; }

                buffer += decoder.decode(value, { stream: true });
                const frames = buffer.split("\n\n");
                buffer = frames.pop();

                for (const frame of frames) {
                    const line = frame.split("\n").find((l) => l.startsWith("data: "));
                    if (!line) continue;
                    try { handleEvent({ ...JSON.parse(line.slice(6)), turn: myTurn }); }
                    catch { /* skip malformed frame */ }
                }
            }
            handleEvent({ type: "turn_end", turn: myTurn });
        } catch (err) {
            onNotice(`Turn failed: ${err && err.message}`);
            if (myTurn === turnSeq) {
                turnStreaming = false;
                resumeListening();
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────────────────────────────────
    function resumeListening() {
        if (closed || state === STATE.PAUSED) return;
        if (playing || turnStreaming) return;
        startRecording();
    }

    return {
        STATE,

        /** Provide the mic/camera stream, start metering and open the socket. */
        attach(mediaStream) {
            stream = mediaStream;
            startMeter();          // one meter for the whole session
            connect();
        },

        /** Begin listening (called once the greeting has played). */
        start() {
            closed = false;
            // Called from a click: the one moment a suspended context may resume.
            if (audioCtx && audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
            resumeListening();
        },

        /** Play one backend-supplied clip (greeting / closing). */
        speak(b64) {
            turnStreaming = false;
            enqueue(b64);
        },

        /** Stop listening and speaking, keeping the socket open. */
        pause() {
            setState(STATE.PAUSED);
            turnSeq += 1;          // abandon any in-flight turn
            turnStreaming = false;
            send({ type: "cancel" });
            stopRecording();
            stopPlayback();
            clearTimeout(watchdogTimer);
        },

        resume() {
            if (closed) return;
            setState(STATE.IDLE);
            resumeListening();
        },

        /** Silence the therapist and drop the current turn (used when ending). */
        interrupt() {
            turnSeq += 1;
            turnStreaming = false;
            send({ type: "cancel" });
            stopRecording();
            stopPlayback();
            clearTimeout(watchdogTimer);
        },

        /** True once nothing is queued or playing. */
        isQuiet() {
            return !playing && queue.length === 0 && !turnStreaming;
        },

        getState() { return state; },

        /** Call from a click handler: lets a context created before any gesture run. */
        unlock() {
            if (audioCtx && audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
        },

        /** {level, bands} of the agent's voice this frame (zeros when silent). */
        levels() { return readLevels(); },

        /** Live detector readings, for diagnosing a session in the field. */
        debug() { return { ...debug, state, wsReady, wsGaveUp }; },

        /** Tear everything down. */
        close() {
            closed = true;
            clearTimeout(reconnectTimer);
            clearTimeout(watchdogTimer);
            clearTimeout(fallbackTimer);
            clearInterval(pingTimer);
            stopRecording();
            stopMeter();
            stopPlayback();
            if (ws) { try { ws.close(); } catch { /* already closed */ } ws = null; }
            if (audioCtx) { try { audioCtx.close(); } catch { /* already closed */ } audioCtx = null; }
            outAnalyser = null;
            setState(STATE.IDLE);
        },
    };
}

export { STATE };
