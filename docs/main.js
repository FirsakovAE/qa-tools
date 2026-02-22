// Определяем текущий origin как базовый URL
    function getBaseURL() {
    if (location.hostname.endsWith('github.io')) {
      const [repo] = location.pathname.split('/').filter(Boolean);
      return location.origin + '/' + repo;
    }
    return location.origin;
  }
  document.getElementById('baseUrl').value = getBaseURL();
    
    // Обработчики вкладок
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        // Убираем активный класс у всех вкладок и контента
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        // Добавляем активный класс текущей вкладке и соответствующему контенту
        tab.classList.add('active');
        const tabId = tab.getAttribute('data-tab');
        document.getElementById(`${tabId}-tab`).classList.add('active');
      });
    });
    
    // Получение информации о последнем релизе
    async function fetchLatestRelease() {
      try {
        const response = await fetch('https://api.github.com/repos/FirsakovAE/qa-tools/releases/latest');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
                
        // Обновляем информацию о релизе
        const updateInfo = document.getElementById('updateInfo');
        const updateVersion = document.getElementById('updateVersion');
        const updateDescription = document.getElementById('updateDescription');
        const releaseDate = document.getElementById('releaseDate');
        
        if (data && data.tag_name) {
          updateVersion.textContent = data.tag_name;
          
          const description = data.body || 'Нет описания';
          updateDescription.innerHTML = marked.parse(description);
          
          // Форматируем дату
          if (data.published_at) {
            const date = new Date(data.published_at);
            releaseDate.textContent = `Опубликовано: ${date.toLocaleDateString('ru-RU')}`;
          }
          
          updateInfo.style.display = 'block';
          
          // Ищем ссылку для скачивания
          const downloadLink = document.getElementById('downloadLink');
          const downloadError = document.getElementById('downloadError');
          
          // Проверяем, есть ли assets в релизе
          if (data.assets && data.assets.length > 0) {
            // Ищем zip архив
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
              // Используем первый доступный asset
              downloadLink.href = data.assets[0].browser_download_url;
              downloadLink.textContent = `⬇️ Скачать ${data.assets[0].name}`;
              downloadLink.style.display = 'inline-flex';
              downloadError.style.display = 'none';
            }
          } else {
            // Если нет assets, создаем ссылку на скачивание исходного кода
            downloadLink.href = `https://github.com/FirsakovAE/qa-tools/archive/refs/tags/${data.tag_name}.zip`;
            downloadLink.textContent = `⬇️ Скачать ${data.tag_name}.zip`;
            downloadLink.style.display = 'inline-flex';
            downloadError.style.display = 'none';
          }
          
          // Для кнопки скачивания в заголовке
          const downloadBtn = document.getElementById('downloadBtn');
          if (downloadBtn) {
            downloadBtn.href = downloadLink.href;
            downloadBtn.target = '_blank';
          }
        }
      } catch (error) {
        console.error('Error fetching release info:', error);
        
        // Показываем ошибку
        const downloadError = document.getElementById('downloadError');
        const downloadLink = document.getElementById('downloadLink');
        
        downloadError.textContent = `Ошибка загрузки информации о релизе: ${error.message}. Пожалуйста, проверьте https://github.com/FirsakovAE/qa-tools/releases`;
        downloadError.style.display = 'block';
        downloadLink.style.display = 'none';
      }
    }
    
    function generateBookmarkletCode(baseURL) {
      // Минимальный код для загрузки inspector
      const code = `
        (function(){
          if(window.__VUE_INSPECTOR_INITIALIZED__){
            return;
          }
          var b='${baseURL}';
          window.__VUE_INSPECTOR_CONFIG__={baseURL:b};
          window.__VUE_INSPECTOR_INITIALIZED__=true;
          var s=document.createElement('script');
          s.src=b+'/loader.js';
          s.onerror=function(){alert('Vue Inspector: Failed to load from '+b)};
          document.head.appendChild(s);
        })();
      `.replace(/\s+/g, ' ').trim();
      
      return 'javascript:' + encodeURIComponent(code);
    }
    
    function updateBookmarklet() {
      const baseURL = document.getElementById('baseUrl').value.replace(/\/$/, '');
      const bookmarklet = document.getElementById('bookmarklet');
      bookmarklet.href = generateBookmarkletCode(baseURL);
    }
    
    // Инициализация
    updateBookmarklet();
    
    // Загружаем информацию о релизе после загрузки страницы
    document.addEventListener('DOMContentLoaded', fetchLatestRelease);
    
    // Обновляем при изменении input
    document.getElementById('baseUrl').addEventListener('input', updateBookmarklet);
    
    // Предотвращаем переход по ссылке при клике
    document.getElementById('bookmarklet').addEventListener('click', function(e) {
      alert('Перетащите эту кнопку в панель закладок браузера,\\nзатем используйте на странице с Vue приложением.');
      e.preventDefault();
    });