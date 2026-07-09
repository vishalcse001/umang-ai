"""
Umang AI - Backend Entry Point
"""

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
"""

# Step 2: Ab isko use karke Gemini model banao
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
gemini_model = genai.GenerativeModel(
    model_name="gemini-flash-latest",
    system_instruction=SYSTEM_PROMPT
)

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Umang AI backend is alive 🚀"}


@app.get("/debug/tables")
def list_tables():
    inspector = inspect(engine)
    return {"tables": inspector.get_table_names()}


class ChatRequest(BaseModel):
    message: str


@app.post("/chat")
def chat(request: ChatRequest):
    response = gemini_model.generate_content(request.message)
    reply = response.text
    return {"reply": reply}