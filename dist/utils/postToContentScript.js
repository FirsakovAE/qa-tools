/**
 * Universal utility to send messages from UI to the content script.
 * Routes through the port in DevTools mode, or via window.parent.postMessage in overlay mode.
 */
import { getRuntimeAdapter } from '@/runtime';
import { isExpectedExtensionError } from './expectedErrors';
export function postToContentScript(message) {
    try {
        const adapter = getRuntimeAdapter();
        if (adapter?.id === 'devtools') {
            adapter.sendMessage(message).catch((e) => {
                if (!isExpectedExtensionError(e))
                    console.error('[utils/postToContentScript] sendMessage failed:', e);
            });
            return;
        }
        window.parent?.postMessage({
            __VUE_INSPECTOR__: true,
            message
        }, '*');
    }
    catch (e) {
        if (!isExpectedExtensionError(e))
            console.error('[utils/postToContentScript] postToContentScript failed:', e);
    }
}
//# sourceMappingURL=postToContentScript.js.map