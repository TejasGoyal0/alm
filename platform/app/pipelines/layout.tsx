"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { Navbar } from "@/components/layout/navbar"
import { supabase } from "@/lib/supabase"

export default function PipelinesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [user, setUser] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let cancelled = false

    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (cancelled) return
      if (!u) {
        router.replace("/login")
        return
      }
      setUser(u.email ?? null)
      setChecked(true)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return
      if (!session) {
        router.replace("/login")
        return
      }
      setUser(session.user.email ?? null)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [router])

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        user={user}
        onSignOut={async () => {
          await supabase.auth.signOut()
          router.replace("/login")
        }}
      />
      <main className="pt-14">{children}</main>
    </div>
  )
}
