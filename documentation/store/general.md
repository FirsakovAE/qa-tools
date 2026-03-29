---
## title: Pinia stores
---
# Pinia stores

The **Stores** tab lists **Pinia** stores registered in the app: id, **state** / **getter** counts, and after row selection a snapshot of **state** and **getters** with editing and write-back where supported.

More on editing **state** / **getters** and **favorites**:

* [State](/store/state)
* [Getters](/store/getters)
* [Favorites](/store/favorite)

## Top toolbar

### Store search

Search and **Search by** follow the same logic as other tabs and can be preset in **Options** for **Stores**.

| Mode      | Purpose                                                                     |
| --------- | --------------------------------------------------------------------------- |
| **Name**  | filter by store name (local to the panel)                                   |
| **Key**   | match **field names** in **state** and **getters** (query sent to the page) |
| **Value** | match **field values** in **state** and **getters** (also on the page)      |

**Key** / **Value** use the global minimum length (default **2**).

**Partial vs exact.** Without quotes, matching uses substring search; exact matching applies when the full query is wrapped in **double quotes** `"..."`.

Content search is capped (around **~100** hits) to avoid overloading the page.

### Status chips

| Item             | Purpose                                                                         |
| ---------------- | ------------------------------------------------------------------------------- |
| **N** or **N/M** | Stores after filtering; with search, **M** is total stores in the last summary. |
| **Favorites** ★  | Matches with favorite stores. Click opens **Options** (Pinia favorites).        |
| **Refresh**      | **Refresh**, loading state, and last successful summary time (or “Loading…”).   |

The panel checks the page bridge before requesting summaries.

## Work area

### Store list

Left: store table. Columns (visibility in settings):

* **Name** — **baseId**;
* **State** — state key count (dash if none);
* **Getters** — getter count (dash if none).

Rows expose a **favorite** star and context menu; favorites live in inspector settings — [Favorites](/store/favorite).

### Store details

Selecting a row opens **State** / **Getters** tabs (when non-empty in the summary), a JSON editor (text/tree per settings), **edit/save**, and navigation back.

Editing constraints are described on [State](/store/state) and [Getters](/store/getters).

Card data is a **point-in-time snapshot** — refresh (**Refresh** on the toolbar or in the card) after external app changes.

## Display limits

### Reading

1. **Summary** — lightweight: ids, **baseId**, state/getter counts, timestamp — **no** full value dump.
2. **Single-store card** — serialized **state** and **getters** for display/edit.

Serialization applies depth and size guards; cycles, functions, and exotic objects may truncate or stringify differently than raw runtime.

**Key** / **Value** hit lists are intentionally limited.

### Capacity

No fixed max store count like **500 Network rows**; typical Pinia registration lists render fully.

Unusual setups may be incomplete; save errors surface in UI or console depending on store shape.

## How it works

### When collection starts

Pinia support activates **after Pinia is detected** (similar to **Props**: Vue + inspector must be present). If Pinia is missing or not ready, the list is empty or shows an error.

### What is monitored

1. **Summary** — ids, names, counts for the table.
2. **One store** — full serialized **state** / **getters** on demand.

This separates a **fast list** from **heavy reads** for one store.

### Messaging

The panel sends a bridge request to the page, where injected code reads `pinia._s` and store instances.

```js
const response = await bridge.send({ type: 'PINIA_GET_STORES_SUMMARY' })

const detail = await bridge.send({
  type: 'PINIA_GET_STORE_STATE',
  storeId: 'my-store-id',
})
```

`PINIA_SEARCH` runs on the page and returns matching store ids.

## See also

* [State](/store/state)
* [Getters](/store/getters)
* [Favorites](/store/favorite)
* [Update settings](/options/update_settings)