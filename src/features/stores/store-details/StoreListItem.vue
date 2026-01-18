<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from '@/components/ui/badge'

const props = defineProps<{
  store: {
    baseId?: string
    stateKeys?: number
    getterKeys?: number
    lastUpdatedFormatted?: string
  }
}>()

const emit = defineEmits<{
  select: []
}>()

const handleClick = () => {
  emit('select')
}

// Отображаем имя элемента
const displayName = computed(() => props.store.baseId || 'Unknown Store')

// Проверяем наличие данных для отображения бейджей
const hasState = computed(() => (props.store.stateKeys || 0) > 0)
const hasGetters = computed(() => (props.store.getterKeys || 0) > 0)
</script>

<template>
  <div
    class="p-3 rounded-md border cursor-pointer transition-colors hover:bg-accent"
    @click="handleClick"
  >
    <div class="flex items-center justify-between">
      <div class="font-medium text-sm">
        {{ displayName }}
      </div>
      <div class="flex gap-1">
        <Badge v-if="hasState" variant="secondary" class="text-xs border">
          State
        </Badge>
        <Badge v-if="hasGetters" variant="secondary" class="text-xs border">
          Getter
        </Badge>
      </div>
    </div>
  </div>
</template>
