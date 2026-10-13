import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Ensure your actual logo image is saved in the assets folder!
import logoImg from '../assets/logo.png';

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');

  /* OVERRIDE DEFAULT VITE/REACT PADDING AND MARGINS */
  html, body, #root { 
    margin: 0 !important; 
    padding: 0 !important; 
    width: 100%; 
    max-width: 100% !important; 
    overflow-x: hidden; 
  }

  * { box-sizing: border-box; font-family: 'Nunito', sans-serif !important; }

  .splash-container {
    height: 100vh;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background-color: #FFFFFF;
  }

  /* Pulsing Glow Background */
  @keyframes pulseGlow {
    0% { box-shadow: 0 0 100px 20px rgba(0, 212, 255, 0.1); }
    50% { box-shadow: 0 0 100px 20px rgba(0, 212, 255, 0.35); }
    100% { box-shadow: 0 0 100px 20px rgba(0, 212, 255, 0.1); }
  }

  .glow-wrapper {
    animation: pulseGlow 2s ease-in-out infinite;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    margin-bottom: 30px;
    background: #FFFFFF; 
  }

  .splash-logo {
    width: 80px;
    height: 80px;
    object-fit: contain; 
  }

  /* Typography */
  .splash-title {
    font-size: 24px;
    font-weight: 500; /* Adjusted to standard bold weight for Nunito */
    color: #0F172A;
    letter-spacing: 1.2px;
    margin-bottom: 15px;
  }

  .splash-subtitle {
    font-size: 14px;
    font-weight: 500;
    color: #00BFFF;
    letter-spacing: 2.0px;
    margin-top: 15px;
  }

  /* Three Dot Loader */
  @keyframes dotBounce {
    0%, 100% { 
      transform: translateY(0); 
      opacity: 0.3; 
    }
    50% { 
      transform: translateY(-8px); 
      opacity: 1; 
    }
  }

  .dots-container {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .dot {
    width: 8px;
    height: 8px;
    background-color: #00BFFF;
    border-radius: 50%;
    margin: 0 4px;
    animation: dotBounce 1.2s infinite ease-in-out;
  }

  .dot:nth-child(1) { animation-delay: 0s; }
  .dot:nth-child(2) { animation-delay: 0.4s; }
  .dot:nth-child(3) { animation-delay: 0.8s; }
`;

export default function SplashPage() {
    const navigate = useNavigate();

    useEffect(() => {
        const timer = setTimeout(() => {
            navigate('/home', { replace: true });
        }, 4000);
        return () => clearTimeout(timer);
    }, [navigate]);

    return (
        <>
            <style>{STYLES}</style>
            <div className="splash-container">
                <div className="glow-wrapper">
                    <img src={logoImg} alt="Horizon Logo" className="splash-logo" />
                </div>
                <div className="splash-title">HORIZON</div>
                <div className="dots-container">
                    <div className="dot"></div>
                    <div className="dot"></div>
                    <div className="dot"></div>
                </div>
                <div className="splash-subtitle">MVP IS LIVE</div>
            </div>
        </>
    );
}