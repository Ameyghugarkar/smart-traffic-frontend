// TrafficCharts.js
// Tabs: Congestion | Vehicles | Live Trend | Predictions | Hourly Forecast

import React, { useEffect, useState, useCallback, useRef } from "react";

import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import axios from "axios";
import { useTheme } from "./ThemeContext";
import { API_TRAFFIC } from "./config";

if (!document.getElementById("spin-anim")) {
  const s = document.createElement("style");
  s.id = "spin-anim";
  s.textContent = "@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }";
  document.head.appendChild(s);
}

const API_BASE         = API_TRAFFIC;
const REFRESH_INTERVAL = 5000;

const getColor  = (c) => c > 0.65 ? "#e53e3e" : c > 0.35 ? "#ed8936" : "#38a169";
const getColorP = (p) => p > 65   ? "#e53e3e" : p > 35   ? "#ed8936" : "#38a169"; // pct version

const CustomTooltip = ({ active, payload, label }) => {
  const { isDark: dark } = useTheme();
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ ...styles.tooltip, background:dark?"#1e2535":"#fff", border:`1px solid ${dark?"#374151":"#e2e8f0"}`, boxShadow:dark?"0 4px 16px rgba(0,0,0,0.4)":"0 4px 12px rgba(0,0,0,.08)" }}>
      <p style={{ ...styles.tooltipTitle, color:dark?"#f1f5f9":"#1a202c" }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ ...styles.tooltipRow, color: p.color }}>
          {p.name}: <strong>{p.value}{p.name.includes("Congestion") ? "%" : ""}</strong>
        </p>
      ))}
    </div>
  );
};

// ─── Hourly Forecast Tab ──────────────────────────────────────────────────────
const HourlyForecastTab = ({ zones }) => {
  const { isDark: dark } = useTheme();
  const [selected,  setSelected]  = useState(zones[0]?.name || "");
  const [forecast,  setForecast]  = useState([]);
  const [allForecasts, setAllForecasts] = useState({});
  const [loading,   setLoading]   = useState(false);
  const [confidence, setConfidence] = useState("low");

  const fetchForecast = useCallback(async (location) => {
    if (allForecasts[location]) {
      setForecast(allForecasts[location].forecast);
      setConfidence(allForecasts[location].confidence);
      return;
    }
    setLoading(true);
    try {
      const res = await axios.get(
        `${API_BASE}/predict/hourly/${encodeURIComponent(location)}`,
        { timeout: 8000 }
      );
      if (res.data?.forecast) {
        setForecast(res.data.forecast);
        setConfidence(res.data.confidence || "low");
        setAllForecasts(prev => ({ ...prev, [location]: res.data }));
      }
    } catch (err) {
      console.error("Hourly forecast error:", err.message);
    } finally {
      setLoading(false);
    }
  }, [allForecasts]);

  useEffect(() => {
    if (selected) fetchForecast(selected);
  }, [selected]); // eslint-disable-line

  const confColor = (c) =>
    c === "high" ? "#38a169" : c === "medium" ? "#ed8936" : "#a0aec0";

  return (
    <div>
      <p style={styles.chartTitle}>
        24-hour traffic forecast — select a zone to see its hourly prediction
      </p>

      {/* Zone selector pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
        {zones.map(z => (
          <button
            key={z.name}
            onClick={() => setSelected(z.name)}
            style={{
              padding: "5px 14px", borderRadius: 99, fontSize: 12, fontWeight: 500,
              cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
              border: "1px solid",
              borderColor:  selected === z.name ? getColor(z.congestion / 100) : (dark?"#374151":"#e2e8f0"),
              background:   selected === z.name ? getColor(z.congestion / 100) + "18" : (dark?"#1e2535":"#f7fafc"),
              color:        selected === z.name ? getColor(z.congestion / 100) : (dark?"#9ca3af":"#718096"),
            }}
          >
            {z.name}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: "center", color: "#a0aec0", padding: 30, fontSize: 13 }}>
          ⏳ Generating forecast for {selected}…
        </div>
      )}

      {!loading && forecast.length > 0 && (
        <>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", minWidth:0 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: dark?"#f1f5f9":"#1a202c", whiteSpace:"nowrap" }}>
                {selected}
              </span>
              <span style={{ fontSize: 12, color: dark?"#6b7280":"#a0aec0", marginLeft: 8, whiteSpace:"nowrap" }}>
                24-hour congestion forecast
              </span>
            </div>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99,
              color: confColor(confidence),
              background: confColor(confidence) + "18",
              border: `1px solid ${confColor(confidence)}44`,
              textTransform: "capitalize",
            }}>
              {confidence} confidence
            </span>
          </div>

          {/* Weather-style hourly cards */}
          <div style={{
            display: "flex", gap: 6, overflowX: "auto",
            paddingBottom: 8,
          }}>
            {forecast.map((h, i) => (
              <div key={i} style={{
                flexShrink: 0, width: 62,
                background: h.isCurrent ? (dark?"#f1f5f9":"#1a202c") : (dark?"#1e2535":"#f7fafc"),
                border: `1px solid ${h.isCurrent ? (dark?"#9ca3af":"#1a202c") : (dark?"#374151":"#e2e8f0")}`,
                outline: h.isCurrent && dark ? "2px solid #e2e8f0" : "none",
                borderRadius: 12, padding: "10px 6px",
                textAlign: "center",
                boxShadow: h.isCurrent ? "0 4px 12px rgba(0,0,0,0.15)" : "none",
              }}>
                {/* Time label */}
                <div style={{
                  fontSize: 10, fontWeight: 600,
                  color: h.isCurrent ? (dark?"#4b5563":"#a0aec0") : (dark?"#6b7280":"#718096"),
                  marginBottom: 6,
                }}>
                  {h.isCurrent ? "NOW" : h.label}
                </div>

                {/* Traffic icon based on status */}
                <div style={{ fontSize: 18, marginBottom: 4 }}>
                  {h.status === "Heavy"    ? "🔴" :
                   h.status === "Moderate" ? "🟠" : "🟢"}
                </div>

                {/* Congestion % */}
                <div style={{
                  fontSize: 13, fontWeight: 700,
                  color: h.isCurrent ? (dark?"#111827":"#fff") : getColorP(h.pct),
                  marginBottom: 4,
                }}>
                  {h.pct}%
                </div>

                {/* Mini bar */}
                <div style={{
                  height: 3, borderRadius: 99,
                  background: h.isCurrent ? (dark?"#cbd5e0":"#4a5568") : (dark?"#374151":"#e2e8f0"),
                  overflow: "hidden",
                }}>
                  <div style={{
                    height: "100%", borderRadius: 99,
                    width: `${h.pct}%`,
                    background: h.isCurrent ? (dark?"#1a202c":"#fff") : getColorP(h.pct),
                  }} />
                </div>

                {/* Status label */}
                <div style={{
                  fontSize: 9, marginTop: 4, fontWeight: 600,
                  color: h.isCurrent ? (dark?"#6b7280":"#a0aec0") : getColorP(h.pct),
                }}>
                  {h.status}
                </div>
              </div>
            ))}
          </div>

          {/* Bar chart version */}
          <p style={{ ...styles.chartTitle, color: dark?"#9ca3af":"#718096", marginTop: 24 }}>
            Congestion forecast chart — next 24 hours
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={forecast} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={dark?"#2d3748":"#f0f0f0"}/>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: dark?"#9ca3af":"#718096" }}
                angle={-35}
                textAnchor="end"
                interval={1}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: dark?"#9ca3af":"#718096" }}
                tickFormatter={v => `${v}%`}
              />
              <Tooltip
                cursor={{ fill: dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.04)" }}
                contentStyle={{ background:dark?"#1e2535":"#fff", border:`1px solid ${dark?"#374151":"#e2e8f0"}`, borderRadius:8, boxShadow:dark?"0 4px 16px rgba(0,0,0,0.4)":"none" }}
                labelStyle={{ color:dark?"#f1f5f9":"#1a202c", fontWeight:600, fontSize:13 }}
                itemStyle={{ color:dark?"#a0aec0":"#718096", fontSize:12 }}
                formatter={(v) => [`${v}%`, "Predicted Congestion"]}
              />
              <Bar dataKey="pct" name="Congestion" radius={[3, 3, 0, 0]}>
                {forecast.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.isCurrent ? (dark?"#e2e8f0":"#1a202c") : getColorP(entry.pct)}
                    opacity={entry.isCurrent ? 1 : 0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div style={{ display: "flex", gap: 12, marginTop: 12, fontSize: 11, color: dark?"#6b7280":"#718096", flexWrap: "wrap", alignItems:"center" }}>
            <span style={{ display:"flex", alignItems:"center", gap:4, whiteSpace:"nowrap" }}>
              <span style={{ width:12, height:12, background:dark?"#e2e8f0":"#1a202c", display:"inline-block", borderRadius:2, border:dark?"1px solid #9ca3af":"none" }}/>
              <span style={{ color: dark?"#e2e8f0":"#1a202c" }}>Current hour</span>
            </span>
            <span style={{ whiteSpace:"nowrap" }}>🔴 Heavy (&gt;65%)</span>
            <span style={{ whiteSpace:"nowrap" }}>🟠 Moderate (35–65%)</span>
            <span style={{ whiteSpace:"nowrap" }}>🟢 Clear (&lt;35%)</span>
            <span style={{ marginLeft: "auto", color: dark?"#4b5563":"#a0aec0", fontSize:10, whiteSpace:"nowrap" }}>
              Based on Pune traffic patterns + zone history
            </span>
          </div>
        </>
      )}
    </div>
  );
};

// ─── History Tab ──────────────────────────────────────────────────────────────
const HistoryTab = () => {
  const { isDark: dark } = useTheme();
  const [snapshots, setSnapshots] = useState([]);
  const [loading,   setLoading]   = useState(true);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/history?range=24h`, { timeout: 8000 });
      if (res.data?.snapshots) {
        const data = res.data.snapshots.map(s => ({
          time:       new Date(s.capturedAt).toLocaleString([], { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit", hour12:true }),
          avgCong:    Math.round(s.avgCongestion * 100),
          vehicles:   s.totalVehicles,
          heavyZones: s.heavyZones,
          clearZones: s.clearZones,
        }));
        setSnapshots(data);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
        <p style={{ ...styles.chartTitle, margin:0 }}>Historical traffic (Last 24 Hours) — 15-min snapshots stored automatically</p>
      </div>

      {loading ? (
        <div style={{ textAlign:"center", color:"#a0aec0", padding:40, fontSize:13 }}>⏳ Loading history…</div>
      ) : snapshots.length === 0 ? (
        <div style={{ textAlign:"center", padding:40 }}>
          <div style={{ fontSize:32, marginBottom:12 }}>📭</div>
          <div style={{ fontSize:14, fontWeight:600, color:dark?"#f1f5f9":"#1a202c", marginBottom:6 }}>No history yet</div>
          <div style={{ fontSize:12, color:"#a0aec0" }}>
            The backend collects a snapshot every 15 minutes automatically.<br/>
            Come back after the first snapshot is collected!
          </div>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap" }}>
            {[
              { label:"Snapshots", value: snapshots.length,  color:"#6366f1" },
              { label:"Avg Cong",  value: `${Math.round(snapshots.reduce((s,x)=>s+x.avgCong,0)/snapshots.length)}%`, color:"#e53e3e" },
              { label:"Peak Cong", value: `${Math.max(...snapshots.map(x=>x.avgCong))}%`, color:"#ed8936" },
              { label:"Min Cong",  value: `${Math.min(...snapshots.map(x=>x.avgCong))}%`, color:"#38a169" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ flex:1, minWidth:80, background:dark?"#141824":"#f7fafc", border:`1px solid ${dark?"#2d3748":"#e2e8f0"}`, borderRadius:10, padding:"10px 14px" }}>
                <div style={{ fontSize:18, fontWeight:700, color, letterSpacing:"-.03em" }}>{value}</div>
                <div style={{ fontSize:10, color:dark?"#6b7280":"#a0aec0", textTransform:"uppercase", letterSpacing:".04em" }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Avg Congestion over time */}
          <p style={{ ...styles.chartTitle, color:dark?"#9ca3af":"#718096" }}>Average congestion over time (%)</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={snapshots} margin={{ top:5, right:10, left:0, bottom:30 }}>
              <defs>
                <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={dark?"#2d3748":"#f0f0f0"}/>
              <XAxis dataKey="time" tick={{ fontSize:9, fill:dark?"#9ca3af":"#718096" }} angle={-30} textAnchor="end" interval={Math.max(0,Math.floor(snapshots.length/8)-1)}/>
              <YAxis domain={[0,100]} tick={{ fontSize:10, fill:dark?"#9ca3af":"#718096" }} tickFormatter={v=>`${v}%`}/>
              <Tooltip
                contentStyle={{ background:dark?"#1e2535":"#fff", border:`1px solid ${dark?"#374151":"#e2e8f0"}`, borderRadius:8 }}
                labelStyle={{ color:dark?"#f1f5f9":"#1a202c", fontWeight:600, fontSize:11 }}
                formatter={v=>[`${v}%`,"Avg Congestion"]}
              />
              <Area type="monotone" dataKey="avgCong" stroke="#6366f1" strokeWidth={2} fill="url(#histGrad)" dot={false}/>
            </AreaChart>
          </ResponsiveContainer>

          {/* Total Vehicles */}
          <p style={{ ...styles.chartTitle, color:dark?"#9ca3af":"#718096", marginTop:20 }}>Total vehicles across all zones</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={snapshots} margin={{ top:5, right:10, left:0, bottom:30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={dark?"#2d3748":"#f0f0f0"}/>
              <XAxis dataKey="time" tick={{ fontSize:9, fill:dark?"#9ca3af":"#718096" }} angle={-30} textAnchor="end" interval={Math.max(0,Math.floor(snapshots.length/8)-1)}/>
              <YAxis tick={{ fontSize:10, fill:dark?"#9ca3af":"#718096" }}/>
              <Tooltip
                contentStyle={{ background:dark?"#1e2535":"#fff", border:`1px solid ${dark?"#374151":"#e2e8f0"}`, borderRadius:8 }}
                labelStyle={{ color:dark?"#f1f5f9":"#1a202c", fontWeight:600, fontSize:11 }}
                itemStyle={{ color:dark?"#a0aec0":"#718096", fontSize:11 }}
                wrapperStyle={{ outline:"none" }}
              />
              <Line type="monotone" dataKey="vehicles" name="Vehicles" stroke="#0ea5e9" strokeWidth={2} dot={false}/>
            </LineChart>
          </ResponsiveContainer>

          {/* Heavy vs Clear zones */}
          <p style={{ ...styles.chartTitle, color:dark?"#9ca3af":"#718096", marginTop:20 }}>
            Heavy vs Clear zones over time
          </p>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={snapshots} margin={{ top:5, right:10, left:0, bottom:30 }} stackOffset="none">
              <defs>
                <linearGradient id="heavyGradTC" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#e53e3e" stopOpacity={0.7}/>
                  <stop offset="95%" stopColor="#e53e3e" stopOpacity={0.2}/>
                </linearGradient>
                <linearGradient id="clearGradTC" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#38a169" stopOpacity={0.6}/>
                  <stop offset="95%" stopColor="#38a169" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={dark?"#2d3748":"#f0f0f0"}/>
              <XAxis dataKey="time" tick={{ fontSize:9, fill:dark?"#9ca3af":"#718096" }} angle={-30} textAnchor="end" interval={Math.max(0,Math.floor(snapshots.length/8)-1)}/>
              <YAxis domain={[0, 12]} tick={{ fontSize:10, fill:dark?"#9ca3af":"#718096" }}/>
              <Tooltip
                contentStyle={{ background:dark?"#1e2535":"#fff", border:`1px solid ${dark?"#374151":"#e2e8f0"}`, borderRadius:8 }}
                labelStyle={{ color:dark?"#f1f5f9":"#1a202c", fontWeight:600, fontSize:11 }}
                itemStyle={{ color:dark?"#a0aec0":"#718096", fontSize:11 }}
                wrapperStyle={{ outline:"none" }}
              />
              {/* Clear first (bottom), Heavy on top */}
              <Area type="monotone" dataKey="clearZones" name="Clear" stackId="zones" stroke="#38a169" fill="url(#clearGradTC)" strokeWidth={1.5}/>
              <Area type="monotone" dataKey="heavyZones" name="Heavy" stackId="zones" stroke="#e53e3e" fill="url(#heavyGradTC)" strokeWidth={1.5}/>
            </AreaChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
};

// ─── Prediction Table Tab ─────────────────────────────────────────────────────
const PredictionTab = ({ trafficData }) => {
  const { isDark: dark } = useTheme();
  const [predictions, setPredictions] = useState({});
  const [loading,     setLoading]     = useState(true);
  const [lastFetched, setLastFetched] = useState(null);
  const [nextTime,    setNextTime]    = useState("");
  const fetchedRef = useRef(false);

  const fetchAll = async (zones) => {
    if (!zones.length) return;
    setLoading(true);
    // Compute next 15-min mark for display
    const now  = new Date();
    const next = new Date(now.getTime() + 15 * 60000);
    setNextTime(next.toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit", hour12:true }));
    const results = {};
    await Promise.all(
      zones.map(async (zone) => {
        try {
          const res = await axios.get(
            `${API_BASE}/predict/${encodeURIComponent(zone.name)}`,
            { timeout: 8000 }
          );
          if (res.data?.predicted !== undefined) {
            results[zone.name] = {
              predicted:  parseFloat(res.data.predicted),
              current:    parseFloat(res.data.current || 0),
              confidence: res.data.confidence || "low",
              dataPoints: res.data.dataPoints || 0,
            };
          }
        } catch { results[zone.name] = null; }
      })
    );
    setPredictions(results);
    setLastFetched(new Date().toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit", hour12:true }));
    setLoading(false);
  };

  useEffect(() => {
    if (!trafficData.length || fetchedRef.current) return;
    fetchedRef.current = true;
    fetchAll(trafficData);
  }, [trafficData]); // eslint-disable-line

  const rows = trafficData
    .map(zone => ({
      name:       zone.name,
      current:    zone.congestion,                    // already in %
      predicted:  predictions[zone.name]
                    ? Math.round(predictions[zone.name].predicted * 100)
                    : null,
      confidence: predictions[zone.name]?.confidence || "low",
      dataPoints: predictions[zone.name]?.dataPoints || 0,
    }))
    .sort((a, b) => (b.predicted ?? 0) - (a.predicted ?? 0));

  // Scale bars to max value so they're always visible (minimum scale: 30%)
  const maxVal = Math.max(30, ...rows.map(r => Math.max(r.current, r.predicted ?? 0)));

  const getTrend = (cur, pred) => {
    if (pred === null) return { label:"—", color:"#a0aec0", bg:"#a0aec018" };
    const diff = pred - cur;
    if (diff > 5)  return { label:`▲ +${diff}%`,  color:"#e53e3e", bg:"#e53e3e18" };
    if (diff < -5) return { label:`▼ ${diff}%`,   color:"#38a169", bg:"#38a16918" };
    return               { label:"→ Stable",      color:"#d97706", bg:"#d9770618" };
  };

  const confColor = (c) =>
    c === "high" ? "#38a169" : c === "medium" ? "#ed8936" : "#a0aec0";

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:12 }}>
        <div>
          <p style={{ ...styles.chartTitle, margin:"0 0 3px" }}>
            AI Prediction — Next 15 Minutes
          </p>
          {nextTime && (
            <span style={{ fontSize:11, color: dark?"#6b7280":"#9ca3af" }}>
              🕐 Predicted congestion at <strong style={{ color: dark?"#a5b4fc":"#6366f1" }}>{nextTime} IST</strong>
              &nbsp;·&nbsp;based on history + time-of-day pattern
            </span>
          )}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
          {lastFetched && (
            <span style={{ fontSize:10, color:dark?"#6b7280":"#9ca3af" }}>Updated {lastFetched}</span>
          )}
          <button
            onClick={() => { fetchAll(trafficData); }}
            disabled={loading}
            style={{ fontSize:11, padding:"4px 10px", borderRadius:7, border:`1px solid ${dark?"#374151":"#e2e8f0"}`, background:"transparent", color:dark?"#9ca3af":"#718096", cursor:"pointer", opacity:loading?0.5:1 }}
          >
            {loading ? "⏳" : "🔄 Refresh"}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding:"30px 0", textAlign:"center", color:"#a0aec0", fontSize:13 }}>
          ⏳ Fetching AI predictions for all 12 zones…
        </div>
      ) : (
        <>
          {/* ── Column headers ── */}
          <div style={{ ...predStyles.tableHeader, background:dark?"#1e2535":"#f7fafc", border:`1px solid ${dark?"#2d3748":"#e2e8f0"}`, color:dark?"#6b7280":"#9ca3af" }}>
            <span style={{ ...predStyles.col, flex:2 }}>ZONE</span>
            <span style={{ ...predStyles.col, flex:"0 0 56px", textAlign:"center" }}>NOW</span>
            <span style={{ ...predStyles.col, flex:"0 0 90px", textAlign:"center", fontSize:10 }}>AT {nextTime||"15 min"}</span>
            <span style={{ ...predStyles.col, flex:1, textAlign:"center" }}>TREND</span>
            <span style={{ ...predStyles.col, flex:1, textAlign:"center" }}>CONFIDENCE</span>
            <span style={{ ...predStyles.col, flex:3 }}>NOW vs PREDICTED</span>
          </div>

          {rows.map((row, i) => {
            const trend   = getTrend(row.current, row.predicted);
            const curPct  = Math.round((row.current  / maxVal) * 100);
            const predPct = row.predicted !== null ? Math.round((row.predicted / maxVal) * 100) : 0;
            return (
              <div key={row.name} style={{ ...predStyles.tableRow, background: i%2===0?(dark?"#1e2535":"#fff"):(dark?"#141824":"#f9fafb"), border:`1px solid ${dark?"#2d3748":"#e2e8f0"}` }}>

                {/* Zone name */}
                <span style={{ ...predStyles.col, flex:2, fontWeight:600, color:dark?"#f1f5f9":"#1a202c", fontSize:13 }}>
                  {row.name}
                </span>

                {/* Now */}
                <span style={{ ...predStyles.col, flex:"0 0 56px", textAlign:"center" }}>
                  <span style={{ fontSize:13, fontWeight:700, color:getColor(row.current/100) }}>{row.current}%</span>
                </span>

                {/* Predicted */}
                <span style={{ ...predStyles.col, flex:"0 0 90px", textAlign:"center" }}>
                  {row.predicted !== null
                    ? <span style={{ fontSize:13, fontWeight:700, color:getColor(row.predicted/100) }}>{row.predicted}%</span>
                    : <span style={{ fontSize:11, color:"#a0aec0" }}>N/A</span>}
                </span>

                {/* Trend badge */}
                <span style={{ ...predStyles.col, flex:1, textAlign:"center" }}>
                  <span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:99, background:trend.bg, color:trend.color, whiteSpace:"nowrap" }}>
                    {trend.label}
                  </span>
                </span>

                {/* Confidence */}
                <span style={{ ...predStyles.col, flex:1, textAlign:"center" }}>
                  <span style={{ fontSize:10, fontWeight:600, textTransform:"capitalize", color:confColor(row.confidence), background:confColor(row.confidence)+"18", border:`1px solid ${confColor(row.confidence)}44`, borderRadius:99, padding:"2px 8px" }}>
                    {row.confidence}
                    {row.dataPoints > 0 && <span style={{ opacity:0.65 }}> ({row.dataPoints})</span>}
                  </span>
                </span>

                {/* Dual bar — scaled to maxVal */}
                <span style={{ ...predStyles.col, flex:3 }}>
                  <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                    {/* Current bar */}
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ fontSize:9, color:dark?"#6b7280":"#9ca3af", width:28, textAlign:"right", flexShrink:0 }}>Now</span>
                      <div style={{ flex:1, height:7, background:dark?"#2d3748":"#edf2f7", borderRadius:99, overflow:"hidden" }}>
                        <div style={{ width:`${Math.max(curPct, 2)}%`, height:"100%", background:getColor(row.current/100), borderRadius:99, transition:"width .4s ease" }}/>
                      </div>
                      <span style={{ fontSize:9, color:dark?"#6b7280":"#9ca3af", width:22, flexShrink:0 }}>{row.current}%</span>
                    </div>
                    {/* Predicted bar */}
                    {row.predicted !== null && (
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ fontSize:9, color:dark?"#6b7280":"#9ca3af", width:28, textAlign:"right", flexShrink:0 }}>Next</span>
                        <div style={{ flex:1, height:7, background:dark?"#2d3748":"#edf2f7", borderRadius:99, overflow:"hidden" }}>
                          <div style={{ width:`${Math.max(predPct, 2)}%`, height:"100%", background:getColor(row.predicted/100), borderRadius:99, opacity:0.75, transition:"width .4s ease" }}/>
                        </div>
                        <span style={{ fontSize:9, color:dark?"#6b7280":"#9ca3af", width:22, flexShrink:0 }}>{row.predicted}%</span>
                      </div>
                    )}
                  </div>
                </span>

              </div>
            );
          })}

          {/* Legend */}
          <div style={{ marginTop:12, display:"flex", gap:16, fontSize:11, color:dark?"#4b5563":"#9ca3af", flexWrap:"wrap" }}>
            <span>▲ worsening &nbsp; ▼ improving &nbsp; → stable (±5%)</span>
            <span style={{ marginLeft:"auto" }}>
              Bars scaled to max zone value ({maxVal}%) for visibility
              &nbsp;·&nbsp;
              <span style={{ color:"#38a169" }}>●</span> High (5+ snapshots) &nbsp;
              <span style={{ color:"#ed8936" }}>●</span> Medium (2+) &nbsp;
              <span style={{ color:"#a0aec0" }}>●</span> Low
            </span>
          </div>
        </>
      )}
    </div>
  );
};



// ─── Main Component ───────────────────────────────────────────────────────────
const TrafficCharts = ({ trafficData: externalData = [], isRefreshing = false, isDark = false }) => {
  const { theme, isDark: themeDark } = useTheme();
  const dark = isDark || themeDark; // use prop or context
  const [historyData, setHistoryData] = useState([]);
  const [activeTab,   setActiveTab]   = useState("congestion");
  const [lastUpdated, setLastUpdated] = useState(null);

  // Process shared data from App.js — no independent fetching needed
  const trafficData = [...externalData]
    .sort((a, b) => b.congestion - a.congestion)
    .map(item => ({
      name:       item.location,
      congestion: Math.round((item.congestion || 0) * 100),
      vehicles:   item.vehicles || 0,
      status:     item.congestion > 0.65 ? "Heavy" : item.congestion > 0.35 ? "Moderate" : "Clear",
    }));

  const loading = externalData.length === 0;

  // Build history from shared data changes
  const seedFetched = useRef(false);

  useEffect(() => {
    // 1. Initial Seed Fetch (only runs once)
    if (!seedFetched.current) {
      seedFetched.current = true;
      axios.get(`${API_BASE}/history?range=24h`, { timeout: 8000 })
        .then(res => {
          if (res.data?.snapshots) {
            // Take the last 60 snapshots (15 hours of history)
            const seed = res.data.snapshots.slice(-60).map(s => ({
              time: new Date(s.capturedAt).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }),
              avgCong: Math.round((s.avgCongestion || 0) * 100),
              vehicles: s.totalVehicles || 0
            }));
            
            // Merge seed with any live points that might have been collected already
            setHistoryData(prev => {
              const livePoints = prev.filter(p => p.time && p.time.includes(":")); // live points have seconds
              return [...seed, ...livePoints].slice(-120);
            });
          }
        })
        .catch(() => {});
    }

    // 2. Append Live Data
    if (isRefreshing || externalData.length === 0) return;
    
    const now = new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", second:"2-digit" });
    setLastUpdated(now);
    
    const avg = Math.round(externalData.reduce((s,z) => s + (z.congestion || 0), 0) / externalData.length * 100);
    const totalVehicles = externalData.reduce((s,z) => s + (z.vehicles || 0), 0);

    setHistoryData(prev => {
      if (prev.length > 0 && prev[prev.length - 1].time === now) return prev;
      return [...prev, { time: now, avgCong: avg, vehicles: totalVehicles }].slice(-120);
    });
  }, [externalData, isRefreshing]); // eslint-disable-line

  if (loading) return (
    <div style={styles.loadingBox}><p style={styles.loadingText}>Loading chart data…</p></div>
  );

  return (
    <div style={{ ...styles.wrapper, position: "relative", background: theme.surface, color: theme.text }}>

      {/* Loading overlay when map is refreshing */}
      {isRefreshing && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 100,
          background: "rgba(255,255,255,0.88)", backdropFilter: "blur(2px)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 12,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            border: "3px solid #e2e8f0",
            borderTop: "3px solid #e53e3e",
            animation: "spin 0.8s linear infinite",
          }}/>
          <div style={{ fontSize: 13, color: "#718096", fontWeight: 600 }}>Fetching fresh traffic data…</div>
          <div style={{ fontSize: 11, color: "#a0aec0" }}>Charts will update automatically</div>
        </div>
      )}

      {/* Header */}
      <div style={{ ...styles.header, background:theme.surface, borderBottom:`1px solid ${theme.border}` }}>
        <div style={styles.headerLeft}>
          <span style={{ ...styles.headerTitle, color:theme.text }}>Traffic Analytics</span>
          <span style={{ ...styles.headerSub, color:theme.textMuted }}>Updated: {lastUpdated} · {trafficData.length} zones</span>
        </div>
        <div style={styles.pills}>
          <div style={{ ...styles.pill, background:dark?"#141824":"#f7fafc", border:`1px solid ${dark?"#2d3748":"#e2e8f0"}` }}>
            <span style={{ ...styles.pillLabel, color:dark?"#6b7280":"#a0aec0" }}>Avg Congestion</span>
            <span style={{ ...styles.pillValue, color:dark?"#f1f5f9":"#1a202c" }}>
              {trafficData.length ? Math.round(trafficData.reduce((s,z) => s + z.congestion, 0) / trafficData.length) : 0}%
            </span>
          </div>
          <div style={{ ...styles.pill, background:dark?"#141824":"#f7fafc", border:`1px solid ${dark?"#2d3748":"#e2e8f0"}` }}>
            <span style={{ ...styles.pillLabel, color:dark?"#6b7280":"#a0aec0" }}>Total Vehicles</span>
            <span style={{ ...styles.pillValue, color:dark?"#f1f5f9":"#1a202c" }}>{trafficData.reduce((s,z) => s + z.vehicles, 0).toLocaleString()}</span>
          </div>
          <div style={{ ...styles.pill, background:dark?"#141824":"#f7fafc", border:`1px solid ${dark?"#2d3748":"#e2e8f0"}` }}>
            <span style={{ ...styles.pillLabel, color:dark?"#6b7280":"#a0aec0" }}>Heavy Zones</span>
            <span style={{ ...styles.pillValue, color: "#e53e3e" }}>{trafficData.filter(z => z.congestion > 65).length}</span>
          </div>
          <div style={{ ...styles.pill, background:dark?"#141824":"#f7fafc", border:`1px solid ${dark?"#2d3748":"#e2e8f0"}` }}>
            <span style={{ ...styles.pillLabel, color:dark?"#6b7280":"#a0aec0" }}>Clear Zones</span>
            <span style={{ ...styles.pillValue, color: "#38a169" }}>{trafficData.filter(z => z.congestion <= 35).length}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ ...styles.tabs, background:theme.surface, borderBottom:`1px solid ${theme.border}` }}>
        {[
          { key: "congestion",  label: "🔴 Congestion"   },
          { key: "vehicles",    label: "🚗 Vehicles"      },
          { key: "history",     label: "📈 Live Trend"    },
          { key: "predictions", label: "🤖 Predictions"   },
          { key: "hourly",      label: "⏱ Hourly Forecast"},
          { key: "historical",  label: "📅 History"       },
        ].map(tab => (
          <button
            key={tab.key}
            style={{ ...styles.tab, color: activeTab === tab.key ? "#e53e3e" : (dark?"#9ca3af":"#718096"), ...(activeTab === tab.key ? styles.tabActive : {}) }}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ ...styles.chartArea, background:theme.bg }}>

        {activeTab === "congestion" && (
          <div style={styles.chartWrap}>
            <p style={styles.chartTitle}>Congestion % per zone — sorted highest to lowest</p>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={trafficData} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={dark?"#2d3748":"#f0f0f0"}/>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: dark?"#9ca3af":"#718096" }} angle={-35} textAnchor="end" interval={0}/>
                <YAxis tick={{ fontSize: 11, fill: dark?"#9ca3af":"#718096" }} domain={[0, 100]} tickFormatter={v => `${v}%`}/>
                <Tooltip content={<CustomTooltip/>} cursor={{ fill: dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.04)" }}/>
                <Bar dataKey="congestion" name="Congestion" radius={[4, 4, 0, 0]}>
                  {trafficData.map((e, i) => <Cell key={i} fill={getColor(e.congestion / 100)}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={styles.zoneTable}>
              {trafficData.map((z, i) => (
                <div key={i} style={styles.zoneRow}>
                  <span style={styles.zoneRank}>#{i+1}</span>
                  <span style={{ ...styles.zoneName, color:dark?"#e2e8f0":"#2d3748" }}>{z.name}</span>
                  <div style={styles.zoneBarWrap}>
                    <div style={{ ...styles.zoneBarFill, width: `${z.congestion}%`, background: getColor(z.congestion / 100) }}/>
                  </div>
                  <span style={{ ...styles.zoneVal, color: getColor(z.congestion / 100) }}>{z.congestion}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "vehicles" && (
          <div style={styles.chartWrap}>
            <p style={styles.chartTitle}>Vehicle count per zone</p>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={trafficData} margin={{ top: 10, right: 20, left: 10, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={dark?"#2d3748":"#f0f0f0"}/>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: dark?"#9ca3af":"#718096" }} angle={-35} textAnchor="end" interval={0}/>
                <YAxis tick={{ fontSize: 11, fill: dark?"#9ca3af":"#718096" }}/>
                <Tooltip content={<CustomTooltip/>} cursor={{ fill: dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.04)" }}/>
                <Bar dataKey="vehicles" name="Vehicles" radius={[4, 4, 0, 0]}>
                  {trafficData.map((e, i) => <Cell key={i} fill={getColor(e.congestion / 100)}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {activeTab === "history" && (
          <div style={styles.chartWrap}>
            <p style={styles.chartTitle}>
              Live Trend: Average congestion over time (shows up to 120 points)
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={historyData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="congGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#e53e3e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#e53e3e" stopOpacity={0.02}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={dark?"#2d3748":"#f0f0f0"}/>
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: dark?"#9ca3af":"#718096" }}/>
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: dark?"#9ca3af":"#718096" }} tickFormatter={v => `${v}%`}/>
                <Tooltip content={<CustomTooltip/>} cursor={{ fill: dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.04)" }}/>
                <Area type="monotone" dataKey="avgCong" name="Avg Congestion" stroke="#e53e3e" strokeWidth={2} fill="url(#congGradient)" dot={{ r: 3, fill: "#e53e3e" }} activeDot={{ r: 5 }}/>
              </AreaChart>
            </ResponsiveContainer>
            <p style={{ ...styles.chartTitle, color: dark?"#9ca3af":"#718096", marginTop: 20 }}>Total vehicles across all zones</p>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={historyData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={dark?"#2d3748":"#f0f0f0"}/>
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: dark?"#9ca3af":"#718096" }}/>
                <YAxis tick={{ fontSize: 11, fill: dark?"#9ca3af":"#718096" }}/>
                <Tooltip content={<CustomTooltip/>} cursor={{ fill: dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.04)" }}/>
                <Line type="monotone" dataKey="vehicles" name="Vehicles" stroke="#185FA5" strokeWidth={2} dot={{ r: 3, fill: "#185FA5" }} activeDot={{ r: 5 }}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {activeTab === "predictions" && <PredictionTab trafficData={trafficData} />}
        {activeTab === "hourly"      && <HourlyForecastTab zones={trafficData} />}
        {activeTab === "historical"  && <HistoryTab />}

      </div>
    </div>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  wrapper:      { borderTop: "1px solid #e2e8f0", fontFamily: "Inter, system-ui, sans-serif" },
  loadingBox:   { display: "flex", alignItems: "center", justifyContent: "center", padding: 40 },
  loadingText:  { fontSize: 14, color: "#718096" },
  header:       { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #e2e8f0", flexWrap: "wrap", gap: 12 },
  headerLeft:   { display: "flex", flexDirection: "column", gap: 2 },
  headerTitle:  { fontSize: 15, fontWeight: 600, letterSpacing: "-.2px" },
  headerSub:    { fontSize: 12, color: "#a0aec0" },
  pills:        { display: "flex", gap: 10, flexWrap: "wrap" },
  pill:         { borderRadius: 10, padding: "8px 14px", display: "flex", flexDirection: "column", gap: 2, minWidth: 90 },
  pillLabel:    { fontSize: 10, textTransform: "uppercase", letterSpacing: ".04em" },
  pillValue:    { fontSize: 18, fontWeight: 600, letterSpacing: "-.3px" },
  tabs:         { display: "flex", gap: 0, borderBottom: "1px solid #e2e8f0", padding: "0 20px", overflowX: "auto" },
  tab:          { padding: "10px 16px", fontSize: 12, fontWeight: 500, background: "none", border: "none", borderBottom: "2px solid transparent", cursor: "pointer", fontFamily: "inherit", transition: "all .15s", whiteSpace: "nowrap" },
  tabActive:    { borderBottom: "2px solid #e53e3e" },
  chartArea:    { padding: "16px 20px 20px" },
  chartWrap:    {},
  chartTitle:   { fontSize: 12, color: "#718096", marginBottom: 12 },
  zoneTable:    { marginTop: 16, display: "flex", flexDirection: "column", gap: 6 },
  zoneRow:      { display: "flex", alignItems: "center", gap: 10 },
  zoneRank:     { fontSize: 11, color: "#a0aec0", width: 24, textAlign: "right", flexShrink: 0 },
  zoneName:     { fontSize: 12, color: "#4a5568", width: 120, flexShrink: 0 },
  zoneBarWrap:  { flex: 1, height: 6, background: "#f0f0f0", borderRadius: 99, overflow: "hidden" },
  zoneBarFill:  { height: "100%", borderRadius: 99, transition: "width .4s ease" },
  zoneVal:      { fontSize: 12, fontWeight: 600, width: 40, textAlign: "right", flexShrink: 0, fontVariantNumeric: "tabular-nums" },
  tooltip:      { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px", boxShadow: "0 4px 12px rgba(0,0,0,.08)", fontFamily: "Inter, system-ui" },
  tooltipTitle: { fontSize: 13, fontWeight: 600, color: "#1a202c", marginBottom: 6 },
  tooltipRow:   { fontSize: 12, margin: "2px 0" },
};

const predStyles = {
  tableHeader: { display: "flex", alignItems: "center", padding: "8px 12px", borderRadius: "8px 8px 0 0", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" },
  tableRow:    { display: "flex", alignItems: "center", padding: "10px 12px", borderTop: "none" },
  col:         { display: "flex", alignItems: "center", paddingRight: 8, fontSize: 12 },
};

export default TrafficCharts;
