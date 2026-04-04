---
title: Standalone
---

# Standalone application

> If the browser does not support the extension, or policy blocks extension installation or access to `chrome://extensions`, Vue Inspector can be launched via a **bookmarklet** on the current page — without installing the extension.

## Data storage

Standalone uses **its own local storage**: settings and media persist between launches and are **not tied to a single site**. Like the extension, it provides **a single shared profile across all domains** where the bookmark is used. Full comparison with the extension is available in [Installation → Where settings are stored](./install#storage); media limits for background assets are described in [Customize](/options/customize).

---

## Installation

1. Open the <a href="../../index.html#installation" target="_self" rel="noopener">installation section</a> on the main project page.
2. Under **Bookmarklet Mode**, drag the **Vue Inspector** button to the browser bookmarks bar.

---

## Usage

1. Open a page with a Vue application;
2. Click the saved **Vue Inspector** bookmark;
3. The inspector panel opens at the bottom of the page.
