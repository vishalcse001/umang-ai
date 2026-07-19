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

## Day 8 — RAG Knowledge Base
- [x] Enabled `pgvector` extension in Supabase and created a `knowledge_base` table (category, topic, content, embedding)
- [x] Curated 13 safe, general-purpose entries covering common medicines, health tips, and emergency guidance for elderly users — deliberately excluding dosage/prescriptive details to avoid unsafe self-medication advice
- [x] Generated semantic embeddings for each entry using Google's `gemini-embedding-001` model
- [x] Implemented `get_relevant_knowledge()` — retrieves the most relevant knowledge base entries via vector similarity search (cosine distance)
- [x] Integrated retrieval into both `/voice-chat` and `/chat` endpoints, so the AI's responses are grounded in curated knowledge rather than relying solely on general model knowledge
- [x] Validated end-to-end: confirmed the AI surfaces relevant, safe guidance (e.g. joint pain tips, emergency response) without suggesting specific medications for symptoms

## Day 9 — Emotion Detection (Text-Based)
- [x] Added `emotion` column to the `conversations` table
- [x] Implemented `detect_emotion()` using a lightweight Gemini classification call, constrained to a fixed set of emotion labels
- [x] Integrated emotion detection into the `/voice-chat` pipeline — detected mood is injected into the AI's prompt context and persisted alongside each user message
- [x] Validated end-to-end: confirmed the AI adapts its tone appropriately based on detected emotion (e.g. responding with extra empathy to a "lonely" classification)

## Day 10 — Face Detection + Emotion (Camera-Based)
- [x] Integrated DeepFace library for facial emotion analysis
- [x] Built `/detect-face-emotion` endpoint — accepts an image, detects the face, and returns the dominant emotion with confidence scores across all categories
- [x] Resolved environment compatibility issues (tf-keras dependency, OpenCV/haarcascade conflict resolved by switching to the RetinaFace detector backend)
- [x] Fixed JSON serialization by converting NumPy float outputs to native Python types
- [x] Validated end-to-end with a real photo — confirmed accurate emotion classification

## Day 11 — Avatar Service Selection + Integration Setup
- [x] Evaluated D-ID vs HeyGen — selected D-ID for its real-time conversational agent focus, mature streaming API, and lower entry cost, better suited to Umang AI's live voice-chat use case
- [x] Set up D-ID account and API key, added to `.env`
- [x] Confirmed API connectivity via `GET /expressives/avatars`
- [x] Selected "aria" avatar with the "Empathetic" sentiment for a warm, elderly-friendly tone
- [x] Generated a successful test video via `POST /expressives` + status polling
- [x] Tuned speech pace using SSML (`<prosody rate="85%">`) for a calmer, more elderly-appropriate delivery speed

## Day 12 — Lip-Sync Working
- [x] Built `/avatar-chat` endpoint — connects the full AI pipeline (memory, knowledge retrieval, emotion detection) to D-ID's avatar video generation
- [x] AI's dynamic reply (not hardcoded text) is sent to D-ID and rendered as a lip-synced avatar video
- [x] Validated end-to-end: confirmed the avatar speaks the AI's actual generated response with accurate lip-sync and natural expression
- [ ] Known limitation: current D-ID trial plan adds a watermark to output videos — will need a paid plan before final demo

## Day 13 — Frontend UI (React)
- [x] Scaffolded the frontend using Vite + React
- [x] Enabled CORS on the backend to allow frontend-backend communication
- [x] Built a full chat interface: text messaging (via `/chat-stream`) and voice recording (via `/voice-chat`)
- [x] Implemented a dedicated "voice call" mode with a live status indicator (listening / thinking / speaking), separate from the default text-chat flow
- [x] Designed a premium, dark-themed UI with glowing accents, glassmorphism cards, and smooth animations
- [x] Implemented frontend-controlled text reveal for a consistently smooth "typing" effect, independent of backend response timing
- [x] Fixed a major stability issue: project directory was inside OneDrive, causing `uvicorn --reload` to trigger spurious restarts due to background file sync — resolved by relocating the project outside OneDrive-synced folders
- [ ] Known area for further optimization: end-to-end response latency (parked for later review)
