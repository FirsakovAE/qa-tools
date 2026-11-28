/**
 * Temporary: GitHub Pages (`docs/` on master) only forwards visitors to the Cloudflare site.
 * Every page, including missing paths served via 404.html, redirects to the same path without the
 * `/{repo}` prefix. Runtime files stay so bookmarklets saved from github.io keep loading until
 * GitHub Pages is switched off. Remove this step together with GitHub Pages.
 */
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const RUNTIME_ENTRIES = ['js', 'injected_ui', 'storage', 'assets', 'icons', 'releases', 'loader.js']

function redirectPage(targetOrigin: string, repoPrefix: string): string {
  const prefixPattern = `^\\/${repoPrefix}(?=\\/|$)`
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Vue Inspector has moved</title>
  <meta name="robots" content="noindex">
  <link rel="canonical" href="${targetOrigin}/">
  <script>
    (function () {
      var path = location.pathname.replace(/${prefixPattern}/, '') || '/';
      location.replace('${targetOrigin}' + path + location.search + location.hash);
    })();
  </script>
  <meta http-equiv="refresh" content="0; url=${targetOrigin}/">
</head>
<body>
  <p>Vue Inspector has moved to <a href="${targetOrigin}/">${targetOrigin}</a>.</p>
</body>
</html>
`
}

export function writeGithubPagesRedirect(opts: {
  siteDir: string
  outDir: string
  targetOrigin: string
  repoPrefix: string
}): void {
  rmSync(opts.outDir, { recursive: true, force: true })
  mkdirSync(opts.outDir, { recursive: true })
  // Jekyll skips `_*.js` files (Rollup `_commonjsHelpers-….js`), which breaks injected_ui with 404.
  writeFileSync(join(opts.outDir, '.nojekyll'), '', 'utf-8')

  for (const entry of RUNTIME_ENTRIES) {
    const src = join(opts.siteDir, entry)
    if (existsSync(src)) cpSync(src, join(opts.outDir, entry), { recursive: true, force: true })
  }

  const page = redirectPage(opts.targetOrigin, opts.repoPrefix)
  writeFileSync(join(opts.outDir, 'index.html'), page, 'utf-8')
  writeFileSync(join(opts.outDir, '404.html'), page, 'utf-8')
}
