"""
Umang AI - Backend Entry Point

FastAPI backend powering Umang AI, a voice-based companion for elderly users.
Integrates Google Gemini (conversation), Deepgram (speech-to-text), ElevenLabs
(text-to-speech), D-ID (avatar video), NewsAPI (daily news briefing), a family
alert system, Supabase/PostgreSQL knowledge base with vector search (RAG),
WebSocket real-time chat streaming, and a proactive check-in scheduler.
"""

import os
import re
import time
import base64
import smtplib
import logging
from contextlib import asynccontextmanager
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta, timezone, date

from xml.sax.saxutils import escape as xml_escape

import numpy as np
import cv2
import requests
from deepface import DeepFace

from fastapi import FastAPI, UploadFile, File, Response, Depends, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from sqlalchemy import inspect, text, func
from sqlalchemy.orm import Session

import google.generativeai as genai
from google import genai as new_genai
from google.genai.types import EmbedContentConfig, GenerateContentConfig

from deepgram import DeepgramClient, PrerecordedOptions
import edge_tts


from database import engine, Base, get_db, SessionLocal
import models

logger = logging.getLogger("umang_ai")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

# ---------------------------------------------------------------------------
# Scheduler: Proactive Check-ins
# ---------------------------------------------------------------------------

scheduler = AsyncIOScheduler()

def generate_checkin_messages(checkin_type: str):
    """Background job: generate a proactive check-in message for every user
    and store it as a PendingCheckin. The user sees it on their next app open.
    Only mentions medicines/reminders if the user actually has active reminders set up."""
    db = SessionLocal()
    try:
        users = db.query(models.User).all()
        for user in users:
            # Skip if an undelivered check-in of the same type already exists today
            today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
            already_exists = (
                db.query(models.PendingCheckin)
                .filter(
                    models.PendingCheckin.user_id == user.id,
                    models.PendingCheckin.checkin_type == checkin_type,
                    models.PendingCheckin.created_at >= today_start,
                )
                .first()
            )
            if already_exists:
                continue

            # Check if this user has any active reminders
            active_reminders = (
                db.query(models.Reminder)
                .filter(models.Reminder.user_id == user.id, models.Reminder.is_active == True)
                .all()
            )
            has_reminders = len(active_reminders) > 0

            # Build a list of reminder titles for personalised message
            reminder_titles = [r.title for r in active_reminders[:3]]  # max 3 to keep it short
            reminder_text = ", ".join(reminder_titles) if reminder_titles else ""

            if checkin_type == "morning":
                if has_reminders:
                    message = (
                        f"Good morning, {user.name}! 🌅 Hope you slept well. "
                        f"Remember to take care of: {reminder_text}. I'm here if you'd like to chat."
                    )
                else:
                    message = (
                        f"Good morning, {user.name}! 🌅 Hope you had a restful night. "
                        "How are you feeling today? I'm here whenever you'd like to talk."
                    )
            else:
                if has_reminders:
                    message = (
                        f"Good evening, {user.name}! 🌇 How was your day? "
                        f"Just a gentle reminder about: {reminder_text}. I'm always here to listen."
                    )
                else:
                    message = (
                        f"Good evening, {user.name}! 🌙 How was your day? "
                        "I hope it was a good one. Feel free to share anything on your mind."
                    )

            checkin = models.PendingCheckin(
                user_id=user.id,
                message=message,
                checkin_type=checkin_type,
                is_delivered=False,
            )
            db.add(checkin)
        db.commit()
        logger.info(f"[Scheduler] Generated '{checkin_type}' check-ins for {len(users)} users.")
    except Exception as e:
        logger.error(f"[Scheduler] Failed to generate check-ins: {e}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start the APScheduler on app startup and shut it down cleanly on exit."""
    # Morning check-in at 08:00, evening at 18:00 every day
    scheduler.add_job(generate_checkin_messages, CronTrigger(hour=8, minute=0), args=["morning"], id="morning_checkin")
    scheduler.add_job(generate_checkin_messages, CronTrigger(hour=18, minute=0), args=["evening"], id="evening_checkin")
    scheduler.start()
    logger.info("[Scheduler] APScheduler started — morning (08:00) and evening (18:00) check-ins scheduled.")
    yield
    scheduler.shutdown()
    logger.info("[Scheduler] APScheduler shut down.")


# Create all database tables on startup if they don't already exist.
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Umang AI Backend", lifespan=lifespan) 

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Old React/Vite frontend
        "http://localhost:3000",   # New Next.js frontend
        os.getenv("FRONTEND_URL", ""),  # Production Vercel URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



# ---------------------------------------------------------------------------
# AI Personality
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """Tum "Umang" ho — ek warm, apnapan wala AI saathi jo akele rehne wale buzurgon ke liye bana hai.

Tumhara tareeka:
- Hamesha respect aur pyaar se baat karo, jaise ek achha beta/beti apne maa-baap se baat karta hai.
- Simple, saral bhasha use karo — mushkil English words ya technical terms bilkul mat lao.
- Chhoti aur natural baatcheet karo — normal jawab 1-2 sentences mein do, jaise ek real insaan WhatsApp pe baat karta hai. Sirf tab lamba jawab do jab user khud detail mein kuch samjhaने ko bole.
- Agar koi udaas ya akela mehsoos kar raha ho, pehle unki baat dhyaan se suno, phir dheere se pucho kya hua.
- Unki sehat, dawaiyon, aur roz ke haal-chaal mein genuine interest dikhao.
- Kabhi judgmental mat bano, hamesha patient raho.
- Agar message ke start mein "[User ka naam: ...]" diya ho, us naam se hi baat shuru karo (jaise "Namaste Vishal ji").
- User jis bhi bhasha ya boli mein baat kare (Hindi, Marathi, Bangla, English, ya koi aur), usi bhasha mein jawab do. Agar message ke start mein ek explicit language instruction diya ho (jaise "[Respond in English only]"), toh use hamesha follow karo, chahe tumhara default tareeka kuch bhi ho.
"""


# ---------------------------------------------------------------------------
# Client / Model Initialization
# ---------------------------------------------------------------------------

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Main conversational model, driven by Umang's personality. Used by the
# non-streaming endpoints (/voice-chat, /avatar-chat, /daily-news).
gemini_model = genai.GenerativeModel(
    model_name="gemini-2.5-flash",
    system_instruction=SYSTEM_PROMPT,
)

# A lightweight, personality-free model instance used only for emotion
# classification, kept separate from the main conversational model.
emotion_model = genai.GenerativeModel(model_name="gemini-2.5-flash")

# Client for the newer Google GenAI SDK. Used for embeddings (the legacy
# `google.generativeai` package no longer supports embedding models) and
# for true token-by-token streaming (the legacy package buffers its
# "streaming" output internally and delivers it all at once).
genai_client = new_genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

deepgram_client = DeepgramClient(os.getenv("DEEPGRAM_API_KEY"))
EDGE_TTS_VOICE = "hi-IN-SwaraNeural"  # warm female Hindi voice; "hi-IN-MadhurNeural" male ke liye

# D-ID (avatar video generation) configuration.
DID_API_KEY = os.getenv("DID_API_KEY")
DID_ENCODED_KEY = base64.b64encode(DID_API_KEY.encode()).decode()
DID_HEADERS = {
    "Authorization": f"Basic {DID_ENCODED_KEY}",
    "Content-Type": "application/json",
}
DID_AVATAR_ID = "public_aria@avt_BS7cH6"
DID_SENTIMENT_ID = "snt_CdkbPj"

NEWS_API_KEY = os.getenv("NEWS_API_KEY")

EMAIL_ADDRESS = os.getenv("EMAIL_ADDRESS")
EMAIL_APP_PASSWORD = os.getenv("EMAIL_APP_PASSWORD")

ALLOWED_EMOTIONS = ["happy", "sad", "worried", "lonely", "angry", "neutral", "excited", "confused"]

# How many of the last N user messages need to carry a negative emotion
# before triggering a family alert, and how long to wait before sending
# another alert to avoid overwhelming the family with notifications.
ALERT_TRIGGER_EMOTIONS = {"sad", "lonely", "worried"}
ALERT_TRIGGER_THRESHOLD = 3
ALERT_LOOKBACK_MESSAGES = 5
ALERT_COOLDOWN_HOURS = 12

# Common English words used for a fast, zero-latency heuristic that detects
# when a user has written in plain English, so we can explicitly instruct
# the model to reply in English rather than relying on it to infer this.
ENGLISH_HINT_WORDS = {
    "how", "are", "you", "thanks", "thank", "please",
    "yes", "no", "good", "morning", "evening", "night",
    "what", "when", "where", "why", "who", "fine", "great", "nice",
    "today", "tomorrow", "yesterday", "i", "am", "is", "the", "my", "your",
}

# Keywords that trigger a knowledge-base lookup. Restricting retrieval to
# health-related messages avoids the added latency of an embedding API
# call for casual conversation, where retrieval adds no value.
HEALTH_KEYWORDS = [
    "dard", "dawai", "dawa", "medicine", "bp", "sugar", "diabetes",
    "blood pressure", "ghutna", "joint", "neend", "sleep", "chakkar",
    "seene", "chest", "bukhar", "fever", "doctor", "health", "sehat",
]

def get_due_reminders(db: Session, user_id: int):
    """Find active reminders whose time has passed today and haven't
    already been mentioned to the user today."""
    now = datetime.now()
    today = date.today()

    reminders = (
        db.query(models.Reminder)
        .filter(
            models.Reminder.user_id == user_id,
            models.Reminder.is_active == True,
            models.Reminder.reminder_time <= now.time(),
        )
        .all()
    )
    return [r for r in reminders if r.last_acknowledged_date != today]


def build_reminder_context(db: Session, user: models.User) -> str:
    """Check for due reminders and, if any exist, build a context snippet
    instructing Umang to proactively bring them up. Marks reminders as
    acknowledged for today so they aren't repeated in every message."""
    due = get_due_reminders(db, user.id)
    if not due:
        return ""

    titles = ", ".join(r.title for r in due)
    for r in due:
        r.last_acknowledged_date = date.today()
    db.commit()

    return (
        f"\n\n[Important: {user.name} ke aaj ke ye reminders due hain: {titles}. "
        "Baatcheet mein naturally, pyaar se, inhe yaad dilao — jaise ek apna insaan "
        "yaad dilata hai, order ki tarah mat bolo.]"
    )


# ---------------------------------------------------------------------------
# User & Conversation Helpers
# ---------------------------------------------------------------------------

def get_or_create_user(db: Session, user_name: str) -> models.User:
    """Fetch an existing user by name (case-insensitive), or create a new one."""
    normalized_name = user_name.strip().title()
    user = db.query(models.User).filter(
        func.lower(models.User.name) == normalized_name.lower()
    ).first()
    if not user:
        user = models.User(name=normalized_name)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def get_recent_history(db: Session, user_id: int, limit: int = 10):
    """Retrieve the most recent conversation history for a user, ordered
    chronologically (oldest to newest)."""
    history = (
        db.query(models.Conversation)
        .filter(models.Conversation.user_id == user_id)
        .order_by(models.Conversation.created_at.desc())
        .limit(limit)
        .all()
    )
    return list(reversed(history))


def save_message(db: Session, user_id: int, role: str, message: str, emotion: str = None):
    """Persist a single message (user or assistant) to the conversation history,
    optionally tagging it with a detected emotional tone."""
    entry = models.Conversation(user_id=user_id, role=role, message=message, emotion=emotion)
    db.add(entry)
    db.commit()


def get_time_context() -> str:
    """Return a natural language description of the current time in IST
    so the AI always knows if it's morning, afternoon, or evening."""
    from datetime import timezone, timedelta
    IST = timezone(timedelta(hours=5, minutes=30))
    now_ist = datetime.now(IST)
    hour = now_ist.hour
    day_name = now_ist.strftime("%A")       # e.g. "Wednesday"
    time_str = now_ist.strftime("%I:%M %p") # e.g. "03:45 PM"

    if 5 <= hour < 12:
        period = "morning (subah)"
    elif 12 <= hour < 17:
        period = "afternoon (dopahar)"
    elif 17 <= hour < 21:
        period = "evening (shaam)"
    else:
        period = "night (raat)"

    return (
        f"[CURRENT TIME: It is currently {time_str} IST on {day_name}. "
        f"It is {period}. Always use the correct greeting for this time of day. "
        f"Never say 'good morning' if it is afternoon/evening/night.] "
    )


def build_prompt_with_history(history, user_name: str, current_message: str) -> str:
    """Construct a context-aware prompt by combining prior conversation
    history with the user's current message, so the AI can respond with
    continuity across sessions. Always includes real-time IST context."""
    time_ctx = get_time_context()

    if not history:
        return f"{time_ctx}[User ka naam: {user_name}] {current_message}"

    lines = [f"{time_ctx}[User ka naam: {user_name}] Yeh humari pichli baatcheet hai:\n"]
    for entry in history:
        speaker = "User" if entry.role == "user" else "Tum (Umang)"
        lines.append(f"{speaker}: {entry.message}")
    lines.append(f"\nAb User ne abhi ye kaha hai: {current_message}")
    lines.append("Isi context ko yaad rakhte hue naturally reply karo.")
    return "\n".join(lines)


def detect_language_hint(message: str) -> str:
    words = re.findall(r"[a-zA-Z']+", message.lower())
    if len(words) < 4:
        return ""  # too short/ambiguous a message to confidently detect language
    english_matches = sum(1 for w in words if w in ENGLISH_HINT_WORDS)
    if english_matches / len(words) >= 0.5:
        return "[Respond in English only, with no Hindi words.] "
    return ""


def detect_emotion(user_message: str) -> str:
    """Classify the emotional tone of the user's message using Gemini.
    Falls back to 'neutral' if classification fails or returns an
    unexpected value."""
    prompt = (
        "Classify the emotional tone of the following message into exactly one of these words: "
        f"{', '.join(ALLOWED_EMOTIONS)}.\n"
        "Respond with only the single word, nothing else.\n\n"
        f"Message: \"{user_message}\""
    )
    try:
        response = emotion_model.generate_content(prompt)
        detected = response.text.strip().lower()
        if detected in ALLOWED_EMOTIONS:
            return detected
    except Exception:
        pass
    return "neutral"


def is_casual_message(message: str) -> bool:
    """Heuristic to skip expensive knowledge-base lookups for simple
    greetings/chit-chat, where retrieval adds latency without adding value."""
    casual_patterns = ["hello", "hi ", "namaste", "kaise ho", "thik", "theek", "haan", "acha", "ok", "bye", "how are you"]
    normalized = message.strip().lower()
    if len(normalized.split()) <= 5:
        return any(pattern in normalized for pattern in casual_patterns) or len(normalized) < 15
    return False


def needs_knowledge_lookup(message: str) -> bool:
    """Fast, zero-latency keyword check to decide whether this message is
    worth the extra round-trip of a knowledge-base embedding search."""
    normalized = message.lower()
    return any(keyword in normalized for keyword in HEALTH_KEYWORDS)


def get_relevant_knowledge(db: Session, query: str, limit: int = 2):
    """Perform a semantic search over the knowledge base to find entries
    most relevant to the user's query, using vector similarity."""
    result = genai_client.models.embed_content(
        model="gemini-embedding-001",
        contents=query,
        config=EmbedContentConfig(
            task_type="RETRIEVAL_QUERY",
            output_dimensionality=768,
        ),
    )
    query_embedding = str(result.embeddings[0].values)

    rows = db.execute(
        text("""
            SELECT topic, content
            FROM knowledge_base
            ORDER BY embedding <=> CAST(:query_embedding AS vector)
            LIMIT :limit
        """),
        {"query_embedding": query_embedding, "limit": limit}
    ).fetchall()

    return rows


def build_knowledge_context(db: Session, query: str) -> str:
    """Fetch relevant knowledge base entries and format them as additional
    context to append to the AI prompt. Skipped for casual/non-health
    messages to keep response times fast."""
    if is_casual_message(query) or not needs_knowledge_lookup(query):
        return ""
    knowledge_results = get_relevant_knowledge(db, query)
    if not knowledge_results:
        return ""
    context = "\n\nRelevant information:\n"
    for row in knowledge_results:
        context += f"- {row.topic}: {row.content}\n"
    return context

async def synthesize_speech(text: str) -> bytes:
    """Convert text to speech using Microsoft Edge's free TTS service (no API key needed)."""
    communicate = edge_tts.Communicate(text, voice=EDGE_TTS_VOICE, rate="-8%")
    audio_chunks = []
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_chunks.append(chunk["data"])
    return b"".join(audio_chunks)

def generate_avatar_video(text_to_speak: str) -> str:
    """Send text to D-ID to generate a lip-synced avatar video and poll
    until rendering completes. Returns the URL of the finished video.
    This call is synchronous and can take 1-2 minutes, since video
    rendering is not instant."""
    safe_text = xml_escape(text_to_speak)
    payload = {
        "avatar_id": DID_AVATAR_ID,
        "sentiment_id": DID_SENTIMENT_ID,
        "script": {
            "type": "text",
            "input": f'<speak><prosody rate="85%">{safe_text}</prosody></speak>',
            "ssml": True,
        },
    }
    response = requests.post("https://api.d-id.com/expressives", json=payload, headers=DID_HEADERS)
    response.raise_for_status()
    video_id = response.json()["id"]

    status_url = f"https://api.d-id.com/expressives/{video_id}"
    while True:
        status_response = requests.get(status_url, headers=DID_HEADERS)
        data = status_response.json()
        status = data.get("status")
        if status == "done":
            return data.get("result_url")
        elif status == "error":
            raise Exception(f"D-ID video generation failed: {data}")
        time.sleep(3)


_news_cache = {"timestamp": 0, "articles": []}

def fetch_daily_news(limit: int = 5) -> list:
    """Fetch recent India-relevant news headlines from NewsAPI. Uses an in-memory cache
    (15 min TTL) to minimize API latency and save quota."""
    global _news_cache
    now = time.time()
    if _news_cache["articles"] and (now - _news_cache["timestamp"] < 900):
        return _news_cache["articles"][:limit]

    params = {
        "apiKey": NEWS_API_KEY,
        "q": "India",
        "language": "en",
        "sortBy": "publishedAt",
        "pageSize": limit,
    }
    response = requests.get("https://newsapi.org/v2/everything", params=params)
    data = response.json()

    if data.get("status") != "ok":
        raise Exception(f"NewsAPI error: {data.get('code')} - {data.get('message')}")

    articles = data.get("articles", [])
    formatted = [{"title": a["title"], "description": a.get("description") or ""} for a in articles]
    _news_cache = {"timestamp": now, "articles": formatted}
    return formatted[:limit]


def summarize_news_for_elderly(articles: list, user_name: str) -> str:
    """Use Gemini to turn raw headlines into a simple, warm, spoken-style
    news briefing suitable for an elderly listener."""
    if not articles:
        return f"Namaste {user_name} ji, aaj filhaal koi naya samachar uplabdh nahi hai."

    headlines_text = "\n".join(f"- {a['title']}: {a['description']}" for a in articles)
    prompt = (
        f"[User ka naam: {user_name}] Yeh aaj ki top khabaren hain:\n\n{headlines_text}\n\n"
        "In khabaron ko Umang ki tarah, simple aur saral Hindi mein, jaise ek apna beta/beti "
        "apne buzurg maa-baap ko roz subah khabar sunata hai, waise summarize karo. "
        "Mushkil words avoid karo, aur bahut lambi na ho — 4-5 khabar chhote mein cover karo."
    )
    response = gemini_model.generate_content(prompt)
    return response.text 


def send_email(to_address: str, subject: str, text_body: str, html_body: str):
    """Shared helper: sends a HTML+text multipart email via Gmail SMTP SSL.
    Using MIMEMultipart alternative ensures better inbox deliverability."""
    if not EMAIL_ADDRESS or not EMAIL_APP_PASSWORD:
        logger.error("[Email] EMAIL_ADDRESS or EMAIL_APP_PASSWORD not set in environment.")
        raise ValueError("Email credentials not configured.")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"Umang AI <{EMAIL_ADDRESS}>"
    msg["To"]      = to_address
    msg["X-Mailer"] = "Umang AI Safety System"
    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(EMAIL_ADDRESS, EMAIL_APP_PASSWORD)
        server.sendmail(EMAIL_ADDRESS, to_address, msg.as_string())


def send_family_alert_email(family_email: str, user_name: str):
    """Notify a registered family member that the user has shown signs of
    persistent sadness or loneliness in recent conversations."""
    subject = f"Umang AI: A note about {user_name}"
    text_body = (
        f"Namaste,\n\n"
        f"This is an automated note from Umang AI. {user_name} has seemed a little "
        f"down or lonely in their recent conversations with their companion app.\n\n"
        f"It might be a good time for a call or a visit — sometimes that's all it takes.\n\n"
        f"With care,\nUmang AI"
    )
    html_body = f"""
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:linear-gradient(135deg,#ff8a5c,#ea580c);padding:28px 32px;">
        <h1 style="color:#fff;margin:0;font-size:22px;">🌼 Umang AI — Wellness Note</h1>
      </div>
      <div style="padding:28px 32px;">
        <p style="color:#374151;font-size:16px;line-height:1.6;">Namaste,</p>
        <p style="color:#374151;font-size:15px;line-height:1.7;">
          This is a gentle note from <strong>Umang AI</strong>. 
          <strong>{user_name}</strong> has seemed a little down or lonely 
          in their recent conversations with the app.
        </p>
        <p style="color:#374151;font-size:15px;line-height:1.7;">
          It might be a good time for a call or a visit — sometimes that's all it takes. 💙
        </p>
        <p style="color:#6b7280;font-size:13px;margin-top:24px;">With care,<br/><strong>Umang AI Safety System</strong></p>
      </div>
    </div>
    """
    send_email(family_email, subject, text_body, html_body)


def check_and_trigger_family_alert(db: Session, user: models.User):
    """Check whether the user's recent messages show a pattern of negative
    emotion, and if so, send a one-time (cooldown-limited) alert to their
    registered family contact.

    NOTE: This function currently includes verbose logging to help verify
    correct behavior during development. These print statements should be
    removed or downgraded to proper logging once confirmed working."""
    if not user.family_email:
        print(f"[Family Alert] Skipped: no family_email set for user '{user.name}'")
        return

    if user.last_alert_sent_at:
        last_sent = user.last_alert_sent_at
        if last_sent.tzinfo is not None:
            last_sent = last_sent.astimezone(timezone.utc).replace(tzinfo=None)
        if datetime.utcnow() - last_sent < timedelta(hours=ALERT_COOLDOWN_HOURS):
            print(f"[Family Alert] Skipped: still within cooldown (last sent {last_sent})")
            return

    recent = (
        db.query(models.Conversation)
        .filter(models.Conversation.user_id == user.id, models.Conversation.role == "user")
        .order_by(models.Conversation.created_at.desc())
        .limit(ALERT_LOOKBACK_MESSAGES)
        .all()
    )
    negative_count = sum(1 for msg in recent if msg.emotion in ALERT_TRIGGER_EMOTIONS)
    print(
        f"[Family Alert] negative_count={negative_count} "
        f"(threshold={ALERT_TRIGGER_THRESHOLD}), "
        f"recent emotions: {[m.emotion for m in recent]}"
    )

    if negative_count >= ALERT_TRIGGER_THRESHOLD:
        try:
            send_family_alert_email(user.family_email, user.name)
            user.last_alert_sent_at = datetime.utcnow()
            db.commit()
            print(f"[Family Alert] Email sent successfully to {user.family_email}")
        except Exception as e:
            print(f"[Family Alert] Failed to send email: {e}")


# ---------------------------------------------------------------------------
# Request Models
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str
    user_name: str = "Dost"

class ReminderRequest(BaseModel):
    user_name: str
    title: str
    reminder_time: str  # format: "HH:MM", e.g. "09:00"

class UserSettingsRequest(BaseModel):
    user_name: str
    family_email: str
# ---------------------------------------------------------------------------
# Utility Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Umang AI backend is alive 🚀"}


@app.get("/debug/tables")
def list_tables():
    inspector = inspect(engine)
    return {"tables": inspector.get_table_names()}


# ---------------------------------------------------------------------------
# Text-Based Chat Endpoints
# ---------------------------------------------------------------------------

@app.post("/chat")
def chat(request: ChatRequest, db: Session = Depends(get_db)):
    """Text-in, text-out conversation endpoint (non-streaming). Includes
    emotion detection and family-alert checking. Useful for quick testing;
    prefer /chat-stream for the actual frontend experience."""
    user = get_or_create_user(db, request.user_name)
    history = get_recent_history(db, user.id, limit=10)
    detected_emotion = detect_emotion(request.message)
    knowledge_context = build_knowledge_context(db, request.message)
    reminder_context = build_reminder_context(db, user)
    language_hint = detect_language_hint(request.message)

    personalized_message = (
        language_hint
        + f"[User's detected mood: {detected_emotion}] "
        + build_prompt_with_history(history, request.user_name, request.message)
        + knowledge_context
        + reminder_context
    )
    response = gemini_model.generate_content(personalized_message)
    reply = response.text

    save_message(db, user.id, "user", request.message, emotion=detected_emotion)
    save_message(db, user.id, "assistant", reply)
    check_and_trigger_family_alert(db, user)

    return {"reply": reply}


@app.post("/chat-stream")
def chat_stream(request: ChatRequest, db: Session = Depends(get_db)):
    """Same as /chat, but streams the AI's reply token-by-token using the
    new Google GenAI SDK, which streams genuinely (unlike the legacy SDK's
    buffered pseudo-streaming). This is what the frontend chat UI uses."""
    user = get_or_create_user(db, request.user_name)
    history = get_recent_history(db, user.id, limit=10)
    knowledge_context = build_knowledge_context(db, request.message)
    language_hint = detect_language_hint(request.message)

    personalized_message = (
        language_hint
        + build_prompt_with_history(history, request.user_name, request.message)
        + knowledge_context
    )

    save_message(db, user.id, "user", request.message)

    def stream_response():
        full_reply = ""
        stream = genai_client.models.generate_content_stream(
            model="gemini-2.5-flash",
            contents=personalized_message,
            config=GenerateContentConfig(system_instruction=SYSTEM_PROMPT, max_output_tokens=200),
        )
        for chunk in stream:
            if chunk.text:
                full_reply += chunk.text
                yield chunk.text
        save_message(db, user.id, "assistant", full_reply)

    return StreamingResponse(stream_response(), media_type="text/plain")


@app.post("/avatar-chat")
def avatar_chat(request: ChatRequest, db: Session = Depends(get_db)):
    """Full pipeline: text in -> AI reply (with memory, knowledge, and
    emotion awareness) -> lip-synced avatar video out."""
    user = get_or_create_user(db, request.user_name)
    history = get_recent_history(db, user.id, limit=10)
    detected_emotion = detect_emotion(request.message)
    knowledge_context = build_knowledge_context(db, request.message)
    language_hint = detect_language_hint(request.message)

    personalized_message = (
        language_hint
        + f"[User's detected mood: {detected_emotion}] "
        + build_prompt_with_history(history, request.user_name, request.message)
        + knowledge_context
    )
    ai_response = gemini_model.generate_content(personalized_message)
    ai_reply = ai_response.text

    save_message(db, user.id, "user", request.message, emotion=detected_emotion)
    save_message(db, user.id, "assistant", ai_reply)
    check_and_trigger_family_alert(db, user)

    video_url = generate_avatar_video(ai_reply)

    return {"reply": ai_reply, "video_url": video_url}


@app.get("/daily-news")
def daily_news(user_name: str = "Dost"):
    """Fetch today's top headlines and return them as a simple,
    elderly-friendly spoken-style summary."""
    try:
        articles = fetch_daily_news()
    except Exception as e:
        return {"error": str(e)}

    summary = summarize_news_for_elderly(articles, user_name)
    return {"summary": summary}


# ---------------------------------------------------------------------------
# Voice-Based Endpoints
# ---------------------------------------------------------------------------

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """Transcribe an uploaded audio file to text (Hindi only)."""
    audio_data = await file.read()

    options = PrerecordedOptions(
        model="nova-2",
        language="hi",
        smart_format=True,
    )

    response = deepgram_client.listen.prerecorded.v("1").transcribe_file(
        {"buffer": audio_data},
        options
    )

    transcript = response.results.channels[0].alternatives[0].transcript
    return {"transcript": transcript}


@app.post("/voice-chat")
async def voice_chat(
    file: UploadFile = File(...),
    user_name: str = "Dost",
    db: Session = Depends(get_db),
):
    """Full voice-to-voice pipeline: audio in -> speech-to-text ->
    AI reply (with memory, knowledge, and emotion awareness) ->
    text-to-speech audio out. Also checks for family-alert conditions."""

    # Step 1: Transcribe the incoming audio (multilingual, code-switching enabled).
    audio_data = await file.read()
    options = PrerecordedOptions(
        model="nova-3",
        language="multi",
        smart_format=True,
    )
    transcribe_response = deepgram_client.listen.prerecorded.v("1").transcribe_file(
        {"buffer": audio_data},
        options
    )
    user_message = transcribe_response.results.channels[0].alternatives[0].transcript

    # Fallback: nova-3's multilingual mode occasionally misfires on short or
    # unclear audio. If the first attempt returns nothing, retry once with
    # a single-language model, which is more reliable for this audience's
    # primarily Hindi speech.
    if not user_message or not user_message.strip():
        retry_options = PrerecordedOptions(
            model="nova-2",
            language="hi",
            smart_format=True,
        )
        retry_response = deepgram_client.listen.prerecorded.v("1").transcribe_file(
            {"buffer": audio_data},
            retry_options
        )
        user_message = retry_response.results.channels[0].alternatives[0].transcript

    # If still nothing was understood, respond with a graceful fallback
    # instead of sending an empty message to Gemini.
    if not user_message or not user_message.strip():
        fallback_text = "Maaf kijiye, mujhe aapki baat sunai nahi di. Kya aap dobara bol sakte hain?"
        audio_bytes = await synthesize_speech(fallback_text)
        return Response(content=audio_bytes, media_type="audio/mpeg")
    # Step 2: Detect emotional tone, load user + conversation history + knowledge context.
    detected_emotion = detect_emotion(user_message)
    user = get_or_create_user(db, user_name)
    history = get_recent_history(db, user.id, limit=10)
    knowledge_context = build_knowledge_context(db, user_message)
    language_hint = detect_language_hint(user_message)

    # Step 3: Build the full prompt and get the AI's reply.
    personalized_message = (
        language_hint
        + f"[User's detected mood: {detected_emotion}] "
        + build_prompt_with_history(history, user_name, user_message)
        + knowledge_context
    )
    ai_response = gemini_model.generate_content(personalized_message)
    ai_reply = ai_response.text

    # Step 4: Persist both sides of the exchange, and check whether a
    # family alert should be triggered based on the recent emotional pattern.
    save_message(db, user.id, "user", user_message, emotion=detected_emotion)
    save_message(db, user.id, "assistant", ai_reply)
    check_and_trigger_family_alert(db, user)

    # Step 5: Convert the AI's reply to speech and return it.
    audio_bytes = await synthesize_speech(ai_reply)

    return Response(content=audio_bytes, media_type="audio/mpeg")


# ---------------------------------------------------------------------------
# Vision Endpoints
# ---------------------------------------------------------------------------

@app.post("/detect-face-emotion")
async def detect_face_emotion(file: UploadFile = File(...)):
    """Analyze a photo to detect the dominant facial emotion."""
    image_data = await file.read()
    nparr = np.frombuffer(image_data, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    try:
        result = DeepFace.analyze(img, actions=["emotion"], enforce_detection=False, detector_backend="retinaface")
        analysis = result[0] if isinstance(result, list) else result
        return {
            "dominant_emotion": str(analysis["dominant_emotion"]),
            "emotion_scores": {k: float(v) for k, v in analysis["emotion"].items()},
        }
    except Exception as e:
        return {"error": str(e)}

@app.post("/reminders")
def create_reminder(request: ReminderRequest, db: Session = Depends(get_db)):
    """Create a new daily reminder for a user."""
    user = get_or_create_user(db, request.user_name)
    hour, minute = map(int, request.reminder_time.split(":"))

    reminder = models.Reminder(
        user_id=user.id,
        title=request.title,
        reminder_time=datetime.now().replace(hour=hour, minute=minute, second=0).time(),
    )
    db.add(reminder)
    db.commit()
    db.refresh(reminder)

    return {"id": reminder.id, "title": reminder.title, "time": str(reminder.reminder_time)}


@app.get("/reminders")
def list_reminders(user_name: str, db: Session = Depends(get_db)):
    """List all active reminders for a user."""
    user = get_or_create_user(db, user_name)
    reminders = db.query(models.Reminder).filter(
        models.Reminder.user_id == user.id, models.Reminder.is_active == True
    ).all()
    return [{"id": r.id, "title": r.title, "time": str(r.reminder_time)} for r in reminders]

@app.get("/user-settings")
def get_user_settings(user_name: str, db: Session = Depends(get_db)):
    """Fetch user settings (e.g. family email)."""
    user = get_or_create_user(db, user_name)
    return {"family_email": user.family_email or ""}

@app.post("/user-settings")
def update_user_settings(request: UserSettingsRequest, db: Session = Depends(get_db)):
    """Update user settings."""
    user = get_or_create_user(db, request.user_name)
    user.family_email = request.family_email
    db.commit()
    return {"status": "success", "family_email": user.family_email}


# ---------------------------------------------------------------------------
# Proactive Check-in Endpoints
# ---------------------------------------------------------------------------

@app.get("/pending-checkins")
def get_pending_checkins(user_name: str, db: Session = Depends(get_db)):
    """Return all undelivered check-in messages for a user.
    Called by the frontend on home screen load to show proactive banners."""
    user = get_or_create_user(db, user_name)
    checkins = (
        db.query(models.PendingCheckin)
        .filter(
            models.PendingCheckin.user_id == user.id,
            models.PendingCheckin.is_delivered == False,
        )
        .order_by(models.PendingCheckin.created_at.asc())
        .all()
    )
    return [{"id": c.id, "message": c.message, "type": c.checkin_type} for c in checkins]


@app.post("/pending-checkins/{checkin_id}/dismiss")
def dismiss_checkin(checkin_id: int, db: Session = Depends(get_db)):
    """Mark a check-in as delivered/dismissed so it isn't shown again."""
    checkin = db.query(models.PendingCheckin).filter(models.PendingCheckin.id == checkin_id).first()
    if not checkin:
        return {"error": "Check-in not found"}
    checkin.is_delivered = True
    db.commit()
    return {"status": "dismissed"}


# ---------------------------------------------------------------------------
# WebSocket Chat Endpoint
# ---------------------------------------------------------------------------

@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    """Real-time bidirectional chat over WebSocket. The client sends a JSON
    message with `user_name` and `message` fields, and the server streams
    back the AI reply token-by-token, ending with a sentinel `__END__` frame.

    Using WebSockets (vs. HTTP streaming) eliminates the connection overhead
    of a new HTTP request per message and enables the server to push events
    (e.g. check-in notifications) proactively in future iterations.
    """
    await websocket.accept()
    db: Session = SessionLocal()

    try:
        while True:
            # Wait for the next message from the client.
            data = await websocket.receive_json()
            user_name = data.get("user_name", "Dost")
            user_message = data.get("message", "").strip()

            if not user_message:
                await websocket.send_text("__END__")
                continue

            # Build context — same pipeline as /chat-stream.
            user = get_or_create_user(db, user_name)
            history = get_recent_history(db, user.id, limit=10)
            knowledge_context = build_knowledge_context(db, user_message)
            language_hint = detect_language_hint(user_message)

            personalized_message = (
                language_hint
                + build_prompt_with_history(history, user_name, user_message)
                + knowledge_context
            )

            save_message(db, user.id, "user", user_message)

            # Stream the AI reply token-by-token over the WebSocket.
            full_reply = ""
            try:
                stream = genai_client.models.generate_content_stream(
                    model="gemini-2.5-flash",
                    contents=personalized_message,
                    config=GenerateContentConfig(
                        system_instruction=SYSTEM_PROMPT,
                        max_output_tokens=1000,
                    ),
                )
                for chunk in stream:
                    if chunk.text:
                        full_reply += chunk.text
                        await websocket.send_text(chunk.text)
            except Exception as e:
                logger.error(f"[WebSocket] Gemini streaming error: {e}")
                await websocket.send_text("Sorry, I encountered an error. Please try again.")

            # Signal the client that this reply is complete.
            await websocket.send_text("__END__")
            save_message(db, user.id, "assistant", full_reply)

    except WebSocketDisconnect:
        logger.info("[WebSocket] Client disconnected.")
    except Exception as e:
        logger.error(f"[WebSocket] Unexpected error: {e}")
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Day 21 — Family Dashboard
# ---------------------------------------------------------------------------

@app.get("/family-dashboard")
def family_dashboard(user_name: str, db: Session = Depends(get_db)):
    """Aggregated data for the family dashboard:
    - Mood trend over last 14 days (date → dominant emotion)
    - Last 5 conversations (message + role + timestamp)
    - Active reminders
    - Recent SOS / family alert count
    """
    user = get_or_create_user(db, user_name)

    # 1. Mood trend — last 14 days
    cutoff = datetime.now(timezone.utc) - timedelta(days=14)
    recent_convs = (
        db.query(models.Conversation)
        .filter(
            models.Conversation.user_id == user.id,
            models.Conversation.role == "user",
            models.Conversation.created_at >= cutoff,
        )
        .order_by(models.Conversation.created_at.asc())
        .all()
    )

    mood_by_day: dict[str, dict] = {}
    for c in recent_convs:
        if c.emotion:
            day_key = c.created_at.strftime("%Y-%m-%d")
            if day_key not in mood_by_day:
                mood_by_day[day_key] = {}
            mood_by_day[day_key][c.emotion] = mood_by_day[day_key].get(c.emotion, 0) + 1

    mood_trend = []
    for day, counts in sorted(mood_by_day.items()):
        dominant = max(counts, key=counts.get)
        mood_trend.append({"date": day, "dominant_emotion": dominant, "counts": counts})

    # 2. Last 5 user + assistant messages (interleaved)
    recent_messages = (
        db.query(models.Conversation)
        .filter(models.Conversation.user_id == user.id)
        .order_by(models.Conversation.created_at.desc())
        .limit(10)
        .all()
    )
    messages_data = [
        {
            "role": m.role,
            "message": m.message[:200],  # truncate for dashboard
            "emotion": m.emotion,
            "timestamp": m.created_at.isoformat() if m.created_at else None,
        }
        for m in reversed(recent_messages)
    ]

    # 3. Active reminders
    reminders = (
        db.query(models.Reminder)
        .filter(models.Reminder.user_id == user.id, models.Reminder.is_active == True)
        .all()
    )
    reminders_data = [{"title": r.title, "time": str(r.reminder_time)} for r in reminders]

    # 4. Negative emotion count in last 7 days
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    negative_count = (
        db.query(models.Conversation)
        .filter(
            models.Conversation.user_id == user.id,
            models.Conversation.role == "user",
            models.Conversation.created_at >= week_ago,
            models.Conversation.emotion.in_(["sad", "lonely", "worried"]),
        )
        .count()
    )

    return {
        "user_name": user.name,
        "family_email": user.family_email or "",
        "mood_trend": mood_trend,
        "recent_messages": messages_data,
        "active_reminders": reminders_data,
        "active_reminders_count": len(reminders_data),          # frontend reads this
        "negative_emotion_count_7d": negative_count,
        "negative_emotions_count": negative_count,               # frontend reads this
    }


# ---------------------------------------------------------------------------
# Day 22 — Emergency SOS & Reminder Completion
# ---------------------------------------------------------------------------

class SOSRequest(BaseModel):
    user_name: str
    message: str = "Mujhe abhi help chahiye! Please contact me immediately."


@app.post("/sos")
def trigger_sos(request: SOSRequest, db: Session = Depends(get_db)):
    """One-tap SOS: immediately sends an urgent email to the user's registered
    family contact, bypassing the normal emotion-threshold cooldown check."""
    user = get_or_create_user(db, request.user_name)

    if not user.family_email:
        return {"status": "error", "message": "No family email registered. Please add one in Settings."}

    now_str = datetime.now().strftime("%d %b %Y, %I:%M %p")
    subject = f"🚨 SOS ALERT: {user.name} needs immediate help — Umang AI"
    text_body = (
        f"URGENT SOS ALERT from Umang AI\n\n"
        f"{user.name} has manually triggered an emergency SOS at {now_str}.\n\n"
        f"Message: \"{request.message}\"\n\n"
        f"Please contact them IMMEDIATELY.\n\n"
        f"— Umang AI Safety System"
    )
    html_body = f"""
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #fca5a5;">
      <div style="background:linear-gradient(135deg,#ef4444,#dc2626);padding:28px 32px;">
        <h1 style="color:#fff;margin:0;font-size:22px;">🚨 Emergency SOS Alert</h1>
        <p style="color:#fecaca;margin:8px 0 0;font-size:14px;">from Umang AI Safety System</p>
      </div>
      <div style="padding:28px 32px;">
        <p style="color:#dc2626;font-size:18px;font-weight:bold;margin-top:0;">Immediate Attention Required</p>
        <p style="color:#374151;font-size:15px;line-height:1.7;">
          <strong>{user.name}</strong> has manually triggered an <strong>emergency SOS alert</strong> 
          at <strong>{now_str}</strong>.
        </p>
        <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:14px 18px;border-radius:8px;margin:20px 0;">
          <p style="margin:0;color:#374151;font-size:15px;font-style:italic;">"{request.message}"</p>
        </div>
        <p style="color:#374151;font-size:15px;line-height:1.7;">
          Please contact <strong>{user.name}</strong> immediately by phone or in person.
        </p>
        <p style="color:#6b7280;font-size:13px;margin-top:28px;">— Umang AI Safety System</p>
      </div>
    </div>
    """

    try:
        send_email(user.family_email, subject, text_body, html_body)
        logger.info(f"[SOS] Alert sent to {user.family_email} for user {user.name}")
        return {"status": "sent", "to": user.family_email}
    except Exception as e:
        logger.error(f"[SOS] Failed to send: {e}")
        return {"status": "error", "message": str(e)}


@app.post("/reminders/{reminder_id}/complete")
def complete_reminder(reminder_id: int, db: Session = Depends(get_db)):
    """Mark a reminder as done for today (sets last_acknowledged_date to today)."""
    reminder = db.query(models.Reminder).filter(models.Reminder.id == reminder_id).first()
    if not reminder:
        return {"error": "Reminder not found"}
    reminder.last_acknowledged_date = date.today()
    db.commit()
    return {"status": "completed", "title": reminder.title}


@app.delete("/reminders/{reminder_id}")
def delete_reminder(reminder_id: int, db: Session = Depends(get_db)):
    """Soft-delete a reminder by marking it inactive."""
    reminder = db.query(models.Reminder).filter(models.Reminder.id == reminder_id).first()
    if not reminder:
        return {"error": "Reminder not found"}
    reminder.is_active = False
    db.commit()
    return {"status": "deleted"}


# ---------------------------------------------------------------------------
# Day 23 — Conversation History
# ---------------------------------------------------------------------------

@app.get("/conversation-history")
def get_conversation_history(
    user_name: str,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
):
    """Paginated conversation history for the user.
    Returns messages ordered newest-first with role, text, emotion, and timestamp."""
    user = get_or_create_user(db, user_name)
    offset = (page - 1) * page_size

    total = db.query(models.Conversation).filter(models.Conversation.user_id == user.id).count()

    messages = (
        db.query(models.Conversation)
        .filter(models.Conversation.user_id == user.id)
        .order_by(models.Conversation.created_at.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "message": m.message,
                "emotion": m.emotion,
                "timestamp": m.created_at.isoformat() if m.created_at else None,
            }
            for m in messages
        ],
    }


# ---------------------------------------------------------------------------
# Day 26 — Health Diary
# ---------------------------------------------------------------------------

class DiaryEntry(BaseModel):
    user_name: str
    mood: str        # e.g. "good", "okay", "not well"
    note: str = ""   # optional free-text note
    energy: int = 3  # 1–5 scale


@app.post("/health-diary")
def add_diary_entry(entry: DiaryEntry, db: Session = Depends(get_db)):
    """Save a daily health diary entry.
    Stores it as a special 'diary' conversation entry for easy retrieval."""
    user = get_or_create_user(db, entry.user_name)
    text = f"[DIARY] mood={entry.mood} energy={entry.energy}/5 note={entry.note or 'none'}"
    conv = models.Conversation(
        user_id=user.id,
        role="diary",
        message=text,
        emotion=entry.mood,
    )
    db.add(conv)
    db.commit()
    return {"status": "saved", "entry": text}


@app.get("/health-diary")
def get_diary_entries(user_name: str, days: int = 7, db: Session = Depends(get_db)):
    """Return diary entries for the last N days."""
    user = get_or_create_user(db, user_name)
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    entries = (
        db.query(models.Conversation)
        .filter(
            models.Conversation.user_id == user.id,
            models.Conversation.role == "diary",
            models.Conversation.created_at >= cutoff,
        )
        .order_by(models.Conversation.created_at.desc())
        .all()
    )
    result = []
    for e in entries:
        parts = {}
        for token in e.message.replace("[DIARY] ", "").split(" "):
            if "=" in token:
                k, v = token.split("=", 1)
                parts[k] = v
        result.append({
            "date": e.created_at.strftime("%Y-%m-%d") if e.created_at else None,
            "mood": parts.get("mood", ""),
            "energy": parts.get("energy", ""),
            "note": parts.get("note", ""),
        })
    return result