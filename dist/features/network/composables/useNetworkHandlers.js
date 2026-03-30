import { ref } from 'vue';
import { findMatchingBreakpoint, findMatchingMock, matchesBreakpoint as matchesBreakpointFn, matchesMock as matchesMockFn } from './useBreakpointMatching';
export function useNetworkHandlers(deps) {
    const { settings, selectedEntryId, pendingBreakpointIds, activeBreakpoints, activeMocks, breakpointState, mockState, clearEntriesBase, clearIndex, copyCurl, activeEntryId, } = deps;
    // Form UI state
    const mockFormMode = ref(false);
    const mockFormEntry = ref(null);
    const mockFormExisting = ref(null);
    const breakpointFormMode = ref(false);
    const breakpointFormEntry = ref(null);
    const breakpointFormExisting = ref(null);
    function clearEntries() {
        clearEntriesBase();
        selectedEntryId.value = null;
        clearIndex();
    }
    function selectEntry(id) {
        if (mockFormMode.value && mockFormEntry.value?.id !== id) {
            mockFormMode.value = false;
            mockFormEntry.value = null;
            mockFormExisting.value = null;
        }
        if (breakpointFormMode.value && breakpointFormEntry.value?.id !== id) {
            breakpointFormMode.value = false;
            breakpointFormEntry.value = null;
            breakpointFormExisting.value = null;
        }
        selectedEntryId.value = id;
    }
    function deselectEntry() {
        if (pendingBreakpointIds.value.length > 0) {
            selectedEntryId.value = pendingBreakpointIds.value[0];
        }
        else {
            selectedEntryId.value = null;
        }
    }
    function selectFirstPendingBreakpoint() {
        if (pendingBreakpointIds.value.length > 0) {
            mockFormMode.value = false;
            mockFormEntry.value = null;
            mockFormExisting.value = null;
            breakpointFormMode.value = false;
            breakpointFormEntry.value = null;
            breakpointFormExisting.value = null;
            selectedEntryId.value = pendingBreakpointIds.value[0];
        }
    }
    // Breakpoint form
    function handleSetBreakpoint(entry) {
        selectedEntryId.value = entry.id;
        breakpointFormEntry.value = entry;
        const matchingBp = findMatchingBreakpoint(entry, activeBreakpoints.value);
        breakpointFormExisting.value = matchingBp;
        breakpointFormMode.value = true;
    }
    function handleBreakpointFormBack() {
        breakpointFormMode.value = false;
        breakpointFormEntry.value = null;
        breakpointFormExisting.value = null;
    }
    function handleBreakpointConfirm(breakpoint) {
        if (!settings.value?.breakpoints)
            return;
        const existingIndex = settings.value.breakpoints.active.findIndex(bp => bp.id === breakpoint.id);
        if (existingIndex !== -1) {
            settings.value.breakpoints.active[existingIndex] = breakpoint;
        }
        else {
            settings.value.breakpoints.active.push(breakpoint);
        }
        breakpointState.syncBreakpoints();
        breakpointFormMode.value = false;
        breakpointFormEntry.value = null;
        breakpointFormExisting.value = null;
    }
    // Mock form
    function handleMockResponse(entry) {
        selectedEntryId.value = entry.id;
        mockFormEntry.value = entry;
        const matchingMock = findMatchingMock(entry, activeMocks.value);
        mockFormExisting.value = matchingMock;
        mockFormMode.value = true;
    }
    function handleMockFormBack() {
        mockFormMode.value = false;
        mockFormEntry.value = null;
        mockFormExisting.value = null;
    }
    function handleMockConfirm(mock) {
        if (!settings.value)
            return;
        if (!settings.value.mocks) {
            settings.value.mocks = { active: [], inactive: [] };
        }
        const existingIndex = settings.value.mocks.active.findIndex(m => m.id === mock.id);
        if (existingIndex !== -1) {
            settings.value.mocks.active[existingIndex] = mock;
        }
        else {
            settings.value.mocks.active.push(mock);
        }
        mockState.syncMocks();
        mockFormMode.value = false;
        mockFormEntry.value = null;
        mockFormExisting.value = null;
    }
    function handleCopyCurl(entry) {
        copyCurl(entry);
    }
    // Toggle/delete breakpoint
    function handleToggleBreakpoint(entry) {
        if (!settings.value?.breakpoints)
            return;
        const bps = settings.value.breakpoints;
        const activeIdx = bps.active.findIndex(bp => matchesBreakpointFn(entry, { ...bp, enabled: true }));
        if (activeIdx !== -1) {
            const [bp] = bps.active.splice(activeIdx, 1);
            bps.inactive.push(bp);
            breakpointState.syncBreakpoints();
            return;
        }
        const inactiveIdx = bps.inactive.findIndex(bp => matchesBreakpointFn(entry, { ...bp, enabled: true }));
        if (inactiveIdx !== -1) {
            const [bp] = bps.inactive.splice(inactiveIdx, 1);
            bps.active.push(bp);
            breakpointState.syncBreakpoints();
        }
    }
    function handleDeleteBreakpoint(entry) {
        if (!settings.value?.breakpoints)
            return;
        const bps = settings.value.breakpoints;
        bps.active = bps.active.filter(bp => !matchesBreakpointFn(entry, { ...bp, enabled: true }));
        bps.inactive = bps.inactive.filter(bp => !matchesBreakpointFn(entry, { ...bp, enabled: true }));
        breakpointState.syncBreakpoints();
    }
    // Toggle/delete mock
    function handleToggleMock(entry) {
        if (!settings.value?.mocks)
            return;
        const mocks = settings.value.mocks;
        const activeIdx = mocks.active.findIndex(m => matchesMockFn(entry, { ...m, enabled: true }));
        if (activeIdx !== -1) {
            const [mock] = mocks.active.splice(activeIdx, 1);
            mocks.inactive.push(mock);
            mockState.syncMocks();
            return;
        }
        const inactiveIdx = mocks.inactive.findIndex(m => matchesMockFn(entry, { ...m, enabled: true }));
        if (inactiveIdx !== -1) {
            const [mock] = mocks.inactive.splice(inactiveIdx, 1);
            mocks.active.push(mock);
            mockState.syncMocks();
        }
    }
    function handleDeleteMock(entry) {
        if (!settings.value?.mocks)
            return;
        const mocks = settings.value.mocks;
        mocks.active = mocks.active.filter(m => !matchesMockFn(entry, { ...m, enabled: true }));
        mocks.inactive = mocks.inactive.filter(m => !matchesMockFn(entry, { ...m, enabled: true }));
        mockState.syncMocks();
    }
    // Breakpoint apply/cancel
    function switchToNextBreakpointOrDeselect(resolvedEntryId) {
        const remaining = pendingBreakpointIds.value.filter(id => id !== resolvedEntryId);
        if (remaining.length > 0) {
            selectedEntryId.value = remaining[0];
        }
        else {
            selectedEntryId.value = null;
        }
    }
    function handleApplyBreakpoint(data) {
        breakpointState.applyBreakpoint(data.entryId);
        switchToNextBreakpointOrDeselect(data.entryId);
    }
    function handleCancelBreakpoint(entryId) {
        breakpointState.cancelBreakpoint(entryId);
        switchToNextBreakpointOrDeselect(entryId);
    }
    function handleDraftUpdate(updates) {
        if (!activeEntryId.value)
            return;
        breakpointState.updateDraft(activeEntryId.value, updates);
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
    };
}
//# sourceMappingURL=useNetworkHandlers.js.map