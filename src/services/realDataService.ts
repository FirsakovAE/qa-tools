import type { TreeNodeModel } from '@/types/tree'
import type { TreeSearchOptions } from '@/types/search'
import { getRuntimeAdapter } from '@/runtime'

interface ComponentInfo {
    name: string
    props: Record<string, any>
    path: string
    element?: { tagName?: string; id?: string; className?: string; testId?: string } | null
    hasProps: boolean
    propsCount: number
    rootElement?: { tagName?: string; id?: string; className?: string; testId?: string } | null
}

interface CollectComponentsResponse {
    components?: ComponentInfo[]
    error?: string
}

export class RealDataService {
    private vueInstances: any[] = []

    async getTreeData(search?: TreeSearchOptions): Promise<TreeNodeModel[]> {
        const components = await this.collectVueComponents()
        return this.transformToTreeData(components, search)
    }

    async refreshComponents(): Promise<ComponentInfo[]> {
        return this.collectVueComponents()
    }

    private async collectVueComponents(): Promise<ComponentInfo[]> {
        const runtime = getRuntimeAdapter()
        if (!runtime) {
            console.warn('[RealDataService] Runtime adapter not available')
            return []
        }

        try {
            // Используем runtime adapter вместо chrome.tabs.sendMessage
            // В extension mode отправится через chrome.tabs
            // В standalone mode отправится через postMessage
            const response = await runtime.sendMessage<CollectComponentsResponse>({
                type: 'COLLECT_VUE_COMPONENTS'
            })

            if (response?.components) {
                return response.components
            } else {
                return []
            }
        } catch (error) {
            console.warn('[RealDataService] Error collecting components:', error)
            return []
        }
    }

    private transformToTreeData(components: ComponentInfo[], search?: TreeSearchOptions): TreeNodeModel[] {
        return components.map((comp, index) => {
            // element и rootElement теперь объекты с информацией, а не DOM элементы
            const rootElement = comp.rootElement || comp.element
            const elementInfo = comp.element

            return {
                id: comp.path || `component-${index}`,
                name: comp.name || 'Anonymous',
                label: comp.name,
                props: comp.props || {},
                jsonProps: JSON.stringify(comp.props || {}, null, 2),
                timestamp: new Date().toISOString(),
                children: [], // TODO: добавить поддержку вложенных компонентов
                rootElement: rootElement ? {
                    tagName: rootElement.tagName || 'div',
                    id: rootElement.id,
                    className: rootElement.className
                } : undefined,
                componentUid: comp.path,
                element: elementInfo ? {
                    tagName: elementInfo.tagName || 'div',
                    id: elementInfo.id,
                    className: elementInfo.className,
                    testId: elementInfo.testId
                } : undefined,
                hasProps: comp.hasProps || false,
                propsCount: comp.propsCount || 0
            }
        })
    }
}
