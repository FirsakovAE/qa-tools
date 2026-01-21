import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { copyFileSync, existsSync, mkdirSync, cpSync, readFileSync, writeFileSync, rmSync } from 'fs'
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
        const foldersToCopy = ['js', 'injected_ui', 'assets']
        foldersToCopy.forEach(folder => {
          const srcPath = join(distPath, folder)
          const destPath = join(docsPath, folder)
          if (existsSync(srcPath)) {
            cpSync(srcPath, destPath, { recursive: true, force: true })
          }
        })

        // Копируем background изображение в injected_ui папку для standalone режима
        const backgroundSrc = join(distPath, 'assets', 'background1-CPnR_9dL.jpg')
        const backgroundDest = join(docsPath, 'injected_ui', 'background1.jpg')
        if (existsSync(backgroundSrc)) {
          copyFileSync(backgroundSrc, backgroundDest)
        }

        // Исправляем пути в injected_ui/index.html для docs/
        const injectedUiHtmlPath = join(docsPath, 'injected_ui', 'index.html')
        if (existsSync(injectedUiHtmlPath)) {
          let content = readFileSync(injectedUiHtmlPath, 'utf-8')
          // Заменяем абсолютные пути на относительные
          content = content
            .replace(/src="\/injected_ui\/index\.js"/g, 'src="./index.js"')
            .replace(/href="\/assets\//g, 'href="../assets/')
          writeFileSync(injectedUiHtmlPath, content, 'utf-8')
        }

        // Исправляем пути в docs/index.html для GitHub Pages
        const indexHtmlPath = join(docsPath, 'index.html')
        if (existsSync(indexHtmlPath)) {
          let content = readFileSync(indexHtmlPath, 'utf-8')

          // Исправляем пути к assets (убираем ведущий слеш)
          content = content.replace(/src="\/assets\//g, 'src="assets/')

          // Полностью заменяем блок script с правильной логикой
          const oldScriptBlock = /<script>[\s\S]*?<\/script>/;
          const newScriptBlock = `<script>
    // Определяем базовый URL для GitHub Pages
    function getBaseURL() {
      const origin = window.location.origin; // https://firsakovae.github.io
      const pathname = window.location.pathname; // /qa-tools/

      // Если на GitHub Pages, добавляем имя репозитория
      if (origin.includes('github.io')) {
        // Извлекаем имя репозитория из пути
        const pathParts = pathname.split('/').filter(p => p);
        const repoName = pathParts[0]; // 'qa-tools'
        return origin + '/' + repoName;
      }

      // Для локального сервера используем origin
      return origin;
    }

    document.getElementById('baseUrl').value = getBaseURL();

    function generateBookmarkletCode(baseURL) {
      // Минимальный код для загрузки inspector
      const code = \`
        (function(){
          if(window.__VUE_INSPECTOR_INITIALIZED__){
            return;
          }
          var b='\${baseURL}';
          window.__VUE_INSPECTOR_CONFIG__={baseURL:b};
          window.__VUE_INSPECTOR_INITIALIZED__=true;
          var s=document.createElement('script');
          s.src=b+'/loader.js';
          s.onerror=function(){alert('Vue Inspector: Failed to load from '+b)};
          document.head.appendChild(s);
        })();
      \`.replace(/\\s+/g, ' ').trim();

      return 'javascript:' + encodeURIComponent(code);
    }

    function updateBookmarklet() {
      const baseURL = document.getElementById('baseUrl').value.replace(/\\/$/, '');
      const bookmarklet = document.getElementById('bookmarklet');
      bookmarklet.href = generateBookmarkletCode(baseURL);
    }

    // Инициализация
    updateBookmarklet();

    // Обновляем при изменении input
    document.getElementById('baseUrl').addEventListener('input', updateBookmarklet);

    // Предотвращаем переход по ссылке при клике
    document.getElementById('bookmarklet').addEventListener('click', function(e) {
      alert('Перетащите эту кнопку в панель закладок браузера,\\nзатем используйте на странице с Vue приложением.');
      e.preventDefault();
    });
  </script>`;

          content = content.replace(oldScriptBlock, newScriptBlock);
          writeFileSync(indexHtmlPath, content, 'utf-8')
        }
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
