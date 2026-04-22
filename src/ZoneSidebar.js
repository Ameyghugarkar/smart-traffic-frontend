// src/ZoneSidebar.js — with Best Time to Travel per zone

import React, { useState, useCallback } from "react";
import axios from "axios";
import { useTheme } from "./ThemeContext";
import { API_TRAFFIC } from "./config";

const API_BASE = API_TRAFFIC;

// Spin animation
if (!document.getElementById("spin-anim")) {
  const s = document.createElement("style");
  s.id = "spin-anim";
  s.textContent = "@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}";
  document.head.appendChild(s);
}

const getCongestionMeta = (c) => {
  if (c > 0.65) return { label:"Heavy",    color:"#ef4444", bg:"#fef2f2", bar:"#ef4444" };
  if (c > 0.35) return { label:"Moderate", color:"#f59e0b", bg:"#fffbeb", bar:"#f59e0b" };
  return               { label:"Clear",    color:"#10b981", bg:"#f0fdf4", bar:"#22c55e" };
};

// ─── Best Time Logic ──────────────────────────────────────────────────────────
const getBestTime = (forecast) => {
  if (!forecast || forecast.length === 0) return null;
  const now = new Date().getHours();

  // Find 2-hour window with lowest avg congestion — only future hours
  let bestStart = null, bestAvg = Infinity;
  for (let i = 0; i < forecast.length - 1; i++) {
    if (forecast[i].hour < now) continue; // skip past hours
    const avg = (forecast[i].congestion + forecast[i+1].congestion) / 2;
    if (avg < bestAvg) {
      bestAvg  = avg;
      bestStart = forecast[i].hour;
    }
  }

  // Find worst 2-hour window
  let worstStart = null, worstAvg = -Infinity;
  for (let i = 0; i < forecast.length - 1; i++) {
    if (forecast[i].hour < now) continue;
    const avg = (forecast[i].congestion + forecast[i+1].congestion) / 2;
    if (avg > worstAvg) {
      worstAvg  = avg;
      worstStart = forecast[i].hour;
    }
  }

  const fmt = (h) => {
    const suffix = h >= 12 ? "PM" : "AM";
    const display = h % 12 === 0 ? 12 : h % 12;
    return `${display}${suffix}`;
  };

  return {
    bestStart,
    bestEnd:   bestStart !== null ? bestStart + 2 : null,
    bestAvg:   Math.round(bestAvg * 100),
    worstStart,
    worstEnd:  worstStart !== null ? worstStart + 2 : null,
    worstAvg:  Math.round(worstAvg * 100),
    fmt,
  };
};

// ─── Best Time Badge shown on each card ──────────────────────────────────────
const BestTimeBadge = ({ location }) => {
  const { isDark } = useTheme();
  const [info,    setInfo]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);

  const fetchForecast = useCallback(async () => {
    if (info) { setOpen(o => !o); return; } // already fetched — just toggle
    setLoading(true);
    try {
      const res = await axios.get(
        `${API_BASE}/predict/hourly/${encodeURIComponent(location)}`,
        { timeout: 6000 }
      );
      if (res.data?.forecast) {
        setInfo(getBestTime(res.data.forecast));
        setOpen(true);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [location, info]);

  return (
    <div style={{ marginTop:6 }}>
      <button
        onClick={(e) => { e.stopPropagation(); fetchForecast(); }}
        style={{
          width:"100%", padding:"4px 0", fontSize:10, fontWeight:600,
          borderRadius:6, border:`1px dashed ${isDark?"#4b5563":"#d1d5db"}`,
          background:"transparent", color:isDark?"#9ca3af":"#6b7280",
          cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:4,
        }}
      >
        {loading ? "⏳ Loading…" : open ? "🕐 Hide Travel Tip ▲" : "🕐 Best Time to Travel ▼"}
      </button>

      {open && info && (
        <div style={{ marginTop:6, borderRadius:8, overflow:"hidden", fontSize:11 }}>
          {/* Best window */}
          <div style={{
            padding:"8px 10px",
            background: isDark ? "#052e16" : "#f0fdf4",
            borderLeft:"3px solid #10b981",
            borderBottom: `1px solid ${isDark ? "#064e3b" : "#d1fae5"}`,
          }}>
            <div style={{ fontWeight:700, color: isDark ? "#34d399" : "#065f46", marginBottom:2 }}>
              ✅ Best window
            </div>
            <div style={{ color: isDark ? "#6ee7b7" : "#047857" }}>
              {info.bestStart !== null
                ? `${info.fmt(info.bestStart)} – ${info.fmt(info.bestEnd)} · ~${info.bestAvg}% congestion`
                : "No future data available"}
            </div>
          </div>

          {/* Worst window */}
          <div style={{
            padding:"8px 10px",
            background: isDark ? "#2d0a0a" : "#fff5f5",
            borderLeft:"3px solid #ef4444",
          }}>
            <div style={{ fontWeight:700, color: isDark ? "#f87171" : "#991b1b", marginBottom:2 }}>
              ⚠️ Avoid
            </div>
            <div style={{ color: isDark ? "#fca5a5" : "#b91c1c" }}>
              {info.worstStart !== null
                ? `${info.fmt(info.worstStart)} – ${info.fmt(info.worstEnd)} · ~${info.worstAvg}% congestion`
                : "No future data available"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Zone Card ────────────────────────────────────────────────────────────────
const ZoneCard = ({ zone, rank, isSelected, onClick }) => {
  const { isDark } = useTheme();
  const meta = getCongestionMeta(zone.congestion);
  const pct  = Math.round(zone.congestion * 100);

  const cardBg     = isSelected ? (isDark ? meta.color + "40" : meta.bg) : (isDark ? "#1e2838" : "#fff");

  const namColor   = isDark ? "#f1f5f9" : (isSelected ? "#111827" : "#111827");
  const rankBg     = isDark ? "#2d3748" : "#f3f4f6";
  const rankBorder = isDark ? "#4b5563" : "#e5e7eb";
  const rankColor  = isDark ? "#d1d5db" : "#6b7280";
  const subColor   = isDark ? "#9ca3af" : "#6b7280";
  const valColor   = isDark ? "#e2e8f0" : "#374151";
  const trackBg    = isDark ? "#374151" : "#f3f4f6";

  return (
    <div
      onClick={() => onClick(zone)}
      style={{
        background: cardBg,
        borderLeft: `4px solid ${meta.bar}`,
        borderRadius:8, padding:"10px 12px", marginBottom:6,
        cursor:"pointer", transition:"all 0.18s ease",
        boxShadow: isSelected ? `0 2px 10px ${meta.color}44` : isDark ? "0 2px 8px rgba(0,0,0,0.5)" : "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
          <span style={{ width:20, height:20, borderRadius:"50%", background:rankBg, border:`1px solid ${rankBorder}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:700, color:rankColor, flexShrink:0 }}>
            {rank}
          </span>
          <span style={{ fontWeight:600, fontSize:13, color:namColor }}>{zone.location}</span>
        </div>
        <span style={{ fontSize:10, fontWeight:600, color:meta.color, background:meta.bg, border:`1px solid ${meta.color}44`, borderRadius:99, padding:"2px 7px" }}>
          {meta.label}
        </span>
      </div>

      <div style={{ height:4, background:trackBg, borderRadius:99, overflow:"hidden", marginBottom:6 }}>
        <div style={{ width:`${Math.max(pct, 2)}%`, height:"100%", background:meta.bar, borderRadius:99, transition:"width 0.6s ease", minWidth:"4px" }}/>
      </div>

      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
        <span style={{ fontSize:11, color:subColor }}>🚗 <b style={{ color:valColor }}>{zone.vehicles}</b> vehicles</span>
        <span style={{ fontSize:11, color:subColor }}>Congestion: <b style={{ color:meta.color }}>{pct}%</b></span>
      </div>

      {/* Best Time to Travel — lazy loaded per zone */}
      <BestTimeBadge location={zone.location} />
    </div>
  );
};

// ─── Stat Badge ───────────────────────────────────────────────────────────────
const StatBadge = ({ label, value, accent, theme }) => (
  <div style={{ flex:1, background:theme?.surface||"#fff", border:`1px solid ${theme?.border||"#e5e7eb"}`, borderRadius:8, padding:"10px 12px", textAlign:"center" }}>
    <div style={{ fontSize:18, fontWeight:700, color:accent, letterSpacing:"-0.03em" }}>{value}</div>
    <div style={{ fontSize:10, color:theme?.textMuted||"#9ca3af", marginTop:1 }}>{label}</div>
  </div>
);

// ─── Main Sidebar ─────────────────────────────────────────────────────────────
export default function ZoneSidebar({ trafficData = [], isRefreshing = false, isDark = false, onZoneSelect }) {
  const { theme } = useTheme();
  const [selected, setSelected] = useState(null);
  const [filter,   setFilter]   = useState("all");
  const [sortBy,   setSortBy]   = useState("congestion");
  const [search,   setSearch]   = useState("");

  const zones = trafficData;

  const filtered = zones
    .filter(z => {
      if (search && !z.location.toLowerCase().includes(search.toLowerCase())) return false;
      if (filter === "heavy") return z.congestion > 0.65;
      if (filter === "clear") return z.congestion <= 0.35;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "congestion") return b.congestion - a.congestion;
      if (sortBy === "vehicles")   return b.vehicles - a.vehicles;
      return a.location.localeCompare(b.location);
    });

  const avgCongestion = zones.length ? Math.round(zones.reduce((s,z)=>s+z.congestion,0)/zones.length*100) : 0;
  const totalVehicles = zones.reduce((s,z)=>s+(z.vehicles||0),0);
  const heavyCount    = zones.filter(z=>z.congestion>0.65).length;
  const clearCount    = zones.filter(z=>z.congestion<=0.35).length;

  const handleSelect = (zone) => {
    setSelected(zone.location === selected ? null : zone.location);
    if (onZoneSelect) onZoneSelect(zone);
  };

  const chip = (label, val) => (
    <button key={val} onClick={() => setFilter(val)} style={{
      fontSize:11, fontWeight:600, padding:"3px 10px", borderRadius:99, border:"1px solid",
      borderColor: filter===val?"#6366f1":(isDark?"#374151":"#e5e7eb"),
      background:  filter===val?"#6366f1":"transparent",
      color:       filter===val?"#fff":(isDark?"#9ca3af":"#6b7280"),
      cursor:"pointer", transition:"all 0.15s",
    }}>{label}</button>
  );

  return (
    <div style={{ width:280, height:"100%", display:"flex", flexDirection:"column", background:theme.surfaceAlt, borderLeft:`1px solid ${theme.border}`, fontFamily:"'DM Sans','Segoe UI',sans-serif", overflow:"hidden", position:"relative" }}>

      {/* Loading overlay */}
      {isRefreshing && (
        <div style={{ position:"absolute", inset:0, zIndex:100, background:"rgba(249,250,251,0.92)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12 }}>
          <div style={{ width:32, height:32, borderRadius:"50%", border:"3px solid #e5e7eb", borderTop:"3px solid #6366f1", animation:"spin 0.8s linear infinite" }}/>
          <div style={{ fontSize:12, color:"#6b7280", fontWeight:600 }}>Updating zones…</div>
          <div style={{ fontSize:11, color:"#9ca3af" }}>Fetching live TomTom data</div>
        </div>
      )}

      {/* Header */}
      <div style={{ padding:"14px 12px 10px", background:theme.surface, borderBottom:`1px solid ${theme.border}`, flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
          <span style={{ fontWeight:700, fontSize:13, color:theme.text }}>📍 Zone Overview</span>
          <span style={{ fontSize:9, color:isRefreshing?"#f59e0b":"#10b981", fontWeight:600 }}>
            {isRefreshing ? "⏳ UPDATING" : "● LIVE"}
          </span>
        </div>
        <div style={{ display:"flex", gap:6, marginBottom:10 }}>
          <StatBadge label="Avg Congestion" value={`${avgCongestion}%`} accent="#6366f1" theme={theme}/>
          <StatBadge label="Total Vehicles" value={totalVehicles.toLocaleString()} accent="#0ea5e9" theme={theme}/>
        </div>
        <div style={{ display:"flex", gap:6, marginBottom:10 }}>
          <StatBadge label="Heavy Zones" value={heavyCount} accent="#ef4444" theme={theme}/>
          <StatBadge label="Clear Zones" value={clearCount} accent="#10b981" theme={theme}/>
        </div>
        <div style={{ position:"relative", marginBottom:8 }}>
          <span style={{ position:"absolute", left:9, top:"50%", transform:"translateY(-50%)", fontSize:12 }}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search zone..."
            style={{ width:"100%", boxSizing:"border-box", padding:"6px 8px 6px 28px", fontSize:12, border:`1px solid ${theme.border}`, borderRadius:7, outline:"none", background:theme.surfaceAlt, color:theme.text }}/>
        </div>
        <div style={{ display:"flex", gap:5, marginBottom:8 }}>
          {chip("All","all")}{chip("🔴 Heavy","heavy")}{chip("🟢 Clear","clear")}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ fontSize:10, color:"#9ca3af", fontWeight:600 }}>SORT BY</span>
          {["congestion","vehicles","name"].map(s=>(
            <button key={s} onClick={()=>setSortBy(s)} style={{
              fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:6, border:"1px solid",
              borderColor: sortBy===s?(isDark?"#6b7280":"#374151"):(isDark?"#374151":"#e5e7eb"),
              background:  sortBy===s?(isDark?"#4b5563":"#374151"):"transparent",
              color:       sortBy===s?"#fff":(isDark?"#6b7280":"#9ca3af"),
              cursor:"pointer", textTransform:"capitalize",
            }}>{s}</button>
          ))}
        </div>
      </div>

      {/* Zone list */}
      <div style={{ flex:1, overflowY:"auto", padding:"10px 10px 10px 12px" }}>
        {filtered.length === 0 && !isRefreshing && (
          <div style={{ textAlign:"center", color:"#9ca3af", fontSize:12, marginTop:30 }}>
            {zones.length === 0 ? "Loading zones…" : "No zones match your filter."}
          </div>
        )}
        {filtered.map((zone, i) => (
          <ZoneCard key={zone.location} zone={zone} rank={i+1} isSelected={selected===zone.location} onClick={handleSelect}/>
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding:"8px 12px", borderTop:`1px solid ${theme.border}`, background:theme.surface, flexShrink:0, fontSize:10, color:theme.textMuted, textAlign:"center" }}>
        {zones.length} zones · TomTom live data · shared from map
      </div>
    </div>
  );
}