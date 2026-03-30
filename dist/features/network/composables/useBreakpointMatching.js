/**
 * Breakpoint Matching Composable
 * Shared URL matching logic for breakpoints and mocks
 */
/**
 * Match a URL against a pattern with wildcard support
 */
export function matchUrlPattern(url, pattern, mode = 'prefix') {
    if (!pattern)
        return true;
    const regexPattern = pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');
    const regex = mode === 'exact'
        ? new RegExp(`^${regexPattern}$`, 'i')
        : mode === 'prefix'
            ? new RegExp(`^${regexPattern}`, 'i')
            : new RegExp(regexPattern, 'i');
    return regex.test(url);
}
/**
 * Match a NetworkEntry against a BreakpointItem
 */
export function matchesBreakpoint(entry, bp) {
    if (!bp.enabled)
        return false;
    try {
        const urlObj = new URL(entry.url);
        // Check scheme
        if (bp.scheme) {
            const urlScheme = urlObj.protocol.replace(':', '');
            if (urlScheme.toLowerCase() !== bp.scheme.toLowerCase()) {
                return false;
            }
        }
        // Check host (supports wildcard *)
        if (bp.host && !matchUrlPattern(urlObj.hostname, bp.host, 'exact')) {
            return false;
        }
        // Check port
        if (bp.port) {
            const urlPort = urlObj.port || (urlObj.protocol === 'https:' ? '443' : '80');
            if (urlPort !== bp.port) {
                return false;
            }
        }
        // Check path (startsWith, supports wildcard *)
        if (bp.path && !matchUrlPattern(urlObj.pathname, bp.path, 'prefix')) {
            return false;
        }
        // Check query (partial match)
        if (bp.query) {
            const searchWithoutPrefix = urlObj.search ? urlObj.search.substring(1) : '';
            if (!searchWithoutPrefix)
                return false;
            if (!matchUrlPattern(searchWithoutPrefix, bp.query, 'contains')) {
                return false;
            }
        }
        // Check method (optional - if set, must match)
        if (bp.method && entry.method.toUpperCase() !== bp.method.toUpperCase()) {
            return false;
        }
        return true;
    }
    catch (error) {
        console.error('[network/useBreakpointMatching] matchesBreakpoint failed:', entry.url, error);
        return false;
    }
}
/**
 * Find the first matching breakpoint for an entry
 */
export function findMatchingBreakpoint(entry, breakpoints) {
    for (const bp of breakpoints) {
        if (matchesBreakpoint(entry, bp)) {
            return bp;
        }
    }
    return null;
}
/**
 * Get set of entry IDs that match any active breakpoint
 */
export function getMatchingEntryIds(entries, breakpoints) {
    const matchingIds = new Set();
    for (const entry of entries) {
        if (findMatchingBreakpoint(entry, breakpoints)) {
            matchingIds.add(entry.id);
        }
    }
    return matchingIds;
}
// ============================================================================
// Mock Matching
// ============================================================================
/**
 * Match a NetworkEntry against a MockRule
 */
export function matchesMock(entry, mock) {
    if (!mock.enabled)
        return false;
    try {
        const urlObj = new URL(entry.url);
        // Check scheme
        if (mock.scheme) {
            const urlScheme = urlObj.protocol.replace(':', '');
            if (urlScheme.toLowerCase() !== mock.scheme.toLowerCase()) {
                return false;
            }
        }
        // Check host (supports wildcard *)
        if (mock.host && !matchUrlPattern(urlObj.hostname, mock.host, 'exact')) {
            return false;
        }
        // Check port
        if (mock.port) {
            const urlPort = urlObj.port || (urlObj.protocol === 'https:' ? '443' : '80');
            if (urlPort !== mock.port) {
                return false;
            }
        }
        // Check path (startsWith, supports wildcard *)
        if (mock.path && !matchUrlPattern(urlObj.pathname, mock.path, 'prefix')) {
            return false;
        }
        // Check query (partial match)
        if (mock.query) {
            const searchWithoutPrefix = urlObj.search ? urlObj.search.substring(1) : '';
            if (!searchWithoutPrefix)
                return false;
            if (!matchUrlPattern(searchWithoutPrefix, mock.query, 'contains')) {
                return false;
            }
        }
        // Check method (optional - if set, must match)
        if (mock.method && entry.method.toUpperCase() !== mock.method.toUpperCase()) {
            return false;
        }
        return true;
    }
    catch (error) {
        console.error('[network/useBreakpointMatching] matchesMock failed:', entry.url, error);
        return false;
    }
}
/**
 * Find the first matching mock for an entry
 */
export function findMatchingMock(entry, mocks) {
    for (const mock of mocks) {
        if (matchesMock(entry, mock)) {
            return mock;
        }
    }
    return null;
}
/**
 * Get set of entry IDs that match any active mock
 */
export function getMockMatchingEntryIds(entries, mocks) {
    const matchingIds = new Set();
    for (const entry of entries) {
        if (findMatchingMock(entry, mocks)) {
            matchingIds.add(entry.id);
        }
    }
    return matchingIds;
}
//# sourceMappingURL=useBreakpointMatching.js.map