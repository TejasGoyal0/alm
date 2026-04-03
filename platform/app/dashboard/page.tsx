"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Activity, Clock, Plus, Zap, Waves, ArrowRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MODELS, type Pipeline } from "@/lib/types"
import { supabase } from "@/lib/supabase"

function formatTimeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ""
  const sec = Math.floor((Date.now() - then) / 1000)
  if (sec < 45) return "just now"
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function modelLabel(modelId: string): string {
  return MODELS.find((x) => x.id === modelId)?.name ?? modelId
}

const statusConfig = {
  draft: { label: "Draft", dot: "bg-zinc-400", bg: "bg-zinc-500/10 text-zinc-400 ring-zinc-500/20" },
  active: { label: "Active", dot: "bg-emerald-400", bg: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20" },
  deployed: { label: "Deployed", dot: "bg-blue-400", bg: "bg-blue-500/10 text-blue-300 ring-blue-500/20" },
} as const

export default function DashboardPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from("pipelines")
        .select("*")
        .order("created_at", { ascending: false })
      if (!cancelled) {
        setPipelines(error ? [] : ((data as Pipeline[]) ?? []))
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const activeCount = useMemo(() => pipelines.filter((p) => p.status === "active").length, [pipelines])
  const deployedCount = useMemo(() => pipelines.filter((p) => p.status === "deployed").length, [pipelines])

  const stats = [
    { label: "Pipelines", value: loading ? "—" : String(pipelines.length), icon: Zap, color: "text-indigo-400" },
    { label: "Active", value: loading ? "—" : String(activeCount), icon: Activity, color: "text-emerald-400" },
    { label: "Deployed", value: loading ? "—" : String(deployedCount), icon: Waves, color: "text-violet-400" },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Your voice pipeline control center.</p>
        </div>
        <Link href="/pipelines/new">
          <Button className="gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20 hover:from-indigo-500 hover:to-violet-500 hover:shadow-lg dark:from-indigo-500 dark:to-violet-500 dark:shadow-indigo-500/10">
            <Plus className="size-4" />
            New Pipeline
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-border bg-card/50 p-4 backdrop-blur"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
              <s.icon className={`size-4 ${s.color}`} />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Pipelines */}
      <div>
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Your pipelines</h2>

        {loading ? (
          <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
            <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Loading...
          </div>
        ) : pipelines.length === 0 ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-indigo-500/15 bg-indigo-500/[0.02] px-6 py-14 text-center">
            <div className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/15 to-violet-500/10 ring-1 ring-indigo-500/20">
              <Waves className="size-7 text-indigo-400" />
            </div>
            <h3 className="text-lg font-semibold">No pipelines yet</h3>
            <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
              Create your first audio pipeline and start routing calls through your AI stack.
            </p>
            <Link href="/pipelines/new" className="mt-6">
              <Button className="gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20 hover:from-indigo-500 hover:to-violet-500">
                <Plus className="size-4" />
                Create pipeline
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pipelines.map((p) => {
              const st = statusConfig[p.status]
              return (
                <Link key={p.id} href={`/pipelines/${p.id}`} className="block">
                  <div className="group h-full rounded-xl border border-border bg-card/50 p-4 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/[0.04]">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{p.name}</h3>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${st.bg}`}>
                        <span className={`size-1.5 rounded-full ${st.dot}`} />
                        {st.label}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Badge variant="secondary" className="text-[10px]">{modelLabel(p.model)}</Badge>
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {formatTimeAgo(p.updated_at)}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-1 text-[10px] font-medium text-indigo-400 opacity-0 transition-opacity group-hover:opacity-100">
                      Open <ArrowRight className="size-3" />
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
