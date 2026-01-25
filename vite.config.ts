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

          // Заменяем inline script на подключение внешнего файла
          const inlineScriptPattern = /  <script>[\s\S]*?<\/script>\s*<\/body>/;
          const externalScriptTag = `  <script src="./main.js"></script>\n</body>`;

          content = content.replace(inlineScriptPattern, externalScriptTag);
          writeFileSync(indexHtmlPath, content, 'utf-8')
        }

        // Создаем main.js с всей логикой
        const mainJsPath = join(docsPath, 'main.js')
        const mainJsContent = `// Определяем среду выполнения
function isGitHubPages() {
  return location.hostname.endsWith('github.io');
}

function getBaseURL() {
  if (isGitHubPages()) {
    const [repo] = location.pathname.split('/').filter(Boolean);
    return location.origin + '/' + repo;
  }
  return location.origin;
}

function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      const tabId = tab.getAttribute('data-tab');
      document.getElementById(\`\${tabId}-tab\`).classList.add('active');
    });
  });
}

function showStaticReleaseInfo() {
  const updateInfo = document.getElementById('updateInfo');
  const updateVersion = document.getElementById('updateVersion');
  const updateDescription = document.getElementById('updateDescription');
  const releaseDate = document.getElementById('releaseDate');
  const downloadLink = document.getElementById('downloadLink');
  const downloadError = document.getElementById('downloadError');

  if (!updateInfo || !updateVersion) return;

  const staticRelease = {
    tag_name: 'v1.2.0',
    body: 'Исправлены ошибки с отображением компонентов в Vue 3. Поддержка Pinia 2.x. Улучшена производительность инспектора.',
    published_at: new Date().toISOString()
  };

  updateVersion.textContent = staticRelease.tag_name;
  updateDescription.textContent = staticRelease.body;
  releaseDate.textContent = \`Опубликовано: \${new Date(staticRelease.published_at).toLocaleDateString('ru-RU')}\`;

  downloadLink.href = 'https://github.com/FirsakovAE/qa-tools/releases';
  downloadLink.textContent = 'Посмотреть релизы на GitHub';
  downloadLink.style.display = 'inline-flex';
  downloadError.style.display = 'none';
  updateInfo.style.display = 'block';
}

function generateBookmarkletCode(baseURL) {
  const code = \`(function(){if(window.__VUE_INSPECTOR_INITIALIZED__){return;}var b='\${baseURL}';window.__VUE_INSPECTOR_CONFIG__={baseURL:b};window.__VUE_INSPECTOR_INITIALIZED__=true;var s=document.createElement('script');s.src=b+'/loader.js';s.onerror=function(){alert('Vue Inspector: Failed to load from '+b)};document.head.appendChild(s);})();\`;
  return 'javascript:' + encodeURIComponent(code);
}

function updateBookmarklet() {
  const baseURL = document.getElementById('baseUrl').value.replace(/\\/$/, '');
  const bookmarklet = document.getElementById('bookmarklet');
  bookmarklet.href = generateBookmarkletCode(baseURL);
}

async function loadRelease() {
  try {
    const response = await fetch('https://api.github.com/repos/FirsakovAE/qa-tools/releases/latest');
    if (!response.ok) throw new Error(\`HTTP error! status: \${response.status}\`);

    const data = await response.json();
    console.log('Release data:', data);

    const updateInfo = document.getElementById('updateInfo');
    const updateVersion = document.getElementById('updateVersion');
    const updateDescription = document.getElementById('updateDescription');
    const releaseDate = document.getElementById('releaseDate');

    if (data && data.tag_name) {
      updateVersion.textContent = data.tag_name;

      let description = data.body || 'Нет описания';
      description = description.replace(/^#+\s+/gm, '');
      description = description.trim();

      updateDescription.textContent = description;

      if (data.published_at) {
        const date = new Date(data.published_at);
        releaseDate.textContent = \`Опубликовано: \${date.toLocaleDateString('ru-RU')}\`;
      }

      updateInfo.style.display = 'block';

      const downloadLink = document.getElementById('downloadLink');
      const downloadError = document.getElementById('downloadError');

      if (data.assets && data.assets.length > 0) {
        const zipAsset = data.assets.find(asset =>
          asset.name.includes('.zip') ||
          asset.name.includes('.crx') ||
          asset.name.toLowerCase().includes('extension')
        );

        if (zipAsset) {
          downloadLink.href = zipAsset.browser_download_url;
          downloadLink.style.display = 'inline-flex';
          downloadError.style.display = 'none';
        } else {
          downloadLink.href = data.assets[0].browser_download_url;
          downloadLink.textContent = \`⬇️ Скачать \${data.assets[0].name}\`;
          downloadLink.style.display = 'inline-flex';
          downloadError.style.display = 'none';
        }
      } else {
        downloadLink.href = \`https://github.com/FirsakovAE/qa-tools/archive/refs/tags/\${data.tag_name}.zip\`;
        downloadLink.textContent = \`⬇️ Скачать \${data.tag_name}.zip\`;
        downloadLink.style.display = 'inline-flex';
        downloadError.style.display = 'none';
      }

      const downloadBtn = document.getElementById('downloadBtn');
      if (downloadBtn) {
        downloadBtn.href = downloadLink.href;
        downloadBtn.target = '_blank';
      }
    }
  } catch (error) {
    console.error('Error fetching release info:', error);
    showStaticReleaseInfo();
  }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('baseUrl').value = getBaseURL();
  initTabs();
  loadRelease();
  updateBookmarklet();

  document.getElementById('baseUrl').addEventListener('input', updateBookmarklet);
  document.getElementById('bookmarklet').addEventListener('click', function(e) {
    alert('Перетащите эту кнопку в панель закладок браузера,\\nзатем используйте на странице с Vue приложением.');
    e.preventDefault();
  });
});
`;

        writeFileSync(mainJsPath, mainJsContent, 'utf-8')

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
        assetFileNames: 'assets/[name]-[hash][extname]',
        // Prevent code splitting - extension scripts must be self-contained
        manualChunks: undefined
      },
      // Prevent code splitting that would break injected scripts
      preserveEntrySignatures: 'strict'
    }
  },
  publicDir: false
})