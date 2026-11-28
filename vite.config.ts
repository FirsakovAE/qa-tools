import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { copyFileSync, existsSync, mkdirSync, cpSync, readFileSync, writeFileSync, rmSync } from 'fs'
import { join, dirname, normalize, posix } from 'path'
import { execFileSync } from 'node:child_process'
import { writeReleaseFeed } from './scripts/releaseFeed.ts'
import { writeGithubPagesRedirect } from './scripts/githubPagesRedirect.ts'

export default defineConfig(({ mode }) => {
  const chromeStore = mode === 'chrome'
  let bundleDir = ''
  return {
  base: './',
  plugins: [
    vue(),
    tailwindcss(),
    basicSsl(),
    viteStaticCopy({
      targets: [
        {
          src: 'manifest.json',
          dest: '.',
          transform: (content: string) => {
            if (!chromeStore) return content
            const manifest = JSON.parse(content)
            manifest.permissions = manifest.permissions.filter((p: string) => p !== 'scripting')
            return JSON.stringify(manifest, null, 2)
          },
        },
        { src: 'public/_locales/*', dest: '_locales' },
        { src: 'public/icons/*', dest: 'icons' },
        { src: 'public/defaultSettings.json', dest: '.' },
        // Standalone mode files
        { src: 'public/standalone/*', dest: 'standalone' },
        // DevTools page
        { src: 'src/devtools/devtools.html', dest: 'devtools' }
      ]
    }),
    {
      name: 'copy-html-entries',
      configResolved(config) {
        bundleDir = config.build.outDir
      },
      closeBundle() {
        const distPath = bundleDir

        // injected_ui: dist/src/injected-ui/index.html → dist/injected_ui/index.html
        const uiSrcHtml = join(distPath, 'src', 'injected-ui', 'index.html')
        const uiDestDir = join(distPath, 'injected_ui')
        const uiDestHtml = join(uiDestDir, 'index.html')
        if (existsSync(uiSrcHtml)) {
          if (!existsSync(uiDestDir)) mkdirSync(uiDestDir, { recursive: true })
          let content = readFileSync(uiSrcHtml, 'utf-8')
          content = content
            .replace(/src="\.\.\/\.\.\/injected_ui\/index\.js"/g, 'src="./index.js"')
            // One `..` stays under site prefix (/qa-tools/…); `../../assets` escapes to host /assets/
            .replace(/\.\.\/\.\.\/assets\//g, '../assets/')
          writeFileSync(uiDestHtml, content, 'utf-8')
        }

        // storage: dist/src/storage/index.html → dist/storage/index.html
        const storageSrcHtml = join(distPath, 'src', 'storage', 'index.html')
        const storageDestDir = join(distPath, 'storage')
        const storageDestHtml = join(storageDestDir, 'index.html')
        if (existsSync(storageSrcHtml)) {
          if (!existsSync(storageDestDir)) mkdirSync(storageDestDir, { recursive: true })
          let content = readFileSync(storageSrcHtml, 'utf-8')
          content = content
            .replace(/src="\.\.\/\.\.\/storage\/index\.js"/g, 'src="./index.js"')
            .replace(/href="\.\.\/\.\.\/assets\//g, 'href="../assets/')
          writeFileSync(storageDestHtml, content, 'utf-8')
        }

        // popup: dist/src/popup/popup.html → dist/popup/popup.html
        const popupSrcHtml = join(distPath, 'src', 'popup', 'popup.html')
        const popupDestDir = join(distPath, 'popup')
        const popupDestHtml = join(popupDestDir, 'popup.html')
        if (existsSync(popupSrcHtml)) {
          if (!existsSync(popupDestDir)) mkdirSync(popupDestDir, { recursive: true })
          let content = readFileSync(popupSrcHtml, 'utf-8')
          content = content
            .replace(/src="\.\.\/\.\.\/popup\/popup\.js"/g, 'src="./popup.js"')
            .replace(/<link rel="modulepreload"[^>]*>/g, '')
          writeFileSync(popupDestHtml, content, 'utf-8')
        }
      }
    },
    {
      name: 'prepare-site',
      configResolved(config) {
        bundleDir = config.build.outDir
      },
      closeBundle() {
        const distPath = bundleDir
        if (chromeStore) {
          const standalonePath = join(distPath, 'standalone')
          if (existsSync(standalonePath)) rmSync(standalonePath, { recursive: true, force: true })
          return
        }
        // Сайт для Cloudflare Pages (корень домена): лендинг, standalone, релизы, VitePress в /docs/
        const sitePath = join(process.cwd(), '.cloudflare', 'site')

        // Удаляем существующую папку сайта для избежания дублирования файлов
        if (existsSync(sitePath)) {
          rmSync(sitePath, { recursive: true, force: true })
        }
        mkdirSync(sitePath, { recursive: true })

        // Копируем standalone файлы
        const standaloneSrc = join(distPath, 'standalone')
        const standaloneDest = sitePath
        if (existsSync(standaloneSrc)) {
          cpSync(standaloneSrc, standaloneDest, { recursive: true, force: true })
        }

        // Копируем необходимые папки для работы standalone
        const foldersToCopy = ['js', 'injected_ui', 'storage', 'assets', 'icons']
        foldersToCopy.forEach(folder => {
          const srcPath = join(distPath, folder)
          const destPath = join(sitePath, folder)
          if (existsSync(srcPath)) {
            cpSync(srcPath, destPath, { recursive: true, force: true })
          }
        })

        // Исправляем пути в injected_ui/index.html сайта
        const injectedUiHtmlPath = join(sitePath, 'injected_ui', 'index.html')
        if (existsSync(injectedUiHtmlPath)) {
          let content = readFileSync(injectedUiHtmlPath, 'utf-8')
          // `../../assets` из injected_ui выходит за префикс сайта (/qa-tools/… на GitHub Pages)
          content = content
            .replace(/src="\.\.\/\.\.\/injected_ui\/index\.js"/g, 'src="./index.js"')
            .replace(/\.\.\/\.\.\/assets\//g, '../assets/')
          writeFileSync(injectedUiHtmlPath, content, 'utf-8')
        }

        // Исправляем пути в index.html лендинга
        const indexHtmlPath = join(sitePath, 'index.html')
        if (existsSync(indexHtmlPath)) {
          let content = readFileSync(indexHtmlPath, 'utf-8')

          // Исправляем пути к assets (убираем ведущий слеш)
          content = content.replace(/src="\/assets\//g, 'src="assets/')

          // Извлекаем inline-скрипт, применяем правки путей и сохраняем как main.js.
          // Это гарантирует, что любые изменения в public/standalone/index.html
          // автоматически попадают в main.js сайта при сборке.
          // Extract first script (bookmarklet, carousel, fade-in); second script (fetch) stays inline
          const inlineScriptPattern = /  <script>([\s\S]*?)<\/script>(?=\s*<script>|\s*<\/body>)/
          const inlineMatch = content.match(inlineScriptPattern)

          if (inlineMatch) {
            let scriptContent = inlineMatch[1]

            // Путь loader.js: на сайте он лежит в корне, а не в standalone/
            scriptContent = scriptContent.replace(
              /\/standalone\/loader\.js/g,
              '/loader.js'
            )

            const mainJsPath = join(sitePath, 'main.js')
            writeFileSync(mainJsPath, scriptContent.trim(), 'utf-8')
          }

          // Заменяем первый inline script на подключение внешнего файла (второй — fetch — остаётся inline)
          const externalScriptTag = `  <script src="./main.js"></script>\n`
          content = content.replace(inlineScriptPattern, externalScriptTag)
          writeFileSync(indexHtmlPath, content, 'utf-8')
        }

        // =============================
        // Cleanup cross-build artifacts
        // =============================

        // 1. Удаляем standalone из dist (extension build должен быть чистым)
        const standaloneDistPath = join(distPath, 'standalone')
        if (existsSync(standaloneDistPath)) {
          rmSync(standaloneDistPath, { recursive: true, force: true })
        }

        // 2. Удаляем extension-артефакты из сайта (standalone должен быть чистым)
        // Примечание: иконки оставляем, так как они могут понадобиться для standalone
        const docsArtifactsToRemove = [
          'manifest.json',
          'defaultSettings.json'
        ]

        docsArtifactsToRemove.forEach(name => {
          const target = join(sitePath, name)
          if (existsSync(target)) {
            rmSync(target, { recursive: true, force: true })
          }
        })

        // 3. Лента релизов + zip расширения → releases/ (не зависит от GitHub API)
        writeReleaseFeed({
          distDir: distPath,
          outDir: join(sitePath, 'releases'),
          manifestPath: join(process.cwd(), 'manifest.json'),
          changelogPath: join(process.cwd(), 'CHANGELOG.md'),
        })

        // 4. VitePress → .cloudflare/site/docs/ (маршрут /docs/)
        // `execFileSync('npx.cmd', …)` даёт EINVAL на части установок Windows; CLI через тот же node, что и сборка.
        const vitepressCli = join(process.cwd(), 'node_modules', 'vitepress', 'bin', 'vitepress.js')
        const realpathPreload = join(process.cwd(), 'scripts', 'win-realpath.cjs')
        execFileSync(process.execPath, ['--require', realpathPreload, vitepressCli, 'build', 'documentation'], {
          stdio: 'inherit',
          cwd: process.cwd(),
          env: process.env,
        })

        // 5. Cloudflare Pages: без корневого 404.html неизвестные пути отдают лендинг (режим SPA);
        // CORS как у GitHub Pages — букмарклет и standalone iframe грузят файлы с чужих origin.
        copyFileSync(join(sitePath, 'docs', '404.html'), join(sitePath, '404.html'))
        writeFileSync(join(sitePath, '_headers'), '/*\n  Access-Control-Allow-Origin: *\n', 'utf-8')

        // 6. Временно: docs/ (GitHub Pages) — редирект на Cloudflare
        writeGithubPagesRedirect({
          siteDir: sitePath,
          outDir: join(process.cwd(), 'docs'),
          targetOrigin: 'https://vue-inspector.pages.dev',
          repoPrefix: 'qa-tools',
        })
      }
    }
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: chromeStore ? 'chrome' : 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        injected_ui_html: 'src/injected-ui/index.html',
        storage_html: 'src/storage/index.html',
        popup_html: 'src/popup/popup.html',
        content: 'src/content/index.ts',
        background: 'src/background.ts',
        injected: 'src/injected/main.ts',
        devtools: 'src/devtools/devtools.ts',
        'ws-early': 'src/injected/ws-early.ts'
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (['content', 'background', 'injected', 'devtools', 'ws-early'].includes(chunkInfo.name)) {
            return 'js/[name].js'
          }
          if (chunkInfo.name === 'injected_ui_html') {
            return 'injected_ui/index.js'
          }
          if (chunkInfo.name === 'storage_html') {
            return 'storage/index.js'
          }
          if (chunkInfo.name === 'popup_html') {
            return 'popup/popup.js'
          }
          return 'assets/[name]-[hash].js'
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        // Prevent code splitting - extension scripts must be self-contained
        manualChunks: undefined
      },
      // Prevent code splitting that would break injected scripts
      preserveEntrySignatures: 'strict',
      plugins: [{
        name: 'inline-shared-chunks-for-scripts',
        generateBundle(_, bundle) {
          // Extension content/background scripts can't use ES `import` statements.
          // If Rollup splits a shared helper into a separate chunk, inline it back.
          const scriptEntries = ['js/content.js', 'js/background.js', 'js/injected.js', 'js/devtools.js', 'js/ws-early.js']
          let inlinedCount = 0

          for (const entryName of scriptEntries) {
            const entry = bundle[entryName]
            if (!entry || entry.type !== 'chunk') continue

            entry.code = entry.code.replace(
              /import\s*\{([^}]*)\}\s*from\s*"([^"]+)"\s*;?\n?/g,
              (fullMatch: string, namedImportsStr: string, relPath: string) => {
                const entryDir = entryName.substring(0, entryName.lastIndexOf('/'))
                const resolved = posix.normalize(posix.join(entryDir, relPath))
                const chunk = bundle[resolved]
                if (!chunk || chunk.type !== 'chunk') return fullMatch

                // Parse the chunk's export statement to build exportedName→localName map
                // e.g. "export{o as c, l as g}" → { c: 'o', g: 'l' }
                const exportMap: Record<string, string> = {}
                const exportMatch = chunk.code.match(/\bexport\s*\{([^}]*)\}\s*;?\s*$/)
                if (exportMatch) {
                  exportMatch[1].split(',').forEach((spec: string) => {
                    const parts = spec.trim().split(/\s+as\s+/)
                    if (parts.length === 2) {
                      exportMap[parts[1]] = parts[0]
                    } else {
                      exportMap[parts[0]] = parts[0]
                    }
                  })
                }

                const code = chunk.code.replace(/\bexport\s*\{[^}]*\}\s*;?\s*$/, '')

                // Compose import aliases through the export map:
                // import { g as Jo } + export { l as g } → Jo = l
                const aliases = namedImportsStr.split(',').filter((s: string) => s.trim()).map((s: string) => {
                  const m = s.trim().match(/^(\S+)\s+as\s+(\S+)$/)
                  const exportedName = m ? m[1] : s.trim()
                  const localAlias = m ? m[2] : s.trim()
                  const chunkLocal = exportMap[exportedName] || exportedName
                  return { chunkLocal, localAlias }
                })

                // The chunk runs in its own scope: its minified top-level names would otherwise
                // collide with the entry's own top-level names.
                const scopeVar = `__inlinedChunk${inlinedCount++}`
                const returned = aliases.map((a, i) => `_${i}:${a.chunkLocal}`).join(',')
                const aliasCode = aliases.map((a, i) => `var ${a.localAlias}=${scopeVar}._${i};`).join('')
                return `var ${scopeVar}=(()=>{${code}\nreturn{${returned}}})();${aliasCode}\n`
              }
            )

            // These run as classic scripts (injected into the page / loaded by the bookmarklet):
            // top-level minified names would share the page's global scope and clash with its
            // own globals (e.g. `const { h } = Vue` → "Identifier 'h' has already been declared").
            if (!/\b(import|export)\s*[{*]/.test(entry.code)) {
              entry.code = `(()=>{${entry.code}\n})();\n`
            }
          }
        }
      }]
    },
    chunkSizeWarningLimit: 3000
  },
  publicDir: false
  }
})