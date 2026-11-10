---
title: Logs settings
---

# Logs settings

**Options → Logs** collects the settings of the [Logs](./general.md) tab. The blocks follow in this order: **Search Settings**, **Logs and limits**, **Ignore list**, **Data masking**, **Export**. Changes apply immediately.

---

## Search Settings

| Checkbox | Default |
| -------- | ------- |
| **Search by event name (title, component, store, URL)** | on |
| **Search by key (payload keys and changed paths)** | off |
| **Search by value (payload values)** | off |

How a query matches is in [Working with logs](./general.md#search). If key and value are both off, name search stays on.

---

## Logs and limits

### Logged events

Each group has a checkbox: an unchecked group is not logged at all, and already logged events stay. All groups are on by default.

| Group | Events |
| ----- | ------ |
| **Requests** | **Send request** and **Receive response** |
| **WebSocket** | **WebSocket open**, **WebSocket sent**, **WebSocket received** and **WebSocket closed** |
| **Props changes** | **Change props** |
| **Emits** | **Emit** |
| **Pinia changes** | **Change store** (when checked again, the store starts with a new **Store snapshot**) |
| **Store actions** | **Store action** |
| **Navigation** | **Navigation** |
| **Clicks** | **Click** |
| **JS errors** | **JS error** |

The number beside each checkbox is how many events of that group are stored now. Its tooltip is **Currently stored**. **Requests** does not count **Receive response**, and the unit is **requests**. The other groups use **events**.

### Data size

| Setting | Default | Range | Meaning |
| ------- | ------- | ----- | ------- |
| **Memory budget** | 20 MB | 8 – 1024 MB | Total size of all buffered events (approximate serialized size). A network entry shared by a request and its response, and equal bodies, are counted once. A binary response counts as its format and size, not the file |
| **Limit event size** | on | — | On by default. Off: events are kept whole. The **Max event size** field is shown only while this is on |
| **Max event size** | 512 KB | 16 – 16 384 KB | Larger parts of an event (store snapshots, arguments, results) are dropped, network bodies are cut to this size |

When the memory budget is reached, the log is cut at a **Navigation** and every event before it is removed. **Pinia** changes up to that cut are rebuilt into a **Store checkpoint**, so the remaining changes keep their **Before** / **After**; the previous base and the diffs it was built from are removed (see [How events are stored](./general.md#how-events-are-stored)). The last navigation is rewritten as a page snapshot, and if the log is still over the budget the oldest remaining events are removed. The newest event is always kept, even if it alone exceeds the budget. **Send request** and **Receive response** are also capped at **Maximum HTTP requests**, the same ring as HTTP rows on the Network tab (**Options → Network**, default **500**): the request and its response leave together. WebSocket log events are capped at **Maximum WebSocket events** (default **500**): open, sent, received and closed each count as one.

The line under the bar is **Used {size} of {size} (approximate serialized size).** The bar turns orange at 90 % and above.

A number outside the range is rounded and clamped to the nearest bound. A value that is not a number resets to the default. An empty field is treated as 0 and therefore becomes the minimum (8 MB or 16 KB). The new value is applied when the field is committed.

**Defaults** on this block restores the group checkboxes, the budget, **Limit event size** and **Max event size**. It does not reset search, the ignore list, masking or **Compress report**.

---

## Ignore list

Event groups excluded from logging. A group is one subject: the same request (method and path), the same component, the same store, and so on. Ignored groups are not recorded at all.

Under the title: **These event groups are not recorded. Log again resumes one group.**

| Column | Meaning |
| ------ | ------- |
| **Type** | The event label (**Send request**, **Change store**, **JS error**, and the rest) |
| **Object** | The stored group key: URL, component, store, message, and so on |

The row menu is only **Log again**. **Log all again**, next to the title, clears the list and is disabled when it is empty. The empty table says *No ignored objects*. Clicking a row does nothing. There is no details card.

The **ignored** indicator on the [Logs](./general.md) toolbar opens this table. It is hidden when the list is empty.

---

## Data masking {#data-masking}

Values are masked **when an event is captured**, so they never reach the **Logs** view or exports.

Under the title: **Values are masked when an event is captured, so they never reach the Logs view or exports.**

Both checkboxes are labeled **Mask sensitive data**.

* The first turns masking on. It is on by default. While it is off, the key list is dimmed and captured values are stored as they are.
* The second is directly under it and is disabled while the first is off. It is on by default. It masks **JWT** (`[MASKED JWT]`), **Bearer** / **Basic** / **Token** credentials (`Bearer [MASKED]`) and card numbers (`[MASKED CARD]`) inside any text of 8 characters or more. There is no separate label for that behavior.

The key list header is **Key contains**. The empty table says *No keys — only value patterns are masked*. The add field placeholder is **Key fragment, e.g. accessCode**. **Add** or **Enter** trims the fragment. An empty value shows **Key cannot be empty**. The same fragment, ignoring case, shows **This key is already in the list**. The row menu is **Delete**. Clicking a row does nothing.

Default keys: `password`, `passwd`, `pwd`, `secret`, `token`, `authorization`, `cookie`, `apikey`, `sessionid`, `privatekey`, `creditcard`, `cardnumber`, `cvv`, `cvc`, `ssn`, `otp`.

Keys match case-insensitively and ignore separators (`api_key`, `api-key` and `apiKey` are the same). Fragments of **4 letters or fewer** must match a whole word, so `pwd` or `otp` do not mask unrelated keys.

**Defaults**, next to the title, restores both checkboxes and the key list.

Masked values of sensitive keys are replaced with `[MASKED]`. Card numbers are checked with the Luhn algorithm.

---

## Export {#export}

**Compress report** is on by default. While the browser can compress, the helper says **The HTML report is several times smaller. Needs Chrome / Edge 80+, Firefox 113+ or Safari 16.4+.** The file then stores the event JSON as gzip in base64. In a browser that cannot compress, the checkbox is disabled and the helper says **Not supported in this browser. Needs Chrome / Edge 80+, Firefox 113+ or Safari 16.4+.** What the file contains is in [Export](./export.md).

---

## See also

* [Working with logs](./general.md)
* [Export](./export.md)
* [Settings management](/options/settings_management)
