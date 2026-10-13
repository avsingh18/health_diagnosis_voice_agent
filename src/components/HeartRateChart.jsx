import React, { useEffect, useMemo, useRef, useState } from "react";

// Heart rate across the consultation, one line. Shaded bands mark when the
// patient was speaking (labelled P1, P2…, matching the transcript), and the
// dashed line is their resting baseline from the first minute — so a rise
// while describing a symptom is visible at a glance. Hover for exact values.

const M = { l: 44, r: 18, t: 18, b: 30 };
const LINE = "#D6246E";

const mmss = (ms) => {
    const s = Math.max(0, Math.round(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export default function HeartRateChart({ samples = [], baseline = null, turns = [], height = 260 }) {
    const boxRef = useRef(null);
    const [w, setW] = useState(640);
    const [hover, setHover] = useState(null);

    useEffect(() => {
        const el = boxRef.current;
        if (!el) return undefined;
        const ro = new ResizeObserver(([e]) => setW(Math.max(280, e.contentRect.width)));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const geo = useMemo(() => {
        if (samples.length < 2) return null;
        const tMax = Math.max(samples[samples.length - 1].t, ...turns.map((t) => t.end || 0));
        const vals = samples.map((s) => s.bpm);
        let lo = Math.min(...vals, baseline ?? Infinity) - 6;
        let hi = Math.max(...vals, baseline ?? -Infinity) + 6;
        lo = Math.floor(lo / 10) * 10;
        hi = Math.ceil(hi / 10) * 10;
        const iw = w - M.l - M.r, ih = height - M.t - M.b;
        const x = (t) => M.l + (t / (tMax || 1)) * iw;
        const y = (v) => M.t + (1 - (v - lo) / (hi - lo)) * ih;
        const d = samples.map((s, i) => `${i ? "L" : "M"}${x(s.t).toFixed(1)},${y(s.bpm).toFixed(1)}`).join("");
        const step = (hi - lo) / 4;
        const yTicks = Array.from({ length: 5 }, (_, i) => Math.round(lo + i * step));
        const minuteMs = tMax > 8 * 60000 ? 120000 : 60000;
        const xTicks = [];
        for (let t = 0; t <= tMax; t += tMax < 90000 ? 15000 : minuteMs) xTicks.push(t);
        const peak = samples.reduce((a, b) => (b.bpm > a.bpm ? b : a));
        return { x, y, d, yTicks, xTicks, lo, hi, tMax, peak, iw };
    }, [samples, baseline, turns, w, height]);

    if (!geo) {
        return <div ref={boxRef} className="hrc-empty">Not enough heart-rate data was recorded in this session.</div>;
    }

    const onMove = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const t = ((px - M.l) / geo.iw) * geo.tMax;
        let best = samples[0];
        for (const s of samples) if (Math.abs(s.t - t) < Math.abs(best.t - t)) best = s;
        const turn = turns.find((tr) => best.t >= tr.start && best.t <= tr.end);
        setHover({ s: best, turn });
    };

    return (
        <div ref={boxRef} className="hrc" style={{ position: "relative" }}>
            <svg width={w} height={height} role="img" aria-label="Heart rate over the session"
                 onMouseMove={onMove} onMouseLeave={() => setHover(null)} style={{ display: "block" }}>
                {/* patient speaking windows */}
                {turns.map((tr) => (
                    <g key={tr.label}>
                        <rect x={geo.x(tr.start)} y={M.t} width={Math.max(2, geo.x(tr.end) - geo.x(tr.start))}
                              height={height - M.t - M.b} fill="var(--hrc-band)" />
                        <text x={geo.x(tr.start) + 3} y={M.t + 11} fontSize="10" fontWeight="600" fill="var(--hrc-muted)">{tr.label}</text>
                    </g>
                ))}
                {/* grid + axes */}
                {geo.yTicks.map((v) => (
                    <g key={v}>
                        <line x1={M.l} x2={w - M.r} y1={geo.y(v)} y2={geo.y(v)} stroke="var(--hrc-grid)" strokeWidth="1" />
                        <text x={M.l - 8} y={geo.y(v) + 4} textAnchor="end" fontSize="11" fill="var(--hrc-muted)">{v}</text>
                    </g>
                ))}
                {geo.xTicks.map((t) => (
                    <text key={t} x={geo.x(t)} y={height - 10} textAnchor="middle" fontSize="11" fill="var(--hrc-muted)">{mmss(t)}</text>
                ))}
                <text x={M.l - 8} y={M.t - 6} textAnchor="end" fontSize="10" fill="var(--hrc-muted)">bpm</text>

                {baseline != null && (
                    <g>
                        <line x1={M.l} x2={w - M.r} y1={geo.y(baseline)} y2={geo.y(baseline)}
                              stroke="var(--hrc-ink2)" strokeWidth="1.5" strokeDasharray="5 4" />
                        <text x={w - M.r} y={geo.y(baseline) - 6} textAnchor="end" fontSize="11" fontWeight="500" fill="var(--hrc-ink2)">
                            baseline {Math.round(baseline)}
                        </text>
                    </g>
                )}

                <path d={geo.d} fill="none" stroke={LINE} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

                {/* peak, labelled once */}
                <circle cx={geo.x(geo.peak.t)} cy={geo.y(geo.peak.bpm)} r="4.5" fill={LINE} stroke="var(--hrc-surface)" strokeWidth="2" />
                <text x={geo.x(geo.peak.t)} y={geo.y(geo.peak.bpm) - 10} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--hrc-ink)">
                    Peak {geo.peak.bpm}
                </text>

                {hover && (
                    <g pointerEvents="none">
                        <line x1={geo.x(hover.s.t)} x2={geo.x(hover.s.t)} y1={M.t} y2={height - M.b} stroke="var(--hrc-ink2)" strokeWidth="1" />
                        <circle cx={geo.x(hover.s.t)} cy={geo.y(hover.s.bpm)} r="5" fill={LINE} stroke="var(--hrc-surface)" strokeWidth="2" />
                    </g>
                )}
            </svg>
            {hover && (
                <div className="hrc-tip" style={{
                    left: Math.min(Math.max(geo.x(hover.s.t) + 12, 0), w - 210),
                    top: Math.max(4, geo.y(hover.s.bpm) - 64),
                }}>
                    <b>{hover.s.bpm} bpm</b> <span>at {mmss(hover.s.t)}</span>
                    {baseline != null && <div>{hover.s.bpm - Math.round(baseline) >= 0 ? "+" : ""}{hover.s.bpm - Math.round(baseline)} vs baseline</div>}
                    {hover.turn && <div className="hrc-tip-q">{hover.turn.label}: “{hover.turn.text.slice(0, 70)}{hover.turn.text.length > 70 ? "…" : ""}”</div>}
                </div>
            )}
        </div>
    );
}
