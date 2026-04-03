"use client"

import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"

export default function PipelinePage() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params.id === "string" ? params.id : params.id?.[0]

  useEffect(() => {
    if (id) {
      router.push(`/pipelines/${id}/deploy`)
    }
  }, [id, router])

  return (
    <div className="flex min-h-[40vh] items-center justify-center px-4">
      <p className="text-sm text-muted-foreground">Redirecting…</p>
    </div>
  )
}
