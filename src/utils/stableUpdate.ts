/**
 * Stable hash for props comparison - handles undefined, functions, and ordering
 */
function stablePropsHash(props: Record<string, any>): string {
    if (!props || typeof props !== 'object') return 'empty'
    
    const keys = Object.keys(props).sort() // Sort keys for stable ordering
    if (keys.length === 0) return 'empty'
    
    const parts: string[] = []
    for (const key of keys.slice(0, 30)) { // Limit to first 30 keys
        const value = props[key]
        parts.push(`${key}:${stableValueHash(value)}`)
    }
    
    return parts.join('|')
}

/**
 * Generate a stable hash for a single value
 */
function stableValueHash(value: any, depth: number = 0): string {
    if (depth > 5) return '[deep]'
    if (value === null) return 'null'
    if (value === undefined) return 'undef'
    
    const type = typeof value
    
    if (type === 'string') {
        // Use first 50 chars for comparison
        return `s:${value.substring(0, 50)}`
    }
    if (type === 'number') return `n:${value}`
    if (type === 'boolean') return `b:${value}`
    if (type === 'function') return 'fn'
    if (type === 'symbol') return 'sym'
    
    if (Array.isArray(value)) {
        if (value.length === 0) return 'arr:0'
        // For arrays, hash length + first few items
        const itemHashes = value.slice(0, 5).map(v => stableValueHash(v, depth + 1))
        return `arr:${value.length}:[${itemHashes.join(',')}]`
    }
    
    if (type === 'object') {
        // For objects, hash key count + sorted keys hash
        const keys = Object.keys(value).sort()
        if (keys.length === 0) return 'obj:0'
        const keyHashes = keys.slice(0, 10).map(k => `${k}:${stableValueHash(value[k], depth + 1)}`)
        return `obj:${keys.length}:{${keyHashes.join(',')}}`
    }
    
    return 'other'
}

export class StableUpdateManager {
    private lastData: any[] = []
    private lastHash = ''
    private updateCount = 0
    private lastPropsHashes = new Map<string, string>()

    // Сравниваем данные по хэшу для минимизации обновлений
    shouldUpdate(newData: any[]): boolean {
        if (newData.length !== this.lastData.length) {
            return true
        }

        const newHash = this.generateHash(newData)
        if (newHash !== this.lastHash) {
            this.lastData = newData
            this.lastHash = newHash
            this.updateCount++
            return true
        }

        return false
    }

    // Метод для очистки кэша при необходимости (например, при большом количестве обновлений)
    clearCache() {
        this.lastData = []
        this.lastHash = ''
        this.updateCount = 0
        this.lastPropsHashes.clear()
    }

    // Получить количество обновлений (для отладки)
    getUpdateCount(): number {
        return this.updateCount
    }

    private generateHash(data: any[]): string {
        // Генерируем простой хэш на основе ID и ключевых полей
        return data.map(item => {
            const id = item.id || ''
            const name = item.name || ''
            const propsCount = item.props ? Object.keys(item.props).length : 0
            const childrenCount = item.children ? item.children.length : 0
            return `${id}-${name}-${propsCount}-${childrenCount}`
        }).join('|')
    }

    // Обновляем только измененные узлы
    updateTree(oldTree: any[], newTree: any[]): any[] {
        if (oldTree.length === 0) return newTree

        const result = [...oldTree]
        const oldMap = new Map(oldTree.map(node => [node.id, node]))
        const newMap = new Map(newTree.map(node => [node.id, node]))

        // Удаляем отсутствующие узлы
        for (let i = result.length - 1; i >= 0; i--) {
            if (!newMap.has(result[i].id)) {
                // Clean up cached hash
                this.lastPropsHashes.delete(result[i].id)
                result.splice(i, 1)
            }
        }

        // Добавляем или обновляем узлы
        newTree.forEach(newNode => {
            const oldNode = oldMap.get(newNode.id)
            if (!oldNode) {
                // Новый узел
                result.push(newNode)
                // Cache props hash for new node
                if (newNode.props) {
                    this.lastPropsHashes.set(newNode.id, stablePropsHash(newNode.props))
                }
            } else if (this.hasNodeChanged(oldNode, newNode)) {
                // Обновляем существующий узел
                const index = result.findIndex(n => n.id === newNode.id)
                if (index !== -1) {
                    // Сохраняем состояние детей если возможно
                    result[index] = {
                        ...newNode,
                        // Можно сохранить состояние развернутости
                        _expanded: oldNode._expanded,
                        children: this.updateTree(oldNode.children || [], newNode.children || [])
                    }
                    // Update cached props hash
                    if (newNode.props) {
                        this.lastPropsHashes.set(newNode.id, stablePropsHash(newNode.props))
                    }
                }
            }
        })

        return result
    }

    private hasNodeChanged(oldNode: any, newNode: any): boolean {
        if (oldNode.name !== newNode.name) return true
        if (oldNode.label !== newNode.label) return true

        const oldProps = oldNode.props || {}
        const newProps = newNode.props || {}

        // Quick check: different key count
        const oldKeyCount = Object.keys(oldProps).length
        const newKeyCount = Object.keys(newProps).length
        if (oldKeyCount !== newKeyCount) return true

        // Use stable hash comparison instead of JSON.stringify
        const newPropsHash = stablePropsHash(newProps)
        const cachedHash = this.lastPropsHashes.get(newNode.id)
        
        // If we have a cached hash, compare with it
        if (cachedHash !== undefined) {
            return cachedHash !== newPropsHash
        }
        
        // First time seeing this node, compare with old props hash
        const oldPropsHash = stablePropsHash(oldProps)
        return oldPropsHash !== newPropsHash
    }
}