/**
 * Network Feature Composables
 * 
 * Responsibilities:
 * - useNetworkEntries: Network entries state and IPC communication
 * - useNetworkSearch: Search functionality with indexed lookups
 * - useBreakpointState: Breakpoint mode, drafts, and sync
 * - useMockState: Mock (Map Local) sync to injected script
 * - useBreakpointMatching: URL pattern matching utilities
 */

export { useNetworkEntries, type NetworkEntriesOptions } from './useNetworkEntries'
export { useNetworkSearch, type SearchSettings } from './useNetworkSearch'
export { 
  useBreakpointState, 
  type BreakpointDraft, 
  type BreakpointStateOptions 
} from './useBreakpointState'
export { useMockState, type MockStateOptions } from './useMockState'
export { 
  matchesBreakpoint, 
  findMatchingBreakpoint, 
  getMatchingEntryIds,
  matchUrlPattern 
} from './useBreakpointMatching'
