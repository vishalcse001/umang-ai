"""
Umang AI - Database Connection
Ye file Supabase (PostgreSQL) se connection banati hai.
"""

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# .env file se environment variables load karo
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# Engine = database ke saath actual connection
engine = create_engine(DATABASE_URL)

# Session = ek "conversation" database ke saath (queries chalane ke liye)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base = saare database models (tables) iske through banenge
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()