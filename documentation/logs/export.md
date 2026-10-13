---
title: Export and import
---

# Export and import

Events from the **Logs** tab can be saved to an **HTML** report and opened again — in any browser or with **Import Logs** in Vue Inspector. This is useful for bug reports, for sharing a scenario with colleagues and for analysis outside the page.

General information about the tab: [Working with logs](./general.md).

---

## Export format

Every export is one **HTML** file: a static report for reading plus the structured event data that **Import Logs** reads back. There is no separate JSON export.

The data inside the report is compact, like the live log (see [How events are stored](./general.md#how-events-are-stored)): store changes are diffs, a request and its response share one network entry, equal bodies are stored once. Titles, Before / After states and request / response details are restored when the report is opened.

The embedded data has a format version. Files from newer versions of Vue Inspector are rejected with a message instead of being misread.

---

## What is exported

### Export Logs

* Without a selection — all events visible in the table after **Search** and **Type** filters.
* With a selection — only the rows ticked in the checkbox column; the button shows **Export Logs (n)**.
* Network events are always exported as a pair: when only **Send request** or only **Receive response** of a request is filtered or selected, the other event is added to the file too.

The button is disabled while the filtered list is empty.

### Single event

**Export event** in the **⋮** menu of the details header or in the row context menu exports one event.

For network events the item is called **Export request & response**: the **Send request** and **Receive response** events of the same request are exported together in one file, so the request and its response are never separated.

### Pinia changes in a partial export

A **Change store** event is a diff against the previous event of the same store. When that previous event is not part of the export (a selection, a filter or a single event), the exported change also carries the full state after it and the old values of the changed fields, so **Before** / **After** stay available in the file.

### Files

| Export | File name |
| ------ | --------- |
| **Export Logs** | `logs_<date>_<time>.html` |
| Network pair | `log_network_<date>_<time>.html` |
| Other single event | `log_<type>_<date>_<time>.html` |

Data is masked at capture time, so the files contain the same masked values as the view (see [Logs settings](./settings.md#data-masking)).

---

## HTML report

The **HTML** report is one self-contained file: styles, scripts, the application icon and the event data are embedded. It uses a dark theme, does not load external resources and opens offline from disk.

### Sidebar

* **Report** — **Overview** and **All events** with the total count;
* sections by type with counters: **Network** (**Send request**, **Receive response**), **Components** (**Change props**, **Emit**), **Pinia** (**Change store**, **Store action**), **Page** (**Navigation**, **JS error**);
* **Download Vue Inspector** at the bottom — link to the project page.

### Overview

Summary cards: **Events**, **Errors**, **Failed requests**, first and last event time, time span; counters by type; export information.

**Events**, **Errors** and **Failed requests** are clickable: they open **All events** with the matching filter. The active filter is shown as a chip above the list; clicking the chip removes it.

### Event list and details

* Search in the top bar; with **in data** enabled the search also looks inside event data.
* Clicking a row opens details with the same tabs as in the app (**Overview**, **Params**, **Headers**, **Body**, **Changes**, **Before** / **After**, **State**, **Raw**, etc.).
* For network events, the button next to **Close** jumps between the request and its response.
* **↑ / ↓** move between events, **Esc** closes details.
* The selected section and event are kept in the address (`#…`), so a link to a specific event can be shared and survives a reload.

---

## Import

**Import Logs** opens an **HTML** report exported from the **Logs** tab. **JSON** and **HTML** files exported by earlier versions open too.

* Imported events are shown in a separate read-only view. The banner shows the file name, the number of events and the export time.
* **Back to live logs** returns to live recording; live events are not lost while a file is open.
* Invalid events are skipped (the number is shown in the import message).
* HTML files that are not a Logs report are rejected with a message.
* Imported data goes through the current masking settings once more.

In files from earlier versions the request and response halves of a network entry are joined back into one entry.

---

## See also

* [Working with logs](./general.md)
* [Logs settings](./settings.md)
* [Export collections](/network/export)
