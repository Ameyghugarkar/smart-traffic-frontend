// pages/HistoryPage.js — Full-screen traffic history analytics v2

import React, { useState, useEffect } from "react";
import axios from "axios";
import { API_TRAFFIC } from "../config";
import { useTheme } from "../ThemeContext";
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

const HistoryPage = () => {
  const { isDark, theme } = useTheme();
  const [viewMode, setViewMode] = useState("day");
  
  // Format today's date for inputs
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const thisMonthStr = today.toISOString().slice(0, 7);
  
  // Quick hack for ISO week
  const getISOWeek = (d) => {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    const week = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    return `${date.getFullYear()}-W${week.toString().padStart(2, '0')}`;
  };
  const thisWeekStr = getISOWeek(today);

  const [dateVal, setDateVal]   = useState(todayStr);
  const [weekVal, setWeekVal]   = useState(thisWeekStr);
  const [monthVal, setMonthVal] = useState(thisMonthStr);

  const toLocalISO = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);
  
  const [customStart, setCustomStart] = useState(toLocalISO(lastWeek));
  const [customEnd,   setCustomEnd]   = useState(toLocalISO(today));

  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(false);

  // Table state
  const [tableFilter, setTableFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [tableFilter]);

  const filteredSnapshots = snapshots.filter(s => 
    s.fullTime.toLowerCase().includes(tableFilter.toLowerCase()) || 
    s.congestion.toString().includes(tableFilter)
  );
  const totalPages = Math.ceil(filteredSnapshots.length / itemsPerPage);
  const paginatedSnapshots = filteredSnapshots.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    let start, end;
    if (viewMode === "day") {
      if (!dateVal) return;
      const d = new Date(dateVal);
      start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0).toISOString();
      end   = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).toISOString();
    } else if (viewMode === "month") {
      if (!monthVal) return;
      const [y, m] = monthVal.split('-');
      start = new Date(y, m - 1, 1).toISOString();
      end   = new Date(y, m, 0, 23, 59, 59).toISOString();
    } else if (viewMode === "week") {
      if (!weekVal) return;
      const [year, week] = weekVal.split('-W');
      const simple = new Date(year, 0, 1 + (week - 1) * 7);
      const dow = simple.getDay();
      const ISOweekStart = simple;
      if (dow <= 4)
          ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
      else
          ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
      start = ISOweekStart.toISOString();
      const e = new Date(ISOweekStart);
      e.setDate(e.getDate() + 6);
      e.setHours(23, 59, 59);
      end = e.toISOString();
    } else if (viewMode === "custom") {
      if (!customStart || !customEnd) return;
      start = new Date(customStart).toISOString();
      end   = new Date(customEnd).toISOString();
    } else if (viewMode === "summary") {
      // Fetch 30 days of data for the summary table
      const d = new Date();
      end = d.toISOString();
      d.setDate(d.getDate() - 30);
      start = d.toISOString();
    }

    setLoading(true);
    axios.get(`${API_TRAFFIC}/history?start=${start}&end=${end}`, { timeout:10000 })
      .then(res => {
        const data = res.data?.snapshots || res.data?.data || (Array.isArray(res.data) ? res.data : []);
        setSnapshots(data.map(s => {
          const d = new Date(s.capturedAt);
          return {
            fullTime: d.toLocaleString("en-IN", { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" }),
            tickTime: viewMode === "day" 
                       ? d.toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" })
                       : d.toLocaleDateString("en-IN", { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" }),
            congestion: Math.round((s.avgCongestion || 0) * 100),
            vehicles:   s.totalVehicles || 0,
            heavyZones: s.heavyZones   || 0,
            clearZones: s.clearZones   || 0,
          };
        }));
      })
      .catch(() => setSnapshots([]))
      .finally(() => setLoading(false));
  }, [viewMode, dateVal, weekVal, monthVal, customStart, customEnd]);

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

  const renderTooltipLabel = (label, payload) => {
    return payload && payload.length ? payload[0].payload.fullTime : label;
  };

  return (
    <div style={{ height:"100%", overflowY:"auto", background: theme.bg, padding:"28px 32px" }}>

      {/* Header & Controls */}
      <div style={{ marginBottom:28, display:"flex", justifyContent:"space-between", alignItems:"flex-end", flexWrap:"wrap", gap:16 }}>
        <div>
          <h1 style={{ margin:0, fontSize:24, fontWeight:800, color: isDark?"#f1f5f9":"#1a202c" }}>
            📅 Traffic History
          </h1>
          <p style={{ margin:"6px 0 0", fontSize:13, color: isDark?"#9ca3af":"#718096" }}>
            Historical congestion patterns for Pune
          </p>
        </div>

        <div style={{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
          
          {/* Download Backup Button */}
          <button
            onClick={() => window.open(`${API_TRAFFIC}/backup`, "_blank")}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 16px", borderRadius: 8, border: "none",
              background: "#10b981", color: "#fff",
              fontWeight: 600, fontSize: 13, cursor: "pointer",
              transition: "all .15s",
              boxShadow: "0 2px 4px rgba(16,185,129,0.2)"
            }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export Backup
          </button>

          <div style={{ display:"flex", background:isDark?"#1e2535":"#f7fafc", borderRadius:8, border:`1px solid ${isDark?"#374151":"#e2e8f0"}`, overflow:"hidden" }}>
            {["day", "week", "month", "custom", "summary"].map(m => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                style={{
                  padding:"8px 16px", fontSize:13, fontWeight:600, cursor:"pointer",
                  border: "none",
                  background: viewMode===m ? "#4299e1" : "transparent",
                  color: viewMode===m ? "#fff" : (isDark?"#9ca3af":"#718096"),
                  transition:"all .15s",
                  textTransform:"capitalize"
                }}
              >{m}</button>
            ))}
          </div>

          <div style={{ background:isDark?"#1e2535":"#fff", borderRadius:8, border:`1px solid ${isDark?"#374151":"#e2e8f0"}`, padding:"6px 12px" }}>
            {viewMode === "day" && (
              <input type="date" value={dateVal} onChange={e => setDateVal(e.target.value)} 
                style={{ background:"transparent", border:"none", color:isDark?"#f1f5f9":"#1a202c", outline:"none", fontFamily:"inherit" }} />
            )}
            {viewMode === "week" && (
              <input type="week" value={weekVal} onChange={e => setWeekVal(e.target.value)}
                style={{ background:"transparent", border:"none", color:isDark?"#f1f5f9":"#1a202c", outline:"none", fontFamily:"inherit" }} />
            )}
            {viewMode === "month" && (
              <input type="month" value={monthVal} onChange={e => setMonthVal(e.target.value)}
                style={{ background:"transparent", border:"none", color:isDark?"#f1f5f9":"#1a202c", outline:"none", fontFamily:"inherit" }} />
            )}
            {viewMode === "custom" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="datetime-local" value={customStart} onChange={e => setCustomStart(e.target.value)} style={{ background:"transparent", border:"none", color:isDark?"#f1f5f9":"#1a202c", outline:"none", fontFamily:"inherit" }} />
                <span style={{ color:isDark?"#9ca3af":"#718096", fontSize:13 }}>to</span>
                <input type="datetime-local" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={{ background:"transparent", border:"none", color:isDark?"#f1f5f9":"#1a202c", outline:"none", fontFamily:"inherit" }} />
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign:"center", padding:80, color: isDark?"#4a5568":"#cbd5e0", fontSize:32 }}>⏳</div>
      ) : snapshots.length === 0 ? (
        <div style={{ ...card, textAlign:"center", padding:60 }}>
          <div style={{ fontSize:48, marginBottom:16 }}>📭</div>
          <div style={{ fontSize:18, fontWeight:700, color:isDark?"#f1f5f9":"#1a202c", marginBottom:8 }}>No data found</div>
          <div style={{ fontSize:13, color:isDark?"#9ca3af":"#718096" }}>
            There is no historical data available for the selected period.
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

          {viewMode !== "summary" ? (
            <>
              {/* Congestion Area Chart */}
              <div style={card}>
                <h2 style={{ margin:"0 0 20px", fontSize:16, fontWeight:700, color:isDark?"#f1f5f9":"#1a202c" }}>
                  Average Congestion Over Time
                </h2>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={snapshots} margin={{ top:15, right:20, left:0, bottom:40 }}>
                    <defs>
                      <linearGradient id="cgGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#e53e3e" stopOpacity={0.35}/>
                        <stop offset="95%" stopColor="#e53e3e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark?"#2d3748":"#f0f0f0"}/>
                    <XAxis dataKey="tickTime" tick={{ fontSize:9, fill:isDark?"#9ca3af":"#718096" }} angle={-30} textAnchor="end" interval={Math.max(0, Math.floor(snapshots.length/10)-1)}/>
                    <YAxis tick={{ fontSize:10, fill:isDark?"#9ca3af":"#718096" }} domain={[0,100]} tickFormatter={v=>`${v}%`}/>
                    <Tooltip {...tooltipProps} labelFormatter={renderTooltipLabel} formatter={v=>[`${v}%`,"Congestion"]}/>
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
                  <LineChart data={snapshots} margin={{ top:15, right:20, left:0, bottom:40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark?"#2d3748":"#f0f0f0"}/>
                    <XAxis dataKey="tickTime" tick={{ fontSize:9, fill:isDark?"#9ca3af":"#718096" }} angle={-30} textAnchor="end" interval={Math.max(0, Math.floor(snapshots.length/10)-1)}/>
                    <YAxis tick={{ fontSize:10, fill:isDark?"#9ca3af":"#718096" }}/>
                    <Tooltip {...tooltipProps} labelFormatter={renderTooltipLabel}/>
                    <Line type="monotone" dataKey="vehicles" name="Vehicles" stroke="#0ea5e9" strokeWidth={2} dot={false}/>
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Heavy vs Clear — Stacked Area */}
              <div style={card}>
                <h2 style={{ margin:"0 0 6px", fontSize:16, fontWeight:700, color:isDark?"#f1f5f9":"#1a202c" }}>
                  Heavy vs Clear Zones Over Time
                </h2>
                <p style={{ margin:"0 0 16px", fontSize:12, color:isDark?"#6b7280":"#9ca3af" }}>
                  Stacked area — combined always equals 12 zones total
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={snapshots} margin={{ top:15, right:20, left:0, bottom:40 }} stackOffset="none">
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
                      dataKey="tickTime"
                      tick={{ fontSize:9, fill:isDark?"#9ca3af":"#718096" }}
                      angle={-35} textAnchor="end"
                      interval={Math.max(0, Math.floor(snapshots.length / 10) - 1)}
                    />
                    <YAxis
                      width={70}
                      tick={{ fontSize:10, fill:isDark?"#9ca3af":"#718096" }}
                      domain={[0, 12]} ticks={[0,3,6,9,12]}
                      tickFormatter={v => `${v} zones`}
                    />
                    <Tooltip
                      {...tooltipProps}
                      labelFormatter={renderTooltipLabel}
                      formatter={(v, name) => [`${v} zones`, name]}
                    />
                    <Legend verticalAlign="top" wrapperStyle={{ fontSize:12, paddingBottom:15 }}/>
                    {/* Clear first (bottom), Heavy on top */}
                    <Area type="monotone" dataKey="clearZones" name="Clear Zones" stackId="zones" stroke="#38a169" fill="url(#clearGrad)" strokeWidth={1.5} />
                    <Area type="monotone" dataKey="heavyZones" name="Heavy Zones" stackId="zones" stroke="#e53e3e" fill="url(#heavyGrad)" strokeWidth={1.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            /* Snapshot Summary Table */
          <div style={card}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:12 }}>
              <h2 style={{ margin:0, fontSize:16, fontWeight:700, color:isDark?"#f1f5f9":"#1a202c" }}>
                Snapshot Summary
              </h2>
              <input 
                type="text" 
                placeholder="Search by time or score..." 
                value={tableFilter} 
                onChange={e => setTableFilter(e.target.value)}
                style={{ 
                  padding:"8px 12px", borderRadius:8, border:`1px solid ${isDark?"#374151":"#e2e8f0"}`, 
                  background:isDark?"#1e2535":"#fff", color:isDark?"#f1f5f9":"#1a202c", outline:"none",
                  fontSize:13, width: "200px"
                }} 
              />
            </div>
            
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${isDark?"#374151":"#e2e8f0"}`, color: isDark?"#9ca3af":"#718096" }}>
                    <th style={{ padding: "12px 8px", fontWeight: 600 }}>Date & Time</th>
                    <th style={{ padding: "12px 8px", fontWeight: 600 }}>Congestion Score</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSnapshots.length === 0 ? (
                    <tr><td colSpan={2} style={{ padding:"24px", textAlign:"center", color:isDark?"#6b7280":"#9ca3af" }}>No matches found.</td></tr>
                  ) : paginatedSnapshots.map((s, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${isDark?"#2d3748":"#f7fafc"}` }}>
                      <td style={{ padding: "12px 8px", color: isDark?"#e2e8f0":"#2d3748", fontWeight:500 }}>{s.fullTime}</td>
                      <td style={{ padding: "12px 8px", color: s.congestion > 70 ? "#e53e3e" : (s.congestion > 40 ? "#f59e0b" : "#38a169"), fontWeight:700 }}>
                        {s.congestion}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:16 }}>
                <span style={{ fontSize:12, color:isDark?"#6b7280":"#a0aec0" }}>
                  Page {currentPage} of {totalPages}
                </span>
                <div style={{ display:"flex", gap:8 }}>
                  <button 
                    disabled={currentPage === 1} 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    style={{ padding:"6px 12px", borderRadius:6, border:`1px solid ${isDark?"#374151":"#e2e8f0"}`, background:isDark?"#1e2535":"#fff", color:isDark?"#e2e8f0":"#4a5568", cursor:currentPage===1?"not-allowed":"pointer", opacity:currentPage===1?0.5:1 }}
                  >
                    Prev
                  </button>
                  <button 
                    disabled={currentPage === totalPages} 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    style={{ padding:"6px 12px", borderRadius:6, border:`1px solid ${isDark?"#374151":"#e2e8f0"}`, background:isDark?"#1e2535":"#fff", color:isDark?"#e2e8f0":"#4a5568", cursor:currentPage===totalPages?"not-allowed":"pointer", opacity:currentPage===totalPages?0.5:1 }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
          )}
        </>
      )}
    </div>
  );
};

export default HistoryPage;
