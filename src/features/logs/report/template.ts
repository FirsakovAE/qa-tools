/**
 * Static HTML report for exported logs (the only export format).
 *
 * The report is one self-contained file that opens offline: inline CSS (`report.css`), the
 * export payload as a JSON data block, the logs runtime (the same code the Logs tab uses to
 * restore states, titles and network entries) and a small renderer (`report.client.js`).
 *
 * Payload version 1: compact events, a shared network section and a snapshot pool
 * (`snapshots`) for identical values referenced from events as `{ __snap: id }`.
 *
 * A compressed report keeps the same JSON as gzip + base64 (`data-encoding="gzip-base64"`);
 * the loader (`report.boot.js`) unpacks it with DecompressionStream before rendering.
 */

import css from './report.css?raw'
import client from './report.client.js?raw'
import boot from './report.boot.js?raw'
import icon from '../../../../public/icons/icon16.png?inline'
import { createLogsRuntime } from '@/injected/logs/runtime'
import { buildAiDigest } from './aiDigest'
import { canCompressReport } from './compressSupport'
import type { StoredNetworkEntry } from '@/types/logs'
import type { BodyContent } from '@/types/network'

export const REPORT_DATA_ID = 'qa-logs-data'
export const LOGS_REPORT_FORMAT = 'vue-inspector-logs'
export const LOGS_REPORT_VERSION = 1

const DATA_OPEN = `<script type="application/json" id="${REPORT_DATA_ID}">`
const DATA_OPEN_GZIP = `<script type="application/octet-stream" id="${REPORT_DATA_ID}" data-encoding="gzip-base64">`
const DATA_CLOSE = '</script>'

/** Stored event: titles, subtitles and restorable states are derived when the file is read */
export interface ReportEvent {
  id: string
  kind: string
  timestamp: number
  key: string
  level: string
  data: Record<string, unknown>
}

export interface LogsReportPayload {
  format: typeof LOGS_REPORT_FORMAT
  version: number
  info: {
    name: string
    exportedAt: string
    count: number
    /** Display labels by event kind */
    kinds?: Record<string, { label: string }>
    [key: string]: unknown
  }
  events: ReportEvent[]
  /**
   * Identical immutable values stored once. Events reference an entry with `{ __snap: id }`.
   */
  snapshots?: Record<string, unknown>
  /** Network entries referenced by request / response events (`data.entryId`); bodies by ref */
  network?: {
    entries: Record<string, StoredNetworkEntry>
    bodies: Record<string, BodyContent>
  }
}

function minifyCss(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};,>])\s*/g, '$1')
    .replace(/:\s+/g, ':')
    .replace(/;}/g, '}')
    .trim()
}

/** Drops comment-only lines and indentation; line breaks are kept (no ASI changes) */
function compactJs(source: string): string {
  return source
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('//'))
    .join('\n')
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** JSON that cannot terminate the script element or break the parser */
function embedJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

/** Script text that cannot close the script element */
function embedScript(source: string): string {
  return source.replace(/<\/(script)/gi, '<\\/$1')
}

const STYLE = minifyCss(css)
const SCRIPT = embedScript([
  `var createLogsRuntime=(${createLogsRuntime.toString()});`,
  'var LogsRuntime=createLogsRuntime();',
  `var buildAiDigest=(${buildAiDigest.toString()});`,
  `function runLogsReport(QA_PAYLOAD,QA_PAYLOAD_TEXT){\n${compactJs(client)}\n}`,
  compactJs(boot),
].join('\n'))

async function gzipBase64(text: string): Promise<string> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

async function dataBlock(payload: LogsReportPayload, compress: boolean): Promise<string> {
  if (compress && canCompressReport()) {
    return `${DATA_OPEN_GZIP}${await gzipBase64(JSON.stringify(payload))}${DATA_CLOSE}`
  }
  return `${DATA_OPEN}${embedJson(payload)}${DATA_CLOSE}`
}

function sourceTag(info: LogsReportPayload['info']): string {
  const source = typeof info.generator === 'string' ? info.generator : info.name
  if (source.includes('Bookmarklet')) return 'Bookmarklet'
  if (source.includes('Extension')) return 'Extension'
  return ''
}

export interface RenderReportOptions {
  /** Store the data block as gzip + base64 (smaller file, needs DecompressionStream to open) */
  compress?: boolean
}

export async function renderLogsReport(payload: LogsReportPayload, options: RenderReportOptions = {}): Promise<string> {
  const title = `${payload.info.name} - ${payload.info.exportedAt}`
  const tag = sourceTag(payload.info)
  const tagHtml = tag ? `<span class="badge">${escapeHtml(tag)}</span>` : ''
  const data = await dataBlock(payload, !!options.compress)
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="generator" content="${escapeHtml(payload.info.name)}">
<title>${escapeHtml(title)}</title>
<style>${STYLE}</style>
</head>
<body>
<header class="nav">
<button id="menu" class="menu-btn" type="button" aria-label="Sections">&#9776;</button>
<div class="brand"><img id="brand-icon" class="brand-mark" src="${icon}" alt=""><span class="brand-copy"><span class="brand-line">Vue Inspector${tagHtml}</span><span class="brand-sub">Logs report</span></span></div>
<span id="nav-meta" class="nav-meta"></span>
<span class="nav-spacer"></span>
<label class="check"><input id="in-data" type="checkbox"> in data</label>
<input id="search" class="search" type="search" placeholder="Search events..." autocomplete="off">
<button id="export-ai" class="nav-btn" type="button" title="Download a compact Markdown digest with a guide for an AI assistant (.md)">Brief<span class="nav-btn-long"> for</span> AI</button>
<button id="export-json" class="nav-btn" type="button" title="Download every event in full, as the Raw tab shows it (.json)">RAW<span class="nav-btn-long"> JSON</span></button>
</header>
<div id="sidebar-backdrop" class="sidebar-backdrop"></div>
<div class="layout">
<nav id="sidebar" class="sidebar" aria-label="Sections"></nav>
<main id="main" class="main"><noscript>This report needs JavaScript to display events.</noscript></main>
<section id="details" class="details" aria-label="Event details"></section>
</div>
${data}
<script>${SCRIPT}</script>
</body>
</html>
`
}

