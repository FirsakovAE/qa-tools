<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import Prism from 'prismjs'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-markup'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-javascript'
import { Copy, Check } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'

// Skip Prism highlighting for payloads larger than this (bytes).
// Prism wraps every token in a <span>, which creates 10k+ DOM nodes on big JSON
// and freezes the UI. Plain text rendering is instant regardless of size.
const HIGHLIGHT_SIZE_LIMIT = 200 * 1024

const PRISM_LANG_MAP: Record<string, string> = {
  json: 'json',
  xml: 'markup',
  html: 'markup',
  css: 'css',
  javascript: 'javascript',
}

const props = withDefaults(defineProps<{
  modelValue: string
  editable?: boolean
  showCopy?: boolean
  fullHeight?: boolean
  language?: string
}>(), {
  fullHeight: false,
  language: 'json'
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const editedJson = ref(props.modelValue.trim())
const copied = ref(false)

watch(() => props.modelValue, v => {
  editedJson.value = v.trim()
  highlight()
})

const isLargePayload = computed(() => editedJson.value.length > HIGHLIGHT_SIZE_LIMIT)

const prismLang = computed(() => PRISM_LANG_MAP[props.language] || null)
const prismClass = computed(() => prismLang.value ? `language-${prismLang.value}` : '')

const isJsonValid = computed(() => {
  if (props.language !== 'json') return true
  try { JSON.parse(editedJson.value); return true } catch { return false }
})

const codeRef = ref<HTMLElement | null>(null)
const editableRef = ref<HTMLElement | null>(null)

function highlight() {
  nextTick(() => {
    if (codeRef.value && !props.editable) {
      codeRef.value.textContent = editedJson.value
      codeRef.value.className = prismClass.value
      if (!isLargePayload.value && prismLang.value) {
        Prism.highlightElement(codeRef.value)
      }
    }
  })
}

function updateEditableContent() {
  nextTick(() => {
    if (editableRef.value && props.editable) {
      editableRef.value.textContent = editedJson.value
    }
  })
}

onMounted(() => {
  highlight()
  updateEditableContent()
})

watch(() => props.editable, () => {
  highlight()
  updateEditableContent()
})

function copyToClipboard() {
  let textToCopy = editedJson.value

  if (props.language === 'json' && textToCopy.length <= HIGHLIGHT_SIZE_LIMIT) {
    try {
      const parsed = JSON.parse(textToCopy)
      if (typeof parsed === 'object' && parsed !== null) {
        textToCopy = JSON.stringify(parsed, null, 2)
      }
    } catch { /* keep original */ }
  }

  try {
    const textArea = document.createElement('textarea')
    textArea.value = textToCopy
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    textArea.style.top = '-999999px'
    textArea.style.opacity = '0'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    const success = document.execCommand('copy')
    document.body.removeChild(textArea)

    if (success) {
      copied.value = true
      setTimeout(() => copied.value = false, 1500)
    }
  } catch {
    // Silently fail if copy doesn't work
  }
}

function onInput(e: Event) {
  editedJson.value = (e.target as HTMLElement).textContent || ''
  emit('update:modelValue', editedJson.value)
}
</script>

<template>
  <div :class="fullHeight ? 'h-full flex flex-col' : ''">
    <Button
      v-if="showCopy && !editable"
      variant="ghost"
      size="sm"
      class="absolute top-2 right-2 z-10 gap-1 text-xs pointer-events-auto bg-transparent hover:bg-transparent active:bg-transparent focus-visible:ring-0"
      @click="copyToClipboard"
    >
      <component :is="copied ? Check : Copy" class="w-4 h-4" />
      {{ copied ? 'Copied' : 'Copy' }}
    </Button>

    <ScrollArea :class="[fullHeight ? 'flex-1 min-h-0 full-height-scroll' : 'h-[330px]']">
      <div :class="['p-2', fullHeight ? 'min-h-full w-full' : '']">
        <pre
          v-if="editable"
          ref="editableRef"
          class="json-editor font-sans leading-relaxed
                 whitespace-pre-wrap break-all
                 bg-transparent outline-none focus:outline-none
                 cursor-text"
          :class="fullHeight ? 'min-h-full' : 'min-h-[300px]'"
          :style="{
            color: 'hsl(var(--foreground))',
            caretColor: 'hsl(var(--foreground))'
          }"
          contenteditable="plaintext-only"
          @input="onInput"
          @keydown="(e: KeyboardEvent) => { if (e.key !== 'Escape') e.stopPropagation() }"
          spellcheck="false"
          :data-content="editedJson"
        ></pre>

        <pre
          v-else
          class="json-viewer p-2 leading-relaxed
                 whitespace-pre-wrap break-words"
          :class="[
            fullHeight ? 'min-h-full' : 'min-h-[300px]',
            isLargePayload && 'json-viewer--plain'
          ]"
        ><code ref="codeRef" :class="prismClass"></code></pre>
      </div>
      <ScrollBar orientation="vertical" />
    </ScrollArea>
  </div>
</template>

<style scoped>
.full-height-scroll :deep([data-reka-scroll-area-viewport] > div) {
  min-height: 100%;
  width: 100%;
}
</style>
