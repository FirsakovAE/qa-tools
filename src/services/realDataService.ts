import type { TreeNodeModel } from '@/types/tree'
import type { TreeSearchOptions } from '@/types/search'
import { getRuntimeAdapter } from '@/runtime'

interface ComponentInfo {
    name: string
    props: Record<string, any>
    path: string
    componentUid?: string
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

    async getTreeData(search?: TreeSearchOptions, forceRefresh = false): Promise<TreeNodeModel[]> {
        const components = await this.collectVueComponents(forceRefresh)
        return this.transformToTreeData(components, search)
    }

    async refreshComponents(): Promise<ComponentInfo[]> {
        return this.collectVueComponents(true)
    }

    private async collectVueComponents(forceRefresh = false): Promise<ComponentInfo[]> {
        const runtime = getRuntimeAdapter()
        if (!runtime) {
            return []
        }

        try {
            // Используем runtime adapter вместо chrome.tabs.sendMessage
            // В extension mode отправится через chrome.tabs
            // В standalone mode отправится через postMessage
            const response = await runtime.sendMessage<CollectComponentsResponse>({
                type: 'COLLECT_VUE_COMPONENTS',
                forceRefresh
            })

            if (response?.components) {
                return response.components
            } else {
                return []
            }
        } catch (error) {
            return []
        }
    }

    private buildStableComponentUid(comp: ComponentInfo): string {
        const name = comp.name || 'Anonymous'
        const el = comp.rootElement || comp.element
        if (el) {
            const tag = el.tagName?.toLowerCase() || 'div'
            const cls = el.className ? '.' + el.className.trim().replace(/\s+/g, '.') : ''
            const id = el.id ? `#${el.id}` : ''
            return `${name}::${tag}${cls}${id}`
        }
        return `${name}::div`
    }

    private transformToTreeData(components: ComponentInfo[], search?: TreeSearchOptions): TreeNodeModel[] {
        return components.map((comp, index) => {
            const rootElement = comp.rootElement || comp.element
            const elementInfo = comp.element

            const stableUid = comp.componentUid && !comp.componentUid.startsWith('uid:')
                ? comp.componentUid
                : this.buildStableComponentUid(comp)

            return {
                id: comp.path || `component-${index}`,
                name: comp.name || 'Anonymous',
                label: comp.name,
                props: comp.props || {},
                jsonProps: JSON.stringify(comp.props || {}, null, 2),
                timestamp: new Date().toISOString(),
                children: [],
                rootElement: rootElement ? {
                    tagName: rootElement.tagName || 'div',
                    id: rootElement.id,
                    className: rootElement.className
                } : undefined,
                componentUid: stableUid,
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
