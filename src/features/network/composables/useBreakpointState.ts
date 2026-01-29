/**
 * Breakpoint State Composable
 * Manages breakpoint mode, pending breakpoints, and drafts
 */

import { ref, computed, watch } from 'vue'
import type { NetworkEntry } from '@/types/network'
import type { BreakpointItem } from '@/types/inspector'
import { matchesBreakpoint, getMatchingEntryIds } from './useBreakpointMatching'
import { parseUrl, deepClone } from '../utils'

// ============================================================================
// Types
// ============================================================================

export interface BreakpointDraft {
  entryId: string
  trigger: 'request' | 'response'
  method: string
  scheme: string
  host: string
  path: string
  params: Array<{ key: string; value: string }>
  requestHeaders: Array<{ name: string; value: string }>
  responseHeaders: Array<{ name: string; value: string }>
  requestBody: string
  responseBody: string
}

interface PendingBreakpoint {
  entryId: string
  trigger: 'request' | 'response'
  timestamp: number
}

export interface BreakpointStateOptions {
  sendCommand: (type: string, data?: Record<string, any>) => void
  getEntry: (id: string) => NetworkEntry | undefined
}

// ============================================================================
// Composable
// ============================================================================

export function useBreakpointState(
  activeBreakpoints: () => BreakpointItem[],
  entries: () => NetworkEntry[],
  options: BreakpointStateOptions
) {
  // State
  const breakpointMode = ref(false)
  const breakpointTrigger = ref<'request' | 'response' | undefined>(undefined)
  const breakpointEntryIds = ref<Set<string>>(new Set())
  const pendingBreakpoints = ref<Map<string, PendingBreakpoint>>(new Map())
  const breakpointDrafts = ref<Map<string, BreakpointDraft>>(new Map())

  // ============================================================================
  // Computed
  // ============================================================================

  /**
   * Entry IDs that match any active breakpoint pattern (for highlighting)
   */
  const entriesMatchingBreakpoints = computed<Set<string>>(() => {
    return getMatchingEntryIds(entries(), activeBreakpoints())
  })

  /**
   * Get breakpoint draft for an entry
   */
  function getBreakpointDraft(entryId: string): BreakpointDraft | null {
    return breakpointDrafts.value.get(entryId) || null
  }

  /**
   * Check if entry has active breakpoint
   */
  function hasBreakpoint(entryId: string): boolean {
    return breakpointEntryIds.value.has(entryId)
  }

  /**
   * Check if entry matches breakpoint pattern
   */
  function matchesBreakpointPattern(entryId: string): boolean {
    return entriesMatchingBreakpoints.value.has(entryId)
  }

  // ============================================================================
  // Actions
  // ============================================================================

  /**
   * Handle breakpoint hit - create draft and enter breakpoint mode
   */
  function handleBreakpointHit(entryId: string, trigger: 'request' | 'response') {
    const entry = options.getEntry(entryId)

    // Add to pending breakpoints
    pendingBreakpoints.value.set(entryId, {
      entryId,
      trigger,
      timestamp: Date.now()
    })

    // Track this entry as having a breakpoint
    breakpointEntryIds.value.add(entryId)

    // Create breakpoint draft
    if (entry) {
      const urlParts = parseUrl(entry.url)

      breakpointDrafts.value.set(entryId, {
        entryId,
        trigger,
        method: entry.method || 'GET',
        scheme: urlParts.scheme,
        host: urlParts.host + (urlParts.port ? ':' + urlParts.port : ''),
        path: urlParts.path,
        params: deepClone(entry.params || []),
        requestHeaders: deepClone(entry.requestHeaders || []),
        responseHeaders: deepClone(entry.responseHeaders || []),
        requestBody: entry.requestBody?.text || '',
        responseBody: entry.responseBody?.text || ''
      })
    }

    // Enable breakpoint mode
    breakpointMode.value = true
    breakpointTrigger.value = trigger

    // Try to expand the app if minimized
    window.parent?.postMessage({
      __VUE_INSPECTOR__: true,
      message: {
        type: 'EXPAND_INSPECTOR',
        __VUE_INSPECTOR__: true
      }
    }, '*')
  }

  /**
   * Update breakpoint draft
   */
  function updateDraft(entryId: string, updates: Partial<BreakpointDraft>) {
    const draft = breakpointDrafts.value.get(entryId)
    if (!draft) return

    breakpointDrafts.value.set(entryId, {
      ...draft,
      ...updates
    })
  }

  /**
   * Apply breakpoint - resume with modifications
   */
  function applyBreakpoint(entryId: string) {
    const pending = pendingBreakpoints.value.get(entryId)
    const draft = breakpointDrafts.value.get(entryId)

    if (!draft || !pending) return

    // Build modifications from draft
    const modifications: Record<string, any> = {}

    if (pending.trigger === 'request') {
      if (draft.method) modifications.method = draft.method
      if (draft.scheme) modifications.scheme = draft.scheme
      if (draft.host) modifications.host = draft.host
      if (draft.path) modifications.path = draft.path
      // Always include arrays - empty arrays mean "clear all"
      if (Array.isArray(draft.requestHeaders)) modifications.requestHeaders = draft.requestHeaders
      if (Array.isArray(draft.params)) modifications.params = draft.params
      if (draft.requestBody !== undefined) modifications.requestBody = draft.requestBody
    } else if (pending.trigger === 'response') {
      // Always include arrays - empty arrays mean "clear all"
      if (Array.isArray(draft.responseHeaders)) modifications.responseHeaders = draft.responseHeaders
      if (draft.responseBody !== undefined) modifications.responseBody = draft.responseBody
    }

    // Send resume command
    const plainModifications = Object.keys(modifications).length > 0
      ? deepClone(modifications)
      : undefined

    options.sendCommand('NETWORK_BREAKPOINT_RESUME', {
      requestId: entryId,
      modifications: plainModifications
    })

    // Clean up
    cleanupBreakpoint(entryId)
  }

  /**
   * Cancel breakpoint - resume request without modifications
   */
  function cancelBreakpoint(entryId: string) {
    const pending = pendingBreakpoints.value.get(entryId)
    if (!pending) return

    // Send cancel command - resume without modifications
    options.sendCommand('NETWORK_BREAKPOINT_RESUME', {
      requestId: entryId,
      modifications: undefined
    })

    // Clean up
    cleanupBreakpoint(entryId)
  }

  /**
   * Clean up breakpoint state for an entry
   */
  function cleanupBreakpoint(entryId: string) {
    pendingBreakpoints.value.delete(entryId)
    breakpointEntryIds.value.delete(entryId)
    breakpointDrafts.value.delete(entryId)

    if (pendingBreakpoints.value.size === 0) {
      breakpointMode.value = false
      breakpointTrigger.value = undefined
    }
  }

  /**
   * Sync breakpoints to injected script
   */
  function syncBreakpoints() {
    const breakpointsToSync = activeBreakpoints().map(bp => ({
      id: bp.id,
      scheme: bp.scheme,
      host: bp.host,
      port: bp.port,
      path: bp.path,
      query: bp.query,
      trigger: bp.trigger,
      enabled: bp.enabled
    }))

    options.sendCommand('NETWORK_BREAKPOINTS_SYNC', {
      breakpoints: deepClone(breakpointsToSync)
    })
  }

  return {
    // State
    breakpointMode,
    breakpointTrigger,
    breakpointEntryIds,
    pendingBreakpoints,
    breakpointDrafts,

    // Computed
    entriesMatchingBreakpoints,

    // Actions
    handleBreakpointHit,
    getBreakpointDraft,
    updateDraft,
    applyBreakpoint,
    cancelBreakpoint,
    cleanupBreakpoint,
    hasBreakpoint,
    matchesBreakpointPattern,
    syncBreakpoints
  }
}
