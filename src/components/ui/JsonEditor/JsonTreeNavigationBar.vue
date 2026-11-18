<script setup lang="ts">
/**
 * Vue replacement for vanilla-jsoneditor’s `.jse-navigation-bar` (tree mode).
 * Breadcrumb mirrors focus path; path string edit opens from a pencil control
 * (`parseJSONPath` / `stringifyJSONPath`).
 */
import type { JSONPath } from 'immutable-json-patch'
import { ChevronRight, Copy, Pencil, X } from 'lucide-vue-next'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from '@/i18n'
import { ScrollAreaRoot, ScrollAreaViewport } from 'reka-ui'
import { parseJSONPath, stringifyJSONPath } from 'vanilla-jsoneditor'

import { Button } from '@/components/ui/button'
import ScrollBar from '@/components/ui/scroll-area/ScrollBar.vue'
import { copyToClipboard } from '@/utils/networkUtils'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    focusPath: JSONPath
    /** Show pencil / path editor (navigation only; not document edit mode). */
    pathEditable?: boolean
    /** If set, path navigation from the text field is applied only when this returns true. */
    validatePath?: (path: JSONPath) => boolean
  }>(),
  { pathEditable: true },
)

const emit = defineEmits<{
  navigate: [path: JSONPath]
}>()

const segments = computed(() => {
  const p = props.focusPath
  const out: { prefix: JSONPath, label: string }[] = []
  out.push({ prefix: [], label: t('editor.jsonRoot') })
  for (let i = 0; i < p.length; i++) {
    const prefix = p.slice(0, i + 1) as JSONPath
    out.push({ prefix, label: String(p[i]) })
  }
  return out
})

const pathInput = ref('')
const editingPath = ref(false)
const pathInputRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.focusPath,
  (fp) => {
    pathInput.value = stringifyJSONPath(fp)
  },
  { immediate: true, deep: true },
)

function openPathEditor() {
  pathInput.value = stringifyJSONPath(props.focusPath)
  editingPath.value = true
  void nextTick(() => {
    const el = pathInputRef.value
    if (!el) return
    el.focus()
    const len = el.value.length
    el.setSelectionRange(len, len)
  })
}

function cancelPathEdit() {
  pathInput.value = stringifyJSONPath(props.focusPath)
  editingPath.value = false
}

function submitPathInput() {
  const raw = pathInput.value.trim()
  try {
    const p = raw === '' ? ([] as JSONPath) : parseJSONPath(raw)
    if (props.validatePath != null && !props.validatePath(p)) {
      pathInput.value = stringifyJSONPath(props.focusPath)
      return
    }
    emit('navigate', p)
    editingPath.value = false
  } catch {
    pathInput.value = stringifyJSONPath(props.focusPath)
  }
}

function onPathKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    submitPathInput()
  }
  else if (e.key === 'Escape') {
    e.preventDefault()
    cancelPathEdit()
  }
}

async function copyPathToClipboard() {
  await copyToClipboard(pathInput.value)
}
</script>

<template>
  <nav
    class="json-tree-navigation-bar flex min-h-[28px] shrink-0 items-center gap-1 border-x border-border bg-muted/40 px-1.5 py-0.5 text-xs"
    :aria-label="t('editor.jsonPath')"
  >
    <template v-if="!editingPath">
      <ScrollAreaRoot class="relative min-h-7 h-7 min-w-0 flex-1 overflow-hidden">
        <ScrollAreaViewport class="h-full w-full rounded-[inherit]">
          <div class="flex w-max flex-nowrap items-center gap-0.5 py-px">
            <template v-for="(item, i) in segments" :key="`${i}:${item.label}`">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                class="h-7 shrink-0 whitespace-nowrap px-2 font-normal text-foreground text-xs"
                :class="i === segments.length - 1 ? 'font-medium' : ''"
                :title="stringifyJSONPath(item.prefix)"
                @click="emit('navigate', item.prefix)"
              >
                {{ item.label }}
              </Button>
              <ChevronRight
                v-if="i < segments.length - 1"
                class="size-3.5 shrink-0 text-muted-foreground opacity-70"
                aria-hidden="true"
              />
            </template>
          </div>
        </ScrollAreaViewport>
        <ScrollBar orientation="horizontal" />
      </ScrollAreaRoot>

      <Button
        v-if="pathEditable"
        type="button"
        variant="ghost"
        size="sm"
        class="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-foreground"
        :title="t('editor.editPath')"
        :aria-label="t('editor.editPath')"
        @click="openPathEditor"
      >
        <Pencil class="size-3.5" />
      </Button>
    </template>

    <template v-else>
      <input
        ref="pathInputRef"
        v-model="pathInput"
        type="text"
        class="min-h-7 min-w-0 flex-1 rounded-md border border-border bg-input px-2 py-1 font-mono text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        spellcheck="false"
        autocapitalize="off"
        autocomplete="off"
        :placeholder="t('editor.pathPh')"
        :title="t('editor.pathTip')"
        @keydown="onPathKeydown"
      />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        class="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-foreground"
        :title="t('common.cancel')"
        :aria-label="t('editor.cancelPath')"
        @click="cancelPathEdit"
      >
        <X class="size-3.5" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        class="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-foreground"
        :title="t('editor.copyPath')"
        :aria-label="t('editor.copyPath')"
        @click="copyPathToClipboard"
      >
        <Copy class="size-3.5" />
      </Button>
    </template>
  </nav>
</template>
