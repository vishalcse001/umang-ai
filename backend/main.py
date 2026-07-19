"""
Umang AI - Backend Entry Point

FastAPI backend powering Umang AI, a voice-based companion for elderly users.
Integrates Google Gemini (conversation), Deepgram (speech-to-text), ElevenLabs
(text-to-speech), D-ID (avatar video), and a Supabase/PostgreSQL knowledge base
with vector search (RAG).
"""

import os
import re
import time
import base64
from xml.sax.saxutils import escape as xml_escape

import numpy as np
import cv2
import requests
from deepface import DeepFace

from fastapi import FastAPI, UploadFile, File, Response, Depends
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from sqlalchemy import inspect, text, func
from sqlalchemy.orm import Session

import google.generativeai as genai
from google import genai as new_genai
from google.genai.types import EmbedContentConfig, GenerateContentConfig

from deepgram import DeepgramClient, PrerecordedOptions
from elevenlabs.client import ElevenLabs

from database import engine, Base, get_db
import models

# Create all database tables on startup if they don't already exist.
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Umang AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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
# non-streaming endpoints (/voice-chat, /avatar-chat).
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
elevenlabs_client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))

# D-ID (avatar video generation) configuration.
DID_API_KEY = os.getenv("DID_API_KEY")
DID_ENCODED_KEY = base64.b64encode(DID_API_KEY.encode()).decode()
DID_HEADERS = {
    "Authorization": f"Basic {DID_ENCODED_KEY}",
    "Content-Type": "application/json",
}
DID_AVATAR_ID = "public_aria@avt_BS7cH6"
DID_SENTIMENT_ID = "snt_CdkbPj"

ALLOWED_EMOTIONS = ["happy", "sad", "worried", "lonely", "angry", "neutral", "excited", "confused"]

# Common English words used for a fast, zero-latency heuristic that detects
# when a user has written in plain English, so we can explicitly instruct
# the model to reply in English rather than relying on it to infer this.
ENGLISH_HINT_WORDS = {
    "hello", "hi", "hey", "how", "are", "you", "thanks", "thank", "please",
    "yes", "no", "ok", "okay", "good", "morning", "evening", "night",
    "what", "when", "where", "why", "who", "fine", "great", "nice",
    "today", "tomorrow", "yesterday", "i", "am", "is", "the", "my", "your",
}


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


def build_prompt_with_history(history, user_name: str, current_message: str) -> str:
    """Construct a context-aware prompt by combining prior conversation
    history with the user's current message, so the AI can respond with
    continuity across sessions."""
    if not history:
        return f"[User ka naam: {user_name}] {current_message}"

    lines = [f"[User ka naam: {user_name}] Yeh humari pichli baatcheet hai:\n"]
    for entry in history:
        speaker = "User" if entry.role == "user" else "Tum (Umang)"
        lines.append(f"{speaker}: {entry.message}")
    lines.append(f"\nAb User ne abhi ye kaha hai: {current_message}")
    lines.append("Isi context ko yaad rakhte hue naturally reply karo.")
    return "\n".join(lines)


def detect_language_hint(message: str) -> str:
    """Fast, zero-API-call heuristic that flags clearly English messages,
    so the prompt can explicitly instruct Gemini to reply in English.
    This avoids the added latency of a separate classification call."""
    words = re.findall(r"[a-zA-Z']+", message.lower())
    if not words:
        return ""
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

HEALTH_KEYWORDS = [
    "dard", "dawai", "dawa", "medicine", "bp", "sugar", "diabetes",
    "blood pressure", "ghutna", "joint", "neend", "sleep", "chakkar",
    "seene", "chest", "bukhar", "fever", "doctor", "health", "sehat",
]


def needs_knowledge_lookup(message: str) -> bool:
    """Fast, zero-latency keyword check to decide whether this message
    is worth the extra round-trip of a knowledge-base embedding search."""
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
    """Fetch relevant knowledge base entries, but only when the message
    looks health-related — this avoids the embedding-API round trip for
    the majority of casual conversation, keeping responses fast."""
    if is_casual_message(query) or not needs_knowledge_lookup(query):
        return ""
    knowledge_results = get_relevant_knowledge(db, query)
    if not knowledge_results:
        return ""
    context = "\n\nRelevant information:\n"
    for row in knowledge_results:
        context += f"- {row.topic}: {row.content}\n"
    return context


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


# ---------------------------------------------------------------------------
# Request Models
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str
    user_name: str = "Dost"


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
    """Text-in, text-out conversation endpoint (non-streaming). Useful for
    quick testing; prefer /chat-stream for the actual frontend experience."""
    user = get_or_create_user(db, request.user_name)
    history = get_recent_history(db, user.id, limit=10)
    knowledge_context = build_knowledge_context(db, request.message)
    language_hint = detect_language_hint(request.message)

    personalized_message = (
        language_hint
        + build_prompt_with_history(history, request.user_name, request.message)
        + knowledge_context
    )

    response = gemini_model.generate_content(personalized_message)
    reply = response.text

    save_message(db, user.id, "user", request.message)
    save_message(db, user.id, "assistant", reply)

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
            config=GenerateContentConfig(system_instruction=SYSTEM_PROMPT),
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

    video_url = generate_avatar_video(ai_reply)

    return {"reply": ai_reply, "video_url": video_url}


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
    text-to-speech audio out."""

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

    # If nothing was understood, respond with a graceful fallback instead
    # of sending an empty message to Gemini.
    if not user_message or not user_message.strip():
        fallback_text = "Maaf kijiye, mujhe aapki baat sunai nahi di. Kya aap dobara bol sakte hain?"
        audio_stream = elevenlabs_client.text_to_speech.convert(
            voice_id="pNInz6obpgDQGcFmaJgB",
            text=fallback_text,
            model_id="eleven_multilingual_v2"
        )
        audio_bytes = b"".join(audio_stream)
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

    # Step 4: Persist both sides of the exchange.
    save_message(db, user.id, "user", user_message, emotion=detected_emotion)
    save_message(db, user.id, "assistant", ai_reply)

    # Step 5: Convert the AI's reply to speech and return it.
    audio_stream = elevenlabs_client.text_to_speech.convert(
        voice_id="pNInz6obpgDQGcFmaJgB",
        text=ai_reply,
        model_id="eleven_multilingual_v2"
    )
    audio_bytes = b"".join(audio_stream)

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