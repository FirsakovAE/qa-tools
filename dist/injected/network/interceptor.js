/**
 * Network Interceptor Module
 * Intercepts fetch and XMLHttpRequest calls
 *
 * Features:
 * - Event-based (no polling)
 * - Excludes extension requests
 * - Excludes OPTIONS method
 * - Supports REST API methods
 * - REAL breakpoint pause with Promise-based waiting
 */
import { looksLikeFormDataDraftJson } from '../../utils/jsonGuards';
// Store original implementations
const originalFetch = window.fetch;
const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSend = XMLHttpRequest.prototype.send;
const originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
const originalXHRResponseTypeDescriptor = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseType');
// Extension URL patterns to exclude
const EXTENSION_PATTERNS = [
    'chrome-extension://',
    'moz-extension://',
    'edge-extension://',
    'webkit-resource://'
];
// Maximum body size to capture (20MB default)
let maxBodySize = 20 * 1024 * 1024;
// Callbacks for intercepted events
let callbacks = null;
// Paused state
let isPaused = false;
// Request ID counter
let requestIdCounter = 0;
// Map of breakpoint ID -> resolver function
const breakpointResolvers = new Map();
// Stores original FormData bodies by requestId so file entries can be
// restored when the user clicks Apply without changing them.
const originalFormDataBodies = new Map();
/**
 * Wait for breakpoint to be resumed
 * This ACTUALLY pauses the request execution
 */
function waitForBreakpointResume(requestId, breakpointId, trigger) {
    return new Promise((resolve, reject) => {
        breakpointResolvers.set(requestId, {
            resolve,
            reject,
            trigger,
            requestId
        });
        // Notify that breakpoint was hit
        if (callbacks?.onBreakpointHit) {
            callbacks.onBreakpointHit(requestId, breakpointId, trigger);
        }
    });
}
/**
 * Resume a paused breakpoint (called from bridge)
 */
export function resumeBreakpoint(requestId, modifications) {
    const pending = breakpointResolvers.get(requestId);
    if (pending) {
        pending.resolve(modifications);
        breakpointResolvers.delete(requestId);
        return true;
    }
    return false;
}
/**
 * Cancel a paused breakpoint (abort the request)
 */
export function cancelBreakpoint(requestId) {
    const pending = breakpointResolvers.get(requestId);
    if (pending) {
        pending.reject(new Error('Breakpoint cancelled by user'));
        breakpointResolvers.delete(requestId);
        return true;
    }
    return false;
}
/**
 * Check if there's an active breakpoint waiting
 */
export function hasActiveBreakpoint(requestId) {
    return breakpointResolvers.has(requestId);
}
/**
 * Get all active breakpoint request IDs
 */
export function getActiveBreakpointIds() {
    return Array.from(breakpointResolvers.keys());
}
// ============================================================================
// Utility Functions
// ============================================================================
/**
 * Generate unique request ID
 */
function generateRequestId() {
    return `net-${Date.now()}-${++requestIdCounter}`;
}
/**
 * Check if URL should be excluded from interception
 */
function shouldExcludeUrl(url) {
    return EXTENSION_PATTERNS.some(pattern => url.startsWith(pattern));
}
/**
 * Check if method should be excluded
 */
function shouldExcludeMethod(method) {
    return method.toUpperCase() === 'OPTIONS';
}
/**
 * Truncate body if too large
 */
function truncateBody(body) {
    if (!body) {
        return { text: '', truncated: false, originalSize: 0 };
    }
    const originalSize = body.length;
    if (originalSize > maxBodySize) {
        return {
            text: body.substring(0, maxBodySize),
            truncated: true,
            originalSize
        };
    }
    return { text: body, truncated: false, originalSize };
}
/**
 * Parse headers from Headers object
 */
function parseHeaders(headers) {
    const result = [];
    headers.forEach((value, name) => {
        result.push({ name, value });
    });
    return result;
}
/**
 * Get content length from headers
 */
function getContentLength(headers) {
    const contentLength = headers.find(h => h.name.toLowerCase() === 'content-length');
    return contentLength ? parseInt(contentLength.value, 10) || 0 : 0;
}
/** Max time to read `response.clone().text()` — avoids hanging the Network row if the stream never completes. */
const READ_RESPONSE_BODY_TIMEOUT_MS = 45_000;
/**
 * Read response body safely (bounded time so inspector rows still finalize).
 */
async function readResponseBody(response, clone) {
    const contentType = response.headers.get('content-type') || '';
    // Skip binary content
    const binaryTypes = ['image/', 'audio/', 'video/', 'application/octet-stream', 'application/pdf', 'application/zip'];
    if (binaryTypes.some(type => contentType.toLowerCase().startsWith(type))) {
        return null;
    }
    try {
        const deadline = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('READ_RESPONSE_BODY_TIMEOUT')), READ_RESPONSE_BODY_TIMEOUT_MS);
        });
        return await Promise.race([clone.text(), deadline]);
    }
    catch (error) {
        if (error instanceof Error && error.message === 'READ_RESPONSE_BODY_TIMEOUT') {
            console.warn('[injected/network] readResponseBody timed out after', READ_RESPONSE_BODY_TIMEOUT_MS, 'ms', contentType);
        }
        else {
            console.error('[injected/network] readResponseBody failed:', error);
        }
        return null;
    }
}
/**
 * Serialize FormData into a JSON string with structured entries.
 * Each entry has: key, type ('text' | 'file'), value, and optional file metadata.
 */
function serializeFormData(formData) {
    const entries = [];
    formData.forEach((value, key) => {
        if (value instanceof File) {
            entries.push({
                key,
                type: 'file',
                value: `(binary)`,
                fileName: value.name,
                fileType: value.type || 'application/octet-stream',
                fileSize: value.size,
            });
        }
        else {
            entries.push({ key, type: 'text', value: String(value) });
        }
    });
    return JSON.stringify({ __formData: true, entries });
}
/**
 * Serialize request body to string
 */
function serializeRequestBody(body) {
    if (!body)
        return null;
    if (typeof body === 'string') {
        return body;
    }
    if (body instanceof URLSearchParams) {
        return body.toString();
    }
    if (body instanceof FormData) {
        return serializeFormData(body);
    }
    if (body instanceof Blob) {
        return `[Blob: ${body.size} bytes, type: ${body.type}]`;
    }
    if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
        return `[Binary: ${body.byteLength} bytes]`;
    }
    try {
        return JSON.stringify(body);
    }
    catch (error) {
        console.error('[injected/network] serializeRequestBody failed:', error);
        return '[Object]';
    }
}
/**
 * Build new URL from modifications
 */
function buildModifiedUrl(originalUrl, modifications) {
    try {
        const url = new URL(originalUrl);
        // Apply scheme change
        if (modifications.scheme) {
            url.protocol = modifications.scheme + ':';
        }
        // Apply host change (may include port)
        if (modifications.host) {
            const [host, port] = modifications.host.split(':');
            url.hostname = host;
            if (port) {
                url.port = port;
            }
            else {
                url.port = '';
            }
        }
        // Apply path change (may include query)
        if (modifications.path) {
            const [pathname, search] = modifications.path.split('?');
            url.pathname = pathname;
            if (search !== undefined) {
                url.search = search ? '?' + search : '';
            }
        }
        // Apply params change - rebuild query string (empty array clears all params)
        if (Array.isArray(modifications.params)) {
            if (modifications.params.length > 0) {
                const searchParams = new URLSearchParams();
                modifications.params.forEach(p => {
                    if (p.key) {
                        searchParams.append(p.key, p.value);
                    }
                });
                url.search = searchParams.toString() ? '?' + searchParams.toString() : '';
            }
            else {
                // Empty array - clear all params
                url.search = '';
            }
        }
        return url.toString();
    }
    catch (e) {
        console.error('[injected/network] buildModifiedUrl failed:', e);
        return originalUrl;
    }
}
/**
 * Check if HTTP method allows body
 */
function methodAllowsBody(method) {
    const methodUpper = method.toUpperCase();
    return methodUpper !== 'GET' && methodUpper !== 'HEAD';
}
/**
 * Normalize any user-provided file path into a file:// URI that fetch() can use.
 *
 * Supported inputs:
 *   file:///C:/Users/.../file.jpg        → returned as-is
 *   C:\Users\...\file.jpg                → file:///C:/Users/.../file.jpg
 *   "C:\Users\...\file.jpg"              → (quotes stripped first)
 *   C:/Users/.../file.jpg                → file:///C:/Users/.../file.jpg
 *   \\server\share\file.jpg              → file://server/share/file.jpg
 *   /Users/.../file.jpg                  → file:///Users/.../file.jpg
 *   ~/Downloads/file.jpg                 → file:///Users/<home>/Downloads/file.jpg  (best-effort)
 */
function normalizeFilePathToUri(raw) {
    let p = raw.trim();
    // Strip wrapping quotes
    if ((p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'"))) {
        p = p.slice(1, -1);
    }
    // Already a file:// URI
    if (/^file:\/\//i.test(p))
        return p;
    // UNC path  \\server\share\...  →  file://server/share/...
    if (p.startsWith('\\\\')) {
        return 'file:' + p.replace(/\\/g, '/');
    }
    // Normalise backslashes to forward slashes for the rest
    p = p.replace(/\\/g, '/');
    // Windows drive letter  C:/...  →  file:///C:/...
    if (/^[A-Za-z]:\//.test(p)) {
        return 'file:///' + p;
    }
    // Home-dir shorthand ~/ (best-effort — won't work in every runtime)
    if (p.startsWith('~/')) {
        return 'file:///' + p.slice(2);
    }
    // Absolute Unix path /...
    if (p.startsWith('/')) {
        return 'file://' + p;
    }
    // Fallback: return as-is (relative or already usable URL)
    return p;
}
/**
 * Decode a base64 data URI (e.g. "data:image/jpeg;base64,/9j/4AAQ...") into a Blob.
 */
function dataUriToBlob(dataUri) {
    const commaIdx = dataUri.indexOf(',');
    if (commaIdx === -1)
        return new Blob([], { type: 'application/octet-stream' });
    const meta = dataUri.slice(0, commaIdx);
    const base64 = dataUri.slice(commaIdx + 1);
    const mimeMatch = meta.match(/data:([^;]+)/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const byteString = atob(base64);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mime });
}
/**
 * Reconstruct the appropriate body from serialized string.
 * If the string contains __formData marker, build a real FormData object.
 *
 * File entry resolution order:
 *   1. value === "(binary)" + originalFD → restore original File
 *   2. value starts with "data:" → decode base64 Data URI to Blob
 *   3. value is a URL/path → attempt fetch (may fail for file:// in browsers)
 *   4. Fallback → empty Blob with original filename
 */
async function deserializeBodyForRequest(body, originalFD) {
    if (!body)
        return body;
    if (!looksLikeFormDataDraftJson(body))
        return body;
    try {
        const parsed = JSON.parse(body);
        if (parsed && parsed.__formData === true && Array.isArray(parsed.entries)) {
            const fd = new FormData();
            for (const entry of parsed.entries) {
                if (entry.type === 'file') {
                    const rawValue = entry.value || '';
                    // 1. Value unchanged — restore original File from the captured FormData
                    if (rawValue === '(binary)' && originalFD) {
                        const original = originalFD.get(entry.key);
                        if (original instanceof File) {
                            fd.append(entry.key, original, original.name);
                            continue;
                        }
                        if (original != null && typeof original !== 'string') {
                            fd.append(entry.key, original, entry.fileName || 'file');
                            continue;
                        }
                        // Key-based lookup failed; try positional match (handles duplicate keys)
                        let found = false;
                        const allValues = originalFD.getAll(entry.key);
                        for (const v of allValues) {
                            if (v instanceof File || (v != null && typeof v !== 'string')) {
                                fd.append(entry.key, v, v instanceof File ? v.name : (entry.fileName || 'file'));
                                found = true;
                                break;
                            }
                        }
                        if (found)
                            continue;
                    }
                    // (binary) without originalFD — send original body as-is (no modifications)
                    if (rawValue === '(binary)' && !originalFD) {
                        fd.append(entry.key, new Blob([], { type: entry.fileType || 'application/octet-stream' }), entry.fileName || 'file');
                        continue;
                    }
                    // 2. Data URI from the built-in file picker (base64-encoded content)
                    if (rawValue.startsWith('data:')) {
                        const blob = dataUriToBlob(rawValue);
                        fd.append(entry.key, blob, entry.fileName || 'file');
                        continue;
                    }
                    // 3. URL or file path — attempt fetch (works for http/https; file:// blocked by browsers)
                    // blob: and __fileId: must be resolved in DevTools before sending — use empty fallback
                    if (rawValue) {
                        if (rawValue.startsWith('blob:') || rawValue.startsWith('__fileId:')) {
                            console.warn('[VueInspector] File reference could not be resolved. Use Browse to select a file or ensure the file is saved in Settings.');
                            fd.append(entry.key, new Blob([], { type: entry.fileType || 'application/octet-stream' }), entry.fileName || 'file');
                            continue;
                        }
                        const fileUri = normalizeFilePathToUri(rawValue);
                        const fileName = rawValue.replace(/\\/g, '/').split('/').pop() || 'file';
                        let blob;
                        try {
                            const resp = await originalFetch.call(window, fileUri);
                            blob = await resp.blob();
                        }
                        catch (err) {
                            console.error('[injected/network] Cannot fetch file from path:', rawValue, err);
                            blob = new Blob([], { type: 'application/octet-stream' });
                        }
                        fd.append(entry.key, blob, fileName);
                        continue;
                    }
                    // 4. Fallback: empty file
                    fd.append(entry.key, new Blob([], { type: 'application/octet-stream' }), entry.fileName || 'file');
                }
                else {
                    fd.append(entry.key, entry.value ?? '');
                }
            }
            return fd;
        }
    }
    catch {
        /* not our FormData draft — send as raw string */
    }
    return body;
}
/**
 * Apply modifications to request init
 */
async function applyRequestModifications(init, modifications, originalFD) {
    const modified = { ...init };
    // Apply method change
    if (modifications.method) {
        modified.method = modifications.method;
    }
    if (modifications.requestHeaders) {
        const headers = new Headers();
        modifications.requestHeaders.forEach(h => headers.set(h.name, h.value));
        modified.headers = headers;
    }
    // Determine effective method (modified or original)
    const effectiveMethod = modifications.method || init?.method || 'GET';
    // Only set body if method allows it (GET/HEAD cannot have body)
    if (modifications.requestBody !== undefined && methodAllowsBody(effectiveMethod)) {
        modified.body = await deserializeBodyForRequest(modifications.requestBody, originalFD);
        // When sending FormData, let the browser set the Content-Type with boundary
        if (modified.body instanceof FormData && modified.headers instanceof Headers) {
            modified.headers.delete('content-type');
        }
    }
    else if (!methodAllowsBody(effectiveMethod)) {
        // Ensure body is removed for GET/HEAD methods
        delete modified.body;
    }
    return modified;
}
// ============================================================================
// Fetch Interceptor
// ============================================================================
/**
 * Intercept fetch API with REAL breakpoint support and Mock (Map Local) feature
 */
function interceptFetch() {
    window.fetch = async function (input, init) {
        const url = typeof input === 'string'
            ? input
            : input instanceof URL
                ? input.href
                : input.url;
        const method = init?.method || (input instanceof Request ? input.method : 'GET');
        // Check exclusions
        if (shouldExcludeUrl(url) || shouldExcludeMethod(method)) {
            return originalFetch.call(window, input, init);
        }
        const requestId = generateRequestId();
        const startTime = performance.now();
        // ========================================
        // 🎯 MOCK CHECK - BEFORE ANY NETWORK CALL!
        // This is Map Local: return fake response without hitting network
        // ========================================
        if (callbacks?.onMockCheck) {
            const mockMatch = callbacks.onMockCheck(url, method.toUpperCase());
            if (mockMatch && mockMatch.mock && mockMatch.mock.enabled) {
                try {
                    // Apply delay if configured (like Charles Proxy)
                    if (mockMatch.mock.delay && mockMatch.mock.delay > 0) {
                        await new Promise(resolve => setTimeout(resolve, mockMatch.mock.delay));
                    }
                    // If body is object/array, stringify it. If undefined/null, use empty string
                    let mockBody;
                    const rawBody = mockMatch.mock.body;
                    if (rawBody === undefined || rawBody === null) {
                        mockBody = '';
                    }
                    else if (typeof rawBody === 'string') {
                        mockBody = rawBody;
                    }
                    else {
                        mockBody = JSON.stringify(rawBody);
                    }
                    const contentType = mockMatch.mock.headers?.find(h => h.name.toLowerCase() === 'content-type')?.value || 'application/json';
                    if (contentType.includes('json') && mockBody) {
                        try {
                            JSON.parse(mockBody);
                        }
                        catch {
                            mockBody = JSON.stringify(mockBody);
                        }
                    }
                    // ✅ FIX: Handle status codes that don't allow a body (204, 205, 304)
                    // Per HTTP spec, these responses MUST NOT have a body
                    const mockStatus = mockMatch.mock.status || 200;
                    const isNoBodyStatus = mockStatus === 204 || mockStatus === 205 || mockStatus === 304;
                    // Also treat empty body as no body
                    const hasBody = !isNoBodyStatus && mockBody !== '';
                    const responseBody = hasBody ? mockBody : null;
                    // Build response headers
                    const responseHeaders = new Headers();
                    if (mockMatch.mock.headers && Array.isArray(mockMatch.mock.headers)) {
                        mockMatch.mock.headers.forEach(h => {
                            if (h.name && h.value !== undefined) {
                                // Skip Content-Type header if there's no body
                                if (!hasBody && h.name.toLowerCase() === 'content-type')
                                    return;
                                responseHeaders.set(h.name, h.value);
                            }
                        });
                    }
                    if (hasBody && !responseHeaders.has('content-type')) {
                        responseHeaders.set('content-type', 'application/json; charset=utf-8');
                    }
                    // Set content-length (0 for no body)
                    responseHeaders.set('content-length', hasBody ? String(new TextEncoder().encode(mockBody).length) : '0');
                    // Create synthetic Response
                    const mockResponse = new Response(responseBody, {
                        status: mockStatus,
                        statusText: mockMatch.mock.statusText || 'OK',
                        headers: responseHeaders
                    });
                    // Notify that mock was applied (for UI logging)
                    if (callbacks?.onMockApplied) {
                        callbacks.onMockApplied(requestId, mockMatch.mockId);
                    }
                    // Extract request headers for logging
                    let requestHeaders = [];
                    const headersSource = init?.headers || (input instanceof Request ? input.headers : null);
                    if (headersSource) {
                        if (headersSource instanceof Headers) {
                            headersSource.forEach((value, name) => requestHeaders.push({ name, value }));
                        }
                        else if (Array.isArray(headersSource)) {
                            headersSource.forEach(([name, value]) => requestHeaders.push({ name, value }));
                        }
                        else {
                            Object.entries(headersSource).forEach(([name, value]) => requestHeaders.push({ name, value }));
                        }
                    }
                    // Log the mocked request (so it appears in Network tab)
                    if (callbacks?.onRequest && !isPaused) {
                        callbacks.onRequest({
                            id: requestId,
                            startTime,
                            method: method.toUpperCase(),
                            url,
                            requestHeaders,
                            requestBody: serializeRequestBody(init?.body || (input instanceof Request ? input.body : null))
                        });
                    }
                    // Log the mocked response (skip if paused — onRequest was skipped too, no pending row to finalize)
                    const endTime = performance.now();
                    if (callbacks?.onResponse && !isPaused) {
                        callbacks.onResponse(requestId, {
                            status: mockStatus,
                            statusText: mockMatch.mock.statusText || 'OK',
                            headers: mockMatch.mock.headers || [],
                            body: hasBody ? mockBody : '',
                            size: hasBody ? mockBody.length : 0,
                            duration: endTime - startTime
                        });
                    }
                    return mockResponse;
                }
                catch (mockError) {
                    console.error('[injected/network] Error creating mock response:', mockError);
                    // Fall through to real network call if mock fails
                }
            }
        }
        // Extract request headers (from init or Request object)
        let requestHeaders = [];
        const headersSource = init?.headers || (input instanceof Request ? input.headers : null);
        if (headersSource) {
            if (headersSource instanceof Headers) {
                headersSource.forEach((value, name) => {
                    requestHeaders.push({ name, value });
                });
            }
            else if (Array.isArray(headersSource)) {
                headersSource.forEach(([name, value]) => {
                    requestHeaders.push({ name, value });
                });
            }
            else {
                Object.entries(headersSource).forEach(([name, value]) => {
                    requestHeaders.push({ name, value });
                });
            }
        }
        // Extract request body (from init or Request object)
        const rawBody = init?.body || (input instanceof Request ? input.body : null);
        if (rawBody instanceof FormData) {
            originalFormDataBodies.set(requestId, rawBody);
        }
        let requestBody = serializeRequestBody(rawBody);
        // Notify about new request (only if not paused for logging)
        if (callbacks?.onRequest && !isPaused) {
            callbacks.onRequest({
                id: requestId,
                startTime,
                method: method.toUpperCase(),
                url,
                requestHeaders,
                requestBody
            });
        }
        // ========================================
        // REQUEST BREAKPOINT CHECK
        // (works even when logging is paused!)
        // ========================================
        let effectiveInput = input;
        let effectiveInit = init;
        if (callbacks?.onBreakpointCheck) {
            const match = callbacks.onBreakpointCheck(url, 'request', method.toUpperCase());
            if (match) {
                // ACTUALLY PAUSE HERE - request has NOT been sent yet!
                const modifications = await waitForBreakpointResume(requestId, match.breakpointId, 'request');
                // Apply any modifications from user
                if (modifications) {
                    const storedFD = originalFormDataBodies.get(requestId) || null;
                    const modifiedInit = await applyRequestModifications(init, modifications, storedFD);
                    // Apply URL modifications (scheme, host, path, params)
                    // Note: empty params array also counts as URL modification (clears query string)
                    const hasUrlMods = modifications.scheme || modifications.host ||
                        modifications.path || Array.isArray(modifications.params);
                    if (hasUrlMods) {
                        const modifiedUrl = buildModifiedUrl(url, modifications);
                        // If input is a Request object, we need to create a new one with new URL
                        if (input instanceof Request) {
                            effectiveInput = new Request(modifiedUrl, { ...modifiedInit });
                            effectiveInit = undefined;
                        }
                        else {
                            effectiveInput = modifiedUrl;
                            effectiveInit = modifiedInit;
                        }
                    }
                    else {
                        // No URL modifications, just apply init changes
                        if (input instanceof Request) {
                            effectiveInput = new Request(input, modifiedInit);
                            effectiveInit = undefined;
                        }
                        else {
                            effectiveInit = modifiedInit;
                        }
                    }
                    // Update captured data with modifications
                    if (modifications.requestHeaders) {
                        requestHeaders = modifications.requestHeaders;
                    }
                    if (modifications.requestBody !== undefined) {
                        requestBody = modifications.requestBody;
                    }
                }
            }
        }
        // ========================================
        // SEND THE ACTUAL REQUEST
        // ========================================
        try {
            const response = await originalFetch.call(window, effectiveInput, effectiveInit);
            originalFormDataBodies.delete(requestId);
            const endTime = performance.now();
            const duration = endTime - startTime;
            // Clone response only once, but defer reading until after breakpoint resume
            let responseBody = null;
            const clone = response.clone();
            // Get response headers
            let responseHeaders = parseHeaders(response.headers);
            // ========================================
            // RESPONSE BREAKPOINT CHECK
            // ========================================
            let finalResponse = response;
            if (callbacks?.onBreakpointCheck) {
                const match = callbacks.onBreakpointCheck(url, 'response', method.toUpperCase());
                if (match) {
                    // Read response body BEFORE waiting for resume (so UI can show it)
                    responseBody = await readResponseBody(response, clone);
                    const trunc = truncateBody(responseBody);
                    let bodyText = trunc.text;
                    let truncated = trunc.truncated;
                    let originalSize = trunc.originalSize;
                    // Calculate size
                    const contentLength = getContentLength(responseHeaders);
                    const size = contentLength || originalSize;
                    // ✅ Notify UI about the response BEFORE pausing (so user can see/edit body)
                    // NOTE: Always notify for breakpoints, regardless of isPaused (breakpoints work even when logging is paused)
                    if (callbacks?.onResponse) {
                        callbacks.onResponse(requestId, {
                            status: response.status,
                            statusText: response.statusText,
                            headers: responseHeaders,
                            body: truncated ? bodyText : responseBody,
                            size,
                            duration
                        });
                    }
                    // NOW pause and wait for user to modify and click Apply
                    const modifications = await waitForBreakpointResume(requestId, match.breakpointId, 'response');
                    // Apply any modifications from user
                    if (modifications && modifications.responseBody !== undefined) {
                        const modifiedBody = modifications.responseBody;
                        // Create modified headers
                        const modifiedHeaders = new Headers();
                        const headersToUse = modifications.responseHeaders ?? responseHeaders;
                        headersToUse.forEach(h => modifiedHeaders.set(h.name, h.value));
                        // Update content-length if body changed
                        if (modifiedBody !== null) {
                            modifiedHeaders.set('content-length', String(modifiedBody.length));
                        }
                        else {
                            modifiedHeaders.delete('content-length');
                        }
                        finalResponse = new Response(modifiedBody, {
                            status: modifications.status ?? response.status,
                            statusText: modifications.statusText ?? response.statusText,
                            headers: modifiedHeaders
                        });
                        // Update for logging
                        responseBody = modifiedBody;
                        responseHeaders = headersToUse;
                        // Update UI with modified response
                        if (callbacks?.onResponse) {
                            callbacks.onResponse(requestId, {
                                status: finalResponse.status,
                                statusText: finalResponse.statusText,
                                headers: responseHeaders,
                                body: modifiedBody,
                                size: modifiedBody?.length || 0,
                                duration
                            });
                        }
                    }
                    return finalResponse;
                }
            }
            // No response breakpoint - read body normally from the existing clone
            responseBody = await readResponseBody(response, clone);
            const trunc = truncateBody(responseBody);
            let bodyText = trunc.text;
            let truncated = trunc.truncated;
            let originalSize = trunc.originalSize;
            // Calculate size
            const contentLength = getContentLength(responseHeaders);
            const size = contentLength || originalSize;
            // Notify about response (normal flow). Always emit so rows never stay pending if interception pauses mid-flight.
            if (callbacks?.onResponse) {
                callbacks.onResponse(requestId, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: responseHeaders,
                    body: truncated ? bodyText : responseBody,
                    size,
                    duration
                });
            }
            return finalResponse;
        }
        catch (error) {
            originalFormDataBodies.delete(requestId);
            console.error('[injected/network] Fetch request failed:', requestId, error);
            // Notify about error
            if (callbacks?.onError) {
                callbacks.onError(requestId, error instanceof Error ? error.message : 'Network request failed');
            }
            throw error;
        }
    };
}
// ============================================================================
// XMLHttpRequest Interceptor
// ============================================================================
// Store original addEventListener for XHR
const originalXHRAddEventListener = XMLHttpRequest.prototype.addEventListener;
/**
 * Intercept XMLHttpRequest
 *
 * Response breakpoint strategy for XHR:
 * 1. Intercept addEventListener and onload/onreadystatechange setters
 * 2. Store all handlers instead of attaching them directly
 * 3. When readyState reaches DONE (4), check for breakpoint — not only `load` (e.g. `timeout` skips `load`, DevTools still shows completion)
 * 4. If breakpoint, wait for resume, apply modifications
 * 5. Override response properties with (possibly modified) values
 * 6. THEN call stored handlers - they see modified data
 */
function interceptXHR() {
    // Track pending XHR requests with extended data
    const xhrMap = new WeakMap();
    // Override open
    XMLHttpRequest.prototype.open = function (method, url, async = true, username, password) {
        const urlStr = url.toString();
        if (!shouldExcludeUrl(urlStr) && !shouldExcludeMethod(method)) {
            xhrMap.set(this, {
                id: generateRequestId(),
                method: method.toUpperCase(),
                url: urlStr,
                startTime: 0,
                requestHeaders: [],
                requestBody: null,
                loadHandlers: [],
                readystatechangeHandlers: [],
                errorHandlers: [],
                responseBreakpointPending: false,
                storedResponseData: null
            });
            // Intercept addEventListener for this XHR instance
            setupXHREventInterception(this, xhrMap.get(this));
        }
        return originalXHROpen.call(this, method, url, async, username, password);
    };
    // Setup event interception for XHR instance
    function setupXHREventInterception(xhr, data) {
        // Override addEventListener to capture handlers
        xhr.addEventListener = function (type, listener, options) {
            if (type === 'load') {
                data.loadHandlers.push(listener);
                return; // Don't attach directly - we'll call manually after breakpoint
            }
            if (type === 'readystatechange') {
                data.readystatechangeHandlers.push(listener);
                return;
            }
            if (type === 'error') {
                data.errorHandlers.push(listener);
                // Still attach error handlers directly
            }
            // For other events, attach normally
            return originalXHRAddEventListener.call(this, type, listener, options);
        };
        // Track onload property assignment
        let _onload = null;
        Object.defineProperty(xhr, 'onload', {
            get: () => _onload,
            set: (handler) => {
                _onload = handler;
                if (handler) {
                    data.loadHandlers.push(handler);
                }
            },
            configurable: true
        });
        // Track onreadystatechange property assignment  
        let _onreadystatechange = null;
        Object.defineProperty(xhr, 'onreadystatechange', {
            get: () => _onreadystatechange,
            set: (handler) => {
                _onreadystatechange = handler;
                if (handler) {
                    data.readystatechangeHandlers.push(handler);
                }
            },
            configurable: true
        });
    }
    // Override setRequestHeader
    XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
        const data = xhrMap.get(this);
        if (data) {
            data.requestHeaders.push({ name, value });
        }
        return originalXHRSetRequestHeader.call(this, name, value);
    };
    // ✅ FIX: Track responseType for proper mock response handling
    if (originalXHRResponseTypeDescriptor) {
        Object.defineProperty(XMLHttpRequest.prototype, 'responseType', {
            get: function () {
                return this._responseType || '';
            },
            set: function (value) {
                this._responseType = value;
                if (originalXHRResponseTypeDescriptor.set) {
                    originalXHRResponseTypeDescriptor.set.call(this, value);
                }
            },
            configurable: true
        });
    }
    // Pending XHR requests waiting for breakpoint resume
    const pendingXHRRequests = new Map();
    // Override send
    XMLHttpRequest.prototype.send = function (body) {
        const data = xhrMap.get(this);
        const xhr = this;
        if (!data) {
            return originalXHRSend.call(this, body);
        }
        data.startTime = performance.now();
        if (body instanceof FormData) {
            originalFormDataBodies.set(data.id, body);
        }
        data.requestBody = serializeRequestBody(body);
        // ========================================
        // 🎯 MOCK CHECK FOR XHR - BEFORE ANY NETWORK CALL!
        // ========================================
        if (callbacks?.onMockCheck) {
            const mockMatch = callbacks.onMockCheck(data.url, data.method);
            if (mockMatch && mockMatch.mock && mockMatch.mock.enabled) {
                // Log the mocked request (so it appears in Network tab)
                if (callbacks?.onRequest && !isPaused) {
                    callbacks.onRequest({
                        id: data.id,
                        startTime: data.startTime,
                        method: data.method,
                        url: data.url,
                        requestHeaders: data.requestHeaders,
                        requestBody: data.requestBody
                    });
                }
                // ✅ FIX: Ensure body is ALWAYS a valid string
                let mockBody;
                const rawBody = mockMatch.mock.body;
                if (rawBody === undefined || rawBody === null) {
                    mockBody = '';
                }
                else if (typeof rawBody === 'string') {
                    mockBody = rawBody;
                }
                else {
                    mockBody = JSON.stringify(rawBody);
                }
                const mockStatus = mockMatch.mock.status || 200;
                const mockStatusText = mockMatch.mock.statusText || 'OK';
                const mockHeaders = mockMatch.mock.headers || [];
                // ✅ FIX: Handle status codes that don't allow a body (204, 205, 304)
                const isNoBodyStatus = mockStatus === 204 || mockStatus === 205 || mockStatus === 304;
                // Also treat empty body as no body
                const hasBody = !isNoBodyStatus && mockBody !== '';
                if (!hasBody) {
                    mockBody = '';
                }
                // ✅ FIX: Validate JSON if needed (only if there's a body)
                const contentType = mockHeaders.find(h => h.name.toLowerCase() === 'content-type')?.value || 'application/json';
                if (hasBody && contentType.includes('json') && mockBody) {
                    try {
                        JSON.parse(mockBody);
                    }
                    catch {
                        mockBody = JSON.stringify(mockBody);
                    }
                }
                // Apply delay if configured
                const applyMockAndCallHandlers = async () => {
                    try {
                        if (mockMatch.mock.delay && mockMatch.mock.delay > 0) {
                            await new Promise(resolve => setTimeout(resolve, mockMatch.mock.delay));
                        }
                        const endTime = performance.now();
                        const duration = endTime - data.startTime;
                        const dispatchReadyStateChange = (state) => {
                            Object.defineProperty(xhr, 'readyState', {
                                get: () => state,
                                configurable: true
                            });
                            xhr.dispatchEvent(new Event('readystatechange'));
                        };
                        // Override status properties FIRST (before readyState changes)
                        Object.defineProperty(xhr, 'status', {
                            get: () => mockStatus,
                            configurable: true
                        });
                        Object.defineProperty(xhr, 'statusText', {
                            get: () => mockStatusText,
                            configurable: true
                        });
                        const responseType = xhr._responseType || xhr.responseType || '';
                        Object.defineProperty(xhr, 'responseText', {
                            get: () => mockBody,
                            configurable: true
                        });
                        // Set response based on responseType
                        if (responseType === 'json') {
                            let parsedResponse;
                            try {
                                parsedResponse = mockBody ? JSON.parse(mockBody) : null;
                            }
                            catch {
                                parsedResponse = mockBody;
                            }
                            Object.defineProperty(xhr, 'response', {
                                get: () => parsedResponse,
                                configurable: true
                            });
                        }
                        else if (responseType === 'arraybuffer') {
                            const encoder = new TextEncoder();
                            Object.defineProperty(xhr, 'response', {
                                get: () => encoder.encode(mockBody).buffer,
                                configurable: true
                            });
                        }
                        else if (responseType === 'blob') {
                            Object.defineProperty(xhr, 'response', {
                                get: () => new Blob([mockBody], { type: contentType }),
                                configurable: true
                            });
                        }
                        else {
                            // Default: text or empty string
                            Object.defineProperty(xhr, 'response', {
                                get: () => mockBody,
                                configurable: true
                            });
                        }
                        // Override header methods - filter out Content-Type if no body
                        const filteredHeaders = mockHeaders.filter(h => {
                            if (!hasBody && h.name.toLowerCase() === 'content-type')
                                return false;
                            return true;
                        });
                        // Build header string and map
                        let headerString = filteredHeaders.map(h => `${h.name}: ${h.value}`).join('\r\n');
                        if (headerString)
                            headerString += '\r\n\r\n';
                        const headerMap = new Map(filteredHeaders.map(h => [h.name.toLowerCase(), h.value]));
                        // Only add default Content-Type if there's a body and it's not already set
                        if (hasBody && !headerMap.has('content-type')) {
                            headerMap.set('content-type', 'application/json; charset=utf-8');
                            headerString = 'content-type: application/json; charset=utf-8\r\n' + headerString;
                        }
                        Object.defineProperty(xhr, 'getAllResponseHeaders', {
                            value: () => headerString,
                            configurable: true
                        });
                        Object.defineProperty(xhr, 'getResponseHeader', {
                            value: (name) => headerMap.get(name.toLowerCase()) || null,
                            configurable: true
                        });
                        // Simulate: OPENED -> HEADERS_RECEIVED -> LOADING -> DONE
                        dispatchReadyStateChange(2); // HEADERS_RECEIVED
                        dispatchReadyStateChange(3); // LOADING  
                        dispatchReadyStateChange(4); // DONE
                        // Without loadend, Axios/Vue promises may never resolve!
                        const progressEventInit = {
                            lengthComputable: true,
                            loaded: mockBody.length,
                            total: mockBody.length
                        };
                        xhr.dispatchEvent(new ProgressEvent('load', progressEventInit));
                        xhr.dispatchEvent(new ProgressEvent('loadend', progressEventInit));
                        // Log the mocked response (skip if paused — no pending row)
                        if (callbacks?.onResponse && !isPaused) {
                            callbacks.onResponse(data.id, {
                                status: mockStatus,
                                statusText: mockStatusText,
                                headers: mockHeaders,
                                body: mockBody,
                                size: mockBody.length,
                                duration
                            });
                        }
                        // Notify mock was applied
                        if (callbacks?.onMockApplied) {
                            callbacks.onMockApplied(data.id, mockMatch.mockId);
                        }
                        // Call stored handlers with mock data (for manually attached handlers)
                        callStoredHandlers(xhr, data);
                    }
                    catch (mockError) {
                        console.error('[injected/network] Error applying XHR mock:', mockError);
                        // If mock fails, we can't recover for XHR - just log error
                    }
                };
                // Execute async but don't return from send()
                applyMockAndCallHandlers();
                // 🔥 DON'T CALL originalXHRSend - request never hits network!
                return;
            }
        }
        // ========================================
        // REQUEST BREAKPOINT CHECK FOR XHR
        // ========================================
        if (callbacks?.onBreakpointCheck) {
            const match = callbacks.onBreakpointCheck(data.url, 'request', data.method);
            if (match) {
                // Store pending XHR request
                pendingXHRRequests.set(data.id, { xhr, body, data });
                // Notify about request first (so UI shows it)
                if (callbacks?.onRequest) {
                    callbacks.onRequest({
                        id: data.id,
                        startTime: data.startTime,
                        method: data.method,
                        url: data.url,
                        requestHeaders: data.requestHeaders,
                        requestBody: data.requestBody
                    });
                }
                // Notify that breakpoint was hit - this will pause until resume
                if (callbacks?.onBreakpointHit) {
                    callbacks.onBreakpointHit(data.id, match.breakpointId, 'request');
                }
                // Store resolver for this XHR - will be called when user clicks Apply
                breakpointResolvers.set(data.id, {
                    resolve: async (modifications) => {
                        const reqMods = modifications;
                        // Apply modifications if any
                        let finalBody = body;
                        // Determine effective method
                        const effectiveMethod = reqMods?.method || data.method;
                        // Only apply body modifications if method allows body
                        if (reqMods?.requestBody !== undefined && methodAllowsBody(effectiveMethod)) {
                            const storedFD = originalFormDataBodies.get(data.id) || null;
                            finalBody = await deserializeBodyForRequest(reqMods.requestBody, storedFD);
                        }
                        else if (!methodAllowsBody(effectiveMethod)) {
                            // Clear body for GET/HEAD methods
                            finalBody = null;
                        }
                        // Check if URL modifications require re-opening
                        // Note: empty params array also counts as URL modification (clears query string)
                        const hasUrlMods = reqMods && (reqMods.scheme || reqMods.host ||
                            reqMods.path || reqMods.method ||
                            Array.isArray(reqMods.params));
                        if (hasUrlMods && reqMods) {
                            // Build modified URL
                            const modifiedUrl = buildModifiedUrl(data.url, reqMods);
                            const modifiedMethod = reqMods.method || data.method;
                            // Re-open XHR with new URL (this resets headers)
                            originalXHROpen.call(xhr, modifiedMethod, modifiedUrl, true);
                            // Re-apply headers (use modified headers if available)
                            // Skip content-type when body is FormData — browser sets it with boundary
                            const isFormDataBody = finalBody instanceof FormData;
                            const headersToApply = reqMods.requestHeaders || data.requestHeaders;
                            headersToApply.forEach(h => {
                                if (isFormDataBody && h.name.toLowerCase() === 'content-type')
                                    return;
                                try {
                                    originalXHRSetRequestHeader.call(xhr, h.name, h.value);
                                }
                                catch (err) {
                                    console.error('[injected/network] XHR setRequestHeader failed:', h.name, err);
                                }
                            });
                            // Update data for logging
                            data.url = modifiedUrl;
                            data.method = modifiedMethod;
                            if (reqMods.requestHeaders) {
                                data.requestHeaders = reqMods.requestHeaders;
                            }
                        }
                        else if (reqMods?.requestHeaders) {
                            // Only header modifications - can't easily re-apply without re-open
                            // For now, log a warning - full solution would require re-opening
                            console.warn('[VueInspector Interceptor] XHR header modifications require URL mods to take effect');
                        }
                        // Remove from pending
                        pendingXHRRequests.delete(data.id);
                        // Setup internal listener for response handling
                        setupXHRInternalListener(xhr, data);
                        // Now actually send the request
                        originalXHRSend.call(xhr, finalBody);
                        originalFormDataBodies.delete(data.id);
                    },
                    reject: (error) => {
                        pendingXHRRequests.delete(data.id);
                        originalFormDataBodies.delete(data.id);
                        // Abort the XHR
                        xhr.abort();
                    },
                    trigger: 'request',
                    requestId: data.id
                });
                // DON'T call originalXHRSend - we wait for resume
                return;
            }
        }
        // No breakpoint - proceed normally
        // Notify about request (only if not paused for logging)
        if (callbacks?.onRequest && !isPaused) {
            callbacks.onRequest({
                id: data.id,
                startTime: data.startTime,
                method: data.method,
                url: data.url,
                requestHeaders: data.requestHeaders,
                requestBody: data.requestBody
            });
        }
        // Setup internal listener for response handling
        setupXHRInternalListener(this, data);
        // Send the request
        return originalXHRSend.call(this, body);
    };
    /**
     * Setup internal XHR listener that handles:
     * 1. Response breakpoint detection
     * 2. Waiting for user resume
     * 3. Applying modifications
     * 4. Calling stored app handlers with (modified) data
     */
    function setupXHRInternalListener(xhr, data) {
        // Use readystatechange DONE, not `load`: `load` is omitted for some outcomes (notably `timeout`) while DONE still runs — otherwise the inspector never gets onResponse and rows stay "pending".
        originalXHRAddEventListener.call(xhr, 'readystatechange', async function () {
            if (this.readyState !== XMLHttpRequest.DONE)
                return;
            if (data.xhrResponseHandled)
                return;
            data.xhrResponseHandled = true;
            const endTime = performance.now();
            const duration = endTime - data.startTime;
            // Parse response headers
            const headerStr = this.getAllResponseHeaders();
            let responseHeaders = [];
            headerStr.split('\r\n').forEach(line => {
                const idx = line.indexOf(':');
                if (idx > 0) {
                    responseHeaders.push({
                        name: line.substring(0, idx).trim(),
                        value: line.substring(idx + 1).trim()
                    });
                }
            });
            // Get response body
            let responseBody = null;
            const contentType = this.getResponseHeader('content-type') || '';
            const binaryTypes = ['image/', 'audio/', 'video/', 'application/octet-stream'];
            if (!binaryTypes.some(type => contentType.toLowerCase().startsWith(type))) {
                try {
                    responseBody = this.responseText;
                }
                catch {
                    responseBody = null;
                }
            }
            const { text: bodyText, truncated, originalSize } = truncateBody(responseBody);
            const contentLength = parseInt(this.getResponseHeader('content-length') || '0', 10);
            const size = contentLength || originalSize;
            // ========================================
            // RESPONSE BREAKPOINT CHECK FOR XHR
            // ========================================
            if (callbacks?.onBreakpointCheck) {
                const match = callbacks.onBreakpointCheck(data.url, 'response', data.method);
                if (match) {
                    // ✅ Notify UI about the response BEFORE pausing (so user can see/edit body)
                    // NOTE: Always notify for breakpoints, regardless of isPaused
                    if (callbacks?.onResponse) {
                        callbacks.onResponse(data.id, {
                            status: this.status,
                            statusText: this.statusText,
                            headers: responseHeaders,
                            body: truncated ? bodyText : responseBody,
                            size,
                            duration
                        });
                    }
                    // NOW pause and wait for user to modify and click Apply
                    const modifications = await waitForBreakpointResume(data.id, match.breakpointId, 'response');
                    // Apply any modifications from user
                    if (modifications) {
                        // For XHR, we need to override the response properties
                        if (modifications.responseBody !== undefined) {
                            // Override responseText and response
                            const modifiedBody = modifications.responseBody;
                            Object.defineProperty(this, 'responseText', {
                                get: () => modifiedBody || '',
                                configurable: true
                            });
                            Object.defineProperty(this, 'response', {
                                get: () => modifiedBody || null,
                                configurable: true
                            });
                            // Update responseBody for logging
                            responseBody = modifiedBody;
                        }
                        if (modifications.status !== undefined) {
                            Object.defineProperty(this, 'status', {
                                get: () => modifications.status,
                                configurable: true
                            });
                        }
                        if (modifications.statusText !== undefined) {
                            Object.defineProperty(this, 'statusText', {
                                get: () => modifications.statusText,
                                configurable: true
                            });
                        }
                        if (modifications.responseHeaders) {
                            // Override getAllResponseHeaders and getResponseHeader
                            const headerString = modifications.responseHeaders.map(h => `${h.name}: ${h.value}`).join('\r\n') + '\r\n\r\n';
                            Object.defineProperty(this, 'getAllResponseHeaders', {
                                value: () => headerString,
                                configurable: true
                            });
                            const headerMap = new Map(modifications.responseHeaders.map(h => [h.name.toLowerCase(), h.value]));
                            Object.defineProperty(this, 'getResponseHeader', {
                                value: (name) => headerMap.get(name.toLowerCase()) || null,
                                configurable: true
                            });
                            // Update responseHeaders for logging
                            responseHeaders = modifications.responseHeaders;
                        }
                        // Update UI with modified response
                        if (callbacks?.onResponse) {
                            callbacks.onResponse(data.id, {
                                status: this.status,
                                statusText: this.statusText,
                                headers: responseHeaders,
                                body: responseBody,
                                size: responseBody?.length || 0,
                                duration
                            });
                        }
                    }
                    // ✅ NOW call stored app handlers (they see modified data)
                    callStoredHandlers(this, data);
                }
                else {
                    // No breakpoint match - notify UI normally
                    // Check for status 0 which indicates CORS or network error
                    if (this.status === 0 && callbacks?.onError) {
                        callbacks.onError(data.id, 'Network error (CORS blocked or connection failed)');
                    }
                    else if (callbacks?.onResponse) {
                        callbacks.onResponse(data.id, {
                            status: this.status,
                            statusText: this.statusText,
                            headers: responseHeaders,
                            body: truncated ? bodyText : responseBody,
                            size,
                            duration
                        });
                    }
                    // Call stored app handlers
                    callStoredHandlers(this, data);
                }
            }
            else {
                // No breakpoint check available - notify UI normally
                // Check for status 0 which indicates CORS or network error
                if (this.status === 0 && callbacks?.onError) {
                    callbacks.onError(data.id, 'Network error (CORS blocked or connection failed)');
                }
                else if (callbacks?.onResponse) {
                    callbacks.onResponse(data.id, {
                        status: this.status,
                        statusText: this.statusText,
                        headers: responseHeaders,
                        body: truncated ? bodyText : responseBody,
                        size,
                        duration
                    });
                }
                // Call stored app handlers
                callStoredHandlers(this, data);
            }
        });
        // Listen for errors - use original addEventListener
        originalXHRAddEventListener.call(xhr, 'error', function () {
            if (callbacks?.onError) {
                // Try to get more specific error info
                let errorMessage = 'XMLHttpRequest failed';
                // If status is available, include it
                if (this.status > 0) {
                    errorMessage = `HTTP ${this.status}: ${this.statusText || 'Error'}`;
                }
                else if (this.status === 0) {
                    // Status 0 usually means CORS error or network failure
                    errorMessage = 'Network error (CORS blocked or connection failed)';
                }
                callbacks.onError(data.id, errorMessage);
            }
            // Call stored error handlers
            callStoredErrorHandlers(xhr, data);
        });
        originalXHRAddEventListener.call(xhr, 'abort', function () {
            if (callbacks?.onError) {
                callbacks.onError(data.id, 'Request aborted');
            }
        });
        originalXHRAddEventListener.call(xhr, 'timeout', function () {
            if (callbacks?.onError) {
                callbacks.onError(data.id, 'Request timed out');
            }
        });
    }
    /**
     * Call stored load and readystatechange handlers
     * This is called AFTER breakpoint is resolved and modifications are applied
     */
    function callStoredHandlers(xhr, data) {
        // Create a synthetic load event
        const loadEvent = new ProgressEvent('load', {
            lengthComputable: true,
            loaded: xhr.response?.length || 0,
            total: xhr.response?.length || 0
        });
        // Call all stored load handlers
        for (const handler of data.loadHandlers) {
            try {
                if (typeof handler === 'function') {
                    handler.call(xhr, loadEvent);
                }
                else if (handler && typeof handler.handleEvent === 'function') {
                    handler.handleEvent(loadEvent);
                }
            }
            catch (err) {
                console.error('[injected/network] Error calling load handler:', err);
            }
        }
        // Call readystatechange handlers (readyState should be 4 = DONE)
        const readystateEvent = new Event('readystatechange');
        for (const handler of data.readystatechangeHandlers) {
            try {
                if (typeof handler === 'function') {
                    handler.call(xhr, readystateEvent);
                }
                else if (handler && typeof handler.handleEvent === 'function') {
                    handler.handleEvent(readystateEvent);
                }
            }
            catch (err) {
                console.error('[injected/network] Error calling readystatechange handler:', err);
            }
        }
    }
    /**
     * Call stored error handlers
     */
    function callStoredErrorHandlers(xhr, data) {
        const errorEvent = new ProgressEvent('error');
        for (const handler of data.errorHandlers) {
            try {
                if (typeof handler === 'function') {
                    handler.call(xhr, errorEvent);
                }
                else if (handler && typeof handler.handleEvent === 'function') {
                    handler.handleEvent(errorEvent);
                }
            }
            catch (err) {
                console.error('[injected/network] Error calling error handler:', err);
            }
        }
    }
}
/**
 * Restore native fetch / XMLHttpRequest so DevTools attribute network calls to app code,
 * not this script. Used when Network is paused and on full cleanup.
 */
function restoreNativeNetworkAPIs() {
    window.fetch = originalFetch;
    XMLHttpRequest.prototype.open = originalXHROpen;
    XMLHttpRequest.prototype.send = originalXHRSend;
    XMLHttpRequest.prototype.setRequestHeader = originalXHRSetRequestHeader;
    if (originalXHRResponseTypeDescriptor) {
        Object.defineProperty(XMLHttpRequest.prototype, 'responseType', originalXHRResponseTypeDescriptor);
    }
}
/**
 * Install fetch + XHR patches (idempotent if called after restoreNativeNetworkAPIs).
 */
function installNetworkPatches() {
    interceptFetch();
    interceptXHR();
}
// ============================================================================
// Public API
// ============================================================================
/**
 * Initialize network interceptor
 */
export function initNetworkInterceptor(cbs, maxSize) {
    callbacks = cbs;
    if (maxSize) {
        maxBodySize = maxSize;
    }
    installNetworkPatches();
}
/**
 * Pause: restore native fetch/XHR so DevTools initiator points at app code, not this script.
 */
export function pauseInterception() {
    isPaused = true;
    restoreNativeNetworkAPIs();
}
/**
 * Resume interception
 */
export function resumeInterception() {
    isPaused = false;
    installNetworkPatches();
}
/**
 * Check if interception is paused
 */
export function isInterceptionPaused() {
    return isPaused;
}
/**
 * Restore original implementations (cleanup)
 */
export function cleanupNetworkInterceptor() {
    restoreNativeNetworkAPIs();
    callbacks = null;
    // Cancel all pending breakpoints
    breakpointResolvers.forEach((pending, id) => {
        pending.reject(new Error('Interceptor cleanup'));
    });
    breakpointResolvers.clear();
    originalFormDataBodies.clear();
}
//# sourceMappingURL=interceptor.js.map