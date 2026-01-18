"use strict";
// Этот скрипт инжектится в страницу для улучшенного поиска Vue компонентов
class VueElementInspector {
    vueComponents = new Map();
    constructor() {
        this.collectVueComponents();
        this.setupMutationObserver();
    }
    // Сбор всех Vue компонентов на странице
    collectVueComponents() {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, null);
        let node;
        while ((node = walker.nextNode())) {
            const element = node;
            const vueInstance = this.getVueInstance(element);
            if (vueInstance) {
                this.vueComponents.set(element, vueInstance);
            }
        }
    }
    // Получение Vue инстанса из элемента
    getVueInstance(element) {
        // Vue 2
        if (element.__vue__) {
            return {
                type: 'vue2',
                instance: element.__vue__,
                name: element.__vue__.$options?.name,
                uid: element.__vue__._uid,
                props: element.__vue__.$props
            };
        }
        // Vue 3
        if (element.__vue_app__) {
            const instance = element.__vue_app__._instance;
            if (instance) {
                return {
                    type: 'vue3',
                    instance: instance,
                    name: instance.type?.name,
                    uid: instance.uid,
                    props: instance.props
                };
            }
        }
        // Проверяем родительские элементы (компонент может быть корневым для своих детей)
        let parent = element.parentElement;
        while (parent) {
            if (parent.__vue__ || parent.__vue_app__) {
                return this.getVueInstance(parent);
            }
            parent = parent.parentElement;
        }
        return null;
    }
    // Наблюдатель за изменениями DOM
    setupMutationObserver() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const element = node;
                            const vueInstance = this.getVueInstance(element);
                            if (vueInstance) {
                                this.vueComponents.set(element, vueInstance);
                            }
                        }
                    });
                    mutation.removedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            this.vueComponents.delete(node);
                        }
                    });
                }
            });
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    // Поиск ближайшего Vue компонента для элемента
    findNearestVueComponent(element) {
        // Проверяем сам элемент
        if (this.vueComponents.has(element)) {
            return this.vueComponents.get(element);
        }
        // Поднимаемся по дереву
        let current = element;
        while (current && current !== document.body) {
            if (this.vueComponents.has(current)) {
                return this.vueComponents.get(current);
            }
            current = current.parentElement;
        }
        return null;
    }
    // Получение всех Vue компонентов
    getAllComponents() {
        return Array.from(this.vueComponents.entries()).map(([element, component]) => ({
            element,
            component
        }));
    }
}
// Экспортируем в глобальную область видимости
if (typeof window !== 'undefined') {
    window.__VUE_ELEMENT_INSPECTOR = new VueElementInspector();
}
//# sourceMappingURL=elementInspector.js.map