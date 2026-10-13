import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

// Ensure these images exist in your src/assets folder
import logoImg from "../assets/logo.png";
import image from "../assets/image.jpg";

// ==========================================
// 🧠 RESEARCH-BACKED THERAPY DATA & CONTENT
// ==========================================
const THERAPY_STEPS = [
    { id: 1, title: "Initial sessions are about you", text: "Your therapist will explore your thoughts, feelings, experiences, and what brought you here. They'll ask about your background, personality, and goals." },
    { id: 2, title: "Defining your goals", text: "Together, you and your therapist identify how to reduce anxiety or depression, manage moods, improve relationships, heal from trauma, or gain clarity." },
    { id: 3, title: "Exploring therapy techniques", text: "Depending on your needs, your therapist may use CBT, trauma-informed care, mindfulness, narrative therapy, or other approaches, always adapting to your pace and comfort." },
    { id: 4, title: "Growth and recovery", text: "Over time, you may notice calmer reactions, healthier boundaries, lighter emotions, and greater confidence. Therapy becomes a space for growth, not just coping." },
    { id: 5, title: "Moving forward", text: "Your therapist supports you in transitioning to maintenance, fewer sessions or check-ins, so you leave with lasting tools and deeper self-trust." }
];

const GAMES_THERAPY_STEPS = [
    { id: 1, title: "Challenge Patterns", text: "Learn tools to challenge negative thoughts and break unhelpful patterns." },
    { id: 2, title: "Understand Feelings", text: "Therapy helps understand your feelings and thoughts better, helping you make better daily choices." },
    { id: 3, title: "Build Coping Skills", text: "Build coping skills to handle stress, depression, anxiety, or difficult situations effectively." },
    { id: 4, title: "Set Boundaries", text: "Set boundaries without guilt, protecting your time, energy, and peace of mind." },
    { id: 5, title: "Take Action", text: "Shift from constant overthinking to taking meaningful steps aligned with your goals and values." },
    { id: 6, title: "Process Trauma", text: "Safely process unresolved trauma, childhood experiences, or relationship pain, paving the way for recovery." }
];

const CONTENT_LIBRARY = [
    {
        id: 1, category: "DEPRESSION", type: "Article", title: "The Difference Between Sadness and Depression", time: "5 mins", cta: "READ", color: "#E8F5E9", imgBg: "#263238", image : image,
        content: "Sadness is a normal human emotion triggered by difficult, hurtful, or disappointing events. In most cases, sadness fades over time. Depression, however, is an abnormal emotional state that affects our thinking, emotions, perceptions, and behaviors. When you are sad, you might cry and spend some time alone, but you can usually still enjoy simple things like your favorite food or a good movie. With depression, feelings of emptiness and despair take over, making it difficult to enjoy anything at all. Understanding this difference is the first step toward seeking the right help."
    },
    {
        id: 2, category: "DEPRESSION", type: "Game", title: "CBT Thought Restructuring Simulator", time: "3 mins", cta: "PLAY", color: "#F3E5F5", imgBg: "#7E57C2", image : image,
        content: "GAME_CBT_SIMULATOR"
    },
    {
        id: 3, category: "ANXIETY", type: "Game", title: "Box Breathing Visualizer", time: "2 mins", cta: "PLAY", color: "#E3F2FD", imgBg: "#0288D1", image : image,
        content: "GAME_BOX_BREATHING"
    },
    {
        id: 4, category: "ANXIETY", type: "Article", title: "How to Stop an Anxiety Spiral", time: "4 mins", cta: "READ", color: "#FFF3E0", imgBg: "#F57C00", image : image,
        content: "An anxiety spiral happens when one negative thought triggers another, leading to a cascade of catastrophic thinking. To stop it, you must interrupt the physical stress response first. Splash cold water on your face, squeeze an ice cube, or take three deep, slow breaths. Once your heart rate slows, challenge the initial thought: 'Is this a fact, or is it a fear?' By separating physical panic from logical thinking, you can regain control of the spiral."
    },
    {
        id: 5, category: "STRESS", type: "Game", title: "The 5-4-3-2-1 Grounding Technique", time: "6 mins", cta: "PLAY", color: "#FBE9E7", imgBg: "#E64A19", image : image,
        content: "GAME_GROUNDING"
    },
    {
        id: 6, category: "STRESS", type: "Article", title: "Setting Healthy Workplace Boundaries", time: "5 mins", cta: "READ", color: "#EFEBE9", imgBg: "#5D4037", image : image,
        content: "Workplace stress often stems from poor boundaries. A boundary is simply communicating what you are and are not available for. Start small: decide on a hard stop time for checking emails (e.g., 6:00 PM). If asked to take on extra work when you are at capacity, use the phrase: 'I can take this on, but it means [Project A] will be delayed until next week. How would you like me to prioritize?' This protects your time without sounding uncooperative."
    },
    {
        id: 7, category: "SLEEP", type: "Article", title: "Creating a Neuro-Friendly Wind-Down Routine", time: "7 mins", cta: "READ", color: "#E8EAF6", imgBg: "#283593", image : image,
        content: "Your brain relies on environmental cues to release melatonin (the sleep hormone). If you look at bright screens right up until bed, your brain thinks it's still daytime. A neuro-friendly routine involves 'dimming the lights'—literally and metaphorically—one hour before bed. Turn off overhead lights, switch to lamps, put away screens, and do something low-dopamine like reading a physical book or stretching. Consistency trains your brain to anticipate sleep."
    }
];

// ==========================================
// 🎨 GLOBAL STYLES & ANIMATIONS
// ==========================================
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');

  html, body, #root { 
    margin: 0 !important; 
    padding: 0 !important; 
    width: 100vw; 
    max-width: 100vw !important; 
    overflow-x: hidden; 
    background: #E2EDFB; 
  }

  * { box-sizing: border-box; font-family: 'Nunito', sans-serif !important; }

  /* Layout Containers */
  .horizon-container { width: 100vw; min-height: 100vh; display: flex; flex-direction: column; align-items: center;}
  .max-width-wrapper { max-width: 1400px; margin: 0 auto; width: 100%; padding: 0 24px; }
  .header-wrapper { width: 100vw; background: #FFFFFF; display: flex; justify-content: center;}

  /* Header */
  .header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; width: 100%; max-width: 1400px;}
  .logo-area { display: flex; align-items: center; gap: 10px; font-size: 24px; font-weight: 600; color: #000; cursor: pointer; letter-spacing: -0.5px; }
  .header-logo { height: 28px; object-fit: contain; }
  .nav-links { display: flex; gap: clamp(16px, 3vw, 40px); }
  .nav-link { color: #666; font-weight: 500; font-size: 16px; cursor: pointer; transition: color 0.2s; }
  .nav-link:hover { color: #1A5FCC; }

  .section-title {
      text-align: center;
      font-size: clamp(24px, 3vw, 36px);
      font-weight: 600;
      color: #555;
      margin: 60px 0 30px 0;
      line-height: 1.3;
  }
  .section-title span { color: #2962FF; }

  /* ------------------------------------- */
  /* HORIZONTAL CAROUSEL GRID              */
  /* ------------------------------------- */
  .carousel-grid {
      display: flex;
      flex-wrap: nowrap; /* Forces one horizontal line */
      overflow-x: auto;  /* Allows scrolling if screen is small */
      gap: 40px;
      width: 100%;
      justify-content: center;
      padding-bottom: 20px;
      -ms-overflow-style: none; scrollbar-width: none;
  }
  .carousel-grid::-webkit-scrollbar { display: none; }
  
  @media (max-width: 900px) {
      .carousel-grid { justify-content: flex-start; } /* Better scroll behavior on mobile */
  }

  .therapy-card {
      min-width: 400px;
      width: 450px;
      flex-shrink: 0; /* Prevents shrinking in the horizontal flex line */
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0,0,0,0.08);
      display: flex;
      flex-direction: column;
      background: #FAFAFA;
  }

  .therapy-card-top {
      padding: 40px 30px;
      background: radial-gradient(circle at top left, #FFFFFF, #F5F0EB);
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      gap: 20px;
      min-height: 320px;
  }

  .card-top-row { display: flex; justify-content: space-between; align-items: center; }

  /* Removed icon image, keeping the bubble structural space as requested */
  .icon-bubble {
      width: 50px; height: 50px; background: #FFF; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 10px rgba(0,0,0,0.05);
  }

  .step-counter {
      border: 1.5px solid #D87D56; color: #D87D56; font-weight: 600;
      font-size: 14px; padding: 4px 12px; border-radius: 8px;
  }

  .therapy-card-title { font-size: 22px; font-weight: 600; color: #444; line-height: 1.2; }
  .therapy-card-text { font-size: 18px; font-weight: 500; color: #555; line-height: 1.6; }

  .therapy-card-bottom {
      background: #82B1FF;
      padding: 24px 30px;
      display: flex;
      justify-content: space-between;
      gap: 15px;
  }

  /* ------------------------------------- */
  /* CONTENT LIBRARY STYLES                */
  /* ------------------------------------- */
  .library-container {
      background: #FFFFFF;
      border-radius: 24px;
      padding: 40px;
      width: 100%;
      max-width: 1200px;
      margin: 0 auto 80px auto;
      box-shadow: 0 12px 40px rgba(0,0,0,0.05);
  }

  .library-title { font-size: 20px; font-weight: 500; color: #666; margin-bottom: 24px; text-align: center; }

  .library-tabs {
      display: flex; justify-content: center; gap: 15px; overflow-x: auto;
      padding-bottom: 10px; margin-bottom: 30px; -ms-overflow-style: none; scrollbar-width: none;  
  }
  .library-tabs::-webkit-scrollbar { display: none; }

  /* Horizontal One-Line Content Grid */
  .library-grid {
      background: #82B1FF;
      border-radius: 16px;
      padding: 30px;
      display: flex;
      flex-wrap: nowrap;
      overflow-x: auto;
      gap: 20px;
      -ms-overflow-style: none; scrollbar-width: none;
  }
  .library-grid::-webkit-scrollbar { display: none; }

  .content-card {
      min-width: 300px; /* Forces cards into horizontal line */
      flex-shrink: 0;
      border-radius: 16px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 6px 15px rgba(0,0,0,0.08);
  }

  /* Empty placeholder area for your manual images later */
  .content-img-placeholder { width: 100%; height: 140px; overflow: hidden; }
  .content-img-placeholder img {
      width: 100%;
      height: 100%;
      object-fit: cover; /* Ensures the image fills the space without distortion */
  }

  .content-details { padding: 20px; display: flex; flex-direction: column; gap: 15px; flex-grow: 1; }
  .content-title { font-size: 16px; font-weight: 600; color: #333; line-height: 1.4; }
  .content-bottom { display: flex; justify-content: space-between; align-items: center; margin-top: auto; }
  .content-meta { font-size: 12px; font-weight: 500; color: #666; }

  /* ------------------------------------- */
  /* MODAL & GAMES STYLES                  */
  /* ------------------------------------- */
  .modal-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.7); z-index: 9999;
      display: flex; justify-content: center; align-items: center; padding: 20px;
  }

  .modal-box {
      background: #FFF; width: 100%; max-width: 700px; border-radius: 24px;
      padding: 40px; box-shadow: 0 20px 50px rgba(0,0,0,0.2);
      max-height: 90vh; overflow-y: auto; position: relative;
  }

  .modal-header { font-size: 28px; font-weight: 600; color: #333; margin-bottom: 20px; }
  .modal-body { font-size: 16px; font-weight: 500; color: #555; line-height: 1.8; }
  
  /* Game: Box Breathing Animation */
  @keyframes breathe {
      0%   { transform: scale(1); opacity: 0.8; }
      25%  { transform: scale(1.8); opacity: 1; } /* Inhale */
      50%  { transform: scale(1.8); opacity: 1; } /* Hold */
      75%  { transform: scale(1); opacity: 0.8; } /* Exhale */
      100% { transform: scale(1); opacity: 0.8; } /* Hold */
  }

  .game-container {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; padding: 60px 0; gap: 40px;
  }

  .breathing-circle {
      width: 120px; height: 120px; background: linear-gradient(135deg, #82B1FF, #1A5FCC);
      border-radius: 50%; animation: breathe 16s infinite cubic-bezier(0.4, 0, 0.2, 1);
      display: flex; align-items: center; justify-content: center;
      color: transparent; /* Text driven by React state */
  }

  .game-instructions { font-size: 18px; font-weight: 500; color: #444; text-align: center; }

  /* Footer */
  .footer-wrapper { width: 100vw; background: #FAFAFA; border-top: 1px solid #E0E0E0; margin-top: auto; display: flex; justify-content: center;}
  .footer { padding: 60px 24px 30px 24px; width: 100%; max-width: 1400px;}
  .footer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 40px; width: 100%; text-align: left; }
  .footer-desc { color: #888; font-size: 14px; margin-top: 16px; line-height: 1.6; max-width: 250px; }
  .footer-col-title { font-size: 16px; font-weight: 600; color: #333; margin-bottom: 20px; }
  .footer-link { display: block; color: #888; font-size: 14px; margin-bottom: 12px; cursor: pointer; transition: color 0.2s; text-decoration: none; }
  .footer-link:hover { color: #1A5FCC; }
  .footer-bottom { text-align: center; color: #AAA; font-size: 14px; padding-top: 40px; margin-top: 40px; border-top: 1px solid #EEE; }

  @media (max-width: 768px) { .footer-grid { grid-template-columns: 1fr; } }
`;

// ==========================================
// 🧩 REUSABLE 3D BUTTON COMPONENT
// ==========================================
const Button3D = ({ children, onClick, variant = "blue", styleOverrides = {} }) => {
    const gradients = {
        blue: "linear-gradient(180deg, #4B8DFF 0%, #1A5FCC 100%)",
        black: "linear-gradient(180deg, #424242 0%, #212121 100%)",
        light: "linear-gradient(180deg, #F0F4FF 0%, #D9E2F5 100%)"
    };

    const textColor = variant === "light" ? "#333" : "#fff";

    return (
        <button
            onClick={onClick}
            style={{
                padding: "clamp(13px,2vw,16px) clamp(32px,5vw,52px)",
                borderRadius: "100px", border: "none", cursor: "pointer",
                color: textColor, fontSize: "clamp(14px,1.5vw,16px)", fontWeight: "500",
                fontFamily: "'Nunito', sans-serif", letterSpacing: "0.3px",
                background: gradients[variant],
                boxShadow: variant === "light"
                    ? "inset 0 4px 8px rgba(255,255,255,0.8), inset 0 -6px 12px rgba(0,0,0,0.05), 0 4px 10px rgba(0,0,0,0.05)"
                    : "inset 0 4px 8px rgba(255,255,255,0.3), inset 0 -6px 12px rgba(0,0,0,0.2), 0 4px 10px rgba(0,0,0,0.1)",
                transition: "all 0.15s ease-out", outline: "none",
                ...styleOverrides
            }}
            onMouseDown={e => {
                e.currentTarget.style.transform = "scale(0.96) translateY(2px)";
                e.currentTarget.style.boxShadow = variant === "light"
                    ? "inset 0 2px 4px rgba(0,0,0,0.05)"
                    : "inset 0 2px 4px rgba(0,0,0,0.3)";
            }}
            onMouseUp={e => {
                e.currentTarget.style.transform = "scale(1) translateY(0)";
                e.currentTarget.style.boxShadow = variant === "light"
                    ? "inset 0 4px 8px rgba(255,255,255,0.8), inset 0 -6px 12px rgba(0,0,0,0.05), 0 4px 10px rgba(0,0,0,0.05)"
                    : "inset 0 4px 8px rgba(255,255,255,0.3), inset 0 -6px 12px rgba(0,0,0,0.2), 0 4px 10px rgba(0,0,0,0.1)";
            }}
            onMouseLeave={e => {
                e.currentTarget.style.transform = "scale(1) translateY(0)";
                e.currentTarget.style.boxShadow = variant === "light"
                    ? "inset 0 4px 8px rgba(255,255,255,0.8), inset 0 -6px 12px rgba(0,0,0,0.05), 0 4px 10px rgba(0,0,0,0.05)"
                    : "inset 0 4px 8px rgba(255,255,255,0.3), inset 0 -6px 12px rgba(0,0,0,0.2), 0 4px 10px rgba(0,0,0,0.1)";
            }}
        >
            {children}
        </button>
    );
};

// ==========================================
// 🚀 MAIN PAGE COMPONENT
// ==========================================
export default function Events() {
    const navigate = useNavigate();

    // States
    const [therapyStep, setTherapyStep] = useState(0);
    const [gamesStep, setGamesStep] = useState(0);
    const [activeTab, setActiveTab] = useState("DEPRESSION");
    const [selectedModalContent, setSelectedModalContent] = useState(null); // Handles Popups

    const handleNavigate = (path) => navigate(path);

    // Carousel Controls
    const handleNextTherapy = () => { if (therapyStep < THERAPY_STEPS.length - 1) setTherapyStep(p => p + 1); };
    const handlePrevTherapy = () => { if (therapyStep > 0) setTherapyStep(p => p - 1); };

    const handleNextGames = () => { if (gamesStep < GAMES_THERAPY_STEPS.length - 1) setGamesStep(p => p + 1); };
    const handlePrevGames = () => { if (gamesStep > 0) setGamesStep(p => p - 1); };

    const filteredContent = CONTENT_LIBRARY.filter(item => item.category === activeTab);

    // Dynamic Game Content Render
    const renderGameContent = (gameId) => {
        if (gameId === "GAME_BOX_BREATHING") {
            return (
                <div className="game-container">
                    <p className="game-instructions">Follow the expanding circle. Inhale for 4 seconds, hold for 4, exhale for 4, hold for 4.</p>
                    <div className="breathing-circle"></div>
                </div>
            );
        }
        if (gameId === "GAME_CBT_SIMULATOR") {
            return (
                <div className="game-container">
                    <p className="game-instructions">Write down a negative thought you had today.</p>
                    <input type="text" placeholder="e.g., I failed this task, I am useless..." style={{width: "100%", padding: "15px", borderRadius: "10px", border: "1px solid #CCC", fontSize: "16px"}} />
                    <p className="game-instructions" style={{marginTop: "20px"}}>Now, rewrite it based strictly on facts, removing the emotional bias.</p>
                    <textarea placeholder="e.g., I struggled with this specific task, but I can learn from the mistake..." style={{width: "100%", padding: "15px", borderRadius: "10px", border: "1px solid #CCC", fontSize: "16px", minHeight: "100px"}}></textarea>
                </div>
            );
        }
        return <p className="game-instructions">Follow the physical grounding steps in your environment right now: Identify 5 things you see, 4 things you can touch, 3 things you hear, 2 things you smell, and 1 thing you taste.</p>;
    };

    return (
        <>
            <style>{STYLES}</style>
            <div className="horizon-container">

                {/* HEADER */}
                <div className="header-wrapper">
                    <header className="header">
                        <div className="logo-area" onClick={() => handleNavigate('/')}>
                            <img src={logoImg} alt="Horizon Logo" className="header-logo" /> Horizon
                        </div>
                        <nav className="nav-links">
                            <span className="nav-link" onClick={() => handleNavigate('/home')}>Home</span>
                            <span className="nav-link" onClick={() => handleNavigate('/events')}>Events</span>
                            <span className="nav-link" onClick={() => handleNavigate('/therapy')}>Therapy</span>
                            <span className="nav-link" onClick={() => handleNavigate('/products')}>Products</span>
                            <span className="nav-link" onClick={() => handleNavigate('/about')}>About</span>
                        </nav>
                        <Button3D variant="blue" styleOverrides={{ padding: "10px 24px", flex: "none" }} onClick={() => handleNavigate('/therapy')}>
                            Get Started
                        </Button3D>
                    </header>
                </div>

                <div className="max-width-wrapper">

                    <h2 className="section-title">Know about how <span>therapy works?</span></h2>

                    {/* DUAL CAROUSEL ROW (One Line Horizontal) */}
                    <div className="carousel-grid">

                        {/* CAROUSEL 1 */}
                        <div className="therapy-card">
                            <div className="therapy-card-top">
                                <div className="card-top-row">
                                    <div className="icon-bubble"></div> {/* Empty space for manual image */}
                                    <div className="step-counter">{THERAPY_STEPS[therapyStep].id}/{THERAPY_STEPS.length}</div>
                                </div>
                                {THERAPY_STEPS[therapyStep].title && <h3 className="therapy-card-title">{THERAPY_STEPS[therapyStep].title}</h3>}
                                <p className="therapy-card-text">{THERAPY_STEPS[therapyStep].text}</p>
                            </div>
                            <div className="therapy-card-bottom">
                                <Button3D
                                    variant="light"
                                    onClick={handlePrevTherapy}
                                    styleOverrides={{ opacity: therapyStep === 0 ? 0.5 : 1, pointerEvents: therapyStep === 0 ? 'none' : 'auto' }}
                                >
                                    Previous
                                </Button3D>
                                <Button3D
                                    variant="blue"
                                    onClick={handleNextTherapy}
                                    styleOverrides={{ opacity: therapyStep === THERAPY_STEPS.length - 1 ? 0.5 : 1, pointerEvents: therapyStep === THERAPY_STEPS.length - 1 ? 'none' : 'auto' }}
                                >
                                    Next
                                </Button3D>
                            </div>
                        </div>

                        {/* CAROUSEL 2 */}
                        <div className="therapy-card">
                            <div className="therapy-card-top">
                                <div className="card-top-row">
                                    <div className="icon-bubble"></div> {/* Empty space for manual image */}
                                    <div className="step-counter">{GAMES_THERAPY_STEPS[gamesStep].id}/{GAMES_THERAPY_STEPS.length}</div>
                                </div>
                                {GAMES_THERAPY_STEPS[gamesStep].title && <h3 className="therapy-card-title">{GAMES_THERAPY_STEPS[gamesStep].title}</h3>}
                                <p className="therapy-card-text">{GAMES_THERAPY_STEPS[gamesStep].text}</p>
                            </div>
                            <div className="therapy-card-bottom">
                                <Button3D
                                    variant="light"
                                    onClick={handlePrevGames}
                                    styleOverrides={{ opacity: gamesStep === 0 ? 0.5 : 1, pointerEvents: gamesStep === 0 ? 'none' : 'auto' }}
                                >
                                    Previous
                                </Button3D>
                                <Button3D
                                    variant="blue"
                                    onClick={handleNextGames}
                                    styleOverrides={{ opacity: gamesStep === GAMES_THERAPY_STEPS.length - 1 ? 0.5 : 1, pointerEvents: gamesStep === GAMES_THERAPY_STEPS.length - 1 ? 'none' : 'auto' }}
                                >
                                    Next
                                </Button3D>
                            </div>
                        </div>

                    </div>

                    {/* CONTENT LIBRARY SECTION */}
                    <h2 className="section-title">Know about how <span>games therapy works?</span></h2>

                    <div className="library-container">
                        <h3 className="library-title">Expert-reviewed content on mental health</h3>

                        {/* CATEGORY TABS AS 3D BUTTONS */}
                        <div className="library-tabs">
                            {["DEPRESSION", "ANXIETY", "STRESS", "SLEEP"].map(tab => (
                                <Button3D
                                    key={tab}
                                    variant={activeTab === tab ? "blue" : "light"}
                                    onClick={() => setActiveTab(tab)}
                                    styleOverrides={{ padding: "8px 24px" }}
                                >
                                    {tab}
                                </Button3D>
                            ))}
                        </div>

                        {/* HORIZONTAL ONE-LINE CONTENT GRID */}
                        <div className="library-grid">
                            {filteredContent.map(item => (
                                <div className="content-card" key={item.id} style={{ background: item.color }}>

                                    {/* Empty area for manual image insertion */}
                                    <div className="content-img-placeholder" style={{ background: item.imgBg }}>
                                        {item.image && (
                                            <img src={item.image} alt={item.title} />
                                        )}
                                    </div>
                                    <div className="content-details">
                                        <h4 className="content-title">{item.title}</h4>
                                        <div className="content-bottom">
                                            <span className="content-meta">{item.type} • {item.time}</span>

                                            {/* Action Button */}
                                            <Button3D
                                                variant="blue"
                                                onClick={() => setSelectedModalContent(item)}
                                                styleOverrides={{ padding: "6px 16px", fontSize: "12px", flex: "none" }}
                                            >
                                                {item.cta}
                                            </Button3D>

                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* MODAL OVERLAY FOR ARTICLES & GAMES */}
                {selectedModalContent && (
                    <div className="modal-overlay" onClick={() => setSelectedModalContent(null)}>
                        <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                            <h2 className="modal-header">{selectedModalContent.title}</h2>

                            <div className="modal-body">
                                {selectedModalContent.type === "Article" ? (
                                    <p>{selectedModalContent.content}</p>
                                ) : (
                                    renderGameContent(selectedModalContent.content)
                                )}
                            </div>

                            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "30px" }}>
                                <Button3D variant="light" onClick={() => setSelectedModalContent(null)}>
                                    Close
                                </Button3D>
                            </div>
                        </div>
                    </div>
                )}

                {/* FOOTER */}
                <div className="footer-wrapper">
                    <footer className="footer">
                        <div className="footer-grid">
                            <div>
                                <div className="logo-area" style={{ marginBottom: "15px" }}>
                                    <img src={logoImg} alt="Horizon Logo" className="header-logo" /> Horizon
                                </div>
                                <p className="footer-desc">Horizon provides a complete mental health therapy ecosystem in affordable service costs.</p>
                            </div>
                            <div>
                                <h4 className="footer-col-title">Product</h4>
                                <span className="footer-link" onClick={() => handleNavigate('/products')}>Features</span>
                                <span className="footer-link" onClick={() => handleNavigate('/about')}>Research AI</span>
                            </div>
                            <div>
                                <h4 className="footer-col-title">Company</h4>
                                <span className="footer-link" onClick={() => handleNavigate('/about')}>About</span>
                                <span className="footer-link" onClick={() => handleNavigate('/bookexpert')}>Careers</span>
                            </div>
                            <div>
                                <h4 className="footer-col-title">Legal</h4>
                                <span className="footer-link" onClick={() => handleNavigate('/about')}>Privacy</span>
                                <span className="footer-link" onClick={() => handleNavigate('/about')}>Terms</span>
                            </div>
                        </div>
                        <div className="footer-bottom">© 2026 Horizon. All rights are reserved</div>
                    </footer>
                </div>

            </div>
        </>
    );
}