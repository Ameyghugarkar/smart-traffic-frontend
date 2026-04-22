// frontend/src/AuthContext.js

import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import { API_AUTH } from "./config";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(localStorage.getItem("token") || null);
  const [loading, setLoading] = useState(true);

  // On mount — verify stored token
  useEffect(() => {
    const verify = async () => {
      if (!token) { setLoading(false); return; }
      try {
        const res = await axios.get(`${API_AUTH}/me`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 5000,
        });
        if (res.data?.success) setUser(res.data.user);
        else logout();
      } catch { logout(); }
      finally { setLoading(false); }
    };
    verify();
  }, []); // eslint-disable-line

  const login = async (email, password) => {
    const res = await axios.post(`${API_AUTH}/login`, { email, password });
    if (res.data?.success) {
      setToken(res.data.token);
      setUser(res.data.user);
      localStorage.setItem("token", res.data.token);
      return { success: true };
    }
    return { success: false, message: res.data.message };
  };

  const register = async (name, email, password) => {
    const res = await axios.post(`${API_AUTH}/register`, { name, email, password });
    if (res.data?.success) {
      setToken(res.data.token);
      setUser(res.data.user);
      localStorage.setItem("token", res.data.token);
      return { success: true };
    }
    return { success: false, message: res.data.message };
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("token");
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);