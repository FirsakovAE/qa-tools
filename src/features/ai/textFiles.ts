/**
 * Text files of the current chat: picked with + → Text file, dropped or pasted on the composer,
 * or a long pasted text. The model gets an overview with the question; the content stays here
 * and the file tools (fileTools.ts) read it. A new chat or closing the app drops the files.
 */

import { extractPdfText, PdfError } from './pdfText'

export type TextFileFormat = 'txt' | 'log' | 'json' | 'har' | 'md' | 'csv' | 'pdf'

export interface AiTextFile {
  /** F1, F2...: the model passes it to the file tools */
  id: string
  name: string
  format: TextFileFormat
  pasted: boolean
  bytes: number
  /** Line ends are \n */
  text: string
  /** Char offset of every line start */
  lineStarts: number[]
  pages?: number
  /** Why a .json / .har file is read as plain text */
  jsonError?: string
  /** Went with a question: the chat history refers to it */
  sent: boolean
}

export class TextFileError extends Error {
  constructor(readonly reason: 'size' | 'binary' | 'pdf' | 'pdfEncrypted' | 'empty' | 'read') {
    super(reason)
  }
}

export const MAX_FILE_BYTES = 64 * 1024 * 1024
export const TEXT_FILE_ACCEPT = '.txt,.log,.json,.har,.md,.markdown,.csv,.tsv,.pdf,.ndjson,.jsonl,.xml,.yaml,.yml,text/*,application/json,application/pdf'

const FORMAT_LABELS: Record<TextFileFormat, string> = {
  txt: 'Text', log: 'Log', json: 'JSON', har: 'HAR', md: 'Markdown', csv: 'CSV', pdf: 'PDF',
}

const files = new Map<string, AiTextFile>()
/** Parsed JSON of a file, read on demand: a big HAR costs several times its size in memory */
const parsed = new WeakMap<AiTextFile, unknown>()
const lowered = new WeakMap<AiTextFile, string>()
let counter = 0

export function getTextFile(id: string): AiTextFile | undefined {
  return files.get(String(id ?? '').trim().toUpperCase().replace(/^#/, ''))
}

export function chatFiles(): AiTextFile[] {
  return [...files.values()].filter(f => f.sent)
}

export function hasChatFiles(): boolean {
  return chatFiles().length > 0
}

export function markFilesSent(ids: string[]): void {
  for (const id of ids) {
    const file = files.get(id)
    if (file) file.sent = true
  }
}

/** A file removed from the composer before it was sent */
export function releaseFile(id: string): void {
  if (files.get(id)?.sent === false) files.delete(id)
}

/** New chat: only the files still waiting in the composer stay */
export function dropChatFiles(keep: Iterable<string>): void {
  const kept = new Set(keep)
  for (const id of [...files.keys()]) if (!kept.has(id)) files.delete(id)
  if (!files.size) counter = 0
}

export function formatLabel(format: TextFileFormat): string {
  return FORMAT_LABELS[format]
}

export function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function lineCount(file: AiTextFile): number {
  return file.lineStarts.length
}

/** Rough: about 4 chars per token for English and code, fewer for other scripts */
export function tokenEstimate(chars: number): string {
  const n = Math.round(chars / 4)
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n)
}

/** Shown on the attachment chip */
export function fileMeta(file: AiTextFile): string {
  const lines = lineCount(file)
  const parts = [FORMAT_LABELS[file.format], sizeLabel(file.bytes)]
  if (file.pages) parts.push(`${file.pages} p.`)
  parts.push(`${lines.toLocaleString()} ${lines === 1 ? 'line' : 'lines'}`, `≈${tokenEstimate(file.text.length)} tokens`)
  return parts.join(' · ')
}

export function lowerText(file: AiTextFile): string {
  let text = lowered.get(file)
  if (text === undefined) {
    text = file.text.toLowerCase()
    // Lowercasing keeps offsets only when no char changes its length
    if (text.length !== file.text.length) text = file.text.replace(/[A-Z\u0400-\u042F]/g, c => c.toLowerCase())
    lowered.set(file, text)
  }
  return text
}

export function fileJson(file: AiTextFile): unknown {
  if (file.format !== 'json' && file.format !== 'har') return undefined
  if (!parsed.has(file)) parsed.set(file, JSON.parse(file.text))
  return parsed.get(file)
}

function lineStartsOf(text: string): number[] {
  const starts = [0]
  let i = text.indexOf('\n')
  while (i !== -1) {
    starts.push(i + 1)
    i = text.indexOf('\n', i + 1)
  }
  if (starts.length > 1 && starts[starts.length - 1] === text.length) starts.pop()
  return starts
}

/** 1-based line of a char offset */
export function lineAt(file: AiTextFile, offset: number): number {
  const starts = file.lineStarts
  let lo = 0
  let hi = starts.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (starts[mid] <= offset) lo = mid
    else hi = mid - 1
  }
  return lo + 1
}

export function lineText(file: AiTextFile, line: number): string {
  const start = file.lineStarts[line - 1]
  if (start === undefined) return ''
  const next = file.lineStarts[line]
  return file.text.slice(start, next === undefined ? file.text.length : next - 1)
}

function extension(name: string): string {
  return name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? ''
}

function isHar(value: unknown): boolean {
  const log = (value as { log?: { entries?: unknown } } | null)?.log
  return !!log && Array.isArray(log.entries)
}

function looksLikeJson(text: string): boolean {
  const start = text.trimStart()[0]
  const end = text.trimEnd().slice(-1)
  return (start === '{' && end === '}') || (start === '[' && end === ']')
}

/** JSON and HAR are parsed once here: a broken file is read as plain text */
function classify(text: string, ext: string): { format: TextFileFormat; json?: unknown; jsonError?: string } {
  const wantsJson = ext === 'json' || ext === 'har'
  if (wantsJson || looksLikeJson(text)) {
    try {
      const json = JSON.parse(text)
      return { format: isHar(json) ? 'har' : 'json', json }
    } catch (e) {
      if (wantsJson) return { format: 'txt', jsonError: String((e as Error)?.message || e) }
    }
  }
  if (ext === 'md' || ext === 'markdown') return { format: 'md' }
  if (ext === 'csv' || ext === 'tsv') return { format: 'csv' }
  if (ext === 'log' || ext === 'ndjson' || ext === 'jsonl') return { format: 'log' }
  if (!ext && (text.match(/^#{1,3} \S/gm)?.length ?? 0) >= 2) return { format: 'md' }
  return { format: 'txt' }
}

function decode(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2))
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2))
  return new TextDecoder('utf-8').decode(bytes)
}

function register(name: string, text: string, bytes: number, pasted: boolean, ext: string, pages?: number): AiTextFile {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  if (!clean.trim()) throw new TextFileError('empty')
  const kind = ext === 'pdf' ? { format: 'pdf' as const } : classify(clean, ext)
  const file: AiTextFile = {
    id: `F${++counter}`,
    name,
    format: kind.format,
    pasted,
    bytes,
    text: clean,
    lineStarts: lineStartsOf(clean),
    pages,
    jsonError: kind.jsonError,
    sent: false,
  }
  if ('json' in kind && kind.json !== undefined) parsed.set(file, kind.json)
  files.set(file.id, file)
  return file
}

export async function readTextFile(file: File): Promise<AiTextFile> {
  if (file.size > MAX_FILE_BYTES) throw new TextFileError('size')
  let bytes: Uint8Array
  try {
    bytes = new Uint8Array(await file.arrayBuffer())
  } catch {
    throw new TextFileError('read')
  }
  const ext = extension(file.name)
  const isPdf = ext === 'pdf' || (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)
  if (isPdf) {
    let result: { text: string; pages: number }
    try {
      result = await extractPdfText(bytes)
    } catch (e) {
      throw new TextFileError(e instanceof PdfError && e.message === 'encrypted' ? 'pdfEncrypted' : 'pdf')
    }
    if (!result.text.replace(/--- Page \d+ ---/g, '').trim()) throw new TextFileError('pdf')
    return register(file.name, result.text, file.size, false, 'pdf', result.pages)
  }
  const text = decode(bytes)
  if (text.slice(0, 8192).includes('\0')) throw new TextFileError('binary')
  return register(file.name, text, file.size, false, ext)
}

export function registerPastedText(text: string, name: string): AiTextFile {
  return register(name, text, new Blob([text]).size, true, '')
}
