import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Pages
import SplashPage          from './pages/SplashPage.jsx';
import HomePage            from './pages/HomePage.jsx';
// 1. Meet the Consultant (multilingual voice intake + smartwatch)
import ConsultNowPage      from './pages/ConsultNowPage.jsx';
import ClinicalReportPage  from './pages/ClinicalReportPage.jsx';
// 2. Meet the Therapist
import SessionPage         from './pages/SessionPage.jsx';
import ConsultantPage      from './pages/ConsultantPage.jsx';
import ResultAnalysis      from "./pages/ResultAnalysis.jsx";
// 3. Book a Doctor
import Bookexpert          from "./pages/Bookexpert.jsx";
import Viewdetails         from "./pages/Viewdetailes.jsx";

// Switched off: Horizon now offers only the three features above. The files
// are kept so these pages can be brought back by uncommenting.
// import Events          from "./pages/Events.jsx";
// import Product         from "./pages/Product.jsx";
// import About           from "./pages/About.jsx";
// import Disclaimer      from "./pages/Disclaimer.jsx";
// import Diagnosis       from "./pages/Diagnosis.jsx";

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/"            element={<SplashPage />} />
                <Route path="/home"        element={<HomePage />} />

                {/* 1. Meet the Consultant */}
                <Route path="/consultation"        element={<ConsultNowPage />} />
                <Route path="/consultation/report" element={<ClinicalReportPage />} />

                {/* 2. Meet the Therapist */}
                <Route path="/therapy"         element={<SessionPage />} />
                <Route path="/consultant"      element={<ConsultantPage />} />
                <Route path="/result-analysis" element={<ResultAnalysis />} />

                {/* 3. Book a Doctor */}
                <Route path="/bookexpert"   element={<Bookexpert />} />
                <Route path="/viewdetails"  element={<Viewdetails />} />

                {/* Switched off
                <Route path="/events"       element={<Events />} />
                <Route path="/products"     element={<Product />} />
                <Route path="/about"        element={<About />} />
                <Route path="/disclaimer"   element={<Disclaimer />} />
                <Route path="/diagnosis"    element={<Diagnosis />} />
                */}

                {/* Legacy links */}
                <Route path="/consult" element={<Navigate to="/consultation" replace />} />
                <Route path="*"        element={<Navigate to="/home" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
