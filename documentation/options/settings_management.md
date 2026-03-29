---
title: Settings management
---

# Save, import, and export

**Options → General** ends with **Import**, **Export**, and **Reset**. They work in **extension** and **standalone**, but **storage backends** and **export payload shape** differ.

Everyday edits **autosave** (debounced) — there is no separate Save button for normal fields.

A short comparison of where bytes go: [Installation → Where settings are stored](/guide/install#storage).

---

## Normal persistence paths

### Extension (Chrome / Edge)

On autosave / import the background worker:

1. Writes the **settings object** (options, tables, Network/Props rules, …) to **IndexedDB** for the extension — primary durable store.
2. **Mirrors** the structure to **`chrome.storage.local`** under a key like **`vue-inspector-settings`** for compatibility and quick access.

Binary Customize files are **not** inlined in JSON — the object stores **ids/metadata** while blobs sit in **`vue-inspector-media`** IndexedDB. Keeps the settings blob small/fast to load.

### Standalone

Settings go through the local storage adapter into a **central KV** store (e.g. **`inspector-settings`** in IndexedDB via the **storage iframe**). **Not** `chrome.storage` — there is no installed extension.

Decorative media uses the same storage perimeter with a **total size budget** (see [Customize](/options/customize)).

**sessionStorage** may cache for first paint after reload — not a substitute for durable storage.

---

## Export

**Export** downloads text named like `vue-inspector-settings-YYYY-MM-DD.txt` containing pretty-printed JSON of in-memory settings.

* **Standalone:** for `savedFiles` rows backed by blobs, export may inline **data URIs** so the backup is **portable** across browsers/machines.
* **Extension:** data URI payloads for heavy files are usually **stripped** — you get structure/options; re-copy media locally or re-import a **rich** standalone export if you need bytes.

Use Export for **backups**, **migration** (especially standalone), and **versioning** presets as plain text.

---

## Import

**Import** picks a file; expected **JSON** matches export (filter often `*.txt`).

1. Parse and **merge with defaults**: unknown keys drop; legacy shapes **migrate** when possible.
2. Result loads into the same options model, then **writes once** to durable storage (extension or standalone).
3. UI refreshes dependent lists (breakpoints, mocks, …).

Blobs are **not duplicated** on write — JSON mostly carries ids; importing a **standalone** export with embedded data URIs hydrates attachments; importing a **trimmed** extension export moves options/lists — you may **re-pick** backgrounds in Customize afterward.

Bad format **aborts** with an error in the form.

Import **overwrites** current keys present in the file. **Export** first if you need rollback.

---

## Reset

**Reset** restores factory defaults and clears related **media** stores. Extension path also clears IndexedDB settings keys and `chrome.storage.local` inspector keys. Standalone writes the reset through the same adapter as normal saves.

**Irreversible** without a prior export.

Partial Auto Run reset (without full wipe) exists via the extension **popup** — see [Auto run](/options/auto_run). **Reset** here clears the **entire** profile.

---

## See also

* [Installation — storage](/guide/install#storage)
* [Customize](/options/customize)
* [Auto run](/options/auto_run)
