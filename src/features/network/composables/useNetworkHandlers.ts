import { ref, computed, type Ref, type ComputedRef } from 'vue'
import type { NetworkEntry } from '@/types/network'
import type { BaseInspectorSettings, BreakpointItem, MockRule } from '@/types/inspector'
import type { BreakpointEditData } from './useBreakpointEditor'
import {
  findMatchingBreakpoint,
  findMatchingMock,
  matchesBreakpoint as matchesBreakpointFn,
  matchesMock as matchesMockFn
} from './useBreakpointMatching'

interface UseNetworkHandlersDeps {
  settings: Ref<BaseInspectorSettings | null>
  selectedEntryId: Ref<string | null>
  pendingBreakpointIds: ComputedRef<string[]>
  activeBreakpoints: ComputedRef<BreakpointItem[]>
  activeMocks: ComputedRef<MockRule[]>
  breakpointState: {
    applyBreakpoint: (entryId: string) => void
    cancelBreakpoint: (entryId: string) => void
    syncBreakpoints: () => void
    updateDraft: (entryId: string, updates: Record<string, unknown>) => void
  }
  mockState: {
    syncMocks: () => void
  }
  clearEntriesBase: () => void
  clearIndex: () => void
  copyCurl: (entry: NetworkEntry) => void
  activeEntryId: ComputedRef<string | null>
}

export function useNetworkHandlers(deps: UseNetworkHandlersDeps) {
  const {
    settings,
    selectedEntryId,
    pendingBreakpointIds,
    activeBreakpoints,
    activeMocks,
    breakpointState,
    mockState,
    clearEntriesBase,
    clearIndex,
    copyCurl,
    activeEntryId,
  } = deps

  // Form UI state
  const mockFormMode = ref(false)
  const mockFormEntry = ref<NetworkEntry | null>(null)
  const mockFormExisting = ref<MockRule | null>(null)
  const breakpointFormMode = ref(false)
  const breakpointFormEntry = ref<NetworkEntry | null>(null)
  const breakpointFormExisting = ref<BreakpointItem | null>(null)

  function clearEntries() {
    clearEntriesBase()
    selectedEntryId.value = null
    clearIndex()
  }

  function selectEntry(id: string) {
    if (mockFormMode.value && mockFormEntry.value?.id !== id) {
      mockFormMode.value = false
      mockFormEntry.value = null
      mockFormExisting.value = null
    }
    if (breakpointFormMode.value && breakpointFormEntry.value?.id !== id) {
      breakpointFormMode.value = false
      breakpointFormEntry.value = null
      breakpointFormExisting.value = null
    }
    selectedEntryId.value = id
  }

  function deselectEntry() {
    if (pendingBreakpointIds.value.length > 0) {
      selectedEntryId.value = pendingBreakpointIds.value[0]
    } else {
      selectedEntryId.value = null
    }
  }

  function selectFirstPendingBreakpoint() {
    if (pendingBreakpointIds.value.length > 0) {
      mockFormMode.value = false
      mockFormEntry.value = null
      mockFormExisting.value = null
      breakpointFormMode.value = false
      breakpointFormEntry.value = null
      breakpointFormExisting.value = null
      selectedEntryId.value = pendingBreakpointIds.value[0]
    }
  }

  // Breakpoint form
  function handleSetBreakpoint(entry: NetworkEntry) {
    selectedEntryId.value = entry.id
    breakpointFormEntry.value = entry
    const matchingBp = findMatchingBreakpoint(entry, activeBreakpoints.value)
    breakpointFormExisting.value = matchingBp
    breakpointFormMode.value = true
  }

  function handleBreakpointFormBack() {
    breakpointFormMode.value = false
    breakpointFormEntry.value = null
    breakpointFormExisting.value = null
  }

  function handleBreakpointConfirm(breakpoint: BreakpointItem) {
    if (!settings.value?.breakpoints) return
    const existingIndex = settings.value.breakpoints.active.findIndex(bp => bp.id === breakpoint.id)
    if (existingIndex !== -1) {
      settings.value.breakpoints.active[existingIndex] = breakpoint
    } else {
      settings.value.breakpoints.active.push(breakpoint)
    }
    breakpointState.syncBreakpoints()
    breakpointFormMode.value = false
    breakpointFormEntry.value = null
    breakpointFormExisting.value = null
  }

  // Mock form
  function handleMockResponse(entry: NetworkEntry) {
    selectedEntryId.value = entry.id
    mockFormEntry.value = entry
    const matchingMock = findMatchingMock(entry, activeMocks.value)
    mockFormExisting.value = matchingMock
    mockFormMode.value = true
  }

  function handleMockFormBack() {
    mockFormMode.value = false
    mockFormEntry.value = null
    mockFormExisting.value = null
  }

  function handleMockConfirm(mock: MockRule) {
    if (!settings.value) return
    if (!settings.value.mocks) {
      settings.value.mocks = { active: [], inactive: [] }
    }
    const existingIndex = settings.value.mocks.active.findIndex(m => m.id === mock.id)
    if (existingIndex !== -1) {
      settings.value.mocks.active[existingIndex] = mock
    } else {
      settings.value.mocks.active.push(mock)
    }
    mockState.syncMocks()
    mockFormMode.value = false
    mockFormEntry.value = null
    mockFormExisting.value = null
  }

  function handleCopyCurl(entry: NetworkEntry) {
    copyCurl(entry)
  }

  // Toggle/delete breakpoint
  function handleToggleBreakpoint(entry: NetworkEntry) {
    if (!settings.value?.breakpoints) return
    const bps = settings.value.breakpoints
    const activeIdx = bps.active.findIndex(bp => matchesBreakpointFn(entry, { ...bp, enabled: true }))
    if (activeIdx !== -1) {
      const [bp] = bps.active.splice(activeIdx, 1)
      bps.inactive.push(bp)
      breakpointState.syncBreakpoints()
      return
    }
    const inactiveIdx = bps.inactive.findIndex(bp => matchesBreakpointFn(entry, { ...bp, enabled: true }))
    if (inactiveIdx !== -1) {
      const [bp] = bps.inactive.splice(inactiveIdx, 1)
      bps.active.push(bp)
      breakpointState.syncBreakpoints()
    }
  }

  function handleDeleteBreakpoint(entry: NetworkEntry) {
    if (!settings.value?.breakpoints) return
    const bps = settings.value.breakpoints
    bps.active = bps.active.filter(bp => !matchesBreakpointFn(entry, { ...bp, enabled: true }))
    bps.inactive = bps.inactive.filter(bp => !matchesBreakpointFn(entry, { ...bp, enabled: true }))
    breakpointState.syncBreakpoints()
  }

  // Toggle/delete mock
  function handleToggleMock(entry: NetworkEntry) {
    if (!settings.value?.mocks) return
    const mocks = settings.value.mocks
    const activeIdx = mocks.active.findIndex(m => matchesMockFn(entry, { ...m, enabled: true }))
    if (activeIdx !== -1) {
      const [mock] = mocks.active.splice(activeIdx, 1)
      mocks.inactive.push(mock)
      mockState.syncMocks()
      return
    }
    const inactiveIdx = mocks.inactive.findIndex(m => matchesMockFn(entry, { ...m, enabled: true }))
    if (inactiveIdx !== -1) {
      const [mock] = mocks.inactive.splice(inactiveIdx, 1)
      mocks.active.push(mock)
      mockState.syncMocks()
    }
  }

  function handleDeleteMock(entry: NetworkEntry) {
    if (!settings.value?.mocks) return
    const mocks = settings.value.mocks
    mocks.active = mocks.active.filter(m => !matchesMockFn(entry, { ...m, enabled: true }))
    mocks.inactive = mocks.inactive.filter(m => !matchesMockFn(entry, { ...m, enabled: true }))
    mockState.syncMocks()
  }

  // Breakpoint apply/cancel
  function switchToNextBreakpointOrDeselect(resolvedEntryId: string) {
    const remaining = pendingBreakpointIds.value.filter(id => id !== resolvedEntryId)
    if (remaining.length > 0) {
      selectedEntryId.value = remaining[0]
    } else {
      selectedEntryId.value = null
    }
  }

  function handleApplyBreakpoint(data: BreakpointEditData) {
    breakpointState.applyBreakpoint(data.entryId)
    switchToNextBreakpointOrDeselect(data.entryId)
  }

  function handleCancelBreakpoint(entryId: string) {
    breakpointState.cancelBreakpoint(entryId)
    switchToNextBreakpointOrDeselect(entryId)
  }

  function handleDraftUpdate(updates: Record<string, unknown>) {
    if (!activeEntryId.value) return
    breakpointState.updateDraft(activeEntryId.value, updates)
  }

  return {
    // Form UI state
    mockFormMode,
    mockFormEntry,
    mockFormExisting,
    breakpointFormMode,
    breakpointFormEntry,
    breakpointFormExisting,
    // Methods
    clearEntries,
    selectEntry,
    deselectEntry,
    selectFirstPendingBreakpoint,
    handleSetBreakpoint,
    handleBreakpointFormBack,
    handleBreakpointConfirm,
    handleMockResponse,
    handleMockFormBack,
    handleMockConfirm,
    handleCopyCurl,
    handleToggleBreakpoint,
    handleDeleteBreakpoint,
    handleToggleMock,
    handleDeleteMock,
    handleApplyBreakpoint,
    handleCancelBreakpoint,
    handleDraftUpdate,
  }
}
