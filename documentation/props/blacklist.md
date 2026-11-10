---
title: Blacklist
---

# Component blacklist (Props)

The **Props** **blacklist** is a set of **Vue component names** excluded from the inspector tree and table. Filtering runs **before** props collection, so hidden components are skipped during traversal.

Props overview: [Overview](/props/general).

Do not confuse this with the **site blacklist** for overlay **auto run** (**General / Auto Run**): here only **component names** are filtered.

---

## Add and remove

* **Ignore by name** in the row menu adds the current component name to **Blocked**. An empty name is ignored. A name already in **Blocked** or **Allowed** is not added again.
* **Options → Props → Component Blacklist** — the list and its details card are below.

---

## Blocked and Allowed

Rules have two states:

* **Blocked** — a matching name is hidden.
* **Allowed** — an exception. A name that matches any **Allowed** rule stays in the list even when a **Blocked** rule also matches.

**Allowed** rules do nothing when there is no **Blocked** rule. Deleting a row removes the rule entirely.

### Component Blacklist in Options

The block sits after **Inspect Mode**. The add field placeholder is **Component name (supports wildcards: *Comp*)**. **Add** or **Enter** trims the text and appends it to **Blocked**. An empty value shows **Name cannot be empty**. The same stored string already in **Blocked** or **Allowed** shows **This name is already in the blacklist**. That check is case-sensitive, so `Foo` and `foo` are two rules; name matching itself ignores case.

| Column | What it shows |
| ------ | ------------- |
| **Component Name** | The stored pattern. |
| **Status** | **Blocked** or **Allowed**. **Allowed** rows are dimmed. |

**Blocked** rows come first, then **Allowed**, each in the order they were added. The row menu (right click or **⋮**) is **Allow** or **Block**, and **Delete**. The empty table says *No components in blacklist*.

A click opens **Blacklist Details**: **Component Name** and **Status** (**Blocked** or **Allowed**). There is no **Edit**. **Back** or **Escape** closes the card. With nothing selected the panel says *Select an item to see details*. If the rule was removed while the card is open, it says *Item no longer exists*. Below **1000** px the card covers the settings list until you go back.

The card does not select that component on the Props tab.

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

Any **Allowed** match wins: the name stays visible. Otherwise any **Blocked** match hides it.

A broad **Blocked** pattern plus a narrower **Allowed** pattern keeps the exception visible. Toggling the broad rule to **Allowed** turns that pattern into an exception for every name it matches.

---

## When it applies

Rules run on every tree rebuild:

* manual **Refresh**;
* automatic refresh;
* reopening the tab.

When the Props table already has rows, an **Options** edit refreshes it. An empty list picks up the rules on the next rebuild.

While a **Blocked** rule hides a name, that component is not selectable in the table or card.

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
