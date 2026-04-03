"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Mic, Square } from "lucide-react"
import { io, type Socket } from "socket.io-client"

import { OrbVisualizer, type OrbState } from "@/components/voice/orb-visualizer"
import {
  downsample,
  float32ToPcm16Base64,
  pcm16Base64ToFloat32,
} from "@/lib/audio-pcm"

const OUTPUT_SAMPLE_RATE = 24000

interface VoiceTestPanelProps {
  voice: string
  systemPrompt: string
  dataContext?: string
}

function rmsFromAnalyser(analyser: AnalyserNode): number {
  const data = new Float32Array(analyser.frequencyBinCount)
  analyser.getFloatTimeDomainData(data)
  let sum = 0
  for (let i = 0; i < data.length; i++) sum += Math.abs(data[i])
  return Math.min((sum / data.length) * 6, 1)
}

function rmsFromPcm(pcm: Float32Array): number {
  let sum = 0
  for (let i = 0; i < pcm.length; i++) sum += Math.abs(pcm[i])
  return Math.min((sum / pcm.length) * 8, 1)
}

export function VoiceTestPanel({
  voice,
  systemPrompt,
  dataContext,
}: VoiceTestPanelProps) {
  const [orbState, setOrbState] = useState<OrbState>("idle")
  const [audioLevel, setAudioLevel] = useState(0.08)
  const [statusText, setStatusText] = useState("Tap to start")
  const [active, setActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const orbStateRef = useRef<OrbState>("idle")
  const activeRef = useRef(false)
  const inputSrRef = useRef(16000)

  const socketRef = useRef<Socket | null>(null)
  const micRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const playCtxRef = useRef<AudioContext | null>(null)
  const srcNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const procRef = useRef<ScriptProcessorNode | null>(null)
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([])
  const nextPlayRef = useRef(0)
  const isPlayingRef = useRef(false)
  const genRef = useRef(0)

  useEffect(() => {
    orbStateRef.current = orbState
  }, [orbState])
  useEffect(() => {
    activeRef.current = active
  }, [active])

  useEffect(() => {
    if (active) return
    let id = 0
    const tick = () => {
      setAudioLevel(0.05 + Math.sin(Date.now() / 1000 * 0.5) * 0.03)
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [active])

  const flushPlayback = useCallback(() => {
    genRef.current += 1
    for (const s of activeSourcesRef.current) {
      try { s.stop() } catch { /* */ }
    }
    activeSourcesRef.current = []
    nextPlayRef.current = 0
    isPlayingRef.current = false
  }, [])

  const stop = useCallback(() => {
    activeRef.current = false
    setActive(false)
    const s = socketRef.current
    socketRef.current = null
    if (s) { try { s.emit("stop-session") } catch { /* */ }; s.disconnect() }
    procRef.current?.disconnect(); procRef.current = null
    srcNodeRef.current?.disconnect(); srcNodeRef.current = null
    analyserRef.current?.disconnect(); analyserRef.current = null
    void audioCtxRef.current?.close(); audioCtxRef.current = null
    void playCtxRef.current?.close(); playCtxRef.current = null
    micRef.current?.getTracks().forEach((t) => t.stop()); micRef.current = null
    flushPlayback()
    setOrbState("idle")
    setStatusText("Tap to start")
    setAudioLevel(0)
  }, [flushPlayback])

  const schedule = useCallback((f32: Float32Array, gen: number) => {
    const ctx = playCtxRef.current
    if (!ctx || gen !== genRef.current) return
    const buf = ctx.createBuffer(1, f32.length, OUTPUT_SAMPLE_RATE)
    buf.getChannelData(0).set(f32)
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    const now = ctx.currentTime
    if (nextPlayRef.current < now) nextPlayRef.current = now
    src.start(nextPlayRef.current)
    nextPlayRef.current += buf.duration
    isPlayingRef.current = true
    activeSourcesRef.current.push(src)
    src.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter((x) => x !== src)
      if (activeSourcesRef.current.length === 0 && activeRef.current && orbStateRef.current === "speaking") {
        isPlayingRef.current = false
        setOrbState("listening")
        setStatusText("Listening...")
      }
    }
  }, [])

  const start = useCallback(async () => {
    const baseUrl = process.env.NEXT_PUBLIC_VOICE_SERVER_URL?.trim()
    if (!baseUrl) { setError("Voice server URL not set"); return }
    if (typeof window !== "undefined" && window.location.protocol !== "https:" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      setError("Microphone requires HTTPS."); return
    }
    setError(null)

    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      micRef.current = mic
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const aCtx = new AC({ latencyHint: "interactive" })
      const pCtx = new AC({ latencyHint: "interactive", sampleRate: OUTPUT_SAMPLE_RATE })
      audioCtxRef.current = aCtx
      playCtxRef.current = pCtx

      const srcNode = aCtx.createMediaStreamSource(mic)
      const analyser = aCtx.createAnalyser(); analyser.fftSize = 256
      srcNode.connect(analyser)
      srcNodeRef.current = srcNode; analyserRef.current = analyser

      const sock = io(baseUrl, { transports: ["websocket"] })
      socketRef.current = sock

      sock.on("connect", () => {
        sock.emit("start-session", { voice, system_prompt: systemPrompt, data_context: dataContext || "" })
      })

      sock.on("session-ready", (cfg: { inputSampleRate?: number } | null) => {
        if (cfg?.inputSampleRate) inputSrRef.current = cfg.inputSampleRate
        const proc = aCtx.createScriptProcessor(2048, 1, 1)
        proc.onaudioprocess = (e) => {
          if (!activeRef.current) return
          const input = e.inputBuffer.getChannelData(0)
          if (orbStateRef.current === "speaking") {
            if (analyserRef.current) setAudioLevel(rmsFromAnalyser(analyserRef.current))
            return
          }
          const resampled = downsample(input, aCtx.sampleRate, inputSrRef.current)
          if (sock.connected) sock.emit("audio-chunk", float32ToPcm16Base64(resampled))
          if (analyserRef.current) setAudioLevel(rmsFromAnalyser(analyserRef.current))
        }
        srcNode.connect(proc)
        proc.connect(aCtx.destination)
        procRef.current = proc
        activeRef.current = true
        setActive(true)
        setOrbState("listening")
        setStatusText("Listening...")
      })

      sock.on("session-configured", () => setStatusText("Listening — say something!"))
      sock.on("vad-speech-started", () => { flushPlayback(); setOrbState("listening"); setStatusText("Listening...") })
      sock.on("vad-speech-stopped", () => { setOrbState("listening"); setStatusText("Processing...") })

      sock.on("audio-delta", (b64: string) => {
        if (!activeRef.current) return
        setOrbState("speaking"); setStatusText("Speaking...")
        const f32 = pcm16Base64ToFloat32(b64)
        setAudioLevel(rmsFromPcm(f32))
        schedule(f32, genRef.current)
      })

      sock.on("response-done", () => {
        if (!isPlayingRef.current) { setOrbState("listening"); setStatusText("Listening...") }
        setTimeout(() => {
          if (activeRef.current && orbStateRef.current === "speaking" && activeSourcesRef.current.length === 0) {
            setOrbState("listening"); setStatusText("Listening...")
          }
        }, 500)
      })

      sock.on("session-closed", () => { setError("Session ended."); stop() })
      sock.on("error", (err: unknown) => {
        const msg = err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : String(err)
        setError(msg); stop()
      })
      sock.on("connect_error", (err: Error) => { setError(err.message || "Cannot reach voice server."); stop() })
      sock.on("disconnect", () => stop())
    } catch (err) {
      const e = err as { name?: string; message?: string }
      setError(e.name === "NotAllowedError" ? "Microphone permission denied." : (e.message ?? "Failed to start"))
      stop()
    }
  }, [voice, systemPrompt, dataContext, flushPlayback, schedule, stop])

  useEffect(() => () => stop(), [stop])

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative h-36 w-36 overflow-hidden rounded-full bg-black/20 ring-1 ring-white/10">
        <OrbVisualizer state={orbState} audioLevel={audioLevel} />
      </div>
      <p className="text-sm text-muted-foreground">{statusText}</p>
      {error && <p className="max-w-xs text-center text-xs text-destructive">{error}</p>}
      {!active ? (
        <button
          type="button"
          onClick={() => void start()}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:shadow-xl"
        >
          <Mic className="size-4" />
          Start Live Test
        </button>
      ) : (
        <button
          type="button"
          onClick={stop}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-2.5 text-sm font-medium transition hover:bg-accent"
        >
          <Square className="size-3.5" />
          End Test
        </button>
      )}
    </div>
  )
}
