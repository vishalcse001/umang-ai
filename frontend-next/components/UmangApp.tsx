"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, Square, Send, ArrowLeft, X, Plus, Settings,
  Newspaper, Bell, Camera, Video, Users, MessageSquare,
  BookHeart, Siren, CheckCircle, Trash2, ChevronLeft, ChevronRight, Loader2
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const WS  = process.env.NEXT_PUBLIC_WS_URL  || "ws://localhost:8000";

type Bezier = [number, number, number, number];
const EASE: Bezier = [0.16, 1, 0.3, 1];

const pv = {
  initial: { opacity: 0, y: 24, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: EASE } },
  exit:    { opacity: 0, y: -12, transition: { duration: 0.22, ease: "easeIn" as const } },
};

/* ── Time helpers ─────────────────────────────────────────────────── */
function greet(now: Date) {
  const h = now.getHours();
  if (h >= 5  && h < 12) return { text: "Good Morning",   emoji: "🌅", sub: "Hope you slept well!" };
  if (h >= 12 && h < 17) return { text: "Good Afternoon", emoji: "☀️", sub: "How's your day going?" };
  if (h >= 17 && h < 21) return { text: "Good Evening",   emoji: "🌇", sub: "Time to relax." };
  return                          { text: "Good Night",    emoji: "🌙", sub: "Rest well tonight." };
}
const fmtT = (d: Date) => d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
const fmtD = (d: Date) => d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });

/* ── Shared styles ────────────────────────────────────────────────── */
const S = {
  page:  { minHeight: "100vh", display: "flex", flexDirection: "column" as const, alignItems: "center", padding: "32px 20px 48px" },
  card:  { background: "rgba(255,255,255,0.04)", backdropFilter: "blur(32px)", WebkitBackdropFilter: "blur(32px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 32, boxShadow: "0 32px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)" },
  input: { width: "100%", padding: "13px 18px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#f3f4f6", fontFamily: "Inter, sans-serif", fontSize: 15, outline: "none" } as React.CSSProperties,
  btnPrimary: { background: "linear-gradient(135deg,#ff8a5c,#ea580c)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600, boxShadow: "0 8px 24px rgba(234,88,12,.35)", transition: "all .2s" } as React.CSSProperties,
  btnGhost:  { background: "rgba(255,255,255,0.07)", border: "none", color: "#d1d5db", cursor: "pointer", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", transition: "background .15s" } as React.CSSProperties,
  w600: { width: "100%", maxWidth: 600 } as React.CSSProperties,
};

/* ── Glow background ─────────────────────────────────────────────── */
function Bg() {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -200, left: -150, width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,138,92,0.38) 0%, transparent 68%)", filter: "blur(80px)" }} />
      <div style={{ position: "absolute", bottom: -200, right: -150, width: 650, height: 650, borderRadius: "50%", background: "radial-gradient(circle, rgba(168,85,247,0.3) 0%, transparent 68%)", filter: "blur(80px)" }} />
      <div style={{ position: "absolute", top: "45%", left: "50%", transform: "translate(-50%,-50%)", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(56,189,248,0.1) 0%, transparent 70%)", filter: "blur(60px)" }} />
    </div>
  );
}

/* ── Orb ─────────────────────────────────────────────────────────── */
function Orb({ size = 56, spin = true }: { size?: number; spin?: boolean }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "conic-gradient(from 180deg, #ff8a5c 0%, #e8734a 25%, #ffcba3 50%, #a855f7 75%, #ff8a5c 100%)",
      boxShadow: `0 0 ${size * 0.65}px rgba(255,138,92,0.55)`,
      animation: spin ? "orbSpin 8s linear infinite" : "none",
    }} />
  );
}

/* ── ActionCard ──────────────────────────────────────────────────── */
function Card({ icon, label, desc, grad, glow, onClick, i }: {
  icon: React.ReactNode; label: string; desc: string;
  grad: string; glow: string; onClick: () => void; i: number;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.35, ease: EASE } }}
      whileHover={{ y: -4, scale: 1.015, boxShadow: "0 16px 48px rgba(0,0,0,0.35)", transition: { duration: 0.18 } }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      style={{
        display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 14,
        padding: "22px 20px", borderRadius: 24, cursor: "pointer", textAlign: "left", width: "100%",
        background: "rgba(255,255,255,0.04)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 6px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      <div style={{ width: 48, height: 48, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0, background: grad, boxShadow: glow }}>
        {icon}
      </div>
      <div>
        <span style={{ display: "block", fontSize: 15, fontWeight: 600, color: "#f3f4f6", lineHeight: 1.3, marginBottom: 4 }}>{label}</span>
        <span style={{ display: "block", fontSize: 12.5, color: "#9ca3af", lineHeight: 1.45 }}>{desc}</span>
      </div>
    </motion.button>
  );
}

/* ── BackBtn ─────────────────────────────────────────────────────── */
function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <motion.button whileTap={{ scale: 0.88 }} onClick={onClick}
      style={{ ...S.btnGhost, width: 38, height: 38, borderRadius: 38 }}>
      <ArrowLeft size={17} />
    </motion.button>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
export default function UmangApp() {
  const [userName, setUserName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [view, setView] = useState("home");
  const [now, setNow] = useState(new Date());

  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [voiceState, setVoiceState] = useState("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [avatarInput, setAvatarInput] = useState("");
  const [avatarStatus, setAvatarStatus] = useState("idle");
  const [avatarVideoUrl, setAvatarVideoUrl] = useState<string | null>(null);
  const [avatarElapsed, setAvatarElapsed] = useState(0);
  const avatarTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [newsSummary, setNewsSummary] = useState("");
  const [newsLoading, setNewsLoading] = useState(false);

  const [remindersList, setRemindersList] = useState<any[]>([]);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [newReminderTitle, setNewReminderTitle] = useState("");
  const [newReminderTime, setNewReminderTime] = useState("");

  const [familyEmail, setFamilyEmail] = useState("");
  const [settingsStatus, setSettingsStatus] = useState("idle");
  const [sosStatus, setSosStatus] = useState("idle");

  const [moodStatus, setMoodStatus] = useState("idle");
  const [moodResult, setMoodResult] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const moodStreamRef = useRef<MediaStream | null>(null);

  const [checkins, setCheckins] = useState<any[]>([]);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [historyMessages, setHistoryMessages] = useState<any[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [diaryEntries, setDiaryEntries] = useState<any[]>([]);
  const [diaryMood, setDiaryMood] = useState("good");
  const [diaryNote, setDiaryNote] = useState("");
  const [diaryEnergy, setDiaryEnergy] = useState(3);
  const [diaryStatus, setDiaryStatus] = useState("idle");

  useEffect(() => { const s = localStorage.getItem("umang_user_name"); if (s) setUserName(s); }, []);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);

  const connectWS = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return wsRef.current!;
    const ws = new WebSocket(`${WS}/ws/chat`);
    wsRef.current = ws;
    return ws;
  }, []);

  useEffect(() => {
    if (userName) { connectWS(); fetchCheckins(); }
    return () => wsRef.current?.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userName]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (view === "settings") fetchSettings();
    if (view === "reminders") fetchReminders();
    if (view === "news") fetchNews();
    if (view === "family") fetchDashboard();
    if (view === "history") fetchHistory(1);
    if (view === "diary") fetchDiaryEntries();
    if (view === "mood") startMoodCamera();
    else stopMoodCamera();
    return () => stopMoodCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, userName]);

  /* API */
  async function fetchCheckins() { try { const r = await fetch(`${API}/pending-checkins?user_name=${encodeURIComponent(userName)}`); setCheckins(await r.json()); } catch {} }
  async function dismissCheckin(id: number) { await fetch(`${API}/pending-checkins/${id}/dismiss`, { method: "POST" }); setCheckins(p => p.filter(c => c.id !== id)); }
  async function fetchDashboard() { setDashboardLoading(true); try { const r = await fetch(`${API}/family-dashboard?user_name=${encodeURIComponent(userName)}`); setDashboardData(await r.json()); } catch {} setDashboardLoading(false); }
  async function fetchSettings() { try { const r = await fetch(`${API}/user-settings?user_name=${encodeURIComponent(userName)}`); const d = await r.json(); setFamilyEmail(d.family_email || ""); } catch {} }
  async function saveSettings() { setSettingsStatus("saving"); try { await fetch(`${API}/user-settings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_name: userName, family_email: familyEmail }) }); setSettingsStatus("saved"); } catch { setSettingsStatus("error"); } setTimeout(() => setSettingsStatus("idle"), 3000); }
  async function triggerSOS() { if (sosStatus === "sending") return; setSosStatus("sending"); try { const r = await fetch(`${API}/sos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_name: userName }) }); const d = await r.json(); setSosStatus(d.status === "sent" ? "sent" : "error"); } catch { setSosStatus("error"); } setTimeout(() => setSosStatus("idle"), 5000); }
  async function fetchNews() { setNewsLoading(true); try { const r = await fetch(`${API}/daily-news?user_name=${encodeURIComponent(userName)}`); const d = await r.json(); setNewsSummary(d.summary || "No news."); } catch { setNewsSummary("Failed to load news."); } setNewsLoading(false); }
  async function fetchReminders() { setRemindersLoading(true); try { const r = await fetch(`${API}/reminders?user_name=${encodeURIComponent(userName)}`); setRemindersList(await r.json()); } catch {} setRemindersLoading(false); }
  async function addReminder() { if (!newReminderTitle.trim() || !newReminderTime) return; await fetch(`${API}/reminders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_name: userName, title: newReminderTitle, reminder_time: newReminderTime }) }); setNewReminderTitle(""); setNewReminderTime(""); fetchReminders(); }
  async function completeReminder(id: number) { await fetch(`${API}/reminders/${id}/complete`, { method: "POST" }); fetchReminders(); }
  async function deleteReminder(id: number) { await fetch(`${API}/reminders/${id}`, { method: "DELETE" }); fetchReminders(); }
  async function fetchHistory(page = 1) { setHistoryLoading(true); try { const r = await fetch(`${API}/conversation-history?user_name=${encodeURIComponent(userName)}&page=${page}&page_size=20`); const d = await r.json(); setHistoryMessages(d.messages || []); setHistoryTotal(d.total || 0); setHistoryPage(page); } catch {} setHistoryLoading(false); }
  async function fetchDiaryEntries() { try { const r = await fetch(`${API}/health-diary?user_name=${encodeURIComponent(userName)}&days=14`); setDiaryEntries(await r.json()); } catch {} }
  async function saveDiaryEntry() { if (diaryStatus === "saving") return; setDiaryStatus("saving"); try { await fetch(`${API}/health-diary`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_name: userName, mood: diaryMood, note: diaryNote, energy: diaryEnergy }) }); setDiaryNote(""); setDiaryStatus("saved"); fetchDiaryEntries(); } catch { setDiaryStatus("error"); } setTimeout(() => setDiaryStatus("idle"), 3000); }

  /* Chat */
  async function sendMsg(init?: string) {
    const msg = (init ?? inputText).trim();
    if (!msg || isSending) return;
    setView("chat");
    setMessages(p => [...p, { role: "user", text: msg }]);
    setInputText(""); setIsSending(true);
    setMessages(p => [...p, { role: "assistant", text: "" }]);
    let full = "";
    const ws = connectWS();
    await new Promise<void>(resolve => {
      ws.onmessage = ev => {
        if (ev.data === "__END__") { setIsSending(false); resolve(); return; }
        full += ev.data;
        setMessages(p => { const u = [...p]; u[u.length - 1] = { role: "assistant", text: full }; return u; });
      };
      ws.onerror = () => { setIsSending(false); resolve(); };
      const go = () => ws.readyState === WebSocket.OPEN
        ? ws.send(JSON.stringify({ message: msg, user_name: userName }))
        : ws.addEventListener("open", () => ws.send(JSON.stringify({ message: msg, user_name: userName })), { once: true });
      go();
    });
  }

  /* Voice */
  async function toggleVoice() {
    if (voiceState === "idle") {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      mediaRecorderRef.current = rec; audioChunksRef.current = [];
      rec.ondataavailable = e => audioChunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const fd = new FormData(); fd.append("file", blob, "rec.webm");
        setVoiceState("thinking");
        try {
          const r = await fetch(`${API}/voice-chat?user_name=${encodeURIComponent(userName)}`, { method: "POST", body: fd });
          const ab = await r.blob();
          const audio = new Audio(URL.createObjectURL(ab));
          setVoiceState("speaking"); audio.onended = () => setVoiceState("idle"); audio.play();
        } catch { setVoiceState("idle"); }
      };
      rec.start(); setVoiceState("listening");
    } else if (voiceState === "listening") { mediaRecorderRef.current?.stop(); }
  }

  /* Avatar */
  async function generateAvatar() {
    const msg = avatarInput.trim();
    if (!msg || avatarStatus === "generating") return;
    setAvatarStatus("generating"); setAvatarVideoUrl(null); setAvatarElapsed(0);
    avatarTimerRef.current = setInterval(() => setAvatarElapsed(p => p + 1), 1000);
    try {
      const r = await fetch(`${API}/avatar-chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: msg, user_name: userName }) });
      const d = await r.json(); setAvatarVideoUrl(d.video_url || null); setAvatarStatus(d.video_url ? "ready" : "error");
    } catch { setAvatarStatus("error"); }
    finally { if (avatarTimerRef.current) clearInterval(avatarTimerRef.current); }
  }

  /* Mood */
  async function startMoodCamera() { setMoodStatus("camera_active"); setMoodResult(null); try { const s = await navigator.mediaDevices.getUserMedia({ video: true }); moodStreamRef.current = s; if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play(); } } catch { setMoodStatus("error"); } }
  function stopMoodCamera() { moodStreamRef.current?.getTracks().forEach(t => t.stop()); moodStreamRef.current = null; }
  async function captureMood() {
    if (!videoRef.current || !canvasRef.current) return;
    setMoodStatus("analyzing");
    const v = videoRef.current, c = canvasRef.current;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    c.toBlob(async blob => {
      stopMoodCamera();
      const fd = new FormData(); fd.append("file", blob!, "face.jpg");
      try { const r = await fetch(`${API}/detect-face-emotion`, { method: "POST", body: fd }); const d = await r.json(); setMoodResult(d.dominant_emotion || null); setMoodStatus(d.dominant_emotion ? "result" : "error"); }
      catch { setMoodStatus("error"); }
    }, "image/jpeg");
  }

  const g = greet(now);

  /* ═══════════════ ONBOARDING ═══════════════ */
  if (!userName) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(ellipse at 50% 0%, #1e1330 0%, #09080e 65%)", padding: 24, position: "relative" }}>
      <Bg />
      <style>{`@keyframes orbSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <motion.div initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } }}
        style={{ ...S.card, padding: "56px 48px", maxWidth: 420, width: "100%", textAlign: "center", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}><Orb size={80} /></div>
        <h1 style={{ fontFamily: "Poppins, sans-serif", fontSize: 32, fontWeight: 800, color: "#fff", marginBottom: 8, letterSpacing: "-0.03em" }}>Umang AI</h1>
        <p style={{ color: "#9ca3af", fontSize: 15, marginBottom: 36 }}>Your Personal Caring Companion</p>
        <input style={{ ...S.input, textAlign: "center", marginBottom: 14, fontSize: 16 }} placeholder="Enter your name to begin"
          value={nameInput} onChange={e => setNameInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && nameInput.trim() && (localStorage.setItem("umang_user_name", nameInput.trim()), setUserName(nameInput.trim()))}
          autoFocus />
        <motion.button whileHover={{ y: -2, boxShadow: "0 16px 40px rgba(234,88,12,.5)" }} whileTap={{ scale: 0.96 }}
          style={{ ...S.btnPrimary, width: "100%", padding: "16px 0", borderRadius: 18, fontSize: 16 }}
          onClick={() => { const t = nameInput.trim(); if (t) { localStorage.setItem("umang_user_name", t); setUserName(t); } }}>
          Get Started →
        </motion.button>
      </motion.div>
    </div>
  );

  /* ═══════════════ MAIN APP ═══════════════ */
  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at 50% 0%, #1e1330 0%, #09080e 65%)", color: "#f3f4f6", fontFamily: "Inter, sans-serif", position: "relative" }}>
      <Bg />
      <style>{`
        @keyframes orbSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(255,138,92,.5); } 50% { box-shadow: 0 0 0 20px rgba(255,138,92,0); } }
        @keyframes sosPulse { 0% { box-shadow: 0 0 0 0 rgba(239,68,68,.7); } 70% { box-shadow: 0 0 0 14px rgba(239,68,68,0); } 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); } }
        @keyframes typeBounce { 0%,60%,100% { transform: translateY(0); opacity: .5; } 30% { transform: translateY(-6px); opacity: 1; } }
        input::placeholder { color: #6b7280; }
        textarea::placeholder { color: #6b7280; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: rgba(255,138,92,.3); border-radius: 99px; }
      `}</style>

      <AnimatePresence mode="wait">

        {/* ══ HOME ══════════════════════════════════════════════════════ */}
        {view === "home" && (
          <motion.div key="home" variants={pv} initial="initial" animate="animate" exit="exit"
            style={{ ...S.page, position: "relative", zIndex: 1 }}>
            <div style={S.w600}>

              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px 8px 10px", borderRadius: 24, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
                  <Orb size={28} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#f3f4f6" }}>Umang AI</span>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", fontFamily: "Poppins, sans-serif", letterSpacing: "-0.02em" }}>{fmtT(now)}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{fmtD(now)}</div>
                </div>
                <motion.button whileTap={{ scale: 0.88 }} onClick={() => setView("settings")}
                  style={{ ...S.btnGhost, width: 40, height: 40 }}>
                  <Settings size={18} />
                </motion.button>
              </div>

              {/* Greeting */}
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.08, duration: 0.4, ease: EASE } }}
                style={{ textAlign: "center", marginBottom: 28 }}>
                <h1 style={{ fontFamily: "Poppins, sans-serif", fontSize: 38, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.2, marginBottom: 8, background: "linear-gradient(135deg,#fff 30%,#ffcba3 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  {g.emoji} {g.text},<br />{userName}
                </h1>
                <p style={{ color: "#9ca3af", fontSize: 16 }}>{g.sub}</p>
              </motion.div>

              {/* Check-in banners */}
              <AnimatePresence>
                {checkins.map(c => (
                  <motion.div key={c.id} initial={{ opacity: 0, y: -12, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", borderRadius: 18, marginBottom: 12,
                      background: c.type === "morning" ? "linear-gradient(135deg,rgba(255,180,80,.12),rgba(255,140,60,.06))" : "linear-gradient(135deg,rgba(168,85,247,.12),rgba(99,60,190,.06))",
                      border: `1px solid ${c.type === "morning" ? "rgba(255,160,60,.2)" : "rgba(168,85,247,.2)"}` }}>
                    <span style={{ fontSize: 20 }}>{c.type === "morning" ? "🌅" : "🌙"}</span>
                    <p style={{ flex: 1, fontSize: 14, color: "#e5e7eb", lineHeight: 1.55 }}>{c.message}</p>
                    <button onClick={() => dismissCheckin(c.id)} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 18, padding: "0 4px" }}>✕</button>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Input Pill */}
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.14, duration: 0.35, ease: EASE } }}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px 8px 14px", borderRadius: 99, marginBottom: 28, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", backdropFilter: "blur(20px)", boxShadow: "0 12px 40px rgba(0,0,0,0.3)" }}>
                <motion.button whileTap={{ scale: 0.88 }} onClick={() => setMessages([])}
                  style={{ ...S.btnGhost, width: 36, height: 36, borderRadius: 36, flexShrink: 0 }}>
                  <Plus size={17} />
                </motion.button>
                <input style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#f3f4f6", fontSize: 15, fontFamily: "Inter, sans-serif" }}
                  placeholder="Type your message here..." value={inputText}
                  onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMsg()} autoFocus />
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => sendMsg()}
                  style={{ ...S.btnPrimary, width: 42, height: 42, borderRadius: 42, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0 }}>
                  <Send size={17} />
                </motion.button>
              </motion.div>

              {/* Action Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {[
                  { icon: <Mic size={20}/>,          label: "Voice Assistant",    desc: "Start an audio conversation",   grad: "linear-gradient(135deg,#ff8a5c,#ea580c)", glow: "0 6px 20px rgba(234,88,12,.4)",   v: "voice" },
                  { icon: <Video size={20}/>,         label: "Avatar Chat",        desc: "Interactive video response",    grad: "linear-gradient(135deg,#a855f7,#7e22ce)", glow: "0 6px 20px rgba(126,34,206,.4)", v: "avatar" },
                  { icon: <Newspaper size={20}/>,     label: "Daily Briefing",     desc: "Latest news and updates",       grad: "linear-gradient(135deg,#38bdf8,#0284c7)", glow: "0 6px 20px rgba(2,132,199,.4)",  v: "news" },
                  { icon: <Bell size={20}/>,          label: "Reminders",          desc: "Manage your daily schedule",    grad: "linear-gradient(135deg,#fbbf24,#d97706)", glow: "0 6px 20px rgba(217,119,6,.4)",  v: "reminders" },
                  { icon: <Camera size={20}/>,        label: "Mood Analysis",      desc: "Emotion detection via camera",  grad: "linear-gradient(135deg,#f43f5e,#e11d48)", glow: "0 6px 20px rgba(225,29,72,.4)",  v: "mood" },
                  { icon: <Users size={20}/>,         label: "Family Dashboard",   desc: "Mood trends & overview",        grad: "linear-gradient(135deg,#38bdf8,#0ea5e9)", glow: "0 6px 20px rgba(14,165,233,.4)", v: "family" },
                  { icon: <MessageSquare size={20}/>, label: "Chat History",       desc: "View past conversations",       grad: "linear-gradient(135deg,#10b981,#059669)", glow: "0 6px 20px rgba(5,150,105,.4)",  v: "history" },
                  { icon: <BookHeart size={20}/>,     label: "Health Diary",       desc: "Log your daily wellbeing",      grad: "linear-gradient(135deg,#fbbf24,#d97706)", glow: "0 6px 20px rgba(217,119,6,.4)",  v: "diary" },
                ].map((c, i) => (
                  <Card key={c.v} i={i} icon={c.icon} label={c.label} desc={c.desc} grad={c.grad} glow={c.glow} onClick={() => setView(c.v)} />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ══ CHAT ══════════════════════════════════════════════════════ */}
        {view === "chat" && (
          <motion.div key="chat" variants={pv} initial="initial" animate="animate" exit="exit"
            style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", zIndex: 1 }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", backdropFilter: "blur(20px)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <BackBtn onClick={() => setView("home")} />
                <Orb size={36} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>Umang AI</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#9ca3af" }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", animation: "pulse 2s infinite" }} />
                    <span>Online</span>
                  </div>
                </div>
              </div>
              <motion.button whileTap={{ scale: 0.88 }} onClick={() => { setMessages([]); setView("home"); }} style={{ ...S.btnGhost, width: 36, height: 36 }}><Plus size={17}/></motion.button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 600, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
              <AnimatePresence initial={false}>
                {messages.map((m, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.22, ease: EASE } }}
                    style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 8 }}>
                    {m.role === "assistant" && <Orb size={28} spin={false} />}
                    <div style={{ maxWidth: "78%", padding: "13px 18px", borderRadius: 22, fontSize: 15, lineHeight: 1.6,
                      ...(m.role === "user"
                        ? { background: "linear-gradient(135deg,#ff8a5c,#ea580c)", color: "#fff", borderBottomRightRadius: 6, boxShadow: "0 6px 20px rgba(234,88,12,.3)" }
                        : { background: "rgba(255,255,255,0.06)", color: "#e5e7eb", borderBottomLeftRadius: 6, border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" }) }}>
                      {m.text || (
                        <div style={{ display: "flex", gap: 5, alignItems: "center", padding: "2px 0" }}>
                          {[0, 0.2, 0.4].map((d, j) => <div key={j} style={{ width: 7, height: 7, borderRadius: "50%", background: "#9ca3af", animation: `typeBounce 1.2s ${d}s infinite` }} />)}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div style={{ padding: "12px 16px 20px", maxWidth: 600, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px 8px 18px", borderRadius: 99, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)" }}>
                <input style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#f3f4f6", fontSize: 15, fontFamily: "Inter, sans-serif" }}
                  placeholder="Reply to Umang..." value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMsg()} autoFocus />
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => sendMsg()} disabled={isSending}
                  style={{ ...S.btnPrimary, width: 42, height: 42, borderRadius: 42, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0, opacity: isSending ? 0.7 : 1 }}>
                  {isSending ? <Loader2 size={16} style={{ animation: "orbSpin 1s linear infinite" }} /> : <Send size={17} />}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ══ VOICE ═════════════════════════════════════════════════════ */}
        {view === "voice" && (
          <motion.div key="voice" variants={pv} initial="initial" animate="animate" exit="exit"
            style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 48, position: "relative", zIndex: 1 }}>
            <motion.button whileTap={{ scale: 0.88 }} onClick={() => { if (voiceState === "listening") mediaRecorderRef.current?.stop(); setVoiceState("idle"); setView("home"); }}
              style={{ ...S.btnGhost, position: "absolute", top: 28, right: 28, width: 42, height: 42 }}><X size={20}/></motion.button>
            <div style={{ textAlign: "center" }}>
              <h2 style={{ fontFamily: "Poppins, sans-serif", fontSize: 26, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Voice Assistant</h2>
              <p style={{ color: "#9ca3af", fontSize: 15 }}>
                {voiceState === "idle" && "Tap the mic to start speaking"}
                {voiceState === "listening" && "🎙️ Listening... tap again to stop"}
                {voiceState === "thinking" && "💭 Processing your voice..."}
                {voiceState === "speaking" && "🔊 Umang is speaking..."}
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.92 }}
              animate={voiceState === "listening" ? { scale: [1, 1.07, 1], transition: { repeat: Infinity, duration: 1.4 } } : {}}
              onClick={toggleVoice} disabled={voiceState === "thinking" || voiceState === "speaking"}
              style={{ width: 160, height: 160, borderRadius: "50%", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
                background: voiceState === "listening" ? "linear-gradient(135deg,#ef4444,#dc2626)" : voiceState === "speaking" ? "linear-gradient(135deg,#10b981,#059669)" : "linear-gradient(135deg,#ff8a5c,#ea580c)",
                boxShadow: "0 20px 60px rgba(255,138,92,.4)", animation: voiceState === "listening" ? "pulse 2s infinite" : "none" }}>
              {voiceState === "thinking" ? <Loader2 size={44} style={{ animation: "orbSpin 1s linear infinite" }} /> : voiceState === "listening" ? <Square size={44} /> : <Mic size={44} />}
            </motion.button>
            <p style={{ color: "#4b5563", fontSize: 13, textAlign: "center", maxWidth: 280 }}>
              {voiceState === "idle" ? "Speak Hindi or English — Umang understands both" : ""}
            </p>
          </motion.div>
        )}

        {/* ══ SUB-VIEWS (settings, news, reminders, mood, family, history, diary, avatar) ══ */}
        {["settings","news","reminders","mood","family","history","diary","avatar"].includes(view) && (
          <motion.div key={view} variants={pv} initial="initial" animate="animate" exit="exit"
            style={{ ...S.page, position: "relative", zIndex: 1 }}>
            <div style={{ ...S.w600, ...S.card, padding: "36px 32px" }}>

              {/* Settings */}
              {view === "settings" && <>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
                  <BackBtn onClick={() => setView("home")} />
                  <h2 style={{ fontFamily: "Poppins, sans-serif", fontSize: 22, fontWeight: 700, color: "#fff" }}>Settings</h2>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div><label style={{ fontSize: 12, color: "#9ca3af", display: "block", marginBottom: 7 }}>YOUR NAME</label><input style={S.input} value={userName} readOnly /></div>
                  <div>
                    <label style={{ fontSize: 12, color: "#9ca3af", display: "block", marginBottom: 7 }}>FAMILY EMERGENCY EMAIL</label>
                    <input style={{ ...S.input, marginBottom: 12 }} placeholder="family@example.com" value={familyEmail} onChange={e => setFamilyEmail(e.target.value)} />
                    <motion.button whileTap={{ scale: 0.97 }} onClick={saveSettings} style={{ ...S.btnPrimary, width: "100%", padding: "15px 0", borderRadius: 16, fontSize: 15 }}>
                      {settingsStatus === "saving" ? "Saving..." : settingsStatus === "saved" ? "✓ Saved!" : "Save Settings"}
                    </motion.button>
                  </div>
                  <div style={{ paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                    <label style={{ fontSize: 12, color: "#9ca3af", display: "block", marginBottom: 6 }}>EMERGENCY SOS</label>
                    <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 14 }}>Instantly notify your family — bypasses all cooldowns.</p>
                    <motion.button whileTap={{ scale: 0.97 }} onClick={triggerSOS} disabled={sosStatus === "sending"}
                      style={{ width: "100%", padding: "16px 0", borderRadius: 16, border: "none", cursor: "pointer", fontSize: 15, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg,#ef4444,#dc2626)", boxShadow: "0 8px 24px rgba(239,68,68,.35)", animation: "sosPulse 1.5s infinite", opacity: sosStatus === "sending" ? 0.7 : 1 }}>
                      <Siren size={17} style={{ display: "inline", marginRight: 8, verticalAlign: "middle" }} />
                      {sosStatus === "idle" && "🚨 Send SOS Alert"}{sosStatus === "sending" && "Sending..."}{sosStatus === "sent" && "✓ Alert Sent!"}{sosStatus === "error" && "✗ Failed — Try Again"}
                    </motion.button>
                  </div>
                </div>
              </>}

              {/* News */}
              {view === "news" && <>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                  <BackBtn onClick={() => setView("home")} />
                  <div style={{ width: 40, height: 40, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#38bdf8,#0284c7)" }}><Newspaper size={18} color="#fff"/></div>
                  <h2 style={{ fontFamily: "Poppins, sans-serif", fontSize: 22, fontWeight: 700, color: "#fff" }}>Daily Briefing</h2>
                </div>
                {newsLoading ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "48px 0" }}>
                    <Loader2 size={32} color="#ff8a5c" style={{ animation: "orbSpin 1s linear infinite" }} />
                    <p style={{ color: "#9ca3af", fontSize: 14 }}>Fetching today&apos;s headlines...</p>
                  </div>
                ) : <p style={{ color: "#d1d5db", fontSize: 15, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{newsSummary}</p>}
              </>}

              {/* Reminders */}
              {view === "reminders" && <>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                  <BackBtn onClick={() => setView("home")} />
                  <div style={{ width: 40, height: 40, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#fbbf24,#d97706)" }}><Bell size={18} color="#fff"/></div>
                  <h2 style={{ fontFamily: "Poppins, sans-serif", fontSize: 22, fontWeight: 700, color: "#fff" }}>Reminders</h2>
                </div>
                <div style={{ padding: 16, borderRadius: 20, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 20 }}>
                  <input style={{ ...S.input, marginBottom: 10 }} placeholder="Reminder title (e.g. Morning BP tablet)" value={newReminderTitle} onChange={e => setNewReminderTitle(e.target.value)} />
                  <div style={{ display: "flex", gap: 10 }}>
                    <input type="time" style={{ ...S.input, flex: 1 }} value={newReminderTime} onChange={e => setNewReminderTime(e.target.value)} />
                    <motion.button whileTap={{ scale: 0.95 }} onClick={addReminder}
                      style={{ ...S.btnPrimary, padding: "12px 20px", borderRadius: 14, display: "flex", alignItems: "center", gap: 6, flexShrink: 0, fontSize: 14 }}>
                      <Plus size={16}/> Add
                    </motion.button>
                  </div>
                </div>
                {remindersLoading ? <div style={{ display: "flex", justifyContent: "center", padding: "32px 0" }}><Loader2 size={24} color="#ff8a5c" style={{ animation: "orbSpin 1s linear infinite" }} /></div>
                  : remindersList.length === 0 ? <p style={{ textAlign: "center", color: "#6b7280", padding: "32px 0", fontSize: 14 }}>No reminders yet. Add one above!</p>
                  : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {remindersList.map((r, i) => (
                      <motion.div key={r.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0, transition: { delay: i * 0.05 } }}
                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: 18, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}>
                        <div><div style={{ color: "#f3f4f6", fontWeight: 500, fontSize: 14 }}>{r.title}</div><div style={{ color: "#9ca3af", fontSize: 12, marginTop: 3 }}>⏰ {r.time}</div></div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <motion.button whileTap={{ scale: 0.88 }} onClick={() => completeReminder(r.id)} style={{ ...S.btnGhost, width: 34, height: 34, color: "#10b981" }}><CheckCircle size={16}/></motion.button>
                          <motion.button whileTap={{ scale: 0.88 }} onClick={() => deleteReminder(r.id)} style={{ ...S.btnGhost, width: 34, height: 34, color: "#ef4444" }}><Trash2 size={16}/></motion.button>
                        </div>
                      </motion.div>
                    ))}
                  </div>}
              </>}

              {/* Mood */}
              {view === "mood" && <>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                  <BackBtn onClick={() => setView("home")} />
                  <h2 style={{ fontFamily: "Poppins, sans-serif", fontSize: 22, fontWeight: 700, color: "#fff" }}>Mood Analysis</h2>
                </div>
                {moodStatus === "camera_active" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <video ref={videoRef} style={{ width: "100%", borderRadius: 20, background: "#000", transform: "scaleX(-1)" }} />
                    <canvas ref={canvasRef} style={{ display: "none" }} />
                    <motion.button whileTap={{ scale: 0.97 }} onClick={captureMood}
                      style={{ ...S.btnPrimary, padding: "15px 0", borderRadius: 16, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      <Camera size={18}/> Capture &amp; Analyse
                    </motion.button>
                  </div>
                )}
                {moodStatus === "analyzing" && <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "48px 0" }}><Loader2 size={36} color="#ff8a5c" style={{ animation: "orbSpin 1s linear infinite" }} /><p style={{ color: "#d1d5db" }}>Analysing your expression...</p></div>}
                {moodStatus === "result" && moodResult && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: "center", padding: "40px 0" }}>
                    <div style={{ fontSize: 72, marginBottom: 16 }}>{({"happy":"😊","sad":"😢","angry":"😠","surprised":"😮","fear":"😰","disgust":"🤢","neutral":"😐"} as any)[moodResult] || "🙂"}</div>
                    <p style={{ fontSize: 26, fontWeight: 700, color: "#fff", textTransform: "capitalize", marginBottom: 8 }}>{moodResult}</p>
                    <p style={{ color: "#9ca3af", fontSize: 14, marginBottom: 24 }}>That&apos;s how I read your expression.</p>
                    <motion.button whileTap={{ scale: 0.97 }} onClick={() => sendMsg(`I am feeling ${moodResult} right now`)}
                      style={{ ...S.btnPrimary, padding: "14px 28px", borderRadius: 16, fontSize: 15 }}>Chat About This</motion.button>
                  </motion.div>
                )}
                {moodStatus === "error" && <p style={{ color: "#ef4444", textAlign: "center", padding: "40px 0" }}>Could not detect mood. Please try again.</p>}
              </>}

              {/* Family Dashboard */}
              {view === "family" && <>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                  <BackBtn onClick={() => setView("home")} />
                  <h2 style={{ fontFamily: "Poppins, sans-serif", fontSize: 22, fontWeight: 700, color: "#fff" }}>Family Dashboard</h2>
                </div>
                {dashboardLoading ? <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}><Loader2 size={28} color="#ff8a5c" style={{ animation: "orbSpin 1s linear infinite" }} /></div>
                  : dashboardData ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                        {[{ label: "Negative Emotions (7d)", value: dashboardData.negative_emotions_count ?? 0, color: "#ef4444" }, { label: "Active Reminders", value: dashboardData.active_reminders_count ?? 0, color: "#ff8a5c" }].map((s, i) => (
                          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.1 } }}
                            style={{ padding: "20px 16px", borderRadius: 20, textAlign: "center", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                            <div style={{ fontSize: 36, fontWeight: 800, color: s.color, marginBottom: 6 }}>{s.value}</div>
                            <div style={{ fontSize: 12, color: "#9ca3af" }}>{s.label}</div>
                          </motion.div>
                        ))}
                      </div>
                      <div>
                        <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 12 }}>Recent Activity</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {(dashboardData.recent_messages || []).slice(0, 5).map((m: any, i: number) => (
                            <div key={i} style={{ padding: "12px 14px", borderRadius: 14, background: "rgba(255,255,255,0.04)", fontSize: 13 }}>
                              <small style={{ color: "#6b7280", display: "block", marginBottom: 4 }}>{m.role} · {m.emotion || "neutral"}</small>
                              <span style={{ color: "#d1d5db" }}>{m.message?.slice(0, 80)}...</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : <p style={{ color: "#6b7280", textAlign: "center", padding: "48px 0" }}>No data available.</p>}
              </>}

              {/* History */}
              {view === "history" && <>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                  <BackBtn onClick={() => setView("home")} />
                  <h2 style={{ fontFamily: "Poppins, sans-serif", fontSize: 22, fontWeight: 700, color: "#fff" }}>Chat History</h2>
                </div>
                {historyLoading ? <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}><Loader2 size={28} color="#ff8a5c" style={{ animation: "orbSpin 1s linear infinite" }} /></div> : (
                  <>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                      {historyMessages.map((m, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.04 } }}
                          style={{ padding: "13px 16px", borderRadius: 16, background: "rgba(255,255,255,0.05)", borderLeft: `3px solid ${m.role === "user" ? "#ff8a5c" : "#a855f7"}` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6b7280", marginBottom: 6 }}>
                            <span style={{ textTransform: "capitalize", fontWeight: 600 }}>{m.role}</span>
                            <span style={{ textTransform: "capitalize" }}>{m.emotion || ""}</span>
                            <span>{m.created_at ? new Date(m.created_at).toLocaleDateString("en-IN") : ""}</span>
                          </div>
                          <p style={{ color: "#d1d5db", fontSize: 14, lineHeight: 1.55 }}>{m.message}</p>
                        </motion.div>
                      ))}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <motion.button whileTap={{ scale: 0.93 }} disabled={historyPage <= 1} onClick={() => fetchHistory(historyPage - 1)}
                        style={{ ...S.btnGhost, borderRadius: 12, padding: "8px 16px", display: "flex", alignItems: "center", gap: 6, fontSize: 13, opacity: historyPage <= 1 ? 0.4 : 1 }}>
                        <ChevronLeft size={16}/> Prev
                      </motion.button>
                      <span style={{ color: "#9ca3af", fontSize: 13 }}>Page {historyPage}</span>
                      <motion.button whileTap={{ scale: 0.93 }} disabled={historyPage * 20 >= historyTotal} onClick={() => fetchHistory(historyPage + 1)}
                        style={{ ...S.btnGhost, borderRadius: 12, padding: "8px 16px", display: "flex", alignItems: "center", gap: 6, fontSize: 13, opacity: historyPage * 20 >= historyTotal ? 0.4 : 1 }}>
                        Next <ChevronRight size={16}/>
                      </motion.button>
                    </div>
                  </>
                )}
              </>}

              {/* Diary */}
              {view === "diary" && <>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                  <BackBtn onClick={() => setView("home")} />
                  <h2 style={{ fontFamily: "Poppins, sans-serif", fontSize: 22, fontWeight: 700, color: "#fff" }}>Health Diary</h2>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
                  <div>
                    <label style={{ fontSize: 12, color: "#9ca3af", display: "block", marginBottom: 7 }}>HOW ARE YOU FEELING?</label>
                    <select style={{ ...S.input, background: "rgba(255,255,255,0.06)" }} value={diaryMood} onChange={e => setDiaryMood(e.target.value)}>
                      {["great","good","okay","tired","sad","worried","sick"].map(m => <option key={m} value={m} style={{ background: "#16171d" }}>{m.charAt(0).toUpperCase()+m.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: "#9ca3af", display: "block", marginBottom: 7 }}>ENERGY LEVEL: {diaryEnergy}/5</label>
                    <input type="range" min={1} max={5} value={diaryEnergy} onChange={e => setDiaryEnergy(Number(e.target.value))} style={{ width: "100%", accentColor: "#ff8a5c" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: "#9ca3af", display: "block", marginBottom: 7 }}>NOTES</label>
                    <textarea style={{ ...S.input, height: 90, resize: "none" }} placeholder="How was your day?" value={diaryNote} onChange={e => setDiaryNote(e.target.value)} />
                  </div>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={saveDiaryEntry}
                    style={{ ...S.btnPrimary, padding: "15px 0", borderRadius: 16, fontSize: 15 }}>
                    {diaryStatus === "saving" ? "Saving..." : diaryStatus === "saved" ? "✓ Saved!" : "Save Today's Entry"}
                  </motion.button>
                </div>
                {diaryEntries.length > 0 && (
                  <div>
                    <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 12 }}>Past Entries</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {diaryEntries.slice(0, 7).map((e, i) => (
                        <div key={i} style={{ padding: "12px 14px", borderRadius: 14, background: "rgba(255,255,255,0.04)" }}>
                          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                            <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 99, background: "rgba(255,138,92,.15)", color: "#ff8a5c", textTransform: "capitalize" }}>{e.mood || "?"}</span>
                            <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 99, background: "rgba(168,85,247,.15)", color: "#a855f7" }}>⚡ {e.energy}/5</span>
                          </div>
                          {e.note && <p style={{ color: "#9ca3af", fontSize: 13 }}>{e.note}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>}

              {/* Avatar */}
              {view === "avatar" && <>
                <motion.button whileTap={{ scale: 0.88 }} onClick={() => { if (avatarTimerRef.current) clearInterval(avatarTimerRef.current); setAvatarStatus("idle"); setAvatarVideoUrl(null); setAvatarInput(""); setView("home"); }}
                  style={{ ...S.btnGhost, position: "absolute", top: 20, right: 20, width: 38, height: 38 }}><X size={18}/></motion.button>
                <div style={{ textAlign: "center", marginBottom: 28 }}>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}><Orb size={60} /></div>
                  <h2 style={{ fontFamily: "Poppins, sans-serif", fontSize: 24, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Avatar Chat</h2>
                  <p style={{ color: "#9ca3af", fontSize: 14 }}>Umang responds as a lip-synced video avatar</p>
                </div>
                {avatarStatus !== "ready" && (
                  <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                    <input style={{ ...S.input, flex: 1 }} placeholder="Ask Umang something..." value={avatarInput} onChange={e => setAvatarInput(e.target.value)} onKeyDown={e => e.key === "Enter" && generateAvatar()} />
                    <motion.button whileTap={{ scale: 0.93 }} onClick={generateAvatar}
                      style={{ ...S.btnPrimary, padding: "12px 18px", borderRadius: 14, display: "flex", alignItems: "center", flexShrink: 0 }}><Send size={16}/></motion.button>
                  </div>
                )}
                {avatarStatus === "generating" && <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "32px 0" }}><Loader2 size={32} color="#ff8a5c" style={{ animation: "orbSpin 1s linear infinite" }} /><p style={{ color: "#d1d5db", fontSize: 14 }}>Generating... ({avatarElapsed}s)</p><p style={{ color: "#6b7280", fontSize: 12 }}>This may take 60–90 seconds</p></div>}
                {avatarStatus === "ready" && avatarVideoUrl && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <video src={avatarVideoUrl} controls autoPlay style={{ width: "100%", borderRadius: 18 }} />
                    <motion.button whileTap={{ scale: 0.97 }} onClick={() => { setAvatarStatus("idle"); setAvatarVideoUrl(null); setAvatarInput(""); }}
                      style={{ ...S.btnGhost, width: "100%", padding: "13px 0", borderRadius: 16, fontSize: 14, border: "1px solid rgba(255,255,255,0.12)" }}>
                      Ask Another Question
                    </motion.button>
                  </div>
                )}
              </>}

            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
