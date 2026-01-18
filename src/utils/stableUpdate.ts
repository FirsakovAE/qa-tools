export class StableUpdateManager {
    private lastData: any[] = []
    private lastHash = ''
    private updateCount = 0

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
                result.splice(i, 1)
            }
        }

        // Добавляем или обновляем узлы
        newTree.forEach(newNode => {
            const oldNode = oldMap.get(newNode.id)
            if (!oldNode) {
                // Новый узел
                result.push(newNode)
            } else if (this.hasNodeChanged(oldNode, newNode)) {
                // Обновляем существующий узел
                const index = result.findIndex(n => n.id === newNode.id)
                if (index !== -1) {
                    // Сохраняем состояние детей если возможно
                    const hasExpandedChildren = oldNode.children && oldNode.children.length > 0
                    result[index] = {
                        ...newNode,
                        // Можно сохранить состояние развернутости
                        _expanded: oldNode._expanded,
                        children: this.updateTree(oldNode.children || [], newNode.children || [])
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

        if (Object.keys(oldProps).length !== Object.keys(newProps).length) return true

        for (const key in newProps) {
            if (JSON.stringify(oldProps[key]) !== JSON.stringify(newProps[key])) {
                return true
            }
        }

        return false
    }
}