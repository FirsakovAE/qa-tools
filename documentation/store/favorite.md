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
* **Options → Pinia → Favorite Stores** — browse, type names, delete, open for editing.

Settings persist in the inspector profile with other options.

---

## Exact names and wildcards

Each entry defines a **store name pattern**.

* Without **`*`**, matching is **exact**: the star appears only for that store name.
* **`*`** matches any substring in the name. Example: **`use*Store`** can match **useUserStore**, **useAuthStore**, etc.

Removing favorite from a row clears **all** rules that match that store (exact and wildcard).

Manual entry in **Options** uses the same wildcard rules.

---

## What is stored

Per entry the inspector keeps:

* **display name** of the store;
* **match pattern** (when using a mask);
* optional **session id** for the matched instance;
* **time added** for display.

That lets favorites apply again after the store list rebuilds.

---

## Matching

When stores load, names are compared to saved patterns:

1. **exact** name match;
2. **wildcard** match if the entry contains **`*`**;
3. session hints may refine the mapping when available.

If multiple stores match one mask, all matching rows can show stars.

---

## Sorting and badge

After refresh, **Stores** floats favorite rows **up**.

The header badge shows **visible favorites / total saved** for the current search.

Clicking the badge can open **Options** for Pinia favorites.

---

## Editing in Options

Open an entry to change its pattern name.

Saving updates the rule; new masks take effect on the next match.

Avoid empty names — they never usefully match.

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
