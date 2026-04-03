"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { io, type Socket } from "socket.io-client"

import { OrbVisualizer, type OrbState } from "@/components/voice/orb-visualizer"
import {
  downsample,
  float32ToPcm16Base64,
  pcm16Base64ToFloat32,
} from "@/lib/audio-pcm"
import { supabase } from "@/lib/supabase"
import type { Deployment, Pipeline } from "@/lib/types"

const OUTPUT_SAMPLE_RATE = 24000

type DeploymentWithPipeline = Deployment & {
  pipelines: Pipeline | Pipeline[] | null
}

function normalizePipeline(
  p: Pipeline | Pipeline[] | null
): Pipeline | null {
  if (!p) return null
  return Array.isArray(p) ? (p[0] ?? null) : p
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

export default function PublicVoicePage() {
  const params = useParams()
  const slug = typeof params.slug === "string" ? params.slug : ""

  const [loading, setLoading] = useState(() => Boolean(slug))
  const [fetchError, setFetchError] = useState<string | null>(() =>
    slug ? null : "Missing deployment slug"
  )
  const [pipeline, setPipeline] = useState<Pipeline | null>(null)
  const [dataSourcesContext, setDataSourcesContext] = useState("")

  const [orbState, setOrbState] = useState<OrbState>("idle")
  const [audioLevel, setAudioLevel] = useState(0.08)
  const [statusText, setStatusText] = useState("Ready")
  const [sessionActive, setSessionActive] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)

  const orbStateRef = useRef<OrbState>("idle")
  const sessionActiveRef = useRef(false)
  const inputSampleRateRef = useRef(16000)

  const socketRef = useRef<Socket | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const playbackCtxRef = useRef<AudioContext | null>(null)
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([])
  const nextPlayTimeRef = useRef(0)
  const isPlayingRef = useRef(false)
  const responseGenerationRef = useRef(0)

  useEffect(() => {
    orbStateRef.current = orbState
  }, [orbState])

  useEffect(() => {
    sessionActiveRef.current = sessionActive
  }, [sessionActive])

  useEffect(() => {
    if (!slug) return

    let cancelled = false
    ;(async () => {
      setLoading(true)
      setFetchError(null)

      const { data, error } = await supabase
        .from("deployments")
        .select("*, pipelines(*)")
        .eq("slug", slug)
        .single()

      if (cancelled) return

      if (error || !data) {
        setFetchError(error?.message ?? "Deployment not found")
        setPipeline(null)
        setLoading(false)
        return
      }

      const row = data as unknown as DeploymentWithPipeline
      const pl = normalizePipeline(row.pipelines)
      if (!pl) {
        setFetchError("Pipeline not found for this deployment")
        setPipeline(null)
        setLoading(false)
        return
      }

      setPipeline(pl)

      const { data: dsRows } = await supabase
        .from("data_sources")
        .select("extracted_context")
        .eq("pipeline_id", pl.id)

      if (cancelled) return

      const parts =
        dsRows
          ?.map((r) => r.extracted_context)
          .filter((c): c is string => Boolean(c && c.trim())) ?? []
      setDataSourcesContext(parts.join("\n\n"))
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    if (sessionActive) return
    let id = 0
    const tick = () => {
      setAudioLevel(0.05 + Math.sin(Date.now() / 1000 * 0.5) * 0.03)
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [sessionActive])

  const flushPlayback = useCallback(() => {
    responseGenerationRef.current += 1
    for (const src of activeSourcesRef.current) {
      try {
        src.stop()
      } catch {
        /* already stopped */
      }
    }
    activeSourcesRef.current = []
    nextPlayTimeRef.current = 0
    isPlayingRef.current = false
  }, [])

  const stopSession = useCallback(() => {
    sessionActiveRef.current = false
    setSessionActive(false)

    const sock = socketRef.current
    socketRef.current = null
    if (sock) {
      try {
        sock.emit("stop-session")
      } catch {
        /* ignore */
      }
      sock.disconnect()
    }

    processorRef.current?.disconnect()
    processorRef.current = null
    sourceNodeRef.current?.disconnect()
    sourceNodeRef.current = null
    analyserRef.current?.disconnect()
    analyserRef.current = null

    void audioCtxRef.current?.close()
    audioCtxRef.current = null
    void playbackCtxRef.current?.close()
    playbackCtxRef.current = null

    micStreamRef.current?.getTracks().forEach((t) => t.stop())
    micStreamRef.current = null

    flushPlayback()
    setOrbState("idle")
    setStatusText("Ready")
    setAudioLevel(0)
  }, [flushPlayback])

  const schedulePlayback = useCallback(
    (float32: Float32Array, gen: number) => {
      const playbackCtx = playbackCtxRef.current
      if (!playbackCtx || gen !== responseGenerationRef.current) return

      const buf = playbackCtx.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE)
      buf.getChannelData(0).set(float32)
      const src = playbackCtx.createBufferSource()
      src.buffer = buf
      src.connect(playbackCtx.destination)

      const now = playbackCtx.currentTime
      if (nextPlayTimeRef.current < now) nextPlayTimeRef.current = now

      src.start(nextPlayTimeRef.current)
      nextPlayTimeRef.current += buf.duration
      isPlayingRef.current = true
      activeSourcesRef.current.push(src)

      src.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== src)
        if (
          activeSourcesRef.current.length === 0 &&
          sessionActiveRef.current &&
          orbStateRef.current === "speaking"
        ) {
          isPlayingRef.current = false
          setOrbState("listening")
          setStatusText("Listening...")
        }
      }
    },
    []
  )

  const startSession = useCallback(async () => {
    if (!pipeline) return

    const baseUrl = process.env.NEXT_PUBLIC_VOICE_SERVER_URL?.trim()
    if (!baseUrl) {
      setSessionError("NEXT_PUBLIC_VOICE_SERVER_URL is not set")
      return
    }

    if (
      typeof window !== "undefined" &&
      window.location.protocol !== "https:" &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1"
    ) {
      setSessionError("Microphone access requires HTTPS.")
      return
    }

    setSessionError(null)

    try {
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      micStreamRef.current = micStream

      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext

      const audioCtx = new AC({ latencyHint: "interactive" })
      const playbackCtx = new AC({
        latencyHint: "interactive",
        sampleRate: OUTPUT_SAMPLE_RATE,
      })
      audioCtxRef.current = audioCtx
      playbackCtxRef.current = playbackCtx

      const sourceNode = audioCtx.createMediaStreamSource(micStream)
      const analyserNode = audioCtx.createAnalyser()
      analyserNode.fftSize = 256
      sourceNode.connect(analyserNode)
      sourceNodeRef.current = sourceNode
      analyserRef.current = analyserNode

      const sessionConfig = {
        model: pipeline.model,
        voice: pipeline.voice,
        system_prompt: pipeline.system_prompt,
        data_sources_context: dataSourcesContext,
      }

      const socket = io(baseUrl, { transports: ["websocket"] })
      socketRef.current = socket

      socket.on("connect", () => {
        socket.emit("start-session", sessionConfig)
      })

      socket.on("session-ready", (cfg: { inputSampleRate?: number } | null) => {
        if (cfg?.inputSampleRate) {
          inputSampleRateRef.current = cfg.inputSampleRate
        }

        const bufferSize = 2048
        const processorNode = audioCtx.createScriptProcessor(bufferSize, 1, 1)
        processorNode.onaudioprocess = (e) => {
          if (!sessionActiveRef.current) return
          const input = e.inputBuffer.getChannelData(0)
          const analyser = analyserRef.current

          if (orbStateRef.current === "speaking") {
            if (analyser) setAudioLevel(rmsFromAnalyser(analyser))
            return
          }

          const resampled = downsample(
            input,
            audioCtx.sampleRate,
            inputSampleRateRef.current
          )
          const base64 = float32ToPcm16Base64(resampled)
          if (socket.connected) socket.emit("audio-chunk", base64)

          if (analyser) setAudioLevel(rmsFromAnalyser(analyser))
        }

        sourceNode.connect(processorNode)
        processorNode.connect(audioCtx.destination)
        processorRef.current = processorNode

        sessionActiveRef.current = true
        setSessionActive(true)
        setOrbState("listening")
        setStatusText("Listening...")
      })

      socket.on("session-configured", () => {
        setStatusText("Listening — say something!")
      })

      socket.on("vad-speech-started", () => {
        flushPlayback()
        setOrbState("listening")
        setStatusText("Listening...")
      })

      socket.on("vad-speech-stopped", () => {
        setOrbState("listening")
        setStatusText("Processing...")
      })

      socket.on("audio-delta", (base64: string) => {
        if (!sessionActiveRef.current) return
        setOrbState("speaking")
        setStatusText("Speaking...")
        const float32 = pcm16Base64ToFloat32(base64)
        setAudioLevel(rmsFromPcm(float32))
        schedulePlayback(float32, responseGenerationRef.current)
      })

      socket.on("audio-done", () => {
        /* buffers may still be playing */
      })

      socket.on("response-done", () => {
        if (!isPlayingRef.current) {
          setOrbState("listening")
          setStatusText("Listening...")
        }
        window.setTimeout(() => {
          if (
            sessionActiveRef.current &&
            orbStateRef.current === "speaking" &&
            activeSourcesRef.current.length === 0
          ) {
            setOrbState("listening")
            setStatusText("Listening...")
          }
        }, 500)
      })

      socket.on("session-closed", () => {
        setSessionError("Session ended by the server.")
        stopSession()
      })

      socket.on("error", (err: unknown) => {
        const msg =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : String(err)
        setSessionError(msg || "Connection error")
        stopSession()
      })

      socket.on("connect_error", (err: Error) => {
        console.error("Socket connect error:", err)
        setSessionError(err.message || "Cannot reach voice server.")
        stopSession()
      })

      socket.on("disconnect", () => {
        stopSession()
      })
    } catch (err) {
      console.error("Failed to start:", err)
      const e = err as { name?: string; message?: string }
      if (e.name === "NotAllowedError") {
        setSessionError("Microphone permission denied.")
      } else {
        setSessionError(e.message ?? "Failed to start voice session")
      }
      stopSession()
    }
  }, [dataSourcesContext, flushPlayback, pipeline, schedulePlayback, stopSession])

  useEffect(() => {
    return () => {
      stopSession()
    }
  }, [stopSession])

  if (loading) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center px-4"
        style={{ backgroundColor: "#060611" }}
      >
        <p className="text-sm text-slate-400">Loading deployment…</p>
      </div>
    )
  }

  if (fetchError || !pipeline) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center px-4"
        style={{ backgroundColor: "#060611" }}
      >
        <p className="text-center text-sm text-red-300">{fetchError}</p>
      </div>
    )
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center px-4 py-10 text-slate-200"
      style={{ backgroundColor: "#060611" }}
    >
      <header className="mb-8 flex w-full max-w-md flex-col items-center gap-1">
        <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-sm font-semibold tracking-tight text-transparent">
          VoiceFlow.ai
        </span>
        <h1 className="text-center text-xl font-semibold text-slate-100">
          {pipeline.name}
        </h1>
      </header>

      <div className="flex w-full max-w-md flex-1 flex-col items-center">
        <div className="relative h-48 w-48 shrink-0 overflow-hidden rounded-full bg-black/20 ring-1 ring-white/10">
          <OrbVisualizer state={orbState} audioLevel={audioLevel} />
        </div>

        <p className="mt-6 text-center text-sm text-slate-400">{statusText}</p>

        {sessionError ? (
          <p className="mt-3 max-w-sm text-center text-xs text-red-300">
            {sessionError}
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {!sessionActive ? (
            <button
              type="button"
              onClick={() => void startSession()}
              className="rounded-full px-6 py-2.5 text-sm font-medium text-white shadow-lg transition hover:opacity-95"
              style={{
                background:
                  "linear-gradient(135deg, rgb(99, 102, 241) 0%, rgb(139, 92, 246) 100%)",
              }}
            >
              Start Conversation
            </button>
          ) : (
            <button
              type="button"
              onClick={stopSession}
              className="rounded-full border border-slate-600 bg-slate-800/80 px-6 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
            >
              End
            </button>
          )}
        </div>
      </div>

      <footer className="mt-auto pt-12 text-center text-[11px] text-slate-600">
        Powered by VoiceFlow.ai
      </footer>
    </div>
  )
}
