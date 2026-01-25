/**
 * Vue/Pinia detection logic
 */

import {
  vueCheckInProgress,
  detectionCompleted,
  detectionAttempts,
  detectionStopped,
  featureFlags,
  injectedScriptLoaded,
  messageListenerAdded,
  checkTimeout,
  setVueCheckInProgress,
  setDetectionCompleted,
  incrementDetectionAttempts,
  setDetectionStopped,
  setFeatureFlags,
  setInjectedScriptLoaded,
  setMessageListenerAdded,
  setCheckTimeout,
  MAX_DETECTION_ATTEMPTS
} from './state'
import { injectScript } from './script-injector'
import { sendFlagsToUI, broadcastToUI } from './ui-bridge'

/**
 * Runs Vue/Pinia detection via injected script
 */
export function runDetection(): void {
  // Skip if already checking or detection completed/stopped
  if (vueCheckInProgress || detectionCompleted || detectionStopped) {
    return
  }

  // Increment attempt counter
  incrementDetectionAttempts()
  
  // If exceeded attempt limit - stop detection WITHOUT loading script
  if (detectionAttempts > MAX_DETECTION_ATTEMPTS) {
    stopDetection()
    // Mark detection as completed with zero flags
    setDetectionCompleted(true)
    setFeatureFlags({ hasVue: false, hasPinia: false, vueVersion: null })
    return
  }

  setVueCheckInProgress(true)
  
  // Inject script if not loaded yet
  if (!injectedScriptLoaded) {
    injectScript()
    setInjectedScriptLoaded(true)
  }
  
  // Send detection request via injected script
  window.postMessage({ type: 'VUE_INSPECTOR_CHECK_VUE' }, '*')
  
  // Reset flag after small delay
  setTimeout(() => {
    setVueCheckInProgress(false)
  }, 1000)
}

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
    
    // Capture previous state for comparison
    const wasFirstDetection = !detectionCompleted
    const prevHasVue = featureFlags.hasVue
    const prevHasPinia = featureFlags.hasPinia
    
    // Update flags (one-way update: false -> true)
    const newFlags = { 
      hasVue: featureFlags.hasVue || hasVue, 
      hasPinia: featureFlags.hasPinia || hasPinia, 
      vueVersion: vueVersion ?? featureFlags.vueVersion 
    }
    
    const flagsChanged = 
      (newFlags.hasVue !== prevHasVue) || 
      (newFlags.hasPinia !== prevHasPinia)
    
    setFeatureFlags(newFlags)
    
    if (!detectionCompleted) {
      setDetectionCompleted(true)
      stopDetection()
    }
    
    // Send flags to UI if something changed or first detection
    if (flagsChanged || wasFirstDetection) {
      sendFlagsToUI()
    }
    
    // Notify background
    try {
      if (chrome.runtime?.id) {
        chrome.runtime.sendMessage({
          type: 'VUE_INSPECTOR_FLAGS',
          flags: newFlags,
          url: window.location.href
        }).catch(() => {})
      }
    } catch {}
    
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
