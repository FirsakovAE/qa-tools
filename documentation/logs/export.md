---
title: Export and import
---

# Export and import

Events from the **Logs** tab can be saved to a file and opened again — in Vue Inspector or, for **HTML**, in any browser. This is useful for bug reports, for sharing a scenario with colleagues and for analysis outside the page.

General information about the tab: [Working with logs](./general.md).

---

## Export format

The format is set in **Options → Logs → Export** and applies to every export from the tab:

| Format | Purpose |
| ------ | ------- |
| **HTML** (default) | Static report that opens in any browser and can be imported back |
| **JSON** | Raw events for re-import or for tools |

**Export Logs** downloads the file in the selected format right away.

---

## What is exported

### Export Logs

* Without a selection — all events visible in the table after **Search** and **Type** filters.
* With a selection — only the rows ticked in the checkbox column; the button shows **Export Logs (n)**.

The button is disabled while the filtered list is empty.

### Single event

**Export event** in the **⋮** menu of the details header or in the row context menu exports one event.

For network events the item is called **Export request & response**: the **Send request** and **Receive response** events of the same request are exported together in one file, so the request and its response are never separated.

Single-event exports use the same format setting as **Export Logs**.

### Files

| Export | File name |
| ------ | --------- |
| **Export Logs** | `logs_<date>_<time>.html` / `.json` |
| Network pair | `log_network_<date>_<time>.html` / `.json` |
| Other single event | `log_<type>_<date>_<time>.html` / `.json` |

Data is masked at capture time, so the files contain the same masked values as the view (see [Logs settings](./settings.md#data-masking)).

---

## HTML report

The **HTML** report is one self-contained file: styles, script, the application icon and the event data are embedded. It uses a dark theme, does not load external resources and opens offline from disk.

### Sidebar

* **Report** — **Overview** and **All events** with the total count;
* sections by type with counters: **Network** (**Send request**, **Receive response**), **Components** (**Change props**, **Emit**), **Pinia** (**Change store**, **Store action**), **Page** (**Navigation**, **JS error**);
* **Download Vue Inspector** at the bottom — link to the project page.

### Overview

Summary cards: **Events**, **Errors**, **Failed requests**, first and last event time, time span; counters by type; export information.

**Events**, **Errors** and **Failed requests** are clickable: they open **All events** with the matching filter. The active filter is shown as a chip above the list; clicking the chip removes it.

### Event list and details

* Search in the top bar; with **in data** enabled the search also looks inside event data.
* Clicking a row opens details with the same tabs as in the app (**Overview**, **Params**, **Headers**, **Body**, **Changes**, **Before** / **After**, **Raw**, etc.).
* For network events, the button next to **Close** jumps between the request and its response.
* **↑ / ↓** move between events, **Esc** closes details.
* The selected section and event are kept in the address (`#…`), so a link to a specific event can be shared and survives a reload.

---

## Import

**Import Logs** opens a file exported from the **Logs** tab — **JSON** or **HTML**.

* Imported events are shown in a separate read-only view. The banner shows the file name, the number of events and the export time.
* **Back to live logs** returns to live recording; live events are not lost while a file is open.
* Invalid events are skipped (the number is shown in the import message).
* HTML files that are not a Logs report are rejected with a message.
* Imported data goes through the current masking settings once more.

Files with full network entries from earlier versions also open: details show only the sections of the event's own type.

---

## See also

* [Working with logs](./general.md)
* [Logs settings](./settings.md)
* [Export collections](/network/export)
