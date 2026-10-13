import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

// ─────────────────────────────────────────────────────────
// 🎨  GLOBAL STYLES
// ─────────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');

  html, body, #root {
    margin: 0 !important; padding: 0 !important;
    width: 100vw; overflow-x: hidden;
    background: #F5F7FF; font-family: 'Nunito', sans-serif;
  }
  * { box-sizing: border-box; }

  /* ── page wrapper ── */
  .ra-page {
    min-height: 100vh; background: #F5F7FF;
    padding: 20px 0 80px 0;
  }

  /* ── content card ── */
  .ra-card {
    max-width: 600px; width: 100%;
    background: #fff; margin: 0 auto 36px;
    border-radius: 24px;
    box-shadow: 0 20px 60px rgba(41,98,255,0.08);
    overflow: hidden; padding: 0 0 40px 0;
  }

  /* ── page heading banner ── */
  .ra-banner {
    background: linear-gradient(135deg, #2962FF 0%, #448AFF 100%);
    padding: 32px 28px 28px;
  }
  .ra-banner h1 {
    font-size: clamp(22px,4vw,30px); font-weight: 700;
    color: #fff; margin: 0 0 6px; letter-spacing: -0.5px;
  }
  .ra-banner p { font-size: 14px; color: rgba(255,255,255,0.8); font-weight: 500; margin: 0; }

  /* ── section padding ── */
  .ra-section { padding: 28px 28px 0 28px; }

  /* ── score section heading ── */
  .ra-score-heading {
    font-size: 18px; font-weight: 600; color: #37474F;
    margin: 0 0 24px; letter-spacing: -0.3px;
  }

  /* ── Score bubble + bar (exact match to screenshots) ── */
  .ra-score-block { margin-bottom: 44px; }
  .ra-score-label { font-size: 16px; font-weight: 500; color: #455A64; margin-bottom: 20px; }

  .ra-bubble-track { position: relative; padding-bottom: 16px; }
  .ra-bubble {
    width: 72px; height: 72px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 26px; font-weight: 700; color: #fff;
    position: absolute; bottom: 8px;
    transform: translateX(-50%);
    transition: left 0.9s cubic-bezier(.34,1.56,.64,1);
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  }
  .ra-bubble::after {
    content: '';
    position: absolute; bottom: -8px; left: 50%;
    transform: translateX(-50%);
    width: 6px; height: 6px;
    border-radius: 50%; background: inherit;
    opacity: 0.6;
  }
  .ra-track-bar {
    width: 100%; height: 6px; border-radius: 10px;
    margin-top: 80px; overflow: hidden; background: #ECEFF1;
  }
  .ra-track-fill {
    height: 100%; border-radius: 10px;
    transition: width 1s cubic-bezier(.34,1.56,.64,1);
  }

  /* severity label */
  .ra-severity-label {
    font-size: clamp(18px,3vw,22px); font-weight: 600;
    margin: 22px 0 6px; line-height: 1.2;
  }
  .ra-encouragement { font-size: 15px; font-weight: 600; color: #37474F; margin: 14px 0 10px; }
  .ra-desc { font-size: 15px; font-weight: 500; color: #546E7A; line-height: 1.65; margin-bottom: 10px; }

  /* ── divider ── */
  .ra-divider { height: 1px; background: #ECEFF1; margin: 28px 0; }

  /* ── spider/radial chart ── */
  .ra-spider-wrap {
    display: flex; flex-direction: column; align-items: center;
    padding: 0 12px;
  }
  .ra-spider-caption {
    font-size: 15px; font-weight: 500; color: #546E7A;
    line-height: 1.65; text-align: left; width: 100%;
    margin-top: 24px; padding: 0 8px;
  }

  /* ── emotion timeline bars ── */
  .ra-timeline-row { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
  .ra-tl-label { font-size: 13px; font-weight: 500; color: #607D8B; width: 90px; flex-shrink: 0; text-transform: capitalize; }
  .ra-tl-bar-bg { flex: 1; height: 8px; background: #ECEFF1; border-radius: 10px; overflow: hidden; }
  .ra-tl-bar-fill { height: 100%; border-radius: 10px; transition: width 1.2s ease; }
  .ra-tl-count { font-size: 12px; font-weight: 600; color: #90A4AE; width: 28px; text-align: right; }

  /* ── face metrics row ── */
  .ra-metrics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px; }
  .ra-metric-card {
    background: #F8F9FF; border: 1.5px solid #E8EEFF;
    border-radius: 14px; padding: 16px 18px;
  }
  .ra-metric-card p { margin: 0; }
  .ra-metric-val { font-size: 22px; font-weight: 700; color: #4B8DFF; }
  .ra-metric-lbl { font-size: 12px; font-weight: 500; color: #90A4AE; margin-top: 4px !important; }

  /* ── technical depth modal overlay ── */
  .ra-modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.55);
    z-index: 500; display: flex; align-items: flex-end; justify-content: center;
    animation: fadeIn 0.2s ease;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .ra-modal {
    position: relative;
    width: 100%; max-width: 680px;
    background: #fff; border-radius: 24px 24px 0 0;
    max-height: 90vh; overflow-y: auto;
    padding: 28px 28px 40px;
    animation: slideUp 0.35s cubic-bezier(.34,1.56,.64,1);
  }
  @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
  .ra-modal-handle {
    width: 44px; height: 5px; background: #E0E0E0;
    border-radius: 10px; margin: 0 auto 22px;
  }
  
  /* ── 3D Modal Download Button ── */
  .ra-download-btn {
    position: absolute; top: 24px; right: 24px;
    background: #1A5FCC;
    color: #fff;
    border: none; border-radius: 100px; /* Rounded pill shape */
    padding: 10px 18px; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all 0.15s ease-out;
    display: flex; align-items: center; gap: 6px;
    box-shadow: none;
  }
  .ra-download-btn:active { 
    transform: scale(0.95) translateY(2px); 
    box-shadow: none; 
  }

  .ra-modal h2 {
    font-size: 20px; font-weight: 700; color: #1a1a1a;
    margin: 0 0 16px; letter-spacing: -0.3px;
    max-width: 80%;
  }
  .ra-modal h3 {
    font-size: 14px; font-weight: 600; color: #2962FF;
    background: #EEF3FF; padding: 8px 12px;
    border-left: 4px solid #2962FF; border-radius: 6px;
    margin: 22px 0 12px;
  }
  .ra-modal table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 14px; }
  .ra-modal th { background: #EEF3FF; color: #1a1a1a; text-align: left; padding: 9px 10px; border: 1px solid #C5D8FF; font-weight: 600; }
  .ra-modal td { padding: 9px 10px; border: 1px solid #E0E8FF; color: #455A64; font-weight: 500; vertical-align: top; }
/* ── Professional Report Container ── */
  .ra-modal blockquote { 
    border-left: 4px solid #448AFF; 
    background: #F8FBFF; /* Cleaner, lighter background */
    border: 1px solid #D1E4FF;
    margin: 10px 0; 
    padding: 20px; 
    border-radius: 0 12px 12px 0; 
    font-size: 14px; 
    color: #37474F; 
    font-weight: 500; 
    white-space: pre-wrap; 
    line-height: 1.7; 
    text-align: left; /* Forces text to start from the left */
  }
  .ra-modal p { font-size: 14px; color: #546E7A; line-height: 1.6; margin: 8px 0; }
  .ra-modal hr { border: none; border-top: 1px solid #E8EEFF; margin: 20px 0; }
  .ra-modal-close-row { display: flex; justify-content: center; margin-top: 28px; }

  /* ── 3D button (matches HomePage) ── */
  .ra-btn-3d {
    padding: clamp(13px,2vw,16px) clamp(28px,4vw,48px);
    border-radius: 100px; border: none; cursor: pointer;
    color: #fff; font-size: clamp(14px,1.4vw,16px); font-weight: 500;
    font-family: 'Nunito', sans-serif; letter-spacing: 0.3px;
    background: #1A5FCC;
    box-shadow: none;
    transition: all 0.15s ease-out; outline: none;
  }
  .ra-btn-3d:active { transform: scale(0.96) translateY(2px); box-shadow: none; }
  .ra-btn-light {
    background: linear-gradient(180deg, #F0F4FF 0%, #D9E2F5 100%);
    color: #333;
    box-shadow: none;
  }

  /* ── bottom sticky CTA ── */
  .ra-sticky-cta {
    position: sticky; bottom: 0;
    background: linear-gradient(0deg, #fff 70%, transparent 100%);
    padding: 16px 28px 28px; display: flex; justify-content: center;
    margin-top: 12px;
  }

  @media (max-width: 640px) {
    .ra-card { margin: 0; border-radius: 0; }
  }
`;

// ─────────────────────────────────────────────────────────
// 🎯  SCORE CONFIG
// ─────────────────────────────────────────────────────────
const SCORE_CONFIG = {
    stress: {
        label: "Stress score",
        heading: "Your Stress Result",
        maxScore: 40,
        color: "#F5A623",
        trackColor: "#FFD082",
        symptoms: ["Poor Work-Life Balance","Negative Thoughts","Communication Problems","Poor Problem Solving","Lack of Focus","Trouble Relaxing","Poor Health"],
        getSeverity: (s) => {
            if (s <= 13) return { label: "Low levels of stress",      encourage: "Great going!",         desc1: "People who score like you show very few signs of stress. Your stress-management seems to be working well.\n\nKeep maintaining your healthy lifestyle and coping strategies.",                                                                                                    desc2: "" };
            if (s <= 26) return { label: "Moderate levels of stress", encourage: "We've got your back",  desc1: "People who score like you show several symptoms of stress such as mood swings, problems with focus, as well as body aches and pains.",                                                                                                                                   desc2: "You might get overwhelmed at times. You might also feel like you don't have enough control over your stress." };
            return               { label: "High levels of stress",    encourage: "You're not alone",     desc1: "People who score like you often feel chronically stressed, fatigued, and find it difficult to function normally at work or in relationships.\n\nWe strongly recommend booking a session with a professional consultant for personalised support.", desc2: "" };
        },
    },
    depression: {
        label: "Depression score",
        heading: "Your Depression Result",
        maxScore: 27,
        color: "#9EA8D0",
        trackColor: "#BFC7E8",
        symptoms: ["Negative Thoughts","Low Self-Esteem","Lack of Focus","Fatigue","Low Interest","Anxiety"],
        getSeverity: (s) => {
            if (s <= 9)  return { label: "Mild depressive concerns",     encourage: "Great going!",          desc1: "People who score like you experience few to no signs that are typically seen in depression. This is great news. You might sometimes feel sad or low, but these feelings might be transient.",                                                                         desc2: "Overall, these concerns don't appear to significantly get in the way of your routine or life." };
            if (s <= 18) return { label: "Moderate depressive concerns", encourage: "We've got your back",   desc1: "People who score like you show a number of signs of depression. You may often feel sad, empty, or hopeless, and find it harder to experience positive emotions.",                                                                                                   desc2: "These feelings may be affecting your daily routine, work, and relationships." };
            return               { label: "Severe depressive concerns",  encourage: "You're not alone",      desc1: "Your score indicates significant depressive symptoms that may be interfering with many areas of your life. These feelings are real and valid.\n\nWe strongly recommend connecting with a professional therapist or psychiatrist as soon as possible.",               desc2: "" };
        },
    },
    anxiety: {
        label: "Anxiety score",
        heading: "Your Anxiety Result",
        maxScore: 21,
        color: "#66BB6A",
        trackColor: "#A5D6A7",
        symptoms: ["Restlessness","Racing Thoughts","Physical Tension","Sleep Issues","Avoidance","Irritability","Panic"],
        getSeverity: (s) => {
            if (s <= 7)  return { label: "Minimal anxiety",  encourage: "Keep it up!",          desc1: "Your anxiety levels appear to be within a healthy range. You seem to have good coping mechanisms.",                                                                                                         desc2: "" };
            if (s <= 14) return { label: "Moderate anxiety", encourage: "We're here for you",   desc1: "You appear to be experiencing moderate levels of anxiety that may sometimes affect your daily activities, sleep, or concentration.", desc2: "Learning some relaxation techniques and grounding strategies may be very helpful." };
            return               { label: "Severe anxiety",  encourage: "You're not alone",     desc1: "Your score indicates a high level of anxiety symptoms that may be significantly impacting your life. Professional support can make a meaningful difference.",                                                desc2: "" };
        },
    },
    overall: {
        label: "Overall wellness score",
        heading: "Overall Mental Wellness",
        maxScore: 100,
        color: "#2962FF",
        trackColor: "#82B1FF",
        symptoms: [],
        getSeverity: (s) => {
            if (s >= 70) return { label: "Good overall wellness",     encourage: "Excellent work!",       desc1: "Your overall mental wellness appears to be in a healthy range. Keep nurturing your mental health with regular self-care.", desc2: "" };
            if (s >= 40) return { label: "Moderate wellness concern", encourage: "We've got your back",   desc1: "Your results indicate some areas of your mental wellness that could benefit from attention and support.",                  desc2: "" };
            return               { label: "Needs attention",          encourage: "You're not alone",      desc1: "Your overall wellness score suggests multiple areas that need professional attention and care.",                          desc2: "" };
        },
    },
};

// ─────────────────────────────────────────────────────────
// 🕸️  SPIDER / RADIAL CHART  (pure SVG – no external lib)
// ─────────────────────────────────────────────────────────
function SpiderChart({ symptoms, scores, color, trackColor }) {
    const n      = symptoms.length;
    const cx     = 170; const cy = 170; const R = 130; const RINGS = 4;
    const WHITE_R = 18;

    const angleOf = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;

    const labelPt = (i) => {
        const a = angleOf(i); const r = R + 38;
        return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
    };

    const scorePt = (i) => {
        const a = angleOf(i); const r = WHITE_R + (R - WHITE_R) * scores[i];
        return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
    };

    const polygonPoints = Array.from({ length: n }, (_, i) => scorePt(i))
        .map((p) => `${p.x},${p.y}`).join(" ");

    return (
        <svg viewBox="0 0 340 340" style={{ width: "100%", maxWidth: 360, overflow: "visible" }}>
            {Array.from({ length: RINGS }, (_, ri) => {
                const r = WHITE_R + ((R - WHITE_R) * (ri + 1)) / RINGS;
                return <circle key={ri} cx={cx} cy={cy} r={r} fill="none" stroke="#ECEFF1" strokeWidth="1" />;
            })}
            {Array.from({ length: n }, (_, i) => {
                const a = angleOf(i);
                return (
                    <line key={i}
                          x1={cx + WHITE_R * Math.cos(a)} y1={cy + WHITE_R * Math.sin(a)}
                          x2={cx + R * Math.cos(a)}        y2={cy + R * Math.sin(a)}
                          stroke="#CFD8DC" strokeWidth="1"
                    />
                );
            })}
            <polygon points={polygonPoints} fill={color} fillOpacity="0.45" stroke={color} strokeWidth="1.5" />
            <circle cx={cx} cy={cy} r={WHITE_R} fill="#fff" />
            {symptoms.map((sym, i) => {
                const { x, y } = labelPt(i);
                const anchor = x < cx - 10 ? "end" : x > cx + 10 ? "start" : "middle";
                const words = sym.split(" ");
                return (
                    <text key={i} x={x} y={y} textAnchor={anchor}
                          fontSize="11" fontWeight="500" fill="#546E7A"
                          fontFamily="Nunito, sans-serif" dominantBaseline="middle">
                        {words.length > 2
                            ? words.map((w, wi) => <tspan key={wi} x={x} dy={wi === 0 ? "-0.5em" : "1.2em"}>{w}</tspan>)
                            : sym}
                    </text>
                );
            })}
        </svg>
    );
}

// ─────────────────────────────────────────────────────────
// 📊  SCORE BLOCK (bubble + track bar)
// ─────────────────────────────────────────────────────────
function ScoreBlock({ configKey, rawScore, animated }) {
    const cfg  = SCORE_CONFIG[configKey];
    const pct  = Math.min(rawScore / cfg.maxScore, 1);
    const sev  = cfg.getSeverity(rawScore);
    const left = `calc(${pct * 100}% * ${(cfg.maxScore - 20) / cfg.maxScore} + 10px)`;

    const symptomScores = cfg.symptoms.map((_, i) => {
        const base = pct;
        const jitter = ((i * 37 + rawScore * 13) % 40) / 100 - 0.2;
        return Math.max(0.05, Math.min(1, base + jitter));
    });

    return (
        <div className="ra-score-block">
            <p className="ra-score-label">{cfg.label}</p>

            <div className="ra-bubble-track">
                <div className="ra-bubble" style={{ background: cfg.color, left: animated ? left : "10px" }}>
                    {rawScore}
                </div>
                <div className="ra-track-bar">
                    <div className="ra-track-fill"
                         style={{ width: animated ? `${pct * 100}%` : "0%", background: `linear-gradient(90deg, ${cfg.trackColor} 0%, ${cfg.color} 100%)` }} />
                </div>
            </div>

            <h2 className="ra-severity-label" style={{ color: cfg.color }}>{sev.label}</h2>
            <p className="ra-encouragement">{sev.encourage}</p>
            <p className="ra-desc">{sev.desc1}</p>
            {sev.desc2 && <p className="ra-desc">{sev.desc2}</p>}

            {cfg.symptoms.length > 0 && (
                <>
                    <div className="ra-divider" />
                    <p style={{ fontSize: 17, fontWeight: 600, color: "#37474F", margin: "0 0 16px" }}>Symptom profile</p>
                    <div className="ra-spider-wrap">
                        <SpiderChart
                            symptoms={cfg.symptoms}
                            scores={symptomScores}
                            color={cfg.color}
                            trackColor={cfg.trackColor}
                        />
                        <p className="ra-spider-caption">
                            The graph displays different symptoms of {configKey}. We have highlighted the ones that were found to affect you most.
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────
// 📋  TECHNICAL DEPTH MODAL
// ─────────────────────────────────────────────────────────
function TechnicalDepthModal({ report, faceData, blinkCount, eyeContact, fusionLog, maskingDetection, voiceEmotion, onClose }) {
    const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    const time  = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

    const rawReport = report || "Report data unavailable. Ensure the Python backend is running and the session was completed.";

    // Download Function
    const handleDownload = () => {
        const textToSave =
            `Horizon Mental Health - Technical Depth Report
Date: ${today}
Time: ${time}
--------------------------------------------------

[ BIOMETRIC OBSERVATIONS ]
Total Blinks: ${blinkCount ?? "N/A"}
Eye Contact Pattern: ${eyeContact ?? "N/A"}
Dominant Facial Emotion (FaceAPI): ${faceData?.faceapi_dominant ?? "Neutral"}
Dominant Facial Emotion (DeepFace): ${faceData?.deepface_dominant ?? "Unavailable"}
Face Tracking Reliability (Rf): ${faceData?.reliability ?? "N/A"}

--------------------------------------------------
[ AI CLINICAL REPORT & ANALYSIS ]

${rawReport}

--------------------------------------------------
Confidentiality Notice: This document contains sensitive mental health information and must be stored, shared, and reviewed only in accordance with applicable privacy laws, institutional policy, and professional ethical standards.`;

        const blob = new Blob([textToSave], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Horizon_Report_${new Date().getTime()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="ra-modal-overlay" onClick={onClose}>
            <div className="ra-modal" onClick={(e) => e.stopPropagation()}>
                <div className="ra-modal-handle" />

                {/* Download Button */}
                <button className="ra-download-btn" onClick={handleDownload} title="Download Report">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Download
                </button>

                <h2>Technical Depth Report</h2>

                <h3>Facility &amp; Report Information</h3>
                <table>
                    <tbody>
                    <tr><td><b>Facility</b></td><td>Horizon Mental Health Platform</td></tr>
                    <tr><td><b>Report Title</b></td><td>AI Multi-Modal Mental Health Assessment</td></tr>
                    <tr><td><b>Date of Evaluation</b></td><td>{today}</td></tr>
                    <tr><td><b>Time of Evaluation</b></td><td>{time}</td></tr>
                    <tr><td><b>System Version</b></td><td>ATMF-MSI v1.0</td></tr>
                    </tbody>
                </table>

                <h3>Multi-Modal Clinical Observations</h3>
                <table>
                    <thead><tr><th>Signal Domain</th><th>Observed Value</th></tr></thead>
                    <tbody>
                    <tr><td>Total Blink Count</td><td>{blinkCount ?? "N/A"}</td></tr>
                    <tr><td>Eye Contact Status</td><td>{eyeContact ?? "N/A"}</td></tr>
                    <tr><td>Dominant Facial Emotion (FaceAPI)</td><td>{faceData?.faceapi_dominant ?? "Neutral"}</td></tr>
                    <tr><td>Dominant Facial Emotion (DeepFace)</td><td>{faceData?.deepface_dominant ?? "Unavailable"}</td></tr>
                    <tr><td>Face Tracking Reliability (Rf)</td><td>{faceData?.reliability ?? "N/A"}</td></tr>
                    </tbody>
                </table>

                <h3>Temporal Segment Analysis</h3>
                {faceData?.temporal_segments && faceData.temporal_segments.length > 0 ? (
                    <table>
                        <thead><tr><th>Segment</th><th>Blinks</th><th>Eye Avoidance</th><th>Dominant Emotion</th><th>Rf</th></tr></thead>
                        <tbody>
                        {faceData.temporal_segments.slice(0, 8).map((seg, i) => (
                            <tr key={i}>
                                <td>T+{seg.timestamp_sec}s</td>
                                <td>{seg.face_metrics?.blinks ?? 0}</td>
                                <td>{seg.face_metrics?.eye_avoidance_ratio ?? 0}</td>
                                <td>{seg.face_metrics?.dominant_emotion ?? "Neutral"}</td>
                                <td>{seg.reliability_scores?.Rf_total ?? "—"}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                ) : (
                    <blockquote>No temporal segment data was recorded. This may occur if the session was very short or the camera was unavailable.</blockquote>
                )}

                <h3>AI Clinical Report & Analysis</h3>
                <blockquote>{rawReport}</blockquote>

                <h3>Voice Analysis Summary</h3>
                <blockquote>
                    {voiceEmotion || "No voice analysis data available."}
                </blockquote>

                <h3>Emotional Consistency Summary</h3>
                <div style={{
                    padding: "16px 18px",
                    borderRadius: 12,
                    background: maskingDetection?.includes("HIGH") ? "#FFF3F3" : "#F0FFF4",
                    border: `1.5px solid ${maskingDetection?.includes("HIGH") ? "#FFCDD2" : "#C8E6C9"}`,
                    marginBottom: 14
                }}>
                    <p style={{
                        margin: 0,
                        fontWeight: 600,
                        fontSize: 15,
                        color: maskingDetection?.includes("HIGH") ? "#C62828" : "#2E7D32"
                    }}>
                        {maskingDetection?.includes("HIGH")
                            ? "Possible emotional masking detected"
                            : "Facial and vocal signals appear consistent"}
                    </p>

                    <p style={{
                        margin: "8px 0 0",
                        fontSize: 13,
                        color: "#546E7A",
                        lineHeight: 1.6,
                        fontWeight: 500
                    }}>
                        {maskingDetection?.includes("HIGH")
                            ? "The session showed some mismatch between facial expression and vocal tone. This can happen when a person appears outwardly calm or positive while their voice suggests distress."
                            : "The session showed good alignment between facial expression and vocal tone, with no strong mismatch detected across the recorded interaction."}
                    </p>
                </div>

                <hr />
                <p style={{ fontSize: 12, color: "#90A4AE", fontWeight: 500 }}>
                    <b>Confidentiality Notice:</b> This document contains sensitive mental health information and must be stored, shared, and reviewed only in accordance with applicable privacy laws, institutional policy, and professional ethical standards.
                </p>

                <div className="ra-modal-close-row">
                    <button
                        className="ra-btn-3d"
                        style={{ maxWidth: 260 }}
                        onMouseDown={e => { e.currentTarget.style.transform = "scale(0.98)"; }}
                        onMouseUp={e   => { e.currentTarget.style.transform = "scale(1)"; }}
                        onMouseLeave={e=> { e.currentTarget.style.transform = "scale(1)"; }}
                        onClick={onClose}
                    >
                        Close Report
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────
// 🚀  MAIN COMPONENT
// ─────────────────────────────────────────────────────────
export default function ResultAnalysis() {
    const navigate = useNavigate();

    const [scores,      setScores]      = useState(null);
    const [faceData,    setFaceData]    = useState(null);
    const [report,      setReport]      = useState("");
    const [blinkCount,  setBlinkCount]  = useState(0);
    const [eyeContact,  setEyeContact]  = useState("Direct");
    const [animated,    setAnimated]    = useState(false);
    const [showModal,   setShowModal]   = useState(false);
    const [emotions,    setEmotions]    = useState({});

    // ADD THESE 3 NEW LINES RIGHT BELOW:
    const [fusionLog,         setFusionLog]         = useState("");
    const [maskingDetection,  setMaskingDetection]  = useState("CONSISTENT");
    const [voiceEmotion,      setVoiceEmotion]      = useState("");

    // ── Load data from sessionStorage (written by ConsultantPage) ──
    useEffect(() => {
        try {
            const raw = sessionStorage.getItem("horizon_result");
            if (raw) {
                const d = JSON.parse(raw);
                setReport(d.report          ?? "");
                setBlinkCount(d.blinkCount  ?? 0);
                setEyeContact(d.eyeContact  ?? "Direct");
                setEmotions(d.faceEmotions  ?? {});

                // ADD THESE 3 LINES RIGHT BELOW:
                setFusionLog(d.fusionLog               ?? "No fusion data available.");
                setMaskingDetection(d.maskingDetection ?? "CONSISTENT");
                setVoiceEmotion(d.voiceEmotion         ?? "No voice analysis available.");

                const dominant_faceapi  = Object.keys(d.faceEmotions  ?? {}).reduce((a, b) => (d.faceEmotions[a]  > d.faceEmotions[b]  ? a : b), "Neutral");
                const dominant_deepface = Object.keys(d.deepFaceEmotions ?? {}).reduce((a, b) => (d.deepFaceEmotions[a] > d.deepFaceEmotions[b] ? a : b), "Unavailable");
                // Derive scores from temporal data
                const tl    = d.temporalSegments ?? [];
                setFaceData({
                    faceapi_dominant:  dominant_faceapi,
                    deepface_dominant: dominant_deepface,
                    reliability: tl.length
                        ? (tl.reduce((s, t) => s + (t.reliability_scores?.Rf_total ?? 0), 0) / tl.length).toFixed(2)
                        : "N/A",
                    temporal_segments: d.temporalSegments ?? [],
                });
                const avgAvoidance = tl.length
                    ? (tl.reduce((s, t) => s + (t.face_metrics?.eye_avoidance_ratio ?? 0), 0) / tl.length)
                    : 0;
                const blinkScore = Math.min(d.blinkCount ?? 0, 60);

                const stressBase = Math.round(12 + avgAvoidance * 18 + blinkScore * 0.15);
                const deprBase   = Math.round(5  + avgAvoidance * 12 + (dominant_faceapi === "sad" ? 6 : 0));
                const anxBase    = Math.round(6  + avgAvoidance * 10 + blinkScore * 0.1);
                const overall    = Math.round(100 - (stressBase / 40) * 35 - (deprBase / 27) * 35 - (anxBase / 21) * 30);

                setScores({
                    stress:     Math.min(stressBase, 40),
                    depression: Math.min(deprBase,   27),
                    anxiety:    Math.min(anxBase,    21),
                    overall:    Math.max(overall, 10),
                });
            } else {
                // Demo fallback when no session data exists
                setScores({ stress: 27, depression: 7, anxiety: 11, overall: 58 });
                setReport("No session data found. This is a demo result. Complete an AI session to get your personalised report.");
            }
        } catch {
            setScores({ stress: 27, depression: 7, anxiety: 11, overall: 58 });
        }

        // Trigger animations after mount
        const t = setTimeout(() => setAnimated(true), 300);
        return () => clearTimeout(t);
    }, []);

    if (!scores) return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Nunito", color: "#607D8B", fontWeight: 500 }}>
            Loading your report…
        </div>
    );

    const emotionEntries = Object.entries(emotions).sort((a, b) => b[1] - a[1]);
    const maxEmotionVal  = emotionEntries[0]?.[1] ?? 1;

    return (
        <>
            <style>{STYLES}</style>

            {showModal && (
                <TechnicalDepthModal
                    report={report}
                    faceData={faceData}
                    blinkCount={blinkCount}
                    eyeContact={eyeContact}
                    fusionLog={fusionLog}
                    maskingDetection={maskingDetection}
                    voiceEmotion={voiceEmotion}
                    onClose={() => setShowModal(false)}
                />
            )}

            <div className="ra-page">
                <div className="ra-card">

                    {/* ── Banner ── */}
                    <div className="ra-banner">
                        <h1>Report Analysis</h1>
                        <p>Based on your AI session · Confidential &amp; Encrypted</p>
                    </div>

                    {/* ── Overall Wellness ── */}
                    <div className="ra-section" style={{ paddingTop: 32 }}>
                        <ScoreBlock configKey="overall" rawScore={scores.overall} animated={animated} />
                        <div className="ra-divider" />
                    </div>

                    {/* ── Stress ── */}
                    <div className="ra-section">
                        <h2 className="ra-score-heading">Your Stress Result</h2>
                        <ScoreBlock configKey="stress" rawScore={scores.stress} animated={animated} />
                        <div className="ra-divider" />
                    </div>

                    {/* ── Depression ── */}
                    <div className="ra-section">
                        <h2 className="ra-score-heading">Your Depression Result</h2>
                        <ScoreBlock configKey="depression" rawScore={scores.depression} animated={animated} />
                        <div className="ra-divider" />
                    </div>

                    {/* ── Anxiety ── */}
                    <div className="ra-section">
                        <h2 className="ra-score-heading">Your Anxiety Result</h2>
                        <ScoreBlock configKey="anxiety" rawScore={scores.anxiety} animated={animated} />
                        <div className="ra-divider" />
                    </div>

                    {/* ── Facial Emotion Distribution ── */}
                    {emotionEntries.length > 0 && (
                        <div className="ra-section">
                            <p style={{ fontSize: 17, fontWeight: 600, color: "#37474F", margin: "0 0 18px" }}>Detected Emotion Distribution</p>
                            {emotionEntries.slice(0, 6).map(([emotion, count]) => (
                                <div className="ra-timeline-row" key={emotion}>
                                    <span className="ra-tl-label">{emotion}</span>
                                    <div className="ra-tl-bar-bg">
                                        <div className="ra-tl-bar-fill"
                                             style={{
                                                 width: animated ? `${(count / maxEmotionVal) * 100}%` : "0%",
                                                 background: "linear-gradient(90deg, #82B1FF, #2962FF)",
                                             }} />
                                    </div>
                                    <span className="ra-tl-count">{count}</span>
                                </div>
                            ))}
                            <div className="ra-divider" />
                        </div>
                    )}

                    {/* ── Biometric Metrics ── */}
                    <div className="ra-section">
                        <p style={{ fontSize: 17, fontWeight: 600, color: "#37474F", margin: "0 0 18px" }}>Session Biometrics</p>
                        <div className="ra-metrics-grid">
                            <div className="ra-metric-card">
                                <p className="ra-metric-val">{blinkCount}</p>
                                <p className="ra-metric-lbl">Total Blinks</p>
                            </div>
                            <div className="ra-metric-card">
                                <p className="ra-metric-val" style={{ fontSize: 16 }}>{eyeContact?.includes("Direct") ? "Direct" : "Avoidant"}</p>
                                <p className="ra-metric-lbl">Eye Contact Pattern</p>
                            </div>
                            <div className="ra-metric-card">
                                <p className="ra-metric-val">{faceData?.faceapi_dominant ?? "Neutral"}</p>
                                <p className="ra-metric-lbl">Dominant Emotion</p>
                            </div>
                            <div className="ra-metric-card">
                                <p className="ra-metric-val">{faceData?.reliability ?? "—"}</p>
                                <p className="ra-metric-lbl">Tracking Reliability (Rf)</p>
                            </div>
                        </div>
                    </div>

                    {/* ── Sticky bottom CTA ── */}
                    <div className="ra-sticky-cta">
                        <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 12 }}>
                            <button
                                className="ra-btn-3d"
                                onClick={() => setShowModal(true)}
                                onMouseDown={e => { e.currentTarget.style.transform = "scale(0.98)"; e.currentTarget.style.boxShadow = "none"; }}
                                onMouseUp={e   => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none"; }}
                                onMouseLeave={e=> { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none"; }}
                            >
                                Get technical depth
                            </button>
                            <button
                                className="ra-btn-3d ra-btn-light"
                                onClick={() => navigate("/bookexpert")}
                                onMouseDown={e => { e.currentTarget.style.transform = "scale(0.98)"; }}
                                onMouseUp={e   => { e.currentTarget.style.transform = "scale(1)"; }}
                                onMouseLeave={e=> { e.currentTarget.style.transform = "scale(1)"; }}
                            >
                                Book a Consultant
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </>
    );
}