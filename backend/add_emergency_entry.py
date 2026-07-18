"""
Umang AI - Add Emergency Response Entry
Ek safe, dawa-suggest na karne wali emergency guidance entry knowledge base mein add karti hai.
"""

import os
from dotenv import load_dotenv
from google import genai as new_genai
from google.genai.types import EmbedContentConfig
from sqlalchemy import create_engine, text

load_dotenv()

client = new_genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
engine = create_engine(os.getenv("DATABASE_URL"))

entry = {
    "category": "health_tip",
    "topic": "Emergency Mein Kya Karein",
    "content": "Agar achanak seene mein dard ho, saans lene mein takleef ho, bahut zyada chakkar aaye, ya baat karne/chalne mein achanak dikkat mehsoos ho, toh ye ek emergency ho sakti hai. Aise mein turant apne doctor ko call karein ya family member ko turant bulayein. Khud se koi bhi dawa lena sahi nahi hai — sirf doctor hi sahi salah de sakte hain."
}

with engine.connect() as conn:
    result = client.models.embed_content(
        model="gemini-embedding-001",
        contents=entry["content"],
        config=EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT", output_dimensionality=768),
    )
    embedding_str = str(result.embeddings[0].values)

    conn.execute(
        text("""
            INSERT INTO knowledge_base (category, topic, content, embedding)
            VALUES (:category, :topic, :content, CAST(:embedding AS vector))
        """),
        {**entry, "embedding": embedding_str}
    )
    conn.commit()

print("✅ Emergency entry added successfully.")