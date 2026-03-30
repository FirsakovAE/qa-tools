/**
 * Props-related runtime message handlers
 *
 * Architecture:
 * - HIGHLIGHT_BY_UID: Look up element by data attribute → highlight if exists
 * - UNHIGHLIGHT_ELEMENT: Remove highlight
 *
 * Element lookup is deterministic via data-vue-inspector-uid attribute.
 * The injected script marks elements, we find them by exact attribute match.
 * NO searching, NO strategies, NO fallbacks.
 */
import { requestWindow } from '../ipc';
import { highlightByUid, unhighlightElement } from '../highlight';
/**
 * UNHIGHLIGHT_ELEMENT handler
 */
export const handleUnhighlightElement = (message, sender, sendResponse) => {
    unhighlightElement();
    sendResponse({ success: true });
    return true;
};
/**
 * HIGHLIGHT_BY_UID handler - the ONLY way to highlight
 *
 * Looks up element by data-vue-inspector-uid attribute:
 * - If found → highlight
 * - If not found → silently return success: false
 */
export const handleHighlightByUid = (message, sender, sendResponse) => {
    const { uid } = message;
    if (typeof uid !== 'number') {
        sendResponse({ success: false, error: 'Invalid UID' });
        return true;
    }
    const success = highlightByUid(uid);
    sendResponse({ success });
    return true;
};
/**
 * HIGHLIGHT_ELEMENT handler - legacy support
 * Extracts UID from componentPath and delegates to highlightByUid
 */
export const handleHighlightElement = (message, sender, sendResponse) => {
    const { componentPath } = message;
    // Try to extract UID from path (format: "uid:123")
    let uid = null;
    if (typeof componentPath === 'string') {
        if (componentPath.startsWith('uid:')) {
            uid = parseInt(componentPath.substring(4), 10);
        }
        else {
            // Legacy path format - cannot highlight without UID
            sendResponse({ success: false, error: 'Legacy path format not supported' });
            return true;
        }
    }
    if (uid === null || isNaN(uid)) {
        sendResponse({ success: false, error: 'Could not extract UID' });
        return true;
    }
    const success = highlightByUid(uid);
    sendResponse({ success });
    return true;
};
/**
 * HIGHLIGHT_ELEMENT_BY_ELEMENT handler - DEPRECATED
 * This was an anti-pattern (selector guessing). Use HIGHLIGHT_BY_UID instead.
 */
export const handleHighlightElementByElement = (message, sender, sendResponse) => {
    // This handler is kept for backward compatibility but does nothing
    // UI should use HIGHLIGHT_BY_UID instead
    sendResponse({ success: false, error: 'Deprecated: use HIGHLIGHT_BY_UID' });
    return true;
};
/**
 * CLEAR_ELEMENT_REGISTRY handler - no longer needed
 * Element marks are managed by injected script via DOM attributes
 */
export const handleClearElementRegistry = (message, sender, sendResponse) => {
    // No-op: element marks are managed by injected script
    sendResponse({ success: true });
    return true;
};
/**
 * UPDATE_COMPONENT_PROPS handler
 */
export const handleUpdateComponentProps = (message, sender, sendResponse) => {
    // Forward props update request to injected script
    requestWindow({
        type: 'VUE_INSPECTOR_UPDATE_PROPS',
        componentPath: message.componentUid,
        props: message.props
    }, 'VUE_INSPECTOR_UPDATE_PROPS_RESULT', 5000)
        .then((response) => {
        sendResponse({ success: response.success || false, error: response.error });
    })
        .catch((error) => {
        console.error('[content/handlers/props] UPDATE_COMPONENT_PROPS failed:', error);
        sendResponse({ success: false, error: error.message });
    });
    return true; // Async response
};
/**
 * GET_COMPONENT_PROPS handler
 */
export const handleGetComponentProps = (message, sender, sendResponse) => {
    requestWindow({
        type: 'VUE_INSPECTOR_GET_COMPONENT_PROPS',
        componentPath: message.componentUid,
        componentPathFallback: message.componentPathFallback
    }, 'VUE_INSPECTOR_COMPONENT_PROPS_DATA', 3000)
        .then((response) => {
        sendResponse({
            props: response.props || {},
            rawProps: response.rawProps || {},
            newUid: response.newUid
        });
    })
        .catch((error) => {
        console.error('[content/handlers/props] GET_COMPONENT_PROPS failed:', error);
        sendResponse({ props: {}, rawProps: {} });
    });
    return true;
};
/**
 * PROPS_SEARCH handler - search by key/value in props (for lightweight format).
 * Uses injected script's deep search with scope: explicitDeep.
 */
export const handlePropsSearch = (message, sender, sendResponse) => {
    const { query, searchByKey, searchByValue, exactMatch } = message;
    const type = searchByKey && searchByValue ? 'all' : searchByKey ? 'key' : 'value';
    requestWindow({
        type: 'VUE_INSPECTOR_SEARCH_COMPONENTS',
        query: query || '',
        options: { scope: 'explicitDeep', type, limit: 10000, exactMatch: !!exactMatch }
    }, 'VUE_INSPECTOR_SEARCH_RESULTS', 15000)
        .then((response) => {
        sendResponse({ results: response.results || [] });
    })
        .catch((error) => {
        console.error('[content/handlers/props] PROPS_SEARCH failed:', error);
        sendResponse({ results: [] });
    });
    return true;
};
//# sourceMappingURL=props.js.map