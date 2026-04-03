"use client"

import { useCallback, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Database,
  FileText,
  Globe,
  Loader2,
  Mic,
  Upload,
  X,
  Zap,
} from "lucide-react"
import { useRouter } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { VoiceTestPanel } from "@/components/voice/voice-test-panel"
import {
  MODELS,
  PROMPT_PRESETS,
  VOICES,
  type DataSourceDraft,
  type WizardState,
} from "@/lib/types"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"

const STEPS = [
  { n: 1, label: "Name & Model" },
  { n: 2, label: "Connect Data" },
  { n: 3, label: "Configure" },
  { n: 4, label: "Test Live" },
] as const

const defaultPrompt =
  PROMPT_PRESETS.find((p) => p.id === "sales")?.prompt ?? ""

const initialWizard: WizardState = {
  name: "",
  description: "",
  model: "gemini-2.5-flash-native-audio",
  voice: "Puck",
  system_prompt: defaultPrompt,
  vad_sensitivity: "medium",
  silence_duration_ms: 300,
  allow_interruptions: true,
  data_sources: [],
}

function sourceIcon(type: DataSourceDraft["type"]) {
  switch (type) {
    case "file":
      return FileText
    case "api":
      return Globe
    case "database":
      return Database
    default:
      return FileText
  }
}

export default function NewPipelinePage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState(1)
  const [maxReachedStep, setMaxReachedStep] = useState(1)
  const [wizardState, setWizardState] = useState<WizardState>(initialWizard)
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(
    "sales"
  )

  const [apiUrl, setApiUrl] = useState("")
  const [apiLoading, setApiLoading] = useState(false)
  const [dbForm, setDbForm] = useState({
    host: "",
    port: "",
    database: "",
    username: "",
    password: "",
  })
  const [dbLoading, setDbLoading] = useState(false)
  const [dbConnected, setDbConnected] = useState(false)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const updateWizard = useCallback((patch: Partial<WizardState>) => {
    setWizardState((s) => ({ ...s, ...patch }))
  }, [])

  const goNext = () => {
    if (step >= 4) return
    const next = step + 1
    setStep(next)
    setMaxReachedStep((m) => Math.max(m, next))
  }

  const goBack = () => {
    if (step <= 1) return
    setStep((s) => s - 1)
  }

  const removeSource = (index: number) => {
    setWizardState((s) => ({
      ...s,
      data_sources: s.data_sources.filter((_, i) => i !== index),
    }))
  }

  const onFilesSelected = (files: FileList | null) => {
    if (!files?.length) return
    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => {
        const text =
          typeof reader.result === "string" ? reader.result : ""
        const draft: DataSourceDraft = {
          type: "file",
          name: file.name,
          config: { filename: file.name, size: file.size },
          extracted_context: text.slice(0, 2000),
        }
        setWizardState((s) => ({
          ...s,
          data_sources: [...s.data_sources, draft],
        }))
      }
      reader.readAsText(file)
    })
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const fetchApiMock = () => {
    const url = apiUrl.trim()
    if (!url) return
    setApiLoading(true)
    window.setTimeout(() => {
      let hostname = url
      try {
        hostname = new URL(
          url.startsWith("http") ? url : `https://${url}`
        ).hostname
      } catch {
        hostname = url.slice(0, 48)
      }
      const draft: DataSourceDraft = {
        type: "api",
        name: hostname,
        config: { url },
        extracted_context: `[API data from ${url} — connected successfully]`,
      }
      setWizardState((s) => ({
        ...s,
        data_sources: [...s.data_sources, draft],
      }))
      setApiLoading(false)
      setApiUrl("")
    }, 1500)
  }

  const testDbMock = () => {
    const { host, database } = dbForm
    if (!host.trim() || !database.trim()) return
    setDbLoading(true)
    setDbConnected(false)
    window.setTimeout(() => {
      const name = `${database}@${host}`
      const draft: DataSourceDraft = {
        type: "database",
        name,
        config: {
          host: dbForm.host,
          port: dbForm.port,
          database: dbForm.database,
          username: dbForm.username,
        },
        extracted_context: "[Database connected — ready to query]",
      }
      setWizardState((s) => ({
        ...s,
        data_sources: [...s.data_sources, draft],
      }))
      setDbLoading(false)
      setDbConnected(true)
    }, 2000)
  }

  const applyPreset = (id: (typeof PROMPT_PRESETS)[number]["id"]) => {
    const p = PROMPT_PRESETS.find((x) => x.id === id)
    if (!p) return
    setSelectedPresetId(id)
    updateWizard({ system_prompt: p.prompt })
  }

  const sanitize = (text: string) =>
    text.replace(/\0/g, "").replace(/\\u0000/g, "")

  const saveAndDeploy = async () => {
    if (!wizardState.name.trim()) {
      setSaveError("Please enter a pipeline name.")
      return
    }
    setSaveError(null)
    setSaving(true)
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()
      if (authError || !user) {
        setSaveError("You must be signed in to save a pipeline.")
        setSaving(false)
        return
      }

      const { data: pipelineRow, error: pipeError } = await supabase
        .from("pipelines")
        .insert({
          user_id: user.id,
          name: sanitize(wizardState.name.trim()),
          description: wizardState.description.trim()
            ? sanitize(wizardState.description.trim())
            : null,
          model: wizardState.model,
          voice: wizardState.voice,
          system_prompt: sanitize(wizardState.system_prompt),
          vad_sensitivity: wizardState.vad_sensitivity,
          silence_duration_ms: wizardState.silence_duration_ms,
          allow_interruptions: wizardState.allow_interruptions,
          status: "draft",
        })
        .select("id")
        .single()

      if (pipeError || !pipelineRow?.id) {
        setSaveError(pipeError?.message ?? "Could not create pipeline.")
        setSaving(false)
        return
      }

      const pipelineId = pipelineRow.id as string

      for (const ds of wizardState.data_sources) {
        const cleanConfig: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(ds.config)) {
          cleanConfig[k] = typeof v === "string" ? sanitize(v) : v
        }
        const { error: dsError } = await supabase.from("data_sources").insert({
          pipeline_id: pipelineId,
          type: ds.type,
          name: sanitize(ds.name),
          config: cleanConfig,
          extracted_context: sanitize(ds.extracted_context),
        })
        if (dsError) {
          setSaveError(dsError.message)
          setSaving(false)
          return
        }
      }

      const slug = crypto.randomUUID().slice(0, 8)
      const { error: depError } = await supabase.from("deployments").insert({
        pipeline_id: pipelineId,
        slug,
        embed_enabled: true,
        status: "live",
      })
      if (depError) {
        setSaveError(depError.message)
        setSaving(false)
        return
      }

      router.push(`/pipelines/${pipelineId}/deploy`)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Something went wrong.")
      setSaving(false)
    }
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-background via-background to-indigo-50/40 dark:to-indigo-950/25">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-10 space-y-2 text-center sm:text-left">
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">
            New voice pipeline
          </h1>
          <p className="text-muted-foreground">
            Configure your model, data, and behavior in a few guided steps.
          </p>
        </div>

        {/* Progress */}
        <div className="mb-10">
          <div className="flex items-start justify-between gap-1 sm:gap-3">
            {STEPS.map(({ n, label }) => {
              const active = step === n
              const done = step > n
              const clickable = n <= maxReachedStep
              return (
                <div
                  key={n}
                  className="flex min-w-0 flex-1 flex-col items-center"
                >
                  <button
                    type="button"
                    disabled={!clickable}
                    onClick={() => clickable && setStep(n)}
                    className={cn(
                      "flex w-full flex-col items-center gap-2 rounded-lg py-2 transition-colors",
                      clickable
                        ? "cursor-pointer hover:bg-muted/60"
                        : "cursor-not-allowed opacity-50"
                    )}
                  >
                    <div
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-all",
                        active &&
                          "bg-indigo-600 text-white shadow-md shadow-indigo-500/30 ring-2 ring-indigo-400/50 dark:bg-indigo-500 dark:ring-indigo-400/40",
                        done &&
                          !active &&
                          "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
                        !done &&
                          !active &&
                          "bg-muted text-muted-foreground ring-1 ring-border"
                      )}
                    >
                      {done && !active ? (
                        <Check className="size-5" aria-hidden />
                      ) : (
                        n
                      )}
                    </div>
                    <span
                      className={cn(
                        "hidden text-center text-xs font-medium sm:block",
                        active
                          ? "text-indigo-700 dark:text-indigo-300"
                          : "text-muted-foreground"
                      )}
                    >
                      {label}
                    </span>
                  </button>
                </div>
              )
            })}
          </div>
          <div className="mt-2 flex justify-between px-4 sm:hidden">
            {STEPS.map(({ n, label }) => (
              <span
                key={n}
                className={cn(
                  "max-w-[22%] truncate text-center text-[10px] font-medium",
                  step === n
                    ? "text-indigo-700 dark:text-indigo-300"
                    : "text-muted-foreground"
                )}
              >
                {label}
              </span>
            ))}
          </div>
          <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-500 dark:to-violet-500"
              initial={false}
              animate={{ width: `${((step - 1) / 3) * 100}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
          </div>
        </div>

        <Card className="border-border/80 shadow-lg shadow-indigo-500/5 dark:shadow-none">
          <CardContent className="px-4 py-8 sm:px-8 sm:py-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -28 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                {step === 1 && (
                  <div className="space-y-8">
                    <div>
                      <CardTitle className="text-xl">Name & model</CardTitle>
                      <CardDescription className="mt-1">
                        Identify your pipeline and choose how it will sound and
                        reason.
                      </CardDescription>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="pipe-name">Pipeline name</Label>
                        <Input
                          id="pipe-name"
                          placeholder="e.g. Acme Sales Line"
                          value={wizardState.name}
                          onChange={(e) =>
                            updateWizard({ name: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pipe-desc">Description (optional)</Label>
                        <Textarea
                          id="pipe-desc"
                          rows={3}
                          className="min-h-[4.5rem] resize-y text-sm"
                          placeholder="Short internal note…"
                          value={wizardState.description}
                          onChange={(e) =>
                            updateWizard({ description: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-3">
                      <Label>Model</Label>
                      <div className="grid gap-4 sm:grid-cols-3">
                        {MODELS.map((m) => {
                          const selected = wizardState.model === m.id
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => updateWizard({ model: m.id })}
                              className={cn(
                                "flex flex-col rounded-xl border bg-card p-4 text-left transition-all hover:border-indigo-300/60 dark:hover:border-indigo-500/40",
                                selected
                                  ? "border-indigo-500 ring-2 ring-indigo-500/40 dark:border-indigo-400 dark:ring-indigo-400/35"
                                  : "border-border"
                              )}
                            >
                              <div className="mb-3 flex items-start justify-between gap-2">
                                <span
                                  className="flex size-10 items-center justify-center rounded-lg bg-indigo-500/10 text-lg text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-200"
                                  aria-hidden
                                >
                                  {m.icon}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="shrink-0 gap-1 border-indigo-200/80 bg-indigo-50/80 text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-950/50 dark:text-indigo-200"
                                >
                                  <Zap className="size-3" aria-hidden />
                                  {m.latency}
                                </Badge>
                              </div>
                              <p className="font-heading font-medium text-foreground">
                                {m.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {m.provider}
                              </p>
                              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                                {m.description}
                              </p>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label>Voice</Label>
                      <div className="flex flex-wrap gap-2">
                        {VOICES.map((v) => {
                          const selected = wizardState.voice === v.id
                          return (
                            <Button
                              key={v.id}
                              type="button"
                              variant={selected ? "default" : "outline"}
                              size="sm"
                              className={cn(
                                "rounded-full px-4",
                                selected &&
                                  "border-0 bg-indigo-600 text-white hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                              )}
                              onClick={() => updateWizard({ voice: v.id })}
                            >
                              <Mic className="size-3.5 opacity-80" aria-hidden />
                              {v.name}
                              <span className="text-muted-foreground/90 [.border-0_&]:text-indigo-100/90">
                                · {v.tag}
                              </span>
                            </Button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-8">
                    <div>
                      <CardTitle className="text-xl">Connect data</CardTitle>
                      <CardDescription className="mt-1">
                        Attach files, APIs, or database context your agent can
                        rely on.
                      </CardDescription>
                    </div>
                    <Tabs defaultValue="files" className="w-full gap-6">
                      <TabsList className="grid h-auto w-full grid-cols-3 p-1 sm:w-full">
                        <TabsTrigger value="files" className="gap-1.5">
                          <FileText className="size-4" aria-hidden />
                          Files
                        </TabsTrigger>
                        <TabsTrigger value="api" className="gap-1.5">
                          <Globe className="size-4" aria-hidden />
                          API
                        </TabsTrigger>
                        <TabsTrigger value="database" className="gap-1.5">
                          <Database className="size-4" aria-hidden />
                          Database
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="files" className="mt-0 space-y-4">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".txt,.pdf,.csv,.md,.json"
                          multiple
                          className="hidden"
                          onChange={(e) => onFilesSelected(e.target.files)}
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          onDragOver={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                          }}
                          onDrop={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            onFilesSelected(e.dataTransfer.files)
                          }}
                          className={cn(
                            "flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-indigo-300/50 bg-indigo-500/[0.03] px-6 py-14 transition-colors",
                            "hover:border-indigo-400 hover:bg-indigo-500/[0.06] dark:border-indigo-500/35 dark:bg-indigo-500/[0.06] dark:hover:border-indigo-400 dark:hover:bg-indigo-500/10"
                          )}
                        >
                          <Upload
                            className="size-10 text-indigo-500 dark:text-indigo-400"
                            aria-hidden
                          />
                          <p className="text-sm font-medium text-foreground">
                            Drop files here or click to upload
                          </p>
                          <p className="text-xs text-muted-foreground">
                            .txt, .pdf, .csv, .md, .json
                          </p>
                        </button>
                      </TabsContent>
                      <TabsContent value="api" className="mt-0 space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="api-url">Endpoint URL</Label>
                          <Input
                            id="api-url"
                            placeholder="https://api.example.com/v1/data"
                            value={apiUrl}
                            onChange={(e) => setApiUrl(e.target.value)}
                          />
                        </div>
                        <Button
                          type="button"
                          className="gap-2 bg-indigo-600 text-white hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                          disabled={apiLoading || !apiUrl.trim()}
                          onClick={fetchApiMock}
                        >
                          {apiLoading ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Globe className="size-4" />
                          )}
                          Fetch & Connect
                        </Button>
                      </TabsContent>
                      <TabsContent value="database" className="mt-0 space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="db-host">Host</Label>
                            <Input
                              id="db-host"
                              value={dbForm.host}
                              onChange={(e) =>
                                setDbForm((f) => ({
                                  ...f,
                                  host: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="db-port">Port</Label>
                            <Input
                              id="db-port"
                              value={dbForm.port}
                              onChange={(e) =>
                                setDbForm((f) => ({
                                  ...f,
                                  port: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="db-name">Database name</Label>
                            <Input
                              id="db-name"
                              value={dbForm.database}
                              onChange={(e) =>
                                setDbForm((f) => ({
                                  ...f,
                                  database: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="db-user">Username</Label>
                            <Input
                              id="db-user"
                              value={dbForm.username}
                              onChange={(e) =>
                                setDbForm((f) => ({
                                  ...f,
                                  username: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="db-pass">Password</Label>
                            <Input
                              id="db-pass"
                              type="password"
                              value={dbForm.password}
                              onChange={(e) =>
                                setDbForm((f) => ({
                                  ...f,
                                  password: e.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            className="gap-2"
                            disabled={
                              dbLoading ||
                              !dbForm.host.trim() ||
                              !dbForm.database.trim()
                            }
                            onClick={testDbMock}
                          >
                            {dbLoading ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Database className="size-4" />
                            )}
                            Test Connection
                          </Button>
                          {dbConnected && (
                            <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                              <Check className="size-4" aria-hidden />
                              Connected
                            </span>
                          )}
                        </div>
                      </TabsContent>
                    </Tabs>

                    <Separator />

                    <div className="space-y-3">
                      <Label>Connected sources</Label>
                      {wizardState.data_sources.length === 0 ? (
                        <p className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                          No sources yet — add files, an API, or a database
                          above.
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {wizardState.data_sources.map((ds, idx) => {
                            const Icon = sourceIcon(ds.type)
                            return (
                              <li
                                key={`${ds.type}-${ds.name}-${idx}`}
                                className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5 dark:bg-muted/10"
                              >
                                <div className="flex size-9 items-center justify-center rounded-md bg-background ring-1 ring-border">
                                  <Icon
                                    className="size-4 text-indigo-600 dark:text-indigo-400"
                                    aria-hidden
                                  />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">
                                    {ds.name}
                                  </p>
                                  <p className="text-xs capitalize text-muted-foreground">
                                    {ds.type}
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  className="shrink-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => removeSource(idx)}
                                  aria-label={`Remove ${ds.name}`}
                                >
                                  <X className="size-4" />
                                </Button>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-8">
                    <div>
                      <CardTitle className="text-xl">Configure</CardTitle>
                      <CardDescription className="mt-1">
                        System behavior, voice activity detection, and turn
                        taking.
                      </CardDescription>
                    </div>
                    <div className="space-y-3">
                      <Label>System prompt presets</Label>
                      <div className="flex flex-wrap gap-2">
                        {PROMPT_PRESETS.map((p) => {
                          const selected = selectedPresetId === p.id
                          return (
                            <Button
                              key={p.id}
                              type="button"
                              size="sm"
                              variant={selected ? "default" : "outline"}
                              className={cn(
                                "rounded-full",
                                selected &&
                                  "border-0 bg-indigo-600 text-white hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                              )}
                              onClick={() => applyPreset(p.id)}
                            >
                              {p.name}
                            </Button>
                          )
                        })}
                      </div>
                      <Textarea
                        rows={10}
                        className="min-h-[220px] resize-y font-mono text-sm leading-relaxed"
                        placeholder="You are a helpful voice agent…"
                        value={wizardState.system_prompt}
                        onChange={(e) => {
                          updateWizard({ system_prompt: e.target.value })
                          setSelectedPresetId(null)
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        {wizardState.system_prompt.length} characters
                      </p>
                    </div>
                    <Separator />
                    <div className="space-y-3">
                      <Label>VAD sensitivity</Label>
                      <div className="grid gap-3 sm:grid-cols-3">
                        {(
                          [
                            {
                              v: "low" as const,
                              title: "Low",
                              desc: "Fewer cuts; better for noisy rooms.",
                            },
                            {
                              v: "medium" as const,
                              title: "Medium",
                              desc: "Balanced — works for most calls.",
                            },
                            {
                              v: "high" as const,
                              title: "High",
                              desc: "Snappy turns; quieter environments.",
                            },
                          ] as const
                        ).map(({ v, title, desc }) => {
                          const selected = wizardState.vad_sensitivity === v
                          return (
                            <button
                              key={v}
                              type="button"
                              onClick={() =>
                                updateWizard({ vad_sensitivity: v })
                              }
                              className={cn(
                                "rounded-xl border p-4 text-left transition-all",
                                selected
                                  ? "border-indigo-500 bg-indigo-500/5 ring-2 ring-indigo-500/30 dark:border-indigo-400 dark:bg-indigo-500/10 dark:ring-indigo-400/25"
                                  : "border-border hover:bg-muted/40"
                              )}
                            >
                              <p className="font-medium text-foreground">
                                {title}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {desc}
                              </p>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <Label htmlFor="silence-slider">
                          Silence duration before end of turn
                        </Label>
                        <span className="tabular-nums text-sm font-medium text-indigo-700 dark:text-indigo-300">
                          {wizardState.silence_duration_ms} ms
                        </span>
                      </div>
                      <Slider
                        min={100}
                        max={1000}
                        step={50}
                        value={[wizardState.silence_duration_ms]}
                        onValueChange={(vals) => {
                          const v = Array.isArray(vals) ? vals[0] : vals
                          if (typeof v === "number")
                            updateWizard({ silence_duration_ms: v })
                        }}
                        className="py-1"
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-4 dark:bg-muted/10">
                      <div>
                        <Label htmlFor="interrupt-switch" className="text-base">
                          Allow interruptions
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Let callers cut in while the agent is speaking.
                        </p>
                      </div>
                      <Switch
                        id="interrupt-switch"
                        checked={wizardState.allow_interruptions}
                        onCheckedChange={(checked) =>
                          updateWizard({ allow_interruptions: checked })
                        }
                      />
                    </div>
                  </div>
                )}

                {step === 4 && (
                  <div className="space-y-8">
                    <div className="text-center">
                      <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-400/15 dark:text-indigo-300">
                        <Mic className="size-8" aria-hidden />
                      </div>
                      <CardTitle className="text-xl">
                        Your pipeline is ready to test
                      </CardTitle>
                      <CardDescription className="mx-auto mt-2 max-w-md">
                        Run a live session to hear responses — wiring to the
                        voice backend comes next.
                      </CardDescription>
                    </div>
                    <Card className="border-border/80 bg-muted/15 dark:bg-muted/5">
                      <CardHeader>
                        <CardTitle className="text-base">Summary</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Model</span>
                          <span className="font-medium text-right">
                            {MODELS.find((m) => m.id === wizardState.model)
                              ?.name ?? wizardState.model}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Voice</span>
                          <span className="font-medium">
                            {VOICES.find((v) => v.id === wizardState.voice)
                              ?.name ?? wizardState.voice}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">
                            Data sources
                          </span>
                          <span className="font-medium tabular-nums">
                            {wizardState.data_sources.length}
                          </span>
                        </div>
                        <Separator className="my-3" />
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">VAD</span>
                          <span className="font-medium capitalize">
                            {wizardState.vad_sensitivity}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Silence</span>
                          <span className="font-medium tabular-nums">
                            {wizardState.silence_duration_ms} ms
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">
                            Interruptions
                          </span>
                          <span className="font-medium">
                            {wizardState.allow_interruptions ? "On" : "Off"}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                    <VoiceTestPanel
                      voice={wizardState.voice}
                      systemPrompt={wizardState.system_prompt}
                      dataContext={wizardState.data_sources
                        .map((ds) => ds.extracted_context)
                        .filter(Boolean)
                        .join("\n\n")}
                    />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </CardContent>

          <CardFooter className="flex flex-col gap-4 border-t bg-muted/30 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8 dark:bg-muted/15">
            {saveError && (
              <p className="w-full text-sm text-destructive sm:order-first sm:w-auto">
                {saveError}
              </p>
            )}
            <div className="flex w-full items-center justify-between gap-3 sm:w-auto">
              <Button
                type="button"
                variant="outline"
                className="gap-1"
                disabled={step <= 1}
                onClick={goBack}
              >
                <ChevronLeft className="size-4" aria-hidden />
                Back
              </Button>
              {step < 4 ? (
                <Button
                  type="button"
                  className="gap-1 bg-indigo-600 text-white hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                  onClick={goNext}
                >
                  Next
                  <ChevronRight className="size-4" aria-hidden />
                </Button>
              ) : (
                <Button
                  type="button"
                  className="gap-2 bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                  disabled={saving}
                  onClick={() => void saveAndDeploy()}
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Check className="size-4" aria-hidden />
                  )}
                  Save & Deploy
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
