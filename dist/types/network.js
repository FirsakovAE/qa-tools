/**
 * Network Tab Types
 * DTO contracts for network request interception
 */
/**
 * Default network configuration values
 */
export const DEFAULT_NETWORK_CONFIG = {
    maxEntries: 500,
    maxBodySize: 20 * 1024 * 1024, // 20MB
    captureRequestBody: true,
    captureResponseBody: true
};
/**
 * Get status category from HTTP status code
 */
export function getStatusCategory(status) {
    if (status === 0)
        return 'pending';
    if (status >= 200 && status < 300)
        return 'success';
    if (status >= 300 && status < 400)
        return 'redirect';
    if (status >= 400 && status < 500)
        return 'client-error';
    if (status >= 500)
        return 'server-error';
    return 'failed';
}
/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes) {
    if (bytes === 0)
        return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
/**
 * Format duration to human readable string
 */
export function formatDuration(ms) {
    if (ms < 1000)
        return `${Math.round(ms)} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
}
/**
 * Extract short name from URL
 */
export function extractUrlName(url) {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        // Get last segment of path or host if root
        const segments = pathname.split('/').filter(Boolean);
        if (segments.length > 0) {
            return segments[segments.length - 1];
        }
        return urlObj.host;
    }
    catch {
        return url.substring(0, 50);
    }
}
/**
 * Parse query parameters from URL
 */
export function parseUrlParams(url) {
    try {
        const urlObj = new URL(url);
        const params = [];
        urlObj.searchParams.forEach((value, key) => {
            params.push({ key, value });
        });
        return params;
    }
    catch {
        return [];
    }
}
/**
 * Extract authorization info from headers
 */
export function extractAuthorization(headers) {
    const authHeader = headers.find(h => h.name.toLowerCase() === 'authorization');
    if (!authHeader) {
        // Check for API key headers
        const apiKeyHeader = headers.find(h => h.name.toLowerCase().includes('api-key') ||
            h.name.toLowerCase().includes('x-api-key'));
        if (apiKeyHeader) {
            return {
                type: 'ApiKey',
                token: apiKeyHeader.value,
                headerName: apiKeyHeader.name
            };
        }
        return { type: 'None' };
    }
    const value = authHeader.value;
    if (value.startsWith('Bearer ')) {
        return {
            type: 'Bearer',
            token: value.substring(7)
        };
    }
    if (value.startsWith('Basic ')) {
        const decoded = atob(value.substring(6));
        const [username] = decoded.split(':');
        return {
            type: 'Basic',
            token: value.substring(6),
            username
        };
    }
    return {
        type: 'Custom',
        token: value
    };
}
/**
 * Check if content type is binary
 */
export function isBinaryContentType(contentType) {
    const binaryTypes = [
        'image/',
        'audio/',
        'video/',
        'application/octet-stream',
        'application/pdf',
        'application/zip',
        'application/gzip',
        'application/x-tar'
    ];
    return binaryTypes.some(type => contentType.toLowerCase().startsWith(type));
}
/**
 * Generate unique ID for network entry
 */
export function generateEntryId() {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
//# sourceMappingURL=network.js.map