// frontend/src/AdminDashboard.js

import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useAuth } from "./AuthContext";
import { useTheme } from "./ThemeContext";
import { API_BASE_ROOT } from "./config";

const API = `${API_BASE_ROOT}/api`;
const severityColor = (s) =>
  s === "high" ? "#e53e3e" : s === "medium" ? "#ed8936" : "#38a169";

export default function AdminDashboard({ onClose }) {
  const { token } = useAuth();
  const { theme, isDark } = useTheme();
  const [tab,       setTab]       = useState("users");
  const [users,     setUsers]     = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");

  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [uRes, iRes] = await Promise.all([
        axios.get(`${API}/auth/users`,    { headers, timeout: 5000 }),
        axios.get(`${API}/incidents/all`, { headers, timeout: 5000 }),
      ]);
      if (uRes.data?.success)  setUsers(uRes.data.users);
      if (iRes.data?.success)  setIncidents(iRes.data.incidents);
    } catch (err) {
      setError("Failed to load data — " + (err.response?.data?.message || err.message));
    } finally { setLoading(false); }
  }, [token]); // eslint-disable-line

  useEffect(() => { fetchData(); }, [fetchData]);

  const deleteIncident = async (id) => {
    try {
      await axios.delete(`${API}/incidents/${id}`, { headers });
      setIncidents(prev => prev.filter(i => i._id !== id));
    } catch (err) { setError("Delete failed: " + err.message); }
  };

  const toggleBlock = async (userId, currentlyBlocked) => {
    try {
      const res = await axios.patch(`${API}/auth/users/${userId}/block`, {}, { headers });
      if (res.data?.success) {
        setUsers(prev => prev.map(u =>
          u._id?.toString() === userId ? { ...u, blocked: res.data.blocked } : u
        ));
      }
    } catch (err) { setError("Block failed: " + err.message); }
  };

  const deleteUser = async (userId) => {
    if (!window.confirm("Delete this user and all their data? This cannot be undone.")) return;
    try {
      await axios.delete(`${API}/auth/users/${userId}`, { headers });
      setUsers(prev => prev.filter(u => u._id?.toString() !== userId));
      // Also remove their incidents from local state
      setIncidents(prev => prev.filter(i => i.reportedById !== userId));
    } catch (err) { setError("Delete user failed: " + err.message); }
  };

  const resolveIncident = async (id) => {
    try {
      await axios.patch(`${API}/incidents/${id}`, {}, { headers });
      // Mark as resolved in local state — keep in list so admin can see history + delete
      setIncidents(prev => prev.map(i => i._id === id ? { ...i, resolved: true } : i));
    } catch (err) { setError("Resolve failed: " + err.message); }
  };

  const activeIncidents   = incidents.filter(i => !i.resolved);
  const resolvedIncidents = incidents.filter(i => i.resolved);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: isDark?"#1a1f2e":"#fff", borderRadius: 16,
        width: 780, maxHeight: "88vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        fontFamily: "Inter, system-ui, sans-serif",
        overflow: "hidden",
      }}>

        {/* Header */}
        <div style={{ background: "#1a202c", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>👑</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Admin Dashboard</div>
              <div style={{ fontSize: 11, color: "#718096" }}>
                {users.length} users · {activeIncidents.length} active · {resolvedIncidents.length} resolved
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#718096", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: `1px solid ${isDark?"#2d3748":"#e2e8f0"}`, flexShrink: 0, background:isDark?"#1a1f2e":"#fff" }}>
          {[
            { key: "users",     label: `👤 Users (${users.length})` },
            { key: "active",    label: `🔴 Active (${activeIncidents.length})` },
            { key: "resolved",  label: `✅ Resolved (${resolvedIncidents.length})` },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: "12px 18px", fontSize: 13, fontWeight: 500,
              background: "none", border: "none", cursor: "pointer",
              borderBottom: tab === t.key ? "2px solid #6366f1" : "2px solid transparent",
              color: tab === t.key ? (isDark?"#a5b4fc":"#1a202c") : (isDark?"#6b7280":"#718096"),
              fontFamily: "inherit",
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: "8px 20px", background: isDark?"#2d1515":"#fff5f5", borderBottom: `1px solid ${isDark?"#7f1d1d":"#fed7d7"}`, fontSize: 12, color: "#fc8181", flexShrink: 0 }}>
            ⚠️ {error}
            <button onClick={() => setError("")} style={{ marginLeft: 8, background: "none", border: "none", cursor: "pointer", color: "#c53030", fontSize: 12 }}>✕</button>
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20, background:isDark?"#141824":"#fff", color:isDark?"#f1f5f9":"#1a202c" }}>
          {loading ? (
            <div style={{ textAlign: "center", color: "#a0aec0", padding: 40, fontSize: 14 }}>
              ⏳ Loading data…
            </div>
          ) : tab === "users" ? (

            // ── Users table ──
            users.length === 0 ? (
              <div style={{ textAlign: "center", color: "#a0aec0", padding: 40 }}>No users yet</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, background:isDark?"#141824":"#fff", border: `1px solid ${isDark?"#2d3748":"#e2e8f0"}`, borderRadius: 8, overflow: "hidden" }}>
                <thead>
                  <tr style={{ background: "#f7fafc" }}>
                    {["#", "Name", "Email", "Role", "Joined", "Incidents", "Action"].map(h => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: isDark?"#6b7280":"#718096", textTransform: "uppercase", letterSpacing: ".04em", borderBottom: `1px solid ${isDark?"#2d3748":"#e2e8f0"}` }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => {
                    const count = incidents.filter(inc => inc.reportedById === u._id?.toString()).length;
                    return (
                      <tr key={u._id} style={{ borderBottom: `1px solid ${isDark?"#1e2535":"#f0f0f0"}` }}>
                        <td style={{ padding: "10px 12px", color: "#a0aec0" }}>{i + 1}</td>
                        <td style={{ padding: "10px 12px", fontWeight: 600, color: isDark?"#f1f5f9":"#1a202c" }}>
                          {u.role === "admin" ? "👑 " : "👤 "}{u.name}
                          {u.blocked && (
                            <span style={{ marginLeft:6, fontSize:9, fontWeight:700, padding:"1px 6px", borderRadius:99, background:"#fff5f5", color:"#c53030", border:"1px solid #fca5a5" }}>
                              BLOCKED
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "10px 12px", color: isDark?"#9ca3af":"#4a5568" }}>{u.email}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
                            background: u.role === "admin" ? "#fffbeb" : "#f0fdf4",
                            color:      u.role === "admin" ? "#b45309"  : "#276749",
                            textTransform: "uppercase",
                          }}>{u.role}</span>
                        </td>
                        <td style={{ padding: "10px 12px", color: isDark?"#6b7280":"#718096", fontSize: 12 }}>
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ fontWeight: 700, color: count > 0 ? "#e53e3e" : "#a0aec0" }}>
                            {count}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          {u.role !== "admin" && (
                            <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                              <button
                                onClick={() => toggleBlock(u._id?.toString(), u.blocked)}
                                style={{
                                  fontSize: 11, padding: "4px 10px", borderRadius: 6,
                                  fontWeight: 600, cursor: "pointer",
                                  background: u.blocked ? "#f0fdf4" : "#fff5f5",
                                  color:      u.blocked ? "#276749" : "#c53030",
                                  border:     u.blocked ? "1px solid #86efac" : "1px solid #fca5a5",
                                }}
                              >
                                {u.blocked ? "🔓 Unblock" : "🚫 Block"}
                              </button>
                              {u.blocked && (
                                <button
                                  onClick={() => deleteUser(u._id?.toString())}
                                  style={{
                                    fontSize: 11, padding: "4px 10px", borderRadius: 6,
                                    fontWeight: 600, cursor: "pointer",
                                    background: "#e53e3e", color: "#fff",
                                    border: "1px solid #c53030",
                                  }}
                                >
                                  🗑 Delete
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )

          ) : (

            // ── Incidents table (active or resolved) ──
            (() => {
              const list = tab === "active" ? activeIncidents : resolvedIncidents;
              return list.length === 0 ? (
                <div style={{ textAlign: "center", color: "#a0aec0", padding: 40 }}>
                  {tab === "active" ? "No active incidents 🎉" : "No resolved incidents yet"}
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, background:isDark?"#141824":"#fff", border: `1px solid ${isDark?"#2d3748":"#e2e8f0"}`, borderRadius: 8, overflow: "hidden" }}>
                  <thead>
                    <tr style={{ background: isDark?"#1e2535":"#f7fafc" }}>
                      {["Type", "Zone", "Severity", "Reported By", "Description", "Time", "Actions"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: isDark?"#6b7280":"#718096", textTransform: "uppercase", letterSpacing: ".04em", borderBottom: `1px solid ${isDark?"#2d3748":"#e2e8f0"}` }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {list.map(inc => (
                      <tr key={inc._id} style={{ borderBottom: `1px solid ${isDark?"#1e2535":"#f0f0f0"}` }}>
                        <td style={{ padding: "10px 12px", fontWeight: 600, color: isDark?"#f1f5f9":"#1a202c" }}>⚠️ {inc.type}</td>
                        <td style={{ padding: "10px 12px", color: isDark?"#9ca3af":"#4a5568" }}>{inc.zone}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, textTransform: "capitalize",
                            background: severityColor(inc.severity) + "18",
                            color:      severityColor(inc.severity),
                            border:     `1px solid ${severityColor(inc.severity)}44`,
                          }}>{inc.severity}</span>
                        </td>
                        <td style={{ padding: "10px 12px", color: "#4a5568", fontSize: 12 }}>
                          {inc.reportedBy || "Anonymous"}
                        </td>
                        <td style={{ padding: "10px 12px", color: "#718096", fontSize: 11, maxWidth: 140 }}>
                          <div style={{ whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:130 }} title={inc.description}>
                            {inc.description || <span style={{ color: "#e2e8f0" }}>—</span>}
                          </div>
                        </td>
                        <td style={{ padding: "10px 12px", color: isDark?"#6b7280":"#718096", fontSize: 11, whiteSpace:"nowrap" }}>
                          {new Date(inc.timestamp).toLocaleString([], { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit", hour12:true })}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ display: "flex", gap: 6 }}>
                            {tab === "active" && (
                              <button onClick={() => resolveIncident(inc._id)} style={{
                                fontSize: 11, padding: "4px 10px", borderRadius: 6, fontWeight: 600,
                                background: "#f0fdf4", color: "#276749",
                                border: "1px solid #86efac", cursor: "pointer",
                              }}>
                                ✓ Resolve
                              </button>
                            )}
                            <button onClick={() => deleteIncident(inc._id)} style={{
                              fontSize: 11, padding: "4px 10px", borderRadius: 6, fontWeight: 600,
                              background: "#e53e3e", color: "#fff",
                              border: "1px solid #c53030", cursor: "pointer",
                            }}>
                              🗑 Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px", borderTop: `1px solid ${isDark?"#2d3748":"#e2e8f0"}`, flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center", background: isDark?"#1a1f2e":"#f9fafb" }}>
          <button onClick={fetchData} style={{
            fontSize: 12, padding: "6px 14px", borderRadius: 7,
            background: isDark?"#2d3748":"#fff", border: `1px solid ${isDark?"#4b5563":"#e2e8f0"}`,
            color: isDark?"#e2e8f0":"#4a5568", cursor: "pointer", fontFamily: "inherit",
          }}>
            🔄 Refresh Data
          </button>
          <button onClick={onClose} style={{
            fontSize: 12, padding: "6px 18px", borderRadius: 7,
            background: "#1a202c", border: "none",
            color: "#fff", cursor: "pointer", fontFamily: "inherit",
          }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}