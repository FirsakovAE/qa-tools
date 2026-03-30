/**
 * Breakpoint State Composable
 * Manages breakpoint mode, pending breakpoints, and drafts
 *
 * NOTE: State is stored at module level to persist across tab switches
 * (when NetworkTab is unmounted and remounted)
 */
import { ref, computed } from 'vue';
import { postToContentScript } from '@/utils/postToContentScript';
import { getMediaBlob, getWallpaperBlob } from '@/settings/mediaStore';
import { getMatchingEntryIds } from './useBreakpointMatching';
import { parseUrl, deepClone } from '../utils';
import { looksLikeFormDataDraftJson } from '@/utils/jsonGuards';
const FILE_ID_PREFIX = '__fileId:';
function blobToDataUri(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}
async function resolveFileIdsInRequestBody(body) {
    if (!body.trim() || !looksLikeFormDataDraftJson(body))
        return body;
    try {
        const parsed = JSON.parse(body);
        if (!parsed?.__formData || !Array.isArray(parsed.entries))
            return body;
        let changed = false;
        for (const entry of parsed.entries) {
            if (entry.type === 'file' && typeof entry.value === 'string' && entry.value.startsWith(FILE_ID_PREFIX)) {
                const fileId = entry.value.slice(FILE_ID_PREFIX.length);
                let blob = await getMediaBlob(fileId);
                if (!blob && fileId.startsWith('wallpaper_')) {
                    blob = await getWallpaperBlob(fileId);
                }
                if (blob) {
                    entry.value = await blobToDataUri(blob);
                    changed = true;
                }
            }
        }
        return changed ? JSON.stringify(parsed) : body;
    }
    catch {
        return body;
    }
}
// ============================================================================
// Module-level State (persists across component mounts)
// ============================================================================
const breakpointMode = ref(false);
const breakpointTrigger = ref(undefined);
const breakpointEntryIds = ref(new Set());
const pendingBreakpoints = ref(new Map());
const breakpointDrafts = ref(new Map());
// ============================================================================
// Composable
// ============================================================================
export function useBreakpointState(activeBreakpoints, entries, options) {
    // State is now module-level, no need to create new refs
    // ============================================================================
    // Computed
    // ============================================================================
    /**
     * Entry IDs that match any active breakpoint pattern (for highlighting)
     */
    const entriesMatchingBreakpoints = computed(() => {
        return getMatchingEntryIds(entries(), activeBreakpoints());
    });
    /**
     * Get breakpoint draft for an entry
     */
    function getBreakpointDraft(entryId) {
        return breakpointDrafts.value.get(entryId) || null;
    }
    /**
     * Check if entry has active breakpoint
     */
    function hasBreakpoint(entryId) {
        return breakpointEntryIds.value.has(entryId);
    }
    /**
     * Check if entry matches breakpoint pattern
     */
    function matchesBreakpointPattern(entryId) {
        return entriesMatchingBreakpoints.value.has(entryId);
    }
    // ============================================================================
    // Actions
    // ============================================================================
    /**
     * Handle breakpoint hit - create draft and enter breakpoint mode
     */
    function handleBreakpointHit(entryId, trigger) {
        const entry = options.getEntry(entryId);
        // Add to pending breakpoints
        pendingBreakpoints.value.set(entryId, {
            entryId,
            trigger,
            timestamp: Date.now()
        });
        // Track this entry as having a breakpoint
        breakpointEntryIds.value.add(entryId);
        // Create breakpoint draft
        if (entry) {
            const urlParts = parseUrl(entry.url);
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
            });
        }
        // Enable breakpoint mode
        breakpointMode.value = true;
        breakpointTrigger.value = trigger;
        // Try to expand the app if minimized (no-op in DevTools mode)
        postToContentScript({
            type: 'EXPAND_INSPECTOR',
            __VUE_INSPECTOR__: true
        });
    }
    /**
     * Update breakpoint draft
     */
    function updateDraft(entryId, updates) {
        const draft = breakpointDrafts.value.get(entryId);
        if (!draft)
            return;
        breakpointDrafts.value.set(entryId, {
            ...draft,
            ...updates
        });
    }
    /**
     * Apply breakpoint - resume with modifications
     */
    async function applyBreakpoint(entryId) {
        const pending = pendingBreakpoints.value.get(entryId);
        const draft = breakpointDrafts.value.get(entryId);
        if (!draft || !pending)
            return;
        // Build modifications from draft
        const modifications = {};
        if (pending.trigger === 'request') {
            if (draft.method)
                modifications.method = draft.method;
            if (draft.scheme)
                modifications.scheme = draft.scheme;
            if (draft.host)
                modifications.host = draft.host;
            if (draft.path)
                modifications.path = draft.path;
            // Always include arrays - empty arrays mean "clear all"
            if (Array.isArray(draft.requestHeaders))
                modifications.requestHeaders = draft.requestHeaders;
            if (Array.isArray(draft.params))
                modifications.params = draft.params;
            if (draft.requestBody !== undefined) {
                modifications.requestBody = await resolveFileIdsInRequestBody(draft.requestBody);
            }
        }
        else if (pending.trigger === 'response') {
            // Always include arrays - empty arrays mean "clear all"
            if (Array.isArray(draft.responseHeaders))
                modifications.responseHeaders = draft.responseHeaders;
            if (draft.responseBody !== undefined)
                modifications.responseBody = draft.responseBody;
        }
        // Send resume command
        const plainModifications = Object.keys(modifications).length > 0
            ? deepClone(modifications)
            : undefined;
        options.sendCommand('NETWORK_BREAKPOINT_RESUME', {
            requestId: entryId,
            modifications: plainModifications
        });
        // Clean up
        cleanupBreakpoint(entryId);
    }
    /**
     * Cancel breakpoint - resume request without modifications
     */
    function cancelBreakpoint(entryId) {
        const pending = pendingBreakpoints.value.get(entryId);
        if (!pending)
            return;
        // Send cancel command - resume without modifications
        options.sendCommand('NETWORK_BREAKPOINT_RESUME', {
            requestId: entryId,
            modifications: undefined
        });
        // Clean up
        cleanupBreakpoint(entryId);
    }
    /**
     * Clean up breakpoint state for an entry
     */
    function cleanupBreakpoint(entryId) {
        pendingBreakpoints.value.delete(entryId);
        breakpointEntryIds.value.delete(entryId);
        breakpointDrafts.value.delete(entryId);
        if (pendingBreakpoints.value.size === 0) {
            breakpointMode.value = false;
            breakpointTrigger.value = undefined;
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
            method: bp.method,
            trigger: bp.trigger,
            enabled: bp.enabled
        }));
        options.sendCommand('NETWORK_BREAKPOINTS_SYNC', {
            breakpoints: deepClone(breakpointsToSync)
        });
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
    };
}
//# sourceMappingURL=useBreakpointState.js.map