import React from "react";
import ReactDOM from "react-dom/client";
import axios from "axios";
import "./index.css";
import App from "./App";
import { AuthProvider }  from "./AuthContext";
import { ThemeProvider } from "./ThemeContext";

// ── Disable browser caching for all API calls ──────────────────────────────
// Without this, the browser serves stale responses on first page load
// and you have to manually refresh to see current traffic data.
axios.defaults.headers.common["Cache-Control"] = "no-cache, no-store";
axios.defaults.headers.common["Pragma"]        = "no-cache";


const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <ThemeProvider>
    <AuthProvider>
      <App />
    </AuthProvider>
  </ThemeProvider>
);