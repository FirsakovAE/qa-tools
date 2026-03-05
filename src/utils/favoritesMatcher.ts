// src/utils/favoritesMatcher.ts

/**
 * Extracts stable identifier parts from a componentUid for favorites matching.
 * 
 * Supported formats:
 * 1. New format: "uid:123" - numeric UID only
 * 2. Legacy format: "path::name::uid::selector::text:content"
 * 3. Name format: "ComponentName::element.class"
 * 
 * Stable parts are: name, selector, text content
 * Unstable parts are: path (can change with DOM structure), uid (changes on reload)
 */
export interface StableFavoriteId {
  /** Component name (e.g., "ORButton") */
  name: string
  /** DOM selector (e.g., "div.deal-content > div.container > ...") */
  selector: string | null
  /** Text content (e.g., "Сформировать АПП") */
  textContent: string | null
  /** Original full id for backwards compatibility */
  originalId: string
  /** Numeric UID (new format) */
  numericUid: number | null
}

/**
 * Parse componentUid into stable parts
 */
export function parseComponentUid(componentUid: string): StableFavoriteId {
  // Handle new "uid:123" format
  if (componentUid.startsWith('uid:')) {
    const uidStr = componentUid.substring(4)
    const numericUid = parseInt(uidStr, 10)
    return {
      name: '',
      selector: null,
      textContent: null,
      originalId: componentUid,
      numericUid: isNaN(numericUid) ? null : numericUid
    }
  }

  const parts = componentUid.split('::')
  
  // Default values
  let name = ''
  let selector: string | null = null
  let textContent: string | null = null
  
  // Handle "ComponentName::element.class" format (simple format)
  if (parts.length === 2 && !parts[0].includes('[') && !parts[0].includes('.')) {
    name = parts[0]
    selector = parts[1]
    return {
      name,
      selector,
      textContent,
      originalId: componentUid,
      numericUid: null
    }
  }
  
  if (parts.length >= 2) {
    // parts[0] is the path (e.g., "root[2].subTree.children[0]...")
    // parts[1] is the component name (e.g., "ORButton")
    name = parts[1]
  }
  
  // Find selector part (starts with element selector pattern)
  // Look for parts that look like CSS selectors: start with tag or contain " > "
  for (let i = 2; i < parts.length; i++) {
    const part = parts[i]
    
    // Skip the UID part (usually just a number or starts with "anon_")
    if (/^\d+$/.test(part) || part.startsWith('anon_')) {
      continue
    }
    
    // Check if this looks like a selector
    if (part.includes(' > ') || part.startsWith('#') || 
        (part.includes('.') && !part.startsWith('text:'))) {
      selector = part
      continue
    }
    
    // Check for text content
    if (part.startsWith('text:')) {
      textContent = part.substring(5) // Remove "text:" prefix
    }
  }
  
  return {
    name,
    selector,
    textContent,
    originalId: componentUid,
    numericUid: null
  }
}

/**
 * Generate a stable identifier string from parsed parts.
 * This ID is stable across page reloads.
 */
export function generateStableFavoriteId(parsed: StableFavoriteId): string {
  // For numeric UIDs, return the original format
  if (parsed.numericUid !== null) {
    return `uid:${parsed.numericUid}`
  }
  
  const parts: string[] = []
  
  if (parsed.name) {
    parts.push(parsed.name)
  }
  
  if (parsed.selector) {
    parts.push(parsed.selector)
  }
  
  if (parsed.textContent) {
    parts.push(`text:${parsed.textContent}`)
  }
  
  return parts.join('::')
}

/**
 * Generate a stable favorite ID from a componentUid
 */
export function getStableFavoriteId(componentUid: string): string {
  const parsed = parseComponentUid(componentUid)
  return generateStableFavoriteId(parsed)
}

/**
 * Check if two favorite IDs match (comparing stable parts)
 */
export function matchFavoriteIds(id1: string, id2: string): boolean {
  if (id1 === id2) {
    return true
  }
  
  const parsed1 = parseComponentUid(id1)
  const parsed2 = parseComponentUid(id2)
  
  // Both are numeric UIDs — only match if identical (same session)
  if (parsed1.numericUid !== null && parsed2.numericUid !== null) {
    return parsed1.numericUid === parsed2.numericUid
  }
  
  // One is numeric UID, other is stable — cannot match by id alone
  // (metadata-based matching is handled in findMatchingFavorite)
  if (parsed1.numericUid !== null || parsed2.numericUid !== null) {
    return false
  }
  
  if (!parsed1.name || !parsed2.name) {
    return false
  }
  
  if (parsed1.name !== parsed2.name) {
    return false
  }
  
  if (parsed1.selector && parsed2.selector) {
    if (parsed1.selector !== parsed2.selector) {
      return false
    }
  }
  
  if (parsed1.textContent && parsed2.textContent) {
    if (parsed1.textContent !== parsed2.textContent) {
      return false
    }
  }
  
  const hasEnoughInfo1 = parsed1.name && (parsed1.selector || parsed1.textContent)
  const hasEnoughInfo2 = parsed2.name && (parsed2.selector || parsed2.textContent)
  
  if (hasEnoughInfo1 && hasEnoughInfo2) {
    return true
  }
  
  const stable1 = generateStableFavoriteId(parsed1)
  const stable2 = generateStableFavoriteId(parsed2)
  
  return stable1 === stable2
}

/**
 * Build a stable identifier from FavoriteItem metadata.
 * Used to match old favorites stored with unstable "uid:XXX" ids.
 */
function buildStableIdFromMeta(fav: { name?: string; tagName?: string; className?: string }): string | null {
  if (!fav.name) return null
  const tag = fav.tagName?.toLowerCase() || 'div'
  const cls = fav.className ? '.' + fav.className.trim().replace(/\s+/g, '.') : ''
  return `${fav.name}::${tag}${cls}`
}

/**
 * Find a matching favorite in the list.
 * Supports metadata-based matching for legacy favorites stored with "uid:XXX" ids.
 */
export function findMatchingFavorite(
  componentUid: string,
  favorites: Array<{ id: string; name?: string; tagName?: string; className?: string }>
): { id: string } | undefined {
  for (const fav of favorites) {
    if (matchFavoriteIds(componentUid, fav.id)) {
      return fav
    }
  }

  // Migration: for favorites stored with unstable "uid:XXX",
  // try to match using metadata (name + tagName + className)
  const parsed = parseComponentUid(componentUid)
  if (parsed.numericUid !== null || !parsed.name) {
    return undefined
  }

  for (const fav of favorites) {
    if (!fav.id.startsWith('uid:')) continue
    const stableFromMeta = buildStableIdFromMeta(fav)
    if (stableFromMeta && matchFavoriteIds(componentUid, stableFromMeta)) {
      return fav
    }
  }

  return undefined
}

/**
 * Check if a component is in favorites (using stable matching)
 */
export function isInFavorites(
  componentUid: string,
  favorites: Array<{ id: string; name?: string; tagName?: string; className?: string }>
): boolean {
  return findMatchingFavorite(componentUid, favorites) !== undefined
}
