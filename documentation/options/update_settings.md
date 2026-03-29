---
title: Update settings
---

# Update settings

Below **Customize** in **Options → General** you will find **Search Parameters** and **Auto Refresh**. They persist with the rest of the profile (see [Settings management](/options/settings_management)).

---

## Search Parameters

Global rules for **text search** across tabs that share the same parameters (**Props**, **Network**, **Pinia** — field debounce/min length).

### Search Debounce (ms)

**Delay after typing stops** before the query applies. Avoids firing on every keystroke.

Typical allowed range **100–1000** ms (default near **300**). Lower = snappier but more churn; higher = calmer on heavy tables.

### Minimum Search Length

**Minimum characters** before filtering runs. Shorter input behaves like an empty query (usually full list).

Allowed **1–10** (often **2**). **1** reacts on first char; higher reduces noisy short prefixes.

These fields are **shared** — one place updates **Props**, **Network**, and **Pinia** consumers.

---

## Auto Refresh

**Enable auto refresh** polls **component tree** views and the **Pinia Stores** table on an interval (**Refresh Interval**: **1, 2, 5, 10, 30** seconds).

Ticks **do not stack** if a refresh is already running.

### Panel visibility

Polling runs **only while the inspector panel is visible** (embedded UI considered active). **Hiding** the panel **stops** timers; showing it again **resumes** if **Enable auto refresh** stays on.

Primarily affects **Props** and **Stores**.

### Props storm protection

On **Props**, besides the configured interval, very frequent tree snapshots from the page can trigger **throttling**: temporarily **pauses applying** bursts so the UI stays responsive. There is **no** user toggle — it is a protective layer.

**Network** is **not** on this auto-refresh schedule — it follows page network events.

Use Auto Refresh when the app mutates the tree or stores often and you want updates without hammering **Refresh** manually. Very short intervals on huge trees can cost CPU — try **10–30** s if needed.

---

## See also

* [Settings management](/options/settings_management)
* [Display modes](/options/display_mode)
