---
title: Update settings
---

# Update settings

Below **Customize** in **Options → General** you will find **Search Parameters** and **Auto Refresh**. They persist with the rest of the profile (see [Settings management](/options/settings_management)).

---

## Search Parameters

Global rules for **text search** on **Props**, **Network**, **Pinia Stores**, and **Logs**. Defaults are **300** ms and **2** characters.

### Search Debounce (ms)

**Delay after typing stops** before the query applies. The field is marked **100–1000**. The default is **300**.

### Minimum Search Length

**Minimum characters** before a new filter runs. The field is marked **1–10**. The default is **2**.

A shorter non-empty query does not start a new search. The previous result stays until the field is cleared or the query reaches the minimum. An empty field shows the full list. **Network** and **Logs** count the text inside double quotes. **Props** and **Pinia Stores** count the whole field, including the quote characters.

---

## Auto Refresh

**Enable auto refresh** is off by default. **Refresh Interval** appears only while it is on. The default interval is **5 seconds**. The choices are **1 second**, **2 seconds**, **5 seconds**, **10 seconds**, and **30 seconds**.

**Pinia Stores** reloads the store list on that interval while that tab is open and the panel is visible. A tick is skipped while a load is already running. Hiding the panel stops the timer; showing it starts the timer again if the checkbox is still on.

**Props** reloads the component tree on that interval while the panel is visible, and stops while it is hidden. If **10** tree updates arrive within **5 seconds**, further updates are dropped for **10 seconds**. The console says `Props update flood detected, entering cooldown`. There is no switch for that. Changing the checkbox or the interval also starts a second **Props** timer that keeps running until you leave the **Props** tab, including while the panel is hidden.

**Network** is not on this timer.

---

## See also

* [Settings management](/options/settings_management)
* [Display modes](/options/display_mode)
