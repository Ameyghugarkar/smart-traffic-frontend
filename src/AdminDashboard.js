// frontend/src/AdminDashboard.js — Full page (not overlay)

import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useAuth }  from "./AuthContext";
import { useTheme } from "./ThemeContext";
import { API_BASE_ROOT } from "./config";

const API = `${API_BASE_ROOT}/api`;
const severityColor = (s) =>
  s === "high" ? "#e53e3e" : s === "medium" ? "#ed8936" : "#38a169";

export default function AdminDashboard({ onClose }) {
  const { token }        = useAuth();
  const { theme, isDark } = useTheme();
  const [tab,       setTab]       = useState("users");
  const [users,     setUsers]     = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");

  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [uRes, iRes] = await Promise.all([
        axios.get(`${API}/auth/users`,    { headers, timeout: 5000 }),
        axios.get(`${API}/incidents/all`, { headers, timeout: 5000 }),
      ]);
      if (uRes.data?.success) setUsers(uRes.data.users);
      if (iRes.data?.success) setIncidents(iRes.data.incidents);
    } catch (err) {
      setError("Failed to load — " + (err.response?.data?.message || err.message));
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
      if (res.data?.success)
        setUsers(prev => prev.map(u =>
          u._id?.toString() === userId ? { ...u, blocked: res.data.blocked } : u
        ));
    } catch (err) { setError("Block failed: " + err.message); }
  };

  const deleteUser = async (userId) => {
    if (!window.confirm("Delete this user? This cannot be undone.")) return;
    try {
      await axios.delete(`${API}/auth/users/${userId}`, { headers });
      setUsers(prev => prev.filter(u => u._id?.toString() !== userId));
      setIncidents(prev => prev.filter(i => i.reportedById !== userId));
    } catch (err) { setError("Delete user failed: " + err.message); }
  };

  const resolveIncident = async (id) => {
    try {
      await axios.patch(`${API}/incidents/${id}`, {}, { headers });
      setIncidents(prev => prev.map(i => i._id === id ? { ...i, resolved: true } : i));
    } catch (err) { setError("Resolve failed: " + err.message); }
  };

  const activeIncidents   = incidents.filter(i => !i.resolved);
  const resolvedIncidents = incidents.filter(i => i.resolved);

  const thStyle = {
    padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700,
    color: isDark ? "#6b7280" : "#9ca3af", textTransform: "uppercase",
    letterSpacing: ".05em", borderBottom: `1px solid ${isDark ? "#2d3748" : "#f0f0f0"}`,
    background: isDark ? "#1e2535" : "#f7fafc", whiteSpace: "nowrap",
  };
  const tdStyle = {
    padding: "11px 14px", fontSize: 13,
    borderBottom: `1px solid ${isDark ? "#1e2535" : "#f9fafb"}`,
    color: isDark ? "#e2e8f0" : "#374151",
  };

  return (
    // ── Full-page wrapper — no fixed/overlay positioning ──────────────────────
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: theme.bg, fontFamily: "Inter, system-ui, sans-serif" }}>

      {/* ── Page header ── */}
      <div style={{ padding: "24px 32px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: isDark ? "#f1f5f9" : "#1a202c", display: "flex", alignItems: "center", gap: 10 }}>
              👑 Admin Dashboard
            </h1>
            <p style={{ margin: "5px 0 0", fontSize: 13, color: isDark ? "#9ca3af" : "#718096" }}>
              {users.length} registered users · {activeIncidents.length} active incidents · {resolvedIncidents.length} resolved
            </p>
          </div>
          <button onClick={fetchData} style={{
            fontSize: 12, padding: "8px 16px", borderRadius: 8, cursor: "pointer",
            background: "transparent", border: `1px solid ${isDark ? "#374151" : "#e2e8f0"}`,
            color: isDark ? "#9ca3af" : "#718096", fontWeight: 500,
          }}>
            🔄 Refresh
          </button>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", borderBottom: `2px solid ${isDark ? "#2d3748" : "#e2e8f0"}`, gap: 4 }}>
          {[
            { key: "users",    label: `👤 Users`,              count: users.length },
            { key: "active",   label: `🔴 Active Incidents`,   count: activeIncidents.length },
            { key: "resolved", label: `✅ Resolved`,           count: resolvedIncidents.length },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: "10px 18px", fontSize: 13, fontWeight: 600,
              background: "none", border: "none", cursor: "pointer",
              borderBottom: tab === t.key ? "2px solid #6366f1" : "2px solid transparent",
              marginBottom: -2,
              color: tab === t.key ? (isDark ? "#a5b4fc" : "#6366f1") : (isDark ? "#6b7280" : "#9ca3af"),
              fontFamily: "inherit",
            }}>
              {t.label}
              <span style={{ marginLeft: 6, fontSize: 11, padding: "1px 7px", borderRadius: 99, background: isDark ? "#2d3748" : "#f3f4f6", color: isDark ? "#9ca3af" : "#6b7280" }}>
                {t.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div style={{ margin: "0 32px", padding: "8px 14px", background: isDark ? "#2d1515" : "#fff5f5", border: `1px solid ${isDark ? "#7f1d1d" : "#fca5a5"}`, borderRadius: 8, fontSize: 12, color: "#fc8181", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, marginTop: 12 }}>
          ⚠️ {error}
          <button onClick={() => setError("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#c53030", fontSize: 14, lineHeight: 1 }}>✕</button>
        </div>
      )}

      {/* ── Table content ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 32px 32px" }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "#a0aec0", padding: 60, fontSize: 14 }}>⏳ Loading admin data…</div>
        ) : tab === "users" ? (

          // ── Users table ────────────────────────────────────────────────────
          users.length === 0 ? (
            <div style={{ textAlign: "center", color: "#a0aec0", padding: 60 }}>No users yet</div>
          ) : (
            <div style={{ background: isDark ? "#1a1f2e" : "#fff", borderRadius: 12, border: `1px solid ${isDark ? "#2d3748" : "#e2e8f0"}`, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["#", "Name", "Email", "Role", "Joined", "Incidents", "Actions"].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => {
                    const count = incidents.filter(inc => inc.reportedById === u._id?.toString()).length;
                    return (
                      <tr key={u._id} style={{ background: i % 2 === 0 ? (isDark ? "#1a1f2e" : "#fff") : (isDark ? "#141824" : "#fafafa") }}>
                        <td style={{ ...tdStyle, color: "#a0aec0", width: 40 }}>{i + 1}</td>
                        <td style={{ ...tdStyle, fontWeight: 600, color: isDark ? "#f1f5f9" : "#1a202c" }}>
                          {u.role === "admin" ? "👑 " : "👤 "}{u.name}
                          {u.blocked && (
                            <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 99, background: "#fff5f5", color: "#c53030", border: "1px solid #fca5a5" }}>
                              BLOCKED
                            </span>
                          )}
                        </td>
                        <td style={{ ...tdStyle, color: isDark ? "#9ca3af" : "#4a5568" }}>{u.email}</td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: u.role === "admin" ? "#fffbeb" : "#f0fdf4", color: u.role === "admin" ? "#b45309" : "#276749", textTransform: "uppercase" }}>
                            {u.role}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, fontSize: 12, color: isDark ? "#6b7280" : "#718096" }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                        <td style={{ ...tdStyle, fontWeight: 700, color: count > 0 ? "#e53e3e" : "#a0aec0", textAlign: "center" }}>{count}</td>
                        <td style={tdStyle}>
                          {u.role !== "admin" && (
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={() => toggleBlock(u._id?.toString(), u.blocked)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, fontWeight: 600, cursor: "pointer", background: u.blocked ? "#f0fdf4" : "#fff5f5", color: u.blocked ? "#276749" : "#c53030", border: u.blocked ? "1px solid #86efac" : "1px solid #fca5a5" }}>
                                {u.blocked ? "🔓 Unblock" : "🚫 Block"}
                              </button>
                              {u.blocked && (
                                <button onClick={() => deleteUser(u._id?.toString())} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, fontWeight: 600, cursor: "pointer", background: "#e53e3e", color: "#fff", border: "1px solid #c53030" }}>
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
            </div>
          )

        ) : (

          // ── Incidents table (active / resolved) ────────────────────────────
          (() => {
            const list = tab === "active" ? activeIncidents : resolvedIncidents;
            return list.length === 0 ? (
              <div style={{ textAlign: "center", color: "#a0aec0", padding: 60 }}>
                {tab === "active" ? "No active incidents 🎉" : "No resolved incidents yet"}
              </div>
            ) : (
              <div style={{ background: isDark ? "#1a1f2e" : "#fff", borderRadius: 12, border: `1px solid ${isDark ? "#2d3748" : "#e2e8f0"}`, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Type", "Zone", "Severity", "Reported By", "Description", "Time", "Actions"].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((inc, i) => (
                      <tr key={inc._id} style={{ background: i % 2 === 0 ? (isDark ? "#1a1f2e" : "#fff") : (isDark ? "#141824" : "#fafafa") }}>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>⚠️ {inc.type}</td>
                        <td style={{ ...tdStyle, color: isDark ? "#9ca3af" : "#4a5568" }}>{inc.zone}</td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, textTransform: "capitalize", background: severityColor(inc.severity) + "18", color: severityColor(inc.severity), border: `1px solid ${severityColor(inc.severity)}44` }}>
                            {inc.severity}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, fontSize: 12 }}>{inc.reportedBy || "Anonymous"}</td>
                        <td style={{ ...tdStyle, fontSize: 12, color: isDark ? "#9ca3af" : "#718096", maxWidth: 160 }}>
                          <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 150 }} title={inc.description}>
                            {inc.description || "—"}
                          </div>
                        </td>
                        <td style={{ ...tdStyle, fontSize: 11, whiteSpace: "nowrap", color: isDark ? "#6b7280" : "#9ca3af" }}>
                          {new Date(inc.timestamp).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", gap: 6 }}>
                            {tab === "active" && (
                              <button onClick={() => resolveIncident(inc._id)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, fontWeight: 600, background: "#f0fdf4", color: "#276749", border: "1px solid #86efac", cursor: "pointer" }}>
                                ✓ Resolve
                              </button>
                            )}
                            <button onClick={() => deleteIncident(inc._id)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, fontWeight: 600, background: "#e53e3e", color: "#fff", border: "1px solid #c53030", cursor: "pointer" }}>
                              🗑 Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
}