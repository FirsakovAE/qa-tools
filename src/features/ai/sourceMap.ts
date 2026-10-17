/**
 * Minimal source map v3 reader: original sources with their embedded content and the lookup
 * of a generated position. Index maps (`sections`) are not supported.
 */

export interface SourceMapData {
  sources: string[]
  sourcesContent: Array<string | null>
  /** Per generated line: segments [generatedColumn, sourceIndex, originalLine, originalColumn] */
  lines: number[][][] | null
  rawMappings: string
}

export interface OriginalPosition {
  source: number
  line: number
  column: number
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const B64_INDEX = new Map(Array.from(B64, (c, i) => [c, i]))

export function parseSourceMap(text: string): SourceMapData | null {
  let raw: any
  try {
    raw = JSON.parse(text.replace(/^\)\]\}'[^\n]*\n/, ''))
  } catch {
    return null
  }
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.sources) || typeof raw.mappings !== 'string') return null
  const root = typeof raw.sourceRoot === 'string' && raw.sourceRoot ? raw.sourceRoot.replace(/\/?$/, '/') : ''
  return {
    sources: raw.sources.map((s: unknown) => `${root}${String(s ?? '')}`),
    sourcesContent: Array.isArray(raw.sourcesContent) ? raw.sourcesContent : [],
    lines: null,
    rawMappings: raw.mappings,
  }
}

function decodeMappings(mappings: string): number[][][] {
  const lines: number[][][] = []
  let line: number[][] = []
  let source = 0
  let origLine = 0
  let origCol = 0
  let genCol = 0
  let segment: number[] = []
  let value = 0
  let shift = 0

  const pushValue = (v: number) => segment.push(v)
  const endSegment = () => {
    if (segment.length >= 4) {
      genCol += segment[0]
      source += segment[1]
      origLine += segment[2]
      origCol += segment[3]
      line.push([genCol, source, origLine, origCol])
    } else if (segment.length >= 1) {
      genCol += segment[0]
    }
    segment = []
  }

  for (let i = 0; i < mappings.length; i++) {
    const c = mappings[i]
    if (c === ',') {
      endSegment()
      continue
    }
    if (c === ';') {
      endSegment()
      lines.push(line)
      line = []
      genCol = 0
      continue
    }
    const digit = B64_INDEX.get(c)
    if (digit === undefined) continue
    value += (digit & 31) << shift
    if (digit & 32) {
      shift += 5
      continue
    }
    pushValue(value & 1 ? -(value >>> 1) : value >>> 1)
    value = 0
    shift = 0
  }
  endSegment()
  lines.push(line)
  return lines
}

/** Original position of a generated 1-based line / 0-based column */
export function originalPosition(map: SourceMapData, line: number, column: number): OriginalPosition | null {
  if (!map.lines) map.lines = decodeMappings(map.rawMappings)
  const segments = map.lines[line - 1]
  if (!segments?.length) return null
  let found: number[] | null = null
  for (const seg of segments) {
    if (seg[0] > column) break
    found = seg
  }
  found ??= segments[0]
  return { source: found[1], line: found[2] + 1, column: found[3] }
}

/** `webpack:///./src/a.vue`, `../../src/a.vue` → `src/a.vue` */
export function displayPath(source: string): string {
  return source
    .replace(/^webpack:\/\/[^/]*\//, '')
    .replace(/^(vite|rollup|turbopack):\/*/, '')
    .replace(/^\/?(\.\.?\/)*/, '')
    .replace(/\?.*$/, '')
}
