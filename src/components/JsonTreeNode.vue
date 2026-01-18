<script setup lang="ts">
import { ref, computed, inject, onMounted, onUnmounted } from 'vue'
import { ChevronRight, ChevronDown } from 'lucide-vue-next'


const props = defineProps<{
  keyName: string
  value: any
  level: number
  isArrayItem?: boolean
  editable?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:value', value: any): void
}>()

// Инъектируем функции управления редактированием
const treeEditing = inject<{
  startEditing: (elementId: string) => void
  stopEditing: () => void
  isEditing: (elementId: string) => boolean
}>('treeEditing')

const isExpanded = ref(false)
const isEditing = ref(false)
const editValue = ref('')

// Создаем уникальный ID для элемента
const elementId = computed(() => `${props.level}-${props.keyName}`)

// Проверяем, редактируется ли этот элемент
const isElementEditing = computed(() => {
  return treeEditing ? treeEditing.isEditing(elementId.value) : isEditing.value
})

// Обработчик клика вне input для завершения редактирования
function handleClickOutside(event: MouseEvent) {
  if (isElementEditing.value) {
    const target = event.target as HTMLElement
    // Проверяем, что клик не внутри нашего input
    if (!target.closest('input')) {
      // Просто завершаем редактирование без сохранения
      if (treeEditing) {
        treeEditing.stopEditing()
      } else {
        isEditing.value = false
      }
    }
  }
}

// Добавляем/удаляем слушатель клика
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

const isObject = computed(() => {
  return typeof props.value === 'object' && props.value !== null && !Array.isArray(props.value)
})

const isArray = computed(() => {
  return Array.isArray(props.value)
})

const isPrimitive = computed(() => {
  return !isObject.value && !isArray.value
})

const hasChildren = computed(() => {
  if (isArray.value) return props.value.length > 0
  if (isObject.value) return Object.keys(props.value).length > 0
  return false
})

const displayValue = computed(() => {
  if (isPrimitive.value) {
    if (typeof props.value === 'string') return `"${props.value}"`
    return String(props.value)
  }
  if (isArray.value) return `Array(${props.value.length})`
  if (isObject.value) return `Object(${Object.keys(props.value).length})`
  return 'null'
})

const children = computed(() => {
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

function startEdit() {
  if (!props.editable) return

  if (treeEditing) {
    treeEditing.startEditing(elementId.value)
  } else {
    isEditing.value = true
  }
  editValue.value = isPrimitive.value ? String(props.value) : JSON.stringify(props.value, null, 2)
}

function commitEdit() {
  if (!isElementEditing.value) return

  try {
    let newValue: any

    if (typeof props.value === 'string') {
      // Remove quotes if present for string editing
      const cleanValue = editValue.value.replace(/^["']|["']$/g, '')
      newValue = cleanValue
    } else if (typeof props.value === 'number') {
      const numValue = Number(editValue.value)
      if (isNaN(numValue)) {
        throw new Error('Invalid number')
      }
      newValue = numValue
    } else if (typeof props.value === 'boolean') {
      const lowerValue = editValue.value.toLowerCase()
      if (lowerValue !== 'true' && lowerValue !== 'false') {
        throw new Error('Invalid boolean')
      }
      newValue = lowerValue === 'true'
    } else {
      // Try to parse as JSON for complex values
      newValue = JSON.parse(editValue.value)
    }

    emit('update:value', newValue)
    if (treeEditing) {
      treeEditing.stopEditing()
    } else {
      isEditing.value = false
    }
  } catch (error) {
    console.error('Invalid value:', error)
    // Не сохраняем невалидное значение, просто выходим из режима редактирования
    if (treeEditing) {
      treeEditing.stopEditing()
    } else {
      isEditing.value = false
    }
  }
}

function cancelEdit() {
  if (treeEditing) {
    treeEditing.stopEditing()
  } else {
    isEditing.value = false
  }
}

function toggleExpanded() {
  if ((isObject.value || isArray.value) && hasChildren.value) {
    isExpanded.value = !isExpanded.value
  }
}

function updateChildValue(childKey: string, newValue: any) {
  const updated = { ...props.value }

  if (isArray.value) {
    const index = parseInt(childKey)
    updated[index] = newValue
  } else {
    updated[childKey] = newValue
  }

  emit('update:value', updated)
}
</script>

<template>
  <div class="json-tree-node">
    <div
      class="flex items-start gap-1 hover:bg-accent/50"
      :class="{ 'cursor-pointer': (isObject || isArray) && hasChildren }"
      :style="{ paddingLeft: `${level * 16}px` }"
      @click="(isObject || isArray) && hasChildren && !isElementEditing ? toggleExpanded() : undefined"
    >
      <!-- Expand/collapse icon placeholder (always reserve space) -->
      <div class="w-4 h-4 flex-shrink-0 flex items-center justify-center self-center">
        <component
          :is="isExpanded ? ChevronDown : ChevronRight"
          v-if="(isObject || isArray) && hasChildren"
          class="w-4 h-4 text-muted-foreground fill-current"
        />
      </div>

      <!-- Key -->
      <span class="text-base leading-relaxed font-normal text-muted-foreground min-w-0">
        {{ keyName }}:
      </span>

      <!-- Value editing/input -->
      <input
        v-if="isElementEditing"
        v-model="editValue"
        class="flex-1 bg-background border rounded text-base leading-relaxed font-normal min-w-0"
        @blur="commitEdit"
        @keyup.enter="commitEdit"
        @keyup.escape="cancelEdit"
        @click.stop
      />

      <!-- Value display -->
      <span
        v-else
        class="text-base leading-relaxed font-normal flex-1 min-w-0"
        :class="{
          'text-green-500': typeof value === 'string',
          'text-blue-500': typeof value === 'number',
          'text-amber-500': typeof value === 'boolean',
          'text-red-500': value === null,
          'text-gray-500': value === undefined,
          'cursor-pointer': (isObject || isArray) ? true : (isPrimitive && editable)
        }"
        @click.stop="(isObject || isArray) ? toggleExpanded() : (isPrimitive && editable) ? startEdit() : undefined"
      >
        {{ displayValue }}
      </span>
    </div>

    <!-- Children -->
    <div v-if="isExpanded && (isObject || isArray)">
      <JsonTreeNode
        v-for="child in children"
        :key="child.key"
        :key-name="child.isArrayItem ? child.key : child.key"
        :value="child.value"
        :level="level + 1"
        :is-array-item="child.isArrayItem"
        :editable="editable"
        @update:value="updateChildValue(child.key, $event)"
      />
    </div>

  </div>
</template>
