<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Star } from 'lucide-vue-next'
import type { TreeNodeModel } from '@/types/tree'
import type { FavoriteItem } from '@/types/inspector'
import { useRuntime } from '@/runtime'
import { isInFavorites } from '@/utils/favoritesMatcher'

const runtime = useRuntime()

const props = defineProps<{
  entries: TreeNodeModel[]
  selectedId: string | null
  favorites?: FavoriteItem[]
}>()

const emit = defineEmits<{
  (e: 'select', node: TreeNodeModel): void
  (e: 'toggleFavorite', node: TreeNodeModel): void
}>()

// Hovered row for showing empty star icon
const hoveredRowId = ref<string | null>(null)

// Check if node is favorite (using same matcher as parent)
function isFavorite(node: TreeNodeModel): boolean {
  if (!props.favorites?.length) return false
  const id = getNodeId(node)
  return isInFavorites(id, props.favorites)
}

// Get unique node identifier - match the format used in favorites
function getNodeId(node: TreeNodeModel): string {
  // Use componentUid if available
  if (node.componentUid) {
    return node.componentUid
  }
  // Fallback to id if it looks like a path (contains ::)
  if (node.id && node.id.includes('::')) {
    return node.id
  }
  // Final fallback
  return `${node.name}::${getElementInfo(node)}`
}

// Get element info string
function getElementInfo(node: TreeNodeModel): string {
  if (node.element) {
    if (node.element instanceof HTMLElement) {
      const tag = node.element.tagName.toLowerCase()
      const cls = node.element.className
        ? '.' + node.element.className.trim().replace(/\s+/g, '.')
        : ''
      return tag + cls
    } else if (node.element.tagName) {
      const tag = node.element.tagName.toLowerCase()
      const cls = node.element.className
        ? '.' + node.element.className.trim().replace(/\s+/g, '.')
        : ''
      return tag + cls
    }
  }
  
  if (node.rootElement?.tagName) {
    const tag = node.rootElement.tagName.toLowerCase()
    const cls = node.rootElement.className
      ? '.' + node.rootElement.className.trim().replace(/\s+/g, '.')
      : ''
    return tag + cls
  }
  
  return 'Logic only'
}

// Truncate element info for display
function truncateElementInfo(info: string): string {
  return info.length > 25 ? info.substring(0, 25) + '...' : info
}

// Get props count
function getPropsCount(node: TreeNodeModel): number {
  return node.props ? Object.keys(node.props).length : 0
}

// Has props
function hasProps(node: TreeNodeModel): boolean {
  return !!node.props && Object.keys(node.props).length > 0
}

// Check if node can be highlighted (has real DOM element)
function canBeHighlighted(node: TreeNodeModel): boolean {
  const elementInfo = getElementInfo(node)
  // Allow highlight if element is not "Logic only" AND has either componentUid or id
  const hasIdentifier = !!(node.componentUid || node.id)
  return hasIdentifier && elementInfo !== 'Logic only'
}

// Sort entries: favorites first, then by name
const sortedEntries = computed(() => {
  return [...props.entries].sort((a, b) => {
    const aFav = isFavorite(a)
    const bFav = isFavorite(b)
    if (aFav && !bFav) return -1
    if (!aFav && bFav) return 1
    return 0
  })
})

const handleRowClick = (node: TreeNodeModel) => {
  if (hasProps(node)) {
    emit('select', node)
  }
}

// Toggle favorite
function handleToggleFavorite(event: Event, node: TreeNodeModel) {
  event.stopPropagation()
  emit('toggleFavorite', node)
}

// Highlight element on hover
async function highlightElement(node: TreeNodeModel) {
  if (!canBeHighlighted(node)) return
  
  // Use componentUid if available, otherwise use id
  const componentPath = node.componentUid || node.id
  if (!componentPath) return
  
  try {
    await runtime.sendMessage({
      type: 'HIGHLIGHT_ELEMENT',
      componentPath
    })
  } catch {
    // Ignore highlight errors
  }
}

// Unhighlight element
async function unhighlightElement() {
  try {
    await runtime.sendMessage({
      type: 'UNHIGHLIGHT_ELEMENT'
    })
  } catch {
    // Ignore unhighlight errors
  }
}

// Handle row mouse enter
function handleRowMouseEnter(node: TreeNodeModel) {
  hoveredRowId.value = node.id
  highlightElement(node)
}

// Handle row mouse leave
function handleRowMouseLeave() {
  hoveredRowId.value = null
  unhighlightElement()
}
</script>

<template>
  <div class="h-full flex flex-col border rounded-lg overflow-hidden">
    <div class="shrink-0 border-b bg-muted/30">
      <Table>
        <TableHeader>
          <TableRow class="hover:bg-transparent">
            <TableHead class="w-10 text-xs font-semibold text-center"></TableHead>
            <TableHead class="text-xs font-semibold text-left">Name</TableHead>
            <TableHead class="w-[140px] text-xs font-semibold text-left">Root Element</TableHead>
            <TableHead class="w-[80px] text-xs font-semibold text-left">Props</TableHead>
          </TableRow>
        </TableHeader>
      </Table>
    </div>
    
    <ScrollArea class="flex-1 min-h-0">
      <Table>
        <TableBody>
          <TableRow
            v-for="node in sortedEntries"
            :key="node.id"
            class="transition-colors"
            :class="{
              'bg-muted': selectedId === node.id,
              'cursor-pointer hover:bg-accent': hasProps(node),
              'opacity-50 cursor-default': !hasProps(node),
              'bg-yellow-50/50 dark:bg-yellow-900/10': isFavorite(node)
            }"
            @click="handleRowClick(node)"
            @mouseenter="handleRowMouseEnter(node)"
            @mouseleave="handleRowMouseLeave"
          >
            <TableCell class="w-10 py-2 text-center">
              <button
                class="p-0.5 rounded hover:bg-accent transition-colors"
                :class="{ 'opacity-0': !isFavorite(node) && hoveredRowId !== node.id }"
                :title="isFavorite(node) ? 'Remove from favorites' : 'Add to favorites'"
                @click="(e) => handleToggleFavorite(e, node)"
              >
                <Star 
                  class="h-3.5 w-3.5 transition-colors"
                  :class="isFavorite(node) 
                    ? 'text-yellow-500 fill-yellow-500' 
                    : 'text-muted-foreground hover:text-yellow-500'"
                />
              </button>
            </TableCell>
            
            <TableCell class="py-2 text-left">
              <div class="truncate text-sm font-medium" :title="node.name">
                {{ node.name }}
              </div>
            </TableCell>
            
            <TableCell class="w-[140px] py-2 text-left">
              <Badge 
                :variant="getElementInfo(node) === 'Logic only' ? 'destructive' : 'secondary'"
                class="text-xs truncate max-w-full"
                :title="getElementInfo(node)"
              >
                {{ truncateElementInfo(getElementInfo(node)) }}
              </Badge>
            </TableCell>
            
            <TableCell class="w-[80px] py-2 text-left">
              <Badge 
                v-if="hasProps(node)"
                variant="outline" 
                class="text-xs font-mono"
              >
                {{ getPropsCount(node) }}
              </Badge>
              <span v-else class="text-xs text-muted-foreground">—</span>
            </TableCell>
          </TableRow>
          
          <TableRow v-if="entries.length === 0">
            <TableCell colspan="4" class="h-32 text-center text-muted-foreground">
              No components found
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </ScrollArea>
  </div>
</template>
