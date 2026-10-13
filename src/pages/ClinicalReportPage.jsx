import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import SiteHeader from "../components/SiteHeader.jsx";
import HeartRateChart from "../components/HeartRateChart.jsx";

// The clinical intake report for "Meet the Consultant". Everything shown was
// produced once, after the call (backend/clinical_engine.py); this page only
// lays it out. Its core promise: every history field links back to the
// patient's exact words, and the verification of that link is shown.

const REPORT_KEY = "horizon_clinical_report";

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap');
  html, body, #root { margin: 0 !important; padding: 0 !important; width: 100%; max-width: 100% !important; overflow-x: hidden; background: #EEF2F8; }
  * { box-sizing: border-box; font-family: 'Nunito', sans-serif; }

  :root {
    --ink: #101828; --ink2: #475467; --muted: #667085; --line: #E4E7EC; --soft: #F8FAFC;
    --brand: #1A5FCC; --teal: #128AA3;
    --good: #067647; --good-bg: #ECFDF3; --warn: #B54708; --warn-bg: #FFFAEB; --crit: #B42318; --crit-bg: #FEF3F2;
    --hrc-band: rgba(26,95,204,0.07); --hrc-grid: #EEF0F3; --hrc-muted: #98A2B3; --hrc-ink: #101828; --hrc-ink2: #667085; --hrc-surface: #FFFFFF;
  }

  .cr-wrap { text-align: left; max-width: 1040px; margin: 0 auto; padding: 28px 18px 72px; }
  .cr-actions { display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap; margin-bottom: 14px; }
  .cr-btn { padding: 10px 18px; border-radius: 10px; font-size: 14px; font-weight: 500; cursor: pointer; border: 1.5px solid #C9D8F5; background: #fff; color: #1A5FCC; }
  .cr-btn.primary { background: #1A5FCC; color: #fff; border-color: #1A5FCC; }
  .cr-btn.dark { background: #1A5FCC; color: #fff; border-color: #1A5FCC; }

  .cr-doc { background: #fff; border-radius: 18px; box-shadow: 0 20px 60px rgba(16,24,40,0.08); overflow: hidden; }
  .cr-head { background: linear-gradient(120deg, #0B1B36 0%, #12325C 70%, #0E4A63 100%); color: #fff; padding: 28px 32px 24px; }
  .cr-head-top { display: flex; justify-content: space-between; gap: 20px; flex-wrap: wrap; align-items: flex-start; }
  .cr-kicker { font-size: 12px; font-weight: 600; letter-spacing: 1.6px; text-transform: uppercase; color: #7FD8E8; }
  .cr-head h1 { margin: 6px 0 0; font-size: clamp(24px, 3vw, 32px); font-weight: 700; letter-spacing: -0.5px; }
  .cr-id { text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #BFD3EE; line-height: 1.7; }
  .cr-meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 14px; margin-top: 22px; padding-top: 18px; border-top: 1px solid rgba(255,255,255,0.12); }
  .cr-meta div span { display: block; font-size: 11px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: #8FA6C4; }
  .cr-meta div b { font-size: 15px; font-weight: 600; }
  .cr-model { margin-top: 16px; display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 500; color: #C9D6EA; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12); padding: 6px 12px; border-radius: 100px; }
  .cr-model i { width: 8px; height: 8px; border-radius: 50%; background: #2BC6E0; box-shadow: 0 0 8px #2BC6E0; }

  .cr-sec { padding: 26px 32px; border-top: 1px solid var(--line); }
  .cr-sec h2 { margin: 0 0 4px; font-size: 13px; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase; color: var(--brand); display: flex; align-items: center; gap: 10px; }
  .cr-sec h2 em { font-style: normal; font-family: 'JetBrains Mono', monospace; color: var(--muted); font-weight: 500; letter-spacing: 0; }
  .cr-sec .lead { margin: 0 0 16px; font-size: 13px; color: var(--muted); }
  .cr-hpi { font-size: 16.5px; line-height: 1.7; color: var(--ink); margin: 6px 0 0; }

  .cr-triage { display: flex; align-items: center; gap: 14px; padding: 14px 18px; border-radius: 14px; margin-top: 4px; }
  .cr-triage b { font-size: 15px; } .cr-triage span { font-size: 14px; color: var(--ink2); }
  .cr-triage.routine { background: var(--good-bg); color: var(--good); }
  .cr-triage.soon { background: var(--warn-bg); color: var(--warn); }
  .cr-triage.urgent { background: var(--crit-bg); color: var(--crit); }
  .cr-triage .ico { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; background: currentColor; }
  .cr-triage .ico span { color: #fff; font-size: 16px; }

  .cr-voice { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1px solid var(--line); border-radius: 14px; overflow: hidden; margin-bottom: 18px; }
  .cr-voice > div { padding: 16px 18px; }
  .cr-voice .said { background: var(--soft); border-right: 1px solid var(--line); }
  .cr-voice .k { font-size: 11px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: var(--muted); margin-bottom: 8px; }
  .cr-voice .q { font-size: 16px; line-height: 1.6; color: var(--ink); font-style: italic; }
  .cr-voice ul { margin: 0; padding-left: 18px; line-height: 1.8; font-size: 14.5px; color: var(--ink); }
  @media (max-width: 720px) { .cr-voice { grid-template-columns: 1fr; } .cr-voice .said { border-right: none; border-bottom: 1px solid var(--line); } }

  table.cr-t { width: 100%; border-collapse: collapse; font-size: 14px; }
  .cr-t th { text-align: left; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--muted); padding: 10px 12px; border-bottom: 2px solid var(--line); background: var(--soft); }
  .cr-t td { padding: 12px; border-bottom: 1px solid var(--line); vertical-align: top; color: var(--ink); }
  .cr-t td.f { font-weight: 600; color: var(--ink2); white-space: nowrap; width: 130px; }
  .cr-t td.v { font-weight: 600; }
  .cr-quote { cursor: pointer; }
  .cr-quote q { font-size: 15px; color: var(--ink); }
  .cr-quote small { display: block; color: var(--muted); font-size: 12.5px; margin-top: 3px; }
  .cr-quote:hover q { text-decoration: underline; text-decoration-color: #9DBBFF; text-underline-offset: 3px; }
  .cr-link { white-space: nowrap; font-size: 12px; font-weight: 600; }
  .cr-link.exact { color: var(--good); } .cr-link.close { color: var(--teal); } .cr-link.unlinked { color: var(--warn); }
  .cr-table-scroll { overflow-x: auto; }

  .cr-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; margin-bottom: 18px; }
  .cr-tile { border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px; }
  .cr-tile span { display: block; font-size: 11px; font-weight: 600; letter-spacing: .8px; text-transform: uppercase; color: var(--muted); }
  .cr-tile b { font-size: 24px; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; }
  .cr-tile b small { font-size: 12px; color: var(--muted); font-weight: 500; margin-left: 3px; }
  .cr-tile em { display: block; font-style: normal; font-size: 12px; color: var(--muted); margin-top: 2px; }
  .cr-src { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; letter-spacing: .6px; padding: 3px 9px; border-radius: 100px; text-transform: uppercase; }
  .cr-src.live { background: var(--good-bg); color: var(--good); }
  .cr-src.sim { background: var(--warn-bg); color: var(--warn); }

  .hrc { border: 1px solid var(--line); border-radius: 14px; padding: 8px 4px 0; }
  .hrc-empty { padding: 28px; text-align: center; color: var(--muted); border: 1px dashed var(--line); border-radius: 14px; }
  .hrc-tip { position: absolute; width: 200px; background: #101828; color: #fff; border-radius: 10px; padding: 8px 10px; font-size: 12px; line-height: 1.5; pointer-events: none; box-shadow: 0 8px 20px rgba(0,0,0,0.2); }
  .hrc-tip span { color: #98A2B3; } .hrc-tip-q { color: #C9D6EA; margin-top: 4px; }
  .cr-details { margin-top: 12px; font-size: 13px; color: var(--ink2); }
  .cr-details summary { cursor: pointer; font-weight: 600; color: var(--brand); }

  .cr-sleep { display: flex; height: 14px; border-radius: 7px; overflow: hidden; gap: 2px; margin: 8px 0 6px; }
  .cr-sleep div { height: 100%; }
  .cr-sleep-legend { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; color: var(--ink2); }
  .cr-sleep-legend i { display: inline-block; width: 9px; height: 9px; border-radius: 3px; margin-right: 5px; }

  .cr-meter { display: flex; align-items: center; gap: 6px; }
  .cr-meter .bar { width: 54px; height: 6px; border-radius: 3px; background: #EEF0F3; overflow: hidden; }
  .cr-meter .bar div { height: 100%; border-radius: 3px; }
  .cr-meter span { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--ink2); }
  .cr-verdict { padding: 12px 16px; border-radius: 12px; font-weight: 600; font-size: 14px; margin-bottom: 16px; display: flex; gap: 10px; align-items: center; }
  .cr-verdict.ok { background: var(--good-bg); color: var(--good); }
  .cr-verdict.bad { background: var(--warn-bg); color: var(--warn); }
  .cr-flag { display: inline-block; font-size: 11.5px; font-weight: 600; color: var(--warn); background: var(--warn-bg); border-radius: 6px; padding: 2px 7px; margin: 2px 4px 2px 0; }
  .cr-log { font-family: 'JetBrains Mono', monospace; font-size: 12px; background: #0B1220; color: #A9C1E8; padding: 14px; border-radius: 10px; white-space: pre-wrap; line-height: 1.6; }

  .cr-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  @media (max-width: 720px) { .cr-cols { grid-template-columns: 1fr; } .cr-sec { padding: 22px 18px; } .cr-head { padding: 22px 18px; } }
  .cr-list { margin: 8px 0 0; padding-left: 18px; line-height: 1.75; font-size: 14.5px; color: var(--ink); }
  .cr-list.red li::marker { color: var(--crit); }

  .cr-transcript { display: flex; flex-direction: column; gap: 10px; }
  .cr-turn { display: grid; grid-template-columns: 92px 1fr; gap: 12px; padding: 10px 12px; border-radius: 10px; transition: background .4s; }
  .cr-turn.p { background: var(--soft); }
  .cr-turn.flash { background: #FFF4D6; }
  .cr-turn .who { font-size: 12px; font-weight: 700; color: var(--muted); }
  .cr-turn.p .who { color: var(--brand); }
  .cr-turn .txt { font-size: 15px; line-height: 1.6; color: var(--ink); }
  .cr-turn mark { background: #DCEBFF; color: inherit; border-radius: 4px; padding: 0 2px; }

  .cr-foot { padding: 20px 32px 26px; border-top: 1px solid var(--line); font-size: 12px; color: var(--muted); line-height: 1.6; display: flex; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
  .cr-sign { text-align: right; }
  .cr-sign b { display: block; color: var(--ink2); font-size: 13px; }

  @media print {
    html, body, #root { background: #fff; }
    .hz-header, .cr-actions, .cr-details summary { display: none !important; }
    .cr-wrap { padding: 0; max-width: none; }
    .cr-doc { box-shadow: none; border-radius: 0; }
    .cr-sec { break-inside: avoid; }
    .cr-head { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;

const TRIAGE = {
    routine: { ico: "✓", title: "Routine review", text: "No danger signs reported. Suitable for a scheduled consultation." },
    soon:    { ico: "!", title: "See a doctor soon", text: "Findings warrant review by a doctor within 24–48 hours." },
    urgent:  { ico: "!!", title: "Urgent attention", text: "Danger signs reported. Advise immediate in-person care." },
};

const LINK_LABEL = { exact: "✓ Verbatim", close: "≈ Matched span", unlinked: "⚠ Not found verbatim" };
const CHANNEL = { verbal: "#1A5FCC", behavioural: "#7A5AF8", physiological: "#D6246E" };

const fmtDur = (s) => `${Math.floor(s / 60)} min ${s % 60} s`;
const fmtMin = (m) => `${Math.floor(m / 60)}h ${m % 60}m`;

function loadReport() {
    try { return JSON.parse(sessionStorage.getItem(REPORT_KEY) || "null"); } catch { return null; }
}

function highlight(text, quotes) {
    // Wrap each linked quote inside the patient's line.
    let parts = [text];
    quotes.filter(Boolean).forEach((q) => {
        parts = parts.flatMap((p) => {
            if (typeof p !== "string") return [p];
            const i = p.toLowerCase().indexOf(q.toLowerCase());
            if (i < 0) return [p];
            return [p.slice(0, i), <mark key={q + i}>{p.slice(i, i + q.length)}</mark>, p.slice(i + q.length)];
        });
    });
    return parts;
}

export default function ClinicalReportPage() {
    const navigate = useNavigate();
    const [flash, setFlash] = useState(null);
    const data = useMemo(loadReport, []);

    const payload = data?.payload;
    const report = data?.report;

    const turns = useMemo(() => {
        let p = 0;
        return (payload?.transcript || []).map((t) => ({ ...t, label: t.role === "user" ? `P${++p}` : "Horizon", pIndex: t.role === "user" ? p - 1 : null }));
    }, [payload]);

    if (!payload) {
        return (
            <>
                <style>{STYLES}</style>
                <SiteHeader />
                <div className="cr-wrap" style={{ textAlign: "center", paddingTop: 80 }}>
                    <h2>No consultation report found</h2>
                    <p style={{ color: "#667085" }}>Start a consultation to generate a clinical report.</p>
                    <button className="cr-btn primary" onClick={() => navigate("/consultation")}>Meet the Consultant</button>
                </div>
            </>
        );
    }

    const fusion = report?.fusion;
    const hrSummary = fusion?.heart_rate;
    const hrLive = payload.heart_rate?.source === "boult";
    const vitals = payload.vitals || {};
    const history = report?.history || [];
    const triage = TRIAGE[report?.triage] ? report.triage : "routine";
    const patientTurns = turns.filter((t) => t.role === "user");

    const speakingWindows = patientTurns.map((t) => ({
        label: t.label,
        start: t.meta?.speechStart ?? Math.max(0, t.t - 6000),
        end: t.meta?.end ?? t.t,
        text: t.text,
    }));

    // The patient turn with the most clinical content becomes the
    // "from voice to history" showcase.
    const counts = {};
    history.forEach((h) => { if (h.turn != null) counts[h.turn] = (counts[h.turn] || 0) + 1; });
    const showcaseTurn = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    const showcase = showcaseTurn != null ? patientTurns[Number(showcaseTurn)] : null;
    const showcaseFields = history.filter((h) => String(h.turn) === String(showcaseTurn));

    const quotesByTurn = {};
    history.forEach((h) => { if (h.turn != null) (quotesByTurn[h.turn] ||= []).push(h.quote); });

    const jumpTo = (pIndex) => {
        if (pIndex == null) return;
        const el = document.getElementById(`turn-p${pIndex}`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        setFlash(pIndex);
        setTimeout(() => setFlash(null), 1600);
    };

    const started = payload.started_at ? new Date(payload.started_at) : new Date();
    const modelName = report?.model && report.model !== "unavailable" ? report.model : null;
    const sleep = vitals.sleep;

    return (
        <>
            <style>{STYLES}</style>
            <SiteHeader />
            <div className="cr-wrap">
                <div className="cr-actions">
                    <button className="cr-btn" onClick={() => navigate("/consultation")}>New consultation</button>
                    <button className="cr-btn dark" onClick={() => window.print()}>Download PDF</button>
                    <button className="cr-btn primary" onClick={() => navigate("/bookexpert")}>Book a doctor →</button>
                </div>

                <article className="cr-doc">
                    {/* ── Letterhead ── */}
                    <header className="cr-head">
                        <div className="cr-head-top">
                            <div>
                                <div className="cr-kicker">Horizon · Clinical Intake Report</div>
                                <h1>Pre-consultation History &amp; Vitals</h1>
                            </div>
                            <div className="cr-id">
                                {report?.report_id || "HZN-DRAFT"}<br />
                                {started.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} · {started.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                            </div>
                        </div>
                        <div className="cr-meta">
                            <div><span>Language</span><b>{report?.dialect || report?.language || payload.lang}</b></div>
                            <div><span>Duration</span><b>{fmtDur(payload.duration_seconds || 0)}</b></div>
                            <div><span>Patient turns</span><b>{patientTurns.length}</b></div>
                            <div><span>Heart-rate source</span><b>{hrLive ? (payload.heart_rate?.device || "Smartwatch") : "Simulated"}</b></div>
                        </div>
                        <div className="cr-model">
                            <i />
                            {modelName
                                ? <>Generated by Horizon Clinical AI · model <b>{modelName}</b> · on-premise inference{report?.processing_s ? ` · ${report.processing_s}s` : ""}</>
                                : <>Clinical model unavailable — raw session data shown</>}
                        </div>
                    </header>

                    {/* ── Summary & triage ── */}
                    <section className="cr-sec">
                        <h2>History of presenting illness</h2>
                        <p className="cr-hpi">{report?.summary || "The report could not be generated. The transcript and vitals recorded in the session are shown below."}</p>
                        {report && (
                            <div className={`cr-triage ${triage}`} style={{ marginTop: 18 }}>
                                <div className="ico"><span>{TRIAGE[triage].ico}</span></div>
                                <div><b>{TRIAGE[triage].title}</b><br /><span>{TRIAGE[triage].text}</span></div>
                            </div>
                        )}
                    </section>

                    {/* ── From voice to history ── */}
                    {history.length > 0 && (
                        <section className="cr-sec">
                            <h2>From voice to history <em>{history.length} findings</em></h2>
                            <p className="lead">Every field links back to the patient's exact words. Click a quote to see it in the transcript.</p>

                            {showcase && (
                                <div className="cr-voice">
                                    <div className="said">
                                        <div className="k">Patient says · {report?.dialect || report?.language}</div>
                                        <div className="q">“{showcase.text}”</div>
                                    </div>
                                    <div>
                                        <div className="k">Clinician sees</div>
                                        <ul>
                                            {showcaseFields.map((h, i) => (
                                                <li key={i}><b>{h.field}:</b> {h.value} — <i>“{h.quote}”</i></li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}

                            <div className="cr-table-scroll">
                                <table className="cr-t">
                                    <thead><tr><th>Field</th><th>Finding</th><th>Patient's words</th><th>Source</th></tr></thead>
                                    <tbody>
                                        {history.map((h, i) => (
                                            <tr key={i}>
                                                <td className="f">{h.field}</td>
                                                <td className="v">{h.value}</td>
                                                <td className="cr-quote" onClick={() => jumpTo(h.turn)}>
                                                    <q>{h.quote}</q>
                                                    {h.quote_en && <small>{h.quote_en}</small>}
                                                </td>
                                                <td>
                                                    <div className={`cr-link ${h.match}`}>{LINK_LABEL[h.match]}</div>
                                                    {h.turn != null && <small style={{ color: "#667085" }}>Turn P{h.turn + 1}</small>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    )}

                    {/* ── Heart rate ── */}
                    <section className="cr-sec">
                        <h2>Heart rate during consultation <span className={`cr-src ${hrLive ? "live" : "sim"}`}>{hrLive ? "● Smartwatch · live sensor" : "Simulated"}</span></h2>
                        <p className="lead">Shaded bands mark when the patient was speaking (P1, P2… as in the transcript). Dashed line: resting baseline from the first minute.</p>
                        {hrSummary && (
                            <div className="cr-tiles">
                                <div className="cr-tile"><span>Baseline</span><b>{Math.round(hrSummary.baseline)}<small>bpm</small></b></div>
                                <div className="cr-tile"><span>Mean</span><b>{Math.round(hrSummary.mean)}<small>bpm</small></b></div>
                                <div className="cr-tile"><span>Peak</span><b>{hrSummary.max}<small>bpm</small></b><em>{hrSummary.tachycardia ? "Above 100 bpm" : "Within normal range"}</em></div>
                                <div className="cr-tile"><span>Lowest</span><b>{hrSummary.min}<small>bpm</small></b></div>
                                <div className="cr-tile"><span>Variability</span><b>{hrSummary.sd}<small>SD</small></b><em>{hrSummary.samples} samples</em></div>
                            </div>
                        )}
                        <HeartRateChart samples={payload.heart_rate?.samples || []} baseline={hrSummary?.baseline ?? null} turns={speakingWindows} />
                        <details className="cr-details">
                            <summary>View heart-rate data table</summary>
                            <div className="cr-table-scroll" style={{ maxHeight: 260, overflowY: "auto", marginTop: 10 }}>
                                <table className="cr-t">
                                    <thead><tr><th>Time</th><th>bpm</th></tr></thead>
                                    <tbody>
                                        {(payload.heart_rate?.samples || []).filter((_, i) => i % 5 === 0).map((s) => (
                                            <tr key={s.t}><td>{Math.floor(s.t / 60000)}:{String(Math.round(s.t / 1000) % 60).padStart(2, "0")}</td><td>{s.bpm}</td></tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </details>
                    </section>

                    {/* ── Other vitals ── */}
                    {vitals.spo2 != null && (
                        <section className="cr-sec">
                            <h2>Wellness metrics <span className="cr-src sim">Simulated</span></h2>
                            <p className="lead">Measured on the watch but not yet exposed by the manufacturer's software — simulated values, for layout only. Not for clinical use.</p>
                            <div className="cr-tiles">
                                <div className="cr-tile"><span>SpO₂</span><b>{vitals.spo2}<small>%</small></b></div>
                                <div className="cr-tile"><span>Stress</span><b>{vitals.stress}</b><em>{vitals.stress_level}</em></div>
                                <div className="cr-tile"><span>Calories today</span><b>{vitals.calories}<small>kcal</small></b></div>
                                <div className="cr-tile"><span>Steps today</span><b>{vitals.workout?.steps?.toLocaleString("en-IN")}</b><em>{vitals.workout?.active_min} active min</em></div>
                                <div className="cr-tile"><span>Last workout</span><b style={{ fontSize: 16 }}>{vitals.workout?.last}</b></div>
                            </div>
                            {sleep && (
                                <div className="cr-tile">
                                    <span>Last night's sleep · {fmtMin(sleep.total_min)} · score {sleep.score}</span>
                                    <div className="cr-sleep">
                                        <div style={{ flex: sleep.deep_min, background: "#1A3F8F" }} />
                                        <div style={{ flex: sleep.light_min, background: "#5B8DEF" }} />
                                        <div style={{ flex: sleep.rem_min, background: "#2BC6E0" }} />
                                        <div style={{ flex: sleep.awake_min, background: "#F5B547" }} />
                                    </div>
                                    <div className="cr-sleep-legend">
                                        <span><i style={{ background: "#1A3F8F" }} />Deep {fmtMin(sleep.deep_min)}</span>
                                        <span><i style={{ background: "#5B8DEF" }} />Light {fmtMin(sleep.light_min)}</span>
                                        <span><i style={{ background: "#2BC6E0" }} />REM {fmtMin(sleep.rem_min)}</span>
                                        <span><i style={{ background: "#F5B547" }} />Awake {sleep.awake_min}m</span>
                                    </div>
                                </div>
                            )}
                        </section>
                    )}

                    {/* ── ATMF-MSI ── */}
                    {fusion && fusion.segments?.length > 0 && (
                        <section className="cr-sec">
                            <h2>ATMF-MSI behavioural fusion <em>arousal: {fusion.arousal_level} ({fusion.overall_arousal})</em></h2>
                            <p className="lead">Each patient turn is scored on three channels. Each channel's weight comes from its reliability for that turn, so missing or weak signals count for less.</p>
                            <div className={`cr-verdict ${fusion.congruence.startsWith("INCONGRUENT") ? "bad" : "ok"}`}>
                                {fusion.congruence.startsWith("INCONGRUENT") ? "⚠" : "✓"} {fusion.congruence}
                            </div>
                            <div className="cr-table-scroll">
                                <table className="cr-t">
                                    <thead><tr><th>Turn</th><th>Verbal</th><th>Behavioural</th><th>Physiological</th><th>HR (Δ)</th><th>Arousal</th><th>Observations</th></tr></thead>
                                    <tbody>
                                        {fusion.segments.map((s) => (
                                            <tr key={s.turn}>
                                                <td className="f" style={{ cursor: "pointer", width: 60 }} onClick={() => jumpTo(s.turn)}>P{s.turn + 1}</td>
                                                {["verbal", "behavioural", "physiological"].map((k) => (
                                                    <td key={k}>
                                                        <div className="cr-meter">
                                                            <div className="bar"><div style={{ width: `${s[k] * 100}%`, background: CHANNEL[k] }} /></div>
                                                            <span>{s[k].toFixed(2)}</span>
                                                        </div>
                                                        <small style={{ color: "#98A2B3", fontSize: 11 }}>w {s.weights[k].toFixed(2)}</small>
                                                    </td>
                                                ))}
                                                <td style={{ whiteSpace: "nowrap" }}>{s.hr != null ? `${Math.round(s.hr)} (${s.d_hr >= 0 ? "+" : ""}${Math.round(s.d_hr)})` : "—"}</td>
                                                <td><b>{s.arousal.toFixed(2)}</b></td>
                                                <td>{s.flags.length ? s.flags.map((f) => <span key={f} className="cr-flag">{f}</span>) : <span style={{ color: "#98A2B3" }}>—</span>}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <details className="cr-details">
                                <summary>Engine log</summary>
                                <div className="cr-log" style={{ marginTop: 10 }}>{fusion.fusion_log}</div>
                            </details>
                        </section>
                    )}

                    {/* ── Impression ── */}
                    {report && (report.impression?.length || report.red_flags?.length || report.recommendations?.length) ? (
                        <section className="cr-sec">
                            <div className="cr-cols">
                                <div>
                                    <h2>Clinical considerations</h2>
                                    {report.impression?.length
                                        ? <ul className="cr-list">{report.impression.map((x) => <li key={x}>{x}</li>)}</ul>
                                        : <p className="lead">None noted.</p>}
                                    <h2 style={{ marginTop: 22 }}>Red flags</h2>
                                    {report.red_flags?.length
                                        ? <ul className="cr-list red">{report.red_flags.map((x) => <li key={x}>{x}</li>)}</ul>
                                        : <p className="lead">No danger signs reported.</p>}
                                </div>
                                <div>
                                    <h2>Recommendations</h2>
                                    {report.recommendations?.length
                                        ? <ul className="cr-list">{report.recommendations.map((x) => <li key={x}>{x}</li>)}</ul>
                                        : <p className="lead">None noted.</p>}
                                </div>
                            </div>
                        </section>
                    ) : null}

                    {/* ── Transcript ── */}
                    <section className="cr-sec">
                        <h2>Verbatim transcript <em>{turns.length} turns</em></h2>
                        <p className="lead">Highlighted words are the source of a history finding.</p>
                        <div className="cr-transcript">
                            {turns.map((t, i) => (
                                <div key={i} id={t.role === "user" ? `turn-p${t.pIndex}` : undefined}
                                     className={`cr-turn ${t.role === "user" ? "p" : ""} ${flash === t.pIndex && t.role === "user" ? "flash" : ""}`}>
                                    <div className="who">{t.label}<br /><span style={{ fontWeight: 500 }}>{Math.floor(t.t / 60000)}:{String(Math.round(t.t / 1000) % 60).padStart(2, "0")}</span></div>
                                    <div className="txt">{t.role === "user" ? highlight(t.text, quotesByTurn[t.pIndex] || []) : t.text}</div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <footer className="cr-foot">
                        <div style={{ maxWidth: 620 }}>
                            AI-generated pre-consultation summary to assist a licensed clinician. It is not a diagnosis
                            and must be reviewed against the patient in person. Wellness metrics marked “simulated” are
                            not measured values.
                        </div>
                        <div className="cr-sign">
                            <b>Horizon Clinical AI</b>
                            {modelName ? `${modelName} · ATMF-MSI v2` : "ATMF-MSI v2"}
                        </div>
                    </footer>
                </article>
            </div>
        </>
    );
}
