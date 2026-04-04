/**
 * Serves the `docs/` folder like a GitHub Pages project site (/{repo}/… URLs),
 * so VitePress base `/qa-tools/docs/` and asset paths match production.
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DOCS_ROOT = path.resolve(__dirname, '../docs')
const SITE_PREFIX =
  '/' + (process.env.GH_PAGES_REPO || process.env.VITEPRESS_REPO || 'qa-tools').replace(/^\/+|\/+$/g, '')
/** If PORT is unset, try 5174 and then the next free port. If set, use only that port. */
const PORT_LOCKED = process.env.PORT !== undefined && String(process.env.PORT).trim() !== ''
const PREFERRED_PORT = PORT_LOCKED ? Number(process.env.PORT) : 5174
const PORT_SCAN_END = 5200

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
}

function resolveUnderRoot(rel) {
  const full = path.normalize(path.join(DOCS_ROOT, rel))
  if (!full.startsWith(DOCS_ROOT)) return null
  return full
}

function tryFile(filePath) {
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) return filePath
  return null
}

function resolvePublicPath(urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]).replace(/^\//, '')
  if (!rel) {
    return tryFile(path.join(DOCS_ROOT, 'index.html'))
  }

  const direct = resolveUnderRoot(rel)
  if (direct) {
    const asFile = tryFile(direct)
    if (asFile) return asFile
    const indexNested = tryFile(path.join(direct, 'index.html'))
    if (indexNested) return indexNested
  }

  const withHtml = resolveUnderRoot(rel + '.html')
  if (withHtml) {
    const f = tryFile(withHtml)
    if (f) return f
  }

  const indexHtml = resolveUnderRoot(path.join(rel, 'index.html'))
  if (indexHtml) {
    const f = tryFile(indexHtml)
    if (f) return f
  }

  return null
}

function handleRequest(req, res) {
  const rawUrl = req.url || '/'
  const url = new URL(rawUrl, 'http://127.0.0.1')
  let p = url.pathname

  res.setHeader('Access-Control-Allow-Origin', '*')

  if (p === '/' || p === '') {
    res.writeHead(302, { Location: SITE_PREFIX + '/' })
    res.end()
    return
  }

  if (!p.startsWith(SITE_PREFIX)) {
    res.writeHead(404)
    res.end(`Not found. Open ${SITE_PREFIX}/ (GitHub Pages-style prefix).`)
    return
  }

  p = p.slice(SITE_PREFIX.length) || '/'
  const filePath = resolvePublicPath(p)

  if (!filePath) {
    res.writeHead(404)
    res.end('Not found')
    return
  }

  const ext = path.extname(filePath)
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream')
  fs.createReadStream(filePath).pipe(res)
}

function listen(port) {
  const server = http.createServer(handleRequest)
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && !PORT_LOCKED && port < PORT_SCAN_END) {
      listen(port + 1)
      return
    }
    if (err.code === 'EADDRINUSE') {
      console.error(
        `Port ${port} is already in use.${PORT_LOCKED ? ' Pick a different PORT.' : ` Tried up to ${PORT_SCAN_END - 1}.`}`,
      )
    } else {
      console.error(err)
    }
    process.exit(1)
  })
  server.listen(port, () => {
    if (!PORT_LOCKED && port !== PREFERRED_PORT) {
      console.log(`Port ${PREFERRED_PORT} is busy; using ${port} (set PORT=${port} to pin).`)
    }
    const u = `http://127.0.0.1:${port}${SITE_PREFIX}/`
    console.log(`Docs (same URL layout as GitHub Pages): ${u}`)
  })
}

listen(PREFERRED_PORT)
