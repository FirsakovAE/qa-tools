---
title: Работа с Getters
---

# Работа с Getters (Pinia)

Во вкладке **Stores** после выбора стора секция **Getters** показывает **текущие значения** вычисляемых computed‑полей и иных свойств, которые Pinia выставляет на инстансе стора рядом с **state**. Значения берутся с живой страницы, сериализуются для JSON‑редактора и при сохранении снова пробрасываются в приложение через логику **патча**.

Общий контекст: [Основные возможности](/store/general). Работа с **state**: [Работа со State](/store/state).

---

## Какие поля считаются getters

Список ключей собирает `getGetterKeys` в `src/injected/pinia/store-meta.ts`: **computed** на setup‑сторе, ключи на `store`, которых нет в `$state`, и свойства с **getter** на прототипе (options‑store).

```ts
function getGetterKeys(store) {
  const getters = []
  const stateKeys = new Set(Object.keys(store.$state || {}))
  // 1) поля store, распознанные как computed ref
  // 2) ключ есть на store, но не в $state
  // 3) get без set на прототипе
  return getters
}
```

В сводке таблицы (**Getters: N**) отображается число таких ключей.

---

## Чтение значений для UI

`getStoreGetters` в `src/injected/pinia/getters.ts` для каждого ключа из `getGetterKeys` кладёт в результат `unwrapValue(store[key])`; ошибки дают `[Non-serializable]`.

```ts
function getStoreGetters(storeId) {
  const store = getStore(storeId)
  if (!store) return {}
  const result = {}
  for (const key of getGetterKeys(store)) {
    try {
      result[key] = unwrapValue(store[key])
    } catch {
      result[key] = '[Non-serializable]'
    }
  }
  return result
}
```

При открытии карточки панель запрашивает `PINIA_GET_STORE_STATE`; в ответе приходят **state** и **getters** — последние показываются во вкладке **Getters** (текстовой или древовидный JSON по настройкам).

---

## Редактирование и сохранение

В `PiniaDetails.vue` при сохранении секции Getters уходит `PINIA_PATCH_GETTERS` с объектом новых значений (результат `JSON.parse` редактора).

```ts
async function saveGettersChanges() {
  const newGetters = JSON.parse(editedGettersJson.value)
  const response = await runtime.sendMessage({
    type: 'PINIA_PATCH_GETTERS',
    storeId,
    newGetters
  })
  if (response?.success) {
    gettersData.value = newGetters
    isEditingGetters.value = false
  }
}
```

На странице `patchGetters` (`src/injected/pinia/state-writer.ts`) **не присваивает значения чистому readonly computed**: внутри `store.$patch` для каждого ключа пытаются обновить **базу** — запись в `$state`, в записываемый ref, слияние в реактивный объект/массив; иначе ключ пропускается.

```ts
function patchGetters(storeId, newGetters) {
  const store = getStore(storeId)
  const updated = []
  store.$patch(() => {
    for (const [key, newValue] of Object.entries(newGetters)) {
      if (key in store.$state) {
        store.$state[key] = newValue
        updated.push(key)
      } else if (isWritableRef(store[key])) {
        store[key].value = newValue
        updated.push(key)
      } else if (canMergeReactive(store[key], newValue)) {
        mergeReactive(store[key], newValue)
        updated.push(key)
      }
      // чистый computed — пропуск
    }
  })
  return { success: true, updated }
}
```

Ответ — `PINIA_PATCH_GETTERS_RESULT` (`success`, список `updated`). После успеха можно перечитать стор (**Refresh**), чтобы убедиться, что отображаемые getters совпали с приложением.

---

## На что обратить внимание

- Если имя совпадает с полем **state**, патч попадёт в **`$state[key]`** — вы меняете источник правды.
- Только читаемые computed без обходного пути к state/ref **не изменятся**; смотрите **state** или **actions**.
- Несериализуемые значения при чтении — заглушка в JSON; правьте осознанно или через **state** / **actions**.

---

## См. также

- [Работа со State](/store/state)
- [Основные возможности Store](/store/general)
- [Избранное](/store/favorite)
