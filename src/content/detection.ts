/**
 * Vue/Pinia detection logic
 */

import {
  detectionCompleted,
  detectionStopped,
  featureFlags,
  messageListenerAdded,
  checkTimeout,
  setDetectionCompleted,
  setDetectionStopped,
  setFeatureFlags,
  setMessageListenerAdded,
  setCheckTimeout,
} from './state'
import { sendFlagsToUI, broadcastToUI } from './ui-bridge'

/**
 * Stops all detection processes to save resources
 */
export function stopDetection(): void {
  if (detectionStopped) return
  setDetectionStopped(true)
  
  // Clear timeout if exists
  if (checkTimeout) {
    clearTimeout(checkTimeout)
    setCheckTimeout(null)
  }
}

/**
 * Handler for messages from injected script
 */
export function handleInjectedMessage(event: MessageEvent): void {
  // Check that message is from our page
  if (event.source !== window || !event.data || typeof event.data !== 'object') {
    return
  }

  // Messages must be from our injected script
  if (!event.data.__FROM_VUE_INSPECTOR__) {
    return
  }

  if (event.data.type === 'VUE_INSPECTOR_READY') {
    // Script ready - request flags
    window.postMessage({ type: 'VUE_INSPECTOR_GET_FLAGS' }, '*')
    return
  }

  // Handle detection result (may come multiple times with reactive detection)
  if (event.data.type === 'VUE_INSPECTOR_DETECTION_RESULT') {
    const { hasVue, hasPinia, vueVersion } = event.data
    
    // Update flags (one-way update: false -> true)
    const newFlags = { 
      hasVue: featureFlags.hasVue || hasVue, 
      hasPinia: featureFlags.hasPinia || hasPinia, 
      vueVersion: vueVersion ?? featureFlags.vueVersion 
    }
    
    setFeatureFlags(newFlags)
    
    if (!detectionCompleted) {
      setDetectionCompleted(true)
      stopDetection()
    }
    
    // Always send flags so overlay receives them (may have mounted late)
    sendFlagsToUI()
    
    // Notify background
    try {
      if (chrome.runtime?.id) {
        chrome.runtime.sendMessage({
          type: 'VUE_INSPECTOR_FLAGS',
          flags: newFlags,
          url: window.location.href
        }).catch((error) => {
          console.error('[content/detection] Failed to send VUE_INSPECTOR_FLAGS:', error)
        })
      }
    } catch (error) {
      console.error('[content/detection] chrome.runtime.sendMessage error:', error)
    }
    
    return
  }
  
  // Props module ready - Vue was detected reactively
  if (event.data.type === 'VUE_INSPECTOR_PROPS_READY') {
    const prevHasVue = featureFlags.hasVue
    if (!prevHasVue) {
      setFeatureFlags({ ...featureFlags, hasVue: true })
    }
    // Always send flags and broadcast when props ready
    sendFlagsToUI()
    broadcastToUI({ type: 'VUE_INSPECTOR_PROPS_READY' })
    return
  }
  
  // Pinia module ready - Pinia was detected reactively
  if (event.data.type === 'VUE_INSPECTOR_PINIA_READY') {
    const prevHasPinia = featureFlags.hasPinia
    if (!prevHasPinia) {
      setFeatureFlags({ ...featureFlags, hasPinia: true })
    }
    // Always send flags and broadcast when pinia ready
    sendFlagsToUI()
    broadcastToUI({ type: 'VUE_INSPECTOR_PINIA_READY' })
    return
  }

  // Old format for compatibility
  if (event.data.type === 'VUE_INSPECTOR_VUE_DETECTED') {
    const { detected } = event.data
    
    if (detected && !featureFlags.hasVue) {
      setFeatureFlags({ ...featureFlags, hasVue: true })
      sendFlagsToUI()
    }
    return
  }
}

/**
 * Add message listener if not already added
 */
export function addMessageListenerIfNeeded(): void {
  if (messageListenerAdded) return
  setMessageListenerAdded(true)
  window.addEventListener('message', handleInjectedMessage)
}

/**
 * Remove message listener
 */
export function removeMessageListener(): void {
  if (!messageListenerAdded) return
  setMessageListenerAdded(false)
  window.removeEventListener('message', handleInjectedMessage)
}
