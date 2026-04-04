---
title: Работа со State
---

# Работа со State (Pinia)

Во вкладке **Stores** для выбранного стора секция **State** показывает **снимок реактивных полей**, которые относятся к состоянию хранилища: для options‑store это в первую очередь ключи из `$state`, для setup‑store — refs и реактивные объекты на инстансе стора (без computed‑геттеров). Значения сериализуются через `unwrapValue`, отображаются в JSON‑редакторе, а при **Save** целиком применяются обратно на страницу через **`store.$patch`** в `replaceState`.

Общий контекст: [Основные возможности](/ru/store/general). Вычисляемые поля и патч «как у геттеров»: [Работа с Getters](/ru/store/getters).

---

## Какие ключи попадают в снимок state

Список имён состояния строится в `getStoreStateKeys` (`src/injected/pinia/store-meta.ts`): при наличии `$state` берутся его ключи; иначе перебираются поля стора без `$`/`_`/функций и без **computed**.

```ts
function getStoreStateKeys(store) {
  if (store.$state && typeof store.$state === 'object') {
    return Object.keys(store.$state)
  }
  // setup-store: только не-функции и не isComputedRef(...)
  return collectEligibleKeysFromStoreInstance(store)
}
```

---

## Чтение значений для UI

`createSnapshot` и `getStoreState` в `src/injected/pinia/state-reader.ts` для каждого ключа состояния вызывают `unwrapValue`; при ошибке в снимок попадает строка `[Non-serializable]`.

```ts
function createSnapshot(store) {
  const snapshot = {}
  for (const key of getStoreStateKeys(store)) {
    try {
      snapshot[key] = unwrapValue(store[key])
    } catch {
      snapshot[key] = '[Non-serializable]'
    }
  }
  return snapshot
}

function getStoreState(storeId) {
  const store = getStore(storeId)
  return store ? createSnapshot(store) : null
}
```

Мост в `src/injected/pinia/bridge.ts` на `PINIA_GET_STORE_STATE` отвечает `PINIA_STORE_STATE_DATA` с полями **state**, **getters** и **actions** — в секцию State уходит `state`.

```ts
function handleGetStoreState({ storeId, requestId }) {
  const state = tryGet(() => getStoreState(storeId))
  const getters = tryGet(() => getStoreGetters(storeId))
  const actions = tryGet(() => getStoreActions(storeId))
  postMessage({ type: 'PINIA_STORE_STATE_DATA', storeId, state, getters, actions, requestId })
}
```

В `PiniaDetails.vue` при открытии карточки вызывается загрузка и подставляются данные в редактор.

```ts
async function loadStoreData() {
  const response = await runtime.sendMessage({
    type: 'PINIA_GET_STORE_STATE',
    storeId
  })
  if (response && 'state' in response) stateData.value = response.state ?? {}
  if (response && 'getters' in response) gettersData.value = response.getters ?? {}
  await nextTick()
  editedStateJson.value = JSON.stringify(stateData.value, null, 2)
  // … то же для getters JSON
}
```

---

## Сохранение: полная замена state из редактора

В UI правится весь JSON состояния; сохранение — одно сообщение `PINIA_REPLACE_STATE` с объектом `newState` (`PiniaDetails.vue` → инжект `replaceState` в `src/injected/pinia/state-writer.ts`).

```ts
async function saveStateChanges() {
  const newState = JSON.parse(editedStateJson.value)
  const response = await runtime.sendMessage({
    type: 'PINIA_REPLACE_STATE',
    storeId,
    newState
  })
  if (response?.success) {
    stateData.value = newState
    isEditingState.value = false
  }
}
```

```ts
function replaceState(storeId, newState) {
  const store = getStore(storeId)
  if (!store) return false
  store.$patch(() => {
    for (const key of Object.keys(newState)) {
      if (shouldSkipKey(store, key)) continue // computed, read-only getter, function
      if (isRef(store[key])) store[key].value = newState[key]
      else if (isReactiveObject(store[key])) mergeIntoReactive(store[key], newState[key])
      else assignPrimitiveOrState(store, key, newState[key])
    }
  })
  return true
}
```

Успешный ответ — `PINIA_REPLACE_STATE_RESULT`; при необходимости карточка снова запрашивает `PINIA_GET_STORE_STATE`, чтобы снимок совпал со страницей.

---

## Точечный патч по пути (`PINIA_PATCH_STATE`)

В `state-writer.ts` есть **`patchState(storeId, path, value)`**: путь вида `a.b[0].c` разбирается, при обходе снимаются ref; если целевое значение — computed, запись отклоняется. Сообщения `PINIA_PATCH_STATE` / `PINIA_PATCH_STATE_RESULT` поддерживаются мостом, но **форма State в панели шлёт только полную замену** (`PINIA_REPLACE_STATE`).

```ts
function patchState(storeId, path, value) {
  const store = getStore(storeId)
  const { parent, lastKey, finalTarget } = navigatePath(store, path) // с unwrap ref по дороге
  if (isComputedRef(finalTarget)) return false
  if (isRef(finalTarget)) finalTarget.value = value
  else parent[lastKey] = value
  return true
}
```

---

## На что обратить внимание

- Снимок **не живой**: после загрузки карточки изменения на странице сами по себе не отражаются, пока вы не обновите данные.
- Ключи вне `getStoreStateKeys` в JSON не показываются; **лишние** ключи в сохранённом JSON могут попытаться записаться в стор — итог зависит от его устройства.
- Поля с `[Non-serializable]` при чтении правьте осознанно или через **actions**.
- Computed и read‑only геттеры в `replaceState` пропускаются; меняйте исходный state или смотрите [Getters](/ru/store/getters).

---

## См. также

- [Работа с Getters](/ru/store/getters)
- [Основные возможности Store](/ru/store/general)
- [Избранное](/ru/store/favorite)
