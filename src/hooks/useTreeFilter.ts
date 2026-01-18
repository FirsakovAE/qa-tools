import { computed, ref } from 'vue'
import { useInspectorSettings } from '@/settings/useInspectorSettings'
import { likeMatch } from '@/utils/likeMatch'
import type { TreeNodeModel } from '@/types/tree'
import type { InspectorSettings } from '@/settings/inspectorSettings'

export function useTreeFilter(treeData: TreeNodeModel[]) {
    const settings = ref<InspectorSettings | null>(null)
    const searchTerm = ref('')
    const propsOnly = ref(false)

    useInspectorSettings().then(s => { settings.value = s ?? null })

    function isBlocked(node: TreeNodeModel): boolean {
        if (!settings.value) return false
        
        const blacklist = settings.value.blacklist
        if (!blacklist) return false
        
        // Проверяем, попадает ли компонент под паттерны из inactive (исключения)
        // Если попадает - не блокируем, даже если попадает под active
        const isInInactive = blacklist.inactive.some((rule: string) =>
            likeMatch(node.name, rule)
        )
        if (isInInactive) return false
        
        // Проверяем, попадает ли компонент под паттерны из active
        const isInActive = blacklist.active.some((rule: string) =>
            likeMatch(node.name, rule)
        )
        
        return isInActive
    }

    const filteredTree = computed<TreeNodeModel[]>(() => {
        if (!settings.value) return treeData
        const q = searchTerm.value.trim().toLowerCase()

        const filterNode = (node: TreeNodeModel): TreeNodeModel | null => {
            if (isBlocked(node)) return null
            if (propsOnly.value && (!node.props || Object.keys(node.props).length === 0)) return null

            if (q) {
                const s = settings.value!.search
                let matched = false
                if (s.byName) matched ||= node.name.toLowerCase().includes(q)
                if (s.byLabel && node.label) matched ||= node.label.toLowerCase().includes(q)
                if (s.byKey && node.props) {
                    matched ||= Object.keys(node.props).some(k => k.toLowerCase().includes(q))
                }
                if (!matched) return null
            }

            const children = node.children
                ?.map(filterNode)
                .filter((c): c is TreeNodeModel => Boolean(c))

            return { ...node, children }
        }

        return treeData.map(filterNode).filter((n): n is TreeNodeModel => Boolean(n))
    })

    const elementsCount = computed(() => {
        const countNodes = (nodes: TreeNodeModel[]): number =>
            nodes.reduce((sum, n) => sum + 1 + (n.children ? countNodes(n.children) : 0), 0)
        return countNodes(filteredTree.value)
    })

    return { filteredTree, elementsCount, searchTerm, propsOnly, settings }
}
