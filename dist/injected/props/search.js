// src/injected/props/search.ts
/**
 * 📐 Search Module - Fast search (no props) and lazy search (with props)
 *
 * Fast search (without props):
 * - Component name
 * - Component label
 *
 * Lazy search (with props) - LIMITED SCOPE:
 * - Default: expanded + logged components only
 * - Deep search: explicit toggle required (like Vue DevTools)
 */
import { getMetaStore } from './meta-store';
import { getLoggedComponents, extractRawProps } from './props-reader';
const DEFAULT_OPTIONS = {
    type: 'all',
    caseSensitive: false,
    limit: 100,
    scope: 'expandedAndLogged', // Safe default - only expanded and logged
    exactMatch: false
};
// ============================================================================
// Scope Helpers
// ============================================================================
/**
 * Get components within the specified search scope
 * CRITICAL: This limits which components have their props read
 */
function getComponentsInScope(scope) {
    const store = getMetaStore();
    switch (scope) {
        case 'expanded':
            return store.getExpandedComponents();
        case 'logged': {
            const loggedUids = new Set(getLoggedComponents());
            return store.getAllComponents().filter(m => loggedUids.has(m.uid));
        }
        case 'expandedAndLogged': {
            const loggedUids = new Set(getLoggedComponents());
            return store.getAllComponents().filter(m => m.isExpanded || loggedUids.has(m.uid));
        }
        case 'visible':
            return store.getAllComponents().filter(m => m.isVisible);
        case 'explicitDeep':
            // DANGEROUS: Returns all components
            // Should only be used with explicit user confirmation
            return store.getAllComponents();
        default:
            return store.getExpandedComponents();
    }
}
/**
 * Check if a component is in scope for props reading
 */
function isInScope(meta, scope) {
    switch (scope) {
        case 'expanded':
            return meta.isExpanded;
        case 'logged':
            return getLoggedComponents().includes(meta.uid);
        case 'expandedAndLogged':
            return meta.isExpanded || getLoggedComponents().includes(meta.uid);
        case 'visible':
            return meta.isVisible;
        case 'explicitDeep':
            return true;
        default:
            return meta.isExpanded;
    }
}
// ============================================================================
// Fast Search (No Props) - ALWAYS SAFE
// ============================================================================
/**
 * Fast search by component name (no props loading)
 */
export function searchByName(query, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options, type: 'name' };
    const store = getMetaStore();
    const results = [];
    const queryNorm = opts.caseSensitive ? query : query.toLowerCase();
    const matchName = opts.exactMatch
        ? (n) => n === queryNorm
        : (n) => n.includes(queryNorm);
    for (const meta of store.getAllComponents()) {
        if (results.length >= opts.limit)
            break;
        const name = meta.name ?? 'Anonymous';
        const nameNorm = opts.caseSensitive ? name : name.toLowerCase();
        if (matchName(nameNorm)) {
            results.push({
                uid: meta.uid,
                name,
                label: meta.label,
                matchType: 'name',
                matchedText: name,
                hasProps: !!meta.propsSnapshot
            });
        }
    }
    return results;
}
/**
 * Fast search by component label (no props loading)
 */
export function searchByLabel(query, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options, type: 'label' };
    const store = getMetaStore();
    const results = [];
    const queryNorm = opts.caseSensitive ? query : query.toLowerCase();
    const matchStr = opts.exactMatch
        ? (s) => s === queryNorm
        : (s) => s.includes(queryNorm);
    for (const meta of store.getAllComponents()) {
        if (results.length >= opts.limit)
            break;
        if (!meta.label)
            continue;
        const labelNorm = opts.caseSensitive ? meta.label : meta.label.toLowerCase();
        if (matchStr(labelNorm)) {
            results.push({
                uid: meta.uid,
                name: meta.name ?? 'Anonymous',
                label: meta.label,
                matchType: 'label',
                matchedText: meta.label,
                hasProps: !!meta.propsSnapshot
            });
        }
    }
    return results;
}
/**
 * Combined fast search (name + label, no props loading) - ALWAYS SAFE
 */
export function fastSearch(query, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const resultMap = new Map();
    const queryNorm = opts.caseSensitive ? query : query.toLowerCase();
    const matchStr = opts.exactMatch
        ? (s) => s === queryNorm
        : (s) => s.includes(queryNorm);
    const store = getMetaStore();
    for (const meta of store.getAllComponents()) {
        if (resultMap.size >= opts.limit)
            break;
        const name = meta.name ?? 'Anonymous';
        const nameNorm = opts.caseSensitive ? name : name.toLowerCase();
        // Match by name
        if (matchStr(nameNorm)) {
            resultMap.set(meta.uid, {
                uid: meta.uid,
                name,
                label: meta.label,
                matchType: 'name',
                matchedText: name,
                hasProps: !!meta.propsSnapshot
            });
            continue;
        }
        // Match by label
        if (meta.label) {
            const labelNorm = opts.caseSensitive ? meta.label : meta.label.toLowerCase();
            if (matchStr(labelNorm)) {
                resultMap.set(meta.uid, {
                    uid: meta.uid,
                    name,
                    label: meta.label,
                    matchType: 'label',
                    matchedText: meta.label,
                    hasProps: !!meta.propsSnapshot
                });
            }
        }
    }
    return Array.from(resultMap.values());
}
// ============================================================================
// Lazy Search (With Props) - SCOPE LIMITED
// ============================================================================
/**
 * Get props for search from existing snapshot.
 * Only uses already-loaded props, doesn't trigger new reads.
 */
function getPropsForSearch(meta) {
    if (!meta.propsSnapshot)
        return null;
    return meta.propsSnapshot.raw;
}
/**
 * Get props for search - reads on-demand when scope is explicitDeep.
 * Used for key/value search with lightweight component list (no pre-loaded props).
 */
function getPropsForSearchOrRead(meta, scope) {
    if (scope === 'explicitDeep') {
        const raw = extractRawProps(meta.instance);
        return raw && typeof raw === 'object' ? raw : null;
    }
    return getPropsForSearch(meta);
}
/**
 * Search by prop key - LIMITED TO SCOPE
 * Default: Only searches expanded + logged components
 */
export function searchByPropKey(query, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options, type: 'key' };
    const results = [];
    const queryNorm = opts.caseSensitive ? query : query.toLowerCase();
    const matchKey = opts.exactMatch
        ? (k) => k === queryNorm
        : (k) => k.includes(queryNorm);
    const componentsInScope = getComponentsInScope(opts.scope);
    for (const meta of componentsInScope) {
        if (results.length >= opts.limit)
            break;
        const props = getPropsForSearchOrRead(meta, opts.scope);
        if (!props)
            continue;
        // Search in prop keys
        for (const key of Object.keys(props)) {
            const keyNorm = opts.caseSensitive ? key : key.toLowerCase();
            if (matchKey(keyNorm)) {
                results.push({
                    uid: meta.uid,
                    name: meta.name ?? 'Anonymous',
                    label: meta.label,
                    matchType: 'key',
                    matchedText: key,
                    hasProps: true
                });
                break; // Only add component once
            }
        }
    }
    return results;
}
/**
 * Search by prop value - LIMITED TO SCOPE
 * Default: Only searches expanded + logged components
 */
export function searchByPropValue(query, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options, type: 'value' };
    const results = [];
    const queryNorm = opts.caseSensitive ? query : query.toLowerCase();
    const componentsInScope = getComponentsInScope(opts.scope);
    for (const meta of componentsInScope) {
        if (results.length >= opts.limit)
            break;
        const props = getPropsForSearchOrRead(meta, opts.scope);
        if (!props)
            continue;
        // Search in prop values
        for (const [key, value] of Object.entries(props)) {
            if (matchesValue(value, queryNorm, opts.caseSensitive, opts.exactMatch)) {
                results.push({
                    uid: meta.uid,
                    name: meta.name ?? 'Anonymous',
                    label: meta.label,
                    matchType: 'value',
                    matchedText: `${key}: ${stringifyValue(value)}`,
                    hasProps: true
                });
                break; // Only add component once
            }
        }
    }
    return results;
}
/**
 * Combined lazy search (key + value) - LIMITED TO SCOPE
 * Default: Only searches expanded + logged components
 */
export function lazySearch(query, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const resultMap = new Map();
    const queryNorm = opts.caseSensitive ? query : query.toLowerCase();
    const componentsInScope = getComponentsInScope(opts.scope);
    for (const meta of componentsInScope) {
        if (resultMap.size >= opts.limit)
            break;
        const props = getPropsForSearchOrRead(meta, opts.scope);
        if (!props)
            continue;
        // Search in keys
        const matchKey = opts.exactMatch
            ? (k) => k === queryNorm
            : (k) => k.includes(queryNorm);
        for (const key of Object.keys(props)) {
            const keyNorm = opts.caseSensitive ? key : key.toLowerCase();
            if (matchKey(keyNorm)) {
                resultMap.set(meta.uid, {
                    uid: meta.uid,
                    name: meta.name ?? 'Anonymous',
                    label: meta.label,
                    matchType: 'key',
                    matchedText: key,
                    hasProps: true
                });
                break;
            }
        }
        if (resultMap.has(meta.uid))
            continue;
        // Search in values
        for (const [key, value] of Object.entries(props)) {
            if (matchesValue(value, queryNorm, opts.caseSensitive, opts.exactMatch)) {
                resultMap.set(meta.uid, {
                    uid: meta.uid,
                    name: meta.name ?? 'Anonymous',
                    label: meta.label,
                    matchType: 'value',
                    matchedText: `${key}: ${stringifyValue(value)}`,
                    hasProps: true
                });
                break;
            }
        }
    }
    return Array.from(resultMap.values());
}
// ============================================================================
// Full Search (All Types)
// ============================================================================
/**
 * Full search across all types (name, label, key, value).
 * Fast search is done first, then lazy search ONLY within scope.
 */
export function fullSearch(query, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const resultMap = new Map();
    // Fast search first (name + label) - ALWAYS SAFE
    const fastResults = fastSearch(query, { ...opts, limit: opts.limit });
    for (const result of fastResults) {
        resultMap.set(result.uid, result);
    }
    // If we haven't reached the limit, do lazy search WITHIN SCOPE
    if (resultMap.size < opts.limit) {
        const remaining = opts.limit - resultMap.size;
        const lazyResults = lazySearch(query, { ...opts, limit: remaining });
        for (const result of lazyResults) {
            if (!resultMap.has(result.uid)) {
                resultMap.set(result.uid, result);
            }
        }
    }
    return Array.from(resultMap.values());
}
/**
 * Search with specific type
 */
export function search(query, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    switch (opts.type) {
        case 'name':
            return searchByName(query, opts);
        case 'label':
            return searchByLabel(query, opts);
        case 'key':
            return searchByPropKey(query, opts);
        case 'value':
            return searchByPropValue(query, opts);
        case 'all':
        default:
            return fullSearch(query, opts);
    }
}
/**
 * Deep search - REQUIRES EXPLICIT CALL
 * This searches ALL components and should only be triggered by explicit user action
 */
export function deepSearch(query, options = {}) {
    console.warn('[injected/props/search] Deep search initiated - this scans all components');
    return search(query, { ...options, scope: 'explicitDeep' });
}
// ============================================================================
// Helpers
// ============================================================================
function matchesValue(value, query, caseSensitive, exactMatch) {
    if (value === null || value === undefined) {
        return false;
    }
    if (typeof value === 'string') {
        const valueNorm = caseSensitive ? value : value.toLowerCase();
        return exactMatch ? valueNorm === query : valueNorm.includes(query);
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        const str = String(value);
        return exactMatch ? str === query : str.includes(query);
    }
    // For objects and arrays - DON'T stringify (expensive)
    // Just check shallow
    if (Array.isArray(value)) {
        for (const item of value.slice(0, 10)) { // Limit to first 10 items
            if (matchesValue(item, query, caseSensitive, exactMatch)) {
                return true;
            }
        }
        return false;
    }
    if (typeof value === 'object') {
        // Check only immediate values, not nested
        for (const v of Object.values(value).slice(0, 10)) {
            if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
                if (matchesValue(v, query, caseSensitive, exactMatch)) {
                    return true;
                }
            }
        }
        return false;
    }
    return false;
}
function stringifyValue(value) {
    if (value === null)
        return 'null';
    if (value === undefined)
        return 'undefined';
    if (typeof value === 'string') {
        return value.length > 50 ? value.substring(0, 50) + '...' : value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    if (Array.isArray(value)) {
        return `Array(${value.length})`;
    }
    if (typeof value === 'object') {
        return `Object{${Object.keys(value).length}}`;
    }
    return String(value);
}
//# sourceMappingURL=search.js.map