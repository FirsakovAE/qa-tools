---
title: Pinia stores
---

# Working with Pinia stores

The **Stores** tab lists **Pinia** stores registered in the app: id, **state** / **getter** counts, and after row selection a snapshot of **state** and **getters** with editing and write-back where supported.

More on editing **state** / **getters** and **favorites**:

* [State](/store/state)
* [Getters](/store/getters)
* [Favorites](/store/favorite)

## Top toolbar

### Store search

Search and **Search by** mirror **Options** presets for this tab.

| Mode | Purpose |
| ---- | ------- |
| **Name** | filter by store name (local to the panel) |
| **Key** | match **names** of fields in **state** and **getters** (query sent to the page) |
| **Value** | match **values** in **state** and **getters** (also on the page) |

**Key** / **Value** use the global minimum length (default **2**).

**Partial vs exact:** substring without quotes; **exact** when the whole query is in **double quotes** `"..."`.

Content search is capped (on the order of **~100** hits) to avoid overloading the page.

### Status chips

| Item | Purpose |
| ---- | ------- |
| **N** or **N/M** | Stores after filter; with search, **M** is total stores in the last summary. |
| **Favorites** ★ | Matches with favorite stores. Click opens **Options** (Pinia favorites). |
| **Refresh** | **Refresh**, loading state, last successful summary time (or “Loading…”). |

The panel checks the page bridge before requesting summaries.

## Work area

### Store list

Left: store table. Columns (visibility in settings):

* **Name** — **baseId**;
* **State** — state key count (dash if none);
* **Getters** — getter count (dash if none).

Rows expose a **favorite** star and context menu; favorites live in inspector settings — [Favorites](/store/favorite).

### Store details

Selecting a row opens **State** / **Getters** tabs (when non-empty in the summary), JSON editor (text/tree per settings), **edit/save**, and navigation back. Editing constraints: [State](/store/state), [Getters](/store/getters).

Card data is a **point-in-time snapshot** — refresh (**Refresh** on the toolbar or in the card) after external app changes.

## Display limits

### Reading

1. **Summary** — lightweight: ids, **baseId**, state/getter **counts**, timestamp — **no** full value dump.
2. **Single-store card** — serialized **state** and **getters** for display/edit.

Serialization respects depth/size guards; cycles, functions, exotic objects may truncate or stringify differently than raw runtime.

**Key** / **Value** hit lists are intentionally limited.

### Capacity

No fixed max store count like **500** **Network** rows; typical Pinia registration lists render fully.

Unusual setups may be incomplete; save errors surface in UI or console depending on store shape.

## How it works

### When collection starts

Pinia support activates **after Pinia is detected** (similar to **Props**: Vue + inspector must be present). If Pinia is missing or not ready, the list is empty or shows an error.

### What is monitored

1. **Summary** — ids, names, counts for the table.
2. **One store** — full serialized **state** / **getters** on demand.

This splits a **fast list** from **heavy reads** for one store.

### Messaging

The panel talks to the page; injected code reads `pinia._s` and store instances.

Illustration:

```js
// Summary — ids, names, key counts, no full state dump
const response = await bridge.send({ type: 'PINIA_GET_STORES_SUMMARY' })

const detail = await bridge.send({
  type: 'PINIA_GET_STORE_STATE',
  storeId: 'my-store-id',
})
// detail.state, detail.getters — for UI and PATCH / REPLACE when supported
```

`PINIA_SEARCH` runs on the page and returns matching store ids.

## See also

* [State](/store/state)
* [Getters](/store/getters)
* [Favorites](/store/favorite)
* [Update settings](/options/update_settings)
