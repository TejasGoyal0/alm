'use client'

import Link from 'next/link'
import { Mic, Zap, Brain, Globe, ArrowRight, Shield, Clock, Waves } from 'lucide-react'
import { motion } from 'framer-motion'

const features = [
  { icon: Zap, title: 'Sub-500ms Latency', desc: 'Native audio LM — no STT/TTS chain. Audio in, audio out.' },
  { icon: Brain, title: 'Context Retention', desc: 'Remembers everything said across the entire call.' },
  { icon: Mic, title: 'Tone & Emotion', desc: 'Detects frustration, excitement, hesitation from audio.' },
  { icon: Globe, title: '32 Languages', desc: 'Code-switches mid-call if the caller does.' },
  { icon: Shield, title: 'Your Data, Your Rules', desc: 'Plug files, APIs, databases. Self-hosted or cloud.' },
  { icon: Clock, title: 'Deploy in Minutes', desc: 'One wizard. From zero to a live voice agent.' },
]

const fadeUp = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0 } }

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#060611] text-[#e2e0f0] overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-[-10%] left-[20%] h-[500px] w-[500px] rounded-full bg-indigo-600/[0.07] blur-[120px]" />
        <div className="absolute bottom-[-5%] right-[15%] h-[600px] w-[600px] rounded-full bg-violet-600/[0.06] blur-[140px]" />
        <div className="absolute top-[40%] right-[30%] h-[300px] w-[300px] rounded-full bg-cyan-500/[0.04] blur-[100px]" />
      </div>

      {/* Grid pattern */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: 'linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      {/* Nav */}
      <nav className="relative z-10 border-b border-white/[0.06]">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500">
              <Waves className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold tracking-tight">VoiceFlow<span className="text-indigo-400/60">.ai</span></span>
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-4 py-1.5 text-xs font-medium text-indigo-200 ring-1 ring-white/[0.08] backdrop-blur transition hover:bg-white/[0.1] hover:ring-indigo-500/30"
          >
            Sign In
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 px-5 pt-28 pb-24 sm:pt-36 sm:pb-32">
        <motion.div
          className="mx-auto max-w-3xl text-center"
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.08 } } }}
        >
          <motion.div
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/[0.06] px-3.5 py-1 text-[11px] font-medium text-indigo-300"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Native Audio Language Model Platform
          </motion.div>

          <motion.h1
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="text-[2.5rem] font-black leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl"
          >
            Build voice agents
            <br />
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
              that sound human
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="mx-auto mt-5 max-w-lg text-sm leading-relaxed text-[#8885a8] sm:text-base"
          >
            Plug your data. Pick a voice. Test live. Deploy.
            One platform for end-to-end audio pipelines — powered by native ALMs.
          </motion.p>

          <motion.div variants={fadeUp} transition={{ duration: 0.5 }} className="mt-8 flex justify-center gap-3">
            <Link
              href="/login"
              className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-xl hover:shadow-indigo-500/30"
            >
              Start Building
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </motion.div>

          {/* Decorative ALM callout */}
          <motion.div
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="mx-auto mt-14 flex max-w-md items-center gap-3 rounded-xl border border-indigo-500/15 bg-indigo-500/[0.04] p-4 text-left backdrop-blur"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10">
              <Waves className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-indigo-200">Native Audio Language Model</p>
              <p className="text-[11px] text-[#6b6896]">No STT → LLM → TTS pipeline. Audio in, audio out, end-to-end.</p>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="relative z-10 border-t border-white/[0.04] px-5 py-24">
        <div className="mx-auto max-w-4xl">
          <div className="mb-14 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-400/80">Capabilities</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Everything you need to ship voice</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.05 }}
                className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all hover:border-indigo-500/20 hover:bg-indigo-500/[0.03]"
              >
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 transition-colors group-hover:bg-indigo-500/15">
                  <f.icon className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold">{f.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-[#6b6896]">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-5 py-24">
        <div className="mx-auto max-w-lg text-center">
          <div className="rounded-2xl border border-indigo-500/15 bg-gradient-to-b from-indigo-500/[0.04] to-transparent p-12">
            <div className="absolute -top-20 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-indigo-500/10 blur-[60px]" />
            <h2 className="text-2xl font-bold sm:text-3xl">Ready to build?</h2>
            <p className="mt-2 text-sm text-[#6b6896]">Deploy voice agents in minutes, not months.</p>
            <Link
              href="/login"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-xl hover:shadow-indigo-500/30"
            >
              Get Started Free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.04] py-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-gradient-to-br from-indigo-500 to-violet-500">
              <Waves className="h-3 w-3 text-white" />
            </div>
            <span className="text-[11px] text-[#6b6896]">&copy; 2026 VoiceFlow.ai</span>
          </div>
          <a
            href="https://www.linkedin.com/in/tejas-goyal-862017246/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#6b6896] transition hover:text-indigo-400"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
          </a>
        </div>
      </footer>
    </div>
  )
}
