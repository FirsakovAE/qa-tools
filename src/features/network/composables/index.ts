/**
 * Network Feature Composables
 * 
 * Responsibilities:
 * - useNetworkEntries: Network entries state and IPC communication
 * - useNetworkSearch: Search functionality with indexed lookups
 * - useBreakpointState: Breakpoint mode, drafts, and sync
 * - useMockState: Mock (Map Local) sync to injected script
 * - useBreakpointMatching: URL pattern matching utilities
 * - useBreakpointEditor: Editable state for breakpoint detail panel
 * - useFormDataEditor: Form-data editing in breakpoint mode
 * - useNetworkHandlers: Handlers for network tab actions
 * - useMockFormState: Mock form state and logic
 */

export { useNetworkEntries, type NetworkEntriesOptions } from './useNetworkEntries'
export { useNetworkSearch, type SearchSettings } from './useNetworkSearch'
export { 
  useBreakpointState, 
  type BreakpointDraft, 
  type BreakpointStateOptions 
} from './useBreakpointState'
export { useMockState, type MockStateOptions } from './useMockState'
export { useNetworkUIState } from './useNetworkUIState'
export { 
  matchesBreakpoint, 
  findMatchingBreakpoint, 
  getMatchingEntryIds,
  matchUrlPattern,
  matchesMock,
  findMatchingMock,
  getMockMatchingEntryIds
} from './useBreakpointMatching'
export { useBreakpointEditor, type BreakpointEditData, type BreakpointDraftShape } from './useBreakpointEditor'
export { useFormDataEditor } from './useFormDataEditor'
export { useNetworkHandlers } from './useNetworkHandlers'
export { useMockFormState, HTTP_STATUS_TEXT } from './useMockFormState'
