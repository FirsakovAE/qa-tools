// src/utils/piniaDataTransformers.ts
import type { PiniaStoreNode } from '@/types/store'

/**
 * Преобразует данные VirtualStore в формат PiniaStoreNode для компонентов
 */
export function transformVirtualStoreToNodes(virtualData: {
    meta: { lastUpdate: number; version: number };
    stores: Record<string, any>;
}): PiniaStoreNode[] {
    if (!virtualData?.stores || Object.keys(virtualData.stores).length === 0) {
        return []
    }

    return Object.keys(virtualData.stores).map(storeId => {
        const store = virtualData.stores[storeId]

        return {
            id: store.id,
            name: store.id,
            stateCount: Object.keys(store.state || {}).length,
            getterKeys: Object.keys(store.getters || {}).length,
            hasState: Object.keys(store.state || {}).length > 0,
            hasGetters: Object.keys(store.getters || {}).length > 0,
            data: {
                id: store.id,
                state: store.state || {},
                getters: store.getters || {},
                piniaMethods: store.piniaMethods || []
            }
        }
    })
}

/**
 * Преобразует данные VirtualStore в формат старого API для обратной совместимости
 */
export function transformVirtualStoreToLegacyFormat(virtualData: {
    meta: { lastUpdate: number; version: number };
    stores: Record<string, any>;
}): Record<string, any> {
    const result: Record<string, any> = {}

    if (virtualData?.stores) {
        Object.keys(virtualData.stores).forEach(storeId => {
            const store = virtualData.stores[storeId]
            result[storeId] = {
                id: store.id,
                state: store.state || {},
                getters: store.getters || {},
                piniaMethods: store.piniaMethods || [],
                timestamp: new Date().toISOString()
            }
        })
    }

    return result
}

/**
 * Преобразует данные отдельного store в формат компонента
 */
export function transformVirtualStoreData(storeData: any): PiniaStoreNode['data'] | null {
    if (!storeData) return null

    return {
        id: storeData.id,
        state: storeData.state || {},
        getters: storeData.getters || {},
        piniaMethods: storeData.piniaMethods || []
    }
}
