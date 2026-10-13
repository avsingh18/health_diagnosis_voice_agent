import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

import logoImg from "../assets/logo.png";
import { CORE_FEATURES } from "../lib/coreFeatures.js";


const STYLES = `
  .hz-header { position: sticky; top: 0; z-index: 50; background: rgba(255,255,255,0.92); backdrop-filter: blur(10px); border-bottom: 1px solid #EEF2FA; }
  .hz-header-inner { max-width: 1280px; margin: 0 auto; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .hz-logo { display: flex; align-items: center; gap: 10px; font-size: 22px; font-weight: 600; color: #000; cursor: pointer; letter-spacing: -0.5px; font-family: 'Nunito', sans-serif; }
  .hz-logo img { height: 28px; object-fit: contain; }
  .hz-nav { display: flex; gap: clamp(8px, 2vw, 28px); align-items: center; }
  .hz-nav-link { color: #5B6475; font-weight: 500; font-size: 15px; cursor: pointer; padding: 8px 12px; border-radius: 100px; transition: color .2s, background .2s; white-space: nowrap; font-family: 'Nunito', sans-serif; border: none; background: none; }
  .hz-nav-link:hover { color: #1A5FCC; background: #F0F5FF; }
  .hz-nav-link.active { color: #1A5FCC; background: #E8F0FE; }
  @media (max-width: 760px) {
    .hz-header-inner { flex-direction: column; gap: 10px; padding: 12px 16px; }
    .hz-nav { width: 100%; justify-content: space-between; gap: 4px; }
    .hz-nav-link { font-size: 13px; padding: 6px 8px; }
  }
`;

export default function SiteHeader() {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    return (
        <>
            <style>{STYLES}</style>
            <header className="hz-header">
                <div className="hz-header-inner">
                    <div className="hz-logo" onClick={() => navigate("/home")}>
                        <img src={logoImg} alt="Horizon" />
                        Horizon
                    </div>
                    <nav className="hz-nav">
                        {CORE_FEATURES.map((f) => (
                            <button
                                key={f.path}
                                className={`hz-nav-link ${pathname.startsWith(f.path) ? "active" : ""}`}
                                onClick={() => navigate(f.path)}
                            >
                                {f.label}
                            </button>
                        ))}
                    </nav>
                </div>
            </header>
        </>
    );
}
