"""
Umang AI - Backend Entry Point
"""
from deepgram import DeepgramClient, PrerecordedOptions
from fastapi import UploadFile, File
import os
import google.generativeai as genai
from fastapi import FastAPI
from pydantic import BaseModel
from sqlalchemy import inspect
from database import engine, Base
import models

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
"""

# Step 2: Ab isko use karke Gemini model banao
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
gemini_model = genai.GenerativeModel(
    model_name="gemini-flash-latest",
    system_instruction=SYSTEM_PROMPT
)
deepgram_client = DeepgramClient(os.getenv("DEEPGRAM_API_KEY"))

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
def chat(request: ChatRequest):
    personalized_message = f"[User ka naam: {request.user_name}] {request.message}"
    response = gemini_model.generate_content(personalized_message)
    reply = response.text
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