import { ref, onUnmounted } from 'vue';
import { useRuntime } from '@/runtime';

export function useElementInspector() {
    const runtime = useRuntime();
    
    const isInspecting = ref(false);
    const hoveredElement = ref(null);
    const selectedElement = ref(null);
    
    // #region agent log
    // Отключено из-за ERR_INSUFFICIENT_RESOURCES - слишком частые запросы
    const logDebug = (location, message, data = {}) => {
        // Логирование отключено для производительности
    };
    // #endregion
    
    const sendToContentScript = (message) => {
        // #region agent log
        logDebug('useElementInspector.ts:sendToContentScript', 'Sending message to content script', { messageType: message.type });
        // #endregion
        return runtime.sendMessage(message);
    };
    const startInspecting = async () => {
        // #region agent log
        logDebug('useElementInspector.ts:startInspecting', 'Starting inspection', { isInspecting: isInspecting.value });
        // #endregion
        if (isInspecting.value)
            return;
        try {
            isInspecting.value = true;
            // Сохраняем состояние инспекции
            runtime.storage.set('vueInspectorInspecting', true);
            const response = await sendToContentScript({ type: 'START_ELEMENT_INSPECTION' });
            // #region agent log
            logDebug('useElementInspector.ts:startInspecting', 'Inspection started on page', { response });
            // #endregion
            console.log('🔍 Element inspector started on page');
        }
        catch (error) {
            // #region agent log
            logDebug('useElementInspector.ts:startInspecting', 'Failed to start inspection', { error: String(error) });
            // #endregion
            console.error('❌ Failed to start element inspection:', error);
            isInspecting.value = false;
        }
    };
    const stopInspecting = async () => {
        // #region agent log
        logDebug('useElementInspector.ts:stopInspecting', 'Stopping inspection', { isInspecting: isInspecting.value });
        // #endregion
        if (!isInspecting.value)
            return;
        try {
            isInspecting.value = false;
            await sendToContentScript({ type: 'STOP_ELEMENT_INSPECTION' });
            runtime.storage.set('vueInspectorInspecting', false);
            // #region agent log
            logDebug('useElementInspector.ts:stopInspecting', 'Inspection stopped on page', {});
            // #endregion
            console.log('🔍 Element inspector stopped');
        }
        catch (error) {
            // #region agent log
            logDebug('useElementInspector.ts:stopInspecting', 'Failed to stop inspection', { error: String(error) });
            // #endregion
            console.error('❌ Failed to stop element inspection:', error);
        }
    };
    const inspectElement = (element) => {
        return element;
    };
    // Слушаем сообщения от content script о выбранном элементе
    const handleMessage = (message, respond) => {
        if (message.type === 'ELEMENT_SELECTED') {
            // #region agent log
            logDebug('useElementInspector.ts:handleMessage', 'Element selected on page', { element: message.element });
            // #endregion
            selectedElement.value = {
                element: null, // Элемент на странице, не доступен в popup
                componentName: message.element?.componentName,
                componentUid: message.element?.componentUid,
                path: message.element?.path || '',
                props: message.element?.props
            };
            isInspecting.value = false;
            // Сохраняем выбранный элемент в storage
            runtime.storage.set('vueInspectorInspecting', false);
            runtime.storage.set('vueInspectorSelectedElement', selectedElement.value);
            console.log('✅ Element selected on page:', selectedElement.value);
            respond({ received: true });
        }
    };
    
    // Добавляем слушатель
    let unsubscribe = null;
    if (!window.__VUE_INSPECTOR_ELEMENT_LISTENER_ADDED__) {
        unsubscribe = runtime.onMessage(handleMessage);
        window.__VUE_INSPECTOR_ELEMENT_LISTENER_ADDED__ = true;
    }
    
    onUnmounted(() => {
        stopInspecting();
        if (unsubscribe) {
            unsubscribe();
            window.__VUE_INSPECTOR_ELEMENT_LISTENER_ADDED__ = false;
        }
    });
    return {
        isInspecting,
        hoveredElement,
        selectedElement,
        startInspecting,
        stopInspecting,
        inspectElement
    };
}
//# sourceMappingURL=useElementInspector.js.map