// pages/AdminPage.js — Admin panel as a proper page (not overlay)
import React from "react";
import AdminDashboard from "../AdminDashboard";
import { useAuth }    from "../AuthContext";
import { useNavigate } from "react-router-dom";
import { useTheme }   from "../ThemeContext";

const AdminPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isDark, theme } = useTheme();

  if (!user || user.role !== "admin") {
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", gap:16, background: theme.bg }}>
        <div style={{ fontSize:48 }}>🔒</div>
        <div style={{ fontSize:20, fontWeight:700, color:isDark?"#f1f5f9":"#1a202c" }}>Admin Access Only</div>
        <button onClick={() => navigate("/")} style={{ padding:"10px 24px", borderRadius:9, background:"#4299e1", color:"#fff", border:"none", fontWeight:600, cursor:"pointer" }}>
          Go to Dashboard
        </button>
      </div>
    );
  }

  // Render AdminDashboard in page mode — pass a navigate-based onClose
  return (
    <div style={{ height:"100%", overflowY:"auto", background: theme.bg }}>
      <AdminDashboard onClose={() => navigate("/")} isPage={true} />
    </div>
  );
};

export default AdminPage;
