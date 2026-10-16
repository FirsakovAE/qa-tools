---
title: Working with logs
---

# Working with logs

The **Logs** tab is a single chronological journal of what happens on the page: network requests, component props and emits, **Pinia** changes and actions, SPA navigation and JS errors. It helps to reconstruct a scenario step by step and to hand it over as a file.

The tab is always visible, comes after **Pinia Store**, and records events the same way in the extension and in **Bookmark** ([Standalone](/standalone)) mode.

## Event types

| Type | What is logged |
| ---- | -------------- |
| **Send request** | Outgoing **fetch** / **XMLHttpRequest** call: URL, method, initiator, **Params**, request **Headers**, **Authorization**, request **Body** |
| **Receive response** | Response to that call: status, duration, size, response **Headers**, response **Body**, network error |
| **WebSocket open** | The connection opened: URL and handshake **Headers**. Its own type in the **Type** filter |
| **WebSocket sent** | One outgoing frame. Each frame is its own event |
| **WebSocket received** | One incoming frame. Each frame is its own event |
| **WebSocket closed** | Close of that connection: close code, reason, duration, size, and **No automatic reconnect** when the protocol says the client will not open a new socket |
| **Change props** | Changed props of a component: list of changes and full **Before** / **After** snapshots |
| **Emit** | Component event: component, event name, arguments, listener type (**regular** / **once**), parent chain |
| **Change store** | Changed **Pinia** state: list of changes and full **Before** / **After** snapshots. The type also includes the store's base states: **Store initialized**, **Store snapshot** and **Store checkpoint** (see [How events are stored](#how-events-are-stored)) |
| **Store action** | **Pinia** action call: arguments, result or error, status, duration |
| **Navigation** | SPA navigation: **pushState**, **replaceState**, **popstate**, **hashchange** with **From** / **To**. When logging starts, and after **Clear**, the current page is recorded as **snapshot** |
| **JS error** | Uncaught error, unhandled promise rejection or `console.error` of the page: message, source, location, compact stack (see [JS errors](#js-errors)) |

Each network call produces **two** events that share one network entry. **Send request** shows what was sent, **Receive response** shows what came back. A WebSocket writes a separate event for the open connection (**WebSocket open**), for every sent frame, for every received frame and for the close. Those four types are in the **Type** filter. They share one stored connection, so the handshake and the frame text are kept once. After a request is edited at a [Breakpoint](/network/traffic), both events show the data that was actually sent and received.

## Top toolbar

### Search

The search box filters the table. The active criteria are set in **Options → Logs → Search Settings** (see [Logs settings](./settings.md)):

| Mode | Description |
| ---- | ----------- |
| **By event name** | Title, component, store, URL |
| **By key** | Keys in the payload and changed paths |
| **By value** | Values in the payload |

For **Change store** and **Change props**, key and value search looks at the changed paths and values; full states are searched in the **Store initialized**, **Store snapshot** and **Store checkpoint** events.

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
| **Export Logs** | Export events to an **HTML** report (see [Export](./export.md)) |

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
| Header checkbox | Select all / clear selection |

When rows are selected, the button shows **Export Logs (n)** and exports only them. Without a selection, all filtered events are exported.

### Event details

Clicking a row opens details on the right. The layout follows **Network**: a tab strip, name/value tables and **JSON** blocks in the selected [JSON mode](/options/json_mode).

| Type | Tabs |
| ---- | ---- |
| **Send request** | **Overview**, **Params (n)**, **Headers**, **Body**, **Raw** |
| **Receive response** | **Overview**, **Headers**, **Body**, **Raw** |
| **WebSocket open** | **Overview**, **Headers**, **Messages (n)**, **Raw** |
| **WebSocket sent**, **WebSocket received** | **Overview**, **Headers**, **Message**, **Raw** |
| **WebSocket closed** | **Overview**, **Headers**, **Messages (n)**, **Raw** |
| **Change props**, **Change store** | **Changes (n)**, **Before**, **After**, **Raw** |
| **Store initialized**, **Store snapshot**, **Store checkpoint** | **Overview**, **State**, **Raw** |
| **Store action** | **Overview**, **Arguments**, **Result** / **Error**, **Raw** |
| **Emit** | **Arguments (n)**, **Overview**, **Raw** |
| **Navigation**, **JS error** | **Overview**, **Stack** (errors), **Raw** |

**Changes** shows a diff by path: added, removed and changed values with the old and new value. Very large diffs are truncated; the full state stays available on **Before** / **After**.

**Before** / **After** of a store change are restored from the store's base state and the changes after it. When that is impossible (the earlier events of the store are no longer in the log), the tab says so and **Changes** still shows the changed values; a value that cannot be restored is shown as *not available*.

**Raw** shows the event with all restored fields.

If a network body was larger than the configured event size, **Body** shows a notice with the original size.

A binary **Receive response** uses the same bar as **Network**, directly under the section tabs: content type, size and a **Binary** badge, for example `image/jpeg (986.2 KB)`. A supported image is shown under that bar. A type that cannot be shown has **Preview unavailable** and **Preview is not supported for this file format.** **Duration** on **Store action** and **Receive response** is shown with two digits after the decimal point (`635.90 ms`).

### Event actions

Actions are available in the **⋮** menu of the details header and in the row context menu (right click or **⋮** in the row):

| Action | Purpose |
| ------ | ------- |
| **Export event** | Export one event. For network events the item is **Export request & response**: both events of the request go into one file. A WebSocket event exports that one event |
| **Copy cURL** | Copy the request as a cURL command (also available on **Receive response**: both events share the request data). WebSocket events do not have this action |
| **Open request event** / **Open response event** | Jump to the paired network event. A WebSocket uses **Open connection event** / **Open close event** |
| **Ignore** | Stop logging this group of events |

**Ignore** works per group: the same request (method and path), the same component, the same store, and so on. Ignored groups are not recorded at all; they can be logged again from **Options → Logs → Ignore list**.

## How it works

### When recording starts

Recording starts together with the rest of Vue Inspector in the tab context. Events are kept in the page, so the history is available when **Logs** is opened later, without reloading the page.

### How events are stored {#how-events-are-stored}

Events keep only primary data; titles, descriptions and full states are derived when an event is shown.

* **Pinia.** When a store is created while logging is running, a **Store initialized** event records its full state. When logging starts on a store that already exists, a **Store snapshot** event records its current state. After that, every **Change store** event stores only the changes. **Before** / **After** are rebuilt from the base state and the changes up to the event. Switching Inspector tabs does not create new snapshots. A new snapshot is recorded after **Clear** and after masking settings change. A recorded state is split like on the **Pinia Store** tab: `state` holds the declared state, `getters` holds getters and data the store keeps outside its declared state (for example, fields assigned in actions of an options store with an empty `state()`). Changes of both are tracked, so change paths start with `state.` or `getters.`.
* **Network.** **Send request** and **Receive response** reference one shared network entry. WebSocket events reference one shared connection: the open event, each frame and the close. Equal response or request bodies (for example, a polled endpoint) are stored once. A duration tick while the socket stays quiet does not add a new event.
* **Shared snapshots.** Identical values inside any event — props, store state, action arguments and results, emit arguments, errors, navigation — are stored once. Each later copy is a reference to that snapshot. The Logs tab and the HTML report restore the full value, so the data you see is the data that was captured.

### Limits

A shared memory budget keeps long sessions stable: when it is reached, the oldest events are dropped. Events are kept whole by default; a maximum event size can be switched on. Groups of events can be switched off completely. Defaults and settings are described in [Logs settings](./settings.md).

Old **Change store** events are not simply dropped: they are compacted into a **Store checkpoint** with the store state at that point, so the history becomes *initial state → checkpoint → recent changes*. The initial state is kept, every remaining change can still be restored, and the compacted changes are no longer listed one by one (the checkpoint shows how many were compacted).

### JS errors {#js-errors}

**JS error** events come from three sources, shown in **Overview** as **Source**: **Uncaught error**, **Unhandled rejection** and **console.error**.

* **Only the inspected page.** Whether an error is the page's is decided by where it comes from (the caller in the stack), not by its text. Messages and errors of Vue Inspector itself and of other browser extensions are not logged. This includes Vue Inspector's internal reports about failed **fetch** / **XHR** requests: such a request is already a **Network** event. The app's own `console.error` about a failed request is kept.
* **console.error.** The message is built like in the browser console (`%s`, `%d`, `%o` and similar are applied, objects are shown as a short preview); object arguments are kept in **Raw**. **Location** points to the line of the app that called `console.error`, or to the top frame of an error passed to it. More than 50 messages per second are not logged; the next event shows how many were skipped (**Suppressed**).
* **Compact stack.** The message is kept. A stack longer than 10 frames keeps the first 5 and the last 5; the middle is replaced by *… N more frames (stack truncated)*. **Overview** shows **Stack: Truncated** with how many frames were kept from each end.

Errors of the inspected page stay in the page console and in **Logs**. They are not added to the extension error list (`chrome://extensions`); that list shows only failures of Vue Inspector itself. A page exception from **WebSocket** `send` or `close`, such as **WebSocket is already in CLOSING or CLOSED state**, is included: the wrapper that records the frame runs in the page. While logging runs, a page `console.error` passes through a small page-side bridge, so the browser console may attribute that line to the bridge. The message and the stack are unchanged.

### Data masking

Sensitive data is masked **when an event is captured**, so it never reaches the view or exports: passwords, tokens, cookies, authorization headers, card numbers and similar keys, as well as **JWT**, **Bearer** / **Basic** credentials and card numbers inside any text.

## See also

* [Export](./export.md)
* [Logs settings](./settings.md)
* [Working with requests](/network/general)
