---
title: Options → AI
---

# Options → AI

**Options → AI** is the section labeled **AI**. The gear on the [AI assistant](/ai/general) tab opens **Connection**. **Review access** on that tab opens **Agent access**.

The blocks follow this order: **Connection**, **Models**, **Personalization**, **Agent access**, **Data masking for AI**.

These choices are stored in this browser, apart from the inspector settings. **Options → Settings management** does not export, import, or reset them. The screen says: *Keys stay in this browser and are not included in settings export.*

## Connection

**OpenRouter** is listed first, then **Gemini**. Each line says **your own API key**.

A saved key is shown as eight dots and its last four characters, with **Remove**. **Remove** clears that key and leaves the provider selected on the AI tab as it is.

An empty key shows a password field, **OpenRouter API key** or **Gemini API key**, and **Save**. **Save** is disabled while the field is empty or only spaces. The saved value is trimmed. Saving also selects that provider on the AI tab.

Under OpenRouter: **Get a free key in** [OpenRouter](https://openrouter.ai/settings/keys). Under Gemini: **Get a free key in** [Google AI Studio](https://aistudio.google.com/apikey).

Until a key is saved, the AI tab uses **Gemini**.

## Models

The provider menu here only chooses whose list to edit. It starts as the provider selected on the AI tab. Changing it does not change that selection.

**Reload the model list** is disabled while the list is loading. When the list is loaded, the right side shows **N of M available**: **M** is the recommended models plus the ones you added, **N** is how many of them are still checked.

The field **Add or search model** is disabled until that provider has a key. Without a key the line is **Connect OpenRouter above to see its models.** or **Connect Gemini above to see its models.** While the list loads: **Loading models...** A failure shows the error text.

The dropdown opens on focus. **Escape** or a click outside closes it.

* An empty field lists free models. The hint is **Free models. Type to search paid ones too.**
* Any text matches the model name or id, ignoring case, across free and paid models. The hint is **All models of the provider, free and paid.** Free models come first, then the name.
* At most **60** rows are shown. The rest is **N more, refine the search**.
* Nothing matched: **No models found**.

A row shows the name, the id, and **free** or **paid**. **recommended** models are already in the list; their checkbox is disabled. Checking another model adds it. The AI tab shows added models under **Added**.

The list under the field is those recommended and added models.

* A checked row is available. Unchecking hides it from the AI tab and from **Auto**. The name is struck through. The status under the name can be **quota used up, resets in …**, **not available for this key**, or **busy, retry in …**. The title is the provider message. **N today** is how many requests that model had today. Badges: **recommended**, **unstable**, **paid**.
* The last checked model cannot be unchecked.
* **Remove from the list** is on models that are not recommended. It is disabled for the last checked model. Recommended models stay in the list; unchecking is how they are hidden.

## Personalization

**Defaults** is disabled while the block is already at the defaults: tone **Default**, detail **Normal**, routing **Lite**, and an empty style field.

**Base style and tone**

| Value | Hint |
| ----- | ---- |
| **Default** | Balanced answers |
| **Professional** | Precise, neutral wording |
| **Friendly** | Supportive, plain words |
| **Direct** | Conclusion first, no filler |
| **Mentor** | Explains the concepts behind the cause |

**Answer detail**

| Value | Hint |
| ----- | ---- |
| **Brief** | Cause, key evidence and the fix in a few lines |
| **Normal** | What went wrong, the cause, the evidence and the fix |
| **Detailed** | The whole chain of events, ruled-out causes, steps to reproduce |

**Instruction routing**

| Value | Hint |
| ----- | ---- |
| **Full** | All task instructions in every request. For strong models |
| **Lite** | Core rules only; the model loads the instructions of the task when needed |

**Your style instructions** holds up to **2000** characters. The placeholder is **For example: answer in Russian, end with a short checklist for the bug report**. The counter is **N / 2000**. The text is saved about **400 ms** after the last change. **Defaults** during that wait can be overwritten by the pending save, so the cleared text comes back.

## Agent access

The description is **What the assistant may read and send to the provider.** **Defaults** restores the values below and is disabled while they are already set.

**Attach the logs digest to questions** — hint **A short summary of errors and the timeline.** **Allowed** by default. **Off** sends the question without that summary. The first step of the answer then says **no logs digest (turned off)**.

**Tools.** Each group is **Allowed**, **Ask each time**, or **Off**. The default is **Ask each time**. **Ask each time** uses the confirmation on the [AI assistant](/ai/general) tab. **Allowed** runs the tool without asking. **Off** does not give that group to the assistant. Reading this documentation stays available.

| Group | Hint |
| ----- | ---- |
| **Logs** | Event details and search over the captured logs |
| **Page code** | List, read and search the scripts of the page and their source maps |
| **Live page** | Find elements on the page, why they are disabled or hidden, their components, handler code and the current store state |

**Data in the logs.** Each line is **Allowed** or **Off**. All three are **Allowed** by default. **Off** replaces the hidden part with `[hidden by AI access settings]`. Store, props, emit and action values that are off become a type in brackets, such as `[string]`, while names and paths stay.

| Line | Hint |
| ---- | ---- |
| **Request and response headers** | Sensitive headers stay masked |
| **Request / response bodies and WebSocket messages** | |
| **Values of store state, props, emits and actions** | Off: only names, paths and types |

## Data masking for AI

This list is applied when data is sent to the provider. It does not change the **Logs** tab or an HTML report. The Logs mask still runs first. See [Data masking](/logs/settings#data-masking) for how a fragment matches a key and for `[MASKED]`, `[MASKED JWT]`, `Bearer [MASKED]` and `[MASKED CARD]`.

The text under the title: **Values with matching names in objects, headers, URLs, and code are sent as [MASKED].**

**Mask sensitive data** is the value-pattern checkbox. It is on by default. While it is off, only the key list is applied.

The column is **Key contains**. The empty table says **No keys — only value patterns are masked**. The placeholder is **Key fragment, e.g. x-client-secret**. **Add** or **Enter** trims the fragment. An empty value shows **Key cannot be empty**. The same fragment, ignoring case, shows **This key is already in the list**. The row menu is **Delete**. Clicking a row does nothing.

The default fragments are the [Logs list](/logs/settings#data-masking) plus `passcode`, `auth`, `bearer`, `jwt`, `credential`, `session`, `csrf`, `xsrf`, `signature`, `accesskey`, `passphrase`.

`passcode` is put back if the saved list does not already contain it. **Delete** on that row does not keep it removed.

**Defaults** restores the key list and turns **Mask sensitive data** on. The button stays enabled when the list is already the default.
