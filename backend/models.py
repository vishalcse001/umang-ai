"""
Umang AI - Database Models
Ye file batati hai database mein kaunse tables honge aur unke columns kya hain.
"""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    phone = Column(String, unique=True, nullable=True)
    language = Column(String, default="hindi")
    family_email = Column(String, nullable=True)
    last_alert_sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Conversation(Base):
    """Stores individual messages exchanged between a user and the assistant,
    enabling persistent, context-aware conversation history."""

    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String, nullable=False)
    message = Column(String, nullable=False)
    emotion = Column(String, nullable=True)   # Detected emotional tone (user messages only)
    created_at = Column(DateTime(timezone=True), server_default=func.now())