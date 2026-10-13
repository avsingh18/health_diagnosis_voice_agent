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

  .horizon-container { width: 100vw; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: linear-gradient(180deg, #FFF3E0 0%, #FFFFFF 100%); }
  .max-width-wrapper { max-width: 800px; margin: 0 auto; width: 100%; padding: 60px 24px; display: flex; flex-direction: column; align-items: center; text-align: center; }

  .page-title { font-size: clamp(36px, 5vw, 54px); font-weight: 700; color: #333; letter-spacing: -1px; margin-bottom: 20px; line-height: 1.2; }
  .page-title span { color: #E64A19; } /* Orange warning theme */
  
  .content-card { background: #FFFFFF; border-radius: 24px; padding: 40px; box-shadow: 0 20px 50px rgba(0,0,0,0.05); text-align: left; margin-bottom: 40px; width: 100%; border-top: 6px solid #FF8A65; }
  
  .content-h3 { font-size: 20px; font-weight: 600; color: #444; margin-top: 30px; margin-bottom: 10px; }
  .content-h3:first-child { margin-top: 0; }
  
  .content-p { font-size: 15px; color: #666; line-height: 1.7; margin-bottom: 20px; }

  .emergency-box { background: #FFEBEE; border: 2px solid #FFCDD2; padding: 25px; border-radius: 16px; margin: 30px 0; text-align: center; }
  .emergency-box h4 { color: #C62828; margin: 0 0 10px 0; font-size: 18px; font-weight: 700; }
  .emergency-box p { color: #D32F2F; margin: 0; font-weight: 500; font-size: 15px; }
`;

// ==========================================
// 🧩 REUSABLE 3D BUTTON COMPONENT
// ==========================================
const Button3D = ({ children, onClick, variant = "blue", styleOverrides = {} }) => {
    const gradients = {
        blue: "linear-gradient(180deg, #4B8DFF 0%, #1A5FCC 100%)",
        light: "linear-gradient(180deg, #F0F4FF 0%, #D9E2F5 100%)",
        orange: "linear-gradient(180deg, #FF8A65 0%, #E64A19 100%)"
    };

    const textColor = variant === "light" ? "#333" : "#fff";

    return (
        <button
            onClick={onClick}
            style={{
                padding: "16px 40px", borderRadius: "100px", border: "none", cursor: "pointer",
                color: textColor, fontSize: "16px", fontWeight: "600", fontFamily: "'Nunito', sans-serif", letterSpacing: "0.5px",
                background: gradients[variant] || gradients.blue,
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

export default function Disclaimer() {
    const navigate = useNavigate();

    return (
        <>
            <style>{STYLES}</style>
            <div className="horizon-container">
                <div className="max-width-wrapper">

                    <h1 className="page-title">Medical <span>Disclaimer</span></h1>

                    <div className="content-card">

                        <div className="emergency-box">
                            <h4>Not for Emergencies</h4>
                            <p>If you are experiencing a medical emergency, considering self-harm, or feel you are a danger to yourself or others, please call your local emergency services (e.g., 911 in the US) or a crisis hotline immediately. Do not use this application for emergency medical needs.</p>
                        </div>

                        <h3 className="content-h3">1. Not a Substitute for Professional Medical Advice</h3>
                        <p className="content-p">
                            The Horizon application, including its AI-driven assessments, visual/audio analysis tools, games, and generated reports, is designed strictly for informational, educational, and self-tracking purposes. The content provided is not intended to be a substitute for professional medical advice, diagnosis, or treatment.
                        </p>

                        <h3 className="content-h3">2. AI Technology Limitations</h3>
                        <p className="content-p">
                            Horizon utilizes artificial intelligence and machine learning algorithms (such as facial mesh analysis and sentiment tracking) to generate insights. While advanced, these systems are not foolproof and cannot replace the nuanced clinical judgment of a licensed human healthcare provider. The assessments generated by Horizon are not clinical diagnoses.
                        </p>

                        <h3 className="content-h3">3. No Doctor-Patient Relationship</h3>
                        <p className="content-p">
                            Using the Horizon app, interacting with the AI Agent, or completing self-assessments does not create a doctor-patient relationship between you and Horizon, its developers, or its affiliates. Always consult with a qualified health provider with any questions you may have regarding a medical or mental health condition.
                        </p>

                        <h3 className="content-h3">4. Assumption of Risk</h3>
                        <p className="content-p">
                            Reliance on any information provided by Horizon or its employees, contracted experts, or other users of the application is solely at your own risk. Horizon assumes no liability for any actions taken based on the information or tools provided within the platform.
                        </p>
                    </div>

                    <div style={{display: 'flex', gap: '20px'}}>
                        <Button3D variant="light" onClick={() => navigate(-1)}>Go Back</Button3D>
                        <Button3D variant="orange" onClick={() => navigate('/home')}>I Understand</Button3D>
                    </div>

                </div>
            </div>
        </>
    );
}