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
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String, nullable=False)       # "user" ya "assistant"
    message = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())