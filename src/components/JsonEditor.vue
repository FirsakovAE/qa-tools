<script setup lang="ts">
import { computed } from 'vue'
import JsonTextEditor from './JsonTextEditor.vue'
import JsonTreeEditor from './JsonTreeEditor.vue'

const props = withDefaults(defineProps<{
  modelValue: string
  editable?: boolean
  showCopy?: boolean
  mode?: 'text' | 'tree'
  fullHeight?: boolean
}>(), {
  fullHeight: false
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'edit'): void
  (e: 'cancel'): void
  (e: 'save'): void
}>()

const mode = computed(() => props.mode ?? 'text')
</script>

<template>
  <div 
    class="relative json-viewer-wrapper rounded"
    :class="fullHeight ? 'h-full flex flex-col' : 'min-h-[350px]'"
  >
    <component
      :is="mode === 'tree' ? JsonTreeEditor : JsonTextEditor"
      :model-value="modelValue"
      :editable="editable"
      :show-copy="showCopy"
      :full-height="fullHeight"
      @update:modelValue="$emit('update:modelValue', $event)"
    />
  </div>
</template>
