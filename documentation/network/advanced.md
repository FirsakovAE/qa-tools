---
title: Advanced capture mode
---

# Advanced capture mode

Under **Options → Network** you can choose the **capture mode** for network traffic:

| Mode | In the UI | What it means |
| ---- | --------- | -------------- |
| **Classic mode** | classic snapshot | Same limits as in-page interception: headers and bodies are only what page scripts can read (including **CORS** rules for cross-origin). See [Working with requests](./general.md#display-limits). |
| **Advanced mode** | extended capture | The extension requests **`webRequest`** access and enriches the request details with the **full set** of request and response headers as seen by the browser for the exchange—not only the subset exposed to the page. |

Turning on **Advanced mode** and related features (pinning headers, **Header links**, editing rules with **Extract regex** and **Transform**) is available **only in the Chrome / Edge extension**.  
**Standalone** still runs without extended capture: the full header set via **`webRequest`** described below **is not available** there.

---

## What Advanced mode adds in the Network tab

- **Request and response headers** in request details use the extended data (including headers not listed in `Access-Control-Expose-Headers`).
- **Pinning header rows** — a header name can be pinned **to the top of the list** separately for **Request** and **Response**. Pins are toggled from the **row menu** (three dots) when Advanced mode is on.
- **Header links** — a rule meaning “for this header on this host, open an external URL”; the template substitutes a processed value for the `{value}` placeholder.

The **Header links** list and **Pinned headers** table under **Options → Network** are shown **only when Advanced mode is enabled**, so Classic mode stays uncluttered.

---

## Header links

Each rule defines:

- **Header** — HTTP header name (matched **case-insensitively**);
- **Host** — host of the request URL (normalized: no scheme or path, e.g. `api.example.com`);
- **Link** — URL template where **`{value}`** is replaced by the **final string** after extract and transform (see below).

You can create and edit rules from the **header row menu** on the **Network** tab (Advanced) and from **Options** when a header rule group is selected.

**`{value}`** is built as follows:

1. Start from the **raw** header value shown on the request card.
2. Optionally apply **Extract regex** (if the field is set).
3. Optionally apply a **Transform** chain (if the field is set).
4. Substitute the result into every **`{value}`** in the link template.

**Extract regex** and **Transform** are **independent**: you can set regex only, transform only, or both.

---

## Extract regex

- The string is used as the **pattern** for **`new RegExp(pattern)`** (no separate flags argument; if you need flags, they must be expressible in the pattern string where syntax allows).
- **`String.prototype.match`** runs on the **raw** header value.
- If there is a **first capturing group** in the match, **that** substring is passed on.
- If there are no groups, the **full match** is used.
- If the pattern is **invalid** or there is **no match**, the **original** header value is used for the next step (as if regex were skipped).

### Sample patterns

```regex
([a-f0-9-]+)
```

```regex
(\d+)
```

```regex
https?:\/\/([^\/]+)
```

---

## Transform

The **Transform** string is a pipeline of steps separated by **`|`**. Steps run **left to right**; each step receives the previous output.

Each step is a “function” call:

| Function | Purpose | Example |
| -------- | ------- | ------- |
| **`trim()`** | Trim leading and trailing whitespace | `"  abc  "` → `"abc"` |
| **`lowercase()`** | Lower case | `ABC` → `abc` |
| **`uppercase()`** | Upper case | `abc` → `ABC` |
| **`replace("a","b")`** | Replace every occurrence of substring **a** with **b** | `replace("-", "")` |
| **`substring(start,end)`** | Slice like **`String.prototype.slice(start, end)`** | `substring(0, 8)` |
| **`removeNonDigits()`** | Keep digits only | `+54 (11) 5555` → `54115555` |
| **`prefix("x")`** | Prefix | `prefix("id-")` |
| **`suffix("x")`** | Suffix | `suffix("-prod")` |

Arguments for **`replace`**, **`prefix`**, and **`suffix`** use **double** or **single** quotes. Inside a string, **`\\`** escapes the next character.

An unknown “function” name or bad argument count for **substring** / **replace** means **that step is skipped** (the value for the next step is unchanged by that step).

### Placeholder and hints

Typical chained example:

```text
replace("-", "") | lowercase()
```

Short examples: **`trim()`**, **`lowercase()`**, **`replace("-", "")`**.

---

## End-to-end examples

### Normalize a UUID

**Extract regex:**

```regex
([a-f0-9-]{36})
```

**Transform:**

```text
replace("-", "")
```

**Value substituted for `{value}`:** hex string without hyphens, e.g. `fbdb0effcaf44d4d86652a71f5556274`.

### Extract a numeric id

**Extract regex:**

```regex
(\d+)
```

**Transform:**

```text
trim()
```

### Lowercase the whole header

**Extract regex:**

```regex
(.+)
```

**Transform:**

```text
trim() | lowercase()
```

---

## Quick recap

- **Advanced mode** extends headers via **`webRequest`**; **Standalone** does not provide this mode.
- **Classic mode** is the original “page-visible” header model.
- **Pin** — separate for **Request** / **Response** lists.
- **Header links:** template with **`{value}`**, optional **Extract regex**, then **Transform** (chain with `|`).
