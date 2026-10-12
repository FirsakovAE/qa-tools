/**
 * Emit tracker: logs component emits (Vue 3 and Vue 2).
 *
 * Vue 3: production `emit` is a bound function captured by the setup context, so it cannot
 * be patched. Instead, emit resolves the listener from `instance.vnode.props` on every call:
 * `instance.vnode` is turned into an accessor and listeners of declared emits are wrapped on
 * every vnode the parent passes in. Declared emit listeners are excluded from Vue's
 * child-update check, so wrapping them causes no extra renders. Emits nobody listens to
 * never reach a listener and are not logged.
 *
 * Vue 2: the instance `$emit` is patched (only emits with listeners are logged).
 */

import { serializeProps } from '../props/serialize'
import { componentName, componentUid, parentChain, type VueVersion } from './component-utils'
import { getSanitizer, isIgnored, isLogsPaused, recordLog } from './core'

const MAX_EMITS_PER_COMPONENT_PER_SEC = 30
const ARGS_PREVIEW_CHARS = 120

const hooked = new WeakSet<object>()
const ownFunctions = new WeakSet<Function>()
/** Per instance: listener key → original value and its wrapped replacement */
const wrapCache = new WeakMap<object, Map<string, { original: unknown; wrapped: unknown }>>()
const rate = new WeakMap<object, { start: number; count: number }>()

const hasOwn = (obj: object, key: string) => Object.prototype.hasOwnProperty.call(obj, key)
const isOn = (key: string) => key.length > 2 && key.charCodeAt(0) === 111 && key.charCodeAt(1) === 110 && !/[a-z]/.test(key[2])
const hyphenate = (s: string) => s.replace(/\B([A-Z])/g, '-$1').toLowerCase()
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

/** Declared emit name for a listener key (`onUpdate:modelValue` → `update:modelValue`), or null */
function declaredEmitName(emitsOptions: Record<string, unknown> | null | undefined, key: string): string | null {
  if (!emitsOptions || typeof emitsOptions !== 'object' || !isOn(key)) return null
  const raw = key.slice(2)
  const bases = raw.endsWith('Once') ? [raw, raw.slice(0, -4)] : [raw]
  for (const base of bases) {
    if (!base) continue
    for (const candidate of [lowerFirst(base), hyphenate(base), base]) {
      if (hasOwn(emitsOptions, candidate)) return candidate
    }
  }
  return null
}

function allowedByRate(instance: object): boolean {
  const now = Date.now()
  const r = rate.get(instance)
  if (!r || now - r.start > 1000) {
    rate.set(instance, { start: now, count: 1 })
    return true
  }
  r.count++
  return r.count <= MAX_EMITS_PER_COMPONENT_PER_SEC
}

function describeNode(node: any): string {
  if (!node || typeof node !== 'object') return String(node)
  if (node === window) return 'window'
  if (node === document) return 'document'
  const tag = typeof node.tagName === 'string' ? node.tagName.toLowerCase() : node.nodeName ?? 'node'
  const id = node.id ? `#${node.id}` : ''
  const cls = typeof node.className === 'string' && node.className.trim()
    ? '.' + node.className.trim().split(/\s+/).slice(0, 3).join('.')
    : ''
  return `${tag}${id}${cls}`
}

function serializeArg(value: unknown): unknown {
  try {
    if (typeof Event !== 'undefined' && value instanceof Event) {
      const e = value as any
      const out: Record<string, unknown> = {
        __event: e.constructor?.name ?? 'Event',
        type: e.type,
        target: describeNode(e.target),
      }
      if ('key' in e) out.key = e.key
      if ('clientX' in e) Object.assign(out, { clientX: e.clientX, clientY: e.clientY, button: e.button })
      if (e.target && 'value' in e.target && typeof e.target.value === 'string') out.targetValue = e.target.value
      return out
    }
    if (value && typeof value === 'object' && typeof (value as any).nodeType === 'number') {
      return `[DOM ${describeNode(value)}]`
    }
    return serializeProps(value)
  } catch {
    return '[Non-serializable]'
  }
}

function previewArgs(args: unknown[]): string {
  if (args.length === 0) return 'no arguments'
  let text: string
  try {
    text = args.map(a => (a === undefined ? 'undefined' : JSON.stringify(a))).join(', ')
  } catch {
    text = `${args.length} argument(s)`
  }
  return text.length > ARGS_PREVIEW_CHARS ? `${text.slice(0, ARGS_PREVIEW_CHARS)}...` : text
}

function logEmit(instance: any, version: VueVersion, event: string, rawArgs: unknown[], once: boolean): void {
  if (isLogsPaused()) return
  const name = componentName(instance, version)
  const key = `${name}.${event}`
  if (isIgnored('emit', key) || !allowedByRate(instance)) return

  // Masked before the preview is built: the subtitle shows argument values
  const args = getSanitizer().sanitize<unknown[]>(rawArgs.map(serializeArg)).value
  recordLog({
    kind: 'emit',
    key,
    level: 'info',
    title: `${name} @${event}`,
    subtitle: previewArgs(args),
    data: {
      component: name,
      event,
      uid: componentUid(instance, version),
      parents: parentChain(instance, version),
      once,
      args,
    },
  })
}

function safeLog(instance: any, version: VueVersion, event: string, args: unknown[], once: boolean): void {
  try {
    logEmit(instance, version, event, args, once)
  } catch (e) {
    console.error('[injected/logs/emit] log failed:', e)
  }
}

// ============================================================================
// Vue 3
// ============================================================================

function wrapListener(instance: any, key: string, event: string, value: unknown): unknown {
  if (typeof value !== 'function' && !Array.isArray(value)) return value
  if (typeof value === 'function' && ownFunctions.has(value)) return value
  if (Array.isArray(value) && typeof value[0] === 'function' && ownFunctions.has(value[0])) return value

  let cache = wrapCache.get(instance)
  if (!cache) wrapCache.set(instance, (cache = new Map()))
  const cached = cache.get(key)
  if (cached && cached.original === value) return cached.wrapped

  const once = key.endsWith('Once') && !event.endsWith('Once')
  let wrapped: unknown
  if (typeof value === 'function') {
    const original = value as (...a: unknown[]) => unknown
    const fn = function (this: unknown, ...args: unknown[]) {
      safeLog(instance, 3, event, args, once)
      return original.apply(this, args)
    }
    ownFunctions.add(fn)
    wrapped = fn
  } else {
    // Vue calls each array item itself — prepend a logger instead of wrapping the items
    const logger = (...args: unknown[]) => safeLog(instance, 3, event, args, once)
    ownFunctions.add(logger)
    wrapped = [logger, ...(value as unknown[])]
  }
  cache.set(key, { original: value, wrapped })
  return wrapped
}

function wrapVNodeListeners(instance: any, vnode: any): void {
  const props = vnode?.props
  if (!props || typeof props !== 'object') return
  let copy: Record<string, unknown> | null = null
  for (const key of Object.keys(props)) {
    const event = declaredEmitName(instance.emitsOptions, key)
    if (!event) continue
    const value = props[key]
    const next = wrapListener(instance, key, event, value)
    if (next === value) continue
    // Copy: the props object may be shared (e.g. `v-bind="obj"`)
    const target: Record<string, unknown> = copy ?? { ...props }
    target[key] = next
    copy = target
  }
  if (copy) vnode.props = copy
}

function hookVue3(instance: any): void {
  const desc = Object.getOwnPropertyDescriptor(instance, 'vnode')
  if (!desc || !('value' in desc) || !desc.configurable) return
  let current = desc.value
  const wrap = (vnode: any) => {
    try {
      wrapVNodeListeners(instance, vnode)
    } catch (e) {
      console.error('[injected/logs/emit] wrap failed:', e)
    }
  }
  wrap(current)
  Object.defineProperty(instance, 'vnode', {
    configurable: true,
    enumerable: desc.enumerable,
    get: () => current,
    set: (vnode: any) => {
      current = vnode
      wrap(vnode)
    },
  })
}

// ============================================================================
// Vue 2
// ============================================================================

function hookVue2(vm: any): void {
  const original = vm.$emit
  if (typeof original !== 'function' || ownFunctions.has(original)) return
  const patched = function (this: unknown, event: unknown, ...args: unknown[]) {
    if (typeof event === 'string' && !event.startsWith('hook:') && vm._events?.[event]?.length) {
      safeLog(vm, 2, event, args, false)
    }
    return original.call(this, event, ...args)
  }
  ownFunctions.add(patched)
  vm.$emit = patched
}

export function trackEmits(instance: any, version: VueVersion): void {
  if (!instance || typeof instance !== 'object' || hooked.has(instance)) return
  hooked.add(instance)
  try {
    if (version === 3) hookVue3(instance)
    else hookVue2(instance)
  } catch (e) {
    console.error('[injected/logs/emit] hook failed:', e)
  }
}
