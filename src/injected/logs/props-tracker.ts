/**
 * Component tracker: logs props changes and emits (Vue 3 and Vue 2).
 *
 * Every mounted component gets a beforeUpdate hook and emit tracking (periodic tree scan
 * picks up new components; an updated hook walks the subtree of an updated component so
 * newly mounted children are tracked without waiting for the scan).
 * At beforeUpdate the new props are already applied, so the previous shallow copy is
 * "before" and the current props are "after". Changes are confirmed by a diff of
 * serialized values — re-created inline objects/handlers with equal content are not logged.
 */

import { findVueRoots } from '../props/vue-detect'
import { serializeRawPropsForDeclared } from '../props/serialize'
import { diffValues, limitChanges, summarizeChanges, MAX_CHANGES } from './diff'
import { isIgnored, isLogsPaused, onLogsStateChanged, recordLog } from './core'
import { componentName, parentChain } from './component-utils'
import { trackEmits } from './emit-tracker'

const SCAN_INTERVAL_MS = 2000
const ROOTS_REFRESH_MS = 15000
const SUBTREE_WALK_DELAY_MS = 50
const MAX_EVENTS_PER_COMPONENT_PER_SEC = 30

type RootRef = { version: 2 | 3; instance: any }

const tracked = new WeakSet<object>()
const lastProps = new WeakMap<object, Record<string, unknown>>()
const rate = new WeakMap<object, { start: number; count: number }>()
let roots: RootRef[] = []
let rootsFoundAt = 0
let scanTimer: ReturnType<typeof setInterval> | null = null
let initialized = false
const pendingWalks = new Map<object, 2 | 3>()
let walkTimer: ReturnType<typeof setTimeout> | null = null

function rawProps(instance: any, version: 2 | 3): Record<string, unknown> | null {
  const props = version === 3 ? instance?.props : instance?._props
  if (!props || typeof props !== 'object') return null
  return (props.__v_raw ?? props) as Record<string, unknown>
}

function shallowCopy(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(obj)) out[key] = obj[key]
  return out
}

function hasShallowChange(prev: Record<string, unknown>, next: Record<string, unknown>): boolean {
  const prevKeys = Object.keys(prev)
  const nextKeys = Object.keys(next)
  if (prevKeys.length !== nextKeys.length) return true
  for (const key of nextKeys) {
    if (!Object.is(prev[key], next[key])) return true
  }
  return false
}

function allowedByRate(instance: object): boolean {
  const now = Date.now()
  const r = rate.get(instance)
  if (!r || now - r.start > 1000) {
    rate.set(instance, { start: now, count: 1 })
    return true
  }
  r.count++
  return r.count <= MAX_EVENTS_PER_COMPONENT_PER_SEC
}

function onBeforeUpdate(instance: any, version: 2 | 3): void {
  const next = rawProps(instance, version)
  if (!next) return
  const prev = lastProps.get(instance)
  if (!prev || isLogsPaused()) {
    lastProps.set(instance, shallowCopy(next))
    return
  }
  if (!hasShallowChange(prev, next)) return
  lastProps.set(instance, shallowCopy(next))

  const name = componentName(instance, version)
  if (isIgnored('props', name) || !allowedByRate(instance)) return

  const before = serializeRawPropsForDeclared(prev)
  const after = serializeRawPropsForDeclared(next)
  const changes = diffValues(before, after)
  if (changes.length === 0) return

  const uid = version === 3 ? instance.uid : instance._uid
  const parents = parentChain(instance, version)
  recordLog({
    kind: 'props',
    key: name,
    level: 'info',
    title: name,
    subtitle: summarizeChanges(changes),
    data: {
      component: name,
      uid,
      parents,
      changes: limitChanges(changes),
      changesTruncated: changes.length >= MAX_CHANGES,
      before,
      after,
    },
  })
}

function attach(instance: any, version: 2 | 3): void {
  if (!instance || typeof instance !== 'object' || tracked.has(instance)) return
  tracked.add(instance)

  const props = rawProps(instance, version)
  if (props) lastProps.set(instance, shallowCopy(props))

  trackEmits(instance, version)

  const hook = () => {
    try {
      onBeforeUpdate(instance, version)
    } catch (e) {
      console.error('[injected/logs/props] beforeUpdate hook failed:', e)
    }
  }
  const updatedHook = () => scheduleSubtreeWalk(instance, version)

  try {
    if (version === 3) {
      if (Array.isArray(instance.bu)) instance.bu.push(hook)
      else instance.bu = [hook]
      if (Array.isArray(instance.u)) instance.u.push(updatedHook)
      else instance.u = [updatedHook]
    } else if (typeof instance.$on === 'function') {
      instance.$on('hook:beforeUpdate', hook)
      instance.$on('hook:updated', updatedHook)
    }
  } catch (e) {
    console.error('[injected/logs/props] attach failed:', e)
  }
}

function scheduleSubtreeWalk(instance: object, version: 2 | 3): void {
  if (isLogsPaused()) return
  pendingWalks.set(instance, version)
  if (walkTimer) return
  walkTimer = setTimeout(() => {
    walkTimer = null
    const batch = [...pendingWalks]
    pendingWalks.clear()
    try {
      for (const [inst, v] of batch) {
        if (v === 3) walkVue3(inst)
        else walkVue2(inst)
      }
    } catch (e) {
      console.error('[injected/logs/props] subtree walk failed:', e)
    }
  }, SUBTREE_WALK_DELAY_MS)
}

function walkVue3(root: any): void {
  const stack: any[] = [root.vnode ?? root.subTree]
  attach(root, 3)
  while (stack.length > 0) {
    const vnode = stack.pop()
    if (!vnode || typeof vnode !== 'object') continue
    const component = vnode.component
    if (component) {
      attach(component, 3)
      if (component.subTree) stack.push(component.subTree)
      continue
    }
    if (vnode.suspense?.activeBranch) stack.push(vnode.suspense.activeBranch)
    if (Array.isArray(vnode.children)) {
      for (const child of vnode.children) {
        if (child && typeof child === 'object') stack.push(child)
      }
    }
  }
}

function walkVue2(root: any): void {
  const stack: any[] = [root]
  while (stack.length > 0) {
    const vm = stack.pop()
    if (!vm) continue
    attach(vm, 2)
    if (Array.isArray(vm.$children)) stack.push(...vm.$children)
  }
}

function refreshRoots(): void {
  const found: RootRef[] = []
  const seen = new Set<any>()
  for (const el of findVueRoots() as any[]) {
    let ref: RootRef | null = null
    // `app._instance` exists only in dev / prod-devtools builds
    const app = el.__vue_app__
    const vue3Root = app?._instance ?? app?._container?._vnode?.component ?? el._vnode?.component
    if (vue3Root) ref = { version: 3, instance: vue3Root }
    else if (el.__vue__) ref = { version: 2, instance: el.__vue__.$root ?? el.__vue__ }
    if (ref && !seen.has(ref.instance)) {
      seen.add(ref.instance)
      found.push(ref)
    }
  }
  roots = found
  rootsFoundAt = Date.now()
}

function scan(): void {
  if (isLogsPaused() || document.hidden) return
  try {
    if (roots.length === 0 || Date.now() - rootsFoundAt > ROOTS_REFRESH_MS) refreshRoots()
    for (const root of roots) {
      if (root.version === 3) walkVue3(root.instance)
      else walkVue2(root.instance)
    }
  } catch (e) {
    console.error('[injected/logs/props] scan failed:', e)
  }
}

export function initPropsLogs(): void {
  if (initialized) return
  initialized = true
  scan()
  scanTimer = setInterval(scan, SCAN_INTERVAL_MS)
  onLogsStateChanged(scan)
}

export function cleanupPropsLogs(): void {
  if (scanTimer) clearInterval(scanTimer)
  scanTimer = null
  if (walkTimer) clearTimeout(walkTimer)
  walkTimer = null
  pendingWalks.clear()
  roots = []
  initialized = false
}
