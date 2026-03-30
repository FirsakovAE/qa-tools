"use strict";
/**
 * Popup script — fully standalone, no app module imports.
 * Two actions:
 *   1. Forced Launch — inject overlay ignoring static-site / autoRun filters
 *   2. Reset Settings — clear all persisted user settings & dock state
 */
const statusEl = document.getElementById('status');
const btnForce = document.getElementById('btn-force');
const btnReset = document.getElementById('btn-reset');
function showStatus(text, type) {
    statusEl.textContent = text;
    statusEl.className = `status ${type}`;
    setTimeout(() => { statusEl.textContent = ''; statusEl.className = 'status'; }, 2500);
}
// ── Forced Launch ──
btnForce.addEventListener('click', async () => {
    btnForce.disabled = true;
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id)
            throw new Error('No active tab');
        await chrome.tabs.sendMessage(tab.id, { type: 'FORCE_INJECT_UI' });
        showStatus('Launched', 'success');
        setTimeout(() => window.close(), 600);
    }
    catch (e) {
        showStatus(e?.message || 'Failed', 'error');
    }
    finally {
        btnForce.disabled = false;
    }
});
// ── Reset Settings ──
btnReset.addEventListener('click', async () => {
    btnReset.disabled = true;
    try {
        const resp = await chrome.runtime.sendMessage({ type: 'RESET_SETTINGS' });
        if (!resp?.success)
            throw new Error(resp?.error || 'Reset failed');
        // Also clear dock-state from chrome.storage.local
        await chrome.storage.local.remove('vue-inspector-dock-state');
        showStatus('Settings reset', 'success');
    }
    catch (e) {
        showStatus(e?.message || 'Failed', 'error');
    }
    finally {
        btnReset.disabled = false;
    }
});
//# sourceMappingURL=popup.js.map