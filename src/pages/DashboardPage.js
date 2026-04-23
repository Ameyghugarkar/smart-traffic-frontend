// pages/DashboardPage.js — Main dashboard (map + sidebar + charts)
import React, { useState, useEffect, useCallback, useRef } from "react";
import axios         from "axios";
import { API_TRAFFIC } from "../config";
import MapComponent  from "../MapComponent";
import TrafficCharts from "../TrafficCharts";
import ZoneSidebar   from "../ZoneSidebar";
import { useTheme }  from "../ThemeContext";
import { useAuth }   from "../AuthContext";

const DashboardPage = ({ onScoreUpdate, onLoginClick }) => {
  const { isDark, theme } = useTheme();
  const { user } = useAuth();

  const [showCharts,   setShowCharts]   = useState(true);
  const [showSidebar,  setShowSidebar]  = useState(true);
  const [trafficData,  setTrafficData]  = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pollRef = useRef(null);

  const dedup = (raw) => {
    const map = {};
    raw.forEach(r => {
      if (!map[r.location] || new Date(r.timestamp) > new Date(map[r.location].timestamp))
        map[r.location] = r;
    });
    return Object.values(map);
  };

  // Reads latest data from MongoDB — no TomTom call, free
  const fetchTraffic = useCallback(async () => {
    try {
      const res = await axios.get(API_TRAFFIC, { timeout: 5000 });
      const raw = Array.isArray(res.data) ? res.data
                : Array.isArray(res.data?.data) ? res.data.data : [];
      if (raw.length === 0) return;
      const zones = dedup(raw);
      setTrafficData(zones);
      const avg = zones.reduce((s, z) => s + z.congestion, 0) / zones.length;
      const score = Math.round((1 - avg) * 100);
      if (onScoreUpdate) onScoreUpdate(score);
    } catch { /* silent */ }
  }, [onScoreUpdate]);

  // Manual Refresh — calls TomTom for fresh live data (uses API quota)
  const generateData = useCallback(async () => {
    setIsRefreshing(true);
    setTrafficData([]);
    try {
      await axios.get(`${API_TRAFFIC}/generate`, { timeout: 60000 });
      await fetchTraffic();
    } catch { /* silent */ }
    finally { setIsRefreshing(false); }
  }, [fetchTraffic]);

  // On mount: read MongoDB immediately, then poll every 15 min (matches cron cadence, zero TomTom cost)
  useEffect(() => {
    fetchTraffic();
    pollRef.current = setInterval(fetchTraffic, 15 * 60 * 1000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []); // eslint-disable-line

  return (
    <div style={{ ...S.root, background: theme.bg }}>
      {/* Map controls bar */}
      <div style={{ ...S.controlBar, borderBottom:`1px solid ${theme.border}`, background: theme.surface }}>
        <button style={{ ...S.toggleBtn, ...(showSidebar ? S.btnActive : {}) }} onClick={() => setShowSidebar(v => !v)}>
          {showSidebar ? "▶ Hide Panel" : "◀ Zone Panel"}
        </button>
        <button style={{ ...S.toggleBtn, ...(showCharts ? S.btnActive : {}) }} onClick={() => setShowCharts(v => !v)}>
          {showCharts ? "▲ Hide Charts" : "▼ Show Charts"}
        </button>
      </div>

      {/* Body */}
      <div style={{ ...S.body, background: theme.bg }}>
        <div style={S.leftCol}>
          <div style={{ flex: showCharts ? "0 0 56%" : "1 1 100%", overflow:"hidden", transition:"flex .3s ease", minHeight:0 }}>
            <MapComponent
              layoutTrigger={`${showSidebar}-${showCharts}`}
              user={user}
              onLoginRequired={onLoginClick}
              trafficData={trafficData}
              isRefreshing={isRefreshing}
              onManualRefresh={generateData}
              isDark={isDark}
            />
          </div>
          {showCharts && (
            <div style={S.chartsSection}>
              <TrafficCharts trafficData={trafficData} isRefreshing={isRefreshing} isDark={isDark} />
            </div>
          )}
        </div>
        {showSidebar && (
          <div style={{ ...S.sidebarCol, borderLeft:`1px solid ${theme.border}`, background: theme.surfaceAlt }}>
            <ZoneSidebar trafficData={trafficData} isRefreshing={isRefreshing} isDark={isDark} />
          </div>
        )}
      </div>
    </div>
  );
};

const S = {
  root:        { display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" },
  controlBar:  { display:"flex", alignItems:"center", gap:8, padding:"6px 14px", flexShrink:0 },
  toggleBtn:   { fontSize:12, fontWeight:500, padding:"4px 12px", borderRadius:7, border:"1px solid #4a5568", background:"transparent", color:"#718096", cursor:"pointer" },
  btnActive:   { background:"#2d3748", color:"#e2e8f0", borderColor:"#718096" },
  body:        { flex:1, display:"flex", overflow:"hidden" },
  leftCol:     { flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0 },
  chartsSection:{ flex:1, overflowY:"auto", minHeight:0 },
  sidebarCol:  { width:285, flexShrink:0, overflow:"hidden" },
};

export default DashboardPage;
