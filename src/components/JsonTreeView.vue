<script setup lang="ts">
import { computed, provide, ref } from 'vue'
import JsonTreeNode from './JsonTreeNode.vue'

const props = defineProps<{
  value: any
  editable?: boolean
}>()

const emit = defineEmits<{
  (e: 'commit', value: any): void
}>()

// Глобальное состояние для отслеживания редактируемого элемента
const editingElement = ref<string | null>(null)

// Функции для управления редактированием
function startEditing(elementId: string) {
  editingElement.value = elementId
}

function stopEditing() {
  editingElement.value = null
}

function isEditing(elementId: string) {
  return editingElement.value === elementId
}

// Предоставляем функции дочерним компонентам
provide('treeEditing', {
  startEditing,
  stopEditing,
  isEditing
})

const isObject = computed(() => {
  return typeof props.value === 'object' && props.value !== null && !Array.isArray(props.value)
})

const isArray = computed(() => {
  return Array.isArray(props.value)
})

const rootChildren = computed(() => {
  if (isArray.value) {
    return props.value.map((item: any, index: number) => ({
      key: index.toString(),
      value: item,
      isArrayItem: true
    }))
  }
  if (isObject.value) {
    return Object.entries(props.value).map(([key, value]) => ({
      key,
      value,
      isArrayItem: false
    }))
  }
  return []
})

function handleItemUpdate(itemKey: string, newValue: any) {
  const updated = { ...props.value }

  if (isArray.value) {
    const index = parseInt(itemKey)
    updated[index] = newValue
  } else {
    updated[itemKey] = newValue
  }

  emit('commit', updated)
}
</script>

<template>
  <div class="json-tree-view">
    <!-- Opening brace -->
    <div class="text-base leading-relaxed font-normal text-muted-foreground mb-1">
      {{ isArray ? '[' : '{' }}
    </div>

    <!-- Content -->
    <div class="ml-4">
      <JsonTreeNode
        v-for="child in rootChildren"
        :key="child.key"
        :key-name="child.isArrayItem ? child.key : child.key"
        :value="child.value"
        :level="0"
        :is-array-item="child.isArrayItem"
        :editable="editable"
        @update:value="handleItemUpdate(child.key, $event)"
      />
    </div>

    <!-- Closing brace -->
    <div class="text-base leading-relaxed font-normal text-muted-foreground mt-1">
      {{ isArray ? ']' : '}' }}
    </div>
  </div>
</template>
