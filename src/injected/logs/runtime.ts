/**
 * Logs runtime: the reading side of the compact logs model, shared by the page buffer,
 * the Logs tab and the HTML report.
 *
 * Stored events keep only primary data: the subject id lives in `key` once, titles and
 * subtitles are derived, store changes are diffs against the previous state of the store
 * (`Store initialized` / `Store snapshot` / checkpoint -> diff -> diff ...), props changes
 * keep the new props plus a reverse diff, network events reference a shared network entry.
 * This module restores the full (legacy-shaped) view of an event from that data.
 *
 * `createLogsRuntime` must stay self-contained (no references outside its body, ASCII only):
 * the HTML report embeds its source text and runs it offline.
 */

export interface RuntimeChange {
  path: string
  type: 'added' | 'removed' | 'changed'
  before?: unknown
  after?: unknown
}

export interface RuntimeEvent {
  id: string
  kind: string
  timestamp: number
  key: string
  level: string
  data: Record<string, any>
  size?: number
}

export interface RestoredStates {
  before?: unknown
  after?: unknown
  beforeKnown: boolean
  afterKnown: boolean
}

export interface StoreChains {
  chains: Map<string, RuntimeEvent[]>
  position: Map<RuntimeEvent, number>
}

export interface HydrateContext {
  /** Store events grouped by store, in chronological order */
  stores?: StoreChains
  /** Resolved network entry by id */
  getEntry?: (id: string) => Record<string, any> | undefined
}

export interface HydratedEvent {
  event: RuntimeEvent & { title: string; subtitle?: string; label: string }
  /** Parts of the view that cannot be restored from the stored data */
  missing: { before?: boolean; after?: boolean; state?: boolean; entry?: boolean }
}

export function createLogsRuntime() {
  const MAX_CHANGES = 200
  const MAX_DIFF_DEPTH = 24
  const ARGS_PREVIEW_CHARS = 120
  const MASK = '[MASKED]'
  const IDENT_RE = /^[A-Za-z_$][\w$]*$/
  const IDENT_AT_RE = /[A-Za-z_$][\w$]*/y

  const hasOwn = (obj: object, key: string | number) => Object.prototype.hasOwnProperty.call(obj, key)
  const isObject = (value: unknown): value is Record<string, any> => value !== null && typeof value === 'object'

  // ==========================================================================
  // Paths and plain JSON values
  // ==========================================================================

  function joinPath(parent: string, key: string, parentIsArray: boolean): string {
    if (parentIsArray) return `${parent}[${key}]`
    if (!IDENT_RE.test(key)) return `${parent}[${JSON.stringify(key)}]`
    return parent ? `${parent}.${key}` : key
  }

  /** Inverse of `joinPath`: `a.b[0]["x y"]` -> ['a', 'b', 0, 'x y']; null for a malformed path */
  function parsePath(path: string): Array<string | number> | null {
    if (path === '(root)' || path === '') return []
    const segments: Array<string | number> = []
    let i = 0
    while (i < path.length) {
      const ch = path[i]
      if (ch === '[') {
        if (path[i + 1] === '"') {
          let j = i + 2
          while (j < path.length && path[j] !== '"') j += path[j] === '\\' ? 2 : 1
          if (path[j + 1] !== ']') return null
          try {
            segments.push(JSON.parse(path.slice(i + 1, j + 1)))
          } catch {
            return null
          }
          i = j + 2
        } else {
          const end = path.indexOf(']', i)
          const index = end === -1 ? NaN : Number(path.slice(i + 1, end))
          if (!Number.isInteger(index) || index < 0) return null
          segments.push(index)
          i = end + 1
        }
        continue
      }
      if (ch === '.') {
        if (i === 0) return null
        i++
      } else if (i !== 0) {
        return null
      }
      IDENT_AT_RE.lastIndex = i
      const match = IDENT_AT_RE.exec(path)
      if (!match) return null
      segments.push(match[0])
      i += match[0].length
    }
    return segments
  }

  function getAt(root: unknown, segments: Array<string | number>): { found: boolean; value?: unknown } {
    let current: unknown = root
    for (const segment of segments) {
      if (!isObject(current) || !hasOwn(current, segment)) return { found: false }
      current = current[segment as string]
    }
    return { found: true, value: current }
  }

  function clone<T>(value: T): T {
    if (!isObject(value)) return value
    if (Array.isArray(value)) {
      const out = new Array(value.length)
      for (let i = 0; i < value.length; i++) out[i] = clone(value[i])
      return out as T
    }
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value)) out[key] = clone(value[key])
    return out as T
  }

  /** Placeholder of a value that was not saved (size limit) or saved as a truncated preview */
  function isIncomplete(value: unknown): boolean {
    return isObject(value) && (value.__omitted === true || value.__truncated === true)
  }

  function isComplete(value: unknown): boolean {
    return value !== undefined && !isIncomplete(value)
  }

  // ==========================================================================
  // Diff
  // ==========================================================================

  function walk(before: unknown, after: unknown, path: string, out: RuntimeChange[], depth: number): void {
    if (out.length >= MAX_CHANGES || Object.is(before, after)) return
    if (isObject(before) && isObject(after) && Array.isArray(before) === Array.isArray(after) && depth < MAX_DIFF_DEPTH) {
      const isArray = Array.isArray(before)
      const keys = new Set([...Object.keys(before), ...Object.keys(after)])
      for (const key of keys) {
        const inBefore = hasOwn(before, key)
        const inAfter = hasOwn(after, key)
        if (inBefore && inAfter && Object.is(before[key], after[key])) continue
        const childPath = joinPath(path, key, isArray)
        if (!inBefore) out.push({ path: childPath, type: 'added', after: after[key] })
        else if (!inAfter) out.push({ path: childPath, type: 'removed', before: before[key] })
        else walk(before[key], after[key], childPath, out, depth + 1)
        if (out.length >= MAX_CHANGES) return
      }
      return
    }
    out.push({ path: path || '(root)', type: 'changed', before, after })
  }

  function diffValues(before: unknown, after: unknown): RuntimeChange[] {
    const out: RuntimeChange[] = []
    walk(before, after, '', out, 0)
    return out
  }

  /**
   * Applies `changes` to `root` in place (`revert` undoes them using the `before` values).
   * `root` must be owned by the caller; inserted values are copied. `exact` is false when a
   * value is missing or truncated, or a path cannot be followed.
   */
  function applyChanges(root: unknown, changes: RuntimeChange[], revert: boolean): { root: unknown; exact: boolean } {
    let exact = true
    const list = revert ? changes.slice().reverse() : changes
    for (const change of list) {
      const segments = isObject(change) && typeof change.path === 'string' ? parsePath(change.path) : null
      if (!segments) {
        exact = false
        continue
      }
      const remove = revert ? change.type === 'added' : change.type === 'removed'
      let value: unknown
      if (!remove) {
        const field = revert ? 'before' : 'after'
        if (!hasOwn(change, field)) {
          exact = false
          continue
        }
        value = (change as any)[field]
        if (isIncomplete(value)) exact = false
      }
      if (segments.length === 0) {
        root = remove ? undefined : clone(value)
        continue
      }
      let parent: unknown = root
      for (let i = 0; i < segments.length - 1 && isObject(parent); i++) parent = parent[segments[i] as string]
      // A masked parent hides its children: the masked value already is the result
      if (parent === MASK) continue
      if (!isObject(parent)) {
        exact = false
        continue
      }
      const key = segments[segments.length - 1]
      if (remove) {
        if (Array.isArray(parent) && typeof key === 'number') {
          if (key < parent.length) parent.length = key
        } else {
          delete (parent as Record<string, any>)[key as string]
        }
      } else {
        parent[key as string] = clone(value)
      }
    }
    return { root, exact }
  }

  function summarizeChanges(changes: RuntimeChange[]): string {
    const shown = changes.slice(0, 3).map(c => c.path)
    const rest = changes.length - shown.length
    return rest > 0 ? `${shown.join(', ')} +${rest} more` : shown.join(', ')
  }

  /** Change with `before` / `after` taken from the restored states when they are known */
  function fillChange(change: RuntimeChange, states: RestoredStates): RuntimeChange {
    const out: RuntimeChange = { path: change.path, type: change.type }
    const segments = parsePath(change.path)
    const pick = (field: 'before' | 'after', known: boolean, state: unknown) => {
      if (known && segments) {
        const hit = getAt(state, segments)
        if (hit.found) {
          out[field] = hit.value
          return
        }
      }
      if (hasOwn(change, field)) out[field] = change[field]
    }
    if (change.type !== 'added') pick('before', states.beforeKnown, states.before)
    if (change.type !== 'removed') pick('after', states.afterKnown, states.after)
    return out
  }

  // ==========================================================================
  // Pinia store chain: base (init / snapshot / checkpoint) -> diff -> diff ...
  // ==========================================================================

  function storeOp(event: RuntimeEvent): 'init' | 'snapshot' | 'checkpoint' | 'change' {
    const op = event.data && event.data.op
    return op === 'init' || op === 'snapshot' || op === 'checkpoint' ? op : 'change'
  }

  function isStoreBase(event: RuntimeEvent): boolean {
    return event.kind === 'store' && storeOp(event) !== 'change'
  }

  /** Full state stored by the event (bases, resynced changes, events of version 1 files) */
  function storeAnchor(event: RuntimeEvent): unknown {
    const data = event.data || {}
    if (data.state !== undefined) return data.state
    return data.op === undefined ? data.after : undefined
  }

  function indexStores(events: RuntimeEvent[]): StoreChains {
    const chains = new Map<string, RuntimeEvent[]>()
    const position = new Map<RuntimeEvent, number>()
    for (const event of events) {
      if (event.kind !== 'store') continue
      let chain = chains.get(event.key)
      if (!chain) chains.set(event.key, (chain = []))
      position.set(event, chain.length)
      chain.push(event)
    }
    return { chains, position }
  }

  /**
   * States before / after `chain[i]` for every wanted index, replaying diffs forward from the
   * nearest complete full state. Returned states are shared and must not be mutated.
   */
  function storeStates(chain: RuntimeEvent[], wanted: number[]): Map<number, RestoredStates> {
    const out = new Map<number, RestoredStates>()
    if (wanted.length === 0) return out
    const want = new Set(wanted)
    const first = Math.min(...wanted)
    const last = Math.min(Math.max(...wanted), chain.length - 1)

    let start = 0
    for (let i = Math.min(first, chain.length) - 1; i >= 0; i--) {
      if (isComplete(storeAnchor(chain[i]))) {
        start = i
        break
      }
    }

    let current: unknown
    let known = false
    // Copy-on-write: `current` may be a stored state or a state already handed out
    let shared = true
    for (let i = start; i <= last; i++) {
      const event = chain[i]
      const data = event.data || {}
      const result: RestoredStates | null = want.has(i) ? { beforeKnown: false, afterKnown: false } : null
      if (result && known) {
        result.before = current
        result.beforeKnown = true
        shared = true
      }
      const anchor = storeAnchor(event)
      if (isComplete(anchor)) {
        current = anchor
        known = true
        shared = true
      } else if (storeOp(event) === 'change' && known && Array.isArray(data.changes) && !data.changesTruncated) {
        if (shared) {
          current = clone(current)
          shared = false
        }
        const applied = applyChanges(current, data.changes, false)
        current = applied.root
        known = applied.exact
      } else {
        known = false
      }
      if (result) {
        if (known) {
          result.after = current
          result.afterKnown = true
          shared = true
        }
        out.set(i, result)
      }
    }
    return out
  }

  /** Before / after of one store change, falling back to self-contained data of the event */
  function restoreStoreChange(event: RuntimeEvent, stores?: StoreChains): RestoredStates {
    const data = event.data || {}
    const chain = stores && stores.chains.get(event.key)
    const index = stores ? stores.position.get(event) : undefined
    const states: RestoredStates = chain && index !== undefined
      ? storeStates(chain, [index]).get(index) || { beforeKnown: false, afterKnown: false }
      : { beforeKnown: false, afterKnown: false }
    if (!states.afterKnown && isComplete(storeAnchor(event))) {
      states.after = storeAnchor(event)
      states.afterKnown = true
    }
    if (!states.beforeKnown && isComplete(data.before)) {
      states.before = data.before
      states.beforeKnown = true
    }
    if (!states.beforeKnown && states.afterKnown && Array.isArray(data.changes) && !data.changesTruncated) {
      const reverted = applyChanges(clone(states.after), data.changes, true)
      if (reverted.exact) {
        states.before = reverted.root
        states.beforeKnown = true
      }
    }
    return states
  }

  // ==========================================================================
  // Props: new props + reverse diff (or both snapshots when the diff is not exact)
  // ==========================================================================

  function restoreProps(event: RuntimeEvent): { states: RestoredStates; changes: RuntimeChange[]; truncated: boolean } {
    const data = event.data || {}
    const states: RestoredStates = {
      before: data.before,
      after: data.after,
      beforeKnown: isComplete(data.before),
      afterKnown: isComplete(data.after),
    }
    let changes: RuntimeChange[] = Array.isArray(data.changes) ? data.changes : []
    let truncated = !!data.changesTruncated
    if (!Array.isArray(data.changes) && states.beforeKnown && states.afterKnown) {
      changes = diffValues(states.before, states.after)
      truncated = changes.length >= MAX_CHANGES
    }
    if (!states.beforeKnown && states.afterKnown && !truncated && Array.isArray(data.changes)) {
      const reverted = applyChanges(clone(states.after), changes, true)
      if (reverted.exact) {
        states.before = reverted.root
        states.beforeKnown = true
      }
    }
    return { states, changes, truncated }
  }

  // ==========================================================================
  // Network entries: one entry per request, bodies shared, page-visible headers as indexes
  // ==========================================================================

  function urlName(url: string): string {
    try {
      const parsed = new URL(url)
      const segments = parsed.pathname.split('/').filter(Boolean)
      return segments.length > 0 ? segments[segments.length - 1] : parsed.host
    } catch {
      return String(url || '').substring(0, 50)
    }
  }

  function decodeHeaders(full: unknown, refs: unknown): Array<{ name: string; value: string }> | undefined {
    if (!Array.isArray(refs)) return undefined
    const list = Array.isArray(full) ? full : []
    const out: Array<{ name: string; value: string }> = []
    for (const ref of refs) {
      const header = typeof ref === 'number' ? list[ref] : ref
      if (isObject(header)) out.push(header as { name: string; value: string })
    }
    return out
  }

  /** Full network entry from its stored form; `bodies` resolves body references */
  function resolveEntry(stored: Record<string, any>, bodies: (ref: string) => unknown): Record<string, any> {
    const { requestBodyRef, responseBodyRef, requestHeadersVisible, responseHeadersVisible, ...rest } = stored
    const body = (ref: unknown) => (typeof ref === 'string' ? bodies(ref) ?? null : null)
    const entry: Record<string, any> = {
      ...rest,
      name: rest.name ?? urlName(rest.url),
      requestHeaders: Array.isArray(rest.requestHeaders) ? rest.requestHeaders : [],
      responseHeaders: Array.isArray(rest.responseHeaders) ? rest.responseHeaders : [],
      params: Array.isArray(rest.params) ? rest.params : [],
      authorization: isObject(rest.authorization) ? rest.authorization : { type: 'None' },
      requestBody: body(requestBodyRef),
      responseBody: body(responseBodyRef),
    }
    const requestVisible = decodeHeaders(entry.requestHeaders, requestHeadersVisible)
    const responseVisible = decodeHeaders(entry.responseHeaders, responseHeadersVisible)
    if (requestVisible) entry.requestHeadersPageVisible = requestVisible
    if (responseVisible) entry.responseHeadersPageVisible = responseVisible
    return entry
  }

  const IDENTITY = ['id', 'timestamp', 'method', 'url', 'path', 'name', 'initiator', 'pending']
  const REQUEST_FIELDS = ['requestHeaders', 'requestHeadersPageVisible', 'params', 'authorization', 'requestBody']
  const RESPONSE_FIELDS = ['status', 'statusText', 'duration', 'size', 'error', 'responseHeaders', 'responseHeadersPageVisible', 'responseBody']

  /** "Send request" shows what was sent, "Receive response" what came back */
  function entryPart(entry: Record<string, any>, kind: string): Record<string, any> {
    const out: Record<string, any> = {}
    for (const field of IDENTITY.concat(kind === 'request' ? REQUEST_FIELDS : RESPONSE_FIELDS)) {
      if (entry[field] !== undefined) out[field] = entry[field]
    }
    return out
  }

  function responseStatus(entry: Record<string, any>): string {
    return entry.error ? `Failed: ${entry.error}` : `${entry.status} ${entry.statusText || ''}`.trim()
  }

  // ==========================================================================
  // Derived display fields
  // ==========================================================================

  function previewArgs(args: unknown): string {
    if (!Array.isArray(args) || args.length === 0) return 'no arguments'
    let text: string
    try {
      text = args.map(a => (a === undefined ? 'undefined' : JSON.stringify(a))).join(', ')
    } catch {
      text = `${args.length} argument(s)`
    }
    return text.length > ARGS_PREVIEW_CHARS ? `${text.slice(0, ARGS_PREVIEW_CHARS)}...` : text
  }

  /** `Store.action` key -> store id and action name (store ids may contain dots) */
  function splitActionKey(key: string): { storeId: string; action: string } {
    const dot = key.lastIndexOf('.')
    return dot === -1 ? { storeId: key, action: '' } : { storeId: key.slice(0, dot), action: key.slice(dot + 1) }
  }

  function emitComponent(event: RuntimeEvent): string {
    const data = event.data || {}
    if (typeof data.component === 'string') return data.component
    const suffix = `.${data.event}`
    return event.key.endsWith(suffix) ? event.key.slice(0, -suffix.length) : event.key
  }

  const STORE_OP_LABELS: Record<string, string> = {
    init: 'Store initialized',
    snapshot: 'Store snapshot',
    checkpoint: 'Store checkpoint',
  }

  /** Type label; store bases are shown under their own name inside the "Change store" type */
  function eventLabel(event: RuntimeEvent, kindLabels: Record<string, string>): string {
    if (event.kind === 'store' && isStoreBase(event)) return STORE_OP_LABELS[storeOp(event)]
    return kindLabels[event.kind] || event.kind
  }

  function describe(event: RuntimeEvent, ctx: HydrateContext): { title: string; subtitle?: string } {
    const data = event.data || {}
    const key = String(event.key || '')
    const legacy = event as RuntimeEvent & { title?: unknown; subtitle?: unknown }
    switch (event.kind) {
      case 'store': {
        const op = storeOp(event)
        if (op === 'init') return { title: key, subtitle: 'Initial state of the store' }
        if (op === 'snapshot') return { title: key, subtitle: 'State at the start of observation' }
        if (op === 'checkpoint') return { title: key, subtitle: `Compacted state (${Number(data.compacted) || 0} earlier changes)` }
        return { title: key, subtitle: summarizeChanges(Array.isArray(data.changes) ? data.changes : []) }
      }
      case 'props':
        return { title: key, subtitle: summarizeChanges(restoreProps(event).changes) }
      case 'action': {
        const error = isObject(data.error) ? data.error : null
        return { title: `${key}()`, subtitle: event.level === 'error' || error ? `Error: ${error ? error.message : ''}` : `${data.duration} ms` }
      }
      case 'emit':
        return { title: `${emitComponent(event)} @${data.event}`, subtitle: previewArgs(data.args) }
      case 'navigation':
        return { title: key, subtitle: data.navType }
      case 'error':
        return { title: key, subtitle: data.source }
      case 'request':
      case 'response': {
        const entry = ctx.getEntry ? ctx.getEntry(data.entryId) : undefined
        if (!entry) return { title: typeof legacy.title === 'string' ? legacy.title : key, subtitle: 'Network entry is not available' }
        const title = `${entry.method} ${entry.path || entry.url}`
        return { title, subtitle: event.kind === 'request' ? entry.url : responseStatus(entry) }
      }
    }
    return {
      title: typeof legacy.title === 'string' ? legacy.title : key,
      subtitle: typeof legacy.subtitle === 'string' ? legacy.subtitle : undefined,
    }
  }

  /** Full view of an event: what the UI shows and what Raw displays */
  function hydrate(event: RuntimeEvent, ctx: HydrateContext, kindLabels: Record<string, string>): HydratedEvent {
    const data = event.data || {}
    const missing: HydratedEvent['missing'] = {}
    let full: Record<string, any>

    switch (event.kind) {
      case 'store': {
        const op = storeOp(event)
        if (op !== 'change') {
          full = { storeId: event.key, op, ...(op === 'checkpoint' ? { compacted: Number(data.compacted) || 0 } : {}), state: data.state }
          if (!isComplete(data.state)) missing.state = true
          break
        }
        const states = restoreStoreChange(event, ctx.stores)
        const changes: RuntimeChange[] = Array.isArray(data.changes) ? data.changes : []
        full = {
          storeId: event.key,
          op,
          mutationType: data.mutationType || 'direct',
          actions: Array.isArray(data.actions) ? data.actions : [],
          changes: changes.map(c => fillChange(c, states)),
          changesTruncated: !!data.changesTruncated,
          before: states.beforeKnown ? states.before : data.before,
          after: states.afterKnown ? states.after : storeAnchor(event),
        }
        if (!states.beforeKnown && !isIncomplete(full.before)) missing.before = true
        if (!states.afterKnown && !isIncomplete(full.after)) missing.after = true
        break
      }
      case 'props': {
        const restored = restoreProps(event)
        full = {
          component: typeof data.component === 'string' ? data.component : event.key,
          uid: data.uid,
          parents: data.parents,
          changes: restored.changes.map(c => fillChange(c, restored.states)),
          changesTruncated: restored.truncated,
          before: restored.states.beforeKnown ? restored.states.before : data.before,
          after: data.after,
        }
        if (!restored.states.beforeKnown && !isIncomplete(full.before)) missing.before = true
        if (!restored.states.afterKnown && !isIncomplete(full.after)) missing.after = true
        break
      }
      case 'action': {
        const { storeId, action } = splitActionKey(event.key)
        const failed = event.level === 'error' || isObject(data.error)
        full = {
          storeId: data.storeId ?? storeId,
          action: data.action ?? action,
          args: data.args,
          status: data.status ?? (failed ? 'error' : 'success'),
          ...(failed ? { error: data.error } : { result: data.result }),
          duration: data.duration,
        }
        break
      }
      case 'emit':
        full = { component: emitComponent(event), event: data.event, uid: data.uid, parents: data.parents, once: !!data.once, args: data.args }
        break
      case 'error':
        full = { ...data, message: data.message ?? event.key }
        break
      case 'request':
      case 'response': {
        const entry = ctx.getEntry ? ctx.getEntry(data.entryId) : undefined
        if (!entry) missing.entry = true
        full = { entryId: data.entryId, entry: entry ? entryPart(entry, event.kind) : null }
        break
      }
      default:
        full = data
    }
    if (data.__sizeLimited !== undefined && full.__sizeLimited === undefined) full.__sizeLimited = data.__sizeLimited

    const { title, subtitle } = describe(event, ctx)
    const view: HydratedEvent['event'] = {
      id: event.id,
      kind: event.kind,
      label: eventLabel(event, kindLabels),
      timestamp: event.timestamp,
      key: event.key,
      level: event.level,
      title,
      data: full,
    }
    if (subtitle !== undefined) view.subtitle = subtitle
    return { event: view, missing }
  }

  return {
    MAX_CHANGES,
    MASK,
    joinPath,
    parsePath,
    getAt,
    clone,
    isIncomplete,
    isComplete,
    diffValues,
    applyChanges,
    summarizeChanges,
    storeOp,
    isStoreBase,
    storeAnchor,
    indexStores,
    storeStates,
    restoreStoreChange,
    restoreProps,
    fillChange,
    resolveEntry,
    entryPart,
    responseStatus,
    urlName,
    previewArgs,
    splitActionKey,
    eventLabel,
    describe,
    hydrate,
  }
}

export type LogsRuntime = ReturnType<typeof createLogsRuntime>

export const logsRuntime: LogsRuntime = createLogsRuntime()
