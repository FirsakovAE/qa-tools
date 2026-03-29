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

## Which option should I choose?

* **Chrome extension** — when you need persistent access and the full feature set: auto-run, DevTools integration, and advanced in-browser workflows.
* **Standalone application** — when extensions cannot be installed, enterprise restrictions apply, or independent launch is required.

---

## Where are settings stored? {#storage}

Both the **extension** and **standalone** use **a single shared settings profile** for the browser: once saved in Options, the same values apply on **every site** where you open the inspector. No separate per-domain configuration is required.

Only the **storage mechanism** differs: the extension uses Chrome’s built-in storage for installed components, while standalone uses a **dedicated local storage layer** for the application (without installation in `chrome://extensions`), created specifically for this mode.

|                                                                               | **Extension**                                                                                                                                         | **Standalone (bookmark)**                                                                                                                 |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Settings** (options, favorites, site lists, etc.)                           | The extension’s **internal browser storage** within the browser profile: data is tied to the installed Vue Inspector instance, not to a specific tab. | **Dedicated** standalone local storage — same concept: one shared database for all sites launched through the bookmark.                   |
| **Customize assets** (backgrounds, saved media from Customize and related UI) | Stored separately in **browser storage** under the extension context (files remain in the browser profile, not “on the site”).                        | Stored in the **same unified** standalone storage, subject to its limits (see [Customize](/options/customize)).                           |
| **Across sites**                                                              | One shared settings profile across all domains in the current browser profile.                                                                        | One shared settings profile across all domains: storage is **not bound** to page origin, so reuse works the same way as in the extension. |

For media limits in Customize, see [Customize](/options/customize).

**Saving and transfer:** regular changes in Options **autosave** (with a small debounce). The **extension** stores settings in **IndexedDB** and **`chrome.storage.local`**; **standalone** keeps a snapshot in its **central KV store** (IndexedDB), while media is stored separately with a size limit. **Export / Import / Reset** in General provide JSON export and full reset; differences between modes during export and import are described in [Settings management](/options/settings_management).
