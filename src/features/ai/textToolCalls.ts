/**
 * Tool calls some models write into the text instead of the `tool_calls` field:
 * - `<tool_call>{"name": "x", "arguments": {...}}</tool_call>` (Hermes, Qwen)
 * - `<tool_call>x<arg_key>k</arg_key><arg_value>v</arg_value></tool_call>` (GLM; also `param_key` / `param_value`)
 * - `<function=x><parameter=k>v</parameter></function>` (Qwen3-Coder), also wrapped in `<tool_call>`
 */

export interface TextToolCall {
  name: string
  args: Record<string, unknown>
}

const TOOL_CALL_BLOCK = /<tool_call>([\s\S]*?)(?:<\/tool_call>|$)/g
const FUNCTION_BLOCK = /<function=([\w.-]+)>([\s\S]*?)(?:<\/function>|$)/g
const PARAMETER = /<parameter=([\w.-]+)>([\s\S]*?)(?:<\/parameter>|(?=<parameter=)|$)/g
const KEY_VALUE = /<(arg|param)_key>([\s\S]*?)<\/\1_key>\s*<\1_value>([\s\S]*?)(?:<\/\1_value>|$)/g
const STRAY_TAGS = /<\/?tool_call>|<\/function>/g

function value(raw: string): unknown {
  const text = raw.trim()
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function fromFunction(name: string, body: string): TextToolCall {
  const args: Record<string, unknown> = {}
  for (const [, key, raw] of body.matchAll(PARAMETER)) args[key] = value(raw)
  return { name, args }
}

function fromBlock(body: string): TextToolCall | null {
  const fn = new RegExp(FUNCTION_BLOCK.source).exec(body)
  if (fn) return fromFunction(fn[1], fn[2])
  const text = body.trim()
  if (text.startsWith('{')) {
    const parsed = value(text) as any
    if (!parsed || typeof parsed.name !== 'string') return null
    const args = typeof parsed.arguments === 'string' ? value(parsed.arguments) : parsed.arguments ?? parsed.parameters
    return { name: parsed.name, args: args && typeof args === 'object' ? args : {} }
  }
  const name = text.split('<', 1)[0].trim()
  if (!name) return null
  const args: Record<string, unknown> = {}
  for (const [, , key, raw] of body.matchAll(KEY_VALUE)) args[key.trim()] = value(raw)
  return { name, args }
}

/** Calls of known tools found in the text, and the text without any call markup */
export function extractTextToolCalls(content: string, known: Set<string>): { calls: TextToolCall[]; text: string } {
  if (!content.includes('<tool_call>') && !content.includes('<function=')) return { calls: [], text: content }
  const calls: TextToolCall[] = []
  let text = content.replace(TOOL_CALL_BLOCK, (_, body: string) => {
    const call = fromBlock(body)
    if (call && known.has(call.name)) calls.push(call)
    return ''
  })
  text = text.replace(FUNCTION_BLOCK, (_, name: string, body: string) => {
    if (known.has(name)) calls.push(fromFunction(name, body))
    return ''
  })
  return { calls, text: text.replace(STRAY_TAGS, '').trim() }
}
