import type { TreeNodeModel } from '@/types/tree'
import type { TreeSearchOptions } from '@/types/search'
import { getRuntimeAdapter } from '@/runtime'
import { isExpectedExtensionError } from '@/utils/expectedErrors'

interface ComponentInfo {
    name: string
    props: Record<string, any>
    path: string
    componentUid?: string
    element?: { tagName?: string; id?: string; className?: string; testId?: string } | null
    hasProps: boolean
    propsCount: number
    propsCountPassed?: number
    rootElement?: { tagName?: string; id?: string; className?: string; testId?: string } | null
}

interface CollectComponentsResponse {
    components?: ComponentInfo[]
    error?: string
}

export class RealDataService {
    private vueInstances: any[] = []

    async getTreeData(
        search?: TreeSearchOptions,
        forceRefresh = false,
        options?: { blacklist?: { active: string[]; inactive: string[] }; rootFilter?: { rootElementUid: number } }
    ): Promise<TreeNodeModel[]> {
        try {
            const components = await this.collectVueComponents(forceRefresh, options?.blacklist, options?.rootFilter?.rootElementUid)
            return this.transformToTreeData(components, search)
        } catch (e) {
            console.error('[services/realDataService] getTreeData failed:', e)
            return []
        }
    }

    async refreshComponents(): Promise<ComponentInfo[]> {
        try {
            return await this.collectVueComponents(true)
        } catch (e) {
            console.error('[services/realDataService] refreshComponents failed:', e)
            return []
        }
    }

    private async collectVueComponents(
        forceRefresh = false,
        blacklist?: { active: string[]; inactive: string[] },
        rootElementUid?: number
    ): Promise<ComponentInfo[]> {
        const runtime = getRuntimeAdapter()
        if (!runtime) {
            return []
        }

        try {
            // Сериализуем blacklist для безопасной передачи через postMessage (iframe mode)
            const serializedBlacklist = blacklist
                ? JSON.parse(JSON.stringify(blacklist)) as { active: string[]; inactive: string[] }
                : undefined

            const response = await runtime.sendMessage<CollectComponentsResponse>({
                type: 'COLLECT_VUE_COMPONENTS',
                forceRefresh,
                blacklist: serializedBlacklist,
                rootElementUid
            })

            if (response?.components) {
                return response.components
            } else {
                return []
            }
        } catch (error) {
            if (!isExpectedExtensionError(error)) {
                console.error('[services/realDataService] collectVueComponents failed:', error)
            }
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
            try {
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
                    propsCount: comp.propsCount || 0,
                    propsCountPassed: comp.propsCountPassed ?? comp.propsCount ?? 0
                }
            } catch (e) {
                console.error('[services/realDataService] transformToTreeData component failed:', comp.path, e)
                return {
                    id: comp.path || `component-${index}`,
                    name: comp.name || 'Anonymous',
                    label: comp.name || 'Anonymous',
                    props: {},
                    jsonProps: '{}',
                    timestamp: new Date().toISOString(),
                    children: [],
                    hasProps: false,
                    propsCount: 0,
                    propsCountPassed: 0
                }
            }
        })
    }
}
