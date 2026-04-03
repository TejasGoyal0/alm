"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { QRCodeSVG } from "qrcode.react"
import {
  ArrowLeft,
  BarChart3,
  Check,
  Copy,
  ExternalLink,
  Pause,
  Phone,
  Play,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { supabase } from "@/lib/supabase"
import type { Deployment, Pipeline } from "@/lib/types"

function useOrigin(): string {
  const [origin, setOrigin] = useState("")
  useEffect(() => {
    queueMicrotask(() => setOrigin(window.location.origin))
  }, [])
  return origin
}

export default function PipelineDeployPage() {
  const params = useParams()
  const id = typeof params.id === "string" ? params.id : params.id?.[0]
  const hasValidId = Boolean(id)
  const origin = useOrigin()

  const [pipeline, setPipeline] = useState<Pipeline | null>(null)
  const [deployment, setDeployment] = useState<Deployment | null>(null)
  const [loadError, setLoadError] = useState<string | null>(() =>
    hasValidId ? null : "Missing pipeline id."
  )
  const [loading, setLoading] = useState(() => hasValidId)

  const [linkCopied, setLinkCopied] = useState(false)
  const [embedCopied, setEmbedCopied] = useState(false)
  const [voipReady, setVoipReady] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)

  const shareUrl =
    origin && deployment?.slug ? `${origin}/v/${deployment.slug}` : ""

  const iframeSnippet =
    shareUrl !== ""
      ? `<iframe src="${shareUrl}" width="400" height="600" frameborder="0"></iframe>`
      : ""

  useEffect(() => {
    if (!id) return

    let cancelled = false

    void (async () => {
      setLoadError(null)
      setLoading(true)

      const [pipeRes, depRes] = await Promise.all([
        supabase.from("pipelines").select("*").eq("id", id).single(),
        supabase
          .from("deployments")
          .select("*")
          .eq("pipeline_id", id)
          .single(),
      ])

      if (cancelled) return

      if (pipeRes.error || !pipeRes.data) {
        setPipeline(null)
        setDeployment(null)
        setLoadError(
          pipeRes.error?.message ?? "Pipeline not found or inaccessible."
        )
        setLoading(false)
        return
      }

      setPipeline(pipeRes.data as Pipeline)

      if (depRes.error || !depRes.data) {
        setDeployment(null)
        setLoadError(
          depRes.error?.code === "PGRST116"
            ? "No deployment found for this pipeline yet."
            : (depRes.error?.message ?? "Could not load deployment.")
        )
      } else {
        setDeployment(depRes.data as Deployment)
        setLoadError(null)
      }

      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    const t = window.setTimeout(() => setVoipReady(true), 2000)
    return () => window.clearTimeout(t)
  }, [])

  const copyLink = useCallback(async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setLinkCopied(true)
      window.setTimeout(() => setLinkCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }, [shareUrl])

  const copyEmbed = useCallback(async () => {
    if (!iframeSnippet) return
    try {
      await navigator.clipboard.writeText(iframeSnippet)
      setEmbedCopied(true)
      window.setTimeout(() => setEmbedCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }, [iframeSnippet])

  const isLive = deployment?.status === "live"

  const onStatusChange = async (checked: boolean) => {
    if (!deployment?.id) return
    const next: Deployment["status"] = checked ? "live" : "paused"
    setStatusUpdating(true)
    const { error } = await supabase
      .from("deployments")
      .update({ status: next })
      .eq("id", deployment.id)

    if (!error) {
      setDeployment((d) => (d ? { ...d, status: next } : d))
    }
    setStatusUpdating(false)
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-center text-sm text-muted-foreground">
          Loading deployment…
        </p>
      </div>
    )
  }

  if (loadError || !deployment || !pipeline) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-12 sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          nativeButton={false}
          render={<Link href="/dashboard" />}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to Dashboard
        </Button>
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-base">Something went wrong</CardTitle>
            <CardDescription>{loadError}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="relative mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
      <AnimatePresence>
        {(linkCopied || embedCopied) && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-800 shadow-lg backdrop-blur-sm dark:text-emerald-200"
          >
            Copied!
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col items-center text-center">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 18 }}
          className="mb-5 flex size-20 items-center justify-center rounded-full bg-emerald-500/15 ring-4 ring-emerald-500/10 dark:bg-emerald-400/15 dark:ring-emerald-400/10"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 500, damping: 20 }}
          >
            <Check
              className="size-10 text-emerald-600 dark:text-emerald-400"
              strokeWidth={2.25}
              aria-hidden
            />
          </motion.div>
        </motion.div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">
          Pipeline Deployed!
        </h1>
        <p className="mt-2 max-w-lg text-pretty text-muted-foreground">
          <span className="font-medium text-foreground">{pipeline.name}</span>{" "}
          is live. Share the link, embed the widget, or connect a phone number.
        </p>
        <Badge
          variant="outline"
          className="mt-4 border-emerald-500/35 bg-emerald-500/8 text-emerald-800 dark:text-emerald-300"
        >
          Deployment ready
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ExternalLink className="size-4 text-indigo-500 dark:text-indigo-400" />
              Shareable link
            </CardTitle>
            <CardDescription>
              Anyone with this URL can open your voice agent.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <code className="min-w-0 flex-1 truncate rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-xs text-foreground dark:bg-muted/20">
                {shareUrl || "…"}
              </code>
              <Button
                variant="secondary"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={() => void copyLink()}
                disabled={!shareUrl}
              >
                <Copy className="size-3.5" aria-hidden />
                Copy
              </Button>
            </div>
            {shareUrl ? (
              <div className="flex justify-center rounded-xl border border-border/80 bg-muted/20 p-4 dark:bg-muted/10">
                <div className="rounded-lg bg-white p-2 shadow-sm dark:bg-white/95">
                  <QRCodeSVG
                    value={shareUrl}
                    size={140}
                    level="M"
                    marginSize={1}
                    bgColor="#ffffff"
                    fgColor="#0a0a0a"
                    title="Voice agent URL"
                  />
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Embed code</CardTitle>
            <CardDescription>
              Drop this iframe into your site to embed the experience.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <pre className="max-h-40 overflow-x-auto overflow-y-auto rounded-xl border border-border bg-muted/30 p-4 text-left text-xs leading-relaxed text-foreground dark:bg-muted/15">
              <code>{iframeSnippet || "…"}</code>
            </pre>
            <Button
              variant="secondary"
              size="sm"
              className="gap-1.5"
              onClick={() => void copyEmbed()}
              disabled={!iframeSnippet}
            >
              <Copy className="size-3.5" aria-hidden />
              Copy embed code
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Phone className="size-4 text-violet-500 dark:text-violet-400" />
              Phone number
            </CardTitle>
            <CardDescription>Route inbound calls to this pipeline.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-muted/20 px-4 py-4 dark:bg-muted/10">
              <div className="flex size-11 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                <Phone className="size-5" aria-hidden />
              </div>
              <div>
                <p className="font-mono text-base font-medium tracking-tight text-foreground">
                  +1 (415) 555-0142
                </p>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  {!voipReady ? (
                    <>
                      <span className="relative flex size-2">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400/60 opacity-75" />
                        <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
                      </span>
                      <span className="animate-pulse">VoIP provisioning…</span>
                    </>
                  ) : (
                    <>
                      <span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                      <span className="text-emerald-700 dark:text-emerald-400">
                        Ready
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Twilio integration — coming soon
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="size-4 text-sky-500 dark:text-sky-400" />
              Analytics preview
            </CardTitle>
            <CardDescription>At-a-glance performance (sample).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Calls Today", value: "0" },
                { label: "Avg Duration", value: "—" },
                { label: "Sentiment", value: "—" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-lg border border-border/60 bg-muted/15 px-2 py-3 text-center dark:bg-muted/10"
                >
                  <p className="text-lg font-semibold tabular-nums text-foreground">
                    {s.value}
                  </p>
                  <p className="mt-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full" disabled>
              View Analytics
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Coming soon
            </p>
          </CardContent>
        </Card>
      </div>

      <Separator className="bg-border/80" />

      <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex items-center gap-3">
            <Switch
              id="deploy-status"
              checked={isLive}
              disabled={statusUpdating}
              onCheckedChange={(c) => void onStatusChange(c)}
            />
            <label
              htmlFor="deploy-status"
              className="flex cursor-pointer select-none items-center gap-2 text-sm font-medium text-foreground"
            >
              {isLive ? (
                <Play className="size-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Pause className="size-4 text-amber-600 dark:text-amber-400" />
              )}
              {isLive ? "Live" : "Paused"}
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            nativeButton={false}
            render={<Link href="/dashboard" />}
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to Dashboard
          </Button>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/pipelines/${id}`} />}
          >
            Edit Pipeline
          </Button>
        </div>
      </div>
    </div>
  )
}
