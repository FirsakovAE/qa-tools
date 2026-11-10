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


**Path** and **Method** are on by default. **Status code**, **Name**, **Key** and **Value** stay off until you enable them in **Search by** or under **Options → Network → Search Settings**. The checkboxes there are **Search by status code**, **Search by method**, **Search by path**, **Search by name**, **Search by key** and **Search by value**. If every one of them is off, a non-empty query matches nothing.

On that screen the blocks follow in this order: **Search Settings**, **Request history**, **Capture mode**, then — only while **Advanced mode** is selected — **Advanced headers**, **Header links** and **Pinned headers**, then **Breakpoints Requests** and **Mocks Responses**. The lists are described in [Traffic interception](./traffic.md) and [Advanced capture mode](./advanced.md).

The query is applied after **Search Debounce** (default **300** ms) and only once it reaches **Minimum Search Length** (default **2**). Both live under **Options → General → Search Parameters** and are shared with the other tabs ([Update settings](/options/update_settings)). A shorter query shows the full list.

**Partial vs exact match.** If the query is **not** wrapped in quotes, **substring** matching is used across enabled modes (case-insensitive for text) — similar to **`LIKE '%text%'`**. **Exact** whole-string matching applies only when the **entire** query is wrapped in **double quotes** `"..."`.

For key/value modes the body must parse as JSON; otherwise that part of the index stays empty. **Key** stores nested keys as dotted paths (`user.id`). On a WebSocket row, **Value** also searches the latest **30** text frames, each clipped to the first **1500** characters; JSON in those frames is indexed for **Key** and **Value** too. **Status code** matches the numeric status. A WebSocket row is **0** while it is connecting or the handshake failed, and **101** after that — **Open** and **Closed** are not status codes.

### Status indicators

The right side of the **Network** toolbar shows status chips. Some are **clickable**.

| Item | Purpose |
| ---- | ------- |
| **N** or **N/M** | Row count after search and the **All** / **XHR** / **WS** switch. **M** is the total rows in the buffer when that count is smaller. |
| **pending** | Requests still in flight, including a WebSocket that is still connecting. |
| **bp** (highlighted, pulse) | Breakpoints waiting for UI action. Click selects the first such row. |
| **bp** (solid amber) | Count of active breakpoint rules. Click opens **Options → Network**, the **Breakpoints Requests** table. |
| **mock** | Active mock response rules. Click opens **Options → Network**, the **Mocks Responses** table. |
| **Paused** | Traffic logging to the list is paused. |

When **breakpoint rules** or **mock response rules** are **suspended** globally (see below), the **bp** and **mock** chips keep their counts but use a **muted** style to show that those rules are **not** applied until you turn them back on.

## Log controls

### Breakpoint rules and mock responses (global) {#breakpoint-rules-and-mock-responses-global}

Next to **Pause recording** and **Clear**, the toolbar has two **icon** controls that apply to **all** configured rules of each type (without deleting them):

| Control | Icon (when active) | Meaning |
| ------- | ------------------ | ------- |
| **Breakpoint rules** | Pause / stop circle (**amber** when rules are on) | **On:** active breakpoint rules can pause matching requests. **Click:** **suspend** breakpoints — rules stay in **Options → Network → Breakpoints Requests**, but no request is held until you enable again. Tooltip: *Breakpoints on (click to suspend)* / *Breakpoints suspended (click to enable)*. |
| **Mock responses** | Shuffle (**purple** when mocks are on) | **On:** active mock rules can short-circuit matching requests. **Click:** **suspend** mocks — rules stay in **Options → Network → Mocks Responses**, but the real network runs until you enable again. Tooltip: *Mock responses on (click to suspend)* / *Mock responses suspended (click to enable)*. |

The same switches exist as **Enable breakpoint rules** and **Enable mock responses** next to the corresponding lists in **Options → Network**; changing either place updates the other.

**Note:** Suspending rules is **not** the same as **Pause recording**. Pause removes the interceptor from the page and stops logging; the global switches only disable **breakpoint** or **mock** handling while the interceptor remains (unless you also pause recording). Details: [Traffic interception](./traffic.md).

### Pause

**Pause** temporarily stops recording into the **Network** list.

While paused:

* new requests **do not appear** in Vue Inspector **Network** until you resume;
* the interceptor **is removed**: the page uses native `fetch`, `XMLHttpRequest` and `WebSocket` again (no inspector substitution).

Implications:

* in the **built-in Network** tab of DevTools the same requests show the **original initiator** (your app code), not the injected script (`injected.js`, etc.);
* while paused, interception features **do not apply** to new calls: **Mock response** and **Breakpoint** (see [traffic interception](./traffic.md)). After **Resume**, interception and rules are active again.

A call that had already entered the inspector wrapper before **Pause** still finishes: its row updates, and a breakpoint this call has already reached still waits. Calls that start after **Pause** use the native APIs and are neither logged nor intercepted.

### Clear

Clears accumulated rows next to **Pause**.

### Export Collection

**All** / **XHR** / **WS**, next to **Export Collection**, limits the table to every row, to `fetch` / XHR, or to WebSocket. **All** is the default. The last choice is kept between sessions. The switch does not remove rows from the buffer. On a narrow toolbar the switch and **Export Collection** move together to the next line.

**Export Collection** downloads a **Postman collection** (**JSON**): the current **filtered** HTTP list, or only the ticked HTTP requests. **WebSocket** rows are left out of the file. Their checkboxes stay disabled, and select all and a **Shift** range skip them. On **WS** the button stays disabled (see [Export Collection](./export.md)).

## Work area

![Network, полноэкранный режим](/screenshots/Network_full_screen.jpg)

### Request list

The left side lists captured requests, **newest first**. Until anything is captured the table says **No network requests captured yet**.

Columns come from the picker in the table header. **Name** and **Path** cannot both be hidden. **Name** is hidden by default; the other columns are shown.

| Column | What it shows |
| ------ | ------------- |
| **Status** | HTTP status. A row still in flight shows **⏳**. A failed row shows **✗**. The error text is drawn under **Path** when that column is visible. |
| **Method** | HTTP method, or **WS** for a socket. |
| **Name** | Short label taken from the URL. |
| **Path** | URL path. |
| **Time** | Duration, or **...** while the row is pending. |
| **Size** | Payload size, or **...** while the row is pending. |

A pending row is dimmed. A row held on a breakpoint has an amber background. A row that only matches a breakpoint rule has an amber bar on the left. A row that matches a mock has a purple bar, and a purple background when that row is selected. While breakpoint or mock rules are suspended globally, those marks are muted.

The first column contains checkboxes for **Export Collection** (Postman **JSON**):

| Action | Result |
| ------ | ------ |
| Click a checkbox | Select / unselect a request |
| **Shift** + click | Select a range from the last clicked row |
| **Ctrl / Cmd** + click on a row | Toggle a row without opening details |
| Header checkbox | Select all HTTP rows / clear selection |

A **WebSocket** row cannot be ticked.

The row menu (right click or **⋮**) on an HTTP row:

| Command | When it appears |
| ------- | --------------- |
| **Copy cURL** | Always. The same action is the **Copy cURL** button in the details header when the panel is at least **1000** px wide (tooltip: *Copy as cURL command (for Postman)*). On a narrower panel it stays in the **⋮** menu. Which Advanced-only headers are included is set under [Advanced capture mode](./advanced.md#advanced-headers). |
| **Ask AI** | Always. See below. |
| **Breakpoint Request** / **Rewrite Breakpoint** | **Rewrite** when the row already matches a breakpoint rule. Opens the rule form ([Traffic interception](./traffic.md)). |
| **Mock Response** / **Rewrite Mock** | **Rewrite** when the row already matches a mock. |
| **Enable** / **Disable Breakpoint**, **Delete Breakpoint** | A breakpoint rule matches this row. |
| **Enable** / **Disable Mock**, **Delete Mock** | A mock rule matches this row. |

A WebSocket row’s menu contains only **Ask AI**.

**Ask AI** (row menu and the details header menu) attaches the request to a question for the assistant. The **AI** tab opens with a chip above the input that shows the method and name: **×** removes it from the question. Type a question, or send the chip without one. The assistant gets the full request and response. When the request is in **Logs**, it gets its event id `#N`. Values are masked and cut by the AI settings.

### Request details

Opening a row shows exchange details:

* **Headers** — request and response headers;
* **Params** — query string pairs;
* **Request** — request body;
* **Response** — response body;
* **Messages** — for a WebSocket row, each sent and received message.

With nothing selected the panel says **Select a request to see details**. The section you last opened is kept for this inspector session and is not written to settings. Until you switch sections, an HTTP row opens on **Response**. A WebSocket row uses **Messages** unless **Headers** was the last section that applies. JSON bodies use the editor from **Options → General → JSON Mode** ([JSON Mode](/options/json_mode)). Text shorter than **200 KB** is pretty-printed when it is JSON; a longer body is shown as captured.

**Back** and **Escape** close the details. On a paused breakpoint they release the pause and send the original request ([Traffic interception](./traffic.md)). While a breakpoint is waiting, **Apply** sends the edited request and the card shows a **Breakpoint** badge. A changed method or URL is drawn in amber.

**GET** and **HEAD** show that the method cannot have a body. A body cut by the size limit shows **Truncated**. Until a response arrives, **Response** says **Waiting for response...**. A failed exchange shows the error text there instead of a body. Each header value has **Copy**. In Advanced mode the header row menu adds pin and link commands ([Advanced capture mode](./advanced.md#advanced-headers)).

For **`multipart/form-data`** bodies captured as structured data, **Request** is shown as a **read-only table**: field key, **Text** or **File**, cell value (text fields as-is; file fields show name and size, or **`(binary)`** when the original bytes are not kept as displayable text). **Copy** copies the visible text or the file name, depending on the row.

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

A binary response shows the content type, the size and a **Binary** badge, for example `image/jpeg (986.2 KB)`. The file itself is not stored. A binary request body shows the same badge and the text *Binary content cannot be displayed*. Durations under one second are shown with two digits after the decimal point (`635.90 ms`).

### Storage cap

The Network list keeps HTTP rows and WebSocket rows on separate rings. Each default is **500**, and each is changed under **Options → Network → Request history** (50–5000): **Maximum HTTP requests** and **Maximum WebSocket events**. When the field changes, the number is rounded and clamped into that range. A value that is not a number is reset to **500**. The new caps apply at once to the Network list and to Logs.

When a cap is reached, the oldest rows of that kind are dropped. Logs keeps the same number of HTTP requests (a request leaves together with its response) and the same number of WebSocket events (open, sent, received and closed each count as one). Both rings are separate from the memory budget.

## How it works

### When interception starts

The network module loads with the rest of Vue Inspector in the **tab context** when you open the inspector overlay or attach the DevTools panel. Until that script runs, `fetch` / `XMLHttpRequest` are not patched. A small page script runs at document start and remembers WebSocket objects the page opens, so **Network** can attach to sockets that are already connected when the inspector starts.

The buffer lives in the page after load; **Network** reads it whenever the panel is open. Without reload, history remains available when you open **Network** later (subject to the request limit above).

### What is monitored

Calls through:

* **`fetch`**
* **`XMLHttpRequest` (XHR)**
* **`WebSocket`** — one row per connection, including a socket that was already open when the inspector started. The method column shows **WS**. In the table an open socket shows **Open**, one that is still connecting shows **⏳**, a failed handshake shows **✗**, and a closed socket shows its close code. Code **1005** and a close without a code show **Closed**. A close code other than **1000**, **1001** or **1005**, and a row with an error, is shown in red. The details header uses **Open**, **Connecting**, **Closed**, or **Closed** plus the code. **Headers** in the extension shows the HTTP upgrade recorded by the browser. Bookmark mode cannot see that exchange: the tab shows **Host**, **Origin**, **User-Agent**, **Connection**, **Upgrade** and **Sec-WebSocket-Version**, plus **Sec-WebSocket-Protocol** and **Sec-WebSocket-Extensions** when the socket reports them. **Sec-WebSocket-Key**, **Sec-WebSocket-Accept** and **Cookie** stay unavailable. **Messages** lists each sent and received frame with its time, direction and size, newest at the bottom. Text is shown as text. One JSON value is formatted with indents; several JSON values in one frame, separated by newlines, are formatted as separate objects. Binary is a short hex preview. The row keeps the latest **200** messages, and a single message is stored up to **64 KB**. **Sent** sends the composed text and is enabled only while the socket is **open**. **Received** delivers that text to the page and is enabled until the socket is **closed**; such a frame is marked **Mock**. Text frames have **Copy**. If older frames were discarded, the bar shows **Earlier messages dropped:** and the count. The negotiated protocol and the close reason are shown above the list when the socket reports them. There is no **Params** tab. Breakpoint, mock and **Copy cURL** stay on `fetch` / XHR; the row menu has only **Ask AI**. **Logs** records **WebSocket open**, **WebSocket sent**, **WebSocket received** and **WebSocket closed** as separate events that share one connection. A JSON frame is shown formatted, including several JSON values separated by newlines in one frame. Those types are in the **Type** filter. When the protocol can be recognized as Centrifuge and the close code means the client will not reconnect (for example **3501**), the close event says **No automatic reconnect** and keeps the reason. Typing `{}` for such a socket shows *This frame may trigger a protocol error and disconnect the WebSocket.* **Sent** and **Received** still send that text.

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
