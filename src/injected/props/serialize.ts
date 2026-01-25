// src/injected/props/serialize.ts

/**
 * 📐 Props Serialization with CPU Protection
 * 
 * Key protections:
 * 1. TIME_BUDGET - abort if serialization takes too long (prevents main thread blocking)
 * 2. MAX_NODES - limit total serialized nodes per call
 * 3. visited.add() BEFORE Object.keys - protect from self-recursive getters
 * 4. Depth/size limits for all structures
 */

// ============================================================================
// Configuration
// ============================================================================

/** Maximum time budget for serialization (ms) - prevents UI blocking */
const SERIALIZE_TIME_BUDGET_MS = 8

/** Maximum depth for object serialization to prevent stack overflow */
const MAX_DEPTH = 12

/** Maximum array length to serialize */
const MAX_ARRAY_LENGTH = 50

/** Maximum object keys to serialize */
const MAX_OBJECT_KEYS = 30

/** Maximum string length for values */
const MAX_STRING_LENGTH = 500

/** Maximum ref unwrapping depth to prevent infinite loops with nested refs */
const MAX_REF_UNWRAP_DEPTH = 5

/** Maximum total nodes to serialize in one call */
const MAX_NODES_PER_CALL = 500

// ============================================================================
// Serialization Context (passed through recursion)
// ============================================================================

interface SerializationContext {
  visited: WeakSet<object>
  startTime: number
  nodeCount: number
  timedOut: boolean
  nodeLimit: boolean
}

function createContext(visited?: WeakSet<object>): SerializationContext {
  return {
    visited: visited ?? new WeakSet(),
    startTime: performance.now(),
    nodeCount: 0,
    timedOut: false,
    nodeLimit: false
  }
}

/**
 * Check if we should abort serialization due to time/node limits
 */
function shouldAbort(ctx: SerializationContext): boolean {
  // Already marked as timed out
  if (ctx.timedOut || ctx.nodeLimit) return true
  
  // Check time budget (only every 50 nodes to reduce overhead)
  if (ctx.nodeCount % 50 === 0) {
    if (performance.now() - ctx.startTime > SERIALIZE_TIME_BUDGET_MS) {
      ctx.timedOut = true
      return true
    }
  }
  
  // Check node limit
  if (ctx.nodeCount >= MAX_NODES_PER_CALL) {
    ctx.nodeLimit = true
    return true
  }
  
  return false
}

/**
 * Increment node count and check limits
 */
function trackNode(ctx: SerializationContext): boolean {
  ctx.nodeCount++
  return !shouldAbort(ctx)
}

// ============================================================================
// Type Checks (fast, no side effects)
// ============================================================================

/**
 * Check if a value is a DOM node (fast check without instanceof)
 */
function isDOMNode(value: any): boolean {
  if (!value || typeof value !== 'object') return false
  return typeof value.nodeType === 'number'
}

/**
 * Check if value is a Vue ref
 */
function isVueRef(value: any): boolean {
  return value && value.__v_isRef === true
}

/**
 * Check if value is a Vue reactive proxy
 */
function isVueReactive(value: any): boolean {
  return value && (value.__v_isReactive === true || value.__v_isReadonly === true)
}

// ============================================================================
// Safe Value Access
// ============================================================================

/**
 * Safely access object keys with timeout protection
 * Returns empty array if access fails or takes too long
 */
function safeGetKeys(value: any, ctx: SerializationContext): string[] {
  if (shouldAbort(ctx)) return []
  
  try {
    return Object.keys(value)
  } catch {
    return []
  }
}

/**
 * Safely access property value
 * Returns undefined if access fails
 */
function safeGetProperty(obj: any, key: string): any {
  try {
    return obj[key]
  } catch {
    return undefined
  }
}

// ============================================================================
// Primitive Serialization
// ============================================================================

function truncateString(str: string): string {
  if (str.length <= MAX_STRING_LENGTH) return str
  return str.substring(0, MAX_STRING_LENGTH) + '...[truncated]'
}

function serializePrimitive(value: any): any {
  if (value === null || value === undefined) return value
  
  const type = typeof value
  if (type === 'string') return truncateString(value)
  if (type === 'number' || type === 'boolean') return value
  if (type === 'bigint') return value.toString() + 'n'
  if (type === 'symbol') return value.toString()
  
  return value
}

// ============================================================================
// Vue Ref Unwrapping (with depth limit)
// ============================================================================

function unwrapRef(value: any, maxDepth: number = MAX_REF_UNWRAP_DEPTH): any {
  let current = value
  let depth = 0
  
  while (current && isVueRef(current) && depth < maxDepth) {
    try {
      current = current.value
    } catch {
      return '[Ref access error]'
    }
    depth++
  }
  
  if (depth >= maxDepth) {
    return '[Ref depth exceeded]'
  }
  
  return current
}

// ============================================================================
// Collection Serialization
// ============================================================================

function serializeMap(map: Map<any, any>, ctx: SerializationContext, depth: number): Record<string, any> {
  if (!trackNode(ctx)) return { __type: 'Map', __timeout: true }
  
  const result: Record<string, any> = { __type: 'Map', entries: [] }
  let count = 0
  
  try {
    for (const [key, value] of map) {
      if (shouldAbort(ctx) || count >= MAX_ARRAY_LENGTH) {
        result.truncated = true
        break
      }
      
      const serializedKey = typeof key === 'object' ? '[Object]' : String(key)
      const serializedValue = serializeValue(value, ctx, depth + 1)
      result.entries.push([serializedKey, serializedValue])
      count++
    }
  } catch {
    result.error = true
  }
  
  return result
}

function serializeSet(set: Set<any>, ctx: SerializationContext, depth: number): Record<string, any> {
  if (!trackNode(ctx)) return { __type: 'Set', __timeout: true }
  
  const result: Record<string, any> = { __type: 'Set', values: [] }
  let count = 0
  
  try {
    for (const value of set) {
      if (shouldAbort(ctx) || count >= MAX_ARRAY_LENGTH) {
        result.truncated = true
        break
      }
      
      result.values.push(serializeValue(value, ctx, depth + 1))
      count++
    }
  } catch {
    result.error = true
  }
  
  return result
}

function serializeArray(arr: any[], ctx: SerializationContext, depth: number): any[] {
  if (!trackNode(ctx)) return ['[Serialization timeout]']
  
  const result: any[] = []
  const length = Math.min(arr.length, MAX_ARRAY_LENGTH)
  
  for (let i = 0; i < length; i++) {
    if (shouldAbort(ctx)) {
      result.push('[Serialization timeout]')
      break
    }
    
    const item = arr[i]
    
    // Skip non-serializable items
    if (typeof item === 'function' || isDOMNode(item)) continue
    if (typeof item === 'object' && item !== null && ctx.visited.has(item)) {
      result.push('[Circular]')
      continue
    }
    
    const serialized = serializeValue(item, ctx, depth + 1)
    if (serialized !== undefined) {
      result.push(serialized)
    }
  }
  
  if (arr.length > MAX_ARRAY_LENGTH) {
    result.push(`...[${arr.length - MAX_ARRAY_LENGTH} more items]`)
  }
  
  return result
}

// ============================================================================
// Object Serialization (CRITICAL: visited.add BEFORE Object.keys)
// ============================================================================

function serializeObject(value: any, ctx: SerializationContext, depth: number): Record<string, any> {
  if (!trackNode(ctx)) return { __timeout: true }
  
  const result: Record<string, any> = {}
  let keyCount = 0
  
  // 🔥 CRITICAL: Add to visited BEFORE accessing any properties
  // This protects from self-recursive getters
  ctx.visited.add(value)
  
  // Now safe to get keys
  const keys = safeGetKeys(value, ctx)
  
  for (const key of keys) {
    if (shouldAbort(ctx)) {
      result.__timeout = true
      break
    }
    
    if (keyCount >= MAX_OBJECT_KEYS) {
      result.__truncated = true
      break
    }
    
    // Skip Vue internal and private properties
    if (key.startsWith('__v_') || key.startsWith('_')) continue
    
    // Safe property access
    const propValue = safeGetProperty(value, key)
    if (propValue === undefined) continue
    
    // Skip functions and DOM nodes
    if (typeof propValue === 'function' || isDOMNode(propValue)) continue
    
    // Handle circular references
    if (typeof propValue === 'object' && propValue !== null && ctx.visited.has(propValue)) {
      result[key] = '[Circular]'
      keyCount++
      continue
    }
    
    const serialized = serializeValue(propValue, ctx, depth + 1)
    if (serialized !== undefined) {
      result[key] = serialized
      keyCount++
    }
  }
  
  return result
}

// ============================================================================
// Main Serialization Function
// ============================================================================

function serializeValue(value: any, ctx: SerializationContext, depth: number): any {
  // Check abort conditions first
  if (shouldAbort(ctx)) {
    return ctx.timedOut ? '[Serialization timeout]' : '[Too many nodes]'
  }
  
  // Handle primitives (fast path)
  if (value === null || value === undefined) return value
  if (typeof value !== 'object' && typeof value !== 'function') {
    return serializePrimitive(value)
  }
  
  // Skip functions
  if (typeof value === 'function') return undefined
  
  // Check depth limit
  if (depth > MAX_DEPTH) return '[Max depth exceeded]'
  
  // Fast DOM check
  if (isDOMNode(value)) return undefined
  
  // Check for circular references BEFORE any processing
  if (ctx.visited.has(value)) return '[Circular]'
  
  // Handle Vue refs - add to visited BEFORE unwrapping
  if (isVueRef(value)) {
    ctx.visited.add(value)
    
    const unwrapped = unwrapRef(value)
    if (typeof unwrapped === 'string' && unwrapped.startsWith('[')) {
      return unwrapped // Error message
    }
    
    return serializeValue(unwrapped, ctx, depth + 1)
  }
  
  // Handle special types (these are safe to access)
  if (value instanceof Date) {
    trackNode(ctx)
    return value.toISOString()
  }
  if (value instanceof RegExp) {
    trackNode(ctx)
    return value.toString()
  }
  if (value instanceof Error) {
    trackNode(ctx)
    return { __type: 'Error', message: value.message, name: value.name }
  }
  if (value instanceof Map) {
    ctx.visited.add(value)
    return serializeMap(value, ctx, depth)
  }
  if (value instanceof Set) {
    ctx.visited.add(value)
    return serializeSet(value, ctx, depth)
  }
  
  // Skip non-serializable types
  if (value instanceof WeakMap || value instanceof WeakSet || value instanceof Promise) {
    return undefined
  }
  
  // Handle arrays
  if (Array.isArray(value)) {
    ctx.visited.add(value)
    return serializeArray(value, ctx, depth)
  }
  
  // Handle plain objects and Vue reactive proxies
  return serializeObject(value, ctx, depth)
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Serializes props with CPU protection.
 * 
 * Features:
 * - Time budget (8ms default) - prevents UI blocking
 * - Node limit - prevents infinite traversal
 * - Circular reference detection
 * - Vue ref/reactive unwrapping
 * - Depth limiting
 * 
 * @param props - Object props to serialize
 * @param visited - Optional WeakSet for tracking visited objects
 * @returns Serialized props object
 */
export function serializeProps(props: any, visited?: WeakSet<object>): any {
  // Handle null/undefined
  if (props === null || props === undefined) {
    return props
  }
  
  // Handle primitives
  if (typeof props !== 'object') {
    return serializePrimitive(props)
  }
  
  // Create context with time budget
  const ctx = createContext(visited)
  
  // Serialize with all protections
  return serializeValue(props, ctx, 0)
}

/**
 * Lightweight check if a value can be safely serialized
 */
export function canSerialize(value: any): boolean {
  if (value === null || value === undefined) return true
  
  const type = typeof value
  if (type === 'string' || type === 'number' || type === 'boolean') return true
  if (type === 'function' || type === 'symbol' || type === 'bigint') return false
  
  if (type !== 'object') return false
  if (isDOMNode(value)) return false
  if (value instanceof WeakMap || value instanceof WeakSet || value instanceof Promise) return false
  
  return true
}

/**
 * Get serialization stats for debugging
 */
export function getSerializationStats(props: any): { nodeCount: number; timedOut: boolean; duration: number } {
  const ctx = createContext()
  serializeValue(props, ctx, 0)
  
  return {
    nodeCount: ctx.nodeCount,
    timedOut: ctx.timedOut || ctx.nodeLimit,
    duration: performance.now() - ctx.startTime
  }
}
