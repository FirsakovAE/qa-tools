/**
 * Standalone Loader
 * 
 * Минимальный загрузчик для bookmarklet.
 * Загружает bootstrap модуль и инициализирует inspector.
 * Supports docking to all 4 edges + floating window mode via interact.js.
 */
(function() {
  'use strict';
  
  var config = window.__VUE_INSPECTOR_CONFIG__;
  if (!config || !config.baseURL) {
    return;
  }
  
  var baseURL = config.baseURL;
  
  window.__VUE_INSPECTOR_STANDALONE__ = true;
  window.__VUE_INSPECTOR_BASE_URL__ = baseURL;
  
  function detectVue() {
    return !!(
      window.__VUE__ ||
      window.__VUE_DEVTOOLS_GLOBAL_HOOK__ ||
      document.querySelector('[data-v-app]') ||
      document.querySelector('[__vue_app__]')
    );
  }
  
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

  function loadInteractJS() {
    if (window.interact) return Promise.resolve();
    return new Promise(function(resolve, reject) {
      var script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/interactjs@1.10.27/dist/interact.min.js';
      script.onload = resolve;
      script.onerror = function() { reject(new Error('Failed to load interact.js')); };
      document.head.appendChild(script);
    });
  }
  
  // ═══════════════════════════════════════════════════════════
  // Инжектируем UI
  // ═══════════════════════════════════════════════════════════
  function injectUI() {
    if (document.getElementById('vue-inspector-root')) {
      return;
    }
    
    // ── State ──
    var isCollapsed = true;
    var height = 360;
    var dockWidth = 360;
    var MIN_HEIGHT = 120;
    var MIN_WIDTH = 200;
    var MAX_OFFSET = 80;
    var TITLEBAR_H = 28;
    var iframeLoaded = false;
    var hasVue = false;

    var dockPosition = 'bottom'; // 'bottom'|'top'|'left'|'right'|'floating'
    var floatingX = Math.round(window.innerWidth / 2 - 300);
    var floatingY = Math.round(window.innerHeight / 2 - 200);
    var floatingWidth = 600;
    var floatingHeight = 400;
    var SNAP_THRESHOLD = 60;

    function clamp(lo, hi, v) { return Math.min(hi, Math.max(lo, v)); }

    // ── Dock state persistence (central-store via hidden storage iframe) ──
    var DOCK_STATE_SETTINGS_KEY = 'dock-state';
    var VALID_DOCKS = ['bottom', 'top', 'left', 'right', 'floating'];
    var STOR_PREFIX = '__VUE_INSPECTOR_STORAGE__';
    var STOR_RESP_PREFIX = '__VUE_INSPECTOR_STORAGE_RESP__';
    var _storIframe = null;
    var _storReady = false;
    var _storReadyCbs = [];
    var _storPending = {};
    var _storCounter = 0;

    function _initDockStorage() {
      var sf = document.createElement('iframe');
      sf.style.display = 'none';
      sf.src = baseURL + '/storage/';
      document.documentElement.appendChild(sf);
      _storIframe = sf;

      window.addEventListener('message', function(event) {
        var d = event.data;
        if (!d || typeof d !== 'object') return;
        if (d[STOR_PREFIX] && d.action === 'ready') {
          _storReady = true;
          var cbs = _storReadyCbs.splice(0);
          for (var i = 0; i < cbs.length; i++) cbs[i]();
          return;
        }
        if (d[STOR_RESP_PREFIX] && d.requestId && _storPending[d.requestId]) {
          var entry = _storPending[d.requestId];
          delete _storPending[d.requestId];
          clearTimeout(entry.timer);
          if (d.error) entry.reject(new Error(d.error));
          else entry.resolve(d.result);
        }
      });
    }

    function _storSend(action, payload) {
      return new Promise(function(resolve, reject) {
        function go() {
          var requestId = 'dock_' + (++_storCounter) + '_' + Date.now();
          var timer = setTimeout(function() {
            delete _storPending[requestId];
            reject(new Error('Storage timeout: ' + action));
          }, 5000);
          _storPending[requestId] = { resolve: resolve, reject: reject, timer: timer };
          var msg = { requestId: requestId, action: action };
          msg[STOR_PREFIX] = true;
          if (payload) { for (var k in payload) { if (payload.hasOwnProperty(k)) msg[k] = payload[k]; } }
          _storIframe.contentWindow.postMessage(msg, '*');
        }
        if (_storReady) go();
        else _storReadyCbs.push(go);
      });
    }

    function saveDockState() {
      _storSend('setSettings', {
        key: DOCK_STATE_SETTINGS_KEY,
        data: {
          dockPosition: dockPosition, height: height, dockWidth: dockWidth,
          floatingX: floatingX, floatingY: floatingY,
          floatingWidth: floatingWidth, floatingHeight: floatingHeight
        }
      }).catch(function() {});
    }

    // Create storage iframe immediately so it starts loading
    _initDockStorage();

    // Async restore — apply saved state as soon as storage is ready
    _storSend('getSettings', { key: DOCK_STATE_SETTINGS_KEY }).then(function(saved) {
      if (!saved || typeof saved !== 'object') return;
      if (VALID_DOCKS.indexOf(saved.dockPosition) === -1) return;
      dockPosition = saved.dockPosition;
      if (typeof saved.height === 'number') height = Math.max(MIN_HEIGHT, saved.height);
      if (typeof saved.dockWidth === 'number') dockWidth = Math.max(MIN_WIDTH, saved.dockWidth);
      if (typeof saved.floatingX === 'number') floatingX = saved.floatingX;
      if (typeof saved.floatingY === 'number') floatingY = saved.floatingY;
      if (typeof saved.floatingWidth === 'number') floatingWidth = Math.max(MIN_WIDTH, saved.floatingWidth);
      if (typeof saved.floatingHeight === 'number') floatingHeight = Math.max(MIN_HEIGHT + TITLEBAR_H, saved.floatingHeight);
      applyLayout();
    }).catch(function() {});

    // ── DOM ──
    var root = document.createElement('div');
    root.id = 'vue-inspector-root';

    var host = document.createElement('div');
    host.id = 'vue-inspector-host';

    var iframe = document.createElement('iframe');
    iframe.id = 'vue-inspector-ui';
    iframe.style.cssText = [
      'position: relative', 'width: 100%', 'height: 100%',
      'border: none', 'background: transparent', 'pointer-events: auto',
      'display: none', 'user-select: none', '-webkit-user-select: none'
    ].join(';');

    // Snap highlight
    var snapHighlight = document.createElement('div');
    snapHighlight.id = 'vue-inspector-snap-highlight';
    snapHighlight.style.cssText = [
      'position: fixed', 'z-index: 999999', 'pointer-events: none',
      'background: rgba(99,102,241,0.12)', 'border: 2px solid rgba(99,102,241,0.4)',
      'box-shadow: 0 0 24px rgba(99,102,241,0.18)', 'border-radius: 6px',
      'opacity: 0', 'transition: opacity 0.2s ease, left 0.15s ease, top 0.15s ease, width 0.15s ease, height 0.15s ease',
      'left: 0', 'top: 0', 'width: 0', 'height: 0'
    ].join(';');

    // ── Toggle bar (drag handle + chevron) ──
    var toggle = document.createElement('div');
    toggle.id = 'vue-inspector-toggle';

    var dragHandle = document.createElement('div');
    dragHandle.id = 'vue-inspector-drag-handle';
    dragHandle.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" opacity="0.55"><circle cx="9" cy="5" r="1.8"/><circle cx="15" cy="5" r="1.8"/><circle cx="9" cy="12" r="1.8"/><circle cx="15" cy="12" r="1.8"/><circle cx="9" cy="19" r="1.8"/><circle cx="15" cy="19" r="1.8"/></svg>';
    dragHandle.style.cssText = 'display:flex;align-items:center;justify-content:center;cursor:grab;padding:4px;border-radius:4px;transition:background 0.15s ease;';
    dragHandle.addEventListener('mouseenter', function() { dragHandle.style.background = 'rgba(255,255,255,0.1)'; });
    dragHandle.addEventListener('mouseleave', function() { dragHandle.style.background = 'transparent'; });

    var chevronBtn = document.createElement('button');
    chevronBtn.id = 'vue-inspector-chevron-btn';
    chevronBtn.style.cssText = 'display:flex;align-items:center;justify-content:center;background:none;border:none;color:inherit;cursor:pointer;padding:4px;border-radius:4px;transition:background 0.15s ease;';
    var chevron = document.createElement('div');
    chevron.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>';
    chevron.style.cssText = 'display:flex;align-items:center;justify-content:center;transform:rotate(0deg);transition:transform 0.25s cubic-bezier(0.4,0,0.2,1);';
    chevronBtn.appendChild(chevron);
    chevronBtn.addEventListener('mouseenter', function() { chevronBtn.style.background = 'rgba(255,255,255,0.1)'; });
    chevronBtn.addEventListener('mouseleave', function() { chevronBtn.style.background = 'transparent'; });

    toggle.appendChild(dragHandle);
    toggle.appendChild(chevronBtn);

    var resizeHandle = document.createElement('div');

    // ── Floating resize handles (8 directions) ──
    var RESIZE_CORNER = 14;
    var floatingResizes = document.createElement('div');
    floatingResizes.style.cssText = 'position:absolute;inset:0;pointer-events:none;display:none;';
    var floatingResizeDirs = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
    floatingResizeDirs.forEach(function(dir) {
      var el = document.createElement('div');
      var b = 'position:absolute;pointer-events:auto;';
      var C = RESIZE_CORNER;
      if (dir === 'n')  el.style.cssText = b + 'top:0;left:' + C + 'px;right:' + C + 'px;height:6px;cursor:ns-resize;';
      if (dir === 's')  el.style.cssText = b + 'bottom:0;left:' + C + 'px;right:' + C + 'px;height:6px;cursor:ns-resize;';
      if (dir === 'e')  el.style.cssText = b + 'top:' + C + 'px;right:0;bottom:' + C + 'px;width:6px;cursor:ew-resize;';
      if (dir === 'w')  el.style.cssText = b + 'top:' + C + 'px;left:0;bottom:' + C + 'px;width:6px;cursor:ew-resize;';
      if (dir === 'ne') el.style.cssText = b + 'top:0;right:0;width:' + C + 'px;height:' + C + 'px;cursor:ne-resize;';
      if (dir === 'nw') el.style.cssText = b + 'top:0;left:0;width:' + C + 'px;height:' + C + 'px;cursor:nw-resize;';
      if (dir === 'se') el.style.cssText = b + 'bottom:0;right:0;width:' + C + 'px;height:' + C + 'px;cursor:se-resize;';
      if (dir === 'sw') el.style.cssText = b + 'bottom:0;left:0;width:' + C + 'px;height:' + C + 'px;cursor:sw-resize;';

      el.addEventListener('pointerdown', function(e) {
        e.preventDefault(); e.stopPropagation();
        iframe.style.pointerEvents = 'none';
        document.body.style.userSelect = 'none';
        el.setPointerCapture(e.pointerId);
        var sx = e.clientX, sy = e.clientY;
        var sfx = floatingX, sfy = floatingY, sfw = floatingWidth, sfh = floatingHeight;
        var mw = MIN_WIDTH, mh = MIN_HEIGHT + TITLEBAR_H;
        function onMove(ev) {
          var dx = ev.clientX - sx, dy = ev.clientY - sy;
          var nx = sfx, ny = sfy, nw = sfw, nh = sfh;
          if (dir.indexOf('e') !== -1) nw = Math.max(mw, sfw + dx);
          if (dir.indexOf('w') !== -1) { nw = Math.max(mw, sfw - dx); nx = sfx + sfw - nw; }
          if (dir.indexOf('s') !== -1) nh = Math.max(mh, sfh + dy);
          if (dir.indexOf('n') !== -1) { nh = Math.max(mh, sfh - dy); ny = sfy + sfh - nh; }
          floatingX = nx; floatingY = ny; floatingWidth = nw; floatingHeight = nh;
          root.style.left = nx + 'px'; root.style.top = ny + 'px';
          root.style.width = nw + 'px'; root.style.height = nh + 'px';
        }
        function onUp(ev) {
          iframe.style.pointerEvents = 'auto';
          document.body.style.userSelect = '';
          el.releasePointerCapture(ev.pointerId);
          el.removeEventListener('pointermove', onMove);
          el.removeEventListener('pointerup', onUp);
          saveDockState();
        }
        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerup', onUp);
      });
      floatingResizes.appendChild(el);
    });

    // ── Chevron rotation helper ──
    function getChevronRotation() {
      var base = { bottom: 0, top: 180, left: -90, right: 90, floating: 0 };
      var b = base[dockPosition] || 0;
      return isCollapsed ? 'rotate(' + b + 'deg)' : 'rotate(' + (b + 180) + 'deg)';
    }

    // ═══════════════════════════════════════════════════════
    // Layout engine
    // ═══════════════════════════════════════════════════════
    function applyLayout() {
      var isFloating = dockPosition === 'floating';
      var isVert = dockPosition === 'left' || dockPosition === 'right';

      // root
      if (isFloating && isCollapsed) {
        root.style.cssText = 'position:fixed;left:' + floatingX + 'px;top:' + floatingY + 'px;z-index:1000000;pointer-events:auto;user-select:none;-webkit-user-select:none;';
      } else if (isFloating) {
        root.style.cssText = 'position:fixed;left:' + floatingX + 'px;top:' + floatingY + 'px;width:' + floatingWidth + 'px;height:' + floatingHeight + 'px;z-index:1000000;pointer-events:auto;border-radius:8px;overflow:hidden;background:#0f0f0f;box-shadow:0 8px 32px rgba(0,0,0,0.45),0 0 0 1px rgba(255,255,255,0.08);user-select:none;-webkit-user-select:none;';
      } else if (dockPosition === 'bottom') {
        root.style.cssText = 'position:fixed;left:0;bottom:0;width:100vw;z-index:1000000;pointer-events:none;user-select:none;-webkit-user-select:none;';
      } else if (dockPosition === 'top') {
        root.style.cssText = 'position:fixed;left:0;top:0;width:100vw;z-index:1000000;pointer-events:none;user-select:none;-webkit-user-select:none;';
      } else if (dockPosition === 'left') {
        root.style.cssText = 'position:fixed;left:0;top:0;height:100vh;z-index:1000000;pointer-events:none;user-select:none;-webkit-user-select:none;';
      } else {
        root.style.cssText = 'position:fixed;right:0;top:0;height:100vh;z-index:1000000;pointer-events:none;user-select:none;-webkit-user-select:none;';
      }

      // host
      if (isFloating) {
        host.style.cssText = 'position:relative;width:100%;height:' + (isCollapsed ? '0px' : 'calc(100% - ' + TITLEBAR_H + 'px)') + ';overflow:hidden;pointer-events:auto;overscroll-behavior:contain;';
      } else if (isVert) {
        var pw = isCollapsed ? 0 : dockWidth;
        host.style.cssText = 'position:relative;height:100%;width:' + pw + 'px;overflow:hidden;pointer-events:' + (isCollapsed ? 'none' : 'auto') + ';overscroll-behavior:contain;';
      } else {
        var ph = isCollapsed ? 0 : height;
        host.style.cssText = 'position:relative;width:100%;height:' + ph + 'px;overflow:hidden;pointer-events:' + (isCollapsed ? 'none' : 'auto') + ';overscroll-behavior:contain;';
      }

      // iframe
      iframe.style.display = isCollapsed ? 'none' : 'block';

      // toggle
      var pill = 'background:rgba(15,15,15,0.85);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);color:rgba(255,255,255,0.95);pointer-events:auto;display:flex;align-items:center;justify-content:center;gap:2px;';
      if (isFloating && isCollapsed) {
        toggle.style.cssText = 'width:72px;height:' + TITLEBAR_H + 'px;border-radius:14px;' + pill + 'border:1px solid rgba(255,255,255,0.12);box-shadow:0 2px 12px rgba(0,0,0,0.25),0 1px 0 rgba(255,255,255,0.06) inset;';
      } else if (isFloating) {
        toggle.style.cssText = 'position:relative;width:100%;height:' + TITLEBAR_H + 'px;background:rgba(15,15,15,0.95);color:rgba(255,255,255,0.95);border:none;border-bottom:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;padding:0 4px;gap:2px;pointer-events:auto;cursor:default;';
      } else if (dockPosition === 'bottom') {
        var bh = isCollapsed ? 0 : height;
        toggle.style.cssText = 'position:absolute;bottom:' + bh + 'px;left:50%;transform:translateX(-50%);width:72px;height:28px;border-radius:14px 14px 0 0;' + pill + 'border:1px solid rgba(255,255,255,0.12);border-bottom:none;box-shadow:0 -2px 12px rgba(0,0,0,0.25),0 1px 0 rgba(255,255,255,0.06) inset;';
      } else if (dockPosition === 'top') {
        var th = isCollapsed ? 0 : height;
        toggle.style.cssText = 'position:absolute;top:' + th + 'px;left:50%;transform:translateX(-50%);width:72px;height:28px;border-radius:0 0 14px 14px;' + pill + 'border:1px solid rgba(255,255,255,0.12);border-top:none;box-shadow:0 2px 12px rgba(0,0,0,0.25),0 -1px 0 rgba(255,255,255,0.06) inset;';
      } else if (dockPosition === 'left') {
        var lw = isCollapsed ? 0 : dockWidth;
        toggle.style.cssText = 'position:absolute;left:' + lw + 'px;top:50%;transform:translateY(-50%);width:28px;height:72px;border-radius:0 14px 14px 0;' + pill + 'flex-direction:column;border:1px solid rgba(255,255,255,0.12);border-left:none;box-shadow:2px 0 12px rgba(0,0,0,0.25),-1px 0 0 rgba(255,255,255,0.06) inset;';
      } else if (dockPosition === 'right') {
        var rw = isCollapsed ? 0 : dockWidth;
        toggle.style.cssText = 'position:absolute;right:' + rw + 'px;top:50%;transform:translateY(-50%);width:28px;height:72px;border-radius:14px 0 0 14px;' + pill + 'flex-direction:column;border:1px solid rgba(255,255,255,0.12);border-right:none;box-shadow:-2px 0 12px rgba(0,0,0,0.25),1px 0 0 rgba(255,255,255,0.06) inset;';
      }

      toggle.setAttribute('data-dock', dockPosition);
      chevron.style.transform = getChevronRotation();

      // resize handle
      if (isFloating || isCollapsed) {
        resizeHandle.style.cssText = 'display:none;';
      } else if (dockPosition === 'bottom') {
        resizeHandle.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:6px;cursor:ns-resize;pointer-events:auto;';
      } else if (dockPosition === 'top') {
        resizeHandle.style.cssText = 'position:absolute;bottom:0;left:0;width:100%;height:6px;cursor:ns-resize;pointer-events:auto;';
      } else if (dockPosition === 'left') {
        resizeHandle.style.cssText = 'position:absolute;top:0;right:0;height:100%;width:6px;cursor:ew-resize;pointer-events:auto;';
      } else {
        resizeHandle.style.cssText = 'position:absolute;top:0;left:0;height:100%;width:6px;cursor:ew-resize;pointer-events:auto;';
      }

      // floating resize handles (8-dir)
      floatingResizes.style.display = (isFloating && !isCollapsed) ? 'block' : 'none';
    }

    // ── Snap zones ──
    function detectSnapZone(px, py) {
      var vw = window.innerWidth, vh = window.innerHeight;
      if (py >= vh - SNAP_THRESHOLD) return 'bottom';
      if (py <= SNAP_THRESHOLD) return 'top';
      if (px <= SNAP_THRESHOLD) return 'left';
      if (px >= vw - SNAP_THRESHOLD) return 'right';
      return null;
    }

    function showSnapHighlight(zone) {
      var vw = window.innerWidth, vh = window.innerHeight, m = 4;
      if (zone === 'bottom') {
        snapHighlight.style.left = m + 'px'; snapHighlight.style.top = (vh - height - m) + 'px';
        snapHighlight.style.width = (vw - m * 2) + 'px'; snapHighlight.style.height = height + 'px';
      } else if (zone === 'top') {
        snapHighlight.style.left = m + 'px'; snapHighlight.style.top = m + 'px';
        snapHighlight.style.width = (vw - m * 2) + 'px'; snapHighlight.style.height = height + 'px';
      } else if (zone === 'left') {
        snapHighlight.style.left = m + 'px'; snapHighlight.style.top = m + 'px';
        snapHighlight.style.width = dockWidth + 'px'; snapHighlight.style.height = (vh - m * 2) + 'px';
      } else {
        snapHighlight.style.left = (vw - dockWidth - m) + 'px'; snapHighlight.style.top = m + 'px';
        snapHighlight.style.width = dockWidth + 'px'; snapHighlight.style.height = (vh - m * 2) + 'px';
      }
      snapHighlight.style.opacity = '1';
    }

    function hideSnapHighlight() { snapHighlight.style.opacity = '0'; }

    // ── Collapse / Expand ──
    function applyCollapsed(next) {
      if (isCollapsed === next) return;
      isCollapsed = next;

      if (!isCollapsed && !iframeLoaded) {
        iframeLoaded = true;
        iframe.src = baseURL + '/injected_ui/#standalone=' + encodeURIComponent(baseURL);
      }

      applyLayout();

      if (iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          __VUE_INSPECTOR__: true, broadcast: true,
          message: { type: 'VUE_INSPECTOR_VISIBILITY_CHANGED', visible: !isCollapsed }
        }, '*');
      }

      if (isCollapsed && !hasVue && iframeLoaded) {
        iframe.src = 'about:blank';
        iframeLoaded = false;
      }
    }

    chevronBtn.onclick = function(e) {
      e.stopPropagation();
      applyCollapsed(!isCollapsed);
    };

    window.__VUE_INSPECTOR_SET_HAS_VUE__ = function(value) { hasVue = value; };

    // ── Resize handle ──
    var resizeDragging = false;
    var rStartY = 0, rStartX = 0, rStartH = 0, rStartW = 0;

    resizeHandle.addEventListener('pointerdown', function(e) {
      e.preventDefault();
      resizeDragging = true;
      rStartY = e.clientY; rStartX = e.clientX;
      rStartH = height; rStartW = dockWidth;
      document.body.style.userSelect = 'none';
      iframe.style.pointerEvents = 'none';
      resizeHandle.setPointerCapture(e.pointerId);
    });

    resizeHandle.addEventListener('pointermove', function(e) {
      if (!resizeDragging) return;
      if (dockPosition === 'bottom') {
        height = clamp(MIN_HEIGHT, window.innerHeight - MAX_OFFSET, rStartH + (rStartY - e.clientY));
      } else if (dockPosition === 'top') {
        height = clamp(MIN_HEIGHT, window.innerHeight - MAX_OFFSET, rStartH + (e.clientY - rStartY));
      } else if (dockPosition === 'left') {
        dockWidth = clamp(MIN_WIDTH, window.innerWidth - MAX_OFFSET, rStartW + (e.clientX - rStartX));
      } else if (dockPosition === 'right') {
        dockWidth = clamp(MIN_WIDTH, window.innerWidth - MAX_OFFSET, rStartW + (rStartX - e.clientX));
      }
      applyLayout();
    });

    resizeHandle.addEventListener('pointerup', function(e) {
      resizeDragging = false;
      document.body.style.userSelect = '';
      iframe.style.pointerEvents = 'auto';
      resizeHandle.releasePointerCapture(e.pointerId);
      saveDockState();
    });

    // ── interact.js drag setup ──
    if (window.interact) {
      window.interact(dragHandle).draggable({
        inertia: false,
        listeners: {
          start: function(event) {
            iframe.style.pointerEvents = 'none';
            if (dockPosition !== 'floating') {
              var isVert = dockPosition === 'left' || dockPosition === 'right';
              floatingWidth = clamp(400, 800, Math.round(window.innerWidth * 0.5));
              floatingHeight = isVert
                ? clamp(300, 600, Math.round(window.innerHeight * 0.5))
                : Math.max(height + TITLEBAR_H, MIN_HEIGHT + TITLEBAR_H);
              var visualH = isCollapsed ? TITLEBAR_H : floatingHeight;
              var visualW = isCollapsed ? 72 : floatingWidth;
              floatingX = clamp(0, window.innerWidth - visualW, event.clientX - visualW / 2);
              floatingY = clamp(0, window.innerHeight - visualH, event.clientY - 18);
              dockPosition = 'floating';
              applyLayout();
              iframe.style.pointerEvents = 'none';
            }
            dragHandle.style.cursor = 'grabbing';
          },
          move: function(event) {
            floatingX += event.dx;
            floatingY += event.dy;
            var vw = isCollapsed ? 72 : floatingWidth;
            floatingX = clamp(0, window.innerWidth - vw, floatingX);
            floatingY = clamp(0, window.innerHeight - 40, floatingY);
            root.style.left = floatingX + 'px';
            root.style.top = floatingY + 'px';
            var zone = detectSnapZone(event.client.x, event.client.y);
            zone ? showSnapHighlight(zone) : hideSnapHighlight();
          },
          end: function(event) {
            iframe.style.pointerEvents = 'auto';
            dragHandle.style.cursor = 'grab';
            hideSnapHighlight();
            var zone = detectSnapZone(event.client.x, event.client.y);
            if (zone) {
              dockPosition = zone;
              if (isCollapsed) applyCollapsed(false);
              else applyLayout();
            }
            saveDockState();
          }
        }
      });
    }

    // Keep floating window in bounds on viewport resize
    window.addEventListener('resize', function() {
      if (dockPosition === 'floating') {
        var vw = isCollapsed ? 72 : floatingWidth;
        floatingX = clamp(0, window.innerWidth - vw, floatingX);
        floatingY = clamp(0, window.innerHeight - 40, floatingY);
        root.style.left = floatingX + 'px';
        root.style.top = floatingY + 'px';
        if (!isCollapsed) {
          floatingWidth = Math.min(floatingWidth, window.innerWidth);
          root.style.width = floatingWidth + 'px';
        }
      }
    });

    // ── Styles ──
    var uiStyles = document.createElement('style');
    uiStyles.textContent = [
      '#vue-inspector-toggle:focus,',
      '#vue-inspector-toggle:focus-visible,',
      '#vue-inspector-toggle button:focus,',
      '#vue-inspector-toggle button:focus-visible { outline: none; }',
      '#vue-inspector-toggle:not([data-dock="floating"]):hover {',
      '  background: rgba(25,25,25,0.92) !important;',
      '}'
    ].join('\n');
    root.appendChild(uiStyles);

    // ── Assemble ──
    // Toggle BEFORE host so it renders at top in floating mode.
    // In docked modes toggle is position:absolute, so order is irrelevant.
    host.appendChild(iframe);
    host.appendChild(resizeHandle);
    root.appendChild(toggle);
    root.appendChild(host);
    root.appendChild(floatingResizes);
    document.documentElement.appendChild(root);
    document.documentElement.appendChild(snapHighlight);

    applyLayout();

    // ── Message relay ──
    setupMessageRelay(iframe);

    // ── Breakpoint auto-expand ──
    var pendingNetworkMessages = [];

    function expandAndLoadIframe() {
      if (!isCollapsed) return;
      applyCollapsed(false);
    }

    iframe.addEventListener('load', function() {
      if (pendingNetworkMessages.length === 0) return;
      var replayed = false;
      var doReplay = function() {
        if (replayed) return;
        replayed = true;
        window.removeEventListener('message', readyListener);
        var msgs = pendingNetworkMessages.splice(0);
        for (var i = 0; i < msgs.length; i++) {
          if (iframe.contentWindow) {
            iframe.contentWindow.postMessage({
              __VUE_INSPECTOR__: true, broadcast: true, message: msgs[i]
            }, '*');
          }
        }
      };
      var readyListener = function(event) {
        if (event.data && event.data.__VUE_INSPECTOR__ && event.source === iframe.contentWindow) {
          setTimeout(doReplay, 100);
        }
      };
      window.addEventListener('message', readyListener);
      setTimeout(doReplay, 1000);
    });

    window.addEventListener('message', function(event) {
      var data = event.data;
      if (!data) return;

      if (data.__VUE_INSPECTOR__ && data.message && data.message.type === 'EXPAND_INSPECTOR' &&
          event.source === iframe.contentWindow) {
        expandAndLoadIframe();
        return;
      }

      if (data.__FROM_VUE_INSPECTOR__ && data.__NETWORK__ &&
          data.type === 'NETWORK_BREAKPOINT_HIT') {
        pendingNetworkMessages.push(data);
        expandAndLoadIframe();
      }
    });
  }
  
  // ===== Element Highlight System =====
  var _highlightOverlay = null;
  var _highlightedElement = null;
  var _highlightRafId = null;
  var ELEMENT_UID_ATTR = 'data-vue-inspector-uid';

  function ensureHighlightOverlay() {
    if (_highlightOverlay) return;
    var el = document.createElement('div');
    el.id = 'vue-inspector-highlight-overlay';
    el.style.cssText = [
      'position: fixed',
      'pointer-events: none',
      'z-index: 999998',
      'border: 3px solid #8b5cf6',
      'background-color: rgba(139,92,246,0.1)',
      'box-shadow: 0 0 0 1px rgba(139,92,246,0.4), 0 0 20px rgba(139,92,246,0.3), inset 0 0 20px rgba(139,92,246,0.1)',
      'transition: all 0.2s ease-in-out',
      'border-radius: 4px',
      'display: none'
    ].join(';');
    document.body.appendChild(el);
    _highlightOverlay = el;

    window.addEventListener('scroll', updateOverlayPosition, true);
    window.addEventListener('resize', updateOverlayPosition);
  }

  function updateOverlayPosition() {
    if (!_highlightedElement || !_highlightOverlay) return;
    if (_highlightRafId) return;
    _highlightRafId = requestAnimationFrame(function() {
      _highlightRafId = null;
      if (!_highlightedElement || !_highlightOverlay) return;
      if (!_highlightedElement.isConnected) { hideOverlay(); return; }
      var rect = _highlightedElement.getBoundingClientRect();
      _highlightOverlay.style.display = 'block';
      _highlightOverlay.style.left = rect.left + 'px';
      _highlightOverlay.style.top = rect.top + 'px';
      _highlightOverlay.style.width = rect.width + 'px';
      _highlightOverlay.style.height = rect.height + 'px';
    });
  }

  function highlightByUid(uid) {
    var el = document.querySelector('[' + ELEMENT_UID_ATTR + '="' + uid + '"]');
    if (!el || !el.isConnected) return false;
    ensureHighlightOverlay();
    _highlightedElement = el;
    updateOverlayPosition();
    return true;
  }

  function hideOverlay() {
    if (_highlightOverlay) _highlightOverlay.style.display = 'none';
    _highlightedElement = null;
  }

  /**
   * Message Relay - мост между UI iframe и injected script
   */
  function setupMessageRelay(iframe) {
    var pendingRequests = {};
    var cachedFlags = null;
    
    var responseTypeMap = {
      'COLLECT_VUE_COMPONENTS': 'VUE_INSPECTOR_COMPONENTS_DATA',
      'VUE_INSPECTOR_GET_COMPONENTS': 'VUE_INSPECTOR_COMPONENTS_DATA',
      'GET_COMPONENT_PROPS': 'VUE_INSPECTOR_COMPONENT_PROPS_DATA',
      'VUE_INSPECTOR_GET_COMPONENT_PROPS': 'VUE_INSPECTOR_COMPONENT_PROPS_DATA',
      'VUE_INSPECTOR_UPDATE_PROPS': 'VUE_INSPECTOR_UPDATE_PROPS_RESULT',
      'UPDATE_COMPONENT_PROPS': 'VUE_INSPECTOR_UPDATE_PROPS_RESULT',
      'PINIA_GET_STORES_SUMMARY': 'PINIA_STORES_SUMMARY_DATA',
      'PINIA_GET_STORE_STATE': 'PINIA_STORE_STATE_DATA',
      'PINIA_PATCH_STATE': 'PINIA_PATCH_STATE_RESULT',
      'PINIA_REPLACE_STATE': 'PINIA_REPLACE_STATE_RESULT',
      'PINIA_PATCH_GETTERS': 'PINIA_PATCH_GETTERS_RESULT',
      'PINIA_CALL_ACTION': 'PINIA_CALL_ACTION_RESULT',
      'PINIA_CHECK_DETECTED': 'PINIA_DETECTED_RESULT',
      'PINIA_BUILD_SEARCH_INDEX': 'PINIA_SEARCH_INDEX_READY',
      'VUE_INSPECTOR_GET_FLAGS': 'VUE_INSPECTOR_DETECTION_RESULT',
      'VUE_INSPECTOR_CHECK_VUE': 'VUE_INSPECTOR_DETECTION_RESULT'
    };
    
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
      
      if (data.__VUE_INSPECTOR__) {
        // Message logging removed
      }

      if (event.source === iframe.contentWindow) {
        // Raw message logging removed
      }
      
      if (event.source === iframe.contentWindow && data.__VUE_INSPECTOR__) {
        var requestId = data.requestId;
        var message = data.message;
        
        if (!message || !message.type) return;

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

        if (message.type === 'HIGHLIGHT_BY_UID') {
          var success = highlightByUid(message.uid);
          if (requestId && iframe.contentWindow) {
            iframe.contentWindow.postMessage({
              __VUE_INSPECTOR__: true,
              responseId: requestId,
              response: { success: success }
            }, '*');
          }
          return;
        }
        if (message.type === 'UNHIGHLIGHT_ELEMENT') {
          hideOverlay();
          if (requestId && iframe.contentWindow) {
            iframe.contentWindow.postMessage({
              __VUE_INSPECTOR__: true,
              responseId: requestId,
              response: { success: true }
            }, '*');
          }
          return;
        }
        
        if (message.type === 'GET_FEATURE_FLAGS' || message.type === 'VUE_INSPECTOR_GET_FLAGS') {
          if (cachedFlags) {
            if (requestId && iframe.contentWindow) {
              iframe.contentWindow.postMessage({
                __VUE_INSPECTOR__: true,
                responseId: requestId,
                response: { type: 'VUE_INSPECTOR_FEATURE_FLAGS', flags: cachedFlags }
              }, '*');
            }
            if (iframe.contentWindow) {
              iframe.contentWindow.postMessage({
                __VUE_INSPECTOR__: true,
                broadcast: true,
                message: { type: 'VUE_INSPECTOR_FEATURE_FLAGS', flags: cachedFlags }
              }, '*');
            }
            return;
          }
          window.postMessage({ type: 'VUE_INSPECTOR_GET_FLAGS' }, '*');
          if (requestId) {
            pendingRequests[requestId] = {
              type: 'VUE_INSPECTOR_GET_FLAGS',
              source: iframe.contentWindow,
              timestamp: Date.now()
            };
          }
          return;
        }
        
        if (requestId && responseTypeMap[message.type]) {
          pendingRequests[requestId] = {
            type: message.type,
            source: iframe.contentWindow,
            timestamp: Date.now()
          };
        }
        
        var forwardMessage = Object.assign({}, message);
        if (requestId) {
          forwardMessage.requestId = requestId;
        }
        
        if (forwardMessage.type === 'COLLECT_VUE_COMPONENTS') {
          forwardMessage.type = 'VUE_INSPECTOR_GET_COMPONENTS';
        }
        if (forwardMessage.type === 'GET_COMPONENT_PROPS') {
          forwardMessage.type = 'VUE_INSPECTOR_GET_COMPONENT_PROPS';
          forwardMessage.componentPath = forwardMessage.componentUid;
        }
        if (forwardMessage.type === 'UPDATE_COMPONENT_PROPS') {
          forwardMessage.type = 'VUE_INSPECTOR_UPDATE_PROPS';
          forwardMessage.componentPath = forwardMessage.componentUid;
        }
        window.postMessage(forwardMessage, '*');
        return;
      }
      
      var isKnownResponseType = data.type && (
        data.type.indexOf('_DATA') !== -1 ||
        data.type.indexOf('_RESULT') !== -1 ||
        data.type.indexOf('_READY') !== -1 ||
        data.type === 'VUE_INSPECTOR_DETECTION_RESULT' ||
        data.type === 'PINIA_DETECTED_RESULT'
      );
      
      if (event.source === window && (data.__FROM_VUE_INSPECTOR__ || isKnownResponseType)) {
        if (data.type === 'VUE_INSPECTOR_DETECTION_RESULT') {
          cachedFlags = {
            hasVue: data.hasVue,
            hasPinia: data.hasPinia,
            vueVersion: data.vueVersion
          };
          
          if (window.__VUE_INSPECTOR_SET_HAS_VUE__) {
            window.__VUE_INSPECTOR_SET_HAS_VUE__(data.hasVue);
          }
          
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
        
        var respondedRequestId = data.requestId;
        
        if (!respondedRequestId && requestTypeByResponse[data.type]) {
          var possibleTypes = requestTypeByResponse[data.type];
          Object.keys(pendingRequests).forEach(function(reqId) {
            if (possibleTypes.indexOf(pendingRequests[reqId].type) !== -1) {
              respondedRequestId = reqId;
            }
          });
        }
        
        if (respondedRequestId && pendingRequests[respondedRequestId]) {
          var pending = pendingRequests[respondedRequestId];
          delete pendingRequests[respondedRequestId];
          if (pending.source) {
            var responsePayload = data;
            if (data.type === 'VUE_INSPECTOR_COMPONENT_PROPS_DATA' && (pending.type === 'GET_COMPONENT_PROPS' || pending.type === 'VUE_INSPECTOR_GET_COMPONENT_PROPS')) {
              responsePayload = { props: data.props || {}, newUid: data.newUid };
            }
            pending.source.postMessage({
              __VUE_INSPECTOR__: true,
              responseId: respondedRequestId,
              response: responsePayload
            }, '*');
          }
          return;
        }
        
        if (iframe.contentWindow) {
          iframe.contentWindow.postMessage({
            __VUE_INSPECTOR__: true,
            broadcast: true,
            message: data
          }, '*');
        }
      }
    });
    
    setInterval(function() {
      var now = Date.now();
      Object.keys(pendingRequests).forEach(function(reqId) {
        if (now - pendingRequests[reqId].timestamp > 30000) {
          delete pendingRequests[reqId];
        }
      });
    }, 30000);
  }

  // ═══════════════════════════════════════════════════════════
  // Init
  // ═══════════════════════════════════════════════════════════
  function init() {
    Promise.all([injectScript(), loadInteractJS()])
      .then(function() {
        injectUI();
      })
      .catch(function(err) {
        // Fallback: try without interact.js
        injectUI();
      });
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
