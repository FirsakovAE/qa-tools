// Определяем среду выполнения
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
      document.getElementById(`${tabId}-tab`).classList.add('active');
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
  releaseDate.textContent = `Опубликовано: ${new Date(staticRelease.published_at).toLocaleDateString('ru-RU')}`;

  downloadLink.href = 'https://github.com/FirsakovAE/qa-tools/releases';
  downloadLink.textContent = 'Посмотреть релизы на GitHub';
  downloadLink.style.display = 'inline-flex';
  downloadError.style.display = 'none';
  updateInfo.style.display = 'block';
}

function generateBookmarkletCode(baseURL) {
  const code = `(function(){if(window.__VUE_INSPECTOR_INITIALIZED__){return;}var b='${baseURL}';window.__VUE_INSPECTOR_CONFIG__={baseURL:b};window.__VUE_INSPECTOR_INITIALIZED__=true;var s=document.createElement('script');s.src=b+'/loader.js';s.onerror=function(){alert('Vue Inspector: Failed to load from '+b)};document.head.appendChild(s);})();`;
  return 'javascript:' + encodeURIComponent(code);
}

function updateBookmarklet() {
  const baseURL = document.getElementById('baseUrl').value.replace(/\/$/, '');
  const bookmarklet = document.getElementById('bookmarklet');
  bookmarklet.href = generateBookmarkletCode(baseURL);
}

async function loadRelease() {
  try {
    const response = await fetch('https://api.github.com/repos/FirsakovAE/qa-tools/releases/latest');
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();
    console.log('Release data:', data);

    const updateInfo = document.getElementById('updateInfo');
    const updateVersion = document.getElementById('updateVersion');
    const updateDescription = document.getElementById('updateDescription');
    const releaseDate = document.getElementById('releaseDate');

    if (data && data.tag_name) {
      updateVersion.textContent = data.tag_name;

      let description = data.body || 'Нет описания';
      description = description.replace(/^#+s+/gm, '');
      description = description.trim();

      updateDescription.textContent = description;

      if (data.published_at) {
        const date = new Date(data.published_at);
        releaseDate.textContent = `Опубликовано: ${date.toLocaleDateString('ru-RU')}`;
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
          downloadLink.textContent = `⬇️ Скачать ${data.assets[0].name}`;
          downloadLink.style.display = 'inline-flex';
          downloadError.style.display = 'none';
        }
      } else {
        downloadLink.href = `https://github.com/FirsakovAE/qa-tools/archive/refs/tags/${data.tag_name}.zip`;
        downloadLink.textContent = `⬇️ Скачать ${data.tag_name}.zip`;
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
    alert('Перетащите эту кнопку в панель закладок браузера,\nзатем используйте на странице с Vue приложением.');
    e.preventDefault();
  });
});
