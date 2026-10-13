import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Cal, { getCalApi } from "@calcom/embed-react";

// Ensure these images exist in your src/assets folder
import logoImg from "../assets/logo.png";
import doctorImg from "../assets/doctor.png";
import handImg from "../assets/hand.png";

// Import your flexible data backend
import { fetchTherapists } from "../Therapistadapter.jsx";

// ==========================================
// 🎨 GLOBAL STYLES
// ==========================================
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');

  /* OVERRIDE DEFAULT VITE/REACT PADDING AND MARGINS */
  html, body, #root { 
    margin: 0 !important; 
    padding: 0 !important; 
    width: 100vw; /* Force full screen width */
    max-width: 100vw !important; 
    overflow-x: hidden; 
    background: #E2EDFB; 
  }

  * { box-sizing: border-box; font-family: 'Nunito', sans-serif !important; }

  /* Layout Containers */
  .horizon-container { width: 100vw; min-height: 100vh; display: flex; flex-direction: column; align-items: center;}
  /* Increase max-width to allow more cards per row on large screens */
  .max-width-wrapper { max-width: 1400px; margin: 0 auto; width: 100%; padding: 0 24px; }
  
  /* Ensure header spans full width regardless of inner wrapper */
  .header-wrapper { width: 100vw; background: #FFFFFF; display: flex; justify-content: center;}

  /* Header */
  .header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; width: 100%; max-width: 1400px;}
  .logo-area { display: flex; align-items: center; gap: 10px; font-size: 24px; font-weight: 600; color: #000; cursor: pointer; letter-spacing: -0.5px; }
  .header-logo { height: 28px; object-fit: contain; }
  .nav-links { display: flex; gap: clamp(16px, 3vw, 40px); }
  .nav-link { color: #666; font-weight: 500; font-size: 16px; cursor: pointer; transition: color 0.2s; }
  .nav-link:hover { color: #1A5FCC; }

  /* Page Title */
  .page-title {
      text-align: center;
      font-size: clamp(32px, 4vw, 48px);
      font-weight: 600;
      color: #555;
      margin: 60px 0 50px 0;
      line-height: 1.2;
  }
  .page-title span {
      color: #2962FF;
  }

  /* Grid Layout - Fixed for uniform heights */
  .therapist-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      grid-auto-rows: 1fr; /* Forces equal height rows */
      gap: 30px;
      width: 100%;
      margin-bottom: 80px;
  }

  /* Card Styling */
  .therapist-card {
      background: #FFFFFF;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.05);
      display: flex;
      flex-direction: column;
      height: 100%; /* Stretches to fill grid row */
      gap: 12px; /* Tightened gap */
      align-items: flex-start; /* Forces all content to the left */
      text-align: left;
  }

  .card-header {
      display: flex;
      gap: 16px;
      align-items: center;
      width: 100%;
      justify-content: flex-start;
      margin-bottom: 4px;
  }

  .doc-avatar {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      object-fit: cover;
      background: #F0F4FF;
  }

  .doc-info {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
  }

  .doc-info h3 {
      font-size: 22px;
      font-weight: 600;
      color: #333;
      margin-bottom: 4px;
  }

  .doc-info p {
      font-size: 14px;
      font-weight: 500;
      color: #777;
      margin-bottom: 2px;
  }

  /* Scrollable Tags Area */
  .card-tags {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      flex-wrap: nowrap;
      overflow-x: auto;
      padding-bottom: 4px; 
      -ms-overflow-style: none; 
      scrollbar-width: none; 
  }
  .card-tags::-webkit-scrollbar {
      display: none; 
  }

  .tag-label {
      font-size: 14px;
      font-weight: 500;
      color: #555;
      min-width: 70px;
      flex-shrink: 0;
      text-align: left;
  }

  .tag-pill {
      background: #F5F5F5;
      color: #888;
      font-size: 12px;
      font-weight: 500;
      padding: 4px 12px;
      border-radius: 100px;
      white-space: nowrap; 
      flex-shrink: 0;
  }

  /* 3D Toggles Container */
  .toggles-container {
      display: flex;
      gap: 10px;
      width: 100%;
      margin-top: 5px;
  }

  /* Pushes the next slot and actions to the bottom of the card */
  .spacer {
      flex-grow: 1; 
  }

  .next-slot {
      font-size: 13px;
      font-weight: 500;
      color: #777;
      width: 100%;
      text-align: left;
      margin-top: auto; /* Push to bottom */
  }
  .next-slot span {
      color: #82B1FF;
  }

  .card-actions {
      display: flex;
      justify-content: space-between;
      gap: 15px;
      margin-top: 8px; /* Reduced gap */
      width: 100%;
  }

  /* Banner Section */
  .banner-section { padding: 40px 24px 80px 24px; display: flex; justify-content: center; width: 100%; }
  .banner-box { 
    background: linear-gradient(90deg, #82B1FF 0%, #448AFF 100%);
    border-radius: 16px; padding: 0 40px; width: 100%; max-width: 1200px; height: 120px;
    display: flex; align-items: center; justify-content: space-between; position: relative; overflow: visible;
  }
  .banner-left { display: flex; align-items: center; gap: 20px; }
  .banner-hand { width: 80px; transform: translateY(-5px); }
  .banner-text { font-size: clamp(20px, 2.5vw, 28px); font-weight: 500; color: #FFF; }
  
  @media (max-width: 768px) {
    .banner-box { flex-direction: column; height: auto; padding: 30px 20px; text-align: center; gap: 20px; }
    .banner-hand { display: none; }
  }
  
  /* Footer full width wrapper */
  .footer-wrapper { width: 100vw; background: #FAFAFA; border-top: 1px solid #E0E0E0; margin-top: 40px; display: flex; justify-content: center;}

  /* Footer */
  .footer { padding: 60px 24px 30px 24px; width: 100%; max-width: 1400px;}
  .footer-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 40px; width: 100%; text-align: left; }
  .footer-desc { color: #888; font-size: 14px; margin-top: 16px; line-height: 1.6; max-width: 250px; }
  .footer-col-title { font-size: 16px; font-weight: 600; color: #333; margin-bottom: 20px; }
  .footer-link { display: block; color: #888; font-size: 14px; margin-bottom: 12px; cursor: pointer; transition: color 0.2s; text-decoration: none; }
  .footer-link:hover { color: #1A5FCC; }
  .footer-bottom { text-align: center; color: #AAA; font-size: 14px; padding-top: 40px; margin-top: 40px; border-top: 1px solid #EEE; }

  @media (max-width: 768px) {
    .footer-grid { grid-template-columns: 1fr; }
  }

  /* Booking Overlay */
  .booking-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.6);
      z-index: 9999;
      display: flex; align-items: center; justify-content: center;
  }
  .booking-modal {
      width: 90%; max-width: 1000px; height: 90vh;
      background: #FFF; border-radius: 16px; overflow: hidden;
      position: relative; display: flex; flex-direction: column;
  }
  .close-btn {
      position: absolute; top: 15px; right: 20px;
      font-size: 28px; font-weight: bold; color: #555;
      cursor: pointer; z-index: 10000;
  }
`;

// ==========================================
// 🧩 REUSABLE 3D BUTTON COMPONENT
// ==========================================
const Button3D = ({ children, onClick, variant = "blue", styleOverrides = {} }) => {
    const gradients = {
        blue: "#1A5FCC",
        black: "#1A5FCC",
        light: "linear-gradient(180deg, #F0F4FF 0%, #D9E2F5 100%)"
    };

    const textColor = variant === "light" ? "#555" : "#fff";
    const bg = gradients[variant];
    const shadow = variant === "light"
        ? "none"
        : "none";

    return (
        <button
            onClick={onClick}
            style={{
                padding: "10px 24px",
                borderRadius: "10px", border: "none", cursor: "pointer",
                color: textColor, fontSize: "14px", fontWeight: "500",
                fontFamily: "'Nunito', sans-serif", letterSpacing: "0.3px",
                background: bg,
                boxShadow: shadow,
                transition: "all 0.15s ease-out", outline: "none",
                flex: 1,
                whiteSpace: "nowrap",
                ...styleOverrides
            }}
            onMouseDown={e => {
                e.currentTarget.style.transform = "scale(0.98)";
                e.currentTarget.style.boxShadow = variant === "light" ? "none" : "none";
            }}
            onMouseUp={e => {
                e.currentTarget.style.transform = "scale(1) translateY(0)";
                e.currentTarget.style.boxShadow = shadow;
            }}
            onMouseLeave={e => {
                e.currentTarget.style.transform = "scale(1) translateY(0)";
                e.currentTarget.style.boxShadow = shadow;
            }}
        >
            {children}
        </button>
    );
};


// ==========================================
// 🚀 MAIN PAGE COMPONENT
// ==========================================
export default function Bookexpert() {
    const navigate = useNavigate();
    const [therapists, setTherapists] = useState([]);
    const [bookingOpen, setBookingOpen] = useState(false);
    const [toggles, setToggles] = useState({});

    useEffect(() => {
        const data = fetchTherapists();
        setTherapists(data);

        const initialToggles = {};
        data.forEach(doc => {
            initialToggles[doc.id] = 'online';
        });
        setToggles(initialToggles);
    }, []);

    // Standardized Cal.com namespace logic
    useEffect(() => {
        (async function () {
            const cal = await getCalApi({"namespace":"60min"});
            cal("ui", {"hideEventTypeDetails":false,"layout":"month_view"});
        })();
    }, []);

    const handleNavigate = (path) => {
        navigate(path);
    };

    const handleToggle = (docId, mode) => {
        setToggles(prev => ({ ...prev, [docId]: mode }));
    };

    const handleBook = () => {
        setBookingOpen(true);
    };

    // FIXED: Routing to Viewdetails with the selected doctor's ID
    const handleViewProfile = (doc) => {
        navigate('/viewdetails', { state: { doctorId: doc.id } });
    };

    return (
        <>
            <style>{STYLES}</style>
            <div className="horizon-container">

                <div className="header-wrapper">
                    <header className="header">
                        <div className="logo-area" onClick={() => handleNavigate('/home')}>
                            <img src={logoImg} alt="Horizon Logo" className="header-logo" />
                            Horizon
                        </div>
                        <nav className="nav-links">
                            <span className="nav-link" onClick={() => handleNavigate("/consultation")}>Meet the Consultant</span>
                            <span className="nav-link" onClick={() => handleNavigate("/therapy")}>Meet the Therapist</span>
                            <span className="nav-link" onClick={() => handleNavigate("/bookexpert")}>Book a Doctor</span>
                        </nav>
                        <Button3D variant="blue" styleOverrides={{ padding: "10px 24px", flex: "none" }} onClick={() => handleNavigate('/consultation')}>
                            Get Started
                        </Button3D>
                    </header>
                </div>

                <div className="max-width-wrapper">
                    <h1 className="page-title">
                        Our top experts and therapists <br />
                        for your <span>super mind.</span>
                    </h1>

                    <div className="therapist-grid">
                        {therapists.map((doc, index) => (
                            <div className="therapist-card" key={index}>

                                <div className="card-header">
                                    <img src={doctorImg} alt={doc.name} className="doc-avatar" />
                                    <div className="doc-info">
                                        <h3>{doc.name}</h3>
                                        <p>{doc.experience}</p>
                                        <p>{doc.fee}</p>
                                    </div>
                                </div>

                                <div className="card-tags">
                                    <span className="tag-label">Expertise:</span>
                                    {doc.expertise.map((exp, i) => (
                                        <span className="tag-pill" key={`exp-${i}`}>{exp}</span>
                                    ))}
                                </div>

                                <div className="card-tags">
                                    <span className="tag-label">Speaks:</span>
                                    {doc.languages.map((lang, i) => (
                                        <span className="tag-pill" key={`lang-${i}`}>{lang}</span>
                                    ))}
                                </div>

                                {/* FIXED: Interactive 3D Toggles */}
                                <div className="toggles-container">
                                    <Button3D
                                        variant={toggles[doc.id] === 'online' ? 'blue' : 'light'}
                                        onClick={() => handleToggle(doc.id, 'online')}
                                        styleOverrides={{ padding: "8px 0", fontSize: "12px" }}
                                    >
                                        Online
                                    </Button3D>
                                    <Button3D
                                        variant={toggles[doc.id] === 'in-person' ? 'blue' : 'light'}
                                        onClick={() => handleToggle(doc.id, 'in-person')}
                                        styleOverrides={{ padding: "8px 0", fontSize: "12px" }}
                                    >
                                        In-person
                                    </Button3D>
                                </div>

                                <div className="spacer"></div>

                                <div className="next-slot">
                                    Next online slot: <span>{doc.nextSlot}</span>
                                </div>

                                <div className="card-actions">
                                    <Button3D variant="light" onClick={() => handleViewProfile(doc)}>
                                        VIEW PROFILE
                                    </Button3D>
                                    <Button3D variant="blue" onClick={handleBook}>
                                        Book
                                    </Button3D>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <section className="banner-section">
                    <div className="banner-box">
                        <div className="banner-left">
                            <img src={handImg} alt="Hand holding pill" className="banner-hand" />
                            <h2 className="banner-text">Not sure whom to see? Talk to the consultant first</h2>
                        </div>
                        <Button3D variant="blue" styleOverrides={{flex: "none", padding: "14px 40px", fontSize: "16px"}} onClick={() => handleNavigate('/consultation')}>
                            Meet the Consultant
                        </Button3D>
                    </div>
                </section>

                <div className="footer-wrapper">
                    <footer className="footer">
                        <div className="footer-grid">
                            <div>
                                <div className="logo-area" style={{ marginBottom: "15px" }}>
                                    <img src={logoImg} alt="Horizon Logo" className="header-logo" />
                                    Horizon
                                </div>
                                <p className="footer-desc">
                                    Horizon provides a complete mental health therapy ecosystem in affordable service costs.
                                </p>
                            </div>

                            <div>
                                <h4 className="footer-col-title">Horizon</h4>
                                <span className="footer-link" onClick={() => handleNavigate('/consultation')}>Meet the Consultant</span>
                                <span className="footer-link" onClick={() => handleNavigate('/therapy')}>Meet the Therapist</span>
                                <span className="footer-link" onClick={() => handleNavigate('/bookexpert')}>Book a Doctor</span>
                            </div>
                        </div>

                        <div className="footer-bottom">
                            © 2026 Horizon. All rights are reserved
                        </div>
                    </footer>
                </div>

                {/* CAL.COM OVERLAY WITH REQUESTED GLOBAL LINK */}
                {bookingOpen && (
                    <div className="booking-overlay" onClick={() => setBookingOpen(false)}>
                        <div className="booking-modal" onClick={e => e.stopPropagation()}>
                            <div className="close-btn" onClick={() => setBookingOpen(false)}>×</div>
                            <div style={{ flexGrow: 1, marginTop: "40px" }}>
                                <Cal
                                    namespace="60min"
                                    calLink="horizon.meeting/60min"
                                    style={{width:"100%", height:"100%", overflow:"scroll"}}
                                    config={{"layout":"month_view","useSlotsViewOnSmallScreen":"true"}}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}