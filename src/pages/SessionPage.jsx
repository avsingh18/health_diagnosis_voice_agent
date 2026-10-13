import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import handImg from "../assets/hand.png";
import bannerImg from "../assets/banner_image.png";
import SiteHeader from "../components/SiteHeader.jsx";

// ══════════════════════════════════════════════════════════════
// 🎨  STYLES
// ══════════════════════════════════════════════════════════════
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');

  *, *::before, *::after { box-sizing: border-box; }
  html, body, #root {
    margin: 0 !important; padding: 0 !important;
    width: 100%; min-height: 100vh;
    background: #E2EDFB;
    font-family: 'Nunito', sans-serif !important;
  }

  /* ── Page wrapper ── */
  .session-container {
    max-width: 900px;
    margin: 0 auto;
    padding: 40px 20px 80px;
    display: flex;
    flex-direction: column;
    gap: 28px;
    align-items: center;
  }

  /* ── Top banner image ── */
  .top-banner-image {
    width: 100%; max-width: 900px;
    height: clamp(240px, 40vw, 420px);
    border-radius: 20px;
    object-fit: cover;
  }

  /* ── Nav header ── */
  .session-header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 4px;
  }
  .session-header-title {
    font-size: clamp(18px, 4vw, 22px);
    font-weight: 700;
    color: #1A237E;
    margin: 0;
  }
  .user-avatar-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .user-avatar {
    width: 38px; height: 38px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid #82B1FF;
  }
  .user-name {
    font-size: 14px; font-weight: 500; color: #37474F;
  }
  .logout-btn {
    background: transparent;
    border: 1px solid #82B1FF;
    border-radius: 100px;
    padding: 5px 14px;
    font-size: 12px; font-weight: 500;
    color: #2962FF;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: 'Nunito', sans-serif;
  }
  .logout-btn:hover { background: rgba(41,98,255,0.06); }

  /* ── Banner card ── */
  .banner-card {
    background: #82B1FF;
    border-radius: 20px;
    width: 100%;
    padding: clamp(20px, 4vw, 28px) clamp(20px, 5vw, 40px);
    display: flex;
    flex-direction: column;
    gap: 20px;
    box-shadow: 0 8px 30px rgba(130,177,255,0.25);
  }
  .banner-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    width: 100%;
  }
  .banner-title-group {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .banner-hand {
    width: 44px; height: auto;
    transform: translateY(-4px);
    flex-shrink: 0;
  }
  .banner-title {
    font-size: clamp(16px, 3.5vw, 20px);
    font-weight: 500;
    color: #FFFFFF;
  }

  /* ── File upload ── */
  .upload-success {
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(255,255,255,0.25);
    border-radius: 12px;
    padding: 10px 16px;
    margin-top: 4px;
  }
  .upload-success-icon { font-size: 18px; }
  .upload-success-text { font-size: 13px; font-weight: 500; color: #fff; }
  .upload-note {
    font-size: 12px; font-weight: 500;
    color: rgba(255,255,255,0.75);
    margin-top: 2px;
  }

  /* ── Time selector ── */
  .time-options {
    display: flex;
    justify-content: center;
    gap: clamp(12px, 3vw, 28px);
    flex-wrap: wrap;
    margin-top: 8px;
  }
  .time-box {
    background: #FFFFFF;
    border-radius: 14px;
    padding: clamp(14px, 3vw, 20px) clamp(20px, 5vw, 36px);
    font-size: clamp(14px, 3vw, 16px);
    font-weight: 500;
    color: #333;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 4px 12px rgba(0,0,0,0.06);
    border: 2px solid transparent;
    text-align: center;
    user-select: none;
  }
  .time-box:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0,0,0,0.1);
  }
  .time-box.selected {
    border-color: #2962FF;
    color: #2962FF;
    background: #F0F5FF;
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(41,98,255,0.18);
  }
  .time-label-sub {
    font-size: 11px; font-weight: 500;
    color: #90A4AE;
    display: block;
    margin-top: 3px;
  }
  .time-box.selected .time-label-sub { color: #448AFF; }

  /* ── Continue section ── */
  .continue-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    margin-top: 8px;
  }
  .continue-hint {
    font-size: 13px; font-weight: 500;
    color: #78909C;
    text-align: center;
  }

  /* ── Mobile ── */
  @media (max-width: 600px) {
    .session-container { padding: 24px 16px 60px; gap: 20px; }
    .time-options       { gap: 10px; }
    .time-box           { padding: 14px 20px; }
    .banner-header      { flex-direction: column; align-items: flex-start; }
  }
`;

// ── 3D Button ─────────────────────────────────────────────────────────────
const Button3D = ({ children, onClick, styleOverrides = {} }) => (
  <button
    onClick={onClick}
    style={{
      padding: "10px 28px",
      borderRadius: "10px", border: "none", cursor: "pointer",
      color: "#fff", fontSize: "14px", fontWeight: "600",
      fontFamily: "'Nunito', sans-serif", letterSpacing: "0.3px",
      background: "#1A5FCC",
      boxShadow: "none",
      transition: "all 0.15s ease-out", outline: "none",
      ...styleOverrides,
    }}
    onMouseDown={e => {
      e.currentTarget.style.transform = "scale(0.98)";
      e.currentTarget.style.boxShadow = "none";
    }}
    onMouseUp={e => {
      e.currentTarget.style.transform = "scale(1) translateY(0)";
      e.currentTarget.style.boxShadow = "none";
    }}
    onMouseLeave={e => {
      e.currentTarget.style.transform = "scale(1) translateY(0)";
      e.currentTarget.style.boxShadow = "none";
    }}
  >
    {children}
  </button>
);

// ══════════════════════════════════════════════════════════════
// 🚀  MAIN COMPONENT
// ══════════════════════════════════════════════════════════════
const TIME_OPTIONS = [
  { value: 60, label: "1 min", sub: "Quick check-in" },
  { value: 90, label: "1.5 min", sub: "Focused session" },
  { value: 120, label: "2 min", sub: "Deep session" },
];

export default function SessionPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [selectedTime, setSelectedTime] = useState(90);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [fileText, setFileText] = useState("");   // extracted text for report

  // ── File upload ─────────────────────────────────────────────────────
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setUploadedFile(file);

    // Read text content for TXT files (PDFs handled on backend)
    if (file.name.toLowerCase().endsWith(".txt")) {
      const reader = new FileReader();
      reader.onload = (e) => setFileText(e.target.result || "");
      reader.readAsText(file);
    } else {
      // For PDF/DOC: store raw file — backend will extract
      setFileText("__file_upload__");
    }
  };

  // ── Continue → consultant ────────────────────────────────────────────
  const handleContinue = () => {
    const sessionConfig = {
      duration_seconds: selectedTime,
      has_uploaded_report: !!uploadedFile,
      file_name: uploadedFile ? uploadedFile.name : null,
      previous_report_text: fileText,      // only used for report, NOT conversation
    };

    sessionStorage.setItem("horizon_session_config", JSON.stringify(sessionConfig));
    sessionStorage.removeItem("horizon_consultant_state"); // Clear any old session state

    // If PDF uploaded, also store file reference for backend submission
    if (uploadedFile && fileText === "__file_upload__") {
      const fr = new FileReader();
      fr.onload = (e) => {
        sessionStorage.setItem(
          "horizon_report_file_b64",
          btoa(String.fromCharCode(...new Uint8Array(e.target.result)))
        );
        sessionStorage.setItem("horizon_report_filename", uploadedFile.name);
        navigate("/consultant");
      };
      fr.readAsArrayBuffer(uploadedFile);
    } else {
      navigate("/consultant");
    }
  };

  return (
    <>
      <style>{STYLES}</style>
      <SiteHeader />
      <div className="session-container">

        {/* Header with user info (Removed) */}
        <div className="session-header">
        </div>

        {/* Top banner */}
        <img src={bannerImg} alt="Session Banner" className="top-banner-image" />

        {/* ── Upload previous report ── */}
        <div className="banner-card">
          <div className="banner-header">
            <div className="banner-title-group">
              <img src={handImg} alt="" className="banner-hand" />
              <span className="banner-title">Upload your previous report (optional)</span>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              accept=".txt,.pdf,.doc,.docx"
              onChange={handleFileUpload}
            />
            <Button3D onClick={() => fileInputRef.current.click()}>
              {uploadedFile ? "Change File" : "Upload"}
            </Button3D>
          </div>

          {uploadedFile ? (
            <>
              <div className="upload-success">
                <span className="upload-success-icon">✅</span>
                <div>
                  <div className="upload-success-text">{uploadedFile.name}</div>
                  <div className="upload-note">
                    This report will only be used to improve your analysis — not shared with anyone.
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="upload-note" style={{ margin: 0 }}>
              If you have a previous session report, uploading it helps our AI provide more accurate analysis. It won't be used during your conversation.
            </p>
          )}
        </div>

        {/* ── Time selection ── */}
        <div className="banner-card">
          <div className="banner-header">
            <div className="banner-title-group">
              <img src={handImg} alt="" className="banner-hand" />
              <span className="banner-title">Select session duration</span>
            </div>
          </div>

          <div className="time-options">
            {TIME_OPTIONS.map(({ value, label, sub }) => (
              <div
                key={value}
                className={`time-box ${selectedTime === value ? "selected" : ""}`}
                onClick={() => setSelectedTime(value)}
              >
                {label}
                <span className="time-label-sub">{sub}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Continue button ── */}
        <div className="continue-section">
          <p className="continue-hint">
            Your session will begin immediately after clicking Continue.
            <br />Make sure you're in a quiet, private space.
          </p>
          <Button3D
            onClick={handleContinue}
            styleOverrides={{ padding: "15px 52px", fontSize: "16px" }}
          >
            Continue to Session →
          </Button3D>
        </div>

      </div>
    </>
  );
}