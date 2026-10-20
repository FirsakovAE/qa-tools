/**
 * Indexed English documentation pages. Loaded on the first read_docs call so the rest of
 * the assistant does not keep every page in memory.
 */

const files = import.meta.glob<string>(
  ['../../../documentation/**/*.md', '!../../../documentation/ru/**', '!../../../documentation/releases/**'],
  { query: '?raw', import: 'default', eager: true },
)

interface Heading {
  line: number
  level: number
  text: string
  id: string
}

interface IndexedPage {
  id: string
  title: string
  text: string
  headings: Heading[]
}

function clean(raw: string): { title: string; text: string } {
  const front = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
  const title = front?.[1].match(/^title:\s*(.+)$/m)?.[1].trim() ?? ''
  const text = raw
    .slice(front?.[0].length ?? 0)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^[ \t]*!\[[^\]]*\]\([^)]*\)[ \t]*$/gm, '')
    .replace(/^[ \t]*<\/?[a-z][^\n]*>[ \t]*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { title, text }
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-')
}

function headings(lines: string[]): Heading[] {
  const result: Heading[] = []
  let fence = false
  lines.forEach((text, line) => {
    if (/^\s*```/.test(text)) fence = !fence
    const m = !fence && text.match(/^(#{1,6})\s+(.+?)\s*$/)
    if (!m) return
    const custom = m[2].match(/\s*\{#([^}]+)\}$/)
    const title = m[2].slice(0, custom?.index).replace(/[*`]/g, '')
    result.push({ line, level: m[1].length, text: title, id: custom?.[1] ?? slug(title) })
  })
  return result
}

const PAGES: IndexedPage[] = Object.entries(files)
  .map(([path, raw]) => {
    const page = { id: path.replace(/^.*\/documentation\//, '').replace(/\.md$/, ''), ...clean(raw) }
    return { ...page, headings: headings(page.text.split('\n')) }
  })
  .sort((a, b) => a.id.localeCompare(b.id))

function findSection(all: Heading[], section: string): Heading | undefined {
  const query = section.trim().toLowerCase().replace(/^#/, '')
  const ranked = [...all].sort((a, b) => (a.level === 1 ? 1 : 0) - (b.level === 1 ? 1 : 0))
  return ranked.find(h => h.text.toLowerCase() === query || h.id === query)
    ?? ranked.find(h => h.text.toLowerCase().includes(query))
}

function findPage(ref: string): IndexedPage | IndexedPage[] {
  const id = ref.trim().toLowerCase().replace(/^\/+/, '').replace(/#.*$/, '').replace(/\.md$/, '')
  const exact = PAGES.find(p => p.id === id)
  if (exact) return exact
  const byName = PAGES.filter(p => p.id.split('/').pop() === id || p.title.toLowerCase() === id)
  return byName.length === 1 ? byName[0] : byName.length ? byName : PAGES.filter(p => p.id.includes(id))
}

function readPage(page: IndexedPage, section?: string): string {
  const lines = page.text.split('\n')
  const all = page.headings
  const sections = all.filter(h => h.level >= 2 && h.level <= 3).map(h => h.text)
  const head = `# docs: ${page.id} (${page.title})`
  if (!section) {
    return sections.length > 2 ? `${head}\nSections: ${sections.join('; ')}\n\n${page.text}` : `${head}\n\n${page.text}`
  }
  const start = findSection(all, section)
  if (!start) return `${head}\nNo section "${section}". Sections: ${sections.join('; ')}`
  const end = all.find(h => h.line > start.line && h.level <= start.level)
  return `${head}\n\n${lines.slice(start.line, end?.line).join('\n').trim()}`
}

export function readDocs(pages: unknown, section?: string): string {
  const refs = (Array.isArray(pages) ? pages : pages ? [pages] : []).map(String).filter(Boolean).slice(0, 3)
  if (!refs.length) {
    return PAGES.map(p => `${p.id} — ${p.title}: ${p.headings.filter(h => h.level === 2).map(h => h.text).join('; ')}`).join('\n')
  }
  return refs.map(ref => {
    const anchor = ref.match(/#(.+)$/)?.[1]
    const found = findPage(ref)
    if (!Array.isArray(found)) return readPage(found, section || anchor)
    return found.length
      ? `Page "${ref}" is ambiguous: ${found.map(p => p.id).join(', ')}`
      : `No page "${ref}". Pages: ${PAGES.map(p => p.id).join(', ')}`
  }).join('\n\n---\n\n')
}
