/**
 * Connections the user adds: OpenAI, DeepSeek, local servers (Ollama, LM Studio) or an own agent
 * behind an OpenAI-compatible `/chat/completions` endpoint. A preset only fills the form.
 */

import type { ContextSize, CustomPreset, CustomProvider, CustomProviderId, ToolSupport } from './types'

export interface CustomPresetInfo {
  label: string
  baseUrl: string
  /** The server rejects requests without a key */
  needsKey: boolean
  /** Runs on the user's machine: models cost nothing and the data stays local */
  local: boolean
  context: ContextSize
  tools: ToolSupport
  keyUrl?: string
  keyConsole?: string
  hint: string
}

export const CUSTOM_PRESETS: Record<CustomPreset, CustomPresetInfo> = {
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    needsKey: true,
    local: false,
    context: 'large',
    tools: 'native',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyConsole: 'OpenAI Platform',
    hint: 'Requests are billed to your OpenAI account.',
  },
  deepseek: {
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    needsKey: true,
    local: false,
    context: 'large',
    tools: 'native',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    keyConsole: 'DeepSeek Platform',
    hint: 'Requests are billed to your DeepSeek balance.',
  },
  ollama: {
    label: 'Ollama',
    baseUrl: 'http://localhost:11434/v1',
    needsKey: false,
    local: true,
    context: 'small',
    tools: 'native',
    hint: 'Start Ollama with OLLAMA_ORIGINS=chrome-extension://* so it accepts requests from the extension. Pick a model with tool support (qwen3, llama3.1 and newer).',
  },
  lmstudio: {
    label: 'LM Studio',
    baseUrl: 'http://localhost:1234/v1',
    needsKey: false,
    local: true,
    context: 'medium',
    tools: 'native',
    hint: 'Start the server in LM Studio → Developer and turn on CORS there.',
  },
  compatible: {
    label: 'OpenAI-compatible',
    baseUrl: '',
    needsKey: false,
    local: false,
    context: 'medium',
    tools: 'native',
    hint: 'Any server or own agent with POST {base URL}/chat/completions in the OpenAI format: vLLM, llama.cpp, LiteLLM, Groq, Mistral, xAI, Together and others.',
  },
}

export const CUSTOM_PRESET_IDS = Object.keys(CUSTOM_PRESETS) as CustomPreset[]

export const CONTEXT_SIZES: ReadonlyArray<{ id: ContextSize; label: string }> = [
  { id: 'small', label: 'Small (8K tokens)' },
  { id: 'medium', label: 'Medium (32K)' },
  { id: 'large', label: 'Large (128K+)' },
]

export const TOOL_SUPPORTS: ReadonlyArray<{ id: ToolSupport; label: string }> = [
  { id: 'native', label: 'Native tool calls' },
  { id: 'text', label: 'Tools as text' },
  { id: 'none', label: 'No tools' },
]

const CONTEXTS = new Set<ContextSize>(CONTEXT_SIZES.map(c => c.id))
const TOOLS = new Set<ToolSupport>(TOOL_SUPPORTS.map(t => t.id))
const HEADER_NAME = /^[!#$%&'*+.^_`|~0-9a-z-]+$/i

export function isCustomProvider(id: string): id is CustomProviderId {
  return id.startsWith('custom:')
}

export function newCustomProviderId(): CustomProviderId {
  return `custom:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/** `https://host/v1/` and `https://host/v1/chat/completions` both become `https://host/v1` */
export function normalizeBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '').replace(/\/chat\/completions$/i, '').replace(/\/+$/, '')
}

export function isValidBaseUrl(raw: string): boolean {
  try {
    const url = new URL(normalizeBaseUrl(raw))
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function baseUrlHost(baseUrl: string): string {
  try {
    return new URL(baseUrl).host
  } catch {
    return baseUrl
  }
}

/** The server is on this machine or in the local network: no traffic leaves it */
export function isLocalUrl(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl).hostname
    return host === 'localhost' || host === '[::1]' || host.endsWith('.local')
      || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  } catch {
    return false
  }
}

/** Keys and other secrets travel in plain text over http to a remote host */
export function isInsecureRemote(baseUrl: string): boolean {
  return baseUrl.startsWith('http:') && !isLocalUrl(baseUrl)
}

/** `Name: value` per line → headers; lines without a valid name are dropped */
export function parseHeaders(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const index = line.indexOf(':')
    if (index <= 0) continue
    const name = line.slice(0, index).trim()
    const value = line.slice(index + 1).trim()
    if (HEADER_NAME.test(name) && value) out[name] = value
  }
  return out
}

export function formatHeaders(headers: Record<string, string>): string {
  return Object.entries(headers).map(([name, value]) => `${name}: ${value}`).join('\n')
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function normalizeHeaders(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, string> = {}
  for (const [name, value] of Object.entries(raw)) {
    if (HEADER_NAME.test(name) && typeof value === 'string' && value) out[name] = value
  }
  return out
}

/** `null` for a record without an id or a usable base URL */
export function normalizeCustomProvider(raw: Partial<CustomProvider> | undefined): CustomProvider | null {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !isCustomProvider(raw.id)) return null
  const baseUrl = normalizeBaseUrl(text(raw.baseUrl))
  if (!isValidBaseUrl(baseUrl)) return null
  const preset = raw.preset && raw.preset in CUSTOM_PRESETS ? raw.preset : 'compatible'
  return {
    id: raw.id,
    preset,
    label: text(raw.label).trim().slice(0, 40) || CUSTOM_PRESETS[preset].label,
    baseUrl,
    apiKey: text(raw.apiKey).trim(),
    headers: normalizeHeaders(raw.headers),
    tools: raw.tools && TOOLS.has(raw.tools) ? raw.tools : CUSTOM_PRESETS[preset].tools,
    stream: raw.stream !== false,
    context: raw.context && CONTEXTS.has(raw.context) ? raw.context : CUSTOM_PRESETS[preset].context,
    consent: raw.consent === true,
  }
}

export function normalizeCustomProviders(raw: unknown): CustomProvider[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: CustomProvider[] = []
  for (const item of raw) {
    const provider = normalizeCustomProvider(item)
    if (!provider || seen.has(provider.id)) continue
    seen.add(provider.id)
    out.push(provider)
  }
  return out
}
