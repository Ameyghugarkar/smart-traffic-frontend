// frontend/src/ThemeContext.js

import React, { createContext, useContext, useState } from "react";

const light = {
  bg:           "#f7fafc",
  surface:      "#ffffff",
  surfaceAlt:   "#f9fafb",
  border:       "#e5e7eb",
  borderStrong: "#d1d5db",
  text:         "#111827",
  textSub:      "#4a5568",
  textMuted:    "#9ca3af",
  appBar:       "#1a202c",
  appBarText:   "#ffffff",
  appBarSub:    "#718096",
  toggleBg:     "transparent",
  toggleBorder: "#4a5568",
  toggleColor:  "#a0aec0",
  toggleActive: "#2d3748",
  cardShadow:   "none",
  mapTile:      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
};

const dark = {
  bg:           "#0f1117",
  surface:      "#1a1f2e",
  surfaceAlt:   "#141824",
  border:       "#2d3748",
  borderStrong: "#4a5568",
  text:         "#f0f4f8",
  textSub:      "#a0aec0",
  textMuted:    "#718096",
  appBar:       "#0d1117",
  appBarText:   "#f0f4f8",
  appBarSub:    "#4a5568",
  toggleBg:     "transparent",
  toggleBorder: "#2d3748",
  toggleColor:  "#718096",
  toggleActive: "#2d3748",
  cardShadow:   "0 1px 3px rgba(0,0,0,0.4)",
  mapTile:      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
};

const ThemeContext = createContext({ isDark: false, theme: light, toggle: () => {} });

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(false);

  const toggle = () => setIsDark(v => {
    const next = !v;
    // Apply/remove dark scrollbar class on body
    if (next) {
      document.documentElement.classList.add("dark-mode");
    } else {
      document.documentElement.classList.remove("dark-mode");
    }
    return next;
  });
  return (
    <ThemeContext.Provider value={{ isDark, theme: isDark ? dark : light, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
export { light, dark };