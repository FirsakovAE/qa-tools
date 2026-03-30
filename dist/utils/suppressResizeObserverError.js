/**
 * Suppresses the harmless "ResizeObserver loop completed with undelivered notifications"
 * error that can occur when UI libraries (e.g. reka-ui ScrollArea) trigger layout
 * changes during resize observation. This is a known browser quirk and does not
 * affect functionality.
 */
export function suppressResizeObserverError() {
    const isResizeObserverError = (msg) => msg.includes('ResizeObserver loop') &&
        (msg.includes('undelivered notifications') || msg.includes('loop limit exceeded'));
    window.addEventListener('error', (e) => {
        if (isResizeObserverError(e.message)) {
            e.preventDefault();
            e.stopImmediatePropagation();
        }
    });
}
//# sourceMappingURL=suppressResizeObserverError.js.map