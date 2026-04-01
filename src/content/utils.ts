/**
 * Utility functions for the content script
 */

import type { VueHTMLElement } from './types'

/**
 * Find Vue root elements in the document
 */
function findVueRoots(): VueHTMLElement[] {
  const vueRoots: VueHTMLElement[] = []

  document.querySelectorAll<HTMLElement>('[__vue_app__]').forEach(el => {
    const vEl = el as VueHTMLElement
    if (vEl.__vue_app__ && !vueRoots.includes(vEl)) {
      vueRoots.push(vEl)
    }
  })

  if (vueRoots.length === 0) {
    const possibleContainers = document.querySelectorAll<HTMLElement>(
      'div, main, section, article, #app, #root, [class*="app"], [class*="vue"], [id*="app"]'
    )

    possibleContainers.forEach(el => {
      const vEl = el as VueHTMLElement
      if (vEl.__vue_app__ || vEl.__vue__ || vEl._vnode) {
        if (!vueRoots.includes(vEl)) {
          vueRoots.push(vEl)
        }
      }
    })
  }

  return vueRoots
}

/**
 * Extract root VNode from a Vue root element
 */
function extractRootVNode(root: VueHTMLElement): any {
  if (root.__vue_app__) {
    const app = root.__vue_app__ as any
    return app._instance?.vnode ?? app._container?._vnode ?? root._vnode
  } else if (root.__vue__) {
    return root.__vue__.$root ?? root.__vue__
  }
  return root._vnode
}

/**
 * Collect Vue components from DOM (fallback method)
 */
export function collectVueComponentsFromDOM(): any[] {
  const components: any[] = []

  const vueRoots = findVueRoots()
  if (vueRoots.length === 0) {
    return []
  }

  vueRoots.forEach((root, rootIndex) => {
    const rootVNode = extractRootVNode(root)
    if (!rootVNode) {
      return
    }

    const collectComponents = (vnode: any, path = '', depth = 0) => {
      if (!vnode || depth > 25) return

      if (vnode.component) {
        const component = {
          vnode,
          component: vnode.component,
          name:
            vnode.component.type?.name ||
            vnode.component.type?.__name ||
            vnode.component.type?.displayName ||
            'Anonymous',
          props: vnode.component.props || {},
          setupState: vnode.component.setupState,
          depth,
          path: `root${rootIndex}.${path}`,
          element: vnode.el ?? null,
          hasProps: vnode.component.props
            ? Object.keys(vnode.component.props).length > 0
            : false,
          propsCount: vnode.component.props
            ? Object.keys(vnode.component.props).length
            : 0,
          rootIndex,
          rootElement: root
        }
        components.push(component)
      }

      if (Array.isArray(vnode.children)) {
        vnode.children.forEach((child: any, i: number) => {
          collectComponents(child, `${path}.children[${i}]`, depth + 1)
        })
      }

      if (vnode.component?.subTree) {
        collectComponents(vnode.component.subTree, `${path}.component.subTree`, depth + 1)
      }
    }

    collectComponents(rootVNode, 'root', 0)
  })

  return components
}
