    // ============================================
    // UNIVERSAL VUE PROPS INSPECTOR FOR QA TEAM
    // Версия 1.1
    // Автор: QA Automation
    // ============================================

    (function() {
    'use strict';
    
    console.log('🚀 Запуск Universal Vue Props Inspector v1.1');
    console.log('📋 Для помощи используйте: help()');
    
    // === КОНФИГУРАЦИЯ ===
    const CONFIG = {
        version: '1.1',
        author: 'QA Team',
        defaultPollInterval: 2000,
        maxComponentsToShow: 50,
        enableAutoRefresh: true,
        
        // Фильтры для исключения UI-компонентов
        excludePatterns: [
        ]
    };
    
    const UI_STATE = {
    showOnlyWithProps: false
};

    
    // === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
    let allComponents = [];
    let filteredComponents = [];
    let monitoredComponents = new Map();
    let refreshInterval = null;
    let inspectorPanel = null;
    let isPanelCollapsed = false;
    let panelPosition = { x: 10, y: 10 };
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };
    let editingComponent = null;
    let originalProps = null;
    let editedProps = null;
    let activeComponentUID = null;
    
    // === УТИЛИТЫ ДЛЯ ФИЛЬТРАЦИИ ===
    
    // Проверка, нужно ли исключить компонент
    function shouldExcludeComponent(componentName) {
        if (!componentName) return false;
        
        for (const pattern of CONFIG.excludePatterns) {
        if (pattern.test(componentName)) {
            return true;
        }
        }
        
        return false;
    }
    
    // Фильтрация компонентов
    function filterComponents() {
        filteredComponents = allComponents.filter(comp => 
        !shouldExcludeComponent(comp.name)
        );
        return filteredComponents;
    }
    
    // === ЭФФЕКТЫ НАЖАТИЯ ===
    
    // Эффект нажатия на кнопку
    function createButtonPressEffect(event) {
        const button = event.currentTarget;
        
        // Сохраняем оригинальные стили
        const originalTransform = button.style.transform;
        const originalTransition = button.style.transition;
        const originalBoxShadow = button.style.boxShadow;
        
        // Эффект нажатия
        button.style.transform = 'scale(0.95)';
        button.style.transition = 'transform 0.1s ease, box-shadow 0.1s ease';
        button.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.2)';
        
        // Восстановление через 150мс
        setTimeout(() => {
        button.style.transform = originalTransform;
        button.style.boxShadow = originalBoxShadow;
        
        // Полное восстановление через еще 50мс
        setTimeout(() => {
            button.style.transition = originalTransition;
        }, 50);
        }, 150);
    }
    
    // Показать короткое сообщение о нажатии
    function showButtonPressMessage(buttonText) {
        const message = document.createElement('div');
        message.style.cssText = `
        position: fixed;
        top: 50px;
        right: 50px;
        background: #42b983;
        color: white;
        padding: 8px 16px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: bold;
        z-index: 100000;
        animation: fadeInOut 2s ease;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;
        
        message.textContent = `${buttonText} вызван (Детали в консоли)`;
        
        // Добавляем CSS анимацию
        const style = document.createElement('style');
        style.textContent = `
        @keyframes fadeInOut {
            0% { opacity: 0; transform: translateY(-10px); }
            10% { opacity: 1; transform: translateY(0); }
            90% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(-10px); }
        }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(message);
        
        // Удаляем сообщение после анимации
        setTimeout(() => {
        message.remove();
        style.remove();
        }, 2000);
    }
    
    // === УПРАВЛЕНИЕ ПАНЕЛЬЮ ===
    
    // Перемещение панели
    function initPanelDragging() {
        const header = inspectorPanel.querySelector('.inspector-header');
        if (!header) return;
        
        header.style.cursor = 'move';
        
        header.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDrag);
        
        header.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        startDrag({
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        });
        
        document.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        drag({
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        });
        
        document.addEventListener('touchend', stopDrag);
    }
    
    function startDrag(e) {
        isDragging = true;
        const rect = inspectorPanel.getBoundingClientRect();
        dragOffset.x = e.clientX - rect.left;
        dragOffset.y = e.clientY - rect.top;
        
        inspectorPanel.style.transition = 'none';
        inspectorPanel.style.zIndex = '100000';
    }
    
    function drag(e) {
        if (!isDragging) return;
        
        e.preventDefault();
        
        panelPosition.x = e.clientX - dragOffset.x;
        panelPosition.y = e.clientY - dragOffset.y;
        
        // Ограничиваем перемещение в пределах окна
        const maxX = window.innerWidth - inspectorPanel.offsetWidth;
        const maxY = window.innerHeight - inspectorPanel.offsetHeight;
        
        panelPosition.x = Math.max(0, Math.min(panelPosition.x, maxX));
        panelPosition.y = Math.max(0, Math.min(panelPosition.y, maxY));
        
        inspectorPanel.style.left = panelPosition.x + 'px';
        inspectorPanel.style.top = panelPosition.y + 'px';
    }
    
    function stopDrag() {
        if (!isDragging) return;
        isDragging = false;
        inspectorPanel.style.transition = 'all 0.3s ease';
        inspectorPanel.style.zIndex = '99999';
    }
    
    // Свернуть/развернуть панель
    function togglePanel() {
        isPanelCollapsed = !isPanelCollapsed;
        
        if (isPanelCollapsed) {
        inspectorPanel.style.height = 'auto';
        inspectorPanel.style.maxHeight = '50px';
        inspectorPanel.style.overflow = 'hidden';
        inspectorPanel.querySelector('.collapse-btn').textContent = '_';
        
        // Скрываем содержимое
        const contents = inspectorPanel.querySelectorAll('.tab-content, .tab-container');
        contents.forEach(el => el.style.display = 'none');
        } else {
        inspectorPanel.style.maxHeight = '85vh';
        inspectorPanel.style.overflow = 'auto';
        inspectorPanel.querySelector('.collapse-btn').textContent = '_';
        
        // Показываем содержимое
        const contents = inspectorPanel.querySelectorAll('.tab-content, .tab-container');
        contents.forEach(el => el.style.display = '');
        }
        
        // Сохраняем состояние в localStorage
        localStorage.setItem('vueInspectorCollapsed', isPanelCollapsed);
    }
    
    // === ФУНКЦИИ РЕДАКТИРОВАНИЯ ПРОПСОВ ===
    
    // Начать редактирование пропсов
function startEditingProps(componentName) {
    // ИЩЕМ ТОЧНО по activeComponentUID
    const comp = filteredComponents.find(c => c.component.uid === activeComponentUID);

    if (!comp) {
        console.log("❌ Не найден компонент для редактирования по activeComponentUID");
        return;
    }

    editingComponent = comp.name;

    const componentData = {
        name: comp.name,
        props: extractPropsFromProxy(comp.props)
    };

    originalProps = JSON.parse(JSON.stringify(componentData.props));
    editedProps = JSON.parse(JSON.stringify(componentData.props));

    showComponentProps(comp.name, true, comp);
    console.log(`✏️ Начато редактирование пропсов для экземпляра UID=${comp.component.uid}`);
}
          
    // Сохранить отредактированные пропсы
    function saveEditedProps() {
        if (!editingComponent || !editedProps) {
        console.log(`❌ Нет данных для сохранения`);
        return;
        }
        
        try {
        // Находим компонент
const component = filteredComponents.find(c => c.component.uid === activeComponentUID);
        if (!component || !component.component) {
            console.log(`❌ Компонент "${editingComponent}" не найден`);
            return;
        }
        
        console.log(`💾 Сохранение пропсов для "${editingComponent}":`, editedProps);
        
        // Пытаемся обновить пропсы напрямую
        // Внимание: это может не работать для всех пропсов в Vue 3
        try {
            // Пытаемся обновить через setupState или props
            if (component.component.props) {
            // Для Vue 3 пропсы иммутабельны, но можно попробовать
            // обновить реактивное состояние
            for (const key in editedProps) {
                if (component.component.props.hasOwnProperty?.(key)) {
                // Пытаемся установить значение
                component.component.props[key] = editedProps[key];
                }
            }
            }
            
            // Также пробуем обновить setupState
            if (component.component.setupState) {
            for (const key in editedProps) {
                if (component.component.setupState.hasOwnProperty?.(key)) {
                component.component.setupState[key] = editedProps[key];
                }
            }
            }
            
            console.log(`✅ Пропсы для "${editingComponent}" обновлены`);
            showButtonPressMessage(`Пропсы ${editingComponent} обновлены`);
            
        } catch (e) {
            console.log(`⚠️ Не удалось обновить пропсы напрямую:`, e.message);
            console.log(`💡 Попробуйте использовать консольные команды для изменения состояния`);
        }
        
        // Выходим из режима редактирования
        cancelEditing();
        
        } catch (error) {
        console.log(`❌ Ошибка при сохранении пропсов:`, error);
        }
    }
    
    // Отменить редактирование
    function cancelEditing() {
        editingComponent = null;
        originalProps = null;
        editedProps = null;
        
        if (inspectorPanel) {
        const propsDisplay = document.getElementById('props-display');
        if (propsDisplay && propsDisplay.dataset.selectedComponent) {
            showComponentProps(propsDisplay.dataset.selectedComponent);
        }
        }
        
        console.log(`❌ Редактирование отменено`);
    }
    
    // Обновить отредактированные пропсы из textarea
    function updateEditedPropsFromTextarea(textarea) {
        if (!editingComponent) return;
        
        try {
        const newProps = JSON.parse(textarea.value);
        editedProps = newProps;
        console.log(`📝 Пропсы обновлены (не сохранены)`);
        } catch (e) {
        console.log(`❌ Ошибка в JSON:`, e.message);
        }
    }
    
    // === ОСНОВНЫЕ ФУНКЦИИ ===
    
    // Инициализация инспектора
    function initInspector() {
        console.log('🔧 Инициализация Vue Props Inspector...');
        
        // Собираем все компоненты
        refreshComponents();
        
        // Создаем UI панель
        createInspectorPanel();
        
        // Восстанавливаем состояние
        const savedCollapsed = localStorage.getItem('vueInspectorCollapsed');
        if (savedCollapsed === 'true') {
        setTimeout(() => togglePanel(), 100);
        }
        
        // Запускаем автообновление если включено
        if (CONFIG.enableAutoRefresh) {
        startAutoRefresh();
        }
        
        console.log('✅ Vue Props Inspector готов к работе!');
        showHelp();
    }
    
    // Сбор всех компонентов приложения
    function refreshComponents() {
        console.log('🔄 Сбор всех компонентов...');
        
        // НОВАЯ ЛОГИКА: Ищем ВСЕ Vue корни на странице
        const vueRoots = [];
        
        // 1. Все элементы с __vue_app__ (Vue 3)
        document.querySelectorAll('[__vue_app__]').forEach(el => {
        if (el.__vue_app__ && !vueRoots.includes(el)) {
            vueRoots.push(el);
        }
        });
        
        // 2. Проверяем все элементы на странице (агрессивный поиск)
        if (vueRoots.length === 0) {
        console.log('🔍 Агрессивный поиск Vue инстансов...');
        
        // Проверяем популярные контейнеры
        const possibleContainers = document.querySelectorAll(
            'div, main, section, article, #app, #root, [class*="app"], [class*="vue"], [id*="app"]'
        );
        
        possibleContainers.forEach(el => {
            // Проверяем признаки Vue
            if (el.__vue_app__ || el.__vue__ || el._vnode) {
            if (!vueRoots.includes(el)) {
                vueRoots.push(el);
            }
            }
            
            // Проверяем дочерние элементы
            el.querySelectorAll('*').forEach(child => {
            if (child.__vue_app__ || child.__vue__ || child._vnode) {
                if (!vueRoots.includes(child)) {
                vueRoots.push(child);
                }
            }
            });
        });
        }
        
        // 3. Если ничего не нашли, используем старую логику как fallback
        if (vueRoots.length === 0) {
        const appElement = document.querySelector('.na-sell-app') || 
                            document.querySelector('[__vue_app__]') ||
                            document.querySelector('*[__vue_app__]');
        
        if (appElement && (appElement.__vue_app__ || appElement.__vue__)) {
            vueRoots.push(appElement);
        }
        }
        
        if (vueRoots.length === 0) {
        console.log('❌ Vue приложения не найдены');
        allComponents = [];
        filteredComponents = [];
        return [];
        }
        
        console.log(`✅ Найдено ${vueRoots.length} Vue инстансов`);
        
        // Логируем что нашли
        vueRoots.forEach((root, index) => {
        let description = root.tagName.toLowerCase();
        if (root.className) {
            const classes = root.className.split(' ').filter(c => c).slice(0, 2);
            if (classes.length > 0) {
            description += `.${classes.join('.')}`;
            }
        }
        if (root.id) description += `#${root.id}`;
        
        console.log(`   ${index + 1}. ${description}`);
        });
        
        const components = [];
        
        // Собираем компоненты из ВСЕХ найденных корней
        vueRoots.forEach((root, rootIndex) => {
        // Получаем корневой vnode
        let rootVNode = null;
        
        if (root.__vue_app__) {
            // Vue 3
            rootVNode = root.__vue_app__._instance?.root || 
                        root.__vue_app__._container?._vnode ||
                        root._vnode;
        } else if (root.__vue__) {
            // Vue 2
            rootVNode = root.__vue__.$root || root.__vue__;
        } else {
            rootVNode = root._vnode;
        }
        
        if (!rootVNode) {
            console.log(`⚠️ Не удалось получить vnode для корня ${rootIndex + 1}`);
            return;
        }
        
        // Собираем компоненты из этого корня
        const rootComponents = [];
        
        function collectComponents(vnode, path = '', depth = 0) {
            if (!vnode || depth > 25) return;
            
            // Если это компонент
            if (vnode.component) {
            const component = {
                vnode: vnode,
                component: vnode.component,
                name: vnode.component.type?.name || 
                    vnode.component.type?.__name || 
                    vnode.component.type?.displayName ||
                    'Anonymous',
                props: vnode.component.props,
                setupState: vnode.component.setupState,
                depth: depth,
                path: `root${rootIndex}.${path}`,
                element: vnode.el,
                hasProps: vnode.component.props && 
                        Object.keys(vnode.component.props).length > 0,
                propsCount: vnode.component.props ? 
                        Object.keys(vnode.component.props).length : 0,
                rootIndex: rootIndex,
                rootElement: root
            };
            
            rootComponents.push(component);
            }
            
            // Рекурсивный обход
            if (vnode.children) {
            if (Array.isArray(vnode.children)) {
                vnode.children.forEach((child, i) => {
                collectComponents(child, `${path}.children[${i}]`, depth + 1);
                });
            }
            }
            
            if (vnode.component?.subTree) {
            collectComponents(vnode.component.subTree, 
                            `${path}.component.subTree`, depth + 1);
            }
        }
        
        collectComponents(rootVNode, 'root', 0);
        
        console.log(`   → ${rootComponents.length} компонентов`);
        components.push(...rootComponents);
        });
        
        allComponents = components;
        filterComponents();
        
        console.log(`✅ Собрано ${components.length} компонентов`);
        console.log(`✅ После фильтрации: ${filteredComponents.length} компонентов`);
        
        return filteredComponents;
    }
    
    // Получение пропсов компонента по имени
// Получение пропсов компонента по имени с учетом контекста элемента
function getComponentProps(componentName, element = null) {
    let component;
    
    // Если передан элемент, ищем компонент, связанный с этим элементом
    if (element) {
        // Ищем среди всех компонентов тот, у которого element совпадает с переданным
        component = allComponents.find(c => 
            c.name === componentName && 
            c.element === element
        );
        
        if (!component) {
            // Если не нашли точное совпадение, ищем вложенные элементы
            component = allComponents.find(c => 
                c.name === componentName && 
                c.element && 
                (c.element === element || c.element.contains(element))
            );
        }
        
        if (component) {
            console.log(`✅ Найден компонент "${componentName}" для указанного элемента`);
        } else {
            console.log(`⚠️ Компонент "${componentName}" не найден для указанного элемента`);
            // Fallback: ищем любой компонент с таким именем
            component = allComponents.find(c => c.name === componentName);
            if (component) {
                console.log(`ℹ️ Используется первый найденный компонент "${componentName}"`);
            }
        }
    } else {
        // Если элемент не указан, используем старую логику
        component = allComponents.find(c => c.name === componentName);
    }
    
    if (!component) {
        console.log(`❌ Компонент "${componentName}" не найден`);
        
        // Предлагаем похожие имена
        const similar = allComponents
            .map(c => c.name)
            .filter(name => name && name.toLowerCase().includes(componentName.toLowerCase()));
        
        if (similar.length > 0) {
            console.log(`💡 Возможно вы имели в виду: ${[...new Set(similar)].join(', ')}`);
        }
        
        return null;
    }
    
    // ДОБАВЛЯЕМ ИНФОРМАЦИЮ О КОНТЕКСТЕ
    console.log(`📍 Контекст компонента "${componentName}":`);
    if (component.element) {
        console.log(`   Элемент: ${component.element.tagName}.${component.element.className || 'no-class'}#${component.element.id || 'no-id'}`);
    }
    if (component.rootElement) {
        const rootClasses = component.rootElement.className ? `.${component.rootElement.className.split(' ')[0]}` : '';
        const rootId = component.rootElement.id ? `#${component.rootElement.id}` : '';
        console.log(`   Корень: ${component.rootElement.tagName}${rootClasses}${rootId}`);
    }
    
    if (!component.hasProps) {
        console.log(`ℹ️ Компонент "${componentName}" не имеет пропсов`);
        return {};
    }
    
    // Преобразуем Proxy в обычный объект
    const props = extractPropsFromProxy(component.props);
    
    return {
        name: component.name,
        props: props,
        element: component.element,
        rootElement: component.rootElement,
        depth: component.depth,
        context: {
            elementInfo: component.element ? {
                tagName: component.element.tagName,
                className: component.element.className,
                id: component.element.id
            } : null,
            rootInfo: component.rootElement ? {
                tagName: component.rootElement.tagName,
                className: component.rootElement.className,
                id: component.rootElement.id
            } : null
        },
        timestamp: new Date().toISOString()
    };
}
    
    // Извлечение пропсов из Proxy
    function extractPropsFromProxy(proxyProps) {
        if (!proxyProps) return {};
        
        try {
        // Пытаемся использовать JSON.stringify
        return JSON.parse(JSON.stringify(proxyProps));
        } catch(e) {
        // Если не получается, собираем вручную
        const result = {};
        
        try {
            // Для Vue 3 Proxy
            for (const key in proxyProps) {
            if (proxyProps.hasOwnProperty?.(key)) {
                result[key] = proxyProps[key];
            }
            }
        } catch(e2) {
            console.log('⚠️ Не удалось извлечь пропсы из Proxy');
        }
        
        return result;
        }
    }
    
    // Мониторинг изменений пропсов
    function monitorComponent(componentName, callback) {
        console.log(`🎯 Запуск мониторинга для "${componentName}"`);
        showButtonPressMessage(`Мониторинг ${componentName}`);
        
        // Проверяем существование компонента
        const component = filteredComponents.find(c => c.name === componentName);
        if (!component) {
        console.log(`❌ Компонент "${componentName}" не найден для мониторинга`);
        return null;
        }
        
        if (!component.hasProps) {
        console.log(`ℹ️ Компонент "${componentName}" не имеет пропсов для мониторинга`);
        return null;
        }
        
        // Сохраняем текущие пропсы
        let lastProps = extractPropsFromProxy(component.props);
        const interval = CONFIG.defaultPollInterval;
        
        const intervalId = setInterval(() => {
        // Обновляем компонент
        refreshComponents();
        const currentComponent = filteredComponents.find(c => c.name === componentName);
        
        if (!currentComponent || !currentComponent.props) {
            console.log(`⚠️ Компонент "${componentName}" больше не доступен`);
            stopMonitoring(componentName);
            return;
        }
        
        const currentProps = extractPropsFromProxy(currentComponent.props);
        const changes = findPropsChanges(lastProps, currentProps);
        
        if (changes.length > 0) {
            const changeEvent = {
            component: componentName,
            timestamp: new Date().toISOString(),
            changes: changes,
            oldProps: { ...lastProps },
            newProps: { ...currentProps }
            };
            
            console.log(`🔄 Изменения в "${componentName}":`);
            changes.forEach(change => {
            console.log(`   📍 ${change.key}: ${JSON.stringify(change.oldValue)} → ${JSON.stringify(change.newValue)}`);
            });
            
            // Вызываем callback если есть
            if (callback && typeof callback === 'function') {
            callback(changeEvent);
            }
            
            // Обновляем UI если панель существует
            updateMonitorDisplay(componentName, changeEvent);
            
            // Сохраняем новые пропсы
            lastProps = currentProps;
        }
        }, interval);
        
        // Сохраняем информацию о мониторинге
        monitoredComponents.set(componentName, {
        intervalId: intervalId,
        lastProps: lastProps,
        startTime: new Date().toISOString(),
        changeCount: 0
        });
        
        updateUI();
        
        return {
        stop: () => stopMonitoring(componentName),
        getStatus: () => getMonitoringStatus(componentName)
        };
    }
    
    // Остановка мониторинга
    function stopMonitoring(componentName) {
        const monitor = monitoredComponents.get(componentName);
        
        if (monitor) {
        clearInterval(monitor.intervalId);
        monitoredComponents.delete(componentName);
        console.log(`⏹️ Мониторинг "${componentName}" остановлен`);
        updateUI();
        return true;
        }
        
        console.log(`ℹ️ Мониторинг "${componentName}" не был запущен`);
        return false;
    }
    
    // Остановка всего мониторинга
    function stopAllMonitoring() {
        let stoppedCount = 0;
        
        monitoredComponents.forEach((monitor, componentName) => {
        clearInterval(monitor.intervalId);
        stoppedCount++;
        });
        
        monitoredComponents.clear();
        console.log(`⏹️ Остановлен весь мониторинг (${stoppedCount} компонентов)`);
        updateUI();
    }
    
    // Поиск изменений в пропсах
    function findPropsChanges(oldProps, newProps) {
        const changes = [];
        const allKeys = new Set([
        ...Object.keys(oldProps || {}),
        ...Object.keys(newProps || {})
        ]);
        
        allKeys.forEach(key => {
        const oldValue = oldProps[key];
        const newValue = newProps[key];
        
        const oldStr = JSON.stringify(oldValue);
        const newStr = JSON.stringify(newValue);
        
        if (oldStr !== newStr) {
            changes.push({
            key: key,
            oldValue: oldValue,
            newValue: newValue,
            type: typeof newValue
            });
        }
        });
        
        return changes;
    }
    
    // Получение статуса мониторинга
    function getMonitoringStatus(componentName) {
        const monitor = monitoredComponents.get(componentName);
        
        if (!monitor) {
        return { monitoring: false, message: 'Мониторинг не запущен' };
        }
        
        const duration = new Date() - new Date(monitor.startTime);
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        
        return {
        monitoring: true,
        component: componentName,
        startTime: monitor.startTime,
        duration: `${minutes}м ${seconds}с`,
        changeCount: monitor.changeCount,
        lastProps: monitor.lastProps
        };
    }
    
    // Получение всех мониторируемых компонентов
    function getAllMonitoredComponents() {
        const result = [];
        
        monitoredComponents.forEach((monitor, componentName) => {
        result.push(getMonitoringStatus(componentName));
        });
        
        return result;
    }
    
    // === UI ФУНКЦИИ ===
    
    // Создание панели инспектора
    function createInspectorPanel() {
        // Удаляем старую панель если есть
        if (inspectorPanel) {
        inspectorPanel.remove();
        }
        
        // Стили
        const style = document.createElement('style');
        style.textContent = `
        .vue-props-inspector {
            position: fixed;
            color: #2c3e50;
            top: ${panelPosition.y}px;
            left: ${panelPosition.x}px;
            background: white;
            border: 3px solid #2c3e50;
            padding: 15px;
            z-index: 99999;
            width: 500px;
            max-height: 85vh;
            box-shadow: 0 0 30px rgba(0,0,0,0.4);
            box-sizing: border-box;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            border-radius: 8px;
            transition: all 0.3s ease;
            resize: both;
    overflow: hidden;   /* важно */
    display: flex;
    flex-direction: column;        }
        
        .inspector-header {
            background: #2c3e50;
            color: white;
            padding: 10px;
            margin: -15px -15px -15px -15px;
            border-radius: 5px 5px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            user-select: none;
        }
        
        .inspector-title {
            font-size: 16px;
            font-weight: bold;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .inspector-version {
            font-size: 11px;
            opacity: 0.8;
        }
        
        .inspector-section {
            margin: 15px 0;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 5px;
        }
        
        .section-title {
            font-weight: bold;
            margin-bottom: 10px;
            color: #2c3e50;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .components-list {
            overflow-y: auto;
            flex: 1 1 auto;
            margin: 10px 0;
            min-height: 0;

        }
        
        .component-item {
            padding: 8px;
            margin: 5px 0;
            border: 1px solid #eee;
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .component-item:hover {
            background: #f5f5f5;
        }
        
        .component-item.selected {
            border-color: #42b983;
            background: rgba(66, 185, 131, 0.1);
        }
        
        .component-name {
            font-weight: bold;
            color: #2c3e50;
        }
        
        .component-props {
            font-size: 11px;
            color: #666;
            background: #eee;
            padding: 2px 6px;
            border-radius: 10px;
        }
        
        .props-display {
            background: #f8f9fa;
            padding: 10px;
            border-radius: 5px;
            max-height: 200px;
            overflow-y: auto;
            font-family: 'Courier New', monospace;
            font-size: 12px;
        }
        
        .props-textarea {
            width: 100%;
            min-height: 150px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            margin-bottom: 10px;
            resize: vertical;
            box-sizing: border-box;
        }
        
.monitoring-panel {
    height: 100%;
    display: flex;
    flex-direction: column;
    position: relative;
}

.monitoring-content {
    flex: 1 1 auto;
    overflow-y: auto;
    padding-right: 6px;
    padding-bottom: 80px; /* пространство под футер */
}

/* Список мониторинга тоже теперь гибкий */
.monitor-list {
    overflow-y: auto;
    margin: 10px 0;
}

        
        .monitor-item {
            padding: 8px;
            margin: 5px 0;
            background: #f8f9fa;
            border-radius: 4px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .monitor-status {
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 10px;
            color: white;
        }
        
        .status-active {
            background: #42b983;
        }
        
        .status-inactive {
            background: #ff6b6b;
        }
        
        .inspector-button {
            background: #2c3e50;
            color: white;
            border: none;
            padding: 8px 12px;
            margin: 2px;
            cursor: pointer;
            border-radius: 4px;
            font-size: 12px;
            transition: background 0.3s, transform 0.1s ease, box-shadow 0.1s ease;
        }
        
        .inspector-button:hover {
            background: #1a252f;
        }
        
        .inspector-button:active {
            transform: scale(0.95);
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
        }
        
        .inspector-button.danger {
            background: #ff6b6b;
        }
        
        .inspector-button.danger:hover {
            background: #ff5252;
        }
        
        .inspector-button.secondary {
            background: #6c757d;
        }
        
        .inspector-button.secondary:hover {
            background: #5a6268;
        }
        
        .inspector-button.success {
            background: #42b983;
        }
        
        .inspector-button.success:hover {
            background: #33a06f;
        }
        
        .button-group {
            display: flex;
            gap: 5px;
            flex-wrap: wrap;
            margin: 10px 0;
        }
        
        .search-input {
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            margin: 10px 0;
            box-sizing: border-box;
        }
        
        .tab-container {
            display: flex;
            border-bottom: 1px solid #ddd;
            margin: 15px 0;
        }
        
        .tab {
            padding: 10px 15px;
            cursor: pointer;
            border-bottom: 3px solid transparent;
            user-select: none;
        }
        
        .tab.active {
            border-bottom-color: #42b983;
            font-weight: bold;
            color: #2c3e50;
        }
        
        .tab-content {
            display: none;
        }
        
.tab-content.active {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden; /* очень важно */
    min-height: 0;
}

        
        .empty-state {
            text-align: center;
            padding: 20px;
            color: #6c757d;
            font-style: italic;
        }
        
        .props-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            margin-top: 10px;
        }
        
        .props-table th {
            background: #f8f9fa;
            text-align: left;
            padding: 8px;
            border-bottom: 2px solid #ddd;
            font-weight: bold;
            color: #2c3e50;
        }
        
        .props-table td {
            padding: 8px;
            border-bottom: 1px solid #eee;
            vertical-align: top;
            text-align: left;
        }
        
        .props-table tr:hover {
            background: #f5f5f5;
        }
        
        .prop-key {
            font-weight: bold;
            color: #42b983;
            white-space: nowrap;
        }
        
        .prop-value {
            max-width: 250px;
            overflow: hidden;
            text-overflow: ellipsis;
            word-break: break-word;
        }
        
        .prop-type {
            color: #666;
            font-size: 11px;
            white-space: nowrap;
        }
        
        .header-controls {
            display: flex;
            gap: 8px;
            align-items: center;
        }
        
        .header-button {
            background: transparent;
            color: white;
            border: 1px solid rgba(255,255,255,0.3);
            padding: 4px 8px;
            cursor: pointer;
            border-radius: 3px;
            font-size: 10px;
            transition: background 0.3s;
        }
        
        .header-button:hover {
            background: rgba(255,255,255,0.1);
        }
        
        .header-button.danger {
            border-color: #ff6b6b;
            color: #ff6b6b;
        }

        /* родитель вкладки */
#inspector-panel, 
.components-panel {
    height: 100%;
    display: flex;
    flex-direction: column;
    position: relative;
    min-height: 0;
}

/* прокручиваемая часть */
.components-content {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
}

.fixed-footer {
    position: absolute;    /* критически важно */
    bottom: 0;
    left: 0;
    width: 100%;
    padding: 10px 0;
    background: #fff;
    border-top: 1px solid #ddd;
    box-shadow: 0 -3px 8px rgba(0,0,0,0.07);
    z-index: 10;
}

/* фиксируем кнопки внизу панели */
.sticky-footer {
    position: sticky;
    bottom: 0;
    background: #fff;
    padding: 10px 0;
    border-top: 1px solid #ddd;
    box-shadow: 0 -3px 8px rgba(0,0,0,0.07);
    z-index: 10;
}

        
        .header-button.danger:hover {
            background: rgba(255,107,107,0.1);
        }
        `;
        document.head.appendChild(style);
        
        // Панель
        inspectorPanel = document.createElement('div');
        inspectorPanel.className = 'vue-props-inspector';
        inspectorPanel.innerHTML = `
        <div class="inspector-header">
            <div class="inspector-title">
            <span>🎯 Vue Props Inspector</span>
            </div>
            <div class="header-controls">
            <button class="header-button collapse-btn" 
                    onclick="VueInspector.togglePanel()">
                _
            </button>
            <button class="header-button danger" 
                    onclick="VueInspector.destroy()">
                X
            </button>
            <div class="inspector-version">v${CONFIG.version}</div>
            </div>
        </div>
        
        <div class="tab-container">
            <div class="tab active" data-tab="components">Компоненты</div>
            <div class="tab" data-tab="monitoring">Мониторинг</div>
            <div class="tab" data-tab="props">Пропсы</div>
        </div>
        
<!-- Вкладка Компоненты -->
<div id="tab-components" class="tab-content active">

    <div class="components-panel">

        <!-- ПРОКРУЧИВАЕМАЯ ОБЛАСТЬ -->
        <div class="components-content">

            <div class="section-title">
                <span>Доступные компоненты (${filteredComponents.length})</span>
                <button class="inspector-button" onclick="VueInspector.refresh()">🔄 Обновить</button>
            </div>
            
            <input 
                type="text" 
                class="search-input" 
                id="component-search"
                placeholder="Поиск компонента..."
                onkeyup="VueInspector.filterComponents()"
            >

            <div class="components-list" id="components-list">
                <!-- Список компонентов будет здесь -->
            </div>

        </div>

        <!-- ФУТЕР С КНОПКАМИ (ВСЕГДА ВНИЗУ) -->
        <div class="button-group sticky-footer">
            <button class="inspector-button" onclick="VueInspector.showAllComponents()">
                📋 Показать все
            </button>
            <button class="inspector-button" onclick="VueInspector.showComponentsWithProps()">
                📦 Только с пропсами
            </button>
            <button class="inspector-button secondary" onclick="VueInspector.copyComponentsList()">
                📋 Копировать список
            </button>
        </div>

    </div>
</div>

        
<!-- Вкладка Мониторинг -->
<div id="tab-monitoring" class="tab-content">

    <div class="monitoring-panel">

        <!-- ПРОКРУЧИВАЕМАЯ ОБЛАСТЬ -->
        <div class="monitoring-content">

            <div class="section-title">
                <span>Активный мониторинг</span>
                <button class="inspector-button danger" onclick="VueInspector.stopAllMonitoring()">
                    ⏹️ Остановить все
                </button>
            </div>

            <div class="monitor-list" id="monitor-list">
                <!-- Список мониторингов будет здесь -->
            </div>

            <div class="section-title">
                <span>Быстрый мониторинг</span>
            </div>

            <input type="text" 
                   class="search-input" 
                   id="monitor-search" 
                   placeholder="Введите имя компонента для мониторинга">

        </div>

        <!-- Футер с кнопками -->
        <div class="button-group fixed-footer">
            <button class="inspector-button" onclick="VueInspector.startMonitorFromInput()">
                ▶️ Начать мониторинг
            </button>
            <button class="inspector-button secondary" onclick="VueInspector.showMonitoringHelp()">
                ℹ️ Помощь
            </button>
        </div>

    </div>
</div>

        
        <!-- Вкладка Пропсы -->
        <div id="tab-props" class="tab-content">
            <div class="section-title">
            <span>Детали пропсов</span>
            <button class="inspector-button" onclick="VueInspector.clearPropsDisplay()">
                🗑️ Очистить
            </button>
            </div>
            
            <div id="props-display">
            <!-- Детали пропсов будут здесь -->
            </div>
        </div>
        `;
        
        document.body.appendChild(inspectorPanel);
        
        // Инициализация
        initTabs();
        initPanelDragging();
        
        // Добавляем обработчики для эффектов нажатия
        inspectorPanel.querySelectorAll('.inspector-button, .header-button').forEach(button => {
        button.addEventListener('click', createButtonPressEffect);
        });
        
        // Первоначальное обновление UI
        updateUI();
    }
    
    // Инициализация табов
    function initTabs() {
        const tabs = inspectorPanel.querySelectorAll('.tab');
        const tabContents = inspectorPanel.querySelectorAll('.tab-content');
        
        tabs.forEach(tab => {
        tab.addEventListener('click', function(e) {
            createButtonPressEffect(e);
            
            const tabName = this.dataset.tab;
            
            // Деактивируем все табы
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Активируем выбранный
            this.classList.add('active');
            document.getElementById(`tab-${tabName}`).classList.add('active');
        });
        });
    }
    
    // Обновление UI
    function updateUI() {
        if (!inspectorPanel) return;
        
        // Обновляем список компонентов
        updateComponentsList();
        
        // Обновляем список мониторинга
        updateMonitorList();
        
        // Обновляем заголовки
        updateSectionTitles();
    }
    
    // Обновление списка компонентов
    function updateComponentsList() {
        const container = document.getElementById('components-list');
        if (!container) return;
        
        let displayComponents = filteredComponents;
        const searchInput = document.getElementById('component-search');
        
// Фильтрация по поиску
if (searchInput && searchInput.value.trim()) {
    const searchTerm = searchInput.value.toLowerCase();

    displayComponents = filteredComponents.filter(comp => {
        // 1️⃣ Поиск по имени компонента
        const nameMatch =
            comp.name &&
            comp.name.toLowerCase().includes(searchTerm);

        // 2️⃣ Поиск по DOM-элементу
        let elementMatch = false;

        if (comp.element instanceof HTMLElement) {
            const tag = comp.element.tagName.toLowerCase();
            const classes = comp.element.className
                ? comp.element.className.toLowerCase()
                : '';

            elementMatch =
                tag.includes(searchTerm) ||
                classes.includes(searchTerm);
        }

        // 3️⃣ Логические состояния
        const logicMatch =
            (!comp.element && 'not rendered'.includes(searchTerm)) ||
            (!(comp.element instanceof HTMLElement) &&
                'logic only'.includes(searchTerm));

        return nameMatch || elementMatch || logicMatch;
    });
}

        
        // Ограничиваем количество
        displayComponents = displayComponents.slice(0, CONFIG.maxComponentsToShow);
        
        if (displayComponents.length === 0) {
        container.innerHTML = '<div class="empty-state">Компоненты не найдены</div>';
        return;
        }

        let html = '';
        
        displayComponents.forEach(comp => {
            const isMonitored = monitoredComponents.has(comp.name);
            const propsCount = comp.propsCount || 0;

            function formatElementInfo(el) {
                if (!el) {
                    return '<span class="el-hidden">🚫 Not rendered</span>';
                }

                // логический компонент без реального DOM
                if (!(el instanceof HTMLElement)) {
                    return '<span class="el-logic">👁 Logic only (no UI)</span>';
                }

                const tag = el.tagName.toLowerCase();
                const cls = el.className
                    ? '.' + el.className.trim().replace(/\s+/g, '.')
                    : '';

                return `<span class="el-dom">🧱 ${tag}${cls}</span>`;
            }

            html += `
                <div class="component-item ${isMonitored ? 'selected' : ''}" 
                    onclick="VueInspector.selectComponentByUID(${comp.component.uid})">
                    <div>
                        <div class="component-name">${comp.name || 'Anonymous'}</div>

                        <div class="component-meta">
                            ${formatElementInfo(comp.element)}
                        </div>
                    </div>

                    <div class="component-props">
                        ${propsCount} props
                        ${isMonitored ? ' 🔄' : ''}
                    </div>
                </div>
            `;
        });
        
        if (filteredComponents.length > CONFIG.maxComponentsToShow) {
            html += `
                <div style="text-align: center; padding: 10px; color: #666; font-size: 12px;">
                    Показано ${CONFIG.maxComponentsToShow} из ${filteredComponents.length} компонентов
                </div>
            `;
        }
        
        container.innerHTML = html;
    }


    

    
    // Обновление списка мониторинга
    function updateMonitorList() {
        const container = document.getElementById('monitor-list');
        if (!container) return;
        
        if (monitoredComponents.size === 0) {
        container.innerHTML = '<div class="empty-state">Мониторинг не активен</div>';
        return;
        }
        
        let html = '';
        
        monitoredComponents.forEach((monitor, componentName) => {
        const duration = new Date() - new Date(monitor.startTime);
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        
        html += `
            <div class="monitor-item">
            <div>
                <div style="font-weight: bold;">${componentName}</div>
                <div style="font-size: 11px; color: #666;">
                Запущен: ${minutes}м ${seconds}с назад | 
                Изменений: ${monitor.changeCount || 0}
                </div>
            </div>
            <div>
                <button class="inspector-button danger" 
                        onclick="VueInspector.stopMonitoring('${componentName.replace(/'/g, "\\'")}')"
                        style="font-size: 11px; padding: 4px 8px;">
                Стоп
                </button>
            </div>
            </div>
        `;
        });
        
        container.innerHTML = html;
    }
    
    // Обновление дисплея мониторинга
    function updateMonitorDisplay(componentName, changeEvent) {
        const monitor = monitoredComponents.get(componentName);
        if (monitor) {
        monitor.changeCount = (monitor.changeCount || 0) + changeEvent.changes.length;
        }
        
        // Обновляем пропсы если компонент выбран
        const propsDisplay = document.getElementById('props-display');
        if (propsDisplay && propsDisplay.dataset.selectedComponent === componentName) {
        showComponentProps(componentName);
        }
        
        updateUI();
    }
    
    // Обновление заголовков секций
    function updateSectionTitles() {
        const componentsTitle = inspectorPanel.querySelector('#tab-components .section-title span');
        if (componentsTitle) {
        componentsTitle.textContent = `Доступные компоненты (${filteredComponents.length})`;
        }
    }
    
    // Показать пропсы компонента с табличным форматом
    function showComponentProps(componentName, isEditing = false, componentOverride = null) {
const component = componentOverride ||
    filteredComponents.find(c => c.name === componentName);
        
        if (!component) {
        console.log(`❌ Компонент "${componentName}" не найден`);
        return;
        }
        
        const props = isEditing ? editedProps : extractPropsFromProxy(component.props);
        const propsDisplay = document.getElementById('props-display');
        
        if (!propsDisplay) return;
        
        propsDisplay.dataset.selectedComponent = componentName;
        
        if (!component.hasProps) {
        propsDisplay.innerHTML = '<div class="empty-state">Компонент не имеет пропсов</div>';
        return;
        }
        
        // ДОБАВЛЯЕМ ИНФОРМАЦИЮ О КОРНЕ
        let rootInfo = '';
        if (component.rootElement) {
        const rootClasses = component.rootElement.className 
            ? `.${component.rootElement.className.split(' ')[0]}`
            : '';
        const rootId = component.rootElement.id ? `#${component.rootElement.id}` : '';
        rootInfo = `<div style="font-size: 10px; color: #666; margin-bottom: 5px;">
            📍 Корень: ${component.rootElement.tagName}${rootClasses}${rootId}
        </div>`;
        }
        
        let html = `
        <div style="margin-bottom: 15px;">
            <div style="font-weight: bold; font-size: 14px; color: #2c3e50;">
            📦 ${componentName}
            </div>
            ${rootInfo}
            <div style="font-size: 11px; color: #666; margin-bottom: 10px;">
            Обновлено: ${new Date().toISOString()} | 
            Пропсов: ${component.propsCount || 0}
            </div>
        </div>
        `;
            
        if (isEditing) {
        // Режим редактирования - textarea
        html += `
            <textarea class="props-textarea" id="props-textarea">${JSON.stringify(props, null, 2)}</textarea>
            <div class="button-group">
            <button class="inspector-button success" onclick="VueInspector.saveEditedProps()">
                💾 Сохранить
            </button>
            <button class="inspector-button danger" onclick="VueInspector.cancelEditing()">
                ❌ Отменить
            </button>
            </div>
        `;
        } else {
        // Режим просмотра - JSON display
        html += `
            <pre class="props-display">
${JSON.stringify(props, null, 2)}
            </pre>
            
            <div class="button-group" style="margin-top: 10px;">
            <button class="inspector-button" 
                    onclick="VueInspector.copyProps('${componentName.replace(/'/g, "\\'")}')">
                📋 Копировать JSON
            </button>
            <button class="inspector-button" 
                    onclick="VueInspector.startMonitoring('${componentName.replace(/'/g, "\\'")}')">
                🔄 Мониторить изменения
            </button>
            <button class="inspector-button secondary" 
                    onclick="VueInspector.startEditingProps('${componentName.replace(/'/g, "\\'")}')">
                ✏️ Редактировать
            </button>
            </div>
        `;
        }
        
        // Добавляем таблицу пропсов с выравниванием по левому краю
        if (Object.keys(props).length > 0 && !isEditing) {
        html += `<div style="margin-top: 15px;">
            <div style="font-weight: bold; margin-bottom: 5px;">Детали пропсов:</div>
            <table class="props-table">
            <thead>
                <tr>
                <th style="text-align: left; width: 30%;">Ключ</th>
                <th style="text-align: left; width: 50%;">Значение</th>
                <th style="text-align: left; width: 20%;">Тип</th>
                </tr>
            </thead>
            <tbody>`;
        
        Object.entries(props).forEach(([key, value]) => {
            const valueType = typeof value;
            const valueStr = JSON.stringify(value);
            const truncatedValue = valueStr.length > 100 ? 
            valueStr.substring(0, 100) + '...' : valueStr;
            
            html += `
            <tr>
                <td class="prop-key" title="${key}">${key}</td>
                <td class="prop-value" title="${valueStr}">${truncatedValue}</td>
                <td class="prop-type">${valueType}</td>
            </tr>
            `;
        });
        
        html += `</tbody></table></div>`;
        }
        
        propsDisplay.innerHTML = html;
        
        // Добавляем обработчики для новых кнопок
        propsDisplay.querySelectorAll('.inspector-button').forEach(button => {
        button.addEventListener('click', createButtonPressEffect);
        });
        
        // Добавляем обработчик для textarea если в режиме редактирования
        if (isEditing) {
        const textarea = document.getElementById('props-textarea');
        if (textarea) {
            textarea.addEventListener('input', function() {
            updateEditedPropsFromTextarea(this);
            });
        }
        }
        
        // Переключаемся на вкладку пропсов
        switchToTab('props');
    }
    
    // Переключение таба
    function switchToTab(tabName) {
        const tab = inspectorPanel.querySelector(`.tab[data-tab="${tabName}"]`);
        if (tab) {
        tab.click();
        }
    }
    
    // Автообновление компонентов
    function startAutoRefresh() {
        if (refreshInterval) {
        clearInterval(refreshInterval);
        }
        
        refreshInterval = setInterval(() => {
        if (CONFIG.enableAutoRefresh) {
            refreshComponents();
            updateUI();
        }
        }, 10000);
        
        console.log('🔄 Автообновление компонентов запущено (каждые 10 секунд)');
    }
    
    // Остановка автообновления
    function stopAutoRefresh() {
        if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
        console.log('⏹️ Автообновление остановлено');
        }
    }
    
    // === ПУБЛИЧНЫЙ API ===
    
    // Экспортируем все функции через глобальный объект
    window.VueInspector = {
        // Основные функции
        init: initInspector,
        refresh: refreshComponents,
        help: showHelp,
        destroy: destroyInspector,
        
        // Управление панелью
        togglePanel: togglePanel,
        
        // Работа с компонентами
        getComponent: getComponentProps,
        getAllComponents: () => filteredComponents,
        filterComponents: function() {
        updateUI();
        },
        showAllComponents: function() {
        document.getElementById('component-search').value = '';
        updateUI();
        },
        showComponentsWithProps: function() {
        document.getElementById('component-search').value = '';
        filteredComponents = filteredComponents.filter(c => c.hasProps);
        updateUI();
        },
        copyComponentsList: function() {
        const list = filteredComponents.map(c => 
            `${c.name} - ${c.propsCount} props - ${c.element?.className || 'no element'}`
        ).join('\n');
        
        navigator.clipboard.writeText(list)
            .then(() => {
            console.log('✅ Список компонентов скопирован!');
            showButtonPressMessage('Список компонентов скопирован');
            });
        },
        
        // Выбор компонента
        selectComponent: function(componentName) {
        showComponentProps(componentName);
        },

        // Выбор компонента по UID (новая функция)
selectComponentByUID: function(uid) {
    const comp = filteredComponents.find(c => c.component?.uid === uid);

    if (!comp) {
        console.log(`❌ Компонент с uid ${uid} не найден`);
        return;
    }

    // Используем специальный метод для открытия конкретного экземпляра
    VueInspector._selectExactComponent(comp);
},

        
        // Работа с пропсами
        copyProps: function(componentName) {
        const componentData = getComponentProps(componentName);
        if (componentData && componentData.props) {
            const json = JSON.stringify(componentData.props, null, 2);
            navigator.clipboard.writeText(json)
            .then(() => {
                console.log(`✅ Пропсы "${componentName}" скопированы!`);
                showButtonPressMessage(`Пропсы ${componentName} скопированы`);
            });
        }
        },
        clearPropsDisplay: function() {
        const propsDisplay = document.getElementById('props-display');
        if (propsDisplay) {
            propsDisplay.innerHTML = '<div class="empty-state">Выберите компонент для просмотра пропсов</div>';
        }
        },

        // Точная передача выбранного компонента
_selectExactComponent: function(comp) {
        activeComponentUID = comp.component.uid; // <--- сохраняем выбранный экземпляр
    showComponentProps(comp.name, false, comp);
},

        
        // Редактирование пропсов
        startEditingProps: startEditingProps,
        saveEditedProps: saveEditedProps,
        cancelEditing: cancelEditing,
        
        // Мониторинг
        startMonitoring: monitorComponent,
        stopMonitoring: stopMonitoring,
        stopAllMonitoring: stopAllMonitoring,
        getMonitoringStatus: getMonitoringStatus,
        getAllMonitored: getAllMonitoredComponents,
        
        startMonitorFromInput: function() {
        const input = document.getElementById('monitor-search');
        if (input && input.value.trim()) {
            this.startMonitoring(input.value.trim());
            input.value = '';
        }
        },
        
        showMonitoringHelp: function() {
        console.log(`
    🎯 Мониторинг пропсов:
    • monitorComponent("имя_компонента") - начать мониторинг
    • stopMonitoring("имя_компонента") - остановить мониторинг
    • stopAllMonitoring() - остановить весь мониторинг

    Примеры:
    VueInspector.startMonitoring("agreement-cars")
    VueInspector.startMonitoring("car-description")
        `);
        },
        
        // Внутренние функции для UI
        _updateUI: updateUI,
        _showComponentProps: showComponentProps
    };
    
    // Глобальные быстрые команды
    window.getAgreementCarsProps = function() {
        return VueInspector.getComponent('agreement-cars');
    };
    
    window.checkComponent = function(componentName) {
        return VueInspector.getComponent(componentName);
    };
    
    window.copySelectedProps = function() {
        const selectedElement = $0;
        if (!selectedElement) {
        console.log('❌ Выберите элемент в DevTools Elements');
        return;
        }
        
        // Ищем компонент для элемента
        const component = filteredComponents.find(c => c.element === selectedElement);
        if (component && component.name) {
        VueInspector.copyProps(component.name);
        } else {
        console.log('❌ Не удалось найти компонент для выбранного элемента');
        }
    };
    
    window.help = function() {
        VueInspector.showQACommands = function() {
        console.log(`
    🎯 КОМАНДЫ ДЛЯ QA:
    ============================================
    📋 ОСНОВНЫЕ КОМАНДЫ:
    VueInspector.init()          - Инициализировать инспектор
    VueInspector.refresh()       - Обновить список компонентов
    VueInspector.help()          - Показать помощь
    VueInspector.destroy()       - Уничтожить инспектор
    VueInspector.togglePanel()   - Свернуть/развернуть панель

    🔍 РАБОТА С КОМПОНЕНТАМИ:
    VueInspector.getComponent("agreement-cars") - Получить пропсы компонента
    VueInspector.getAllComponents()             - Получить все компоненты
    VueInspector.selectComponent("имя")         - Выбрать компонент в UI

    🔄 МОНИТОРИНГ:
    VueInspector.startMonitoring("имя") - Начать мониторинг
    VueInspector.stopMonitoring("имя")  - Остановить мониторинг
    VueInspector.stopAllMonitoring()    - Остановить весь мониторинг

    📋 РАБОТА С ПРОПСАМИ:
    VueInspector.copyProps("имя")       - Копировать пропсы
    VueInspector.startEditingProps("имя") - Начать редактирование пропсов

    ✏️ РЕДАКТИРОВАНИЕ:
    VueInspector.saveEditedProps()      - Сохранить изменения
    VueInspector.cancelEditing()        - Отменить редактирование

    🎯 БЫСТРЫЕ КОМАНДЫ:
    getAgreementCarsProps()             - Получить пропсы agreement-cars
    checkComponent("имя")               - Проверить компонент
    copySelectedProps()                 - Копировать пропсы выбранного элемента
    ============================================
        `);
        };
        VueInspector.showQACommands();
    };
    
    // Функция уничтожения инспектора
    function destroyInspector() {
        stopAllMonitoring();
        stopAutoRefresh();
        
        if (inspectorPanel) {
        inspectorPanel.remove();
        inspectorPanel = null;
        }
        
        // Удаляем стили
        document.querySelectorAll('style').forEach(style => {
        if (style.textContent.includes('vue-props-inspector')) {
            style.remove();
        }
        });
        
        // Очищаем глобальные переменные
        allComponents = [];
        filteredComponents = [];
        monitoredComponents.clear();
        editingComponent = null;
        originalProps = null;
        editedProps = null;
        
        console.log('🗑️ Vue Props Inspector уничтожен');
        showButtonPressMessage('Инспектор уничтожен');
    }
    
    // Показать помощь
    function showHelp() {
        console.log(`
    🎯 VUE PROPS INSPECTOR v${CONFIG.version}
    ============================================
    ДЛЯ НАЧАЛА РАБОТЫ:
    1. Выполните: VueInspector.init()
    2. Или просто: initInspector()

    ОСНОВНОЙ ИНТЕРФЕЙС:
    • Панель появится в правом верхнем углу
    • Перетаскивайте за шапку для перемещения
    • Кнопка _ для сворачивания/разворачивания
    • Кнопка X для завершения скрипта
    • 3 вкладки: Компоненты, Мониторинг, Пропсы
    • Кликните на компонент для просмотра его пропсов

    ФИЛЬТРАЦИЯ КОМПОНЕНТОВ:
    • Автоматически исключены все UI-компоненты
    • Поиск по имени в поле ввода

    РЕДАКТИРОВАНИЕ ПРОПСОВ:
    • Нажмите "Редактировать" для изменения пропсов
    • Измените JSON в текстовом поле
    • Сохраните или отмените изменения

    БЫСТРЫЕ КОМАНДЫ В КОНСОЛИ:
    • help() - показать эту помощь
    • getAgreementCarsProps() - получить пропсы agreement-cars
    • checkComponent("имя") - проверить любой компонент

    МОНИТОРИНГ ИЗМЕНЕНИЙ:
    • Выберите компонент и нажмите "Мониторить изменения"
    • Изменения будут логироваться в консоль
    • Короткие сообщения о действиях
    • Остановите мониторинг когда нужно

    АВТОР: ${CONFIG.author}
    ============================================
        `);
    }
    
    // Автоматический запуск при загрузке
    console.log('🔧 Vue Props Inspector загружен. Для запуска выполните: VueInspector.init()');
    
    })();

    VueInspector.init()