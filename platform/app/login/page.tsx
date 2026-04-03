"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Auth } from "@supabase/auth-ui-react"
import { ThemeSupa, merge } from "@supabase/auth-ui-shared"
import { Waves } from "lucide-react"

import { supabase } from "@/lib/supabase"

const authTheme = merge(ThemeSupa, {
  default: {
    colors: {
      brand: "#6366f1",
      brandAccent: "#7c3aed",
      brandButtonText: "white",
      inputBorder: "#e4e2f0",
      inputBorderFocus: "#6366f1",
      inputBorderHover: "#818cf8",
      anchorTextColor: "#6366f1",
      anchorTextHoverColor: "#7c3aed",
    },
  },
  dark: {
    colors: {
      brand: "#818cf8",
      brandAccent: "#a78bfa",
      brandButtonText: "white",
      inputBackground: "rgba(12, 12, 36, 0.8)",
      inputBorder: "rgba(99, 102, 241, 0.2)",
      inputBorderFocus: "#818cf8",
      inputBorderHover: "rgba(129, 140, 248, 0.4)",
      defaultButtonBackground: "rgba(17, 17, 50, 0.8)",
      defaultButtonBackgroundHover: "rgba(26, 26, 74, 0.8)",
      defaultButtonBorder: "rgba(99, 102, 241, 0.15)",
      dividerBackground: "rgba(99, 102, 241, 0.1)",
      anchorTextColor: "#818cf8",
      anchorTextHoverColor: "#a78bfa",
    },
  },
})

function useSystemDark() {
  const [isDark, setIsDark] = useState(false)
  useEffect(() => {
    const root = document.documentElement
    const sync = () => {
      setIsDark(root.classList.contains("dark") || window.matchMedia("(prefers-color-scheme: dark)").matches)
    }
    sync()
    const mo = new MutationObserver(sync)
    mo.observe(root, { attributes: true, attributeFilter: ["class"] })
    const mql = window.matchMedia("(prefers-color-scheme: dark)")
    mql.addEventListener("change", sync)
    return () => { mo.disconnect(); mql.removeEventListener("change", sync) }
  }, [])
  return isDark
}

export default function LoginPage() {
  const router = useRouter()
  const isDark = useSystemDark()
  const [origin, setOrigin] = useState("")

  useEffect(() => { setOrigin(window.location.origin) }, [])
  const redirectTo = useMemo(() => (origin ? `${origin}/dashboard` : undefined), [origin])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) router.push("/dashboard")
    })
    return () => subscription.unsubscribe()
  }, [router])

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push("/dashboard")
    })
  }, [router])

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 bg-[#060611]" />
      <div className="pointer-events-none absolute top-[-10%] left-[15%] h-[400px] w-[400px] rounded-full bg-indigo-600/[0.08] blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-5%] right-[10%] h-[500px] w-[500px] rounded-full bg-violet-600/[0.06] blur-[140px]" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      <div className="relative z-10 w-full max-w-sm">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 shadow-lg shadow-indigo-500/25">
            <Waves className="size-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">
            <span className="bg-gradient-to-r from-indigo-300 to-violet-300 bg-clip-text text-transparent">
              VoiceFlow.ai
            </span>
          </h1>
          <p className="mt-1 text-xs text-[#6b6896]">Sign in to build voice pipelines</p>
        </div>

        {/* Auth card */}
        <div className="rounded-2xl border border-indigo-500/10 bg-[#0c0c24]/80 p-6 shadow-2xl shadow-indigo-950/30 backdrop-blur-xl">
          <div className="[&_.supabase-auth-ui_ui-container]:shadow-none">
            <Auth
              supabaseClient={supabase}
              appearance={{ theme: authTheme }}
              theme={isDark ? "dark" : "default"}
              providers={["github", "google"]}
              redirectTo={redirectTo}
              showLinks
            />
          </div>
        </div>

        <p className="mt-4 text-center text-[10px] text-[#6b6896]">
          Audio pipeline platform powered by native ALMs
        </p>
      </div>
    </div>
  )
}
