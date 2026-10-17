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

## [2.6.0] - 2026-10-17

### Logs

A new **Logs** tab: one chronological journal of page events. Available in the extension and in **Bookmark** (Standalone) mode, always placed after **Pinia Store**.

#### Event types

* **Send request** / **Receive response** — `fetch` / `XMLHttpRequest` requests and responses with parameters, headers, body, status, duration and size.
* **WebSocket open** / **WebSocket sent** / **WebSocket received** / **WebSocket closed** — opening and closing connections, sent and received messages, headers, duration and the close reason.
* **Change props** — component prop changes with a **Before** / **After** comparison.
* **Emit** — component events, arguments, listener type and the parent chain.
* **Change store** — Pinia state changes with a **Before** / **After** comparison. An existing store keeps an initial snapshot; a new store keeps its full state at creation.
* **Store action** — arguments, result or error, status and duration of Pinia actions.
* **Navigation** — SPA navigation with **From** / **To**. The current page is saved when recording starts and after **Clear**.
* **JS error** — uncaught errors, unhandled promise rejections and page `console.error` calls. The message, source, location and stack are shown. Messages of Vue Inspector itself and of other browser extensions are not recorded.

#### Table and details

* Columns **Time**, **Type**, **Event**, with highlighting for errors and failed requests: **4xx** is a warning, **5xx** and errors are a critical status.
* Filter by event type and search by names, keys and values. Search modes are set in **Options → Logs → Search Settings**; a quoted query matches exactly.
* **Pause** stops recording, **Clear** empties the journal. Events are collected from the moment the inspector starts, even if the **Logs** tab is opened later.
* Details depend on the event type and include the relevant data: request parameters, headers, JSON, WebSocket messages, event arguments and state snapshots.
* Prop and Pinia changes include a **diff** of added, removed and changed paths.
* Actions menu: **Export event**, **Copy cURL**, jump to the paired request or response, **Ignore** to stop recording the selected group of events.

#### Selection and export

* Select events with checkboxes, **Shift + click** for a range, **Ctrl / Cmd + click** to toggle individual rows.
* **Export Logs (n)** exports the selected events. With nothing selected, every event that matches the current filters is exported.
* Requests and responses are always exported together.
* **Export Logs** and a single-event export create a self-contained HTML report, format version 1, that opens offline.
* Pinia changes in the report keep the data needed to view **Before** / **After**, even when earlier events were not exported.

### HTML report

A self-contained HTML report with a dark theme and no external resources.

* Sections **Report**, **Network**, **WebSocket**, **Components**, **Pinia**, **Page** with event counters.
* **Overview** summary, and **Events**, **Errors** and **Failed requests** cards that open the matching events.
* Search by titles and inside data (**in data**).
* Keyboard navigation (**↑ / ↓**, **Esc**) and direct links to events.
* Details with the same tabs as **Logs**, and a jump between a request and its response.
* **Locate** opens the event list and brings the selected event into view.
* A **Support Vue Inspector** section with links to Boosty and a USDT donation over Tron (TRC-20).

### Network

* Select requests with checkboxes and export only the selected rows with **Export Collection (n)**.
* **bp** and **mock** counts open the list of active rules. **Pause** suspends a rule, **×** deletes it.
* On a narrow panel, saving a **Breakpoint** / **Mock** or leaving the form with the back button closes the request details. On a wide panel they stay open.
* After a request or response is edited at a **Breakpoint**, the data that was actually sent is shown.
* WebSocket connections are listed as separate **WS** rows, including ones already open when the inspector starts.
* **Headers** shows the handshake headers, **Messages** shows sent and received frames, newest first. JSON is formatted; direction and size are shown.
* The latest 200 messages of a connection are kept. WebSocket is not included in **Export Collection**; **Breakpoint** and **Mock** stay available for HTTP.
* **Logs** and the HTML report record WebSocket events separately: **open**, **sent**, **received**, **closed**.
* A recognized Centrifuge close, for example **3501**, shows the reason and **No automatic reconnect**. Sending `{}` on that connection shows a warning that the socket may close.
* Binary responses show a notice with the content type; in the HTML report it uses the same styling as the truncated-data warning.

### Props / Pinia Store

Saving removed keys in **Edit** mode is fixed.

* **Pinia** — nested keys are deleted from the store; removing top-level keys is handled for both options stores and setup stores.
* **Props** — a removed prop gets the value Vue uses for a prop that is not passed: its **default**, `false` for **Boolean**, otherwise `undefined`. Nested keys of object props are deleted.

### Options → Logs

* **Search Settings** — default search modes.
* **Ignore list** — ignored event groups, with **Log again** and **Log all again**.
* **Logs and limits** — turn event types on and off, memory budget, event size limit and the **Used X of Y** indicator.
* **Data masking** — masking of sensitive data, patterns and the key list.

#### Data storage and limits

* Sensitive data is masked when an event is recorded, by keys and by value patterns, including JWT, **Bearer** / **Basic** and card numbers.
* The default memory budget is **20 MB**. When the limit is reached, older events are dropped.
* Pinia change history is compacted into a **Store checkpoint**, so the remaining changes can still be viewed.
* Repeated values are stored once and restored in full in the UI and in the HTML report.
* Events are stored whole by default. An optional event size limit of **512 KB** limits the volume by dropping large parts of events and truncating network bodies.

### UI / UX

* **Options** has a **Support Vue Inspector** section with links to Boosty and a USDT donation over Tron (TRC-20).
* Filter dropdowns use the UI kit scrollbar instead of the browser scrollbar.
* The favorites column in **Pinia** is aligned with the columns in **Props**, **Network** and **Logs**.

### Fixes

* Fixed the inspector failing to start when page global names clashed with names in the injected scripts.
* Fixed **Breakpoint** with relative request and response URLs.
* Fixed the display of the request and response data that was actually sent after a **Breakpoint** edit.
* Fixed applying edited `XMLHttpRequest` headers when the URL and method did not change.
* Fixed resolving relative URLs that were edited at a **Breakpoint**.
* Fixed saving removed keys when editing **Pinia** and **Props**.

## [2.7.0] - 2026-10-17

### AI assistant

* New **AI** tab: a chat that diagnoses the inspected site. Describe the problem, and the assistant explains what went wrong, the likely cause, the evidence (event ids and code locations) and how to fix it.
* The assistant starts from a short logs digest. When that is not enough, it reads full events (bodies, headers, store states, stacks) and searches the logs. When the logs do not explain the cause, it reads the page code.
* Page code is read from the scripts the page loaded. When the site ships source maps, stack frames are mapped to the original files (Vue components, stores) and those files can be listed, read and searched.
* When the assistant reads an error, it gets the code at the first app frames of the stack in the same step. Library and extension frames are skipped. This saves a request per frame on the free tier.
* The answer appears as the model writes it. A stopped answer keeps the text written so far.
* The **Reasoning** switch in the message field controls whether thinking models reason before answering. It is off by default to save tokens. Models that always reason (gpt-oss, Gemini Pro) then use the lowest effort.
* The message field grows with the text up to about five lines. The send / stop button and the **Reasoning** switch sit inside the field.
* Reasoning is collapsed to one line: the current thought while the model thinks, the first line afterwards. Click it to expand the full text.
* The chat uses the scrollbars of the inspector theme.
* The reasoning of thinking models and the notes the assistant writes between tool calls are shown live and kept in the steps of the answer. They are not sent back to the model, so they do not cost tokens in later requests. `<think>` blocks that some models put into the text are moved to the reasoning as well.
* Tool calls that a model writes into the text (`<tool_call>` and `<function=…>` markup) are run as tool calls. Such markup never shows up in the answer.
* One question uses at most 6 tool rounds. Near the limit the assistant is told how many rounds are left, and the last request asks for a text answer from the data collected. A repeated identical tool call is not run again: the assistant is pointed to the earlier result, so the same data is not sent twice.
* Reading minified page code is cheaper. Code search shows the line and column of a match in a minified line, with the code around it. Reading a minified script as a range, or at a line without a column, returns a short hint instead of thousands of characters of minified code. Search results also say when the page has no source maps, so the assistant does not look for original files.
* The assistant explains common harmless browser notices, such as `ResizeObserver loop completed with undelivered notifications` and `Script error.`, without spending requests on searching the code.
* Under each answer the tab shows what it cost: requests to the provider, prompt and completion tokens as the provider reports them (with the cached part), and time. The numbers are also shown for a stopped or failed answer.
* The assistant also answers questions about Vue Inspector itself.
* **Sign in with OpenRouter** connects your OpenRouter account and uses its free models. The quick-switch list offers three recommended models; the other free models with tool support are listed below them.
* Models whose providers are down are hidden, and models that fail often are marked **unstable**. The check uses the public OpenRouter status and does not spend your free requests. The refresh button next to the model list repeats it.
* Each request names two fallback models. When the chosen model is overloaded or rate-limited, a fallback answers, and the answer shows which model gave it. A model that failed is marked **busy** and skipped for 10 minutes.
* A Gemini or Groq model that is overloaded or rate-limited is replaced with another model of the same provider.
* When the provider asks to wait a few seconds (a per-minute limit), the assistant waits and repeats the request with the same model.
* The daily limit of free OpenRouter and Gemini requests is reported separately from a busy model: switching models does not help with it. Groq counts the daily limit per model, so another Groq model answers.
* As an alternative, add your own **Gemini API key** (free tier from Google AI Studio) or **Groq API key** (free tier from GroqCloud). The bookmarklet works with these keys only.
* Groq free models accept about 8K tokens a minute, so with Groq the assistant sends a shorter logs digest, cuts long tool results and drops the oldest questions of the chat.
* Keys are stored in the browser apart from the settings and are not included in settings export.
* Before the first question the tab shows what is sent to the provider. Values hidden by **Data masking** are never sent.
* The extension now requests the `identity` permission for the OpenRouter sign-in.

### Logs

* **Export for AI**, next to **Export Logs**, downloads a compact Markdown digest of the selected events, or of every event that matches the filters. It is many times smaller than the full report.
* The digest begins with a built-in guide for the AI assistant. The guide explains how to read the file, tells the assistant to start from the problems, and to ask for specific events by id instead of the whole report.
* Next comes a **Summary**: event counts by type, errors, failed requests and WebSocket connections, and the slowest requests.
* **Problems** groups identical failures and shows their evidence once: the status, error, stack, a shortened response body and the WebSocket close code. An error that came without a stack says so.
* The **Timeline** has one line per event, with the changed keys of Pinia and props changes. Repeated lines are folded.
* An event id `#N` opens the same event in the HTML report with the link `#all/N`.

### HTML report

* **Export for AI** downloads the same Markdown digest as an `.md` file.
* **Export JSON** saves the full report data, also from a compressed report.
* On a narrow screen the header buttons are shortened to **Export AI** and **JSON**.
* The **Failed requests / WS** card also counts WebSocket connections that closed with an error code, closed without automatic reconnect, or failed.

### Options → Logs

* **Export → Compress report**, on by default, stores the report data as gzip encoded in base64. The file becomes several times smaller and is unpacked when it opens.
* In a browser without gzip streams the option is disabled and reports are exported uncompressed.
* A compressed report needs Chrome / Edge 80+, Firefox 113+ or Safari 16.4+, and its data cannot be read in the file source. Use **Export JSON** or **Export for AI** in the report instead.

### Fixes

* Fixed the false **Body truncated** notice on complete responses with non-ASCII text, such as Cyrillic. The body length in characters was compared with `Content-Length` in bytes. The notice now appears only when the body was actually cut.
* Reports exported before this fix no longer show the false notice either.
