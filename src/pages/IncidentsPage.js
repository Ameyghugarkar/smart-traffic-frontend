// pages/IncidentsPage.js — Full CRUD page for traffic incidents
import React, { useState, useEffect } from "react";
import axios from "axios";
import { API_INCIDENTS } from "../config";
import { useTheme } from "../ThemeContext";
import { useAuth  } from "../AuthContext";

const SEVERITY_COLOR = { high:"#e53e3e", medium:"#d97706", low:"#38a169" };

// Zone → approximate Pune coordinates (required by incident model)
const ZONE_COORDS = {
  "Hinjewadi":    { lat:18.5914, lng:73.7380 },
  "Wakad":        { lat:18.6019, lng:73.7619 },
  "Swargate":     { lat:18.5019, lng:73.8600 },
  "Shivajinagar": { lat:18.5308, lng:73.8475 },
  "Deccan":       { lat:18.5163, lng:73.8473 },
  "Kothrud":      { lat:18.5074, lng:73.8077 },
  "Baner":        { lat:18.5590, lng:73.7868 },
  "Aundh":        { lat:18.5589, lng:73.8078 },
  "Viman Nagar":  { lat:18.5679, lng:73.9143 },
  "Hadapsar":     { lat:18.5018, lng:73.9260 },
  "Kharadi":      { lat:18.5517, lng:73.9389 },
  "Katraj":       { lat:18.4530, lng:73.8673 },
};

const ZONES = Object.keys(ZONE_COORDS);
const TYPES = ["Accident","Road Closure","Flooding","Construction","Breakdown","Protest","Other"];

const IncidentsPage = ({ onLoginClick }) => {
  const { isDark, theme } = useTheme();
  const { user, token } = useAuth();

  const [incidents,  setIncidents]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ zone:"Hinjewadi", description:"", severity:"medium", type:"Accident" });

  const fetchIncidents = () => {
    setLoading(true);
    axios.get(API_INCIDENTS, { timeout:8000 })
      .then(r => {
        // API returns { success: true, incidents: [...] }
        const list = r.data?.incidents || r.data?.data || r.data || [];
        setIncidents(Array.isArray(list) ? list : []);
      })
      .catch(() => setIncidents([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchIncidents(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) { onLoginClick?.(); return; }
    setSubmitting(true);
    const coords = ZONE_COORDS[form.zone] || { lat:18.52, lng:73.85 };
    try {
      await axios.post(
        API_INCIDENTS,
        { zone: form.zone, type: form.type, severity: form.severity, description: form.description, lat: coords.lat, lng: coords.lng },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setForm({ zone:"Hinjewadi", description:"", severity:"medium", type:"Accident" });
      setShowForm(false);
      fetchIncidents();
    } catch { /* silent */ }
    finally { setSubmitting(false); }
  };

  const handleResolve = async (id) => {
    try {
      await axios.patch(`${API_INCIDENTS}/${id}`, {}, { headers:{ Authorization:`Bearer ${token}` } });
      fetchIncidents();
    } catch { /* silent */ }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this incident?")) return;
    try {
      await axios.delete(`${API_INCIDENTS}/${id}`, { headers:{ Authorization:`Bearer ${token}` } });
      fetchIncidents();
    } catch { /* silent */ }
  };

  const card       = { background:theme.surface, border:`1px solid ${theme.border}`, borderRadius:16, padding:"24px 28px", marginBottom:24 };
  const inputStyle = { width:"100%", padding:"9px 12px", borderRadius:8, border:`1px solid ${isDark?"#374151":"#e2e8f0"}`, background:isDark?"#1a2035":"#f8fafc", color:isDark?"#f1f5f9":"#1a202c", fontSize:13, boxSizing:"border-box" };
  const labelStyle = { fontSize:12, fontWeight:600, color:isDark?"#9ca3af":"#718096", marginBottom:4, display:"block" };

  return (
    <div style={{ height:"100%", overflowY:"auto", background:theme.bg, padding:"28px 32px" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:28 }}>
        <div>
          <h1 style={{ margin:0, fontSize:24, fontWeight:800, color:isDark?"#f1f5f9":"#1a202c" }}>⚠️ Traffic Incidents</h1>
          <p style={{ margin:"6px 0 0", fontSize:13, color:isDark?"#9ca3af":"#718096" }}>View, report, and manage traffic incidents across Pune zones</p>
        </div>
        <button
          onClick={() => user ? setShowForm(v=>!v) : onLoginClick?.()}
          style={{ padding:"10px 20px", borderRadius:9, fontSize:13, fontWeight:600, cursor:"pointer", border:"none", background: showForm?"#718096":"#e53e3e", color:"#fff" }}
        >
          {showForm ? "✕ Cancel" : "+ Report Incident"}
        </button>
      </div>

      {/* Report Form */}
      {showForm && (
        <div style={{ ...card, border:"1px solid #e53e3e44", background:isDark?"#1a1f2e":"#fff9f9" }}>
          <h2 style={{ margin:"0 0 20px", fontSize:16, fontWeight:700, color:isDark?"#f1f5f9":"#1a202c" }}>📝 Report New Incident</h2>
          <form onSubmit={handleSubmit}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
              <div>
                <label style={labelStyle}>Zone / Location</label>
                <select value={form.zone} onChange={e=>setForm(f=>({...f,zone:e.target.value}))} style={inputStyle} required>
                  {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Incident Type</label>
                <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} style={inputStyle} required>
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Severity</label>
                <select value={form.severity} onChange={e=>setForm(f=>({...f,severity:e.target.value}))} style={inputStyle}>
                  <option value="low">🟢 Low</option>
                  <option value="medium">🟠 Medium</option>
                  <option value="high">🔴 High</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Description</label>
                <input
                  value={form.description}
                  onChange={e=>setForm(f=>({...f,description:e.target.value}))}
                  placeholder="Brief description of the incident..."
                  style={inputStyle}
                  required
                />
              </div>
            </div>
            <button type="submit" disabled={submitting}
              style={{ padding:"10px 28px", borderRadius:8, border:"none", background:"#e53e3e", color:"#fff", fontWeight:600, fontSize:13, cursor:"pointer", opacity:submitting?0.7:1 }}>
              {submitting ? "Submitting..." : "🚨 Submit Incident"}
            </button>
          </form>
        </div>
      )}

      {/* Incidents Table */}
      <div style={card}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
          <h2 style={{ margin:0, fontSize:16, fontWeight:700, color:isDark?"#f1f5f9":"#1a202c" }}>
            Active Incidents
            {incidents.length > 0 && <span style={{ fontSize:12, fontWeight:500, color:"#9ca3af", marginLeft:8 }}>({incidents.length})</span>}
          </h2>
          <button onClick={fetchIncidents}
            style={{ fontSize:12, padding:"5px 12px", borderRadius:7, border:`1px solid ${isDark?"#374151":"#e2e8f0"}`, background:"transparent", color:isDark?"#9ca3af":"#718096", cursor:"pointer" }}>
            🔄 Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign:"center", padding:40, color:"#9ca3af", fontSize:28 }}>⏳ Loading...</div>
        ) : incidents.length === 0 ? (
          <div style={{ textAlign:"center", padding:48 }}>
            <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
            <div style={{ fontSize:16, fontWeight:600, color:isDark?"#f1f5f9":"#1a202c" }}>No active incidents</div>
            <div style={{ fontSize:13, color:isDark?"#9ca3af":"#718096", marginTop:6 }}>All clear across Pune!</div>
          </div>
        ) : (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr>
                  {["Zone","Type","Severity","Description","Reported By","Time","Actions"].map(h => (
                    <th key={h} style={{ textAlign:"left", padding:"10px 14px", fontSize:11, fontWeight:700, color:isDark?"#6b7280":"#9ca3af", borderBottom:`1px solid ${isDark?"#2d3748":"#f0f0f0"}`, whiteSpace:"nowrap" }}>
                      {h.toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {incidents.map((inc, i) => (
                  <tr key={inc._id||i} style={{ borderBottom:`1px solid ${isDark?"#1f2937":"#f9fafb"}` }}>
                    <td style={{ padding:"12px 14px", fontWeight:600, color:isDark?"#e2e8f0":"#1a202c" }}>{inc.zone}</td>
                    <td style={{ padding:"12px 14px", color:isDark?"#9ca3af":"#718096" }}>{inc.type}</td>
                    <td style={{ padding:"12px 14px" }}>
                      <span style={{ padding:"3px 10px", borderRadius:99, fontSize:11, fontWeight:700, background:(SEVERITY_COLOR[inc.severity]||"#718096")+"22", color:SEVERITY_COLOR[inc.severity]||"#718096" }}>
                        {(inc.severity||"unknown").toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding:"12px 14px", color:isDark?"#9ca3af":"#718096", maxWidth:220 }}>{inc.description||"—"}</td>
                    <td style={{ padding:"12px 14px", color:isDark?"#6b7280":"#9ca3af", fontSize:12 }}>{inc.reportedBy||"Anonymous"}</td>
                    <td style={{ padding:"12px 14px", color:isDark?"#6b7280":"#9ca3af", fontSize:11, whiteSpace:"nowrap" }}>
                      {inc.timestamp ? new Date(inc.timestamp).toLocaleString("en-IN",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}) : "—"}
                    </td>
                    <td style={{ padding:"12px 14px" }}>
                      <div style={{ display:"flex", gap:6 }}>
                        {user && (
                          <button onClick={()=>handleResolve(inc._id)}
                            style={{ fontSize:11, padding:"4px 10px", borderRadius:6, border:"1px solid #38a16944", background:"transparent", color:"#38a169", cursor:"pointer" }}>
                            ✓ Resolve
                          </button>
                        )}
                        {user?.role==="admin" && (
                          <button onClick={()=>handleDelete(inc._id)}
                            style={{ fontSize:11, padding:"4px 10px", borderRadius:6, border:"1px solid #e53e3e44", background:"transparent", color:"#e53e3e", cursor:"pointer" }}>
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default IncidentsPage;
