/**
 * Compact Markdown digest of a logs report for an AI assistant: a built-in guide, a summary,
 * the problems with their evidence and a one-line-per-event timeline. Bulky data (bodies,
 * store states) is left in the report; the guide tells the assistant to ask for it by event id.
 *
 * Reads the report payload, so the AI tab and the HTML report ("Brief for AI") produce
 * the same text. `buildAiDigest` must stay self-contained
 * (no references outside its body, ASCII only): the HTML report embeds its source text.
 */

import type { LogsRuntime } from '@/injected/logs/runtime'
import type { LogsReportPayload } from './template'

export interface AiDigestOptions {
  maxTimeline?: number
  /** Whole digest budget: problems beyond it are listed in one line each, the timeline is cut */
  maxChars?: number
  /** Request/response body size in Problems */
  bodyChars?: number
  /** For the built-in assistant: its system prompt explains the digest, so the guide is left out */
  noGuide?: boolean
}

export function buildAiDigest(payload: LogsReportPayload, rt: LogsRuntime, options?: AiDigestOptions): string {
  const MAX_TIMELINE = options && options.maxTimeline ? options.maxTimeline : 1500
  const MAX_CHARS = options && options.maxChars ? options.maxChars : Infinity
  const CONTEXT = 6
  const LINE_CHARS = 220
  const BODY_CHARS = options && options.bodyChars ? options.bodyChars : 2000
  const STACK_LINES = MAX_CHARS === Infinity ? 12 : 6
  const BRIEF_PROBLEMS = 15
  const SLOWEST = 5

  const hasOwn = (obj: unknown, key: string) => !!obj && Object.prototype.hasOwnProperty.call(obj, key)
  const isObject = (v: unknown): v is Record<string, any> => v !== null && typeof v === 'object'

  const info: Record<string, any> = isObject(payload.info) ? payload.info : {}
  const kindLabels: Record<string, string> = {}
  const kinds = isObject(info.kinds) ? info.kinds : {}
  for (const k of Object.keys(kinds)) if (kinds[k] && kinds[k].label) kindLabels[k] = kinds[k].label

  rt.loadSnapshots(payload.snapshots)
  const network: Record<string, any> = isObject(payload.network) ? payload.network : {}
  const entryCache: Record<string, any> = {}
  const getEntry = (id: string) => {
    if (id == null || !hasOwn(network.entries, id)) return undefined
    if (!hasOwn(entryCache, id)) {
      const stored = network.entries[id]
      entryCache[id] = isObject(stored)
        ? rt.resolveEntry({ id, ...stored }, ref => (hasOwn(network.bodies, ref) ? network.bodies[ref] : undefined))
        : undefined
    }
    return entryCache[id]
  }

  const events = (Array.isArray(payload.events) ? payload.events : [])
    .filter(isObject)
    .map(raw => {
      const data = rt.resolveValue(raw.data)
      return {
        id: String(raw.id),
        kind: String(raw.kind || 'other'),
        timestamp: Number(raw.timestamp) || 0,
        key: String(raw.key || ''),
        level: String(raw.level || 'info'),
        data: isObject(data) ? data : {},
      }
    })
  const ctx = { stores: rt.indexStores(events), getEntry }

  // ------------------------------------------------------------ text helpers

  const oneLine = (s: unknown, max = LINE_CHARS) => {
    const text = String(s == null ? '' : s).replace(/\s+/g, ' ').trim()
    return text.length > max ? `${text.slice(0, max)}... [${text.length - max} chars cut]` : text
  }
  const cut = (s: string, max: number) => (s.length > max ? `${s.slice(0, max)}\n... [${s.length - max} chars cut]` : s)
  const json = (v: unknown) => {
    try {
      const s = JSON.stringify(v)
      return s === undefined ? String(v) : s
    } catch {
      return String(v)
    }
  }
  const compactBody = (text: string) => {
    const t = text.trim()
    if (t[0] === '{' || t[0] === '[') {
      try {
        return JSON.stringify(JSON.parse(t))
      } catch { /* not JSON: keep as is */ }
    }
    return t
  }
  const fence = (text: string) => {
    let ticks = '```'
    while (text.includes(ticks)) ticks += '`'
    return `${ticks}\n${text}\n${ticks}`
  }
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  const clock = (ts: number) => {
    const d = new Date(ts)
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
  }
  const rel = (ms: number) => (ms < 1000 ? `+${Math.round(ms)}ms` : `+${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)}s`)
  const bytes = (b: unknown) => {
    const n = Number(b) || 0
    return n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`
  }

  // ------------------------------------------------------------ classification

  const isWs = (kind: string) => kind === 'ws' || kind === 'ws-sent' || kind === 'ws-received' || kind === 'ws-closed'
  const cleanClose = (code: unknown) => code == null || code === 1000 || code === 1001 || code === 1005
  const failedEntry = (e: (typeof events)[number]) => {
    if (e.kind !== 'response' && e.kind !== 'ws-closed') return null
    const entry = getEntry(e.data.entryId)
    if (!entry) return null
    if (entry.websocket) {
      return entry.error || entry.websocket.reconnect === false || !cleanClose(entry.websocket.closeCode) ? entry : null
    }
    return entry.error || Number(entry.status) >= 400 ? entry : null
  }

  const t0 = events.length ? events[0].timestamp : 0
  const rows = events.map((e, index) => {
    let title = e.key
    let subtitle = ''
    try {
      const d = rt.describe(e, ctx)
      title = d.title
      subtitle = d.subtitle == null ? '' : String(d.subtitle)
    } catch { /* keep the key */ }
    const entry = failedEntry(e)
    return {
      e,
      index,
      label: rt.eventLabel(e, kindLabels),
      title,
      subtitle,
      failedEntry: entry,
      problem: e.level === 'error' || !!entry,
    }
  })

  // ------------------------------------------------------------ summary

  const out: string[] = []
  const counts: Record<string, number> = {}
  for (const r of rows) counts[r.label] = (counts[r.label] || 0) + 1
  const errors = rows.filter(r => r.e.level === 'error').length
  const failedHttp = rows.filter(r => r.failedEntry && !r.failedEntry.websocket).length
  const failedWs = rows.filter(r => r.failedEntry && r.failedEntry.websocket).length
  const span = events.length ? events[events.length - 1].timestamp - t0 : 0

  out.push('# Vue Inspector logs - AI digest')
  out.push('')
  if (!(options && options.noGuide)) {
    out.push('## How to read this file')
    out.push('')
    out.push('You are helping to debug a Vue web application. This is a compact digest of events captured in the browser by Vue Inspector (network requests, WebSocket, component props and emits, Pinia store changes and actions, navigation, errors).')
    out.push('')
    out.push('- Work top-down: **Summary** -> **Problems** -> **Timeline**. Do not try to reconstruct everything; start from the problems.')
    out.push('- Every event has an id `#N` (its position in the report). The same event is opened in the HTML report by the URL hash `#all/N`.')
    out.push('- **Problems** groups identical failures (same kind, title and status/message) and shows the evidence once: status, error, stack, a cut response body, WebSocket close code. `Also:` lists the other ids of the group.')
    out.push(`- For the cause of a problem, read the **Timeline** around its id (\`Context\` gives the range): the request before an error, the store changes and navigation after a response.`)
    out.push('- Timeline line: `#N +time KIND title | details`. Time is relative to the first event. Store and props lines show what changed (`key: before -> after`). Repeated identical lines are folded as `(xN)`.')
    out.push('- Text marked `[... chars cut]` was shortened for this digest. `[MASKED]` values were hidden at capture and are not available anywhere.')
    out.push('- Full bodies, headers and store states are in the HTML report and its "RAW JSON" file. If something you need is missing here, ask the user for specific events by id (for example "the response body of #42") instead of the whole file.')
    out.push('- Answer with: what went wrong, the most likely cause, the evidence (event ids), and how to reproduce or fix it.')
    out.push('')
  }
  out.push('## Summary')
  out.push('')
  if (info.generator || info.name) out.push(`- Source: ${oneLine(info.generator || info.name)}`)
  if (info.exportedAt) out.push(`- Exported: ${oneLine(info.exportedAt)}`)
  if (events.length) out.push(`- Captured: ${new Date(t0).toISOString()} .. ${new Date(t0 + span).toISOString()} (${rel(span).slice(1)})`)
  out.push(`- Events: ${events.length}${Object.keys(counts).length ? ` (${Object.keys(counts).sort((a, b) => counts[b] - counts[a]).map(k => `${k} ${counts[k]}`).join(', ')})` : ''}`)
  out.push(`- Errors: ${errors}; failed requests: ${failedHttp}; failed WebSocket connections: ${failedWs}`)

  const timed = rows
    .filter(r => r.e.kind === 'response')
    .map(r => ({ r, entry: getEntry(r.e.data.entryId) }))
    .filter(x => x.entry && !x.entry.websocket && Number(x.entry.duration) > 0)
    .sort((a, b) => Number(b.entry.duration) - Number(a.entry.duration))
    .slice(0, SLOWEST)
  if (timed.length) {
    out.push(`- Slowest requests: ${timed.map(x => `#${x.r.index} ${oneLine(x.r.title, 80)} ${Math.round(Number(x.entry.duration))}ms`).join('; ')}`)
  }

  // ------------------------------------------------------------ problems

  const groups: Array<{ sig: string; rows: typeof rows }> = []
  const bySig: Record<string, (typeof groups)[number]> = {}
  for (const r of rows) {
    if (!r.problem) continue
    const status = r.failedEntry ? (r.failedEntry.websocket ? r.failedEntry.websocket.closeCode : r.failedEntry.status) : ''
    const sig = `${r.e.kind}|${r.title}|${status}|${r.failedEntry ? r.failedEntry.error || '' : r.subtitle}`
    if (!bySig[sig]) {
      bySig[sig] = { sig, rows: [] }
      groups.push(bySig[sig])
    }
    bySig[sig].rows.push(r)
  }

  const bodyBlock = (name: string, body: any, lines: string[]) => {
    if (!isObject(body)) return
    if (body.isBinary || body.media) {
      lines.push(`- ${name}: binary${body.media && body.media.format ? ` (${body.media.format})` : ''}, ${bytes(body.originalSize)}`)
      return
    }
    if (typeof body.text !== 'string' || !body.text) return
    // Older exports flagged complete non-ASCII bodies (characters vs Content-Length bytes)
    const cutAtCapture = body.truncated && new TextEncoder().encode(body.text).length !== body.originalSize
    const note = cutAtCapture ? ` (cut at capture, ${bytes(body.originalSize)} originally)` : ''
    lines.push(`- ${name}${note}:`)
    lines.push(fence(cut(compactBody(body.text), BODY_CHARS)))
  }

  const stackBlock = (stack: unknown, lines: string[]) => {
    if (typeof stack !== 'string' || !stack.trim()) return
    const all = stack.trim().split('\n')
    const kept = all.slice(0, STACK_LINES).join('\n')
    lines.push('- Stack:')
    lines.push(fence(all.length > STACK_LINES ? `${kept}\n... [${all.length - STACK_LINES} lines cut]` : kept))
  }

  const evidence = (r: (typeof rows)[number]): string[] => {
    const lines: string[] = []
    const d = r.e.data
    const entry = r.failedEntry || (d.entryId != null ? getEntry(d.entryId) : undefined)
    if (entry) {
      lines.push(`- ${[entry.method, oneLine(entry.url, 400)].filter(Boolean).join(' ')}`)
      if (entry.websocket) {
        const ws = entry.websocket
        lines.push(`- WebSocket: state ${ws.state || '?'}, close code ${ws.closeCode == null ? 'none' : ws.closeCode}${ws.closeReason ? `, reason "${oneLine(ws.closeReason)}"` : ''}${ws.reconnect === false ? ', no automatic reconnect' : ''}`)
        const frames = Array.isArray(ws.frames) ? ws.frames : []
        if (frames.length) {
          lines.push(`- Last frames (${Math.min(3, frames.length)} of ${frames.length}):`)
          for (const f of frames.slice(-3)) lines.push(`  - ${f.direction || '?'}: ${oneLine(f.data, 300)}`)
        }
      } else {
        lines.push(`- Status: ${entry.status || 0} ${entry.statusText || ''}`.trimEnd() + (entry.duration ? `, ${Math.round(Number(entry.duration))}ms` : ''))
      }
      if (entry.error) lines.push(`- Error: ${oneLine(entry.error, 600)}`)
      bodyBlock('Request body', entry.requestBody, lines)
      bodyBlock('Response body', entry.responseBody, lines)
      return lines
    }
    if (r.e.kind === 'action') {
      const err = isObject(d.error) ? d.error : {}
      if (err.message || r.subtitle) lines.push(`- Error: ${oneLine(err.message || r.subtitle, 600)}`)
      if (d.args !== undefined) lines.push(`- Arguments: ${oneLine(json(d.args), 400)}`)
      stackBlock(err.stack, lines)
      return lines
    }
    const message = d.message ?? r.e.key
    lines.push(`- Message: ${oneLine(message, 600)}`)
    // The first stack frame already has them
    const inStack = MAX_CHARS !== Infinity && typeof d.stack === 'string' && d.stack.trim()
      ? ['name', 'filename', 'lineno', 'colno', 'stackTruncated']
      : []
    for (const k of Object.keys(d)) {
      if (k === 'message' || k === 'stack' || k.startsWith('__') || inStack.includes(k)) continue
      const v = d[k]
      if (v == null || v === '') continue
      lines.push(`- ${k}: ${oneLine(isObject(v) ? json(v) : v, 300)}`)
    }
    if (typeof d.stack === 'string' && d.stack.trim()) stackBlock(d.stack, lines)
    else if (r.e.kind === 'error') lines.push('- Stack: none, the browser reported no stack for this error (the data above is all there is)')
    return lines
  }

  const lastPage = (index: number) => {
    for (let i = index - 1; i >= 0; i--) if (rows[i].e.kind === 'navigation') return rows[i]
  }
  const dataLater = (first: (typeof rows)[number]) => {
    if (!/null|undefined|TypeError/i.test(first.title)) return ''
    const laterStore: string[] = []
    const laterAction: string[] = []
    for (let i = first.index + 1; i < rows.length && i <= first.index + 40; i++) {
      const r = rows[i]
      const sub = r.subtitle || ''
      if (r.e.kind === 'store' && sub.indexOf('.data') !== -1 && laterStore.length < 2) laterStore.push(`#${r.index} ${oneLine(r.label + ' ' + r.title, 70)}`)
      else if (r.e.kind === 'action' && /getByKey|fetch/.test(r.title) && !/null|loading|empty/.test(sub) && laterAction.length < 1) laterAction.push(`#${r.index} ${oneLine(r.label + ' ' + r.title, 70)}`)
    }
    return laterStore.concat(laterAction).join('; ')
  }
  /** Whether the socket ever worked: a server that never answers means no realtime updates at all */
  const wsHealth = (g: (typeof groups)[number]): string[] => {
    const first = g.rows[0].failedEntry
    if (!first || !first.websocket) return []
    const url = String(first.url || '')
    const seen: Record<string, boolean> = {}
    let opened = 0
    let received = 0
    const channels: string[] = []
    for (const r of rows) {
      if (r.e.kind !== 'ws' && r.e.kind !== 'ws-closed') continue
      const entry = getEntry(r.e.data.entryId)
      if (!entry || !entry.websocket || String(entry.url || '') !== url || seen[entry.id]) continue
      seen[entry.id] = true
      opened++
      const frames = Array.isArray(entry.websocket.frames) ? entry.websocket.frames : []
      for (const f of frames) {
        if (f.direction === 'received') received++
        const text = typeof f.data === 'string' ? f.data : ''
        const re = /"channel"\s*:\s*"([^"]+)"/g
        let m: RegExpExecArray | null
        while ((m = re.exec(text)) && channels.length < 12) if (channels.indexOf(m[1]) === -1) channels.push(m[1])
      }
    }
    const last = g.rows[g.rows.length - 1]
    const lines = [`- Connections to this URL: ${opened} opened, ${g.rows.length} closed with this error, ${received} frames received, failing from ${rel(g.rows[0].e.timestamp - t0)} to ${rel(last.e.timestamp - t0)}`]
    if (!received) lines.push('- The server never delivered a message: realtime updates (pushes, statuses, document readiness) did not arrive during the whole capture')
    if (channels.length) lines.push(`- Subscribed channels: ${channels.join(', ')}`)
    return lines
  }

  out.push('')
  out.push('## Problems')
  out.push('')
  if (!groups.length) out.push('No errors, failed requests or failed WebSocket connections were captured.')
  // Problems take up to half of the budget; the rest of the groups get one line each
  const problemsBudget = MAX_CHARS * 0.5
  let used = out.join('\n').length
  const brief: string[] = []
  groups.forEach((g, i) => {
    const first = g.rows[0]
    const head = first.subtitle ? ` - ${oneLine(first.subtitle, 160)}` : ''
    if (used > problemsBudget) {
      brief.push(`- #${first.index} ${first.label}: ${oneLine(first.title, 100)}${first.subtitle ? ` - ${oneLine(first.subtitle, 80)}` : ''}${g.rows.length > 1 ? ` (${g.rows.length} times)` : ''}`)
      return
    }
    const start = out.length
    out.push(`### ${i + 1}. #${first.index} ${first.label}: ${oneLine(first.title, 160)}${head}`)
    out.push('')
    out.push(`- At: ${clock(first.e.timestamp)} (${rel(first.e.timestamp - t0)})${g.rows.length > 1 ? `, ${g.rows.length} times` : ''}`)
    if (g.rows.length > 1) {
      const ids = g.rows.slice(1).map(r => `#${r.index}`)
      out.push(`- Also: ${ids.slice(0, 30).join(', ')}${ids.length > 30 ? `, ... (${ids.length - 30} more)` : ''}`)
    }
    out.push(`- Context: #${Math.max(0, first.index - CONTEXT)}..#${Math.min(rows.length - 1, first.index + CONTEXT)}`)
    const page = lastPage(first.index)
    if (page) out.push(`- Page: #${page.index} ${oneLine(page.title, 180)} (last navigation before this error)`)
    const later = dataLater(first)
    if (later) out.push(`- Data later: ${later}`)
    for (const line of wsHealth(g)) out.push(line)
    for (const line of evidence(first)) out.push(line)
    out.push('')
    if (MAX_CHARS !== Infinity) used += out.slice(start).join('\n').length + 1
  })
  if (brief.length) {
    out.push(`### Other problems (${brief.length}, details by id)`)
    out.push('')
    for (const line of brief.slice(0, BRIEF_PROBLEMS)) out.push(line)
    if (brief.length > BRIEF_PROBLEMS) out.push(`- ... ${brief.length - BRIEF_PROBLEMS} more`)
    out.push('')
  }

  // ------------------------------------------------------------ timeline

  let shown = rows.map(() => true)
  let note = ''
  if (rows.length > MAX_TIMELINE) {
    shown = rows.map(r => r.e.kind === 'navigation')
    for (const r of rows) {
      if (!r.problem) continue
      for (let i = Math.max(0, r.index - CONTEXT); i <= Math.min(rows.length - 1, r.index + CONTEXT); i++) shown[i] = true
    }
    let budget = MAX_TIMELINE - shown.filter(Boolean).length
    for (let i = 0; i < rows.length && budget > 0; i++) {
      if (!shown[i]) {
        shown[i] = true
        budget--
      }
    }
    note = `Only ${shown.filter(Boolean).length} of ${rows.length} events are listed: navigation, the context of every problem and the earliest events. Gaps are marked with "...".`
  }

  const TIMELINE_LINE = MAX_CHARS === Infinity ? LINE_CHARS : 160
  const timelineText = (r: (typeof rows)[number]) => {
    // Request subtitles repeat the path of the title as a full URL
    const repeats = MAX_CHARS !== Infinity && r.subtitle.includes(r.title.split(' ').pop() || '\n')
    const tail = r.subtitle && !repeats ? ` | ${r.subtitle}` : ''
    return oneLine(`${r.problem ? '!! ' : ''}${r.label} ${r.title}${tail}`, TIMELINE_LINE)
  }
  if (MAX_CHARS !== Infinity) {
    // The nearest events of every problem first (they show what the code read and what came after),
    // then the rest of the lines chosen above
    const order: number[] = []
    for (let d = 0; d <= CONTEXT; d++) {
      for (const g of groups) {
        const at = g.rows[0].index
        order.push(at - d)
        if (d) order.push(at + d)
      }
    }
    rows.forEach((r, i) => { if (shown[i]) order.push(i) })
    const picked = rows.map(() => false)
    let left = MAX_CHARS - out.join('\n').length - 400
    for (const i of order) {
      if (i < 0 || i >= rows.length || picked[i]) continue
      const cost = timelineText(rows[i]).length + 16
      if (cost > left) break
      picked[i] = true
      left -= cost
    }
    shown = picked
    const listed = picked.filter(Boolean).length
    note = listed < rows.length
      ? `Only ${listed} of ${rows.length} events are listed: the nearest events of every problem first, then navigation and the earliest events. Gaps are marked with "...".`
      : ''
  }

  out.push('## Timeline')
  out.push('')
  if (note) {
    out.push(note)
    out.push('')
  }
  out.push('```')
  let prev: string | null = null
  let repeat = 0
  let lastLine = ''
  let lastIndex = 0
  let timelineLeft = MAX_CHARS - out.join('\n').length - 200
  let cutAt = -1
  const flush = () => {
    if (!lastLine) return
    const line = repeat > 1 ? `${lastLine} (x${repeat}, until #${lastIndex})` : lastLine
    timelineLeft -= line.length + 1
    out.push(line)
    lastLine = ''
    repeat = 0
  }
  let skipped = false
  for (const r of rows) {
    if (timelineLeft < 0) {
      cutAt = r.index
      break
    }
    if (!shown[r.index]) {
      skipped = true
      continue
    }
    if (skipped) {
      flush()
      prev = null
      out.push('...')
      skipped = false
    }
    const text = timelineText(r)
    if (text === prev && !r.problem) {
      repeat++
      lastIndex = r.index
      continue
    }
    flush()
    prev = text
    repeat = 1
    lastIndex = r.index
    lastLine = `#${r.index} ${rel(r.e.timestamp - t0)} ${text}`
  }
  flush()
  if (cutAt >= 0) out.push(`... [timeline cut at #${cutAt} of ${rows.length}]`)
  else if (skipped) out.push('...')
  out.push('```')
  out.push('')
  out.push('`!!` marks a problem event (see Problems).')
  out.push('')
  return out.join('\n')
}
