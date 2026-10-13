import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

import doctorImg      from "../assets/doctor.png";
import interiorImg    from "../assets/interior.jpg";
import therapyIconImg from "../assets/therapy-icon.png";
import logoImg        from "../assets/logo.png";

import { fetchTherapists } from "../Therapistadapter.jsx";

// ==========================================
// 🎨 STYLES
// ==========================================
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');

  html, body, #root {
    margin: 0 !important; padding: 0 !important;
    width: 100vw; overflow-x: hidden;
    background: #F5F7FF; font-family: 'Nunito', sans-serif;
  }
  * { box-sizing: border-box; }

  /* ── Page wrapper ── */
  .vd-page {
    width: 100%; min-height: 100vh;
    display: flex; flex-direction: column; align-items: center;
    background: #F5F7FF;
  }

  /* ── Global header (sticky) ── */
  .vd-global-header {
    width: 100vw; background: #fff;
    display: flex; justify-content: center;
    box-shadow: 0 2px 10px rgba(0,0,0,0.05);
    position: sticky; top: 0; z-index: 200;
  }
  .vd-global-header-inner {
    width: 100%; max-width: 1400px;
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 24px;
  }
  .logo-area { display: flex; align-items: center; gap: 10px; font-size: 22px; font-weight: 600; color: #000; cursor: pointer; }
  .header-logo { height: 26px; object-fit: contain; }
  .nav-links { display: flex; gap: clamp(14px,3vw,38px); }
  .nav-link { color: #666; font-weight: 500; font-size: 15px; cursor: pointer; transition: color 0.2s; }
  .nav-link:hover { color: #1A5FCC; }

  /* ── Profile card (mobile-app style) ── */
  .profile-container {
    width: 100%; max-width: 900px;
    background: #fff;
    margin: 36px auto 60px auto;
    border-radius: 24px;
    box-shadow: 0 20px 60px rgba(41,98,255,0.09);
    overflow: hidden;
    position: relative;
    padding-bottom: 100px;
  }

  /* Profile sticky sub-header */
  .profile-header {
    padding: 18px 24px;
    display: flex; align-items: center; gap: 14px;
    position: sticky; top: 64px;
    background: #fff; z-index: 100;
    border-bottom: 1px solid #F0F0F0;
  }
  .back-arrow { font-size: 22px; cursor: pointer; color: #333; font-weight: 600; line-height: 1; }
  .header-title { font-size: 19px; font-weight: 600; color: #1a1a1a; margin: 0; }

  /* ── HERO VIDEO ── */
  .hero-media {
    width: 100%; height: 240px;
    background: #D9E8FF;
    position: relative; overflow: hidden;
  }
  .hero-media iframe {
    width: 100%; height: 100%; border: none;
    pointer-events: none;
  }
  .hero-overlay {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    background: rgba(0,0,0,0.18);
    cursor: pointer;
    transition: background 0.2s;
  }
  .hero-overlay:hover { background: rgba(0,0,0,0.08); }
  .play-btn-wrap {
    width: 64px; height: 64px;
    background: rgba(255,255,255,0.88);
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    backdrop-filter: blur(6px);
    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    transition: transform 0.15s;
  }
  .play-btn-wrap:hover { transform: scale(1.08); }
  .play-triangle {
    width: 0; height: 0;
    border-top: 12px solid transparent;
    border-bottom: 12px solid transparent;
    border-left: 20px solid #2962FF;
    margin-left: 4px;
  }

  /* ── TABS ── */
  .tabs-container {
    display: flex; padding: 18px 20px; gap: 10px;
    border-bottom: 1px solid #F0F0F0;
  }
  .tab-btn {
    flex: 1; padding: 13px 0; text-align: center;
    font-size: 15px; font-weight: 600;
    border-radius: 12px; cursor: pointer; transition: all 0.2s;
  }
  .tab-btn.active   { background: #fff; color: #2962FF; border: 2px solid #2962FF; }
  .tab-btn.inactive { background: #F5F5F5; color: #888; border: 2px solid transparent; }

  /* ── ABOUT TAB ── */
  .about-section { padding: 24px; }

  .info-row { display: flex; align-items: center; gap: 18px; margin-bottom: 24px; }
  .info-avatar { width: 76px; height: 76px; border-radius: 50%; object-fit: cover; background: #F0F4FF; border: 3px solid #E8EEFF; }
  .info-text h2 { margin: 0 0 4px; font-size: 21px; font-weight: 700; color: #1a1a1a; }
  .info-text p  { margin: 0; font-size: 13px; font-weight: 500; color: #607D8B; }

  .details-list { display: flex; flex-direction: column; gap: 9px; margin-bottom: 22px; }
  .detail-item {
    display: flex; align-items: center; gap: 10px;
    font-size: 14px; font-weight: 500; color: #555;
  }
  .detail-icon { width: 20px; height: 20px; object-fit: contain; flex-shrink: 0; }

  .bio-text { font-size: 15px; color: #555; line-height: 1.65; margin-bottom: 8px; }
  .read-more { color: #2962FF; font-weight: 600; font-size: 13px; cursor: pointer; text-align: right; margin-bottom: 28px; }

  /* Section headers */
  .section-heading {
    display: flex; align-items: center; gap: 12px;
    font-size: 17px; font-weight: 600; color: #1a1a1a;
    margin: 28px 0 16px;
  }
  .section-icon-wrap {
    width: 38px; height: 38px; background: #EEF3FF;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .section-icon-wrap img { width: 20px; height: 20px; object-fit: contain; }

  /* Concerns */
  .concerns-box {
    background: #fff; border: 1.5px solid #E8EEFF;
    border-radius: 16px; padding: 18px;
    display: flex; flex-direction: column; gap: 14px;
  }
  .concern-item {
    display: flex; align-items: flex-start; gap: 10px;
    font-size: 15px; font-weight: 500; color: #555;
  }
  .concern-quote { color: #448AFF; font-size: 22px; line-height: 1; flex-shrink: 0; }
  .view-all { text-align: right; color: #2962FF; font-size: 13px; font-weight: 600; cursor: pointer; margin-top: 10px; }

  /* Therapy categories */
  .categories-scroll {
    display: flex; gap: 14px; overflow-x: auto; padding-bottom: 10px;
    -ms-overflow-style: none; scrollbar-width: none;
  }
  .categories-scroll::-webkit-scrollbar { display: none; }
  .category-item { display: flex; flex-direction: column; align-items: center; gap: 8px; min-width: 84px; text-align: center; }
  .cat-img {
    width: 76px; height: 76px; background: #EEF3FF;
    border-radius: 16px;
    display: flex; align-items: center; justify-content: center;
  }
  .cat-img img { width: 36px; height: 36px; object-fit: contain; }
  .cat-label { font-size: 12px; font-weight: 500; color: #555; line-height: 1.3; }

  /* Specialisations */
  .spec-list { display: flex; flex-direction: column; gap: 11px; }
  .spec-item {
    display: flex; align-items: center; gap: 14px;
    padding: 14px 18px; border: 1.5px solid #E8EEFF;
    border-radius: 12px; font-size: 15px; font-weight: 500; color: #444;
    cursor: pointer; transition: background 0.15s;
  }
  .spec-item:hover { background: #F0F4FF; }
  .spec-num {
    width: 26px; height: 26px; background: #2962FF; color: #fff;
    border-radius: 50%; display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 600; flex-shrink: 0;
  }
  .spec-arrow { margin-left: auto; color: #B0BEC5; font-size: 18px; }

  /* Languages */
  .lang-tags { display: flex; gap: 12px; flex-wrap: wrap; }
  .lang-tag {
    padding: 8px 18px; border: 1.5px solid #E8EEFF;
    border-radius: 100px; font-size: 14px; font-weight: 500; color: #444;
    display: flex; align-items: center; gap: 8px;
  }
  .lang-check { color: #2962FF; font-weight: 700; }

  /* Affiliations */
  .aff-item {
    display: flex; align-items: flex-start; gap: 10px;
    font-size: 15px; font-weight: 500; color: #555; line-height: 1.55;
    padding: 14px 0; border-bottom: 1px solid #F0F0F0;
  }
  .aff-check { color: #2962FF; font-weight: 700; margin-top: 2px; flex-shrink: 0; }

  /* ── BOOK SESSION TAB ── */
  .book-section { padding: 24px; }

  .clinic-img { width: 100%; height: 180px; object-fit: cover; border-radius: 16px; margin-bottom: 28px; }
  .clinic-placeholder {
    width: 100%; height: 180px; border-radius: 16px; margin-bottom: 28px;
    background: linear-gradient(135deg, #E8EEFF 0%, #D9E8FF 100%);
    display: flex; align-items: center; justify-content: center;
    color: #90A4AE; font-size: 14px; font-weight: 500;
  }

  .book-heading { font-size: 17px; font-weight: 600; color: #1a1a1a; margin: 0 0 14px 0; }

  .pricing-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; padding: 16px 18px; background: #EEF3FF; border-radius: 14px; }
  .duration-text { font-size: 15px; font-weight: 600; color: #2962FF; }
  .price-text    { font-size: 15px; font-weight: 500; color: #444; }

  /* Session type */
  .type-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 28px; }
  .type-btn {
    padding: 18px 0; border: 2px solid #E8EEFF; border-radius: 14px;
    display: flex; flex-direction: column; align-items: center; gap: 8px;
    background: #fff; cursor: pointer; transition: all 0.2s;
  }
  .type-btn:hover { border-color: #2962FF; background: #F0F4FF; }
  .type-btn.active { background: #2962FF; border-color: #2962FF; }
  
  /* FIXED ICON BEHAVIOR: 
     Instead of CSS filters, we use standard image handling. 
     If you have separate active/inactive SVG icons in the future, swap them here. 
     For now, we just ensure it doesn't disappear when active. */
  .type-icon { width: 28px; height: 28px; object-fit: contain; }
  .type-label { font-size: 13px; font-weight: 600; }
  .type-btn.active .type-label { color: #fff; }
  .type-btn:not(.active) .type-label { color: #555; }

  /* Location */
  .location-row {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 28px; padding: 16px 18px;
    background: #F8F9FF; border-radius: 14px; gap: 12px;
  }
  .loc-text { font-size: 14px; color: #555; line-height: 1.6; }
  .loc-icon-wrap {
    width: 40px; height: 40px; border: 2px solid #E8EEFF; border-radius: 12px;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .loc-icon-wrap img { width: 20px; height: 20px; object-fit: contain; }

  /* Slots */
  .slots-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
  .dates-scroll {
    display: flex; gap: 12px; overflow-x: auto; padding-bottom: 10px; margin-bottom: 22px;
    -ms-overflow-style: none; scrollbar-width: none;
  }
  .dates-scroll::-webkit-scrollbar { display: none; }

  .date-card {
    min-width: 96px; border: 2px solid #E8EEFF; border-radius: 14px;
    padding: 14px 10px; text-align: center; cursor: pointer;
    background: #fff; transition: all 0.2s; flex-shrink: 0;
  }
  .date-card.disabled { background: #F5F5F5; opacity: 0.55; cursor: not-allowed; }
  .date-card.active   { background: #2962FF; border-color: #2962FF; }
  .date-day   { font-size: 11px; font-weight: 600; margin-bottom: 5px; text-transform: uppercase; }
  .date-value { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
  .date-avail { font-size: 11px; font-weight: 500; }

  .time-section-label { font-size: 12px; font-weight: 600; color: #90A4AE; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 12px; }
  .time-slots-wrap { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px; }
  .time-slot {
    padding: 12px 22px; border: 2px solid #E8EEFF; border-radius: 10px;
    font-size: 14px; font-weight: 500; color: #555; cursor: pointer; transition: all 0.2s;
  }
  .time-slot:hover { border-color: #2962FF; color: #2962FF; background: #F0F4FF; }
  .time-slot.active { background: #EEF3FF; border-color: #2962FF; color: #2962FF; }

  /* Fixed bottom bar */
  .bottom-bar {
    position: fixed; bottom: 0; left: 0; right: 0;
    background: #fff; padding: 16px 20px;
    box-shadow: 0 -8px 24px rgba(0,0,0,0.07);
    display: flex; justify-content: center; z-index: 150;
  }
  .bottom-bar-inner { width: 100%; max-width: 600px; }

  @media (max-width: 640px) {
    .profile-container { margin: 0; border-radius: 0; }
    .nav-links { display: none !important; }
  }
`;

// ==========================================
// 🧩 3D BUTTON
// ==========================================
const Button3D = ({ children, onClick, variant = "blue", disabled = false, styleOverrides = {} }) => {
    const gradients = {
        blue:  "#1A5FCC",
        light: "linear-gradient(180deg, #F0F4FF 0%, #D9E2F5 100%)",
        gray:  "linear-gradient(180deg, #CFD8DC 0%, #B0BEC5 100%)",
    };
    const shadows = {
        blue:  "none",
        light: "none",
        gray:  "none",
    };
    const textColor = variant === "light" ? "#333" : "#fff";
    const shadow    = shadows[variant] || shadows.blue;

    return (
        <button
            onClick={disabled ? undefined : onClick}
            style={{
                padding: "clamp(13px,2vw,16px) clamp(28px,4vw,48px)",
                borderRadius: "10px", border: "none",
                cursor: disabled ? "not-allowed" : "pointer",
                color: textColor, fontSize: "clamp(14px,1.4vw,16px)",
                fontWeight: "500", fontFamily: "'Nunito', sans-serif",
                letterSpacing: "0.3px",
                background: disabled ? gradients.gray : (gradients[variant] || gradients.blue),
                boxShadow: disabled ? shadows.gray : shadow,
                transition: "all 0.15s ease-out", outline: "none", width: "100%",
                opacity: disabled ? 0.75 : 1,
                ...styleOverrides,
            }}
            onMouseDown={e => { if (!disabled) { e.currentTarget.style.transform = "scale(0.98)"; e.currentTarget.style.boxShadow = "none"; } }}
            onMouseUp={e   => { e.currentTarget.style.transform = "scale(1) translateY(0)"; e.currentTarget.style.boxShadow = shadow; }}
            onMouseLeave={e=> { e.currentTarget.style.transform = "scale(1) translateY(0)"; e.currentTarget.style.boxShadow = shadow; }}
        >
            {children}
        </button>
    );
};

// ==========================================
// 🚀 MAIN COMPONENT
// ==========================================
export default function Viewdetails() {
    const navigate = useNavigate();
    const location = useLocation();

    const [activeTab,    setActiveTab]    = useState("about");
    const [docData,      setDocData]      = useState(null);
    const [videoPlaying, setVideoPlaying] = useState(false);
    const [bioExpanded,  setBioExpanded]  = useState(false);

    // Booking state
    const [selectedType, setSelectedType] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedTime, setSelectedTime] = useState(null);

    const YOUTUBE_ID = "7LD8iC4NqXM";

    useEffect(() => {
        const data = fetchTherapists();
        if (data && data.length > 0) {
            const docId = location.state?.doctorId;
            const selectedDoc = data.find(d => d.id === docId) || data[0];
            setDocData(selectedDoc);
        }
    }, [location]);

    if (!docData) return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Nunito', sans-serif", color: "#607D8B", fontSize: 16, fontWeight: 500 }}>
            Loading profile…
        </div>
    );

    const canProceed = !!(selectedType && selectedDate && selectedTime);

    const SLOTS = {
        "15": { day: "WED", label: "15th Apr", times: { EVENING: ["5:00 PM"] }, avail: "1 available" },
        "16": { day: "THU", label: "16th Apr", times: { MORNING: ["9:00 AM", "10:00 AM", "11:30 AM"] }, avail: "3 available" },
        "17": { day: "FRI", label: "17th Apr", times: { AFTERNOON: ["2:00 PM", "3:30 PM", "4:30 PM"], EVENING: ["6:00 PM"] }, avail: "4 available" },
        "18": { day: "SAT", label: "18th Apr", times: { MORNING: ["10:00 AM", "11:00 AM"] }, avail: "2 available" },
    };

    const SESSION_TYPES = [
        { id: "inperson", label: "In-Person" },
        { id: "video",    label: "Video"     },
        { id: "call",     label: "Call"      },
    ];

    return (
        <>
            <style>{STYLES}</style>
            <div className="vd-page">

                {/* ── GLOBAL HEADER ── */}
                <div className="vd-global-header">
                    <div className="vd-global-header-inner">
                        <div className="logo-area" onClick={() => navigate("/home")}>
                            <img src={logoImg} alt="Horizon" className="header-logo" />
                            Horizon
                        </div>
                        <nav className="nav-links">
                            <span className="nav-link" onClick={() => navigate("/consultation")}>Meet the Consultant</span>
                            <span className="nav-link" onClick={() => navigate("/therapy")}>Meet the Therapist</span>
                            <span className="nav-link" onClick={() => navigate("/bookexpert")}>Book a Doctor</span>
                        </nav>
                        <Button3D variant="blue" onClick={() => navigate("/consultation")} styleOverrides={{ padding: "10px 24px", width: "auto", fontSize: 14 }}>
                            Get Started
                        </Button3D>
                    </div>
                </div>

                {/* ── PROFILE CARD ── */}
                <div className="profile-container">

                    {/* ── HERO VIDEO ── */}
                    <div className="hero-media">
                        {videoPlaying ? (
                            <iframe
                                src={`https://www.youtube.com/embed/${YOUTUBE_ID}?autoplay=1&rel=0&modestbranding=1`}
                                allow="autoplay; encrypted-media"
                                allowFullScreen
                                title="Therapist Demo"
                                style={{ width: "100%", height: "100%", border: "none" }}
                            />
                        ) : (
                            <>
                                <img
                                    src={`https://img.youtube.com/vi/${YOUTUBE_ID}/maxresdefault.jpg`}
                                    alt="Demo video thumbnail"
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                    onError={e => { e.target.src = doctorImg; }}
                                />
                                <div className="hero-overlay" onClick={() => setVideoPlaying(true)}>
                                    <div className="play-btn-wrap">
                                        <div className="play-triangle" />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* ── TABS ── */}
                    <div className="tabs-container">
                        <div className={`tab-btn ${activeTab === "about" ? "active" : "inactive"}`} onClick={() => setActiveTab("about")}>
                            About {docData.name.split(" ")[1] || docData.name}
                        </div>
                        <div className={`tab-btn ${activeTab === "book" ? "active" : "inactive"}`} onClick={() => setActiveTab("book")}>
                            Book Session
                        </div>
                    </div>

                    {/* ══════════════════════════════════════════
                        TAB 1: ABOUT
                    ══════════════════════════════════════════ */}
                    {activeTab === "about" && (
                        <div className="about-section">

                            <div className="info-row">
                                <img src={doctorImg} alt="Avatar" className="info-avatar" />
                                <div className="info-text">
                                    <h2>{docData.name}</h2>
                                    <p>Senior Consultant Psychologist</p>
                                </div>
                            </div>

                            <div className="details-list">
                                <div className="detail-item">
                                    <img src={therapyIconImg} alt="" className="detail-icon" />
                                    B.A, M.Sc, M.Phil
                                </div>
                                <div className="detail-item">
                                    <img src={therapyIconImg} alt="" className="detail-icon" />
                                    {docData.experience}
                                </div>
                                <div className="detail-item">
                                    <img src={therapyIconImg} alt="" className="detail-icon" />
                                    {docData.fee}
                                </div>
                            </div>

                            <p className="bio-text">
                                Sometimes, life asks more of us than we know how to give. In trying to stay strong, we forget what it feels like to simply be. Pain doesn't always look the way we expect — it can appear as overthinking, exhaustion, or a quiet sense of feeling lost.
                                {bioExpanded && (
                                    <> My approach is rooted in empathy, evidence, and collaboration. I believe that every person has the inner resources to heal — and I am here to help you find them. Together, we'll create a safe, non-judgemental space where your voice matters.</>
                                )}
                            </p>
                            <div className="read-more" onClick={() => setBioExpanded(p => !p)}>
                                {bioExpanded ? "Read less ▲" : "Read more ▼"}
                            </div>

                            <div className="section-heading">
                                <div className="section-icon-wrap"><img src={therapyIconImg} alt="" /></div>
                                Concerns I can help with
                            </div>
                            <div className="concerns-box">
                                {["I feel like I overthink everything", "I don't feel like myself lately", "I struggle to manage my emotions at work", "I feel disconnected from my relationships"].map((c, i) => (
                                    <div className="concern-item" key={i}>
                                        <span className="concern-quote">❝</span>
                                        {c}
                                    </div>
                                ))}
                            </div>
                            <div className="view-all">View All Concerns ▼</div>

                            <div className="section-heading">
                                <div className="section-icon-wrap"><img src={therapyIconImg} alt="" /></div>
                                I offer therapy for
                            </div>
                            <div className="categories-scroll">
                                {[...docData.expertise, "Relationships", "Stress"].map((exp, i) => (
                                    <div className="category-item" key={i}>
                                        <div className="cat-img"><img src={therapyIconImg} alt="" /></div>
                                        <span className="cat-label">{exp.length > 14 ? exp.substring(0, 14) + "…" : exp}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="section-heading">
                                <div className="section-icon-wrap"><img src={therapyIconImg} alt="" /></div>
                                I Specialise in
                            </div>
                            <div className="spec-list">
                                {["Cognitive Behaviour Therapy", "Rational Emotive Behaviour Therapy", "Narrative Therapy", "Mindfulness-Based Stress Reduction"].map((s, i) => (
                                    <div className="spec-item" key={i}>
                                        <div className="spec-num">{i + 1}</div>
                                        {s}
                                        <span className="spec-arrow">›</span>
                                    </div>
                                ))}
                            </div>
                            <div className="view-all" style={{ marginTop: 14 }}>View All Specialisations ▼</div>

                            <div className="section-heading">
                                <div className="section-icon-wrap"><img src={therapyIconImg} alt="" /></div>
                                Languages I speak
                            </div>
                            <div className="lang-tags">
                                {docData.languages.map((l, i) => (
                                    <div className="lang-tag" key={i}>
                                        <span className="lang-check">✓</span>{l}
                                    </div>
                                ))}
                            </div>

                            <div className="section-heading">
                                <div className="section-icon-wrap"><img src={therapyIconImg} alt="" /></div>
                                My Affiliations
                            </div>
                            <div className="aff-item">
                                <span className="aff-check">✓</span>
                                Senior Consultant Psychologist at Horizon Mental Health from Oct 2023 to present
                            </div>
                            <div className="aff-item">
                                <span className="aff-check">✓</span>
                                Clinical Psychologist, MedFirst Wellness Centre, Jan 2019 – Sep 2023
                            </div>

                        </div>
                    )}

                    {/* ══════════════════════════════════════════
                        TAB 2: BOOK SESSION
                    ══════════════════════════════════════════ */}
                    {activeTab === "book" && (
                        <div className="book-section">

                            <img
                                src={interiorImg}
                                alt="Clinic interior"
                                className="clinic-img"
                                onError={e => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }}
                            />
                            <div className="clinic-placeholder" style={{ display: "none" }}>
                                <span>Clinic Interior</span>
                            </div>

                            <h3 className="book-heading">Session Duration</h3>
                            <div className="pricing-row">
                                <span className="duration-text">50 mins · 1 session</span>
                                <span className="price-text">{docData.fee}</span>
                            </div>

                            <h3 className="book-heading">What type of session would you like?</h3>
                            <div className="type-grid">
                                {SESSION_TYPES.map(t => (
                                    <div
                                        key={t.id}
                                        className={`type-btn ${selectedType === t.id ? "active" : ""}`}
                                        onClick={() => setSelectedType(t.id)}
                                    >
                                        {/* REMOVED the CSS filter that was making the image disappear */}
                                        <img
                                            src={therapyIconImg} alt=""
                                            className="type-icon"
                                        />
                                        <span className="type-label">{t.label}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="location-row">
                                <div className="loc-text">
                                    <strong>Horizon Mental Health Centre,</strong><br />
                                    2nd Floor, Keerthi Surya Shakthi Towers<br />
                                    ITPL Main Road, Bangalore – 560048
                                </div>
                                <div className="loc-icon-wrap">
                                    <img src={therapyIconImg} alt="" />
                                </div>
                            </div>

                            <div className="slots-header">
                                <h3 className="book-heading" style={{ margin: 0 }}>Check available slots</h3>
                                <div className="loc-icon-wrap">
                                    <img src={therapyIconImg} alt="" />
                                </div>
                            </div>

                            <div className="dates-scroll">
                                <div className="date-card disabled">
                                    <div className="date-day" style={{ color: "#999" }}>TODAY</div>
                                    <div className="date-value" style={{ color: "#999" }}>14th Apr</div>
                                    <div className="date-avail" style={{ color: "#999" }}>not available</div>
                                </div>

                                {Object.entries(SLOTS).map(([id, slot]) => (
                                    <div
                                        key={id}
                                        className={`date-card ${selectedDate === id ? "active" : ""}`}
                                        onClick={() => { setSelectedDate(id); setSelectedTime(null); }}
                                    >
                                        <div className="date-day"  style={{ color: selectedDate === id ? "#fff" : "#333" }}>{slot.day}</div>
                                        <div className="date-value"style={{ color: selectedDate === id ? "#fff" : "#333" }}>{slot.label}</div>
                                        <div className="date-avail"style={{ color: selectedDate === id ? "#cce" : "#2962FF" }}>{slot.avail}</div>
                                    </div>
                                ))}
                            </div>

                            {selectedDate && Object.entries(SLOTS[selectedDate].times).map(([period, times]) => (
                                <div key={period}>
                                    <p className="time-section-label">{period}</p>
                                    <div className="time-slots-wrap">
                                        {times.map(t => (
                                            <div
                                                key={t}
                                                className={`time-slot ${selectedTime === t ? "active" : ""}`}
                                                onClick={() => setSelectedTime(t)}
                                            >
                                                {t}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            <div style={{ height: 20 }} />
                        </div>
                    )}

                </div>

                {/* ── FIXED BOTTOM PROCEED BAR ── */}
                {activeTab === "book" && (
                    <div className="bottom-bar">
                        <div className="bottom-bar-inner">
                            <Button3D
                                variant={canProceed ? "blue" : "light"}
                                disabled={!canProceed}
                                onClick={() => {
                                    if (canProceed) {
                                        alert(`Booking confirmed!\n\nType: ${selectedType}\nDoctor: ${docData.name}\nDate: ${SLOTS[selectedDate].label}\nTime: ${selectedTime}`);
                                    }
                                }}
                                styleOverrides={{ fontSize: 16, fontWeight: 600, padding: "18px 0" }}
                            >
                                {canProceed ? "PROCEED TO CONFIRM" : "SELECT SESSION DETAILS"}
                            </Button3D>
                        </div>
                    </div>
                )}

            </div>
        </>
    );
}