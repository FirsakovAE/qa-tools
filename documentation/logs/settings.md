---
title: Logs settings
---

# Logs settings

**Options → Logs** collects the settings of the [Logs](./general.md) tab. Changes apply immediately.

---

## Search Settings

Default search modes of the **Logs** tab:

| Option | Searches in |
| ------ | ----------- |
| **Search by event name** | Title, component, store, URL (enabled by default) |
| **Search by key** | Keys in the payload and changed paths |
| **Search by value** | Values in the payload |

---

## Logs and limits

### Logged events

Each group has a checkbox: an unchecked group is not logged at all, and already logged events stay. All groups are on by default.

| Group | Events |
| ----- | ------ |
| **Network** | **Send request** and **Receive response** |
| **Props changes** | **Change props** |
| **Emits** | **Emit** |
| **Pinia changes** | **Change store** (when checked again, the store starts with a new **Store snapshot**) |
| **Store actions** | **Store action** |
| **Navigation** | **Navigation** |
| **JS errors** | **JS error** |

The number next to a checkbox shows how many events of the group are currently stored.

### Data size

| Setting | Default | Range | Meaning |
| ------- | ------- | ----- | ------- |
| **Memory budget** | 20 MB | 8 – 1024 MB | Total size of all buffered events (approximate serialized size). A network entry shared by a request and its response, and equal bodies, are counted once. A binary response counts as its format and size, not the file |
| **Limit event size** | off | — | Off: events are kept whole and nothing is cut, so an exported report keeps complete data |
| **Max event size** | 512 KB | 16 – 16 384 KB | Only with **Limit event size**: larger parts of an event (store snapshots, arguments, results) are dropped, network bodies are cut to this size |

When the memory budget is reached, the log is cut at a **Navigation** and every event before it is removed. **Pinia** changes up to that cut are rebuilt into a **Store checkpoint**, so the remaining changes keep their **Before** / **After**; the previous base and the diffs it was built from are removed (see [How events are stored](./general.md#how-events-are-stored)). The last navigation is rewritten as a page snapshot, and if the log is still over the budget the oldest remaining events are removed. The newest event is always kept, even if it alone exceeds the budget. **Send request** and **Receive response** are also capped at **Maximum HTTP requests**, the same ring as HTTP rows on the Network tab (**Options → Network**, default **500**): the request and its response leave together. WebSocket log events are capped at **Maximum WebSocket events** (default **500**): open, sent, received and closed each count as one.

The bar under the fields shows current usage (**Used X of Y**); it turns orange above 90 %.

Values outside the range are corrected to the nearest bound. **Defaults** restores all settings of the block.

---

## Data masking {#data-masking}

Values are masked **when an event is captured**, so they never reach the **Logs** view or exports.

| Option | Meaning |
| ------ | ------- |
| **Mask sensitive data** | Enables masking (on by default) |
| **Mask token-like values in any text** | Masks **JWT**, **Bearer** / **Basic** credentials and card numbers inside any string |
| **Key contains** list | Object keys, header and parameter names containing these fragments are masked |

Default keys: `password`, `passwd`, `pwd`, `secret`, `token`, `authorization`, `cookie`, `apikey`, `sessionid`, `privatekey`, `creditcard`, `cardnumber`, `cvv`, `cvc`, `ssn`, `otp`.

Keys match case-insensitively and ignore separators (`api_key`, `api-key` and `apiKey` are the same). Fragments of **4 letters or fewer** must match a whole word, so `pwd` or `otp` do not mask unrelated keys.

Add your own fragments in the input under the list; remove them from the row menu. **Default keys** restores the default list.

Masked values are replaced with markers: `[MASKED]` for values of sensitive keys, `[MASKED JWT]` and `[MASKED CARD]` for tokens and card numbers found in text (card numbers are checked with the Luhn algorithm).

---

## See also

* [Working with logs](./general.md)
* [Export](./export.md)
* [Settings management](/options/settings_management)
