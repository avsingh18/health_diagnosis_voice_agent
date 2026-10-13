import React from "react";
import { useNavigate } from "react-router-dom";

// ==========================================
// 🎨 GLOBAL STYLES & ANIMATIONS
// ==========================================
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');

  html, body, #root { 
    margin: 0 !important; 
    padding: 0 !important; 
    width: 100%; 
    max-width: 100% !important; 
    overflow-x: hidden; 
    background: #FFFFFF;
  }

  * { box-sizing: border-box; font-family: 'Nunito', sans-serif !important; }

  .horizon-container { width: 100vw; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: linear-gradient(180deg, #E8F0FE 0%, #FFFFFF 100%); }
  .max-width-wrapper { max-width: 800px; margin: 0 auto; width: 100%; padding: 60px 24px; display: flex; flex-direction: column; align-items: center; text-align: center; }

  .page-title { font-size: clamp(36px, 5vw, 54px); font-weight: 700; color: #333; letter-spacing: -1px; margin-bottom: 20px; line-height: 1.2; }
  .page-title span { color: #2962FF; }
  
  .content-card { background: #FFFFFF; border-radius: 24px; padding: 40px; box-shadow: 0 20px 50px rgba(0,0,0,0.05); text-align: left; margin-bottom: 40px; width: 100%; }
  
  .content-h3 { font-size: 22px; font-weight: 600; color: #444; margin-top: 30px; margin-bottom: 15px; }
  .content-h3:first-child { margin-top: 0; }
  
  .content-p { font-size: 16px; color: #666; line-height: 1.7; margin-bottom: 20px; }
  
  .highlight-box { background: #F0F4FF; border-left: 4px solid #2962FF; padding: 20px; border-radius: 0 12px 12px 0; margin: 30px 0; }
  .highlight-box p { margin: 0; color: #333; font-weight: 500; font-size: 16px; }
`;

// ==========================================
// 🧩 REUSABLE 3D BUTTON COMPONENT
// ==========================================
const Button3D = ({ children, onClick, variant = "blue", styleOverrides = {} }) => {
    const gradients = {
        blue: "linear-gradient(180deg, #4B8DFF 0%, #1A5FCC 100%)",
        light: "linear-gradient(180deg, #F0F4FF 0%, #D9E2F5 100%)"
    };

    const textColor = variant === "light" ? "#333" : "#fff";

    return (
        <button
            onClick={onClick}
            style={{
                padding: "16px 40px", borderRadius: "100px", border: "none", cursor: "pointer",
                color: textColor, fontSize: "16px", fontWeight: "600", fontFamily: "'Nunito', sans-serif", letterSpacing: "0.5px",
                background: gradients[variant],
                boxShadow: variant === "light"
                    ? "inset 0 4px 8px rgba(255,255,255,0.8), inset 0 -6px 12px rgba(0,0,0,0.05), 0 6px 15px rgba(0,0,0,0.05)"
                    : "inset 0 4px 8px rgba(255,255,255,0.3), inset 0 -6px 12px rgba(0,0,0,0.2), 0 6px 15px rgba(0,0,0,0.15)",
                transition: "all 0.1s ease-out", outline: "none", ...styleOverrides
            }}
            onMouseDown={e => { e.currentTarget.style.transform = "scale(0.97) translateY(2px)"; }}
            onMouseUp={e => { e.currentTarget.style.transform = "scale(1) translateY(0)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "scale(1) translateY(0)"; }}
        >
            {children}
        </button>
    );
};

export default function About() {
    const navigate = useNavigate();

    return (
        <>
            <style>{STYLES}</style>
            <div className="horizon-container">
                <div className="max-width-wrapper">

                    <h1 className="page-title">About <span>Horizon</span></h1>

                    <div className="content-card">
                        <h3 className="content-h3">Our Mission</h3>
                        <p className="content-p">
                            At Horizon, we believe that mental healthcare should be accessible, intelligent, and deeply empathetic. Our mission is to bridge the gap between technology and human connection, providing a safe space where individuals can understand their emotional state and find the right path to recovery.
                        </p>

                        <div className="highlight-box">
                            <p>"We are building a future where your smartphone is the first line of defense in mental health triage, not just a distraction."</p>
                        </div>

                        <h3 className="content-h3">How We Do It</h3>
                        <p className="content-p">
                            Using state-of-the-art Temporal Multimodal Fusion (ATMF), Horizon analyzes micro-expressions, vocal tone, and behavioral patterns during a short, secure video session. This data is processed completely on your device to ensure maximum privacy.
                        </p>
                        <p className="content-p">
                            We don't just provide data; we provide direction. Whether it's through our interactive CBT games, guided breathing exercises, or direct connections to certified local therapists, Horizon is an entire ecosystem designed for your super mind.
                        </p>

                        <h3 className="content-h3">Privacy First</h3>
                        <p className="content-p">
                            Your mental health data is your own. We do not store video feeds or voice recordings on our servers. All facial mesh processing and temporal analysis occur securely in your browser session, and the final report is yours to download and share with your actual therapist if you choose.
                        </p>
                    </div>

                    <Button3D variant="blue" onClick={() => navigate('/home')}>Return to Home</Button3D>

                </div>
            </div>
        </>
    );
}