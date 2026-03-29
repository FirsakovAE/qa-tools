---
title: Installation
---

# Installation

Vue Inspector is available in more than one launch mode so you can use it across environments and browsers.

The right mode depends on environment constraints, security policy, and how you prefer to work.

<div class="install-options">
  <a class="install-option-card" href="./extension">
    <span class="install-option-icon install-option-icon--brand" aria-hidden="true">
      <img src="/install/chrome-logo.svg" alt="" width="32" height="32" loading="lazy" decoding="async" />
    </span>
    <span class="install-option-body">
      <span class="install-option-title">Browser extension</span>
      <span class="install-option-desc">Full control inside the browser.</span>
    </span>
  </a>
  <a class="install-option-card" href="./standalone">
    <span class="install-option-icon install-option-icon--brand" aria-hidden="true">
      <img src="/install/electron-logo.svg" alt="" width="32" height="32" loading="lazy" decoding="async" />
    </span>
    <span class="install-option-body">
      <span class="install-option-title">Standalone app</span>
      <span class="install-option-desc">For strict policies and any browser.</span>
    </span>
  </a>
</div>

## Which one should I pick?

* **Chrome extension** — when you want persistent access and the full feature set: auto run, DevTools integration, and advanced in-browser workflows.
* **Standalone** — when extensions are blocked, enterprise policy applies, or you need a bookmarklet-style launch without installing the extension.

---

## Where settings are stored {#storage}

Both the **extension** and **standalone** share **one settings profile** for the browser: after you save options, the same values apply on **every site** where you open the inspector. You do not configure per domain separately.

Only the **storage mechanism** differs: the extension uses Chrome’s storages for the installed component; standalone uses a **separate local store** for the app (no `chrome://extensions` install), dedicated to that mode.

| | **Extension** | **Standalone (bookmark)** |
|---|----------------|---------------------------|
| **Settings** (options, favorites, site lists, etc.) | The extension’s **local storage** in the browser profile: data is tied to the installed Vue Inspector build, not a specific tab. | **Dedicated** standalone local storage — same idea, one database for all sites you launch via the bookmark. |
| **Customize assets** (backgrounds, saved media from Customize and related UI) | Stored in **browser storage** under the extension context (files live in the profile, not “on the site”). | Goes into the **same unified** standalone store, subject to its limits (see [Customize](/options/customize)). |
| **Across sites** | One settings set for all origins in this browser profile. | One settings set for all origins: storage is **not** bound to the page origin, so reuse matches the extension. |

For media limits in Customize see [Customize](/options/customize).

**Saving and migration:** normal edits in Options **autosave** (with a small debounce). The **extension** mirrors settings in **IndexedDB** and **`chrome.storage.local`**; **standalone** keeps a snapshot in its **central KV store** (IndexedDB), with media stored separately under a size cap. **Export / Import / Reset** in General produce a JSON file and a full reset; what differs between modes in export/import is covered in [Settings management](/options/settings_management).
