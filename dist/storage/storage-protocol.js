/**
 * Central Storage Protocol
 *
 * Shared constants for postMessage communication between
 * UI iframe and the hidden storage iframe.
 */
export const STORAGE_PREFIX = '__VUE_INSPECTOR_STORAGE__';
export const STORAGE_RESPONSE_PREFIX = '__VUE_INSPECTOR_STORAGE_RESP__';
export const DB_NAME = 'central-store';
export const DB_VERSION = 1;
export const SETTINGS_STORE = 'settings';
export const MEDIA_STORE = 'media';
export const MEDIA_LIMIT_BYTES = 30 * 1024 * 1024;
//# sourceMappingURL=storage-protocol.js.map