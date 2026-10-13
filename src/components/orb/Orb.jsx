// The AI agent our students built: a glowing sphere with a face, after the
// reference the client sent. Teal and calm (dot eyes) while it listens;
// magenta while it speaks, with tall eyes, a mouth and a waveform that
// follow its voice (loudness and nine bands per frame).
//
// The face and waveform were drawn for r = 170; `k` scales them with the orb
// so it reads the same at any size.

import React from "react";

import { clamp01, lerp, rnd } from "./kit.js";

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, k) => {
  const [x, y] = [hex(a), hex(b)];
  return `rgb(${x.map((v, i) => Math.round(lerp(v, y[i], k))).join(",")})`;
};
const mixA = (a, b, k, alpha) => mix(a, b, k).replace("rgb(", "rgba(").replace(")", `,${alpha})`);

const CALM = { hi: "#57B9DA", mid: "#1C5D86", low: "#0A1C33", aura: "#19B4CF", eye: "#E6FBFF" };
const TALK = { hi: "#FF5CAF", mid: "#B3125F", low: "#33041F", aura: "#E0157A", eye: "#FFFFFF" };
const DESIGN_R = 170;

/**
 * The orb at (x, y), radius r. `form` (0–1) brings it out of the light;
 * `talk` (0–1) turns it from calm to speaking; `level` and `bands` are its
 * voice this frame; `happy` (0–1) curves its eyes into a smile.
 */
export function Orb({ t, x, y, r, form = 1, talk = 0, level = 0, bands = null, happy = 0 }) {
  if (form <= 0) return null;
  const k = r / DESIGN_R;
  const c = (key) => mix(CALM[key], TALK[key], talk);
  const bob = Math.sin(t * 1.5) * 7 * k;
  const sc = (0.55 + 0.45 * form) * (1 + 0.04 * level * talk);
  const cy = y + bob;
  // a blink every few seconds (not while speaking hard)
  const cyc = (t + 0.7) % 3.7;
  const blink = cyc > 3.52 ? 1 - Math.sin(((cyc - 3.52) / 0.18) * Math.PI) * 0.9 : 1;
  const eyeW = lerp(19, 21, talk);
  const eyeH = lerp(19, 52, talk) * blink;
  const mouthW = lerp(26, 30 + 10 * level, talk);
  const mouthH = lerp(5, 6 + 14 * level, talk);
  const look = Math.sin(t * 0.6) * 6 * (1 - talk);
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {/* aura */}
      <div style={{
        position: "absolute", left: x - r * 3.2, top: cy - r * 3.2, width: r * 6.4, height: r * 6.4, opacity: form * (0.8 + 0.2 * level * talk),
        background: `radial-gradient(circle, ${mixA(CALM.aura, TALK.aura, talk, 0.85)} 0%, ${mixA(CALM.aura, TALK.aura, talk, 0.46)} 24%, ${mixA(CALM.aura, TALK.aura, talk, 0.15)} 44%, rgba(0,0,0,0) 66%)`,
      }} />
      <Particles t={t} x={x} y={cy} r={r} form={form} color={c("aura")} />
      {/* the sphere */}
      <div style={{ position: "absolute", left: x - r, top: cy - r, width: r * 2, height: r * 2, transform: `scale(${sc})`, opacity: Math.min(1, form * 1.6) }}>
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: `radial-gradient(circle at 36% 30%, ${c("hi")} 0%, ${c("mid")} 46%, ${c("low")} 100%)`,
          boxShadow: `0 0 ${r * 0.5}px ${mixA(CALM.aura, TALK.aura, talk, 0.55)}, inset ${-r * 0.12}px ${-r * 0.2}px ${r * 0.45}px rgba(0,0,0,.45), inset ${r * 0.06}px ${r * 0.08}px ${r * 0.3}px rgba(255,255,255,.14)`,
        }} />
        {/* a sheen across the top */}
        <div style={{ position: "absolute", left: r * 0.36, top: r * 0.16, width: r * 0.9, height: r * 0.5, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(255,255,255,.28), rgba(255,255,255,0) 70%)", transform: "rotate(-24deg)" }} />
        {/* the face (drawn in r = 170 units) */}
        <svg width={r * 2} height={r * 2} viewBox={`${-DESIGN_R} ${-DESIGN_R} ${DESIGN_R * 2} ${DESIGN_R * 2}`} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <defs>
            <filter id="orb-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="5" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <g filter="url(#orb-glow)" transform={`translate(${look} 0)`}>
            {[-1, 1].map((side) => (
              <React.Fragment key={side}>
                <rect x={side * 34 - eyeW / 2} y={-14 - eyeH / 2} width={eyeW} height={Math.max(2, eyeH)} rx={eyeW / 2} fill={c("eye")} opacity={1 - happy} />
                {happy > 0 && <path d={`M ${side * 34 - 14} -8 Q ${side * 34} -26 ${side * 34 + 14} -8`} fill="none" stroke={c("eye")} strokeWidth={7} strokeLinecap="round" opacity={happy} />}
              </React.Fragment>
            ))}
            <rect x={-mouthW / 2} y={30 - mouthH / 2} width={mouthW} height={mouthH} rx={mouthH / 2} fill={c("eye")} opacity={0.85} />
          </g>
        </svg>
      </div>
      {/* its voice */}
      {talk > 0.01 && (
        <svg width={260 * k} height={120 * k} viewBox="-130 -60 260 120" style={{ position: "absolute", left: x - 130 * k, top: cy + r * sc + 34 * k, overflow: "visible", opacity: talk }}>
          <g filter="url(#orb-glow)">
            {Array.from({ length: 9 }, (_, i) => {
              const b = bands ? bands[i] : 0;
              const h = 6 + clamp01(b * 1.1) * 74 * (0.7 + 0.3 * Math.sin(t * 17 + i * 1.9));
              return <rect key={i} x={(i - 4) * 18 - 4} y={-h / 2} width={8} height={h} rx={4} fill={c("aura")} />;
            })}
          </g>
        </svg>
      )}
    </div>
  );
}

/** Motes that circle the orb, gathering in from far away as it forms. */
function Particles({ t, x, y, r, form, color }) {
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      {Array.from({ length: 34 }, (_, i) => {
        const tilt = rnd(i, 1) * Math.PI;
        const orbit = r * (1.35 + rnd(i, 2) * 0.9);
        const far = 900 + rnd(i, 3) * 500;
        const rad = lerp(far, orbit, form);
        const a = rnd(i, 4) * Math.PI * 2 + t * (0.25 + rnd(i, 5) * 0.35) * (i % 2 ? 1 : -1) + (1 - form) * 2.4;
        const px = x + Math.cos(a) * rad;
        const py = y + Math.sin(a) * rad * (0.35 + 0.5 * Math.abs(Math.cos(tilt)));
        const size = 1.5 + rnd(i, 6) * 3;
        return <circle key={i} cx={px} cy={py} r={size} fill={color} opacity={(0.25 + rnd(i, 7) * 0.6) * Math.min(1, form * 1.4)} />;
      })}
    </svg>
  );
}
