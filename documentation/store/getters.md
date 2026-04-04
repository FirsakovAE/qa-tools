---
title: Getters
---

# Getters (Pinia)

In **Stores**, **Getters** shows **current values** of computed fields and other properties Pinia exposes on the store instance beside **state**. Values are read from the live page, serialized for the JSON editor, and on save are applied via **patch** logic back into the app.

Context: [Store overview](/store/general). **State** editing: [State](/store/state).

---

## Which fields count as getters

`getGetterKeys` in `src/injected/pinia/store-meta.ts` collects **computed** on setup stores, keys present on `store` but missing from `$state`, and prototype properties with **get** (options stores).

```ts
function getGetterKeys(store) {
  const getters = []
  const stateKeys = new Set(Object.keys(store.$state || {}))
  // 1) store fields detected as computed refs
  // 2) key on store but not in $state
  // 3) getter without setter on prototype
  return getters
}
```

The summary column (**Getters: N**) shows that count.

---

## Reading for the UI

`getStoreGetters` in `src/injected/pinia/getters.ts` stores `unwrapValue(store[key])` per getter key; errors become `[Non-serializable]`.

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

Opening the card requests `PINIA_GET_STORE_STATE`; **getters** render in the **Getters** tab (text or tree JSON).

---

## Edit and save

Saving **Getters** sends `PINIA_PATCH_GETTERS` with parsed JSON from the editor (`PiniaDetails.vue`).

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

`patchGetters` in `src/injected/pinia/state-writer.ts` **does not assign to pure readonly computed**; inside `store.$patch` it tries **backing** fields — writes to `$state`, writable refs, reactive merge; otherwise skips.

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
      // pure computed — skip
    }
  })
  return { success: true, updated }
}
```

Response: `PINIA_PATCH_GETTERS_RESULT` (`success`, `updated`). **Refresh** afterward to confirm displayed getters match the app.

---

## Notes

* If a name matches **state**, the patch hits **`$state[key]`** — you change the source of truth.
* Pure read-only computed with no writable backing **won’t** change; use **state** or **actions**.
* Non-serializable reads show placeholders; edit carefully or via **state** / **actions**.

---

## See also

* [State](/store/state)
* [Store overview](/store/general)
* [Favorites](/store/favorite)
