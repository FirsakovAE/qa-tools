// Content script который инжектится в страницу
interface ComponentInfo {
    uid: string
    component: any
    name: string
    props: Record<string, any>
    setupState: any
    element: HTMLElement | null
}

class RealPropsEditor {
    private components: ComponentInfo[] = []

    constructor() {
        this.setupMessageListener()
        this.collectVueComponents()
    }

    private setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            switch (message.type) {
                case 'GET_COMPONENT_PROPS':
                    this.handleGetProps(message.componentUid, sendResponse)
                    return true

                case 'UPDATE_COMPONENT_PROPS':
                    this.handleUpdateProps(
                        message.componentUid,
                        message.props,
                        message.options,
                        sendResponse
                    )
                    return true

                case 'FIND_COMPONENT_BY_UID':
                    this.handleFindComponent(message.uid, sendResponse)
                    return true

                case 'REFRESH_COMPONENTS':
                    this.collectVueComponents()
                    sendResponse({ success: true })
                    return true
            }
        })
    }

    private collectVueComponents() {
        this.components = []

        const findVueComponents = (element: HTMLElement = document.body): ComponentInfo[] => {
            const components: ComponentInfo[] = []

            // Проверяем текущий элемент
            if (element.__vue__ || element.__vue_app__ || element._vnode) {
                const component = this.extractVueComponent(element)
                if (component) {
                    components.push(component)
                }
            }

            // Рекурсивно проверяем детей
            element.childNodes.forEach((child) => {
                if (child.nodeType === Node.ELEMENT_NODE) {
                    components.push(...findVueComponents(child as HTMLElement))
                }
            })

            return components
        }

        this.components = findVueComponents()
    }

    private extractVueComponent(element: HTMLElement): ComponentInfo | null {
        try {
            let vueInstance: any = null
            let props: Record<string, any> = {}
            let setupState: any = null

            if (element.__vue_app__) {
                // Vue 3
                vueInstance = element.__vue_app__._instance
                if (vueInstance) {
                    props = vueInstance.props || {}
                    setupState = vueInstance.setupState || null
                }
            } else if (element.__vue__) {
                // Vue 2
                vueInstance = element.__vue__
                props = vueInstance.$props || {}
            }

            if (!vueInstance) {
                return null
            }

            // Генерируем уникальный UID
            const uid = this.generateComponentUid(element, vueInstance)

            return {
                uid,
                component: vueInstance,
                name: vueInstance.type?.name || vueInstance.$options?.name || 'Anonymous',
                props,
                setupState,
                element
            }
        } catch (error) {
            return null
        }
    }

    private generateComponentUid(element: HTMLElement, vueInstance: any): string {
        // Создаем уникальный ID на основе позиции в DOM и свойств компонента
        const path: string[] = []
        let current: HTMLElement | null = element

        while (current && current !== document.body) {
            const index = Array.from(current.parentNode?.children || []).indexOf(current)
            path.unshift(`${current.tagName.toLowerCase()}[${index}]`)
            current = current.parentElement
        }

        const componentName = vueInstance.type?.name || vueInstance.$options?.name || 'Component'
        const hash = btoa(encodeURIComponent(path.join(' > ') + componentName))
            .replace(/=/g, '')
            .substring(0, 16)

        return `vue-${hash}`
    }

    private handleGetProps(uid: string, sendResponse: (response: any) => void) {
        const component = this.components.find(c => c.uid === uid)

        if (!component) {
            sendResponse({ error: 'Component not found' })
            return
        }

        try {
            // Извлекаем пропсы из Proxy
            const props = this.extractPropsFromProxy(component.component.props || component.props)
            sendResponse({ props })
        } catch (error) {
            sendResponse({ error: (error as Error).message })
        }
    }

    private handleUpdateProps(
        uid: string,
        newProps: Record<string, any>,
        options: any,
        sendResponse: (response: any) => void
    ) {
        const component = this.components.find(c => c.uid === uid)

        if (!component) {
            sendResponse({ success: false, error: 'Component not found' })
            return
        }

        try {
            const updated = this.updateComponentProps(component, newProps, options)
            sendResponse({ success: updated })
        } catch (error) {
            sendResponse({ success: false, error: (error as Error).message })
        }
    }

    private updateComponentProps(
        component: ComponentInfo,
        newProps: Record<string, any>,
        options: any
    ): boolean {
        let success = false

        // Пытаемся обновить через разные пути
        Object.entries(newProps).forEach(([key, value]) => {
            try {
                // 1. Прямое обновление пропсов (может не работать в Vue 3)
                if (component.component.props && key in component.component.props) {
                    component.component.props[key] = value
                    success = true
                }

                // 2. Обновление через setupState (Vue 3 Composition API)
                if (component.component.setupState && key in component.component.setupState) {
                    component.component.setupState[key] = value
                    success = true
                }

                // 3. Обновление через data (Vue 2 Options API)
                if (component.component.$data && key in component.component.$data) {
                    component.component.$data[key] = value
                    success = true
                }

                // 4. Попробовать вызвать setter если есть
                if (component.component[key] !== undefined) {
                    component.component[key] = value
                    success = true
                }
            } catch (error) {
            }
        })

        if (success && !options?.silent) {

            // Триггерим обновление UI
            if (component.component.$forceUpdate) {
                component.component.$forceUpdate() // Vue 2
            } else if (component.component.update) {
                component.component.update() // Vue 3
            }
        }

        return success
    }

    private extractPropsFromProxy(proxyProps: any): Record<string, any> {
        if (!proxyProps) return {}

        try {
            // Пытаемся использовать JSON.stringify для извлечения
            return JSON.parse(JSON.stringify(proxyProps))
        } catch (e) {
            // Если не получается, собираем вручную
            const result: Record<string, any> = {}

            try {
                for (const key in proxyProps) {
                    if (proxyProps.hasOwnProperty?.(key)) {
                        result[key] = proxyProps[key]
                    }
                }
            } catch (e2) {
            }

            return result
        }
    }

    private handleFindComponent(uid: string, sendResponse: (response: any) => void) {
        const component = this.components.find(c => c.uid === uid)
        sendResponse({ component: component || null })
    }
}

// Инициализируем при загрузке страницы
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        setTimeout(() => {
            window.__VUE_PROPS_EDITOR = new RealPropsEditor()
        }, 1000)
    })
}