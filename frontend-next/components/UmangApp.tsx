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

// ── Framer Motion Variants ───────────────────────────────────────────────────
// Cubic bezier must be typed as a 4-tuple to satisfy Framer Motion's Easing type
type Bezier = [number, number, number, number];
const SPRING: Bezier = [0.16, 1, 0.3, 1];

const pageVariants = {
  initial: { opacity: 0, y: 20, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: SPRING } },
  exit:    { opacity: 0, y: -10, scale: 0.99, transition: { duration: 0.2, ease: "easeIn" as const } },
};

const cardVariants = {
  initial: { opacity: 0, y: 16 },
  animate: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.07, duration: 0.35, ease: SPRING }
  }),
};

const bubbleVariants = {
  initial: { opacity: 0, y: 10, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.25, ease: SPRING } },
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function getTimeGreeting(now: Date) {
  const h = now.getHours();
  if (h >= 5  && h < 12) return { text: "Good Morning",   emoji: "🌅", sub: "Hope you slept well!" };
  if (h >= 12 && h < 17) return { text: "Good Afternoon", emoji: "☀️", sub: "How's your day going?" };
  if (h >= 17 && h < 21) return { text: "Good Evening",   emoji: "🌇", sub: "Time to relax and unwind." };
  return                          { text: "Good Night",    emoji: "🌙", sub: "Rest well, take care of yourself." };
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}
function fmtDate(d: Date) {
  return d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });
}

// ── GlowBackground ───────────────────────────────────────────────────────────
function GlowBg() {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-40 -left-32 w-[600px] h-[600px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(255,138,92,0.35) 0%, transparent 70%)", filter: "blur(80px)" }} />
        <div className="absolute -bottom-40 -right-32 w-[550px] h-[550px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(168,85,247,0.28) 0%, transparent 70%)", filter: "blur(80px)" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(56,189,248,0.08) 0%, transparent 70%)", filter: "blur(60px)" }} />
      </div>
      {/* Animated noise grain for premium feel */}
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-[0.03]"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
    </>
  );
}

// ── BrandOrb ─────────────────────────────────────────────────────────────────
function BrandOrb({ size = 56, spin = true }: { size?: number; spin?: boolean }) {
  return (
    <div
      className={spin ? "spin-slow" : ""}
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        background: "conic-gradient(from 180deg, #ff8a5c, #e8734a, #ffcba3, #a855f7, #ff8a5c)",
        boxShadow: `0 0 ${size * 0.7}px rgba(255,138,92,0.5)`,
      }}
    />
  );
}

// ── ActionCard ───────────────────────────────────────────────────────────────
function ActionCard({ icon, label, desc, gradient, glow, onClick, index }: {
  icon: React.ReactNode; label: string; desc: string;
  gradient: string; glow: string; onClick: () => void; index: number;
}) {
  return (
    <motion.button
      variants={cardVariants} custom={index} initial="initial" animate="animate"
      whileHover={{ y: -5, scale: 1.02 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="flex flex-col items-start gap-3 p-5 rounded-2xl text-left w-full cursor-pointer"
      style={{
        background: "rgba(255,255,255,0.035)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06)",
        transition: "border-color 0.25s, box-shadow 0.25s",
      }}
    >
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white flex-shrink-0"
        style={{ background: gradient, boxShadow: glow }}>
        {icon}
      </div>
      <div>
        <span className="block text-[15px] font-semibold text-white leading-tight mb-1">{label}</span>
        <span className="block text-[13px] text-gray-400 leading-snug">{desc}</span>
      </div>
    </motion.button>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function UmangApp() {
  const [userName, setUserName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [view, setView] = useState("home");
  const [now, setNow] = useState(new Date());

  // Chat
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Voice
  const [voiceState, setVoiceState] = useState("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Avatar
  const [avatarInput, setAvatarInput] = useState("");
  const [avatarStatus, setAvatarStatus] = useState("idle");
  const [avatarVideoUrl, setAvatarVideoUrl] = useState<string | null>(null);
  const [avatarElapsed, setAvatarElapsed] = useState(0);
  const avatarTimerRef = useRef<NodeJS.Timeout | null>(null);

  // News
  const [newsSummary, setNewsSummary] = useState("");
  const [newsLoading, setNewsLoading] = useState(false);

  // Reminders
  const [remindersList, setRemindersList] = useState<any[]>([]);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [newReminderTitle, setNewReminderTitle] = useState("");
  const [newReminderTime, setNewReminderTime] = useState("");

  // Settings & SOS
  const [familyEmail, setFamilyEmail] = useState("");
  const [settingsStatus, setSettingsStatus] = useState("idle");
  const [sosStatus, setSosStatus] = useState("idle");

  // Mood
  const [moodStatus, setMoodStatus] = useState("idle");
  const [moodResult, setMoodResult] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const moodStreamRef = useRef<MediaStream | null>(null);

  // Check-ins
  const [checkins, setCheckins] = useState<any[]>([]);

  // Dashboard
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  // History
  const [historyMessages, setHistoryMessages] = useState<any[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Diary
  const [diaryEntries, setDiaryEntries] = useState<any[]>([]);
  const [diaryMood, setDiaryMood] = useState("good");
  const [diaryNote, setDiaryNote] = useState("");
  const [diaryEnergy, setDiaryEnergy] = useState(3);
  const [diaryStatus, setDiaryStatus] = useState("idle");

  // ── Init from localStorage ───────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem("umang_user_name");
    if (saved) setUserName(saved);
  }, []);

  // ── Live clock ───────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  // ── WebSocket ────────────────────────────────────────────────────────────
  const connectWS = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return wsRef.current!;
    const ws = new WebSocket(`${WS}/ws/chat`);
    wsRef.current = ws;
    ws.onerror = () => console.error("[WS] error");
    ws.onclose = () => console.log("[WS] closed");
    return ws;
  }, []);

  useEffect(() => {
    if (userName) { connectWS(); fetchCheckins(); }
    return () => wsRef.current?.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userName]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  // ── API Functions ─────────────────────────────────────────────────────────
  async function fetchCheckins() {
    try {
      const r = await fetch(`${API}/pending-checkins?user_name=${encodeURIComponent(userName)}`);
      setCheckins(await r.json());
    } catch {}
  }
  async function dismissCheckin(id: number) {
    await fetch(`${API}/pending-checkins/${id}/dismiss`, { method: "POST" });
    setCheckins(p => p.filter(c => c.id !== id));
  }
  async function fetchDashboard() {
    setDashboardLoading(true);
    try {
      const r = await fetch(`${API}/family-dashboard?user_name=${encodeURIComponent(userName)}`);
      setDashboardData(await r.json());
    } catch {}
    setDashboardLoading(false);
  }
  async function fetchSettings() {
    try {
      const r = await fetch(`${API}/user-settings?user_name=${encodeURIComponent(userName)}`);
      const d = await r.json();
      setFamilyEmail(d.family_email || "");
    } catch {}
  }
  async function saveSettings() {
    setSettingsStatus("saving");
    try {
      await fetch(`${API}/user-settings`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_name: userName, family_email: familyEmail }),
      });
      setSettingsStatus("saved");
    } catch { setSettingsStatus("error"); }
    setTimeout(() => setSettingsStatus("idle"), 3000);
  }
  async function triggerSOS() {
    if (sosStatus === "sending") return;
    setSosStatus("sending");
    try {
      const r = await fetch(`${API}/sos`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_name: userName }),
      });
      const d = await r.json();
      setSosStatus(d.status === "sent" ? "sent" : "error");
    } catch { setSosStatus("error"); }
    setTimeout(() => setSosStatus("idle"), 5000);
  }
  async function fetchNews() {
    setNewsLoading(true);
    try {
      const r = await fetch(`${API}/daily-news?user_name=${encodeURIComponent(userName)}`);
      const d = await r.json();
      setNewsSummary(d.summary || "Could not load news.");
    } catch { setNewsSummary("Failed to fetch news."); }
    setNewsLoading(false);
  }
  async function fetchReminders() {
    setRemindersLoading(true);
    try {
      const r = await fetch(`${API}/reminders?user_name=${encodeURIComponent(userName)}`);
      setRemindersList(await r.json());
    } catch {}
    setRemindersLoading(false);
  }
  async function addReminder() {
    if (!newReminderTitle.trim() || !newReminderTime) return;
    await fetch(`${API}/reminders`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_name: userName, title: newReminderTitle, reminder_time: newReminderTime }),
    });
    setNewReminderTitle(""); setNewReminderTime("");
    fetchReminders();
  }
  async function completeReminder(id: number) {
    await fetch(`${API}/reminders/${id}/complete`, { method: "POST" });
    fetchReminders();
  }
  async function deleteReminder(id: number) {
    await fetch(`${API}/reminders/${id}`, { method: "DELETE" });
    fetchReminders();
  }
  async function fetchHistory(page = 1) {
    setHistoryLoading(true);
    try {
      const r = await fetch(`${API}/conversation-history?user_name=${encodeURIComponent(userName)}&page=${page}&page_size=20`);
      const d = await r.json();
      setHistoryMessages(d.messages || []);
      setHistoryTotal(d.total || 0);
      setHistoryPage(page);
    } catch {}
    setHistoryLoading(false);
  }
  async function fetchDiaryEntries() {
    try {
      const r = await fetch(`${API}/health-diary?user_name=${encodeURIComponent(userName)}&days=14`);
      setDiaryEntries(await r.json());
    } catch {}
  }
  async function saveDiaryEntry() {
    if (diaryStatus === "saving") return;
    setDiaryStatus("saving");
    try {
      await fetch(`${API}/health-diary`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_name: userName, mood: diaryMood, note: diaryNote, energy: diaryEnergy }),
      });
      setDiaryNote(""); setDiaryStatus("saved"); fetchDiaryEntries();
    } catch { setDiaryStatus("error"); }
    setTimeout(() => setDiaryStatus("idle"), 3000);
  }

  // ── Chat ─────────────────────────────────────────────────────────────────
  async function sendTextMessage(initial?: string) {
    const msg = (initial ?? inputText).trim();
    if (!msg || isSending) return;
    setView("chat");
    setMessages(p => [...p, { role: "user", text: msg }]);
    setInputText("");
    setIsSending(true);
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
      const send = () => ws.readyState === WebSocket.OPEN
        ? ws.send(JSON.stringify({ message: msg, user_name: userName }))
        : ws.addEventListener("open", () => ws.send(JSON.stringify({ message: msg, user_name: userName })), { once: true });
      send();
    });
  }

  // ── Voice ─────────────────────────────────────────────────────────────────
  async function toggleVoice() {
    if (voiceState === "idle") {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      mediaRecorderRef.current = rec;
      audioChunksRef.current = [];
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
          setVoiceState("speaking");
          audio.onended = () => setVoiceState("idle");
          audio.play();
        } catch { setVoiceState("idle"); }
      };
      rec.start(); setVoiceState("listening");
    } else if (voiceState === "listening") {
      mediaRecorderRef.current?.stop(); setVoiceState("thinking");
    }
  }

  // ── Avatar ────────────────────────────────────────────────────────────────
  async function generateAvatar() {
    const msg = avatarInput.trim();
    if (!msg || avatarStatus === "generating") return;
    setAvatarStatus("generating"); setAvatarVideoUrl(null); setAvatarElapsed(0);
    avatarTimerRef.current = setInterval(() => setAvatarElapsed(p => p + 1), 1000);
    try {
      const r = await fetch(`${API}/avatar-chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, user_name: userName }),
      });
      const d = await r.json();
      setAvatarVideoUrl(d.video_url || null);
      setAvatarStatus(d.video_url ? "ready" : "error");
    } catch { setAvatarStatus("error"); }
    finally { if (avatarTimerRef.current) clearInterval(avatarTimerRef.current); }
  }

  // ── Mood ──────────────────────────────────────────────────────────────────
  async function startMoodCamera() {
    setMoodStatus("camera_active"); setMoodResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      moodStreamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
    } catch { setMoodStatus("error"); }
  }
  function stopMoodCamera() {
    moodStreamRef.current?.getTracks().forEach(t => t.stop());
    moodStreamRef.current = null;
  }
  async function captureMood() {
    if (!videoRef.current || !canvasRef.current) return;
    setMoodStatus("analyzing");
    const v = videoRef.current, c = canvasRef.current;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    c.toBlob(async blob => {
      stopMoodCamera();
      const fd = new FormData(); fd.append("file", blob!, "face.jpg");
      try {
        const r = await fetch(`${API}/detect-face-emotion`, { method: "POST", body: fd });
        const d = await r.json();
        setMoodResult(d.dominant_emotion || null);
        setMoodStatus(d.dominant_emotion ? "result" : "error");
      } catch { setMoodStatus("error"); }
    }, "image/jpeg");
  }

  const greet = getTimeGreeting(now);

  // ══════════════════════════════════════════════════════════════════════════
  // VIEWS
  // ══════════════════════════════════════════════════════════════════════════

  // ── Onboarding ─────────────────────────────────────────────────────────────
  if (!userName) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "radial-gradient(circle at 50% 0%, #1c1528 0%, #09080e 70%)" }}>
        <GlowBg />
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16,1,0.3,1] }}
          className="glass rounded-[32px] p-14 text-center max-w-[420px] w-full">
          <div className="flex justify-center mb-6"><BrandOrb size={72} /></div>
          <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: "Poppins, sans-serif" }}>Umang AI</h1>
          <p className="text-gray-400 text-sm mb-8">Your Personal Caring Companion</p>
          <input
            className="input-base mb-4 text-center"
            placeholder="Enter your name to begin"
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && nameInput.trim() && (localStorage.setItem("umang_user_name", nameInput.trim()), setUserName(nameInput.trim()))}
            autoFocus
          />
          <motion.button whileTap={{ scale: 0.97 }} whileHover={{ y: -2 }}
            className="btn-primary w-full py-4 rounded-2xl text-base"
            onClick={() => { const t = nameInput.trim(); if (t) { localStorage.setItem("umang_user_name", t); setUserName(t); } }}>
            Get Started →
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "radial-gradient(circle at 50% 0%, #1c1528 0%, #09080e 70%)" }}>
      <GlowBg />
      <AnimatePresence mode="wait">

        {/* ── HOME ─────────────────────────────────────────────────────── */}
        {view === "home" && (
          <motion.div key="home" variants={pageVariants} initial="initial" animate="animate" exit="exit"
            className="min-h-screen flex flex-col items-center justify-start px-5 py-8 max-w-[640px] mx-auto">

            {/* Header */}
            <div className="flex items-center justify-between w-full mb-6">
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-2xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <BrandOrb size={26} />
                <span className="text-sm font-semibold text-white">Umang AI</span>
              </div>
              <div className="text-center">
                <div className="text-base font-bold text-white" style={{ fontFamily: "Poppins, sans-serif" }}>{fmtTime(now)}</div>
                <div className="text-[10px] text-gray-400">{fmtDate(now)}</div>
              </div>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => setView("settings")}
                className="btn-ghost w-10 h-10">
                <Settings size={18} />
              </motion.button>
            </div>

            {/* Greeting */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-center mb-6">
              <h1 className="text-4xl font-bold gradient-text mb-2" style={{ fontFamily: "Poppins, sans-serif" }}>
                {greet.emoji} {greet.text},<br />{userName}
              </h1>
              <p className="text-gray-400 text-base">{greet.sub}</p>
            </motion.div>

            {/* Check-in Banners */}
            <AnimatePresence>
              {checkins.map(c => (
                <motion.div key={c.id} initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                  className="w-full flex items-start gap-3 p-4 rounded-2xl mb-3 banner-slide"
                  style={{
                    background: c.type === "morning" ? "linear-gradient(135deg,rgba(255,180,80,.15),rgba(255,140,60,.08))" : "linear-gradient(135deg,rgba(168,85,247,.15),rgba(99,60,190,.08))",
                    border: c.type === "morning" ? "1px solid rgba(255,160,60,.25)" : "1px solid rgba(168,85,247,.25)",
                  }}>
                  <span className="text-xl">{c.type === "morning" ? "🌅" : "🌙"}</span>
                  <p className="flex-1 text-sm text-gray-200 leading-relaxed">{c.message}</p>
                  <button onClick={() => dismissCheckin(c.id)} className="text-gray-500 hover:text-white transition-colors text-lg">✕</button>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Input Pill */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="w-full flex items-center gap-2 px-4 py-2 rounded-full mb-6"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", backdropFilter: "blur(20px)", boxShadow: "0 12px 40px rgba(0,0,0,0.3)" }}>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => { setMessages([]); setView("home"); }}
                className="btn-ghost w-9 h-9 flex-shrink-0">
                <Plus size={18} />
              </motion.button>
              <input
                className="flex-1 bg-transparent border-none outline-none text-white text-[15px] py-2 placeholder-gray-600"
                placeholder="Type your message here..."
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendTextMessage()}
                autoFocus
              />
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => sendTextMessage()}
                className="btn-primary w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0">
                <Send size={16} />
              </motion.button>
            </motion.div>

            {/* Action Grid */}
            <div className="grid grid-cols-2 gap-4 w-full">
              {[
                { icon: <Mic size={20}/>, label: "Voice Assistant",   desc: "Start an audio conversation",  gradient: "linear-gradient(135deg,#ff8a5c,#ea580c)", glow: "0 6px 20px rgba(234,88,12,.4)",   view: "voice" },
                { icon: <Video size={20}/>, label: "Avatar Chat",     desc: "Interactive video response",   gradient: "linear-gradient(135deg,#a855f7,#7e22ce)", glow: "0 6px 20px rgba(126,34,206,.4)", view: "avatar" },
                { icon: <Newspaper size={20}/>, label: "Daily Briefing", desc: "Latest news and updates",  gradient: "linear-gradient(135deg,#38bdf8,#0284c7)", glow: "0 6px 20px rgba(2,132,199,.4)",  view: "news" },
                { icon: <Bell size={20}/>, label: "Reminders",        desc: "Manage your daily schedule",  gradient: "linear-gradient(135deg,#fbbf24,#d97706)", glow: "0 6px 20px rgba(217,119,6,.4)",  view: "reminders" },
                { icon: <Camera size={20}/>, label: "Mood Analysis",  desc: "Emotion detection via camera", gradient: "linear-gradient(135deg,#f43f5e,#e11d48)", glow: "0 6px 20px rgba(225,29,72,.4)",  view: "mood" },
                { icon: <Users size={20}/>, label: "Family Dashboard",desc: "Mood trends & overview",       gradient: "linear-gradient(135deg,#38bdf8,#0ea5e9)", glow: "0 6px 20px rgba(14,165,233,.4)", view: "family" },
                { icon: <MessageSquare size={20}/>, label: "Chat History", desc: "View past conversations",gradient: "linear-gradient(135deg,#10b981,#059669)", glow: "0 6px 20px rgba(5,150,105,.4)",  view: "history" },
                { icon: <BookHeart size={20}/>, label: "Health Diary",desc: "Log your daily wellbeing",     gradient: "linear-gradient(135deg,#fbbf24,#d97706)", glow: "0 6px 20px rgba(217,119,6,.4)",  view: "diary" },
              ].map((card, i) => (
                <ActionCard key={card.view} index={i} icon={card.icon} label={card.label} desc={card.desc}
                  gradient={card.gradient} glow={card.glow} onClick={() => setView(card.view as any)} />
              ))}
            </div>
          </motion.div>
        )}

        {/* ── CHAT ─────────────────────────────────────────────────────── */}
        {view === "chat" && (
          <motion.div key="chat" variants={pageVariants} initial="initial" animate="animate" exit="exit"
            className="flex flex-col h-screen max-w-[560px] mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
              <div className="flex items-center gap-3">
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setView("home")} className="btn-ghost w-9 h-9"><ArrowLeft size={18}/></motion.button>
                <BrandOrb size={34} spin />
                <div>
                  <div className="text-sm font-semibold text-white">Umang AI</div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <div className="w-1.5 h-1.5 rounded-full status-online" />
                    <span>Online</span>
                  </div>
                </div>
              </div>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => { setMessages([]); setView("home"); }} className="btn-ghost w-9 h-9"><Plus size={18}/></motion.button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
              <AnimatePresence initial={false}>
                {messages.map((m, i) => (
                  <motion.div key={i} variants={bubbleVariants} initial="initial" animate="animate"
                    className={`flex items-end gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    {m.role === "assistant" && <BrandOrb size={26} spin={false} />}
                    <div className={`max-w-[80%] px-5 py-3.5 rounded-2xl text-[15px] leading-relaxed ${
                      m.role === "user"
                        ? "text-white rounded-br-md"
                        : "text-gray-100 rounded-bl-md border"
                    }`}
                      style={m.role === "user"
                        ? { background: "linear-gradient(135deg,#ff8a5c,#ea580c)", boxShadow: "0 6px 20px rgba(234,88,12,.3)" }
                        : { background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" }}>
                      {m.text || (
                        <div className="flex gap-1.5 py-0.5">
                          <div className="typing-dot w-1.5 h-1.5" /><div className="typing-dot w-1.5 h-1.5" /><div className="typing-dot w-1.5 h-1.5" />
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 pb-5 pt-2">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
                <input
                  className="flex-1 bg-transparent border-none outline-none text-white text-[15px] py-2 placeholder-gray-600"
                  placeholder="Reply to Umang..."
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendTextMessage()}
                  autoFocus
                />
                <motion.button whileTap={{ scale: 0.9 }}
                  className="btn-primary w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  onClick={() => sendTextMessage()} disabled={isSending}>
                  {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── VOICE ─────────────────────────────────────────────────────── */}
        {view === "voice" && (
          <motion.div key="voice" variants={pageVariants} initial="initial" animate="animate" exit="exit"
            className="min-h-screen flex flex-col items-center justify-center gap-12 px-6">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => { if (voiceState === "listening") mediaRecorderRef.current?.stop(); setVoiceState("idle"); setView("home"); }}
              className="absolute top-7 right-7 btn-ghost w-10 h-10"><X size={20}/></motion.button>

            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-2">Voice Assistant</h2>
              <p className="text-gray-400 text-sm">
                {voiceState === "idle" && "Tap the mic to start speaking"}
                {voiceState === "listening" && "🎙️ Listening... tap to stop"}
                {voiceState === "thinking" && "💭 Processing your message..."}
                {voiceState === "speaking" && "🔊 Umang is responding..."}
              </p>
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
              animate={voiceState === "listening" ? { scale: [1, 1.08, 1], transition: { repeat: Infinity, duration: 1.5 } } : {}}
              onClick={toggleVoice}
              disabled={voiceState === "thinking" || voiceState === "speaking"}
              className={`w-40 h-40 rounded-full flex items-center justify-center text-white ${voiceState === "listening" ? "orb-pulse" : ""}`}
              style={{
                background: voiceState === "listening"
                  ? "linear-gradient(135deg,#ef4444,#dc2626)"
                  : voiceState === "speaking"
                  ? "linear-gradient(135deg,#10b981,#059669)"
                  : "linear-gradient(135deg,#ff8a5c,#ea580c)",
                boxShadow: "0 20px 60px rgba(255,138,92,0.4)",
              }}>
              {voiceState === "listening" ? <Square size={42}/> : voiceState === "thinking" ? <Loader2 size={40} className="animate-spin"/> : <Mic size={42}/>}
            </motion.button>

            <p className="text-gray-500 text-xs text-center max-w-xs">
              {voiceState === "idle" ? "Speak Hindi or English — Umang understands both" : ""}
            </p>
          </motion.div>
        )}

        {/* ── SETTINGS ───────────────────────────────────────────────────── */}
        {view === "settings" && (
          <motion.div key="settings" variants={pageVariants} initial="initial" animate="animate" exit="exit"
            className="min-h-screen flex items-start justify-center px-5 py-8">
            <div className="glass rounded-[32px] p-9 w-full max-w-[520px]">
              <div className="flex items-center gap-3 mb-8">
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setView("home")} className="btn-ghost w-9 h-9"><ArrowLeft size={18}/></motion.button>
                <h2 className="text-xl font-bold text-white">Settings</h2>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Your Name</label>
                  <input className="input-base" value={userName} readOnly />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Family Emergency Contact Email</label>
                  <input className="input-base mb-3" placeholder="family@example.com" value={familyEmail} onChange={e => setFamilyEmail(e.target.value)} />
                  <motion.button whileTap={{ scale: 0.97 }} onClick={saveSettings}
                    className="btn-primary w-full py-3.5 rounded-2xl text-sm font-semibold">
                    {settingsStatus === "saving" ? "Saving..." : settingsStatus === "saved" ? "✓ Saved!" : "Save Settings"}
                  </motion.button>
                </div>

                {/* SOS */}
                <div className="pt-4 border-t" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Emergency SOS Alert</label>
                  <p className="text-xs text-gray-500 mb-3">Instantly notify your family contact — bypasses all cooldowns.</p>
                  <motion.button whileTap={{ scale: 0.97 }}
                    onClick={triggerSOS}
                    disabled={sosStatus === "sending"}
                    className={`w-full py-4 rounded-2xl text-sm font-bold text-white ${sosStatus === "sending" ? "opacity-70" : "sos-pulse"}`}
                    style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)", boxShadow: "0 8px 24px rgba(239,68,68,.35)" }}>
                    <Siren size={18} className="inline mr-2 mb-0.5"/>
                    {sosStatus === "idle" && "🚨 Send SOS Alert"}
                    {sosStatus === "sending" && "Sending..."}
                    {sosStatus === "sent" && "✓ Alert Sent!"}
                    {sosStatus === "error" && "✗ Failed — Try Again"}
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── NEWS ───────────────────────────────────────────────────────── */}
        {view === "news" && (
          <motion.div key="news" variants={pageVariants} initial="initial" animate="animate" exit="exit"
            className="min-h-screen flex items-start justify-center px-5 py-8">
            <div className="glass rounded-[32px] p-9 w-full max-w-[520px]">
              <div className="flex items-center gap-3 mb-6">
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setView("home")} className="btn-ghost w-9 h-9"><ArrowLeft size={18}/></motion.button>
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#38bdf8,#0284c7)" }}>
                  <Newspaper size={18} className="text-white"/>
                </div>
                <h2 className="text-xl font-bold text-white">Daily Briefing</h2>
              </div>
              {newsLoading ? (
                <div className="flex flex-col items-center gap-4 py-12">
                  <Loader2 size={32} className="animate-spin text-orange-400"/>
                  <p className="text-gray-400 text-sm">Fetching today's headlines...</p>
                </div>
              ) : newsSummary ? (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="text-gray-200 text-[15px] leading-relaxed whitespace-pre-wrap">
                  {newsSummary}
                </motion.p>
              ) : null}
            </div>
          </motion.div>
        )}

        {/* ── REMINDERS ──────────────────────────────────────────────────── */}
        {view === "reminders" && (
          <motion.div key="reminders" variants={pageVariants} initial="initial" animate="animate" exit="exit"
            className="min-h-screen flex items-start justify-center px-5 py-8">
            <div className="glass rounded-[32px] p-9 w-full max-w-[520px]">
              <div className="flex items-center gap-3 mb-6">
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setView("home")} className="btn-ghost w-9 h-9"><ArrowLeft size={18}/></motion.button>
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#fbbf24,#d97706)" }}>
                  <Bell size={18} className="text-white"/>
                </div>
                <h2 className="text-xl font-bold text-white">Reminders</h2>
              </div>

              {/* Add */}
              <div className="flex flex-col gap-2 mb-6 p-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <input className="input-base" placeholder="Reminder title (e.g. Morning BP tablet)" value={newReminderTitle} onChange={e => setNewReminderTitle(e.target.value)} />
                <div className="flex gap-2">
                  <input type="time" className="input-base flex-1" value={newReminderTime} onChange={e => setNewReminderTime(e.target.value)} />
                  <motion.button whileTap={{ scale: 0.95 }} onClick={addReminder} className="btn-primary px-5 py-3 rounded-2xl text-sm font-semibold flex items-center gap-1.5">
                    <Plus size={16}/> Add
                  </motion.button>
                </div>
              </div>

              {remindersLoading ? (
                <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-orange-400"/></div>
              ) : remindersList.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-8">No reminders yet. Add one above!</p>
              ) : (
                <ul className="space-y-3">
                  <AnimatePresence>
                    {remindersList.map((r, i) => (
                      <motion.li key={r.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ delay: i * 0.05 }}
                        className="flex items-center justify-between p-4 rounded-2xl"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div>
                          <div className="text-white font-medium text-sm">{r.title}</div>
                          <div className="text-gray-400 text-xs mt-0.5">⏰ {r.time}</div>
                        </div>
                        <div className="flex gap-2">
                          <motion.button whileTap={{ scale: 0.9 }} onClick={() => completeReminder(r.id)}
                            className="btn-ghost w-8 h-8 text-green-400 hover:bg-green-400/10"><CheckCircle size={16}/></motion.button>
                          <motion.button whileTap={{ scale: 0.9 }} onClick={() => deleteReminder(r.id)}
                            className="btn-ghost w-8 h-8 text-red-400 hover:bg-red-400/10"><Trash2 size={16}/></motion.button>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>
          </motion.div>
        )}

        {/* ── MOOD ───────────────────────────────────────────────────────── */}
        {view === "mood" && (
          <motion.div key="mood" variants={pageVariants} initial="initial" animate="animate" exit="exit"
            className="min-h-screen flex items-start justify-center px-5 py-8">
            <div className="glass rounded-[32px] p-9 w-full max-w-[520px]">
              <div className="flex items-center gap-3 mb-6">
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setView("home")} className="btn-ghost w-9 h-9"><ArrowLeft size={18}/></motion.button>
                <h2 className="text-xl font-bold text-white">Mood Analysis</h2>
              </div>
              {moodStatus === "camera_active" && (
                <div className="space-y-4">
                  <video ref={videoRef} className="w-full rounded-2xl bg-black" style={{ transform: "scaleX(-1)" }} />
                  <canvas ref={canvasRef} className="hidden" />
                  <motion.button whileTap={{ scale: 0.97 }} onClick={captureMood}
                    className="btn-primary w-full py-4 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2">
                    <Camera size={18}/> Capture & Analyse
                  </motion.button>
                </div>
              )}
              {moodStatus === "analyzing" && (
                <div className="flex flex-col items-center gap-4 py-12">
                  <Loader2 size={36} className="animate-spin text-orange-400"/>
                  <p className="text-gray-300">Analysing your expression...</p>
                </div>
              )}
              {moodStatus === "result" && moodResult && (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
                  <div className="text-6xl mb-4">{{"happy":"😊","sad":"😢","angry":"😠","surprised":"😮","fear":"😰","disgust":"🤢","neutral":"😐","worried":"😟","lonely":"😔"}[moodResult] || "🙂"}</div>
                  <p className="text-2xl font-bold text-white capitalize mb-2">{moodResult}</p>
                  <p className="text-gray-400 text-sm">That's how I read your expression.</p>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => sendTextMessage(`I am feeling ${moodResult} right now`)}
                    className="btn-primary mt-6 px-6 py-3 rounded-2xl text-sm font-semibold">
                    Chat About This
                  </motion.button>
                </motion.div>
              )}
              {moodStatus === "error" && <p className="text-red-400 text-center py-8">Could not detect mood. Please try again.</p>}
            </div>
          </motion.div>
        )}

        {/* ── FAMILY DASHBOARD ───────────────────────────────────────────── */}
        {view === "family" && (
          <motion.div key="family" variants={pageVariants} initial="initial" animate="animate" exit="exit"
            className="min-h-screen flex items-start justify-center px-5 py-8">
            <div className="glass rounded-[32px] p-9 w-full max-w-[520px]">
              <div className="flex items-center gap-3 mb-6">
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setView("home")} className="btn-ghost w-9 h-9"><ArrowLeft size={18}/></motion.button>
                <h2 className="text-xl font-bold text-white">Family Dashboard</h2>
              </div>
              {dashboardLoading ? (
                <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-orange-400"/></div>
              ) : dashboardData ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: "Negative Emotions (7d)", value: dashboardData.negative_emotions_count ?? 0, color: "#ef4444" },
                      { label: "Active Reminders", value: dashboardData.active_reminders_count ?? 0, color: "#ff8a5c" },
                    ].map((s, i) => (
                      <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                        className="p-4 rounded-2xl text-center" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div className="text-3xl font-bold mb-1" style={{ color: s.color }}>{s.value}</div>
                        <div className="text-xs text-gray-400">{s.label}</div>
                      </motion.div>
                    ))}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-400 mb-3">Recent Activity</p>
                    <div className="space-y-2">
                      {(dashboardData.recent_messages || []).slice(0, 5).map((m: any, i: number) => (
                        <div key={i} className="text-sm text-gray-300 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
                          <small className="text-gray-500 block mb-1">{m.role} · {m.emotion || "neutral"}</small>
                          {m.message?.slice(0, 80)}...
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : <p className="text-gray-500 text-center py-10">No data available.</p>}
            </div>
          </motion.div>
        )}

        {/* ── HISTORY ────────────────────────────────────────────────────── */}
        {view === "history" && (
          <motion.div key="history" variants={pageVariants} initial="initial" animate="animate" exit="exit"
            className="min-h-screen flex items-start justify-center px-5 py-8">
            <div className="glass rounded-[32px] p-9 w-full max-w-[520px]">
              <div className="flex items-center gap-3 mb-6">
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setView("home")} className="btn-ghost w-9 h-9"><ArrowLeft size={18}/></motion.button>
                <h2 className="text-xl font-bold text-white">Chat History</h2>
              </div>
              {historyLoading ? (
                <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-orange-400"/></div>
              ) : (
                <>
                  <div className="space-y-3 mb-6">
                    {historyMessages.map((m, i) => (
                      <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                        className={`p-3.5 rounded-xl text-sm border-l-2 ${m.role === "user" ? "border-orange-400" : "border-purple-500"}`}
                        style={{ background: "rgba(255,255,255,0.04)" }}>
                        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                          <span className="capitalize font-medium">{m.role}</span>
                          {m.emotion && <span className="capitalize">{m.emotion}</span>}
                          <span>{m.created_at ? new Date(m.created_at).toLocaleDateString("en-IN") : ""}</span>
                        </div>
                        <p className="text-gray-300 leading-relaxed">{m.message}</p>
                      </motion.div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center text-sm text-gray-400">
                    <motion.button whileTap={{ scale: 0.95 }} disabled={historyPage <= 1}
                      onClick={() => fetchHistory(historyPage - 1)}
                      className="flex items-center gap-1 px-3 py-2 rounded-xl disabled:opacity-40 hover:bg-white/5 transition-colors">
                      <ChevronLeft size={16}/> Prev
                    </motion.button>
                    <span>Page {historyPage}</span>
                    <motion.button whileTap={{ scale: 0.95 }} disabled={historyPage * 20 >= historyTotal}
                      onClick={() => fetchHistory(historyPage + 1)}
                      className="flex items-center gap-1 px-3 py-2 rounded-xl disabled:opacity-40 hover:bg-white/5 transition-colors">
                      Next <ChevronRight size={16}/>
                    </motion.button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* ── DIARY ──────────────────────────────────────────────────────── */}
        {view === "diary" && (
          <motion.div key="diary" variants={pageVariants} initial="initial" animate="animate" exit="exit"
            className="min-h-screen flex items-start justify-center px-5 py-8">
            <div className="glass rounded-[32px] p-9 w-full max-w-[520px]">
              <div className="flex items-center gap-3 mb-6">
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setView("home")} className="btn-ghost w-9 h-9"><ArrowLeft size={18}/></motion.button>
                <h2 className="text-xl font-bold text-white">Health Diary</h2>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">How are you feeling?</label>
                  <select className="input-base" value={diaryMood} onChange={e => setDiaryMood(e.target.value)}
                    style={{ background: "rgba(255,255,255,0.05)", color: "white" }}>
                    {["great","good","okay","tired","sad","worried","sick"].map(m => (
                      <option key={m} value={m} style={{ background: "#16171d" }}>{m.charAt(0).toUpperCase()+m.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Energy Level: {diaryEnergy}/5</label>
                  <input type="range" min={1} max={5} value={diaryEnergy} onChange={e => setDiaryEnergy(Number(e.target.value))}
                    className="w-full accent-orange-400"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Notes (optional)</label>
                  <textarea className="input-base resize-none h-24" placeholder="How was your day? Any health notes..."
                    value={diaryNote} onChange={e => setDiaryNote(e.target.value)} />
                </div>
                <motion.button whileTap={{ scale: 0.97 }} onClick={saveDiaryEntry}
                  className="btn-primary w-full py-4 rounded-2xl text-sm font-semibold">
                  {diaryStatus === "saving" ? "Saving..." : diaryStatus === "saved" ? "✓ Saved!" : "Save Today's Entry"}
                </motion.button>
              </div>

              {diaryEntries.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-400 mb-3">Past Entries</p>
                  <div className="space-y-3">
                    {diaryEntries.slice(0, 7).map((e, i) => (
                      <div key={i} className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
                        <div className="flex gap-2 mb-1.5">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-orange-400/20 text-orange-300 capitalize">{e.mood || "?"}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-400/20 text-purple-300">⚡ {e.energy}/5</span>
                        </div>
                        {e.note && <p className="text-xs text-gray-400">{e.note}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── AVATAR ─────────────────────────────────────────────────────── */}
        {view === "avatar" && (
          <motion.div key="avatar" variants={pageVariants} initial="initial" animate="animate" exit="exit"
            className="min-h-screen flex items-center justify-center px-5">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => { if (avatarTimerRef.current) clearInterval(avatarTimerRef.current); setAvatarStatus("idle"); setAvatarVideoUrl(null); setAvatarInput(""); setView("home"); }}
              className="absolute top-7 right-7 btn-ghost w-10 h-10"><X size={20}/></motion.button>

            <div className="glass rounded-[32px] p-10 w-full max-w-[480px] text-center">
              <div className="flex justify-center mb-4"><BrandOrb size={60}/></div>
              <h2 className="text-2xl font-bold text-white mb-2">Avatar Chat</h2>
              <p className="text-gray-400 text-sm mb-8">Umang responds as a lip-synced video avatar</p>

              {avatarStatus !== "ready" && (
                <div className="flex gap-2 mb-4">
                  <input className="input-base flex-1" placeholder="Ask Umang something..."
                    value={avatarInput} onChange={e => setAvatarInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && generateAvatar()} />
                  <motion.button whileTap={{ scale: 0.95 }} onClick={generateAvatar} className="btn-primary px-5 py-3 rounded-2xl text-sm font-semibold flex-shrink-0">
                    <Send size={16}/>
                  </motion.button>
                </div>
              )}

              {avatarStatus === "generating" && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Loader2 size={32} className="animate-spin text-orange-400"/>
                  <p className="text-gray-300 text-sm">Generating avatar response... ({avatarElapsed}s)</p>
                  <p className="text-gray-500 text-xs">This may take 60–90 seconds</p>
                </div>
              )}

              {avatarStatus === "ready" && avatarVideoUrl && (
                <div className="space-y-4">
                  <video src={avatarVideoUrl} controls autoPlay className="w-full rounded-2xl"/>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => { setAvatarStatus("idle"); setAvatarVideoUrl(null); setAvatarInput(""); }}
                    className="w-full py-3 rounded-2xl text-sm text-gray-400 hover:bg-white/5 transition-colors border border-white/10">
                    Ask Another Question
                  </motion.button>
                </div>
              )}
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
