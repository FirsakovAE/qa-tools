---
title: JSON Mode
---

# JSON Mode

In **Options → General**, the **JSON Mode** switch chooses which implementation is used to **view and edit JSON** across the inspector (for example request/response bodies in **Network**, payloads in **Mock response**, **Pinia** state snapshots, and **Props** component data when the content is JSON).

Non-JSON bodies (XML, plain text, etc.) still use a **single text view** with Prism highlighting where applicable; the switch mainly affects **JSON** payloads.

---

## Classic

**Classic** uses the built-in **text editor with Prism syntax highlighting** (`JsonTextEditor`):

- One **plain text** surface — there is **no separate tree UI**.
- **Read-only** views get highlighted JSON (and other supported languages); **editable** mode is still text-based with validation feedback for JSON.
- Tuned for **large fragments**: above a size threshold, highlighting is reduced so the UI stays responsive (very large **non-JSON** read-only payloads may use a lightweight viewer instead).

Choose Classic when you want a **minimal, fast text-only** experience.

---

## Advanced

**Advanced** uses **vanilla-jsoneditor** (the `JsonEditor` UI component):

- **Two representations of the same JSON**: **Text** (code) and **Tree** (structured). You can switch from the editor toolbar; the last choice (**Text** vs **Tree**) is **remembered** in settings (`json.mode`).
- **Text mode**: formatting helpers (e.g. **Format** / **Compact** where editing is allowed), **Undo / Redo**, **Search**, copy, and the same editing model as the library.
- **Tree mode**: expand/collapse, **breadcrumb / path** navigation, context menus on nodes, and integrated sorting / editing flows provided by the app on top of the tree.

Choose Advanced when you need **tree navigation**, **history**, **search**, and richer editing around JSON.

---

## Summary

| | **Classic** | **Advanced** |
|---|-------------|--------------|
| **Engine** | Prism text (`JsonTextEditor`) | vanilla-jsoneditor |
| **Tree view** | No | Yes (Text + Tree) |
| **Typical use** | Lightweight text + highlighting | Structured editing + toolbar features |

---

## See also

- [Customize](/options/customize) — other **General** options (theme, background, saved files).
- [Display modes](/options/display_mode) — how the inspector panel is shown on the page.
