import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { copyFileSync, existsSync, mkdirSync, cpSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    viteStaticCopy({
      targets: [
        { src: 'manifest.json', dest: '.' },
        { src: 'public/icons/*', dest: 'icons' },
        { src: 'public/defaultSettings.json', dest: '.' },
        // Standalone mode files
        { src: 'public/standalone/*', dest: 'standalone' }
      ]
    }),
    {
      name: 'copy-injected-ui-html',
      closeBundle() {
        const distPath = join(process.cwd(), 'dist')
        // Vite гарантированно кладет HTML entry по пути: dist/{inputPathRelativeToSrc}
        const srcHtml = join(distPath, 'src', 'injected-ui', 'index.html')
        const destDir = join(distPath, 'injected_ui')
        const destHtml = join(destDir, 'index.html')

        if (existsSync(srcHtml)) {
          if (!existsSync(destDir)) {
            mkdirSync(destDir, { recursive: true })
          }
          copyFileSync(srcHtml, destHtml)
          console.log('✓ Copied injected UI HTML to injected_ui/index.html')
        }
      }
    },
    {
      name: 'prepare-docs-for-github-pages',
      closeBundle() {
        const distPath = join(process.cwd(), 'dist')
        const docsPath = join(process.cwd(), 'docs')

        // Создаем папку docs если не существует
        if (!existsSync(docsPath)) {
          mkdirSync(docsPath, { recursive: true })
        }

        // Копируем standalone файлы
        const standaloneSrc = join(distPath, 'standalone')
        const standaloneDest = docsPath
        if (existsSync(standaloneSrc)) {
          cpSync(standaloneSrc, standaloneDest, { recursive: true, force: true })
          console.log('✓ Copied standalone files to docs/')
        }

        // Копируем необходимые папки для работы standalone
        const foldersToCopy = ['js', 'injected_ui', 'assets']
        foldersToCopy.forEach(folder => {
          const srcPath = join(distPath, folder)
          const destPath = join(docsPath, folder)
          if (existsSync(srcPath)) {
            cpSync(srcPath, destPath, { recursive: true, force: true })
            console.log(`✓ Copied ${folder}/ to docs/${folder}/`)
          }
        })

        // Исправляем пути в injected_ui/index.html для docs/
        const injectedUiHtmlPath = join(docsPath, 'injected_ui', 'index.html')
        if (existsSync(injectedUiHtmlPath)) {
          let content = readFileSync(injectedUiHtmlPath, 'utf-8')
          // Заменяем абсолютные пути на относительные
          content = content
            .replace(/src="\/injected_ui\/index\.js"/g, 'src="./index.js"')
            .replace(/href="\/assets\//g, 'href="../assets/')
          writeFileSync(injectedUiHtmlPath, content, 'utf-8')
          console.log('✓ Fixed paths in docs/injected_ui/index.html')
        }

        console.log('✓ GitHub Pages docs/ folder is ready')
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
        popup: 'src/popup/popup.html',
        injected_ui_html: 'src/injected-ui/index.html',
        content: 'src/content.ts',
        background: 'src/background.ts',
        injected: 'src/injected/main.ts'
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (['content', 'background', 'injected'].includes(chunkInfo.name)) {
            return 'js/[name].js'
          }
          if (chunkInfo.name === 'injected_ui_html') {
            return 'injected_ui/index.js'
          }
          return 'assets/[name]-[hash].js'
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  },
  publicDir: false
})
