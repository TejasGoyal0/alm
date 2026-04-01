# VoiceFlow AI

Human-like voice agents powered by end-to-end Audio Language Models. This is a complete landing page with an **interactive real-time voice demo** that lets visitors talk to an AI agent directly in the browser.

## Quick Start

### 1. Get a Free API Key

**Gemini (default, free):** Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey) and create a key.

**OpenAI (alternative):** Requires a paid API key with Realtime API access.

### 2. Install & Run

```bash
cp .env.example .env
# Edit .env and paste your GEMINI_API_KEY

npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000).

> **Note:** Microphone access requires HTTPS in production. On `localhost` it works over HTTP.

### 3. Switch Providers

In `.env`, change `PROVIDER=openai` and set `OPENAI_API_KEY` to use OpenAI's Realtime API instead.

## Architecture

```
Browser (index.html)
  ├─ MediaRecorder → ScriptProcessor → PCM16 chunks
  ├─ Socket.io client ──→ audio-chunk events
  ├─ Canvas circular waveform visualizer
  └─ Web Audio API playback queue

Server (server.js)
  ├─ Express static server
  ├─ Socket.io ──→ provider-agnostic event layer
  └─ WebSocket proxy to:
      ├─ Gemini Multimodal Live API (16kHz in / 24kHz out)
      └─ OpenAI Realtime API (24kHz in / 24kHz out)
```

## Deploy to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new)

1. Push this repo to GitHub
2. Connect it on [railway.app](https://railway.app)
3. Add env vars: `GEMINI_API_KEY`, `PROVIDER=gemini`
4. Railway auto-detects Node.js and runs `npm start`

## Deploy Frontend + Backend Separately

Since the app uses WebSockets, you need a persistent server (not serverless):

| Component | Host | Notes |
|-----------|------|-------|
| Backend   | Railway / Render / Fly.io | Needs WebSocket support |
| Frontend  | Same server | Served as static files by Express |

## Tech Stack

- **Frontend:** Tailwind CSS, Socket.io client, Web Audio API, Canvas 2D
- **Backend:** Node.js, Express, Socket.io, ws
- **AI:** Google Gemini 2.0 Flash Live API (default) or OpenAI Realtime API
