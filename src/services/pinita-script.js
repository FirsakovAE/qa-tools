/**
 * Pinia Inspector v9.2 - Production-Ready Store Inspector
 * Features: Live snapshots, search index, action tracking, diagnostics
 */
(function() {
    "use strict";

    console.log('🎯 Pinia Inspector v9.2 - Production-Ready');

    // Configuration
    const config = {
        debug: true,
        maxDepth: 15,
        maxIndexSize: 10000,
        maxTimelineSize: 1000,
        verbose: false // Детальное логирование каждого store (false = только итоги)
    };

    // Store instance tracking (prevents duplicate snapshots)
    const StoreInstanceMap = new WeakMap();

    // Main data structure
    // 🎯 Глобальный индекс (единственный источник правды)
    const SearchIndex = {
        version: 2,

        // exact value → entries
        exact: new Map(),

        // token → Set<exactValue>
        tokens: new Map(),

        // storeId → Set<exactValue>
        storeMap: new Map(),

        totalEntries: 0
    };

    const VirtualStore = {
        pinia: null,
        stores: {},
        timeline: [],
        meta: {
            version: "9.2-production",
            foundVia: null,
            lastUpdate: 0,
            piniaUid: null,
            newStoreCheckInterval: null // Интервал для проверки новых stores
        }
    };

    // Logger utility
    const logger = {
        log: (...args) => config.debug && console.log('🔍', ...args),
        success: (...args) => config.debug && console.log('✅', ...args),
        warn: (...args) => config.debug && console.log('⚠️', ...args),
        error: (...args) => config.debug && console.log('❌', ...args),
        group: (...args) => config.debug && console.group(...args),
        groupEnd: () => config.debug && console.groupEnd()
    };

    const PiniaInspector = {
        // ===== PINIA DETECTION =====

        findPiniaUltimate: function() {
            logger.group('🚀 УЛЬТИМАТИВНЫЙ ПОИСК PINIA');
            
            // ШАГ 1: Проверяем Map который вы показали
            logger.log('ШАГ 1: Проверяем window._s напрямую');
            
            if (window._s && window._s instanceof Map && window._s.size > 0) {
                logger.success('Нашел window._s Map!', window._s);
                
                const fakePinia = {
                    _s: window._s,
                    $id: 'found-in-window',
                    foundVia: 'window._s'
                };
                
                VirtualStore.meta.foundVia = 'window._s';
                return fakePinia;
            }
            
                        
            // ШАГ 2: Ищем по всему window
            logger.log('ШАГ 2: Сканирую все свойства window');
            
            const candidates = [];
            const props = Object.getOwnPropertyNames(window);
            
            for (const prop of props) {
                // Пропускаем стандартные свойства
                if (prop.startsWith('_') || prop === 'window' || prop === 'document' || 
                    prop === 'console' || prop === 'localStorage' || prop === 'sessionStorage') {
                    continue;
                }
                
                try {
                    const value = window[prop];
                    
                    // Проверяем, не является ли это Map с stores
                    if (value && value instanceof Map) {
                        logger.log(`Проверяю ${prop} (Map размер: ${value.size})`);
                        
                        // Проверяем содержимое Map
                        const firstEntry = Array.from(value.entries())[0];
                        if (firstEntry && firstEntry[1] && typeof firstEntry[1] === 'object') {
                            if (firstEntry[1].$id || firstEntry[1].$state) {
                                logger.success(`Map ${prop} содержит Pinia stores!`);
                                
                                const fakePinia = {
                                    _s: value,
                                    $id: `found-in-${prop}`,
                                    foundVia: prop
                                };
                                
                                VirtualStore.meta.foundVia = prop;
                                return fakePinia;
                            }
                        }
                    }
                    
                    // Проверяем другие объекты
                    if (value && typeof value === 'object' && value._s) {
                        logger.log(`Проверяю ${prop} (имеет _s)`);
                        candidates.push({ prop, value });
                    }
            } catch (e) {
                    // Игнорируем ошибки доступа
                }
            }
            
            // ШАГ 3: Проверяем кандидатов
            if (candidates.length > 0) {
                logger.log(`ШАГ 3: Проверяю ${candidates.length} кандидатов`);
                
                for (const candidate of candidates) {
                    if (this.isValidPinia(candidate.value)) {
                        logger.success(`Нашел Pinia в window.${candidate.prop}`);
                        VirtualStore.meta.foundVia = candidate.prop;
                        return candidate.value;
                    }
                }
            }
            
            // ШАГ 4: Ищем Vue приложения
            logger.log('ШАГ 4: Ищу Vue приложения');
            
            // Проверяем все элементы с Vue атрибутами
            const vueSelectors = [
                '[data-v-app]',
                '[__vue_app__]',
                '[__vue__]',
                '[vue-app]',
                '[vue]'
            ];
            
            for (const selector of vueSelectors) {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    logger.log(`Нашел ${elements.length} элементов с ${selector}`);
                    
                    for (const el of elements) {
                        // Vue 3
                        if (el.__vue_app__) {
                            logger.log('Проверяю Vue 3 app');
                            
                            const app = el.__vue_app__;
                            const pinia = this.findPiniaInVueApp(app);
                            if (pinia) {
                                logger.success('Нашел Pinia в Vue 3 app');
                                return pinia;
                            }
                        }
                        
                        // Vue 2
                        if (el.__vue__) {
                            logger.log('Проверяю Vue 2 instance');
                            
                            const instance = el.__vue__;
                            if (instance.$pinia) {
                                logger.success('Нашел Pinia в Vue 2 instance');
                                return instance.$pinia;
                            }
                        }
                    }
                }
            }
            
            // ШАГ 5: Глубокий поиск
            logger.log('ШАГ 5: Глубокий поиск в известных объектах');
            
            const deepSearchTargets = [
                'app', 'vue', 'store', 'pinia', 
                'nuxt', '$nuxt', 'router', '$router',
                'main', 'Main', 'App', 'APP'
            ];
            
            for (const target of deepSearchTargets) {
                const obj = window[target];
                if (obj && typeof obj === 'object') {
                    const found = this.deepSearch(obj, target, 0);
                    if (found) {
                        logger.success(`Нашел Pinia в window.${target}`);
                        return found;
                    }
                }
            }
                        
            logger.warn('ШАГ 6: Pinia не найдена');
            logger.groupEnd();
            return null;
        },
        
        // Глубокий поиск в объекте
        deepSearch: function(obj, path, depth) {
            if (depth > config.maxDepth) return null;
            if (!obj || typeof obj !== 'object') return null;

            // Проверяем текущий объект
            if (this.isValidPinia(obj)) {
                logger.success(`Нашел Pinia в ${path}`);
                return obj;
            }

            // Проверяем наличие _s
            if (obj._s && (obj._s instanceof Map || typeof obj._s === 'object')) {
                logger.success(`Нашел _s в ${path}`);

                const fakePinia = {
                    _s: obj._s,
                    $id: `found-in-${path}`,
                    foundVia: path
                };

                return fakePinia;
            }

            // Рекурсивный поиск
            const keys = Object.keys(obj).slice(0, 20);
            for (const key of keys) {
                if (key.startsWith('__') || key === 'constructor') continue;

                try {
                    const value = obj[key];
                    if (value && typeof value === 'object') {
                        const found = this.deepSearch(value, `${path}.${key}`, depth + 1);
                        if (found) return found;
                    }
                } catch (e) {
                    // Игнорируем ошибки
                }
            }

            return null;
        },

        // Поиск Pinia в Vue приложении
        findPiniaInVueApp: function(app) {
            if (!app) return null;
                        
                        // Проверяем provides
            if (app._context?.provides) {
                            const provides = app._context.provides;
                            
                // Стандартные ключи Pinia
                const piniaKeys = [
                    'pinia',
                    '$pinia',
                    Symbol.for('pinia')
                ];

                for (const key of piniaKeys) {
                    const pinia = provides[key];
                    if (pinia && this.isValidPinia(pinia)) {
                        return pinia;
                    }
                }

                // Ищем все ключи
                for (const key in provides) {
                    const value = provides[key];
                    if (value && this.isValidPinia(value)) {
                        return value;
                    }
                }
            }

            // Проверяем config.globalProperties
            if (app.config?.globalProperties?.$pinia) {
                            return app.config.globalProperties.$pinia;
                        }

            return null;
        },

        // Проверка, является ли объект Pinia
        isValidPinia: function(obj) {
            if (!obj || typeof obj !== 'object') return false;

            // Основные признаки Pinia
            const hasStores = obj._s && (
                obj._s instanceof Map ||
                typeof obj._s === 'object'
            );

            // Дополнительные признаки
            const hasPiniaProperties =
                typeof obj.install === 'function' ||
                typeof obj.use === 'function' ||
                typeof obj._a === 'object' ||
                typeof obj._p === 'object';

            return hasStores || hasPiniaProperties;
        },


        // ===== SNAPSHOT MANAGEMENT =====

        snapshotStore: function(storeId, forceRefresh = false) {
            if (config.verbose) {
                logger.group(`📸 Stable Snapshot для ${storeId}`);
            }
            
            const store = this.getStore(storeId);
            if (!store) {
                if (config.verbose) {
                    logger.groupEnd();
                }
                // Возвращаем Promise для совместимости с подписками
                return Promise.resolve(null);
            }

            // 🔧 FIX 1: Привязка snapshot к instance с учетом версии
            // 🔥 КРИТИЧЕСКИЙ ФИКС: Если forceRefresh = true, пропускаем проверку и создаем новый snapshot
            // 🔥 КРИТИЧЕСКИЙ ФИКС: Всегда возвращаем Promise для совместимости с подписками
            if (!forceRefresh) {
                const prev = StoreInstanceMap.get(store);
                const currentVersion = VirtualStore.stores[storeId]?.version || 0;

                if (prev && prev.version === currentVersion) {
                    if (config.verbose) {
                        logger.log(`📋 Instance уже обработан (v${currentVersion}), возвращаем существующий snapshot`);
                        logger.groupEnd();
                    }
                    // Возвращаем Promise для совместимости с подписками
                    return Promise.resolve(VirtualStore.stores[storeId]);
                }
            } else {
                if (config.verbose) {
                    logger.log(`🔄 Принудительное обновление snapshot для ${storeId}`);
                }
            }

            // ✅ ФИКС №2: Stable snapshot barrier
            // Ждем microtask для стабильного состояния
            return Promise.resolve().then(() => {
                // Создаем stable копию state
                const rawState = this.createStableStateSnapshot(store);
                // 🔥 КРИТИЧЕСКИЙ ФИКС: При forceRefresh используем текущую версию из VirtualStore или 0
                // Это гарантирует, что версия будет обновлена даже если snapshot был удален
                const previousVersion = VirtualStore.stores[storeId]?.version || 0;
            
            // Создаем полный snapshot
                const timestamp = Date.now();
            const snapshot = {
                id: storeId,
                    timestamp: timestamp,
                    timestampFormatted: this.formatTimestamp(timestamp),
                    version: previousVersion + 1, // ✅ ФИКС №4: versioning (всегда увеличиваем версию)
                
                    // 📦 State (stable)
                    state: rawState,
                
                // 📐 Getters (метаданные)
                getters: this.extractGettersMetadata(store),
                
                // ⚡ Actions (метаданные)
                actions: this.extractActionsMetadata(store),
                
                // 🧠 Action Data (история вызовов)
                    actionData: VirtualStore.stores[storeId]?.actionData || {},

                    // 🔍 Diagnostics (обнаружение ghost errors)
                    diagnostics: this.runDiagnostics(storeId, rawState),
                
                // 📊 Статистика
                stats: {
                    stateKeys: 0,
                    getterKeys: 0,
                    actionCount: 0,
                        actionDataCount: 0,
                        diagnosticsCount: 0
                }
            };
            
            // Подсчитываем статистику
            snapshot.stats.stateKeys = Object.keys(snapshot.state).length;
            snapshot.stats.getterKeys = Object.keys(snapshot.getters).length;
            snapshot.stats.actionCount = snapshot.actions.length;
                snapshot.stats.diagnosticsCount = snapshot.diagnostics.length;

                // 🔧 FIX 1: Регистрируем instance с версией
                StoreInstanceMap.set(store, {
                    snapshotId: storeId,
                    version: snapshot.version,
                    timestamp: snapshot.timestamp
                });
            
            // Сохраняем в VirtualStore
            VirtualStore.stores[storeId] = snapshot;
            
                // 🔥 Новая архитектура: индексация отдельно в refreshAllStores
                // this.indexSnapshot(storeId, snapshot); // НЕ ЗДЕСЬ

                // 📝 Добавляем в timeline
                this.addToTimeline('snapshot', { storeId, version: snapshot.version, timestamp: snapshot.timestamp });

                // 🔥 Новая архитектура: индексация отдельно в refreshAllStores
                // this.indexStore(storeId, rawState); // НЕ ЗДЕСЬ

                if (config.verbose) {
                    logger.success(`✅ Stable Snapshot v${snapshot.version}: ${snapshot.stats.stateKeys} state, ${snapshot.stats.actionCount} actions`);
                    logger.groupEnd();
                }
            
            return snapshot;
            });
        },
        
        // ✅ ФИКС №2: Stable state snapshot
        createStableStateSnapshot: function(store) {
            try {
                const source = store.$state && typeof store.$state === 'object' ? store.$state : store;

                // ⚠️ FIX 6: structuredClone сохраняет Date, Map, Set и т.д.
                if (typeof structuredClone === 'function') {
                    return structuredClone(source);
                } else {
                    // Fallback для старых браузеров
                    return JSON.parse(JSON.stringify(source));
                }
            } catch (e) {
                logger.warn('Не удалось создать stable snapshot, использую fallback');
                // Fallback - глубокое извлечение без JSON
                return this.deepExtractState(store);
            }
        },

        // ===== DATA EXTRACTION =====
        deepExtractState: function(store, maxDepth = 8) {
            try {
                if (store.$state && typeof store.$state === 'object') {
                    return this.deepExtractObject(store.$state, maxDepth, 0, 'state');
                } else {
                    return this.deepExtractObject(store, maxDepth, 0, 'store');
                }
            } catch (e) {
                return { error: e.message };
            }
        },
        
        deepExtractObject: function(obj, maxDepth, currentDepth = 0, path = '') {
            if (currentDepth >= maxDepth) return { _type: 'max_depth' };
            if (!obj || typeof obj !== 'object') return obj;
            
            // Специальные типы
            if (typeof obj === 'function') {
                return { 
                    _type: 'function',
                    name: obj.name || 'anonymous',
                    length: obj.length,
                    async: obj.constructor.name === 'AsyncFunction'
                };
            }
            
            if (obj instanceof Promise) {
                return { _type: 'promise', status: 'pending' };
            }
            
            if (obj instanceof Date) {
                return { _type: 'date', value: obj.toISOString() };
            }
            
            // Объект или массив
            const result = Array.isArray(obj) ? [] : {};
            const keys = Object.keys(obj).slice(0, 100); // Ограничиваем
            
            for (const key of keys) {
                // Пропускаем системные ключи
                if (key.startsWith('_') && !key.startsWith('_type')) continue;
                if (key.startsWith('$') && key !== '$id') continue;
                
                const currentPath = path ? `${path}.${key}` : key;
                
                try {
                    const value = obj[key];
                    
                    if (value && typeof value === 'object') {
                        result[key] = this.deepExtractObject(
                            value, 
                            maxDepth, 
                            currentDepth + 1, 
                            currentPath
                        );
                    } else {
                        result[key] = value;
                    }
                    
                    // ✅ ФИКС №3: ИНДЕКСАЦИЯ ТОЛЬКО ЧЕРЕЗ SNAPSHOT
                    // Убрана индексация в обход snapshot
                    
                } catch (e) {
                    result[key] = { _type: 'error', message: e.message };
                }
            }
            
            return result;
        },
        
        // ===== METADATA EXTRACTION =====
        extractGettersMetadata: function(store) {
            const getters = {};
            
            try {
                const allKeys = new Set([
                    ...Object.keys(store),
                    ...Object.getOwnPropertyNames(store)
                ]);
                
                for (const key of allKeys) {
                    if (key.startsWith('$') || key.startsWith('_')) continue;
                    
                    try {
                        const desc = Object.getOwnPropertyDescriptor(store, key);
                        if (desc && desc.get) {
                            getters[key] = {
                                type: 'getter',
                                hasSetter: !!desc.set,
                                writable: desc.writable !== false,
                                enumerable: desc.enumerable !== false
                            };
                            
                            // Пробуем получить значение геттера
                            try {
                                const value = store[key];
                                getters[key].value = value;
                                getters[key].valueType = typeof value;
                                
                                // ✅ ФИКС №3: ИНДЕКСАЦИЯ ТОЛЬКО ЧЕРЕЗ SNAPSHOT
                                // Убрана индексация в обход snapshot
                            } catch (e) {
                                getters[key].valueError = e.message;
                            }
                        }
                    } catch (e) {
                        // Пропускаем ошибки
                    }
                }
            } catch (e) {
                logger.error('Ошибка при извлечении геттеров:', e);
            }
            
            return getters;
        },
        
        // 5. ИЗВЛЕЧЕНИЕ METADATA ACTIONS (БЕЗ МУТАЦИИ STORE)
        extractActionsMetadata: function(store) {
            const actions = [];
            
            try {
                // Forbidden keys filter (like original pinita-script.js)
                const FORBIDDEN_KEYS = new Set([
                    '__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__',
                    'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable', 'toString',
                    'toLocaleString', 'valueOf', '__proto__', 'constructor'
                ]);

                // Get all possible action keys (same approach as original)
                const actionKeys = new Set([
                    ...Object.keys(store),
                    ...Object.getOwnPropertyNames(store)
                ]);
                
                // HMR actions filter (like original)
                const hmrActions = store._hmrPayload?.actions;
                const seen = new Set();
                    
                for (const key of actionKeys) {
                    if (seen.has(key)) continue;
                    seen.add(key);

                        const value = store[key];

                    // HMR filter: skip if HMR payload exists and action is not in it
                    if (hmrActions && !hmrActions.includes(key)) continue;

                    if (typeof value === 'function' &&
                        !key.startsWith('$') &&
                        !key.startsWith('_') &&
                        !FORBIDDEN_KEYS.has(key)) {

                            const actionInfo = {
                                name: key,
                            source: store.$options?.actions?.[key]
                        };

                        actions.push(actionInfo);
                    }
                }

                actions.sort((a, b) => a.name.localeCompare(b.name));
            } catch (e) {
                logger.error('Error extracting actions:', e);
            }

            return actions;
        },

        getWrappedAction: function(storeId, actionName) {
            const store = this.getStore(storeId);
            if (!store || typeof store[actionName] !== 'function') return null;

            const originalFn = store[actionName];

            // Проверяем, есть ли уже обертка
            VirtualStore.meta.actionWrappers = VirtualStore.meta.actionWrappers || new WeakMap();
            if (VirtualStore.meta.actionWrappers.has(originalFn)) {
                return VirtualStore.meta.actionWrappers.get(originalFn);
            }

            // Создаем обертку
            const inspector = this;
            const wrappedFn = async function(...args) {
                const storeCtx = this;
                                const timestamp = Date.now();
                                
                                // Записываем данные вызова
                const callId = `${storeId}.${actionName}_${timestamp}`;
                                const callData = {
                                    id: callId,
                                    store: storeId,
                    action: actionName,
                    args: inspector.sanitizeArgs(args),
                                    timestamp: timestamp,
                    timestampFormatted: inspector.formatTimestamp(timestamp),
                                    startTime: performance.now()
                                };
                                
                // Добавляем в timeline
                inspector.addToTimeline('action', callData);
                                
                                // Сохраняем в actionData
                if (!VirtualStore.stores[storeId].actionData[actionName]) {
                    VirtualStore.stores[storeId].actionData[actionName] = [];
                                }
                                
                VirtualStore.stores[storeId].actionData[actionName].push(callData);
                                
                                // Ограничиваем историю
                if (VirtualStore.stores[storeId].actionData[actionName].length > 10) {
                    VirtualStore.stores[storeId].actionData[actionName].shift();
                }

                try {
                    const result = await originalFn.apply(storeCtx, args);

                                    callData.endTime = performance.now();
                                    callData.duration = callData.endTime - callData.startTime;
                    callData.result = inspector.sanitizeResult(result);
                                    callData.success = true;
                                    
                                    return result;
                                } catch (error) {
                                    callData.endTime = performance.now();
                                    callData.duration = callData.endTime - callData.startTime;
                                    callData.error = error.message;
                                    callData.success = false;
                                    
                                    throw error;
                                }
            };

            // Сохраняем обертку
            VirtualStore.meta.actionWrappers.set(originalFn, wrappedFn);

            return wrappedFn;
        },

        // ===== NEW INDEXING ARCHITECTURE =====

        // 🧩 1. Центральная функция индексации (ядро)
        indexAny: function(value, meta) {
            const { storeId, path, depth, currentKey } = meta;
            const MAX_DEPTH = config.maxDepth || 15;

            if (depth > MAX_DEPTH) return;
            if (value === null || value === undefined) return;

            const t = typeof value;

            // ⛔ Служебные поля (проверяем ключ)
            if (currentKey && (currentKey.startsWith('_') || currentKey.startsWith('$'))) return;

            // 🔤 Примитивы - индексируем
            if (t === 'string' || t === 'number' || t === 'boolean') {
                this.addIndexEntry(value, meta);
                return;
            }

            // 📦 Массив - рекурсивно
                if (Array.isArray(value)) {
                value.forEach((v, i) =>
                    this.indexAny(v, {
                        ...meta,
                        currentKey: i.toString(),
                        path: `${path}[${i}]`,
                        depth: depth + 1
                    })
                );
                return;
            }

            // 🧠 Объект - рекурсивно
            if (t === 'object') {
                for (const key of Object.keys(value)) {
                    this.indexAny(value[key], {
                        ...meta,
                        currentKey: key,
                        path: path ? `${path}.${key}` : key,
                        depth: depth + 1
                    });
                }
            }
        },
        
        // 🧩 2. Единая точка записи в индекс
        addIndexEntry: function(rawValue, meta) {
            // 🔧 FIX 4: Ограничение размера индекса
            if (SearchIndex.totalEntries >= config.maxIndexSize) return;

            const exact = String(rawValue).toLowerCase().trim();
            if (!exact || exact.length > 100) return; // Ограничиваем длину

            // === exact index ===
            if (!SearchIndex.exact.has(exact)) {
                SearchIndex.exact.set(exact, []);
            }

            SearchIndex.exact.get(exact).push({
                storeId: meta.storeId,
                path: meta.path,
                type: typeof rawValue,
                timestamp: Date.now()
            });

            // === store map ===
            if (!SearchIndex.storeMap.has(meta.storeId)) {
                SearchIndex.storeMap.set(meta.storeId, new Set());
            }
            SearchIndex.storeMap.get(meta.storeId).add(exact);

            // === token index ===
            for (const token of this.tokenize(exact)) {
                if (!SearchIndex.tokens.has(token)) {
                    SearchIndex.tokens.set(token, new Set());
                }
                SearchIndex.tokens.get(token).add(exact);
            }

            SearchIndex.totalEntries++;
        },

        // 🧩 3. Индексация целого store
        indexStore: function(storeId, state) {
            if (config.verbose) {
                logger.group(`📇 Индексация store: ${storeId}`);
            }

            this.indexAny(state, {
                storeId,
                currentKey: null,
                path: '',
                depth: 0
            });

            if (config.verbose) {
                logger.success(`✅ Store ${storeId} индексирован`);
                logger.groupEnd();
            }
        },

        // 🧩 4. Корректный сброс индекса
        clearSearchIndex: function() {
            SearchIndex.exact.clear();
            SearchIndex.tokens.clear();
            SearchIndex.storeMap.clear();
            SearchIndex.totalEntries = 0;
            logger.log('🧹 Search index cleared');
        },
        
        // 7. ПОИСК ПО ИНДЕКСУ (с фильтрацией по версии)
        // 🔍 Новая функция поиска с LIKE поддержкой
        search: function(query, options = {}) {
            logger.group(`🔍 Search: "${query}"`);

            if (!query || !query.trim()) {
                logger.warn('Empty query');
                logger.groupEnd();
                return [];
            }
            
            const q = query.toLowerCase().trim();
            const isLike = q.includes('%');
            const results = [];
            const seen = new Set();

            // ===== EXACT =====
            if (!isLike) {
                const hits = SearchIndex.exact.get(q) || [];
                for (const hit of hits) {
                    results.push({
                        ...hit,
                        matchType: 'exact',
                        relevance: 1.0,
                        timestampFormatted: this.formatTimestamp(hit.timestamp)
                    });
                }

                logger.success(`✅ Found ${results.length} exact matches`);
                logger.groupEnd();
                return results;
            }

            // ===== LIKE =====
            const pattern = q.replace(/%/g, '').toLowerCase();

            // Для LIKE поиска перебираем все exact значения и ищем совпадения
            for (const [exactValue, entries] of SearchIndex.exact) {
                if (!exactValue.includes(pattern)) continue;

                if (seen.has(exactValue)) continue;
                seen.add(exactValue);

                for (const entry of entries) {
                        results.push({
                        ...entry,
                        matchType: 'like',
                        relevance: exactValue === pattern ? 0.9 : 0.6,
                        timestampFormatted: this.formatTimestamp(entry.timestamp)
                    });
                }
            }
            
            // Сортируем по релевантности
            results.sort((a, b) => b.relevance - a.relevance);

            // Инвариант: индекс не должен быть пустым
            console.assert(
                SearchIndex.exact.size > 0,
                '❌ Index empty'
            );

            console.log(
                `📊 Index size:`,
                SearchIndex.exact.size,
                `entries`,
                SearchIndex.totalEntries
            );

            logger.success(`✅ Found ${results.length} LIKE matches`);
            logger.groupEnd();
            
            return results.slice(0, 50);
        },
        
        // 8. ПОЛУЧИТЬ ВСЕ STORES SUMMARY
        getAllStoresSummary: function() {
            logger.group('📊 Все stores summary');
            
            const summary = {};
            let totalSearchableKeys = 0;

            // 🔧 FIX 6: Дедупликация summary
            const uniqueStores = new Set(Object.keys(VirtualStore.stores));
            
            // Проходим по всем snapshot'ам
            for (const storeId of uniqueStores) {
                const snapshot = VirtualStore.stores[storeId];
                
                // Подсчитываем actionData
                let actionDataCount = 0;
                for (const actionName in snapshot.actionData) {
                    actionDataCount += snapshot.actionData[actionName].length;
                }
                
                // Подсчитываем searchable keys из SearchIndex
                const searchableKeys = SearchIndex.storeMap.get(storeId)?.size || 0;
                totalSearchableKeys += searchableKeys;
                
                // Создаем summary
                summary[storeId] = {
                    id: storeId,
                    baseId: this.normalizeStoreId(storeId), // ✅ FIX: Normalized ID for dynamic stores
                    stateKeys: snapshot.stats.stateKeys,
                    getterKeys: snapshot.stats.getterKeys,
                    actions: snapshot.stats.actionCount,
                    actionData: actionDataCount,
                    searchableKeys: searchableKeys,
                    lastUpdated: snapshot.timestamp,
                    lastUpdatedFormatted: PiniaInspector.formatTimestamp(snapshot.timestamp)
                };
            }
            
            logger.success(`✅ Summary готов: ${Object.keys(summary).length} stores, ${totalSearchableKeys} индексированных ключей`);
            logger.groupEnd();
            
            return summary;
        },
        
        // 9. ОБНОВИТЬ ВСЕ STORES (ЕДИНСТВЕННОЕ МЕСТО СБРОСА ИНДЕКСА)
        refreshAllStores: async function() {
            logger.group('🔄 Обновление всех stores');
            
            if (!VirtualStore.pinia) {
                logger.error('Pinia не инициализирована');
                logger.groupEnd();
                return false;
            }

            // ✅ ЕДИНСТВЕННОЕ МЕСТО: Полный сброс индекса
            this.clearSearchIndex();
            
            // 🔥 КРИТИЧЕСКИЙ ФИКС: Удаляем старые snapshots из VirtualStore перед обновлением
            // Это гарантирует, что все stores будут пересозданы с новыми timestamp
            const stores = this.getStoresList();
            stores.forEach(storeId => {
                delete VirtualStore.stores[storeId];
            });
            
            if (config.verbose) {
                logger.log(`🧹 Удалено ${stores.length} старых snapshots для принудительного обновления`);
            }
            
            const promises = stores.map(storeId => this.snapshotStore(storeId, true)); // forceRefresh = true
            const snapshots = await Promise.all(promises);
            
            // Индексируем каждый store
            let indexedCount = 0;
            snapshots.forEach(snapshot => {
                if (snapshot) {
                    this.indexStore(snapshot.id, snapshot.state);
                    indexedCount++;
                }
            });
            
            // 🔥 КРИТИЧЕСКИЙ ФИКС: Устанавливаем подписки на изменения для всех stores
            // Это обеспечивает автоматическое обновление при последующих изменениях
            // Также проверяем и устанавливаем подписки на новые stores
            this.attachAllStoreListeners();
            const newStoresCount = this.checkAndAttachNewStores();
            
            const updatedCount = snapshots.filter(snapshot => snapshot !== null).length;
            VirtualStore.meta.lastUpdate = Date.now();
            
            // Компактное итоговое сообщение
            logger.success(`✅ Обновлено ${updatedCount} stores, индексировано ${indexedCount}${newStoresCount > 0 ? `, новых: ${newStoresCount}` : ''}`);
            logger.groupEnd();
            
            return updatedCount;
        },
        
        // ===== REACTIVE UPDATES (SUBSCRIPTIONS) =====
        
        // Подписка на изменения store (автоматическое обновление snapshots)
        attachStoreListeners: function(store) {
            // Проверяем, не подписались ли уже
            if (store.__piniaInspectorAttached) {
                return;
            }
            store.__piniaInspectorAttached = true;
            
            const inspector = this;
            
            // Подписка на изменения state
            try {
                const unsubscribeState = store.$subscribe((mutation, state) => {
                    logger.log(`🔄 Store "${store.$id}" state changed, updating snapshot`);
                    // Обновляем snapshot при изменении state (forceRefresh = true для принудительного обновления)
                    inspector.snapshotStore(store.$id, true).then(() => {
                        // Переиндексируем store после обновления
                        const snapshot = VirtualStore.stores[store.$id];
                        if (snapshot) {
                            inspector.indexStore(store.$id, snapshot.state);
                        }
                    }).catch(err => {
                        logger.warn(`Ошибка при обновлении snapshot для store "${store.$id}":`, err.message);
                    });
                });
                
                // Сохраняем функцию отписки для возможности очистки
                store.__piniaInspectorUnsubscribeState = unsubscribeState;
            } catch (e) {
                logger.warn(`Не удалось подписаться на изменения state для store "${store.$id}":`, e.message);
            }
            
            // Подписка на вызовы actions
            try {
                const unsubscribeActions = store.$onAction(({ name, args, after, onError }) => {
                    logger.log(`⚡ Action "${name}" вызван в store "${store.$id}"`);
                    
                    // После успешного выполнения action обновляем snapshot
                    after(() => {
                        logger.log(`✅ Action "${name}" завершен, обновляю snapshot`);
                        // forceRefresh = true для принудительного обновления после action
                        inspector.snapshotStore(store.$id, true).then(() => {
                            const snapshot = VirtualStore.stores[store.$id];
                            if (snapshot) {
                                inspector.indexStore(store.$id, snapshot.state);
                            }
                        }).catch(err => {
                            logger.warn(`Ошибка при обновлении snapshot после action "${name}":`, err.message);
                        });
                    });
                    
                    // При ошибке также обновляем snapshot (для отображения ошибок)
                    onError((error) => {
                        logger.warn(`❌ Action "${name}" завершился с ошибкой:`, error.message);
                        // forceRefresh = true для принудительного обновления после ошибки
                        inspector.snapshotStore(store.$id, true).then(() => {
                            const snapshot = VirtualStore.stores[store.$id];
                            if (snapshot) {
                                inspector.indexStore(store.$id, snapshot.state);
                            }
                        }).catch(err => {
                            logger.warn(`Ошибка при обновлении snapshot после ошибки action "${name}":`, err.message);
                        });
                    });
                });
                
                // Сохраняем функцию отписки
                store.__piniaInspectorUnsubscribeActions = unsubscribeActions;
            } catch (e) {
                logger.warn(`Не удалось подписаться на actions для store "${store.$id}":`, e.message);
            }
            
            logger.log(`✅ Подписки установлены для store "${store.$id}"`);
        },
        
        // Отписка от изменений store
        detachStoreListeners: function(store) {
            if (!store.__piniaInspectorAttached) {
                return;
            }
            
            // Отписываемся от изменений state
            if (store.__piniaInspectorUnsubscribeState) {
                try {
                    store.__piniaInspectorUnsubscribeState();
                    delete store.__piniaInspectorUnsubscribeState;
                } catch (e) {
                    logger.warn(`Ошибка при отписке от state для store "${store.$id}":`, e.message);
                }
            }
            
            // Отписываемся от actions
            if (store.__piniaInspectorUnsubscribeActions) {
                try {
                    store.__piniaInspectorUnsubscribeActions();
                    delete store.__piniaInspectorUnsubscribeActions;
                } catch (e) {
                    logger.warn(`Ошибка при отписке от actions для store "${store.$id}":`, e.message);
                }
            }
            
            delete store.__piniaInspectorAttached;
            logger.log(`✅ Подписки удалены для store "${store.$id}"`);
        },
        
        // Подписка на все stores (включая новые)
        attachAllStoreListeners: function() {
            if (!VirtualStore.pinia || !VirtualStore.pinia._s) {
                logger.warn('Pinia не инициализирована, невозможно установить подписки');
                return;
            }
            
            const stores = this.getStoresList();
            let attachedCount = 0;
            let newStoresCount = 0;
            
            stores.forEach(storeId => {
                const store = this.getStore(storeId);
                if (store) {
                    // Проверяем, не подписались ли уже
                    if (!store.__piniaInspectorAttached) {
                        this.attachStoreListeners(store);
                        attachedCount++;
                        newStoresCount++;
                    } else {
                        // Store уже имеет подписки, но проверяем, что они активны
                        attachedCount++;
                    }
                }
            });
            
            if (config.verbose) {
                if (newStoresCount > 0) {
                    logger.success(`✅ Подписки установлены для ${newStoresCount} новых stores (всего ${attachedCount})`);
                } else {
                    logger.log(`✅ Все ${attachedCount} stores уже имеют подписки`);
                }
            }
        },
        
        // Проверка и установка подписок на новые stores
        checkAndAttachNewStores: function() {
            if (!VirtualStore.pinia || !VirtualStore.pinia._s) {
                return 0;
            }
            
            const currentStores = this.getStoresList();
            let newStoresFound = 0;
            
            currentStores.forEach(storeId => {
                const store = this.getStore(storeId);
                if (store && !store.__piniaInspectorAttached) {
                    logger.log(`🆕 Обнаружен новый store "${storeId}", устанавливаю подписки`);
                    this.attachStoreListeners(store);
                    // Также создаем snapshot для нового store
                    this.snapshotStore(storeId, true).then(() => {
                        const snapshot = VirtualStore.stores[storeId];
                        if (snapshot) {
                            this.indexStore(storeId, snapshot.state);
                        }
                    }).catch(err => {
                        logger.warn(`Ошибка при создании snapshot для нового store "${storeId}":`, err.message);
                    });
                    newStoresFound++;
                }
            });
            
            if (newStoresFound > 0 && config.verbose) {
                logger.success(`✅ Подписки установлены для ${newStoresFound} новых stores`);
            }
            
            return newStoresFound;
        },
        
        // Запуск периодической проверки новых stores
        startNewStoreWatcher: function() {
            // Останавливаем предыдущий интервал, если есть
            if (VirtualStore.meta.newStoreCheckInterval) {
                clearInterval(VirtualStore.meta.newStoreCheckInterval);
            }
            
            // Проверяем новые stores каждые 5 секунд
            VirtualStore.meta.newStoreCheckInterval = setInterval(() => {
                this.checkAndAttachNewStores();
            }, 5000);
            
            logger.log('👀 Запущена периодическая проверка новых stores (каждые 5 секунд)');
        },
        
        // Остановка периодической проверки новых stores
        stopNewStoreWatcher: function() {
            if (VirtualStore.meta.newStoreCheckInterval) {
                clearInterval(VirtualStore.meta.newStoreCheckInterval);
                VirtualStore.meta.newStoreCheckInterval = null;
                logger.log('🛑 Остановлена периодическая проверка новых stores');
            }
        },

        // ===== UTILITY METHODS =====

        // Adapter to ensure timestamp formatting in API responses
        formatApiResponse: function(data) {
            if (!data) return data;

            // Handle arrays
            if (Array.isArray(data)) {
                return data.map(item => this.formatApiResponse(item));
            }

            // Handle objects with timestamp
            if (typeof data === 'object' && data.timestamp && !data.timestampFormatted) {
            return {
                    ...data,
                    timestampFormatted: this.formatTimestamp(data.timestamp)
                };
            }

            return data;
        },

        // Tokenize value for LIKE search
        tokenize: function(value) {
            return value
                .toLowerCase()
                .split(/[^\p{L}\d]+/u)  // \p{L} - любые буквы (включая кириллицу)
                .filter(t => t.length >= 2);
        },

        // Normalize store ID to handle dynamic Pinia stores
        normalizeStoreId: function(id) {
            // 🔧 FIX 5: Whitelist подход вместо агрессивной замены
            // Только для известных динамических паттернов
            if (id.startsWith('navPanelStore_') && id.match(/_[a-z0-9]{8,}$/i)) {
                return 'navPanelStore';
            }
            // Можно добавить другие известные паттерны:
            // if (id.startsWith('modalStore_') && id.match(/_[a-z0-9]{8,}$/i)) {
            //     return 'modalStore';
            // }

            return id; // Возвращаем как есть, если не подходит под паттерны
        },


        // Универсальная функция установки значения по пути (поддержка массивов)
        setByPath: function(target, path, value) {
            const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
            let obj = target;

            for (let i = 0; i < parts.length - 1; i++) {
                const key = parts[i];
                if (!(key in obj)) obj[key] = {};
                obj = obj[key];
            }

            obj[parts.at(-1)] = value;
        },

        // Format timestamp for human-readable display (fast, no dependencies)
        formatTimestamp: function(timestamp) {
            if (!timestamp) return '—';

            const diff = Date.now() - timestamp;

            if (diff < 1000) return 'Just now';
            if (diff < 60_000) return `${Math.floor(diff / 1000)} sec ago`;
            if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
            if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;

            return new Date(timestamp).toLocaleString();
        },
        
        getStore: function(storeId) {
            if (!VirtualStore.pinia) {
                logger.error('Pinia не инициализирована');
                return null;
            }
            
            let store;
            
            if (VirtualStore.pinia._s instanceof Map) {
                store = VirtualStore.pinia._s.get(storeId);
            } else if (VirtualStore.pinia._s && typeof VirtualStore.pinia._s === 'object') {
                store = VirtualStore.pinia._s[storeId];
            }
            
            if (!store) {
                logger.error(`Store "${storeId}" не найден`);
                return null;
            }
            
            return store;
        },
        
        getStoresList: function() {
            if (!VirtualStore.pinia || !VirtualStore.pinia._s) {
                return [];
            }
            
            const stores = [];
            
            try {
                if (VirtualStore.pinia._s instanceof Map) {
                    for (const [id] of VirtualStore.pinia._s) {
                        stores.push(id);
                    }
                } else if (typeof VirtualStore.pinia._s === 'object') {
                    for (const id in VirtualStore.pinia._s) {
                        stores.push(id);
                    }
                }
                    } catch (e) {
                logger.error('Ошибка при получении stores:', e);
            }
            
            return stores.sort();
        },
        
        // ===== PUBLIC API =====
        
        initialize: async function() {
            logger.group('🚀 Initializing Pinia Inspector');

            const foundPinia = this.findPiniaUltimate();
            if (!foundPinia) {
                logger.error('Pinia not found');
                logger.groupEnd();
                return null;
            }
            
            const isNewPinia = !VirtualStore.pinia ||
                !VirtualStore.meta.piniaUid ||
                !VirtualStore.pinia.__pinitaUid;

            if (isNewPinia) {
                VirtualStore.meta.piniaUid = VirtualStore.meta.piniaUid || Symbol('pinia');
                VirtualStore.pinia = foundPinia;
                VirtualStore.pinia.__pinitaUid = VirtualStore.meta.piniaUid;
                logger.success(`✅ Pinia found via: ${VirtualStore.meta.foundVia}`);
            } else {
                if (VirtualStore.pinia.__pinitaUid !== VirtualStore.meta.piniaUid) {
                    logger.warn('⚠️ Different Pinia instance detected, resetting VirtualStore');
                    VirtualStore.stores = {};
                    PiniaInspector.clearSearchIndex();
                    VirtualStore.timeline = [];
                    VirtualStore.pinia = foundPinia;
                    VirtualStore.pinia.__pinitaUid = VirtualStore.meta.piniaUid;
                }
                logger.success('✅ Using existing Pinia instance');
            }

            await this.refreshAllStores();
            
            // 🔥 КРИТИЧЕСКИЙ ФИКС: Устанавливаем подписки на изменения всех stores
            // Это обеспечивает автоматическое обновление snapshots при изменении state или вызове actions
            this.attachAllStoreListeners();
            
            // 🔥 КРИТИЧЕСКИЙ ФИКС: Запускаем периодическую проверку новых stores
            this.startNewStoreWatcher();
            

            logger.log('🎉 Pinia Inspector ready!');
            logger.groupEnd();
            return VirtualStore;
        },
        
        // Демо

        // ✅ ФИКС №5: Diagnostics layer (обнаружение ghost errors)
        runDiagnostics: function(storeId, state) {
            const issues = [];
            const baseId = this.normalizeStoreId(storeId);

            // Диагностика workday (как в примере)
            if (baseId === 'user' && state.workday) {
                const wd = state.workday;

                // Проверяем инварианты
                if (wd.state === true && wd.status >= 400) {
                    issues.push({
                        type: 'ghost_error',
                        severity: 'warning',
                        message: 'Active workday contains error status',
                        path: 'workday',
                        value: wd.status,
                        baseId: baseId,
                        storeId: storeId,
                        suggestion: 'Error should be cleared when workday becomes active'
                    });
                }

                if (wd.state === true && wd.date_finish !== null) {
                    issues.push({
                        type: 'invariant_violation',
                        severity: 'error',
                        message: 'Active workday should not have finish date',
                        path: 'workday.date_finish',
                        value: wd.date_finish,
                        baseId: baseId,
                        storeId: storeId
                    });
                }
            }

            return issues;
        },

        // 🔟 FUTURE-PROOF: Event Timeline
        addToTimeline: function(type, payload) {
            const timestamp = Date.now();
            VirtualStore.timeline.push({
                type: type,
                timestamp: timestamp,
                timestampFormatted: this.formatTimestamp(timestamp),
                payload: payload
            });

            // Ограничиваем размер
            if (VirtualStore.timeline.length > config.maxTimelineSize) {
                VirtualStore.timeline.shift();
            }
        },

        // ===== RESULT UNWRAPPING =====

        unwrapResult: function(result, maxDepth = 3) {
            const unwrapInfo = {
                value: result,
                type: this.getType(result),
                originalType: result?.constructor?.name || 'unknown',
                isProxy: false,
                isCustomClass: false,
                isPromise: false,
                depth: 0,
                raw: result,
                methods: [],
                properties: []
            };

            if (result && typeof result === 'object') {
                const constructorName = result.constructor?.name;
                const standardTypes = ['Object', 'Array', 'Promise', 'Date', 'RegExp', 'Error'];

                // Check for custom class
                if (constructorName && !standardTypes.includes(constructorName)) {
                    unwrapInfo.isCustomClass = true;
                    unwrapInfo.originalType = constructorName;
                    unwrapInfo.methods = this.extractMethods(result);
                    unwrapInfo.properties = this.extractProperties(result);
                }

                // Check for proxy
                unwrapInfo.isProxy =
                    result.__v_isProxy || result.__v_isReactive ||
                    result.__v_isReadonly || result.__v_isShallow ||
                    result.constructor?.name === 'Proxy' ||
                    result.toString().includes('[object Proxy]');

                if (result instanceof Promise) {
                    unwrapInfo.isPromise = true;
                    unwrapInfo.value = { _type: 'Promise', status: 'pending' };
                    return unwrapInfo;
                }

                if (unwrapInfo.isProxy) {
                    unwrapInfo.value = this.deepUnwrap(result, maxDepth);
                    unwrapInfo.depth = maxDepth;
                } else if (!Array.isArray(result)) {
                    unwrapInfo.value = this.deepUnwrap(result, maxDepth);
                }
            }

            return unwrapInfo;
        },

        // ИЗВЛЕЧЕНИЕ МЕТОДОВ ИЗ ОБЪЕКТА
        extractMethods: function(obj) {
            const methods = [];
            const seen = new Set();

            try {
                // Получаем все свойства
                const allProps = [
                    ...Object.getOwnPropertyNames(obj),
                    ...Object.keys(obj)
                ];

                for (const prop of allProps) {
                    if (seen.has(prop)) continue;
                    seen.add(prop);

                    // Пропускаем системные
                    if (prop.startsWith('_') || prop.startsWith('$')) continue;

                    try {
                        const value = obj[prop];
                        if (typeof value === 'function') {
                            methods.push({
                                name: prop,
                                length: this.getFunctionLength(value),
                                async: this.isAsyncFunction(value),
                                source: this.getFunctionSource(value)
                            });
                        }
                    } catch (e) {
                        // Игнорируем
                    }
                }
            } catch (e) {
                // Игнорируем ошибки
            }

            return methods.sort((a, b) => a.name.localeCompare(b.name));
        },

        // ИЗВЛЕЧЕНИЕ СВОЙСТВ
        extractProperties: function(obj) {
            const properties = [];

            try {
                const keys = this.getObjectKeys(obj);

                for (const key of keys) {
                    if (key.startsWith('_') || key.startsWith('$')) continue;

                    try {
                        const value = obj[key];

                        // Пропускаем функции
                        if (typeof value === 'function') continue;

                        properties.push({
                            name: key,
                            type: typeof value,
                            value: this.safeUnwrap(value, 1),
                            hasGetter: this.hasGetter(obj, key),
                            hasSetter: this.hasSetter(obj, key)
                        });
                    } catch (e) {
                        properties.push({
                            name: key,
                            type: 'error',
                            error: e.message
                        });
                    }
                }
            } catch (e) {
                // Игнорируем
            }

            return properties;
        },

        // ПОЛУЧИТЬ ДЛИНУ ФУНКЦИИ (работает с нативными обертками)
        getFunctionLength: function(fn) {
            try {
                // Сначала пробуем стандартное свойство
                if (fn.length !== undefined && fn.length !== 0) {
                    return fn.length;
                }

                // Пробуем получить из строкового представления
                const source = fn.toString();

                // Ищем параметры в function(...) или (...)=>
                const paramMatch = source.match(/^(?:async\s+)?(?:function\s*\w*)?\s*\(([^)]*)\)/);
                if (paramMatch) {
                    const params = paramMatch[1].trim();
                    if (params === '') return 0;

                    // Считаем параметры (учитывая деструктуризацию и значения по умолчанию)
                    const paramCount = params.split(',').filter(p => p.trim() !== '').length;
                    return paramCount;
                }

                // Для стрелочных функций без скобок
                const arrowMatch = source.match(/^(?:async\s+)?(\w+)\s*=>/);
                if (arrowMatch) {
                    return 1;
                }

                return 0;
            } catch (e) {
                return 0;
            }
        },

        // ПРОВЕРИТЬ ЯВЛЯЕТСЯ ЛИ ФУНКЦИЯ ASYNC
        isAsyncFunction: function(fn) {
            try {
                return fn.constructor.name === 'AsyncFunction' ||
                       fn.toString().trim().startsWith('async');
            } catch (e) {
                return false;
            }
        },

        // ПОЛУЧИТЬ ИСХОДНЫЙ КОД ФУНКЦИИ
        getFunctionSource: function(fn) {
            try {
                // Пробуем получить оригинальную функцию
                if (fn._original) {
                    return fn._original.toString();
                }

                const source = fn.toString();

                // Если код слишком длинный, обрезаем
                if (source.length > 1000) {
                    return source.substring(0, 1000) + '...';
                }

                return source;
            } catch (e) {
                return '[Error getting source]';
            }
        },

        // ОПРЕДЕЛИТЬ ТИП ОБЪЕКТА
        getType: function(obj) {
            if (obj === null) return 'null';
            if (obj === undefined) return 'undefined';

            const type = typeof obj;
            if (type !== 'object') return type.charAt(0).toUpperCase() + type.slice(1);

            if (Array.isArray(obj)) return 'Array';

            const constructorName = obj.constructor?.name;
            if (constructorName) {
                return constructorName;
            }

            const toString = Object.prototype.toString.call(obj);
            const match = toString.match(/\[object (\w+)\]/);
            return match ? match[1] : 'Object';
        },

        // ПРОВЕРКА НА GETTER/SETTER
        hasGetter: function(obj, prop) {
            try {
                const descriptor = Object.getOwnPropertyDescriptor(obj, prop);
                return descriptor && typeof descriptor.get === 'function';
            } catch (e) {
                return false;
            }
        },

        hasSetter: function(obj, prop) {
            try {
                const descriptor = Object.getOwnPropertyDescriptor(obj, prop);
                return descriptor && typeof descriptor.set === 'function';
            } catch (e) {
                return false;
            }
        },

        // БЕЗОПАСНАЯ РАСПАКОВКА
        safeUnwrap: function(value, maxDepth = 1) {
            try {
                // Используем deepUnwrap для более глубокой распаковки
                return this.deepUnwrap(value, maxDepth);
            } catch (e) {
                return { _error: e.message };
            }
        },

        // ГЛУБОКАЯ РАСПАКОВКА
        deepUnwrap: function(obj, maxDepth, currentDepth = 0, seen = new WeakSet()) {
            if (currentDepth >= maxDepth) {
                return { _type: 'max_depth', depth: currentDepth };
            }

            if (!obj || typeof obj !== 'object') {
                return obj;
            }

            // Защита от циклических ссылок
            if (seen.has(obj)) {
                return { _type: 'circular_reference' };
            }
            seen.add(obj);

            // Проверяем специальные типы
            const type = this.getType(obj);
            if (type !== 'Object' && type !== 'Array') {
                return { _type: type, value: this.getSimpleValue(obj) };
            }

            // Распаковываем объект/массив
            const result = Array.isArray(obj) ? [] : {};
            const keys = this.getObjectKeys(obj);

            for (const key of keys) {
                // Пропускаем системные ключи
                if (key.startsWith('__v_') || key.startsWith('_')) continue;

                try {
                    const value = obj[key];

                    if (value && typeof value === 'object') {
                        result[key] = this.deepUnwrap(value, maxDepth, currentDepth + 1, seen);
                    } else {
                        result[key] = value;
                    }
                } catch (e) {
                    result[key] = { _type: 'error', message: e.message };
                }
            }

            return result;
        },

        // ОЧИСТИТЬ АРГУМЕНТЫ ДЛЯ ХРАНЕНИЯ
        sanitizeArgs: function(args) {
            if (!Array.isArray(args)) return [];
            return args.map(arg => this.deepUnwrap(arg, 2)); // Ограничиваем глубину для аргументов
        },

        // ОЧИСТИТЬ РЕЗУЛЬТАТ ДЛЯ ХРАНЕНИЯ
        sanitizeResult: function(result) {
            return this.deepUnwrap(result, 3); // Ограничиваем глубину для результатов
        },

        // ПОЛУЧИТЬ КЛЮЧИ ОБЪЕКТА (работает с Proxy)
        getObjectKeys: function(obj) {
            try {
                // Пробуем разные способы
                if (typeof Object.keys === 'function') {
                    return Object.keys(obj).slice(0, 50); // Ограничиваем
                }

                if (typeof Object.getOwnPropertyNames === 'function') {
                    return Object.getOwnPropertyNames(obj)
                        .filter(key => !key.startsWith('_'))
                        .slice(0, 50);
                }

                // Fallback
                const keys = [];
                for (const key in obj) {
                    if (!key.startsWith('_') && keys.length < 50) {
                        keys.push(key);
                    }
                }
                return keys;
            } catch (e) {
                return [];
            }
        },

        // ПОЛУЧИТЬ ПРОСТОЕ ЗНАЧЕНИЕ
        getSimpleValue: function(obj) {
            try {
                if (obj instanceof Date) return obj.toISOString();
                if (obj instanceof RegExp) return obj.toString();
                if (obj instanceof Error) return { message: obj.message, stack: obj.stack };

                // Пробуем JSON
                const json = JSON.stringify(obj);
                if (json.length < 1000) {
                    return JSON.parse(json);
                }

                return { _type: 'complex_object', preview: json.substring(0, 200) + '...' };
            } catch (e) {
                return { _type: 'unserializable', constructor: obj.constructor?.name };
            }
        },


        // ===== STATE EDITING =====

        // 🔥 НОВАЯ ФУНКЦИЯ: Получение вложенного значения
        getNestedValue: function(obj, path) {
            const keys = this.parsePath(path);
            let current = obj;
            
            for (const key of keys) {
                if (current == null || typeof current !== 'object') {
                    return undefined;
                }
                
                if (key.type === 'array') {
                    if (!Array.isArray(current[key.name])) {
                        return undefined;
                    }
                    current = current[key.name][key.index];
                } else {
                    current = current[key.name];
                }
            }
            
            return current;
        },

        // 🔥 НОВАЯ ФУНКЦИЯ: Парсинг пути (поддержка массивов)
        parsePath: function(path) {
            const parts = path.split('.');
            const result = [];
            
            for (const part of parts) {
                const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
                if (arrayMatch) {
                    result.push({
                        type: 'array',
                        name: arrayMatch[1],
                        index: parseInt(arrayMatch[2])
                    });
                } else {
                    result.push({
                        type: 'property',
                        name: part
                    });
                }
            }
            
            return result;
        },

        // 🔥 НОВАЯ ФУНКЦИЯ: Установка значения с реактивностью
        setNestedValueReactive: function(store, path, value) {
            const keys = this.parsePath(path);
            const state = store.$state || store;
            
            // 🔥 КРИТИЧЕСКИЙ ФИКС: Для массивов используем splice для реактивности
            const lastKey = keys[keys.length - 1];
            
            if (lastKey.type === 'array') {
                // Для элементов массива используем Vue.set или splice
                const parent = this.getNestedValue(state, keys.slice(0, -1));
                if (!parent || !Array.isArray(parent[lastKey.name])) {
                    return false;
                }
                
                // Вариант 1: Используем Vue.set если доступен
                if (window.Vue && window.Vue.set) {
                    window.Vue.set(parent[lastKey.name], lastKey.index, value);
                } 
                // Вариант 2: Используем splice для реактивности
                else if (parent[lastKey.name].splice) {
                    parent[lastKey.name].splice(lastKey.index, 1, value);
                }
                // Вариант 3: Прямое присвоение (менее предпочтительно)
                else {
                    parent[lastKey.name][lastKey.index] = value;
                }
                
                return true;
            } else {
                // Для обычных свойств используем разные подходы
                
                // Вариант 1: Используем $patch если доступен (предпочтительно для Pinia)
                if (keys.length === 1 && typeof store.$patch === 'function') {
                    const patchObj = {};
                    patchObj[keys[0].name] = value;
                    store.$patch(patchObj);
                    return true;
                }
                
                // Вариант 2: Используем Vue.set для вложенных свойств
                if (window.Vue && window.Vue.set) {
                    const parent = this.getNestedValue(state, keys.slice(0, -1));
                    if (parent) {
                        window.Vue.set(parent, lastKey.name, value);
                        return true;
                    }
                }
                
                // Вариант 3: Прямое присвоение через промежуточные объекты
                let current = state;
                for (let i = 0; i < keys.length - 1; i++) {
                    const key = keys[i];
                    if (key.type === 'array') {
                        if (!Array.isArray(current[key.name])) {
                            return false;
                        }
                        current = current[key.name][key.index];
                    } else {
                        if (!current[key.name] || typeof current[key.name] !== 'object') {
                            current[key.name] = {};
                        }
                        current = current[key.name];
                    }
                }
                
                current[lastKey.name] = value;
                return true;
            }
        },

        // 🔥 НОВАЯ ФУНКЦИЯ: Принудительный триггер реактивности
        triggerReactiveUpdate: function(store, path, value) {
            try {
                // Способ 1: Вызов фиктивного action (триггерит реактивность)
                if (typeof store.$patch === 'function') {
                    const patchObj = {};
                    const keys = path.split('.');
                    let obj = patchObj;
                    
                    for (let i = 0; i < keys.length - 1; i++) {
                        obj[keys[i]] = {};
                        obj = obj[keys[i]];
                    }
                    obj[keys[keys.length - 1]] = value;
                    
                    store.$patch(patchObj);
                    return true;
                }
                
                // Способ 2: Вызов notify для Vue 3 реактивности
                if (store.$state && store.$state.__v_raw) {
                    // Для Vue 3 реактивных объектов
                    const rawState = store.$state.__v_raw;
                    const keys = this.parsePath(path);
                    let current = rawState;
                    
                    for (let i = 0; i < keys.length; i++) {
                        const key = keys[i];
                        if (key.type === 'array') {
                            if (!Array.isArray(current[key.name])) break;
                            if (i === keys.length - 1) {
                                current[key.name][key.index] = value;
                            } else {
                                current = current[key.name][key.index];
                            }
                        } else {
                            if (i === keys.length - 1) {
                                current[key.name] = value;
                            } else {
                                if (!current[key.name] || typeof current[key.name] !== 'object') {
                                    current[key.name] = {};
                                }
                                current = current[key.name];
                            }
                        }
                    }
                }
                
                // Способ 3: Принудительное обновление через forceUpdate если доступно
                if (typeof store.$forceUpdate === 'function') {
                    store.$forceUpdate();
                }
                
                return true;
            } catch (e) {
                logger.warn('Could not trigger reactive update:', e.message);
                return false;
            }
        },

        // Единичное изменение key-value с поддержкой реактивности (Pinia-safe)
        patchStoreState: function(storeId, path, value) {
            if (config.verbose) {
                logger.group(`🔧 Patching state: ${storeId}.${path}`);
            }
            
            const store = this.getStore(storeId);
            if (!store) {
                logger.error(`Store "${storeId}" not found`);
                if (config.verbose) {
                    logger.groupEnd();
                }
                return Promise.resolve({
                    success: false,
                    error: `Store "${storeId}" not found`
                });
            }
            
            try {
                // Сохраняем старое значение до изменения
                const oldValue = this.getNestedValue(store.$state || store, path);
                
                // 🔥 КРИТИЧЕСКИЙ ФИКС: Используем store.$patch для патчинга реального Pinia store
                if (typeof store.$patch === 'function') {
                    // Используем функцию-колбэк для $patch (рекомендуемый способ)
                    store.$patch((state) => {
                        this.setByPath(state, path, value);
                    });
                } else {
                    // Fallback для старых версий Pinia или нестандартных stores
                    this.setByPath(store.$state || store, path, value);
                }
                
                const timestamp = Date.now();
                const patchInfo = {
                    storeId,
                    path,
                    oldValue: this.safeUnwrap(oldValue, 2),
                    newValue: this.safeUnwrap(value, 2),
                    timestamp,
                    timestampFormatted: this.formatTimestamp(timestamp),
                    success: true
                };
                
                // Добавляем в timeline
                this.addToTimeline('patch', patchInfo);
                
                // 🔥 КРИТИЧЕСКИЙ ФИКС: Обновляем snapshot после патчинга реального store
                return this.snapshotStore(storeId, true).then(() => {
                    // Переиндексируем store
                    const snapshot = VirtualStore.stores[storeId];
                    if (snapshot) {
                        this.indexStore(storeId, snapshot.state);
                    }
                    
                    if (config.verbose) {
                        logger.success(`✅ State patched: ${storeId}.${path}`);
                        logger.log(`   Old value:`, oldValue);
                        logger.log(`   New value:`, value);
                        logger.groupEnd();
                    }
                    
                    return patchInfo;
                });
                
            } catch (error) {
                logger.error(`❌ Failed to patch state:`, error.message);
                
                const errorInfo = {
                    success: false,
                    storeId,
                    path,
                    error: error.message,
                    timestamp: Date.now(),
                    timestampFormatted: this.formatTimestamp(Date.now())
                };
                
                // Добавляем ошибку в timeline
                this.addToTimeline('patch_error', errorInfo);
                if (config.verbose) {
                    logger.groupEnd();
                }
                
                return Promise.resolve(errorInfo);
            }
        },

        // Массовое обновление state с реактивностью (Pinia-safe)
        batchPatchStoreState: function(storeId, patches = []) {
            if (config.verbose) {
                logger.group(`🔧 Batch patching state: ${storeId} (${patches.length} patches)`);
            }
            
            const store = this.getStore(storeId);
            if (!store) {
                logger.error(`Store "${storeId}" not found`);
                if (config.verbose) {
                    logger.groupEnd();
                }
                return Promise.resolve({
                    success: false,
                    error: `Store "${storeId}" not found`
                });
            }
            
            if (!Array.isArray(patches) || patches.length === 0) {
                return Promise.resolve({
                    success: false,
                    error: 'Patches must be a non-empty array'
                });
            }
            
            try {
                // 🔥 КРИТИЧЕСКИЙ ФИКС: Используем store.$patch для массового патчинга
                if (typeof store.$patch === 'function') {
                    store.$patch((state) => {
                        for (const { path, value } of patches) {
                            this.setByPath(state, path, value);
                        }
                    });
                } else {
                    // Fallback
                    for (const { path, value } of patches) {
                        this.setByPath(store.$state || store, path, value);
                    }
                }
                
                const timestamp = Date.now();
                const batchInfo = {
                    storeId,
                    patchesCount: patches.length,
                    timestamp,
                    timestampFormatted: this.formatTimestamp(timestamp),
                    success: true
                };
                
                // Добавляем в timeline
                this.addToTimeline('batch_patch', batchInfo);
                
                // Обновляем snapshot после патчинга
                return this.snapshotStore(storeId, true).then(() => {
                    // Переиндексируем store
                    const snapshot = VirtualStore.stores[storeId];
                    if (snapshot) {
                        this.indexStore(storeId, snapshot.state);
                    }
                    
                    if (config.verbose) {
                        logger.success(`✅ Batch patched: ${storeId} (${patches.length} patches)`);
                        logger.groupEnd();
                    }
                    
            return {
                        success: true,
                        count: patches.length,
                        ...batchInfo
                    };
                });
                
            } catch (error) {
                logger.error(`❌ Failed to batch patch state:`, error.message);
                
                const errorInfo = {
                    success: false,
                    storeId,
                    error: error.message,
                    timestamp: Date.now(),
                    timestampFormatted: this.formatTimestamp(Date.now())
                };
                
                this.addToTimeline('batch_patch_error', errorInfo);
                if (config.verbose) {
                    logger.groupEnd();
                }
                
                return Promise.resolve(errorInfo);
            }
        },

        // Валидация пути к свойству в state
        validateStoreStatePath: function(storeId, path) {
            const store = this.getStore(storeId);
            if (!store) {
                return {
                    valid: false,
                    error: `Store "${storeId}" not found`
                };
            }

            const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
            let obj = store.$state || store;

            for (const key of parts) {
                if (obj == null || !(key in obj)) {
                    return {
                        valid: false,
                        error: `Path "${path}" is invalid: "${key}" not found`,
                        path: path,
                        failedAt: key
                    };
                }
                obj = obj[key];
            }

            return {
                valid: true,
                path: path,
                value: this.safeUnwrap(obj, 2),
                valueType: typeof obj
            };
        },

        // Замена всего JSON
        replaceStoreState: function(storeId, newState) {
            if (config.verbose) {
                logger.group(`🔄 Replacing state: ${storeId}`);
            }
            
            const store = this.getStore(storeId);
            if (!store) {
                logger.error(`Store "${storeId}" not found`);
                if (config.verbose) {
                    logger.groupEnd();
                }
                return Promise.resolve({
                    success: false,
                    error: `Store "${storeId}" not found`
                });
            }
            
            try {
                // Валидируем новый state
                if (!newState || typeof newState !== 'object') {
                    throw new Error('New state must be an object');
                }
                
                const oldState = this.createStableStateSnapshot(store);
                
                // 🔥 КРИТИЧЕСКИЙ ФИКС: Используем $patch для реактивной замены
                if (typeof store.$patch === 'function') {
                    store.$patch(newState);
                } 
                // 🔥 Дополнительный метод: reset для полной замены
                else if (typeof store.$reset === 'function') {
                    // Сохраняем старое состояние
                    const stateKeys = Object.keys(store.$state);
                    for (const key of stateKeys) {
                        delete store.$state[key];
                    }
                    Object.assign(store.$state, newState);
                    // Вызываем reset для реактивности
                    store.$reset();
                }
                // Fallback: прямая замена
                else if (store.$state) {
                    // Очищаем старый state
                    const stateKeys = Object.keys(store.$state);
                    for (const key of stateKeys) {
                        delete store.$state[key];
                    }
                    // Копируем новые свойства с реактивностью
                    for (const key in newState) {
                        if (newState.hasOwnProperty(key)) {
                            this.setNestedValueReactive(store, key, newState[key]);
                        }
                    }
                } 
                // Ultimate fallback
                else {
                    const stateKeys = Object.keys(store);
                    for (const key of stateKeys) {
                        if (!key.startsWith('$') && !key.startsWith('_') && key !== 'constructor') {
                            delete store[key];
                        }
                    }
                    Object.assign(store, newState);
                }
                
                const timestamp = Date.now();
                const replaceInfo = {
                    storeId,
                    oldStateSize: Object.keys(oldState).length,
                    newStateSize: Object.keys(newState).length,
                    changedKeys: this.getChangedKeys(oldState, newState),
                    timestamp,
                    timestampFormatted: this.formatTimestamp(timestamp),
                    success: true
                };
                
                // Добавляем в timeline
                this.addToTimeline('replace', replaceInfo);
                
                // 🔥 КРИТИЧЕСКИЙ ФИКС: Ждем завершения обновления snapshot перед возвратом
                // Это гарантирует, что snapshot будет обновлен до того, как getStoreState вернет данные
                return this.snapshotStore(storeId, true).then(() => {
                    // Переиндексируем store
                    const snapshot = VirtualStore.stores[storeId];
                    if (snapshot) {
                        this.indexStore(storeId, snapshot.state);
                    }
                    
                    if (config.verbose) {
                        logger.success(`✅ State replaced: ${storeId}`);
                        logger.log(`   Old state keys: ${Object.keys(oldState).length}`);
                        logger.log(`   New state keys: ${Object.keys(newState).length}`);
                        logger.groupEnd();
                    }
                    
                    return replaceInfo;
                });
                
            } catch (error) {
                logger.error(`❌ Failed to replace state:`, error.message);
                
                const errorInfo = {
                    success: false,
                    storeId,
                    error: error.message,
                    timestamp: Date.now(),
                    timestampFormatted: this.formatTimestamp(Date.now())
                };
                
                // Добавляем ошибку в timeline
                this.addToTimeline('replace_error', errorInfo);
                if (config.verbose) {
                    logger.groupEnd();
                }
                
                return Promise.resolve(errorInfo);
            }
        },

        // Вспомогательная функция: определение измененных ключей
        getChangedKeys: function(oldObj, newObj) {
            const changed = [];
            const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
            
            for (const key of allKeys) {
                if (!this.isEqual(oldObj[key], newObj[key])) {
                    changed.push(key);
                }
            }
            
            return changed;
        },

        // Вспомогательная функция: глубокое сравнение
        isEqual: function(a, b) {
            // Примитивы
            if (a === b) return true;
            
            // null/undefined
            if (a == null || b == null) return a === b;
            
            // Типы
            if (typeof a !== typeof b) return false;
            
            // Массивы
            if (Array.isArray(a) && Array.isArray(b)) {
                if (a.length !== b.length) return false;
                for (let i = 0; i < a.length; i++) {
                    if (!this.isEqual(a[i], b[i])) return false;
                }
                return true;
            }
            
            // Объекты
            if (typeof a === 'object' && typeof b === 'object') {
                const aKeys = Object.keys(a);
                const bKeys = Object.keys(b);
                
                if (aKeys.length !== bKeys.length) return false;
                
                for (const key of aKeys) {
                    if (!b.hasOwnProperty(key)) return false;
                    if (!this.isEqual(a[key], b[key])) return false;
                }
                return true;
            }
            
            // Прочее (числа, строки, булевы)
            return a === b;
        }
    };

    // ============= ЭКСПОРТ ПУБЛИЧНОГО API =============
    
    const PublicAPI = {
        // Summary & Search
        getAllStoresSummary: () => PiniaInspector.getAllStoresSummary(),
        search: function(query) {
            return PiniaInspector.search(query);
        },
        
        // State
        getStoreState: function(storeId) {
            // 🔥 КРИТИЧЕСКИЙ ФИКС: Всегда получаем live данные из store, а не из snapshot
            // Это гарантирует, что после patchState изменения будут видны сразу
            const store = PiniaInspector.getStore(storeId);
            if (!store) {
                return null;
            }
            
            // Получаем актуальные данные напрямую из store
            return PiniaInspector.createStableStateSnapshot(store);
        },

        getStateValue: (storeId, key) => {
            const snapshot = VirtualStore.stores[storeId];
            if (!snapshot || !snapshot.state) return null;

            const keys = key.split('.');
            let current = snapshot.state;

            for (const k of keys) {
                if (current && typeof current === 'object' && k in current) {
                    current = current[k];
                } else {
                    return null;
                }
            }

            return current;
        },

        // Actions
        getStoreActions: (storeId) => {
            const snapshot = VirtualStore.stores[storeId];
            return snapshot ? snapshot.actions : [];
        },
        
        callAction: (storeId, actionName, ...args) => {
            const store = PiniaInspector.getStore(storeId);
            if (!store || typeof store[actionName] !== 'function') {
                return Promise.reject(`Action "${actionName}" not found`);
            }

            const wrappedAction = PiniaInspector.getWrappedAction(storeId, actionName);
            if (wrappedAction) {
                return wrappedAction.apply(store, args);
            }
            
            return store[actionName](...args);
        },

        callActionUnwrapped: function(storeId, actionName, ...args) {
            // Используем PublicAPI.callAction через this, так как мы в PublicAPI
            return this.callAction(storeId, actionName, ...args)
                .then(result => {
                    if (window.pinitaUnpack && window.pinitaUnpack.unwrapResult) {
                        return window.pinitaUnpack.unwrapResult(result).value;
                    }
                    // Если pinitaUnpack недоступен, используем встроенный unwrapResult
                    return PiniaInspector.unwrapResult(result, 3).value;
                });
        },

        callActionRaw: (storeId, actionName, ...args) => {
            const store = PiniaInspector.getStore(storeId);
            if (!store || typeof store[actionName] !== 'function') {
                return Promise.reject(`Action "${actionName}" not found`);
            }
            return store[actionName](...args);
        },

        unwrapValue: (value, maxDepth = 3) =>
            PiniaInspector.unwrapResult(value, maxDepth).value,

        getValueType: (value) => PiniaInspector.getType(value),
        
        // Getters
        getStoreGetters: (storeId) => {
            const snapshot = VirtualStore.stores[storeId];
            return snapshot ? snapshot.getters : {};
        },
        
        getActionData: function(storeId, actionName) {
            const snapshot = VirtualStore.stores[storeId];
            if (!snapshot || !snapshot.actionData) return null;
            return PiniaInspector.formatApiResponse(snapshot.actionData[actionName]) || null;
        },
        
        // Management
        refreshAllStores: () => PiniaInspector.refreshAllStores(),

        refreshStore: function(storeId) {
            delete VirtualStore.stores[storeId];

            const store = PiniaInspector.getStore(storeId);
            if (store) {
                StoreInstanceMap.delete(store);
            }

            return PiniaInspector.snapshotStore(storeId);
        },
        
        // Info
        getIndexStats: () => ({
            keys: SearchIndex.exact.size,
            tokens: SearchIndex.tokens.size,
            entries: SearchIndex.totalEntries,
            stores: SearchIndex.storeMap.size
        }),
        getStoreInfo: function(storeId) {
            const snapshot = VirtualStore.stores[storeId];
            if (!snapshot) return null;

            return {
                ...snapshot,
                timestampFormatted: PiniaInspector.formatTimestamp(snapshot.timestamp)
            };
        },

        // Timeline & Diagnostics
        getTimeline: () => VirtualStore.timeline,
        getDiagnostics: (storeId) => {
            const snapshot = VirtualStore.stores[storeId];
            return snapshot ? snapshot.diagnostics || [] : [];
        },

        // State Editing
        patchState: function(storeId, path, value) {
            return PiniaInspector.patchStoreState(storeId, path, value);
        },

        // 🔥 НОВЫЙ МЕТОД: Получение значения с проверкой реактивности
        getReactiveValue: function(storeId, path) {
            const store = PiniaInspector.getStore(storeId);
            if (!store) {
                return null;
            }
            
            const value = PiniaInspector.getNestedValue(store.$state || store, path);
            
            // Проверяем, является ли значение реактивным
            if (value && typeof value === 'object') {
                return {
                    value: value,
                    isReactive: !!value.__v_isReactive || !!value.__v_isProxy,
                    isReadonly: !!value.__v_isReadonly,
                    isRef: !!value.__v_isRef,
                    rawValue: value.__v_raw || value
                };
            }
            
            return value;
        },

        // 🔥 НОВЫЙ МЕТОД: Массовое обновление с реактивностью
        patchStateReactive: function(storeId, patches) {
            const store = PiniaInspector.getStore(storeId);
            if (!store) {
                return Promise.resolve({
                    success: false,
                    error: `Store "${storeId}" not found`
                });
            }
            
            // Используем $patch для массового обновления с реактивностью
            if (typeof store.$patch === 'function') {
                const patchObj = {};
                
                for (const patch of patches) {
                    const keys = patch.path.split('.');
                    let obj = patchObj;
                    
                    for (let i = 0; i < keys.length - 1; i++) {
                        if (!obj[keys[i]]) {
                            obj[keys[i]] = {};
                        }
                        obj = obj[keys[i]];
                    }
                    
                    const lastKey = keys[keys.length - 1];
                    const arrayMatch = lastKey.match(/^(\w+)\[(\d+)\]$/);
                    
                    if (arrayMatch) {
                        const arrayName = arrayMatch[1];
                        const arrayIndex = parseInt(arrayMatch[2]);
                        
                        if (!obj[arrayName]) {
                            obj[arrayName] = [];
                        }
                        
                        // Ensure array is long enough
                        while (obj[arrayName].length <= arrayIndex) {
                            obj[arrayName].push(undefined);
                        }
                        
                        obj[arrayName][arrayIndex] = patch.value;
                    } else {
                        obj[lastKey] = patch.value;
                    }
                }
                
                try {
                    store.$patch(patchObj);
                    
                    return Promise.resolve({
                        success: true,
                        patchesApplied: patches.length,
                        usedPatchMethod: true
                    });
                } catch (error) {
                    return Promise.resolve({
                        success: false,
                        error: error.message,
                        patchesApplied: 0
                    });
                }
            }
            
            // Fallback: последовательное применение
            return this.batchPatchState(storeId, patches);
        },

        replaceState: function(storeId, newState) {
            // Если передали строку JSON, парсим
            if (typeof newState === 'string') {
                try {
                    newState = JSON.parse(newState);
                } catch (e) {
                    return Promise.resolve({
                        success: false,
                        error: 'Invalid JSON: ' + e.message
                    });
                }
            }
            
            return PiniaInspector.replaceStoreState(storeId, newState);
        },

        // Batch editing
        batchPatchState: function(storeId, patches) {
            return PiniaInspector.batchPatchStoreState(storeId, patches);
        },

        // State validation
        validateStatePath: function(storeId, path) {
            return PiniaInspector.validateStoreStatePath(storeId, path);
        },
        
        // Info
        info: () => ({
            hasPinia: !!VirtualStore.pinia,
            storesCount: Object.keys(VirtualStore.stores).length,
            indexKeys: SearchIndex.exact.size,
            indexTokens: SearchIndex.tokens.size,
            indexEntries: SearchIndex.totalEntries,
            timelineEvents: VirtualStore.timeline.length,
            foundVia: VirtualStore.meta.foundVia,
            version: VirtualStore.meta.version,
            lastUpdate: VirtualStore.meta.lastUpdate,
            lastUpdateFormatted: PiniaInspector.formatTimestamp(VirtualStore.meta.lastUpdate)
        })
    };

    // ===== UTILITY FUNCTIONS =====

    // Экспортируем
    window.piniaAPI = PublicAPI;
    window.piniaInspector = PiniaInspector;

    // Auto-initialization
    setTimeout(async () => {
        console.log('⏳ Auto-initializing...');

        if (!window.pinitaUnpack) {
            console.log('📦 Loading pinita-unpack.js...');
            // Load pinita-unpack.js in production
        }

        await PiniaInspector.initialize();

            setTimeout(() => {
            console.log('\n🎯 Use window.piniaAPI for:');
            console.log('');
            console.log('📊 SUMMARY & SEARCH:');
            console.log('  piniaAPI.getAllStoresSummary() - get all stores summary');
            console.log('  piniaAPI.search("query") - search across all indexed data');
            console.log('');
            console.log('🏪 STATE ACCESS & EDITING:');
            console.log('  piniaAPI.getStoreState("storeId") - get complete state');
            console.log('  piniaAPI.getStateValue("storeId", "key.path") - get nested value');
            console.log('  piniaAPI.patchState("storeId", "key.path", value) - update single value');
            console.log('  piniaAPI.replaceState("storeId", {new: "state"}) - replace entire state');
            console.log('  piniaAPI.batchPatchState("storeId", [{path, value}, ...]) - batch updates');
            console.log('  piniaAPI.validateStatePath("storeId", "path") - validate path');
            console.log('');
            console.log('⚡ ACTIONS:');
            console.log('  piniaAPI.getStoreActions("storeId") - get all actions');
            console.log('  piniaAPI.callAction("storeId", "actionName", ...args) - execute action');
            console.log('  piniaAPI.callActionUnwrapped("storeId", "actionName", ...args) - execute with unpacking');
            console.log('  piniaAPI.callActionRaw("storeId", "actionName", ...args) - raw action call');
            console.log('  piniaAPI.getActionData("storeId", "actionName") - get action history');
            console.log('');
            console.log('📥 GETTERS:');
            console.log('  piniaAPI.getStoreGetters("storeId") - get all getters');
            console.log('');
            console.log('🔧 MANAGEMENT:');
            console.log('  piniaAPI.refreshAllStores() - refresh all stores and reindex');
            console.log('  piniaAPI.refreshStore("storeId") - refresh single store');
            console.log('');
            console.log('📈 INFO & DIAGNOSTICS:');
            console.log('  piniaAPI.info() - get system info');
            console.log('  piniaAPI.getIndexStats() - get index statistics');
            console.log('  piniaAPI.getStoreInfo("storeId") - get store snapshot');
            console.log('  piniaAPI.getTimeline() - get event timeline');
            console.log('  piniaAPI.getDiagnostics("storeId") - get store diagnostics');
            console.log('');
            console.log('⚙️ UTILITIES:');
            console.log('  piniaAPI.unwrapValue(value, maxDepth) - unwrap Proxy objects');
            console.log('  piniaAPI.getValueType(value) - get value type');
        }, 2000);
    }, 1000);

    return PiniaInspector;
})();