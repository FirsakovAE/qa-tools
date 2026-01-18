/**
 * Standalone Loader
 * 
 * Минимальный загрузчик для bookmarklet.
 * Загружает bootstrap модуль и инициализирует inspector.
 */
(function() {
  'use strict';
  
  // Получаем конфигурацию установленную bookmarklet'ом
  var config = window.__VUE_INSPECTOR_CONFIG__;
  if (!config || !config.baseURL) {
    console.error('[Vue Inspector] Configuration not found. Use bookmarklet from setup page.');
    return;
  }
  
  var baseURL = config.baseURL;
  
  // Устанавливаем глобальные флаги для UI iframe
  window.__VUE_INSPECTOR_STANDALONE__ = true;
  window.__VUE_INSPECTOR_BASE_URL__ = baseURL;
  
  // Проверяем доступность Vue на странице (опционально)
  function detectVue() {
    return !!(
      window.__VUE__ ||
      window.__VUE_DEVTOOLS_GLOBAL_HOOK__ ||
      document.querySelector('[data-v-app]') ||
      document.querySelector('[__vue_app__]')
    );
  }
  
  // Инжектируем injected script для доступа к Vue
  function injectScript() {
    if (document.getElementById('vue-inspector-injected-script')) {
      return Promise.resolve();
    }
    
    return new Promise(function(resolve, reject) {
      var script = document.createElement('script');
      script.id = 'vue-inspector-injected-script';
      script.src = baseURL + '/js/injected.js';
      script.onload = resolve;
      script.onerror = function() {
        reject(new Error('Failed to load injected.js'));
      };
      document.head.appendChild(script);
    });
  }
  
  // Инжектируем UI
  function injectUI() {
    if (document.getElementById('vue-inspector-root')) {
      console.log('[Vue Inspector] UI already present');
      return;
    }
    
    // Создаём UI структуру (аналогично content.ts)
    var root = document.createElement('div');
    root.id = 'vue-inspector-root';
    root.style.cssText = [
      'position: fixed',
      'left: 0',
      'bottom: 0',
      'width: 100vw',
      'z-index: 1000000',
      'pointer-events: none'
    ].join(';');
    
    var host = document.createElement('div');
    host.id = 'vue-inspector-host';
    host.style.cssText = [
      'position: relative',
      'width: 100%',
      'height: 0px',
      'overflow: hidden',
      'pointer-events: none'
    ].join(';');
    
    var iframe = document.createElement('iframe');
    iframe.id = 'vue-inspector-ui';
    iframe.style.cssText = [
      'position: relative',
      'width: 100%',
      'height: 100%',
      'border: none',
      'background: transparent',
      'pointer-events: auto',
      'display: none'
    ].join(';');
    
    // Toggle button
    var toggle = document.createElement('button');
    toggle.id = 'vue-inspector-toggle';
    toggle.style.cssText = [
      'position: absolute',
      'bottom: 0px',
      'left: 50%',
      'transform: translateX(-50%)',
      'width: 32px',
      'height: 32px',
      'border-radius: 50%',
      'background: #111',
      'color: white',
      'border: 1px solid rgba(255,255,255,0.2)',
      'cursor: pointer',
      'pointer-events: auto',
      'display: flex',
      'align-items: center',
      'justify-content: center'
    ].join(';');
    
    var chevron = document.createElement('div');
    chevron.style.cssText = [
      'width: 0',
      'height: 0',
      'border-left: 6px solid transparent',
      'border-right: 6px solid transparent',
      'border-top: 8px solid white',
      'transition: transform 0.2s ease',
      'transform: rotate(180deg)'
    ].join(';');
    toggle.appendChild(chevron);
    
    // State
    var isCollapsed = true;
    var height = 360;
    var iframeLoaded = false;
    
    function updateState() {
      if (isCollapsed) {
        host.style.height = '0px';
        iframe.style.display = 'none';
        toggle.style.bottom = '0px';
      } else {
        host.style.height = height + 'px';
        iframe.style.display = 'block';
        toggle.style.bottom = height + 'px';
      }
    }
    
    // Флаг наличия Vue (обновляется из message relay)
    var hasVue = false;
    
    toggle.onclick = function() {
      isCollapsed = !isCollapsed;
      chevron.style.transform = isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)';
      
      // Lazy load iframe
      if (!isCollapsed && !iframeLoaded) {
        iframeLoaded = true;
        // Используем injected_ui который работает через postMessage
        // Передаём standalone флаг через URL hash (избегаем CORS проблем)
        iframe.src = baseURL + '/injected_ui/index.html#standalone=' + encodeURIComponent(baseURL);
      }
      
      updateState();
      
      // Уведомляем iframe о состоянии видимости (для паузы auto-refresh)
      if (iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          __VUE_INSPECTOR__: true,
          broadcast: true,
          message: {
            type: 'VUE_INSPECTOR_VISIBILITY_CHANGED',
            visible: !isCollapsed
          }
        }, '*');
      }
      
      // ЭКОНОМИЯ РЕСУРСОВ: если Vue не найден и панель свёрнута - выгружаем iframe
      if (isCollapsed && !hasVue && iframeLoaded) {
        iframe.src = 'about:blank';
        iframeLoaded = false;
        console.log('[Vue Inspector] Iframe unloaded (no Vue detected)');
      }
    };
    
    // Экспортируем функцию для обновления hasVue из message relay
    window.__VUE_INSPECTOR_SET_HAS_VUE__ = function(value) {
      hasVue = value;
    };
    
    // Resize handle
    var resizeHandle = document.createElement('div');
    resizeHandle.style.cssText = [
      'position: absolute',
      'top: 0',
      'left: 0',
      'width: 100%',
      'height: 6px',
      'cursor: ns-resize',
      'pointer-events: auto'
    ].join(';');
    
    var dragging = false;
    var startY = 0;
    var startHeight = 0;
    
    resizeHandle.addEventListener('pointerdown', function(e) {
      e.preventDefault();
      dragging = true;
      startY = e.clientY;
      startHeight = height;
      document.body.style.userSelect = 'none';
      resizeHandle.setPointerCapture(e.pointerId);
    });
    
    resizeHandle.addEventListener('pointermove', function(e) {
      if (!dragging) return;
      height = Math.min(
        window.innerHeight - 80,
        Math.max(120, startHeight + (startY - e.clientY))
      );
      host.style.height = height + 'px';
      toggle.style.bottom = height + 'px';
    });
    
    resizeHandle.addEventListener('pointerup', function(e) {
      dragging = false;
      document.body.style.userSelect = '';
      resizeHandle.releasePointerCapture(e.pointerId);
    });
    
    // Assemble
    host.appendChild(iframe);
    host.appendChild(resizeHandle);
    root.appendChild(host);
    root.appendChild(toggle);
    document.documentElement.appendChild(root);
    
    console.log('[Vue Inspector] UI injected');
    
    // Запускаем message relay после создания UI
    setupMessageRelay(iframe);
  }
  
  /**
   * Message Relay - мост между UI iframe и injected script
   * UI использует __VUE_INSPECTOR__ формат
   * Injected script использует __FROM_VUE_INSPECTOR__ формат
   */
  function setupMessageRelay(iframe) {
    // Хранилище pending запросов от UI (requestId -> {type, source, timestamp})
    var pendingRequests = {};
    
    // Кэш feature flags от injected script
    var cachedFlags = null;
    
    // Маппинг типов запросов UI -> типов ответов injected script
    var responseTypeMap = {
      // Props
      'COLLECT_VUE_COMPONENTS': 'VUE_INSPECTOR_COMPONENTS_DATA',
      'VUE_INSPECTOR_GET_COMPONENTS': 'VUE_INSPECTOR_COMPONENTS_DATA',
      'VUE_INSPECTOR_GET_COMPONENT_PROPS': 'VUE_INSPECTOR_COMPONENT_PROPS_DATA',
      'VUE_INSPECTOR_UPDATE_PROPS': 'VUE_INSPECTOR_UPDATE_PROPS_RESULT',
      'UPDATE_COMPONENT_PROPS': 'VUE_INSPECTOR_UPDATE_PROPS_RESULT',
      // Pinia
      'PINIA_GET_STORES_SUMMARY': 'PINIA_STORES_SUMMARY_DATA',
      'PINIA_GET_STORE_STATE': 'PINIA_STORE_STATE_DATA',
      'PINIA_PATCH_STATE': 'PINIA_PATCH_STATE_RESULT',
      'PINIA_REPLACE_STATE': 'PINIA_REPLACE_STATE_RESULT',
      'PINIA_PATCH_GETTERS': 'PINIA_PATCH_GETTERS_RESULT',
      'PINIA_CALL_ACTION': 'PINIA_CALL_ACTION_RESULT',
      'PINIA_CHECK_DETECTED': 'PINIA_DETECTED_RESULT',
      'PINIA_BUILD_SEARCH_INDEX': 'PINIA_SEARCH_INDEX_READY',
      // Detection
      'VUE_INSPECTOR_GET_FLAGS': 'VUE_INSPECTOR_DETECTION_RESULT',
      'VUE_INSPECTOR_CHECK_VUE': 'VUE_INSPECTOR_DETECTION_RESULT'
    };
    
    // Обратный маппинг для быстрого поиска
    var requestTypeByResponse = {};
    Object.keys(responseTypeMap).forEach(function(reqType) {
      var respType = responseTypeMap[reqType];
      if (!requestTypeByResponse[respType]) {
        requestTypeByResponse[respType] = [];
      }
      requestTypeByResponse[respType].push(reqType);
    });
    
    window.addEventListener('message', function(event) {
      var data = event.data;
      if (!data || typeof data !== 'object') return;
      
      // Debug: log ALL messages with __VUE_INSPECTOR__ prefix
      if (data.__VUE_INSPECTOR__) {
        console.log('[Relay] Message with prefix, source is iframe:', event.source === iframe.contentWindow, 
                    'type:', data.message?.type, 'requestId:', data.requestId);
      }
      
      // Debug: log all messages from iframe
      if (event.source === iframe.contentWindow) {
        console.log('[Relay] Raw message from iframe:', data.__VUE_INSPECTOR__ ? 'has prefix' : 'NO prefix', data);
      }
      
      // === Сообщения от UI iframe -> injected script ===
      if (event.source === iframe.contentWindow && data.__VUE_INSPECTOR__) {
        var requestId = data.requestId;
        var message = data.message;
        
        if (!message || !message.type) return;
        
        console.log('[Relay] UI -> Page:', message.type, requestId ? '(req:' + requestId + ')' : '');
        
        // Специальная обработка PING - отвечаем сразу
        if (message.type === 'PING') {
          if (requestId && iframe.contentWindow) {
            iframe.contentWindow.postMessage({
              __VUE_INSPECTOR__: true,
              responseId: requestId,
              response: { pong: true }
            }, '*');
          }
          return;
        }
        
        // GET_FEATURE_FLAGS / VUE_INSPECTOR_GET_FLAGS - возвращаем кэшированные или запрашиваем
        if (message.type === 'GET_FEATURE_FLAGS' || message.type === 'VUE_INSPECTOR_GET_FLAGS') {
          if (cachedFlags) {
            // Возвращаем кэшированные флаги
            if (requestId && iframe.contentWindow) {
              iframe.contentWindow.postMessage({
                __VUE_INSPECTOR__: true,
                responseId: requestId,
                response: { type: 'VUE_INSPECTOR_FEATURE_FLAGS', flags: cachedFlags }
              }, '*');
            }
            // Также отправляем broadcast (для Navigation.vue)
            if (iframe.contentWindow) {
              iframe.contentWindow.postMessage({
                __VUE_INSPECTOR__: true,
                broadcast: true,
                message: { type: 'VUE_INSPECTOR_FEATURE_FLAGS', flags: cachedFlags }
              }, '*');
            }
            return;
          }
          // Запрашиваем у injected script
          window.postMessage({ type: 'VUE_INSPECTOR_GET_FLAGS' }, '*');
          // Сохраняем pending для ответа
          if (requestId) {
            pendingRequests[requestId] = {
              type: 'VUE_INSPECTOR_GET_FLAGS',
              source: iframe.contentWindow,
              timestamp: Date.now()
            };
          }
          return;
        }
        
        // Сохраняем pending request если ожидается ответ
        if (requestId && responseTypeMap[message.type]) {
          pendingRequests[requestId] = {
            type: message.type,
            source: iframe.contentWindow,
            timestamp: Date.now()
          };
        }
        
        // Пересылаем сообщение в injected script (добавляем requestId если есть)
        var forwardMessage = Object.assign({}, message);
        if (requestId) {
          forwardMessage.requestId = requestId;
        }
        
        // Трансляция типов сообщений (UI использует другие имена)
        if (forwardMessage.type === 'COLLECT_VUE_COMPONENTS') {
          forwardMessage.type = 'VUE_INSPECTOR_GET_COMPONENTS';
        }
        if (forwardMessage.type === 'UPDATE_COMPONENT_PROPS') {
          console.log('[Relay] Translating UPDATE_COMPONENT_PROPS -> VUE_INSPECTOR_UPDATE_PROPS');
          forwardMessage.type = 'VUE_INSPECTOR_UPDATE_PROPS';
          forwardMessage.componentPath = forwardMessage.componentUid;
        }
        
        console.log('[Relay] Forwarding to page:', forwardMessage.type, 'requestId:', forwardMessage.requestId);
        window.postMessage(forwardMessage, '*');
        return;
      }
      
      // === Сообщения от injected script -> UI iframe ===
      // Проверяем либо маркер __FROM_VUE_INSPECTOR__, либо известные типы ответов
      var isKnownResponseType = data.type && (
        data.type.indexOf('_DATA') !== -1 ||
        data.type.indexOf('_RESULT') !== -1 ||
        data.type.indexOf('_READY') !== -1 ||
        data.type === 'VUE_INSPECTOR_DETECTION_RESULT' ||
        data.type === 'PINIA_DETECTED_RESULT'
      );
      
      if (event.source === window && (data.__FROM_VUE_INSPECTOR__ || isKnownResponseType)) {
        console.log('[Relay] Page -> UI:', data.type, data.requestId ? '(req:' + data.requestId + ')' : '');
        
        // Обработка результата детекции
        if (data.type === 'VUE_INSPECTOR_DETECTION_RESULT') {
          cachedFlags = {
            hasVue: data.hasVue,
            hasPinia: data.hasPinia,
            vueVersion: data.vueVersion
          };
          
          // Обновляем флаг hasVue для экономии ресурсов при сворачивании
          if (window.__VUE_INSPECTOR_SET_HAS_VUE__) {
            window.__VUE_INSPECTOR_SET_HAS_VUE__(data.hasVue);
          }
          
          // Отправляем в UI как broadcast (для инициализации)
          if (iframe.contentWindow) {
            iframe.contentWindow.postMessage({
              __VUE_INSPECTOR__: true,
              broadcast: true,
              message: {
                type: 'VUE_INSPECTOR_FEATURE_FLAGS',
                flags: cachedFlags
              }
            }, '*');
          }
        }
        
        // Ищем pending request для этого ответа
        var respondedRequestId = data.requestId;
        
        // Если нет requestId в ответе, ищем по типу сообщения
        if (!respondedRequestId && requestTypeByResponse[data.type]) {
          var possibleTypes = requestTypeByResponse[data.type];
          Object.keys(pendingRequests).forEach(function(reqId) {
            if (possibleTypes.indexOf(pendingRequests[reqId].type) !== -1) {
              respondedRequestId = reqId;
            }
          });
        }
        
        // Отвечаем на pending request
        if (respondedRequestId && pendingRequests[respondedRequestId]) {
          var pending = pendingRequests[respondedRequestId];
          delete pendingRequests[respondedRequestId];
          if (pending.source) {
            pending.source.postMessage({
              __VUE_INSPECTOR__: true,
              responseId: respondedRequestId,
              response: data
            }, '*');
          }
          return;
        }
        
        // Пересылаем как broadcast (для событий без pending request)
        if (iframe.contentWindow) {
          iframe.contentWindow.postMessage({
            __VUE_INSPECTOR__: true,
            broadcast: true,
            message: data
          }, '*');
        }
      }
    });
    
    // Очистка старых pending requests (каждые 30 сек)
    setInterval(function() {
      var now = Date.now();
      Object.keys(pendingRequests).forEach(function(reqId) {
        if (now - pendingRequests[reqId].timestamp > 30000) {
          console.log('[Relay] Cleaning stale request:', reqId);
          delete pendingRequests[reqId];
        }
      });
    }, 30000);
    
    console.log('[Vue Inspector] Message relay initialized');
  }
  
  // Главная функция инициализации
  function init() {
    console.log('[Vue Inspector] Initializing standalone mode...');
    console.log('[Vue Inspector] Base URL:', baseURL);
    
    // Сначала инжектируем script для доступа к Vue
    injectScript()
      .then(function() {
        console.log('[Vue Inspector] Injected script loaded');
        // Затем инжектируем UI
        injectUI();
        console.log('[Vue Inspector] Ready! Click the chevron button at the bottom.');
      })
      .catch(function(err) {
        console.error('[Vue Inspector] Initialization failed:', err);
      });
  }
  
  // Запускаем
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
