import { useState, useRef, useEffect } from "react";
import "./App.css";

const API_BASE = "http://localhost:8000";

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

function App() {
  const [userName, setUserName] = useState(localStorage.getItem("umang_user_name") || "");
  const [nameInput, setNameInput] = useState("");
  const [view, setView] = useState("home"); // home | chat | voice | avatar
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [voiceState, setVoiceState] = useState("idle"); // idle | listening | thinking | speaking

  // Avatar (video reply) state
  const [avatarInput, setAvatarInput] = useState("");
  const [avatarStatus, setAvatarStatus] = useState("idle"); // idle | generating | ready | error
  const [avatarVideoUrl, setAvatarVideoUrl] = useState(null);
  const [avatarElapsed, setAvatarElapsed] = useState(0);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const chatEndRef = useRef(null);
  const avatarTimerRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    let revealedLength = 0;
    let streamDone = false;

    const revealLoop = () => {
      if (revealedLength < fullText.length) {
        const remaining = fullText.length - revealedLength;
        const step = Math.max(2, Math.ceil(remaining / 15));
        revealedLength = Math.min(revealedLength + step, fullText.length);
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", text: fullText.slice(0, revealedLength) };
          return updated;
        });
      }
      if (revealedLength < fullText.length || !streamDone) {
        requestAnimationFrame(revealLoop);
      }
    };
    requestAnimationFrame(revealLoop);

    try {
      const response = await fetch(`${API_BASE}/chat-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, user_name: userName }),
      });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
      }
    } catch (error) {
      console.error(error);
      fullText = fullText || "Something went wrong. Please try again.";
    } finally {
      streamDone = true;
      setIsSending(false);
    }
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

  // ---------------- Onboarding ----------------
  if (!userName) {
    return (
      <div className="shell">
        <div className="glow glow-1" />
        <div className="glow glow-2" />
        <div className="onboarding-card">
          <div className="brand-orb" />
          <h1>Umang AI</h1>
          <p className="tagline">Your companion, always here</p>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirmName()}
            placeholder="What should we call you?"
            autoFocus
          />
          <button className="primary-button" onClick={confirmName}>
            Get Started
          </button>
        </div>
      </div>
    );
  }

  // ---------------- Voice call mode ----------------
  if (view === "voice") {
    const statusText = {
      idle: "Tap to talk",
      listening: "Listening...",
      thinking: "Thinking...",
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

        <div className="avatar-card">
          <h2>Video Reply</h2>
          <p className="avatar-subtitle">
            Umang will reply with a short video. This takes about a minute to generate.
          </p>

          {avatarStatus === "idle" && (
            <div className="avatar-input-row">
              <input
                type="text"
                value={avatarInput}
                onChange={(e) => setAvatarInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && generateAvatarReply()}
                placeholder="What would you like to ask?"
                autoFocus
              />
              <button className="pill-icon-button accent" onClick={generateAvatarReply}>
                <SendIcon />
              </button>
            </div>
          )}

          {avatarStatus === "generating" && (
            <div className="avatar-loading">
              <div className="avatar-spinner" />
              <p>Generating your video reply... ({avatarElapsed}s)</p>
              <span className="avatar-hint">This usually takes 60-90 seconds.</span>
            </div>
          )}

          {avatarStatus === "ready" && avatarVideoUrl && (
            <div className="avatar-video-wrap">
              <video src={avatarVideoUrl} controls autoPlay className="avatar-video" />
              <button className="secondary-button" onClick={() => setAvatarStatus("idle")}>
                Ask something else
              </button>
            </div>
          )}

          {avatarStatus === "error" && (
            <div className="avatar-loading">
              <p>Something went wrong generating the video.</p>
              <button className="secondary-button" onClick={() => setAvatarStatus("idle")}>
                Try again
              </button>
            </div>
          )}
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
          <h1 className="greeting">Welcome back, {userName}</h1>
          <p className="greeting-sub">How are you feeling today?</p>

          <div className="input-pill">
            <button className="pill-icon-button" onClick={startNewConversation} title="New conversation">
              <PlusIcon />
            </button>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendTextMessage()}
              placeholder="Ask Umang anything..."
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

          <button className="voice-entry-card" onClick={() => setView("voice")}>
            <div className="voice-entry-icon"><MicIcon size={20} /></div>
            <div>
              <strong>Talk with Umang</strong>
              <span>Start a live voice conversation</span>
            </div>
          </button>

          <button className="voice-entry-card" onClick={() => setView("avatar")}>
            <div className="voice-entry-icon avatar-icon"><VideoIcon size={18} /></div>
            <div>
              <strong>See Umang</strong>
              <span>Get a video reply with a talking avatar</span>
            </div>
          </button>
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
            placeholder="Type your message..."
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