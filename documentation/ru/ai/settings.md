---
title: Options → AI
---

# Options → AI

**Options → AI** — это раздел с подписью **AI**. Шестерёнка на вкладке [AI-ассистент](/ru/ai/general) открывает **Connection**. **Review access** на той вкладке открывает **Agent access**.

Блоки идут в таком порядке: **Connection**, **Models**, **Personalization**, **Agent access**, **Data masking for AI**.

Эти настройки хранятся в этом браузере отдельно от настроек инспектора. **Options → Settings management** их не экспортирует, не импортирует и не сбрасывает. На экране написано: *Keys stay in this browser and are not included in settings export.*

## Connection

Сначала **OpenRouter**, затем **Gemini**. У каждой строки подпись **your own API key**.

Сохранённый ключ показан как восемь точек и последние четыре символа, рядом **Remove**. **Remove** стирает этот ключ и не меняет провайдера, выбранного на вкладке AI.

Пустой ключ — поле пароля **OpenRouter API key** или **Gemini API key** и кнопка **Save**. **Save** недоступна, пока поле пустое или в нём одни пробелы. Сохраняется текст без пробелов по краям. Сохранение также выбирает этого провайдера на вкладке AI.

Под OpenRouter: **Get a free key in** [OpenRouter](https://openrouter.ai/settings/keys). Под Gemini: **Get a free key in** [Google AI Studio](https://aistudio.google.com/apikey).

Пока ни один ключ не сохранён, вкладка AI использует **Gemini**.

## Models

Меню провайдера здесь только выбирает, чей список редактировать. Сначала это провайдер, выбранный на вкладке AI. Смена здесь его не переключает.

**Reload the model list** недоступна, пока список загружается. Когда список загружен, справа **N of M available**: **M** — рекомендованные модели плюс добавленные, **N** — сколько из них всё ещё отмечено.

Поле **Add or search model** недоступно, пока у этого провайдера нет ключа. Без ключа строка **Connect OpenRouter above to see its models.** или **Connect Gemini above to see its models.** Пока список грузится: **Loading models...** Ошибка показывает текст ошибки.

Список открывается при фокусе. **Escape** или клик снаружи его закрывает.

* Пустое поле показывает бесплатные модели. Подсказка: **Free models. Type to search paid ones too.**
* Любой текст ищет по имени или id без учёта регистра, среди бесплатных и платных. Подсказка: **All models of the provider, free and paid.** Сначала бесплатные, затем по имени.
* Показано не больше **60** строк. Остаток: **N more, refine the search**.
* Ничего не найдено: **No models found**.

У строки имя, id и метка **free** или **paid**. Модели **recommended** уже в списке, их флажок недоступен. Отметка другой модели её добавляет. На вкладке AI добавленные модели идут в группе **Added**.

Под полем — эти рекомендованные и добавленные модели.

* Отмеченная строка доступна. Снятие отметки прячет её с вкладки AI и из **Auto**. Имя зачёркнуто. Под именем может быть **quota used up, resets in …**, **not available for this key** или **busy, retry in …**. В подсказке — сообщение провайдера. **N today** — сколько запросов к этой модели было сегодня. Метки: **recommended**, **unstable**, **paid**.
* Последнюю отмеченную модель снять нельзя.
* **Remove from the list** есть у моделей без метки recommended. Кнопка недоступна у последней отмеченной. Рекомендованные из списка не удаляются; их скрывают снятием отметки.

## Personalization

**Defaults** недоступна, пока блок уже в значениях по умолчанию: тон **Default**, объём **Normal**, маршрутизация **Lite** и пустое поле стиля.

**Base style and tone**

| Значение | Подсказка |
| -------- | --------- |
| **Default** | Balanced answers |
| **Professional** | Precise, neutral wording |
| **Friendly** | Supportive, plain words |
| **Direct** | Conclusion first, no filler |
| **Mentor** | Explains the concepts behind the cause |

**Answer detail**

| Значение | Подсказка |
| -------- | --------- |
| **Brief** | Cause, key evidence and the fix in a few lines |
| **Normal** | What went wrong, the cause, the evidence and the fix |
| **Detailed** | The whole chain of events, ruled-out causes, steps to reproduce |

**Instruction routing**

| Значение | Подсказка |
| -------- | --------- |
| **Full** | All task instructions in every request. For strong models |
| **Lite** | Core rules only; the model loads the instructions of the task when needed |

**Your style instructions** вмещает до **2000** символов. Подсказка поля: **For example: answer in Russian, end with a short checklist for the bug report**. Счётчик: **N / 2000**. Текст сохраняется примерно через **400 мс** после последнего изменения. **Defaults** в это окно может перезаписать отложенное сохранение, и стёртый текст вернётся.

## Agent access

Описание: **What the assistant may read and send to the provider.** **Defaults** возвращает значения ниже и недоступна, пока они уже стоят.

**Attach the logs digest to questions** — подсказка **A short summary of errors and the timeline.** По умолчанию **Allowed**. **Off** отправляет вопрос без этой сводки. Первый шаг ответа тогда пишет **no logs digest (turned off)**.

**Tools.** У каждой группы **Allowed**, **Ask each time** или **Off**. По умолчанию **Ask each time**. **Ask each time** — это подтверждение на вкладке [AI-ассистент](/ru/ai/general). **Allowed** выполняет инструмент без вопроса. **Off** не отдаёт эту группу ассистенту. Чтение этой документации остаётся доступным.

| Группа | Подсказка |
| ------ | --------- |
| **Logs** | Event details and search over the captured logs |
| **Page code** | List, read and search the scripts of the page and their source maps |
| **Live page** | Find elements on the page, why they are disabled or hidden, their components, handler code and the current store state |

**Data in the logs.** У каждой строки **Allowed** или **Off**. Все три по умолчанию **Allowed**. **Off** подставляет вместо скрытой части `[hidden by AI access settings]`. Выключенные значения стора, props, emit и action становятся типом в скобках, например `[string]`; имена и пути остаются.

| Строка | Подсказка |
| ------ | --------- |
| **Request and response headers** | Sensitive headers stay masked |
| **Request / response bodies and WebSocket messages** | |
| **Values of store state, props, emits and actions** | Off: only names, paths and types |

## Data masking for AI

Этот список применяется, когда данные уходят провайдеру. Вкладку **Logs** и HTML-отчёт он не меняет. Маска логов по-прежнему срабатывает первой. Как фрагмент совпадает с ключом и что значат `[MASKED]`, `[MASKED JWT]`, `Bearer [MASKED]` и `[MASKED CARD]`, описано в [Data masking](/ru/logs/settings#data-masking).

Текст под заголовком: **Values with matching names in objects, headers, URLs, and code are sent as [MASKED].**

**Mask sensitive data** — это флажок шаблонов значений. Он включён по умолчанию. Пока он выключен, действует только список ключей.

Колонка — **Key contains**. Пустая таблица: **No keys — only value patterns are masked**. Подсказка поля: **Key fragment, e.g. x-client-secret**. **Add** или **Enter** обрезает фрагмент. Пустое значение: **Key cannot be empty**. Тот же фрагмент без учёта регистра: **This key is already in the list**. Меню строки — **Delete**. Клик по строке ничего не делает.

Фрагменты по умолчанию — это [список логов](/ru/logs/settings#data-masking) плюс `passcode`, `auth`, `bearer`, `jwt`, `credential`, `session`, `csrf`, `xsrf`, `signature`, `accesskey`, `passphrase`.

`passcode` возвращается в список, если сохранённый список его ещё не содержит. **Delete** у этой строки не оставляет её удалённой.

**Defaults** восстанавливает список ключей и включает **Mask sensitive data**. Кнопка остаётся доступной, даже если список уже такой.
