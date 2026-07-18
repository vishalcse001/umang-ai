# Umang AI

An AI-powered voice companion for elderly people living alone in India — converses naturally in the user's own language, remembers past conversations, checks in on their well-being, and is being built toward reminding medicines and alerting family when something feels off.

## Overview

Umang AI is a 30-day proof-of-concept project exploring what a human-like, emotionally aware AI companion could look like for India's elderly population. The long-term vision is a multimodal, avatar-driven assistant capable of natural conversation, visual explanations, and proactive care — this repository tracks the incremental build-up toward that goal.

## Tech Stack

- **Backend:** FastAPI (Python)
- **Database:** Supabase (PostgreSQL) via SQLAlchemy
- **Conversational AI:** Google Gemini API
- **Speech-to-Text:** Deepgram (Nova-3, multilingual)
- **Text-to-Speech:** ElevenLabs
- **Frontend:** React *(planned)*
- **Avatar / Lip-sync:** HeyGen or D-ID *(planned)*

## Features (Current Progress)

- ✅ FastAPI backend connected to a Supabase PostgreSQL database
- ✅ Conversational AI endpoint powered by Gemini, with a custom personality tuned for empathetic, elderly-friendly conversation
- ✅ Voice input support — speech-to-text via Deepgram
- ✅ Voice output support — text-to-speech via ElevenLabs, combined into a full voice-to-voice `/voice-chat` pipeline
- ✅ Persistent conversation memory — the assistant recalls prior context across sessions
- ✅ Multilingual support — Hindi-English code-switching via Deepgram Nova-3

See [`docs/progress-log.md`](docs/progress-log.md) for the full day-by-day build log.

## Status

🚧 **Day 7 of 30 — Multilingual support complete.** Actively in development.

## Project Structure