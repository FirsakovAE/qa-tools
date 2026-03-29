---
title: Components and props
---

# Components and props

The **Props** tab shows the **Vue instance tree** on the page: component names, link to the root DOM node, and props summaries. Full values load when you select a row; you can edit and write back where supported.

**Inspect mode**, **favorites**, and the **component blacklist** have dedicated pages: [Inspect](/props/inspect), [Favorites](/props/favorite), [Blacklist](/props/blacklist).

## Top toolbar

### Component search

The search box supports several modes. Active criteria come from **Search by** next to the input. You can preset the same types under **Options** for this tab.

| Mode | Purpose |
| ---- | ------- |
| **Name** | component name |
| **Label** | `label` string / suitable instance metadata |
| **Root** | root element hints |
| **Key** | prop names (including nested), deep search runs in the page |
| **Value** | prop values (including nested), queried on the page |

**Key** and **Value** enforce a minimum length (default **2** characters; configurable).

**Partial vs exact.** Without quotes, text modes use **substring** (case-insensitive). **Exact** whole-string match requires **double quotes** `"..."` around the full query.

**Inspect** next to search picks a node on the page to filter the list; see [Inspect](/props/inspect).

### Status chips

Right side of **Props**:

| Item | Purpose |
| ---- | ------- |
| **Filtered** (amber) | Filtering by a page element (**Inspect**). Click clears the filter and reloads the full list. |
| **N** or **N/M** | Visible rows after filtering; with search, **M** is total components in the snapshot. |
| **Favorites** ★ | Matches between the current tree and saved favorites. Click opens **Options** favorites. |
| **Refresh** | **Refresh** button and last snapshot time (`lastUpdated`). |

## Work area

### Component list

Left: the component table. Main columns (toggles in table settings):

* **Name** — component name;
* **Root Element** — root DOM info (tag, classes, id when available);
* **Passed** — received props count;
* **Declared** — declared props count.

Hovering a row highlights the matching node in the page.

The row context menu and star tie into [favorites](/props/favorite) and [blacklist](/props/blacklist).

### Component details

Selecting a row opens a panel with:

* instance summary;
* **props** (text or tree JSON per editor settings);
* **refresh** and (where supported) **edit/save** back to the app.

The **favorite** star here is described on [Favorites](/props/favorite).

## Display limits

### Reading limits

**Props on demand:** opening a card reads and serializes values; heavy objects hit serializer limits (below).

The light table lists metadata and counts without full serialization every frame.

### Storage

There is no fixed “**N rows like Network**” cap: size depends on component count and injected-side caches (pruned when nodes are not expanded/needed).

To protect the main thread, serialization applies limits such as:

* time budget per pass;
* max depth and array/object size;
* long string truncation and max node count per response.

Huge or cyclic structures may appear truncated — expected protection behavior.

## How it works

### When collection starts

The Props module attaches **after Vue is detected** (unlike **Network**, which starts with the general inspector script). If Vue is not ready or the inspector is not injected, the list stays empty.

After first success you can refresh manually (**Refresh**) or on a timer (**auto refresh** in **Options**).

### What is monitored

1. **Structure** — traversing instances yields a flat list with metadata (name, label, element binding, passed/declared counts without full values each frame).
2. **Props on selection** — full values load lazily for the open card.

The same channel refreshes after **Refresh**, honoring the active **blacklist** (names filtered during collection — see [Blacklist](/props/blacklist)).

### Messaging model

The panel does not read Vue memory directly: it posts to the page; injected code walks instances and returns serialized data.

Simplified loop:

```js
// Illustration: UI asks for components; the page scanner builds structure.
const response = await bridge.send({
  type: 'COLLECT_VUE_COMPONENTS',
  forceRefresh: true,
  blacklist: { active: ['SomeNoise'], inactive: [] },
})
// response.components — names, uid, prop counts, Root Element strings…
// Full prop payloads load separately when a card opens (lazy).
```

This separates the **light table** from **heavy prop reads** for one node.

## See also

* [Inspect](/props/inspect)
* [Favorites](/props/favorite)
* [Blacklist](/props/blacklist)
* [Update settings & auto refresh](/options/update_settings) (**Options**)
