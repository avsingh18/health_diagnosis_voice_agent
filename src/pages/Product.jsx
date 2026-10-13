import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

import logoImg from "../assets/logo.png";
import therapyIconImg from "../assets/therapy-icon.png";

// ==========================================
// 📊 PROGRAM DATA
// ==========================================
const PROGRAMS = [
    { id: "stress",     title: "Tackling Stress",        color: "#FFF3E0", textColor: "#5D4037" },
    { id: "depression", title: "Overcoming Depression",  color: "#E4F0FF", textColor: "#1e3d80" },
    { id: "anxiety",    title: "Beating Anxiety",        color: "#E0F2F1", textColor: "#004D40" },
    { id: "sleep",      title: "Sleeping Better",        color: "#EDE7F6", textColor: "#311B92" },
    { id: "anger",      title: "Managing Anger",         color: "#FCE4EC", textColor: "#880E4F" },
    { id: "happiness",  title: "Living Happier",         color: "#FBE9E7", textColor: "#bf360c" },
];

// ==========================================
// 📖 SYMPTOMS DATA
// ==========================================
const SYMPTOMS_DATA = {
    stress: {
        intro: "Stress is your body's physical, mental and emotional response to any changes in your environment. While some amount of stress can be good for you, excessive stress can lead to a variety of emotional and physical problems.",
        list: [
            { title: "Inability to Relax", desc: "You may feel constantly on edge, unable to wind down even when you have free time." },
            { title: "Lack of Focus", desc: "Your concentration power diminishes — difficulty following instructions, remembering things, keeping track of conversations, making decisions or performing complicated tasks." },
            { title: "Low Immunity", desc: "Prolonged stress weakens your immune system, making you more susceptible to frequent colds and infections." },
            { title: "Poor Decision Making", desc: "Stress clouds your judgment, making it difficult to weigh pros and cons effectively." },
        ],
    },
    depression: {
        intro: "Depression is a common mental health disorder that negatively affects how you feel, the way you think and how you act. It can lead to a variety of emotional and physical problems.",
        list: [
            { title: "Low Interest & Diminished Enjoyment", desc: "Losing interest in hobbies or activities you once enjoyed is a hallmark symptom." },
            { title: "Fatigue", desc: "Feeling physically drained or overwhelmingly tired, even after a full night's sleep." },
            { title: "Lack of Focus", desc: "Difficulty concentrating, remembering details, or making decisions." },
            { title: "Low Self-esteem", desc: "Harboring feelings of worthlessness, guilt, or harsh self-criticism." },
            { title: "Negative Automatic Thoughts", desc: "A persistent stream of pessimistic or hopeless thoughts about yourself and the future." },
            { title: "Anxiety", desc: "Often co-occurring with depression, characterized by restlessness and excessive worry." },
        ],
    },
    default: {
        intro: "Understanding your symptoms is the first step toward building a personalized recovery plan tailored to your exact needs.",
        list: [
            { title: "Emotional Exhaustion", desc: "Feeling drained, overwhelmed, or unable to cope with daily tasks." },
            { title: "Physical Symptoms", desc: "Experiencing unexplained headaches, stomachaches, or muscle tension." },
        ],
    },
};

// ==========================================
// ❓ ASSESSMENT BANK (3+3+3 = 9 questions each)
// ==========================================
const ASSESSMENT_BANK = {
    stress: [
        // — Health (3) —
        { section: "Health",   text: "How often have you felt physically exhausted or drained of energy?",              options: [{l:"Not at all",s:0},{l:"Several days",s:1},{l:"More than half the days",s:2},{l:"Nearly every day",s:3}] },
        { section: "Health",   text: "Have you experienced tension headaches, jaw clenching, or muscle pain?",          options: [{l:"Not at all",s:0},{l:"Several days",s:1},{l:"More than half the days",s:2},{l:"Nearly every day",s:3}] },
        { section: "Health",   text: "How has your sleep quality been lately?",                                          options: [{l:"Good",s:0},{l:"Slightly disrupted",s:1},{l:"Poor",s:2},{l:"Very poor / Insomnia",s:3}] },
        // — Symptom (3) —
        { section: "Symptom",  text: "How often do you feel overwhelmed by your responsibilities?",                     options: [{l:"Rarely",s:0},{l:"Sometimes",s:1},{l:"Often",s:2},{l:"Constantly",s:3}] },
        { section: "Symptom",  text: "Do you find yourself becoming easily irritable or agitated?",                    options: [{l:"Rarely",s:0},{l:"Sometimes",s:1},{l:"Often",s:2},{l:"Constantly",s:3}] },
        { section: "Symptom",  text: "How often do you feel you cannot cope with all the things you have to do?",      options: [{l:"Never",s:0},{l:"Sometimes",s:1},{l:"Fairly often",s:2},{l:"Very often",s:3}] },
        // — Global (3) —
        { section: "Global",   text: "How much is stress interfering with your daily work or social life?",            options: [{l:"Not at all",s:0},{l:"A little",s:1},{l:"Moderately",s:2},{l:"Severely",s:3}] },
        { section: "Global",   text: "Do you feel you have adequate support to manage your current stress levels?",    options: [{l:"Yes, plenty",s:0},{l:"Some support",s:1},{l:"Not much",s:2},{l:"No support at all",s:3}] },
        { section: "Global",   text: "How confident are you in your ability to handle personal problems right now?",   options: [{l:"Very confident",s:0},{l:"Somewhat confident",s:1},{l:"Not very confident",s:2},{l:"Not at all confident",s:3}] },
    ],
    depression: [
        { section: "Health",   text: "How often have you been bothered by trouble falling or staying asleep?",         options: [{l:"Not at all",s:0},{l:"Several days",s:1},{l:"More than half the days",s:2},{l:"Nearly every day",s:3}] },
        { section: "Health",   text: "How would you describe your appetite lately?",                                    options: [{l:"Normal",s:0},{l:"Slightly off",s:1},{l:"Significantly changed",s:2},{l:"Extreme change",s:3}] },
        { section: "Health",   text: "How often do you feel tired or have little energy?",                              options: [{l:"Not at all",s:0},{l:"Several days",s:1},{l:"More than half the days",s:2},{l:"Nearly every day",s:3}] },
        { section: "Symptom",  text: "How often have you felt little interest or pleasure in doing things?",           options: [{l:"Not at all",s:0},{l:"Several days",s:1},{l:"More than half the days",s:2},{l:"Nearly every day",s:3}] },
        { section: "Symptom",  text: "How often have you felt down, depressed, or hopeless?",                          options: [{l:"Not at all",s:0},{l:"Several days",s:1},{l:"More than half the days",s:2},{l:"Nearly every day",s:3}] },
        { section: "Symptom",  text: "How often have you felt bad about yourself, or that you are a failure?",         options: [{l:"Not at all",s:0},{l:"Several days",s:1},{l:"More than half the days",s:2},{l:"Nearly every day",s:3}] },
        { section: "Global",   text: "How difficult have these problems made it to do your work or care for things at home?", options: [{l:"Not difficult at all",s:0},{l:"Somewhat difficult",s:1},{l:"Very difficult",s:2},{l:"Extremely difficult",s:3}] },
        { section: "Global",   text: "How hopeful are you about the future?",                                          options: [{l:"Very hopeful",s:0},{l:"Somewhat hopeful",s:1},{l:"Not very hopeful",s:2},{l:"Hopeless",s:3}] },
        { section: "Global",   text: "How often do you feel disconnected or isolated from people around you?",         options: [{l:"Rarely",s:0},{l:"Sometimes",s:1},{l:"Often",s:2},{l:"Constantly",s:3}] },
    ],
    default: [
        { section: "Health",   text: "How is your overall physical energy level?",                                     options: [{l:"High",s:0},{l:"Moderate",s:1},{l:"Low",s:2},{l:"Exhausted",s:3}] },
        { section: "Health",   text: "How is your sleep quality?",                                                     options: [{l:"Great",s:0},{l:"Okay",s:1},{l:"Poor",s:2},{l:"Terrible",s:3}] },
        { section: "Health",   text: "Have you noticed changes in your appetite?",                                     options: [{l:"No",s:0},{l:"Slightly",s:1},{l:"Moderately",s:2},{l:"Severely",s:3}] },
        { section: "Symptom",  text: "How often do you feel overwhelmed by your thoughts?",                           options: [{l:"Rarely",s:0},{l:"Sometimes",s:1},{l:"Often",s:2},{l:"Always",s:3}] },
        { section: "Symptom",  text: "How difficult is it to control your emotions?",                                 options: [{l:"Not difficult",s:0},{l:"Slightly difficult",s:1},{l:"Very difficult",s:2},{l:"Impossible",s:3}] },
        { section: "Symptom",  text: "How often do you feel on edge or unable to relax?",                             options: [{l:"Rarely",s:0},{l:"Sometimes",s:1},{l:"Often",s:2},{l:"Always",s:3}] },
        { section: "Global",   text: "How much is this affecting your daily life and work?",                           options: [{l:"Not at all",s:0},{l:"A little",s:1},{l:"A lot",s:2},{l:"Completely",s:3}] },
        { section: "Global",   text: "How do you view your relationships currently?",                                  options: [{l:"Strong",s:0},{l:"Okay",s:1},{l:"Strained",s:2},{l:"Failing",s:3}] },
        { section: "Global",   text: "How confident are you that things will improve?",                               options: [{l:"Very",s:0},{l:"Somewhat",s:1},{l:"Not very",s:2},{l:"Not at all",s:3}] },
    ],
};

// Section score labels per category
const SCORE_LABELS = {
    stress:     { Health: "Physical Health Score", Symptom: "Stress Symptom Score", Global: "Life Impact Score" },
    depression: { Health: "Physical Health Score", Symptom: "Depression Score",     Global: "Global Functioning Score" },
    default:    { Health: "Physical Health Score", Symptom: "Symptom Score",        Global: "Life Impact Score" },
};

// ==========================================
// 🎨 STYLES
// ==========================================
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');

  html, body, #root {
    margin: 0 !important; padding: 0 !important;
    width: 100vw; overflow-x: hidden;
    background: #FFFFFF; font-family: 'Nunito', sans-serif;
  }
  * { box-sizing: border-box; }

  .horizon-container { width: 100vw; min-height: 100vh; display: flex; flex-direction: column; align-items: center; background: #F5F7FF; }
  .header-wrapper { width: 100vw; background: #FFFFFF; display: flex; justify-content: center; box-shadow: 0 2px 10px rgba(0,0,0,0.05); z-index: 10; position: sticky; top: 0; }
  .header { display: flex; justify-content: space-between; align-items: center; padding: 18px 24px; width: 100%; max-width: 1400px; }
  .logo-area { display: flex; align-items: center; gap: 10px; font-size: 24px; font-weight: 600; color: #000; cursor: pointer; }
  .header-logo { height: 28px; object-fit: contain; }
  .nav-links { display: flex; gap: clamp(16px, 3vw, 40px); }
  .nav-link { color: #666; font-weight: 500; font-size: 16px; cursor: pointer; transition: color 0.2s; }
  .nav-link:hover { color: #1A5FCC; }

  /* ── App Window ── */
  .app-window {
    width: 100%; max-width: 600px;
    background: #FFFFFF;
    margin: 40px auto;
    border-radius: 24px;
    box-shadow: 0 20px 60px rgba(41,98,255,0.10);
    overflow: hidden;
    display: flex; flex-direction: column;
    position: relative;
    min-height: 600px;
  }

  .app-header { padding: 30px 30px 10px 30px; }
  .app-title   { font-size: 24px; font-weight: 600; color: #1a1a1a; margin-bottom: 10px; line-height: 1.3; }
  .app-subtitle{ font-size: 15px; font-weight: 500; color: #607D8B; line-height: 1.6; }

  .section-label { font-size: 13px; font-weight: 600; color: #90A4AE; letter-spacing: 1.5px; text-transform: uppercase; margin: 24px 30px 12px 30px; }

  /* Program Cards */
  .program-list  { padding: 0 20px 30px 20px; display: flex; flex-direction: column; gap: 12px; }
  .program-card  {
    display: flex; align-items: center; padding: 18px 20px; border-radius: 16px; cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .program-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.07); }
  .program-icon  { width: 40px; height: 40px; object-fit: contain; margin-right: 16px; flex-shrink: 0; }
  .program-info h4 { font-size: 17px; font-weight: 600; margin: 0; }
  .program-arrow { margin-left: auto; font-size: 22px; font-weight: 500; }

  /* Intro */
  .intro-banner { height: 140px; display: flex; align-items: center; justify-content: center; }
  .intro-banner img { height: 80px; object-fit: contain; filter: drop-shadow(0 4px 16px rgba(0,0,0,0.12)); }
  .accordion-container { padding: 0 30px 110px 30px; }
  .accordion-item { border-bottom: 1px solid #ECEFF1; padding: 14px 0; cursor: pointer; }
  .accordion-header { display: flex; justify-content: space-between; align-items: center; font-size: 15px; font-weight: 500; color: #455A64; }
  .accordion-content { font-size: 14px; color: #607D8B; margin-top: 8px; line-height: 1.6; }
  .bottom-cta {
    position: absolute; bottom: 0; left: 0; right: 0;
    background: linear-gradient(0deg, #FFFFFF 70%, transparent 100%);
    padding: 24px 30px;
    display: flex; justify-content: center;
  }

  /* Overview */
  .overview-list { padding: 20px 30px 110px 30px; display: flex; flex-direction: column; gap: 28px; }
  .overview-item { display: flex; align-items: center; gap: 20px; }
  .overview-icon-wrap {
    width: 54px; height: 54px; background: #F0F4FF; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .overview-icon-wrap img { width: 28px; height: 28px; object-fit: contain; }
  .overview-text { font-size: 17px; font-weight: 500; color: #455A64; }

  /* Quiz */
  .quiz-container { flex-grow: 1; display: flex; flex-direction: column; padding: 36px 30px; }
  .quiz-icon-wrap { display: flex; justify-content: center; margin-bottom: 18px; }
  .quiz-icon-wrap img { width: 64px; height: 64px; object-fit: contain; filter: drop-shadow(0 4px 12px rgba(41,98,255,0.2)); }
  .quiz-title    { font-size: 22px; font-weight: 600; color: #1a1a1a; margin-bottom: 10px; text-align: center; }
  .quiz-subtitle { font-size: 15px; color: #607D8B; margin-bottom: 32px; text-align: center; line-height: 1.5; }
  .quiz-question { font-size: 19px; font-weight: 500; color: #1a1a1a; margin-bottom: 24px; line-height: 1.4; }
  .section-chip  { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 14px; }
  .section-chip img { width: 18px; height: 18px; object-fit: contain; }
  .section-chip span { font-size: 13px; font-weight: 600; color: #2962FF; letter-spacing: 1px; text-transform: uppercase; }

  .progress-bar-container { width: 100%; height: 6px; background: #E0E0E0; border-radius: 10px; margin-top: auto; overflow: hidden; }
  .progress-bar-fill { height: 100%; background: linear-gradient(90deg, #4B8DFF, #2962FF); transition: width 0.35s ease; border-radius: 10px; }
  .deep-breath-text { font-size: 11px; font-weight: 600; color: #B0BEC5; letter-spacing: 2px; margin: 16px 0 10px; text-transform: uppercase; text-align: center; }

  .back-btn { font-size: 15px; font-weight: 600; color: #B0BEC5; cursor: pointer; display: flex; align-items: center; gap: 4px; margin-bottom: 20px; width: fit-content; }
  .back-btn:hover { color: #2962FF; }

  /* ── Result / Scores ── */
  @keyframes popIn {
    0%   { transform: scale(0.75); opacity: 0; }
    60%  { transform: scale(1.06); opacity: 1; }
    100% { transform: scale(1); }
  }
  @keyframes confettiFall {
    0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
    100% { transform: translateY(100px) rotate(720deg); opacity: 0; }
  }

  .score-card {
    background: #FFFFFF;
    border: 2.5px solid #E8EEFF;
    border-radius: 18px;
    padding: 18px 22px;
    margin-bottom: 14px;
    animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    box-shadow: 0 6px 24px rgba(41,98,255,0.08);
    display: flex; align-items: center; justify-content: space-between;
  }
  .score-card:nth-child(2) { animation-delay: 0.1s; opacity: 0; }
  .score-card:nth-child(3) { animation-delay: 0.2s; opacity: 0; }
  .score-card:nth-child(4) { animation-delay: 0.3s; opacity: 0; }

  .score-label { font-size: 14px; font-weight: 500; color: #607D8B; margin-bottom: 4px; }
  .score-value { font-size: 32px; font-weight: 700; color: #2962FF; line-height: 1; }
  .score-max   { font-size: 14px; color: #B0BEC5; font-weight: 500; }
  .severity-pill {
    padding: 6px 16px; border-radius: 100px; font-size: 13px; font-weight: 600; letter-spacing: 0.5px;
  }

  .confetti-piece {
    position: absolute; width: 10px; height: 10px; border-radius: 2px;
    animation: confettiFall 1.8s ease-out forwards;
  }

  /* Section transition screen bg colours */
  .bg-health  { background: linear-gradient(160deg, #FFF8E1 0%, #FFFDE7 100%); }
  .bg-symptom { background: linear-gradient(160deg, #F3E5F5 0%, #EDE7F6 100%); }
  .bg-global  { background: linear-gradient(160deg, #E8F5E9 0%, #F1F8E9 100%); }
  .bg-result  { background: linear-gradient(160deg, #E8F0FE 0%, #EEF3FF 100%); }

  @media (max-width: 640px) {
    .app-window { margin: 0; border-radius: 0; min-height: 100vh; }
    .nav-links { display: none !important; }
  }
`;

// ==========================================
// 🧩 3D BUTTON (matches HomePage exactly)
// ==========================================
const Button3D = ({ children, onClick, variant = "blue", styleOverrides = {} }) => {
    const gradients = {
        blue:  "linear-gradient(180deg, #4B8DFF 0%, #1A5FCC 100%)",
        black: "linear-gradient(180deg, #424242 0%, #212121 100%)",
        light: "linear-gradient(180deg, #F0F4FF 0%, #D9E2F5 100%)",
    };
    const textColor = variant === "light" ? "#333" : "#fff";
    const shadow = variant === "light"
        ? "inset 0 4px 8px rgba(255,255,255,0.8), inset 0 -6px 12px rgba(0,0,0,0.05), 0 4px 10px rgba(0,0,0,0.05)"
        : "inset 0 4px 8px rgba(255,255,255,0.3), inset 0 -6px 12px rgba(0,0,0,0.2), 0 4px 10px rgba(0,0,0,0.1)";
    const shadowPressed = variant === "light" ? "inset 0 2px 4px rgba(0,0,0,0.05)" : "inset 0 2px 4px rgba(0,0,0,0.3)";

    return (
        <button
            onClick={onClick}
            style={{
                padding: "clamp(13px,2vw,16px) clamp(28px,4vw,48px)",
                borderRadius: "100px", border: "none", cursor: "pointer",
                color: textColor, fontSize: "clamp(14px,1.4vw,16px)", fontWeight: "500",
                fontFamily: "'Nunito', sans-serif", letterSpacing: "0.3px",
                background: gradients[variant],
                boxShadow: shadow,
                transition: "all 0.15s ease-out", outline: "none",
                width: "100%",
                ...styleOverrides,
            }}
            onMouseDown={e => { e.currentTarget.style.transform = "scale(0.96) translateY(2px)"; e.currentTarget.style.boxShadow = shadowPressed; }}
            onMouseUp={e   => { e.currentTarget.style.transform = "scale(1) translateY(0)";      e.currentTarget.style.boxShadow = shadow; }}
            onMouseLeave={e=> { e.currentTarget.style.transform = "scale(1) translateY(0)";      e.currentTarget.style.boxShadow = shadow; }}
        >
            {children}
        </button>
    );
};

// ==========================================
// 🎊 CONFETTI COMPONENT
// ==========================================
const CONFETTI_COLORS = ["#2962FF","#448AFF","#00BCD4","#4CAF50","#FF9800","#E91E63","#9C27B0"];
function Confetti() {
    const pieces = Array.from({ length: 28 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 20}%`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: `${6 + Math.random() * 8}px`,
        delay: `${Math.random() * 0.8}s`,
        duration: `${1.2 + Math.random() * 1}s`,
    }));

    return (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
            {pieces.map(p => (
                <div key={p.id} className="confetti-piece" style={{
                    left: p.left, top: p.top,
                    width: p.size, height: p.size,
                    background: p.color,
                    animationDelay: p.delay,
                    animationDuration: p.duration,
                }} />
            ))}
        </div>
    );
}

// ==========================================
// 🚀 MAIN COMPONENT
// ==========================================
export default function Product() {
    const navigate = useNavigate();

    const [view, setView]           = useState("dashboard");
    const [selectedProgram, setSP]  = useState(null);
    const [expandedAcc, setExpAcc]  = useState(null);
    const [quizStep, setQuizStep]   = useState(0);
    const [answers, setAnswers]     = useState([]);
    const [currentBank, setBank]    = useState([]);
    // section transition flag
    const [showSectionIntro, setSSI]= useState(false);
    const appWindowRef = useRef(null);

    const scrollTop = () => appWindowRef.current?.scrollTo({ top: 0, behavior: "smooth" });

    const handleProgramSelect = (prog) => {
        setSP(prog);
        setBank(ASSESSMENT_BANK[prog.id] || ASSESSMENT_BANK.default);
        setAnswers([]);
        setQuizStep(0);
        setView("intro");
        setExpAcc(null);
        scrollTop();
    };

    const handleAnswer = (points) => {
        const newAnswers = [...answers, points];
        setAnswers(newAnswers);
        const nextStep = quizStep + 1;

        if (nextStep >= currentBank.length) {
            setView("result");
            scrollTop();
            return;
        }

        // Check if entering a new section → show section intro
        if (currentBank[nextStep].section !== currentBank[quizStep].section) {
            setQuizStep(nextStep);
            setSSI(true);
            setView("section_transition");
            scrollTop();
        } else {
            setQuizStep(nextStep);
        }
    };

    // Derived score helpers
    const sectionScores = () => {
        if (!currentBank.length || !answers.length) return {};
        const sections = {};
        currentBank.forEach((q, i) => {
            if (answers[i] !== undefined) {
                if (!sections[q.section]) sections[q.section] = 0;
                sections[q.section] += answers[i];
            }
        });
        return sections;
    };

    const totalScore = answers.reduce((a, b) => a + b, 0);
    const maxScore   = currentBank.length * 3; // 9 * 3 = 27

    const getSeverity = (score, max) => {
        const pct = score / max;
        if (pct > 0.66) return { label: "Severe",   color: "#E53935", bg: "#FFEBEE" };
        if (pct > 0.33) return { label: "Moderate", color: "#F57C00", bg: "#FFF3E0" };
        return                  { label: "Mild",     color: "#2E7D32", bg: "#E8F5E9" };
    };

    const sectionSeverity = (score) => {
        if (score >= 7) return { label: "High",   color: "#E53935" };
        if (score >= 4) return { label: "Medium", color: "#F57C00" };
        return                  { label: "Low",   color: "#2E7D32" };
    };

    const getResultMessage = () => {
        const s = getSeverity(totalScore, maxScore);
        if (s.label === "Severe")   return "Your results indicate severe symptoms. We strongly recommend booking a session with one of our certified consultants for professional support.";
        if (s.label === "Moderate") return "Your results indicate moderate symptoms. Our guided therapy programs and wellness games will be a great starting point for you.";
        return "Your results indicate mild symptoms. Some basic self-care routines and tracking tools should be very helpful to you.";
    };

    const scoreLabels = SCORE_LABELS[selectedProgram?.id] || SCORE_LABELS.default;

    // Section metadata
    const SECTION_META = {
        Health:  { title: "Health Assessment",  subtitle: "Let's check your physical well-being — sleep, energy, and body signals.", bgClass: "bg-health"  },
        Symptom: { title: "Symptom Assessment", subtitle: "Now let's explore the emotional and psychological symptoms you experience.",  bgClass: "bg-symptom" },
        Global:  { title: "Global Assessment",  subtitle: "Finally, let's understand how this affects your overall day-to-day life.",    bgClass: "bg-global"  },
    };

    // ── RENDERS ──────────────────────────────────────────────

    const renderDashboard = () => (
        <>
            <div className="app-header">
                <h2 className="app-title">Hi, Avadhesh! What brings you here?</h2>
                <p className="app-subtitle">Choose a programme below to begin your personalised scientific assessment.</p>
            </div>

            <p className="section-label">Our Programmes</p>
            <div className="program-list">
                {PROGRAMS.map(p => (
                    <div key={p.id} className="program-card" style={{ background: p.color }} onClick={() => handleProgramSelect(p)}>
                        <img src={therapyIconImg} alt="" className="program-icon" />
                        <div className="program-info">
                            <h4 style={{ color: p.textColor }}>{p.title}</h4>
                        </div>
                        <span className="program-arrow" style={{ color: p.textColor }}>›</span>
                    </div>
                ))}
            </div>
        </>
    );

    const renderIntro = () => {
        const symptoms = SYMPTOMS_DATA[selectedProgram.id] || SYMPTOMS_DATA.default;
        return (
            <>
                <div className="intro-banner" style={{ background: selectedProgram.color }}>
                    <img src={therapyIconImg} alt="" />
                </div>
                <div className="app-header" style={{ paddingBottom: 10 }}>
                    <div className="back-btn" onClick={() => setView("dashboard")}>‹ Back</div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "#90A4AE", marginBottom: 6 }}>{selectedProgram.title}</p>
                    <h2 className="app-title">We've got your back, Avadhesh.</h2>
                    <p className="app-subtitle">
                        Living with this can be challenging and overwhelming. But we're here for you.<br /><br />
                        We'd like to better understand your situation to create a personalised plan based on your needs.<br /><br />
                        Take our 9-step scientific assessment (3 sections × 3 questions each) to help us create your plan.
                    </p>
                    <h2 className="app-title" style={{ fontSize: 19, marginTop: 28 }}>Understanding Symptoms</h2>
                    <p className="app-subtitle" style={{ marginBottom: 0 }}>{symptoms.intro}</p>
                </div>

                <div className="accordion-container">
                    {symptoms.list.map((item, i) => (
                        <div className="accordion-item" key={i} onClick={() => setExpAcc(expandedAcc === i ? null : i)}>
                            <div className="accordion-header">
                                {item.title}
                                <span style={{ fontSize: 12 }}>{expandedAcc === i ? "▲" : "▼"}</span>
                            </div>
                            {expandedAcc === i && <div className="accordion-content">{item.desc}</div>}
                        </div>
                    ))}
                </div>

                <div className="bottom-cta">
                    <Button3D variant="blue" onClick={() => setView("overview")}>START THE ASSESSMENT</Button3D>
                </div>
            </>
        );
    };

    const renderOverview = () => (
        <>
            <div className="app-header">
                <div className="back-btn" onClick={() => setView("intro")}>‹ Back</div>
                <h2 className="app-title">{selectedProgram.title} Assessment</h2>
                <p className="app-subtitle">To fully understand your levels, we'll conduct the assessment in 3 parts (3 questions each).</p>
            </div>
            <div className="overview-list">
                {["Health", "Symptom", "Global"].map((sec) => (
                    <div className="overview-item" key={sec}>
                        <div className="overview-icon-wrap">
                            <img src={therapyIconImg} alt="" />
                        </div>
                        <div className="overview-text">{SECTION_META[sec].title}</div>
                    </div>
                ))}
            </div>
            <div className="bottom-cta">
                <Button3D variant="blue" onClick={() => { setQuizStep(0); setAnswers([]); setView("section_transition"); setSSI(true); }}>
                    START ASSESSMENT
                </Button3D>
            </div>
        </>
    );

    const renderSectionTransition = () => {
        const sec = currentBank[quizStep]?.section || "Health";
        const meta = SECTION_META[sec];
        return (
            <div className={`quiz-container ${meta.bgClass}`} style={{ textAlign: "center" }}>
                <div className="quiz-icon-wrap">
                    <img src={therapyIconImg} alt="" />
                </div>
                <h2 className="quiz-title">{meta.title}</h2>
                <p className="quiz-subtitle">{meta.subtitle}</p>
                <div style={{ marginTop: 32, maxWidth: 340, margin: "32px auto 0" }}>
                    <Button3D variant="blue" onClick={() => { setSSI(false); setView("quiz_questions"); }}>
                        CONTINUE
                    </Button3D>
                </div>
                <p className="deep-breath-text">TAKE A DEEP BREATH</p>
                <div className="progress-bar-container" style={{ marginTop: 12 }}>
                    <div className="progress-bar-fill" style={{ width: `${(quizStep / currentBank.length) * 100}%` }} />
                </div>
            </div>
        );
    };

    const renderQuestions = () => {
        const question = currentBank[quizStep];
        const progress = ((quizStep + 1) / currentBank.length) * 100;
        const secQ = quizStep % 3 + 1; // question 1-3 within section

        return (
            <div style={{ padding: "32px 28px", display: "flex", flexDirection: "column", minHeight: 580 }}>
                <div className="back-btn" onClick={() => { setQuizStep(0); setAnswers([]); setView("overview"); }}>
                    ‹ Restart
                </div>

                <div className="section-chip">
                    <img src={therapyIconImg} alt="" style={{ width: 18, height: 18 }} />
                    <span>{question.section} • Q{secQ} of 3</span>
                </div>

                <h2 className="quiz-question">{question.text}</h2>

                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
                    {question.options.map((opt, i) => (
                        <Button3D
                            key={i}
                            variant="light"
                            onClick={() => handleAnswer(opt.s)}
                            styleOverrides={{ textAlign: "left", padding: "16px 22px", color: "#455A64", fontSize: 15 }}
                        >
                            {opt.l}
                        </Button3D>
                    ))}
                </div>

                <div style={{ marginTop: "auto", paddingTop: 24 }}>
                    <div className="progress-bar-container">
                        <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <p style={{ fontSize: 12, color: "#B0BEC5", fontWeight: 500, marginTop: 8, textAlign: "right" }}>
                        {quizStep + 1} / {currentBank.length}
                    </p>
                </div>
            </div>
        );
    };

    const renderResult = () => {
        const overall     = getSeverity(totalScore, maxScore);
        const secScores   = sectionScores();
        const sections    = ["Health", "Symptom", "Global"];

        return (
            <div className="quiz-container bg-result" style={{ position: "relative", overflow: "hidden" }}>
                <Confetti />

                <div className="quiz-icon-wrap" style={{ position: "relative", zIndex: 1 }}>
                    <img src={therapyIconImg} alt="" style={{ width: 72, height: 72 }} />
                </div>
                <h2 className="quiz-title" style={{ position: "relative", zIndex: 1 }}>Assessment Complete!</h2>
                <p className="quiz-subtitle" style={{ position: "relative", zIndex: 1 }}>
                    Thank you for sharing. Here is your personalised report for{" "}
                    <strong>{selectedProgram.title}</strong>.
                </p>

                {/* Overall score */}
                <div className="score-card" style={{ position: "relative", zIndex: 1, marginBottom: 8 }}>
                    <div>
                        <p className="score-label">Overall Score</p>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                            <span className="score-value">{totalScore}</span>
                            <span className="score-max">/ {maxScore}</span>
                        </div>
                    </div>
                    <span className="severity-pill" style={{ background: overall.bg, color: overall.color }}>
                        {overall.label}
                    </span>
                </div>

                {/* Per-section scores */}
                {sections.map((sec, idx) => {
                    const s   = secScores[sec] ?? 0;
                    const sev = sectionSeverity(s);
                    const lbl = scoreLabels[sec] || `${sec} Score`;
                    return (
                        <div className="score-card" key={sec} style={{ position: "relative", zIndex: 1, animationDelay: `${(idx + 1) * 0.1}s`, opacity: 0 }}>
                            <div>
                                <p className="score-label">{lbl}</p>
                                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                                    <span className="score-value" style={{ fontSize: 26 }}>{s}</span>
                                    <span className="score-max">/ 9</span>
                                </div>
                            </div>
                            <span className="severity-pill" style={{ background: sev.color + "22", color: sev.color }}>
                                {sev.label}
                            </span>
                        </div>
                    );
                })}

                <p className="quiz-subtitle" style={{ marginTop: 4, position: "relative", zIndex: 1 }}>
                    {getResultMessage()}
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16, position: "relative", zIndex: 1 }}>
                    <Button3D variant="blue" onClick={() => navigate("/bookexpert")}>MEET A CONSULTANT</Button3D>
                    <Button3D variant="light" onClick={() => { setView("dashboard"); setSP(null); setAnswers([]); setQuizStep(0); }}>
                        RETURN TO PROGRAMMES
                    </Button3D>
                </div>
            </div>
        );
    };

    return (
        <>
            <style>{STYLES}</style>
            <div className="horizon-container">

                {/* HEADER */}
                <div className="header-wrapper">
                    <header className="header">
                        <div className="logo-area" onClick={() => navigate("/")}>
                            <img src={logoImg} alt="Horizon" className="header-logo" />
                            Horizon
                        </div>
                        <nav className="nav-links">
                            <span className="nav-link" onClick={() => navigate("/")}>Home</span>
                            <span className="nav-link" onClick={() => navigate("/events")}>Events</span>
                            <span className="nav-link" onClick={() => navigate("/therapy")}>Therapy</span>
                            <span className="nav-link" onClick={() => navigate("/products")}>Products</span>
                            <span className="nav-link" onClick={() => navigate("/about")}>About</span>
                        </nav>
                        <Button3D variant="blue" styleOverrides={{ padding: "10px 24px", width: "auto", fontSize: 14 }} onClick={() => navigate("/therapy")}>
                            Get Started
                        </Button3D>
                    </header>
                </div>

                {/* APP WINDOW */}
                <div className="app-window" ref={appWindowRef}>
                    {view === "dashboard"          && renderDashboard()}
                    {view === "intro"               && renderIntro()}
                    {view === "overview"            && renderOverview()}
                    {view === "section_transition"  && renderSectionTransition()}
                    {view === "quiz_questions"      && renderQuestions()}
                    {view === "result"              && renderResult()}
                </div>

            </div>
        </>
    );
}