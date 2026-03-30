---
title: Export Collection
---

# Export Collection

On the **Network** tab, captured requests can be saved as a **Postman collection** file (an API description format compatible with Postman and many other clients). This is useful for replaying flows, sharing them with teammates, or importing them into a separate testing tool.

What appears in the list and possible data visibility limitations are described in [Working with requests](/network/general). In the inspector, **multipart** bodies are already shown as structured form fields; the export maps that shape into Postman-style **form-data** rather than a single opaque blob.

---

## Where to find the command

**Export Collection** is located on the **Network** toolbar (next to search and filters; on narrow layouts it may appear in a different header section, but the action remains the same).

The tooltip indicates that the **currently filtered** set of requests will be exported.

The button remains **disabled** while the filtered list is empty.

---

## What gets exported

The file contains **only rows currently visible** in the table with **Search** and active search modes applied (path, method, status code, keys and values inside bodies, and so on). This is not necessarily the full request history: active filters restrict what enters the collection.

For each included row, a separate request is created in the collection with:

* **method** and **URL** (including address components and query string when present);
* **request headers** stored by the inspector (pseudo-headers starting with `:` are omitted; for **multipart** bodies the content-type header may be intentionally skipped to avoid conflicts with Postman **form-data** mode);
* **request body** when captured: raw text (including JSON syntax hints where applicable) or **form-data** fields, including file-part markers (binary files themselves are not attached — only names or placeholders are exported, as is typical when no real files are available).

**Server responses** are **not included** — the export contains only the description of **outgoing** requests suitable for replay from a client.

Collection item names follow the short request label shown in the Network list.

---

## Saved file

After clicking **Export Collection**, the browser offers a **JSON** file download with a Postman-style filename (spaces in the default title are usually replaced with underscores).

The file can be imported into **Postman** or opened in any editor to inspect its structure.

---

## Caveats

* Only **headers and bodies the inspector was able to read** are included in the export (CORS limitations, truncated bodies, opaque binary content, and similar restrictions may affect output).
* Rows with **network errors** or partial data may still appear in the export if they remain visible after filtering — validate requests before reuse.
* **Replaying** requests from Postman may differ from browser behavior because of cookies, tokens, environment settings, and headers automatically added by the browser — manual adjustment after import may be required.

---

## See also

* [Working with requests](/network/general)
* [Traffic interception](/network/traffic)
