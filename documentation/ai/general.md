---
title: AI assistant
---

# AI assistant

The **AI assistant** tab sits after **Logs**. The header on the tab says **AI**. The assistant answers questions about the captured logs and the page. Attaching a request, a component, a store or a log event is described on those tabs.

Connection, what the assistant may read, masking, style and the model list are in [Options → AI](/ai/settings). This page is the chat itself.

## Before the first question

With no API key the tab says **Connect an AI provider** and offers **Connect in Options → AI**. The text names a free key of Gemini or OpenRouter.

With a key but no confirmation, the tab says **Data sent to OpenRouter** or **Data sent to Gemini**:

* questions, a digest of the captured logs, the event data and the page code the assistant asks for;
* tokens, passwords, API keys and other values from the AI masking list are replaced with `[MASKED]` before sending; what the assistant may read is set in **Options → AI → Agent access**;
* free models may store prompts and use them for training.

**I understand** confirms. **Review access** opens **Options → AI → Agent access**. Until then the input stays disabled and reads **Connect a provider to ask questions**.

After confirmation, an empty chat offers four example questions. Clicking one sends it.

## Toolbar

| Control | Behavior |
| ------- | -------- |
| Provider | **OpenRouter** or **Gemini** |
| Model | Shown when a key is set and the model list has loaded. **Auto** is first: *free models, switches on limits*. Then **Recommended** and **Added**. A model note can say **paid**, a status, **unstable**, and how many requests it had today |
| **Checking models...** | Shown while the list loads |
| **Models failed to load, retry** | Shown when the list fails. The title is the error text |
| Refresh | Tooltip **Check which models are available** |
| Settings | Tooltip **AI settings: connection, access, masking, style, models**. Opens **Options → AI** |
| **New chat** | Tooltip **New chat**. Disabled when the chat is empty and the assistant is idle. Clears the conversation. The conversation stays while the inspector is open, including after switching tabs. Reloading the page starts an empty chat |

The model list is hidden until a key exists and models have loaded.

## Questions

The placeholder is **Ask AI**. With chips attached it is **Ask about the attached data**.

**Enter** sends. **Shift+Enter** inserts a line. The send button tooltip is **Send (Enter; Shift+Enter for a new line)**. Send needs text or at least one chip. Sending only chips asks the assistant to explain the attached data and point out anything wrong in it. The chip stays on the question; **×** removes it before sending.

While an answer is running the button is **Stop**.

Under the field, when the chat is ready:

* OpenRouter: **Today: N of M free OpenRouter requests (counted in this browser). Each assistant step is one request.** **M** is the limit the provider reported, or **50** when it has not. In **Auto**, a second sentence says how many models are skipped because they are out of quota or unavailable.
* Gemini: **Today: N Gemini requests. Daily limits depend on the model and your Google AI Studio project.** The same **Auto** sentence can follow.

**Auto** can be selected only when the list has a model that is not marked paid. A hand-picked model must be selected for the field to accept a question.

## Answers

The question is on the right. The answer is on the left, with the model name and the request count for that answer.

**Copy** on a message copies its text. The tooltip becomes **Copied**, or a toast says **Could not copy to the clipboard**. A code block in the answer has its own copy control.

A `#N` link in the answer opens that event on **Logs**. If it is gone, a toast says **The event is no longer in the logs**.

**Try again** on the last answer sends the same question once more. It is disabled while an answer is running or the chat is not ready.

If the chosen model fails in a way that is specific to that model, the answer offers **Switch to Auto and try again**. That selects **Auto** and sends the question again.

While a run waits for permission, the chat asks **Allow the assistant to read logs?**, **… page code?** or **… the live page?**. The choices are **Allow**, **Allow in this chat** and **Deny**. **Allow in this chat** lasts until **New chat**.

A failed answer shows the error in the card. **Provider message** expands the text returned by the provider.

## See also

* [Options → AI](/ai/settings)
* [Working with logs](/logs/general)
* [Working with requests](/network/general)
* [Components and props](/props/general)
* [Pinia stores](/store/general)
