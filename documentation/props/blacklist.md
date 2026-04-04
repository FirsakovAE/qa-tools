---
title: Blacklist
---

# Component blacklist (Props)

The **Props** **blacklist** is a set of **Vue component names** excluded from the inspector tree and table. Filtering runs **before** props collection, so hidden components are skipped during traversal.

Props overview: [Overview](/props/general).

Do not confuse this with the **site blacklist** for overlay **auto run** (**General / Auto Run**): here only **component names** are filtered.

---

## Add and remove

* **Row context menu** on **Props** — adds the current component name to the active block list.
* **Options → Props → Component Blacklist** — view rules, add lines, toggle state, delete.

Duplicate names are usually not created.

---

## Active vs inactive

Rules have two states:

* **Blocked** — applied; matching components are hidden.
* **Off** — stored but not filtering.

Toggle without retyping. Deleting a row removes the rule entirely.

With no active rules, blacklist filtering is effectively off.

---

## Name matching

Comparison uses the **displayed component name**.

* Without **`*`** or **`%`** — **case-insensitive exact** match.
* **`*`** and **`%`** act as wildcards for name fragments.

Examples:

* `MyButton` — only **MyButton**;
* `Base*` — names starting with **Base**;
* `*Modal*` — names containing **Modal**.

Nameless components may show as **Anonymous** when that is what the tree uses.

---

## Intersections

If several rules match, each rule’s **active** state applies.

Inactive rules do not act as exceptions — they are simply ignored until re-enabled.

Prefer toggling a broad pattern off temporarily instead of stacking near-duplicates.

---

## When it applies

Rules run on every tree rebuild:

* manual **Refresh**;
* automatic refresh;
* reopening the tab.

After **Options** edits the tree usually refreshes so the table reflects changes immediately.

While a rule is active, hidden components are not selectable in the table or card.

---

## Tips

* Start from **exact names** via the row context menu.
* **Wide patterns** help repeated noise components but need care.
* **Blacklist affects inspector display only** — it does not change your Vue app.

---

## See also

* [Props overview](/props/general)
* [Inspect](/props/inspect)
* [Customize](/options/customize)
