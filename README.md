# Vue Inspector

**Vue Inspector** is a tool for analyzing Vue applications at runtime without requiring access to source code, local builds, or a development environment.

The project is designed for scenarios where standard browser devtools are no longer sufficient: a significant part of frontend logic lives inside props, stores, reactive connections, and internal component runtime states that are not visible through the DOM, network, or console alone.

The tool makes it possible to inspect an application directly on a live page — exactly in the state in which it exists at execution time.

---

## Why It Matters

Modern frontend applications are increasingly structured in a way where external observation no longer explains internal behavior.

Standard tools reveal only part of the picture:

* Network shows transport
* DOM shows output
* Console shows errors

But a substantial part of the logic exists between them:

* props
* store
* reactive state
* internal component transitions

Vue Runtime Inspector provides direct access to this runtime layer without requiring additional dev tools or local environment reproduction.

---

## Core Features

### Props

* Vue component detection on the page
* runtime props inspection
* analysis of received and declared props
* search by component, DOM, and values
* JSON editing without page reload
* favorites / blacklist / quick actions
* direct component selection on the page via Inspect mode

### Store

* active Pinia store detection
* inspection of `state`, `getters`, and `actions`
* live state editing during page execution
* favorites and custom search templates

### Network

* `fetch` / `XHR` inspection
* request breakpoint before sending
* request payload modification
* mock response support
* response substitution without proxy or certificates
* Postman collection generation

---

## How It Differs from Standard DevTools

Unlike classic Vue Devtools, this tool is designed not only for local development but also for working with already running applications where:

* source code access is unavailable
* local project build is not accessible
* production or test environments must be inspected
* fast access to runtime data is required without dev environment setup

---

## Launch Modes

* Browser Extension
* Embedded iframe
* DevTools mode
* Standalone bookmark

The standalone mode is especially useful in corporate environments where extension installation is restricted.

---

## Best Use Cases

Vue Runtime Inspector is especially useful for:

* frontend application testing
* complex integration analysis
* locating data transfer issues
* component behavior investigation
* reactive state verification

---

## Roadmap

The current production branch of the project is implemented for Vue.

In the future, the architecture is considered a foundation for extending the runtime inspection approach to other frontend ecosystems, including React.

---

## Installation

### Extension

```bash
npm install
npm run build
```

Then:

```text
chrome://extensions/
→ Developer mode
→ Load unpacked
→ dist/
```

### Standalone

Open:

```text
https://firsakovae.github.io/qa-tools/
```

Drag the bookmark and launch it on the target page.
