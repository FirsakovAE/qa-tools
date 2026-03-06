import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { copyFileSync, existsSync, mkdirSync, cpSync, readFileSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'

export default defineConfig({
  base: './',
  plugins: [
    vue(),
    tailwindcss(),
    viteStaticCopy({
      targets: [
        { src: 'manifest.json', dest: '.' },
        { src: 'public/icons/*', dest: 'icons' },
        { src: 'public/defaultSettings.json', dest: '.' },
        // Standalone mode files
        { src: 'public/standalone/*', dest: 'standalone' },
        // DevTools page
        { src: 'src/devtools/devtools.html', dest: 'devtools' }
      ]
    }),
    {
      name: 'copy-injected-ui-html',
      closeBundle() {
        const distPath = join(process.cwd(), 'dist')
        // Vite puts the HTML entry at dist/src/injected-ui/index.html (mirroring input path)
        // but the extension expects it at dist/injected_ui/index.html
        const srcHtml = join(distPath, 'src', 'injected-ui', 'index.html')
        const destDir = join(distPath, 'injected_ui')
        const destHtml = join(destDir, 'index.html')

        if (existsSync(srcHtml)) {
          if (!existsSync(destDir)) {
            mkdirSync(destDir, { recursive: true })
          }
          let content = readFileSync(srcHtml, 'utf-8')
          // Fix relative paths: the source HTML is 2 dirs deep (dist/src/injected-ui/),
          // but the destination is 1 dir deep (dist/injected_ui/)
          content = content
            .replace(/src="\.\.\/\.\.\/injected_ui\/index\.js"/g, 'src="./index.js"')
            .replace(/href="\.\.\/\.\.\/assets\//g, 'href="../assets/')
          writeFileSync(destHtml, content, 'utf-8')
        }
      }
    },
    {
      name: 'prepare-docs-for-github-pages',
      closeBundle() {
        const distPath = join(process.cwd(), 'dist')
        const docsPath = join(process.cwd(), 'docs')

        // Удаляем существующую папку docs для избежания дублирования файлов
        if (existsSync(docsPath)) {
          rmSync(docsPath, { recursive: true, force: true })
        }

        // Создаем папку docs
        mkdirSync(docsPath, { recursive: true })

        // Копируем standalone файлы
        const standaloneSrc = join(distPath, 'standalone')
        const standaloneDest = docsPath
        if (existsSync(standaloneSrc)) {
          cpSync(standaloneSrc, standaloneDest, { recursive: true, force: true })
        }

        // Копируем необходимые папки для работы standalone
        const foldersToCopy = ['js', 'injected_ui', 'assets', 'icons']
        foldersToCopy.forEach(folder => {
          const srcPath = join(distPath, folder)
          const destPath = join(docsPath, folder)
          if (existsSync(srcPath)) {
            cpSync(srcPath, destPath, { recursive: true, force: true })
          }
        })

        // Исправляем пути в injected_ui/index.html для docs/
        const injectedUiHtmlPath = join(docsPath, 'injected_ui', 'index.html')
        if (existsSync(injectedUiHtmlPath)) {
          let content = readFileSync(injectedUiHtmlPath, 'utf-8')
          // Заменяем пути для docs/ (они уже относительные из-за base: './')
          content = content
            .replace(/src="\.\.\/\.\.\/injected_ui\/index\.js"/g, 'src="./index.js"')
            .replace(/href="\.\.\/\.\.\/assets\//g, 'href="../assets/')
          writeFileSync(injectedUiHtmlPath, content, 'utf-8')
        }

        // Исправляем пути в docs/index.html для GitHub Pages
        const indexHtmlPath = join(docsPath, 'index.html')
        if (existsSync(indexHtmlPath)) {
          let content = readFileSync(indexHtmlPath, 'utf-8')

          // Исправляем пути к assets (убираем ведущий слеш)
          content = content.replace(/src="\/assets\//g, 'src="assets/')

          // Извлекаем inline-скрипт, применяем правки путей и сохраняем как main.js.
          // Это гарантирует, что любые изменения в public/standalone/index.html
          // автоматически попадают в docs/main.js при сборке.
          const inlineScriptPattern = /  <script>([\s\S]*?)<\/script>\s*<\/body>/
          const inlineMatch = content.match(inlineScriptPattern)

          if (inlineMatch) {
            let scriptContent = inlineMatch[1]

            // Путь loader.js: в docs он лежит в корне, а не в standalone/
            scriptContent = scriptContent.replace(
              /\/standalone\/loader\.js/g,
              '/loader.js'
            )

            // Base URL: поддержка GitHub Pages (hostname.github.io)
            scriptContent = scriptContent.replace(
              /const currentOrigin = window\.location\.origin;\s*document\.getElementById\('baseUrl'\)\.value = currentOrigin;/,
              `function getBaseURL() {
    if (location.hostname.endsWith('github.io')) {
      const [repo] = location.pathname.split('/').filter(Boolean);
      return location.origin + '/' + repo;
    }
    return location.origin;
  }
  document.getElementById('baseUrl').value = getBaseURL();`
            )

            const mainJsPath = join(docsPath, 'main.js')
            writeFileSync(mainJsPath, scriptContent.trim(), 'utf-8')
          }

          // Заменяем inline script на подключение внешнего файла
          const externalScriptTag = `  <script src="./main.js"></script>\n</body>`
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

        // 2. Удаляем extension-артефакты из docs (standalone должен быть чистым)
        // Примечание: иконки оставляем, так как они могут понадобиться для standalone
        const docsArtifactsToRemove = [
          'manifest.json',
          'defaultSettings.json'
        ]

        docsArtifactsToRemove.forEach(name => {
          const target = join(docsPath, name)
          if (existsSync(target)) {
            rmSync(target, { recursive: true, force: true })
          }
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
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        injected_ui_html: 'src/injected-ui/index.html',
        content: 'src/content/index.ts',
        background: 'src/background.ts',
        injected: 'src/injected/main.ts',
        devtools: 'src/devtools/devtools.ts'
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (['content', 'background', 'injected', 'devtools'].includes(chunkInfo.name)) {
            return 'js/[name].js'
          }
          if (chunkInfo.name === 'injected_ui_html') {
            return 'injected_ui/index.js'
          }
          return 'assets/[name]-[hash].js'
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        // Prevent code splitting - extension scripts must be self-contained
        manualChunks: undefined
      },
      // Prevent code splitting that would break injected scripts
      preserveEntrySignatures: 'strict'
    },
    chunkSizeWarningLimit: 1500
  },
  publicDir: false
})