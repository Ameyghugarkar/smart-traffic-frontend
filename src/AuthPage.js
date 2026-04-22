// frontend/src/AuthPage.js
// Login + Register page — shown when user clicks "Login" in top bar

import React, { useState } from "react";
import { useAuth } from "./AuthContext";

export default function AuthPage({ onClose }) {
  const { login, register } = useAuth();
  const [mode,    setMode]    = useState("login"); // login | register
  const [name,    setName]    = useState("");
  const [email,   setEmail]   = useState("");
  const [password, setPassword] = useState("");
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(""); 
    // Validate email format before hitting backend
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(email)) {
      setError("Enter a valid email address (e.g. name@gmail.com)");
      return;
    }
    if (mode === "register" && password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      const result = mode === "login"
        ? await login(email, password)
        : await register(name, email, password);

      if (result.success) onClose();
      else setError(result.message || "Something went wrong");
    } catch (err) {
      setError(err.response?.data?.message || "Server error — is backend running?");
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, padding: 32,
        width: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        fontFamily: "Inter, system-ui, sans-serif",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#1a202c" }}>
              {mode === "login" ? "Welcome back" : "Create account"}
            </div>
            <div style={{ fontSize: 12, color: "#718096", marginTop: 2 }}>
              {mode === "login" ? "Login to report incidents" : "Join Smart Traffic Monitor"}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#a0aec0" }}>✕</button>
        </div>

        {/* Form */}
        {mode === "register" && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Full Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={inputStyle}/>
          </div>
        )}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Email</label>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" type="email" style={inputStyle}/>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Password</label>
          <input value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••" type="password" style={inputStyle}/>
        </div>

        {error && (
          <div style={{ fontSize: 12, color: "#c53030", background: "#fff5f5", border: "1px solid #fed7d7", borderRadius: 8, padding: "8px 12px", marginBottom: 14 }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: "100%", padding: "11px 0", borderRadius: 9,
            background: loading ? "#a0aec0" : "#1a202c",
            color: "#fff", border: "none", fontSize: 14,
            fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
            fontFamily: "inherit",
          }}
        >
          {loading ? "Please wait…" : mode === "login" ? "Login" : "Create Account"}
        </button>

        {/* Toggle mode */}
        <div style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: "#718096" }}>
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
            style={{ background: "none", border: "none", color: "#4299e1", fontWeight: 600, cursor: "pointer", fontSize: 12 }}
          >
            {mode === "login" ? "Sign up" : "Login"}
          </button>
        </div>

        {/* Admin hint */}
        <div style={{ marginTop: 16, padding: "8px 12px", background: "#f7fafc", borderRadius: 8, fontSize: 11, color: "#718096", textAlign: "center" }}>
          Admin: admin@traffic.com / admin123
        </div>
      </div>
    </div>
  );
}

const labelStyle = { fontSize: 11, fontWeight: 600, color: "#4a5568", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".04em" };
const inputStyle = { width: "100%", padding: "9px 12px", fontSize: 13, border: "1px solid #e2e8f0", borderRadius: 8, outline: "none", boxSizing: "border-box", fontFamily: "inherit", background: "#f9fafb" };