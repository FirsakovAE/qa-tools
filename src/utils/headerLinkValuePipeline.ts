/**
 * Header link URL templates: `{value}` or `{value|op|...}` — pipeline left→right.
 * `|` inside a regex/alternation is OK if the next `|` is not followed by a known op (see findNextBoundary).
 *
 * MD5 routine adapted from JavaScript-MD5 (blueimp, MIT).
 */

const NO_ARG_OPS = [
  'trim',
  'lower',
  'upper',
  'urlencode',
  'urldecode',
  'base64encode',
  'base64decode',
  'hexencode',
  'hexdecode',
  'md5',
  'sha1',
  'sha256',
] as const

const NO_ARG_SET = new Set<string>(NO_ARG_OPS)

/** Longest prefix first — parametric ops */
const PREFIX_OP_PREFIXES = [
  'replaceRegex:',
  'replaceText:',
  'substring:',
  'split:',
  'ifMatch:',
  'default:',
  'match:',
  'replace:',
  'regex:',
] as const

function stepHead(step: string): string {
  const i = step.indexOf('|')
  return i === -1 ? step : step.slice(0, i)
}

function startsWithKnownOp(rest: string): boolean {
  const head = stepHead(rest)
  if (NO_ARG_SET.has(head)) return true
  for (const p of PREFIX_OP_PREFIXES) {
    if (rest.startsWith(p)) return true
  }
  return false
}

/** Index of `|` such that everything after starts a new op (or end of string). */
function findNextBoundary(s: string, start: number): number {
  for (let i = start; i < s.length; i++) {
    if (s[i] !== '|') continue
    const after = s.slice(i + 1)
    if (after.length === 0 || startsWithKnownOp(after)) return i
  }
  return s.length
}

export function parseValuePipeline(inner: string): string[] {
  const s = inner.replace(/^\|/, '')
  if (!s.trim()) return []
  const steps: string[] = []
  let pos = 0
  while (pos < s.length) {
    while (pos < s.length && s[pos] === '|') pos++
    if (pos >= s.length) break
    const end = findNextBoundary(s, pos)
    steps.push(s.slice(pos, end))
    pos = end < s.length ? end + 1 : end
  }
  return steps
}

type PipelineCtx = {
  value: string
  lastMatch: RegExpExecArray | null
}

function stripReplaceTemplate(tpl: string, m: RegExpExecArray | null): string {
  if (!m) return ''
  return tpl.replace(/\$(\d+)/g, (_, d) => {
    const n = Number(d)
    return m[n] ?? ''
  })
}

function tryRegex(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern)
  } catch {
    return null
  }
}

function utf8ToBinaryString(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (const b of bytes) {
    bin += String.fromCharCode(b)
  }
  return bin
}

function utf8FromBinaryString(bin: string): string {
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i) & 0xff
  }
  return new TextDecoder().decode(bytes)
}

function hexEncodeUtf8(s: string): string {
  const bytes = new TextEncoder().encode(s)
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function hexDecodeToUtf8(hex: string): string {
  const t = hex.trim().replace(/\s+/g, '')
  if (t.length % 2 !== 0) return ''
  try {
    const bytes = new Uint8Array(t.length / 2)
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(t.slice(i * 2, i * 2 + 2), 16)
    }
    return new TextDecoder().decode(bytes)
  } catch {
    return ''
  }
}

function base64EncodeUtf8(s: string): string {
  try {
    return btoa(utf8ToBinaryString(s))
  } catch {
    return ''
  }
}

function base64DecodeUtf8(s: string): string {
  try {
    return utf8FromBinaryString(atob(s.trim()))
  } catch {
    return ''
  }
}

function bufferToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function digestHex(alg: 'SHA-1' | 'SHA-256', text: string): Promise<string> {
  try {
    const subtle = globalThis.crypto?.subtle
    if (!subtle) return ''
    const data = new TextEncoder().encode(text)
    const buf = await subtle.digest(alg, data)
    return bufferToHex(buf)
  } catch {
    return ''
  }
}

/** MD5 hex digest of UTF-8 string (JavaScript-MD5 / blueimp, MIT). */
function md5Utf8(message: string): string {
  function safeAdd(x: number, y: number): number {
    const lsw = (x & 0xffff) + (y & 0xffff)
    const msw = (x >> 16) + (y >> 16) + (lsw >> 16)
    return (msw << 16) | (lsw & 0xffff)
  }
  function bitRotateLeft(num: number, cnt: number): number {
    return (num << cnt) | (num >>> (32 - cnt))
  }
  function md5cmn(q: number, a: number, b: number, x: number, s: number, t: number): number {
    return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b)
  }
  function md5ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return md5cmn((b & c) | (~b & d), a, b, x, s, t)
  }
  function md5gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return md5cmn((b & d) | (c & ~d), a, b, x, s, t)
  }
  function md5hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return md5cmn(b ^ c ^ d, a, b, x, s, t)
  }
  function md5ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return md5cmn(c ^ (b | ~d), a, b, x, s, t)
  }
  function binlMD5(x: number[], len: number): number[] {
    x[len >> 5] |= 0x80 << len % 32
    x[(((len + 64) >>> 9) << 4) + 14] = len
    let a = 1732584193
    let b = -271733879
    let c = -1732584194
    let d = 271733878
    for (let i = 0; i < x.length; i += 16) {
      const olda = a
      const oldb = b
      const oldc = c
      const oldd = d
      a = md5ff(a, b, c, d, x[i]!, 7, -680876936)
      d = md5ff(d, a, b, c, x[i + 1]!, 12, -389564586)
      c = md5ff(c, d, a, b, x[i + 2]!, 17, 606105819)
      b = md5ff(b, c, d, a, x[i + 3]!, 22, -1044525330)
      a = md5ff(a, b, c, d, x[i + 4]!, 7, -176418897)
      d = md5ff(d, a, b, c, x[i + 5]!, 12, 1200080426)
      c = md5ff(c, d, a, b, x[i + 6]!, 17, -1473231341)
      b = md5ff(b, c, d, a, x[i + 7]!, 22, -45705983)
      a = md5ff(a, b, c, d, x[i + 8]!, 7, 1770035416)
      d = md5ff(d, a, b, c, x[i + 9]!, 12, -1958414417)
      c = md5ff(c, d, a, b, x[i + 10]!, 17, -42063)
      b = md5ff(b, c, d, a, x[i + 11]!, 22, -1990404162)
      a = md5ff(a, b, c, d, x[i + 12]!, 7, 1804603682)
      d = md5ff(d, a, b, c, x[i + 13]!, 12, -40341101)
      c = md5ff(c, d, a, b, x[i + 14]!, 17, -1502002290)
      b = md5ff(b, c, d, a, x[i + 15]!, 22, 1236535329)
      a = md5gg(a, b, c, d, x[i + 1]!, 5, -165796510)
      d = md5gg(d, a, b, c, x[i + 6]!, 9, -1069501632)
      c = md5gg(c, d, a, b, x[i + 11]!, 14, 643717713)
      b = md5gg(b, c, d, a, x[i]!, 20, -373897302)
      a = md5gg(a, b, c, d, x[i + 5]!, 5, -701558691)
      d = md5gg(d, a, b, c, x[i + 10]!, 9, 38016083)
      c = md5gg(c, d, a, b, x[i + 15]!, 14, -660478335)
      b = md5gg(b, c, d, a, x[i + 4]!, 20, -405537848)
      a = md5gg(a, b, c, d, x[i + 9]!, 5, 568446438)
      d = md5gg(d, a, b, c, x[i + 14]!, 9, -1019803690)
      c = md5gg(c, d, a, b, x[i + 3]!, 14, -187363961)
      b = md5gg(b, c, d, a, x[i + 8]!, 20, 1163531501)
      a = md5gg(a, b, c, d, x[i + 13]!, 5, -1444681467)
      d = md5gg(d, a, b, c, x[i + 2]!, 9, -51403784)
      c = md5gg(c, d, a, b, x[i + 7]!, 14, 1735328473)
      b = md5gg(b, c, d, a, x[i + 12]!, 20, -1926607734)
      a = md5hh(a, b, c, d, x[i + 5]!, 4, -378558)
      d = md5hh(d, a, b, c, x[i + 8]!, 11, -2022574463)
      c = md5hh(c, d, a, b, x[i + 11]!, 16, 1839030562)
      b = md5hh(b, c, d, a, x[i + 14]!, 23, -35309556)
      a = md5hh(a, b, c, d, x[i + 1]!, 4, -1530992060)
      d = md5hh(d, a, b, c, x[i + 4]!, 11, 1272893353)
      c = md5hh(c, d, a, b, x[i + 7]!, 16, -155497632)
      b = md5hh(b, c, d, a, x[i + 10]!, 23, -1094730640)
      a = md5hh(a, b, c, d, x[i + 13]!, 4, 681279174)
      d = md5hh(d, a, b, c, x[i]!, 11, -358537222)
      c = md5hh(c, d, a, b, x[i + 3]!, 16, -722521979)
      b = md5hh(b, c, d, a, x[i + 6]!, 23, 76029189)
      a = md5hh(a, b, c, d, x[i + 9]!, 4, -640364487)
      d = md5hh(d, a, b, c, x[i + 12]!, 11, -421815835)
      c = md5hh(c, d, a, b, x[i + 15]!, 16, 530742520)
      b = md5hh(b, c, d, a, x[i + 2]!, 23, -995338651)
      a = md5ii(a, b, c, d, x[i]!, 6, -198630844)
      d = md5ii(d, a, b, c, x[i + 7]!, 10, 1126891415)
      c = md5ii(c, d, a, b, x[i + 14]!, 15, -1416354905)
      b = md5ii(b, c, d, a, x[i + 5]!, 21, -57434055)
      a = md5ii(a, b, c, d, x[i + 12]!, 6, 1700485571)
      d = md5ii(d, a, b, c, x[i + 3]!, 10, -1894986606)
      c = md5ii(c, d, a, b, x[i + 10]!, 15, -1051523)
      b = md5ii(b, c, d, a, x[i + 1]!, 21, -2054922799)
      a = md5ii(a, b, c, d, x[i + 8]!, 6, 1873313359)
      d = md5ii(d, a, b, c, x[i + 15]!, 10, -30611744)
      c = md5ii(c, d, a, b, x[i + 6]!, 15, -1560198380)
      b = md5ii(b, c, d, a, x[i + 13]!, 21, 1309151649)
      a = md5ii(a, b, c, d, x[i + 4]!, 6, -145523070)
      d = md5ii(d, a, b, c, x[i + 11]!, 10, -1120210379)
      c = md5ii(c, d, a, b, x[i + 2]!, 15, 718787259)
      b = md5ii(b, c, d, a, x[i + 9]!, 21, -343485551)
      a = safeAdd(a, olda)
      b = safeAdd(b, oldb)
      c = safeAdd(c, oldc)
      d = safeAdd(d, oldd)
    }
    return [a, b, c, d]
  }
  function binl2rstr(input: number[]): string {
    let output = ''
    const length32 = input.length * 32
    for (let i = 0; i < length32; i += 8) {
      output += String.fromCharCode((input[i >> 5]! >>> i % 32) & 0xff)
    }
    return output
  }
  function rstr2binl(input: string): number[] {
    const output: number[] = []
    output[(input.length >> 2) - 1] = 0
    for (let i = 0; i < output.length; i += 1) output[i] = 0
    const length8 = input.length * 8
    for (let i = 0; i < length8; i += 8) {
      output[i >> 5]! |= (input.charCodeAt(i / 8) & 0xff) << i % 32
    }
    return output
  }
  function rstrMD5(s: string): string {
    return binl2rstr(binlMD5(rstr2binl(s), s.length * 8))
  }
  function rstr2hex(input: string): string {
    const hexTab = '0123456789abcdef'
    let output = ''
    for (let i = 0; i < input.length; i += 1) {
      const x = input.charCodeAt(i)
      output += hexTab.charAt((x >>> 4) & 0x0f) + hexTab.charAt(x & 0x0f)
    }
    return output
  }
  const raw = rstrMD5(utf8ToBinaryString(message))
  return rstr2hex(raw)
}

function parseReplaceRegexArg(arg: string): { pattern: string; template: string } {
  const idx = arg.lastIndexOf(':')
  if (idx === -1) return { pattern: arg, template: '' }
  return { pattern: arg.slice(0, idx), template: arg.slice(idx + 1) }
}

function parseReplaceTextArg(payload: string): { from: string; to: string } {
  const li = payload.lastIndexOf(':')
  if (li === -1) return { from: payload, to: '' }
  return { from: payload.slice(0, li), to: payload.slice(li + 1) }
}

function parseIfMatchArg(payload: string): {
  pattern: string
  truePart: string
  falsePart: string
} | null {
  const li = payload.lastIndexOf(':')
  if (li <= 0) return null
  const falsePart = payload.slice(li + 1)
  const mid = payload.slice(0, li).lastIndexOf(':')
  if (mid <= 0) return null
  const truePart = payload.slice(mid + 1, li)
  const pattern = payload.slice(0, mid)
  return { pattern, truePart, falsePart }
}

function parseSplitArg(payload: string): { delimiter: string; index: number } | null {
  const lastColon = payload.lastIndexOf(':')
  if (lastColon === -1) return null
  const idxStr = payload.slice(lastColon + 1)
  if (!/^\d+$/.test(idxStr)) return null
  return { delimiter: payload.slice(0, lastColon), index: Number(idxStr) }
}

async function applyStep(ctx: PipelineCtx, step: string): Promise<void> {
  const v = ctx.value

  for (const op of NO_ARG_OPS) {
    if (step === op) {
      switch (op) {
        case 'trim':
          ctx.value = v.trim()
          break
        case 'lower':
          ctx.value = v.toLowerCase()
          break
        case 'upper':
          ctx.value = v.toUpperCase()
          break
        case 'urlencode':
          ctx.value = encodeURIComponent(v)
          break
        case 'urldecode': {
          try {
            ctx.value = decodeURIComponent(v.replace(/\+/g, '%20'))
          } catch {
            ctx.value = v
          }
          break
        }
        case 'base64encode':
          ctx.value = base64EncodeUtf8(v)
          break
        case 'base64decode':
          ctx.value = base64DecodeUtf8(v)
          break
        case 'hexencode':
          ctx.value = hexEncodeUtf8(v)
          break
        case 'hexdecode':
          ctx.value = hexDecodeToUtf8(v)
          break
        case 'md5':
          ctx.value = md5Utf8(v)
          break
        case 'sha1':
          ctx.value = await digestHex('SHA-1', v)
          break
        case 'sha256':
          ctx.value = await digestHex('SHA-256', v)
          break
        default:
          break
      }
      return
    }
  }

  if (step.startsWith('regex:')) {
    const pattern = step.slice('regex:'.length)
    const re = tryRegex(pattern)
    if (!re) return
    const m = re.exec(v)
    ctx.lastMatch = m
    ctx.value = m?.[0] ?? ''
    return
  }

  if (step.startsWith('replace:')) {
    const tpl = step.slice('replace:'.length)
    ctx.value = stripReplaceTemplate(tpl, ctx.lastMatch)
    return
  }

  if (step.startsWith('replaceRegex:')) {
    const { pattern, template } = parseReplaceRegexArg(step.slice('replaceRegex:'.length))
    const re = tryRegex(pattern)
    if (!re) return
    ctx.value = v.replace(re, template)
    ctx.lastMatch = re.exec(v)
    return
  }

  if (step.startsWith('match:')) {
    const pattern = step.slice('match:'.length)
    const re = tryRegex(pattern)
    if (!re) return
    ctx.value = re.test(v) ? v : ''
    return
  }

  if (step.startsWith('default:')) {
    const fb = step.slice('default:'.length)
    if (v === '') ctx.value = fb
    return
  }

  if (step.startsWith('replaceText:')) {
    const { from, to } = parseReplaceTextArg(step.slice('replaceText:'.length))
    if (!from) return
    ctx.value = v.split(from).join(to)
    return
  }

  if (step.startsWith('substring:')) {
    const rest = step.slice('substring:'.length)
    const m = /^(-?\d+)(?::(-?\d+))?$/.exec(rest)
    if (!m) return
    const start = Number(m[1])
    const len = m[2] === undefined ? undefined : Number(m[2])
    ctx.value =
      len === undefined || len === null || Number.isNaN(len)
        ? v.slice(start)
        : v.substring(start, start + len)
    return
  }

  if (step.startsWith('split:')) {
    const parsed = parseSplitArg(step.slice('split:'.length))
    if (!parsed) return
    const parts = v.split(parsed.delimiter)
    const idx = parsed.index
    ctx.value = idx >= 0 && idx < parts.length ? parts[idx]! : ''
    return
  }

  if (step.startsWith('ifMatch:')) {
    const parsed = parseIfMatchArg(step.slice('ifMatch:'.length))
    if (!parsed) return
    const re = tryRegex(parsed.pattern)
    if (!re) return
    ctx.value = re.test(v) ? parsed.truePart : parsed.falsePart
    return
  }
}

/** Apply `{value...}` inner part (without braces); empty inner = raw value. */
export async function applyValuePipeline(headerValue: string, inner: string): Promise<string> {
  const trimmedInner = inner.trim()
  if (!trimmedInner || trimmedInner === '|') return headerValue

  const steps = parseValuePipeline(inner)
  if (!steps.length) return headerValue

  const ctx: PipelineCtx = { value: headerValue, lastMatch: null }
  for (const step of steps) {
    await applyStep(ctx, step)
  }
  return ctx.value
}

/** Replace every `{value...}` placeholder; supports pipelines (async for SHA / subtle). */
export async function buildHeaderLinkUrlFromPipeline(
  template: string,
  headerValue: string,
): Promise<string> {
  let result = ''
  let i = 0
  while (i < template.length) {
    const start = template.indexOf('{value', i)
    if (start === -1) {
      result += template.slice(i)
      break
    }
    result += template.slice(i, start)
    const end = template.indexOf('}', start)
    if (end === -1) {
      result += template.slice(start)
      break
    }
    const inner = template.slice(start + '{value'.length, end)
    result += await applyValuePipeline(headerValue, inner)
    i = end + 1
  }
  return result
}
