# Vue Runtime Inspector

**Vue Runtime Inspector** — инструмент для глубокой runtime-инспекции Vue-приложений в production- и test-сценариях.

Проект создан для ситуаций, когда стандартных browser devtools уже недостаточно: значительная часть frontend-логики находится внутри props, store, реактивных связей и внутренних runtime-состояний компонентов, которые не видны через DOM и network alone.

Инструмент позволяет работать с приложением изнутри:

* инспектировать и изменять `props` Vue-компонентов
* читать и редактировать `state` и `getters` Pinia
* перехватывать и изменять сетевые запросы
* подменять ответы без proxy и сертификатов
* запускать инспектор как extension, iframe, DevTools или standalone bookmark

---

## Почему это нужно

Современные frontend-приложения всё чаще строятся так, что внешнее наблюдение перестаёт объяснять внутреннее поведение.

Стандартные инструменты показывают только часть картины:

* Network показывает транспорт
* DOM показывает результат
* Console показывает ошибки

Но значимая часть логики находится между ними:

* props
* store
* reactive state
* internal component transitions

Vue Runtime Inspector даёт прямой доступ к этому слою.

---

## Основные возможности

### Props

* обнаружение Vue-компонентов на странице
* просмотр runtime props
* поиск по компонентам, DOM и значениям
* редактирование JSON без перезагрузки страницы
* favorites / blacklist / quick actions

### Store

* обнаружение активных stores
* просмотр `state` и `getters`
* редактирование состояния во время работы страницы
* favorites и пользовательские шаблоны поиска

### Network

* просмотр `fetch` / `XHR`
* breakpoint перед отправкой
* изменение request payload
* mock response
* генерация Postman collection

---

## Режимы запуска

* Browser Extension
* Embedded iframe
* DevTools mode
* Standalone bookmark (без установки)

Standalone-режим особенно полезен в корпоративных окружениях, где установка расширений ограничена.

---

## Roadmap

Текущая production-ветка проекта реализована для Vue.

В перспективе архитектура проекта рассматривается как база для расширения runtime inspection-подхода на другие frontend ecosystems, включая React.

---

## Установка

### Extension

```bash
npm install
npm run build
```

Далее:

```text
chrome://extensions/
→ Developer mode
→ Load unpacked
→ dist/
```

### Standalone

Открыть:

```text
https://firsakovae.github.io/qa-tools/
```

Перетащить bookmark и запускать на целевой странице.
