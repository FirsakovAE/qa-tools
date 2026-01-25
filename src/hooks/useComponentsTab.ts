import { ref, computed, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import type { Ref, ComputedRef } from 'vue'
import type { TreeNodeModel } from '@/types/tree'
import { PropsEditorServiceFactory, type PropsEditorService } from '@/services/propsEditorService'
import { useInspectorSettings } from '@/settings/useInspectorSettings'
import { likeMatch } from '@/utils/likeMatch'
import { useRuntime } from '@/runtime'
import { isInFavorites } from '@/utils/favoritesMatcher'

interface ComponentsTabOptions {
    modelValue?: string
    propsOnly?: boolean
}

interface ComponentsTabReturn {
    filteredTree: ComputedRef<TreeNodeModel[]>
    elementsCount: ComputedRef<number>
    searchTerm: Ref<string>
    propsOnly: Ref<boolean>
    startEditingProps?: (uid: string) => void
    saveEditedProps?: () => Promise<boolean>
    cancelEditing?: () => void
    updateEditedProp?: (key: string, value: any) => void
    editingComponent?: Ref<string | null>
}

export function useComponentsTab(
    treeData: Readonly<Ref<TreeNodeModel[]>>,
    options: ComponentsTabOptions = {}
): ComponentsTabReturn {
    const runtime = useRuntime()
    const STORAGE_KEY_SEARCH = 'vue-inspector-search-term'
    const STORAGE_KEY_PROPS_ONLY = 'vue-inspector-props-only'
    
    // Восстанавливаем состояние поиска и фильтра
    const savedSearchTerm = options.modelValue ?? ''
    const savedPropsOnly = options.propsOnly ?? false
    
    const searchTerm = ref(savedSearchTerm)
    const debouncedTerm = ref(savedSearchTerm)
    const localPropsOnly = ref(savedPropsOnly)
    
    // Загружаем сохраненное состояние при инициализации
    Promise.all([
        runtime.storage.get<string>(STORAGE_KEY_SEARCH),
        runtime.storage.get<boolean>(STORAGE_KEY_PROPS_ONLY)
    ]).then(([savedSearch, savedPropsOnlyVal]) => {
        if (savedSearch !== null && typeof savedSearch === 'string') {
            searchTerm.value = savedSearch
            debouncedTerm.value = savedSearch
        }
        if (savedPropsOnlyVal !== null && typeof savedPropsOnlyVal === 'boolean') {
            localPropsOnly.value = savedPropsOnlyVal
        }
    })
    
    // Сохраняем состояние поиска при изменении
    watch(searchTerm, (value) => {
        runtime.storage.set(STORAGE_KEY_SEARCH, value)
    })
    
    // Сохраняем состояние фильтра при изменении
    watch(localPropsOnly, (value) => {
        runtime.storage.set(STORAGE_KEY_PROPS_ONLY, value)
    })

    // Редактирование пропсов
    const editingComponent = ref<string | null>(null)
    const editedProps = ref<Record<string, any>>({})
    const settingsRef = ref<any>(null)

    // Загружаем настройки
    useInspectorSettings().then(s => {
        settingsRef.value = s
    })
    
    // Создаем сервис для редактирования пропсов
    const propsEditorService = computed(() => {
        return PropsEditorServiceFactory.createService()
    })

    const startEditingProps = (uid: string) => {
        editingComponent.value = uid
        // Находим компонент в treeData и копируем его пропсы
        const findComponent = (nodes: TreeNodeModel[]): TreeNodeModel | null => {
            for (const node of nodes) {
                if (node.componentUid === uid) {
                    return node
                }
                if (node.children) {
                    const found = findComponent(node.children)
                    if (found) return found
                }
            }
            return null
        }
        
        const component = findComponent(treeData.value)
        if (component) {
            editedProps.value = { ...(component.props || {}) }
        } else {
            editedProps.value = {}
        }
    }

    const updateEditedProp = (key: string, value: any) => {
        editedProps.value[key] = value
    }

    const saveEditedProps = async (): Promise<boolean> => {
        if (!editingComponent.value) {
            return false
        }

        try {
            
            const success = await propsEditorService.value.updateComponentProps(
                editingComponent.value,
                editedProps.value
            )

            if (success) {
                // Обновляем пропсы в treeData
                const findAndUpdate = (nodes: TreeNodeModel[]): boolean => {
                    for (const node of nodes) {
                        if (node.componentUid === editingComponent.value) {
                            node.props = { ...editedProps.value }
                            node.jsonProps = JSON.stringify(editedProps.value, null, 2)
                            node.timestamp = new Date().toISOString()
                            return true
                        }
                        if (node.children && findAndUpdate(node.children)) {
                            return true
                        }
                    }
                    return false
                }
                findAndUpdate(treeData.value)
                
                return true
            } else {
                return false
            }
        } catch (error) {
            return false
        }
    }

    const cancelEditing = () => {
        editingComponent.value = null
        editedProps.value = {}
    }

    const debounceDelay = computed(() => settingsRef.value?.search?.debounce ?? 300)
    const minLength = computed(() => settingsRef.value?.search?.minLength ?? 2)

    // Создаем ref для текущей debounced функции
    const debouncedApply = ref<any>(null)

    // Функция для создания новой debounced функции с текущими настройками
    const updateDebouncedApply = () => {
        debouncedApply.value = useDebounceFn(() => {
            // Проверяем минимальную длину перед установкой debounced значения
            if (searchTerm.value.length >= minLength.value || searchTerm.value.length === 0) {
                debouncedTerm.value = searchTerm.value
            }
        }, debounceDelay.value)
    }

    // Инициализируем debounced функцию
    updateDebouncedApply()

    // Пересоздаем debounced функцию при изменении настроек
    watch([debounceDelay, minLength], updateDebouncedApply)

    // Функция-обработчик для watch, которая всегда вызывает текущую debounced функцию
    const handleSearchTermChange = () => {
        debouncedApply.value?.()
    }

    watch(searchTerm, handleSearchTermChange)

    // Функция проверки, заблокирован ли компонент blacklist
    const isBlocked = (node: TreeNodeModel): boolean => {
        if (!settingsRef.value) return false
        
        const blacklist = settingsRef.value.blacklist
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

    // Функция проверки, находится ли элемент в избранном (используем stable matching)
    const isFavorite = (node: TreeNodeModel): boolean => {
        if (!settingsRef.value?.favorites) return false

        // Используем уникальный идентификатор элемента (componentUid или name::elementInfo)
        const elementId = (() => {
            // Используем componentUid как основной идентификатор, если он есть
            if (node.componentUid) {
                return node.componentUid
            }

            // Fallback: name + elementInfo для уникальности
            const elementInfo = (() => {
                if (node.element) {
                    if (node.element instanceof HTMLElement) {
                        const tag = node.element.tagName.toLowerCase()
                        const cls = node.element.className
                            ? '.' + node.element.className.trim().replace(/\s+/g, '.')
                            : ''
                        return tag + cls
                    } else if (node.element.tagName) {
                        const tag = node.element.tagName.toLowerCase()
                        const cls = node.element.className
                            ? '.' + node.element.className.trim().replace(/\s+/g, '.')
                            : ''
                        return tag + cls
                    }
                }

                // Fallback на rootElement (корневой элемент Vue приложения)
                if (node.rootElement?.tagName) {
                    const tag = node.rootElement.tagName.toLowerCase()
                    const cls = node.rootElement.className
                        ? '.' + node.rootElement.className.trim().replace(/\s+/g, '.')
                        : ''
                    return tag + cls
                }

                return 'div'
            })()

            return `${node.name}::${elementInfo}`
        })()

        // Use stable matching to compare favorites (ignores unstable Vue UIDs)
        return isInFavorites(elementId, settingsRef.value.favorites)
    }

    const filteredTree = computed((): TreeNodeModel[] => {
        const q = debouncedTerm.value.trim().toLowerCase()
        const searchSettings = settingsRef.value?.search

        const filterRecursive = (nodes: TreeNodeModel[]): TreeNodeModel[] => {
            return nodes
                .map((node): TreeNodeModel | null => {
                    // Проверяем blacklist - если компонент заблокирован, скрываем его
                    if (isBlocked(node)) {
                        return null
                    }
                    
                    const hasProps = node.props && Object.keys(node.props).length > 0
                    
                    // Сначала фильтруем детей, чтобы знать, есть ли у узла дети с props
                    const children = node.children?.flatMap(child => filterRecursive([child])) ?? []
                    
                    // Проверка поиска с учетом настроек поиска
                    let searchCheck = !q
                    if (q && searchSettings) {
                        searchCheck = false
                        if (searchSettings.byName === true && node.name.toLowerCase().includes(q)) {
                            searchCheck = true
                        }
                        if (!searchCheck && searchSettings.byLabel === true && node.label && node.label.toLowerCase().includes(q)) {
                            searchCheck = true
                        }
                        if (!searchCheck && searchSettings.byRootElement === true) {
                            // Используем ту же логику, что и в TreeNode.vue для генерации elementInfo
                            const elementInfo = (() => {
                                // Используем element (элемент самого компонента), как в script_console.ini
                                if (node.element) {
                                    if (node.element instanceof HTMLElement) {
                                        // HTMLElement
                                        const tag = node.element.tagName.toLowerCase()
                                        const cls = node.element.className
                                            ? '.' + node.element.className.trim().replace(/\s+/g, '.')
                                            : ''
                                        return tag + cls
                                    } else if (node.element.tagName) {
                                        // Объект с tagName, className, id
                                        const tag = node.element.tagName.toLowerCase()
                                        const cls = node.element.className
                                            ? '.' + node.element.className.trim().replace(/\s+/g, '.')
                                            : ''
                                        return tag + cls
                                    }
                                }

                                // Fallback на rootElement (корневой элемент Vue приложения)
                                if (node.rootElement?.tagName) {
                                    const tag = node.rootElement.tagName.toLowerCase()
                                    const cls = node.rootElement.className
                                        ? '.' + node.rootElement.className.trim().replace(/\s+/g, '.')
                                        : ''
                                    return tag + cls
                                }

                                return 'div'
                            })()

                            if (elementInfo.toLowerCase().includes(q)) {
                                searchCheck = true
                            }
                        }
                        if (!searchCheck && searchSettings.byKey === true && node.props) {
                            if (Object.keys(node.props).some(k => k.toLowerCase().includes(q))) {
                                searchCheck = true
                            }
                        }
                        if (!searchCheck && searchSettings.byValue === true && node.props) {
                            // Функция для глубокого поиска в значениях пропсов
                            const searchInValue = (value: any, searchQuery: string): boolean => {
                                if (value === null || value === undefined) return false

                                const query = searchQuery.toLowerCase()

                                // Для примитивных типов - прямое сравнение
                                if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                                    return String(value).toLowerCase().includes(query)
                                }

                                // Для массивов - поиск в каждом элементе
                                if (Array.isArray(value)) {
                                    return value.some(item => searchInValue(item, searchQuery))
                                }

                                // Для объектов - поиск в значениях всех свойств
                                if (typeof value === 'object') {
                                    return Object.values(value).some(val => searchInValue(val, searchQuery))
                                }

                                return false
                            }

                            if (Object.values(node.props).some(v => searchInValue(v, q))) {
                                searchCheck = true
                            }
                        }
                    } else if (q) {
                        // Fallback, если настройки поиска еще не загружены
                        const elementInfo = (() => {
                            // Используем element (элемент самого компонента), как в script_console.ini
                            if (node.element) {
                                if (node.element instanceof HTMLElement) {
                                    // HTMLElement
                                    const tag = node.element.tagName.toLowerCase()
                                    const cls = node.element.className
                                        ? '.' + node.element.className.trim().replace(/\s+/g, '.')
                                        : ''
                                    return tag + cls
                                } else if (node.element.tagName) {
                                    // Объект с tagName, className, id
                                    const tag = node.element.tagName.toLowerCase()
                                    const cls = node.element.className
                                        ? '.' + node.element.className.trim().replace(/\s+/g, '.')
                                        : ''
                                    return tag + cls
                                }
                            }

                            // Fallback на rootElement (корневой элемент Vue приложения)
                            if (node.rootElement?.tagName) {
                                const tag = node.rootElement.tagName.toLowerCase()
                                const cls = node.rootElement.className
                                    ? '.' + node.rootElement.className.trim().replace(/\s+/g, '.')
                                    : ''
                                return tag + cls
                            }

                            return 'div'
                        })()

                        // Функция для глубокого поиска в значениях пропсов
                        const searchInValue = (value: any, searchQuery: string): boolean => {
                            if (value === null || value === undefined) return false

                            const query = searchQuery.toLowerCase()

                            // Для примитивных типов - прямое сравнение
                            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                                return String(value).toLowerCase().includes(query)
                            }

                            // Для массивов - поиск в каждом элементе
                            if (Array.isArray(value)) {
                                return value.some(item => searchInValue(item, searchQuery))
                            }

                            // Для объектов - поиск в значениях всех свойств
                            if (typeof value === 'object') {
                                return Object.values(value).some(val => searchInValue(val, searchQuery))
                            }

                            return false
                        }

                        searchCheck = Boolean(
                            node.name.toLowerCase().includes(q) ||
                            (node.label && node.label.toLowerCase().includes(q)) ||
                            elementInfo.toLowerCase().includes(q) ||
                            (node.props && Object.keys(node.props).some(k => k.toLowerCase().includes(q))) ||
                            (node.props && Object.values(node.props).some(v => searchInValue(v, q)))
                        )
                    }
                    
                    // Если включен propsOnly, проверяем наличие props
                    if (localPropsOnly.value) {
                        // Если у узла нет props, но есть дети с props - оставляем узел для отображения структуры
                        if (!hasProps && children.length === 0) {
                            return null
                        }
                        // Если у узла нет props и нет совпадения в поиске, но есть дети - проверяем детей
                        if (!hasProps && !searchCheck && children.length === 0) {
                            return null
                        }
                    }
                    
                    // Если поиск активен и узел не проходит проверку поиска
                    if (q && !searchCheck && children.length === 0) {
                        return null
                    }

                    return { ...node, children: children.length > 0 ? children : undefined }
                })
                .filter((n): n is TreeNodeModel => n !== null)
        }

        let result = filterRecursive(treeData.value)

        // Сортируем: избранные элементы первыми
        result = result.sort((a, b) => {
            const aFavorite = isFavorite(a)
            const bFavorite = isFavorite(b)

            if (aFavorite && !bFavorite) return -1
            if (!aFavorite && bFavorite) return 1
            return 0
        })

        return result
    })

    const elementsCount = computed(() => {
        const walk = (nodes: TreeNodeModel[]): number =>
            nodes.reduce((sum, n) => sum + 1 + (n.children ? walk(n.children) : 0), 0)
        return walk(filteredTree.value)
    })

    return { 
        filteredTree, 
        elementsCount, 
        searchTerm, 
        propsOnly: localPropsOnly, 
        startEditingProps,
        saveEditedProps,
        cancelEditing,
        updateEditedProp,
        editingComponent
    }
}
