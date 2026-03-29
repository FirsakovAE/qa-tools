---
title: Export collections
---

# Export Collection

On the **Network** tab you can save the captured requests as a **Postman collection** file (API description format compatible with Postman and many other clients). Useful to replay flows, share with teammates, or import into another testing tool.

What enters the list and data visibility limits are covered in [Working with requests](/network/general).

---

## Where the command lives

**Export Collection** sits on the **Network** toolbar (near search and filters — on narrow layouts it may move but the action is the same).

The tooltip notes that the **currently filtered** set is exported.

The button is **disabled** while the filtered list is empty.

---

## What gets exported

The file includes **only rows visible** in the table with **Search** and active modes applied (path, method, status, keys/values in bodies, etc.). It is not necessarily the full history buffer: filters narrow the export.

For each included row the collection defines a request with:

* **method** and **URL** (address components and query when present);
* **request headers** stored by the inspector (pseudo headers starting with `:` are omitted; for **multipart** bodies the content-type line may be skipped on purpose to avoid clashing with Postman **form-data** mode);
* **request body** when captured: raw text (with JSON language hint where applicable) or **form-data** fields, including file-part markers (binary files are not embedded — names or placeholders only, as usual for export without real attachments).

**Server responses** are **not** embedded — export describes **outgoing** requests you can replay from a client.

Item names follow the short label shown in the Network list.

---

## File on disk

After **Export Collection** the browser offers a **JSON** download with a Postman-style name (spaces in the default title often become underscores).

Open it in **Postman** via collection import or in an editor to inspect structure.

---

## Caveats

* Only **headers and bodies the inspector could read** appear in the export (CORS, truncated bodies, opaque binary).
* Rows with **network errors** or partial data can still export if they remain in the filtered list — validate before reuse.
* **Replaying** from Postman may differ from the browser because of cookies, tokens, ambient headers, and environment — adjust after import if needed.

---

## See also

* [Working with requests](/network/general)
* [Traffic interception](/network/traffic)
