/**
 * Props-related runtime message handlers
 */

import type { RuntimeHandler } from '../types'
import { requestWindow } from '../ipc'
import {
  highlightElement,
  unhighlightElement,
  tryHighlight,
  highlightByVueVNode,
  highlightBySelector,
  highlightByText,
  highlightByComponentsList
} from '../highlight'

/**
 * UNHIGHLIGHT_ELEMENT handler
 */
export const handleUnhighlightElement: RuntimeHandler = (message, sender, sendResponse) => {
  try {
    unhighlightElement()
    sendResponse({ success: true })
  } catch (error) {
    sendResponse({ success: false, error: String(error) })
  }
  return true
}

/**
 * HIGHLIGHT_ELEMENT handler
 */
export const handleHighlightElement: RuntimeHandler = (message, sender, sendResponse) => {
  const { componentPath } = message

  const element = tryHighlight(componentPath, [
    highlightByVueVNode,
    highlightBySelector,
    highlightByText
  ])

  if (element) {
    highlightElement(element)
    sendResponse({ success: true })
    return true
  }

  // Async fallback via components list
  return highlightByComponentsList(componentPath, sendResponse)
}

/**
 * UPDATE_COMPONENT_PROPS handler
 */
export const handleUpdateComponentProps: RuntimeHandler = (message, sender, sendResponse) => {
  // Forward props update request to injected script
  requestWindow({
    type: 'VUE_INSPECTOR_UPDATE_PROPS',
    componentPath: message.componentUid, // Use path as identifier
    props: message.props
  }, 'VUE_INSPECTOR_UPDATE_PROPS_RESULT', 5000)
    .then((response: any) => {
      sendResponse({ success: response.success || false, error: response.error })
    })
    .catch((error) => {
      sendResponse({ success: false, error: error.message })
    })

  return true // Async response
}

/**
 * GET_COMPONENT_PROPS handler
 */
export const handleGetComponentProps: RuntimeHandler = (message, sender, sendResponse) => {
  // Request component props via injected script
  requestWindow({
    type: 'VUE_INSPECTOR_GET_COMPONENT_PROPS',
    componentPath: message.componentUid
  }, 'VUE_INSPECTOR_COMPONENT_PROPS_DATA', 3000)
    .then((response: any) => {
      sendResponse({ props: response.props || {} })
    })
    .catch(() => {
      sendResponse({ props: {} })
    })

  return true
}
