import { reactive, watch, toRaw } from 'vue'
import { defaultInspectorSettings, type InspectorSettings } from '@/settings/inspectorSettings'
import { safeRuntime, safeSendMessage } from '@/utils/extensionBridge'


// Реактивное состояние
const state = reactive<InspectorSettings>(structuredClone(defaultInspectorSettings))
let isLoaded = false
let saveTimeout: number | null = null

// Сохранение через background script (IndexedDB + chrome.storage.local)
async function saveToStorage() {
    try {
        // Безопасное клонирование с обработкой ошибок
        let settingsToSave
        try {
            settingsToSave = structuredClone(toRaw(state))
        } catch (cloneError) {
            // Fallback: создаем копию вручную, исключая проблемные поля
            settingsToSave = JSON.parse(JSON.stringify(toRaw(state)))
        }

        // Отправляем настройки в background script для сохранения в IndexedDB
        await safeSendMessage({
            type: 'UPDATE_SETTINGS',
            settings: settingsToSave
        })


    } catch (error) {
    }
}

// Загрузка через background script (IndexedDB с fallback на chrome.storage.local)
async function loadFromStorage(): Promise<void> {
    return new Promise((resolve) => {
        // Запрашиваем настройки у background script
        safeSendMessage({ type: 'GET_SETTINGS' }).then((response) => {
            try {
                const savedSettings = response

                if (savedSettings && typeof savedSettings === 'object') {
                    if (savedSettings.version !== defaultInspectorSettings.version) {
                    }

                    const mergedSettings = mergeSettings(defaultInspectorSettings, savedSettings)
                    Object.assign(state, mergedSettings)

                } else {
                    // При первом запуске применяем настройки по умолчанию и сохраняем их
                    Object.assign(state, structuredClone(defaultInspectorSettings))
                    // Сохраняем настройки по умолчанию при первом запуске
                    saveToStorage()
                }
    } catch (error) {
        // Fallback на настройки по умолчанию
        Object.assign(state, structuredClone(defaultInspectorSettings))
    }

            isLoaded = true
            resolve()
        })
    })
}

// Мердж настроек
function mergeSettings(defaults: InspectorSettings, saved: Partial<InspectorSettings>) {
    const result = structuredClone(defaults)

    function mergeDeep(target: any, source: any) {
        if (typeof target !== 'object' || typeof source !== 'object' || target === null || source === null) return

        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                const sourceValue = source[key]
                const targetValue = target[key]
                
                // Если это вложенный объект (не массив и не null), рекурсивно мерджим
                if (
                    typeof sourceValue === 'object' &&
                    sourceValue !== null &&
                    !Array.isArray(sourceValue) &&
                    typeof targetValue === 'object' &&
                    targetValue !== null &&
                    !Array.isArray(targetValue)
                ) {
                    mergeDeep(targetValue, sourceValue)
                } 
                // Если ключ существует в defaults, обновляем значение
                else if (target.hasOwnProperty(key)) {
                    target[key] = sourceValue
                }
            }
        }
    }

    mergeDeep(result, saved)
    return result
}

// Дебаунс для сохранения
function debouncedSave() {
    if (saveTimeout) clearTimeout(saveTimeout)

    saveTimeout = window.setTimeout(() => {
        saveToStorage()
        saveTimeout = null
    }, 500)
}

// Автосохранение
watch(
    () => state,
    () => {
        if (isLoaded) debouncedSave()
    },
    { deep: true }
)

function handleBeforeUnload() {
    if (saveTimeout) clearTimeout(saveTimeout)
    saveToStorage()
}

// Основная функция
export async function useInspectorSettings(): Promise<InspectorSettings> {
    if (!isLoaded) {
        await loadFromStorage()
        window.addEventListener('beforeunload', handleBeforeUnload)
        window.addEventListener('pagehide', handleBeforeUnload)
    }

    return state
}

export async function resetInspectorSettings() {
    Object.assign(state, structuredClone(defaultInspectorSettings))

    // Отправляем запрос на сброс в background script
    try {
        await safeSendMessage({ type: 'RESET_SETTINGS' })
    } catch (error) {
        // Fallback: сохраняем локально
        await saveToStorage()
    }

}

export async function exportSettings(): Promise<string> {
    return JSON.stringify(toRaw(state), null, 2)
}

export async function importSettings(json: string): Promise<void> {
    try {
        const imported = JSON.parse(json)
        Object.assign(state, mergeSettings(defaultInspectorSettings, imported))
        await saveToStorage()
    } catch (error: any) {
        throw error
    }
}
