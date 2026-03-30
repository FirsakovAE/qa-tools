/**
 * Optimized row model for PropsTable
 *
 * Key principles:
 * - `rows` array NEVER changes (stable reference)
 * - Only `visible` and `isFavorite` flags are mutated
 * - Zero array recreation on filter change
 */
// ============================================================================
// Deep Search Utilities (CPU-optimized)
// ============================================================================
const MAX_SEARCH_DEPTH = 20; // Prevent infinite recursion on circular refs
/**
 * Deep search for a key in nested object
 * Returns true immediately when match is found (early exit)
 */
export function deepSearchKey(obj, query, exactMatch = false, depth = 0) {
    if (depth > MAX_SEARCH_DEPTH || obj === null || obj === undefined) {
        return false;
    }
    if (typeof obj !== 'object') {
        return false;
    }
    // Handle arrays - search each element
    if (Array.isArray(obj)) {
        for (const item of obj) {
            if (deepSearchKey(item, query, exactMatch, depth + 1)) {
                return true;
            }
        }
        return false;
    }
    // Handle objects - check keys and recurse into values
    const matchKey = exactMatch
        ? (k) => k.toLowerCase() === query
        : (k) => k.toLowerCase().includes(query);
    for (const key of Object.keys(obj)) {
        if (matchKey(key)) {
            return true;
        }
        if (deepSearchKey(obj[key], query, exactMatch, depth + 1)) {
            return true;
        }
    }
    return false;
}
/**
 * Deep search for a value in nested object
 * Returns true immediately when match is found (early exit)
 */
export function deepSearchValue(obj, query, exactMatch = false, depth = 0) {
    if (depth > MAX_SEARCH_DEPTH) {
        return false;
    }
    if (obj === null || obj === undefined) {
        return false;
    }
    // Primitive types - check string representation
    if (typeof obj !== 'object') {
        const str = String(obj).toLowerCase();
        return exactMatch ? str === query : str.includes(query);
    }
    // Handle arrays - search each element
    if (Array.isArray(obj)) {
        for (const item of obj) {
            if (deepSearchValue(item, query, exactMatch, depth + 1)) {
                return true;
            }
        }
        return false;
    }
    // Handle objects - recurse into values
    for (const key of Object.keys(obj)) {
        if (deepSearchValue(obj[key], query, exactMatch, depth + 1)) {
            return true;
        }
    }
    return false;
}
/**
 * Create PropsRow from TreeNodeModel
 */
export function createPropsRow(node, isFavorite) {
    const elementInfo = getElementInfo(node);
    const hasPropsFromData = !!(node.props && Object.keys(node.props).length > 0);
    const hasPropsFromMeta = !!(node.hasProps && (node.propsCount ?? 0) > 0);
    return {
        ...node,
        hasPropsFlag: hasPropsFromData || hasPropsFromMeta,
        hasDomElement: !!(node.rootElement?.tagName || node.element),
        visible: true,
        isFavoriteFlag: isFavorite,
        elementInfo,
        uid: extractUid(node)
    };
}
function buildElementSelector(tag, elId, cls, testId) {
    let sel = tag.toLowerCase();
    if (elId)
        sel += '#' + elId;
    if (cls)
        sel += '.' + cls.trim().replace(/\s+/g, '.');
    if (testId)
        sel += `[${testId}]`;
    return sel;
}
export function getElementInfo(node) {
    if (node.element) {
        if (node.element instanceof HTMLElement) {
            return buildElementSelector(node.element.tagName, node.element.id || undefined, node.element.className || undefined, node.element.getAttribute?.('data-testid') || undefined);
        }
        else if (node.element.tagName) {
            return buildElementSelector(node.element.tagName, node.element.id, node.element.className, node.element.testId);
        }
    }
    if (node.rootElement?.tagName) {
        return buildElementSelector(node.rootElement.tagName, node.rootElement.id, node.rootElement.className, node.rootElement.testId);
    }
    return 'Logic only';
}
function extractUid(node) {
    // node.id holds the original runtime path (e.g. "uid:496"),
    // node.componentUid is the stable display identifier — not suitable for UID extraction
    const path = node.id;
    if (!path)
        return null;
    if (typeof path === 'string' && path.startsWith('uid:')) {
        const uid = parseInt(path.substring(4), 10);
        return isNaN(uid) ? null : uid;
    }
    return null;
}
/**
 * Update visibility for all rows based on filters
 * This is O(n) simple assignments - zero array recreation
 * @param matchedUids - When provided with searchByKey/searchByValue, used for filtering (from PROPS_SEARCH API)
 */
export function updateRowsVisibility(rows, options) {
    const { searchTerm, searchByName, searchByRootElement, searchByKey, searchByValue, exactMatch = false, matchedUids } = options;
    const q = searchTerm.toLowerCase().trim();
    const hasSearch = q.length > 0;
    const useKeyValueApi = (searchByKey || searchByValue) && matchedUids !== undefined;
    const matchStr = exactMatch
        ? (s) => s === q
        : (s) => s.includes(q);
    for (const row of rows) {
        if (hasSearch) {
            let matches = false;
            if (searchByName && row.name && matchStr(row.name.toLowerCase())) {
                matches = true;
            }
            if (!matches && searchByRootElement && matchStr(row.elementInfo.toLowerCase())) {
                matches = true;
            }
            if (!matches && (searchByKey || searchByValue)) {
                if (useKeyValueApi) {
                    matches = row.uid !== null && matchedUids.has(row.uid);
                }
                else if (row.props) {
                    if (searchByKey && deepSearchKey(row.props, q, exactMatch))
                        matches = true;
                    if (!matches && searchByValue && deepSearchValue(row.props, q, exactMatch))
                        matches = true;
                }
            }
            row.visible = matches;
            continue;
        }
        row.visible = true;
    }
}
/**
 * Sort rows by favorite status (in-place, stable sort)
 */
export function sortRowsByFavorite(rows) {
    rows.sort((a, b) => {
        if (a.isFavoriteFlag && !b.isFavoriteFlag)
            return -1;
        if (!a.isFavoriteFlag && b.isFavoriteFlag)
            return 1;
        return 0;
    });
}
//# sourceMappingURL=types.js.map