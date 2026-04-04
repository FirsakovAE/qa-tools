---
title: Favorites
---

# Favorites (Props)

**Favorites** under **Props** are persisted **components** you can return to across sessions. Starred rows float **to the top**, show a **star** beside the name, and a header badge counts favorites visible on the current screen.

Props overview: [Overview](/props/general).

**Pinia favorites** are separate (**Stores** tab and **Options → Pinia**); this page covers **Vue components** only.

---

## Add and remove

* **In the component card** — header **star** toggles favorite for that component.
* **Row context menu** on **Props** — add/remove favorite.
* **Props table** — click the **star** area on a row to toggle even if the icon is not always visible.
* **Options → Props → Favorites** — browse saved entries, delete, or jump to a component for details.

After changes the table **re-sorts** so favorites rise (unless search filters conflict).

---

## What is stored

Each entry keeps, among other fields:

* **component name**;
* **identity** for matching in the tree (including root DOM signature: tag and classes);
* optional **nodeId** for the current session;
* **time added** (shown in Options).

That lets favorites survive **reloads**: on rebuild the inspector matches saved signatures.

---

## Matching

Matching uses **stable identifiers** when refreshing the tree.

* If a numeric **session uid** is stored, it only matches **within the current tree lifecycle** (full rebuild changes uids).
* Entries with **name + root element signature** match on **stable cues**, not internal tree path.

Legacy entries with only **session uid** may also use **metadata** (name, tag, class) to reconnect after reload.

If several candidates look alike, the wrong instance may star — remove and re-add from the correct row.

---

## Header badge

A **found / total** style badge shows how many favorite components are visible under current filters vs how many favorites are saved.

Clicking the badge can jump to **Options** favorites.

---

## Tips

* Use favorites for **anchor components**: headers, widgets you check often, problem areas.
* After **DOM structure changes**, verify stars still point to the right instance.
* Favorites **do not** affect runtime behavior and are unrelated to the component **blacklist**.

---

## See also

* [Props overview](/props/general)
* [Blacklist](/props/blacklist)
* [Customize](/options/customize)
* [Store overview](/store/general) — separate Pinia favorites
