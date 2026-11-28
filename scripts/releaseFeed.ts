/**
 * Static release feed published with the site (`docs/releases/`), so the extension and the landing
 * page don't depend on the GitHub Releases API (it returns 404 once the repository is private).
 * JSON files mirror the GitHub `releases/{latest,tags/vX}` response shape; asset URLs are relative
 * to the JSON file.
 */
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { zipSync, type Zippable } from 'fflate'

interface ChangelogEntry {
  version: string
  date: string | null
  body: string
}

interface FeedRelease {
  tag_name: string
  name: string
  body: string
  published_at: string
  assets: Array<{ name: string; browser_download_url: string; size: number }>
}

/** Fixed timestamp keeps the zip byte-identical between builds of the same `dist/`. */
const ZIP_MTIME = new Date('2000-01-01T00:00:00Z')

function parseChangelog(text: string): ChangelogEntry[] {
  const headers = [...text.matchAll(/^## \[([^\]]+)\](.*)$/gm)]
  const entries: ChangelogEntry[] = []
  headers.forEach((m, i) => {
    const version = m[1].trim()
    if (!/^\d+\.\d+\.\d+/.test(version)) return
    const start = m.index! + m[0].length
    const end = i + 1 < headers.length ? headers[i + 1].index! : text.length
    const date = m[2].match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null
    entries.push({ version, date, body: text.slice(start, end).trim() })
  })
  return entries
}

function collectFiles(dir: string, root: string, out: Zippable): void {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) collectFiles(full, root, out)
    else out[relative(root, full).split(sep).join('/')] = [readFileSync(full), { mtime: ZIP_MTIME }]
  }
}

function toFeedRelease(entry: ChangelogEntry, assets: FeedRelease['assets']): FeedRelease {
  const tag = `v${entry.version}`
  return {
    tag_name: tag,
    name: tag,
    body: entry.body,
    published_at: entry.date ? `${entry.date}T00:00:00Z` : '',
    assets,
  }
}

export function writeReleaseFeed(opts: {
  distDir: string
  outDir: string
  manifestPath: string
  changelogPath: string
}): void {
  const version: string = JSON.parse(readFileSync(opts.manifestPath, 'utf-8')).version
  const entries = parseChangelog(readFileSync(opts.changelogPath, 'utf-8').replace(/\r\n/g, '\n'))
  mkdirSync(opts.outDir, { recursive: true })

  const files: Zippable = {}
  collectFiles(opts.distDir, opts.distDir, files)
  const zip = zipSync(files, { level: 9 })
  const zipName = `qa-tools-v${version}.zip`
  writeFileSync(join(opts.outDir, zipName), zip)

  for (const entry of entries) {
    if (entry.version === version) continue
    writeFileSync(join(opts.outDir, `v${entry.version}.json`), JSON.stringify(toFeedRelease(entry, []), null, 2))
  }

  const current = entries.find(e => e.version === version) ?? { version, date: null, body: '' }
  const latest = toFeedRelease(current, [{ name: zipName, browser_download_url: zipName, size: zip.byteLength }])
  const latestJson = JSON.stringify(latest, null, 2)
  writeFileSync(join(opts.outDir, `v${version}.json`), latestJson)
  writeFileSync(join(opts.outDir, 'latest.json'), latestJson)
}
