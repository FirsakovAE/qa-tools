<script setup lang="ts">
import { computed } from 'vue'
import JsonTextEditor from './JsonTextEditor.vue'
import JsonTreeEditor from './JsonTreeEditor.vue'
import JsonEditorReadOnlyLarge from './JsonEditorReadOnlyLarge.vue'

/** For read-only payloads larger than this, use lightweight view (no Prism, no tree) */
const LARGE_READ_THRESHOLD = 500 * 1024

const props = withDefaults(defineProps<{
  modelValue: string
  editable?: boolean
  showCopy?: boolean
  mode?: 'text' | 'tree'
  fullHeight?: boolean
  language?: string
}>(), {
  fullHeight: false,
  language: 'json'
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'edit'): void
  (e: 'cancel'): void
  (e: 'save'): void
}>()

const mode = computed(() => props.mode ?? 'text')
const useTreeMode = computed(() => mode.value === 'tree' && props.language === 'json')

/** Use lightweight read-only view for large payloads to avoid DOM overload */
const useLargeReadOnly = computed(
  () => !props.editable && props.modelValue.length > LARGE_READ_THRESHOLD
)
</script>

<template>
  <div 
    class="relative json-viewer-wrapper rounded"
    :class="fullHeight ? 'h-full flex flex-col' : 'min-h-[350px]'"
  >
    <JsonEditorReadOnlyLarge
      v-if="useLargeReadOnly"
      :model-value="modelValue"
      :full-height="fullHeight"
    />
    <component
      v-else
      :is="useTreeMode ? JsonTreeEditor : JsonTextEditor"
      :model-value="modelValue"
      :editable="editable"
      :show-copy="showCopy"
      :full-height="fullHeight"
      :language="language"
      @update:modelValue="$emit('update:modelValue', $event)"
    />
  </div>
</template>
