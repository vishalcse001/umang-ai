# Umang AI — Progress Log

Track kya complete hua.

## Day 1 — Development Environment Setup
- [x] Node.js, Python, Git, VS Code installed
- [x] GitHub repo created (private)
- [x] Folder structure created (backend / frontend / docs)
- [x] VS Code extensions installed (ESLint, Prettier, Python)
- [x] First commit pushed

## Day 2 — Backend & Database Setup
- [x] Python virtual environment (venv) created and activated
- [x] FastAPI, Uvicorn, SQLAlchemy installed via requirements.txt
- [x] Basic FastAPI server running (/health endpoint working)
- [x] Supabase PostgreSQL database created (Mumbai region)
- [x] Database connected via SQLAlchemy (Session Pooler)
- [x] First table (`users`) created and verified

## Day 3 — AI Chatbot Endpoint
- [x] Gemini API key configured
- [x] Umang AI personality (system prompt) designed
- [x] /chat endpoint created and tested successfully

## Day 4 — Speech-to-Text (Deepgram)
- [x] Deepgram API key configured
- [x] python-multipart installed for file uploads
- [x] /transcribe endpoint created and tested
- [x] Hindi transcription verified successfully
- [x] /voice-chat endpoint created — combines transcription + AI response


## Day 5 — Text-to-Speech (ElevenLabs) + Voice Chat
- [x] ElevenLabs API key configured
- [x] /voice-chat endpoint tested end-to-end (audio in → transcription → Gemini reply → audio out)
- [x] Response audio verified working (curl se test kiya, VS Code mein play karke confirm kiya)

## Day 6 — Conversation Memory & Context Persistence
- [x] Designed and implemented a `conversations` table (user_id, role, message, created_at) to persist chat history
- [x] Integrated context-aware memory into the `/voice-chat` endpoint — each interaction (both user input and AI response) is now stored against the corresponding user
- [x] Implemented a `get_or_create_user` mechanism to associate conversations with a unique user identity
- [x] Built a context-retrieval layer that fetches the last N messages and injects them into the Gemini prompt, enabling continuity across sessions
- [x] Validated end-to-end functionality: verified that the AI correctly recalls prior context (e.g., user's name) across multiple turns, confirmed via direct inspection of stored records in Supabase

## Day 7 — Multilingual Support
- [x] Deepgram Nova-3 model integrated with `language=multi` for real-time Hindi-English code-switching
- [x] System prompt updated to instruct the AI to respond in the same language the user speaks
- [x] Empty-transcript fallback handling added (graceful "please repeat" response instead of blind Gemini call)
- [x] Fixed case-sensitive user matching bug (e.g. "vishal" vs "Vishal" creating duplicate user records)
- [x] Validated end-to-end: confirmed AI responds in Hindi, English, and Hinglish based on user's spoken language
- [ ] Known limitation: occasional language misdetection on ambiguous audio (documented Deepgram Nova-3 constraint, not application-level bug)