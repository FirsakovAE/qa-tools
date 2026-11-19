/**
 * Text layer of a PDF without a PDF library: objects (also inside object streams), Flate
 * streams, page content with fonts mapped by their ToUnicode CMaps, form XObjects. Scanned
 * pages (images only) and encrypted files have no readable text.
 */

type PdfValue =
  | number
  | boolean
  | null
  | string
  | { name: string }
  | { str: string }
  | { ref: number }
  | PdfValue[]
  | PdfDict

interface PdfDict {
  dict: Record<string, PdfValue>
}

interface PdfObject {
  value: PdfValue
  /** Raw stream bytes as a binary string */
  stream?: string
}

interface FontMap {
  /** Code byte lengths of the CMap, longest first */
  lengths: number[]
  map: Map<string, string>
  twoByte: boolean
  /** Simple fonts: code byte -> text from /Differences */
  differences?: Map<number, string>
  /** Glyph advance per code in 1/1000 of the font size: tells a word gap from kerning */
  widths: Map<number, number>
  defaultWidth: number
}

export class PdfError extends Error {}

const MAX_FORM_DEPTH = 5

function binaryString(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    out += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000) as unknown as number[])
  }
  return out
}

function toBytes(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 0xff
  return bytes
}

/** Inflates what it can: a stream with junk after its end still gives its text */
async function inflate(data: string): Promise<string> {
  if (typeof DecompressionStream !== 'function') throw new PdfError('No DecompressionStream')
  const stream = new Blob([toBytes(data) as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'))
  const reader = stream.getReader()
  const parts: Uint8Array[] = []
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      parts.push(value)
    }
  } catch {
    // Truncated or padded stream: keep what was inflated
  }
  return parts.map(binaryString).join('')
}

const WS = /[\0\t\n\f\r ]/
const DELIM = /[()<>[\]{}/%]/

class Lexer {
  pos = 0
  constructor(readonly s: string, start = 0) {
    this.pos = start
  }

  skipSpace(): void {
    const s = this.s
    while (this.pos < s.length) {
      const c = s[this.pos]
      if (WS.test(c)) this.pos++
      else if (c === '%') {
        while (this.pos < s.length && s[this.pos] !== '\n' && s[this.pos] !== '\r') this.pos++
      } else break
    }
  }

  /** A value, an operator name ({ op }) or undefined at the end */
  next(): PdfValue | { op: string } | undefined {
    this.skipSpace()
    const s = this.s
    if (this.pos >= s.length) return undefined
    const c = s[this.pos]
    if (c === '/') {
      let end = this.pos + 1
      while (end < s.length && !WS.test(s[end]) && !DELIM.test(s[end])) end++
      const name = s.slice(this.pos + 1, end).replace(/#([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
      this.pos = end
      return { name }
    }
    if (c === '(') return { str: this.literal() }
    if (c === '<') {
      if (s[this.pos + 1] === '<') {
        this.pos += 2
        return this.dictionary()
      }
      const end = s.indexOf('>', this.pos)
      const hex = s.slice(this.pos + 1, end < 0 ? s.length : end).replace(/[^0-9a-fA-F]/g, '')
      this.pos = end < 0 ? s.length : end + 1
      let str = ''
      for (let i = 0; i < hex.length; i += 2) str += String.fromCharCode(parseInt(hex.slice(i, i + 2).padEnd(2, '0'), 16))
      return { str }
    }
    if (c === '[') {
      this.pos++
      const list: PdfValue[] = []
      for (;;) {
        this.skipSpace()
        if (this.pos >= s.length) break
        if (s[this.pos] === ']') {
          this.pos++
          break
        }
        const item = this.next()
        if (item === undefined) break
        if (typeof item === 'object' && item && 'op' in item) {
          if (item.op === 'R' && list.length >= 2) {
            list.splice(-2, 2, { ref: Number(list[list.length - 2]) })
          }
          continue
        }
        list.push(item)
      }
      return list
    }
    if (c === '>' || c === ']' || c === ')' || c === '{' || c === '}') {
      this.pos++
      return this.next()
    }
    let end = this.pos
    while (end < s.length && !WS.test(s[end]) && !DELIM.test(s[end])) end++
    if (end === this.pos) end++
    const word = s.slice(this.pos, end)
    this.pos = end
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(word)) return Number(word)
    if (word === 'true') return true
    if (word === 'false') return false
    if (word === 'null') return null
    return { op: word }
  }

  private dictionary(): PdfDict {
    const dict: Record<string, PdfValue> = {}
    const s = this.s
    let key: string | null = null
    const values: PdfValue[] = []
    const flush = () => {
      if (key !== null && values.length) dict[key] = values[values.length - 1]
    }
    for (;;) {
      this.skipSpace()
      if (this.pos >= s.length) break
      if (s.startsWith('>>', this.pos)) {
        this.pos += 2
        break
      }
      const item = this.next()
      if (item === undefined) break
      if (typeof item === 'object' && item && 'op' in item) {
        if (item.op === 'R' && values.length >= 2) values.splice(-2, 2, { ref: Number(values[values.length - 2]) })
        continue
      }
      if (typeof item === 'object' && item && 'name' in item && (key === null || values.length)) {
        flush()
        key = item.name
        values.length = 0
        continue
      }
      values.push(item)
    }
    flush()
    return { dict }
  }

  private literal(): string {
    const s = this.s
    let depth = 0
    let out = ''
    this.pos++
    while (this.pos < s.length) {
      const c = s[this.pos++]
      if (c === '\\') {
        const n = s[this.pos++]
        if (n === undefined) break
        const esc: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' }
        if (n in esc) out += esc[n]
        else if (/[0-7]/.test(n)) {
          let oct = n
          while (oct.length < 3 && /[0-7]/.test(s[this.pos] ?? '')) oct += s[this.pos++]
          out += String.fromCharCode(parseInt(oct, 8) & 0xff)
        } else if (n === '\r') {
          if (s[this.pos] === '\n') this.pos++
        } else if (n !== '\n') out += n
      } else if (c === '(') {
        depth++
        out += c
      } else if (c === ')') {
        if (depth === 0) break
        depth--
        out += c
      } else out += c
    }
    return out
  }
}

function isDict(v: PdfValue | undefined): v is PdfDict {
  return !!v && typeof v === 'object' && 'dict' in v
}

function nameOf(v: PdfValue | undefined): string | undefined {
  return v && typeof v === 'object' && 'name' in v ? v.name : undefined
}

class PdfDocument {
  objects = new Map<number, PdfObject>()

  constructor(readonly data: string) {}

  resolve(v: PdfValue | undefined): PdfValue | undefined {
    for (let i = 0; i < 8 && v && typeof v === 'object' && 'ref' in v; i++) v = this.objects.get(v.ref)?.value
    return v
  }

  dictOf(v: PdfValue | undefined): Record<string, PdfValue> | undefined {
    const r = this.resolve(v)
    return isDict(r) ? r.dict : undefined
  }

  /** Top-level objects in file order: a later revision of an object replaces the earlier one */
  scan(): void {
    const re = /(\d+)\s+(\d+)\s+obj\b/g
    const s = this.data
    let m: RegExpExecArray | null
    while ((m = re.exec(s))) {
      const num = Number(m[1])
      const lexer = new Lexer(s, re.lastIndex)
      const value = lexer.next()
      if (value === undefined || (typeof value === 'object' && value && 'op' in value)) continue
      const obj: PdfObject = { value }
      lexer.skipSpace()
      if (isDict(value) && s.startsWith('stream', lexer.pos)) {
        let start = lexer.pos + 6
        if (s[start] === '\r') start++
        if (s[start] === '\n') start++
        const length = value.dict.Length
        let end = typeof length === 'number' && /^\s*endstream/.test(s.slice(start + length, start + length + 20)) ? start + length : -1
        if (end < 0) end = s.indexOf('endstream', start)
        if (end < 0) end = s.length
        obj.stream = s.slice(start, end)
        re.lastIndex = end
      }
      this.objects.set(num, obj)
    }
  }

  async streamData(obj: PdfObject | undefined): Promise<string | undefined> {
    if (!obj?.stream || !isDict(obj.value)) return undefined
    const filter = this.resolve(obj.value.dict.Filter)
    const filters = (Array.isArray(filter) ? filter : filter ? [filter] : []).map(f => nameOf(this.resolve(f)))
    let data = obj.stream
    for (const f of filters) {
      if (f === 'FlateDecode' || f === 'Fl') data = await inflate(data)
      else if (f === 'ASCIIHexDecode' || f === 'AHx') {
        const hex = data.replace(/>[\s\S]*$/, '').replace(/[^0-9a-fA-F]/g, '')
        let out = ''
        for (let i = 0; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2).padEnd(2, '0'), 16))
        data = out
      } else return undefined
    }
    return data
  }

  async streamOf(v: PdfValue | undefined): Promise<string | undefined> {
    for (let i = 0; i < 8 && v && typeof v === 'object' && 'ref' in v; i++) {
      const obj = this.objects.get(v.ref)
      if (obj?.stream) return this.streamData(obj)
      v = obj?.value
    }
    return undefined
  }

  /** Objects packed in object streams (PDF 1.5+): fonts and pages are often there */
  async unpackObjectStreams(): Promise<void> {
    for (const obj of [...this.objects.values()]) {
      if (!isDict(obj.value) || nameOf(obj.value.dict.Type) !== 'ObjStm') continue
      const data = await this.streamData(obj)
      const first = obj.value.dict.First
      const n = obj.value.dict.N
      if (!data || typeof first !== 'number' || typeof n !== 'number') continue
      const header = data.slice(0, first).trim().split(/\s+/).map(Number)
      for (let i = 0; i < n && i * 2 + 1 < header.length; i++) {
        const num = header[i * 2]
        if (this.objects.has(num)) continue
        const value = new Lexer(data, first + header[i * 2 + 1]).next()
        if (value !== undefined && !(typeof value === 'object' && value && 'op' in value)) this.objects.set(num, { value })
      }
    }
  }

  /** Pages in reading order: the page tree from the catalog, otherwise every page object */
  pages(): Record<string, PdfValue>[] {
    const roots = [...this.data.matchAll(/\/Root\s+(\d+)\s+\d+\s+R/g)]
    const catalog = roots.length ? this.dictOf({ ref: Number(roots[roots.length - 1][1]) }) : undefined
    const result: Record<string, PdfValue>[] = []
    const seen = new Set<Record<string, PdfValue>>()
    const walk = (node: PdfValue | undefined, inherited: PdfValue | undefined, depth: number) => {
      const dict = this.dictOf(node)
      if (!dict || seen.has(dict) || depth > 32) return
      seen.add(dict)
      const resources = dict.Resources ?? inherited
      const kids = this.resolve(dict.Kids)
      if (Array.isArray(kids)) {
        for (const kid of kids) walk(kid, resources, depth + 1)
      } else if (nameOf(dict.Type) === 'Page' || dict.Contents) {
        result.push({ ...dict, Resources: resources ?? null })
      }
    }
    if (catalog) walk(catalog.Pages, undefined, 0)
    if (result.length) return result
    return [...this.objects.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, o]) => (isDict(o.value) && nameOf(o.value.dict.Type) === 'Page' ? o.value.dict : null))
      .filter((d): d is Record<string, PdfValue> => !!d)
  }
}

function utf16be(bytes: string): string {
  let out = ''
  for (let i = 0; i + 1 < bytes.length; i += 2) out += String.fromCharCode((bytes.charCodeAt(i) << 8) | bytes.charCodeAt(i + 1))
  return out
}

function hexBytes(hex: string): string {
  let out = ''
  for (let i = 0; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2).padEnd(2, '0'), 16))
  return out
}

function incrementBytes(bytes: string, by: number): string {
  const codes = [...bytes].map(c => c.charCodeAt(0))
  let carry = by
  for (let i = codes.length - 1; i >= 0 && carry; i--) {
    const sum = codes[i] + carry
    codes[i] = sum & 0xff
    carry = sum >> 8
  }
  return String.fromCharCode(...codes)
}

function parseCMap(text: string): { map: Map<string, string>; lengths: number[] } {
  const map = new Map<string, string>()
  const lengths = new Set<number>()
  for (const block of text.matchAll(/begincodespacerange([\s\S]*?)endcodespacerange/g)) {
    for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>/g)) lengths.add(Math.ceil(m[1].length / 2))
  }
  for (const block of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g)) {
      map.set(hexBytes(m[1]), utf16be(hexBytes(m[2])))
      lengths.add(Math.ceil(m[1].length / 2))
    }
  }
  for (const block of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<[0-9a-fA-F]*>|\[[^\]]*\])/g)) {
      const lo = hexBytes(m[1])
      const count = Math.min(parseInt(m[2], 16) - parseInt(m[1], 16), 0xffff)
      lengths.add(lo.length)
      if (m[3].startsWith('[')) {
        const list = [...m[3].matchAll(/<([0-9a-fA-F]*)>/g)].map(x => utf16be(hexBytes(x[1])))
        list.forEach((dst, i) => { if (i <= count) map.set(incrementBytes(lo, i), dst) })
      } else {
        const dst = hexBytes(m[3].slice(1, -1))
        for (let i = 0; i <= count; i++) map.set(incrementBytes(lo, i), utf16be(incrementBytes(dst, i)))
      }
    }
  }
  return { map, lengths: [...lengths].sort((a, b) => b - a) }
}

/** Glyph names of /Differences that are common in text */
const GLYPHS: Record<string, string> = {
  space: ' ', period: '.', comma: ',', colon: ':', semicolon: ';', hyphen: '-', endash: '–', emdash: '—',
  quoteright: '’', quoteleft: '‘', quotedblleft: '“', quotedblright: '”', quotesingle: "'", quotedbl: '"',
  parenleft: '(', parenright: ')', slash: '/', underscore: '_', exclam: '!', question: '?', at: '@',
  numbersign: '#', percent: '%', ampersand: '&', asterisk: '*', plus: '+', equal: '=', bullet: '•',
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9',
  fi: 'fi', fl: 'fl', ellipsis: '…', bracketleft: '[', bracketright: ']', less: '<', greater: '>',
}

function glyphText(name: string): string | undefined {
  if (/^[A-Za-z]$/.test(name)) return name
  if (GLYPHS[name]) return GLYPHS[name]
  const uni = name.match(/^uni([0-9A-Fa-f]{4,})/)
  if (uni) return String.fromCodePoint(parseInt(uni[1].slice(0, 4), 16))
  const u = name.match(/^u([0-9A-Fa-f]{4,6})$/)
  if (u) return String.fromCodePoint(parseInt(u[1], 16))
  return undefined
}

async function fontMap(doc: PdfDocument, fontRef: PdfValue | undefined, cache: Map<unknown, FontMap>): Promise<FontMap> {
  const font = doc.dictOf(fontRef)
  const key = font ?? fontRef
  const cached = cache.get(key)
  if (cached) return cached
  const twoByte = nameOf(font?.Subtype) === 'Type0'
  const result: FontMap = { lengths: twoByte ? [2] : [1], map: new Map(), twoByte, widths: new Map(), defaultWidth: twoByte ? 1000 : 500 }
  if (twoByte) {
    const descendants = doc.resolve(font?.DescendantFonts)
    const cid = doc.dictOf(Array.isArray(descendants) ? descendants[0] : descendants)
    if (typeof cid?.DW === 'number') result.defaultWidth = cid.DW
    const w = doc.resolve(cid?.W)
    if (Array.isArray(w)) {
      for (let i = 0; i < w.length;) {
        const first = doc.resolve(w[i])
        const next = doc.resolve(w[i + 1])
        if (typeof first !== 'number') break
        if (Array.isArray(next)) {
          next.forEach((width, k) => { const v = doc.resolve(width); if (typeof v === 'number') result.widths.set(first + k, v) })
          i += 2
        } else {
          const last = next
          const width = doc.resolve(w[i + 2])
          if (typeof last !== 'number' || typeof width !== 'number') break
          for (let c = first; c <= last && c - first < 0xffff; c++) result.widths.set(c, width)
          i += 3
        }
      }
    }
  } else {
    const firstChar = doc.resolve(font?.FirstChar)
    const widths = doc.resolve(font?.Widths)
    if (typeof firstChar === 'number' && Array.isArray(widths)) {
      widths.forEach((width, k) => { const v = doc.resolve(width); if (typeof v === 'number') result.widths.set(firstChar + k, v) })
    }
  }
  const cmap = font ? await doc.streamOf(font.ToUnicode) : undefined
  if (cmap) {
    const parsed = parseCMap(cmap)
    result.map = parsed.map
    if (parsed.lengths.length) result.lengths = parsed.lengths
  }
  const encoding = doc.dictOf(font?.Encoding)
  const diffs = doc.resolve(encoding?.Differences)
  if (Array.isArray(diffs)) {
    result.differences = new Map()
    let code = 0
    for (const item of diffs) {
      if (typeof item === 'number') code = item
      else {
        const text = glyphText(nameOf(item) ?? '')
        if (text !== undefined) result.differences.set(code, text)
        code++
      }
    }
  }
  cache.set(key, result)
  return result
}

/** Windows-1252 differs from Latin-1 in 0x80-0x9F */
const WIN_ANSI: Record<number, string> = {
  0x80: '€', 0x82: '‚', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡', 0x89: '‰', 0x8b: '‹', 0x91: '‘',
  0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—', 0x99: '™', 0x9b: '›',
}

function codeNumber(bytes: string): number {
  let n = 0
  for (let i = 0; i < bytes.length; i++) n = n * 256 + bytes.charCodeAt(i)
  return n
}

/** Text of a shown string and its advance in 1/1000 of the font size */
function decodeText(bytes: string, font: FontMap | undefined): { text: string; advance: number } {
  if (!font) return { text: bytes, advance: bytes.length * 500 }
  let out = ''
  let advance = 0
  let i = 0
  while (i < bytes.length) {
    let len = 0
    let text: string | undefined
    if (font.map.size) {
      for (const l of font.lengths) {
        text = font.map.get(bytes.substr(i, l))
        if (text !== undefined) {
          len = l
          break
        }
      }
    }
    if (!len) len = font.twoByte ? 2 : 1
    const code = codeNumber(bytes.substr(i, len))
    advance += font.widths.get(code) ?? font.defaultWidth
    i += len
    if (text === undefined && !font.twoByte) {
      text = font.differences?.get(code) ?? WIN_ANSI[code] ?? (code >= 32 ? String.fromCharCode(code) : '')
    }
    out += text ?? ''
  }
  return { text: out, advance }
}

interface TextState {
  out: string[]
  font?: FontMap
  fontSize: number
  /** Horizontal scale of the text matrix */
  scale: number
  /** Start of the current line and the end of the last shown text, in text matrix units */
  lineX: number
  lineY: number
  endX?: number
  /** Line of the last shown text */
  textY?: number
}

/** A gap wider than this part of the font size is a space between words */
const WORD_GAP = 0.2

function newline(state: TextState): void {
  const last = state.out[state.out.length - 1]
  if (last !== undefined && last !== '\n') state.out.push('\n')
}

function space(state: TextState): void {
  const last = state.out[state.out.length - 1]
  if (last !== undefined && !/\s$/.test(last)) state.out.push(' ')
}

async function runContent(
  doc: PdfDocument,
  content: string,
  resources: PdfValue | undefined,
  state: TextState,
  fonts: Map<unknown, FontMap>,
  depth: number,
): Promise<void> {
  const res = doc.dictOf(resources)
  const fontDict = doc.dictOf(res?.Font)
  const xobjects = doc.dictOf(res?.XObject)
  const lexer = new Lexer(content)
  const operands: PdfValue[] = []
  const em = () => Math.abs(state.fontSize * state.scale) || 1
  const show = (bytes: string) => {
    const { text, advance } = decodeText(bytes, state.font)
    state.out.push(text)
    state.textY = state.lineY
    state.endX = (state.endX ?? state.lineX) + (advance / 1000) * state.fontSize * state.scale
  }
  /** The next text starts at x on the line y: a new line, a word gap or kerning */
  const moveTo = (x: number, y: number) => {
    if (state.textY !== undefined && Math.abs(y - state.textY) > em() * 0.5) {
      newline(state)
    } else if (state.endX !== undefined) {
      const gap = (x - state.endX) * Math.sign(state.scale || 1)
      if (gap > em() * WORD_GAP || gap < -em() * 2) space(state)
    }
    state.lineX = x
    state.lineY = y
    state.endX = x
  }
  for (;;) {
    const token = lexer.next()
    if (token === undefined) break
    if (!(token && typeof token === 'object' && 'op' in token)) {
      operands.push(token)
      if (operands.length > 64) operands.shift()
      continue
    }
    const op = token.op
    const str = (v: PdfValue | undefined) => (v && typeof v === 'object' && 'str' in v ? v.str : undefined)
    switch (op) {
      case 'Tf': {
        const name = nameOf(operands[operands.length - 2])
        const size = operands[operands.length - 1]
        state.font = name && fontDict ? await fontMap(doc, fontDict[name], fonts) : undefined
        if (typeof size === 'number') state.fontSize = size
        break
      }
      case 'Tj': {
        const s = str(operands[operands.length - 1])
        if (s !== undefined) show(s)
        break
      }
      case "'":
      case '"': {
        newline(state)
        state.endX = state.lineX
        const s = str(operands[operands.length - 1])
        if (s !== undefined) show(s)
        break
      }
      case 'TJ': {
        const list = operands[operands.length - 1]
        if (Array.isArray(list)) {
          for (const item of list) {
            if (typeof item === 'number') {
              if (item < -1000 * WORD_GAP) space(state)
              state.endX = (state.endX ?? state.lineX) - (item / 1000) * state.fontSize * state.scale
            } else {
              const s = str(item)
              if (s !== undefined) show(s)
            }
          }
        }
        break
      }
      case 'Td':
      case 'TD': {
        const ty = operands[operands.length - 1]
        const tx = operands[operands.length - 2]
        if (typeof tx === 'number' && typeof ty === 'number') moveTo(state.lineX + tx * state.scale, state.lineY + ty * Math.abs(state.scale))
        break
      }
      case 'T*':
        newline(state)
        state.endX = state.lineX
        break
      case 'Tm': {
        const [a, , , , e, f] = operands.slice(-6)
        if (typeof a === 'number' && typeof e === 'number' && typeof f === 'number') {
          state.scale = a || 1
          moveTo(e, f)
        }
        break
      }
      case 'BT':
        state.lineX = 0
        state.lineY = 0
        state.scale = 1
        break
      case 'ID': {
        const end = content.slice(lexer.pos).search(/\sEI(?=[\s/]|$)/)
        lexer.pos = end < 0 ? content.length : lexer.pos + end + 3
        break
      }
      case 'Do': {
        const name = nameOf(operands[operands.length - 1])
        const ref = name && xobjects ? xobjects[name] : undefined
        const form = doc.dictOf(ref)
        if (form && nameOf(form.Subtype) === 'Form' && depth < MAX_FORM_DEPTH) {
          const data = await doc.streamOf(ref)
          if (data) {
            const saved = state.font
            await runContent(doc, data, form.Resources ?? resources, state, fonts, depth + 1)
            state.font = saved
          }
        }
        break
      }
    }
    operands.length = 0
  }
}

function tidy(text: string): string {
  return text
    .replace(/[\0-\x08\x0b\x0c\x0e-\x1f]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Text of every page, each under a `--- Page N ---` line */
export async function extractPdfText(bytes: Uint8Array): Promise<{ text: string; pages: number }> {
  const data = binaryString(bytes)
  if (!data.startsWith('%PDF')) throw new PdfError('Not a PDF')
  if (/\/Encrypt\s/.test(data.slice(-4096)) || /\/Encrypt\s+\d+\s+\d+\s+R/.test(data)) throw new PdfError('encrypted')
  const doc = new PdfDocument(data)
  doc.scan()
  await doc.unpackObjectStreams()
  const pages = doc.pages()
  const fonts = new Map<unknown, FontMap>()
  const parts: string[] = []
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    const contents = doc.resolve(page.Contents)
    const refs = Array.isArray(contents) ? contents : [page.Contents]
    const streams: string[] = []
    for (const ref of refs) {
      const data = await doc.streamOf(ref)
      if (data) streams.push(data)
    }
    const state: TextState = { out: [], fontSize: 12, scale: 1, lineX: 0, lineY: 0 }
    await runContent(doc, streams.join('\n'), page.Resources ?? undefined, state, fonts, 0)
    parts.push(`--- Page ${i + 1} ---\n${tidy(state.out.join(''))}`)
  }
  return { text: parts.join('\n\n'), pages: pages.length }
}
