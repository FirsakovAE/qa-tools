import { reactive, watch, toRaw } from 'vue'
import { defaultInspectorSettings, type InspectorSettings } from '@/settings/inspectorSettings'
import { safeRuntime, safeSendMessage } from '@/utils/extensionBridge'
import { getRuntimeAdapter } from '@/runtime'

const SETTINGS_STORAGE_KEY = 'inspector-settings'

// Реактивное состояние
const state = reactive<InspectorSettings>(structuredClone(defaultInspectorSettings))
let isLoaded = false
let saveTimeout: number | null = null

function isStandaloneMode(): boolean {
    const adapter = getRuntimeAdapter()
    return adapter?.capabilities.mode === 'standalone'
}

async function saveToStorage() {
    try {
        let settingsToSave
        try {
            settingsToSave = structuredClone(toRaw(state))
        } catch {
            settingsToSave = JSON.parse(JSON.stringify(toRaw(state)))
        }

        if (isStandaloneMode()) {
            const adapter = getRuntimeAdapter()
            await adapter?.storage.set(SETTINGS_STORAGE_KEY, settingsToSave)
        } else {
            await safeSendMessage({
                type: 'UPDATE_SETTINGS',
                settings: settingsToSave
            })
        }
    } catch {
        // Silent fail
    }
}

async function loadFromStorage(): Promise<void> {
    try {
        let savedSettings: any = null

        if (isStandaloneMode()) {
            const adapter = getRuntimeAdapter()
            savedSettings = await adapter?.storage.get(SETTINGS_STORAGE_KEY)
        } else {
            savedSettings = await safeSendMessage({ type: 'GET_SETTINGS' })
        }

        if (savedSettings && typeof savedSettings === 'object') {
            const mergedSettings = mergeSettings(defaultInspectorSettings, savedSettings)
            Object.assign(state, mergedSettings)
        } else {
            Object.assign(state, structuredClone(defaultInspectorSettings))
            saveToStorage()
        }
    } catch {
        Object.assign(state, structuredClone(defaultInspectorSettings))
    }

    isLoaded = true
}

function migrateFavoriteIds(saved: any): void {
    if (!Array.isArray(saved.favorites)) return
    let changed = false
    for (const fav of saved.favorites) {
        if (typeof fav.id === 'string' && fav.id.startsWith('uid:') && fav.name) {
            const tag = fav.tagName?.toLowerCase() || 'div'
            const cls = fav.className ? '.' + fav.className.trim().replace(/\s+/g, '.') : ''
            fav.id = `${fav.name}::${tag}${cls}`
            changed = true
        }
    }
    if (changed) {
        const seen = new Set<string>()
        saved.favorites = saved.favorites.filter((fav: any) => {
            if (seen.has(fav.id)) return false
            seen.add(fav.id)
            return true
        })
    }
}

function migrateSearchSettings(saved: any): void {
    if (saved.search && typeof saved.search === 'object') {
        const oldSearch = saved.search
        // Копируем старые search настройки в каждый модуль, если модуль ещё не существует
        if (!saved.networkSearch) {
            saved.networkSearch = { ...oldSearch }
        }
        if (!saved.propsSearch) {
            saved.propsSearch = { ...oldSearch }
        }
        if (!saved.piniaSearch) {
            saved.piniaSearch = { ...oldSearch }
        }
        // Удаляем deprecated поле
        delete saved.search
    }

    // Миграция: debounce/minLength из per-module в глобальный searchParams
    if (!saved.searchParams) {
        const source = saved.networkSearch ?? saved.propsSearch ?? saved.piniaSearch
        if (source && (source.debounce !== undefined || source.minLength !== undefined)) {
            saved.searchParams = {
                debounce: source.debounce ?? 300,
                minLength: source.minLength ?? 2,
            }
        }
    }
    // Удаляем устаревшие поля из per-module settings
    for (const key of ['networkSearch', 'propsSearch', 'piniaSearch']) {
        if (saved[key]) {
            delete saved[key].debounce
            delete saved[key].minLength
        }
    }

    // Миграция: удаляем byLabel/byRootElement из piniaSearch
    if (saved.piniaSearch) {
        delete saved.piniaSearch.byLabel
        delete saved.piniaSearch.byRootElement
    }

    // Миграция: networkSearch — byLabel -> byMethod, byName -> byPath, добавляем byStatus, удаляем byRootElement
    if (saved.networkSearch) {
        if (saved.networkSearch.byLabel !== undefined && saved.networkSearch.byMethod === undefined) {
            saved.networkSearch.byMethod = saved.networkSearch.byLabel
        }
        if (saved.networkSearch.byName !== undefined && saved.networkSearch.byPath === undefined) {
            saved.networkSearch.byPath = saved.networkSearch.byName
        }
        delete saved.networkSearch.byLabel
        delete saved.networkSearch.byName
        delete saved.networkSearch.byRootElement
        if (saved.networkSearch.byStatus === undefined) {
            saved.networkSearch.byStatus = false
        }
    }

    // Миграция: удаляем version из настроек
    delete saved.version
}

// Мердж настроек
function mergeSettings(defaults: InspectorSettings, saved: Partial<InspectorSettings>) {
    migrateSearchSettings(saved)
    migrateFavoriteIds(saved)

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

    try {
        if (isStandaloneMode()) {
            await saveToStorage()
        } else {
            await safeSendMessage({ type: 'RESET_SETTINGS' })
        }
    } catch {
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
