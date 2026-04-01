---
title: Release history
---

# Release history

## [2.0.0] - 2026-01-23

### Core

* Corporate-friendly build that does not require installation.
* Version tracking and notifications for new updates.
* Project moved to an `iframe` entry; `popup` is no longer the primary entry point.

---

### Performance

* Fixed a memory spike on static sites, including Docusaurus and Hugo.

---

### UI / UX

* Refreshed styles and overall visual design.

## [2.1.0] - 2026-02-02

### Core

* New `Network` management tab.
* Redesign for `iframe` layout instead of `popup` — more useful space on screen.
* JSON layout tweaks — editor uses full app height.
* Fixed tabs sticking when opening early — `Props` and `Pinia` no longer require a full page reload to appear.

---

### Props

* Fixed favorites not resolving after reload or repeated flows.
* Optimized Props for long sessions without excessive CPU; internal refactor.
* Props tab overhaul — better behavior with large trees and hover search.
* Removed `Props only` mode.

---

### Network

* Intercepts `fetch` and `XMLHttpRequest` except `OPTIONS` and extension-originated calls.
* Summary columns: status, method, name, duration, size.
* Detailed view: params, auth, headers, request, response — only CORS-exposed headers where applicable.
* Pause/resume capture; recording on by default on first open.
* `Breakpoint` — pause and edit outbound requests before send.
* `Mock Response` — intercept and return a synthetic response.
* Quick copy of URLs, tokens, and key fields.
* Clear all captured requests.
* Event-driven architecture without polling for lower CPU.
* Binary detection — textual preview suppressed with metadata only.

## [2.2.0] - 2026-02-24

### Core

* `Display Mode` — move the app into a `DevTools` tab or disable pure overlay.
* `Options` reorganized into logical sections.
* `Props`, `Pinia Store`, and `Network` filters editable inline without jumping to Options.
* Fixed JSON text-mode click target area.
* Large JSON no longer truncates — heavy CSS disabled for performance.
* Update notifications revised:

  * `Dismiss` → `Later`;
  * `Download` → `Preview` pointing to `Options → About`;
  * detail block with `Ignore` and `Download`.

---

### Props

* Fixed missing Props hover highlight in `Standalone`.

---

### Network

* `form-data` support for reading and traffic substitution.
* Saved files for reuse with `Breakpoint` / `form-data`.
* `Rewrite Breakpoint` / `Rewrite Mock` — overwrite existing rules instead of duplicating.
* Badges for active `Breakpoint` / `Mock` per request; click opens matching Options.
* Search by HTTP status code.
* `Breakpoint` rules consider HTTP method.
* Fixed inspector not opening when a `breakpoint` fired.
* Context menu entries: `Disable/Enable Breakpoint`, `Disable/Enable Mock`, `Delete Breakpoint/Mock` (shown when applicable).

---

### Options

#### General

* Core settings (`Display Mode`, `Search Parameters`, `Auto Refresh`, `JSON Editor Mode`) grouped together.
* `Settings Management` moved from the tab header.

#### Network

* `Search Settings` split into their own section and decoupled.
* `Breakpoints` / `Mocks` table layout fixes — rows no longer over-stretch.
* Toggle and edit existing rules.

#### Props

* Settings file controls moved into the section.
* `Component Blacklist` moved here from the general block.
* `Favorite Components` moved here from the general block.

#### Pinia Store

* Settings file controls moved into the section.

#### About

* `Release notes` and `Check for updates` (extension only).
* When an update exists:

  * `Ignore` silences this version until a newer one ships;
  * `Download` fetches the app archive.

## [2.3.0] - 2026-03-16

### Network

* `Postman` collection export from captured `Network` traffic.
* Single-panel mode: `Copy cURL` replaced with a header context menu — `Breakpoint`, `Mock`, `Copy cURL`.
* Right-click context menu on request detail header.

---

### Props

* Favorites and blacklist behavior fixes.
* Blacklist applied during collection traversal (not only table filtering) — faster Props load.
* Quick actions menu for `Props`.
* Refresh open component in read mode.
* Shortcut jump to favorites from the favorites counter.

---

### Store

* Pinia `favorites` with shortcut navigation.
* Quick actions menu for `Pinia Store`.
* Refresh open entry in read mode.
* `Options` supports manual favorite entries with `wildcards`.

---

### Options

* User files now persist as local copies in app storage.
* `Standalone` uses dedicated local storage — settings survive relaunch and work across sites.
* Tree JSON editor temporarily disabled — text mode only.

#### Customize

`Options → General → Customize` adds theming:

* `Dark / Light` color scheme;
* `Image` background (`File / Link`) with stills, `GIF`, `MP4`;
* `Browse` or pick from saved files;
* Add by URL;
* `Image Opacity`, `Blur`, `Noise Intensity / Opacity`, `Position (X / Y)`, `Scale` (`100–200%`).

---

### UI / UX

* Responsive layout for smaller screens.
* Wide layout: split list + details.
* ~`1000px` width collapses to single-panel.
* `Esc` closes panels/dialogs.
* `Ctrl+F` search in `DevTools` tab mode.
* Loading skeletons for `Props` / `Pinia` tables instead of raw “Not found”.
* Column visibility toggles for `Props`, `Pinia`, `Network`.
* Chevron redesign for iframe open/close.
* Table context menus (right-click).

---

### Performance

* Blacklist applied during Props tree pre-walk — faster data collection and tab load.

---

### Fixes

* JSON edit hit area while scrolling.
* `Network` tab freezes after long sessions.
* `Ctrl+A` selects only the focused input.
* Reset/delete buttons respect `disabled` state.
* `Options` tables with many rows.
* JSON edit mode styling.
* Minor cosmetic fixes.

## [2.4.0] - 2026-04-19

### Network

* When `Pause` is enabled, inspector interceptors are detached, so native DevTools display the `original initiator` instead of `injected.ts`.
* The `Network` table now uses virtualization for better performance and reduced UI freezes.
* The request details view now opens on the `Response` tab by default.
* When a `Breakpoint` is triggered, the paused method automatically opens on the `Request` tab.
* `Search by` lists on the `Network` tab and in `Options` now support searching by the `Name` column.

---

### Props

* `Props` performance has been significantly improved, making `auto refresh` safe to use.

* In the `Props` table, the `Props` column has been split into `Passed` and `Declared` (all columns can be hidden):

  * `Passed` — number of props currently received;
  * `Declared` — number of props declared on the component.

* In the right-side `Props details` panel, data is now split into two tabs:

  * `Passed` — props currently received (opened by default);
  * `Declared` — all props declared by the component.

* The `Props details` panel now includes a `Size` parameter.

#### Inspect (Props Inspector)

* Added page element selection mode similar to `Chrome DevTools Elements`.
* Allows selecting elements directly on the page for quick `Props` filtering.
* Highlights `Vue` components on hover.
* Displays quick element info: `Name`, `Root element`, `Received Props`, `Nested components`.
* After selection, `Props` displays only the selected element and its nested components.
* The filter can be quickly cleared via the `Filtered` badge.

---

### UI / UX

#### Windowed mode

* Added support for windowed mode with saved position for both launch modes.
* Updated the iframe open chevron with a drag indicator.
* Added support for docking the launcher to any of the four browser edges with automatic vertical stretching.

#### Auto launch settings

* Added `Whitelist` for automatic app launch and `Blacklist` for excluded sites where launch and launcher display are disabled.
* Added extension `popup` with quick actions:

  * `Forced Launch` — launches the app ignoring whitelist, blacklist, and static-site restrictions;
  * `Reset Settings` — resets all extension settings.

#### Other UI improvements

* Fixed `JSON` styling for large data volumes.
* Added exact search when entering values in quotes; without quotes, search works in `like` mode.
* Minor visual interface improvements.
* Improved `Esc` behavior in `DevTools` mode: first closes nested tabs, and when nothing else remains, opens the `DevTools Console`.

---

### Performance

* Improved `Props` and `Store` detection mechanism for significantly faster data retrieval.
* Increased limits for maximum readable `Props` count.
* Refactored internal project structure: removed unused modules, dead code, and duplicated logic.

---

### Documentation

* Full project documentation has been added.
* Added a `Documentation` section to the landing page.
* Added quick documentation access via `Options → About`.

---

### Fixes

* Blocked native right-click menu inside the application context menu.
• Fixed incorrect favorite detection in Props details when names matched.
* Improved search behavior in `DevTools mode`: fixed cases where search could stop working and added highlight reset when clearing the field or closing search.
* Fixed an issue when saving changes to `Getters` in `Pinia Store`.
* Fixed an issue with retrieving `Props` data in `Vue` during local development.
* Fixed `Network` issues during local development.
