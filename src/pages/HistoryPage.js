// pages/HistoryPage.js — Full-screen traffic history analytics v2

import React, { useState, useEffect } from "react";
import axios from "axios";
import { API_TRAFFIC } from "../config";
import { useTheme } from "../ThemeContext";
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";


const RANGES = [
  { key:"24h", label:"Last 24 Hours" },
  { key:"7d",  label:"Last 7 Days"   },
  { key:"30d", label:"Last 30 Days"  },
];

const HistoryPage = () => {
  const { isDark, theme } = useTheme();
  const [range,     setRange]     = useState("24h");
  const [snapshots, setSnapshots] = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    setLoading(true);
    axios.get(`${API_TRAFFIC}/history?range=${range}`, { timeout:10000 })
      .then(res => {
        const data = res.data?.data || res.data || [];
        setSnapshots(data.map(s => ({
          // Short time label — just hour:minute, date only when 7d/30d
          time:       new Date(s.capturedAt).toLocaleString("en-IN", {
                        hour:   "2-digit",
                        minute: "2-digit",
                        ...(range !== "24h" ? { day:"numeric", month:"short" } : {}),
                      }),
          congestion: Math.round((s.avgCongestion || 0) * 100),
          vehicles:   s.totalVehicles || 0,
          heavyZones: s.heavyZones   || 0,
          clearZones: s.clearZones   || 0,
        })));
      })
      .catch(() => setSnapshots([]))
      .finally(() => setLoading(false));
  }, [range]);

  const card = {
    background: theme.surface,
    border: `1px solid ${theme.border}`,
    borderRadius: 16,
    padding: "24px 28px",
    marginBottom: 24,
  };

  const tooltipProps = {
    contentStyle: { background: isDark ? "#1e2535" : "#fff", border: `1px solid ${isDark ? "#374151" : "#e2e8f0"}`, borderRadius: 8 },
    labelStyle:   { color: isDark ? "#f1f5f9" : "#1a202c", fontWeight: 600, fontSize: 11 },
    itemStyle:    { color: isDark ? "#a0aec0" : "#718096", fontSize: 11 },
    wrapperStyle: { outline: "none" },
  };

  return (
    <div style={{ height:"100%", overflowY:"auto", background: theme.bg, padding:"28px 32px" }}>

      {/* Header */}
      <div style={{ marginBottom:28 }}>
        <h1 style={{ margin:0, fontSize:24, fontWeight:800, color: isDark?"#f1f5f9":"#1a202c" }}>
          📅 Traffic History
        </h1>
        <p style={{ margin:"6px 0 0", fontSize:13, color: isDark?"#9ca3af":"#718096" }}>
          Historical congestion patterns for Pune — auto-collected every 15 minutes
        </p>
      </div>

      {/* Range Tabs */}
      <div style={{ display:"flex", gap:8, marginBottom:28 }}>
        {RANGES.map(r => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            style={{
              padding:"8px 20px", borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer",
              border: `1px solid ${range===r.key ? "#4299e1" : (isDark?"#374151":"#e2e8f0")}`,
              background: range===r.key ? "#4299e1" : "transparent",
              color: range===r.key ? "#fff" : (isDark?"#9ca3af":"#718096"),
              transition:"all .15s",
            }}
          >{r.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:"center", padding:80, color: isDark?"#4a5568":"#cbd5e0", fontSize:32 }}>⏳</div>
      ) : snapshots.length === 0 ? (
        <div style={{ ...card, textAlign:"center", padding:60 }}>
          <div style={{ fontSize:48, marginBottom:16 }}>📭</div>
          <div style={{ fontSize:18, fontWeight:700, color:isDark?"#f1f5f9":"#1a202c", marginBottom:8 }}>No history yet</div>
          <div style={{ fontSize:13, color:isDark?"#9ca3af":"#718096" }}>
            The system collects a snapshot every 15 minutes.<br/>
            Check back soon — data will appear here automatically.
          </div>
        </div>
      ) : (
        <>
          {/* Stats Summary */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:24 }}>
            {[
              { label:"Avg Congestion", value:`${Math.round(snapshots.reduce((s,x)=>s+x.congestion,0)/snapshots.length)}%`, color:"#e53e3e" },
              { label:"Avg Vehicles",   value:Math.round(snapshots.reduce((s,x)=>s+x.vehicles,0)/snapshots.length).toLocaleString(), color:"#0ea5e9" },
              { label:"Snapshots",      value:snapshots.length, color:"#8b5cf6" },
              { label:"Peak Congestion",value:`${Math.max(...snapshots.map(s=>s.congestion))}%`, color:"#f59e0b" },
            ].map(stat => (
              <div key={stat.label} style={{ ...card, marginBottom:0, textAlign:"center" }}>
                <div style={{ fontSize:26, fontWeight:800, color:stat.color }}>{stat.value}</div>
                <div style={{ fontSize:11, color:isDark?"#9ca3af":"#718096", marginTop:4 }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Congestion Area Chart */}
          <div style={card}>
            <h2 style={{ margin:"0 0 20px", fontSize:16, fontWeight:700, color:isDark?"#f1f5f9":"#1a202c" }}>
              Average Congestion Over Time
            </h2>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={snapshots} margin={{ top:5, right:20, left:0, bottom:40 }}>
                <defs>
                  <linearGradient id="cgGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#e53e3e" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="#e53e3e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark?"#2d3748":"#f0f0f0"}/>
                <XAxis dataKey="time" tick={{ fontSize:9, fill:isDark?"#9ca3af":"#718096" }} angle={-30} textAnchor="end" interval={Math.max(0, Math.floor(snapshots.length/10)-1)}/>
                <YAxis tick={{ fontSize:10, fill:isDark?"#9ca3af":"#718096" }} domain={[0,100]} tickFormatter={v=>`${v}%`}/>
                <Tooltip {...tooltipProps} formatter={v=>[`${v}%`,"Congestion"]}/>
                <Area type="monotone" dataKey="congestion" name="Congestion %" stroke="#e53e3e" fill="url(#cgGrad)" strokeWidth={2}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Vehicles Line Chart */}
          <div style={card}>
            <h2 style={{ margin:"0 0 20px", fontSize:16, fontWeight:700, color:isDark?"#f1f5f9":"#1a202c" }}>
              Total Vehicles Across All Zones
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={snapshots} margin={{ top:5, right:20, left:0, bottom:40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark?"#2d3748":"#f0f0f0"}/>
                <XAxis dataKey="time" tick={{ fontSize:9, fill:isDark?"#9ca3af":"#718096" }} angle={-30} textAnchor="end" interval={Math.max(0, Math.floor(snapshots.length/10)-1)}/>
                <YAxis tick={{ fontSize:10, fill:isDark?"#9ca3af":"#718096" }}/>
                <Tooltip {...tooltipProps}/>
                <Line type="monotone" dataKey="vehicles" name="Vehicles" stroke="#0ea5e9" strokeWidth={2} dot={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Heavy vs Clear — Stacked Area (works at any data density) */}
          <div style={card}>
            <h2 style={{ margin:"0 0 6px", fontSize:16, fontWeight:700, color:isDark?"#f1f5f9":"#1a202c" }}>
              Heavy vs Clear Zones Over Time
            </h2>
            <p style={{ margin:"0 0 16px", fontSize:12, color:isDark?"#6b7280":"#9ca3af" }}>
              Stacked area — combined always equals 12 zones total
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={snapshots} margin={{ top:5, right:20, left:0, bottom:40 }}
                stackOffset="none">
                <defs>
                  <linearGradient id="heavyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#e53e3e" stopOpacity={0.7}/>
                    <stop offset="95%" stopColor="#e53e3e" stopOpacity={0.2}/>
                  </linearGradient>
                  <linearGradient id="clearGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#38a169" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="#38a169" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark?"#2d3748":"#f0f0f0"}/>
                <XAxis
                  dataKey="time"
                  tick={{ fontSize:9, fill:isDark?"#9ca3af":"#718096" }}
                  angle={-35} textAnchor="end"
                  interval={Math.max(0, Math.floor(snapshots.length / 10) - 1)}
                />
                <YAxis
                  tick={{ fontSize:10, fill:isDark?"#9ca3af":"#718096" }}
                  domain={[0, 12]} ticks={[0,3,6,9,12]}
                  tickFormatter={v => `${v} zones`}
                />
                <Tooltip
                  {...tooltipProps}
                  formatter={(v, name) => [`${v} zones`, name]}
                />
                <Legend wrapperStyle={{ fontSize:12, paddingTop:12 }}/>
                {/* Clear first (bottom), Heavy on top */}
                <Area
                  type="monotone" dataKey="clearZones" name="Clear Zones"
                  stackId="zones"
                  stroke="#38a169" fill="url(#clearGrad)" strokeWidth={1.5}
                />
                <Area
                  type="monotone" dataKey="heavyZones" name="Heavy Zones"
                  stackId="zones"
                  stroke="#e53e3e" fill="url(#heavyGrad)" strokeWidth={1.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
};

export default HistoryPage;
