import React, { useEffect, useRef, useState } from "react";

import { Orb } from "./Orb.jsx";
import { lerp } from "./kit.js";

/**
 * Fills its parent and keeps the Orb animated: measures the box, runs the
 * frame clock, eases between calm and speaking, and samples the agent's
 * voice each frame through `getLevels()` → { level, bands }.
 *
 * The parent must be positioned (relative/absolute/fixed).
 */
export default function OrbStage({ speaking = false, happy = false, getLevels, yFrac = 0.42, rFrac = 0.17, maxR = 170 }) {
  const boxRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [frame, setFrame] = useState({ t: 0, form: 0, talk: 0, level: 0, bands: null, happy: 0 });
  const live = useRef({ speaking, happy, getLevels });
  useEffect(() => { live.current = { speaking, happy, getLevels }; }, [speaking, happy, getLevels]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    let prev = { form: 0, talk: 0, level: 0, happy: 0 };
    const tick = (now) => {
      const t = (now - t0) / 1000;
      const { speaking: sp, happy: hp, getLevels: gl } = live.current;
      let level = 0, bands = null;
      if (gl) {
        try { ({ level = 0, bands = null } = gl() || {}); } catch { /* no voice this frame */ }
      }
      // The orb gathers itself over ~1.6 s, then eases between moods.
      const form = Math.min(1, t / 1.6);
      const talk = lerp(prev.talk, sp ? 1 : 0, 0.12);
      const lvl = lerp(prev.level, level, 0.35);
      const hap = lerp(prev.happy, hp ? 1 : 0, 0.08);
      prev = { form, talk, level: lvl, happy: hap };
      setFrame({ t, form: easeOut(form), talk, level: lvl, bands, happy: hap });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const r = Math.min(maxR, Math.min(size.w, size.h) * rFrac);
  return (
    <div ref={boxRef} style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {size.w > 0 && (
        <Orb t={frame.t} x={size.w / 2} y={size.h * yFrac} r={r} form={frame.form}
             talk={frame.talk} level={frame.level} bands={frame.bands} happy={frame.happy} />
      )}
    </div>
  );
}

const easeOut = (x) => 1 - Math.pow(1 - x, 3);
