// src/injected/collect.ts

// Define interfaces locally to avoid import issues
interface VueInstance {
  _uid?: number
  $options?: { name?: string }
  type?: { name?: string; __name?: string; displayName?: string }
  props?: Record<string, any>
  subTree?: any
  root?: any
  _instance?: any
  _container?: any
  setupState?: any
}

interface VueHTMLElement extends HTMLElement {
  __vue_app__?: any
  __vue__?: any
  _vnode?: any
}

interface VueContext {
  version: 2 | 3
  roots: VueHTMLElement[]
}

interface ComponentInfo {
  name: string
  props: Record<string, any>
  path: string
  element: ElementInfo | null
  hasProps: boolean
  propsCount: number
  rootElement: ElementInfo | null
}

interface ElementInfo {
  tagName?: string
  id?: string
  className?: string
  testId?: string
}
import { serializeProps } from './serialize'
import { getElementInfo, findComponentRootEl, generateUniqueSelector } from './dom-mapping'

/**
 * Вспомогательная функция для добавления компонента в список.
 * @param instance - Экземпляр компонента.
 * @param vnodeNode - VNode компонента.
 * @param compPath - Путь компоненту.
 * @param rootElement - Корневой элемент приложения.
 * @returns Объект информации о компоненте.
 */
function addComponent(instance: any, vnodeNode: any, compPath: string, rootElement: HTMLElement): ComponentInfo | null {
  if (!instance) return null
  const rawProps = instance.props || instance.$props || instance.propsData || instance._props || {}
  const props = serializeProps(rawProps)
  const name =
    instance.type?.name ||
    instance.type?.__name ||
    instance.type?.displayName ||
    instance.$options?.name ||
    'Anonymous'
  let componentId = instance.uid || instance._uid || `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const el = vnodeNode?.el || vnodeNode?.elm

  // Генерируем уникальный селектор для подсветки
 let uniqueSelector = ''
  if (el && el instanceof HTMLElement) {
    uniqueSelector = generateUniqueSelector(el)
    if (uniqueSelector) {
      componentId = `${componentId}::${uniqueSelector}`
    }

    // Добавляем текстовый контент для элементов с текстом (для различения похожих элементов)
    if (el.textContent && el.textContent.trim().length > 0 && el.textContent.trim().length < 50) {
      const textContent = el.textContent.trim().replace(/\s+/g, ' ')
      componentId = `${componentId}::text:${textContent}`
    }
  }

  const elementInfo = getElementInfo(el)
  const rootEl = findComponentRootEl(el)
 const rootElementInfo = rootEl ? getElementInfo(rootEl) : elementInfo

  return {
    name,
    props,
    path: `${compPath}::${name}::${componentId}`,
    element: elementInfo,
    hasProps: Object.keys(props).length > 0,
    propsCount: Object.keys(props).length,
    rootElement: rootElementInfo
  }
}

/**
 * Проверяет, является ли vnode компонентом Vue 3
 */
const isVue3Component = (vnode: any, vueContext: VueContext): boolean => {
 return vueContext.version === 3 && !!vnode.component;
};

/**
 * Проверяет, является ли vnode компонентом Vue 2
 */
const isVue2Component = (vnode: any, vueContext: VueContext): boolean => {
  return vueContext.version === 2 && (vnode.componentInstance || vnode.context);
};

/**
 * Обрабатывает vnode как компонент Vue 3
 */
const processVue3Component = (vnode: any, path: string, rootElement: HTMLElement, depth: number, collected: Set<any>, vueContext: VueContext): ComponentInfo[] => {
 const components: ComponentInfo[] = [];

  const componentInfo = addComponent(vnode.component, vnode, path || 'root', rootElement);
  if (componentInfo) {
    components.push(componentInfo);
  }

  // Рекурсивно обходим subTree (как в старой версии)
  if (vnode.component.subTree) {
    components.push(
      ...collectComponentsRecursively(
        vnode.component.subTree,
        `${path || 'root'}.subTree`,
        depth + 1,
        rootElement,
        collected,
        vueContext
      )
    );
  }

  return components;
};

/**
 * Обрабатывает vnode как компонент Vue 2
 */
const processVue2Component = (vnode: any, path: string, rootElement: HTMLElement, depth: number, collected: Set<any>, vueContext: VueContext): ComponentInfo[] => {
  const components: ComponentInfo[] = [];

  const instance = vnode.componentInstance || vnode.context;
  if (instance) {
    const componentInfo = addComponent(instance, vnode, path || 'root', rootElement);
    if (componentInfo) {
      components.push(componentInfo);
    }

    // Рекурсивно обходим $children (как в старой версии)
    if (instance.$children) {
      instance.$children.forEach((child: any, i: number) => {
        if (child.$vnode && !collected.has(child.$vnode)) {
          components.push(
            ...collectComponentsRecursively(
              child.$vnode,
              `${path || 'root'}.children[${i}]`,
              depth + 1,
              rootElement,
              collected,
              vueContext
            )
          );
        }
      });
    }
  }

  return components;
};

/**
 * Обрабатывает дочерние vnode
 */
const processChildren = (
  vnode: any,
  path: string,
  depth: number,
  rootElement: HTMLElement,
  collected: Set<any>,
  vueContext: VueContext
): ComponentInfo[] => {
  const components: ComponentInfo[] = [];

  if (Array.isArray(vnode.children)) {
    vnode.children.forEach((child: any, i: number) => {
      if (child && !collected.has(child)) {
        components.push(
          ...collectComponentsRecursively(
            child,
            `${path || 'root'}.children[${i}]`,
            depth + 1,
            rootElement,
            collected,
            vueContext
          )
        );
      }
    });
  } else if (vnode.children && typeof vnode.children === 'object' && !collected.has(vnode.children)) {
    components.push(
      ...collectComponentsRecursively(
        vnode.children,
        `${path || 'root'}.children`,
        depth + 1,
        rootElement,
        collected,
        vueContext
      )
    );
  }

 return components;
};

/**
 * Максимальная глубина рекурсии для сбора компонентов
 * Увеличена для поддержки глубоко вложенных компонентов
 */
const MAX_DEPTH = 100;

/**
 * Проверяет, должен ли vnode быть пропущен (например, если он уже был обработан или глубина превышена)
 */
const shouldSkipVNode = (vnode: any, depth: number, collected: Set<any>): boolean => {
  return !vnode || depth > MAX_DEPTH || collected.has(vnode);
};

/**
 * Основная функция для рекурсивного сбора информации о компонентах из дерева VNodes.
 * @param vnode - VNode для обхода.
 * @param path - Текущий путь в дереве.
 * @param depth - Текущая глубина рекурсии.
 * @param rootElement - Корневой элемент приложения.
 * @param collected - Множество уже собранных VNodes.
 * @param vueContext - Контекст Vue (для унификации работы с версиями).
 * @returns Массив информации о компонентах.
 */
export function collectComponentsRecursively(
  vnode: any,
  path = '',
  depth = 0,
  rootElement: HTMLElement,
  collected: Set<any> = new Set(),
  vueContext: VueContext
): ComponentInfo[] {
  // Проверяем, нужно ли пропустить этот vnode
  if (shouldSkipVNode(vnode, depth, collected)) return [];
  collected.add(vnode);

  // Определяем, является ли vnode компонентом и какого типа
  const isVue3 = isVue3Component(vnode, vueContext);
  const isVue2 = isVue2Component(vnode, vueContext);

  // Обрабатываем vnode в зависимости от типа
  let currentComponents: ComponentInfo[] = [];
  if (isVue3) {
    currentComponents = processVue3Component(vnode, path, rootElement, depth, collected, vueContext);
  } else if (isVue2) {
    currentComponents = processVue2Component(vnode, path, rootElement, depth, collected, vueContext);
  }

  // Всегда обрабатываем дочерние vnode (как в старой версии)
  const childComponents = processChildren(vnode, path, depth, rootElement, collected, vueContext);

  // Объединяем результаты
  return [...currentComponents, ...childComponents];
}