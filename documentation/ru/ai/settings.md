---
title: Options → AI
---

# Options → AI

**Options → AI** — это раздел с подписью **AI**. Шестерёнка на вкладке [AI-ассистент](/ru/ai/general) открывает **Connection**. **Review access** на той вкладке открывает **Agent access**.

Блоки идут в таком порядке: **Connection**, **Models**, **Personalization**, **Agent access**, **Data masking for AI**.

Эти настройки хранятся в этом браузере отдельно от профиля инспектора. **Export** и **Import** в [Менеджере настроек](/ru/options/settings_management) включают их: в JSON это объект `ai`. Ключи API и **Extra headers** своих провайдеров в файл не записываются и при импорте не применяются. Свои провайдеры записываются без них; при импорте провайдер с тем же id сохраняет ключ, заголовки и подтверждение из этого браузера, новый приходит без ключа и снова спрашивает подтверждение, а провайдеры, которые есть только в этом браузере, остаются. **Reset** не очищает **Options → AI**, включая ключи и счётчики запросов за сегодня. На экране написано: *Keys stay in this browser and are not included in settings export.*

## Connection

Сначала **OpenRouter**, затем **Gemini**. У каждой строки подпись **your own API key**.

Сохранённый ключ показан как восемь точек и последние четыре символа, рядом **Remove**. **Remove** стирает этот ключ и не меняет провайдера, выбранного на вкладке AI.

Пустой ключ — поле пароля **OpenRouter API key** или **Gemini API key** и кнопка **Save**. **Save** недоступна, пока поле пустое или в нём одни пробелы. Сохраняется текст без пробелов по краям. Сохранение также выбирает этого провайдера на вкладке AI.

Под OpenRouter: **Get a free key in** [OpenRouter](https://openrouter.ai/settings/keys). Под Gemini: **Get a free key in** [Google AI Studio](https://aistudio.google.com/apikey).

Пока ни один ключ не сохранён, вкладка AI использует **Gemini**.

### Свои провайдеры {#your-own-providers}

Под встроенными провайдерами — **Your own providers** с подписью *OpenAI, DeepSeek, local models, OpenAI-compatible agents*. Подходит любой сервер, который отвечает на `POST {Base URL}/chat/completions` в формате OpenAI: облачный ключ API, модель на вашей машине или собственный агент. Каждый провайдер — строка с именем, а под ним хост, **local** для адреса на этой машине или в локальной сети, ключ в виде восьми точек и последних четырёх символов (или **no key**) и режим инструментов. **Edit the connection** открывает тот же диалог, что и **Add provider**. **Remove the connection** переспрашивает в самой строке (**Remove** / **Keep**); удаление стирает ключ, выбор моделей и отметки моделей этого провайдера, а вкладка AI переключается на встроенного провайдера.

**Add provider** открывает **Add your own provider**:

| Поле | Значение |
| ---- | -------- |
| **Type** | Пресет, который заполняет поля ниже; см. следующую таблицу. Смена пресета меняет только поля, которые ещё совпадают со значениями прежнего пресета |
| **Name** | До 40 символов, видно в меню провайдеров |
| **Base URL** | До версии API включительно, например `https://api.openai.com/v1`. Завершающий `/` или `/chat/completions` убирается. Под полем — куда пойдут запросы или предупреждение для удалённого адреса `http://` (ключ и данные идут без шифрования) |
| **API key** | Обязателен для OpenAI и DeepSeek, для остальных типов — по желанию. Отправляется как `Authorization: Bearer …` |
| **Tools** (Advanced) | **Native tool calls** — поле `tools` в API. **Tools as text** — для серверов, которые не принимают `tools`: инструменты описываются в системном промпте, модель пишет `<tool_call>{…}</tool_call>`, результаты возвращаются сообщениями пользователя. **No tools** — модель отвечает только по вопросу, вложениям и выжимке логов |
| **Context size** (Advanced) | **Small (8K tokens)**, **Medium (32K)** или **Large (128K+)**. Чем меньше, тем короче выжимка логов, сильнее обрезаются результаты инструментов, раньше отбрасываются прошлые вопросы и меньше раундов инструментов (6, 8 и 10) |
| **Stream answers** (Advanced) | Включено по умолчанию. Выключите, если сервер ломает потоковые ответы |
| **Extra headers** (Advanced) | По одному в строке, `Name: value`, для шлюзов и прокси (например `api-key: …`). Заголовок с именем `Authorization` заменяет стандартный |

| Тип | Base URL | Ключ | Контекст | Примечания |
| --- | -------- | ---- | -------- | ---------- |
| **OpenAI** | `https://api.openai.com/v1` | обязателен | Large | Оплачивается с вашего аккаунта OpenAI. Рассуждающим моделям (`o…`, `gpt-5…`) `temperature` не передаётся |
| **DeepSeek** | `https://api.deepseek.com/v1` | обязателен | Large | Оплачивается с баланса DeepSeek. Рассуждения `deepseek-reasoner` показываются как размышления |
| **Ollama** | `http://localhost:11434/v1` | — | Small | Запускайте Ollama с `OLLAMA_ORIGINS=chrome-extension://*` (или `*`), иначе она отвечает расширению 403. Для длинных чатов увеличьте `OLLAMA_CONTEXT_LENGTH` (например 16384). Выбирайте модель с поддержкой инструментов |
| **LM Studio** | `http://localhost:1234/v1` | — | Medium | Запустите сервер в **Developer** и включите **CORS** |
| **OpenAI-compatible** | свой | по желанию | Medium | vLLM, llama.cpp, LiteLLM, Groq, Mistral, xAI, Together, собственный агент |

**Test connection** запрашивает список моделей (`GET {Base URL}/models`) и отправляет один короткий запрос с тестовым инструментом. По результату выбирается **Tools**: **Native tool calls**, если модель вызвала инструмент, и **Tools as text**, если она его проигнорировала или сервер отклонил поле `tools`. **Model id for the test** указывать не обязательно; без него берётся первая предложенная модель. Для сервера без списка моделей id нужен; при **Add**/**Save** он добавляется в модели провайдера. Ошибка показывает сообщение и **Server response**.

Первый вопрос новому провайдеру снова просит подтверждение: **Data sent to {имя} ({хост})**. В тексте сказано, локальный ли сервер или что данные уходят на этот хост по его условиям.

Частые ошибки своих провайдеров:

* **Could not reach {имя} ({хост})** — сервер не запущен, адрес неверный или (на [standalone](/ru/standalone)-странице) сервер не разрешает запросы с другого origin.
* **{имя} refused the request from the extension** — локальный сервер отклонил origin расширения (Ollama: `OLLAMA_ORIGINS`).
* **{имя}: {хост} has no such endpoint** — проверьте **Base URL**; обычно он заканчивается на `/v1`.
* **{имя} rejected tool calls** — переключите **Tools** на **Tools as text** или **No tools**.
* **{имя}: the account has no credits or quota left.**

Если сервер отвечает HTTP 400 на `temperature`, `stream_options` или `tool_choice`, запрос один раз повторяется без этого параметра, и до перезагрузки страницы расширения этот параметр серверу больше не отправляется.

## Models

Меню провайдера здесь только выбирает, чей список редактировать. Сначала это провайдер, выбранный на вкладке AI. Смена здесь его не переключает.

**Reload the model list** недоступна, пока список загружается. Когда список загружен, справа **N of M available**: **M** — рекомендованные модели плюс добавленные, **N** — сколько из них всё ещё отмечено.

В меню провайдера — OpenRouter, Gemini и свои провайдеры. Поле **Add or search model** недоступно, пока у этого провайдера нет ключа (свой провайдер считается подключённым сразу после добавления). Без ключа строка **Connect OpenRouter above to see its models.** или **Connect Gemini above to see its models.** Пока список грузится: **Loading models...** Ошибка показывает текст ошибки; у своих провайдеров уже добавленные модели остаются в списке под ней.

Список открывается при фокусе. **Escape** или клик снаружи его закрывает.

* Пустое поле показывает бесплатные модели. Подсказка: **Free models. Type to search paid ones too.**
* Любой текст ищет по имени или id без учёта регистра, среди бесплатных и платных. Подсказка: **All models of the provider, free and paid.** Сначала бесплатные, затем по имени.
* Показано не больше **60** строк. Остаток: **N more, refine the search**.
* Ничего не найдено: **No models found**.

У строки имя, id и метка **free** или **paid**. Модели **recommended** уже в списке, их флажок недоступен. Отметка другой модели её добавляет. На вкладке AI добавленные модели идут в группе **Added**.

У своих провайдеров список берётся из `GET {Base URL}/models` без моделей эмбеддингов, речи и изображений, меток **free**/**paid** нет, подсказка — **Models the server lists**. У локальных провайдеров и у списков до 8 моделей рекомендованы все модели; в длинных списках рекомендуется до трёх (OpenAI: `gpt-5-mini`, `gpt-5`, `gpt-4.1-mini`…; DeepSeek: `deepseek-chat`, `deepseek-reasoner`). В поле написано **Add or search model, or type a model id**: введённый id, которого нет в списке сервера, показывает **Add model id …**, **Enter** тоже его добавляет. Так добавляются модели агентов и шлюзов без списка моделей. **Auto** у своих провайдеров выбирает из моделей списка и переключается при ошибках.

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
