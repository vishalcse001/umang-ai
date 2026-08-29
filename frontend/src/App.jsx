import { useState, useRef, useEffect, useCallback } from "react";
import "./App.css";

const API_BASE = "http://localhost:8000";
const WS_BASE  = "ws://localhost:8000";

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M3 11L21 3L13 21L11 13L3 11Z" fill="currentColor" />
    </svg>
  );
}

function MicIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor" />
      <path d="M5 11a7 7 0 0014 0M12 18v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="5" width="14" height="14" rx="3" fill="currentColor" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M15 19L8 12L15 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function VideoIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="6" width="14" height="12" rx="2" fill="currentColor" />
      <path d="M16 10L22 7V17L16 14V10Z" fill="currentColor" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}

function NewsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m-1 4h1m4-8h1m-1 4h1m-1 4h1"/>
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
    </svg>
  );
}

function App() {
  const [userName, setUserName] = useState(localStorage.getItem("umang_user_name") || "");
  const [nameInput, setNameInput] = useState("");
  // views: home | chat | voice | avatar | news | reminders | settings | mood
  const [view, setView] = useState("home"); 
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [voiceState, setVoiceState] = useState("idle");

  // Avatar states
  const [avatarInput, setAvatarInput] = useState("");
  const [avatarStatus, setAvatarStatus] = useState("idle");
  const [avatarVideoUrl, setAvatarVideoUrl] = useState(null);
  const [avatarElapsed, setAvatarElapsed] = useState(0);

  // News states
  const [newsSummary, setNewsSummary] = useState("");
  const [newsLoading, setNewsLoading] = useState(false);

  // Reminders states
  const [remindersList, setRemindersList] = useState([]);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [newReminderTitle, setNewReminderTitle] = useState("");
  const [newReminderTime, setNewReminderTime] = useState("");

  // Settings states
  const [familyEmail, setFamilyEmail] = useState("");
  const [settingsStatus, setSettingsStatus] = useState("idle");

  // Mood states
  const [moodStatus, setMoodStatus] = useState("idle"); // idle, camera_active, analyzing, result, error
  const [moodResult, setMoodResult] = useState(null);

  // Proactive check-in state
  const [checkins, setCheckins] = useState([]);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const chatEndRef = useRef(null);
  const avatarTimerRef = useRef(null);
  const wsRef = useRef(null); // persistent WebSocket connection
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const moodStreamRef = useRef(null);

  // Open (or reuse) the WebSocket connection for chat.
  const connectWebSocket = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return wsRef.current;
    const ws = new WebSocket(`${WS_BASE}/ws/chat`);
    wsRef.current = ws;
    ws.onerror = () => console.error("[WS] Connection error");
    ws.onclose = () => console.log("[WS] Disconnected");
    return ws;
  }, []);

  useEffect(() => {
    if (userName) {
      connectWebSocket();
      fetchCheckins();
    }
    return () => wsRef.current?.close();
  }, [userName]);

  useEffect(() => {
    if (view === "chat") {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, view]);

  useEffect(() => {
    if (view === "settings") fetchSettings();
    if (view === "reminders") fetchReminders();
    if (view === "news") fetchNews();
    if (view === "mood") startMoodCamera();
    else stopMoodCamera();

    return () => stopMoodCamera();
  }, [view, userName]);

  async function fetchCheckins() {
    try {
      const res = await fetch(`${API_BASE}/pending-checkins?user_name=${encodeURIComponent(userName)}`);
      const data = await res.json();
      setCheckins(data);
    } catch (e) {
      console.error("Failed to fetch check-ins", e);
    }
  }

  async function dismissCheckin(id) {
    try {
      await fetch(`${API_BASE}/pending-checkins/${id}/dismiss`, { method: "POST" });
      setCheckins((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      console.error(e);
    }
  }

  function confirmName() {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    localStorage.setItem("umang_user_name", trimmed);
    setUserName(trimmed);
  }

  function startNewConversation() {
    setMessages([]);
    setView("home");
  }

  async function sendTextMessage(initialText) {
    const userMessage = (initialText ?? inputText).trim();
    if (!userMessage || isSending) return;

    setView("chat");
    setMessages((prev) => [...prev, { role: "user", text: userMessage }]);
    setInputText("");
    setIsSending(true);
    setMessages((prev) => [...prev, { role: "assistant", text: "" }]);

    let fullText = "";

    const ws = connectWebSocket();

    // Helper: wait for WS to be open before sending
    const sendWhenReady = () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ message: userMessage, user_name: userName }));
      } else {
        ws.addEventListener("open", () => {
          ws.send(JSON.stringify({ message: userMessage, user_name: userName }));
        }, { once: true });
      }
    };

    await new Promise((resolve) => {
      ws.onmessage = (event) => {
        const token = event.data;
        if (token === "__END__") {
          setIsSending(false);
          resolve();
          return;
        }
        fullText += token;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", text: fullText };
          return updated;
        });
      };

      ws.onerror = () => {
        fullText = fullText || "Connection error. Please try again.";
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", text: fullText };
          return updated;
        });
        setIsSending(false);
        resolve();
      };

      sendWhenReady();
    });
  }

  async function toggleVoiceRecording() {
    if (voiceState === "idle") {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => audioChunksRef.current.push(event.data);
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await sendVoiceMessage(audioBlob);
      };

      mediaRecorder.start();
      setVoiceState("listening");
    } else if (voiceState === "listening") {
      mediaRecorderRef.current?.stop();
      setVoiceState("thinking");
    }
  }

  async function sendVoiceMessage(audioBlob) {
    try {
      const formData = new FormData();
      formData.append("file", audioBlob, "recording.webm");

      const response = await fetch(
        `${API_BASE}/voice-chat?user_name=${encodeURIComponent(userName)}`,
        { method: "POST", body: formData }
      );
      const audioResponseBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioResponseBlob);
      const audio = new Audio(audioUrl);

      setVoiceState("speaking");
      audio.onended = () => setVoiceState("idle");
      audio.play();
    } catch (error) {
      console.error(error);
      setVoiceState("idle");
    }
  }

  function exitVoiceMode() {
    if (voiceState === "listening") mediaRecorderRef.current?.stop();
    setVoiceState("idle");
    setView("home");
  }

  // ---------------- Avatar (video reply) ----------------
  async function generateAvatarReply() {
    const message = avatarInput.trim();
    if (!message || avatarStatus === "generating") return;

    setAvatarStatus("generating");
    setAvatarVideoUrl(null);
    setAvatarElapsed(0);

    avatarTimerRef.current = setInterval(() => {
      setAvatarElapsed((prev) => prev + 1);
    }, 1000);

    try {
      const response = await fetch(`${API_BASE}/avatar-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, user_name: userName }),
      });
      const data = await response.json();
      if (data.video_url) {
        setAvatarVideoUrl(data.video_url);
        setAvatarStatus("ready");
      } else {
        setAvatarStatus("error");
      }
    } catch (error) {
      console.error(error);
      setAvatarStatus("error");
    } finally {
      clearInterval(avatarTimerRef.current);
    }
  }

  function exitAvatarMode() {
    clearInterval(avatarTimerRef.current);
    setAvatarStatus("idle");
    setAvatarVideoUrl(null);
    setAvatarInput("");
    setView("home");
  }

  // ---------------- New Features ----------------
  async function fetchSettings() {
    try {
      const res = await fetch(`${API_BASE}/user-settings?user_name=${encodeURIComponent(userName)}`);
      const data = await res.json();
      setFamilyEmail(data.family_email || "");
    } catch (e) {
      console.error("Failed to fetch settings", e);
    }
  }

  async function saveSettings() {
    setSettingsStatus("saving");
    try {
      await fetch(`${API_BASE}/user-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_name: userName, family_email: familyEmail }),
      });
      setSettingsStatus("saved");
      setTimeout(() => setSettingsStatus("idle"), 3000);
    } catch (e) {
      setSettingsStatus("error");
      setTimeout(() => setSettingsStatus("idle"), 3000);
    }
  }

  async function fetchNews() {
    setNewsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/daily-news?user_name=${encodeURIComponent(userName)}`);
      const data = await res.json();
      setNewsSummary(data.summary);
    } catch (e) {
      console.error(e);
      setNewsSummary("Failed to fetch news. Please try again later.");
    }
    setNewsLoading(false);
  }

  async function fetchReminders() {
    setRemindersLoading(true);
    try {
      const res = await fetch(`${API_BASE}/reminders?user_name=${encodeURIComponent(userName)}`);
      const data = await res.json();
      setRemindersList(data);
    } catch (e) {
      console.error(e);
    }
    setRemindersLoading(false);
  }

  async function addReminder() {
    if (!newReminderTitle.trim() || !newReminderTime) return;
    try {
      await fetch(`${API_BASE}/reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_name: userName,
          title: newReminderTitle,
          reminder_time: newReminderTime,
        }),
      });
      setNewReminderTitle("");
      setNewReminderTime("");
      fetchReminders();
    } catch (e) {
      console.error(e);
    }
  }

  async function startMoodCamera() {
    setMoodStatus("camera_active");
    setMoodResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      moodStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (e) {
      setMoodStatus("error");
      console.error(e);
    }
  }

  function stopMoodCamera() {
    if (moodStreamRef.current) {
      moodStreamRef.current.getTracks().forEach(t => t.stop());
      moodStreamRef.current = null;
    }
  }

  async function captureAndDetectMood() {
    if (!videoRef.current || !canvasRef.current) return;
    setMoodStatus("analyzing");
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      stopMoodCamera();
      const formData = new FormData();
      formData.append("file", blob, "face.jpg");
      try {
        const res = await fetch(`${API_BASE}/detect-face-emotion`, {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (data.dominant_emotion) {
          setMoodResult(data.dominant_emotion);
          setMoodStatus("result");
        } else {
          setMoodStatus("error");
        }
      } catch (e) {
        setMoodStatus("error");
      }
    }, 'image/jpeg');
  }


  // ---------------- Onboarding ----------------
  if (!userName) {
    return (
      <div className="shell">
        <div className="glow glow-1" />
        <div className="glow glow-2" />
        <div className="onboarding-card">
          <div className="brand-orb" />
          <h1>Umang AI</h1>
          <p className="tagline">Your Personal Companion</p>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirmName()}
            placeholder="Enter your name"
            autoFocus
          />
          <button className="primary-button" onClick={confirmName}>
            Get Started
          </button>
        </div>
      </div>
    );
  }

  // ---------------- Home ----------------
  if (view === "home") {
    return (
      <div className="shell">
        <div className="glow glow-1" />
        <div className="glow glow-2" />

        <div className="home-content">
          <div className="home-top-bar">
            <button className="icon-ghost-button" onClick={() => setView("settings")} title="Settings">
              <SettingsIcon />
            </button>
          </div>

          <h1 className="greeting">Welcome, {userName}</h1>
          <p className="greeting-sub">How can Umang assist you today?</p>

          <div className="input-pill">
            <button className="pill-icon-button" onClick={startNewConversation} title="New conversation">
              <PlusIcon />
            </button>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendTextMessage()}
              placeholder="Type your message here..."
              autoFocus
            />
            <button className="pill-icon-button accent" onClick={() => setView("voice")} title="Talk with voice">
              <MicIcon size={18} />
            </button>
            {inputText.trim() && (
              <button className="pill-icon-button accent" onClick={() => sendTextMessage()} title="Send">
                <SendIcon />
              </button>
            )}
          </div>

          <div className="action-grid">
            <button className="action-card" onClick={() => setView("voice")}>
              <div className="action-icon"><MicIcon size={20} /></div>
              <strong>Voice Assistant</strong>
              <span>Start an audio conversation</span>
            </button>
            <button className="action-card" onClick={() => setView("avatar")}>
              <div className="action-icon avatar-icon"><VideoIcon size={18} /></div>
              <strong>Avatar Chat</strong>
              <span>Interactive video response</span>
            </button>
            <button className="action-card" onClick={() => setView("news")}>
              <div className="action-icon news-icon"><NewsIcon /></div>
              <strong>Daily Briefing</strong>
              <span>Latest news and updates</span>
            </button>
            <button className="action-card" onClick={() => setView("reminders")}>
              <div className="action-icon reminders-icon"><BellIcon /></div>
              <strong>Reminders</strong>
              <span>Manage your daily schedule</span>
            </button>
            <button className="action-card" onClick={() => setView("mood")}>
              <div className="action-icon mood-icon"><CameraIcon /></div>
              <strong>Mood Analysis</strong>
              <span>Emotion detection via camera</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- Voice call mode ----------------
  if (view === "voice") {
    const statusText = {
      idle: "Tap to speak",
      listening: "Listening...",
      thinking: "Processing...",
      speaking: "Umang is speaking...",
    }[voiceState];

    return (
      <div className="shell voice-shell">
        <div className="glow glow-1" />
        <div className="glow glow-2" />
        <button className="close-button" onClick={exitVoiceMode}>
          <CloseIcon />
        </button>

        <div className="voice-stage">
          <div className={`voice-orb ${voiceState}`} />
          <p className="voice-status">{statusText}</p>
        </div>

        <button
          className={`voice-main-button ${voiceState}`}
          onClick={toggleVoiceRecording}
          disabled={voiceState === "thinking" || voiceState === "speaking"}
        >
          {voiceState === "listening" ? <StopIcon /> : <MicIcon size={26} />}
        </button>
      </div>
    );
  }

  // ---------------- Avatar (video reply) mode ----------------
  if (view === "avatar") {
    return (
      <div className="shell">
        <div className="glow glow-1" />
        <div className="glow glow-2" />
        <button className="close-button" onClick={exitAvatarMode}>
          <CloseIcon />
        </button>

        <div className="feature-card">
          <h2>Avatar Chat</h2>
          <p className="feature-subtitle">
            Umang will respond with a synthesized video. Generation takes approximately 60 seconds.
          </p>

          {avatarStatus === "idle" && (
            <div className="feature-input-row">
              <input
                type="text"
                value={avatarInput}
                onChange={(e) => setAvatarInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && generateAvatarReply()}
                placeholder="What would you like to discuss?"
                autoFocus
              />
              <button className="pill-icon-button accent" onClick={generateAvatarReply}>
                <SendIcon />
              </button>
            </div>
          )}

          {avatarStatus === "generating" && (
            <div className="feature-loading">
              <div className="feature-spinner" />
              <p>Generating video response... ({avatarElapsed}s)</p>
              <span className="feature-hint">Typical wait time is 60-90 seconds.</span>
            </div>
          )}

          {avatarStatus === "ready" && avatarVideoUrl && (
            <div className="feature-video-wrap">
              <video src={avatarVideoUrl} controls autoPlay className="feature-video" />
              <button className="secondary-button" onClick={() => setAvatarStatus("idle")}>
                Ask another question
              </button>
            </div>
          )}

          {avatarStatus === "error" && (
            <div className="feature-loading">
              <p>Failed to generate video response.</p>
              <button className="secondary-button" onClick={() => setAvatarStatus("idle")}>
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------------- News mode ----------------
  if (view === "news") {
    return (
      <div className="shell">
        <div className="glow glow-1" />
        <div className="glow glow-2" />
        <button className="close-button" onClick={() => setView("home")}>
          <CloseIcon />
        </button>

        <div className="feature-card news-card">
          <div className="card-header">
            <div className="action-icon news-icon"><NewsIcon /></div>
            <h2>Daily Briefing</h2>
          </div>
          
          {newsLoading ? (
            <div className="feature-loading">
              <div className="feature-spinner" />
              <p>Fetching latest updates...</p>
            </div>
          ) : (
            <div className="news-content">
              <p>{newsSummary}</p>
              <button className="secondary-button mt-4" onClick={fetchNews}>
                Refresh Briefing
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------------- Reminders mode ----------------
  if (view === "reminders") {
    return (
      <div className="shell">
        <div className="glow glow-1" />
        <div className="glow glow-2" />
        <button className="close-button" onClick={() => setView("home")}>
          <CloseIcon />
        </button>

        <div className="feature-card reminders-card">
          <div className="card-header">
            <div className="action-icon reminders-icon"><BellIcon /></div>
            <h2>Active Reminders</h2>
          </div>

          <div className="feature-input-row reminder-add">
            <input
              type="text"
              placeholder="Task or Medication (e.g., Blood Pressure)"
              value={newReminderTitle}
              onChange={(e) => setNewReminderTitle(e.target.value)}
            />
            <input
              type="time"
              value={newReminderTime}
              onChange={(e) => setNewReminderTime(e.target.value)}
            />
            <button className="pill-icon-button accent" onClick={addReminder}>
              <PlusIcon />
            </button>
          </div>

          {remindersLoading ? (
            <p className="text-center mt-4">Loading...</p>
          ) : remindersList.length === 0 ? (
            <p className="empty-state">No active reminders found.</p>
          ) : (
            <ul className="reminders-list">
              {remindersList.map((r) => (
                <li key={r.id} className="reminder-item">
                  <div className="reminder-info">
                    <strong>{r.title}</strong>
                    <span>{r.time}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  // ---------------- Settings mode ----------------
  if (view === "settings") {
    return (
      <div className="shell">
        <div className="glow glow-1" />
        <div className="glow glow-2" />
        <button className="close-button" onClick={() => setView("home")}>
          <CloseIcon />
        </button>

        <div className="feature-card settings-card">
          <div className="card-header">
            <div className="action-icon"><SettingsIcon /></div>
            <h2>Settings</h2>
          </div>

          <div className="settings-form">
            <label>
              <strong>Emergency Contact Email</strong>
              <span className="feature-hint d-block">This contact will receive alerts if persistent negative emotions are detected.</span>
              <input
                type="email"
                placeholder="contact@example.com"
                value={familyEmail}
                onChange={(e) => setFamilyEmail(e.target.value)}
              />
            </label>
            
            <button 
              className="primary-button" 
              onClick={saveSettings}
              disabled={settingsStatus === "saving"}
            >
              {settingsStatus === "saving" ? "Saving..." : settingsStatus === "saved" ? "Saved!" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- Mood mode ----------------
  if (view === "mood") {
    return (
      <div className="shell">
        <div className="glow glow-1" />
        <div className="glow glow-2" />
        <button className="close-button" onClick={() => setView("home")}>
          <CloseIcon />
        </button>

        <div className="feature-card mood-card">
          <div className="card-header">
            <div className="action-icon mood-icon"><CameraIcon /></div>
            <h2>Mood Analysis</h2>
          </div>
          <p className="feature-subtitle">Capture a photo to analyze your current emotional state.</p>

          {moodStatus === "camera_active" && (
            <div className="camera-wrap">
              <video ref={videoRef} className="camera-feed" autoPlay playsInline muted />
              <button className="primary-button mt-4" onClick={captureAndDetectMood}>
                Capture Photo
              </button>
            </div>
          )}

          {moodStatus === "analyzing" && (
            <div className="feature-loading">
              <div className="feature-spinner" />
              <p>Analyzing facial expressions...</p>
            </div>
          )}

          {moodStatus === "result" && (
            <div className="mood-result">
              <h3 className="mood-text">Detected Emotion: <strong>{moodResult}</strong></h3>
              <button className="secondary-button mt-4" onClick={startMoodCamera}>
                Retake Photo
              </button>
            </div>
          )}

          {moodStatus === "error" && (
            <div className="feature-loading">
              <p>Failed to detect emotion.</p>
              <button className="secondary-button mt-4" onClick={startMoodCamera}>
                Try again
              </button>
            </div>
          )}
          
          {/* Hidden canvas for image capture */}
          <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>
      </div>
    );
  }

  // ---------------- Chat view ----------------
  return (
    <div className="shell">
      <div className="glow glow-1" />
      <div className="glow glow-2" />

      <div className="chat-shell">
        <header className="chat-header">
          <button className="icon-ghost-button" onClick={() => setView("home")}>
            <BackIcon />
          </button>
          <div className="chat-header-title">
            <div className="brand-orb small" />
            <div>
              <strong>Umang AI</strong>
              <span><span className="status-dot" />Online</span>
            </div>
          </div>
          <button className="icon-ghost-button" onClick={() => setView("voice")} title="Switch to voice">
            <MicIcon size={18} />
          </button>
        </header>

        <div className="chat-window">
          {messages.map((msg, i) => (
            <div key={i} className={`message-row ${msg.role}`}>
              {msg.role === "assistant" && <div className="msg-avatar" />}
              <div className={`bubble ${msg.role}`}>
                <p>{msg.text}</p>
              </div>
            </div>
          ))}
          {isSending && messages[messages.length - 1]?.role === "user" && (
            <div className="message-row assistant">
              <div className="msg-avatar" />
              <div className="bubble assistant typing">
                <span></span><span></span><span></span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="input-pill in-chat">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendTextMessage()}
            placeholder="Type a message..."
          />
          <button className="pill-icon-button accent" onClick={() => sendTextMessage()} disabled={isSending}>
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;