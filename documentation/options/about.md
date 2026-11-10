---
title: About
---

# About

**Options → About** is the section labeled **About**. It does not change inspector settings.

## Vue Inspector

The text is: **A DevTools extension for inspecting Vue.js applications — components, props, Pinia stores, and network requests.**

**Version** shows the extension version. If the manifest has no version, or the version is exactly `1.0.0`, standalone shows `standalone_latest` and the extension shows `unknown`.

## Actions

**Release notes** is always shown. In the extension it loads the GitHub release whose tag is the current version. In standalone it loads the latest release. While it loads, the button is disabled.

**Check for updates** is shown only in the extension. It loads the latest release and compares that tag with the manifest version. A missing manifest version is compared as `0.0.0`. A newer tag opens **Update Available**. The same or an older tag opens **Up to Date**.

The card closes with Back or Escape.

| Card | What it shows |
| ---- | ------------- |
| **Release Notes** | **Version** and the notes. An empty note is **No release notes available.** |
| **Update Available** | **Download new version** and the version, then **What's New**. **Ignore** remembers this version so the update toast skips it until a different version is published. **Download** saves the first file attached to the release and is disabled when there is no file |
| **Up to Date** | **You're up to date!** and **Version … is the latest.** Then **Current Release Notes** when the release has notes |

A failed request shows the error in the card. The messages are **Could not determine current version.**, **No release data available.**, **Failed to fetch release notes.**, **Failed to check for updates.**, **Release not found.**, **GitHub API rate limit exceeded. Resets at …**, **GitHub API error:** and the status, or **Network error**.

## Links

**GitHub** opens [https://github.com/FirsakovAE/qa-tools](https://github.com/FirsakovAE/qa-tools). **Docs** opens [https://firsakovae.github.io/qa-tools/docs/index.html](https://firsakovae.github.io/qa-tools/docs/index.html).

## Footer

**© 2026 FirsakovAE**

**GNU General Public License v3.0** opens [https://www.gnu.org/licenses/gpl-3.0.html](https://www.gnu.org/licenses/gpl-3.0.html).

## See also

* [Release notes](/releases/history)
* [Display modes](/options/display_mode)
