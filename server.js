require('dotenv').config();
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
  maxHttpBufferSize: 1e7,
});

const PORT = process.env.PORT || 3000;
const PROVIDER = (process.env.PROVIDER || 'gemini').toLowerCase();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (PROVIDER === 'gemini' && !GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY is required. Get a free key at https://aistudio.google.com/apikey');
  process.exit(1);
}
if (PROVIDER === 'openai' && !OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is required.');
  process.exit(1);
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (_req, res) => res.json({ status: 'ok', provider: PROVIDER }));
app.get('/config', (_req, res) => res.json({ provider: PROVIDER }));

const SYSTEM_INSTRUCTIONS = `You are a friendly conversational partner for VoiceFlow AI. Keep responses very short (1-2 sentences). Be warm and witty. Match the caller's energy. Never say you're AI unless asked.`;

// ═══════════════════════════════════════════
//  GEMINI MULTIMODAL LIVE API
// ═══════════════════════════════════════════
const GEMINI_MODEL = 'models/gemini-2.5-flash-native-audio-latest';
const GEMINI_WS_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${GEMINI_API_KEY}`;

function startGeminiSession(socket, sessionConfig = {}) {
  const voice = sessionConfig.voice || 'Puck';
  const basePrompt = sessionConfig.system_prompt || SYSTEM_INSTRUCTIONS;
  const dataContext = sessionConfig.data_context || '';
  const fullPrompt = dataContext ? `${basePrompt}\n\n---\nCONTEXT DATA:\n${dataContext}` : basePrompt;

  const ws = new WebSocket(GEMINI_WS_URL);
  ws._timing = { lastAudioSentAt: 0, firstAudioResponseAt: 0 };

  ws.on('open', () => {
    console.log(`[${socket.id}] Gemini WebSocket connected`);
    ws.send(JSON.stringify({
      setup: {
        model: GEMINI_MODEL,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice },
            },
          },
          thinkingConfig: {
            thinkingBudget: 0,
          },
        },
        systemInstruction: {
          parts: [{ text: fullPrompt }],
        },
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false,
            startOfSpeechSensitivity: 'START_SENSITIVITY_LOW',
            endOfSpeechSensitivity: 'END_SENSITIVITY_HIGH',
            prefixPaddingMs: 0,
            silenceDurationMs: 100,
          },
        },
      },
    }));
  });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.setupComplete !== undefined) {
      console.log(`[${socket.id}] Gemini session ready`);
      socket.emit('session-ready', { inputSampleRate: 16000, outputSampleRate: 24000 });
      socket.emit('session-configured');
      return;
    }

    if (msg.serverContent) {
      const sc = msg.serverContent;

      if (sc.interrupted) {
        console.log(`[${socket.id}] ⚡ User interrupted`);
        socket.emit('vad-speech-started');
        return;
      }

      if (sc.modelTurn?.parts) {
        for (const part of sc.modelTurn.parts) {
          if (part.inlineData?.data) {
            if (!ws._timing.firstAudioResponseAt) {
              ws._timing.firstAudioResponseAt = Date.now();
              const totalDelay = ws._timing.lastAudioSentAt ? ws._timing.firstAudioResponseAt - ws._timing.lastAudioSentAt : 0;
              console.log(`[${socket.id}] 🎙 First audio response: last-audio-chunk → first-response = ${totalDelay}ms`);
            }
            socket.emit('audio-delta', part.inlineData.data);
          }
          if (part.text) {
            socket.emit('transcript-delta', part.text);
          }
        }
      }

      if (sc.turnComplete) {
        console.log(`[${socket.id}] ✅ Turn complete`);
        ws._timing.firstAudioResponseAt = 0;
        socket.emit('audio-done');
        socket.emit('response-done');
      }
    }

    if (msg.goAway) {
      console.log(`[${socket.id}] 🔄 Gemini goAway:`, msg.goAway);
    }

    if (msg.usageMetadata) {
      console.log(`[${socket.id}] 📊 Usage:`, JSON.stringify(msg.usageMetadata));
    }

    if (msg.error) {
      console.error(`[${socket.id}] Gemini error:`, msg.error);
      socket.emit('error', { message: msg.error.message || 'Gemini error' });
    }
  });

  ws.on('close', (code, reason) => {
    const reasonStr = reason?.toString() || 'unknown';
    console.log(`[${socket.id}] Gemini WS closed: ${code} ${reasonStr}`);
    socket.emit('error', { message: `Voice engine closed: ${reasonStr}` });
    socket.emit('session-closed');
  });

  ws.on('error', (err) => {
    console.error(`[${socket.id}] Gemini WS error:`, err.message);
    socket.emit('error', { message: `Voice engine error: ${err.message}` });
  });

  return ws;
}

function sendGeminiAudio(ws, base64Audio) {
  if (ws._timing) ws._timing.lastAudioSentAt = Date.now();
  ws.send(JSON.stringify({
    realtimeInput: {
      mediaChunks: [{
        mimeType: 'audio/pcm;rate=16000',
        data: base64Audio,
      }],
    },
  }));
}

// ═══════════════════════════════════════════
//  OPENAI REALTIME API
// ═══════════════════════════════════════════
const OPENAI_MODEL = 'gpt-4o-realtime-preview-2024-12-17';
const OPENAI_WS_URL = `wss://api.openai.com/v1/realtime?model=${OPENAI_MODEL}`;

function startOpenAISession(socket) {
  const ws = new WebSocket(OPENAI_WS_URL, {
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'OpenAI-Beta': 'realtime=v1',
    },
  });

  ws.on('open', () => {
    console.log(`[${socket.id}] OpenAI WebSocket connected`);
    ws.send(JSON.stringify({
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: SYSTEM_INSTRUCTIONS,
        voice: 'shimmer',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: { model: 'whisper-1' },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 300,
        },
        temperature: 0.8,
        max_response_output_tokens: 512,
      },
    }));
  });

  ws.on('message', (raw) => {
    let event;
    try { event = JSON.parse(raw.toString()); } catch { return; }

    switch (event.type) {
      case 'session.created':
        socket.emit('session-ready', { inputSampleRate: 24000, outputSampleRate: 24000 });
        break;
      case 'session.updated':
        socket.emit('session-configured');
        break;
      case 'input_audio_buffer.speech_started':
        socket.emit('vad-speech-started');
        break;
      case 'input_audio_buffer.speech_stopped':
        socket.emit('vad-speech-stopped');
        break;
      case 'response.audio.delta':
        if (event.delta) socket.emit('audio-delta', event.delta);
        break;
      case 'response.audio.done':
        socket.emit('audio-done');
        break;
      case 'response.audio_transcript.delta':
        if (event.delta) socket.emit('transcript-delta', event.delta);
        break;
      case 'response.audio_transcript.done':
        if (event.transcript) socket.emit('transcript-done', event.transcript);
        break;
      case 'conversation.item.input_audio_transcription.completed':
        if (event.transcript) socket.emit('user-transcript', event.transcript);
        break;
      case 'response.done':
        socket.emit('response-done');
        break;
      case 'error':
        console.error(`[${socket.id}] OpenAI error:`, event.error);
        socket.emit('error', { message: event.error?.message || 'OpenAI error' });
        break;
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`[${socket.id}] OpenAI WS closed: ${code} ${reason}`);
    socket.emit('session-closed');
  });

  ws.on('error', (err) => {
    console.error(`[${socket.id}] OpenAI WS error:`, err.message);
    socket.emit('error', { message: 'Voice engine connection failed' });
  });

  return ws;
}

function sendOpenAIAudio(ws, base64Audio) {
  ws.send(JSON.stringify({
    type: 'input_audio_buffer.append',
    audio: base64Audio,
  }));
}

// ═══════════════════════════════════════════
//  SOCKET.IO — provider-agnostic layer
// ═══════════════════════════════════════════
io.on('connection', (socket) => {
  let providerWs = null;
  console.log(`[${socket.id}] Client connected (provider: ${PROVIDER})`);

  socket.on('start-session', (config) => {
    // config may be: { model, voice, system_prompt, data_context } or undefined (landing page)
    if (providerWs) { providerWs.close(); providerWs = null; }

    console.log(`[${socket.id}] Starting ${PROVIDER} session`);
    const sessionConfig = config && typeof config === 'object' ? config : {};
    if (PROVIDER === 'gemini' && sessionConfig.model) {
      console.log(`[${socket.id}] Client requested model (ignored, using ${GEMINI_MODEL}):`, sessionConfig.model);
    }
    providerWs = PROVIDER === 'gemini'
      ? startGeminiSession(socket, sessionConfig)
      : startOpenAISession(socket);
  });

  socket.on('audio-chunk', (base64Audio) => {
    if (!providerWs || providerWs.readyState !== WebSocket.OPEN) return;

    if (PROVIDER === 'gemini') {
      sendGeminiAudio(providerWs, base64Audio);
    } else {
      sendOpenAIAudio(providerWs, base64Audio);
    }
  });

  socket.on('toggle-plugin', ({ id, enabled, context }) => {
    if (!providerWs || providerWs.readyState !== WebSocket.OPEN) return;
    console.log(`[${socket.id}] Plugin ${id}: ${enabled ? 'ON' : 'OFF'}`);

    if (PROVIDER === 'gemini') {
      const text = enabled
        ? `[SYSTEM CONTEXT INJECTION — "${id}" plugin activated. Silently absorb this and use it naturally. Do NOT read it back or announce it.]\n${context}`
        : `[SYSTEM CONTEXT INJECTION — "${id}" plugin deactivated. Stop referencing that data.]`;

      providerWs.send(JSON.stringify({
        clientContent: {
          turns: [{ role: 'user', parts: [{ text }] }],
          turnComplete: false,
        },
      }));
    }
  });

  socket.on('interrupt', () => {
    if (!providerWs || providerWs.readyState !== WebSocket.OPEN) return;
    if (PROVIDER === 'openai') {
      providerWs.send(JSON.stringify({ type: 'response.cancel' }));
    }
  });

  socket.on('stop-session', () => {
    console.log(`[${socket.id}] Stopping session`);
    if (providerWs) { providerWs.close(); providerWs = null; }
  });

  socket.on('disconnect', () => {
    console.log(`[${socket.id}] Client disconnected`);
    if (providerWs) { providerWs.close(); providerWs = null; }
  });
});

httpServer.listen(PORT, () => {
  console.log(`VoiceFlow AI server running on port ${PORT}`);
  console.log(`Provider: ${PROVIDER.toUpperCase()}`);
  console.log(`Open http://localhost:${PORT}`);
});
