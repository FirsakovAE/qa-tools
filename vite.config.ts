import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { copyFileSync, existsSync, mkdirSync, cpSync, readFileSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'

export default defineConfig({
  base: './',
  plugins: [
    vue(),
    tailwindcss(),
    basicSsl(),
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
      name: 'copy-html-entries',
      closeBundle() {
        const distPath = join(process.cwd(), 'dist')

        // injected_ui: dist/src/injected-ui/index.html → dist/injected_ui/index.html
        const uiSrcHtml = join(distPath, 'src', 'injected-ui', 'index.html')
        const uiDestDir = join(distPath, 'injected_ui')
        const uiDestHtml = join(uiDestDir, 'index.html')
        if (existsSync(uiSrcHtml)) {
          if (!existsSync(uiDestDir)) mkdirSync(uiDestDir, { recursive: true })
          let content = readFileSync(uiSrcHtml, 'utf-8')
          content = content
            .replace(/src="\.\.\/\.\.\/injected_ui\/index\.js"/g, 'src="./index.js"')
            .replace(/href="\.\.\/\.\.\/assets\//g, 'href="../assets/')
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
        const foldersToCopy = ['js', 'injected_ui', 'storage', 'assets', 'icons']
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
        storage_html: 'src/storage/index.html',
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
          if (chunkInfo.name === 'storage_html') {
            return 'storage/index.js'
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