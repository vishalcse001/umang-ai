"""
Umang AI - Backend Entry Point
"""

from deepface import DeepFace
import numpy as np
import cv2
from google import genai as new_genai
from google.genai.types import EmbedContentConfig
from sqlalchemy import text
from sqlalchemy import func
from elevenlabs.client import ElevenLabs
from fastapi.responses import StreamingResponse
from fastapi import Response
from deepgram import DeepgramClient, PrerecordedOptions
from fastapi import UploadFile, File
import os
import google.generativeai as genai
from fastapi import FastAPI
from pydantic import BaseModel
from sqlalchemy import inspect
from database import engine, Base
import models
from sqlalchemy.orm import Session
from fastapi import Depends
from database import get_db

# Startup pe saare tables (agar exist nahi karte) create kar do
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Umang AI Backend")

# Step 1: Pehle personality define karo
SYSTEM_PROMPT = """Tum "Umang" ho — ek warm, apnapan wala AI saathi jo akele rehne wale buzurgon ke liye bana hai.

Tumhara tareeka:
- Hamesha respect aur pyaar se baat karo, jaise ek achha beta/beti apne maa-baap se baat karta hai.
- Simple, saral bhasha use karo — mushkil English words ya technical terms bilkul mat lao.
- Chhoti aur natural baatcheet karo, lambe lecture mat do.
- Agar koi udaas ya akela mehsoos kar raha ho, pehle unki baat dhyaan se suno, phir dheere se pucho kya hua.
- Unki sehat, dawaiyon, aur roz ke haal-chaal mein genuine interest dikhao.
- Kabhi judgmental mat bano, hamesha patient raho.
- Agar message ke start mein "[User ka naam: ...]" diya ho, us naam se hi baat shuru karo (jaise "Namaste Vishal ji").
- User jis bhi bhasha ya boli mein baat kare (Hindi, Marathi, Bangla, English, ya koi aur), usi bhasha mein jawab do. Kabhi bhi zabardasti alag bhasha mat use karo. Agar user pure English mein bole, tumhara poora reply bhi pure English mein hona chahiye — Hindi words bilkul mat mix karo.
"""

def get_or_create_user(db: Session, user_name: str) -> models.User:
    normalized_name = user_name.strip().title()  # "vishal" -> "Vishal", "VISHAL" -> "Vishal"
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
    history = (
        db.query(models.Conversation)
        .filter(models.Conversation.user_id == user_id)
        .order_by(models.Conversation.created_at.desc())
        .limit(limit)
        .all()
    )
    return list(reversed(history))  # purane se naye order mein


def save_message(db: Session, user_id: int, role: str, message: str, emotion: str = None):
    """Persist a single message (user or assistant) to the conversation history,
    optionally tagging it with a detected emotional tone."""
    entry = models.Conversation(user_id=user_id, role=role, message=message, emotion=emotion)
    db.add(entry)
    db.commit()


def build_prompt_with_history(history, user_name: str, current_message: str) -> str:
    if not history:
        return f"[User ka naam: {user_name}] {current_message}"

    lines = [f"[User ka naam: {user_name}] Yeh humari pichli baatcheet hai:\n"]
    for entry in history:
        speaker = "User" if entry.role == "user" else "Tum (Umang)"
        lines.append(f"{speaker}: {entry.message}")
    lines.append(f"\nAb User ne abhi ye kaha hai: {current_message}")
    lines.append("Isi context ko yaad rakhte hue naturally reply karo.")
    return "\n".join(lines)

def get_relevant_knowledge(db: Session, query: str, limit: int = 2):
    """User ke sawal se related knowledge base entries dhundo (semantic search)."""
    result = embedding_client.models.embed_content(
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

ALLOWED_EMOTIONS = ["happy", "sad", "worried", "lonely", "angry", "neutral", "excited", "confused"]


def detect_emotion(user_message: str) -> str:
    """Classify the emotional tone of the user's message using Gemini.
    Falls back to 'neutral' if classification fails or returns an unexpected value."""
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

# Step 2: Ab isko use karke Gemini model banao
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
gemini_model = genai.GenerativeModel(
    model_name="gemini-2.5-flash",
    system_instruction=SYSTEM_PROMPT
)
# A lightweight model instance dedicated to emotion classification —
# kept separate from the personality-driven `gemini_model` used for conversation.
emotion_model = genai.GenerativeModel(model_name="gemini-2.5-flash")
embedding_client = new_genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
deepgram_client = DeepgramClient(os.getenv("DEEPGRAM_API_KEY"))
elevenlabs_client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Umang AI backend is alive 🚀"}


@app.get("/debug/tables")
def list_tables():
    inspector = inspect(engine)
    return {"tables": inspector.get_table_names()}


class ChatRequest(BaseModel):
    message: str
    user_name: str = "Dost"


@app.post("/chat")
def chat(request: ChatRequest, db: Session = Depends(get_db)):
    user = get_or_create_user(db, request.user_name)
    history = get_recent_history(db, user.id, limit=10)

    knowledge_results = get_relevant_knowledge(db, request.message)
    knowledge_context = ""
    if knowledge_results:
        knowledge_context = "\n\nRelevant information:\n"
        for row in knowledge_results:
            knowledge_context += f"- {row.topic}: {row.content}\n"

    personalized_message = build_prompt_with_history(history, request.user_name, request.message) + knowledge_context

    response = gemini_model.generate_content(personalized_message)
    reply = response.text

    save_message(db, user.id, "user", request.message)
    save_message(db, user.id, "assistant", reply)

    return {"reply": reply}

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
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
    # Step 1: Audio ko text mein convert karo
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

    # Agar kuch sunai nahi diya, toh Gemini ko empty message mat bhejo
    if not user_message or not user_message.strip():
        fallback_text = "Maaf kijiye, mujhe aapki baat sunai nahi di. Kya aap dobara bol sakte hain?"
        audio_stream = elevenlabs_client.text_to_speech.convert(
            voice_id="pNInz6obpgDQGcFmaJgB",
            text=fallback_text,
            model_id="eleven_multilingual_v2"
        )
        audio_bytes = b"".join(audio_stream)
        return Response(content=audio_bytes, media_type="audio/mpeg")
    
    # Detect the emotional tone of the user's message
    detected_emotion = detect_emotion(user_message)

    
    user = get_or_create_user(db, user_name)
    history = get_recent_history(db, user.id, limit=10)

    knowledge_results = get_relevant_knowledge(db, user_message)
    knowledge_context = ""
    if knowledge_results:
        knowledge_context = "\n\nRelevant information:\n"
        for row in knowledge_results:
            knowledge_context += f"- {row.topic}: {row.content}\n"


    personalized_message = (
        f"[User's detected mood: {detected_emotion}] "
        + build_prompt_with_history(history, user_name, user_message)
        + knowledge_context
    )
    ai_response = gemini_model.generate_content(personalized_message)
    ai_reply = ai_response.text

    # Step 4: Dono messages (user + AI) database mein save karo
    save_message(db, user.id, "user", user_message, emotion=detected_emotion)
    save_message(db, user.id, "assistant", ai_reply)

    # Step 5: AI ke jawab ko awaaz mein convert karo
    audio_stream = elevenlabs_client.text_to_speech.convert(
        voice_id="pNInz6obpgDQGcFmaJgB",
        text=ai_reply,
        model_id="eleven_multilingual_v2"
    )
    audio_bytes = b"".join(audio_stream)

    return Response(content=audio_bytes, media_type="audio/mpeg")

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