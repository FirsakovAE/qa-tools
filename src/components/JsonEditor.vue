<script setup lang="ts">
import { computed } from 'vue'
import JsonTextEditor from './JsonTextEditor.vue'
import JsonEditorReadOnlyLarge from './JsonEditorReadOnlyLarge.vue'
import { JsonEditor as UiJsonEditor } from '@/components/ui/JsonEditor'

/**
 * Only fall back to the lightweight `<pre>` viewer for non-JSON content
 * (XML/HTML/plain text) above this size — Prism-based highlighting is
 * very slow on huge inputs. JSON of any size goes through
 * vanilla-jsoneditor, which virtualises tree-mode rendering (only the
 * first 100 items of each array are materialised) and supports docs
 * up to ~512 MB per the library docs.
 */
const LARGE_NON_JSON_THRESHOLD = 500 * 1024

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

defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'edit'): void
  (e: 'cancel'): void
  (e: 'save'): void
}>()

const isJsonLanguage = computed(() => props.language === 'json')
const valueLength = computed(() => props.modelValue?.length ?? 0)

const effectiveMode = computed<'text' | 'tree'>(() => props.mode ?? 'text')

/** vanilla-jsoneditor handles only JSON; fall back to Prism-based editor for other content. */
const useVanillaEditor = computed(() => isJsonLanguage.value)

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
