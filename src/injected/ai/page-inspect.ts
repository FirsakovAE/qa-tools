/**
 * Live page for the AI assistant: UI elements with their state (disabled, hidden, covered),
 * the Vue component that renders them, its current props / state, the code of the event
 * handlers, and the current state of Pinia / Vuex stores.
 *
 * Values are plain-JSON and size-limited here; masking and the access scopes are applied in the UI.
 * Strings from the injected bundle must stay ASCII: the page may decode the script as Latin-1.
 */

import { findVueRoots } from '../props/vue-detect'
import { componentName } from '../logs/component-utils'
import { getPiniaInstance, updatePiniaContext } from '../pinia/context'
import { getStoreStateKeys, getGetterKeys, getActionKeys } from '../pinia/store-meta'

const MAX_MATCHES = 6
const MAX_CANDIDATES = 4000
const TEXT_CHARS = 160
const CODE_CHARS = 900
const RELATED_CODE = 4
const OWNER_CHAIN = 5
const LISTENER_LEVELS = 4
const MAX_INSTANCES = 20000
const MAX_HINTS = 8
const MAX_HINT_CANDIDATES = 15
const MAX_CHILDREN = 25

const VALUE_DEPTH = 5
const VALUE_KEYS = 40
const VALUE_ITEMS = 15
const VALUE_STRING = 300
const VALUE_NODES = 1500

const INTERACTIVE = 'button, a[href], input, select, textarea, summary, label, [role="button"], [role="link"], [role="menuitem"], [role="tab"], [role="checkbox"], [role="switch"], [role="option"], [role="radio"], [contenteditable="true"], [tabindex]:not([tabindex="-1"])'
const OWN_UI = '[id^="vue-inspector-"]'
const ATTRS = ['id', 'name', 'type', 'role', 'href', 'title', 'placeholder', 'aria-label', 'aria-disabled', 'aria-hidden', 'aria-busy', 'aria-expanded', 'aria-checked', 'readonly', 'required', 'disabled', 'inert', 'tabindex']
const STATE_CLASS = /disabled|inactive|hidden|loading|locked|blocked|readonly|invisible/i

type VueVersion = 2 | 3

// ---------------------------------------------------------------- values

interface PlainContext {
  nodes: number
  seen: WeakSet<object>
}

function shortText(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}... [${text.length - max} chars cut]` : text
}

function isVueInternal(obj: any): boolean {
  return obj.__v_isVNode === true || obj._isVue === true || (typeof obj.uid === 'number' && 'subTree' in obj && 'vnode' in obj) || (obj.$ && typeof obj.$ === 'object' && 'subTree' in obj.$)
}

/** Plain-JSON copy with refs / proxies unwrapped and every dimension limited */
function plain(value: unknown, ctx: PlainContext = { nodes: 0, seen: new WeakSet() }, depth = 0): unknown {
  if (++ctx.nodes > VALUE_NODES) return '[...]'
  switch (typeof value) {
    case 'string': return shortText(value, VALUE_STRING)
    case 'number': return Number.isFinite(value) ? value : String(value)
    case 'boolean': return value
    case 'undefined': return '[undefined]'
    case 'bigint': return `${value}n`
    case 'symbol': return value.toString()
    case 'function': return `[Function ${(value as { name?: string }).name || 'anonymous'}]`
  }
  if (value === null) return null
  let obj = value as any
  try {
    if (obj.__v_isRef === true) return plain('_rawValue' in obj ? obj._rawValue : obj._value, ctx, depth)
    if (obj.__v_raw && obj.__v_raw !== obj) obj = obj.__v_raw
    if (typeof obj.nodeType === 'number') return `[DOM ${String(obj.nodeName ?? 'node')}]`
    if (obj === window) return '[Window]'
    if (isVueInternal(obj)) return '[Vue component]'
    if (obj instanceof Date) return Number.isNaN(obj.getTime()) ? 'Invalid Date' : obj.toISOString()
    if (obj instanceof RegExp) return String(obj)
    if (obj instanceof Error) return `${obj.name}: ${obj.message}`
    if (obj instanceof Promise) return '[Promise]'
  } catch {
    return '[Unreadable]'
  }
  if (ctx.seen.has(obj)) return '[Circular]'
  if (depth >= VALUE_DEPTH) return Array.isArray(obj) ? `[Array(${obj.length})]` : '[Object]'
  ctx.seen.add(obj)
  try {
    if (obj instanceof Map) obj = Object.fromEntries(Array.from(obj.entries()).map(([k, v]) => [String(k), v]))
    else if (obj instanceof Set) obj = Array.from(obj)
    if (Array.isArray(obj)) {
      const out = obj.slice(0, VALUE_ITEMS).map((item: unknown) => plain(item, ctx, depth + 1))
      if (obj.length > VALUE_ITEMS) out.push(`[+${obj.length - VALUE_ITEMS} more, ${obj.length} items]`)
      return out
    }
    const keys = Object.keys(obj)
    const out: Record<string, unknown> = {}
    for (const key of keys.slice(0, VALUE_KEYS)) {
      let child: unknown
      try {
        child = obj[key]
      } catch {
        child = '[Unreadable]'
      }
      out[key] = plain(child, ctx, depth + 1)
    }
    if (keys.length > VALUE_KEYS) out['[more keys]'] = keys.length - VALUE_KEYS
    return out
  } catch {
    return '[Unreadable]'
  } finally {
    ctx.seen.delete(obj)
  }
}

function code(fn: unknown): string {
  try {
    return shortText(Function.prototype.toString.call(fn).replace(/\s+/g, ' ').trim(), CODE_CHARS)
  } catch {
    return '[code unavailable]'
  }
}

// ---------------------------------------------------------------- elements

function ownUi(el: Element): boolean {
  return !!el.closest(OWN_UI)
}

function label(el: Element): string {
  const h = el as HTMLElement & { value?: unknown }
  const parts = [
    el.getAttribute('aria-label'),
    el.getAttribute('title'),
    el.getAttribute('placeholder'),
    el.getAttribute('alt'),
    el.getAttribute('data-test-id') ?? el.getAttribute('data-testid') ?? el.getAttribute('data-test') ?? el.getAttribute('data-qa'),
    el instanceof HTMLInputElement && /^(button|submit|reset)$/i.test(el.type) ? String(h.value ?? '') : '',
    el.textContent,
  ]
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
}

function describeEl(el: Element): string {
  const id = el.id ? `#${el.id}` : ''
  const cls = typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 4).join('.')}` : ''
  const text = ((el as HTMLElement).innerText ?? el.textContent ?? '').replace(/\s+/g, ' ').trim()
  return `<${el.tagName.toLowerCase()}${id}${cls}>${text ? ` "${shortText(text, 60)}"` : ''}`
}

/** Innermost elements whose label contains the text, moved up to the control they belong to */
function findByText(text: string): Element[] {
  const needle = text.toLowerCase().replace(/\s+/g, ' ').trim()
  const all = Array.from(document.body?.querySelectorAll('*') ?? []).slice(0, MAX_CANDIDATES * 5)
  const hits = new Set<Element>()
  for (const el of all) {
    if (el instanceof HTMLScriptElement || el instanceof HTMLStyleElement || ownUi(el)) continue
    if (!label(el).toLowerCase().includes(needle)) continue
    hits.add(el)
    if (hits.size > MAX_CANDIDATES) break
  }
  const innermost = Array.from(hits).filter(el => !Array.from(el.children).some(child => hits.has(child)))
  const controls: Element[] = []
  for (const el of innermost) {
    const control = el.closest(INTERACTIVE) ?? el
    if (!controls.includes(control)) controls.push(control)
  }
  // Controls first: a label in a button matters more than the same text in a heading
  return controls.sort((a, b) => Number(!b.matches(INTERACTIVE)) - Number(!a.matches(INTERACTIVE)))
}

function findBySelector(selector: string): Element[] | string {
  try {
    return Array.from(document.querySelectorAll(selector)).filter(el => !ownUi(el))
  } catch (e) {
    return `Invalid selector: ${String((e as Error)?.message || e)}`
  }
}

function attributes(el: Element): Record<string, string> {
  const out: Record<string, string> = {}
  for (const name of ATTRS) {
    const value = el.getAttribute(name)
    if (value !== null) out[name] = shortText(value, 120)
  }
  for (const attr of Array.from(el.attributes)) {
    if (/^data-/.test(attr.name) && !attr.name.startsWith('data-v-') && attr.name !== 'data-vue-inspector-uid') out[attr.name] = shortText(attr.value, 120)
  }
  const cls = typeof el.className === 'string' ? el.className.trim() : ''
  if (cls) out.class = shortText(cls, 200)
  return out
}

/** Why the element cannot be used or seen right now */
function blockers(el: Element): string[] {
  const out: string[] = []
  const h = el as HTMLElement
  const style = getComputedStyle(el)
  if (!el.isConnected) out.push('detached from the document')
  if ((h as HTMLButtonElement).disabled === true) out.push('disabled property is true')
  else if (el.matches(':disabled')) out.push('disabled by an ancestor <fieldset disabled>')
  const ariaDisabled = el.closest('[aria-disabled="true"]')
  if (ariaDisabled) out.push(ariaDisabled === el ? 'aria-disabled="true"' : `aria-disabled="true" on ancestor ${describeEl(ariaDisabled)}`)
  const inert = el.closest('[inert]')
  if (inert) out.push(inert === el ? 'inert' : `inert ancestor ${describeEl(inert)}`)
  if ((h as HTMLInputElement).readOnly === true) out.push('readonly')
  if (style.pointerEvents === 'none') {
    let source: Element = el
    for (let p = el.parentElement; p && getComputedStyle(p).pointerEvents === 'none'; p = p.parentElement) source = p
    out.push(source === el ? 'pointer-events: none' : `pointer-events: none from ancestor ${describeEl(source)}`)
  }
  const cls = typeof el.className === 'string' ? el.className.split(/\s+/).filter(c => STATE_CLASS.test(c)) : []
  if (cls.length) out.push(`state classes: ${cls.join(' ')}`)

  let hidden: Element | null = null
  for (let p: Element | null = el; p && p !== document.documentElement; p = p.parentElement) {
    const s = getComputedStyle(p)
    if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse' || Number(s.opacity) === 0 || s.contentVisibility === 'hidden') {
      hidden = p
      const why = s.display === 'none' ? 'display: none' : s.opacity === '0' ? 'opacity: 0' : `visibility: ${s.visibility}`
      out.push(p === el ? `hidden: ${why} (v-show sets display: none)` : `hidden: ${why} on ancestor ${describeEl(p)}`)
      break
    }
  }
  const rect = el.getBoundingClientRect()
  if (!hidden && (rect.width === 0 || rect.height === 0)) out.push('zero size')
  if (!hidden && rect.width > 0 && rect.height > 0) {
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) {
      out.push('outside the viewport (scroll to see it)')
    } else {
      const top = document.elementFromPoint(x, y)
      if (top && top !== el && !el.contains(top) && !top.contains(el) && !ownUi(top)) out.push(`covered by ${describeEl(top)}`)
    }
  }
  return out
}

// ---------------------------------------------------------------- Vue

interface Owner {
  version: VueVersion
  instance: any
}

function vue3Roots(): any[] {
  const out: any[] = []
  for (const el of findVueRoots() as any[]) {
    const app = el.__vue_app__
    const root = app?._instance ?? app?._container?._vnode?.component ?? el._vnode?.component
    if (root && !out.includes(root)) out.push(root)
  }
  return out
}

/** DOM elements a Vue 3 component rendered at its top level (fragments have several) */
function topElements(instance: any): Element[] {
  const out: Element[] = []
  const stack = [instance.subTree]
  let guard = 0
  while (stack.length && guard++ < 200) {
    const vnode = stack.pop()
    if (!vnode) continue
    if (vnode.el instanceof Element) {
      out.push(vnode.el)
      continue
    }
    if (vnode.component?.subTree) stack.push(vnode.component.subTree)
    else if (Array.isArray(vnode.children)) for (const child of vnode.children) if (child && typeof child === 'object') stack.push(child)
  }
  return out
}

/** Components rendered directly by a Vue 3 component */
function vue3Children(instance: any): any[] {
  const out: any[] = []
  const vnodes = [instance.subTree]
  while (vnodes.length) {
    const vnode = vnodes.pop()
    if (!vnode || typeof vnode !== 'object') continue
    if (vnode.component) {
      out.push(vnode.component)
      continue
    }
    if (vnode.suspense?.activeBranch) vnodes.push(vnode.suspense.activeBranch)
    if (Array.isArray(vnode.children)) for (const child of vnode.children) vnodes.push(child)
  }
  return out
}

/** Deepest component whose rendered elements contain `el`; works without devtools hooks */
function vue3OwnerByTree(el: Element): any {
  let best: any = null
  let bestDepth = -1
  const stack: Array<{ instance: any; depth: number }> = vue3Roots().map(instance => ({ instance, depth: 0 }))
  let visited = 0
  while (stack.length && visited++ < MAX_INSTANCES) {
    const { instance, depth } = stack.pop()!
    if (!topElements(instance).some(top => top === el || top.contains(el))) continue
    if (depth > bestDepth) {
      best = instance
      bestDepth = depth
    }
    for (const child of vue3Children(instance)) stack.push({ instance: child, depth: depth + 1 })
  }
  return best
}

/** Every mounted component of the page, parents first */
function allInstances(): Owner[] {
  const out: Owner[] = []
  const stack: Owner[] = vue3Roots().map(instance => ({ version: 3 as const, instance }))
  for (const el of findVueRoots() as any[]) {
    if (!el.__vue_app__ && el.__vue__) stack.push({ version: 2, instance: el.__vue__.$root ?? el.__vue__ })
  }
  const seen = new Set<any>()
  while (stack.length && out.length < MAX_INSTANCES) {
    const owner = stack.shift()!
    if (seen.has(owner.instance)) continue
    seen.add(owner.instance)
    out.push(owner)
    const children = owner.version === 3 ? vue3Children(owner.instance) : owner.instance.$children ?? []
    for (const child of children) stack.push({ version: owner.version, instance: child })
  }
  return out
}

function normalName(name: string): string {
  return name.toLowerCase().replace(/\.vue$/, '').replace(/[^a-z0-9]/g, '')
}

/** `agreement-cars-CccydAut.js` -> `agreement-cars`: a chunk is named after its component plus a build hash */
function withoutBuildHash(file: string): string {
  const base = file.replace(/\?.*$/, '').replace(/\.(m?js|cjs|vue)$/i, '')
  const m = /^(.+)[-.]([A-Za-z0-9_-]{8})$/.exec(base)
  return m && !/^[a-z]+$/.test(m[2]) ? m[1] : base
}

/** Mounted components by name, file path or chunk name (case, dashes, `.vue` and build hashes ignored) */
function findComponents(query: string): Owner[] {
  const wanted = normalName(withoutBuildHash(query.split(/[\\/]/).pop() ?? query))
  if (!wanted) return []
  const exact: Owner[] = []
  const partial: Owner[] = []
  for (const owner of allInstances()) {
    const name = normalName(componentName(owner.instance, owner.version))
    const file = normalName((fileOf(owner) ?? '').split(/[\\/]/).pop() ?? '')
    if (name === wanted || file === wanted) exact.push(owner)
    else if (name.includes(wanted) || (file && file.includes(wanted))) partial.push(owner)
  }
  return exact.length ? exact : partial
}

function ownerOf(el: Element): Owner | null {
  for (let p: any = el; p; p = p.parentElement) {
    if (p.__vueParentComponent) return { version: 3, instance: p.__vueParentComponent }
    if (p.__vue__) return { version: 2, instance: p.__vue__ }
  }
  const instance = vue3OwnerByTree(el)
  return instance ? { version: 3, instance } : null
}

function parentOf(owner: Owner): any {
  return owner.version === 3 ? owner.instance.parent : owner.instance.$parent
}

function fileOf(owner: Owner): string | undefined {
  const file = owner.version === 3 ? owner.instance.type?.__file : owner.instance.$options?.__file
  return typeof file === 'string' ? file : undefined
}

function ownerChain(owner: Owner): string[] {
  const out: string[] = []
  for (let instance = owner.instance; instance && out.length < OWNER_CHAIN; instance = parentOf({ version: owner.version, instance })) {
    const file = fileOf({ version: owner.version, instance })
    out.push(`${componentName(instance, owner.version)}${file ? ` (${file})` : ''}`)
  }
  return out
}

function readKeys(source: any, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of keys) {
    try {
      out[key] = source[key]
    } catch (e) {
      out[key] = `[Error: ${String((e as Error)?.message || e)}]`
    }
  }
  return out
}

/** Current values of a component: props, local state, computed; functions are listed as methods */
function componentState(owner: Owner): { values: Record<string, unknown>; methods: Record<string, unknown>; note?: string } {
  const { instance } = owner
  const values: Record<string, unknown> = {}
  const methods: Record<string, unknown> = {}
  const split = (group: string, source: Record<string, unknown> | undefined) => {
    if (!source || typeof source !== 'object') return
    const data: Record<string, unknown> = {}
    for (const key of Object.keys(source)) {
      if (key.startsWith('__')) continue
      let value: unknown
      try {
        value = source[key]
      } catch {
        value = '[Unreadable]'
      }
      if (typeof value === 'function') methods[key] = value
      else data[key] = value
    }
    if (Object.keys(data).length) values[group] = plain(data)
  }
  if (owner.version === 3) {
    split('props', instance.props)
    split('setup', instance.setupState)
    split('data', instance.data)
    const computed = instance.type?.computed
    if (computed && instance.proxy) split('computed', readKeys(instance.proxy, Object.keys(computed)))
    for (const [key, fn] of Object.entries(instance.type?.methods ?? {})) methods[key] = fn
    const attrs = instance.attrs && Object.keys(instance.attrs).length ? instance.attrs : null
    if (attrs) split('attrs', attrs)
    const empty = !instance.setupState || !Object.keys(instance.setupState).length
    const note = empty && instance.type?.setup && !instance.type?.computed
      ? 'Local state of <script setup> is kept in closures in production builds and cannot be read here: read the component code and the stores it uses.'
      : undefined
    return { values, methods, note }
  }
  split('props', instance.$props)
  split('data', instance.$data)
  const computed = instance.$options?.computed
  if (computed) split('computed', readKeys(instance, Object.keys(computed)))
  for (const [key, fn] of Object.entries(instance.$options?.methods ?? {})) methods[key] = fn
  return { values, methods }
}

// ---------------------------------------------------------------- render dependencies

/** A reactive key read by a getter or the render; the value is known for props of the component */
export interface ReactiveRead {
  key: string
  prop: boolean
  value?: unknown
}

export interface RenderDependency {
  /** Name when known: setup binding, store getter */
  name?: string
  value: unknown
  code: string
  reads: ReactiveRead[]
  /** Computeds this one reads */
  uses: RenderDependency[]
}

export interface RenderDependencies {
  computed: RenderDependency[]
  /** Reactive keys the render reads directly (props, state fields) */
  reads: ReactiveRead[]
}

const DEP_COMPUTEDS = 25
const DEP_READS = 40
const DEP_DEPTH = 3
const DEP_CODE_CHARS = 500

/** Deps of a subscriber: a linked list since Vue 3.5, an array of Map deps in 3.4 */
function depsOf(sub: any): any[] {
  const out: any[] = []
  if (!sub) return out
  if (Array.isArray(sub.deps)) return sub.deps.slice(0, 200)
  for (let link = sub.deps; link && out.length < 200; link = link.nextDep) if (link.dep) out.push(link.dep)
  return out
}

function rawOf(value: any): any {
  return value && typeof value === 'object' && value.__v_raw ? value.__v_raw : value
}

/** Names of computed refs: setup bindings of the component and getters of the Pinia stores */
function computedNames(owner: Owner): Map<any, string> {
  const names = new Map<any, string>()
  const add = (source: any, prefix: string) => {
    const raw = rawOf(source)
    if (!raw || typeof raw !== 'object') return
    for (const key of Object.keys(raw)) {
      try {
        const value = raw[key]
        if (value && typeof value === 'object' && value.__v_isRef && !names.has(value)) names.set(value, `${prefix}${key}`)
      } catch { /* getter threw */ }
    }
  }
  add(owner.instance.setupState, '')
  const pinia = getPiniaInstance()
  const stores: Map<string, any> | null = pinia?._s instanceof Map ? pinia._s : null
  stores?.forEach((store, id) => add(store, `store ${id}.`))
  return names
}

function readKey(dep: any, props: Record<string, unknown> | undefined): ReactiveRead | null {
  const key = dep?.key
  if (typeof key !== 'string' || !key || key.startsWith('__v_')) return null
  if (props && Object.prototype.hasOwnProperty.call(props, key)) {
    let value: unknown
    try {
      value = props[key]
    } catch {
      value = '[Unreadable]'
    }
    return { key, prop: true, value: plain(value) }
  }
  return { key, prop: false }
}

function addRead(list: ReactiveRead[], read: ReactiveRead | null): void {
  if (read && list.length < DEP_READS && !list.some(r => r.key === read.key && r.prop === read.prop)) list.push(read)
}

function describeComputed(computed: any, props: any, names: Map<any, string>, depth: number, budget: { left: number }): RenderDependency {
  const sub = computed.effect ?? computed
  const getter = typeof computed.fn === 'function' ? computed.fn : typeof computed.getter === 'function' ? computed.getter : sub?.fn
  const reads: ReactiveRead[] = []
  const uses: RenderDependency[] = []
  for (const dep of depsOf(sub)) {
    if (dep.computed && dep.computed !== computed) {
      if (depth < DEP_DEPTH && budget.left-- > 0) uses.push(describeComputed(dep.computed, props, names, depth + 1, budget))
      continue
    }
    addRead(reads, readKey(dep, props))
  }
  return {
    name: names.get(computed),
    value: plain(computed._value),
    code: getter ? shortText(code(getter), DEP_CODE_CHARS) : '[code unavailable]',
    reads,
    uses,
  }
}

/** What the component template reads now: the computeds with their code and values, and the keys */
function renderDependencies(owner: Owner): RenderDependencies | null {
  if (owner.version !== 3) return null
  const { instance } = owner
  const names = computedNames(owner)
  const budget = { left: DEP_COMPUTEDS }
  const computed: RenderDependency[] = []
  const reads: ReactiveRead[] = []
  const deps = depsOf(instance.effect)
  if (deps.some(dep => dep && (dep.computed || dep.key !== undefined))) {
    for (const dep of deps) {
      if (dep.computed) {
        if (budget.left-- > 0) computed.push(describeComputed(dep.computed, instance.props, names, 1, budget))
        continue
      }
      addRead(reads, readKey(dep, instance.props))
    }
  } else {
    // Vue <= 3.3: deps do not point to computeds; the component scope lists them
    for (const effect of instance.scope?.effects ?? []) {
      if (effect?.computed && budget.left-- > 0) computed.push(describeComputed(effect.computed, instance.props, names, 1, budget))
    }
  }
  return computed.length || reads.length ? { computed, reads } : null
}

// ---------------------------------------------------------------- prop origins

const ORIGIN_PROPS = 25
const ORIGIN_LEVELS = 8
const BINDING_CHARS = 300
const PATH_DEPTH = 6
const PATH_NODES = 4000
const PATHS_PER_KEY = 4
const SHORT_RENDER = 1500

/** Where the current value of a prop comes from */
export interface PropOrigin {
  prop: string
  value: unknown
  /** Components that pass it on unchanged (async wrappers, v-bind="$attrs" / "$props"), nearest first */
  through: string[]
  /** The component whose render sets it */
  from?: string
  /** Bindings of the key in the render code of `from`: `showButton: n.value && !o.viewOnly` */
  bindings: string[]
  /** No binding by name (props passed as an object): where the key is in the state of `from` or in a store */
  found: Array<{ path: string; value: unknown }>
  /** No binding by name and a short render of `from`: its code shows the object it passes */
  render?: string
}

function describeInstance(instance: any): string {
  const file = fileOf({ version: 3, instance })
  return `${componentName(instance, 3)}${file ? ` (${file})` : ''}`
}

function kebab(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

function hasKey(source: any, key: string): boolean {
  try {
    return !!source && typeof source === 'object' && (Object.prototype.hasOwnProperty.call(source, key) || Object.prototype.hasOwnProperty.call(source, kebab(key)))
  } catch {
    return false
  }
}

function renderCode(instance: any): string {
  const fn = instance.render ?? instance.type?.render
  if (typeof fn !== 'function') return ''
  try {
    return Function.prototype.toString.call(fn)
  } catch {
    return ''
  }
}

/** The expression after `key:` up to the next `,` / `}` / `)` outside brackets and strings */
function expressionAt(text: string, from: number): string {
  let depth = 0
  let quote = ''
  let i = from
  for (; i < text.length && i - from < BINDING_CHARS; i++) {
    const c = text[i]
    if (quote) {
      if (c === '\\') i++
      else if (c === quote) quote = ''
      continue
    }
    if (c === '"' || c === "'" || c === '`') quote = c
    else if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') {
      if (!depth) break
      depth--
    } else if (c === ',' && !depth) break
  }
  const expr = text.slice(from, i).trim()
  return i - from >= BINDING_CHARS ? `${expr}...` : expr
}

/** `key: expression` in the props objects of a render function, also as "kebab-key" */
function bindingsIn(code: string, key: string): string[] {
  if (!code) return []
  const names = [key, kebab(key)].map(n => n.replace(/[$]/g, '\\$'))
  const re = new RegExp(`(?:^|[{,(\\s])(["']?)(${Array.from(new Set(names)).join('|')})\\1\\s*:`, 'g')
  const out: string[] = []
  for (const m of code.matchAll(re)) {
    const expr = expressionAt(code, m.index! + m[0].length)
    // A props declaration (`key: Boolean`, `key: { type: ... }`) is not a binding
    if (!expr || /^\{\s*type\s*:|^(Boolean|String|Number|Object|Array|Function)\b|^null$/.test(expr)) continue
    const binding = `${m[2]}: ${expr}`
    if (!out.includes(binding)) out.push(binding)
    if (out.length >= 3) break
  }
  return out
}

function unref(value: any): any {
  try {
    if (value && typeof value === 'object' && value.__v_isRef === true) return '_rawValue' in value ? value._rawValue : value._value
  } catch { /* getter threw */ }
  return value
}

/** Paths of the keys in reactive state, breadth-first: `props.node.props.showButton` */
function pathsOf(roots: Array<[string, any]>, keys: Set<string>): Map<string, PropOrigin['found']> {
  const out = new Map<string, PropOrigin['found']>()
  const wanted = new Map<string, string>()
  for (const key of keys) {
    wanted.set(key, key)
    wanted.set(kebab(key), key)
  }
  const seen = new WeakSet<object>()
  const queue: Array<{ path: string; value: any; depth: number }> = roots.map(([path, value]) => ({ path, value, depth: 0 }))
  let nodes = 0
  while (queue.length && nodes++ < PATH_NODES) {
    const { path, value, depth } = queue.shift()!
    let obj = unref(value)
    if (!obj || typeof obj !== 'object') continue
    try {
      if (obj.__v_raw && obj.__v_raw !== obj) obj = obj.__v_raw
      if (typeof obj.nodeType === 'number' || obj === window || isVueInternal(obj) || seen.has(obj)) continue
    } catch {
      continue
    }
    seen.add(obj)
    let entries: Array<[string, any]>
    try {
      entries = obj instanceof Map ? Array.from(obj.entries()).map(([k, v]) => [String(k), v])
        : Array.isArray(obj) ? obj.slice(0, 20).map((v, i) => [String(i), v])
        : Object.keys(obj).slice(0, 200).map(k => [k, obj[k]])
    } catch {
      continue
    }
    for (const [k, v] of entries) {
      const childPath = Array.isArray(obj) ? `${path}[${k}]` : `${path}.${k}`
      const key = wanted.get(k)
      if (key && typeof v !== 'function') {
        const list = out.get(key) ?? []
        if (list.length < PATHS_PER_KEY) list.push({ path: childPath, value: plain(unref(v)) })
        out.set(key, list)
      }
      if (depth + 1 < PATH_DEPTH && v && typeof v === 'object') queue.push({ path: childPath, value: v, depth: depth + 1 })
    }
  }
  return out
}

function stateRoots(instance: any): Array<[string, any]> {
  const roots: Array<[string, any]> = []
  if (instance.props) roots.push(['props', instance.props])
  if (instance.setupState && Object.keys(instance.setupState).length) roots.push(['setup', instance.setupState])
  if (instance.data && Object.keys(instance.data).length) roots.push(['data', instance.data])
  if (instance.provides && instance.provides !== instance.parent?.provides) roots.push(['provide', instance.provides])
  return roots
}

function storeRoots(): Array<[string, any]> {
  const pinia = getPiniaInstance()
  const stores: Map<string, any> | null = pinia?._s instanceof Map ? pinia._s : null
  const roots: Array<[string, any]> = []
  stores?.forEach((store, id) => roots.push([`store ${id}`, store.$state]))
  const vuex = vuexStore()
  if (vuex?.state) roots.push(['vuex state', vuex.state])
  return roots
}

/**
 * For each prop: up the render owners (`vnode.ctx`: the component whose render created the vnode,
 * also for slot content) while the value is only passed on, then the binding in the render code
 * of the component that sets it, or where the key is in its state or in a store.
 */
function propOrigins(owner: Owner): PropOrigin[] {
  if (owner.version !== 3 || !owner.instance.props) return []
  const keys = Object.keys(owner.instance.props).slice(0, ORIGIN_PROPS)
  const codes = new Map<any, string>()
  const codeOf = (instance: any) => {
    if (!codes.has(instance)) codes.set(instance, renderCode(instance))
    return codes.get(instance)!
  }
  const origins: PropOrigin[] = []
  /** Components that set props without a binding by name, with those origins */
  const unbound = new Map<any, PropOrigin[]>()
  for (const key of keys) {
    let value: unknown
    try {
      value = owner.instance.props[key]
    } catch {
      value = '[Unreadable]'
    }
    const origin: PropOrigin = { prop: key, value: plain(value), through: [], bindings: [], found: [] }
    const sameKey = new RegExp(`:\\s*(?:[\\w$]+\\.)*(?:${key.replace(/[$]/g, '\\$')})$`)
    let current = owner.instance
    for (let level = 0; level < ORIGIN_LEVELS; level++) {
      const parent = current.vnode?.ctx ?? current.parent
      if (!parent || parent === current) break
      const bindings = bindingsIn(codeOf(parent), key)
      // `key: e.key` in a component that has the same prop or attr passes it on too
      const passed = hasKey(parent.props, key) || hasKey(parent.attrs, key)
      if (passed && bindings.every(b => sameKey.test(b))) {
        origin.through.push(describeInstance(parent))
        current = parent
        continue
      }
      origin.from = describeInstance(parent)
      origin.bindings = bindings
      if (!bindings.length) unbound.set(parent, [...(unbound.get(parent) ?? []), origin])
      break
    }
    origins.push(origin)
  }
  // Props passed as an object (`h(Comp, node.props)`, `v-bind="config"`): the keys in its state, then in the stores
  let stores: Array<[string, any]> | null = null
  for (const [parent, list] of unbound) {
    const keysOf = new Set(list.map(o => o.prop))
    const inState = pathsOf(stateRoots(parent), keysOf)
    const rest = new Set(Array.from(keysOf).filter(k => !inState.has(k)))
    if (rest.size) stores ??= storeRoots()
    const inStores = rest.size && stores?.length ? pathsOf(stores, rest) : new Map<string, PropOrigin['found']>()
    const render = codeOf(parent).replace(/\s+/g, ' ').trim()
    for (const origin of list) {
      origin.found = inState.get(origin.prop) ?? inStores.get(origin.prop) ?? []
      if (render && render.length <= SHORT_RENDER) origin.render = render
    }
  }
  return origins
}

interface Listener {
  on: string
  event: string
  code: string
}

/** Vue 3 event invokers: `_vei`, a symbol since Vue 3.4 */
function invokers(el: any): Record<string, any> | null {
  if (el._vei && typeof el._vei === 'object') return el._vei
  const key = Object.getOwnPropertySymbols(el).find(s => s.description === '_vei')
  return key ? el[key] : null
}

/** Vue 3 event handlers on the element and its nearest ancestors */
function listeners(el: Element): Listener[] {
  const out: Listener[] = []
  let level = 0
  for (let p: any = el; p && level < LISTENER_LEVELS; p = p.parentElement, level++) {
    const vei = invokers(p)
    if (!vei || typeof vei !== 'object') continue
    for (const [key, invoker] of Object.entries<any>(vei)) {
      const value = invoker?.value
      if (!value) continue
      const fns = Array.isArray(value) ? value : [value]
      for (const fn of fns) out.push({ on: p === el ? 'element' : `ancestor ${describeEl(p)}`, event: key.replace(/^on/, '').toLowerCase(), code: code(fn) })
    }
  }
  return out
}

/** Component methods the handler code names: the logic behind the click often lives there */
function relatedCode(handlers: Listener[], methods: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  const shown = new Set(handlers.map(h => h.code))
  const text = Array.from(shown).join('\n')
  for (const [name, fn] of Object.entries(methods)) {
    if (Object.keys(out).length >= RELATED_CODE) break
    const body = code(fn)
    if (!shown.has(body) && new RegExp(`(^|[^\\w$])${name.replace(/\$/g, '\\$')}([^\\w$]|$)`).test(text)) out[name] = body
  }
  return out
}

// ---------------------------------------------------------------- inspect

export interface InspectedElement {
  element: string
  text: string
  attributes: Record<string, string>
  blockers: string[]
  listeners: Listener[]
  component?: {
    chain: string[]
    state: unknown
    methods: string[]
    related: Record<string, string>
    note?: string
    render?: RenderDependencies | null
    /** Components it renders now: the control may be in one of them */
    children?: string[]
    origins?: PropOrigin[]
  }
}

export interface InspectHint {
  element: string
  text: string
  blockers: string[]
  chain: string[]
}

export interface InspectResult {
  page: string
  total: number
  matches: InspectedElement[]
  /** No match: elements with words of the text (a notice often explains why a control is missing) */
  hints?: InspectHint[]
  error?: string
}

function inspectElement(el: Element, withState: boolean): InspectedElement {
  const handlers = listeners(el)
  const result: InspectedElement = {
    element: describeEl(el),
    text: shortText(((el as HTMLElement).innerText ?? el.textContent ?? '').replace(/\s+/g, ' ').trim(), TEXT_CHARS),
    attributes: attributes(el),
    blockers: blockers(el),
    listeners: handlers,
  }
  const owner = ownerOf(el)
  if (owner) {
    const state = withState ? componentState(owner) : { values: {}, methods: {} }
    result.component = {
      chain: ownerChain(owner),
      state: state.values,
      methods: Object.keys(state.methods).slice(0, 60),
      related: relatedCode(handlers, state.methods),
      note: state.note,
      render: withState ? renderDependencies(owner) : undefined,
      origins: withState ? propOrigins(owner) : undefined,
    }
  }
  return result
}

/** A component with what it renders now: an empty render (comment) means its own v-if is false */
function inspectComponent(owner: Owner): InspectedElement {
  const tops = owner.version === 3 ? topElements(owner.instance) : owner.instance.$el instanceof Element ? [owner.instance.$el] : []
  const state = componentState(owner)
  const first = tops[0]
  return {
    element: first ? describeEl(first) : '(renders no element now)',
    text: first ? shortText(((first as HTMLElement).innerText ?? first.textContent ?? '').replace(/\s+/g, ' ').trim(), TEXT_CHARS) : '',
    attributes: first ? attributes(first) : {},
    blockers: first ? blockers(first) : [],
    listeners: [],
    component: {
      chain: ownerChain(owner),
      state: state.values,
      methods: Object.keys(state.methods).slice(0, 60),
      related: {},
      note: state.note,
      render: renderDependencies(owner),
      children: childNames(owner),
      origins: propOrigins(owner),
    },
  }
}

function childNames(owner: Owner): string[] {
  const children: any[] = owner.version === 3 ? vue3Children(owner.instance) : owner.instance.$children ?? []
  const names = children.map(instance => {
    const file = fileOf({ version: owner.version, instance })
    return `${componentName(instance, owner.version)}${file ? ` (${file})` : ''}`
  })
  const counts = new Map<string, number>()
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1)
  return Array.from(counts, ([name, n]) => (n > 1 ? `${name} x${n}` : name)).slice(0, MAX_CHILDREN)
}

/** Word stems of the text: "Soglasovat s ROP" also finds "dlya soglasovaniya s ROP neobhodimo..." */
function stems(text: string): string[] {
  const words = text.match(/[\p{L}\p{N}]{3,}/gu) ?? []
  return Array.from(new Set(words.map(w => (w.length > 5 ? w.slice(0, w.length - 3) : w).toLowerCase()))).slice(0, 5)
}

/** Elements with the most words of the text first, visible before hidden ones */
function hintsFor(text: string): InspectHint[] {
  const words = stems(text)
  const candidates: Array<{ el: Element; score: number; length: number; blockers: string[] }> = []
  for (const stem of words) {
    for (const el of findByText(stem).slice(0, MAX_HINT_CANDIDATES)) {
      if (candidates.some(c => c.el === el || c.el.contains(el) || el.contains(c.el))) continue
      const lower = label(el).toLowerCase()
      const found = blockers(el)
      const hidden = found.some(b => b.startsWith('hidden') || b === 'zero size' || b === 'detached from the document')
      candidates.push({ el, blockers: found, length: Math.min(lower.length, 300), score: words.filter(w => lower.includes(w)).length + (hidden ? 0 : 0.5) })
    }
  }
  // Equal scores: a sentence (a notice) says more than a badge or a menu item
  return candidates
    .sort((a, b) => b.score - a.score || b.length - a.length)
    .slice(0, MAX_HINTS)
    .map(({ el, blockers: found }) => {
      const owner = ownerOf(el)
      return {
        element: describeEl(el),
        text: shortText(((el as HTMLElement).innerText ?? el.textContent ?? '').replace(/\s+/g, ' ').trim(), 300),
        blockers: found,
        chain: owner ? ownerChain(owner) : [],
      }
    })
}

export function inspectUi(args: { text?: unknown; selector?: unknown; component?: unknown; limit?: unknown }): InspectResult {
  const page = location.href
  const text = typeof args.text === 'string' ? args.text.trim() : ''
  const selector = typeof args.selector === 'string' ? args.selector.trim() : ''
  const component = typeof args.component === 'string' ? args.component.trim() : ''
  const limit = Math.min(MAX_MATCHES, Math.max(1, Number(args.limit) || 3))
  if (component) {
    const owners = findComponents(component)
    return { page, total: owners.length, matches: owners.slice(0, limit).map(inspectComponent) }
  }
  if (!text && !selector) return { page, total: 0, matches: [], error: 'Pass text (a label, button text or message), a CSS selector or a component name.' }
  let found: Element[]
  if (selector) {
    const bySelector = findBySelector(selector)
    if (typeof bySelector === 'string') return { page, total: 0, matches: [], error: bySelector }
    found = text ? bySelector.filter(el => label(el).toLowerCase().includes(text.toLowerCase())) : bySelector
  } else {
    found = findByText(text)
  }
  if (!found.length) return { page, total: 0, matches: [], hints: text ? hintsFor(text) : undefined }
  // Component state is read for the first matches only: it is the heaviest part
  const matches = found.slice(0, limit).map((el, i) => inspectElement(el, i < 2))
  return { page, total: found.length, matches }
}

// ---------------------------------------------------------------- stores

export interface StoresResult {
  kind: 'pinia' | 'vuex' | 'none'
  stores: Array<{ id: string; state?: unknown; getters?: unknown; stateKeys?: string[]; getterKeys?: string[]; actionKeys?: string[] }>
  missing?: string[]
}

function vuexStore(): any {
  for (const el of findVueRoots() as any[]) {
    const store = el.__vue_app__?.config?.globalProperties?.$store ?? el.__vue__?.$store
    if (store?.state && store.getters !== undefined) return store
  }
  return null
}

export function readStores(args: { ids?: unknown }): StoresResult {
  const ids = Array.isArray(args.ids) ? args.ids.map(String).slice(0, 4) : typeof args.ids === 'string' ? [args.ids] : []
  let pinia = getPiniaInstance()
  if (!pinia) pinia = updatePiniaContext().pinia
  if (pinia?._s) {
    const map: Map<string, any> = pinia._s instanceof Map ? pinia._s : new Map(Object.entries(pinia._s))
    if (!ids.length) {
      return {
        kind: 'pinia',
        stores: Array.from(map.entries()).map(([id, store]) => ({
          id,
          stateKeys: getStoreStateKeys(store),
          getterKeys: getGetterKeys(store),
          actionKeys: getActionKeys(store),
        })),
      }
    }
    const stores: StoresResult['stores'] = []
    const missing: string[] = []
    for (const id of ids) {
      const store = map.get(id)
      if (!store) {
        missing.push(id)
        continue
      }
      stores.push({
        id,
        state: plain(readKeys(store, getStoreStateKeys(store))),
        getters: plain(readKeys(store, getGetterKeys(store))),
      })
    }
    return { kind: 'pinia', stores, missing: missing.length ? missing : undefined }
  }
  const vuex = vuexStore()
  if (vuex) {
    const getterKeys = Object.keys(vuex.getters ?? {})
    if (!ids.length) return { kind: 'vuex', stores: [{ id: 'root', stateKeys: Object.keys(vuex.state ?? {}), getterKeys }] }
    const wanted = ids.filter(id => id !== 'root')
    const state = wanted.length ? readKeys(vuex.state, wanted) : vuex.state
    const getters = readKeys(vuex.getters, wanted.length ? getterKeys.filter(k => wanted.some(id => k === id || k.startsWith(`${id}/`))) : getterKeys)
    return { kind: 'vuex', stores: [{ id: ids.join(', '), state: plain(state), getters: plain(getters) }] }
  }
  return { kind: 'none', stores: [] }
}
