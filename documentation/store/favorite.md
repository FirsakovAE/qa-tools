---
title: Favorites
---

# Favorites (Pinia stores)

**Favorite stores** are a persisted list of **Pinia stores** for faster navigation on **Stores**: starred rows move **to the top**, show a **star**, and a header badge counts how many favorites match the current results.

Store overview: [Overview](/store/general).

**Vue component** favorites (**Props** tab) are separate: [Favorites (Props)](/props/favorite).

---

## Add and remove

* **In the store card** — header **star** toggles favorite.
* **Row context menu** on **Stores** — add/remove favorite.
* **Stores table** — click the **star** area on a row.
* **Options → Pinia Store → Favorite Stores** — the list and its details card are below.

Settings persist in the inspector profile with other options.

---

## Exact names and wildcards

Each entry defines a **store name pattern**.

* Without **`*`**, matching is **exact** and case-sensitive: the star appears only for that store name.
* **`*`** is any sequence, and the pattern must match the whole name. Example: **`use*Store`** matches **useUserStore** and **useAuthStore**. Case is significant.

Removing favorite from a row clears **all** rules that match that store (exact and wildcard).

Manual entry in **Options** uses the same wildcard rules.

---

## What is stored

Per entry the inspector keeps:

* **id** and **name**, both set to the displayed store name when you star a row (a mask typed in Options is stored in these strings);
* **storeId** of the instance at the moment it was starred. The star does not use this field;
* **time added**.

That lets favorites apply again after the store list rebuilds.

---

## Matching

The displayed name (`baseId`) is compared with each entry’s **id** and **name**. An exact equality or a `*` pattern on either field stars the row. Comparison is case-sensitive. The stored **storeId** is not part of the match.

If several stores match one mask, every matching row shows a star.

---

## Sorting and badge

The table keeps favorite rows on top.

The badge is always shown. It reads `0` when nothing is saved, otherwise visible favorites / saved total. It is yellow when at least one visible row is a favorite.

Clicking the badge opens **Options → Pinia Store → Favorite Stores**.

---

## Favorite Stores in Options

The block is second on **Options → Pinia Store**. The add field placeholder is **Store name (supports wildcards: *Store*)**. **Add** or **Enter** trims the text and appends a row whose **id** and **name** are that string. There is no **storeId**. An empty value shows **Name cannot be empty**. The same **id** or **name** already in the list shows **This store is already in favorites**. That check is the exact string, so `Foo` and `foo` are two rows, and a mask is not treated as a duplicate of a name it would match.

Rows stay in the saved order.

| Column | What it shows |
| ------ | ------------- |
| **Store Name** | The stored name. |
| **Added** | The locale date only. |

The row menu (right click or **⋮**) is **Edit** and **Delete**. **Delete** removes every entry with that **id**. It does not clear other patterns that merely match the same store. The empty table says *No favorite stores*.

A click opens **Favorite Store Details**: **Store Name** and **Added** as the locale date and time. **Edit** in the row menu opens that card already in edit mode. The header **Edit** icon does the same on an open card. The field placeholder is **Store name**. **Enter** or **Save** writes the trimmed text into both **id** and **name** and keeps **storeId** if the row had one. **Save** is disabled while the field is blank, and it does not check for another row with the same name. **Cancel** leaves edit mode and stays on the card. **Back** or **Escape** closes the card, including during edit.

With nothing selected the panel says *Select an item to see details*. If the entry was removed while the card is open, it says *Item no longer exists*. Below **1000** px the card covers the settings list until you go back.

The card does not select that store on the Stores tab.

---

## Tips

* Favorite **core** stores: user, settings, UI shell.
* **Patterns** help uniform naming schemes; overly broad masks may over-select.
* Favorites **do not** change Pinia runtime; they are local inspector metadata.

---

## See also

* [Store overview](/store/general)
* [Favorites (Props)](/props/favorite)
* [Customize](/options/customize)
