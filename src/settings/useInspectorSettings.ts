import { reactive, watch, toRaw } from 'vue'
import { defaultInspectorSettings, type InspectorSettings } from '@/settings/inspectorSettings'
import { safeRuntime, safeSendMessage } from '@/utils/extensionBridge'
import { getRuntimeAdapter } from '@/runtime'
import { initMediaStore, getMediaBlob, blobToDataUri } from '@/settings/mediaStore'

const SETTINGS_STORAGE_KEY = 'inspector-settings'
const STANDALONE_STORAGE_KEY = '__vue_inspector_storage__'

// Реактивное состояние
const state = reactive<InspectorSettings>(structuredClone(defaultInspectorSettings))
let isLoaded = false
let saveTimeout: number | null = null

/**
 * Synchronous preload from sessionStorage or localStorage (standalone mode).
 * Populates `state` immediately so the first render already has real settings.
 * Tries sessionStorage first (survives F5), then localStorage (survives refresh/new tab).
 * Does NOT set isLoaded — loadFromStorage will run and call initMediaStore.
 */
function trySyncPreload(): void {
    try {
        let raw = sessionStorage.getItem(STANDALONE_STORAGE_KEY)
        if (!raw) raw = localStorage.getItem(STANDALONE_STORAGE_KEY)
        if (!raw) return
        const data = JSON.parse(raw)
        const saved = data[SETTINGS_STORAGE_KEY]
        if (saved && typeof saved === 'object') {
            const merged = mergeSettings(defaultInspectorSettings, saved)
            Object.assign(state, merged)
        }
    } catch { /* sync preload failed — async path will handle it */ }
}

trySyncPreload()

export { state as inspectorState }

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
            for (const sf of settingsToSave.savedFiles || []) {
                if (!sf.dataUri) {
                    try {
                        const blob = await getMediaBlob(sf.id)
                        if (blob) sf.dataUri = await blobToDataUri(blob)
                    } catch { /* ignore */ }
                }
            }
        } else {
            for (const sf of settingsToSave.savedFiles || []) {
                delete sf.dataUri
            }
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
            if (!savedSettings) {
                try {
                    const raw = localStorage.getItem(STANDALONE_STORAGE_KEY)
                    if (raw) {
                        const data = JSON.parse(raw)
                        savedSettings = data[SETTINGS_STORAGE_KEY]
                    }
                } catch { /* ignore */ }
            }
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

    await initMediaStore(state.savedFiles || [])
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

function migrateCustomizeSettings(settings: any) {
    const c = settings.customize
    if (!c) return

    const img = c.image
    if (img && img.sourceType === 'file' && img.url && !img.savedFileId) {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
        if (!settings.savedFiles) settings.savedFiles = []
        settings.savedFiles.push({
            id,
            name: img.fileName || 'Imported image',
            size: img.url.length,
            mimeType: 'image/png',
            dataUri: img.url,
        })
        img.savedFileId = id
        img.url = ''
    }

    if (c.imageOpacity === undefined && (c.imageOpacityLight !== undefined || c.imageOpacityDark !== undefined)) {
        c.imageOpacity = c.imageOpacityLight ?? c.imageOpacityDark ?? 0.2
    }
    delete c.imageOpacityLight
    delete c.imageOpacityDark
    delete c.noiseIntensity
    delete c.noiseOpacity
}

// Мердж настроек
function mergeSettings(defaults: InspectorSettings, saved: Partial<InspectorSettings>) {
    migrateSearchSettings(saved)
    migrateFavoriteIds(saved)
    migrateCustomizeSettings(saved)

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
    let data = toRaw(state)
    if (isStandaloneMode()) {
        data = JSON.parse(JSON.stringify(data))
        for (const sf of (data as InspectorSettings).savedFiles || []) {
            if (!sf.dataUri) {
                try {
                    const blob = await getMediaBlob(sf.id)
                    if (blob) sf.dataUri = await blobToDataUri(blob)
                } catch { /* ignore */ }
            }
        }
    } else {
        data = JSON.parse(JSON.stringify(data))
        for (const sf of (data as InspectorSettings).savedFiles || []) {
            delete sf.dataUri
        }
    }
    return JSON.stringify(data, null, 2)
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
