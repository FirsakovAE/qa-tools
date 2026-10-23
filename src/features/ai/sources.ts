/**
 * Page sources for the assistant: the scripts of the inspected page, their source maps and the
 * original files embedded in the maps (`sourcesContent`).
 *
 * Scripts are fetched by the content script (page origin and cookies); in the extension the UI
 * page fetches directly when that fails (host permissions, no CORS).
 */

import { getRuntimeAdapter } from '@/runtime'
import { parseFrames } from '@/injected/logs/stack'
import { displayPath, originalPosition, parseSourceMap, type SourceMapData } from './sourceMap'

const LIST_TTL_MS = 30_000
const MAX_SCRIPTS = 300
const PARALLEL = 6
const RESULT_CHARS = 20000
const LONG_LINE = 1000
const MAX_LIST = 300
const MAX_MATCHES = 30
const STACK_FRAMES = 3
const STACK_CONTEXT = 4
const STACK_COLUMN_CHARS = 250
/** Average line length above which a script is treated as minified */
const MINIFIED_LINE = 500
/** Chars on each side of a position in a minified line */
const SNIPPET_CHARS = 1500
const MAX_SNIPPET_CHARS = 6000
/** Windows read_source returns for a query */
const QUERY_WINDOWS = 3
/** Matches search_source lists in one minified line */
const LINE_MATCHES = 8
const NO_MAPS_NOTE = 'The page has no source maps with embedded code: only the minified scripts can be read, original files (.vue, stores) are not available.'

interface Script {
  url: string
  inlineIndex?: number
  text?: string
  map?: SourceMapData | null
  error?: string
  loading?: Promise<void>
}

interface Original {
  path: string
  script: Script
  index: number
}

interface PageList {
  page: { url: string; title: string }
  at: number
  /** Scripts over MAX_SCRIPTS that are not read */
  skipped: number
}

const scripts = new Map<string, Script>()
let pageList: PageList | null = null
let listing: Promise<void> | null = null

function isLibrary(path: string): boolean {
  return /(^|\/)node_modules\/|^\.?vite\/deps\/|^\(webpack\)|^webpack\/|^\x00/.test(path)
}

function cut(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}\n... [${text.length - max} chars cut]` : text
}

async function request<T>(message: Record<string, unknown>, timeout = 15000): Promise<T> {
  const adapter = getRuntimeAdapter()
  if (!adapter) throw new Error('Inspector runtime is not ready')
  return adapter.sendMessage<T>({ type: String(message.type), ...message }, timeout)
}

async function fetchText(url: string): Promise<{ text: string; sourceMap?: string }> {
  try {
    const res = await request<{ text?: string; sourceMap?: string; error?: string }>({ type: 'AI_SOURCE_FETCH', url })
    if (typeof res?.text === 'string') return { text: res.text, sourceMap: res.sourceMap }
    if (!(typeof chrome !== 'undefined' && chrome.runtime?.id)) throw new Error(res?.error || 'Fetch failed')
  } catch (e) {
    if (!(typeof chrome !== 'undefined' && chrome.runtime?.id)) throw e
  }
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return { text: await res.text(), sourceMap: res.headers.get('SourceMap') || res.headers.get('X-SourceMap') || undefined }
}

function decodeDataUrl(url: string): string | null {
  const m = /^data:[^,]*?(;base64)?,(.*)$/s.exec(url)
  if (!m) return null
  if (!m[1]) return decodeURIComponent(m[2])
  const binary = atob(m[2])
  return new TextDecoder().decode(Uint8Array.from(binary, c => c.charCodeAt(0)))
}

async function loadMap(script: Script, headerUrl?: string): Promise<SourceMapData | null> {
  const tail = script.text!.slice(-2000)
  const m = /[#@]\s*sourceMappingURL=(\S+)\s*$/.exec(tail.trimEnd())
  const ref = headerUrl || m?.[1]
  if (!ref) return null
  if (ref.startsWith('data:')) {
    const text = decodeDataUrl(ref)
    return text ? parseSourceMap(text) : null
  }
  const base = script.inlineIndex === undefined ? script.url : pageList?.page.url ?? location.href
  const { text } = await fetchText(new URL(ref, base).href)
  return parseSourceMap(text)
}

function ensureScript(url: string, inlineIndex?: number): Script {
  let script = scripts.get(url)
  if (!script) {
    script = { url, inlineIndex }
    scripts.set(url, script)
  }
  return script
}

function loadScript(script: Script): Promise<void> {
  if (script.text !== undefined || script.error) return Promise.resolve()
  script.loading ??= (async () => {
    try {
      if (script.inlineIndex !== undefined) {
        const res = await request<{ text?: string; error?: string }>({ type: 'AI_SOURCE_FETCH', inlineIndex: script.inlineIndex })
        if (typeof res?.text !== 'string') throw new Error(res?.error || 'Inline script not found')
        script.text = res.text
        script.map = await loadMap(script).catch(() => null)
        return
      }
      const { text, sourceMap } = await fetchText(script.url)
      script.text = text
      script.map = await loadMap(script, sourceMap).catch(() => null)
    } catch (e) {
      script.error = String((e as Error)?.message || e)
    }
  })()
  return script.loading
}

async function loadAll(list: Script[]): Promise<void> {
  let next = 0
  const worker = async () => {
    while (next < list.length) await loadScript(list[next++])
  }
  await Promise.all(Array.from({ length: Math.min(PARALLEL, list.length) }, worker))
}

function documentKey(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return url
  }
}

/** What the code tools could read, so "not found" is not taken for "not in the page code" */
function coverage(): string {
  const all = Array.from(scripts.values())
  const failed = all.filter(s => s.error)
  const parts = [`Searched ${all.length - failed.length} scripts`]
  if (failed.length) parts.push(`${failed.length} could not be loaded (${failed.slice(0, 3).map(s => `${s.url}: ${s.error}`).join('; ')}${failed.length > 3 ? '; ...' : ''})`)
  if (pageList?.skipped) parts.push(`${pageList.skipped} more scripts are over the limit and not read`)
  return `${parts.join(', ')}.`
}

async function refreshList(): Promise<void> {
  if (pageList && Date.now() - pageList.at < LIST_TTL_MS) return
  listing ??= (async () => {
    try {
      const res = await request<{ page: PageList['page']; scripts: string[]; inline: Array<{ index: number }> }>({ type: 'AI_SOURCES_LIST' })
      // SPA routes change the hash or the path, not the loaded code: only another document resets the cache
      if (pageList && documentKey(pageList.page.url) !== documentKey(res.page.url)) scripts.clear()
      const fresh = res.scripts.filter(url => !scripts.has(url))
      const room = Math.max(0, MAX_SCRIPTS - scripts.size)
      pageList = { page: res.page, at: Date.now(), skipped: Math.max(0, fresh.length - room) }
      for (const url of fresh.slice(0, room)) ensureScript(url)
      for (const s of res.inline) ensureScript(`inline-script-${s.index}`, s.index)
    } finally {
      listing = null
    }
  })()
  await listing
  await loadAll(Array.from(scripts.values()))
}

function originals(): Original[] {
  const byPath = new Map<string, Original>()
  for (const script of scripts.values()) {
    const map = script.map
    if (!map) continue
    map.sources.forEach((source, index) => {
      const path = displayPath(source)
      const prev = byPath.get(path)
      // Vue SFC parts share a path; prefer the entry with the whole file
      if (!prev || (!prev.script.map!.sourcesContent[prev.index] && map.sourcesContent[index]) || (!source.includes('?') && prev.script.map!.sources[prev.index].includes('?'))) {
        byPath.set(path, { path, script, index })
      }
    })
  }
  return Array.from(byPath.values())
}

function originalText(o: Original): string | null {
  return o.script.map?.sourcesContent[o.index] ?? null
}

function numbered(lines: string[], from: number, to: number, mark?: number): string {
  const out: string[] = []
  for (let i = from; i <= to && i <= lines.length; i++) {
    let text = lines[i - 1]
    if (text.length > LONG_LINE) text = `${text.slice(0, LONG_LINE)}... [${text.length - LONG_LINE} chars cut]`
    out.push(`${i === mark ? '>' : ' '}${String(i).padStart(5)}| ${text}`)
  }
  return out.join('\n')
}

/** Long lines of a minified file, for a position the model got wrong */
function longLines(lines: string[]): string {
  const long = lines.map((text, i) => ({ line: i + 1, length: text.length })).filter(l => l.length > LONG_LINE).slice(0, 5)
  return long.length ? ` Long lines: ${long.map(l => `${l.line} (${l.length} chars)`).join(', ')}.` : ''
}

/** A window of a (possibly minified) generated line around `column` */
function generatedSnippet(script: Script, line: number, column: number, context: number, chars = SNIPPET_CHARS): string {
  const lines = script.text!.split('\n')
  const target = lines[line - 1]
  if (target === undefined) return `Line ${line} is out of range (the file has ${lines.length} lines).${longLines(lines)}`
  if (column > target.length) {
    return `Column ${column + 1} is past the end of line ${line} (${target.length} chars).${longLines(lines)} Pass query instead of a position to read around a text.`
  }
  if (target.length > LONG_LINE) {
    const start = Math.max(0, column - chars)
    const piece = target.slice(start, column + chars)
    return `Line ${line} is ${target.length} chars long (minified); chars ${start}..${start + piece.length}, the column is marked with ⟦⟧:\n${piece.slice(0, column - start)}⟦⟧${piece.slice(column - start)}`
  }
  return numbered(lines, Math.max(1, line - context), line + context, line)
}

function stripQuery(url: string): string {
  return url.replace(/[?#].*$/, '')
}

function findScript(path: string): Script | undefined {
  const exact = scripts.get(path)
  if (exact) return exact
  const bare = stripQuery(path)
  for (const script of scripts.values()) if (stripQuery(script.url) === bare) return script
  return undefined
}

/** A loaded script whose URL contains the text (a chunk name such as `agreement-cars`), when only one does */
function findScriptPart(path: string): Script | Script[] | undefined {
  const needle = stripQuery(path).toLowerCase()
  if (needle.length < 3) return undefined
  const found = Array.from(scripts.values()).filter(s => s.text !== undefined && stripQuery(s.url).toLowerCase().includes(needle))
  return found.length === 1 ? found[0] : found.length ? found : undefined
}

function findOriginals(path: string): Original[] {
  const wanted = displayPath(path).toLowerCase()
  const all = originals()
  const exact = all.filter(o => o.path.toLowerCase() === wanted)
  if (exact.length) return exact
  return all.filter(o => o.path.toLowerCase().endsWith(`/${wanted}`) || o.path.toLowerCase().endsWith(wanted))
}

/**
 * Code around the first app frames of an error stack, mapped to the original files when the
 * page ships source maps. Library and extension frames are skipped.
 */
export async function stackCode(stack: string): Promise<string> {
  const out: string[] = []
  const seen = new Set<string>()
  for (const frame of parseFrames(stack)) {
    if (out.length >= STACK_FRAMES) break
    if (!/^https?:/i.test(frame.url) || isLibrary(new URL(frame.url).pathname.slice(1))) continue
    const script = findScript(frame.url) ?? ensureScript(frame.url)
    await loadScript(script)
    // Inline scripts report the page URL, which loads the HTML document
    if (script.text === undefined || /^\s*</.test(script.text)) continue
    const column = Math.max(0, frame.colno - 1)
    const pos = script.map ? originalPosition(script.map, frame.lineno, column) : null
    const text = pos ? script.map!.sourcesContent[pos.source] : null
    if (pos && text != null) {
      const file = displayPath(script.map!.sources[pos.source])
      if (isLibrary(file) || seen.has(`${file}:${pos.line}`)) continue
      seen.add(`${file}:${pos.line}`)
      const lines = text.split('\n')
      out.push(`${frame.line}\n  maps to ${file}:${pos.line}:${pos.column + 1}\n${numbered(lines, Math.max(1, pos.line - STACK_CONTEXT), pos.line + STACK_CONTEXT, pos.line)}`)
      continue
    }
    const key = `${script.url}:${frame.lineno}:${frame.colno}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(`${frame.line}\n${generatedSnippet(script, frame.lineno, column, STACK_CONTEXT, STACK_COLUMN_CHARS)}`)
  }
  return out.join('\n\n')
}

// ---------------------------------------------------------------- tools

export async function listSources(filter?: unknown, includeLibraries?: unknown): Promise<string> {
  await refreshList()
  const needle = typeof filter === 'string' ? filter.toLowerCase() : ''
  const libs = includeLibraries === true
  const out: string[] = []
  if (pageList) out.push(`Page: ${pageList.page.url}${pageList.page.title ? ` (${pageList.page.title})` : ''}`)

  const scriptLines: string[] = []
  for (const s of scripts.values()) {
    if (needle && !s.url.toLowerCase().includes(needle)) continue
    const size = s.text !== undefined ? `${Math.round(s.text.length / 1024)} KB` : s.error ? `not loaded: ${s.error}` : 'not loaded'
    const map = s.map ? `source map: ${s.map.sources.length} files` : 'no source map'
    scriptLines.push(`- ${s.url} (${size}, ${map})`)
  }
  out.push('', `Scripts (${scriptLines.length}${pageList?.skipped ? `, ${pageList.skipped} more over the limit are not read` : ''}):`, ...scriptLines.slice(0, MAX_LIST))

  const files = originals()
    .filter(o => (libs || !isLibrary(o.path)) && (!needle || o.path.toLowerCase().includes(needle)))
    .sort((a, b) => a.path.localeCompare(b.path))
  const hidden = libs ? 0 : originals().filter(o => isLibrary(o.path)).length
  out.push('', `Original files from source maps (${files.length}${hidden ? `, ${hidden} library files hidden` : ''}):`)
  for (const o of files.slice(0, MAX_LIST)) out.push(`- ${o.path}${originalText(o) == null ? ' (content not embedded)' : ''}`)
  if (files.length > MAX_LIST) out.push(`... ${files.length - MAX_LIST} more, narrow with filter`)
  if (!files.length && !hidden) out.push('None: the page has no source maps, read the scripts instead.')
  return cut(out.join('\n'), RESULT_CHARS)
}

export async function readSource(args: Record<string, unknown>): Promise<string> {
  await refreshList()
  const path = String(args.path ?? '').trim()
  if (!path) return 'Pass a path: a script URL or an original file path from list_sources.'
  const line = Number(args.line) || 0
  const column = Math.max(0, (Number(args.column) || 1) - 1)
  const context = Math.min(80, Math.max(3, Number(args.context) || 20))
  const chars = Math.min(MAX_SNIPPET_CHARS, Math.max(200, Number(args.chars) || SNIPPET_CHARS))
  const query = typeof args.query === 'string' ? args.query : ''
  const find = query ? matcher(query, args.regex === true, 50) : null
  if (typeof find === 'string') return find
  const around = (name: string, text: string) =>
    cut(readAround(name, text, find!, chars) ?? `No match for "${query}" in ${name}. search_source lists the files that contain it.`, RESULT_CHARS)

  let script = findScript(path)
  if (!script && /^https?:/i.test(path)) {
    script = ensureScript(path)
    await loadScript(script)
  }
  if (!script && !findOriginals(path).length) {
    const part = findScriptPart(path)
    if (Array.isArray(part)) return `Several scripts match "${path}":\n${part.slice(0, 20).map(s => `- ${s.url}`).join('\n')}`
    script = part
  }
  if (script) {
    if (script.error) return `Could not load ${script.url}: ${script.error}`
    if (find && script.text !== undefined) return around(script.url, script.text)
    if (line && script.map) {
      const pos = originalPosition(script.map, line, column)
      const text = pos ? script.map.sourcesContent[pos.source] : null
      if (pos && text != null) {
        const file = displayPath(script.map.sources[pos.source])
        const lines = text.split('\n')
        return cut(`${script.url}:${line}:${column + 1} maps to ${file}:${pos.line}:${pos.column + 1}\n\n${numbered(lines, Math.max(1, pos.line - context), pos.line + context, pos.line)}`, RESULT_CHARS)
      }
    }
    const lines = script.text!.split('\n')
    const mapNote = script.map ? '' : ', no source map'
    if (line && !(Number(args.column) > 0) && (lines[line - 1]?.length ?? 0) > LONG_LINE) {
      return `Line ${line} of ${script.url} is ${lines[line - 1].length} chars long (minified${mapNote}). Pass query (a piece of the code to read around) or the column: search_source reports matches in such lines as url:line:column.`
    }
    if (line) return cut(`${script.url}:${line}:${column + 1}${script.map ? ' (no mapping for this position)' : ' (no source map)'}\n\n${generatedSnippet(script, line, column, context, chars)}`, RESULT_CHARS)
    if (script.text!.length / lines.length > MINIFIED_LINE) {
      return `${script.url} is minified (${lines.length} lines, ${Math.round(script.text!.length / 1024)} KB${mapNote}): a range of it is not readable. Call read_source with query (a piece of the code, as search_source found it) or with line and column.`
    }
    const from = Math.max(1, Number(args.start_line) || 1)
    const to = Math.min(lines.length, Number(args.end_line) || from + 199)
    return cut(`${script.url} lines ${from}..${to} of ${lines.length}\n\n${numbered(lines, from, to)}`, RESULT_CHARS)
  }

  const matches = findOriginals(path)
  if (!matches.length) return `No script or original file matches "${path}". Call list_sources to see the available files.`
  if (matches.length > 1 && matches.some(m => m.path !== matches[0].path)) {
    return `Several files match "${path}":\n${matches.slice(0, 20).map(m => `- ${m.path}`).join('\n')}`
  }
  const file = matches[0]
  const text = originalText(file)
  if (text == null) return `${file.path}: the source map does not embed its content. Read the generated script ${file.script.url} instead.`
  if (find) return around(file.path, text)
  const lines = text.split('\n')
  if (line) return cut(`${file.path}:${line}\n\n${numbered(lines, Math.max(1, line - context), line + context, line)}`, RESULT_CHARS)
  const from = Math.max(1, Number(args.start_line) || 1)
  const to = Math.min(lines.length, Number(args.end_line) || from + 399)
  return cut(`${file.path} lines ${from}..${to} of ${lines.length}\n\n${numbered(lines, from, to)}`, RESULT_CHARS)
}

/** Case-insensitive text that also matches its non-ASCII letters written as \uXXXX escapes, as minifiers often do, and any kind of space */
function escapedTextPattern(text: string): RegExp {
  const escape = (c: string) => `\\\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`
  const source = Array.from(text.replace(/\s+/g, ' ')).map(c => {
    // Typography puts non-breaking spaces between words: "s&nbsp;ROP", "\u00a0"
    if (c === ' ') return '(?:\\s|&nbsp;|&#160;|\\\\u00a0|\\\\xa0)+'
    if (!/[^\x00-\x7f]/.test(c)) return c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const variants = new Set([c.toLowerCase(), c.toUpperCase()])
    return `(?:${Array.from(variants).flatMap(v => [v, escape(v)]).join('|')})`
  }).join('')
  return new RegExp(source, 'i')
}

/** Start indexes of the query in a line, at most `max`; or an error message for a bad regular expression */
function matcher(query: string, regex: boolean, max: number): ((line: string) => number[]) | string {
  let re: RegExp
  if (regex) {
    try {
      re = new RegExp(query, 'gi')
    } catch (e) {
      return `Invalid regular expression: ${(e as Error).message}`
    }
  } else {
    re = /[^\x00-\x7f]/.test(query) ? new RegExp(escapedTextPattern(query).source, 'gi') : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
  }
  return line => {
    const out: number[] = []
    re.lastIndex = 0
    for (let m = re.exec(line); m && out.length < max; m = re.exec(line)) {
      out.push(m.index)
      if (!m[0].length) re.lastIndex++
    }
    return out
  }
}

/** Windows around matches in a minified line; close matches share one window */
function matchWindows(text: string, at: number[], before: number, after: number): Array<{ from: number; to: number; at: number[] }> {
  const windows: Array<{ from: number; to: number; at: number[] }> = []
  for (const pos of at) {
    const last = windows[windows.length - 1]
    if (last && pos < last.to - 40) {
      last.at.push(pos)
      last.to = Math.min(text.length, Math.max(last.to, Math.min(pos + after, last.from + 2 * (before + after))))
      continue
    }
    windows.push({ from: Math.max(0, pos - before), to: Math.min(text.length, pos + after), at: [pos] })
  }
  return windows
}

/** Code of a minified line around a query: what read_source returns for `query` */
function readAround(name: string, text: string, find: (line: string) => number[], chars: number): string | null {
  const lines = text.split('\n')
  const out: string[] = []
  let total = 0
  for (let i = 0; i < lines.length; i++) {
    const at = find(lines[i])
    if (!at.length) continue
    total += at.length
    if (out.length >= QUERY_WINDOWS) continue
    if (lines[i].length <= LONG_LINE) {
      out.push(`${name}:${i + 1}\n${numbered(lines, Math.max(1, i + 1 - 20), i + 1 + 20, i + 1)}`)
      continue
    }
    for (const w of matchWindows(lines[i], at, chars, chars)) {
      if (out.length >= QUERY_WINDOWS) break
      out.push(`${name}:${i + 1}:${w.at[0] + 1} (chars ${w.from}..${w.to} of ${lines[i].length}${w.at.length > 1 ? `, ${w.at.length} matches` : ''}):\n${lines[i].slice(w.from, w.to)}`)
    }
  }
  if (!out.length) return null
  return `${total} match${total === 1 ? '' : 'es'}${total > out.length ? `, the first ${out.length} windows shown (pass a longer query or a regex to narrow)` : ''}\n\n${out.join('\n\n')}`
}

export async function searchSource(args: Record<string, unknown>): Promise<string> {
  await refreshList()
  const query = String(args.query ?? '')
  if (!query) return 'Pass a query.'
  const find = matcher(query, args.regex === true, LINE_MATCHES)
  if (typeof find === 'string') return find
  const scope = typeof args.path === 'string' ? args.path.toLowerCase() : ''
  const libs = args.include_libraries === true

  const found: string[] = []
  let total = 0
  const scan = (name: string, text: string) => {
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i]
      const at = find(lineText)
      if (!at.length) continue
      // Minified lines: every match with its column, a line is often the whole file
      if (lineText.length > 240) {
        for (const w of matchWindows(lineText, at, 120, 200)) {
          total++
          if (found.length < MAX_MATCHES) found.push(`${name}:${i + 1}:${w.at[0] + 1}: ...${lineText.slice(w.from, w.to).trim()}...`)
        }
        continue
      }
      total++
      if (found.length < MAX_MATCHES) found.push(`${name}:${i + 1}: ${lineText.trim()}`)
    }
  }

  const mappedScripts = new Set<Script>()
  for (const o of originals()) {
    if ((!libs && isLibrary(o.path)) || (scope && !o.path.toLowerCase().includes(scope))) continue
    const text = originalText(o)
    if (text == null) continue
    mappedScripts.add(o.script)
    scan(o.path, text)
  }
  for (const s of scripts.values()) {
    if (s.text === undefined || mappedScripts.has(s) || (scope && !s.url.toLowerCase().includes(scope))) continue
    scan(s.url, s.text)
  }
  const note = originals().some(o => originalText(o) != null) ? '' : `\n${NO_MAPS_NOTE}`
  if (!total) {
    return `No matches for "${query}". ${coverage()}${note}\nThe text may be built from parts, come from translations (search a shorter part or the i18n key) or from the server (search_logs), or live in a chunk that is not loaded yet: open the screen that shows it and search again.`
  }
  const next = 'To read more code around a match: read_source with the url and query (a distinctive piece of the match), no column needed.'
  return cut(`${total} matches${total > found.length ? `, first ${found.length} shown` : ''}:\n${found.join('\n')}\n${next}${note}`, RESULT_CHARS)
}
