# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]



## [1.0.1] - 2026-01-23
### Added
ping

## [2.0.0] - 2026-01-23

### Core

* Corporate-friendly build that does not require installation.
* Version tracking and notifications for new updates.
* Project moved to an **iframe** entry; **popup** is no longer the primary entry point.

---

### Performance

* Fixed a memory spike on static sites, including Docusaurus and Hugo.

---

### UI / UX

* Refreshed styles and overall visual design.

## [2.1.0] - 2026-02-02

### Core

* New **Network** management tab.
* Redesign for **iframe** layout instead of **popup** — more useful space on screen.
* JSON layout tweaks — editor uses full app height.
* Fixed tabs sticking when opening early — **Props** and **Pinia** no longer require a full page reload to appear.

---

### Props

* Fixed favorites not resolving after reload or repeated flows.
* Optimized Props for long sessions without excessive CPU; internal refactor.
* Props tab overhaul — better behavior with large trees and hover search.
* Removed **Props only** mode.

---

### Network

* Intercepts **fetch** and **XMLHttpRequest** except **OPTIONS** and extension-originated calls.
* Summary columns: status, method, name, duration, size.
* Detailed view: params, auth, headers, request, response — only CORS-exposed headers where applicable.
* Pause/resume capture; recording on by default on first open.
* **Breakpoint** — pause and edit outbound requests before send.
* **Mock Response** — intercept and return a synthetic response.
* Quick copy of URLs, tokens, and key fields.
* Clear all captured requests.
* Event-driven architecture without polling for lower CPU.
* Binary detection — textual preview suppressed with metadata only.

## [2.2.0] - 2026-02-24

### Core

* **Display Mode** — move the app into a **DevTools** tab or disable pure overlay.
* **Options** reorganized into logical sections.
* **Props**, **Pinia Store**, and **Network** filters editable inline without jumping to Options.
* Fixed JSON text-mode click target area.
* Large JSON no longer truncates — heavy CSS disabled for performance.
* Update notifications revised:

  * **Dismiss** → **Later**;
  * **Download** → **Preview** pointing to **Options → About**;
  * detail block with **Ignore** and **Download**.

---

### Props

* Fixed missing Props hover highlight in **Standalone**.

---

### Network

* **form-data** support for reading and traffic substitution.
* Saved files for reuse with **Breakpoint** / **form-data**.
* **Rewrite Breakpoint** / **Rewrite Mock** — overwrite existing rules instead of duplicating.
* Badges for active **Breakpoint** / **Mock** per request; click opens matching Options.
* Search by HTTP status code.
* **Breakpoint** rules consider HTTP method.
* Fixed inspector not opening when a **breakpoint** fired.
* Context menu entries: **Disable/Enable Breakpoint**, **Disable/Enable Mock**, **Delete Breakpoint/Mock** (shown when applicable).

---

### Options

#### General

* Core settings (**Display Mode**, **Search Parameters**, **Auto Refresh**, **JSON Editor Mode**) grouped together.
* **Settings Management** moved from the tab header.

#### Network

* **Search Settings** split into their own section and decoupled.
* **Breakpoints** / **Mocks** table layout fixes — rows no longer over-stretch.
* Toggle and edit existing rules.

#### Props

* Settings file controls moved into the section.
* **Component Blacklist** moved here from the general block.
* **Favorite Components** moved here from the general block.

#### Pinia Store

* Settings file controls moved into the section.

#### About

* **Release notes** and **Check for updates** (extension only).
* When an update exists:

  * **Ignore** silences this version until a newer one ships;
  * **Download** fetches the app archive.

## [2.3.0] - 2026-03-16

### Network

* **Postman** collection export from captured **Network** traffic.
* Single-panel mode: **Copy cURL** replaced with a header context menu — **Breakpoint**, **Mock**, **Copy cURL**.
* Right-click context menu on request detail header.

---

### Props

* Favorites and blacklist behavior fixes.
* Blacklist applied during collection traversal (not only table filtering) — faster Props load.
* Quick actions menu for **Props**.
* Refresh open component in read mode.
* Shortcut jump to favorites from the favorites counter.

---

### Store

* Pinia **favorites** with shortcut navigation.
* Quick actions menu for **Pinia Store**.
* Refresh open entry in read mode.
* **Options** supports manual favorite entries with **wildcards**.

---

### Options

* User files now persist as local copies in app storage.
* **Standalone** uses dedicated local storage — settings survive relaunch and work across sites.
* Tree JSON editor temporarily disabled — text mode only.

#### Customize

**Options → General → Customize** adds theming:

* **Dark / Light** color scheme;
* **Image** background (**File / Link**) with stills, **GIF**, **MP4**;
* **Browse** or pick from saved files;
* Add by URL;
* **Image Opacity**, **Blur**, **Noise Intensity / Opacity**, **Position (X / Y)**, **Scale** (**100–200%**).

---

### UI / UX

* Responsive layout for smaller screens.
* Wide layout: split list + details.
* ~**1000px** width collapses to single-panel.
* **Esc** closes panels/dialogs.
* **Ctrl+F** search in **DevTools** tab mode.
* Loading skeletons for **Props** / **Pinia** tables instead of raw “Not found”.
* Column visibility toggles for **Props**, **Pinia**, **Network**.
* Chevron redesign for iframe open/close.
* Table context menus (right-click).

---

### Performance

* Blacklist applied during Props tree pre-walk — faster data collection and tab load.

---

### Fixes

* JSON edit hit area while scrolling.
* **Network** tab freezes after long sessions.
* **Ctrl+A** selects only the focused input.
* Reset/delete buttons respect **disabled** state.
* **Options** tables with many rows.
* JSON edit mode styling.
* Minor cosmetic fixes.

## [2.4.0] - 2026-04-05

### Network

* When **Pause** is enabled, inspector interceptors are detached, so native DevTools display the **original initiator** instead of **injected.ts**.
* The **Network** table now uses virtualization for better performance and reduced UI freezes.
* The request details view now opens on the **Response** tab by default.
* When a **Breakpoint** is triggered, the paused method automatically opens on the **Request** tab.
* **Search by** lists on the **Network** tab and in **Options** now support searching by the **Name** column.

---

### Props

* **Props** performance has been significantly improved, making **auto refresh** safe to use.

* In the **Props** table, the **Props** column has been split into **Passed** and **Declared** (all columns can be hidden):

  * **Passed** — number of props currently received;
  * **Declared** — number of props declared on the component.

* In the right-side **Props details** panel, data is now split into two tabs:

  * **Passed** — props currently received (opened by default);
  * **Declared** — all props declared by the component.

* The **Props details** panel now includes a **Size** parameter.

#### Inspect (Props Inspector)

* Added page element selection mode similar to **Chrome DevTools Elements**.
* Allows selecting elements directly on the page for quick **Props** filtering.
* Highlights **Vue** components on hover.
* Displays quick element info: **Name**, **Root element**, **Received Props**, **Nested components**.
* After selection, **Props** displays only the selected element and its nested components.
* The filter can be quickly cleared via the **Filtered** badge.

---

### UI / UX

#### Windowed mode

* Added support for windowed mode with saved position for both launch modes.
* Updated the iframe open chevron with a drag indicator.
* Added support for docking the launcher to any of the four browser edges with automatic vertical stretching.

#### Auto launch settings

* Added **Whitelist** for automatic app launch and **Blacklist** for excluded sites where launch and launcher display are disabled.
* Added extension **popup** with quick actions:

  * **Forced Launch** — launches the app ignoring whitelist, blacklist, and static-site restrictions;
  * **Reset Settings** — resets all extension settings.

#### Other UI improvements

* Fixed **JSON** styling for large data volumes.
* Added exact search when entering values in quotes; without quotes, search works in **like** mode.
* Minor visual interface improvements.
* Improved **Esc** behavior in **DevTools** mode: first closes nested tabs, and when nothing else remains, opens the **DevTools Console**.

---

### Performance

* Improved **Props** and **Store** detection mechanism for significantly faster data retrieval.
* Increased limits for maximum readable **Props** count.
* Refactored internal project structure: removed unused modules, dead code, and duplicated logic.

---

### Documentation

* Full project documentation has been added.
* Added a **Documentation** section to the landing page.
* Added quick documentation access via **Options → About**.

---

### Fixes

* Blocked native right-click menu inside the application context menu.
• Fixed incorrect favorite detection in Props details when names matched.
* Improved search behavior in **DevTools mode**: fixed cases where search could stop working and added highlight reset when clearing the field or closing search.
* Fixed an issue when saving changes to **Getters** in **Pinia Store**.
* Fixed an issue with retrieving **Props** data in **Vue** during local development.
* Fixed **Network** issues during local development.

## [2.5.0] - 2026-05-17

### Network

* Network header sections can be **collapsed** and **expanded**.
* The app **remembers the last details tab** you used; when you open another request, it opens on the **same tab** you had selected while viewing the previous request.

**Global suspend for Breakpoint and Mock**

On the **Network** toolbar (right side, next to log recording controls), two buttons were added: **suspend / resume all breakpoint rules** (pause-in-circle icon; active — **amber** accent) and **suspend / resume all mock responses** (shuffle icon; active — **purple** accent). Rules are **not** removed from **Options → Network**; when turned off, that interception type is **not** applied on the page. The same flags are controlled by **Enable breakpoint rules** and **Enable mock responses** next to the lists in **Options**; the toolbar and **Options** stay in sync. **bp** and **mock** badges use a **muted** style when global rule application is disabled.

**Network capture: Advanced mode**

**Network** settings include **Advanced mode**: the extension requests additional permissions and collects the **full** request and response header set (including headers not always visible in the regular DevTools **Network** tab because of page limitations). **Classic mode** still shows only headers available in the standard “classic” view without bypassing those limitations.

**Standalone**

Advanced capture and related features are **not available in Standalone**: only the classic flow runs there, without extended headers and without Advanced-only menus and settings.

**What Advanced mode adds in Network**

* **Extra headers** in the Request / Response areas on the selected request’s Headers tab.
* **Pinned headers** — pin names to the top of the list separately for **request** and **response**; edit pins in settings (Advanced only).
* **Header links** — per host and URL template, open an external resource with the header value substituted (e.g. traces, ID lookup, internal dashboards). Manage rules in **Network** settings and from the header row context menu (when Advanced).
* **Header links** and **Pinned headers** in **Options** are shown **only when Advanced mode is enabled** so Classic mode stays uncluttered.

---

### UI / UX

**JSON Mode (**Options → General**)**

**Options → General** now includes a **JSON Mode** switch with two options:

* **Classic** — built-in text editor with Prism syntax highlighting (**JsonTextEditor**): a single text view with no tree, tuned for large payloads (reduced highlighting on very long JSON and a lightweight viewer for large non-JSON read-only bodies).
* **Advanced** — **vanilla-jsoneditor**: two views of the same JSON — **Text** (code) and **Tree** (structure); switch from the toolbar; the last selected mode (**Text** / **Tree**) is **saved** in settings (**json.mode**). Advanced provides **Format** / **Compact** (where editing is allowed), **Undo / Redo**, **search**, copy; in tree mode — expand/collapse, path navigation, context menus, and sort/edit flows built on the tree.

The **Classic / Advanced** choice selects the JSON implementation across the UI (**Network** and **Mock** bodies, **Pinia** snapshots, JSON on **Props**, etc.). Non-JSON content still uses text view with highlighting where supported.

## [2.6.0] - 2026-10-12

### Logs

A new **Logs** tab: one chronological journal of what happens on the page. The tab is always visible, comes after **Pinia Store**, and works in both the extension and **Bookmark** (Standalone) modes.

#### Event types

* **Send request** / **Receive response** — every **fetch** / **XMLHttpRequest** call is logged as two events that share one network entry. The request event shows **Params**, **Headers**, **Authorization** and **Body** of the request, the response event shows **Status**, **Duration**, **Size**, **Headers** and **Body** of the response.
* **Change props** — changed props of a component with the list of changes and full **Before** / **After** snapshots.
* **Emit** — component events: component, event name, arguments, listener type (**regular** / **once**), parent chain.
* **Change store** — changed **Pinia** state with the list of changes and full **Before** / **After** snapshots. A store created while logging gets a **Store initialized** event with its full state, a store that already existed when logging started gets a **Store snapshot**; later events store only the changes, and **Before** / **After** are restored from them. A recorded store state is split like on the **Pinia Store** tab: `state` holds the declared state, `getters` holds getters and data the store keeps outside its declared state (for example, fields assigned in actions of an options store with an empty `state()`); changes of both are logged.
* **Store action** — **Pinia** action calls: arguments, result or error, status and duration.
* **Navigation** — SPA navigation (**pushState**, **replaceState**, **popstate**, **hashchange**) with **From** / **To**.
* **JS error** — uncaught errors, unhandled promise rejections and `console.error` calls of the page, with message, source, location and a compact stack (the top 10 frames; a cut is marked). Messages of Vue Inspector itself and of other browser extensions are not logged, including its internal reports of failed fetch / XHR requests (they are already **Network** events); the app’s own error messages about requests are kept.

#### Logs table

* Columns: **Time**, **Type**, **Event**; failed requests and errors are highlighted (**4xx** — warning, **5xx** / network errors / failed actions / JS errors — error).
* **Type** filter: all types are enabled by default; when every type is turned off, nothing is shown.
* Search by event name (title, component, store, URL), by key (payload keys and changed paths) and by value; the modes are preset in **Options → Logs → Search Settings**. Quoted queries use exact matching.
* **Pause** / resume recording and **Clear**.
* Events are recorded in the page from the moment the inspector loads, so the history is available when the tab is opened later.

#### Event details

* Details use the same layout as **Network**: tab strip, tables of name/value pairs and **JSON** blocks with the selected JSON mode.
* Tabs depend on the type:

  * **Send request** — **Overview**, **Params (n)**, **Headers**, **Body**, **Raw**;
  * **Receive response** — **Overview**, **Headers**, **Body**, **Raw**;
  * **Change props** / **Change store** — **Changes (n)** (diff with added / removed / changed paths), **Before**, **After**, **Raw**;
  * **Store initialized** / **Store snapshot** / **Store checkpoint** — **State**, **Overview**, **Raw**;
  * **Store action** — **Overview**, **Arguments**, **Result** / **Error**, **Raw**;
  * **Emit** — **Arguments (n)**, **Overview**, **Raw**;
  * **Navigation** / **JS error** — **Overview**, **Stack** (for errors), **Raw**.

* Actions are collected in the **⋮** menu of the details header and in the row context menu:

  * **Export event** — single-event export; for **Send request** / **Receive response** it is **Export request & response** and exports both events of the request in one file;
  * **Copy cURL** — for both network events (they share the request data);
  * **Open request event** / **Open response event** — jump to the paired network event;
  * **Ignore** — stop logging this group of events (same request, component, store, etc.).

#### Selection for export

* A checkbox column was added at the start of the **Logs** table (same position as the favorites star in **Props** and **Pinia**).
* Hotkeys: **Shift + click** — select a range, **Ctrl / Cmd + click** on a row — toggle a row, **Ctrl / Cmd + A** — select all filtered rows; the header checkbox selects or clears everything.
* When rows are selected, **Export Logs (n)** exports only them; otherwise all filtered events are exported. Network events are always exported with their pair (request + response).

#### Export and import

* **Export Logs** and single-event exports download an **HTML** report. It contains the structured event data for **Import Logs** (with a format version) and opens offline. A **Change store** event whose previous store event is not exported carries its full state, so **Before** / **After** stay available in the file.
* The report is static and self-contained (dark theme, no external resources) and repeats the **Logs** tab:

  * sidebar navigation by sections (**Report**, **Network**, **Components**, **Pinia**, **Page**) with event counters;
  * **Overview** with summary cards; **Events**, **Errors** and **Failed requests** open **All events** with the matching filter;
  * search across titles or inside data (**in data**), keyboard navigation (**↑ / ↓**, **Esc**), deep links to a selected event;
  * event details with the same tabs as in the app and a button that jumps between a request and its response;
  * **Download Vue Inspector** link to the project page at the bottom of the sidebar.

* **Import Logs** opens exported **HTML** reports, as well as **JSON** and **HTML** files from earlier builds. Imported events are shown in a separate read-only view with the file name and export time; **Back to live logs** returns to live recording. Invalid events are skipped, foreign HTML files are rejected.

#### Data safety and limits

* Sensitive data is masked when an event is captured, so it never reaches the view, exports or imports:

  * by key: password, token, secret, authorization, cookie, apikey, card number, cvv, otp and others (list is editable);
  * by value: **JWT**, **Bearer** / **Basic** credentials and card numbers inside any text.

* Every event group (**Network**, **Props changes**, **Emits**, **Pinia changes**, **Store actions**, **Navigation**, **JS errors**) can be switched off: it is not logged at all.
* Old **Change store** events are compacted into a **Store checkpoint** (*initial state → checkpoint → recent changes*) instead of being dropped, so the remaining changes keep their **Before** / **After**.
* A shared **memory budget** (64 MB by default): when it is reached, the oldest events are dropped; the newest event is always kept. A network entry shared by a request and its response, and equal bodies, are counted once.
* Events are kept whole by default (store states, props, emit arguments, network bodies), so an imported report has complete data. An optional **max event size** (512 KB by default) drops large parts of an event and truncates network bodies with a notice in the details.

#### Options → Logs

* **Search Settings** — default search modes.
* **Ignore list** — ignored event groups with **Log again** and **Log all again**.
* **What to log and limits** — switches for event groups, memory budget, optional max event size, current usage and **Defaults**.
* **Data masking** — enable masking, value patterns, own key list and **Default keys**.

---

### Network

* A checkbox column was added at the start of the **Network** table with the same hotkeys as in **Logs**; **Export Collection (n)** exports only the selected requests.
* After a request is edited at a **Breakpoint**, **Network** and **Logs** show the data that was actually sent (URL, method, headers, body), not the data captured before the pause.

---

### Props / Pinia Store

* Removing keys in **Edit** mode is now saved:

  * **Pinia** — removed nested keys are deleted from the store; removed top-level state keys are deleted (options stores) or set to `undefined` while keeping the ref link (setup stores);
  * **Props** — a removed prop gets the value Vue uses for a prop that is not passed: its **default**, `false` for **Boolean** props, otherwise `undefined`; removed keys inside an object prop are deleted.

---

### UI / UX

* Filter lists (**Search by** in **Network**, **Props**, **Pinia** and **Type** / **Search by** in **Logs**) use the UI kit scrollbar instead of the default browser one.
* The favorites star column in **Pinia** is aligned with the first column of **Props**, **Network** and **Logs**.

---

### Fixes

* Fixed the inspector failing to start on pages whose global variables clashed with names from the injected scripts (`Identifier '…' has already been declared`).
* Fixed **Breakpoint** rules never matching requests made with relative URLs.
* Fixed **Network** showing request data from before a **Breakpoint** edit.
* Fixed response **Breakpoint** rules being checked against the original URL instead of the edited one.
* Fixed **XMLHttpRequest** header edits at a **Breakpoint** not being applied when the URL and method stayed the same.
* Fixed edited relative URLs at a **Breakpoint** not being resolved against the page address.
* Fixed **Network** keeping the original response after the response was edited at a response **Breakpoint**.
* Fixed removal of keys not being saved in **Pinia** and **Props** edit modes.
