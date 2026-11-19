/**
 * Attached text files for the model: a short overview goes with the question, the content is
 * read with tools. search_file finds lines (JSON: `path = value`) and ranks ~800-token passages
 * with 50% overlap for several words; read_file pages lines or chars; query_json reads JSON / HAR
 * values by path and lists, filters and counts array items.
 */

import { aiCredentials } from './credentials'
import { providerBudget } from './providers'
import {
  chatFiles,
  fileJson,
  formatLabel,
  getTextFile,
  lineAt,
  lineCount,
  lineText,
  lowerText,
  sizeLabel,
  tokenEstimate,
  type AiTextFile,
} from './textFiles'
import type { AiStep, ToolDefinition } from './types'

/** Lines longer than this are read and searched by char position */
const LONG_LINE = 1000
const LINE_CHARS = 300
const MATCH_WINDOW = 150
const READ_CHARS = 8000
const READ_LINES = 300
const MAX_COUNT = 20_000
/** ≈800 tokens per passage, every passage overlaps the next by half */
const PASSAGE_CHARS = 3200
const PASSAGE_STEP = 1600
const PASSAGES = 3
const ITEM_CHARS = 700

export const FILE_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'search_file',
      description: 'Search an attached file (file="F1"). Case-insensitive text, or a regex with regex=true; "a|b" finds either. Text files: matching lines with line numbers and context. JSON / HAR: `path = value` of matching keys and values (pass the path to query_json). A query of several words also returns the best matching passages of the file, so describe what you look for when the exact text is unknown.',
      parameters: {
        type: 'object',
        properties: {
          file: { type: 'string', description: 'File id from the attachment, e.g. F1' },
          query: { type: 'string', description: 'Text, words or a regex' },
          regex: { type: 'boolean', description: 'Treat query as a JavaScript regular expression' },
          context: { type: 'integer', description: 'Lines shown around each match, default 1, up to 5' },
          limit: { type: 'integer', description: 'Max matches, default 20, up to 50' },
          offset: { type: 'integer', description: 'Skip this many matches (next page)' },
        },
        required: ['file', 'query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a part of an attached file: lines start_line..end_line (numbered), or chars from offset for very long lines (minified JSON). PDF: page=N. Read around what search_file found instead of reading the file from the start.',
      parameters: {
        type: 'object',
        properties: {
          file: { type: 'string', description: 'File id, e.g. F1' },
          start_line: { type: 'integer', description: '1-based first line, default 1' },
          end_line: { type: 'integer', description: 'Last line' },
          offset: { type: 'integer', description: 'First char to read (from a marker or a match position) instead of lines' },
          chars: { type: 'integer', description: 'Max chars to return, default 8000' },
          page: { type: 'integer', description: 'PDF: read from the start of this page' },
        },
        required: ['file'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_json',
      description: 'Read an attached JSON or HAR file by path. Object: its keys with short values. Array: items with their index; `where` filters, `fields` picks properties, `group_by` counts items per value. A string that holds JSON (HAR bodies in response.content.text) is parsed when the path goes inside it. HAR requests are at log.entries. Example: {"file": "F1", "path": "log.entries", "where": {"response.status": ">=400"}, "fields": ["request.method", "request.url", "response.status"]}',
      parameters: {
        type: 'object',
        properties: {
          file: { type: 'string', description: 'File id, e.g. F1' },
          path: { type: 'string', description: 'Dotted path with [index]: log.entries[3].response, data.items. Empty: the root' },
          where: {
            type: 'object',
            description: 'Array items only: conditions on item properties, all must hold. Key: property path inside the item (response.status; through arrays: request.headers.name). Value: 42 / true / "text" equal (case-insensitive); "~text" contains; "!value" not equal; ">10" "<10" ">=10" "<=10"; "*" exists; "!*" missing',
          },
          fields: { type: 'array', items: { type: 'string' }, description: 'Array items only: properties to show for each item' },
          group_by: { type: 'string', description: 'Array items only: property path to count the (matching) items by, e.g. response.status' },
          limit: { type: 'integer', description: 'Max items, default 20 (50 with fields), up to 200' },
          offset: { type: 'integer', description: 'Arrays: skip this many items. Long strings: first char to read' },
        },
        required: ['file'],
      },
    },
  },
]

export const FILE_TOOL_NAMES = new Set(FILE_TOOLS.map(t => t.function.name))

/** Added to the system prompt while the chat has files: only then the tools are sent */
export const FILES_NOTE = `## Attached files
\`<attachment type="text file" file="F1">\` is a file the user attached (also a long pasted text). With \`complete="true"\` the whole content is in the attachment. Otherwise the attachment holds only an overview, and you read the content with the file tools, passing \`file\`:
- \`search_file\`: find text or a regex; returns line numbers, JSON / HAR \`path = value\`. Several words also return the best matching passages.
- \`read_file\`: read lines (\`start_line\`, \`end_line\`) or chars (\`offset\`) around what you found.
- \`query_json\` (JSON / HAR): a value by path; list, filter (\`where\`) and count (\`group_by\`) array items. HAR requests: path \`log.entries\`.
Search first, then read only the parts the answer needs; do not read a long file page by page. Never say something is not in the file before \`search_file\` found nothing for it. Quote line numbers (\`F1:120\`) or JSON paths as evidence.`

export const FILES_NO_TOOLS_NOTE = 'Attached files: without tools only the part of each file that fits is in the message (`complete="false"` means the rest is cut). Say when the answer may depend on the cut part.'

function budgetChars(): number {
  return Math.max(2000, providerBudget(aiCredentials.provider).toolResultChars - 300)
}

function int(value: unknown, fallback: number, min: number, max: number): number {
  const n = Math.floor(Number(value))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

function oneLine(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

/** Up to `max` chars of a line, centered on a position when it is long */
function window(text: string, at: number, max: number): string {
  if (text.length <= max) return text
  const start = Math.max(0, Math.min(at - Math.floor(max / 2), text.length - max))
  return `${start > 0 ? '…' : ''}${text.slice(start, start + max)}${start + max < text.length ? '…' : ''}`
}

function fileList(): string {
  const list = chatFiles()
  return list.length
    ? `Files: ${list.map(f => `${f.id} "${f.name}" (${formatLabel(f.format)}, ${lineCount(f)} lines)`).join('; ')}`
    : 'No files are attached to this chat.'
}

function pickFile(id: unknown): AiTextFile | string {
  const list = chatFiles()
  if ((id === undefined || id === '') && list.length === 1) return list[0]
  const file = getTextFile(String(id ?? ''))
  if (file?.sent) return file
  return `No file "${String(id ?? '')}". ${fileList()}`
}

// ---------- JSON helpers ----------

type PathPart = string | number

function parsePath(path: string): PathPart[] | null {
  const p = path.trim().replace(/^\$\.?/, '').replace(/^\./, '')
  const parts: PathPart[] = []
  const re = /\[(\d+)\]|\[["']([^"']*)["']\]|\.?([^.[\]]+)/y
  let pos = 0
  while (pos < p.length) {
    re.lastIndex = pos
    const m = re.exec(p)
    if (!m) return null
    pos = re.lastIndex
    parts.push(m[1] !== undefined ? Number(m[1]) : (m[2] ?? m[3]))
  }
  return parts
}

function joinPath(base: string, part: PathPart): string {
  if (typeof part === 'number') return `${base}[${part}]`
  if (/^[A-Za-z_$][\w$-]*$/.test(part)) return base ? `${base}.${part}` : part
  return `${base}["${part}"]`
}

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function jsonInString(v: unknown): unknown {
  if (typeof v !== 'string') return undefined
  const t = v.trim()
  if (!/^[[{]/.test(t)) return undefined
  try {
    return JSON.parse(t)
  } catch {
    return undefined
  }
}

function describeItems(list: unknown[]): string {
  const sample = list.slice(0, 20)
  const objects = sample.filter(isObject)
  if (objects.length) {
    const keys = [...new Set(objects.flatMap(o => Object.keys(o)))]
    return `object {${keys.slice(0, 12).join(', ')}${keys.length > 12 ? `, … +${keys.length - 12}` : ''}}`
  }
  const types = [...new Set(sample.map(v => (Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v)))]
  return types.join(' | ')
}

function preview(v: unknown, max = 160): string {
  if (v === undefined) return '(missing)'
  if (typeof v === 'string') {
    return v.length > max ? `${JSON.stringify(v.slice(0, max))}… (${v.length} chars)` : JSON.stringify(v)
  }
  if (v === null || typeof v !== 'object') return String(v)
  if (Array.isArray(v)) return `array(${v.length})${v.length ? ` of ${describeItems(v)}` : ''}`
  const keys = Object.keys(v)
  return `{${keys.slice(0, 10).join(', ')}${keys.length > 10 ? `, … +${keys.length - 10}` : ''}}`
}

function compact(v: unknown, max: number, path: string): string {
  const json = JSON.stringify(v) ?? 'undefined'
  return json.length > max ? `${json.slice(0, max)}… [${json.length} chars: query_json path="${path}"]` : json
}

/** Every value at a path inside an item; arrays on the way are expanded */
function valuesAt(item: unknown, path: string): unknown[] {
  const parts = parsePath(path) ?? [path]
  let current: unknown[] = [item]
  for (const part of parts) {
    const next: unknown[] = []
    for (const value of current) {
      let v = value
      if (typeof v === 'string' && typeof part === 'string') v = jsonInString(v)
      if (Array.isArray(v) && typeof part === 'string') {
        for (const el of v) if (isObject(el) && part in el) next.push(el[part])
      } else if (Array.isArray(v) && typeof part === 'number') {
        if (part < v.length) next.push(v[part])
      } else if (isObject(v) && typeof part === 'string' && part in v) {
        next.push(v[part])
      }
    }
    current = next
  }
  return current
}

function equalLoose(v: unknown, expected: unknown): boolean {
  if (v !== null && typeof v === 'object') return JSON.stringify(v) === JSON.stringify(expected)
  return String(v).toLowerCase() === String(expected).toLowerCase()
}

function holds(values: unknown[], cond: unknown): boolean {
  if (cond === '*') return values.length > 0
  if (cond === '!*') return values.length === 0
  if (typeof cond === 'string') {
    if (cond.startsWith('~')) {
      const needle = cond.slice(1).toLowerCase()
      return values.some(v => (typeof v === 'string' ? v : JSON.stringify(v) ?? '').toLowerCase().includes(needle))
    }
    const cmp = cond.match(/^(>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)$/)
    if (cmp) {
      const limit = Number(cmp[2])
      return values.some(v => {
        if (v === null || v === '' || typeof v === 'boolean') return false
        const n = Number(v)
        if (!Number.isFinite(n)) return false
        return cmp[1] === '>' ? n > limit : cmp[1] === '<' ? n < limit : cmp[1] === '>=' ? n >= limit : n <= limit
      })
    }
    if (cond.startsWith('!')) return !values.some(v => equalLoose(v, cond.slice(1)))
  }
  return values.some(v => equalLoose(v, cond))
}

function resolvePath(root: unknown, path: string): { value: unknown; path: string; note?: string } | string {
  const parts = parsePath(path)
  if (!parts) return `Cannot read the path "${path}". Use dots and [index]: log.entries[3].response.status`
  let value = root
  let at = ''
  let note: string | undefined
  for (const part of parts) {
    const inner = jsonInString(value)
    if (inner !== undefined) {
      value = inner
      note = `${at || 'root'} is JSON text; read inside it`
    }
    if (Array.isArray(value) && typeof part === 'number') {
      if (part >= value.length) return `${at || 'root'} has ${value.length} items; no [${part}].`
      value = value[part]
    } else if (Array.isArray(value)) {
      return `${at || 'root'} is an array of ${value.length}: use an index such as ${joinPath(at, 0)}, or where / fields to read "${part}" of every item.`
    } else if (isObject(value) && String(part) in value) {
      value = value[String(part)]
    } else if (isObject(value)) {
      const keys = Object.keys(value)
      return `No "${part}" in ${at || 'root'}. Keys: ${keys.slice(0, 40).join(', ')}${keys.length > 40 ? ', …' : ''}`
    } else {
      return `${at || 'root'} is ${preview(value, 60)}, it has no "${part}".`
    }
    at = joinPath(at, part)
  }
  return { value, path: at, note }
}

function jsonOutline(root: unknown, maxLines: number): string[] {
  const lines: string[] = []
  const walk = (v: unknown, label: string, depth: number) => {
    if (lines.length >= maxLines) return
    const pad = '  '.repeat(depth)
    if (Array.isArray(v)) {
      lines.push(`${pad}${label}: array(${v.length})${v.length ? ` of ${describeItems(v)}` : ''}`)
      const first = v.find(isObject)
      if (first && depth < 3) {
        for (const [k, child] of Object.entries(first)) {
          if (child && typeof child === 'object') walk(child, `[0].${k}`, depth + 1)
        }
      }
    } else if (isObject(v)) {
      const keys = Object.keys(v)
      lines.push(`${pad}${label}: object, ${keys.length} keys`)
      if (depth < 3) {
        for (const k of keys.slice(0, 25)) walk(v[k], k, depth + 1)
        if (keys.length > 25) lines.push(`${pad}  … +${keys.length - 25} keys`)
      }
    } else {
      lines.push(`${pad}${label}: ${preview(v, 80)}`)
    }
  }
  walk(root, 'root', 0)
  if (lines.length >= maxLines) lines.push('…')
  return lines
}

// ---------- Overview ----------

interface HarEntry {
  startedDateTime?: string
  time?: number
  request?: { method?: string; url?: string }
  response?: { status?: number; content?: { size?: number; mimeType?: string }; _error?: string }
  _resourceType?: string
}

function harLine(e: HarEntry, i: number): string {
  const status = e.response?.status ?? 0
  const time = typeof e.time === 'number' ? `${Math.round(e.time)} ms` : ''
  const error = e.response?._error ? ` ${oneLine(e.response._error, 60)}` : ''
  return `[${i}] ${e.request?.method ?? '?'} ${status || 'failed'} ${oneLine(e.request?.url ?? '', 140)}${time ? ` (${time})` : ''}${error}`
}

function harOverview(json: { log: { entries: HarEntry[]; pages?: { title?: string }[]; creator?: { name?: string; version?: string } } }, maxChars: number): string {
  const { entries, pages, creator } = json.log
  const out: string[] = []
  out.push(`HAR${creator?.name ? ` by ${creator.name}${creator.version ? ` ${creator.version}` : ''}` : ''}: ${entries.length} requests at log.entries${pages?.length ? `, ${pages.length} pages (${pages.slice(0, 3).map(p => `"${oneLine(p.title ?? '', 60)}"`).join(', ')}${pages.length > 3 ? ', …' : ''})` : ''}.`)
  const times = entries.map(e => Date.parse(e.startedDateTime ?? '')).filter(Number.isFinite)
  if (times.length) {
    const from = Math.min(...times)
    const to = Math.max(...times)
    out.push(`Time: ${new Date(from).toISOString()} – ${new Date(to).toISOString()} (${Math.round((to - from) / 1000)} s)`)
  }
  const buckets = new Map<string, number>()
  const hosts = new Map<string, number>()
  for (const e of entries) {
    const s = e.response?.status ?? 0
    const bucket = s ? `${Math.floor(s / 100)}xx` : 'failed'
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1)
    try {
      const host = new URL(e.request?.url ?? '').host
      hosts.set(host, (hosts.get(host) ?? 0) + 1)
    } catch {
      // Not a URL: data:, blob:
    }
  }
  out.push(`Status: ${[...buckets.entries()].sort().map(([k, n]) => `${k} ${n}`).join(', ')}`)
  out.push(`Hosts: ${[...hosts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([h, n]) => `${h} ${n}`).join(', ')}`)
  const lines: string[] = []
  if (entries.length <= 30) {
    lines.push('Requests:', ...entries.map(harLine))
  } else {
    const failed = entries.map((e, i) => [e, i] as const).filter(([e]) => !e.response?.status || e.response.status >= 400)
    if (failed.length) lines.push(`Failed (status >= 400 or no response), ${failed.length}:`, ...failed.slice(0, 15).map(([e, i]) => harLine(e, i)))
    if (failed.length > 15) lines.push(`… +${failed.length - 15}: query_json path="log.entries" where={"response.status": ">=400"}`)
    const slow = entries.map((e, i) => [e, i] as const).filter(([e]) => typeof e.time === 'number').sort((a, b) => (b[0].time ?? 0) - (a[0].time ?? 0)).slice(0, 5)
    if (slow.length) lines.push('Slowest:', ...slow.map(([e, i]) => harLine(e, i)))
  }
  lines.push('Entry: request {method, url, headers[{name, value}], queryString, postData.text}, response {status, headers, content {mimeType, text = body}}, time, startedDateTime.')
  let text = out.join('\n')
  for (const line of lines) {
    if (text.length + line.length + 1 > maxChars) break
    text += `\n${line}`
  }
  return text
}

const ERROR_LINE = /^.*(?:\b(?:ERROR|FATAL|CRITICAL|SEVERE)\b|Exception\b|\w*Error:|Traceback|\bpanic:|\[error\]|"level":\s*"error").*$/gm
const WARN_LINE = /^.*(?:\bWARN(?:ING)?\b|\[warn(?:ing)?\]|"level":\s*"warn").*$/gm

function problemLines(file: AiTextFile, maxLines: number): string[] {
  const errors: string[] = []
  let errorCount = 0
  for (const m of file.text.matchAll(ERROR_LINE)) {
    if (++errorCount <= maxLines) errors.push(`${lineAt(file, m.index ?? 0)}| ${oneLine(m[0], 200)}`)
    if (errorCount >= MAX_COUNT) break
  }
  let warnCount = 0
  for (const _ of file.text.matchAll(WARN_LINE)) if (++warnCount >= MAX_COUNT) break
  if (!errorCount && !warnCount) return []
  const head = `Problem lines: ${errorCount}${errorCount >= MAX_COUNT ? '+' : ''} error, ${warnCount}${warnCount >= MAX_COUNT ? '+' : ''} warning`
  return errorCount ? [head, 'First errors:', ...errors] : [head]
}

function numbered(file: AiTextFile, from: number, to: number, width: number): string[] {
  const lines: string[] = []
  for (let n = from; n <= to && n <= lineCount(file); n++) lines.push(`${n}| ${oneLine(lineText(file, n), width)}`)
  return lines
}

function textOutline(file: AiTextFile, maxChars: number): string {
  const total = lineCount(file)
  const sections: string[] = []
  if (file.format === 'pdf') {
    const pages = [...file.text.matchAll(/^--- Page (\d+) ---$/gm)].slice(0, 40)
    sections.push(`PDF, ${file.pages ?? pages.length} pages (text layer). Pages start at lines:`)
    for (const m of pages) {
      const line = lineAt(file, m.index ?? 0)
      sections.push(`page ${m[1]} → line ${line}: ${oneLine(lineText(file, line + 1), 100)}`)
    }
  } else if (file.format === 'md') {
    const heads: string[] = []
    let fence = false
    for (let n = 1; n <= total && heads.length < 80; n++) {
      const text = lineText(file, n)
      if (/^\s*```/.test(text)) fence = !fence
      if (!fence && /^#{1,4}\s/.test(text)) heads.push(`${n}| ${oneLine(text, 120)}`)
    }
    sections.push(heads.length ? 'Headings:' : 'No headings.', ...heads)
  } else if (file.format === 'csv') {
    const header = lineText(file, 1)
    const delimiter = [',', ';', '\t', '|'].map(d => [d, header.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0]
    sections.push(`CSV, delimiter ${JSON.stringify(delimiter)}, ${total - 1} data rows (lines 2-${total}).`, `Columns: ${oneLine(header, 600)}`, 'First rows:', ...numbered(file, 2, 4, 300))
  }
  if (file.format !== 'csv' && file.format !== 'pdf' && file.format !== 'md') {
    sections.push('Start:', ...numbered(file, 1, Math.min(total, 12), 200))
    if (total > 20) sections.push('End:', ...numbered(file, total - 4, total, 200))
  }
  if (file.format === 'log' || file.format === 'txt' || file.format === 'pdf') sections.push(...problemLines(file, 10))
  let text = ''
  for (const line of sections) {
    if (text.length + line.length + 1 > maxChars) {
      text += '\n…'
      break
    }
    text += `${text ? '\n' : ''}${line}`
  }
  return text
}

export interface FileOverviewOptions {
  /** A file up to this size goes whole */
  inline: number
  /** Size of the outline of a bigger file */
  outline: number
  /** Without tools the file goes whole up to `inline` and the rest is cut */
  tools: boolean
}

/** Body of the attachment of a file; `complete` when the whole content is in it */
export function fileOverview(file: AiTextFile, opts: FileOverviewOptions): { complete: boolean; text: string } {
  const lines = lineCount(file)
  const facts = [formatLabel(file.format), sizeLabel(file.bytes), `${lines} ${lines === 1 ? 'line' : 'lines'}`, `≈${tokenEstimate(file.text.length)} tokens`]
  if (file.pages) facts.splice(2, 0, `${file.pages} pages`)
  const head = `${file.id}${file.pasted ? ' (pasted text)' : ''}: ${facts.join(', ')}.`
  const parseNote = file.jsonError ? `\nNot valid JSON (${oneLine(file.jsonError, 120)}): read as text.` : ''
  if (file.text.length <= opts.inline) {
    return { complete: true, text: `${head}${parseNote} Full content:\n${file.text}` }
  }
  if (!opts.tools) {
    return { complete: false, text: `${head}${parseNote} First ${opts.inline} of ${file.text.length} chars (the rest is cut):\n${file.text.slice(0, opts.inline)}` }
  }
  let outline: string
  const json = file.format === 'json' || file.format === 'har' ? fileJson(file) : undefined
  if (file.format === 'har') {
    outline = harOverview(json as Parameters<typeof harOverview>[0], opts.outline)
  } else if (file.format === 'json') {
    outline = `Structure:\n${jsonOutline(json, 60).join('\n')}`
    if (outline.length > opts.outline) outline = `${outline.slice(0, opts.outline)}\n…`
  } else {
    outline = textOutline(file, opts.outline)
  }
  const tools = file.format === 'json' || file.format === 'har' ? 'search_file, query_json, read_file' : 'search_file, read_file'
  return { complete: false, text: `${head}${parseNote} Content not included: read it with ${tools} (file="${file.id}").\n${outline}` }
}

// ---------- search_file ----------

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildRegex(query: string, regex: boolean): RegExp | string {
  try {
    if (regex) return new RegExp(query, 'gi')
    const alternatives = query.split('|').map(s => s.trim()).filter(Boolean)
    return new RegExp(alternatives.map(escapeRegex).join('|'), 'gi')
  } catch (e) {
    return `Invalid regex: ${String((e as Error)?.message || e)}`
  }
}

interface Hit {
  line: number
  index: number
}

function findHits(file: AiTextFile, re: RegExp, skip: number, limit: number): { hits: Hit[]; total: number } {
  const text = file.text
  const hits: Hit[] = []
  let total = 0
  let lastKey = ''
  re.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (!m[0]) {
      re.lastIndex++
      continue
    }
    const line = lineAt(file, m.index)
    const start = file.lineStarts[line - 1]
    const next = file.lineStarts[line] ?? text.length + 1
    const long = next - start > LONG_LINE
    const key = long ? `${line}:${Math.floor((m.index - start) / (MATCH_WINDOW * 2))}` : String(line)
    if (key !== lastKey) {
      lastKey = key
      total++
      if (total > skip && hits.length < limit) hits.push({ line, index: m.index })
      if (total >= MAX_COUNT) break
    }
    if (!long && re.lastIndex < next) re.lastIndex = next
  }
  return { hits, total }
}

function renderHits(file: AiTextFile, hits: Hit[], context: number, max: number): { text: string; shown: number } {
  const out: string[] = []
  let size = 0
  let shown = 0
  let lastLine = 0
  for (const hit of hits) {
    const lineStart = file.lineStarts[hit.line - 1]
    const full = lineText(file, hit.line)
    let block: string[]
    if (full.length > LONG_LINE) {
      const col = hit.index - lineStart
      block = [`> ${hit.line}:${col + 1}| ${window(full, col, MATCH_WINDOW * 2)}  [read_file file="${file.id}" offset=${Math.max(0, hit.index - 2000)}]`]
      lastLine = hit.line
    } else {
      const from = Math.max(1, hit.line - context, lastLine + 1)
      const to = Math.min(lineCount(file), hit.line + context)
      block = []
      if (lastLine && from > lastLine + 1) block.push('--')
      for (let n = from; n <= to; n++) {
        const text = lineText(file, n)
        const shownText = n === hit.line ? window(text.replace(/\t/g, '  '), text.search(/\S/), LINE_CHARS) : oneLine(text, LINE_CHARS)
        block.push(`${n === hit.line ? '>' : ' '} ${n}| ${shownText}`)
      }
      lastLine = Math.max(lastLine, to)
    }
    const add = block.join('\n')
    if (size + add.length > max && shown) break
    out.push(add)
    size += add.length + 1
    shown++
  }
  return { text: out.join('\n'), shown }
}

function queryTerms(query: string): string[] {
  const words = query.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? []
  const terms = words.filter(w => w.length >= 3 || /\d/.test(w))
  // Crude stemming: "errors", "ошибки" and "ошибка" share a prefix
  return [...new Set(terms.map(w => (w.length > 5 ? w.slice(0, w.length - 2) : w)))]
}

const passageCache = new WeakMap<AiTextFile, { start: number; end: number }[]>()

function passages(file: AiTextFile): { start: number; end: number }[] {
  let list = passageCache.get(file)
  if (list) return list
  list = []
  const text = file.text
  const snap = (pos: number, slack: number) => {
    if (pos >= text.length) return text.length
    const nl = text.indexOf('\n', pos)
    return nl !== -1 && nl - pos <= slack ? nl + 1 : pos
  }
  for (let start = 0; start < text.length;) {
    const end = snap(start + PASSAGE_CHARS, 400)
    list.push({ start, end })
    if (end >= text.length) break
    start = snap(start + PASSAGE_STEP, 400)
  }
  passageCache.set(file, list)
  return list
}

/** BM25 over overlapping passages, like a file search without embeddings; `shown` lines are skipped */
function rankedPassages(file: AiTextFile, query: string, max: number, shown: Set<number>): string {
  const terms = queryTerms(query)
  if (terms.length < 2) return ''
  const list = passages(file)
  const low = lowerText(file)
  const tf = new Map<number, Map<string, number>>()
  for (const term of terms) {
    let pos = low.indexOf(term)
    for (let n = 0; pos !== -1 && n < 50_000; n++) {
      let lo = 0
      let hi = list.length - 1
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1
        if (list[mid].start <= pos) lo = mid
        else hi = mid - 1
      }
      for (let i = lo; i >= 0 && list[i].end > pos; i--) {
        const counts = tf.get(i) ?? new Map<string, number>()
        counts.set(term, (counts.get(term) ?? 0) + 1)
        tf.set(i, counts)
      }
      pos = low.indexOf(term, pos + term.length)
    }
  }
  if (!tf.size) return ''
  const df = new Map<string, number>()
  for (const counts of tf.values()) for (const term of counts.keys()) df.set(term, (df.get(term) ?? 0) + 1)
  const N = list.length
  const avg = file.text.length / N || 1
  const scored = [...tf.entries()].map(([i, counts]) => {
    const len = list[i].end - list[i].start
    let score = 0
    for (const [term, f] of counts) {
      const idf = Math.log(1 + (N - (df.get(term) ?? 0) + 0.5) / ((df.get(term) ?? 0) + 0.5))
      score += idf * (f * 2.2) / (f + 1.2 * (0.25 + 0.75 * len / avg))
    }
    return { i, score: score * (counts.size / terms.length), matched: counts.size }
  }).sort((a, b) => b.score - a.score)
  const out = [`Best matching passages for ${terms.map(t => `"${t}"`).join(', ')} (≈800 tokens each; read one whole with read_file start_line / end_line):`]
  let size = out[0].length
  const picked: number[] = []
  for (const s of scored) {
    if (picked.length >= PASSAGES) break
    if (picked.some(i => Math.abs(i - s.i) <= 1)) continue
    const { start, end } = list[s.i]
    const from = lineAt(file, start)
    const to = lineAt(file, Math.max(start, end - 1))
    const lines: string[] = []
    let fresh = false
    for (let n = from; n <= to && lines.length < 6; n++) {
      const text = lineText(file, n)
      const lower = text.toLowerCase()
      const at = terms.map(t => lower.indexOf(t)).filter(i => i >= 0)
      if (!at.length) continue
      lines.push(`  ${n}| ${window(text, Math.min(...at), 240)}`)
      if (!shown.has(n)) fresh = true
    }
    if (!fresh) continue
    const block = `[${picked.length + 1}] lines ${from}-${to}, ${s.matched} of ${terms.length} words\n${lines.join('\n')}`
    if (size + block.length > max) break
    picked.push(s.i)
    out.push(block)
    size += block.length
  }
  return picked.length ? out.join('\n') : ''
}

interface JsonHit {
  path: string
  key: boolean
  value: unknown
  at: number
}

function searchJson(root: unknown, re: RegExp, skip: number, limit: number): { hits: JsonHit[]; total: number; groups: Map<string, number> } {
  const hits: JsonHit[] = []
  const groups = new Map<string, number>()
  let total = 0
  const test = new RegExp(re.source, 'i')
  const record = (path: string, key: boolean, value: unknown, at: number) => {
    total++
    const group = path.replace(/\[\d+\]/g, '[*]')
    groups.set(group, (groups.get(group) ?? 0) + 1)
    if (total > skip && hits.length < limit) hits.push({ path, key, value, at })
  }
  const walk = (v: unknown, path: string) => {
    if (total >= MAX_COUNT) return
    if (Array.isArray(v)) {
      v.forEach((child, i) => walk(child, `${path}[${i}]`))
    } else if (isObject(v)) {
      for (const [k, child] of Object.entries(v)) {
        const p = joinPath(path, k)
        const m = test.exec(k)
        if (m) record(p, true, child, m.index)
        walk(child, p)
      }
    } else if (v !== null && v !== undefined) {
      const m = test.exec(String(v))
      if (m) record(path, false, v, m.index)
    }
  }
  walk(root, '')
  return { hits, total, groups }
}

function searchFile(args: Record<string, any>): string {
  const file = pickFile(args.file)
  if (typeof file === 'string') return file
  const query = String(args.query ?? '').trim()
  if (!query) return 'Pass query: the text, words or regex to find.'
  const re = buildRegex(query, !!args.regex)
  if (typeof re === 'string') return re
  const max = budgetChars()
  const limit = int(args.limit, 20, 1, 50)
  const offset = int(args.offset, 0, 0, MAX_COUNT)
  const context = int(args.context, 1, 0, 5)
  const name = `${file.id} "${file.name}"`

  const json = file.format === 'json' || file.format === 'har' ? fileJson(file) : undefined
  if (json !== undefined) {
    const { hits, total, groups } = searchJson(json, re, offset, limit)
    if (total) {
      const out = [`${name}: ${total}${total >= MAX_COUNT ? '+' : ''} matches for ${JSON.stringify(query)}${total > hits.length ? ` (showing ${offset + 1}-${offset + hits.length})` : ''}:`]
      if (groups.size > 1 && total > limit) {
        out.push(`By path: ${[...groups.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([p, n]) => `${p} ${n}`).join(', ')}`)
      }
      let size = out.join('\n').length
      for (const hit of hits) {
        const value = hit.key
          ? `${hit.path} (key) = ${preview(hit.value, 120)}`
          : typeof hit.value === 'string' && hit.value.length > MATCH_WINDOW * 2
            ? `${hit.path} = "${window(hit.value, hit.at, MATCH_WINDOW * 2)}" (${hit.value.length} chars; query_json path="${hit.path}" offset=${Math.max(0, hit.at - 1000)})`
            : `${hit.path} = ${preview(hit.value, MATCH_WINDOW * 2)}`
        if (size + value.length > max) break
        out.push(value)
        size += value.length + 1
      }
      if (offset + hits.length < total) out.push(`More: call again with offset=${offset + hits.length}`)
      return out.join('\n')
    }
  }

  const { hits, total } = findHits(file, re, offset, limit)
  const out: string[] = []
  if (total) {
    const rendered = renderHits(file, hits, context, max)
    out.push(`${name}: ${total}${total >= MAX_COUNT ? '+' : ''} matching lines for ${JSON.stringify(query)}${total > rendered.shown ? ` (showing ${offset + 1}-${offset + rendered.shown})` : ''}:`, rendered.text)
    if (offset + rendered.shown < total) out.push(`More: call again with offset=${offset + rendered.shown}`)
  } else {
    out.push(`${name}: no matches for ${JSON.stringify(query)}.`)
  }
  if (!args.regex && total < 5 && offset === 0) {
    const used = out.join('\n').length
    const ranked = rankedPassages(file, query, max - used, new Set(hits.map(h => h.line)))
    if (ranked) out.push('', ranked)
    else if (!total) out.push('Try other words, a shorter part of a word, or a regex with alternatives.')
  }
  return out.join('\n')
}

// ---------- read_file ----------

function readFile(args: Record<string, any>): string {
  const file = pickFile(args.file)
  if (typeof file === 'string') return file
  const max = budgetChars()
  const size = int(args.chars, Math.min(READ_CHARS, max), 200, max)
  const text = file.text
  const total = lineCount(file)

  if (args.offset !== undefined && args.offset !== null && args.start_line === undefined) {
    const from = int(args.offset, 0, 0, text.length)
    const to = Math.min(text.length, from + size)
    const head = `${file.id} chars ${from}-${to} of ${text.length} (lines ${lineAt(file, from)}-${lineAt(file, Math.max(from, to - 1))}):`
    return `${head}\n${text.slice(from, to)}${to < text.length ? `\nMore: read_file file="${file.id}" offset=${to}` : '\n[end of file]'}`
  }

  let start = int(args.start_line, 1, 1, total)
  if (args.page !== undefined && file.format === 'pdf') {
    const at = text.indexOf(`--- Page ${int(args.page, 1, 1, 100_000)} ---`)
    if (at === -1) return `No page ${args.page}; the PDF has ${file.pages ?? '?'} pages.`
    start = lineAt(file, at)
  }
  const explicitEnd = args.end_line !== undefined && args.end_line !== null
  const end = explicitEnd ? int(args.end_line, start, start, total) : Math.min(total, start + READ_LINES - 1)
  const out: string[] = [`${file.id} lines ${start}-${end} of ${total}:`]
  let used = out[0].length
  let n = start
  for (; n <= end; n++) {
    const lineStart = file.lineStarts[n - 1]
    let line = lineText(file, n)
    if (line.length > 2000) line = `${line.slice(0, 2000)}… [line continues, ${line.length} chars: read_file file="${file.id}" offset=${lineStart + 2000}]`
    const row = `${n}| ${line}`
    if (used + row.length + 1 > size && n > start) break
    out.push(row)
    used += row.length + 1
  }
  if (n <= end || (!explicitEnd && end < total)) {
    out[0] = `${file.id} lines ${start}-${n - 1} of ${total}:`
    out.push(`More: read_file file="${file.id}" start_line=${n}${explicitEnd ? ` end_line=${end}` : ''}`)
  } else if (end >= total) {
    out.push('[end of file]')
  }
  return out.join('\n')
}

// ---------- query_json ----------

function itemLine(item: unknown, index: number, path: string, fields: string[] | undefined): string {
  if (fields?.length) {
    return `[${index}] ${fields.map(f => {
      const values = valuesAt(item, f)
      const shown = values.length === 0 ? '(missing)' : values.length === 1 ? preview(values[0], 200) : `[${values.slice(0, 5).map(v => preview(v, 60)).join(', ')}${values.length > 5 ? ', …' : ''}]`
      return `${f}=${shown}`
    }).join(' | ')}`
  }
  return `[${index}] ${compact(item, ITEM_CHARS, `${path}[${index}]`)}`
}

function queryJson(args: Record<string, any>): string {
  const file = pickFile(args.file)
  if (typeof file === 'string') return file
  if (file.format !== 'json' && file.format !== 'har') {
    return `${file.id} is ${formatLabel(file.format)}${file.jsonError ? ' (not valid JSON)' : ''}, not JSON: use search_file and read_file.`
  }
  const max = budgetChars()
  const found = resolvePath(fileJson(file), String(args.path ?? ''))
  if (typeof found === 'string') return found
  let { value } = found
  const path = found.path
  const label = path || 'root'
  const notes = found.note ? [`(${found.note})`] : []
  const where = isObject(args.where) ? args.where : undefined
  const fields = Array.isArray(args.fields) ? args.fields.map(String).filter(Boolean) : undefined
  const groupBy = typeof args.group_by === 'string' && args.group_by ? args.group_by : undefined

  if (!Array.isArray(value) && (where || groupBy || fields)) {
    const inner = jsonInString(value)
    if (Array.isArray(inner)) {
      value = inner
      notes.push(`(${label} is JSON text; read inside it)`)
    } else if (!Array.isArray(value)) {
      return `${label} is ${preview(value, 80)}, not an array: where, fields and group_by work on arrays.${isObject(value) ? ` Keys: ${Object.keys(value).slice(0, 40).join(', ')}` : ''}`
    }
  }

  if (Array.isArray(value)) {
    const list = value
    const conditions = where ? Object.entries(where) : []
    const matching: number[] = []
    for (let i = 0; i < list.length; i++) {
      if (conditions.every(([key, cond]) => holds(valuesAt(list[i], key), cond))) matching.push(i)
    }
    const out = [...notes, `${label}: array(${list.length})${where ? `, ${matching.length} match ${JSON.stringify(where)}` : ''}${list.length ? `, items ${describeItems(list)}` : ''}`]
    if (groupBy) {
      const counts = new Map<string, number>()
      for (const i of matching) {
        const values = valuesAt(list[i], groupBy)
        const key = values.length ? values.map(v => (typeof v === 'string' ? v : JSON.stringify(v))).join(', ') : '(missing)'
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
      const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
      out.push(`Count by ${groupBy} (${sorted.length} values):`, ...sorted.slice(0, 60).map(([k, n]) => `${oneLine(k, 160)}: ${n}`))
      if (sorted.length > 60) out.push(`… +${sorted.length - 60} values`)
      if (!fields) return out.join('\n')
    }
    const limit = int(args.limit, fields ? 50 : 20, 1, 200)
    const offset = int(args.offset, 0, 0, matching.length)
    let size = out.join('\n').length
    let shown = 0
    for (const i of matching.slice(offset, offset + limit)) {
      const line = itemLine(list[i], i, path, fields)
      if (size + line.length > max && shown) break
      out.push(line)
      size += line.length + 1
      shown++
    }
    if (offset + shown < matching.length) out.push(`More: call again with offset=${offset + shown}`)
    return out.join('\n')
  }

  if (typeof value === 'string') {
    const from = int(args.offset, 0, 0, value.length)
    const size = Math.min(max - 200, READ_CHARS * 2)
    const to = Math.min(value.length, from + size)
    const more = to < value.length ? `\nMore: query_json file="${file.id}" path="${path}" offset=${to}` : ''
    const parsedNote = jsonInString(value) !== undefined ? ' It is JSON text: add a path inside it, or where / fields for an array.' : ''
    return `${[...notes, `${label}: string, ${value.length} chars${value.length > size ? `, chars ${from}-${to}` : ''}.${parsedNote}`].join('\n')}\n${value.slice(from, to)}${more}`
  }

  if (isObject(value)) {
    const whole = JSON.stringify(value, null, 1)
    if (whole.length <= Math.min(max, 3000)) return [...notes, `${label}:`, whole].join('\n')
    const out = [...notes, `${label}: object, ${Object.keys(value).length} keys`]
    let size = out.join('\n').length
    for (const [k, v] of Object.entries(value)) {
      const line = `${joinPath(path, k)}: ${preview(v, 200)}`
      if (size + line.length > max) {
        out.push('… more keys cut: read a key by its path')
        break
      }
      out.push(line)
      size += line.length + 1
    }
    return out.join('\n')
  }
  return [...notes, `${label} = ${JSON.stringify(value)}`].join('\n')
}

export function runFileTool(name: string, args: Record<string, any>): string {
  switch (name) {
    case 'search_file':
      return searchFile(args)
    case 'read_file':
      return readFile(args)
    case 'query_json':
      return queryJson(args)
    default:
      return `Unknown tool "${name}".`
  }
}

function short(value: unknown, max = 60): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value) ?? ''
  return text.length > max ? `${text.slice(0, max)}...` : text
}

export function describeFileTool(name: string, args: Record<string, any>): AiStep {
  const file = getTextFile(String(args.file ?? ''))
  const target = file ? file.name : String(args.file ?? 'file')
  switch (name) {
    case 'search_file':
      return { tool: 'File', summary: `Search ${short(target)} for "${short(args.query)}"${Number(args.offset) > 0 ? `, from ${args.offset}` : ''}` }
    case 'read_file': {
      const range = args.page ? `page ${args.page}` : args.offset !== undefined && args.start_line === undefined ? `from char ${args.offset}` : `lines ${args.start_line ?? 1}${args.end_line ? `-${args.end_line}` : ''}`
      return { tool: 'File', summary: `Read ${short(target)} ${range}` }
    }
    case 'query_json': {
      const parts = [args.path ? short(args.path) : 'root', args.where && `where ${short(args.where, 90)}`, args.group_by && `count by ${short(args.group_by)}`].filter(Boolean)
      return { tool: 'File', summary: `Query ${short(target)} ${parts.join(' ')}` }
    }
    default:
      return { tool: name, summary: '' }
  }
}
