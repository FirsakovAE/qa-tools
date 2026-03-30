/**
 * Runtime Module - публичный API
 */
// Context (для использования в core)
export { useRuntime, useCapabilities, hasCapability, isRuntimeReady, getRuntimeAdapter } from './context';
// Adapters (для bootstrap)
export { createExtensionAdapter } from './extension/adapter';
export { createStandaloneAdapter } from './standalone/adapter';
export { createDevtoolsAdapter } from './devtools/adapter';
// Bootstrap (internal - используется только в entry points)
export { setRuntimeAdapter } from './context';
//# sourceMappingURL=index.js.map