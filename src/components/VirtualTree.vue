<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import { FixedSizeList as List } from 'vue-virtual-scroll'
import TreeNode from '@/features/props/prop-details/TreeNode.vue'
import type { TreeNodeModel } from '@/types/tree'

const props = defineProps<{
  nodes: TreeNodeModel[]
  itemHeight?: number
}>()

const emit = defineEmits<{
  select: [node: TreeNodeModel]
}>()

const containerRef = ref()
const itemHeight = props.itemHeight || 40

// Плоский список для виртуализации
const flatNodes = ref<any[]>([])

// Преобразование дерева в плоский список с учетом раскрытия
function flattenTree(nodes: TreeNodeModel[], depth = 0): any[] {
  const result: any[] = []

  nodes.forEach(node => {
    result.push({
      ...node,
      depth,
      isLeaf: !node.children || node.children.length === 0,
      expanded: false
    })

    // Рекурсивно добавляем детей
    if (node.children && node.children.length > 0) {
      const children = flattenTree(node.children, depth + 1)
      result.push(...children)
    }
  })

  return result
}

// Обновляем плоский список только при реальных изменениях
let lastNodeHash = ''
function updateFlatNodes() {
  const currentHash = JSON.stringify(props.nodes.map(n => n.id))

  if (currentHash === lastNodeHash) {
    return
  }

  lastNodeHash = currentHash
  flatNodes.value = flattenTree(props.nodes)
}

// Инициализация и обновления
updateFlatNodes()
watch(() => props.nodes, updateFlatNodes, { deep: true })

// Обработчик выбора
function handleSelect(node: TreeNodeModel) {
  emit('select', node)
}

onUnmounted(() => {
  // Очистка
  flatNodes.value = []
})
</script>

<template>
  <div ref="containerRef" class="h-full">
    <List
        v-if="flatNodes.length > 0"
        :item-size="itemHeight"
        :item-count="flatNodes.length"
        :width="'100%'"
        :height="380"
        class="virtual-tree"
    >
      <template #default="{ index, style }">
        <div :style="style" class="virtual-item">
          <TreeNode
              :node="flatNodes[index]"
              :depth="flatNodes[index].depth"
              @select="handleSelect"
          />
        </div>
      </template>
    </List>
    <div v-else class="h-full flex items-center justify-center text-muted-foreground">
      No components found
    </div>
  </div>
</template>

<style scoped>
.virtual-tree {
  overflow-x: hidden !important;
}

.virtual-item {
  padding: 0 8px;
}
</style>