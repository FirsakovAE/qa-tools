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

## Ignore list

Event groups added with **Ignore** in the **Logs** tab. Events of these groups are not recorded.

| Column | Content |
| ------ | ------- |
| **Type** | Event type |
| **Event** | Group key: request (method and path), component, store, etc. |
| **Added** | Date the rule was added |

* **Log again** in the row menu removes one rule.
* **Log all again** removes all rules.

The same list is available from the **ignored** indicator in the **Logs** toolbar.

---

## Export

Format of **Export Logs** and of single-event exports:

* **JSON** — raw events for re-import or tools;
* **HTML** (default) — static report that opens in any browser and can be re-imported.

Details: [Export and import](./export.md).

---

## Logs limits

Each event type is a **ring buffer**: when it is full, the oldest events are overwritten. The memory budget applies to all types together.

### Events per type

| Type | Default | Unit |
| ---- | ------- | ---- |
| **Network** | 500 | requests |
| **Props changes** | 1 000 | events |
| **Emits** | 1 000 | events |
| **Pinia changes** | 1 000 | events |
| **Store actions** | 1 000 | events |
| **Navigation** | 200 | events |
| **JS errors** | 200 | events |

Allowed range: **10 – 20 000**. The number before the field shows how many events of the type are currently stored. For **Network** the limit applies separately to **Send request** and **Receive response** events.

### Data size

| Setting | Default | Range | Meaning |
| ------- | ------- | ----- | ------- |
| **Memory budget** | 64 MB | 8 – 1024 MB | Total size of all buffered events (approximate serialized size) |
| **Max event size** | 512 KB | 16 – 16 384 KB | Larger parts of an event (store snapshots, arguments, results) are dropped, network bodies are cut to this size |

The bar under the fields shows current usage (**Used X of Y**); it turns orange above 90 %.

Values outside the range are corrected to the nearest bound. **Defaults** restores all limits.

---

## Data masking {#data-masking}

Values are masked **when an event is captured**, so they never reach the **Logs** view, exports or imports.

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
* [Export and import](./export.md)
* [Settings management](/options/settings_management)
