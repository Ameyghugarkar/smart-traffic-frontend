// pages/ChatPage.js
// Full-page Gemini-powered traffic assistant

import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { API_BASE_ROOT } from "../config";
import { useTheme } from "../ThemeContext";

const API_CHAT = `${API_BASE_ROOT}/api/chat`;

const SUGGESTIONS = [
  "Which zone is most congested right now?",
  "Where should I avoid driving?",
  "What's the best time to travel today?",
  "How is traffic compared to this morning?",
  "Which zone has the least traffic?",
  "Give me a quick traffic summary for Pune",
];

// Inject keyframes
if (!document.getElementById("chat-page-anims")) {
  const s = document.createElement("style");
  s.id = "chat-page-anims";
  s.textContent = `
    @keyframes chatFadeIn {
      from { opacity:0; transform:translateY(10px); }
      to   { opacity:1; transform:translateY(0);   }
    }
    @keyframes chatPulse {
      0%,80%,100% { transform:scale(0); opacity:0.4; }
      40%         { transform:scale(1); opacity:1;   }
    }
  `;
  document.head.appendChild(s);
}

const TypingDots = () => (
  <div style={{ display:"flex", gap:4, padding:"12px 16px", alignItems:"center" }}>
    {[0,1,2].map(i => (
      <div key={i} style={{
        width:8, height:8, borderRadius:"50%", background:"#6366f1",
        animation: "chatPulse 1.2s ease-in-out " + (i * 0.2) + "s infinite",
      }}/>
    ))}
  </div>
);

const formatText = (text) => {
  if (!text) return null;
  return text.split('\n').map((line, i) => {
    const isList = line.trim().startsWith('* ') || line.trim().startsWith('- ');
    const content = isList ? line.trim().substring(2) : line;
    
    // Bold parsing
    const parts = content.split(/\*\*(.*?)\*\*/g);
    const formatted = parts.map((part, idx) => 
      idx % 2 === 1 ? <strong key={idx} style={{ color:"inherit" }}>{part}</strong> : part
    );

    if (isList) {
      return (
        <div key={i} style={{ display:'flex', gap:8, marginTop:4, marginBottom:4 }}>
          <span style={{ color:'#6366f1', fontWeight:'bold' }}>•</span>
          <div style={{ flex:1 }}>{formatted}</div>
        </div>
      );
    }
    return <div key={i} style={{ minHeight: i === 0 ? 0 : 8 }}>{formatted}</div>;
  });
};

const MessageBubble = ({ msg, isDark }) => {
  const isUser = msg.role === "user";
  return (
    <div style={{
      display:"flex", justifyContent: isUser ? "flex-end" : "flex-start",
      marginBottom:20, animation:"chatFadeIn 0.3s ease", width:"100%"
    }}>
      {!isUser && (
        <div style={{
          width:36, height:36, borderRadius:"50%", background:"linear-gradient(135deg,#6366f1,#8b5cf6)",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:18, flexShrink:0, marginRight:12, marginTop:2,
          boxShadow:"0 4px 12px rgba(99,102,241,0.3)",
        }}>🤖</div>
      )}

      <div style={{
        maxWidth:"75%",
        background: isUser
          ? "linear-gradient(135deg,#6366f1,#8b5cf6)"
          : (isDark ? "#1e2535" : "#fff"),
        color: isUser ? "#fff" : (isDark ? "#e2e8f0" : "#1a202c"),
        borderRadius: isUser ? "20px 20px 4px 20px" : "20px 20px 20px 4px",
        padding:"16px 20px",
        fontSize:15, lineHeight:1.6,
        boxShadow: isUser
          ? "0 6px 16px rgba(99,102,241,0.3)"
          : (isDark ? "0 4px 12px rgba(0,0,0,0.3)" : "0 2px 8px rgba(0,0,0,0.05)"),
        border: isUser ? "none" : ("1px solid " + (isDark?"#2d3748":"#e2e8f0")),
        whiteSpace:"pre-wrap",
        wordBreak:"break-word",
      }}>
        {formatText(msg.text)}
        <div style={{
          fontSize:11, marginTop:8, opacity:0.6, textAlign:"right",
          color: isUser ? "rgba(255,255,255,0.8)" : (isDark?"#9ca3af":"#718096"),
        }}>
          {msg.time}
        </div>
      </div>

      {isUser && (
        <div style={{
          width:36, height:36, borderRadius:"50%", background:"#4299e1",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:18, flexShrink:0, marginLeft:12, marginTop:2,
          boxShadow:"0 4px 12px rgba(66,153,225,0.3)",
        }}>👤</div>
      )}
    </div>
  );
};

export default function ChatPage() {
  const { isDark } = useTheme();
  const [messages, setMessages] = useState([
    {
      role:"ai", text:
        "👋 Hi! I'm **PuneTrafficAI**, your smart traffic assistant.\n\nAsk me anything about current Pune traffic — which zones are congested, best travel times, or a quick summary!",
      time: new Date().toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit", hour12:true }),
    }
  ]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [showSugg, setShowSugg] = useState(true);

  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [messages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    const time = new Date().toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit", hour12:true });
    const userMsg = { role:"user", text:msg, time };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setShowSugg(false);

    const history = messages.slice(-10).map(m => ({ role: m.role, text: m.text }));

    try {
      const res = await axios.post(API_CHAT, { message: msg, history }, { timeout:25000 });
      const aiMsg = {
        role:"ai",
        text: res.data.reply || "Sorry, I couldn't get a response. Try again!",
        time: new Date().toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit", hour12:true }),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      const errText = err.response?.data?.error || "AI assistant is unavailable. Check your Gemini API key.";
      setMessages(prev => [...prev, {
        role:"ai", text: "⚠️ " + errText,
        time: new Date().toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit", hour12:true }),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([{
      role:"ai", text:"Chat cleared! How can I help you with Pune traffic?",
      time: new Date().toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit", hour12:true }),
    }]);
    setShowSugg(true);
  };

  const surface  = isDark ? "#111827" : "#f8fafc";
  const border   = isDark ? "#2d3748" : "#e2e8f0";
  const textMain = isDark ? "#f1f5f9" : "#1a202c";
  const textMute = isDark ? "#9ca3af" : "#718096";

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:surface }}>
      
      {/* ── Header ── */}
      <div style={{
        padding:"20px 40px", borderBottom: "1px solid " + border,
        display:"flex", alignItems:"center", justifyContent:"space-between",
        background: isDark ? "#1a202c" : "#fff", flexShrink:0
      }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:700, color:textMain, display:"flex", alignItems:"center", gap:10 }}>
            <span>🤖</span> PuneTrafficAI
          </h1>
          <div style={{ fontSize:13, color:textMute, marginTop:4, display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ width:8, height:8, borderRadius:"50%", background:"#10b981", display:"inline-block" }}/>
            Powered by Gemini 2.5 Flash · Analyzing live Pune traffic data
          </div>
        </div>
        <button
          onClick={clearChat}
          style={{
            padding:"8px 16px", borderRadius:8, fontSize:13, fontWeight:600,
            background: isDark ? "#2d3748" : "#edf2f7", color: isDark ? "#e2e8f0" : "#4a5568",
            border:"none", cursor:"pointer", transition:"all 0.2s"
          }}
          onMouseEnter={e => e.currentTarget.style.background = isDark ? "#4a5568" : "#e2e8f0"}
          onMouseLeave={e => e.currentTarget.style.background = isDark ? "#2d3748" : "#edf2f7"}
        >
          🗑 Clear Chat
        </button>
      </div>

      {/* ── Chat History ── */}
      <div style={{
        flex:1, overflowY:"auto", padding:"40px 20px",
        display:"flex", flexDirection:"column", alignItems:"center",
        scrollBehavior:"smooth"
      }}>
        <div style={{ width:"100%", maxWidth:800 }}>
          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} isDark={isDark} />
          ))}

          {loading && (
            <div style={{ display:"flex", justifyContent:"flex-start", marginBottom:20, animation:"chatFadeIn 0.2s ease" }}>
              <div style={{
                width:36, height:36, borderRadius:"50%", background:"linear-gradient(135deg,#6366f1,#8b5cf6)",
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0, marginRight:12, marginTop:2,
              }}>🤖</div>
              <div style={{
                background: isDark ? "#1e2535" : "#fff",
                borderRadius:"20px 20px 20px 4px",
                border: "1px solid " + (isDark?"#2d3748":"#e2e8f0"),
              }}>
                <TypingDots />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Input Area ── */}
      <div style={{
        padding:"20px 40px 40px", flexShrink:0,
        display:"flex", flexDirection:"column", alignItems:"center",
        background: isDark ? "linear-gradient(to top, #111827 70%, transparent)" : "linear-gradient(to top, #f8fafc 70%, transparent)",
      }}>
        <div style={{ width:"100%", maxWidth:800 }}>
          
          {/* Suggestions */}
          {showSugg && !loading && (
            <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:16, justifyContent:"center" }}>
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i} onClick={() => sendMessage(s)}
                  style={{
                    fontSize:13, padding:"8px 16px", borderRadius:99,
                    border: "1px solid " + (isDark?"#4a5568":"#cbd5e0"),
                    background: isDark ? "#1e2535" : "#fff",
                    color: isDark ? "#e2e8f0" : "#4a5568",
                    cursor:"pointer", transition:"all 0.15s", fontFamily:"inherit"
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor="#6366f1";
                    e.currentTarget.style.color="#6366f1";
                    e.currentTarget.style.background=isDark?"#1e1b4b":"#eef2ff";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor=isDark?"#4a5568":"#cbd5e0";
                    e.currentTarget.style.color=isDark?"#e2e8f0":"#4a5568";
                    e.currentTarget.style.background=isDark?"#1e2535":"#fff";
                  }}
                >{s}</button>
              ))}
            </div>
          )}

          {/* Textbox */}
          <div style={{
            position:"relative", display:"flex", alignItems:"flex-end",
            background: isDark ? "#1a202c" : "#fff",
            border: "1px solid " + (isDark?"#4a5568":"#cbd5e0"),
            borderRadius:24, padding:"8px 12px 8px 20px",
            boxShadow: isDark ? "0 8px 30px rgba(0,0,0,0.5)" : "0 8px 30px rgba(0,0,0,0.08)",
            transition:"border-color 0.2s, box-shadow 0.2s",
            minHeight: 56, boxSizing: "border-box"
          }}
          onFocusCapture={e => e.currentTarget.style.borderColor="#6366f1"}
          onBlurCapture={e => e.currentTarget.style.borderColor=isDark?"#4a5568":"#cbd5e0"}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Message PuneTrafficAI..."
              rows={1}
              style={{
                flex:1, resize:"none", border:"none", background:"transparent",
                color:textMain, fontSize:15, outline:"none",
                fontFamily:"'DM Sans',system-ui,sans-serif", lineHeight:1.5,
                maxHeight:200, padding:"8px 0", margin:0,
              }}
              onInput={e => {
                e.target.style.height="auto";
                e.target.style.height=Math.min(e.target.scrollHeight, 200)+"px";
              }}
              disabled={loading}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              style={{
                width:40, height:40, borderRadius:"50%", border:"none",
                background: input.trim() && !loading ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : (isDark?"#2d3748":"#e2e8f0"),
                color: input.trim() && !loading ? "#fff" : textMute,
                fontSize:18, cursor: input.trim() && !loading ? "pointer" : "default",
                display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
                marginLeft:12, transition:"all 0.2s", marginBottom: 2,
                boxShadow: input.trim() && !loading ? "0 4px 12px rgba(99,102,241,0.4)" : "none",
              }}
            >➤</button>
          </div>
          
          <div style={{ textAlign:"center", fontSize:11, color:textMute, marginTop:12 }}>
            PuneTrafficAI can make mistakes. Verify critical traffic information on the Dashboard.
          </div>
        </div>
      </div>
    </div>
  );
}

