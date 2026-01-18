<script setup lang="ts">
import type { TreeNodeModel } from '@/types/tree'

// 👇 props
const props = defineProps<{
  tree: TreeNodeModel[]
}>()

// 👇 emit selection
const emit = defineEmits<{
  (e: 'select', node: TreeNodeModel): void
}>()
</script>

<template>
  <slot
    name="list"
    :onSelect="(node: TreeNodeModel) => emit('select', node)"
  />
</template>
