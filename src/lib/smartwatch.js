/**
 * smartwatch.js — live vitals for the consultation.
 *
 * HEART RATE (real): Web Bluetooth, standard GATT Heart Rate service
 * (0x180D, measurement characteristic 0x2A37) — the same service nRF Connect
 * shows when a Boult watch is broadcasting heart rate. Boult's firmware only
 * exposes heart rate to third parties, so that is the only reading taken from
 * the watch. Needs Chrome/Edge on desktop or Android, over https or localhost.
 *
 * EVERYTHING ELSE (simulated): SpO₂, stress, calories, sleep and workout are
 * computed on the watch but not published over BLE yet, so they are simulated
 * here — stress and calories follow the live heart rate so they move
 * plausibly. Every simulated value is labelled as such in the UI and report.
 *
 * When no watch is paired, `createDemoHeartRate` stands in so the session and
 * report still work end to end; the report marks the source as "simulated".
 */

// Boult watches, and generic white-label watches such as "Smartwatch SJ" that
// expose the standard Heart Rate service without advertising it.
const NAME_PREFIXES = ["Boult", "BOULT", "boult", "Smartwatch", "SmartWatch", "SJ"];

export const isBluetoothSupported = () =>
    typeof navigator !== "undefined" && !!navigator.bluetooth;

// Moyoung / Da Fit firmware (white-label watches such as "Smartwatch SJ",
// manufacturer "MOYOUNG-V2") has the standard Heart Rate service but stays
// silent until a measurement is started through its own command channel:
// service 0xFEEA, write characteristic 0xFEE2, packet FE EA 10 <len> <cmd> <payload>.
// Command 109 with payload 0 starts heart-rate measurement, 0xFF stops it.
// Verified against a Smartwatch SJ: 2A37 then notifies about once a second.
const MOYOUNG_SERVICE = 0xfeea;
const MOYOUNG_WRITE   = 0xfee2;
const MOYOUNG_CMD_HR  = 109;
const MOYOUNG_REARM_MS = 40000;   // the watch ends a measurement on its own
const moyoungPacket = (cmd, payload) => new Uint8Array([0xfe, 0xea, 0x10, 5 + payload.length, cmd, ...payload]);

/** Parse a Heart Rate Measurement (0x2A37) value. */
function parseHeartRate(dv) {
    const flags = dv.getUint8(0);
    return flags & 0x01 ? dv.getUint16(1, true) : dv.getUint8(1);
}

/**
 * @param {object}   cb
 * @param {function} cb.onHeartRate (bpm) => void
 * @param {function} cb.onStatus    ({ state, device, battery, error }) => void
 *        state: "idle" | "pairing" | "connected" | "reconnecting" | "disconnected" | "error"
 */
export function createWatchLink({ onHeartRate = () => {}, onStatus = () => {} } = {}) {
    let device = null;
    let characteristic = null;
    let wanted = false;          // false once the user disconnects on purpose
    let retries = 0;
    let trigger = null;          // Moyoung command characteristic, if present
    let rearmTimer = null;

    const status = (state, extra = {}) =>
        onStatus({ state, device: device?.name || "", ...extra });

    const onValue = (e) => {
        const bpm = parseHeartRate(e.target.value);
        if (bpm > 25 && bpm < 230) onHeartRate(bpm);   // drop sensor warm-up zeros
    };

    async function subscribe() {
        const server = await device.gatt.connect();
        const service = await server.getPrimaryService("heart_rate");
        characteristic = await service.getCharacteristic("heart_rate_measurement");
        characteristic.addEventListener("characteristicvaluechanged", onValue);
        await characteristic.startNotifications();

        // Moyoung watches: start the measurement, and keep it running.
        clearInterval(rearmTimer);
        trigger = null;
        try {
            const ms = await server.getPrimaryService(MOYOUNG_SERVICE);
            trigger = await ms.getCharacteristic(MOYOUNG_WRITE);
            const start = () => trigger?.writeValueWithoutResponse(moyoungPacket(MOYOUNG_CMD_HR, [0])).catch(() => {});
            await start();
            rearmTimer = setInterval(start, MOYOUNG_REARM_MS);
        } catch { /* a standard watch streams on its own */ }

        let battery = null;
        try {
            const bs = await server.getPrimaryService("battery_service");
            const lvl = await bs.getCharacteristic("battery_level");
            battery = (await lvl.readValue()).getUint8(0);
        } catch { /* battery is optional */ }

        retries = 0;
        status("connected", { battery });
    }

    async function onDisconnected() {
        characteristic = null;
        clearInterval(rearmTimer);
        if (!wanted || retries >= 3) { status("disconnected"); return; }
        retries += 1;
        status("reconnecting");
        await new Promise((r) => setTimeout(r, 800 * retries));
        try { await subscribe(); } catch { onDisconnected(); }
    }

    return {
        /** Must be called from a click: the browser shows its device chooser. */
        async connect() {
            if (!isBluetoothSupported()) {
                status("error", { error: "Web Bluetooth is not available in this browser. Use Chrome or Edge." });
                return false;
            }
            status("pairing");
            try {
                device = await navigator.bluetooth.requestDevice({
                    filters: [
                        { services: ["heart_rate"] },
                        ...NAME_PREFIXES.map((namePrefix) => ({ namePrefix })),
                    ],
                    optionalServices: ["heart_rate", "battery_service", MOYOUNG_SERVICE],
                });
                wanted = true;
                device.addEventListener("gattserverdisconnected", onDisconnected);
                await subscribe();
                return true;
            } catch (err) {
                const cancelled = err && err.name === "NotFoundError";
                status(cancelled ? "idle" : "error", {
                    error: cancelled ? "" : (err && err.message) || "Could not connect to the watch.",
                });
                return false;
            }
        },

        disconnect() {
            wanted = false;
            clearInterval(rearmTimer);
            try { trigger?.writeValueWithoutResponse(moyoungPacket(MOYOUNG_CMD_HR, [0xff])).catch(() => {}); } catch { /* gone */ }
            try { characteristic?.removeEventListener("characteristicvaluechanged", onValue); } catch { /* gone */ }
            try { device?.gatt?.connected && device.gatt.disconnect(); } catch { /* gone */ }
            status("disconnected");
        },
    };
}

/** Demo heart rate: a slow random walk with occasional bumps, ~1 Hz. */
export function createDemoHeartRate(onHeartRate, base = 74) {
    let hr = base + Math.random() * 6;
    let bump = 0;
    const id = setInterval(() => {
        if (Math.random() < 0.03) bump = 8 + Math.random() * 10;
        bump *= 0.93;
        hr += (base - hr) * 0.08 + (Math.random() - 0.5) * 2.4;
        onHeartRate(Math.round(hr + bump));
    }, 1000);
    return { stop: () => clearInterval(id) };
}

/**
 * Simulated watch metrics. `getHeartRate()` lets stress and calories track the
 * live (or demo) heart rate. Call tick() about once a second.
 */
export function createVitalsSimulator(getHeartRate) {
    const seed = Math.random();
    let spo2 = 97 + seed;
    let stress = 30 + seed * 15;
    let calories = Math.round(850 + seed * 500);          // kcal burned so far today
    const sleepHours = 6 + seed * 1.6;
    const sleep = {
        total_min: Math.round(sleepHours * 60),
        deep_min: Math.round(sleepHours * 60 * (0.16 + seed * 0.06)),
        rem_min: Math.round(sleepHours * 60 * (0.19 + seed * 0.04)),
        awake_min: Math.round(10 + seed * 25),
        score: Math.round(62 + seed * 26),
    };
    sleep.light_min = sleep.total_min - sleep.deep_min - sleep.rem_min;
    const workout = {
        steps: Math.round(3200 + seed * 5200),
        active_min: Math.round(18 + seed * 40),
        last: seed > 0.5 ? "Brisk walk · 26 min" : "Walk · 18 min",
    };

    const series = { spo2: [], stress: [] };

    return {
        tick(tMs) {
            const hr = getHeartRate() || 75;
            spo2 += (97.6 - spo2) * 0.1 + (Math.random() - 0.5) * 0.5;
            spo2 = Math.max(94, Math.min(99.5, spo2));
            const target = Math.max(8, Math.min(92, (hr - 58) * 1.7 + 12));
            stress += (target - stress) * 0.08 + (Math.random() - 0.5) * 2;
            calories += (1.25 + Math.max(0, hr - 70) * 0.045) / 60;   // kcal per second
            if (tMs !== undefined && Math.round(tMs / 1000) % 5 === 0) {
                series.spo2.push({ t: tMs, v: Math.round(spo2) });
                series.stress.push({ t: tMs, v: Math.round(stress) });
            }
            return this.snapshot();
        },
        snapshot() {
            return {
                spo2: Math.round(spo2),
                stress: Math.round(stress),
                stress_level: stress < 30 ? "Relaxed" : stress < 60 ? "Normal" : stress < 80 ? "Medium" : "High",
                calories: Math.round(calories),
                sleep, workout,
            };
        },
        export() {
            return { ...this.snapshot(), series, simulated: true };
        },
    };
}
