// src/injected/collect-all.ts

import { findVueRoots, extractRootVNode, detectVueContext } from './vue-detect'

interface VueHTMLElement extends HTMLElement {
  __vue_app__?: any
  __vue__?: any
  _vnode?: any
}

/**
 * Интерфейс для информации о компоненте
 */
interface ComponentInfo {
  name: string
  props: Record<string, any>
  path: string
  element: ElementInfo | null
  hasProps: boolean
  propsCount: number
  rootElement: ElementInfo | null
}

/**
 * Интерфейс для информации об элементе
 */
interface ElementInfo {
  tagName?: string
  id?: string
  className?: string
  testId?: string
}
import { collectComponentsRecursively } from './collect'

/**
 * Получает информацию о всех компонентах Vue на странице.
 * @returns Массив информации о компонентах.
 */
export function getVueComponents(): ComponentInfo[] {
  const allComponents: ComponentInfo[] = []
  const vueRoots = findVueRoots()

  if (vueRoots.length > 0) {
    vueRoots.forEach((root, rootIndex) => {
      const rootVNode = extractRootVNode(root)
      if (rootVNode) {
        // Определяем версию Vue для каждого корня отдельно (как в старой версии)
        const isRootVue2 = root.__vue__ && !root.__vue_app__
        const vueContext: { version: 2 | 3, roots: VueHTMLElement[] } = {
          version: isRootVue2 ? 2 : 3,
          roots: vueRoots
        }

        // Используем Set для отслеживания обработанных VNodes
        // Очищаем Set после каждого цикла для предотвращения утечек памяти
        const collected = new Set()

        const components = collectComponentsRecursively(
          rootVNode,
          `root[${rootIndex}]`,
          0,
          root as HTMLElement,
          collected,
          vueContext
        )
        allComponents.push(...components)

        // Очищаем Set после использования для предотвращения накопления ссылок
        collected.clear()
      }
    })
  }

  return allComponents
}