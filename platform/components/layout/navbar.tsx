"use client"

import * as React from "react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { LogOut, Moon, Sun, Waves } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export type NavbarProps = {
  user: string | null
  onSignOut?: () => void | Promise<void>
  className?: string
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => { setMounted(true) }, [])

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-foreground"
      aria-label="Toggle theme"
    >
      {!mounted ? <span className="size-4" /> : resolvedTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  )
}

function userInitial(email: string) {
  return (email.split("@")[0]?.[0] ?? "?").toUpperCase()
}

export function Navbar({ user, onSignOut, className }: NavbarProps) {
  return (
    <header
      className={cn(
        "fixed top-0 right-0 left-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl",
        className,
      )}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-foreground transition hover:opacity-90">
          <div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500">
            <Waves className="size-3.5 text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight">
            VoiceFlow<span className="text-muted-foreground">.ai</span>
          </span>
        </Link>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex size-8 shrink-0 items-center justify-center rounded-full transition hover:ring-2 hover:ring-indigo-500/30"
                aria-label="Account menu"
              >
                <Avatar className="size-7">
                  <AvatarFallback className="bg-indigo-500/15 text-xs font-medium text-indigo-400">
                    {userInitial(user)}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                <DropdownMenuLabel className="font-normal">
                  <p className="text-[10px] text-muted-foreground">Signed in as</p>
                  <p className="truncate text-xs">{user}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2 text-destructive"
                  onClick={() => void onSignOut?.()}
                >
                  <LogOut className="size-3.5" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              href="/login"
              className="ml-1 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground ring-1 ring-border transition hover:bg-accent hover:text-foreground"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
