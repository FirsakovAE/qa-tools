---
title: Favorites
---

# Favorites (Props)

**Favorites** under **Props** are persisted **components** you can return to across sessions. Starred rows float **to the top**, show a **star** beside the name, and a header badge counts favorites visible on the current screen.

Props overview: [Overview](/props/general).

**Pinia favorites** are separate (**Stores** tab and **Options → Pinia Store**); this page covers **Vue components** only.

---

## Add and remove

* **In the component card** — header **star** toggles favorite for that component.
* **Row context menu** on **Props** — add/remove favorite.
* **Props table** — click the **star** area on a row to toggle even if the icon is not always visible.
* **Options → Props → Favorite Components** — the list and its details card are below. There is no **Add**; entries come from the Props tab.

After changes the Props table **re-sorts** so favorites rise (unless search filters conflict).

### Favorite Components in Options

The block is last on **Options → Props**. There is no **Add**. Rows stay in the saved order.

| Column | What it shows |
| ------ | ------------- |
| **Component** | The name, and under it the tag plus `.` and the stored class string. Spaces in the class string stay spaces. |
| **Added** | The locale date only. |

The row menu is only **Delete**. **Delete** removes every saved entry with that id. The empty table says *No favorite components*.

A click opens **Favorite Details**: **Component Name**, **Element** (tag plus `.` and the class string), and **Added** as the locale date and time. There is no **Edit**. **Back** or **Escape** closes the card. With nothing selected the panel says *Select an item to see details*. If the entry was removed while the card is open, it says *Item no longer exists*. Below **1000** px the card covers the settings list until you go back.

The card does not select that component on the Props tab.

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

The badge is always shown. It reads `0` when nothing is saved, otherwise visible favorites / saved total. It is yellow when at least one visible row is a favorite.

Clicking the badge opens **Options → Props → Favorite Components**.

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
