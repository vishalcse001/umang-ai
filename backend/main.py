"""
Umang AI - Backend Entry Point
"""

from fastapi import FastAPI
from database import engine, Base
from database import engine, Base
import models  # models.py import karna zaroori hai taaki tables register hon 

# Startup pe saare tables (agar exist nahi karte) create kar do
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Umang AI Backend")


@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Umang AI backend is alive 🚀"}

from sqlalchemy import inspect

@app.get("/debug/tables")
def list_tables():
    inspector = inspect(engine)
    return {"tables": inspector.get_table_names()}