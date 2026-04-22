// App.js — React Router shell (multi-page app)
import React, { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Navbar         from "./components/Navbar";
import DashboardPage  from "./pages/DashboardPage";
import HistoryPage    from "./pages/HistoryPage";
import IncidentsPage  from "./pages/IncidentsPage";
import AdminPage      from "./pages/AdminPage";
import AuthPage       from "./AuthPage";
import { useAuth }    from "./AuthContext";
import { useTheme }   from "./ThemeContext";

// Protect routes that require admin role
const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user || user.role !== "admin") return <Navigate to="/" replace />;
  return children;
};

const AppShell = () => {
  const { theme } = useTheme();
  const [trafficScore, setTrafficScore] = useState(null);
  const [showAuth,     setShowAuth]     = useState(false);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", overflow:"hidden", fontFamily:"'DM Sans', Inter, system-ui, sans-serif", background: theme.bg }}>

      {/* Auth modal — available from any page */}
      {showAuth && <AuthPage onClose={() => setShowAuth(false)} />}

      {/* Persistent top nav */}
      <Navbar
        trafficScore={trafficScore}
        onLoginClick={() => setShowAuth(true)}
      />

      {/* Page content */}
      <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
        <Routes>
          <Route path="/" element={
            <DashboardPage
              onScoreUpdate={setTrafficScore}
              onLoginClick={() => setShowAuth(true)}
            />}
          />
          <Route path="/history"   element={<HistoryPage />} />
          <Route path="/incidents" element={<IncidentsPage onLoginClick={() => setShowAuth(true)} />} />
          <Route path="/admin"     element={<AdminRoute><AdminPage /></AdminRoute>} />
          <Route path="*"          element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
};

const App = () => (
  <BrowserRouter>
    <AppShell />
  </BrowserRouter>
);

export default App;