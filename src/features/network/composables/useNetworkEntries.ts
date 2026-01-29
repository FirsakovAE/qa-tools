/**
 * Network Entries State Composable
 * Manages network entries state and IPC communication
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { NetworkEntry, NetworkConfig } from '@/types/network'
import { DEFAULT_NETWORK_CONFIG } from '@/types/network'

export interface NetworkEntriesOptions {
  onBreakpointHit?: (requestId: string, trigger: 'request' | 'response', entry?: any) => void
}

/**
 * Composable for network entries management
 */
export function useNetworkEntries(options: NetworkEntriesOptions = {}) {
  // State
  const entries = ref<NetworkEntry[]>([])
  const paused = ref(false)
  const config = ref<NetworkConfig>({ ...DEFAULT_NETWORK_CONFIG })
  const isReady = ref(false)

  // ============================================================================
  // IPC Communication
  // ============================================================================

  /**
   * Send command to injected network module via content script
   */
  function sendCommand(type: string, data: Record<string, any> = {}): void {
    window.parent?.postMessage({
      __VUE_INSPECTOR__: true,
      message: {
        type,
        __VUE_INSPECTOR__: true,
        __NETWORK_CMD__: true,
        ...data
      }
    }, '*')
  }

  /**
   * Normalize entry to ensure it has a version field
   */
  function normalizeEntry(entry: any): NetworkEntry {
    return { ...entry, version: entry.version ?? 1 }
  }

  /**
   * Handle incoming network messages
   */
  function handleMessage(event: MessageEvent): void {
    const data = event.data

    // Handle broadcast format from content script
    if (data?.__VUE_INSPECTOR__ && data.broadcast && data.message?.__NETWORK__) {
      processMessage(data.message)
      return
    }

    // Handle direct format
    if (data?.__FROM_VUE_INSPECTOR__ && data.__NETWORK__) {
      processMessage(data)
    }
  }

  /**
   * Process network message
   */
  function processMessage(msg: any): void {
    const { type } = msg

    switch (type) {
      case 'NETWORK_READY':
        isReady.value = true
        if (typeof msg.paused === 'boolean') {
          paused.value = msg.paused
        }
        sendCommand('NETWORK_GET_ENTRIES')
        break

      case 'NETWORK_ENTRY_CAPTURED':
        if (msg.entry && !paused.value) {
          const entry = normalizeEntry(msg.entry)
          const existingIndex = entries.value.findIndex(e => e.id === entry.id)
          if (existingIndex === -1) {
            entries.value = [...entries.value, entry]

            if (entries.value.length > config.value.maxEntries) {
              entries.value = entries.value.slice(-config.value.maxEntries)
            }
          }
        }
        break

      case 'NETWORK_ENTRY_UPDATED':
        if (msg.entry) {
          const entry = normalizeEntry(msg.entry)
          const index = entries.value.findIndex(e => e.id === entry.id)

          if (index !== -1) {
            const newEntries = [...entries.value]
            newEntries[index] = entry
            entries.value = newEntries
          } else if (!paused.value) {
            entries.value = [...entries.value, entry]
          }
        }
        break

      case 'NETWORK_BREAKPOINT_HIT':
        if (msg.requestId && msg.trigger) {
          // Add entry if provided and not in list
          if (msg.entry) {
            const existingIndex = entries.value.findIndex(e => e.id === msg.requestId)
            if (existingIndex === -1) {
              const entry = normalizeEntry(msg.entry)
              entries.value = [...entries.value, entry]
            }
          }
          // Notify parent
          options.onBreakpointHit?.(msg.requestId, msg.trigger, msg.entry)
        }
        break

      case 'NETWORK_ENTRIES_DATA':
        isReady.value = true
        if (msg.entries && Array.isArray(msg.entries)) {
          entries.value = msg.entries.map(normalizeEntry)
        }
        break

      case 'NETWORK_STATUS':
        isReady.value = true
        if (typeof msg.paused === 'boolean') {
          paused.value = msg.paused
        }
        break

      case 'NETWORK_PAUSED':
        paused.value = true
        break

      case 'NETWORK_RESUMED':
        paused.value = false
        break

      case 'NETWORK_CLEARED':
        entries.value = []
        break
    }
  }

  // ============================================================================
  // Actions
  // ============================================================================

  function togglePause() {
    if (paused.value) {
      paused.value = false
      sendCommand('NETWORK_RESUME')
    } else {
      paused.value = true
      sendCommand('NETWORK_PAUSE')
    }
  }

  function clearEntries() {
    entries.value = []
    sendCommand('NETWORK_CLEAR')
  }

  function addEntry(entry: NetworkEntry) {
    const existingIndex = entries.value.findIndex(e => e.id === entry.id)
    if (existingIndex === -1) {
      entries.value = [...entries.value, entry]
    }
  }

  function getEntry(id: string): NetworkEntry | undefined {
    return entries.value.find(e => e.id === id)
  }

  // ============================================================================
  // Computed
  // ============================================================================

  const totalCount = computed(() => entries.value.length)
  const pendingCount = computed(() => entries.value.filter(e => e.pending).length)

  // ============================================================================
  // Lifecycle
  // ============================================================================

  let statusCheckInterval: ReturnType<typeof setInterval> | null = null

  onMounted(() => {
    window.addEventListener('message', handleMessage)

    sendCommand('NETWORK_GET_STATUS')
    sendCommand('NETWORK_GET_ENTRIES')

    // Retry until ready
    let retryCount = 0
    statusCheckInterval = setInterval(() => {
      if (isReady.value || retryCount > 10) {
        if (statusCheckInterval) {
          clearInterval(statusCheckInterval)
          statusCheckInterval = null
        }
        return
      }
      retryCount++
      sendCommand('NETWORK_GET_STATUS')
      sendCommand('NETWORK_GET_ENTRIES')
    }, 500)
  })

  onUnmounted(() => {
    window.removeEventListener('message', handleMessage)
    if (statusCheckInterval) {
      clearInterval(statusCheckInterval)
      statusCheckInterval = null
    }
  })

  return {
    // State
    entries,
    paused,
    config,
    isReady,
    
    // Computed
    totalCount,
    pendingCount,
    
    // Actions
    sendCommand,
    togglePause,
    clearEntries,
    addEntry,
    getEntry,
    normalizeEntry
  }
}
