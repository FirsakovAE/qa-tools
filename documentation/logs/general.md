---
title: Working with logs
---

# Working with logs

The **Logs** tab is a single chronological journal of what happens on the page: network requests, component props and emits, **Pinia** changes and actions, SPA navigation and JS errors. It helps to reconstruct a scenario step by step and to hand it over as a file.

The tab is always visible, comes after **Pinia Store**, and works the same way in the extension and in **Bookmark** ([Standalone](/standalone)) mode.

## Event types

| Type | What is logged |
| ---- | -------------- |
| **Send request** | Outgoing **fetch** / **XMLHttpRequest** call: URL, method, initiator, **Params**, request **Headers**, **Authorization**, request **Body** |
| **Receive response** | Response to that call: status, duration, size, response **Headers**, response **Body**, network error |
| **Change props** | Changed props of a component: list of changes and full **Before** / **After** snapshots |
| **Emit** | Component event: component, event name, arguments, listener type (**regular** / **once**), parent chain |
| **Change store** | Changed **Pinia** state: list of changes and full **Before** / **After** snapshots |
| **Store action** | **Pinia** action call: arguments, result or error, status, duration |
| **Navigation** | SPA navigation: **pushState**, **replaceState**, **popstate**, **hashchange** with **From** / **To** |
| **JS error** | Uncaught error or unhandled promise rejection: message, location, stack |

Each network call produces **two** events. **Send request** stores only what was sent, **Receive response** stores only what came back; both keep the URL and method so the pair can be found. After a request is edited at a [Breakpoint](/network/traffic), both events contain the data that was actually sent and received.

## Top toolbar

### Search

The search box filters the table. The active criteria are set in **Options → Logs → Search Settings** (see [Logs settings](./settings.md)):

| Mode | Description |
| ---- | ----------- |
| **By event name** | Title, component, store, URL |
| **By key** | Keys in the payload and changed paths |
| **By value** | Values in the payload |

As in other tabs, a query **without** quotes matches a substring, a query wrapped in **double quotes** `"..."` matches exactly. The minimum query length comes from the inspector search settings (default **2** characters).

### Type

**Type** limits the table to the selected event types. All types are enabled by default. If every type is turned off, the table is empty and shows a hint to enable types again.

### Status indicators

| Item | Purpose |
| ---- | ------- |
| **N** or **N/M** | Rows after filters; with an active search or **Type** filter, **M** is the total number of events in the buffer |
| **ignored** | Number of ignored event groups. Click opens **Ignored events**: remove a single rule or **Clear all** |
| **Paused** | Recording of new events is paused |

### Log controls

| Control | Purpose |
| ------- | ------- |
| **Pause** / **Resume** | Stop and resume recording new events |
| **Clear** | Remove all recorded events |
| **Export Logs** | Export events to a file (see [Export and import](./export.md)) |
| **Import Logs** | Open an exported **JSON** or **HTML** file |

## Work area

### Events table

| Column | Content |
| ------ | ------- |
| Checkbox | Selection for export |
| **Time** | Event time with milliseconds |
| **Type** | Colored type badge |
| **Event** | Title and short description (method and path, component and event, store and changed keys, etc.) |

Rows are highlighted by level: **4xx** responses — warning; **5xx**, network errors, failed actions and JS errors — error.

### Selection for export

The first column contains checkboxes, in the same position as the favorites star in **Props** and **Pinia**.

| Action | Result |
| ------ | ------ |
| Click a checkbox | Select / unselect a row |
| **Shift** + click | Select a range from the last clicked row |
| **Ctrl / Cmd** + click on a row | Toggle a row without opening details |
| **Ctrl / Cmd** + **A** (table focused) | Select all filtered rows |
| Header checkbox | Select all / clear selection |

When rows are selected, the button shows **Export Logs (n)** and exports only them. Without a selection, all filtered events are exported.

### Event details

Clicking a row opens details on the right. The layout follows **Network**: a tab strip, name/value tables and **JSON** blocks in the selected [JSON mode](/options/json_mode).

| Type | Tabs |
| ---- | ---- |
| **Send request** | **Overview**, **Params (n)**, **Headers**, **Body**, **Raw** |
| **Receive response** | **Overview**, **Headers**, **Body**, **Raw** |
| **Change props**, **Change store** | **Changes (n)**, **Before**, **After**, **Raw** |
| **Store action** | **Overview**, **Arguments**, **Result** / **Error**, **Raw** |
| **Emit** | **Arguments (n)**, **Overview**, **Raw** |
| **Navigation**, **JS error** | **Overview**, **Stack** (errors), **Raw** |

**Changes** shows a diff by path: added, removed and changed values with the old and new value. Very large diffs are truncated; the full state stays available on **Before** / **After**.

If a network body was larger than the configured event size, **Body** shows a notice with the original size.

### Event actions

Actions are available in the **⋮** menu of the details header and in the row context menu (right click or **⋮** in the row):

| Action | Purpose |
| ------ | ------- |
| **Export event** | Export one event. For network events the item is **Export request & response**: both events of the request go into one file |
| **Copy cURL** | Copy the request as a cURL command. For **Receive response** the command is built from its paired **Send request** |
| **Open request event** / **Open response event** | Jump to the paired network event |
| **Ignore** | Stop logging this group of events |

**Ignore** works per group: the same request (method and path), the same component, the same store, and so on. Ignored groups are not recorded at all; they can be logged again from **Options → Logs → Ignore list**.

## How it works

### When recording starts

Recording starts together with the rest of Vue Inspector in the tab context. Events are kept in the page, so the history is available when **Logs** is opened later, without reloading the page.

### Limits

Every event type is a ring buffer: when it is full, the oldest events are overwritten. A shared memory budget and a maximum event size keep long sessions stable. Defaults and settings are described in [Logs settings](./settings.md).

### Data masking

Sensitive data is masked **when an event is captured**, so it never reaches the view, exports or imports: passwords, tokens, cookies, authorization headers, card numbers and similar keys, as well as **JWT**, **Bearer** / **Basic** credentials and card numbers inside any text.

## See also

* [Export and import](./export.md)
* [Logs settings](./settings.md)
* [Working with requests](/network/general)
