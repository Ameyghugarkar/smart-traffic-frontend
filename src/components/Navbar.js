// components/Navbar.js — Top navigation bar with React Router links
import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth }  from "../AuthContext";
import { useTheme } from "../ThemeContext";

const getScoreMeta = (s) =>
  s === null      ? { label:"Loading",  color:"#718096", emoji:"⏳" }
  : s >= 70       ? { label:"Good",     color:"#38a169", emoji:"🟢" }
  : s >= 45       ? { label:"Moderate", color:"#d97706", emoji:"🟠" }
  :                 { label:"Critical", color:"#e53e3e", emoji:"🔴" };

const Navbar = ({ trafficScore, onLoginClick }) => {
  const { user, logout } = useAuth();
  const { isDark, toggle } = useTheme();
  const meta = getScoreMeta(trafficScore);

  const navItems = [
    { to: "/",          label: "🗺️ Dashboard",  end: true },
    { to: "/incidents", label: "⚠️ Incidents"            },
    ...(user?.role === "admin" ? [
      { to: "/history", label: "📅 History" },
      { to: "/admin",   label: "📊 Admin" }
    ] : []),
  ];

  return (
    <nav style={S.nav}>
      {/* Brand */}
      <div style={S.left}>
        <span style={{ fontSize:22 }}>🚦</span>
        <div>
          <div style={S.appName}>Smart Traffic Monitor</div>
          <div style={S.appSub}>Pune Metropolitan Area · Real-time AI</div>
        </div>
      </div>

      {/* Nav Links */}
      <div style={S.center}>
        {navItems.map(({ to, label, end }) => (
          <NavLink
            key={to} to={to} end={end}
            style={({ isActive }) => ({ ...S.link, ...(isActive ? S.linkActive : {}) })}
          >
            {label}
          </NavLink>
        ))}
      </div>

      {/* Right: score + user */}
      <div style={S.right}>
        {trafficScore !== null && (
          <div style={S.scoreBox}>
            <div style={S.scoreLabel}>PUNE TRAFFIC INDEX</div>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ fontSize:22, fontWeight:800, color:meta.color, lineHeight:1 }}>{trafficScore}</span>
              <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:99, background:meta.color+"25", color:meta.color }}>
                {meta.emoji} {meta.label}
              </span>
            </div>
          </div>
        )}

        <button onClick={toggle} style={S.iconBtn} title="Toggle theme">
          {isDark ? "☀️" : "🌙"}
        </button>

        {user ? (
          <>
            <div style={S.userBadge}>
              <span>{user.role === "admin" ? "👑" : "👤"}</span>
              <div>
                <div style={S.userName}>{user.role === "admin" ? "Administrator" : user.name}</div>
                <div style={{ ...S.userRole, color: user.role==="admin"?"#fbbf24":"#718096" }}>{user.role}</div>
              </div>
            </div>
            <button onClick={logout} style={{ ...S.btn, color:"#fc8181", borderColor:"#fc818144" }}>Logout</button>
          </>
        ) : (
          <button onClick={onLoginClick} style={{ ...S.btn, background:"#4299e1", color:"#fff", borderColor:"#4299e1", fontWeight:600 }}>
            🔐 Login
          </button>
        )}
      </div>
    </nav>
  );
};

const S = {
  nav:        { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 16px", height:56, background:"#1a202c", flexShrink:0, zIndex:1000, gap:12 },
  left:       { display:"flex", alignItems:"center", gap:10, flexShrink:0 },
  appName:    { fontSize:14, fontWeight:600, color:"#fff", letterSpacing:"-.2px" },
  appSub:     { fontSize:10, color:"#718096" },
  center:     { display:"flex", alignItems:"center", gap:4 },
  link:       { fontSize:12, fontWeight:500, padding:"5px 13px", borderRadius:7, border:"1px solid transparent", color:"#a0aec0", textDecoration:"none", transition:"all .15s" },
  linkActive: { background:"#2d3748", color:"#e2e8f0", border:"1px solid #4a5568" },
  right:      { display:"flex", alignItems:"center", gap:8, flexShrink:0 },
  scoreBox:   { background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"4px 12px" },
  scoreLabel: { fontSize:9, color:"#718096", fontWeight:700, letterSpacing:".06em", marginBottom:2 },
  iconBtn:    { fontSize:14, padding:"4px 10px", borderRadius:7, border:"1px solid #4a5568", background:"transparent", cursor:"pointer" },
  btn:        { fontSize:12, fontWeight:500, padding:"5px 13px", borderRadius:7, border:"1px solid #4a5568", background:"transparent", color:"#a0aec0", cursor:"pointer" },
  userBadge:  { display:"flex", alignItems:"center", gap:6, background:"rgba(255,255,255,0.08)", borderRadius:8, padding:"4px 10px", border:"1px solid rgba(255,255,255,0.1)" },
  userName:   { fontSize:11, fontWeight:600, color:"#e2e8f0" },
  userRole:   { fontSize:9, textTransform:"uppercase", fontWeight:700 },
};

export default Navbar;
