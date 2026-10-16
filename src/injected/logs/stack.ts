/**
 * Stack trace helpers: who produced an error (page vs Vue Inspector) and a compact stack.
 *
 * Vue Inspector's page scripts (injected.js, and content.js in Bookmark mode) are loaded from one
 * base URL; frames under it are internal. Frames of browser extensions are not the page either.
 */

export interface StackFrame {
  line: string
  url: string
  lineno: number
  colno: number
}

export interface CompactStack {
  stack: string
  /** Set when frames were cut: total count, how many were kept, and which ends */
  stackTruncated?: { frames: number; kept: number; head: number; tail: number }
}

const HEAD_FRAMES = 5
const TAIL_FRAMES = 5
const MAX_LINE_CHARS = 300
const MAX_HEADER_CHARS = 1000
const FRAME_RE = /^\s*(?:at\s+)?(?:.*?[@(])?((?:[a-z][a-z0-9+.-]*:)+\/*[^\s()]*?):(\d+):(\d+)\)?\s*$/i
const EXTENSION_RE = /^(?:chrome|moz|safari-web|ms-browser)-extension:/i

/** Base URL of this script (`.../js/injected.js` → `.../`); evaluated while the script runs */
const OWN_BASE: string = (() => {
  let src = ''
  try {
    src = (document.currentScript as HTMLScriptElement | null)?.src ?? ''
  } catch { /* no DOM */ }
  if (!src) src = parseFrames(new Error().stack ?? '')[0]?.url ?? ''
  if (!src) return ''
  const js = src.lastIndexOf('/js/')
  return js !== -1 ? src.slice(0, js + 1) : src.slice(0, src.lastIndexOf('/') + 1)
})()

/** Drops the first `count` stack frames (the message lines stay) */
export function skipStackFrames(stack: string, count: number): string {
  if (count <= 0) return stack
  let left = count
  return stack.split('\n').filter(line => {
    if (left > 0 && (FRAME_RE.test(line) || /^\s*at\s/.test(line))) {
      left--
      return false
    }
    return true
  }).join('\n')
}

export function parseFrames(stack: string): StackFrame[] {
  const out: StackFrame[] = []
  for (const line of stack.split('\n')) {
    const m = FRAME_RE.exec(line)
    if (m) out.push({ line: line.trim(), url: m[1], lineno: Number(m[2]), colno: Number(m[3]) })
  }
  return out
}

export function isInspectorUrl(url: string): boolean {
  return !!OWN_BASE && url.startsWith(OWN_BASE)
}

/** Code that is not the inspected page: Vue Inspector or another browser extension */
export function isForeignUrl(url: string): boolean {
  return isInspectorUrl(url) || EXTENSION_RE.test(url)
}

function clipLine(line: string): string {
  return line.length > MAX_LINE_CHARS ? `${line.slice(0, MAX_LINE_CHARS)}…` : line
}

/**
 * Keeps the message lines and both ends of the stack (first 5 and last 5 frames).
 * The middle is cut; the cut is stated between the kept frames and in `stackTruncated`.
 */
export function compactStack(stack: string, options: { dropLeadingInspector?: boolean; header?: boolean } = {}): CompactStack {
  const lines = stack.split('\n')
  const header: string[] = []
  const frames: string[] = []
  for (const line of lines) {
    if (FRAME_RE.test(line) || /^\s*at\s/.test(line)) frames.push(line.trim())
    else if (frames.length === 0 && line.trim() && options.header !== false) header.push(line)
  }
  let start = 0
  if (options.dropLeadingInspector) {
    while (start < frames.length && isInspectorUrl(FRAME_RE.exec(frames[start])?.[1] ?? '')) start++
  }
  const relevant = frames.slice(start)
  const limit = HEAD_FRAMES + TAIL_FRAMES
  const omitted = relevant.length > limit ? relevant.length - limit : 0
  const body = omitted > 0
    ? [
        ...relevant.slice(0, HEAD_FRAMES).map(l => `    ${clipLine(l)}`),
        `    … ${omitted} more frame${omitted === 1 ? '' : 's'} (stack truncated)`,
        ...relevant.slice(-TAIL_FRAMES).map(l => `    ${clipLine(l)}`),
      ]
    : relevant.map(l => `    ${clipLine(l)}`)
  let head = header.join('\n')
  if (head.length > MAX_HEADER_CHARS) head = `${head.slice(0, MAX_HEADER_CHARS)}…`
  const result: CompactStack = { stack: [head, ...body].filter(Boolean).join('\n') }
  if (omitted > 0) {
    result.stackTruncated = { frames: relevant.length, kept: limit, head: HEAD_FRAMES, tail: TAIL_FRAMES }
  }
  return result
}
