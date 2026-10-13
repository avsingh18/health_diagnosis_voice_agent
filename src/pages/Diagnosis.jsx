import React, { useState, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { useGLTF, OrbitControls, ContactShadows, Environment } from "@react-three/drei";
import { clone } from 'three/examples/jsm/utils/SkeletonUtils';
import { useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import * as THREE from 'three';

import logoImg from "../assets/logo.png";
import therapyIconImg from "../assets/therapy-icon.png";

// ==========================================
// 🧠 CLINICAL PSYCHOSOMATIC DATABASE
// ==========================================
const BODY_MAP_DB = {
    brain: {
        title: "The Brain & Nervous System",
        subtitle: "The command center of your mental health.",
        overview: "Your brain is the epicenter of your thoughts, emotions, and behavior. In mental health, three key areas are crucial: the Amygdala (fear and threat detection), the Prefrontal Cortex (logic and decision making), and the Hippocampus (memory).",
        symptoms: [
            "Overthinking and racing thoughts",
            "Brain fog or lack of concentration",
            "Chronic fatigue and mental exhaustion",
            "Disrupted sleep patterns or insomnia"
        ],
        therapy: "Cognitive Behavioral Therapy (CBT) helps rewire these neural pathways. Mindfulness practices shrink the amygdala's fear response, while actively building new, healthier synaptic connections in the prefrontal cortex.",
        programs: ["Beating Anxiety", "Overcoming Depression", "Sleeping Better"]
    },
    heart: {
        title: "The Heart & Respiratory System",
        subtitle: "The physical engine of the anxiety response.",
        overview: "When the brain perceives a threat (even an imagined one), it activates the Sympathetic Nervous System. This floods your body with adrenaline and cortisol, leading to rapid heartbeat and shallow breathing—the classic 'fight or flight' response.",
        symptoms: [
            "Heart palpitations or racing pulse",
            "Shortness of breath or chest tightness",
            "Panic attacks",
            "Feeling constantly 'on edge'"
        ],
        therapy: "We utilize Somatic therapies and breathing visualizers. Techniques like Box Breathing stimulate the Vagus nerve, which signals the Parasympathetic Nervous System to slow the heart rate and calm the body.",
        programs: ["Tackling Stress", "Beating Anxiety"]
    },
    gut: {
        title: "The Gut-Brain Axis",
        subtitle: "Your body's 'second brain'.",
        overview: "The Enteric Nervous System in your gut contains over 100 million nerve cells. It communicates directly with your brain via the Vagus nerve. Up to 90% of the body's serotonin (the 'happy chemical') is produced in the gut.",
        symptoms: [
            "Stress-induced nausea or 'butterflies'",
            "Changes in appetite (overeating or under-eating)",
            "Irritable Bowel Syndrome (IBS) flare-ups",
            "Unexplained abdominal pain during stress"
        ],
        therapy: "Managing chronic stress directly improves gastrointestinal distress. Therapy focuses on grounding techniques to reduce systemic inflammation, alongside nutritional psychiatry awareness.",
        programs: ["Tackling Stress", "Living Happier"]
    }
};

// ==========================================
// 🎨 GLOBAL STYLES
// ==========================================
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');

  html, body, #root { 
    margin: 0 !important; padding: 0 !important; 
    width: 100vw; overflow-x: hidden; 
    background: #FAFAFA; font-family: 'Nunito', sans-serif; 
  }
  * { box-sizing: border-box; }

  .horizon-container { width: 100vw; min-height: 100vh; display: flex; flex-direction: column; align-items: center; }
  
  .header-wrapper { width: 100vw; background: #FFFFFF; display: flex; justify-content: center; box-shadow: 0 2px 10px rgba(0,0,0,0.05); z-index: 10; position: sticky; top: 0;}
  .header { display: flex; justify-content: space-between; align-items: center; padding: 15px 24px; width: 100%; max-width: 1400px;}
  .logo-area { display: flex; align-items: center; gap: 10px; font-size: 22px; font-weight: 600; color: #000; cursor: pointer; }
  .header-logo { height: 26px; object-fit: contain; }
  .nav-links { display: flex; gap: clamp(14px, 3vw, 30px); }
  .nav-link { color: #666; font-weight: 500; font-size: 15px; cursor: pointer; transition: color 0.2s; }
  .nav-link:hover { color: #1A5FCC; }

  .diagnosis-layout {
      display: flex;
      width: 100%;
      max-width: 1400px;
      height: calc(100vh - 70px);
      background: #FAFAFA;
  }

  /* 3D Canvas Area */
  .canvas-panel {
      flex: 1;
      position: relative;
      background: radial-gradient(circle at center, #FFFFFF 0%, #E2EDFB 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      border-right: 1px solid #E0E0E0;
  }

  .canvas-instruction {
      position: absolute;
      top: 30px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(255,255,255,0.9);
      padding: 10px 20px;
      border-radius: 100px;
      font-size: 14px;
      font-weight: 600;
      color: #1A5FCC;
      box-shadow: 0 4px 15px rgba(26, 95, 204, 0.1);
      z-index: 5;
      pointer-events: none;
  }

  /* Information Panel */
  .info-panel {
      width: 45%;
      min-width: 400px;
      max-width: 600px;
      background: #FFFFFF;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
  }

  .welcome-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 40px;
      text-align: center;
      color: #666;
  }
  .welcome-icon { width: 80px; height: 80px; margin-bottom: 20px; opacity: 0.5;}

  .detail-state {
      padding: 40px;
      display: flex;
      flex-direction: column;
      animation: fadeIn 0.3s ease-out;
  }

  @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
  }

  .detail-header { border-bottom: 2px solid #F0F0F0; padding-bottom: 20px; margin-bottom: 30px; }
  .detail-title { font-size: 28px; font-weight: 700; color: #333; margin: 0 0 10px 0; }
  .detail-subtitle { font-size: 16px; font-weight: 500; color: #2962FF; margin: 0; }

  /* Tabs */
  .tabs-container { display: flex; gap: 10px; margin-bottom: 30px; border-bottom: 1px solid #E0E0E0;}
  .tab-btn {
      padding: 12px 20px;
      font-size: 15px;
      font-weight: 600;
      color: #888;
      background: none;
      border: none;
      border-bottom: 3px solid transparent;
      cursor: pointer;
      transition: all 0.2s;
  }
  .tab-btn.active { color: #1A5FCC; border-bottom-color: #1A5FCC; }
  .tab-btn:hover:not(.active) { color: #555; }

  .tab-content { font-size: 16px; color: #555; line-height: 1.7; }
  
  .symptom-list { list-style: none; padding: 0; margin: 20px 0;}
  .symptom-list li {
      position: relative;
      padding-left: 30px;
      margin-bottom: 12px;
      font-weight: 500;
      color: #444;
  }
  .symptom-list li::before {
      content: '•';
      position: absolute;
      left: 10px;
      color: #2962FF;
      font-size: 20px;
      line-height: 1;
  }

  .program-tags { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 20px; }
  .p-tag { background: #E2EDFB; color: #1A5FCC; padding: 6px 14px; border-radius: 100px; font-size: 13px; font-weight: 600; }

  @media (max-width: 900px) {
      .diagnosis-layout { flex-direction: column; height: auto; }
      .canvas-panel { height: 50vh; min-height: 400px; border-right: none; border-bottom: 1px solid #E0E0E0; }
      .info-panel { width: 100%; min-width: 100%; height: auto; }
  }
`;

// ==========================================
// 🧩 3D BUTTON COMPONENT
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
                padding: "12px 28px", borderRadius: "100px", border: "none", cursor: "pointer",
                color: textColor, fontSize: "15px", fontWeight: "600", fontFamily: "'Nunito', sans-serif",
                background: gradients[variant],
                boxShadow: variant === "light"
                    ? "inset 0 4px 8px rgba(255,255,255,0.8), inset 0 -6px 12px rgba(0,0,0,0.05), 0 4px 10px rgba(0,0,0,0.05)"
                    : "inset 0 4px 8px rgba(255,255,255,0.3), inset 0 -6px 12px rgba(0,0,0,0.2), 0 4px 10px rgba(0,0,0,0.1)",
                transition: "all 0.15s ease-out", outline: "none", ...styleOverrides
            }}
            onMouseDown={e => { e.currentTarget.style.transform = "scale(0.96) translateY(2px)"; }}
            onMouseUp={e => { e.currentTarget.style.transform = "scale(1) translateY(0)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "scale(1) translateY(0)"; }}
        >
            {children}
        </button>
    );
};

const XbotModel = ({ onSelectNode, activeNode }) => {
    // 1. Use the lower-level useLoader instead of useGLTF to bypass R3F's aggressive caching
    const gltf = useLoader(GLTFLoader, "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/Xbot.glb");

    // 2. Create a deep, safe clone of the scene that doesn't share WebGL references
    const clonedScene = React.useMemo(() => {
        if (!gltf) return null;
        const clone = gltf.scene.clone(true); // Deep clone

        // Ensure all materials are unique to this instance to prevent context sharing crashes
        clone.traverse((child) => {
            if (child.isMesh) {
                child.material = child.material.clone();
                // Ensure standard materials work well in our environment
                if (child.material instanceof THREE.MeshStandardMaterial) {
                    child.material.envMapIntensity = 1;
                    child.material.needsUpdate = true;
                }
            }
        });
        return clone;
    }, [gltf]);

    const Hitbox = ({ position, id, label }) => {
        const isActive = activeNode === id;
        return (
            <group position={position}>
                <mesh>
                    <sphereGeometry args={[0.08, 16, 16]} />
                    <meshStandardMaterial
                        color={isActive ? "#FF3D00" : "#2962FF"}
                        emissive={isActive ? "#FF3D00" : "#2962FF"}
                        emissiveIntensity={2}
                        toneMapped={false}
                    />
                </mesh>
                <mesh
                    visible={false}
                    onClick={(e) => { e.stopPropagation(); onSelectNode(id); }}
                    onPointerOver={() => document.body.style.cursor = 'pointer'}
                    onPointerOut={() => document.body.style.cursor = 'auto'}
                >
                    <sphereGeometry args={[0.3, 16, 16]} />
                </mesh>
            </group>
        );
    };

    if (!clonedScene) return null;

    return (
        <group>
            {/* Render the manually deep-cloned scene */}
            <primitive object={clonedScene} scale={1.8} position={[0, -1.8, 0]} />

            <Hitbox position={[0, 1.2, 0.1]} id="brain" label="Brain" />
            <Hitbox position={[0, 0.4, 0.15]} id="heart" label="Heart" />
            <Hitbox position={[0, -0.1, 0.1]} id="gut" label="Gut" />
        </group>
    );
};

// ==========================================
// 🚀 MAIN COMPONENT
// ==========================================
export default function Diagnosis() {
    const navigate = useNavigate();
    const [activeNode, setActiveNode] = useState(null);
    const [activeTab, setActiveTab] = useState("overview"); // overview, symptoms, therapy

    const handleNodeSelect = (nodeId) => {
        setActiveNode(nodeId);
        setActiveTab("overview");
    };

    const renderInfoContent = () => {
        if (!activeNode) {
            return (
                <div className="welcome-state">
                    <img src={therapyIconImg} alt="Therapy" className="welcome-icon" style={{filter: "grayscale(100%) opacity(0.5)"}}/>
                    <h2 style={{color: "#333", fontWeight: 600}}>Psychosomatic Explorer</h2>
                    <p style={{maxWidth: "300px", lineHeight: 1.6}}>
                        Interact with the glowing nodes on the 3D model to understand how mental health impacts different parts of your body.
                    </p>
                </div>
            );
        }

        const data = BODY_MAP_DB[activeNode];

        return (
            <div className="detail-state">
                <div className="detail-header">
                    <h2 className="detail-title">{data.title}</h2>
                    <p className="detail-subtitle">{data.subtitle}</p>
                </div>

                <div className="tabs-container">
                    <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
                    <button className={`tab-btn ${activeTab === 'symptoms' ? 'active' : ''}`} onClick={() => setActiveTab('symptoms')}>Symptoms</button>
                    <button className={`tab-btn ${activeTab === 'therapy' ? 'active' : ''}`} onClick={() => setActiveTab('therapy')}>Therapy</button>
                </div>

                <div className="tab-content">
                    {activeTab === 'overview' && (
                        <div>
                            <p>{data.overview}</p>
                            <br/>
                            <p><strong>Associated Horizon Programs:</strong></p>
                            <div className="program-tags">
                                {data.programs.map((prog, i) => <span key={i} className="p-tag">{prog}</span>)}
                            </div>
                        </div>
                    )}

                    {activeTab === 'symptoms' && (
                        <div>
                            <p>Common manifestations connected to this system include:</p>
                            <ul className="symptom-list">
                                {data.symptoms.map((symp, i) => <li key={i}>{symp}</li>)}
                            </ul>
                        </div>
                    )}

                    {activeTab === 'therapy' && (
                        <div>
                            <p>{data.therapy}</p>
                            <div style={{marginTop: "40px"}}>
                                <Button3D onClick={() => navigate('/bookexpert')} styleOverrides={{width: "100%"}}>
                                    Consult an Expert Now
                                </Button3D>
                            </div>
                        </div>
                    )}
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
                        <div className="logo-area" onClick={() => navigate('/')}>
                            <img src={logoImg} alt="Horizon Logo" className="header-logo" /> Horizon
                        </div>
                        <nav className="nav-links" style={{ display: window.innerWidth < 768 ? 'none' : 'flex' }}>
                            <span className="nav-link" onClick={() => navigate('/home')}>Home</span>
                            <span className="nav-link" onClick={() => navigate('/events')}>Events</span>
                            <span className="nav-link" onClick={() => navigate('/therapy')}>Therapy</span>
                            <span className="nav-link" onClick={() => navigate('/products')}>Products</span>
                        </nav>
                        <Button3D onClick={() => navigate('/bookexpert')} styleOverrides={{ padding: "8px 24px", width: "auto" }}>
                            Book Session
                        </Button3D>
                    </header>
                </div>

                {/* SPLIT LAYOUT */}
                <div className="diagnosis-layout">

                    {/* LEFT: 3D CANVAS */}
                    <div className="canvas-panel">
                        <div className="canvas-instruction">
                            Interact with the model to explore
                        </div>

                        <Suspense fallback={<div style={{fontWeight: 600, color: "#1A5FCC"}}>Loading 3D Anatomy...</div>}>
                            <Canvas frameloop="demand" camera={{ position: [0, 1, 4], fov: 50 }}>
                                <ambientLight intensity={0.6} />
                                <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
                                <Environment preset="city" />

                                <XbotModel onSelectNode={handleNodeSelect} activeNode={activeNode} />

                                <OrbitControls
                                    enablePan={false}
                                    minPolarAngle={Math.PI / 4}
                                    maxPolarAngle={Math.PI / 1.5}
                                    minDistance={2}
                                    maxDistance={6}
                                />
                                <ContactShadows position={[0, -1.8, 0]} opacity={0.4} scale={5} blur={2} far={4} />
                            </Canvas>
                        </Suspense>
                    </div>

                    {/* RIGHT: INFO PANEL */}
                    <div className="info-panel">
                        {renderInfoContent()}
                    </div>

                </div>
            </div>
        </>
    );
}

// Preload the model to prevent lag
useGLTF.preload("https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/Xbot.glb");