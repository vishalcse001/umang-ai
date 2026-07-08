"""
Umang AI - Database Models
Ye file batati hai database mein kaunse tables honge aur unke columns kya hain.
"""

from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    phone = Column(String, unique=True, nullable=False)
    language = Column(String, default="hindi")
    created_at = Column(DateTime(timezone=True), server_default=func.now())