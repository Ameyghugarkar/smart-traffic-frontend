// MapComponent.js — Rich route visualization + fixed incident clear button

import React, { useEffect, useState, useCallback, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, Marker, useMap } from "react-leaflet";
import axios from "axios";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useAuth } from "./AuthContext";
import { useTheme } from "./ThemeContext";
import { API_TRAFFIC, API_INCIDENTS } from "./config";

// Alert slide-in animation
const alertStyle = document.createElement("style");
alertStyle.textContent = `@keyframes slideIn { from { opacity:0; transform:translateX(-20px); } to { opacity:1; transform:translateX(0); } } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.dark-mode .leaflet-popup-content-wrapper, html.dark-mode .leaflet-popup-content-wrapper { background:#1a1f2e !important; color:#f1f5f9 !important; border:1px solid #374151 !important; box-shadow:0 8px 32px rgba(0,0,0,0.6) !important; }
.dark-mode .leaflet-popup-tip, html.dark-mode .leaflet-popup-tip { background:#1a1f2e !important; border-color:#374151 !important; }
.dark-mode .leaflet-popup-tip-container { filter: drop-shadow(0 1px 0 #374151); }
.dark-mode .leaflet-popup-close-button { color:#9ca3af !important; }
.dark-mode .leaflet-popup-content { color:#f1f5f9 !important; }`;
if (!document.head.querySelector("#alert-anim")) { alertStyle.id="alert-anim"; document.head.appendChild(alertStyle); }

const API_BASE         = API_TRAFFIC;
const INCIDENT_API     = API_INCIDENTS;
const REFRESH_INTERVAL = 5000;

const getColor = (c) => c > 0.65 ? "#e53e3e" : c > 0.35 ? "#ed8936" : "#38a169";
const getLabel = (c) => c > 0.65 ? "Heavy"   : c > 0.35 ? "Moderate" : "Clear";

// ─── Incident marker icon ─────────────────────────────────────────────────────
const makeIncidentIcon = (severity) => {
  const color = severity === "high" ? "#e53e3e" : severity === "medium" ? "#ed8936" : "#38a169";
  return L.divIcon({
    className: "",
    html: `<div style="
      width:32px;height:32px;border-radius:50%;
      background:${color};border:3px solid #fff;
      box-shadow:0 2px 10px rgba(0,0,0,0.35);
      display:flex;align-items:center;justify-content:center;
      font-size:14px;
    ">⚠️</div>`,
    iconSize:   [32, 32],
    iconAnchor: [16, 16],
  });
};

// ─── Route waypoint icon ──────────────────────────────────────────────────────
const makeWaypointIcon = (label, color) => L.divIcon({
  className: "",
  html: `<div style="
    width:28px;height:28px;border-radius:50%;
    background:${color};border:3px solid #fff;
    box-shadow:0 2px 10px rgba(0,0,0,0.3);
    display:flex;align-items:center;justify-content:center;
    font-size:11px;font-weight:700;color:#fff;
  ">${label}</div>`,
  iconSize:   [28, 28],
  iconAnchor: [14, 14],
});

// ─── Map Resizer — fixes white area when layout changes ───────────────────────
const MapResizer = ({ trigger }) => {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 300);
  }, [trigger, map]);
  return null;
};

// ─── Canvas Heatmap ───────────────────────────────────────────────────────────
const CanvasHeatmap = ({ points }) => {
  const map      = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (!map || !points || points.length === 0) return;
    if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }

    const HeatLayer = L.Layer.extend({
      onAdd(map) {
        this._map = map;
        this._canvas = L.DomUtil.create("canvas", "leaflet-heatmap-canvas");
        const size = map.getSize();
        this._canvas.width = size.x; this._canvas.height = size.y;
        Object.assign(this._canvas.style, { position:"absolute", top:"0", left:"0", pointerEvents:"none", zIndex:"400", opacity:"0.75" });
        map.getPanes().overlayPane.appendChild(this._canvas);
        map.on("moveend zoomend resize", this._draw, this);
        this._draw();
      },
      onRemove(map) {
        map.off("moveend zoomend resize", this._draw, this);
        if (this._canvas?.parentNode) this._canvas.parentNode.removeChild(this._canvas);
      },
      _draw() {
        if (!this._map || !this._canvas) return;
        const map = this._map, canvas = this._canvas;
        const size = map.getSize();
        canvas.width = size.x; canvas.height = size.y;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, size.x, size.y);
        L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0,0]));
        points.forEach(([lat, lng, intensity]) => {
          const pos = map.latLngToContainerPoint([lat, lng]);
          const g = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 60);
          const r = Math.round(intensity * 255), gr = Math.round((1-intensity)*200);
          g.addColorStop(0,   `rgba(${r},${gr},0,0.9)`);
          g.addColorStop(0.4, `rgba(${r},${gr},0,0.5)`);
          g.addColorStop(1,   `rgba(${r},${gr},0,0)`);
          ctx.beginPath(); ctx.arc(pos.x, pos.y, 60, 0, Math.PI*2);
          ctx.fillStyle = g; ctx.fill();
        });
      },
    });
    layerRef.current = new HeatLayer();
    layerRef.current.addTo(map);
    return () => { if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; } };
  }, [points, map]);
  return null;
};

// ─── Rich Route Layer — colored segments per zone congestion ─────────────────
const RouteLayer = ({ routeData }) => {
  if (!routeData) return null;
  const { coords, path, zones } = routeData;
  if (!coords || coords.length < 2) return null;

  const zoneMap = {};
  zones.forEach(z => { zoneMap[z.location] = z.congestion; });

  return (
    <>
      {/* Thick white outline (road border effect) */}
      <Polyline positions={coords} color="#fff" weight={10} opacity={0.8}/>

      {/* Colored segments between each waypoint */}
      {coords.slice(0, -1).map((start, i) => {
        const end        = coords[i + 1];
        const zoneName   = path[i + 1];
        const congestion = zoneMap[zoneName] || 0;
        const color      = getColor(congestion);
        return (
          <Polyline
            key={i}
            positions={[start, end]}
            color={color}
            weight={6}
            opacity={0.9}
          />
        );
      })}

      {/* Animated dashed overlay for direction feel */}
      <Polyline positions={coords} color="#fff" weight={2} opacity={0.6} dashArray="8 12"/>

      {/* Waypoint markers — A for start, B for end, numbers in between */}
      {path.map((zone, i) => {
        const coord = coords[i];
        if (!coord) return null;
        const isStart = i === 0;
        const isEnd   = i === path.length - 1;
        const label   = isStart ? "A" : isEnd ? "B" : `${i}`;
        const color   = isStart ? "#1a202c" : isEnd ? "#6366f1" : getColor(zoneMap[zone] || 0);
        return (
          <Marker key={zone} position={coord} icon={makeWaypointIcon(label, color)}>
            <Popup>
              <div style={{ minWidth: 140, fontFamily: "Inter, system-ui" }}>
                <strong style={{ fontSize: 13 }}>
                  {isStart ? "🟢 Start" : isEnd ? "🏁 End" : `📍 Via`}: {zone}
                </strong>
                <div style={{ fontSize: 11, color: "#718096", marginTop: 4 }}>
                  Congestion: <span style={{ color: getColor(zoneMap[zone]||0), fontWeight: 600 }}>
                    {Math.round((zoneMap[zone]||0)*100)}%
                  </span>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
};

// ─── Route Suggester Panel ────────────────────────────────────────────────────
const RouteSuggester = ({ zones, onRoute, onClose }) => {
  const { theme, isDark } = useTheme();
  const [from,   setFrom]   = useState("");
  const [to,     setTo]     = useState("");
  const [result, setResult] = useState(null);

  const CONNECTIONS = {
    "Kothrud":      ["Deccan","Swargate","Aundh","Baner"],
    "Shivajinagar": ["Deccan","Kothrud","Aundh","Viman Nagar"],
    "Hinjewadi":    ["Wakad","Baner","Aundh"],
    "Viman Nagar":  ["Kharadi","Hadapsar","Shivajinagar"],
    "Hadapsar":     ["Viman Nagar","Swargate","Katraj","Kharadi"],
    "Kharadi":      ["Viman Nagar","Hadapsar"],
    "Baner":        ["Aundh","Hinjewadi","Wakad","Kothrud"],
    "Wakad":        ["Hinjewadi","Baner","Aundh"],
    "Aundh":        ["Baner","Wakad","Shivajinagar","Kothrud","Hinjewadi"],
    "Katraj":       ["Swargate","Hadapsar"],
    "Swargate":     ["Katraj","Kothrud","Deccan","Hadapsar"],
    "Deccan":       ["Shivajinagar","Kothrud","Swargate"],
  };

  const findRoute = () => {
    if (!from || !to || from === to) return;
    const zoneMap = {};
    zones.forEach(z => { zoneMap[z.location] = z.congestion; });

    const visited = new Set(), dist = {}, prev = {};
    const names = zones.map(z => z.location);
    names.forEach(n => { dist[n] = Infinity; });
    dist[from] = 0;

    while (true) {
      let current = null;
      names.forEach(n => { if (!visited.has(n) && (current===null || dist[n]<dist[current])) current=n; });
      if (!current || current===to || dist[current]===Infinity) break;
      visited.add(current);
      (CONNECTIONS[current]||[]).forEach(neighbor => {
        const cost = 1 + (zoneMap[neighbor]||0)*10;
        if (dist[current]+cost < dist[neighbor]) { dist[neighbor]=dist[current]+cost; prev[neighbor]=current; }
      });
    }

    const path=[]; let cur=to;
    while (cur) { path.unshift(cur); cur=prev[cur]; }

    if (path[0] !== from) {
      setResult({ error:"No direct route found between these zones." });
      onRoute(null); return;
    }

    const totalCong = path.reduce((s,z)=>s+(zoneMap[z]||0),0)/path.length;
    setResult({ path, totalCong });

    const coords = path.map(z => {
      const zn = zones.find(z2=>z2.location===z);
      return zn ? [zn.lat, zn.lng] : null;
    }).filter(Boolean);

    onRoute({ coords, path, zones, totalCong });
  };

  const zoneNames = zones.map(z=>z.location).sort();

  return (
    <div style={{ ...panelStyles.panel, background: theme.surface, color: theme.text, border:`1px solid ${theme.border}`, boxShadow: isDark?"0 8px 32px rgba(0,0,0,0.5)":"0 8px 32px rgba(0,0,0,0.15)" }}>
      <div style={panelStyles.header}>
        <span style={{ fontWeight:700, fontSize:13 }}>🗺 Route Suggester</span>
        <button onClick={onClose} style={panelStyles.closeBtn}>✕</button>
      </div>
      <p style={{ ...panelStyles.sub, color:theme.textMuted }}>Least congested route between two zones</p>

      <label style={{ ...panelStyles.label, color:theme.textSub }}>From</label>
      <select value={from} onChange={e=>setFrom(e.target.value)} style={{ ...panelStyles.select, border:`1px solid ${theme.border}`, background:theme.surfaceAlt, color:theme.text }}>
        <option value="">Select zone…</option>
        {zoneNames.map(z=><option key={z} value={z}>{z}</option>)}
      </select>

      <label style={{ ...panelStyles.label, color:theme.textSub }}>To</label>
      <select value={to} onChange={e=>setTo(e.target.value)} style={{ ...panelStyles.select, border:`1px solid ${theme.border}`, background:theme.surfaceAlt, color:theme.text }}>
        <option value="">Select zone…</option>
        {zoneNames.filter(z=>z!==from).map(z=><option key={z} value={z}>{z}</option>)}
      </select>

      <button onClick={findRoute} disabled={!from||!to} style={{ ...panelStyles.btn, background:(!from||!to)?(isDark?"#2d3748":"#e2e8f0"):"#4299e1", color:(!from||!to)?(isDark?"#6b7280":"#a0aec0"):"#fff", border:"none", outline:"none", opacity:(!from||!to)?0.7:1, cursor:(!from||!to)?"not-allowed":"pointer" }}>
        Find Best Route
      </button>

      {result?.error && (
        <div style={{ marginTop:12, fontSize:12, color:"#c53030", background:"#fff5f5", padding:"8px 12px", borderRadius:8 }}>{result.error}</div>
      )}

      {result?.path && (
        <div style={{ marginTop:14 }}>
          <div style={{ fontSize:11, color:"#718096", marginBottom:8, fontWeight:600 }}>SUGGESTED ROUTE</div>

          {/* Color legend */}
          <div style={{ display:"flex", gap:8, marginBottom:10, fontSize:10 }}>
            {[["#38a169","Clear"],["#ed8936","Moderate"],["#e53e3e","Heavy"]].map(([c,l])=>(
              <span key={l} style={{ display:"flex", alignItems:"center", gap:3, color:"#718096" }}>
                <span style={{ width:16, height:4, background:c, borderRadius:99, display:"inline-block" }}/>
                {l}
              </span>
            ))}
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            {result.path.map((zone, i) => {
              const z = zones.find(zn=>zn.location===zone);
              const c = z?.congestion||0;
              const isStart = i===0, isEnd = i===result.path.length-1;
              return (
                <div key={zone} style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ width:22, height:22, borderRadius:"50%", background:isStart?"#1a202c":isEnd?"#6366f1":getColor(c), display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color:"#fff", fontWeight:700, flexShrink:0 }}>
                    {isStart?"A":isEnd?"B":i}
                  </span>
                  {i < result.path.length-1 && (
                    <div style={{ position:"absolute", left:22, width:2, height:12, background:"#e2e8f0" }}/>
                  )}
                  <span style={{ fontSize:12, fontWeight:600, color:"#1a202c", flex:1 }}>{zone}</span>
                  <span style={{ fontSize:11, color:isStart||isEnd?"#6366f1":getColor(c), fontWeight:600 }}>
                    {isStart?"START":isEnd?"END":`${Math.round(c*100)}%`}
                  </span>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop:12, padding:"8px 12px", borderRadius:8, background:getColor(result.totalCong)+"18", border:`1px solid ${getColor(result.totalCong)}44` }}>
            <div style={{ fontSize:10, color:"#718096", marginBottom:2 }}>AVG ROUTE CONGESTION</div>
            <span style={{ fontSize:15, fontWeight:700, color:getColor(result.totalCong) }}>
              {Math.round(result.totalCong*100)}% — {getLabel(result.totalCong)}
            </span>
          </div>

          <button onClick={()=>{setResult(null); onRoute(null);}} style={{ ...panelStyles.btn, background:isDark?"#2d3748":"#f7fafc", color:isDark?"#a0aec0":"#718096", border:`1px solid ${isDark?"#4b5563":"#e2e8f0"}`, marginTop:8 }}>
            Clear Route
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Incident Report Panel ────────────────────────────────────────────────────
const IncidentForm = ({ zones, incidents, onAdd, onClear, onClose, user, onLoginRequired }) => {
  const { theme, isDark } = useTheme();
  const [form,      setForm]      = useState({ zone:"", type:"", description:"", severity:"medium" });
  const [submitted, setSubmitted] = useState(false);

  const TYPES = ["Accident","Road Closure","Flooding","Construction","Breakdown","Protest","Other"];
  const severityColor = (s) => s==="high"?"#e53e3e":s==="medium"?"#ed8936":"#38a169";

  const handleSubmit = () => {
    if (!form.zone || !form.type) return;
    const zone = zones.find(z=>z.location===form.zone);
    onAdd({
      ...form,
      id:        Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      date:      new Date().toLocaleDateString(),
      lat:       zone?.lat,
      lng:       zone?.lng,
    });
    setSubmitted(true);
    setForm({ zone:"", type:"", description:"", severity:"medium" });
    setTimeout(()=>setSubmitted(false), 2000);
  };

  return (
    <div style={{ ...panelStyles.panel, background: theme.surface, color: theme.text, border:`1px solid ${theme.border}`, boxShadow: isDark?"0 8px 32px rgba(0,0,0,0.5)":"0 8px 32px rgba(0,0,0,0.15)" }}>
      <div style={panelStyles.header}>
        <span style={{ fontWeight:700, fontSize:13 }}>⚠️ Report Incident</span>
        <button onClick={onClose} style={panelStyles.closeBtn}>✕</button>
      </div>
      <p style={{ ...panelStyles.sub, color:theme.textMuted }}>Report accidents, closures or roadblocks</p>

      <label style={{ ...panelStyles.label, color:theme.textSub }}>Zone</label>
      <select value={form.zone} onChange={e=>setForm(f=>({...f,zone:e.target.value}))} style={{ ...panelStyles.select, border:`1px solid ${theme.border}`, background:theme.surfaceAlt, color:theme.text }}>
        <option value="">Select zone…</option>
        {zones.map(z=><option key={z.location} value={z.location}>{z.location}</option>)}
      </select>

      <label style={{ ...panelStyles.label, color:theme.textSub }}>Incident Type</label>
      <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} style={{ ...panelStyles.select, border:`1px solid ${theme.border}`, background:theme.surfaceAlt, color:theme.text }}>
        <option value="">Select type…</option>
        {TYPES.map(t=><option key={t} value={t}>{t}</option>)}
      </select>

      <label style={{ ...panelStyles.label, color:theme.textSub }}>Severity</label>
      <div style={{ display:"flex", gap:6, marginBottom:10 }}>
        {["low","medium","high"].map(s=>(
          <button key={s} onClick={()=>setForm(f=>({...f,severity:s}))} style={{
            flex:1, padding:"5px 0", borderRadius:7, fontSize:11, fontWeight:600,
            cursor:"pointer", textTransform:"capitalize", border:"1px solid",
            borderColor: form.severity===s?severityColor(s):"#e2e8f0",
            background:  form.severity===s?severityColor(s)+"18":"#f7fafc",
            color:       form.severity===s?severityColor(s):"#718096",
          }}>{s}</button>
        ))}
      </div>

      <label style={{ ...panelStyles.label, color:theme.textSub }}>Description (optional)</label>
      <textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}
        placeholder="e.g. Two vehicles collided near signal..." rows={2}
        style={{ ...panelStyles.select, resize:"none", fontFamily:"inherit", border:`1px solid ${isDark?"#374151":"#e2e8f0"}`, background:isDark?"#0f1117":"#f9fafb", color:isDark?"#f1f5f9":"#1a202c" }}
      />

      {user ? (
        <button onClick={handleSubmit} disabled={!form.zone||!form.type} style={{
          ...panelStyles.btn,
          background: (!form.zone||!form.type)?"#e2e8f0":"#e53e3e",
          color:      (!form.zone||!form.type)?"#a0aec0":"#fff",
          cursor:     (!form.zone||!form.type)?"not-allowed":"pointer",
        }}>
          {submitted?"✅ Reported!":"Submit Report"}
        </button>
      ) : (
        <button onClick={() => { onClose(); onLoginRequired && onLoginRequired(); }} style={{
          ...panelStyles.btn, background:"#4299e1",
        }}>
          🔐 Login to Report Incident
        </button>
      )}

      {/* Active incidents */}
      {incidents.length > 0 && (
        <div style={{ marginTop:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <span style={{ fontSize:11, color:isDark?"#6b7280":"#718096", fontWeight:600 }}>ACTIVE ON MAP ({incidents.length})</span>
            {/* FIXED: Clear All calls onClear with no arguments */}
            <button
              onClick={() => onClear()}
              style={{ fontSize:11, color:"#c53030", background:isDark?"#2d1515":"#fff5f5", border:`1px solid ${isDark?"#7f1d1d":"#fed7d7"}`, borderRadius:6, padding:"2px 10px", cursor:"pointer" }}
            >
              Clear All
            </button>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:6, maxHeight:200, overflowY:"auto" }}>
            {incidents.map(inc=>(
              <div key={inc._id||inc.id} style={{
                padding:"8px 10px", borderRadius:8, fontSize:11,
                background:isDark?"#141824":"#f9fafb",
                border:`1px solid ${isDark?"#2d3748":"#e2e8f0"}`,
                borderLeft:`3px solid ${severityColor(inc.severity)}`,
              }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:2 }}>
                  <span style={{ fontWeight:700, color:isDark?"#f1f5f9":"#1a202c" }}>{inc.type}</span>
                  {(user && (user.role === "admin" || inc.reportedById === user.id)) && (
                    <button
                      onClick={() => onClear(inc._id||inc.id)}
                      style={{ fontSize:11, color:"#fff", background:"#e53e3e", border:"none", borderRadius:4, padding:"2px 8px", cursor:"pointer", fontWeight:600 }}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div style={{ color:isDark?"#a0aec0":"#4a5568" }}>
                    {inc.zone}
                  </div>
                <div style={{ color:isDark?"#6b7280":"#9ca3af", fontSize:10, marginTop:2 }}>
                  {inc.timestamp && !inc.timestamp.toString().includes("T")
                    ? inc.timestamp
                    : new Date(inc.createdAt || inc.timestamp).toLocaleString([], {
                        month:"short", day:"numeric",
                        hour:"2-digit", minute:"2-digit", hour12:true
                      })}
                </div>
                {inc.description && <div style={{ color:isDark?"#6b7280":"#718096", marginTop:2, fontSize:10, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:180 }}>{inc.description}</div>}
                <div style={{ marginTop:4 }}>
                  <span style={{
                    fontSize:9, fontWeight:600, padding:"1px 7px", borderRadius:99, textTransform:"capitalize",
                    background:severityColor(inc.severity)+"18", color:severityColor(inc.severity),
                    border:`1px solid ${severityColor(inc.severity)}44`,
                  }}>{inc.severity}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const MapComponent = ({ layoutTrigger = "", user = null, onLoginRequired = () => {}, onManualRefresh = null, trafficData: externalData = [], isRefreshing = false, isDark = false }) => {
  const { theme } = useTheme();
  const { token } = useAuth(); // user comes from props
  const [predictions,  setPredictions]  = useState({});
  const [lastUpdated,  setLastUpdated]  = useState(null); // kept for display
  const [showHeatmap,  setShowHeatmap]  = useState(false);
  const [showMarkers,  setShowMarkers]  = useState(true);
  const [showRoute,    setShowRoute]    = useState(false);
  const [showIncident, setShowIncident] = useState(false);
  const [routeData,    setRouteData]    = useState(null);
  const [incidents,    setIncidents]    = useState([]);
  const [generating,   setGenerating]   = useState(false);
  const [generateMsg,  setGenerateMsg]  = useState(null);
  const [refreshing,   setRefreshing]   = useState(false); // full overlay loading
  const [alerts,       setAlerts]       = useState([]);  // active congestion alerts
  const alertedZonesRef = useRef(new Set()); // track which zones already alerted
  const predictionsRef = useRef({});

  // Combined trigger — fires MapResizer whenever any layout or panel changes
  const resizerTrigger = `${showRoute}-${showIncident}-${layoutTrigger}`;

  // trafficData comes from externalData prop
  const trafficData = externalData;
  const heatmapPoints = trafficData
    .filter(item=>item.lat&&item.lng&&item.congestion!==undefined)
    .map(item=>[parseFloat(item.lat),parseFloat(item.lng),parseFloat(item.congestion)]);

  const fetchPredictions = useCallback(async (locations) => {
    const results = {};
    await Promise.all(locations.map(async (location) => {
      if (predictionsRef.current[location]!==undefined) return;
      try {
        const res = await axios.get(`${API_BASE}/predict/${encodeURIComponent(location)}`,{timeout:4000});
        if (res.data?.predicted!==undefined) {
          results[location]={ predicted:parseFloat(res.data.predicted).toFixed(2), current:parseFloat(res.data.current||0).toFixed(2), confidence:res.data.confidence||"medium" };
        } else { results[location]={ predicted:"N/A",current:"N/A",confidence:"low" }; }
      } catch { results[location]={ predicted:"N/A",current:"N/A",confidence:"low" }; }
    }));
    if (Object.keys(results).length>0) {
      predictionsRef.current={...predictionsRef.current,...results};
      setPredictions(prev=>({...prev,...results}));
    }
  },[]);


  const handleGenerate = useCallback(async () => {
    if (onManualRefresh) {
      setGenerating(true);
      setRefreshing(true);     // show map overlay
      setPredictions({});
      predictionsRef.current = {};
      try {
        await onManualRefresh(); // App.js generateData — sets isRefreshing, clears data, fetches fresh
        setGenerateMsg("✅ Data refreshed");
      } catch {
        setGenerateMsg("⚠️ Refresh failed");
      } finally {
        setGenerating(false);
        setRefreshing(false);  // hide map overlay
        setTimeout(() => setGenerateMsg(null), 3000);
      }
    }
  }, [onManualRefresh]);

  // ─── Incident handlers — saved to MongoDB ────────────────────────────────
  const fetchIncidents = useCallback(async () => {
    try {
      const res = await axios.get(INCIDENT_API, { timeout: 5000 });
      if (res.data?.success) setIncidents(res.data.incidents);
    } catch (err) { console.error("[Incidents] fetch failed:", err.message); }
  }, []);

  const handleAddIncident = async (incident) => {
    try {
      const res = await axios.post(INCIDENT_API, incident, { timeout: 5000, headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (res.data?.success) {
        setIncidents(prev => [res.data.incident, ...prev]);
      }
    } catch (err) { console.error("[Incidents] save failed:", err.message); }
  };

  const handleClearIncident = async (id) => {
    try {
      if (id === undefined) {
        // Clear all
        await axios.delete(INCIDENT_API, { timeout: 5000, headers: token ? { Authorization: `Bearer ${token}` } : {} });
        setIncidents([]);
      } else {
        // Delete one
        await axios.delete(`${INCIDENT_API}/${id}`, { timeout: 5000, headers: token ? { Authorization: `Bearer ${token}` } : {} });
        setIncidents(prev => prev.filter(i => i._id !== id));
      }
    } catch (err) { console.error("[Incidents] delete failed:", err.message); }
  };

  useEffect(() => {
    fetchIncidents();
    const incidentInterval = setInterval(fetchIncidents, 5000);
    return () => clearInterval(incidentInterval);
  }, [fetchIncidents]);

  // When externalData changes — update predictions, route colors, alerts
  useEffect(() => {
    if (externalData.length === 0) return;
    // Reset and refetch predictions
    predictionsRef.current = {};
    setPredictions({});
    fetchPredictions(externalData.map(i => i.location).filter(Boolean));
    // Update route zone colors
    setRouteData(prev => prev ? { ...prev, zones: externalData } : null);
    // Alert check
    externalData.forEach(zone => {
      if (zone.congestion > 0.65 && !alertedZonesRef.current.has(zone.location)) {
        alertedZonesRef.current.add(zone.location);
        const alert = {
          id: Date.now() + Math.random(),
          zone: zone.location,
          congestion: Math.round(zone.congestion * 100),
          time: new Date().toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"}),
        };
        setAlerts(prev => [alert, ...prev].slice(0, 5));
        setTimeout(() => setAlerts(prev => prev.filter(a => a.id !== alert.id)), 8000);
      }
      if (zone.congestion <= 0.60) alertedZonesRef.current.delete(zone.location);
    });
  }, [externalData, fetchPredictions]);

  if (externalData.length === 0 && isRefreshing) return (
    <div style={styles.loadingBox}><p style={styles.loadingText}>Loading traffic data…</p></div>
  );

  return (
    <div style={{ ...styles.wrapper, "--bg": theme.bg, "--surface": theme.surface, "--border": theme.border, background: theme.surface }}> 

      {/* Compact status bar */}
      <div style={{ ...styles.statusBar, background: theme.surface, borderBottom: `1px solid ${theme.border}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
          <span style={styles.liveDot}/>
          <span style={{ ...styles.liveText, color: theme.textSub }}>Live · {trafficData.length} zones · {lastUpdated}</span>
        </div>

        <div style={{ display:"flex", gap:6, flexWrap:"nowrap" }}>
          <button style={{ ...styles.toggleBtn, border:`1px solid ${theme.border}`, background:theme.surfaceAlt, color:theme.textSub, ...(showMarkers?styles.toggleActiveGreen:{}) }} onClick={()=>setShowMarkers(v=>!v)}>● Markers</button>
          <button style={{ ...styles.toggleBtn, border:`1px solid ${theme.border}`, background:theme.surfaceAlt, color:theme.textSub, ...(showHeatmap?styles.toggleActiveRed:{}) }} onClick={()=>setShowHeatmap(v=>!v)}>🌡 Heat</button>
          <button onClick={()=>{setShowRoute(v=>!v);setShowIncident(false);}}
            style={{ ...styles.toggleBtn, border:`1px solid ${theme.border}`, background:theme.surfaceAlt, color:theme.textSub, ...(showRoute?{background:"#ebf4ff",border:"1px solid #4299e1",color:"#2b6cb0"}:{}) }}>
            🗺 Route
          </button>
          <button
            onClick={() => { setShowIncident(v=>!v); setShowRoute(false); }}
            style={{ ...styles.toggleBtn, border:`1px solid ${theme.border}`, background:theme.surfaceAlt, color:theme.textSub, ...(showIncident?{background:"#fff5f5",border:"1px solid #e53e3e",color:"#c53030"}:{}) }}
          >
            ⚠️ Incident{incidents.length>0&&<span style={{ background:"#e53e3e",color:"#fff",borderRadius:99,padding:"0 5px",fontSize:10,marginLeft:4 }}>{incidents.length}</span>}
          </button>

          {/* Clear Route — only visible when a route is drawn */}
          {routeData && (
            <button
              onClick={() => setRouteData(null)}
              style={{ ...styles.toggleBtn, background:"#fff5f5", border:"1px solid #e53e3e", color:"#c53030", fontWeight:600 }}
            >
              ✕ Clear Route
            </button>
          )}
          {/* Refresh — admin only */}
          {user?.role === "admin" && (
            <button onClick={handleGenerate} disabled={generating} style={{
              ...styles.toggleBtn,
              background: generating ? "#ebf8f1" : "#1a202c",
              color:      generating ? "#276749" : "#fff",
              border: "1px solid #1a202c", fontWeight: 600,
              opacity: generating ? 0.7 : 1,
              cursor:  generating ? "not-allowed" : "pointer",
            }}>
              {generating ? "⏳…" : "🔄 Refresh"}
            </button>
          )}
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:10, marginLeft:"auto", flexShrink:0 }}>
          {generateMsg && (
            <span style={{ fontSize:11, fontWeight:500, padding:"2px 8px", borderRadius:99,
              color:      generateMsg.startsWith("✅") ? "#276749" : "#c53030",
              background: generateMsg.startsWith("✅") ? "#ebf8f1" : "#fff5f5" }}>
              {generateMsg}
            </span>
          )}
          <div style={styles.legend}>
            {[["#38a169","Clear"],["#ed8936","Mod"],["#e53e3e","Heavy"]].map(([c,l])=>(
              <span key={l} style={{ ...styles.legendItem, color:theme.textSub }}>
                <span style={{ ...styles.legendDot,background:c }}/>{l}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Map + panels */}
      <div style={{ position:"relative", flex:1, overflow:"hidden", height:"100%" }}>
        <MapContainer center={[18.5204,73.8567]} zoom={12} style={styles.map}>
          <MapResizer trigger={resizerTrigger}/>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors'/>

          {showHeatmap&&heatmapPoints.length>0&&<CanvasHeatmap points={heatmapPoints}/>}

          {/* Rich route layer */}
          <RouteLayer routeData={routeData}/>

          {/* Incident markers */}
          {/* Group incidents by location — stack multiple at same zone with offset */}
          {incidents.filter(inc=>inc.lat&&inc.lng).map((inc, idx) => {
            // Offset markers at same zone so they don't overlap
            const sameZone = incidents.filter(i => i.zone === inc.zone && i.lat && i.lng);
            const posIdx   = sameZone.findIndex(i => (i._id||i.id) === (inc._id||inc.id));
            const offsetLat = inc.lat + posIdx * 0.003;
            const offsetLng = inc.lng + posIdx * 0.003;

            // Live traffic data for this zone
            const zoneTraffic = trafficData.find(z => z.location === inc.zone);
            const congPct     = zoneTraffic ? Math.round(zoneTraffic.congestion * 100) : null;
            const congColor   = zoneTraffic ? getColor(zoneTraffic.congestion) : "#718096";
            const congLabel   = zoneTraffic ? getLabel(zoneTraffic.congestion) : null;

            return (
              <Marker key={inc._id||inc.id} position={[offsetLat, offsetLng]} icon={makeIncidentIcon(inc.severity)}>
                <Popup>
                  <div style={{ minWidth:210, fontFamily:"Inter,system-ui", fontSize:12 }}>

                    {/* Title */}
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
                      <span style={{ fontSize:15 }}>⚠️</span>
                      <strong style={{ fontSize:13, color:"#1a202c" }}>{inc.type}</strong>
                      {sameZone.length > 1 && (
                        <span style={{ fontSize:9, background:"#e53e3e", color:"#fff", borderRadius:99, padding:"1px 6px", marginLeft:"auto" }}>
                          {posIdx+1}/{sameZone.length}
                        </span>
                      )}
                    </div>

                    {/* Incident details */}
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                      <span style={{ color:isDark?"#9ca3af":"#718096" }}>Zone</span>
                      <span style={{ fontWeight:600, color:isDark?"#f1f5f9":"#1a202c" }}>{inc.zone}</span>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                      <span style={{ color:isDark?"#9ca3af":"#718096" }}>Severity</span>
                      <span style={{
                        fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:99, textTransform:"capitalize",
                        background: inc.severity==="high"?"#fff5f5":inc.severity==="medium"?"#fffbeb":"#f0fdf4",
                        color:      inc.severity==="high"?"#c53030":inc.severity==="medium"?"#b45309":"#276749",
                      }}>{inc.severity}</span>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                      <span style={{ color:isDark?"#9ca3af":"#718096" }}>Reported</span>
                      <span style={{ color:isDark?"#a0aec0":"#4a5568" }}>
                        {inc.timestamp && !inc.timestamp.includes("T")
                          ? inc.timestamp
                          : new Date(inc.createdAt || inc.timestamp).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit", hour12:true})}
                      </span>
                    </div>
                    {inc.description && (
                      <div style={{ marginBottom:4, padding:"5px 8px", background:isDark?"#0d1117":"#f9fafb", border:`1px solid ${isDark?"#374151":"#e2e8f0"}`, borderRadius:6, color:isDark?"#a0aec0":"#4a5568", fontSize:11, lineHeight:1.4 }}>
                        {inc.description}
                      </div>
                    )}

                    {/* Live traffic data divider */}
                    {zoneTraffic && (
                      <>
                        <div style={{ borderTop:`1px solid ${isDark?"#374151":"#e2e8f0"}`, margin:"8px 0 6px", fontSize:10, color:isDark?"#6b7280":"#9ca3af", fontWeight:600 }}>
                          LIVE TRAFFIC — {inc.zone}
                        </div>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                          <span style={{ color:isDark?"#9ca3af":"#718096" }}>Status</span>
                          <span style={{ fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:99, background:congColor+"22", color:congColor }}>
                            {congLabel}
                          </span>
                        </div>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                          <span style={{ color:isDark?"#9ca3af":"#718096" }}>Congestion</span>
                          <span style={{ fontWeight:600, color:congColor }}>{congPct}%</span>
                        </div>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                          <span style={{ color:isDark?"#9ca3af":"#718096" }}>Vehicles</span>
                          <span style={{ fontWeight:500, color:isDark?"#f1f5f9":"#1a202c" }}>{zoneTraffic.vehicles?.toLocaleString()}</span>
                        </div>
                        {/* Mini congestion bar */}
                        <div style={{ height:4, background:isDark?"#374151":"#f3f4f6", borderRadius:99, overflow:"hidden", marginBottom:8 }}>
                          <div style={{ width:`${congPct}%`, height:"100%", background:congColor, borderRadius:99 }}/>
                        </div>
                      </>
                    )}

                    {/* Remove button */}
                    <button
                      onClick={()=>handleClearIncident(inc._id||inc.id)}
                      style={{ width:"100%", padding:"5px 0", fontSize:11, fontWeight:600, color:"#fff", background:"#e53e3e", border:"none", borderRadius:6, cursor:"pointer" }}
                    >
                      Remove Incident
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Traffic markers */}
          {showMarkers&&trafficData.map((item)=>{
            const pred=predictions[item.location];
            const predValue=pred?.predicted;
            const predLoading=predValue===undefined;
            return (
              <CircleMarker key={item.location} center={[item.lat,item.lng]}
                radius={14+(item.congestion||0)*10} fillColor={getColor(item.congestion||0)}
                color="#fff" weight={2} opacity={1} fillOpacity={0.82}>
                <Popup>
                  <div style={{ ...styles.popup, background:isDark?"#1a1f2e":"#fff", color:theme.text }}>
                    <strong style={{ ...styles.popupTitle, color:theme.text }}>{item.location}</strong>
                    <div style={styles.popupRow}>
                      <span style={{ ...styles.popupLabel, color:theme.textMuted }}>Status</span>
                      <span style={{ ...styles.popupBadge,background:getColor(item.congestion||0)+"22",color:getColor(item.congestion||0) }}>{getLabel(item.congestion||0)}</span>
                    </div>
                    <div style={styles.popupRow}>
                      <span style={{ ...styles.popupLabel, color:theme.textMuted }}>Vehicles</span>
                      <span style={{ ...styles.popupValue, color:theme.text }}>{item.vehicles?.toLocaleString()||"—"}</span>
                    </div>
                    <div style={styles.popupRow}>
                      <span style={{ ...styles.popupLabel, color:theme.textMuted }}>Congestion</span>
                      <span style={{ ...styles.popupValue, color:theme.text }}>{item.congestion!==undefined?`${(item.congestion*100).toFixed(0)}%`:"—"}</span>
                    </div>
                    <div style={{ ...styles.popupRow,borderTop:`1px solid ${isDark?"#2d3748":"#e2e8f0"}`,paddingTop:8,marginTop:4 }}>
                      <span style={{ ...styles.popupLabel, color:theme.textMuted }}>
                        Next 15 min
                      </span>
                      <span style={{ ...styles.popupValue,fontWeight:600,color:predLoading?"#a0aec0":predValue==="N/A"?"#fc8181":getColor(parseFloat(predValue)||0) }}>
                        {predLoading ? "Fetching…"
                          : predValue==="N/A" ? "Unavailable"
                          : (() => {
                              const pct  = Math.round(parseFloat(predValue)*100);
                              const cur  = Math.round((item.congestion||0)*100);
                              const diff = pct - cur;
                              const arrow = diff > 3 ? " ▲" : diff < -3 ? " ▼" : " →";
                              const nextT = new Date(Date.now()+15*60000)
                                .toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true});
                              return `${pct}%${arrow}  (at ${nextT})`;
                            })()
                        }
                      </span>
                    </div>
                    {pred?.confidence&&(
                      <div style={styles.popupRow}>
                        <span style={{ ...styles.popupLabel, color:theme.textMuted }}>Confidence</span>
                        <span style={{ ...styles.popupValue,textTransform:"capitalize" }}>{pred.confidence}</span>
                      </div>
                    )}
                    <div style={{ fontSize:10,color:theme.textMuted,marginTop:6 }}>
                      {item.timestamp ? `Data as of ${new Date(item.timestamp).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true})}` : ""}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>

        {/* ── Full overlay loading — shown while refreshing TomTom data ── */}
        {(refreshing || isRefreshing) && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 2000,
            background: "rgba(26,32,44,0.75)", backdropFilter: "blur(3px)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 16,
          }}>
            {/* Spinner */}
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              border: "4px solid rgba(255,255,255,0.15)",
              borderTop: "4px solid #fff",
              animation: "spin 0.8s linear infinite",
            }}/>
            <div style={{ color: "#fff", fontSize: 15, fontWeight: 600 }}>
              Fetching live traffic data…
            </div>
            <div style={{ color: "#a0aec0", fontSize: 12 }}>
              Calling TomTom API for 12 Pune zones
            </div>
          </div>
        )}

        {showRoute&&(
          <div style={panelStyles.floating}>
            <RouteSuggester zones={trafficData} onRoute={(data)=>setRouteData(data)} onClose={()=>setShowRoute(false)}/>
          </div>
        )}

        {showIncident&&(
          <div style={panelStyles.floating}>
            <IncidentForm zones={trafficData} incidents={incidents} onAdd={handleAddIncident} onClear={handleClearIncident} onClose={()=>setShowIncident(false)} user={user} onLoginRequired={onLoginRequired}/>
          </div>
        )}

        {/* ── Alert toasts — bottom left ── */}
        <div style={{ position:"absolute", bottom:16, left:16, zIndex:2000, display:"flex", flexDirection:"column", gap:8, maxWidth:300 }}>
          {alerts.map(alert => (
            <div key={alert.id} style={{
              background:"#1a202c",
              borderLeft:"4px solid #e53e3e",
              borderRadius:10,
              padding:"12px 14px",
              boxShadow:"0 4px 20px rgba(0,0,0,0.3)",
              display:"flex", flexDirection:"column", gap:4,
              animation:"slideIn 0.3s ease",
            }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:14 }}>🚨</span>
                  <span style={{ fontSize:12, fontWeight:700, color:"#fff" }}>
                    Critical Congestion Alert
                  </span>
                </div>
                <button
                  onClick={() => setAlerts(prev => prev.filter(a => a.id !== alert.id))}
                  style={{ background:"none", border:"none", color:"#718096", cursor:"pointer", fontSize:14, padding:"0 2px", lineHeight:1 }}
                >
                  ✕
                </button>
              </div>
              <div style={{ fontSize:12, color:"#e2e8f0" }}>
                <b style={{ color:"#fc8181" }}>{alert.zone}</b> has reached{" "}
                <b style={{ color:"#fc8181" }}>{alert.congestion}%</b> congestion
              </div>
              <div style={{ fontSize:10, color:"#718096" }}>
                {alert.time} · Consider alternate routes
              </div>
              {/* Progress bar */}
              <div style={{ height:3, background:"#2d3748", borderRadius:99, overflow:"hidden", marginTop:2 }}>
                <div style={{ width:`${alert.congestion}%`, height:"100%", background:"#e53e3e", borderRadius:99 }}/>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

const styles = {
  wrapper:           { display:"flex",flexDirection:"column",height:"100%",fontFamily:"Inter,system-ui,sans-serif",background:"var(--bg)" },
  loadingBox:        { display:"flex",alignItems:"center",justifyContent:"center",height:"100%" },
  loadingText:       { fontSize:15,color:"#718096" },
  statusBar:         { display:"flex",alignItems:"center",gap:12,padding:"6px 14px",background:"var(--surface)",borderBottom:"1px solid var(--border)",zIndex:1000,flexWrap:"nowrap",minHeight:44 },
  liveDot:           { width:7,height:7,borderRadius:"50%",background:"#38a169",flexShrink:0,display:"inline-block" },
  liveText:          { fontSize:12,whiteSpace:"nowrap" },
  toggleBtn:         { padding:"4px 10px",borderRadius:99,fontSize:11,fontWeight:500,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap" },
  toggleActiveGreen: { background:"#ebf8f1",border:"1px solid #38a169",color:"#276749" },
  toggleActiveRed:   { background:"#fff5f5",border:"1px solid #e53e3e",color:"#c53030" },
  legend:            { display:"flex",gap:10,flexWrap:"nowrap" },
  legendItem:        { display:"flex",alignItems:"center",gap:4,fontSize:11 },
  legendDot:         { width:8,height:8,borderRadius:"50%",display:"inline-block",flexShrink:0 },
  map:               { width:"100%",height:"100%",minHeight:0 },
  popup:             { minWidth:200,fontFamily:"Inter,system-ui,sans-serif",padding:"2px" },
  popupTitle:        { display:"block",fontSize:14,fontWeight:600,marginBottom:8 },
  popupRow:          { display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5 },
  popupLabel:        { fontSize:12 },
  popupValue:        { fontSize:12,fontWeight:500 },
  popupBadge:        { fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:99 },
};

const panelStyles = {
  floating: { position:"absolute",top:12,right:12,zIndex:1000,width:300,maxHeight:"88%",overflowY:"auto",boxShadow:"0 8px 32px rgba(0,0,0,0.15)",borderRadius:12 },
  panel:    { borderRadius:12,padding:16,fontFamily:"Inter,system-ui,sans-serif",border:"1px solid transparent" },
  header:   { display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4 },
  closeBtn: { background:"none",border:"none",fontSize:14,cursor:"pointer",color:"#a0aec0",padding:"2px 6px" },
  sub:      { fontSize:11,marginBottom:14,marginTop:0 },
  label:    { fontSize:11,fontWeight:600,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".04em" },
  select:   { width:"100%",padding:"7px 10px",fontSize:12,borderRadius:8,marginBottom:12,outline:"none",boxSizing:"border-box" },
  btn:      { width:"100%",padding:"9px 0",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",marginTop:4,outline:"none",border:"none" },
};

export default MapComponent;