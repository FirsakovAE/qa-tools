---
title: State
---

# State (Pinia)

In **Stores**, for the selected store, **State** shows a snapshot of **reactive fields** that belong to store state: for options stores mainly **`$state`** keys; for setup stores — refs and reactive objects on the store instance (excluding **computed** getters). Values go through `unwrapValue`, render in the JSON editor, and **Save** applies back via **`store.$patch`** inside `replaceState`.

Context: [Store overview](/store/general). Computed-style patching: [Getters](/store/getters).

---

## Which keys appear in the state snapshot

Key names come from `getStoreStateKeys` (`src/injected/pinia/store-meta.ts`): when `$state` exists, its keys are used; otherwise the store instance is scanned (skipping `$` / `_` / functions / **computed**).

```ts
function getStoreStateKeys(store) {
  if (store.$state && typeof store.$state === 'object') {
    return Object.keys(store.$state)
  }
  // setup-store: non-functions only, not isComputedRef(...)
  return collectEligibleKeysFromStoreInstance(store)
}
```

---

## Reading for the UI

`createSnapshot` / `getStoreState` in `src/injected/pinia/state-reader.ts` call `unwrapValue` per key; failures become `[Non-serializable]`.

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

The bridge in `src/injected/pinia/bridge.ts` answers `PINIA_GET_STORE_STATE` with `PINIA_STORE_STATE_DATA` containing **state**, **getters**, and **actions** — the **State** tab uses `state`.

```ts
function handleGetStoreState({ storeId, requestId }) {
  const state = tryGet(() => getStoreState(storeId))
  const getters = tryGet(() => getStoreGetters(storeId))
  const actions = tryGet(() => getStoreActions(storeId))
  postMessage({ type: 'PINIA_STORE_STATE_DATA', storeId, state, getters, actions, requestId })
}
```

`PiniaDetails.vue` loads this when the card opens and fills the editor.

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
  // …same for getters JSON
}
```

---

## Save: full state replace from the editor

The UI edits the whole state JSON; saving sends `PINIA_REPLACE_STATE` with `newState` (`PiniaDetails.vue` → injected `replaceState` in `src/injected/pinia/state-writer.ts`).

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

Success replies with `PINIA_REPLACE_STATE_RESULT`; the card may re-fetch `PINIA_GET_STORE_STATE` to resync.

---

## Path patch (`PINIA_PATCH_STATE`)

`state-writer.ts` exposes **`patchState(storeId, path, value)`**: paths like `a.b[0].c` unwrap refs along the way; **computed** targets reject writes. `PINIA_PATCH_STATE` / `PINIA_PATCH_STATE_RESULT` exist, but **the State form only issues full replace** (`PINIA_REPLACE_STATE`).

```ts
function patchState(storeId, path, value) {
  const store = getStore(storeId)
  const { parent, lastKey, finalTarget } = navigatePath(store, path) // unwrap refs
  if (isComputedRef(finalTarget)) return false
  if (isRef(finalTarget)) finalTarget.value = value
  else parent[lastKey] = value
  return true
}
```

---

## Notes

* The snapshot is **not live** until you refresh.
* Keys outside `getStoreStateKeys` won’t show in UI; **extra** keys in pasted JSON may still attempt writes — outcome depends on the store.
* Treat `[Non-serializable]` carefully or use **actions**.
* Computed / read-only getters are skipped in `replaceState`; change underlying **state** or see [Getters](/store/getters).

---

## See also

* [Getters](/store/getters)
* [Store overview](/store/general)
* [Favorites](/store/favorite)
