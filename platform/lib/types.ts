export interface Pipeline {
  id: string
  user_id: string
  name: string
  description: string | null
  model: string
  voice: string
  system_prompt: string
  vad_sensitivity: 'low' | 'medium' | 'high'
  silence_duration_ms: number
  allow_interruptions?: boolean
  status: 'draft' | 'active' | 'deployed'
  created_at: string
  updated_at: string
}

export interface DataSource {
  id: string
  pipeline_id: string
  type: 'file' | 'api' | 'database'
  name: string
  config: Record<string, unknown>
  extracted_context: string | null
  created_at: string
}

export interface Deployment {
  id: string
  pipeline_id: string
  slug: string
  embed_enabled: boolean
  phone_number: string | null
  status: 'live' | 'paused'
  created_at: string
}

export interface WizardState {
  name: string
  description: string
  model: string
  voice: string
  system_prompt: string
  vad_sensitivity: 'low' | 'medium' | 'high'
  silence_duration_ms: number
  allow_interruptions: boolean
  data_sources: DataSourceDraft[]
}

export interface DataSourceDraft {
  type: 'file' | 'api' | 'database'
  name: string
  config: Record<string, unknown>
  extracted_context: string
}

export const MODELS = [
  {
    id: 'gemini-2.5-flash-native-audio',
    name: 'Gemini Native Audio',
    provider: 'Google',
    description: 'End-to-end audio LM — no STT/TTS chain',
    latency: '<500ms',
    icon: '✦',
  },
  {
    id: 'gpt-4o-realtime',
    name: 'GPT-4o Realtime',
    provider: 'OpenAI',
    description: 'Multimodal realtime with voice',
    latency: '<800ms',
    icon: '◈',
  },
  {
    id: 'custom',
    name: 'Custom Endpoint',
    provider: 'Self-hosted',
    description: 'Bring your own audio model API',
    latency: 'Variable',
    icon: '⬡',
  },
] as const

export const VOICES = [
  { id: 'Puck', name: 'Puck', tag: 'Friendly' },
  { id: 'Kore', name: 'Kore', tag: 'Professional' },
  { id: 'Charon', name: 'Charon', tag: 'Deep' },
  { id: 'Aoede', name: 'Aoede', tag: 'Warm' },
] as const

export const PROMPT_PRESETS = [
  {
    id: 'sales',
    name: 'Sales Agent',
    prompt: `You are a warm, persuasive sales agent. Build rapport quickly, identify needs through natural conversation, and guide toward solutions. Use conversational language, mirror the caller's energy, and close with clear next steps. Never be pushy — be genuinely helpful.`,
  },
  {
    id: 'support',
    name: 'Support Agent',
    prompt: `You are a patient, empathetic support agent. Listen carefully, acknowledge frustration, and resolve issues step by step. Use clear, simple language. Always confirm the resolution before ending. If you can't resolve something, escalate gracefully.`,
  },
  {
    id: 'custom',
    name: 'Custom',
    prompt: '',
  },
] as const
