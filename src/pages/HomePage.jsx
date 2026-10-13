import React from "react";
import { useNavigate } from "react-router-dom";

import SiteHeader from "../components/SiteHeader.jsx";
import { CORE_FEATURES } from "../lib/coreFeatures.js";
import groupImg from "../assets/group.png";

// Home → one of three things: the consultant, the therapist, or a doctor.
// The earlier marketing sections (hospital ticker, banner, footer link farm)
// pointed at pages that are now switched off in App.jsx.

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');

  html, body, #root { margin: 0 !important; padding: 0 !important; width: 100%; max-width: 100% !important; overflow-x: hidden; background: #FFFFFF; }
  * { box-sizing: border-box; font-family: 'Nunito', sans-serif; }

  .home { min-height: 100vh; display: flex; flex-direction: column; background: linear-gradient(180deg, #E8F0FE 0%, #FFFFFF 55%); }
  .home-main { text-align: left; flex: 1; max-width: 1180px; width: 100%; margin: 0 auto; padding: clamp(28px, 6vw, 64px) 24px 48px; }

  .home-hero { display: flex; align-items: center; justify-content: space-between; gap: 32px; margin-bottom: clamp(28px, 5vw, 48px); }
  .home-hero h1 { font-size: clamp(32px, 4.6vw, 54px); font-weight: 700; line-height: 1.08; color: #1F2937; letter-spacing: -1px; margin: 0 0 14px; }
  .home-hero h1 span { color: #2962FF; }
  .home-hero p { font-size: clamp(15px, 1.6vw, 17px); color: #5B6475; line-height: 1.6; max-width: 560px; margin: 0; }
  .home-hero img { width: min(380px, 34vw); object-fit: contain; }
  @media (max-width: 860px) { .home-hero img { display: none; } }

  .home-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
  @media (max-width: 960px) { .home-cards { grid-template-columns: 1fr; } }

  .home-card { position: relative; background: #fff; border: 1.5px solid #E3EAF8; border-radius: 24px; padding: 28px 26px 26px; display: flex; flex-direction: column; gap: 14px; cursor: pointer; transition: transform .2s, box-shadow .2s, border-color .2s; text-align: left; }
  .home-card:hover { transform: translateY(-4px); box-shadow: 0 18px 44px rgba(41,98,255,0.12); border-color: #9DBBFF; }
  .home-card.primary { background: linear-gradient(160deg, #0B1B36 0%, #12325C 100%); border-color: #12325C; color: #fff; }
  .home-card.primary:hover { border-color: #19B4CF; box-shadow: 0 18px 44px rgba(25,180,207,0.28); }
  .home-card-step { font-size: 12px; font-weight: 600; letter-spacing: 1.4px; text-transform: uppercase; color: #8A94A6; }
  .home-card.primary .home-card-step { color: #7FD8E8; }
  .home-card h2 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.4px; color: #1F2937; }
  .home-card.primary h2 { color: #fff; }
  .home-card p { margin: 0; font-size: 15px; line-height: 1.6; color: #5B6475; flex: 1; }
  .home-card.primary p { color: #C9D6EA; }
  .home-card-tag { position: absolute; top: 22px; right: 22px; background: #E0157A; color: #fff; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 100px; letter-spacing: .6px; }
  .home-card-cta { align-self: flex-start; margin-top: 6px; padding: 11px 22px; border-radius: 10px; border: none; font-size: 15px; font-weight: 500; cursor: pointer; color: #fff; background: #1A5FCC; transition: background .15s; }
  .home-card-cta:hover { background: #154FAD; }

  .home-orb { width: 54px; height: 54px; border-radius: 50%; background: radial-gradient(circle at 36% 30%, #57B9DA 0%, #1C5D86 46%, #0A1C33 100%); box-shadow: 0 0 26px rgba(25,180,207,0.6); position: relative; }
  .home-orb::before, .home-orb::after { content: ""; position: absolute; top: 19px; width: 6px; height: 6px; border-radius: 50%; background: #E6FBFF; box-shadow: 0 0 6px #E6FBFF; }
  .home-orb::before { left: 17px; } .home-orb::after { right: 17px; }

  .home-foot { text-align: center; color: #9AA3B2; font-size: 13px; padding: 24px; }
`;

export default function HomePage() {
    const navigate = useNavigate();
    return (
        <>
            <style>{STYLES}</style>
            <div className="home">
                <SiteHeader />
                <main className="home-main">
                    <section className="home-hero">
                        <div>
                            <h1>Care that starts with <span>a conversation.</span></h1>
                            <p>
                                Talk to Horizon in your own language. Start with the consultant, talk things
                                through with the therapist, or go straight to a doctor.
                            </p>
                        </div>
                        <img src={groupImg} alt="" />
                    </section>

                    <section className="home-cards">
                        {CORE_FEATURES.map((f, i) => (
                            <div
                                key={f.path}
                                className={`home-card ${i === 0 ? "primary" : ""} ${i === 2 ? "last" : ""}`}
                                onClick={() => navigate(f.path)}
                            >
                                {f.tag && <span className="home-card-tag">{f.tag}</span>}
                                {i === 0 && <div className="home-orb" />}
                                <span className="home-card-step">
                                    {i === 2 ? "When nothing else works" : `Option ${i + 1}`}
                                </span>
                                <h2>{f.label}</h2>
                                <p>{f.blurb}</p>
                                <button className="home-card-cta" onClick={(e) => { e.stopPropagation(); navigate(f.path); }}>
                                    {f.cta} →
                                </button>
                            </div>
                        ))}
                    </section>
                </main>
                <footer className="home-foot">© 2026 Horizon · AI assistance for clinicians, not a substitute for one.</footer>
            </div>
        </>
    );
}
