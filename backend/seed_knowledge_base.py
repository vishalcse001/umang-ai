"""
Umang AI - Knowledge Base Seeder
Ye script curated medicine aur health tips ki info database mein daalti hai,
har entry ke sath uska embedding (Gemini se) generate karke.

Chalane ka tareeka: python seed_knowledge_base.py
(Sirf ek baar chalana hai — dobara chalaya toh duplicate entries ban jayengi)
"""

import os
from dotenv import load_dotenv
from google import genai
from google.genai.types import EmbedContentConfig
from sqlalchemy import create_engine, text              
load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
engine = create_engine(os.getenv("DATABASE_URL"))

# ---- Curated Knowledge Base Data ----
# Note: Sirf general, safe info — dosage/timing kabhi nahi likhna, hamesha
# "apne doctor se poochein" wala disclaimer rakhna.

knowledge_data = [
    {
        "category": "medicine",
        "topic": "Paracetamol",
        "content": "Paracetamol aam taur par bukhar aur halka dard (jaise sar dard, badan dard) kam karne ke liye use hoti hai. Ye kai logon ke liye safe mani jaati hai, lekin sahi maatra aur timing ke liye hamesha apne doctor ya pharmacist se poochna chahiye."
    },
    {
        "category": "medicine",
        "topic": "Metformin",
        "content": "Metformin diabetes (sugar) control karne ke liye di jaane wali ek common dawa hai. Isse blood sugar level manage karne mein madad milti hai. Iski exact khuraak sirf doctor hi decide kar sakte hain, khud se kabhi na lein ya band karein."
    },
    {
        "category": "medicine",
        "topic": "Amlodipine",
        "content": "Amlodipine high blood pressure (BP) control karne ke liye use hoti hai. Ye dawa regularly, doctor ke bataye tareeke se lena zaroori hai — bina poochhe band karna khatarnaak ho sakta hai."
    },
    {
        "category": "medicine",
        "topic": "Aspirin / Blood Thinners",
        "content": "Kuch buzurgon ko dil (heart) ki suraksha ke liye blood-thinning dawaiyan (jaise Aspirin) di jaati hain. Ye dawaiyan bleeding ka risk badha sakti hain, isliye inhe sirf doctor ki salah se hi lena chahiye, aur koi bhi naya symptom dikhne par turant doctor ko batana chahiye."
    },
    {
        "category": "medicine",
        "topic": "Vitamin D aur Calcium",
        "content": "Buzurgon mein haddiyan kamzor hone (osteoporosis) ka risk zyada hota hai, isliye Vitamin D aur Calcium supplements kai baar diye jaate hain. Dhoop lena aur doodh-dahi jaisi cheezein bhi naturally inki madad karti hain, lekin supplement lena hai ya nahi ye doctor decide karenge."
    },
    {
        "category": "health_tip",
        "topic": "Blood Pressure Management",
        "content": "High blood pressure ko control mein rakhne ke liye namak kam khana, roz halka walk karna, aur stress kam lena madadgar hota hai. BP ko regularly check karte rehna chahiye aur doctor ke bataye checkup schedule ko follow karna chahiye."
    },
    {
        "category": "health_tip",
        "topic": "Diabetes aur Khana-Peena",
        "content": "Diabetes mein meetha aur zyada carbohydrate wala khana kam karna faydemand hota hai. Chhote-chhote intervals mein balanced khana khana, aur fiber-rich foods (jaise sabziyan, dal) lena sugar level ko stable rakhne mein madad karta hai."
    },
    {
        "category": "health_tip",
        "topic": "Joint Pain aur Arthritis",
        "content": "Ghutno ya jodo ke dard mein halka stretching aur chalna (agar doctor allow kare) faydemand hota hai. Zyada der ek hi position mein baithna avoid karna chahiye. Garam sikai kai logon ko rahat deti hai, lekin persistent dard mein doctor se milna zaroori hai."
    },
    {
        "category": "health_tip",
        "topic": "Neend aur Aaram",
        "content": "Buzurgon ke liye achhi neend zaroori hai sehat ke liye. Raat ko sone se pehle mobile/TV screen kam dekhna, ek fixed sone-uthne ka time rakhna, aur din mein zyada lambi neend na lena — ye sab acchi neend mein madad karte hain."
    },
    {
        "category": "health_tip",
        "topic": "Paani aur Hydration",
        "content": "Umar badhne ke sath pyaas ka ehsaas kam ho sakta hai, isliye jaan-boojhkar din bhar thoda-thoda paani peete rehna chahiye. Kam paani peene se chakkar aana, confusion, ya kamzori jaisi problems ho sakti hain."
    },
    {
        "category": "health_tip",
        "topic": "Girne se Bachaav (Fall Prevention)",
        "content": "Ghar mein phisalne wali jagah (jaise gile floor) se bachna, achhi roshni rakhna, aur zaroorat pade toh walking stick use karna girne ka khatra kam karta hai. Buzurgon mein girna ek gambhir chot ka karan ban sakta hai, isliye savdhani zaroori hai."
    },
    {
        "category": "health_tip",
        "topic": "Akelapan aur Mानसिक Sehat",
        "content": "Akela mehsoos karna buzurgon mein aam hai, khaaskar jab bachche door rehte hain. Roz kisi apne se baat karna, hobbies mein time dena, ya mohalle mein logon se milna-julna mansik sehat ke liye bahut faydemand hota hai."
    },
]


def seed_database():
    with engine.connect() as conn:
        for entry in knowledge_data:
            # Embedding generate karo (naye google-genai SDK se)
            result = client.models.embed_content(
                model="gemini-embedding-001",
                contents=entry["content"],
                config=EmbedContentConfig(
                    task_type="RETRIEVAL_DOCUMENT",
                    output_dimensionality=768,
                ),
            )
            embedding = result.embeddings[0].values
            embedding_str = str(embedding)

            conn.execute(
                text("""
                    INSERT INTO knowledge_base (category, topic, content, embedding)
                    VALUES (:category, :topic, :content, CAST(:embedding AS vector))
                """),
                {
                    "category": entry["category"],
                    "topic": entry["topic"],
                    "content": entry["content"],
                    "embedding": embedding_str,
                }
            )
            print(f"✅ Added: {entry['topic']}")

        conn.commit()
    print(f"\n🎉 Done! {len(knowledge_data)} entries added to knowledge_base.")


if __name__ == "__main__":
    seed_database()