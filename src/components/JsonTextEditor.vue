<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import Prism from 'prismjs'
import 'prismjs/components/prism-json'
import { Copy, Check } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'

const props = defineProps<{
  modelValue: string
  editable?: boolean
  showCopy?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const editedJson = ref(props.modelValue.trim())
const copied = ref(false)

watch(() => props.modelValue, v => {
  editedJson.value = v.trim()
})

const isJsonValid = computed(() => {
  try { JSON.parse(editedJson.value); return true } catch { return false }
})

const codeRef = ref<HTMLElement | null>(null)
const editableRef = ref<HTMLElement | null>(null)

function highlight() {
  nextTick(() => {
    if (codeRef.value && !props.editable) {
      codeRef.value.textContent = editedJson.value
      Prism.highlightElement(codeRef.value)
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
  try {
    const textArea = document.createElement('textarea')
    textArea.value = editedJson.value
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    textArea.style.top = '-999999px'
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
  <div>
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

    <ScrollArea class="h-[330px]">
      <div class="p-2">
        <pre
          v-if="editable"
          ref="editableRef"
          class="json-editor h-full min-h-[300px] p-2 font-mono text-sm leading-relaxed overflow-auto
                 whitespace-pre-wrap break-all
                 bg-transparent outline-none focus:outline-none border rounded
                 cursor-text"
          :style="{
            color: 'hsl(var(--foreground))',
            caretColor: 'hsl(var(--foreground))'
          }"
          contenteditable="plaintext-only"
          @input="onInput"
          @keydown="(e) => e.stopPropagation()"
          spellcheck="false"
          :data-content="editedJson"
        ></pre>

        <pre
          v-else
          class="json-viewer h-full min-h-[300px] p-2 font-mono text-sm leading-relaxed overflow-auto
                 whitespace-pre-wrap break-words"
        ><code ref="codeRef" class="language-json"></code></pre>
      </div>
      <ScrollBar orientation="vertical" />
    </ScrollArea>
  </div>
</template>

<style scoped>
</style>
