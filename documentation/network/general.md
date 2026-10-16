---
title: Working with requests
---

# Working with requests

The **Network** tab shows network activity of the application at runtime.

## Top toolbar

![Network, область заголовка (JPG)](/screenshots/Network_header.jpg)

### Search

The search box supports multiple modes. The active criteria are chosen in **Search by** next to the input. The same options exist under **Options** for that tab so you can preset search types.

| Mode            | Description                                          |
| --------------- | ---------------------------------------------------- |
| **Status code** | Search by response status code                       |
| **Method**      | Search by HTTP method                                |
| **Path**        | Search by URL or part of the path                    |
| **Name**        | Search by request name                               |
| **Key**         | Search by keys in **JSON** request/response bodies   |
| **Value**       | Search by values in **JSON** request/response bodies |


There is a minimum query length (default **2** characters; configurable in inspector search settings).

**Partial vs exact match.** If the query is **not** wrapped in quotes, **substring** matching is used across enabled modes (case-insensitive for text) — similar to **`LIKE '%text%'`**. **Exact** whole-string matching applies only when the **entire** query is wrapped in **double quotes** `"..."`.

For key/value modes the body must parse as JSON; otherwise the search index may be empty.

### Status indicators

The right side of the **Network** toolbar shows status chips. Some are **clickable**.

| Item | Purpose |
| ---- | ------- |
| **N** or **N/M** | Row count after search and the **All** / **XHR** / **WS** switch. **M** is the total rows in the buffer when that count is smaller. |
| **pending** | Requests still in flight. |
| **bp** (highlighted, pulse) | Breakpoints waiting for UI action. Click selects the first such row. |
| **bp** (solid amber) | Count of active breakpoint rules. Click opens that list. **Pause** disables a rule without deleting it; **×** deletes it. Disabled rules leave the list. |
| **mock** | Active mock response rules. Click opens that list, with the same **Pause** and **×** actions. |
| **Paused** | Traffic logging to the list is paused. |

When **breakpoint rules** or **mock response rules** are **suspended** globally (see below), the **bp** and **mock** chips keep their counts but use a **muted** style to show that those rules are **not** applied until you turn them back on.

## Log controls

### Breakpoint rules and mock responses (global) {#breakpoint-rules-and-mock-responses-global}

Next to **Pause recording** and **Clear**, the toolbar has two **icon** controls that apply to **all** configured rules of each type (without deleting them):

| Control | Icon (when active) | Meaning |
| ------- | ------------------ | ------- |
| **Breakpoint rules** | Pause / stop circle (**amber** when rules are on) | **On:** active breakpoint rules can pause matching requests. **Click:** **suspend** breakpoints — rules stay in **Options → Network → Breakpoints**, but no request is held until you enable again. Tooltip: *Breakpoints on (click to suspend)* / *Breakpoints suspended (click to enable)*. |
| **Mock responses** | Shuffle (**purple** when mocks are on) | **On:** active mock rules can short-circuit matching requests. **Click:** **suspend** mocks — rules stay in **Options → Network → Mock Responses**, but the real network runs until you enable again. Tooltip: *Mock responses on (click to suspend)* / *Mock responses suspended (click to enable)*. |

The same switches exist as **Enable breakpoint rules** and **Enable mock responses** next to the corresponding lists in **Options → Network**; changing either place updates the other.

**Note:** Suspending rules is **not** the same as **Pause recording**. Pause removes the interceptor from the page and stops logging; the global switches only disable **breakpoint** or **mock** handling while the interceptor remains (unless you also pause recording). Details: [Traffic interception](./traffic.md).

### Pause

**Pause** temporarily stops recording into the **Network** list.

While paused:

* new requests **do not appear** in Vue Inspector **Network** until you resume;
* the interceptor **is removed**: the page uses native `fetch`, `XMLHttpRequest` and `WebSocket` again (no inspector substitution).

Implications:

* in the **built-in Network** tab of DevTools the same requests show the **original initiator** (your app code), not the injected script (`injected.js`, etc.);
* while paused, interception features **do not apply**: **Mock response** and **Breakpoint** (see [traffic interception](./traffic.md)). After **Resume**, interception and rules are active again.

### Clear

Clears accumulated rows next to **Pause**.

### Export Collection

**All** / **XHR** / **WS**, next to **Export Collection**, limits the table to every row, to `fetch` / XHR, or to WebSocket. **All** is the default. The switch does not remove rows from the buffer.

**Export Collection** saves the current **filtered** HTTP list, or only the ticked HTTP requests. **WebSocket** rows are left out of the file. Their checkboxes stay disabled, and select all and a **Shift** range skip them. On **WS** the button stays disabled (see [Export collections](./export.md)).

## Work area

![Network, полноэкранный режим](/screenshots/Network_full_screen.jpg)

### Request list

The left side lists captured requests.

Per request you typically see:

* **Name / Path** — short name or path;
* **Status** — HTTP status;
* **Time** — duration;
* **Size** — payload size;

Column visibility is configurable.

The first column contains checkboxes for choosing requests to export:

| Action | Result |
| ------ | ------ |
| Click a checkbox | Select / unselect a request |
| **Shift** + click | Select a range from the last clicked row |
| **Ctrl / Cmd** + click on a row | Toggle a row without opening details |
| Header checkbox | Select all HTTP rows / clear selection |

A **WebSocket** row cannot be ticked.

### Request details

Opening a row shows exchange details:

* **Headers** — request and response headers;
* **Params** — query string pairs;
* **Request** — request body;
* **Response** — response body;
* **Messages** — for a WebSocket row, each sent and received message.

For **`multipart/form-data`** bodies captured as structured data, **Request** is shown as a **read-only table**: field key, **Text** or **File**, cell value (text fields as-is; file fields show name and size, or **`(binary)`** when the original bytes are not kept as displayable text). **Copy** copies the visible text or the file name, depending on the row.

The **`X-Request-Id`** header (and similar) may be visually emphasized when present.

## Display limits

### Reading limits

Vue Inspector only shows headers and bodies **visible to page JavaScript** after the request completes.

For **cross-origin** responses browsers apply **CORS**: not every response header is exposed unless listed in **`Access-Control-Expose-Headers`**.  
For example, if `X-Request-Id` is missing from:

```http
Access-Control-Expose-Headers: X-Request-Id
```

(or a list that includes it), the page may not see it in `response.headers` — and Network will not show it, even if the browser’s native Network tab does.

On **same-origin** requests headers are usually available unless another policy hides them.

In the **Vue Inspector extension** for Chrome / Edge, **Advanced mode** (capture setting under **Options → Network**) can enrich request and response headers with browser-level data beyond what the page is allowed to read. For details, header pinning, **Header links**, and related options, see [Advanced capture mode](./advanced.md).

Very large bodies may be truncated (roughly **20 MB** captured text in code).

An image response (**PNG**, **JPEG**, **GIF**, **WEBP**, **BMP**, **SVG**, **AVIF**, **ICO**) shows the picture under the content-type bar, for example `image/jpeg (986.2 KB)` with a **Binary** badge. Other binary types use the same bar, then **Preview unavailable** and **Preview is not supported for this file format.** A picture larger than **8 MB** keeps the bar without the picture. Durations under one second are shown with two digits after the decimal point (`635.90 ms`).

### Storage cap

At most **500** requests are kept.

When the cap is reached, oldest entries are dropped so recent activity remains visible.

## How it works

### When interception starts

The network module loads with the rest of Vue Inspector in the **tab context** when you open the inspector overlay or attach the DevTools panel. Until that script runs, `fetch` / `XMLHttpRequest` are not patched. A small page script runs at document start and remembers WebSocket objects the page opens, so **Network** can attach to sockets that are already connected when the inspector starts.

The buffer lives in the page after load; **Network** reads it whenever the panel is open. Without reload, history remains available when you open **Network** later (subject to the **500** entry cap).

### What is monitored

Calls through:

* **`fetch`**
* **`XMLHttpRequest` (XHR)**
* **`WebSocket`** — one row per connection, including a socket that was already open when the inspector started. The method column shows **WS**. While the socket is open the status is **Open**; after a normal close it shows the close code (**1000** / **1001**) or **Closed**. **Headers** shows the HTTP upgrade request and response recorded by the extension. **Messages** lists each sent and received frame with its time, direction and size, newest first. Text is shown as text. One JSON value is formatted with indents; several JSON values in one frame, separated by newlines, are formatted as separate objects. Binary is a short hex preview. The row keeps the latest **200** messages, and a single message is stored up to **64 KB**. **Sent** sends the composed text on the open socket. **Received** delivers that text to the page. There is no **Params** tab. Breakpoint, mock and **Copy cURL** stay on `fetch` / XHR; the row menu is disabled. **Logs** records **WebSocket open**, **WebSocket sent**, **WebSocket received** and **WebSocket closed** as separate events that share one connection. A JSON frame is shown formatted, including several JSON values separated by newlines in one frame. Those types are in the **Type** filter. When the protocol can be recognized as Centrifuge and the close code means the client will not reconnect (for example **3501**), the close event says **No automatic reconnect** and keeps the reason. Typing `{}` for such a socket shows *This frame may trigger a protocol error and disconnect the WebSocket.* **Sent** and **Received** still send that text.

Not captured, among others:

* other APIs (`navigator.sendBeacon`, `EventSource`, `<img>` / `<script>` loads without XHR);
* **OPTIONS** preflights (filtered out);
* extension URLs (`chrome-extension://`, `moz-extension://`, …).

Each HTTP row records the initiator type: **fetch** or **xhr**. A WebSocket row records **websocket**.

### Interception model

Unlike the browser **Network** DevTools tab (engine-level), Vue Inspector runs **in the page**: it wraps global `fetch` and XHR methods, performs the real network call, then reads whatever the response object exposes to the page (headers, body, status, timing).

Simplified `fetch` idea:

```js
// Illustration: after the real request, headers come from response.headers.
// Names are limited by the browser (including CORS), not “all” wire headers.
window.fetch = async function patchedFetch(input, init) {
  const response = await originalFetch.call(window, input, init)
  const headersForUi = []
  response.headers.forEach((value, name) => {
    headersForUi.push({ name, value })
  })
  // …send metadata and body to the inspector UI…
  return response
}
```
