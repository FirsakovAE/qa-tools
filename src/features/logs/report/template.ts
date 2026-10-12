/**
 * Static HTML report for exported logs.
 *
 * The report is one self-contained file: inline CSS (`report.css`), the export payload as a
 * JSON data block and a small renderer (`report.client.js`). The module depends on nothing
 * from the app, so the template can change independently of the extension / Bookmark builds.
 * The data block is the same JSON as the JSON export, which is what Import Logs reads back.
 */

import css from './report.css?raw'
import client from './report.client.js?raw'
import icon from '../../../../public/icons/icon16.png?inline'

export const REPORT_DATA_ID = 'qa-logs-data'

const DATA_OPEN = `<script type="application/json" id="${REPORT_DATA_ID}">`
const DATA_CLOSE = '</script>'

export interface LogsReportPayload {
  info: {
    name: string
    exportedAt: string
    count: number
    version?: string
    /** Display labels by event kind */
    kinds?: Record<string, { label: string }>
    [key: string]: unknown
  }
  events: unknown[]
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

const STYLE = minifyCss(css)
const SCRIPT = compactJs(client)

export function renderLogsReport(payload: LogsReportPayload): string {
  const title = `${payload.info.name} - ${payload.info.exportedAt}`
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
<div class="brand"><img id="brand-icon" class="brand-mark" src="${icon}" alt="">Vue Inspector <small>Logs report</small></div>
<span id="nav-meta" class="nav-meta"></span>
<span class="nav-spacer"></span>
<label class="check"><input id="in-data" type="checkbox"> in data</label>
<input id="search" class="search" type="search" placeholder="Search events..." autocomplete="off">
</header>
<div class="layout">
<nav id="sidebar" class="sidebar" aria-label="Sections"></nav>
<main id="main" class="main"><noscript>This report needs JavaScript to display events. The raw data is embedded in this file and can be opened with Import Logs.</noscript></main>
<section id="details" class="details" aria-label="Event details"></section>
</div>
${DATA_OPEN}${embedJson(payload)}${DATA_CLOSE}
<script>${SCRIPT}</script>
</body>
</html>
`
}

export function isLogsReportHtml(text: string): boolean {
  return text.includes(`id="${REPORT_DATA_ID}"`)
}

/** Reads the export payload back from a report; null if the text is not a logs report */
export function extractLogsReportData(text: string): unknown | null {
  const start = text.indexOf(DATA_OPEN)
  if (start === -1) return null
  const from = start + DATA_OPEN.length
  const end = text.indexOf(DATA_CLOSE, from)
  if (end === -1) return null
  return JSON.parse(text.slice(from, end))
}
