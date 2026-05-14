<script setup lang="ts">
import { computed } from 'vue'
import JsonTextEditor from './JsonTextEditor.vue'
import JsonEditorReadOnlyLarge from './JsonEditorReadOnlyLarge.vue'
import { JsonEditor as UiJsonEditor } from '@/components/ui/JsonEditor'

/**
 * JSON: either Prism `JsonTextEditor` (Classic) or vanilla-jsoneditor
 * (JSONEditor), per settings. Tree/text for the library is toggled in its
 * toolbar. Non-JSON uses `JsonTextEditor` or, for huge read-only payloads,
 * `JsonEditorReadOnlyLarge` — Prism is slow on very large fragments.
 */
const LARGE_NON_JSON_THRESHOLD = 500 * 1024

const props = withDefaults(defineProps<{
  modelValue: string
  editable?: boolean
  showCopy?: boolean
  /** Only for JSON + JSONEditor backend: vanilla-jsoneditor text vs tree. */
  mode?: 'text' | 'tree'
  /** Classic = Prism `JsonTextEditor`; JSONEditor = vanilla-jsoneditor. */
  editor?: 'classic' | 'jsoneditor'
  fullHeight?: boolean
  language?: string
}>(), {
  fullHeight: false,
  editor: 'jsoneditor',
  language: 'json'
})

defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'update:mode', value: 'text' | 'tree'): void
  (e: 'edit'): void
  (e: 'cancel'): void
  (e: 'save'): void
}>()

const isJsonLanguage = computed(() => props.language === 'json')
const valueLength = computed(() => props.modelValue?.length ?? 0)

const effectiveMode = computed<'text' | 'tree'>(() => props.mode ?? 'text')

/** vanilla-jsoneditor only for JSON when JSONEditor backend is chosen. */
const useVanillaEditor = computed(
  () => isJsonLanguage.value && props.editor !== 'classic',
)

/** Lightweight read-only view only for *non-JSON* huge content. */
const useLargeReadOnly = computed(
  () =>
    !useVanillaEditor.value
    && !props.editable
    && valueLength.value > LARGE_NON_JSON_THRESHOLD,
)
</script>

<template>
  <div
    class="relative json-viewer-wrapper rounded"
    :class="fullHeight ? 'h-full flex flex-col' : 'min-h-[350px]'"
  >
    <UiJsonEditor
      v-if="useVanillaEditor"
      :model-value="modelValue"
      :editable="editable"
      :show-copy="showCopy"
      :mode="effectiveMode"
      :full-height="fullHeight"
      @update:model-value="$emit('update:modelValue', $event)"
      @update:mode="$emit('update:mode', $event)"
    />
    <JsonEditorReadOnlyLarge
      v-else-if="useLargeReadOnly"
      :model-value="modelValue"
      :full-height="fullHeight"
    />
    <JsonTextEditor
      v-else
      :model-value="modelValue"
      :editable="editable"
      :show-copy="showCopy"
      :full-height="fullHeight"
      :language="language"
      @update:model-value="$emit('update:modelValue', $event)"
    />
  </div>
</template>
