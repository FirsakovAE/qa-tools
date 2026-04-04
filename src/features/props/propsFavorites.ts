import type { TreeNodeModel } from '@/types/tree'
import type { FavoriteItem } from '@/types/inspector'
import { matchFavoriteIds } from '@/utils/favoritesMatcher'
import { getElementInfo } from './types'

/**
 * Same stable id as PropsTab rows / toggle favorite (componentUid, legacy path with ::, or name + DOM hint).
 */
export function getPropsFavoriteNodeId(node: TreeNodeModel): string {
  if (node.componentUid) return node.componentUid
  if (node.id && node.id.includes('::')) return node.id
  return `${node.name}::${getElementInfo(node)}`
}

/**
 * Whether this node gets the star in Props, matching {@link PropsTab} updateFavoriteFlags:
 * when several rows share the same stable favorite match, only the one tied by nodeId
 * (or the single / first candidate) is marked.
 */
export function isPropsRowResolvedFavorite(
  node: TreeNodeModel,
  favorites: FavoriteItem[],
  allRows: TreeNodeModel[]
): boolean {
  if (!favorites.length) return false
  const getId = getPropsFavoriteNodeId

  for (const fav of favorites) {
    if (!matchFavoriteIds(getId(node), fav.id)) continue

    const candidates = allRows.filter((r) => matchFavoriteIds(getId(r), fav.id))
    if (candidates.length === 0) continue

    if (!candidates.some((c) => c.id === node.id)) continue

    let marked: TreeNodeModel
    if (candidates.length === 1) {
      marked = candidates[0]
    } else if (fav.nodeId) {
      const exact = candidates.find((r) => r.id === fav.nodeId)
      marked = exact ?? candidates[0]
    } else {
      marked = candidates[0]
    }

    if (marked.id === node.id) return true
  }
  return false
}
