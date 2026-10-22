const c=`---\r
title: Browser extension\r
---\r
\r
### Chrome / Edge extension\r
\r
> Primary launch mode for Vue Inspector with automatic launch, separate window mode, popup menu access, and browser integration.\r
\r
## Data storage\r
\r
Settings and saved media are stored in **browser profile storage** (separate from the sites being inspected): once saved in Options, the same data becomes available across all tabs. Comparison with standalone mode and storage details by data type are described in [Installation → Where settings are stored](./install#storage).\r
\r
---\r
\r
## Installation\r
\r
1. Open the <a href="../../index.html#installation" target="_self" rel="noopener">installation section</a> on the main project page.\r
2. Download the latest extension archive;\r
3. Extract it to a convenient folder;\r
4. Open \`chrome://extensions/\`;\r
5. Enable **Developer mode** in the upper-right corner;\r
6. Click **Load unpacked**;\r
7. Select the extension folder.\r
\r
---\r
\r
## Usage\r
\r
After installation, the extension becomes available in the browser and can launch according to your current settings.\r
\r
It can also be launched manually from the extension popup when needed.\r
\r
---\r
\r
## Incognito mode\r
\r
To use the extension in incognito mode:\r
\r
1. Open \`chrome://extensions/\`;\r
2. Find **Vue Inspector** in the installed extensions list;\r
3. Open **Details**;\r
4. Enable **Allow in incognito**.\r
\r
The extension will then also be available in private browser windows.\r
`,h=`---\r
title: General UI principles\r
---\r
\r
# General UI principles\r
\r
High-level patterns shared across Vue Inspector panels. For **where** the UI runs (overlay, DevTools tab, standalone window), see [Display modes](/options/display_mode) and [Installation](/install).\r
\r
![Props, полноэкранный режим](/screenshots/Props_full_screen.jpg)\r
\r
## Navigation\r
\r
The UI is built around two main tabs: the primary data area and a secondary detail area. In narrow layouts the two can merge into a single working surface.\r
\r
## Working with rows\r
\r
In all tables you can act on a row in two ways:\r
\r
* the **⋯** menu on the row;\r
* the **right-click** context menu.\r
\r
Both are equivalent and appear across the main areas of the app.\r
\r
## Top toolbar\r
\r
Most panels share a common top toolbar with search and extra actions. What appears there depends on the current mode and the kind of data shown.\r
\r
![Props, область заголовка](/screenshots/Props_header.jpg)\r
\r
## Search\r
\r
Search is a cross-cutting feature in the main panels.\r
\r
The runtime provides a built-in search affordance:\r
\r
* **Ctrl+F** — uses the browser’s or DevTools find‑in‑page behavior (and how it interacts with the panel depends on [display mode](/options/display_mode) and the structure of the current view).\r
\r
For section-specific filters (requests, props, store), see the relevant docs — for example [Network — working with requests](/network/general).\r
\r
## Keyboard shortcuts\r
\r
Common shortcuts:\r
\r
* **Ctrl+F** — search in the current panel (see above);\r
* **Esc** — cancel the current action, e.g. close a detail view or exit [Inspect](/props/inspect) mode.\r
\r
## Detail views\r
\r
Many entities open a **detail** view when selected. **Esc** or navigating back returns to the previous UI state.\r
\r
![Детализация props](/screenshots/Props_details.jpg)\r
\r
## Display modes\r
\r
Depending on launch context — **Overlay**, **DevTools**, or **Standalone** — layout and chrome can differ slightly while keeping the same overall behavior. See [Display modes](/options/display_mode), [Browser extension](/extension), and [Standalone app](/standalone).\r
`,p=`---\r
title: Introduction\r
layout: doc\r
---\r
\r
# Introduction\r
\r
## What is Vue Inspector?\r
\r
**Vue Inspector** is a tool for analyzing Vue applications at runtime without requiring access to source code, a local build, or a dedicated development environment.\r
\r
The extension allows you to explore the application structure directly on the loaded page: inspect props, store data, network requests, and internal component state exactly as they exist while the application is running.\r
\r
It is designed for scenarios where you need to quickly understand the current frontend state without relying on additional development tools.\r
\r
---\r
\r
## Why use Vue Inspector?\r
\r
Vue Inspector helps simplify application analysis when standard browser tools are not sufficient or when faster access to runtime data is required.\r
\r
Main capabilities:\r
\r
* View component props in real time;\r
* Inspect received and declared props;\r
* Access store data without manually searching runtime structures;\r
* Browse network requests in a structured format;\r
* Keep a single journal of requests, props, emits, store changes, navigation and errors, and export it as an HTML report;\r
* Jump quickly to related data inside the application;\r
* Select components directly on the page using Inspect mode;\r
* Filter and locate required data without manually traversing the DOM structure;\r
\r
---\r
\r
## How is Vue Inspector different from standard DevTools?\r
\r
Unlike Vue Devtools, Vue Inspector is designed not only for local development but also for working with already running applications where:\r
\r
* source code is unavailable;\r
* no local project build is accessible;\r
* production or test environments need to be explored quickly;\r
* runtime data must be inspected without preparing a development environment;\r
\r
---\r
\r
## When is it especially useful?\r
\r
Vue Inspector is particularly useful for:\r
\r
* frontend application testing;\r
* analyzing complex integrations;\r
* investigating component behavior;\r
* locating data transfer issues;\r
* verifying reactive application state;\r
\r
---\r
\r
## Additional Notes\r
\r
The project continues to evolve and gradually expands runtime analysis support for various frontend scenarios.\r
`,u=`---\r
title: Installation\r
---\r
\r
# Installation\r
\r
Vue Inspector is available in more than one launch mode so you can use it across environments and browsers.\r
\r
The right mode depends on environment constraints, security policy, and how you prefer to work.\r
\r
<div class="install-options">\r
  <a class="install-option-card" href="./extension">\r
    <span class="install-option-icon install-option-icon--brand" aria-hidden="true">\r
      <img src="/install/chrome-logo.svg" alt="" width="32" height="32" loading="lazy" decoding="async" />\r
    </span>\r
    <span class="install-option-body">\r
      <span class="install-option-title">Browser extension</span>\r
      <span class="install-option-desc">Full control inside the browser.</span>\r
    </span>\r
  </a>\r
  <a class="install-option-card" href="./standalone">\r
    <span class="install-option-icon install-option-icon--brand" aria-hidden="true">\r
      <img src="/install/electron-logo.svg" alt="" width="32" height="32" loading="lazy" decoding="async" />\r
    </span>\r
    <span class="install-option-body">\r
      <span class="install-option-title">Standalone app</span>\r
      <span class="install-option-desc">For strict policies and any browser.</span>\r
    </span>\r
  </a>\r
</div>\r
\r
## Which option should I choose?\r
\r
* **Chrome extension** — when you need persistent access and the full feature set: auto-run, DevTools integration, and advanced in-browser workflows.\r
* **Standalone application** — when extensions cannot be installed, enterprise restrictions apply, or independent launch is required.\r
\r
---\r
\r
## Where are settings stored? {#storage}\r
\r
Both the **extension** and **standalone** use **a single shared settings profile** for the browser: once saved in Options, the same values apply on **every site** where you open the inspector. No separate per-domain configuration is required.\r
\r
Only the **storage mechanism** differs: the extension uses Chrome’s built-in storage for installed components, while standalone uses a **dedicated local storage layer** for the application (without installation in \`chrome://extensions\`), created specifically for this mode.\r
\r
|                                                                               | **Extension**                                                                                                                                         | **Standalone (bookmark)**                                                                                                                 |\r
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |\r
| **Settings** (options, favorites, site lists, etc.)                           | The extension’s **internal browser storage** within the browser profile: data is tied to the installed Vue Inspector instance, not to a specific tab. | **Dedicated** standalone local storage — same concept: one shared database for all sites launched through the bookmark.                   |\r
| **Customize assets** (backgrounds, saved media from Customize and related UI) | Stored separately in **browser storage** under the extension context (files remain in the browser profile, not “on the site”).                        | Stored in the **same unified** standalone storage, subject to its limits (see [Customize](/options/customize)).                           |\r
| **Across sites**                                                              | One shared settings profile across all domains in the current browser profile.                                                                        | One shared settings profile across all domains: storage is **not bound** to page origin, so reuse works the same way as in the extension. |\r
\r
For media limits in Customize, see [Customize](/options/customize).\r
\r
**Saving and transfer:** regular changes in Options **autosave** (with a small debounce). The **extension** stores settings in **IndexedDB** and **\`chrome.storage.local\`**; **standalone** keeps a snapshot in its **central KV store** (IndexedDB), while media is stored separately with a size limit. **Export / Import / Reset** in General provide JSON export and full reset; differences between modes during export and import are described in [Settings management](/options/settings_management).\r
`,m=`---\r
title: Export\r
---\r
\r
# Export\r
\r
Events from the **Logs** tab can be saved to an **HTML** report and opened in any browser. This is useful for bug reports, for sharing a scenario with colleagues and for analysis outside the page.\r
\r
General information about the tab: [Working with logs](./general.md).\r
\r
---\r
\r
## Export format\r
\r
Every export is one **HTML** file: a static report that opens in the browser. The report itself downloads the other formats (see [Downloads from the report](#downloads-from-the-report)).\r
\r
The data inside the report is compact, like the live log (see [How events are stored](./general.md#how-events-are-stored)): store changes are diffs, a request and its response share one network entry, equal bodies are stored once, and identical values in any event are stored once as a shared snapshot. Titles, Before / After states, snapshot values and request / response details are restored when the report is opened.\r
\r
The embedded data uses format version 1.\r
\r
---\r
\r
## What is exported\r
\r
### Export Logs\r
\r
* Without a selection — all events visible in the table after **Search** and **Type** filters.\r
* With a selection — only the rows ticked in the checkbox column; the button shows **Export Logs (n)**.\r
* Network events are always exported as a pair: when only **Send request** or only **Receive response** of a request is filtered or selected, the other event is added to the file too. A WebSocket frame stays the event that was selected.\r
\r
The button is disabled while the filtered list is empty.\r
\r
### Single event\r
\r
**Export event** in the **⋮** menu of the details header or in the row context menu exports one event.\r
\r
For network events the item is called **Export request & response**: the **Send request** and **Receive response** events of the same request are exported together in one file, so the request and its response are never separated. A WebSocket event is exported on its own.\r
\r
### Pinia changes in a partial export\r
\r
A **Change store** event is a diff against the previous event of the same store. When that previous event is not part of the export (a selection, a filter or a single event), the exported change also carries the full state after it and the old values of the changed fields, so **Before** / **After** stay available in the file.\r
\r
### Files\r
\r
| Export | File name |\r
| ------ | --------- |\r
| **Export Logs** | \`logs_<date>_<time>.html\` |\r
| Network pair | \`log_network_<date>_<time>.html\` |\r
| Other single event | \`log_<type>_<date>_<time>.html\` |\r
\r
Data is masked at capture time, so the files contain the same masked values as the view (see [Logs settings](./settings.md#data-masking)).\r
\r
---\r
\r
## HTML report\r
\r
The **HTML** report is one self-contained file: styles, scripts, the application icon and the event data are embedded. It uses a dark theme, does not load external resources and opens offline from disk.\r
\r
### Sidebar\r
\r
* **Report** — **Overview** and **All events** with the total count;\r
* sections by type with counters: **Network** (**Send request**, **Receive response**), **WebSocket** (**WebSocket open**, **WebSocket sent**, **WebSocket received**, **WebSocket closed**), **Components** (**Change props**, **Emit**), **Pinia** (**Change store**, **Store action**), **Page** (**Navigation**, **JS error**);\r
* **Download Vue Inspector** at the bottom — link to the project page.\r
* **Support Vue Inspector** above it: **Monthly support** opens Boosty, **Donate with USDT** shows the Tron (TRC-20) address, a QR code and **Copy address**.\r
\r
### Overview\r
\r
Summary cards: **Events**, **Errors**, **Failed requests**, first and last event time, time span; counters by type; export information. **Generator** is **Vue Inspector Extension** or **Vue Inspector Bookmarklet**, matching the mode that created the file.\r
\r
The header shows **Vue Inspector** with that mode in a tag, **Logs report** on the next line, and the event count with the export time centered beside those two lines.\r
\r
**Events**, **Errors** and **Failed requests** are clickable: they open **All events** with the matching filter. The active filter is shown as a chip above the list; clicking the chip removes it.\r
\r
### Event list and details\r
\r
* Search in the top bar; with **in data** enabled the search also looks inside event data.\r
* **All events** has a **Type** dropdown with checkboxes, the same control as on the **Logs** tab. Every type is on by default. **Select all** and **Clear** turn the whole list on or off. With every type off, the list is empty. The filter stays on this page while you search or use the **Errors** / **Failed requests** chip, and does not change the sidebar sections.\r
* Clicking a row opens details with the same tabs as in the app (**Overview**, **Params**, **Headers**, **Body**, **Changes**, **Before** / **After**, **State**, **Raw**, etc.). Every JSON and text block has the same bar on top: **Find**, the previous / next match arrows, the match count and **Copy**. JSON is indented and colored, including a truncated body. **Find** searches the whole block and highlights the matches; Enter and Shift+Enter move between them, Esc clears the field. **Copy** copies the stored text. While details with such a block are open, Ctrl+F (Cmd+F) moves to its **Find** field in any keyboard layout; a second Ctrl+F opens the browser find. A block larger than **200 KB** fills the details area and keeps only the visible lines in the page, so only **Find** sees all of it. Smaller blocks are on the page in full, so the browser find works on them too.\r
* A binary response shows the same yellow notice as a truncated body, *Binary response received. Body not included in report.*, above the type line (\`image/jpeg (986.2 KB)\` and **Binary**).\r
* **WebSocket open**, **WebSocket sent**, **WebSocket received** and **WebSocket closed** are a separate **WebSocket** section. A message is pretty-printed JSON when the frame is JSON. **Sent** or **Received** and the size sit above that block, in the same type-and-size line as a binary file. **WebSocket closed** lists each frame the same way. When the tab holds several messages, one **Find** bar sits above them and stays visible while scrolling: it searches all messages together, the count and the arrows go through the matches across the messages, and each message keeps its own **Copy**. **Overview** shows the close code, the reason and **No automatic reconnect** when that was determined.\r
* For network events, **Request** or **Response** in the details header jumps between the request and its response. A WebSocket frame or the open event uses **Closed**; the close event uses **Opened**.\r
* **Locate** opens **All events** and scrolls so this event is in view, the same way **Request** / **Response** brings its pair into view. If its type was switched off, that type is switched on so the event stays in the list. When the details panel covers the list, **Locate** also closes the panel so the event stays visible in the list.\r
* The details panel closes with the back arrow on the left (the same control as in the app) or with **Esc**.\r
* **↑ / ↓** move between events.\r
* The selected section and event are kept in the address (\`#…\`), so a link to a specific event can be shared and survives a reload.\r
* On a narrow screen the section list opens from the menu button. Choosing a section closes it, and a tap outside it closes it. Event rows show a colored bar for the event type.\r
\r
### Downloads from the report\r
\r
Two buttons in the top bar download the events of the report:\r
\r
| Button | File | Content |\r
| ------ | ---- | ------- |\r
| **Brief for AI** | \`<report>.ai.md\` | A compact Markdown digest (errors, failed requests, timeline) with a guide for an AI assistant |\r
| **RAW JSON** | \`<report>.raw.json\` | Every event in full, oldest first, indented: the same object the **Raw** tab shows, with restored store states, change values and the request / response details. A WebSocket message keeps only its own frame |\r
\r
On a narrow screen the buttons are shortened to **Brief AI** and **RAW**.\r
\r
---\r
\r
## See also\r
\r
* [Working with logs](./general.md)\r
* [Logs settings](./settings.md)\r
* [Export collections](/network/export)\r
`,g=`---\r
title: Working with logs\r
---\r
\r
# Working with logs\r
\r
The **Logs** tab is a single chronological journal of what happens on the page: network requests, component props and emits, **Pinia** changes and actions, SPA navigation and JS errors. It helps to reconstruct a scenario step by step and to hand it over as a file.\r
\r
The tab is always visible, comes after **Pinia Store**, and records events the same way in the extension and in **Bookmark** ([Standalone](/standalone)) mode.\r
\r
## Event types\r
\r
| Type | What is logged |\r
| ---- | -------------- |\r
| **Send request** | Outgoing **fetch** / **XMLHttpRequest** call: URL, method, initiator, **Params**, request **Headers**, **Authorization**, request **Body** |\r
| **Receive response** | Response to that call: status, duration, size, response **Headers**, response **Body**, network error |\r
| **WebSocket open** | The connection opened: URL and handshake **Headers**. Its own type in the **Type** filter |\r
| **WebSocket sent** | One outgoing frame. Each frame is its own event |\r
| **WebSocket received** | One incoming frame. Each frame is its own event |\r
| **WebSocket closed** | Close of that connection: close code, reason, duration, size, and **No automatic reconnect** when the protocol says the client will not open a new socket |\r
| **Change props** | Changed props of a component: list of changes and full **Before** / **After** snapshots |\r
| **Emit** | Component event: component, event name, arguments, listener type (**regular** / **once**), parent chain |\r
| **Change store** | Changed **Pinia** state: list of changes and full **Before** / **After** snapshots. The type also includes the store's base states: **Store initialized**, **Store snapshot** and **Store checkpoint** (see [How events are stored](#how-events-are-stored)) |\r
| **Store action** | **Pinia** action call: arguments, result or error, status, duration |\r
| **Navigation** | SPA navigation: **pushState**, **replaceState**, **popstate**, **hashchange** with **From** / **To**. When logging starts, and after **Clear**, the current page is recorded as **snapshot** |\r
| **JS error** | Uncaught error, unhandled promise rejection or \`console.error\` of the page: message, source, location, compact stack (see [JS errors](#js-errors)) |\r
\r
Each network call produces **two** events that share one network entry. **Send request** shows what was sent, **Receive response** shows what came back. A WebSocket writes a separate event for the open connection (**WebSocket open**), for every sent frame, for every received frame and for the close. Those four types are in the **Type** filter. They share one stored connection, so the handshake and the frame text are kept once. After a request is edited at a [Breakpoint](/network/traffic), both events show the data that was actually sent and received.\r
\r
## Top toolbar\r
\r
### Search\r
\r
The search box filters the table. The active criteria are set in **Options → Logs → Search Settings** (see [Logs settings](./settings.md)):\r
\r
| Mode | Description |\r
| ---- | ----------- |\r
| **By event name** | Title, component, store, URL |\r
| **By key** | Keys in the payload and changed paths |\r
| **By value** | Values in the payload |\r
\r
For **Change store** and **Change props**, key and value search looks at the changed paths and values; full states are searched in the **Store initialized**, **Store snapshot** and **Store checkpoint** events.\r
\r
As in other tabs, a query **without** quotes matches a substring, a query wrapped in **double quotes** \`"..."\` matches exactly. The minimum query length comes from the inspector search settings (default **2** characters).\r
\r
### Type\r
\r
**Type** limits the table to the selected event types. All types are enabled by default. If every type is turned off, the table is empty and shows a hint to enable types again.\r
\r
### Status indicators\r
\r
| Item | Purpose |\r
| ---- | ------- |\r
| **N** or **N/M** | Rows after filters; with an active search or **Type** filter, **M** is the total number of events in the buffer |\r
| **ignored** | Number of ignored event groups. Click opens **Ignored events**: remove a single rule or **Clear all** |\r
| **Paused** | Recording of new events is paused |\r
\r
### Log controls\r
\r
| Control | Purpose |\r
| ------- | ------- |\r
| **Pause** / **Resume** | Stop and resume recording new events |\r
| **Clear** | Remove all recorded events |\r
| **Export Logs** | Export events to an **HTML** report (see [Export](./export.md)) |\r
\r
## Work area\r
\r
### Events table\r
\r
| Column | Content |\r
| ------ | ------- |\r
| Checkbox | Selection for export |\r
| **Time** | Event time with milliseconds |\r
| **Type** | Colored type badge |\r
| **Event** | Title and short description (method and path, component and event, store and changed keys, etc.) |\r
\r
Rows are highlighted by level: **4xx** responses — warning; **5xx**, network errors, failed actions and JS errors — error.\r
\r
### Selection for export\r
\r
The first column contains checkboxes, in the same position as the favorites star in **Props** and **Pinia**.\r
\r
| Action | Result |\r
| ------ | ------ |\r
| Click a checkbox | Select / unselect a row |\r
| **Shift** + click | Select a range from the last clicked row |\r
| **Ctrl / Cmd** + click on a row | Toggle a row without opening details |\r
| Header checkbox | Select all / clear selection |\r
\r
When rows are selected, the button shows **Export Logs (n)** and exports only them as an **HTML** report. Without a selection, all filtered events are exported.\r
\r
### Event details\r
\r
Clicking a row opens details on the right. The layout follows **Network**: a tab strip, name/value tables and **JSON** blocks in the selected [JSON mode](/options/json_mode).\r
\r
| Type | Tabs |\r
| ---- | ---- |\r
| **Send request** | **Overview**, **Params (n)**, **Headers**, **Body**, **Raw** |\r
| **Receive response** | **Overview**, **Headers**, **Body**, **Raw** |\r
| **WebSocket open** | **Overview**, **Headers**, **Messages (n)**, **Raw** |\r
| **WebSocket sent**, **WebSocket received** | **Overview**, **Headers**, **Message**, **Raw** |\r
| **WebSocket closed** | **Overview**, **Headers**, **Messages (n)**, **Raw** |\r
| **Change props**, **Change store** | **Changes (n)**, **Before**, **After**, **Raw** |\r
| **Store initialized**, **Store snapshot**, **Store checkpoint** | **Overview**, **State**, **Raw** |\r
| **Store action** | **Overview**, **Arguments**, **Result** / **Error**, **Raw** |\r
| **Emit** | **Arguments (n)**, **Overview**, **Raw** |\r
| **Navigation**, **JS error** | **Overview**, **Stack** (errors), **Raw** |\r
\r
**Changes** shows a diff by path: added, removed and changed values with the old and new value. Very large diffs are truncated; the full state stays available on **Before** / **After**.\r
\r
**Before** / **After** of a store change are restored from the store's base state and the changes after it. When that is impossible (the earlier events of the store are no longer in the log), the tab says so and **Changes** still shows the changed values; a value that cannot be restored is shown as *not available*.\r
\r
**Raw** shows the event with all restored fields.\r
\r
If a network body was larger than the configured event size, **Body** shows a notice with the original size.\r
\r
A binary **Receive response** uses the same bar as **Network**, directly under the section tabs: content type, size and a **Binary** badge, for example \`image/jpeg (986.2 KB)\`. The file itself is not stored. **Duration** on **Store action** and **Receive response** is shown with two digits after the decimal point (\`635.90 ms\`).\r
\r
### Event actions\r
\r
Actions are available in the **⋮** menu of the details header and in the row context menu (right click or **⋮** in the row):\r
\r
| Action | Purpose |\r
| ------ | ------- |\r
| **Export event** | Export one event. For network events the item is **Export request & response**: both events of the request go into one file. A WebSocket event exports that one event |\r
| **Copy cURL** | Copy the request as a cURL command (also available on **Receive response**: both events share the request data). WebSocket events do not have this action |\r
| **Open request event** / **Open response event** | Jump to the paired network event. A WebSocket uses **Open connection event** / **Open close event** |\r
| **Ignore** | Stop logging this group of events |\r
\r
**Ignore** works per group: the same request (method and path), the same component, the same store, and so on. Ignored groups are not recorded at all; the **ignored** indicator in the toolbar opens their list, where **×** logs one group again and **Clear all** logs every group again.\r
\r
## How it works\r
\r
### When recording starts\r
\r
Recording starts together with the rest of Vue Inspector in the tab context. Events are kept in the page, so the history is available when **Logs** is opened later, without reloading the page.\r
\r
### How events are stored {#how-events-are-stored}\r
\r
Events keep only primary data; titles, descriptions and full states are derived when an event is shown.\r
\r
* **Pinia.** When a store is created while logging is running, a **Store initialized** event records its full state. When logging starts on a store that already exists, a **Store snapshot** event records its current state. After that, every **Change store** event stores only the changes. **Before** / **After** are rebuilt from the base state and the changes up to the event. Switching Inspector tabs does not create new snapshots. A new snapshot is recorded after **Clear** and after masking settings change. A recorded state is split like on the **Pinia Store** tab: \`state\` holds the declared state, \`getters\` holds getters and data the store keeps outside its declared state (for example, fields assigned in actions of an options store with an empty \`state()\`). Changes of both are tracked, so change paths start with \`state.\` or \`getters.\`.\r
* **Network.** **Send request** and **Receive response** reference one shared network entry. WebSocket events reference one shared connection: the open event, each frame and the close. Equal response or request bodies (for example, a polled endpoint) are stored once. A duration tick while the socket stays quiet does not add a new event.\r
* **Shared snapshots.** Identical values inside any event — props, store state, action arguments and results, emit arguments, errors, navigation — are stored once. Each later copy is a reference to that snapshot. The Logs tab and the HTML report restore the full value, so the data you see is the data that was captured.\r
\r
### Limits\r
\r
A shared memory budget keeps long sessions stable. When it is reached, the log is cut at a **Navigation**: every event recorded before that navigation is removed, whatever its type — network requests and responses, WebSocket, props, Pinia, emits, store actions and errors. Events from the navigation onward stay. Each earlier navigation is a cut in turn, so the oldest period goes first. The last navigation is rewritten as a snapshot of the page at that moment (\`from\` is cleared), and events before it are removed the same way. If the log is still over the budget, the oldest remaining events are removed by age. The newest event is always kept, even if it alone exceeds the budget. Events are kept whole by default; a maximum event size can be switched on. Groups of events can be switched off completely. Defaults and settings are described in [Logs settings](./settings.md).\r
\r
**Send request** and **Receive response** follow **Maximum HTTP requests** (**Options → Network**, default **500**): an older request leaves the log together with its response. **WebSocket open**, **WebSocket sent**, **WebSocket received** and **WebSocket closed** follow **Maximum WebSocket events** (the same screen, default **500**): each of those records counts as one, and the oldest are dropped. Both rings are separate from the memory budget.\r
\r
A **Pinia** chain is not broken by a cut. Changes up to the cut are rebuilt into one **Store checkpoint** with the store state at that point, placed before the events that remain. The previous base and the diffs that produced it are deleted. Later **Change store** events still restore **Before** / **After** from that checkpoint. A store whose next remaining event is already a full state does not get a checkpoint; its older events are removed.\r
\r
### JS errors {#js-errors}\r
\r
**JS error** events come from three sources, shown in **Overview** as **Source**: **Uncaught error**, **Unhandled rejection** and **console.error**.\r
\r
* **Only the inspected page.** Whether an error is the page's is decided by where it comes from (the caller in the stack), not by its text. Messages and errors of Vue Inspector itself and of other browser extensions are not logged. This includes Vue Inspector's internal reports about failed **fetch** / **XHR** requests: such a request is already a **Network** event. The app's own \`console.error\` about a failed request is kept.\r
* **console.error.** The message is built like in the browser console (\`%s\`, \`%d\`, \`%o\` and similar are applied, objects are shown as a short preview); object arguments are kept in **Raw**. **Location** points to the line of the app that called \`console.error\`, or to the top frame of an error passed to it. More than 50 messages per second are not logged; the next event shows how many were skipped (**Suppressed**).\r
* **Compact stack.** The message is kept. A stack longer than 10 frames keeps the first 5 and the last 5; the middle is replaced by *… N more frames (stack truncated)*. **Overview** shows **Stack: Truncated** with how many frames were kept from each end.\r
\r
Errors of the inspected page stay in the page console and in **Logs**. They are not added to the extension error list (\`chrome://extensions\`); that list shows only failures of Vue Inspector itself. A page exception from **WebSocket** \`send\` or \`close\`, such as **WebSocket is already in CLOSING or CLOSED state**, is included: the wrapper that records the frame runs in the page. A failed **fetch**, an aborted or timed-out request, and a response body that could not be read because the connection dropped (**Failed to fetch**, **network error**) are recorded only as a Network row. While logging runs, a page \`console.error\` passes through a small page-side bridge, so the browser console may attribute that line to the bridge. The message and the stack are unchanged.\r
\r
### Data masking\r
\r
Sensitive data is masked **when an event is captured**, so it never reaches the view or exports: passwords, tokens, cookies, authorization headers, card numbers and similar keys, as well as **JWT**, **Bearer** / **Basic** credentials and card numbers inside any text.\r
\r
## See also\r
\r
* [Export](./export.md)\r
* [Logs settings](./settings.md)\r
* [Working with requests](/network/general)\r
`,f=`---\r
title: Logs settings\r
---\r
\r
# Logs settings\r
\r
**Options → Logs** collects the settings of the [Logs](./general.md) tab. Changes apply immediately.\r
\r
---\r
\r
## Search Settings\r
\r
Default search modes of the **Logs** tab:\r
\r
| Option | Searches in |\r
| ------ | ----------- |\r
| **Search by event name** | Title, component, store, URL (enabled by default) |\r
| **Search by key** | Keys in the payload and changed paths |\r
| **Search by value** | Values in the payload |\r
\r
---\r
\r
## Logs and limits\r
\r
### Logged events\r
\r
Each group has a checkbox: an unchecked group is not logged at all, and already logged events stay. All groups are on by default.\r
\r
| Group | Events |\r
| ----- | ------ |\r
| **Network** | **Send request** and **Receive response** |\r
| **Props changes** | **Change props** |\r
| **Emits** | **Emit** |\r
| **Pinia changes** | **Change store** (when checked again, the store starts with a new **Store snapshot**) |\r
| **Store actions** | **Store action** |\r
| **Navigation** | **Navigation** |\r
| **JS errors** | **JS error** |\r
\r
The number next to a checkbox shows how many events of the group are currently stored.\r
\r
### Data size\r
\r
| Setting | Default | Range | Meaning |\r
| ------- | ------- | ----- | ------- |\r
| **Memory budget** | 20 MB | 8 – 1024 MB | Total size of all buffered events (approximate serialized size). A network entry shared by a request and its response, and equal bodies, are counted once. A binary response counts as its format and size, not the file |\r
| **Limit event size** | off | — | Off: events are kept whole and nothing is cut, so an exported report keeps complete data |\r
| **Max event size** | 512 KB | 16 – 16 384 KB | Only with **Limit event size**: larger parts of an event (store snapshots, arguments, results) are dropped, network bodies are cut to this size |\r
\r
When the memory budget is reached, the log is cut at a **Navigation** and every event before it is removed. **Pinia** changes up to that cut are rebuilt into a **Store checkpoint**, so the remaining changes keep their **Before** / **After**; the previous base and the diffs it was built from are removed (see [How events are stored](./general.md#how-events-are-stored)). The last navigation is rewritten as a page snapshot, and if the log is still over the budget the oldest remaining events are removed. The newest event is always kept, even if it alone exceeds the budget. **Send request** and **Receive response** are also capped at **Maximum HTTP requests**, the same ring as HTTP rows on the Network tab (**Options → Network**, default **500**): the request and its response leave together. WebSocket log events are capped at **Maximum WebSocket events** (default **500**): open, sent, received and closed each count as one.\r
\r
The bar under the fields shows current usage (**Used X of Y**); it turns orange above 90 %.\r
\r
Values outside the range are corrected to the nearest bound. **Defaults** restores all settings of the block.\r
\r
---\r
\r
## Data masking {#data-masking}\r
\r
Values are masked **when an event is captured**, so they never reach the **Logs** view or exports.\r
\r
| Option | Meaning |\r
| ------ | ------- |\r
| **Mask sensitive data** | Enables masking (on by default) |\r
| **Mask token-like values in any text** | Masks **JWT**, **Bearer** / **Basic** credentials and card numbers inside any string |\r
| **Key contains** list | Object keys, header and parameter names containing these fragments are masked |\r
\r
Default keys: \`password\`, \`passwd\`, \`pwd\`, \`secret\`, \`token\`, \`authorization\`, \`cookie\`, \`apikey\`, \`sessionid\`, \`privatekey\`, \`creditcard\`, \`cardnumber\`, \`cvv\`, \`cvc\`, \`ssn\`, \`otp\`.\r
\r
Keys match case-insensitively and ignore separators (\`api_key\`, \`api-key\` and \`apiKey\` are the same). Fragments of **4 letters or fewer** must match a whole word, so \`pwd\` or \`otp\` do not mask unrelated keys.\r
\r
Add your own fragments in the input under the list; remove them from the row menu. **Defaults**, next to the title, restores the key list and both checkboxes.\r
\r
Masked values are replaced with markers: \`[MASKED]\` for values of sensitive keys, \`[MASKED JWT]\` and \`[MASKED CARD]\` for tokens and card numbers found in text (card numbers are checked with the Luhn algorithm).\r
\r
---\r
\r
## See also\r
\r
* [Working with logs](./general.md)\r
* [Export](./export.md)\r
* [Settings management](/options/settings_management)\r
`,w="---\r\ntitle: Advanced capture mode\r\n---\r\n\r\n# Advanced capture mode\r\n\r\nUnder **Options → Network** you can choose the **capture mode** for network traffic:\r\n\r\n| Mode | In the UI | What it means |\r\n| ---- | --------- | -------------- |\r\n| **Classic mode** | classic snapshot | Same limits as in-page interception: headers and bodies are only what page scripts can read (including **CORS** rules for cross-origin). See [Working with requests](./general.md#display-limits). |\r\n| **Advanced mode** | extended capture | The extension requests **`webRequest`** access and enriches the request details with the **full set** of request and response headers as seen by the browser for the exchange—not only the subset exposed to the page. |\r\n\r\n**Advanced mode** (pinning headers, **Header links**, Advanced-only header visibility options) is available **only in the Chrome / Edge extension**.  \r\n**Standalone** still runs without extended capture: the full header set via **`webRequest`** described below **is not available** there.\r\n\r\n---\r\n\r\n## What Advanced mode adds in the Network tab\r\n\r\n- **Request and response headers** in request details use the extended data (including headers not listed in `Access-Control-Expose-Headers`).\r\n- **Pinning header rows** — a header name can be pinned **to the top of the list** separately for **Request** and **Response**. Pins are toggled from the **row menu** (three dots) when Advanced mode is on.\r\n- **Header links** — for a given header name and request **Host**, open an external URL using a template; the **`{value}`** placeholder (and optional **value pipeline**) controls how the header text is inserted into the link. See [Header links](#header-links) below.\r\n\r\nThe **Header links** list, **Pinned headers** table, and **Advanced headers** options under **Options → Network** are shown **only when Advanced mode is enabled**, so Classic mode stays uncluttered.\r\n\r\n---\r\n\r\n## Header links\r\n\r\nEach rule defines:\r\n\r\n- **Header** — HTTP header name (matched **case-insensitively**);\r\n- **Host** — host of the request URL (normalized: no scheme or path, e.g. `api.example.com`);\r\n- **Link** — URL template; placeholders are resolved as described in **[Value placeholder and pipeline](#value-placeholder-and-pipelines)**.\r\n\r\nYou can create and edit rules from the **header row menu** on the **Network** tab (Advanced) and from **Options** when a header rule group is selected.\r\n\r\n### Value placeholder and pipeline {#value-placeholder-and-pipelines}\r\n\r\nInside the **Link** field you can use:\r\n\r\n- **`{value}`** — insert the header value exactly as shown on the request card (same as a pipeline with no steps).\r\n- **`{value|…}`** — run a **pipeline**: after `{value`, list steps separated by **`|`**; apply them **left → right**, then insert the result. Example: `{value|trim|urlencode}`.\r\n\r\nUse a **pipe** `|` between steps. The parser splits the chain at `|` only when the **next** segment starts with a **known operation** (see tables below). That way, a `|` **inside a regex** (e.g. alternation `a|b`) is usually fine, as long as the substring after a candidate split does not look like a new op.\r\n\r\nIf a step is invalid (e.g. bad regex), that step is skipped and the value is left unchanged for that step.\r\n\r\n#### No-argument operations\r\n\r\n| Op | Effect |\r\n| --- | --- |\r\n| `trim` | Trim leading/trailing whitespace. |\r\n| `lower` | Lowercase. |\r\n| `upper` | Uppercase. |\r\n| `urlencode` | `encodeURIComponent`-style encoding for use in URL query parts. |\r\n| `urldecode` | Decode URI component (`+` treated as space). Invalid escapes leave the value unchanged. |\r\n| `base64encode` / `base64decode` | Base64 of UTF-8 bytes. |\r\n| `hexencode` / `hexdecode` | Hex string ↔ UTF-8 bytes (`hexdecode` ignores whitespace). |\r\n| `md5` | MD5 hex digest of UTF-8 input (sync). |\r\n| `sha1` / `sha256` | SHA-1 / SHA-256 hex digest via **Web Crypto** (`crypto.subtle`). Requires a context where SubtleCrypto is available (e.g. **HTTPS** or extension pages); otherwise the digest step yields an empty string. |\r\n\r\n#### Regex and replacement\r\n\r\n| Op | Syntax | Notes |\r\n| --- | --- | --- |\r\n| `regex` | `regex:<pattern>` | `new RegExp(<pattern>)` (no flags in the syntax—add them inside the pattern if your engine supports it). Sets the **last match** for a following `replace`. On no match, the value becomes empty. |\r\n| `replace` | `replace:<template>` | After `replace:`, substitute `$1`, `$2`, … from the **last** `regex` match. If there was no match, result is empty. |\r\n| `replaceRegex` | `replaceRegex:<pattern>:<template>` | **Pattern** and **template** are split at the **last** `:` in the segment—so a `:` inside the pattern is awkward; prefer `regex` + `replace` instead. Uses `String.replace` with a `RegExp`. |\r\n| `match` | `match:<pattern>` | If the value matches, keep it; otherwise replace with empty string. |\r\n\r\n#### Strings and structure\r\n\r\n| Op | Syntax | Notes |\r\n| --- | --- | --- |\r\n| `replaceText` | `replaceText:<from>:<to>` | **From** / **to** use the **last** `:` in the payload as separator between `to` and everything before it (`from` may contain `:`). Global replace of all `from` occurrences. Empty `from` skips the step. |\r\n| `substring` | `substring:<start>` or `substring:<start>:<length>` | Same idea as `String.slice` / `substring`: with two numbers, length is a **character count** from `start`. |\r\n| `split` | `split:<delimiter>:<index>` | **Index** is the part after the **last** `:` (must be digits). **Delimiter** is everything before that `:` (may contain `:`). Empty part if index is out of range. |\r\n\r\n#### Conditions and defaults\r\n\r\n| Op | Syntax | Notes |\r\n| --- | --- | --- |\r\n| `default` | `default:<fallback>` | If the current value is exactly the **empty string** after previous steps, set it to `<fallback>`. To treat whitespace-only as empty, use `trim` first. |\r\n| `ifMatch` | `ifMatch:<pattern>:<ifTrue>:<ifFalse>` | **False** branch is after the **last** `:`; **true** branch is between the **second-to-last** and **last** `:`; **pattern** is everything before the **second-to-last** `:` (so colons inside branches are constrained by this rule). |\r\n\r\n### Examples\r\n\r\n```text\r\nhttps://trace.example.com/?id={value}\r\n```\r\n\r\n```text\r\nhttps://trace.example.com/?id={value|trim|urlencode}\r\n```\r\n\r\n```text\r\nhttps://trace.example.com/?t={value|regex:^Bearer\\s+(.+)$|replace:$1|urlencode}\r\n```\r\n\r\n```text\r\nhttps://trace.example.com/?t={value|default:unknown}\r\n```\r\n\r\nMultiple placeholders in one template are allowed; each `{value...}` block is resolved independently using the **same** header value.\r\n\r\n---\r\n\r\n## Quick recap\r\n\r\n- **Advanced mode** extends headers via **`webRequest`**; **Standalone** does not provide this mode.\r\n- **Classic mode** is the original “page-visible” header model.\r\n- **Pin** — separate for **Request** / **Response** lists.\r\n- **Header links:** **Host** + **Link** template: **`{value}`** or pipeline **`{value|op|…}`** for the header value.\r\n",v=`---\r
title: Export Collection\r
---\r
\r
# Export Collection\r
\r
![Network, область заголовка (JPG)](/screenshots/Network_header.jpg)\r
\r
On the **Network** tab, captured requests can be saved as a **Postman collection** file (**JSON**, an API description format compatible with Postman and many other clients). This is useful for replaying flows, sharing them with teammates, or importing them into a separate testing tool.\r
\r
What appears in the list and possible data visibility limitations are described in [Working with requests](/network/general). In the inspector, **multipart** bodies are already shown as structured form fields; the export maps that shape into Postman-style **form-data** rather than a single opaque blob.\r
\r
---\r
\r
## Where to find the command\r
\r
**Export Collection** is located on the **Network** toolbar, next to **All** / **XHR** / **WS** (next to search and filters). On a narrow toolbar the switch and the button move together to the next line. **All** lists every row, **XHR** lists \`fetch\` / XHR, **WS** lists WebSocket. The export follows that switch for HTTP requests and always skips WebSocket.\r
\r
The tooltip indicates that the **currently filtered** HTTP requests will be exported.\r
\r
The button remains **disabled** while the filtered list has no HTTP request. With only WebSocket rows visible it stays disabled.\r
\r
---\r
\r
## What gets exported\r
\r
The file contains **only HTTP rows currently visible** in the table with **Search** and active search modes applied (path, method, status code, keys and values inside bodies, and so on). This is not necessarily the full request history: active filters restrict what enters the collection. **WebSocket** rows are omitted.\r
\r
If HTTP requests are ticked in the checkbox column, only the selected requests are exported; the button then shows **Export Collection (n)**. WebSocket rows cannot be ticked, and a range or select-all does not include them.\r
\r
For each included row, a separate request is created in the collection with:\r
\r
* **method** and **URL** (including address components and query string when present);\r
* **request headers** stored by the inspector (pseudo-headers starting with \`:\` are omitted; for **multipart** bodies the content-type header may be intentionally skipped to avoid conflicts with Postman **form-data** mode);\r
* **request body** when captured: raw text (including JSON syntax hints where applicable) or **form-data** fields, including file-part markers (binary files themselves are not attached — only names or placeholders are exported, as is typical when no real files are available).\r
\r
**Server responses** are **not included** — the export contains only the description of **outgoing** requests suitable for replay from a client.\r
\r
Collection item names follow the short request label shown in the Network list.\r
\r
---\r
\r
## Saved file\r
\r
After clicking **Export Collection**, the browser offers a **JSON** file download with a Postman-style filename (spaces in the default title are usually replaced with underscores).\r
\r
The file can be imported into **Postman** or opened in any editor to inspect its structure.\r
\r
---\r
\r
## Caveats\r
\r
* Only **headers and bodies the inspector was able to read** are included in the export (CORS limitations, truncated bodies, opaque binary content, and similar restrictions may affect output).\r
* Rows with **network errors** or partial data may still appear in the export if they remain visible after filtering — validate requests before reuse.\r
* **Replaying** requests from Postman may differ from browser behavior because of cookies, tokens, environment settings, and headers automatically added by the browser — manual adjustment after import may be required.\r
\r
---\r
\r
## See also\r
\r
* [Working with requests](/network/general)\r
* [Traffic interception](/network/traffic)\r
`,b=`---\r
title: Working with requests\r
---\r
\r
# Working with requests\r
\r
The **Network** tab shows network activity of the application at runtime.\r
\r
## Top toolbar\r
\r
![Network, область заголовка (JPG)](/screenshots/Network_header.jpg)\r
\r
### Search\r
\r
The search box supports multiple modes. The active criteria are chosen in **Search by** next to the input. The same options exist under **Options** for that tab so you can preset search types.\r
\r
| Mode            | Description                                          |\r
| --------------- | ---------------------------------------------------- |\r
| **Status code** | Search by response status code                       |\r
| **Method**      | Search by HTTP method                                |\r
| **Path**        | Search by URL or part of the path                    |\r
| **Name**        | Search by request name                               |\r
| **Key**         | Search by keys in **JSON** request/response bodies   |\r
| **Value**       | Search by values in **JSON** request/response bodies |\r
\r
\r
There is a minimum query length (default **2** characters; configurable in inspector search settings).\r
\r
**Partial vs exact match.** If the query is **not** wrapped in quotes, **substring** matching is used across enabled modes (case-insensitive for text) — similar to **\`LIKE '%text%'\`**. **Exact** whole-string matching applies only when the **entire** query is wrapped in **double quotes** \`"..."\`.\r
\r
For key/value modes the body must parse as JSON; otherwise the search index may be empty.\r
\r
### Status indicators\r
\r
The right side of the **Network** toolbar shows status chips. Some are **clickable**.\r
\r
| Item | Purpose |\r
| ---- | ------- |\r
| **N** or **N/M** | Row count after search and the **All** / **XHR** / **WS** switch. **M** is the total rows in the buffer when that count is smaller. |\r
| **pending** | Requests still in flight. |\r
| **bp** (highlighted, pulse) | Breakpoints waiting for UI action. Click selects the first such row. |\r
| **bp** (solid amber) | Count of active breakpoint rules. Click opens that list. **Pause** disables a rule without deleting it; **×** deletes it. Disabled rules leave the list. |\r
| **mock** | Active mock response rules. Click opens that list, with the same **Pause** and **×** actions. |\r
| **Paused** | Traffic logging to the list is paused. |\r
\r
When **breakpoint rules** or **mock response rules** are **suspended** globally (see below), the **bp** and **mock** chips keep their counts but use a **muted** style to show that those rules are **not** applied until you turn them back on.\r
\r
## Log controls\r
\r
### Breakpoint rules and mock responses (global) {#breakpoint-rules-and-mock-responses-global}\r
\r
Next to **Pause recording** and **Clear**, the toolbar has two **icon** controls that apply to **all** configured rules of each type (without deleting them):\r
\r
| Control | Icon (when active) | Meaning |\r
| ------- | ------------------ | ------- |\r
| **Breakpoint rules** | Pause / stop circle (**amber** when rules are on) | **On:** active breakpoint rules can pause matching requests. **Click:** **suspend** breakpoints — rules stay in **Options → Network → Breakpoints**, but no request is held until you enable again. Tooltip: *Breakpoints on (click to suspend)* / *Breakpoints suspended (click to enable)*. |\r
| **Mock responses** | Shuffle (**purple** when mocks are on) | **On:** active mock rules can short-circuit matching requests. **Click:** **suspend** mocks — rules stay in **Options → Network → Mock Responses**, but the real network runs until you enable again. Tooltip: *Mock responses on (click to suspend)* / *Mock responses suspended (click to enable)*. |\r
\r
The same switches exist as **Enable breakpoint rules** and **Enable mock responses** next to the corresponding lists in **Options → Network**; changing either place updates the other.\r
\r
**Note:** Suspending rules is **not** the same as **Pause recording**. Pause removes the interceptor from the page and stops logging; the global switches only disable **breakpoint** or **mock** handling while the interceptor remains (unless you also pause recording). Details: [Traffic interception](./traffic.md).\r
\r
### Pause\r
\r
**Pause** temporarily stops recording into the **Network** list.\r
\r
While paused:\r
\r
* new requests **do not appear** in Vue Inspector **Network** until you resume;\r
* the interceptor **is removed**: the page uses native \`fetch\`, \`XMLHttpRequest\` and \`WebSocket\` again (no inspector substitution).\r
\r
Implications:\r
\r
* in the **built-in Network** tab of DevTools the same requests show the **original initiator** (your app code), not the injected script (\`injected.js\`, etc.);\r
* while paused, interception features **do not apply**: **Mock response** and **Breakpoint** (see [traffic interception](./traffic.md)). After **Resume**, interception and rules are active again.\r
\r
### Clear\r
\r
Clears accumulated rows next to **Pause**.\r
\r
### Export Collection\r
\r
**All** / **XHR** / **WS**, next to **Export Collection**, limits the table to every row, to \`fetch\` / XHR, or to WebSocket. **All** is the default. The switch does not remove rows from the buffer. On a narrow toolbar the switch and **Export Collection** move together to the next line.\r
\r
**Export Collection** downloads a **Postman collection** (**JSON**): the current **filtered** HTTP list, or only the ticked HTTP requests. **WebSocket** rows are left out of the file. Their checkboxes stay disabled, and select all and a **Shift** range skip them. On **WS** the button stays disabled (see [Export Collection](./export.md)).\r
\r
## Work area\r
\r
![Network, полноэкранный режим](/screenshots/Network_full_screen.jpg)\r
\r
### Request list\r
\r
The left side lists captured requests.\r
\r
Per request you typically see:\r
\r
* **Name / Path** — short name or path;\r
* **Status** — HTTP status;\r
* **Time** — duration;\r
* **Size** — payload size;\r
\r
Column visibility is configurable.\r
\r
The first column contains checkboxes for **Export Collection** (Postman **JSON**):\r
\r
| Action | Result |\r
| ------ | ------ |\r
| Click a checkbox | Select / unselect a request |\r
| **Shift** + click | Select a range from the last clicked row |\r
| **Ctrl / Cmd** + click on a row | Toggle a row without opening details |\r
| Header checkbox | Select all HTTP rows / clear selection |\r
\r
A **WebSocket** row cannot be ticked.\r
\r
### Request details\r
\r
Opening a row shows exchange details:\r
\r
* **Headers** — request and response headers;\r
* **Params** — query string pairs;\r
* **Request** — request body;\r
* **Response** — response body;\r
* **Messages** — for a WebSocket row, each sent and received message.\r
\r
For **\`multipart/form-data\`** bodies captured as structured data, **Request** is shown as a **read-only table**: field key, **Text** or **File**, cell value (text fields as-is; file fields show name and size, or **\`(binary)\`** when the original bytes are not kept as displayable text). **Copy** copies the visible text or the file name, depending on the row.\r
\r
The **\`X-Request-Id\`** header (and similar) may be visually emphasized when present.\r
\r
## Display limits\r
\r
### Reading limits\r
\r
Vue Inspector only shows headers and bodies **visible to page JavaScript** after the request completes.\r
\r
For **cross-origin** responses browsers apply **CORS**: not every response header is exposed unless listed in **\`Access-Control-Expose-Headers\`**.  \r
For example, if \`X-Request-Id\` is missing from:\r
\r
\`\`\`http\r
Access-Control-Expose-Headers: X-Request-Id\r
\`\`\`\r
\r
(or a list that includes it), the page may not see it in \`response.headers\` — and Network will not show it, even if the browser’s native Network tab does.\r
\r
On **same-origin** requests headers are usually available unless another policy hides them.\r
\r
In the **Vue Inspector extension** for Chrome / Edge, **Advanced mode** (capture setting under **Options → Network**) can enrich request and response headers with browser-level data beyond what the page is allowed to read. For details, header pinning, **Header links**, and related options, see [Advanced capture mode](./advanced.md).\r
\r
Very large bodies may be truncated (roughly **20 MB** captured text in code).\r
\r
A binary response shows the content type, the size and a **Binary** badge, for example \`image/jpeg (986.2 KB)\`. The file itself is not stored. Durations under one second are shown with two digits after the decimal point (\`635.90 ms\`).\r
\r
### Storage cap\r
\r
The Network list keeps HTTP rows and WebSocket rows on separate rings. Each default is **500**, and each is changed under **Options → Network → Request history** (50–5000): **Maximum HTTP requests** and **Maximum WebSocket events**.\r
\r
When a cap is reached, the oldest rows of that kind are dropped. Logs keeps the same number of HTTP requests (a request leaves together with its response) and the same number of WebSocket events (open, sent, received and closed each count as one). Both rings are separate from the memory budget.\r
\r
## How it works\r
\r
### When interception starts\r
\r
The network module loads with the rest of Vue Inspector in the **tab context** when you open the inspector overlay or attach the DevTools panel. Until that script runs, \`fetch\` / \`XMLHttpRequest\` are not patched. A small page script runs at document start and remembers WebSocket objects the page opens, so **Network** can attach to sockets that are already connected when the inspector starts.\r
\r
The buffer lives in the page after load; **Network** reads it whenever the panel is open. Without reload, history remains available when you open **Network** later (subject to the request limit above).\r
\r
### What is monitored\r
\r
Calls through:\r
\r
* **\`fetch\`**\r
* **\`XMLHttpRequest\` (XHR)**\r
* **\`WebSocket\`** — one row per connection, including a socket that was already open when the inspector started. The method column shows **WS**. While the socket is open the status is **Open**; after a normal close it shows the close code (**1000** / **1001**) or **Closed**. **Headers** in the extension shows the HTTP upgrade recorded by the browser. Bookmark mode cannot see that exchange: the tab shows **Host**, **Origin**, **User-Agent**, **Connection**, **Upgrade** and **Sec-WebSocket-Version**, plus **Sec-WebSocket-Protocol** and **Sec-WebSocket-Extensions** when the socket reports them. **Sec-WebSocket-Key**, **Sec-WebSocket-Accept** and **Cookie** stay unavailable. **Messages** lists each sent and received frame with its time, direction and size, newest first. Text is shown as text. One JSON value is formatted with indents; several JSON values in one frame, separated by newlines, are formatted as separate objects. Binary is a short hex preview. The row keeps the latest **200** messages, and a single message is stored up to **64 KB**. **Sent** sends the composed text on the open socket. **Received** delivers that text to the page. There is no **Params** tab. Breakpoint, mock and **Copy cURL** stay on \`fetch\` / XHR; the row menu is disabled. **Logs** records **WebSocket open**, **WebSocket sent**, **WebSocket received** and **WebSocket closed** as separate events that share one connection. A JSON frame is shown formatted, including several JSON values separated by newlines in one frame. Those types are in the **Type** filter. When the protocol can be recognized as Centrifuge and the close code means the client will not reconnect (for example **3501**), the close event says **No automatic reconnect** and keeps the reason. Typing \`{}\` for such a socket shows *This frame may trigger a protocol error and disconnect the WebSocket.* **Sent** and **Received** still send that text.\r
\r
Not captured, among others:\r
\r
* other APIs (\`navigator.sendBeacon\`, \`EventSource\`, \`<img>\` / \`<script>\` loads without XHR);\r
* **OPTIONS** preflights (filtered out);\r
* extension URLs (\`chrome-extension://\`, \`moz-extension://\`, …).\r
\r
Each HTTP row records the initiator type: **fetch** or **xhr**. A WebSocket row records **websocket**.\r
\r
### Interception model\r
\r
Unlike the browser **Network** DevTools tab (engine-level), Vue Inspector runs **in the page**: it wraps global \`fetch\` and XHR methods, performs the real network call, then reads whatever the response object exposes to the page (headers, body, status, timing).\r
\r
Simplified \`fetch\` idea:\r
\r
\`\`\`js\r
// Illustration: after the real request, headers come from response.headers.\r
// Names are limited by the browser (including CORS), not “all” wire headers.\r
window.fetch = async function patchedFetch(input, init) {\r
  const response = await originalFetch.call(window, input, init)\r
  const headersForUi = []\r
  response.headers.forEach((value, name) => {\r
    headersForUi.push({ name, value })\r
  })\r
  // …send metadata and body to the inspector UI…\r
  return response\r
}\r
\`\`\`\r
`,y=`---\r
title: Traffic interception\r
---\r
\r
# Breakpoints and mock responses\r
\r
The **Network** tab and **Options → Network** provide two interception mechanisms:\r
\r
* **Breakpoint** — pause an outgoing request **before it hits the network**, edit parameters, then continue;\r
* **Mock response** — return a crafted response **without calling the server**.\r
\r
Both apply to **\`fetch\`** and **\`XMLHttpRequest\`** on the current page. WebSocket rows are observed only: breakpoint and mock rules do not apply to them.\r
\r
On a narrow panel the list and the request details share one screen. Saving a breakpoint or mock, or leaving that form with the back button, closes the details. On a wide panel the details stay open.\r
\r
You can **suspend all breakpoint rules** or **all mock rules** globally from the **Network** toolbar or via **Enable breakpoint rules** / **Enable mock responses** in **Options → Network** — rules remain saved but are not applied until re-enabled. See [Working with requests](/network/general#breakpoint-rules-and-mock-responses-global).\r
\r
General interception limits (page context, CORS, scope) are described in [Working with requests](/network/general).\r
\r
---\r
\r
## Breakpoints\r
\r
![Breakpoint](/screenshots/Breakpoint.jpg)\r
\r
### Purpose\r
\r
A breakpoint pauses an outbound request **before it is sent**.\r
\r
When URL and method match the rule:\r
\r
* the request is held;\r
* the UI lets you edit parameters;\r
* after confirmation the request continues with your changes;\r
* or you can cancel.\r
\r
Interception happens after the app built the request but before native send.\r
\r
### What you can change\r
\r
Before continuing you can edit:\r
\r
* HTTP method;\r
* URL (scheme, host, path, query);\r
* headers;\r
* body.\r
\r
After **Apply** the request goes out in the modified form.\r
\r
### Request body: raw and form-data (breakpoint)\r
\r
For the paused request, the body editor can use **Raw** (single text area) or **Form-data** (rows analogous to the read-only **Network** details table).\r
\r
### Form-data mode\r
\r
In **Form-data** mode, each row contains:\r
\r
* a **key**;\r
* a value type (**Text** or **File**);\r
* the value.\r
\r
For **File** rows, **Browse** lets you pick a file from disk. The chosen file is added to the draft, typically as a **\`data:\`** URI.\r
\r
### File sources for File fields\r
\r
For **File** rows, the dropdown lists:\r
\r
* **Original** — restore the file that was already part of this request (equivalent to the original **\`(binary)\`** for as long as the current pause still has the original \`FormData\`);\r
* **Saved Files** entries under **Options → General**;\r
* **wallpapers** (background media) from **Customize** — same shared media store as panel styling.\r
\r
### Auto-saving files selected via Browse\r
\r
**Auto-save new files selected via Browse** (**Options → General → Saved Files**) controls whether files picked in this editor are auto-saved.\r
\r
When the option is on:\r
\r
* the file is copied to **Saved Files**;\r
* that happens only if there is not already an entry with the same **name + size** pair.\r
\r
Storage limits follow [Customize](/options/customize):\r
\r
* the **extension** uses **IndexedDB**;\r
* **standalone** enforces a **30 MB** cap.\r
\r
### How data is applied after you continue\r
\r
After you continue, the injected script builds a new **\`FormData\`** object:\r
\r
* text values are appended as normal fields;\r
* **\`data:\`** values are turned into file parts;\r
* **\`(binary)\`** restores the original **File** from the captured request for as long as that source data is still available.\r
\r
### File restoration limits\r
\r
If the value is still:\r
\r
* a **\`blob:\`** URL;\r
* or a **\`__fileId:\`…** reference,\r
\r
the page cannot recover the file contents on its own.\r
\r
In that case an **empty** placeholder is sent for that part and the console emits a **warning**.\r
\r
To avoid that, pick the file again with **Browse** or select a saved file from the list.\r
\r
### Where to configure\r
\r
* **Network** — create or adjust a breakpoint from a captured request.\r
* **Options → Network → Breakpoints Requests** — manage the rule list.\r
* **Network toolbar** (breakpoint icon) or **Enable breakpoint rules** in **Options** — turn **all** breakpoint handling on or off without deleting rules (see [Working with requests](/network/general#breakpoint-rules-and-mock-responses-global)).\r
\r
### Behavior\r
\r
When a request hits an active breakpoint rule the UI focuses editing:\r
\r
* the breakpoint card opens;\r
* the view may switch to **Network**;\r
* a collapsed inspector iframe expands automatically.\r
\r
Until you confirm or cancel, the request stays paused.\r
\r
## Mock responses\r
\r
![Моки запросов](/screenshots/Mock.jpg)\r
\r
### Purpose\r
\r
Mock fully replaces a network call with a local response.\r
\r
When a rule matches:\r
\r
* no server round-trip;\r
* a synthetic response is built;\r
* the page receives it like a normal HTTP response.\r
\r
### What a mock can set\r
\r
* **status** and **statusText**;\r
* **headers**;\r
* **body**;\r
* **delay** before resolving.\r
\r
### Where to configure\r
\r
* **Network** — create or adjust from a request row.\r
* **Options → Network → Mock Responses** — manage rules.\r
* **Network toolbar** (mock icon) or **Enable mock responses** in **Options** — turn **all** mock handling on or off without deleting rules (see [Working with requests](/network/general#breakpoint-rules-and-mock-responses-global)).\r
\r
### Behavior\r
\r
If mock matches:\r
\r
* the real request is not sent;\r
* breakpoint does not apply for that call.\r
\r
Order of evaluation:\r
\r
1. mock first;\r
2. if no mock — breakpoint;\r
3. otherwise normal network.\r
\r
Mock wins over breakpoint.\r
\r
---\r
\r
## Breakpoint vs mock\r
\r
| Mechanism | Network round-trip | Can change request | Can change response |\r
|-----------|-------------------|--------------------|---------------------|\r
| Breakpoint | Yes | Yes | No |\r
| Mock response | No | No | Yes |\r
\r
---\r
\r
## Limits\r
\r
Both work only for:\r
\r
* **fetch**\r
* **XMLHttpRequest**\r
\r
Not intercepted:\r
\r
* \`<img>\`, \`<script>\`, \`<link>\` loads;\r
* service workers outside this layer;\r
* native browser calls outside page JS.\r
\r
**OPTIONS (preflight)** requests are not part of interception.\r
\r
---\r
\r
## Compared to Charles Proxy\r
\r
**Charles** (and similar **system / external proxies**: Fiddler, mitmproxy, …) sits **between client and server** at the OS or app level:\r
\r
* sees traffic **beyond the browser** (mobile apps, CLI, other tools if proxied);\r
* **HTTPS** typically needs a trusted root and **SSL Proxying** (TLS termination);\r
* **Breakpoints** and **Map Local / Remote** apply to **all** matching connections **on that channel**.\r
\r
**Vue Inspector** runs **inside the browser tab**: it patches **\`fetch\`** and **\`XMLHttpRequest\`**.\r
\r
| Aspect | Charles (typical) | Vue Inspector |\r
| ------ | ----------------- | ------------- |\r
| Level | Proxy / out-of-process | JS in the page |\r
| Scope | Many clients, HTTP(S) through proxy | This document only: **fetch** and **XHR** |\r
| HTTPS | Custom trust, TLS break | No extra TLS break — the app already sees responses in JS |\r
| SW / native requests | Often visible on the path | Not covered here |\r
| SPA convenience | Proxy + certs setup | Enable rules in the inspector for the current site |\r
\r
In **intent**, Inspector breakpoints/mocks resemble Charles (**pause / fake a response**); in **placement** it is a **page-level devtool**, not a network proxy.\r
\r
## See also\r
\r
* [Working with requests](/network/general)\r
* [Export collections](/network/export)\r
`,k=`---\r
title: Auto run\r
---\r
\r
# Auto run\r
\r
> **Extension only (Chrome / Edge).** The **Auto Run** block in **Options → General** is **hidden** in **standalone**: a bookmark has no background extension process to decide when to show the panel.\r
\r
**Auto Run** controls **when** the overlay **pill** appears on sites in **overlay** mode. This is **not** the component **blacklist** on **Props** — here we only filter **site origins** (scheme, host, port).\r
\r
---\r
\r
## Basics\r
\r
Rules inspect the page **origin** (address bar host, no path). You can enter a full URL such as \`https://app.example/\` or a pattern like \`*localhost*\` where \`*\` matches any substring. Empty lists impose no restriction until you add rows (or enable whitelist mode, below).\r
\r
The overlay still **won’t** inject on pages the extension treats as **static without Vue** (separate heuristic). Lists don’t bypass that — see the extension **popup** section.\r
\r
---\r
\r
## Site Blacklist\r
\r
**Site Blacklist** — origins/patterns where the pill **must not** auto-show.\r
\r
* Add via input + **Add** (or Enter).\r
* Table shows **pattern** and **added** date; select a row to edit in the side panel.\r
* If the current origin **matches any** blacklist row, auto-run overlay is off for that tab.\r
\r
Blacklist can combine with whitelist: whitelist is evaluated first when active and non-empty.\r
\r
---\r
\r
## Site Whitelist and “whitelist mode”\r
\r
**Enable whitelist mode** activates **Site Whitelist**.\r
\r
* While the whitelist is **empty**, mode is effectively open — only blacklist (if any) applies.\r
* Once the whitelist has **at least one** row, auto overlay is **only** allowed on matching origins; everything else is denied **before** blacklist trims further.\r
\r
So a **non-empty whitelist** defines “where yes”, **blacklist** subtracts exceptions.\r
\r
---\r
\r
## Extension popup — escape hatch\r
\r
![Всплывающее окно](/screenshots/popup.jpg)\r
\r
The extension icon **popup** exposes two actions (UI labels in English: **Forced Launch**, **Reset Settings**).\r
\r
**Forced Launch** injects the inspector on the **active tab**, **ignoring** Auto Run lists and the static-site heuristic. Use when lists block all sites or **Options** is unreachable.\r
\r
**Reset Settings** performs a **full wipe** of saved inspector settings (Auto Run, theming, favorites, etc.). Last resort if configuration locks you out — there is **no** undo without a backup export.\r
\r
If you rely on a strict whitelist, keep at least one URL you use to open **Options**, or remember **Forced Launch** / **Reset Settings**.\r
\r
---\r
\r
## See also\r
\r
* [Installation → Where settings are stored](/install#storage)\r
* [Browser extension](/extension)\r
`,S=`---\r
title: Customize\r
---\r
\r
# Customize\r
\r
![Персонализация](/screenshots/Customize.jpg)\r
\r
**Options → General → Customize** controls the main inspector look: theme, background media, and how it is displayed. You style the **tool**, not the site content.\r
\r
---\r
\r
## Extension vs standalone\r
\r
Fields (**theme**, **file / URL**, opacity, blur, noise, position, scale) match. What differs is **where file bytes go** and **whether a total quota applies**.\r
\r
| | **Extension (Chrome / Edge)** | **Standalone** |\r
|---|------------------------------|----------------|\r
| **Where uploads live** | Media copies in extension **IndexedDB** (separate stores for wallpaper and saved files). | Media goes into the app’s **unified local store** (central quota). |\r
| **Size limit** | No app-enforced “N MB for media”; real cap is **IndexedDB / storage quota** for the extension profile. | **Hard 30 MB** total for decorative media in standalone storage — saves are blocked if the new total would exceed (error like “Media limit exceeded”). |\r
| **Usage meter** | The **X MB / 30 MB** counter **does not** show in Customize. | Customize shows **usage** of the media store (**MB of 30 MB**) so you see remaining headroom. |\r
\r
**URL backgrounds** do not count like uploaded files in local quota, but for offline predictability local files within quota are often simpler (in standalone respect **30 MB** total).\r
\r
---\r
\r
## Theme\r
\r
![Персонализация: селекторы](/screenshots/Customize_selectors.jpg)\r
\r
**Dark / Light** toggles inspector color scheme.\r
\r
---\r
\r
## Background (Image)\r
\r
**Image** sets the panel background. Sources — **File** and **Link**:\r
\r
* **File** — local asset via **Browse** or previously saved copies (extension: IndexedDB; standalone: unified 30 MB store — table above). Presets: [Settings management](/options/settings_management).\r
* **Link** — URL to media.\r
\r
Supported: **still images**, animated **GIF**, **MP4** video backgrounds.\r
\r
---\r
\r
## Background rendering\r
\r
| Control | Role |\r
| ------- | ---- |\r
| **Image Opacity** | Background layer transparency vs UI chrome. |\r
| **Blur** | Blur strength. |\r
| **Noise Intensity / Opacity** | Grain overlay strength/visibility. |\r
| **Position (X / Y)** | Pan the image. |\r
| **Scale** | Zoom **100–200%**. |\r
\r
Combined, you can keep background subtle or decorative without hurting readability.\r
\r
---\r
\r
## Saved files\r
\r
![Предпросмотр файла](/screenshots/File_preview.jpg)\r
\r
The **Saved Files** section on the **General** page keeps local media copies for reuse.\r
\r
They are used in several places:\r
\r
* picking a background file in **Customize**;\r
* **File** fields in **Form-data** at a **Network** breakpoint;\r
* anywhere else the inspector needs to re-select a file you already saved.\r
\r
**Extension** vs **standalone** storage rules match the table above: same idea, different backing store and total capacity.\r
\r
### File list\r
\r
The main control is a table of saved files.\r
\r
Through it you can:\r
\r
* browse saved entries;\r
* delete files;\r
* reuse them in supported editors.\r
\r
The same table lists **Saved Files** entries and **Customize** background media (**wallpapers**) together — one shared inspector media store (where it lives and any size cap still follow the **Extension vs standalone** table above).\r
\r
### Auto-saving new files\r
\r
**Auto-save new files selected via Browse** controls whether new files are added to the list automatically.\r
\r
When the option is on, a file is written to **Saved Files** when:\r
\r
* it was chosen via **Browse**;\r
* there is not already an entry with the same **name + size** pair.\r
\r
This applies, for example, when editing **Form-data** at a **Network** breakpoint.\r
\r
### Use in Form-data\r
\r
When you pick a file from the list in the **Form-data** editor, the draft stores a service reference of the form **\`__fileId:\`…**.\r
\r
When changes are applied, the injected script uses that id to attach the real file bytes to the request.\r
\r
Details: [Traffic interception](/network/traffic).\r
\r
---\r
\r
## See also\r
\r
* [Display modes](/options/display_mode)\r
* [JSON Mode](/options/json_mode) — Classic vs Advanced JSON editor (also under **General**).\r
* [Settings management](/options/settings_management)\r
`,x=`---\r
title: Display modes\r
---\r
\r
# Display modes\r
\r
**Options → General → Display Mode** chooses **where** the Vue Inspector UI lives relative to the page: **Overlay** on the page or **DevTools tab** inside the browser’s developer tools.\r
\r
> **DevTools mode requires the installed extension** (Chrome / Edge). **Standalone** disables that toggle: the inspector only runs as an overlay; there is no DevTools panel.\r
\r
After changing mode the extension suggests **reloading the page**.\r
\r
---\r
\r
## Overlay — dock, pill, and size\r
\r
![Окно приложения](/screenshots/Window.jpg)\r
\r
**Overlay** embeds the panel above the site in its own “window” in the tab.\r
\r
The **pill** (compact handle with drag affordance and chevron) is the main control:\r
\r
* **Chevron** expands/collapses inspector chrome.\r
* **Drag handle** moves the block: near window edges it **snaps** top/bottom/left/right; centered becomes a **floating** framed window.\r
\r
**Default** first open: docked to the **bottom** — full-width strip with the site visible above (resize height). Classic bottom dock.\r
\r
**Resizing:**\r
\r
* Docked: grab the **outer** edge (for bottom dock, the **top** border) to change height (bottom/top dock) or width (left/right).\r
* Floating: corners and edges resize freely.\r
\r
Position, dock side, and floating geometry **persist** between visits (within browser/extension limits).\r
\r
Whether the pill shows on a site can also depend on **Auto Run** lists — see [Auto run](/options/auto_run).\r
\r
---\r
\r
## DevTools tab\r
\r
![DevTools](/screenshots/Devtools.jpg)\r
\r
> **Extension only.** The inspector opens as a **separate tab** inside native **DevTools** (F12 / Inspect), not as a floating overlay.\r
\r
Useful if you keep tools next to Console/Network or prefer not to cover the page. Pill dragging applies to **Overlay** only; DevTools layout follows the browser panel.\r
\r
After switching to **DevTools tab**, **reload** and open DevTools — you should see **Vue Inspector** among panel tabs.\r
\r
**Reload (F5):** the inspector tab reconnects to **this** tab’s page context. No extra enable step.\r
\r
**Versus Overlay:** while overlay is **collapsed**, some page-side flows may not get a full channel to the expanded panel — **Breakpoint** / **Mock** may need you to **expand** first. In **DevTools** mode the inspector is already an **active DevTools surface**, so **Network** interception works **immediately** after reload.\r
\r
**Network after F5:** the request list **clears and refills** as the page reloads, but **Network** features (intercept, breakpoints, mocks) are **ready from the start** — no extra click to “wake” networking.\r
\r
---\r
\r
## See also\r
\r
* [Auto run](/options/auto_run) — when the overlay pill auto-shows\r
* [Customize](/options/customize) — theme and panel background\r
* [Browser extension](/extension)\r
`,T=`---\r
title: JSON Mode\r
---\r
\r
# JSON Mode\r
\r
In **Options → General**, the **JSON Mode** switch chooses which implementation is used to **view and edit JSON** across the inspector (for example request/response bodies in **Network**, payloads in **Mock response**, **Pinia** state snapshots, and **Props** component data when the content is JSON).\r
\r
Non-JSON bodies (XML, plain text, etc.) still use a **single text view** with Prism highlighting where applicable; the switch mainly affects **JSON** payloads.\r
\r
---\r
\r
## Classic\r
\r
**Classic** uses the built-in **text editor with Prism syntax highlighting** (\`JsonTextEditor\`):\r
\r
- One **plain text** surface — there is **no separate tree UI**.\r
- **Read-only** views get highlighted JSON (and other supported languages).\r
- Tuned for **large fragments**: above a size threshold, highlighting is reduced so the UI stays responsive (very large **non-JSON** read-only payloads may use a lightweight viewer instead).\r
\r
Choose Classic when you want a **minimal, fast text-only** experience.\r
\r
---\r
\r
## Advanced\r
\r
**Advanced** uses **vanilla-jsoneditor** (the \`JsonEditor\` UI component):\r
\r
- **Two representations of the same JSON**: **Text** (code) and **Tree** (structured). You can switch from the editor toolbar; the last choice (**Text** vs **Tree**) is **remembered** in settings (\`json.mode\`).\r
- **Text mode**: formatting helpers (e.g. **Format** / **Compact** where editing is allowed), **Undo / Redo**, **Search**, copy, and the same editing model as the library.\r
- **Tree mode**: expand/collapse, **breadcrumb / path** navigation, context menus on nodes, and integrated sorting / editing flows provided by the app on top of the tree.\r
\r
Choose Advanced when you need **tree navigation**, **history**, **search**, and richer editing around JSON.\r
\r
---\r
\r
## See also\r
\r
- [Customize](/options/customize) — other **General** options (theme, background, saved files).\r
- [Display modes](/options/display_mode) — how the inspector panel is shown on the page.\r
`,I=`---\r
title: Settings management\r
---\r
\r
# Save, import, and export\r
\r
**Options → General** ends with **Import**, **Export**, and **Reset**. They work in **extension** and **standalone**, but **storage backends** and **export payload shape** differ.\r
\r
Everyday edits **autosave** (debounced) — there is no separate Save button for normal fields.\r
\r
A short comparison of where bytes go: [Installation → Where settings are stored](/install#storage).\r
\r
---\r
\r
## Normal persistence paths\r
\r
### Extension (Chrome / Edge)\r
\r
On autosave / import the background worker:\r
\r
1. Writes the **settings object** (options, tables, Network/Props rules, …) to **IndexedDB** for the extension — primary durable store.\r
2. **Mirrors** the structure to **\`chrome.storage.local\`** under a key like **\`vue-inspector-settings\`** for compatibility and quick access.\r
\r
Binary Customize files are **not** inlined in JSON — the object stores **ids/metadata** while blobs sit in **\`vue-inspector-media\`** IndexedDB. Keeps the settings blob small/fast to load.\r
\r
### Standalone\r
\r
Settings go through the local storage adapter into a **central KV** store (e.g. **\`inspector-settings\`** in IndexedDB via the **storage iframe**). **Not** \`chrome.storage\` — there is no installed extension.\r
\r
Decorative media uses the same storage perimeter with a **total size budget** (see [Customize](/options/customize)).\r
\r
**sessionStorage** may cache for first paint after reload — not a substitute for durable storage.\r
\r
---\r
\r
## Export\r
\r
**Export** downloads text named like \`vue-inspector-settings-YYYY-MM-DD.txt\` containing pretty-printed JSON of in-memory settings.\r
\r
* **Standalone:** for \`savedFiles\` rows backed by blobs, export may inline **data URIs** so the backup is **portable** across browsers/machines.\r
* **Extension:** data URI payloads for heavy files are usually **stripped** — you get structure/options; re-copy media locally or re-import a **rich** standalone export if you need bytes.\r
\r
Use Export for **backups**, **migration** (especially standalone), and **versioning** presets as plain text.\r
\r
---\r
\r
## Import\r
\r
**Import** picks a file; expected **JSON** matches export (filter often \`*.txt\`).\r
\r
1. Parse and **merge with defaults**: unknown keys drop; legacy shapes **migrate** when possible.\r
2. Result loads into the same options model, then **writes once** to durable storage (extension or standalone).\r
3. UI refreshes dependent lists (breakpoints, mocks, …).\r
\r
Blobs are **not duplicated** on write — JSON mostly carries ids; importing a **standalone** export with embedded data URIs hydrates attachments; importing a **trimmed** extension export moves options/lists — you may **re-pick** backgrounds in Customize afterward.\r
\r
Bad format **aborts** with an error in the form.\r
\r
Import **overwrites** current keys present in the file. **Export** first if you need rollback.\r
\r
---\r
\r
## Reset\r
\r
**Reset** restores factory defaults and clears related **media** stores. Extension path also clears IndexedDB settings keys and \`chrome.storage.local\` inspector keys. Standalone writes the reset through the same adapter as normal saves.\r
\r
**Irreversible** without a prior export.\r
\r
Partial Auto Run reset (without full wipe) exists via the extension **popup** — see [Auto run](/options/auto_run). **Reset** here clears the **entire** profile.\r
\r
---\r
\r
## See also\r
\r
* [Installation — storage](/install#storage)\r
* [Customize](/options/customize)\r
* [Auto run](/options/auto_run)\r
`,P=`---\r
title: Update settings\r
---\r
\r
# Update settings\r
\r
Below **Customize** in **Options → General** you will find **Search Parameters** and **Auto Refresh**. They persist with the rest of the profile (see [Settings management](/options/settings_management)).\r
\r
---\r
\r
## Search Parameters\r
\r
Global rules for **text search** across tabs that share the same parameters (**Props**, **Network**, **Pinia** — field debounce/min length).\r
\r
### Search Debounce (ms)\r
\r
**Delay after typing stops** before the query applies. Avoids firing on every keystroke.\r
\r
Typical allowed range **100–1000** ms (default near **300**). Lower = snappier but more churn; higher = calmer on heavy tables.\r
\r
### Minimum Search Length\r
\r
**Minimum characters** before filtering runs. Shorter input behaves like an empty query (usually full list).\r
\r
Allowed **1–10** (often **2**). **1** reacts on first char; higher reduces noisy short prefixes.\r
\r
These fields are **shared** — one place updates **Props**, **Network**, and **Pinia** consumers.\r
\r
---\r
\r
## Auto Refresh\r
\r
**Enable auto refresh** polls **component tree** views and the **Pinia Stores** table on an interval (**Refresh Interval**: **1, 2, 5, 10, 30** seconds).\r
\r
Ticks **do not stack** if a refresh is already running.\r
\r
### Panel visibility\r
\r
Polling runs **only while the inspector panel is visible** (embedded UI considered active). **Hiding** the panel **stops** timers; showing it again **resumes** if **Enable auto refresh** stays on.\r
\r
Primarily affects **Props** and **Stores**.\r
\r
### Props storm protection\r
\r
On **Props**, besides the configured interval, very frequent tree snapshots from the page can trigger **throttling**: temporarily **pauses applying** bursts so the UI stays responsive. There is **no** user toggle — it is a protective layer.\r
\r
**Network** is **not** on this auto-refresh schedule — it follows page network events.\r
\r
Use Auto Refresh when the app mutates the tree or stores often and you want updates without hammering **Refresh** manually. Very short intervals on huge trees can cost CPU — try **10–30** s if needed.\r
\r
---\r
\r
## See also\r
\r
* [Settings management](/options/settings_management)\r
* [Display modes](/options/display_mode)\r
`,_=`---\r
title: Blacklist\r
---\r
\r
# Component blacklist (Props)\r
\r
The **Props** **blacklist** is a set of **Vue component names** excluded from the inspector tree and table. Filtering runs **before** props collection, so hidden components are skipped during traversal.\r
\r
Props overview: [Overview](/props/general).\r
\r
Do not confuse this with the **site blacklist** for overlay **auto run** (**General / Auto Run**): here only **component names** are filtered.\r
\r
---\r
\r
## Add and remove\r
\r
* **Row context menu** on **Props** — adds the current component name to the active block list.\r
* **Options → Props → Component Blacklist** — view rules, add lines, toggle state, delete.\r
\r
Duplicate names are usually not created.\r
\r
---\r
\r
## Active vs inactive\r
\r
Rules have two states:\r
\r
* **Blocked** — applied; matching components are hidden.\r
* **Off** — stored but not filtering.\r
\r
Toggle without retyping. Deleting a row removes the rule entirely.\r
\r
With no active rules, blacklist filtering is effectively off.\r
\r
---\r
\r
## Name matching\r
\r
Comparison uses the **displayed component name**.\r
\r
* Without **\`*\`** or **\`%\`** — **case-insensitive exact** match.\r
* **\`*\`** and **\`%\`** act as wildcards for name fragments.\r
\r
Examples:\r
\r
* \`MyButton\` — only **MyButton**;\r
* \`Base*\` — names starting with **Base**;\r
* \`*Modal*\` — names containing **Modal**.\r
\r
Nameless components may show as **Anonymous** when that is what the tree uses.\r
\r
---\r
\r
## Intersections\r
\r
If several rules match, each rule’s **active** state applies.\r
\r
Inactive rules do not act as exceptions — they are simply ignored until re-enabled.\r
\r
Prefer toggling a broad pattern off temporarily instead of stacking near-duplicates.\r
\r
---\r
\r
## When it applies\r
\r
Rules run on every tree rebuild:\r
\r
* manual **Refresh**;\r
* automatic refresh;\r
* reopening the tab.\r
\r
After **Options** edits the tree usually refreshes so the table reflects changes immediately.\r
\r
While a rule is active, hidden components are not selectable in the table or card.\r
\r
---\r
\r
## Tips\r
\r
* Start from **exact names** via the row context menu.\r
* **Wide patterns** help repeated noise components but need care.\r
* **Blacklist affects inspector display only** — it does not change your Vue app.\r
\r
---\r
\r
## See also\r
\r
* [Props overview](/props/general)\r
* [Inspect](/props/inspect)\r
* [Customize](/options/customize)\r
`,R=`---\r
title: Favorites\r
---\r
\r
# Favorites (Props)\r
\r
**Favorites** under **Props** are persisted **components** you can return to across sessions. Starred rows float **to the top**, show a **star** beside the name, and a header badge counts favorites visible on the current screen.\r
\r
Props overview: [Overview](/props/general).\r
\r
**Pinia favorites** are separate (**Stores** tab and **Options → Pinia**); this page covers **Vue components** only.\r
\r
---\r
\r
## Add and remove\r
\r
* **In the component card** — header **star** toggles favorite for that component.\r
* **Row context menu** on **Props** — add/remove favorite.\r
* **Props table** — click the **star** area on a row to toggle even if the icon is not always visible.\r
* **Options → Props → Favorites** — browse saved entries, delete, or jump to a component for details.\r
\r
After changes the table **re-sorts** so favorites rise (unless search filters conflict).\r
\r
---\r
\r
## What is stored\r
\r
Each entry keeps, among other fields:\r
\r
* **component name**;\r
* **identity** for matching in the tree (including root DOM signature: tag and classes);\r
* optional **nodeId** for the current session;\r
* **time added** (shown in Options).\r
\r
That lets favorites survive **reloads**: on rebuild the inspector matches saved signatures.\r
\r
---\r
\r
## Matching\r
\r
Matching uses **stable identifiers** when refreshing the tree.\r
\r
* If a numeric **session uid** is stored, it only matches **within the current tree lifecycle** (full rebuild changes uids).\r
* Entries with **name + root element signature** match on **stable cues**, not internal tree path.\r
\r
Legacy entries with only **session uid** may also use **metadata** (name, tag, class) to reconnect after reload.\r
\r
If several candidates look alike, the wrong instance may star — remove and re-add from the correct row.\r
\r
---\r
\r
## Header badge\r
\r
A **found / total** style badge shows how many favorite components are visible under current filters vs how many favorites are saved.\r
\r
Clicking the badge can jump to **Options** favorites.\r
\r
---\r
\r
## Tips\r
\r
* Use favorites for **anchor components**: headers, widgets you check often, problem areas.\r
* After **DOM structure changes**, verify stars still point to the right instance.\r
* Favorites **do not** affect runtime behavior and are unrelated to the component **blacklist**.\r
\r
---\r
\r
## See also\r
\r
* [Props overview](/props/general)\r
* [Blacklist](/props/blacklist)\r
* [Customize](/options/customize)\r
* [Store overview](/store/general) — separate Pinia favorites\r
`,C=`---\r
title: Components and props\r
---\r
\r
# Components and props\r
\r
The **Props** tab shows the **Vue instance tree** on the page: component names, link to the root DOM node, and props summaries. Full values load when you select a row; you can edit and write back where supported.\r
\r
**Inspect mode**, **favorites**, and the **component blacklist** are covered on separate pages: [Inspect](/props/inspect), [Favorites](/props/favorite), [Blacklist](/props/blacklist).\r
\r
## Top toolbar\r
\r
![Props, область заголовка](/screenshots/Props_header.jpg)\r
\r
### Component search\r
\r
The search field supports several modes. Active criteria come from **Search by** next to the input. The same options can be preset in **Options** for this tab.\r
\r
| Mode      | Purpose                                                                         |\r
| --------- | ------------------------------------------------------------------------------- |\r
| **Name**  | filter by component name                                                        |\r
| **Label** | match \`label\` string / suitable instance metadata                               |\r
| **Root**  | match root element information                                                  |\r
| **Key**   | prop names (including nested), deep search on the page                         |\r
| **Value** | prop values (including nested), query on the page                              |\r
\r
**Key** and **Value** use a minimum query length (default **2** characters; configurable in inspector search settings).\r
\r
**Partial vs exact.** If the query is **not** wrapped in quotes, enabled text modes use **substring** matching (case-insensitive). **Exact** whole-string match applies when the **entire** search text is wrapped in **double quotes** \`"..."\`.\r
\r
**Inspect** next to search picks a node on the page to filter the list; see [Inspect](/props/inspect).\r
\r
### Status chips\r
\r
Right side of **Props**:\r
\r
| Item                       | Purpose                                                                                          |\r
| -------------------------- | ------------------------------------------------------------------------------------------------ |\r
| **Filtered** (amber badge) | A page-element filter (**Inspect**) is active. Click clears the filter and restores the full list. |\r
| **N** or **N/M**           | Visible rows after filtering; with a non-empty search, **M** is total components in the snapshot. |\r
| **Favorites** ★            | Matches between the current tree and saved favorites. Click opens **Options** favorites.         |\r
| **Update**                 | **Refresh** button and last snapshot time (\`lastUpdated\`).                                       |\r
\r
## Work area\r
\r
![Props, полноэкранный режим](/screenshots/Props_full_screen.jpg)\r
\r
### Component list\r
\r
Left: the component table. Main columns (visibility in table settings):\r
\r
* **Name** — component name;\r
* **Root Element** — root DOM info for the instance (tag, classes, id when available);\r
* **Received** — count of props actually passed;\r
* **Declared** — count of props declared on the component.\r
\r
Hovering a row highlights the matching node in the page.\r
\r
The row context menu and star connect to [Favorites](/props/favorite) and [Blacklist](/props/blacklist).\r
\r
## Component details\r
\r
Selecting a component row opens a detail panel for that component.\r
\r
### Summary header\r
\r
The top of the panel shows:\r
\r
* component name;\r
* short **root DOM** info (tag and classes);\r
* size of the serialized **Received** tab payload;\r
* an **Updated:** line with the last update time for the node data.\r
\r
### Component data\r
\r
Two tabs below:\r
\r
| Tab          | Purpose                                                                       |\r
| ------------ | ----------------------------------------------------------------------------- |\r
| **Received** | props actually passed; view and edit supported                                |\r
| **Declared** | declared prop definitions (**rawProps**); view only                          |\r
\r
Both tabs are always available.\r
\r
The active tab is shown as **JSON**—text or tree—according to inspector settings.\r
\r
The editor supports **copying** the contents.\r
\r
### Navigation\r
\r
* **← Back** closes details and returns to the table;\r
* **Esc** in edit mode discards edits;\r
* **Esc** outside edit mode returns to the list.\r
\r
### Controls\r
\r
| Control     | Purpose                                                                                                                                 |\r
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------- |\r
| **Star**    | add or remove from favorites; always available                                                                                         |\r
| **Refresh** | re-fetch the selected component from the page; temporarily disabled while a refresh runs; **hidden** in **Edit** mode                  |\r
| **Edit**    | enter edit mode; **only on the Received** tab                                                                                          |\r
\r
Button order in the header (view mode): **Star → Refresh → Edit**.\r
\r
### Edit mode\r
\r
**Edit** applies **only** to the **Received** tab.\r
\r
When editing, **Refresh** and **Edit** become **Cancel** and **Save**. **Star** stays available.\r
\r
| Before editing | In edit mode                                                                 |\r
| -------------- | ----------------------------------------------------------------------------- |\r
| **Refresh**    | **Cancel** — revert the draft to the last loaded props and leave edit mode    |\r
| **Edit**       | **Save** — write changes to the app                                           |\r
\r
* **Save** is disabled if JSON fails validation;\r
* changes apply only after **Save**;\r
* if save fails, edit mode may remain—watch UI messages and the console.\r
\r
**Removing keys.** A prop deleted from the JSON gets the value Vue uses when the parent does not pass that prop:\r
\r
* the prop's **default** (a factory function is called);\r
* \`false\` for **Boolean** props without a default;\r
* otherwise \`undefined\`.\r
\r
Keys deleted inside an object prop are removed from the object. This lets you check how a component behaves when optional data is missing. After saving, the card shows the edited JSON; use **Refresh** to see the resolved values.\r
\r
The **favorite** star in this panel and in the table is described on [Favorites](/props/favorite).\r
\r
Card data reflects the **last successful** update for the selected node—use **Refresh** in the detail header to re-query props from the page, or toolbar **Refresh** on **Props** for a full snapshot refresh.\r
\r
## Display limits\r
\r
### Reading limits\r
\r
**Props on demand:** opening a card reads and serializes values for the detail panel; heavy objects hit serializer limits (below).\r
\r
The light table sends metadata and counts without full serialization of every value on each update.\r
\r
### Storage\r
\r
There is no fixed “N rows like **Network**” cap for **Props**: size depends on component count and injected-side cache policy (snapshots are pruned where a node is not expanded and not needed).\r
\r
To avoid blocking the page main thread, prop serialization applies limits including:\r
\r
* time budget per serialization pass;\r
* max nesting depth and array/object size;\r
* long string truncation and a cap on nodes per response.\r
\r
Very large or cyclic structures may appear incomplete or marked as truncated—expected safeguard behavior.\r
\r
## How it works\r
\r
### When collection starts\r
\r
The Props module attaches **after Vue is detected** on the page (unlike **Network**, which starts with the general inspector script). Until Vue initializes or the inspector is injected in the tab, the component list stays empty.\r
\r
After the first successful load you can refresh manually (**Refresh**) or on a schedule (**auto refresh** in **Options**).\r
\r
### What is monitored\r
\r
1. **Structure** — walking Vue instances yields a flat list with metadata (name, label when present, element binding, **received** and **declared** counts without full values every frame).\r
2. **Props on selection** — full values load when you open a card (lazy).\r
\r
The same channel refreshes after **Toolbar** **Refresh**, respecting the active **blacklist** (name filtering during collection—see [Blacklist](/props/blacklist)).\r
\r
### Messaging model\r
\r
The panel does not read Vue memory directly: it sends a message to the page; injected code walks instances and returns serialized data.\r
\r
Simplified flow:\r
\r
\`\`\`js\r
// Illustration: UI requests the component list; the page scanner builds structure.\r
const response = await bridge.send({\r
  type: 'COLLECT_VUE_COMPONENTS',\r
  forceRefresh: true,\r
  blacklist: { active: ['SomeNoise'], inactive: [] },\r
})\r
// response.components — names, uid, prop counts, Root Element strings…\r
// Full prop payloads load separately when a card opens (lazy).\r
\`\`\`\r
\r
This separates the **light table** from **heavy prop reads** for the selected node only.\r
\r
## See also\r
\r
* [Inspect — pick a component on the page](/props/inspect)\r
* [Favorites](/props/favorite)\r
* [Blacklist](/props/blacklist)\r
* [Update settings & auto refresh](/options/update_settings) (**Options**)\r
`,E=`---\r
title: Inspect\r
---\r
\r
# Inspect mode (pick a component on the page)\r
\r
![Инспектор](/screenshots/Inspector.jpg)\r
\r
**Inspect** on the **Props** tab lets you pick UI on the **page** and, after click, narrow the component list to the subtree tied to that node — similar to picking an element in browser DevTools, but the result is **filtering the Props table**, not opening the DOM tree.\r
\r
Overview: [Props overview](/props/general).\r
\r
---\r
\r
## Start and stop\r
\r
The **Inspect** control (pointer icon) lives on the **Props** toolbar and enables picking an element to filter components.\r
\r
Before activation the component list **refreshes** so the tree matches the page.\r
\r
By default **Inspect** temporarily **hides** the inspector overlay so it does not cover the page. Change this under **Options → Inspect Mode → Hide overlay while inspecting**.\r
\r
Clicking **Inspect** again stops picking **without** clearing an applied filter.\r
\r
**Escape** cancels picking without selecting.\r
\r
Switching tabs or closing the panel resets pick mode.\r
\r
---\r
\r
## On-page behavior\r
\r
With Inspect, pointer moves and clicks are handled **above** normal page behavior, including elements that usually ignore clicks.\r
\r
Selection binds to the nearest DOM node linked to a **Vue instance**.\r
\r
While moving the pointer, the element under it **highlights** and a **tooltip** may show:\r
\r
* component name;\r
* root element summary (tag, class fragment or \`id\`);\r
* props count;\r
* nested component count.\r
\r
Tooltip light/dark follows inspector theme.\r
\r
**Vue Inspector** UI (overlay, chevron, Inspect helpers) is excluded from picking.\r
\r
If **Hide overlay while inspecting** is on, the UI returns after pick or cancel.\r
\r
---\r
\r
## After you pick\r
\r
When a page element is chosen:\r
\r
* Inspect mode ends;\r
* the **Props** table keeps components for that **root** subtree;\r
* a **Filtered** chip shows the list is scoped.\r
\r
Click **Filtered** to clear the filter and reload the full list.\r
\r
Starting Inspect again with a filter active lets you pick another root and replace the scope.\r
\r
---\r
\r
## Limits and notes\r
\r
* If there is no Vue-related node under the cursor, selection may not filter.\r
* Deep DOM may resolve to the nearest component, not the visually expected level.\r
* Inspect only affects the component list; **favorites**, **blacklist**, and **search** still apply on top.\r
\r
More: [Favorites](/props/favorite), [Blacklist](/props/blacklist).\r
\r
---\r
\r
## See also\r
\r
* [Props overview](/props/general)\r
* [Favorites](/props/favorite)\r
* [Blacklist](/props/blacklist)\r
`,O=`---\r
title: Standalone\r
---\r
\r
# Standalone application\r
\r
> If the browser does not support the extension, or policy blocks extension installation or access to \`chrome://extensions\`, Vue Inspector can be launched via a **bookmarklet** on the current page — without installing the extension.\r
\r
## Data storage\r
\r
Standalone uses **its own local storage**: settings and media persist between launches and are **not tied to a single site**. Like the extension, it provides **a single shared profile across all domains** where the bookmark is used. Full comparison with the extension is available in [Installation → Where settings are stored](./install#storage); media limits for background assets are described in [Customize](/options/customize).\r
\r
---\r
\r
## Installation\r
\r
1. Open the <a href="../../index.html#installation" target="_self" rel="noopener">installation section</a> on the main project page.\r
2. Under **Bookmarklet Mode**, drag the **Vue Inspector** button to the browser bookmarks bar.\r
\r
---\r
\r
## Usage\r
\r
1. Open a page with a Vue application;\r
2. Click the saved **Vue Inspector** bookmark;\r
3. The inspector panel opens at the bottom of the page.\r
`,A=`---\r
title: Favorites\r
---\r
\r
# Favorites (Pinia stores)\r
\r
**Favorite stores** are a persisted list of **Pinia stores** for faster navigation on **Stores**: starred rows move **to the top**, show a **star**, and a header badge counts how many favorites match the current results.\r
\r
Store overview: [Overview](/store/general).\r
\r
**Vue component** favorites (**Props** tab) are separate: [Favorites (Props)](/props/favorite).\r
\r
---\r
\r
## Add and remove\r
\r
* **In the store card** — header **star** toggles favorite.\r
* **Row context menu** on **Stores** — add/remove favorite.\r
* **Stores table** — click the **star** area on a row.\r
* **Options → Pinia → Favorite Stores** — browse, type names, delete, open for editing.\r
\r
Settings persist in the inspector profile with other options.\r
\r
---\r
\r
## Exact names and wildcards\r
\r
Each entry defines a **store name pattern**.\r
\r
* Without **\`*\`**, matching is **exact**: the star appears only for that store name.\r
* **\`*\`** matches any substring in the name. Example: **\`use*Store\`** can match **useUserStore**, **useAuthStore**, etc.\r
\r
Removing favorite from a row clears **all** rules that match that store (exact and wildcard).\r
\r
Manual entry in **Options** uses the same wildcard rules.\r
\r
---\r
\r
## What is stored\r
\r
Per entry the inspector keeps:\r
\r
* **display name** of the store;\r
* **match pattern** (when using a mask);\r
* optional **session id** for the matched instance;\r
* **time added** for display.\r
\r
That lets favorites apply again after the store list rebuilds.\r
\r
---\r
\r
## Matching\r
\r
When stores load, names are compared to saved patterns:\r
\r
1. **exact** name match;\r
2. **wildcard** match if the entry contains **\`*\`**;\r
3. session hints may refine the mapping when available.\r
\r
If multiple stores match one mask, all matching rows can show stars.\r
\r
---\r
\r
## Sorting and badge\r
\r
After refresh, **Stores** floats favorite rows **up**.\r
\r
The header badge shows **visible favorites / total saved** for the current search.\r
\r
Clicking the badge can open **Options** for Pinia favorites.\r
\r
---\r
\r
## Editing in Options\r
\r
Open an entry to change its pattern name.\r
\r
Saving updates the rule; new masks take effect on the next match.\r
\r
Avoid empty names — they never usefully match.\r
\r
---\r
\r
## Tips\r
\r
* Favorite **core** stores: user, settings, UI shell.\r
* **Patterns** help uniform naming schemes; overly broad masks may over-select.\r
* Favorites **do not** change Pinia runtime; they are local inspector metadata.\r
\r
---\r
\r
## See also\r
\r
* [Store overview](/store/general)\r
* [Favorites (Props)](/props/favorite)\r
* [Customize](/options/customize)\r
`,N=`---\r
title: Pinia stores\r
---\r
\r
# Pinia stores\r
\r
The **Stores** tab is for inspecting **Pinia** stores registered in the app: name (id), **state** and **getter** field counts, and—after you select a row—a snapshot of **state** and **getters** that you can edit and write back where supported.\r
\r
More on editing **state** and **getters**, and **favorites** for stores:\r
\r
* [State](/store/state)\r
* [Getters](/store/getters)\r
* [Favorites](/store/favorite)\r
\r
## Top toolbar\r
\r
![Store, область заголовка](/screenshots/Store_header.jpg)\r
\r
### Store search\r
\r
The search field and **Search by** switch work like on other tabs. Search types can be preset in **Options** for **Stores**.\r
\r
| Mode      | Purpose                                                                                    |\r
| --------- | ------------------------------------------------------------------------------------------ |\r
| **Name**  | filter by store name (local to the panel)                                                |\r
| **Key**   | match field names in **state** and **getters** (search runs in the page context)           |\r
| **Value** | match field values in **state** and **getters** (also in the page context)                 |\r
\r
**Key** and **Value** use a minimum query length (default **2** characters; configurable in inspector search settings).\r
\r
**Partial vs exact.** If the query is **not** wrapped in quotes, **substring** matching is used (case-insensitive). **Exact** matching applies when the **entire** query is wrapped in **double quotes** \`"..."\`.\r
\r
Content search limits how many results are returned so very broad queries do not overload the page.\r
\r
### Status chips\r
\r
Right side of **Stores**:\r
\r
| Item              | Purpose                                                                                                                                 |\r
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------- |\r
| **N** or **N/M**  | Number of stores after filtering; with a non-empty search, **M** after the slash is the total stores in the last summary.              |\r
| **Favorites** ★   | Overlap with favorited stores. Click opens **Options** (Pinia favorites).                                                              |\r
| **Update**        | **Refresh** button, loading indicator, and time of the last successful summary (or text like \`Loading...\`).                             |\r
\r
Before requesting a summary, the panel checks that the bridge to the page is available; if the context is unavailable, data is not requested.\r
\r
## Work area\r
\r
![Pinia, полноэкранный режим](/screenshots/Pinia_full_screen.jpg)\r
\r
### Store list\r
\r
Left: the store table. Main columns (visibility in table settings):\r
\r
* **Name** — display name of the store (**baseId**);\r
* **State** — number of keys in state (dash if none);\r
* **Getters** — number of getters (dash if none).\r
\r
Rows expose a **favorite** star and a context menu. Favorites are stored in inspector settings — see [Favorites](/store/favorite).\r
\r
## Store details\r
\r
Selecting a store row opens a detail panel for that store.\r
\r
### Summary header\r
\r
The top of the panel shows:\r
\r
* store name;\r
* number of **State** keys;\r
* number of **Getters** keys;\r
* an **Updated:** line with the timestamp of the last card data refresh.\r
\r
### Store data\r
\r
Below that, tabs:\r
\r
| Tab         | Purpose                                                                                                                      |\r
| ----------- | ---------------------------------------------------------------------------------------------------------------------------- |\r
| **State**   | snapshot of reactive **state**; view and save changes                                                                         |\r
| **Getters** | snapshot of current **getter** values in serialized form; view and limited editing depending on the scenario                |\r
\r
Only tabs that have data are shown.\r
\r
The active tab is shown as **JSON**—text or tree—according to inspector settings.\r
\r
### Navigation\r
\r
* **← Back** closes details and returns to the table;\r
* **Esc** in edit mode discards edits;\r
* **Esc** outside edit mode returns to the list.\r
\r
### Controls\r
\r
| Control     | Purpose                                                                                              |\r
| ----------- | ---------------------------------------------------------------------------------------------------- |\r
| **Star**    | add or remove the store from favorites                                                                |\r
| **Refresh** | re-fetch the selected store’s data from the page; available outside **Edit** mode                     |\r
| **Edit**    | enter edit mode for the active tab (**State** or **Getters**)                                       |\r
\r
### Edit mode\r
\r
After **Edit**, **Refresh** and **Edit** are replaced by **Cancel** and **Save**.\r
\r
| Before editing | In edit mode                                                    |\r
| -------------- | --------------------------------------------------------------- |\r
| **Refresh**    | **Cancel** — discard changes and leave edit mode                |\r
| **Edit**       | **Save** — apply changes to the app                            |\r
\r
Changes are applied only after **Save**.\r
\r
For **State**, the store’s current state is updated; for **Getters**, writing is only supported in valid scenarios, and limits depend on how the store is implemented.\r
\r
The **favorite** star in this panel and in the table is described on [Favorites](/store/favorite).\r
\r
Card data reflects a **snapshot from the last request**: changes in the app are not reflected automatically until you **Refresh** in the card or refresh the summary from the **Stores** top toolbar.\r
\r
## Display limits\r
\r
### Reading limits\r
\r
1. **All-stores summary** — lightweight: each store gets id, name, **state** / **getter** key counts, and a snapshot timestamp, **without** full value serialization.\r
2. **Selected store card** — a separate request with serialized **state** and **getters** for display and editing.\r
\r
**State** and **getter** serialization uses depth and size limits: cycles, functions, and special objects may be truncated or shown differently than in raw runtime.\r
\r
**Key** / **Value** search hit lists are also capped.\r
\r
### Capacity\r
\r
There is no fixed cap on how many stores appear in the table: typical **Pinia** summary responses list them all.\r
\r
Unusual registration or extreme setups may be incomplete; whether writes succeed depends on the store—if save fails, use the UI message or the console.\r
\r
## How it works\r
\r
### When collection starts\r
\r
The injected Pinia module hooks in after **Pinia** is detected on the page (same idea as **Props**: Vue and the inspector must be active).\r
\r
If Pinia is not installed or not initialized when you open **Stores**, the list stays empty or you may see a load error.\r
\r
### What is monitored\r
\r
1. **Summary** — ids, names, and field counts for the table only.\r
2. **Single store details** — full serialized **state** and **getters** when you drill in.\r
\r
That keeps a **fast list** separate from **heavy reads** for one store.\r
\r
### Messaging\r
\r
The panel does not read Pinia directly: it sends a message to the page context where registered stores are available.\r
\r
\`\`\`js\r
// Illustration: summary request — store id, name, and key counts only\r
const response = await bridge.send({ type: 'PINIA_GET_STORES_SUMMARY' })\r
// response.summary — map storeId → { id, baseId, stateKeys, getterKeys, … }\r
\r
const detail = await bridge.send({\r
  type: 'PINIA_GET_STORE_STATE',\r
  storeId: 'my-store-id',\r
})\r
// detail.state, detail.getters — data for display and editing\r
\`\`\`\r
\r
Key/value search (\`PINIA_SEARCH\`) runs in the page and returns only matching store ids.\r
\r
## See also\r
\r
* [State](/store/state)\r
* [Getters](/store/getters)\r
* [Favorites](/store/favorite)\r
* [Update settings](/options/update_settings)\r
`,q=`---\r
title: Getters\r
---\r
\r
# Getters (Pinia)\r
\r
In **Stores**, **Getters** shows **current values** of computed fields and other properties Pinia exposes on the store instance beside **state**. Values are read from the live page, serialized for the JSON editor, and on save are applied via **patch** logic back into the app.\r
\r
Context: [Store overview](/store/general). **State** editing: [State](/store/state).\r
\r
---\r
\r
## Which fields count as getters\r
\r
\`getGetterKeys\` in \`src/injected/pinia/store-meta.ts\` collects **computed** on setup stores, keys present on \`store\` but missing from \`$state\`, and prototype properties with **get** (options stores).\r
\r
\`\`\`ts\r
function getGetterKeys(store) {\r
  const getters = []\r
  const stateKeys = new Set(Object.keys(store.$state || {}))\r
  // 1) store fields detected as computed refs\r
  // 2) key on store but not in $state\r
  // 3) getter without setter on prototype\r
  return getters\r
}\r
\`\`\`\r
\r
The summary column (**Getters: N**) shows that count.\r
\r
---\r
\r
## Reading for the UI\r
\r
\`getStoreGetters\` in \`src/injected/pinia/getters.ts\` stores \`unwrapValue(store[key])\` per getter key; errors become \`[Non-serializable]\`.\r
\r
\`\`\`ts\r
function getStoreGetters(storeId) {\r
  const store = getStore(storeId)\r
  if (!store) return {}\r
  const result = {}\r
  for (const key of getGetterKeys(store)) {\r
    try {\r
      result[key] = unwrapValue(store[key])\r
    } catch {\r
      result[key] = '[Non-serializable]'\r
    }\r
  }\r
  return result\r
}\r
\`\`\`\r
\r
Opening the card requests \`PINIA_GET_STORE_STATE\`; **getters** render in the **Getters** tab (text or tree JSON).\r
\r
---\r
\r
## Edit and save\r
\r
Saving **Getters** sends \`PINIA_PATCH_GETTERS\` with parsed JSON from the editor (\`PiniaDetails.vue\`).\r
\r
\`\`\`ts\r
async function saveGettersChanges() {\r
  const newGetters = JSON.parse(editedGettersJson.value)\r
  const response = await runtime.sendMessage({\r
    type: 'PINIA_PATCH_GETTERS',\r
    storeId,\r
    newGetters\r
  })\r
  if (response?.success) {\r
    gettersData.value = newGetters\r
    isEditingGetters.value = false\r
  }\r
}\r
\`\`\`\r
\r
\`patchGetters\` in \`src/injected/pinia/state-writer.ts\` **does not assign to pure readonly computed**; inside \`store.$patch\` it tries **backing** fields — writes to \`$state\`, writable refs, reactive merge; otherwise skips.\r
\r
\`\`\`ts\r
function patchGetters(storeId, newGetters) {\r
  const store = getStore(storeId)\r
  const updated = []\r
  store.$patch(() => {\r
    for (const [key, newValue] of Object.entries(newGetters)) {\r
      if (key in store.$state) {\r
        store.$state[key] = newValue\r
        updated.push(key)\r
      } else if (isWritableRef(store[key])) {\r
        store[key].value = newValue\r
        updated.push(key)\r
      } else if (canMergeReactive(store[key], newValue)) {\r
        mergeReactive(store[key], newValue)\r
        updated.push(key)\r
      }\r
      // pure computed — skip\r
    }\r
  })\r
  return { success: true, updated }\r
}\r
\`\`\`\r
\r
Response: \`PINIA_PATCH_GETTERS_RESULT\` (\`success\`, \`updated\`). **Refresh** afterward to confirm displayed getters match the app.\r
\r
**Removing keys.** As for [State](./state.md#removing-keys), keys deleted in the editor are sent as \`removedPaths\`. A getter itself cannot be removed, so only keys **inside** a getter value are deleted — this works when the getter returns an object from state.\r
\r
---\r
\r
## Notes\r
\r
* If a name matches **state**, the patch hits **\`$state[key]\`** — you change the source of truth.\r
* Pure read-only computed with no writable backing **won’t** change; use **state** or **actions**.\r
* Non-serializable reads show placeholders; edit carefully or via **state** / **actions**.\r
\r
---\r
\r
## See also\r
\r
* [State](/store/state)\r
* [Store overview](/store/general)\r
* [Favorites](/store/favorite)\r
`,W=`---\r
title: State\r
---\r
\r
# State (Pinia)\r
\r
In **Stores**, for the selected store, **State** shows a snapshot of **reactive fields** that belong to store state: for options stores mainly **\`$state\`** keys; for setup stores — refs and reactive objects on the store instance (excluding **computed** getters). Values go through \`unwrapValue\`, render in the JSON editor, and **Save** applies back via **\`store.$patch\`** inside \`replaceState\`.\r
\r
Context: [Store overview](/store/general). Computed-style patching: [Getters](/store/getters).\r
\r
---\r
\r
## Which keys appear in the state snapshot\r
\r
Key names come from \`getStoreStateKeys\` (\`src/injected/pinia/store-meta.ts\`): when \`$state\` exists, its keys are used; otherwise the store instance is scanned (skipping \`$\` / \`_\` / functions / **computed**).\r
\r
\`\`\`ts\r
function getStoreStateKeys(store) {\r
  if (store.$state && typeof store.$state === 'object') {\r
    return Object.keys(store.$state)\r
  }\r
  // setup-store: non-functions only, not isComputedRef(...)\r
  return collectEligibleKeysFromStoreInstance(store)\r
}\r
\`\`\`\r
\r
---\r
\r
## Reading for the UI\r
\r
\`createSnapshot\` / \`getStoreState\` in \`src/injected/pinia/state-reader.ts\` call \`unwrapValue\` per key; failures become \`[Non-serializable]\`.\r
\r
\`\`\`ts\r
function createSnapshot(store) {\r
  const snapshot = {}\r
  for (const key of getStoreStateKeys(store)) {\r
    try {\r
      snapshot[key] = unwrapValue(store[key])\r
    } catch {\r
      snapshot[key] = '[Non-serializable]'\r
    }\r
  }\r
  return snapshot\r
}\r
\r
function getStoreState(storeId) {\r
  const store = getStore(storeId)\r
  return store ? createSnapshot(store) : null\r
}\r
\`\`\`\r
\r
The bridge in \`src/injected/pinia/bridge.ts\` answers \`PINIA_GET_STORE_STATE\` with \`PINIA_STORE_STATE_DATA\` containing **state**, **getters**, and **actions** — the **State** tab uses \`state\`.\r
\r
\`\`\`ts\r
function handleGetStoreState({ storeId, requestId }) {\r
  const state = tryGet(() => getStoreState(storeId))\r
  const getters = tryGet(() => getStoreGetters(storeId))\r
  const actions = tryGet(() => getStoreActions(storeId))\r
  postMessage({ type: 'PINIA_STORE_STATE_DATA', storeId, state, getters, actions, requestId })\r
}\r
\`\`\`\r
\r
\`PiniaDetails.vue\` loads this when the card opens and fills the editor.\r
\r
\`\`\`ts\r
async function loadStoreData() {\r
  const response = await runtime.sendMessage({\r
    type: 'PINIA_GET_STORE_STATE',\r
    storeId\r
  })\r
  if (response && 'state' in response) stateData.value = response.state ?? {}\r
  if (response && 'getters' in response) gettersData.value = response.getters ?? {}\r
  await nextTick()\r
  editedStateJson.value = JSON.stringify(stateData.value, null, 2)\r
  // …same for getters JSON\r
}\r
\`\`\`\r
\r
---\r
\r
## Save: full state replace from the editor\r
\r
The UI edits the whole state JSON; saving sends \`PINIA_REPLACE_STATE\` with \`newState\` (\`PiniaDetails.vue\` → injected \`replaceState\` in \`src/injected/pinia/state-writer.ts\`).\r
\r
\`\`\`ts\r
async function saveStateChanges() {\r
  const newState = JSON.parse(editedStateJson.value)\r
  const response = await runtime.sendMessage({\r
    type: 'PINIA_REPLACE_STATE',\r
    storeId,\r
    newState\r
  })\r
  if (response?.success) {\r
    stateData.value = newState\r
    isEditingState.value = false\r
  }\r
}\r
\`\`\`\r
\r
\`\`\`ts\r
function replaceState(storeId, newState) {\r
  const store = getStore(storeId)\r
  if (!store) return false\r
  store.$patch(() => {\r
    for (const key of Object.keys(newState)) {\r
      if (shouldSkipKey(store, key)) continue // computed, read-only getter, function\r
      if (isRef(store[key])) store[key].value = newState[key]\r
      else if (isReactiveObject(store[key])) mergeIntoReactive(store[key], newState[key])\r
      else assignPrimitiveOrState(store, key, newState[key])\r
    }\r
  })\r
  return true\r
}\r
\`\`\`\r
\r
Success replies with \`PINIA_REPLACE_STATE_RESULT\`; the card may re-fetch \`PINIA_GET_STORE_STATE\` to resync.\r
\r
### Removing keys\r
\r
The merge above never deletes keys on its own, so keys removed in the editor are sent explicitly: before saving, the UI compares the loaded snapshot with the edited JSON and adds \`removedPaths\` — the paths of deleted keys (arrays are replaced as a whole and are not compared inside).\r
\r
\`\`\`ts\r
const response = await runtime.sendMessage({\r
  type: 'PINIA_REPLACE_STATE',\r
  storeId,\r
  newState,\r
  removedPaths: findRemovedPaths(stateData.value, newState) // e.g. [['user', 'middleName'], ['discount']]\r
})\r
\`\`\`\r
\r
Inside the same \`store.$patch\`, after the merge:\r
\r
* **nested keys** are deleted from their object — getters and watchers react as to a missing field;\r
* **top-level keys** of an options store are deleted from \`$state\`;\r
* **top-level keys** of a setup store are set to \`undefined\`: deleting the ref would detach it from the store, so later writes would no longer reach the state.\r
\r
Only the keys you removed are deleted; everything else keeps the merge behavior.\r
\r
---\r
\r
## Path patch (\`PINIA_PATCH_STATE\`)\r
\r
\`state-writer.ts\` exposes **\`patchState(storeId, path, value)\`**: paths like \`a.b[0].c\` unwrap refs along the way; **computed** targets reject writes. \`PINIA_PATCH_STATE\` / \`PINIA_PATCH_STATE_RESULT\` exist, but **the State form only issues full replace** (\`PINIA_REPLACE_STATE\`).\r
\r
\`\`\`ts\r
function patchState(storeId, path, value) {\r
  const store = getStore(storeId)\r
  const { parent, lastKey, finalTarget } = navigatePath(store, path) // unwrap refs\r
  if (isComputedRef(finalTarget)) return false\r
  if (isRef(finalTarget)) finalTarget.value = value\r
  else parent[lastKey] = value\r
  return true\r
}\r
\`\`\`\r
\r
---\r
\r
## Notes\r
\r
* The snapshot is **not live** until you refresh.\r
* Keys outside \`getStoreStateKeys\` won’t show in UI; **extra** keys in pasted JSON may still attempt writes — outcome depends on the store.\r
* Treat \`[Non-serializable]\` carefully or use **actions**.\r
* Computed / read-only getters are skipped in \`replaceState\`; change underlying **state** or see [Getters](/store/getters).\r
\r
---\r
\r
## See also\r
\r
* [Getters](/store/getters)\r
* [Store overview](/store/general)\r
* [Favorites](/store/favorite)\r
`,B=Object.assign({"../../../documentation/extension.md":c,"../../../documentation/general_principles.md":h,"../../../documentation/index.md":p,"../../../documentation/install.md":u,"../../../documentation/logs/export.md":m,"../../../documentation/logs/general.md":g,"../../../documentation/logs/settings.md":f,"../../../documentation/network/advanced.md":w,"../../../documentation/network/export.md":v,"../../../documentation/network/general.md":b,"../../../documentation/network/traffic.md":y,"../../../documentation/options/auto_run.md":k,"../../../documentation/options/customize.md":S,"../../../documentation/options/display_mode.md":x,"../../../documentation/options/json_mode.md":T,"../../../documentation/options/settings_management.md":I,"../../../documentation/options/update_settings.md":P,"../../../documentation/props/blacklist.md":_,"../../../documentation/props/favorite.md":R,"../../../documentation/props/general.md":C,"../../../documentation/props/inspect.md":E,"../../../documentation/standalone.md":O,"../../../documentation/store/favorite.md":A,"../../../documentation/store/general.md":N,"../../../documentation/store/getters.md":q,"../../../documentation/store/state.md":W});function M(e){const r=e.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/),s=r?.[1].match(/^title:\s*(.+)$/m)?.[1].trim()??"",t=e.slice(r?.[0].length??0).replace(/<!--[\s\S]*?-->/g,"").replace(/^[ \t]*!\[[^\]]*\]\([^)]*\)[ \t]*$/gm,"").replace(/^[ \t]*<\/?[a-z][^\n]*>[ \t]*$/gim,"").replace(/\n{3,}/g,`

`).trim();return{title:s,text:t}}function F(e){return e.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu,"").trim().replace(/\s+/g,"-")}function L(e){const r=[];let s=!1;return e.forEach((t,n)=>{/^\s*```/.test(t)&&(s=!s);const o=!s&&t.match(/^(#{1,6})\s+(.+?)\s*$/);if(!o)return;const a=o[2].match(/\s*\{#([^}]+)\}$/),d=o[2].slice(0,a?.index).replace(/[*`]/g,"");r.push({line:n,level:o[1].length,text:d,id:a?.[1]??F(d)})}),r}const l=Object.entries(B).map(([e,r])=>{const s={id:e.replace(/^.*\/documentation\//,"").replace(/\.md$/,""),...M(r)};return{...s,headings:L(s.text.split(`
`))}}).sort((e,r)=>e.id.localeCompare(r.id));function D(e,r){const s=r.trim().toLowerCase().replace(/^#/,""),t=[...e].sort((n,o)=>(n.level===1?1:0)-(o.level===1?1:0));return t.find(n=>n.text.toLowerCase()===s||n.id===s)??t.find(n=>n.text.toLowerCase().includes(s))}function z(e){const r=e.trim().toLowerCase().replace(/^\/+/,"").replace(/#.*$/,"").replace(/\.md$/,""),s=l.find(n=>n.id===r);if(s)return s;const t=l.filter(n=>n.id.split("/").pop()===r||n.title.toLowerCase()===r);return t.length===1?t[0]:t.length?t:l.filter(n=>n.id.includes(r))}function U(e,r){const s=e.text.split(`
`),t=e.headings,n=t.filter(i=>i.level>=2&&i.level<=3).map(i=>i.text),o=`# docs: ${e.id} (${e.title})`;if(!r)return n.length>2?`${o}
Sections: ${n.join("; ")}

${e.text}`:`${o}

${e.text}`;const a=D(t,r);if(!a)return`${o}
No section "${r}". Sections: ${n.join("; ")}`;const d=t.find(i=>i.line>a.line&&i.level<=a.level);return`${o}

${s.slice(a.line,d?.line).join(`
`).trim()}`}function H(e,r){const s=(Array.isArray(e)?e:e?[e]:[]).map(String).filter(Boolean).slice(0,3);return s.length?s.map(t=>{const n=t.match(/#(.+)$/)?.[1],o=z(t);return Array.isArray(o)?o.length?`Page "${t}" is ambiguous: ${o.map(a=>a.id).join(", ")}`:`No page "${t}". Pages: ${l.map(a=>a.id).join(", ")}`:U(o,r||n)}).join(`

---

`):l.map(t=>`${t.id} — ${t.title}: ${t.headings.filter(n=>n.level===2).map(n=>n.text).join("; ")}`).join(`
`)}export{H as readDocs};
