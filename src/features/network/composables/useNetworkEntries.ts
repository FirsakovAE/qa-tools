/**
 * Network Entries State Composable
 * Manages network entries state and IPC communication
 * 
 * NOTE: State AND message listener are at module level to persist across tab switches
 * This ensures network updates are received even when NetworkTab is not visible
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { NetworkEntry, NetworkConfig } from '@/types/network'
import { DEFAULT_NETWORK_CONFIG } from '@/types/network'

export interface NetworkEntriesOptions {
  onBreakpointHit?: (requestId: string, trigger: 'request' | 'response', entry?: any) => void
}

// ============================================================================
// Module-level State (persists across component mounts)
// ============================================================================

const entries = ref<NetworkEntry[]>([])
const paused = ref(false)
const config = ref<NetworkConfig>({ ...DEFAULT_NETWORK_CONFIG })
const isReady = ref(false)

// Track if module-level listener is initialized
let listenerInitialized = false

// Breakpoint hit callbacks (component-specific, registered on mount)
const breakpointHitCallbacks = new Set<(requestId: string, trigger: 'request' | 'response', entry?: any) => void>()

// ============================================================================
// Module-level Functions
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
 * Process network message (module-level, always active)
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
            // Breakpoint entries are always pending until resumed
            const entry = { ...normalizeEntry(msg.entry), pending: true }
            entries.value = [...entries.value, entry]
          } else {
            // Update existing entry to mark as pending
            const newEntries = [...entries.value]
            newEntries[existingIndex] = { ...newEntries[existingIndex], pending: true }
            entries.value = newEntries
          }
        }
        // Notify all registered callbacks
        breakpointHitCallbacks.forEach(cb => cb(msg.requestId, msg.trigger, msg.entry))
      }
      break

    case 'NETWORK_ENTRIES_DATA':
      isReady.value = true
      if (msg.entries && Array.isArray(msg.entries)) {
        // Smart merge: update from server but preserve breakpoint pending state
        const incomingEntries = msg.entries.map(normalizeEntry)
        const breakpointIds = new Set(
          entries.value
            .filter(e => e.pending)
            .map(e => e.id)
        )
        
        // Start with incoming entries (server is source of truth for completed requests)
        const mergedEntries: NetworkEntry[] = []
        const processedIds = new Set<string>()
        
        for (const incoming of incomingEntries) {
          processedIds.add(incoming.id)
          // If this entry was in breakpoint (pending), preserve that status
          if (breakpointIds.has(incoming.id)) {
            mergedEntries.push({ ...incoming, pending: true })
          } else {
            mergedEntries.push(incoming)
          }
        }
        
        // Keep any breakpoint entries that weren't in incoming data
        for (const existing of entries.value) {
          if (existing.pending && !processedIds.has(existing.id)) {
            mergedEntries.push(existing)
          }
        }
        
        entries.value = mergedEntries
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

/**
 * Handle incoming network messages (module-level listener)
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
 * Initialize module-level listener (called once)
 */
function initModuleListener(): void {
  if (listenerInitialized) return
  listenerInitialized = true
  window.addEventListener('message', handleMessage)
}

// ============================================================================
// Composable
// ============================================================================

/**
 * Composable for network entries management
 */
export function useNetworkEntries(options: NetworkEntriesOptions = {}) {
  // Ensure module-level listener is active
  initModuleListener()

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
    // Register breakpoint callback if provided
    if (options.onBreakpointHit) {
      breakpointHitCallbacks.add(options.onBreakpointHit)
    }

    // Request status (always)
    sendCommand('NETWORK_GET_STATUS')
    
    // Only request entries if we don't have any (fresh load)
    if (entries.value.length === 0) {
      sendCommand('NETWORK_GET_ENTRIES')
    } else {
      // We have persisted entries, mark as ready
      isReady.value = true
    }

    // Retry until ready (only if fresh load)
    let retryCount = 0
    const needsEntries = entries.value.length === 0
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
      if (needsEntries) {
        sendCommand('NETWORK_GET_ENTRIES')
      }
    }, 500)
  })

  onUnmounted(() => {
    // Unregister breakpoint callback
    if (options.onBreakpointHit) {
      breakpointHitCallbacks.delete(options.onBreakpointHit)
    }
    
    // Clear interval but DON'T remove the message listener
    // The listener stays active at module level
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
