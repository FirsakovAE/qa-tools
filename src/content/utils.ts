/**
 * Utility functions for the content script
 */

import type { VueHTMLElement } from './types'

/**
 * Builds a CSS selector from element information.
 * Excludes unstable classes and limits the number of classes.
 */
export function buildSelectorFromElementInfo(elementInfo: any): string | null {
  if (!elementInfo) return null

  const parts: string[] = []

  if (elementInfo.tagName) {
    parts.push(elementInfo.tagName.toLowerCase())
  }

  if (elementInfo.id) {
    // Escape special characters in ID
    const escapedId = elementInfo.id.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1')
    parts.push(`#${escapedId}`)
  }

  if (elementInfo.className) {
    const classes = elementInfo.className.trim().split(/\s+/)
    // Filter classes with invalid characters and exclude unstable ones
    const validClasses = classes.filter((cls: string) => {
      // Check that class contains only valid CSS selector characters
      return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(cls) &&
             !cls.includes('animate-') &&
             !cls.includes('transition-') &&
             !cls.includes('backdrop-')
    })
    if (validClasses.length > 0) {
      parts.push(...validClasses.slice(0, 3).map((cls: string) => `.${cls}`))
    }
  }

  if (elementInfo.testId) {
    // Escape special characters in data-test-id
    const escapedTestId = elementInfo.testId.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1')
    parts.push(`[data-test-id="${escapedTestId}"]`)
  }

  return parts.length > 0 ? parts.join('') : null
}

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
    return root.__vue_app__._instance?.root ?? root.__vue_app__._container?._vnode ?? root._vnode
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
