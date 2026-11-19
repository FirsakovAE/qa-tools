/**
 * Prop override rules: values saved from the Props editor that a component receives
 * from the moment it is created, before setup() and the first render.
 *
 * Self-contained: bundled into ws-early (document_start, page world) and into the
 * injected script; whichever runs first installs the engine, the other reuses it.
 *
 * Vue 3 (esm-bundler build, 3.3+): Vue calls every function in
 * globalThis.__VUE_INSTANCE_SETTERS__ with the instance right before setup(), so a
 * setter registered there sees each component with initialized props.
 * Older Vue 3 builds fall back to a global beforeCreate mixin; Vue 2 uses a global
 * beforeCreate mixin that rewrites propsData.
 *
 * An applied value is sticky: the raw props key becomes an accessor that keeps the
 * override and parks whatever the parent passes later, restored when the rule goes away.
 */

export interface PropOverrideSyncRule {
  id: string
  /** location.host the rule belongs to; empty matches every site */
  host: string
  component: string
  /** Ancestor component names, root first, parent last */
  path: string[]
  scope: 'path' | 'all'
  props: Record<string, unknown>
}

export interface PropOverrideTarget {
  component: string
  path: string[]
  host: string
}

export interface PropOverridesApi {
  sync(rules: PropOverrideSyncRule[]): number
  /** Rule ids and prop keys currently overridden on the instance */
  applied(instance: any): { ruleIds: string[]; keys: string[] } | null
  /** Live edit of an overridden key: the new value replaces the override on this instance */
  write(instance: any, key: string, value: unknown): boolean
  describe(instance: any): PropOverrideTarget
}

const GLOBAL_KEY = '__VUE_INSPECTOR_PROP_OVERRIDES__'
const MIRROR_KEY = '__vue_inspector_prop_overrides__'
const SETTERS_KEY = '__VUE_INSTANCE_SETTERS__'
export const PROP_OVERRIDES_SYNC = 'PROP_OVERRIDES_SYNC'

interface StickyEntry {
  ruleId: string
  value: unknown
  json: string
  parentValue: unknown
  writing: boolean
  restore: (live: boolean) => void
}

type Page = typeof globalThis & Record<string, any>

export function getPropOverrides(): PropOverridesApi | null {
  return ((globalThis as Page)[GLOBAL_KEY] as PropOverridesApi | undefined) ?? null
}

export function bootPropOverrides(): PropOverridesApi {
  const page = globalThis as Page
  const existing = page[GLOBAL_KEY] as PropOverridesApi | undefined
  if (existing) return existing

  let rules: PropOverrideSyncRule[] = []
  const stuck = new WeakMap<object, Map<string, StickyEntry>>()
  const touched = new Set<any>()
  const seen = new WeakSet<object>()
  let settersHooked = false
  const patchedVue2 = new WeakSet<object>()
  const patchedApps = new WeakSet<object>()

  function clone<T>(value: T): T {
    if (value === null || typeof value !== 'object') return value
    try {
      return JSON.parse(JSON.stringify(value))
    } catch {
      return value
    }
  }

  function json(value: unknown): string {
    try {
      return JSON.stringify(value) ?? 'undefined'
    } catch {
      return String(value)
    }
  }

  function isVue3(instance: any): boolean {
    return !!instance && typeof instance === 'object' && !!instance.vnode && 'propsOptions' in instance
  }

  function nameOf(instance: any): string {
    if (!instance) return 'Anonymous'
    return (
      instance.type?.name ||
      instance.type?.__name ||
      instance.type?.displayName ||
      instance.$options?.name ||
      instance.$options?._componentTag ||
      'Anonymous'
    )
  }

  function ancestry(instance: any): string[] {
    const names: string[] = []
    let current = isVue3(instance) ? instance.parent : instance.$parent
    while (current && names.length < 200) {
      names.unshift(nameOf(current))
      current = isVue3(current) ? current.parent : current.$parent
    }
    return names
  }

  function sameRoute(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((name, i) => name === b[i])
  }

  function forHost(list: PropOverrideSyncRule[]): PropOverrideSyncRule[] {
    const host = location.host
    return list.filter(rule => !rule.host || rule.host === host)
  }

  /** Values the instance should get, more specific rules last so they win */
  function wanted(instance: any): Map<string, { ruleId: string; value: unknown }> {
    const result = new Map<string, { ruleId: string; value: unknown }>()
    if (!rules.length) return result
    const name = nameOf(instance)
    const candidates = rules.filter(rule => rule.component === name)
    if (!candidates.length) return result
    let route: string[] | null = null
    const ordered = [...candidates.filter(r => r.scope === 'all'), ...candidates.filter(r => r.scope !== 'all')]
    for (const rule of ordered) {
      if (rule.scope !== 'all') {
        route ??= ancestry(instance)
        if (!sameRoute(route, rule.path)) continue
      }
      for (const key of Object.keys(rule.props)) result.set(key, { ruleId: rule.id, value: rule.props[key] })
    }
    return result
  }

  function declared(instance: any, key: string): boolean {
    if (isVue3(instance)) {
      const options = instance.propsOptions?.[0]
      return !!options && Object.prototype.hasOwnProperty.call(options, key)
    }
    const options = instance.$options?.props
    return !!options && Object.prototype.hasOwnProperty.call(options, key)
  }

  function rawProps3(instance: any): Record<string, unknown> | null {
    const props = instance.props
    if (!props || !props.__v_isReactive) return null
    return (props.__v_raw as Record<string, unknown>) ?? null
  }

  function refreshVue2(vm: any): void {
    try {
      const watchers: any[] = vm._watchers || vm._scope?.effects || []
      for (const w of watchers) if (w && w.lazy) w.dirty = true
      vm.$forceUpdate?.()
    } catch {
      /* best effort */
    }
  }

  function stick3(instance: any, entries: Map<string, StickyEntry>, key: string, ruleId: string, value: unknown, live: boolean): void {
    const raw = rawProps3(instance)
    if (!raw) return
    const proxy = instance.props
    const parentValue = raw[key]
    const entry: StickyEntry = {
      ruleId,
      value,
      json: json(value),
      parentValue,
      writing: false,
      restore(liveRestore) {
        Object.defineProperty(raw, key, { value: entry.value, writable: true, enumerable: true, configurable: true })
        if (liveRestore) proxy[key] = entry.parentValue
        else raw[key] = entry.parentValue
      }
    }
    if (live) proxy[key] = value
    Object.defineProperty(raw, key, {
      configurable: true,
      enumerable: true,
      get: () => entry.value,
      set: (next: unknown) => {
        if (entry.writing) entry.value = next
        else entry.parentValue = next
      }
    })
    entries.set(key, entry)
  }

  function stick2(vm: any, entries: Map<string, StickyEntry>, key: string, ruleId: string, value: unknown, live: boolean): void {
    const props = vm._props
    if (!props) return
    const desc = Object.getOwnPropertyDescriptor(props, key)
    if (!desc || !desc.configurable) return
    const parentGet = desc.get
    const parentSet = desc.set
    const entry: StickyEntry = {
      ruleId,
      value,
      json: json(value),
      parentValue: undefined,
      writing: false,
      restore(liveRestore) {
        Object.defineProperty(props, key, desc)
        if (liveRestore) refreshVue2(vm)
      }
    }
    Object.defineProperty(props, key, {
      configurable: true,
      enumerable: desc.enumerable,
      get() {
        if (parentGet) parentGet.call(props)
        return entry.value
      },
      set(next: unknown) {
        if (entry.writing) entry.value = next
        else if (parentSet) parentSet.call(props, next)
        else if (!parentGet) desc.value = next
      }
    })
    entries.set(key, entry)
    if (live) refreshVue2(vm)
  }

  function writeEntry(instance: any, entry: StickyEntry, key: string, value: unknown): void {
    entry.writing = true
    try {
      if (isVue3(instance)) {
        instance.props[key] = value
        entry.value = value
      } else {
        entry.value = value
        refreshVue2(instance)
      }
    } finally {
      entry.writing = false
    }
    entry.json = json(value)
  }

  function mounted(instance: any): boolean {
    return isVue3(instance) ? !!instance.isMounted : !!instance._isMounted
  }

  function gone(instance: any): boolean {
    return isVue3(instance) ? !!instance.isUnmounted : !!instance._isDestroyed
  }

  /** Bring the instance in line with the rules; live means it is already on screen */
  function reconcile(instance: any, live: boolean): void {
    const target = wanted(instance)
    let entries = stuck.get(instance)
    if (!target.size && !entries) return
    if (!entries) {
      entries = new Map()
      stuck.set(instance, entries)
    }
    for (const [key, entry] of [...entries]) {
      if (target.has(key)) continue
      try {
        entry.restore(live)
      } catch {
        /* instance torn down */
      }
      entries.delete(key)
    }
    const vue3 = isVue3(instance)
    for (const [key, { ruleId, value }] of target) {
      if (!declared(instance, key)) continue
      const existing = entries.get(key)
      if (existing) {
        existing.ruleId = ruleId
        if (existing.json !== json(value)) writeEntry(instance, existing, key, clone(value))
        continue
      }
      try {
        if (vue3) stick3(instance, entries, key, ruleId, clone(value), live)
        else stick2(instance, entries, key, ruleId, clone(value), live)
      } catch {
        /* frozen or exotic props object */
      }
    }
    if (entries.size) touched.add(instance)
    else {
      stuck.delete(instance)
      touched.delete(instance)
    }
  }

  function onInstance(instance: any): void {
    if (!rules.length || !instance || typeof instance !== 'object' || seen.has(instance)) return
    if (!isVue3(instance) || !rawProps3(instance)) return
    seen.add(instance)
    try {
      reconcile(instance, !!instance.isMounted)
    } catch {
      /* never break the page */
    }
  }

  function hookSetters(): void {
    if (settersHooked) return
    settersHooked = true
    let list = page[SETTERS_KEY] as Array<(v: unknown) => void> | undefined
    if (!Array.isArray(list)) {
      list = []
      page[SETTERS_KEY] = list
    }
    list.push(onInstance)
  }

  function vueRegisteredSetter(): boolean {
    const list = page[SETTERS_KEY]
    return Array.isArray(list) && list.some(fn => fn !== onInstance)
  }

  /** Mounted apps with their root vnode (app._instance is only set in dev builds) */
  function vue3Apps(): Array<{ app: any; root: any }> {
    const apps: Array<{ app: any; root: any }> = []
    document.querySelectorAll('[data-v-app]').forEach(el => {
      const app = (el as any).__vue_app__
      if (app && !apps.some(entry => entry.app === app)) {
        apps.push({ app, root: (el as any)._vnode ?? app._instance?.vnode })
      }
    })
    return apps
  }

  function vue2Roots(): any[] {
    const roots: any[] = []
    const candidates = document.querySelectorAll('body, body > *, body > * > *, body > * > * > *')
    candidates.forEach(el => {
      const vm = (el as any).__vue__
      const root = vm?.$root
      if (root && !roots.includes(root)) roots.push(root)
    })
    return roots
  }

  function patchVue3App(app: any): void {
    if (patchedApps.has(app) || typeof app.mixin !== 'function') return
    patchedApps.add(app)
    app.mixin({
      beforeCreate(this: any) {
        onInstance(this.$)
      }
    })
    const context = app._context
    if (context && context.optionsCache) context.optionsCache = new WeakMap()
  }

  function patchVue2(root: any): void {
    let Base = root.constructor
    while (Base && Base.super) Base = Base.super
    if (!Base || typeof Base.mixin !== 'function' || patchedVue2.has(Base)) return
    patchedVue2.add(Base)
    Base.mixin({
      beforeCreate(this: any) {
        if (!rules.length) return
        try {
          const target = wanted(this)
          if (!target.size) return
          const options = this.$options
          const data = { ...(options.propsData || {}) }
          let changed = false
          for (const [key, { value }] of target) {
            if (!declared(this, key)) continue
            data[key] = clone(value)
            changed = true
          }
          if (changed) options.propsData = data
        } catch {
          /* never break the page */
        }
      },
      created(this: any) {
        if (!rules.length) return
        try {
          reconcile(this, false)
        } catch {
          /* never break the page */
        }
      }
    })
  }

  function walk3(vnode: any, visit: (instance: any) => void, depth: number): void {
    if (!vnode || typeof vnode !== 'object' || depth > 400) return
    const component = vnode.component
    if (component) {
      visit(component)
      walk3(component.subTree, visit, depth + 1)
      return
    }
    if (vnode.suspense) {
      walk3(vnode.suspense.activeBranch, visit, depth + 1)
      return
    }
    const children = vnode.children
    if (Array.isArray(children)) for (const child of children) walk3(child, visit, depth + 1)
  }

  function walk2(vm: any, visit: (instance: any) => void, depth: number): void {
    if (!vm || depth > 400) return
    visit(vm)
    for (const child of vm.$children || []) walk2(child, visit, depth + 1)
  }

  /** Apply to everything already on the page and hook future instances */
  function reconcileAll(): void {
    const visited = new Set<any>()
    const visit = (instance: any) => {
      if (visited.has(instance)) return
      visited.add(instance)
      if (isVue3(instance)) seen.add(instance)
      try {
        reconcile(instance, mounted(instance))
      } catch {
        /* never break the page */
      }
    }
    const apps = vue3Apps()
    for (const { app, root } of apps) {
      if (rules.length && !vueRegisteredSetter()) patchVue3App(app)
      walk3(root, visit, 0)
    }
    if (!apps.length) {
      for (const root of vue2Roots()) {
        if (rules.length) patchVue2(root)
        walk2(root, visit, 0)
      }
    }
    for (const instance of [...touched]) {
      if (visited.has(instance)) continue
      if (gone(instance)) {
        touched.delete(instance)
        stuck.delete(instance)
        continue
      }
      try {
        reconcile(instance, mounted(instance))
      } catch {
        /* never break the page */
      }
    }
  }

  function writeMirror(list: PropOverrideSyncRule[]): void {
    try {
      if (list.length) localStorage.setItem(MIRROR_KEY, JSON.stringify(list))
      else localStorage.removeItem(MIRROR_KEY)
    } catch {
      /* storage blocked */
    }
  }

  function readMirror(): PropOverrideSyncRule[] {
    try {
      const stored = localStorage.getItem(MIRROR_KEY)
      const parsed = stored ? JSON.parse(stored) : null
      return Array.isArray(parsed) ? forHost(parsed.filter(valid)) : []
    } catch {
      return []
    }
  }

  function valid(rule: any): rule is PropOverrideSyncRule {
    return (
      !!rule &&
      typeof rule.id === 'string' &&
      typeof rule.component === 'string' &&
      Array.isArray(rule.path) &&
      !!rule.props &&
      typeof rule.props === 'object'
    )
  }

  function sync(next: PropOverrideSyncRule[]): number {
    rules = forHost((Array.isArray(next) ? next : []).filter(valid))
    writeMirror(rules)
    if (rules.length) hookSetters()
    if (rules.length || touched.size) reconcileAll()
    let count = 0
    for (const instance of touched) if (!gone(instance)) count++
    return count
  }

  const api: PropOverridesApi = {
    sync,
    applied(instance) {
      const entries = instance ? stuck.get(instance) : undefined
      if (!entries || !entries.size) return null
      const ruleIds = [...new Set([...entries.values()].map(e => e.ruleId))]
      return { ruleIds, keys: [...entries.keys()] }
    },
    write(instance, key, value) {
      const entry = instance ? stuck.get(instance)?.get(key) : undefined
      if (!entry) return false
      writeEntry(instance, entry, key, value)
      return true
    },
    describe(instance) {
      return { component: nameOf(instance), path: ancestry(instance), host: location.host }
    }
  }

  Object.defineProperty(page, GLOBAL_KEY, { value: api, configurable: true })

  window.addEventListener('message', event => {
    const data = event.data
    if (event.source !== window || !data || data.type !== PROP_OVERRIDES_SYNC) return
    let applied = 0
    try {
      applied = sync(data.rules)
    } catch {
      /* never break the page */
    }
    if (data.requestId) {
      window.postMessage({ type: `${PROP_OVERRIDES_SYNC}_RESULT`, requestId: data.requestId, applied, __FROM_VUE_INSPECTOR__: true }, '*')
    }
  })

  rules = readMirror()
  if (rules.length) hookSetters()

  return api
}
