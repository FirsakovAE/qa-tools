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
- **Header links** — for a given header name and request **Host**, open an external URL using a template; the **`{value}`** placeholder (and optional **value pipeline**) controls how the header text is inserted into the link. See [Header links](#header-links) below.

The **Header links** list, **Pinned headers** table, and **Advanced headers** options under **Options → Network** are shown **only when Advanced mode is enabled**, so Classic mode stays uncluttered.

---

## Header links

Each rule defines:

- **Header** — HTTP header name (matched **case-insensitively**);
- **Host** — host of the request URL (normalized: no scheme or path, e.g. `api.example.com`);
- **Link** — URL template; placeholders are resolved as described in **[Value placeholder and pipeline](#value-placeholder-and-pipelines)**.

You can create and edit rules from the **header row menu** on the **Network** tab (Advanced) and from **Options** when a header rule group is selected.

### Value placeholder and pipeline {#value-placeholder-and-pipelines}

Inside the **Link** field you can use:

- **`{value}`** — insert the header value exactly as shown on the request card (same as a pipeline with no steps).
- **`{value|…}`** — run a **pipeline**: after `{value`, list steps separated by **`|`**; apply them **left → right**, then insert the result. Example: `{value|trim|urlencode}`.

Use a **pipe** `|` between steps. The parser splits the chain at `|` only when the **next** segment starts with a **known operation** (see tables below). That way, a `|` **inside a regex** (e.g. alternation `a|b`) is usually fine, as long as the substring after a candidate split does not look like a new op.

If a step is invalid (e.g. bad regex), that step is skipped and the value is left unchanged for that step.

#### No-argument operations

| Op | Effect |
| --- | --- |
| `trim` | Trim leading/trailing whitespace. |
| `lower` | Lowercase. |
| `upper` | Uppercase. |
| `urlencode` | `encodeURIComponent`-style encoding for use in URL query parts. |
| `urldecode` | Decode URI component (`+` treated as space). Invalid escapes leave the value unchanged. |
| `base64encode` / `base64decode` | Base64 of UTF-8 bytes. |
| `hexencode` / `hexdecode` | Hex string ↔ UTF-8 bytes (`hexdecode` ignores whitespace). |
| `md5` | MD5 hex digest of UTF-8 input (sync). |
| `sha1` / `sha256` | SHA-1 / SHA-256 hex digest via **Web Crypto** (`crypto.subtle`). Requires a context where SubtleCrypto is available (e.g. **HTTPS** or extension pages); otherwise the digest step yields an empty string. |

#### Regex and replacement

| Op | Syntax | Notes |
| --- | --- | --- |
| `regex` | `regex:<pattern>` | `new RegExp(<pattern>)` (no flags in the syntax—add them inside the pattern if your engine supports it). Sets the **last match** for a following `replace`. On no match, the value becomes empty. |
| `replace` | `replace:<template>` | After `replace:`, substitute `$1`, `$2`, … from the **last** `regex` match. If there was no match, result is empty. |
| `replaceRegex` | `replaceRegex:<pattern>:<template>` | **Pattern** and **template** are split at the **last** `:` in the segment—so a `:` inside the pattern is awkward; prefer `regex` + `replace` instead. Uses `String.replace` with a `RegExp`. |
| `match` | `match:<pattern>` | If the value matches, keep it; otherwise replace with empty string. |

#### Strings and structure

| Op | Syntax | Notes |
| --- | --- | --- |
| `replaceText` | `replaceText:<from>:<to>` | **From** / **to** use the **last** `:` in the payload as separator between `to` and everything before it (`from` may contain `:`). Global replace of all `from` occurrences. Empty `from` skips the step. |
| `substring` | `substring:<start>` or `substring:<start>:<length>` | Same idea as `String.slice` / `substring`: with two numbers, length is a **character count** from `start`. |
| `split` | `split:<delimiter>:<index>` | **Index** is the part after the **last** `:` (must be digits). **Delimiter** is everything before that `:` (may contain `:`). Empty part if index is out of range. |

#### Conditions and defaults

| Op | Syntax | Notes |
| --- | --- | --- |
| `default` | `default:<fallback>` | If the current value is exactly the **empty string** after previous steps, set it to `<fallback>`. To treat whitespace-only as empty, use `trim` first. |
| `ifMatch` | `ifMatch:<pattern>:<ifTrue>:<ifFalse>` | **False** branch is after the **last** `:`; **true** branch is between the **second-to-last** and **last** `:`; **pattern** is everything before the **second-to-last** `:` (so colons inside branches are constrained by this rule). |

### Examples

```text
https://trace.example.com/?id={value}
```

```text
https://trace.example.com/?id={value|trim|urlencode}
```

```text
https://trace.example.com/?t={value|regex:^Bearer\s+(.+)$|replace:$1|urlencode}
```

```text
https://trace.example.com/?t={value|default:unknown}
```

Multiple placeholders in one template are allowed; each `{value...}` block is resolved independently using the **same** header value.

---

## Quick recap

- **Advanced mode** extends headers via **`webRequest`**; **Standalone** does not provide this mode.
- **Classic mode** is the original “page-visible” header model.
- **Pin** — separate for **Request** / **Response** lists.
- **Header links:** **Host** + **Link** template: **`{value}`** or pipeline **`{value|op|…}`** for the header value.
