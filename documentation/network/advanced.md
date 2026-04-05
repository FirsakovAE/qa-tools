---
title: Advanced capture mode
---

# Advanced capture mode

Under **Options → Network** you can choose the **capture mode** for network traffic:

| Mode | In the UI | What it means |
| ---- | --------- | -------------- |
| **Classic mode** | classic snapshot | Same limits as in-page interception: headers and bodies are only what page scripts can read (including **CORS** rules for cross-origin). See [Working with requests](./general.md#display-limits). |
| **Advanced mode** | extended capture | The extension requests **`webRequest`** access and enriches the request details with the **full set** of request and response headers as seen by the browser for the exchange—not only the subset exposed to the page. |

**Advanced mode** (pinning headers, **Header links**, Advanced-only header visibility options) is available **only in the Chrome / Edge extension**.  
**Standalone** still runs without extended capture: the full header set via **`webRequest`** described below **is not available** there.

---

## What Advanced mode adds in the Network tab

- **Request and response headers** in request details use the extended data (including headers not listed in `Access-Control-Expose-Headers`).
- **Pinning header rows** — a header name can be pinned **to the top of the list** separately for **Request** and **Response**. Pins are toggled from the **row menu** (three dots) when Advanced mode is on.
- **Header links** — for a given header name and request **Host**, open an external URL using a template; **`{value}`** is replaced with the header value as shown in Network.

The **Header links** list, **Pinned headers** table, and **Advanced headers** options under **Options → Network** are shown **only when Advanced mode is enabled**, so Classic mode stays uncluttered.

---

## Header links

Each rule defines:

- **Header** — HTTP header name (matched **case-insensitively**);
- **Host** — host of the request URL (normalized: no scheme or path, e.g. `api.example.com`);
- **Link** — URL template; **`{value}`** is replaced with the raw header value from the request card.

You can create and edit rules from the **header row menu** on the **Network** tab (Advanced) and from **Options** when a header rule group is selected.

---

## Quick recap

- **Advanced mode** extends headers via **`webRequest`**; **Standalone** does not provide this mode.
- **Classic mode** is the original “page-visible” header model.
- **Pin** — separate for **Request** / **Response** lists.
- **Header links:** **Host** + **Link** template with **`{value}`** for the header value.
