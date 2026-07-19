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

function App() {
  const [userName, setUserName] = useState(localStorage.getItem("umang_user_name") || "");
  const [nameInput, setNameInput] = useState("");
  const [view, setView] = useState("home"); // home | chat | voice
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [voiceState, setVoiceState] = useState("idle"); // idle | listening | thinking | speaking

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const chatEndRef = useRef(null);

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

    // Reveal speed is controlled entirely on the frontend, independent of
    // how the network delivers the response, guaranteeing a smooth typing
    // animation even if the backend response arrives in one chunk.
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

  // ---------------- Home ----------------
  if (view === "home") {
    return (
      <div className="shell">
        <div className="glow glow-1" />
        <div className="glow glow-2" />

        <div className="home-content">
          <h1 className="greeting">Namaste, {userName}</h1>
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