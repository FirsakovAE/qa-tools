---
title: Components and props
---

# Components and props

The **Props** tab shows the **Vue instance tree** on the page: component names, link to the root DOM node, and props summaries. Full values load when you select a row; you can edit and write back where supported.

**Inspect mode**, **favorites**, and the **component blacklist** are covered on separate pages: [Inspect](/props/inspect), [Favorites](/props/favorite), [Blacklist](/props/blacklist).

## Top toolbar

![Props, область заголовка](/screenshots/Props_header.jpg)

### Component search

The search field supports several modes. Active criteria come from **Search by** next to the input. The same checkboxes are the first block on **Options → Props**, under **Search Settings**: **Search by component name**, **Search by root element**, **Search by key**, **Search by value**. Defaults: name and root element on; key and value off. A change applies to the open Props list immediately.

On **Options → Props** the blocks follow in this order: **Search Settings**, **Inspect Mode**, **Component Blacklist**, **Favorite Components**. Inspect, the blacklist, and favorites are described on their own pages.

| Mode      | What the list uses                                                                                          |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| **Name**  | component `name`                                                                                            |
| **Root**  | the **Root Element** string (`tag`, `#id`, `.classes`, `[data-testid]`, or `Logic only`)                   |
| **Key**   | prop names, including nested keys                                                                           |
| **Value** | prop values, including nested values                                                                        |

A non-empty query keeps a row when any enabled mode matches (**Name**, **Root**, **Key**, **Value**). With all of them off, the query matches nothing.

Minimum length applies to every mode. Default **2** characters and **300 ms** debounce, from **Options → General → Search Parameters** ([Update settings](/options/update_settings)). A shorter non-empty query does not start a new search; the previous result stays until the field is cleared or the query reaches the minimum.

**Key** and **Value** ask the page for matches. If that request fails, they match nothing; **Name** and **Root** still filter in the panel. The local fallback walks `props` to depth 20.

**Partial vs exact.** If the query is **not** wrapped in quotes, enabled text modes use **substring** matching (case-insensitive). **Exact** whole-string match applies when the **entire** search text is wrapped in **double quotes** `"..."`.

**Inspect** next to search picks a node on the page to filter the list; see [Inspect](/props/inspect).

### Status chips

Right side of **Props**:

| Item                       | Purpose                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| **Filtered** (amber badge) | A page-element filter (**Inspect**) is active. Click clears the filter and restores the full list. |
| **N** or **N/M**           | **N** is visible rows. **/M** appears only when the search field is not empty and the counts differ. The Inspect filter alone does not add **/M**. |
| **Favorites** ★            | Visible favorites / saved total, or `0` when none are saved. Yellow when at least one visible row is a favorite. Click opens **Options → Props → Favorite Components**. |
| **Update**                 | **Refresh** button and last snapshot time (`lastUpdated`).                                       |

## Work area

![Props, полноэкранный режим](/screenshots/Props_full_screen.jpg)

### Component list

Left: the component table. **Name** is always shown. The column menu toggles **Root Element**, **Received**, and **Declared**; all three default to on.

* **Name** — component name;
* **Root Element** — `tag#id.class[data-testid]`, or `Logic only` when there is no DOM node. The cell truncates at 25 characters; the full string is the tooltip. `Logic only` uses the warning badge;
* **Received** — count of props actually passed;
* **Declared** — count of props declared on the component.

A row with no received props is dimmed, shows **—** in **Received** and **Declared**, and does not open the card. The empty list says **No components found**.

Hover highlights the page node only when the row has a DOM element. A `Logic only` row clears the highlight. Favorite rows do not take the hover background. Search clears the highlight.

The row menu is **Ask AI**, **Add favorite** / **Remove favorite**, and **Ignore by name**. The star on the row does the same favorite toggle. See [Favorites](/props/favorite) and [Blacklist](/props/blacklist).

**Ask AI** in the row menu attaches the current props of the component to a question for the assistant. The **AI** tab opens with a chip above the input, for example *OrderCard props*: **×** removes it from the question. Type a question, or send the chip without one. Values are masked by the AI settings and cut; with **Values of store state, props, emits and actions** off, the assistant gets only names and types. The item is disabled for a component without props.

## Component details

Selecting a component row that has received props opens the detail panel. With nothing selected the panel says **Select a component to see details**.

### Summary header

The top of the panel shows:

* component name;
* short **root DOM** info (tag and classes), truncated at 40 characters with a tooltip for the rest. When the row has no root element the badge shows `div` (the table shows `Logic only`);
* size of the serialized **Received** payload, hidden when that payload is empty;
* an **Updated:** line with the node timestamp, or **—** when the node has none.

### Component data

Two tabs below:

| Tab          | Purpose                                                                       |
| ------------ | ----------------------------------------------------------------------------- |
| **Received** | props actually passed; view and edit supported                                |
| **Declared** | declared prop definitions (**rawProps**); view only                          |

Both tabs are always available.

The active tab is shown as **JSON**—text or tree—according to inspector settings.

The editor supports **copying** the contents.

### Navigation

* **← Back** closes the card, including during edit;
* **Esc** in edit mode discards the draft and stays on the card;
* **Esc** outside edit mode closes the card.

### Controls

| Control     | Purpose                                                                                                                                 |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Star**    | add or remove from favorites; always available                                                                                         |
| **Refresh** | re-fetch the selected component from the page; temporarily disabled while a refresh runs; **hidden** in **Edit** mode                  |
| **Edit**    | enter edit mode; **only on the Received** tab                                                                                          |

Button order in the header (view mode): **Star → Refresh → Edit**.

### Edit mode

**Edit** applies **only** to the **Received** tab.

When editing, **Refresh** and **Edit** become **Cancel** and **Save**. **Star** stays available.

| Before editing | In edit mode                                                                 |
| -------------- | ----------------------------------------------------------------------------- |
| **Refresh**    | **Cancel** — revert the draft to the last loaded props and leave edit mode    |
| **Edit**       | **Save** — write changes to the app                                           |

* **Save** is disabled if JSON fails validation;
* changes apply only after **Save**;
* there is no toast. If the page rejects the write, edit mode still closes and the editor keeps the draft until the next props update; the failure is in the console. If save throws, edit mode stays open.

**Removing keys.** A prop deleted from the JSON gets the value Vue uses when the parent does not pass that prop:

* the prop's **default** (a factory function is called);
* `false` for **Boolean** props without a default;
* otherwise `undefined`.

Keys deleted inside an object prop are removed from the object. This lets you check how a component behaves when optional data is missing. After saving, the card shows the edited JSON; use **Refresh** to see the resolved values.

The **favorite** star in this panel and in the table is described on [Favorites](/props/favorite).

Card data reflects the **last successful** update for the selected node—use **Refresh** in the detail header to re-query props from the page, or toolbar **Refresh** on **Props** for a full snapshot refresh.

## Display limits

### Reading limits

**Props on demand:** opening a card reads and serializes values for the detail panel; heavy objects hit serializer limits (below).

The light table sends metadata and counts without full serialization of every value on each update.

### Storage

There is no fixed “N rows like **Network**” cap for **Props**: size depends on component count and injected-side cache policy (snapshots are pruned where a node is not expanded and not needed).

To avoid blocking the page main thread, prop serialization applies limits including:

* time budget per serialization pass;
* max nesting depth and array/object size;
* long string truncation and a cap on nodes per response.

Very large or cyclic structures may appear incomplete or marked as truncated—expected safeguard behavior.

## How it works

### When collection starts

The Props module attaches **after Vue is detected** on the page (unlike **Network**, which starts with the general inspector script). Until Vue initializes or the inspector is injected in the tab, the component list stays empty.

After the first successful load you can refresh manually (**Refresh**) or on a schedule (**auto refresh** in **Options**).

### What is monitored

1. **Structure** — walking Vue instances yields a flat list with metadata (name, label when present, element binding, **received** and **declared** counts without full values every frame).
2. **Props on selection** — full values load when you open a card (lazy).

The same channel refreshes after **Toolbar** **Refresh**, respecting the active **blacklist** (name filtering during collection—see [Blacklist](/props/blacklist)).

### Messaging model

The panel does not read Vue memory directly: it sends a message to the page; injected code walks instances and returns serialized data.

Simplified flow:

```js
// Illustration: UI requests the component list; the page scanner builds structure.
const response = await bridge.send({
  type: 'COLLECT_VUE_COMPONENTS',
  forceRefresh: true,
  blacklist: { active: ['SomeNoise'], inactive: [] },
})
// response.components — names, uid, prop counts, Root Element strings…
// Full prop payloads load separately when a card opens (lazy).
```

This separates the **light table** from **heavy prop reads** for the selected node only.

## See also

* [Inspect — pick a component on the page](/props/inspect)
* [Favorites](/props/favorite)
* [Blacklist](/props/blacklist)
* [Update settings & auto refresh](/options/update_settings) (**Options**)
