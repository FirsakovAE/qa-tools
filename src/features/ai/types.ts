export type AiProviderId = 'openrouter' | 'gemini' | 'groq'

export interface AiModel {
  id: string
  name: string
  contextLength?: number
  recommended?: boolean
  /** Provider status says the model works but fails often lately */
  unstable?: boolean
}

/** OpenAI-compatible chat message (both providers speak this format) */
export interface ChatToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
  [extra: string]: unknown
}

export type ChatMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ChatToolCall[] }
  | { role: 'tool'; tool_call_id: string; name: string; content: string }

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

/** One visible step of an answer: a tool the assistant called, or its reasoning (`summary` holds the text) */
export interface AiStep {
  tool: string
  summary: string
  thought?: boolean
  /** The user declined the call or the tool is turned off */
  declined?: boolean
}

/** Tokens as the provider reported them; zero when it did not */
export interface AiTokens {
  prompt: number
  completion: number
  /** Prompt tokens served from the provider cache */
  cached: number
}

/** Cost of one answer: all completions of the question */
export interface AiUsage extends AiTokens {
  requests: number
  /** Completions that came without token counts */
  unreported: number
  ms: number
}

export interface AiChatEntry {
  id: string
  role: 'user' | 'assistant'
  text: string
  steps?: AiStep[]
  error?: boolean
  /** Provider's own error text */
  errorDetails?: string
  /** The error is about the hand-picked model: Auto mode may answer */
  suggestAuto?: boolean
  model?: string
  usage?: AiUsage
  /** Logs event ids of the `#N` the answer names */
  events?: Record<number, string>
}
